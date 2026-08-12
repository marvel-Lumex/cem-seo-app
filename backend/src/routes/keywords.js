const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getActiveProject } = require("../services/activeProject");
const { getKeywordTrends } = require("../services/trends");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const { q } = req.query;
  const project = await getActiveProject(req.userId);
  if (!project) return res.json([]);

  let rows;
  if (q) {
    // ILIKE (not LIKE) for case-insensitive matching in Postgres
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

  res.json(rows);
});

// Real Google Trends data (free, no API key) for a given keyword — search
// interest over time plus real related/rising search terms as fresh keyword
// ideas. This is genuine data, unlike the seeded volume/difficulty numbers
// above, which need a paid provider to become real (see README).
router.get("/trends", requireAuth, async (req, res) => {
  const keyword = (req.query.keyword || "").toString().trim();
  if (!keyword) return res.status(400).json({ error: "keyword query param is required" });

  try {
    const result = await getKeywordTrends(keyword);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: "Couldn't fetch trend data for that keyword right now. Try again shortly." });
  }
});

module.exports = router;
