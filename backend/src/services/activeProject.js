const db = require("../db");

// Every user can track multiple sites (Projects). This resolves which one
// they're currently "looking at" across Home/Audit/Keywords, instead of
// always defaulting to whichever site happened to be created first.
async function getActiveProject(userId) {
  const { rows: userRows } = await db.query("SELECT active_project_id FROM users WHERE id = $1", [userId]);
  const activeProjectId = userRows[0]?.active_project_id;

  if (activeProjectId) {
    const { rows } = await db.query("SELECT * FROM projects WHERE id = $1 AND user_id = $2", [activeProjectId, userId]);
    if (rows[0]) return rows[0];
  }

  // No active project set yet (or it no longer belongs to this user) —
  // fall back to their first project and remember that choice going forward.
  const { rows: fallbackRows } = await db.query(
    "SELECT * FROM projects WHERE user_id = $1 ORDER BY id ASC LIMIT 1",
    [userId]
  );
  const fallback = fallbackRows[0];

  if (fallback) {
    await db.query("UPDATE users SET active_project_id = $1 WHERE id = $2", [fallback.id, userId]);
  }

  return fallback || null;
}

module.exports = { getActiveProject };
