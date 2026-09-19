const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getActiveProject } = require("../services/activeProject");
const { queryTopQueries, queryTrendingQueries } = require("../services/searchConsole");

const router = express.Router();

function clickOpportunityTip(query) {
  return `"${query}" gets seen often but rarely clicked. Try making your title and meta description for this page more specific and compelling — mention exact numbers, dates, or benefits searchers care about.`;
}

function quickWinTip(position) {
  if (position <= 12) {
    return "You're close to page 1 — a few more relevant internal links or a content refresh could push this over the edge.";
  }
  return "You're on page 2 — strengthening this page's content depth and getting a few quality backlinks could help it climb toward page 1.";
}

router.get("/", requireAuth, async (req, res) => {
  const project = await getActiveProject(req.userId);
  if (!project) return res.status(404).json({ error: "No project found" });

  if (!project.gsc_refresh_token || !project.gsc_site_url) {
    return res.status(400).json({
      error: "Connect Google Search Console first to see real click opportunities and quick wins.",
    });
  }

  let queries;
  try {
    queries = await queryTopQueries(project);
  } catch (err) {
    return res.status(502).json({ error: err.message || "Couldn't fetch Search Console data right now." });
  }

  const clickOpportunities = queries
    .filter((q) => q.impressions >= 50 && q.ctr < 0.02)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10)
    .map((q) => ({ ...q, tip: clickOpportunityTip(q.query) }));

  const quickWins = queries
    .filter((q) => q.position >= 8 && q.position <= 20 && q.impressions >= 10)
    .sort((a, b) => a.position - b.position)
    .slice(0, 10)
    .map((q) => ({ ...q, tip: quickWinTip(q.position) }));

  // Real period-over-period momentum — same pattern as Google's own Search
  // Console Insights report. A separate, additional GSC call, wrapped so a
  // failure here doesn't take down the rest of the page.
  let trendingUp = [];
  let trendingDown = [];
  try {
    const trending = await queryTrendingQueries(project);
    trendingUp = trending.trendingUp;
    trendingDown = trending.trendingDown;
  } catch (err) {
    console.error("Trending queries fetch failed:", err.message);
  }

  res.json({ clickOpportunities, quickWins, trendingUp, trendingDown, totalQueriesAnalyzed: queries.length });
});

module.exports = router;
