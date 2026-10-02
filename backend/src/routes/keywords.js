const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getActiveProject } = require("../services/activeProject");
const { getKeywordTrends, getInterestByRegion } = require("../services/trends");
const { classifyIntent } = require("../utils/searchIntent");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const { q } = req.query;
  const project = await getActiveProject(req.userId);
  if (!project) return res.json([]);

  let rows;
  if (q) {
    ({ rows } = await db.query(
      "SELECT keyword, volume, difficulty FROM keywords WHERE project_id = $1 AND keyword ILIKE $2 ORDER BY id",
      [project.id, `%${q}%`]
    ));
  } else {
    ({ rows } = await db.query(
      "SELECT keyword, volume, difficulty FROM keywords WHERE project_id = $1 ORDER BY id",
      [project.id]
    ));
  }

  const withIntent = rows.map((r) => ({ ...r, intent: classifyIntent(r.keyword) }));

  res.json(withIntent);
});

router.get("/trends", requireAuth, async (req, res) => {
  const keyword = (req.query.keyword || "").toString().trim();
  const geo = (req.query.geo || "").toString().trim();
  if (!keyword) return res.status(400).json({ error: "keyword query param is required" });

  try {
    const result = await getKeywordTrends(keyword, geo);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: "Couldn't fetch trend data for that keyword right now. Try again shortly." });
  }
});

// Local SEO: which regions/cities actually search this term most, using
// Google Trends' real regional breakdown — free, no paid data needed.
router.get("/local", requireAuth, async (req, res) => {
  const keyword = (req.query.keyword || "").toString().trim();
  const country = (req.query.country || "").toString().trim();
  if (!keyword) return res.status(400).json({ error: "keyword query param is required" });

  try {
    const regions = await getInterestByRegion(keyword, country);
    res.json({ keyword, country: country || "Worldwide", regions });
  } catch (err) {
    res.status(502).json({ error: "Couldn't fetch local search data right now. Try again shortly." });
  }
});

module.exports = router;
