const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getActiveProject } = require("../services/activeProject");
const { querySearchAnalytics, queryTopQueries } = require("../services/searchConsole");

const router = express.Router();

// One combined view of real health + visibility + opportunity data — not a
// single invented "growth score" (that would just be a made-up number), but
// the actual real numbers from Audit, Search Console, and Keywords side by
// side, so the whole picture is visible without jumping between screens.
router.get("/", requireAuth, async (req, res) => {
  const project = await getActiveProject(req.userId);
  if (!project) return res.status(404).json({ error: "No project found" });

  const { rows: auditRows } = await db.query(
    "SELECT health_score, critical_issues, warnings, passed_checks FROM audits WHERE project_id = $1 ORDER BY run_at DESC LIMIT 1",
    [project.id]
  );
  const latestAudit = auditRows[0] || null;

  const { rows: keywordCountRows } = await db.query(
    "SELECT COUNT(*) AS count FROM keywords WHERE project_id = $1",
    [project.id]
  );
  const keywordsTracked = Number(keywordCountRows[0]?.count || 0);

  let searchVisibility = { totalClicks: 0, totalImpressions: 0, avgPosition: 0, isLiveData: false };
  let opportunitiesSummary = { clickOpportunities: 0, quickWins: 0, isLiveData: false };

  if (project.gsc_refresh_token && project.gsc_site_url) {
    try {
      const stats = await querySearchAnalytics(project);
      searchVisibility = { ...stats, isLiveData: true };
    } catch (err) {
      console.error("Growth dashboard: search analytics fetch failed:", err.message);
    }

    try {
      const queries = await queryTopQueries(project);
      const clickOpportunities = queries.filter((q) => q.impressions >= 50 && q.ctr < 0.02).length;
      const quickWins = queries.filter((q) => q.position >= 8 && q.position <= 20 && q.impressions >= 10).length;
      opportunitiesSummary = { clickOpportunities, quickWins, isLiveData: true };
    } catch (err) {
      console.error("Growth dashboard: opportunities fetch failed:", err.message);
    }
  }

  res.json({
    domain: project.domain,
    seoHealth: latestAudit
      ? {
          score: latestAudit.health_score,
          criticalIssues: latestAudit.critical_issues,
          warnings: latestAudit.warnings,
          passedChecks: latestAudit.passed_checks,
        }
      : null,
    searchVisibility,
    opportunitiesSummary,
    keywordsTracked,
  });
});

module.exports = router;
