const crypto = require("crypto");
const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getUserLimits } = require("../services/planLimits");

const router = express.Router();
const HEX = /^#[0-9a-fA-F]{6}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
function isHttps(v) {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}

router.use(requireAuth);
router.use(
  wrap(async (req, res, next) => {
    const limits = await getUserLimits(req.userId);
    if (limits.plan !== "agency") {
      return res.status(403).json({ error: "Client workspaces and branded reports are available on the Agency plan." });
    }
    next();
  })
);

async function ownProject(userId, projectId) {
  const { rows } = await db.query("SELECT id, domain FROM projects WHERE id = $1 AND user_id = $2", [projectId, userId]);
  return rows[0] || null;
}

// ---- Branding ----
router.get(
  "/profile",
  wrap(async (req, res) => {
    const { rows } = await db.query(
      `SELECT agency_name AS "agencyName", brand_color AS "brandColor", logo_url AS "logoUrl",
              contact_email AS "contactEmail", website
       FROM agency_profiles WHERE user_id = $1`,
      [req.userId]
    );
    res.json(rows[0] || { agencyName: "", brandColor: "", logoUrl: "", contactEmail: "", website: "" });
  })
);

router.put(
  "/profile",
  wrap(async (req, res) => {
    const b = req.body || {};
    const agencyName = str(b.agencyName, 80);
    const brandColor = str(b.brandColor, 7);
    const logoUrl = str(b.logoUrl, 300);
    const contactEmail = str(b.contactEmail, 120);
    const website = str(b.website, 200);

    if (brandColor && !HEX.test(brandColor)) return res.status(400).json({ error: "Brand color must look like #517EEE" });
    if (logoUrl && !isHttps(logoUrl)) return res.status(400).json({ error: "Logo link must start with https://" });
    if (contactEmail && !EMAIL.test(contactEmail)) return res.status(400).json({ error: "Contact email is not valid" });
    if (website && !isHttps(website)) return res.status(400).json({ error: "Website must start with https://" });

    await db.query(
      `INSERT INTO agency_profiles (user_id, agency_name, brand_color, logo_url, contact_email, website, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         agency_name = EXCLUDED.agency_name, brand_color = EXCLUDED.brand_color, logo_url = EXCLUDED.logo_url,
         contact_email = EXCLUDED.contact_email, website = EXCLUDED.website, updated_at = NOW()`,
      [req.userId, agencyName || null, brandColor || null, logoUrl || null, contactEmail || null, website || null]
    );
    res.json({ agencyName, brandColor, logoUrl, contactEmail, website });
  })
);

// ---- Clients ----
router.get(
  "/clients",
  wrap(async (req, res) => {
    const { rows } = await db.query(
      `SELECT c.id, c.name, c.contact_email AS "contactEmail", c.created_at AS "createdAt",
              COUNT(p.id)::int AS "siteCount"
       FROM clients c LEFT JOIN projects p ON p.client_id = c.id
       WHERE c.user_id = $1 GROUP BY c.id ORDER BY c.name ASC`,
      [req.userId]
    );
    res.json(rows);
  })
);

router.post(
  "/clients",
  wrap(async (req, res) => {
    const b = req.body || {};
    const name = str(b.name, 100);
    const contactEmail = str(b.contactEmail, 120);
    const notes = str(b.notes, 1000);
    if (!name) return res.status(400).json({ error: "Client name is required" });
    if (contactEmail && !EMAIL.test(contactEmail)) return res.status(400).json({ error: "Client email is not valid" });

    const { rows } = await db.query(
      "INSERT INTO clients (user_id, name, contact_email, notes) VALUES ($1, $2, $3, $4) RETURNING id",
      [req.userId, name, contactEmail || null, notes || null]
    );
    res.status(201).json({ id: rows[0].id, name, contactEmail, notes });
  })
);

