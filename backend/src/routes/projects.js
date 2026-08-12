const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const { rows: userRows } = await db.query("SELECT active_project_id FROM users WHERE id = $1", [req.userId]);
  const { rows: projects } = await db.query(
    `SELECT id, domain, status, seo_score AS "seoScore", last_audit_at AS "lastAuditAt"
     FROM projects WHERE user_id = $1 ORDER BY id ASC`,
    [req.userId]
  );

  const activeId = userRows[0]?.active_project_id || (projects[0]?.id ?? null);

  res.json(projects.map((p) => ({ ...p, isActive: p.id === activeId })));
});

router.post("/", requireAuth, async (req, res) => {
  const { domain } = req.body;
  if (!domain || !domain.trim()) return res.status(400).json({ error: "domain is required" });

  const { rows: existingRows } = await db.query(
    "SELECT id FROM projects WHERE user_id = $1 AND domain = $2",
    [req.userId, domain.trim()]
  );
  if (existingRows[0]) return res.status(409).json({ error: "You're already tracking this domain" });

  const { rows } = await db.query(
    "INSERT INTO projects (user_id, domain, status, seo_score) VALUES ($1, $2, 'Active', 0) RETURNING id",
    [req.userId, domain.trim()]
  );
  const newProjectId = rows[0].id;

  // A user adding a new site almost always wants to see it right away —
  // make it their active project automatically.
  await db.query("UPDATE users SET active_project_id = $1 WHERE id = $2", [newProjectId, req.userId]);

  res.status(201).json({ id: newProjectId, domain: domain.trim(), status: "Active", seoScore: 0 });
});

// Must come after the more specific routes above so "/active" style paths
// (if ever added) wouldn't collide with this catch-all :id route.
router.get("/:id", requireAuth, async (req, res) => {
  const { rows: projectRows } = await db.query(
    "SELECT * FROM projects WHERE id = $1 AND user_id = $2",
    [req.params.id, req.userId]
  );
  const project = projectRows[0];
  if (!project) return res.status(404).json({ error: "Project not found" });

  const { rows: userRows } = await db.query("SELECT active_project_id FROM users WHERE id = $1", [req.userId]);
  const { rows: auditRows } = await db.query(
    "SELECT * FROM audits WHERE project_id = $1 ORDER BY run_at DESC LIMIT 1",
    [project.id]
  );
  const latestAudit = auditRows[0];

  res.json({
    id: project.id,
    domain: project.domain,
    status: project.status,
    seoScore: project.seo_score,
    totalClicks: project.total_clicks,
    totalImpressions: project.total_impressions,
    avgPosition: project.avg_position,
    backlinks: project.backlinks,
    lastAuditAt: project.last_audit_at,
    isActive: project.id === userRows[0]?.active_project_id,
    latestAudit: latestAudit
      ? {
          healthScore: latestAudit.health_score,
          criticalIssues: latestAudit.critical_issues,
          warnings: latestAudit.warnings,
          notices: latestAudit.notices,
          passedChecks: latestAudit.passed_checks,
        }
      : null,
  });
});

router.put("/:id/activate", requireAuth, async (req, res) => {
  const { rows } = await db.query(
    "SELECT id, domain FROM projects WHERE id = $1 AND user_id = $2",
    [req.params.id, req.userId]
  );
  const project = rows[0];
  if (!project) return res.status(404).json({ error: "Project not found" });

  await db.query("UPDATE users SET active_project_id = $1 WHERE id = $2", [project.id, req.userId]);
  res.json({ activeProjectId: project.id, domain: project.domain });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const { rows } = await db.query(
    "SELECT id FROM projects WHERE id = $1 AND user_id = $2",
    [req.params.id, req.userId]
  );
  const project = rows[0];
  if (!project) return res.status(404).json({ error: "Project not found" });

  await db.query("DELETE FROM audits WHERE project_id = $1", [project.id]);
  await db.query("DELETE FROM keywords WHERE project_id = $1", [project.id]);
  await db.query("DELETE FROM projects WHERE id = $1", [project.id]);

  // If the deleted project was active, fall back to whatever's left
  const { rows: userRows } = await db.query("SELECT active_project_id FROM users WHERE id = $1", [req.userId]);
  if (userRows[0]?.active_project_id === project.id) {
    const { rows: nextRows } = await db.query(
      "SELECT id FROM projects WHERE user_id = $1 ORDER BY id ASC LIMIT 1",
      [req.userId]
    );
    await db.query("UPDATE users SET active_project_id = $1 WHERE id = $2", [nextRows[0]?.id || null, req.userId]);
  }

  res.json({ deleted: true });
});

module.exports = router;
