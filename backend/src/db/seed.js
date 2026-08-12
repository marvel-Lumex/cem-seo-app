// Seeds one demo project with audit + keyword data matching the Figma prototype.
// Called automatically the first time a user signs up (see routes/auth.js).
const db = require("./index");

async function seedProjectsForUser(userId) {
  const projects = [
    { domain: "lumexalliance.com", status: "Active", score: 82, clicks: 12400, impressions: 215000, pos: 18.6, backlinks: 1204 },
    { domain: "cemseo.app", status: "Active", score: 74, clicks: 5100, impressions: 98000, pos: 22.1, backlinks: 640 },
    { domain: "novabrands.io", status: "Needs attention", score: 58, clicks: 2300, impressions: 41000, pos: 34.4, backlinks: 210 },
    { domain: "driftly.co", status: "Critical", score: 41, clicks: 900, impressions: 15000, pos: 51.2, backlinks: 88 },
  ];

  const keywordSeed = [
    ["seo tools for saas", "12.1K", 45],
    ["best seo software", "8.9K", 40],
    ["keyword research tool", "6.5K", 38],
    ["on page seo checklist", "4.4K", 29],
    ["technical seo audit", "3.1K", 35],
    ["increase website traffic", "2.7K", 41],
  ];

  for (const p of projects) {
    const { rows } = await db.query(
      `INSERT INTO projects (user_id, domain, status, seo_score, total_clicks, total_impressions, avg_position, backlinks, last_audit_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [userId, p.domain, p.status, p.score, p.clicks, p.impressions, p.pos, p.backlinks, new Date().toISOString()]
    );
    const projectId = rows[0].id;

    await db.query(
      `INSERT INTO audits (project_id, health_score, critical_issues, warnings, notices, passed_checks)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [projectId, p.score - 4, p.score < 60 ? 12 : 7, 23, 42, 118]
    );

    for (const [kw, vol, kd] of keywordSeed) {
      await db.query(
        `INSERT INTO keywords (project_id, keyword, volume, difficulty, match_type) VALUES ($1, $2, $3, $4, $5)`,
        [projectId, kw, vol, kd, "broad"]
      );
    }
  }
}

module.exports = { seedProjectsForUser };