router.get(
  "/clients/:id",
  wrap(async (req, res) => {
    const { rows } = await db.query(
      `SELECT id, name, contact_email AS "contactEmail", notes, created_at AS "createdAt"
       FROM clients WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );
    if (!rows[0]) return res.status(404).json({ error: "Client not found" });
    const { rows: sites } = await db.query(
      `SELECT id, domain, seo_score AS "seoScore", last_audit_at AS "lastAuditAt"
       FROM projects WHERE client_id = $1 AND user_id = $2 ORDER BY id ASC`,
      [req.params.id, req.userId]
    );
    res.json({ ...rows[0], sites });
  })
);

router.put(
  "/clients/:id",
  wrap(async (req, res) => {
    const b = req.body || {};
    const name = str(b.name, 100);
    const contactEmail = str(b.contactEmail, 120);
    const notes = str(b.notes, 1000);
    if (!name) return res.status(400).json({ error: "Client name is required" });
    if (contactEmail && !EMAIL.test(contactEmail)) return res.status(400).json({ error: "Client email is not valid" });

    const { rowCount } = await db.query(
      "UPDATE clients SET name = $1, contact_email = $2, notes = $3 WHERE id = $4 AND user_id = $5",
      [name, contactEmail || null, notes || null, req.params.id, req.userId]
    );
    if (!rowCount) return res.status(404).json({ error: "Client not found" });
    res.json({ id: Number(req.params.id), name, contactEmail, notes });
  })
);

router.delete(
  "/clients/:id",
  wrap(async (req, res) => {
    const { rows } = await db.query("SELECT id FROM clients WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    if (!rows[0]) return res.status(404).json({ error: "Client not found" });
    await db.query("UPDATE projects SET client_id = NULL WHERE client_id = $1 AND user_id = $2", [req.params.id, req.userId]);
    await db.query("DELETE FROM clients WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    res.json({ deleted: true });
  })
);

// ---- Move a site to a client (or clientId: null to unassign) ----
router.put(
  "/projects/:id/client",
  wrap(async (req, res) => {
    const project = await ownProject(req.userId, req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const clientId = req.body && req.body.clientId != null ? Number(req.body.clientId) : null;
    if (clientId !== null) {
      if (!Number.isInteger(clientId)) return res.status(400).json({ error: "clientId is not valid" });
      const { rows } = await db.query("SELECT id FROM clients WHERE id = $1 AND user_id = $2", [clientId, req.userId]);
      if (!rows[0]) return res.status(404).json({ error: "Client not found" });
    }
    await db.query("UPDATE projects SET client_id = $1 WHERE id = $2", [clientId, project.id]);
    res.json({ projectId: project.id, clientId });
  })
);

// ---- Report links ----
function baseUrl(req) {
  const env = (process.env.REPORT_BASE_URL || "").replace(/\/+$/, "");
  return env || `${req.protocol}://${req.get("host")}`;
}

router.get(
  "/projects/:id/report-link",
  wrap(async (req, res) => {
    const project = await ownProject(req.userId, req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const { rows } = await db.query(
      `SELECT created_at AS "createdAt", last_viewed_at AS "lastViewedAt", view_count AS "viewCount"
       FROM report_links WHERE project_id = $1 AND revoked_at IS NULL ORDER BY id DESC LIMIT 1`,
      [project.id]
    );
    res.json(rows[0] ? { active: true, ...rows[0] } : { active: false });
  })
);

router.post(
  "/projects/:id/report-link",
  wrap(async (req, res) => {
    const project = await ownProject(req.userId, req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const token = crypto.randomBytes(32).toString("base64url");
    const hash = crypto.createHash("sha256").update(token).digest("hex");

    await db.query("UPDATE report_links SET revoked_at = NOW() WHERE project_id = $1 AND revoked_at IS NULL", [project.id]);
    await db.query("INSERT INTO report_links (project_id, user_id, token_hash) VALUES ($1, $2, $3)", [project.id, req.userId, hash]);

    res.status(201).json({ url: `${baseUrl(req)}/r/${token}` });
  })
);

router.delete(
  "/projects/:id/report-link",
  wrap(async (req, res) => {
    const project = await ownProject(req.userId, req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    await db.query("UPDATE report_links SET revoked_at = NOW() WHERE project_id = $1 AND revoked_at IS NULL", [project.id]);
    res.json({ revoked: true });
  })
);

module.exports = router;
