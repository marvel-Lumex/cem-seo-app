const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { runPageSpeedAudit } = require("../services/pagespeed");
const { getActiveProject } = require("../services/activeProject");
const { checkAndSendAuditAlert } = require("../services/alerts");

const router = express.Router();

function parseJsonColumn(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

router.get("/", requireAuth, async (req, res) => {
  const project = await getActiveProject(req.userId);
  if (!project) return res.status(404).json({ error: "No project found" });

  const { rows } = await db.query(
    "SELECT * FROM audits WHERE project_id = $1 ORDER BY run_at DESC LIMIT 1",
    [project.id]
  );
  const audit = rows[0];

  if (!audit) return res.status(404).json({ error: "No audits found" });

  res.json({
    healthScore: audit.health_score,
    criticalIssues: audit.critical_issues,
    warnings: audit.warnings,
    notices: audit.notices,
    passedChecks: audit.passed_checks,
    topIssues: parseJsonColumn(audit.top_issues_json) || [],
    categoryScores: parseJsonColumn(audit.category_scores_json) || null,
    runAt: audit.run_at,
  });
});

router.post("/run", requireAuth, async (req, res) => {
  const project = await getActiveProject(req.userId);
  if (!project) return res.status(404).json({ error: "No project found" });

  const { rows: previousRows } = await db.query(
    "SELECT * FROM audits WHERE project_id = $1 ORDER BY run_at DESC LIMIT 1",
    [project.id]
  );
  const previousAudit = previousRows[0];

  let result;
  try {
    result = await runPageSpeedAudit(project.domain);
  } catch (err) {
    return res.status(502).json({ error: err.message || "Audit failed" });
  }

  const { healthScore, criticalIssues, warnings, notices, passedChecks, topIssues, categoryScores } = result;

  await db.query(
    `INSERT INTO audits (project_id, health_score, critical_issues, warnings, notices, passed_checks, top_issues_json, category_scores_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      project.id,
      healthScore,
      criticalIssues,
      warnings,
      notices,
      passedChecks,
      JSON.stringify(topIssues),
      JSON.stringify(categoryScores),
    ]
  );

  await db.query("UPDATE projects SET seo_score = $1, last_audit_at = $2 WHERE id = $3", [
    healthScore,
    new Date().toISOString(),
    project.id,
  ]);

  checkAndSendAuditAlert(req.userId, project, { healthScore, criticalIssues }, previousAudit);

  res.status(201).json({
    healthScore,
    criticalIssues,
    warnings,
    notices,
    passedChecks,
    topIssues,
    categoryScores,
    runAt: new Date().toISOString(),
  });
});

router.get("/history", requireAuth, async (req, res) => {
  const project = await getActiveProject(req.userId);
  if (!project) return res.json([]);

  const { rows } = await db.query(
    `SELECT health_score AS "healthScore", category_scores_json, run_at AS "runAt" FROM audits WHERE project_id = $1 ORDER BY run_at ASC LIMIT 30`,
    [project.id]
  );

  // Real per-category history (Performance/Accessibility/Best Practices/SEO
  // over time) — this is what powers the SEO Health screen's trend lines,
  // distinct from just the single overall score shown on the Audit tab.
  const withCategories = rows.map((r) => ({
    healthScore: r.healthScore,
    runAt: r.runAt,
    categoryScores: parseJsonColumn(r.category_scores_json),
  }));

  res.json(withCategories);
});

module.exports = router;
