const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getActiveProject } = require("../services/activeProject");
const { queryTopQueries } = require("../services/searchConsole");

const router = express.Router();

// Plain-English, non-AI-generated guidance — a real content generator (the
// paid feature on the roadmap) would write full custom suggestions; this is
// a free, honest starting point: pattern-based tips, not fabricated advice.
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

  // Click Opportunities: real search visibility (decent impressions) but a
  // CTR low enough that the title/description likely isn't compelling.
  const clickOpportunities = queries
    .filter((q) => q.impressions >= 50 && q.ctr < 0.02)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10)
    .map((q) => ({ ...q, tip: clickOpportunityTip(q.query) }));

  // Quick Wins: ranking on page 2 (roughly positions 8-20) — close enough
  // that a modest push could realistically get them onto page 1.
  const quickWins = queries
    .filter((q) => q.position >= 8 && q.position <= 20 && q.impressions >= 10)
    .sort((a, b) => a.position - b.position)
    .slice(0, 10)
    .map((q) => ({ ...q, tip: quickWinTip(q.position) }));

  res.json({ clickOpportunities, quickWins, totalQueriesAnalyzed: queries.length });
});

module.exports = router;
