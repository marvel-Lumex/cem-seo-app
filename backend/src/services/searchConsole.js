const db = require("../db");

const OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GSC_SITES_URL = "https://www.googleapis.com/webmasters/v3/sites";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

function isConfigured() {
  return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

function getRedirectUri() {
  return process.env.GOOGLE_OAUTH_REDIRECT_URI || "http://localhost:4000/api/gsc/callback";
}

// The "state" param round-trips through Google's OAuth flow unmodified, so
// we use it to remember which user/project this connection is for when the
// browser redirect lands back on our /callback route (which has no auth
// header of its own). Base64-encoded JSON — not cryptographically signed,
// which is a reasonable simplification for now but worth hardening
// (e.g. HMAC-signing the state) before real public launch.
function encodeState(userId, projectId) {
  return Buffer.from(JSON.stringify({ userId, projectId, nonce: Date.now() })).toString("base64url");
}

function decodeState(state) {
  try {
    return JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function buildAuthUrl(userId, projectId) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state: encodeState(userId, projectId),
  });
  return `${OAUTH_AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(code) {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return res.json(); // { access_token, refresh_token, expires_in, ... }
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  return res.json(); // { access_token, expires_in, ... }
}

// Returns a valid access token for this project's GSC connection, refreshing
// it first if it's expired.
async function getValidAccessToken(project) {
  const expiresAt = project.gsc_token_expires ? new Date(project.gsc_token_expires) : null;
  const stillValid = expiresAt && expiresAt.getTime() - Date.now() > 60_000;

  if (stillValid) return project.gsc_access_token;

  const refreshed = await refreshAccessToken(project.gsc_refresh_token);
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await db.query("UPDATE projects SET gsc_access_token = $1, gsc_token_expires = $2 WHERE id = $3", [
    refreshed.access_token,
    newExpiry,
    project.id,
  ]);
  return refreshed.access_token;
}

async function listSites(accessToken) {
  const res = await fetch(GSC_SITES_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Couldn't list Search Console sites: ${await res.text()}`);
  const data = await res.json();
  return (data.siteEntry || []).map((s) => ({ siteUrl: s.siteUrl, permissionLevel: s.permissionLevel }));
}

async function querySearchAnalytics(project) {
  const accessToken = await getValidAccessToken(project);
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 28);

  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(project.gsc_site_url)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        dimensions: [],
      }),
    }
  );
  if (!res.ok) throw new Error(`Search Analytics query failed: ${await res.text()}`);
  const data = await res.json();
  const row = data.rows?.[0];

  return {
    totalClicks: row ? Math.round(row.clicks) : 0,
    totalImpressions: row ? Math.round(row.impressions) : 0,
    avgPosition: row ? Number(row.position.toFixed(1)) : 0,
  };
}

module.exports = {
  isConfigured,
  buildAuthUrl,
  decodeState,
  exchangeCodeForTokens,
  getValidAccessToken,
  listSites,
  querySearchAnalytics,
};
