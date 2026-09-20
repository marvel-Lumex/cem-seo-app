const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getActiveProject } = require("../services/activeProject");
const { getKeywordTrends } = require("../services/trends");
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

  // Real, explainable pattern-based intent classification — added here so
  // every consumer of this endpoint gets it automatically, no separate call.
  const withIntent = rows.map((r) => ({ ...r, intent: classifyIntent(r.keyword) }));

  res.json(withIntent);
});

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
