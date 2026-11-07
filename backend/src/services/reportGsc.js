const db = require("../db");
const { querySearchAnalytics } = require("./searchConsole");

const CACHE_MS = 6 * 3600 * 1000;

async function getGscSnapshot(linkId, projectId) {
  let cachedData = null;
  let fetchedAt = null;
  try {
    const { rows } = await db.query("SELECT gsc_json, gsc_fetched_at FROM report_links WHERE id = $1", [linkId]);
    if (rows[0] && rows[0].gsc_json) {
      cachedData = JSON.parse(rows[0].gsc_json);
      fetchedAt = rows[0].gsc_fetched_at ? new Date(rows[0].gsc_fetched_at).getTime() : null;
    }
  } catch {
    cachedData = null;
  }

  if (cachedData && fetchedAt && Date.now() - fetchedAt < CACHE_MS) return cachedData;

  const { rows: projRows } = await db.query("SELECT * FROM projects WHERE id = $1", [projectId]);
  const p = projRows[0];
  if (!p || !p.gsc_refresh_token || !p.gsc_site_url) return null;

  try {
    const stats = await querySearchAnalytics(p);
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 28);
    const data = {
      clicks: stats.totalClicks,
      impressions: stats.totalImpressions,
      position: stats.avgPosition,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
    try {
      await db.query("UPDATE report_links SET gsc_json = $1, gsc_fetched_at = NOW() WHERE id = $2", [JSON.stringify(data), linkId]);
    } catch (e) {
      console.error("Could not cache Search Console snapshot:", e.message);
    }
    return data;
  } catch (err) {
    console.error("Report Search Console query failed:", err.message);
    return cachedData;
  }
}

module.exports = { getGscSnapshot };
