const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getActiveProject } = require("../services/activeProject");
const { querySearchAnalytics } = require("../services/searchConsole");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const project = await getActiveProject(req.userId);

  if (!project) {
    return res.status(404).json({ error: "No projects found for this user" });
  }

  // If this project has a connected + chosen Search Console property, pull
  // real clicks/impressions/position from Google instead of the seeded
  // placeholder numbers. Falls back silently to seeded data if the live
  // query fails for any reason (expired connection, network hiccup, etc.)
  // so a Search Console problem never breaks the whole dashboard.
  let liveStats = null;
  if (project.gsc_refresh_token && project.gsc_site_url) {
    try {
      liveStats = await querySearchAnalytics(project);
    } catch (err) {
      console.error("Search Console query failed, falling back to seeded data:", err.message);
    }
  }

  res.json({
    domain: project.domain,
    seoScore: project.seo_score,
    totalClicks: liveStats ? liveStats.totalClicks : project.total_clicks,
    totalImpressions: liveStats ? liveStats.totalImpressions : project.total_impressions,
    avgPosition: liveStats ? liveStats.avgPosition : project.avg_position,
    backlinks: project.backlinks,
    lastAuditAt: project.last_audit_at,
    isLiveData: !!liveStats,
  });
});

module.exports = router;
