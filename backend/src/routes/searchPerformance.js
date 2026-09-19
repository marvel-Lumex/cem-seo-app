const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getActiveProject } = require("../services/activeProject");
const { queryTopQueries } = require("../services/searchConsole");

const router = express.Router();

// Real per-query search performance — the detailed data behind the
// Search Visibility summary on the Growth Dashboard. This is genuinely new
// data not shown anywhere else in the app (Home only shows site-wide
// totals; this shows the individual query-level breakdown).
router.get("/", requireAuth, async (req, res) => {
  const project = await getActiveProject(req.userId);
  if (!project) return res.status(404).json({ error: "No project found" });

  if (!project.gsc_refresh_token || !project.gsc_site_url) {
    return res.status(400).json({
      error: "Connect Google Search Console first to see your real search performance.",
    });
  }

  try {
    const queries = await queryTopQueries(project);
    const sorted = queries.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
    res.json({ queries: sorted });
  } catch (err) {
    res.status(502).json({ error: err.message || "Couldn't fetch Search Console data right now." });
  }
});

module.exports = router;
