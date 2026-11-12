// Sends a Cem SEO user's Clients (and their audits) into the user's own Pipelume workspace.
// Nothing is sent unless the user linked a workspace. Every public function here is safe to call
// without await and never throws, so it can never break a Cem SEO request.
//
// Server settings (Render): PIPELUME_URL (the Pipelume Supabase project URL) and PIPELUME_ANON_KEY (its public anon key).
// The per-user connector key is stored encrypted with a key derived from PIPELUME_LINK_SECRET (or JWT_SECRET).
const crypto = require("crypto");
const db = require("../db");

const SOURCE = "cem_seo_client";
const KEY_RE = /^plk_[0-9a-f]{64}$/;

const baseUrl = () => String(process.env.PIPELUME_URL || "").replace(/\/+$/, "");
const anonKey = () => process.env.PIPELUME_ANON_KEY || "";
const isConfigured = () => !!(baseUrl() && anonKey());

function secretKey() {
  const s = process.env.PIPELUME_LINK_SECRET || process.env.JWT_SECRET || "dev-secret";
  return crypto.createHash("sha256").update("pipelume-link:" + s).digest();
}
function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}
function decrypt(blob) {
  const [iv, tag, enc] = String(blob).split(".").map((p) => Buffer.from(p, "base64url"));
  const d = crypto.createDecipheriv("aes-256-gcm", secretKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Calls a Pipelume (Supabase) function. Retries network errors, 429 and 5xx.
async function rpc(fn, body, { timeoutMs = 8000, retries = 2 } = {}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), timeoutMs);
      const res = await fetch(`${baseUrl()}/rest/v1/rpc/${fn}`, {
        method: "POST",
        signal: ctl.signal,
        headers: { apikey: anonKey(), Authorization: "Bearer " + anonKey(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      clearTimeout(t);
      const data = await res.json().catch(() => null);
      if (res.ok) return { ok: true, data };
      if (res.status < 500 && res.status !== 429) return { ok: false, status: res.status, message: (data && data.message) || "rejected " + res.status };
      last = { ok: false, status: res.status, message: "server " + res.status };
    } catch (e) {
      last = { ok: false, status: 0, message: e.name === "AbortError" ? "timeout" : e.message };
    }
    if (attempt < retries) await sleep(300 * 2 ** attempt);
  }
  return last;
}

async function checkKey(key) {
  if (!isConfigured() || !KEY_RE.test(String(key || ""))) return false;
  const r = await rpc("check_api_key", { p_key: key }, { retries: 1 });
  return r.ok && r.data === true;
}

async function saveLink(userId, key) {
  await db.query(
    `INSERT INTO pipelume_links (user_id, key_enc, connected_at, last_error) VALUES ($1, $2, NOW(), NULL)
     ON CONFLICT (user_id) DO UPDATE SET key_enc = EXCLUDED.key_enc, connected_at = NOW(), last_error = NULL`,
    [userId, encrypt(key)]
  );
}
async function getLink(userId) {
  const { rows } = await db.query(
    `SELECT key_enc, connected_at AS "connectedAt", last_sync_at AS "lastSyncAt", last_error AS "lastError" FROM pipelume_links WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}
async function removeLink(userId) {
  await db.query("DELETE FROM pipelume_links WHERE user_id = $1", [userId]);
}

function clientContact(client, domains, event) {
  const c = {
    source: SOURCE,
    external_id: "client:" + client.id,
    full_name: client.name,
    email: client.contact_email || undefined,
    custom: { cem_seo_client_id: client.id, sites: domains },
  };
  if (event) c.event = event;
  return c;
}

// Sends one contact using the user's stored key. If Pipelume says the key was revoked, the link is removed.
async function push(userId, contact, link) {
  link = link || (await getLink(userId));
  if (!link || !isConfigured()) return { skipped: true };
  const r = await rpc("ingest_contact", { p_key: decrypt(link.key_enc), p_contact: contact });
  if (r.ok) {
    await db.query("UPDATE pipelume_links SET last_sync_at = NOW(), last_error = NULL WHERE user_id = $1", [userId]);
    return { ok: true };
  }
  if (r.status === 401 || r.status === 403 || /invalid api key/i.test(r.message || "")) {
    await removeLink(userId);
    return { error: "key_revoked" };
  }
  await db.query("UPDATE pipelume_links SET last_error = $1 WHERE user_id = $2", [String(r.message).slice(0, 300), userId]);
  return { error: r.message };
}

async function loadClient(userId, clientId) {
  const { rows } = await db.query("SELECT id, name, contact_email FROM clients WHERE id = $1 AND user_id = $2", [clientId, userId]);
  if (!rows[0]) return null;
  const { rows: sites } = await db.query("SELECT domain FROM projects WHERE client_id = $1 AND user_id = $2 ORDER BY id", [clientId, userId]);
  return { client: rows[0], domains: sites.map((s) => s.domain) };
}

async function syncClientNow(userId, clientId, event, link) {
  const c = await loadClient(userId, clientId);
  if (!c) return { skipped: true };
  return push(userId, clientContact(c.client, c.domains, event), link);
}

async function syncAllNow(userId) {
  const link = await getLink(userId);
  if (!link) return { synced: 0 };
  const { rows } = await db.query("SELECT id FROM clients WHERE user_id = $1 ORDER BY id", [userId]);
  let synced = 0;
  for (const row of rows) {
    const r = await syncClientNow(userId, row.id, null, link);
    if (r.error === "key_revoked") break;
    if (r.ok) synced++;
  }
  return { synced, total: rows.length };
}

async function auditNow(userId, projectId, audit) {
  const link = await getLink(userId);
  if (!link) return { skipped: true };
  const { rows } = await db.query("SELECT client_id, domain FROM projects WHERE id = $1 AND user_id = $2", [projectId, userId]);
  if (!rows[0] || !rows[0].client_id) return { skipped: true };
  const event = {
    kind: "audit",
    body: `Audit on ${rows[0].domain}: health score ${audit.healthScore}, ${audit.criticalIssues} critical issue${audit.criticalIssues === 1 ? "" : "s"}`,
    meta: { domain: rows[0].domain, healthScore: audit.healthScore, criticalIssues: audit.criticalIssues },
  };
  return syncClientNow(userId, rows[0].client_id, event, link);
}

const safe = (fn) => (...args) => {
  Promise.resolve()
    .then(() => fn(...args))
    .catch((e) => console.error("[pipelume]", e.message));
};

module.exports = {
  isConfigured,
  checkKey,
  saveLink,
  getLink,
  removeLink,
  syncAllNow,
  syncClientNow,
  auditNow,
  // fire-and-forget versions for use inside other routes
  syncClient: safe((userId, clientId) => syncClientNow(userId, clientId)),
  onAudit: safe(auditNow),
  syncAll: safe(syncAllNow),
  _test: { encrypt, decrypt, KEY_RE },
};
