const db = require("../db");

function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
const num = (v) => Number(v) || 0;

async function getTrafficHtml() {
  try {
    const W = "created_at > NOW() - INTERVAL '30 days'";
    const { rows: t } = await db.query(
      "SELECT " +
        "COUNT(*) FILTER (WHERE event='page_view') AS views, " +
        "COUNT(DISTINCT visitor) FILTER (WHERE event='page_view') AS uniques, " +
        "COUNT(*) FILTER (WHERE event='download_click') AS downloads, " +
        "COUNT(*) FILTER (WHERE event='page_view' AND created_at > NOW() - INTERVAL '24 hours') AS views_today, " +
        "COUNT(*) FILTER (WHERE event='download_click' AND created_at > NOW() - INTERVAL '24 hours') AS downloads_today " +
        "FROM page_events WHERE " + W
    );
    const { rows: daily } = await db.query(
      "SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d, " +
        "COUNT(*) FILTER (WHERE event='page_view') AS views, " +
        "COUNT(*) FILTER (WHERE event='download_click') AS downloads " +
        "FROM page_events WHERE " + W + " GROUP BY d ORDER BY d DESC LIMIT 14"
    );
    const { rows: sources } = await db.query(
      "SELECT source, " +
        "COUNT(*) FILTER (WHERE event='page_view') AS views, " +
        "COUNT(*) FILTER (WHERE event='download_click') AS downloads " +
        "FROM page_events WHERE " + W + " GROUP BY source ORDER BY views DESC, downloads DESC LIMIT 8"
    );
    const { rows: devices } = await db.query(
      "SELECT device, COUNT(*) FILTER (WHERE event='page_view') AS views " +
        "FROM page_events WHERE " + W + " GROUP BY device ORDER BY views DESC"
    );

    const s = t[0] || {};
    const views = num(s.views);
    const downloads = num(s.downloads);
    const conv = views > 0 ? ((downloads / views) * 100).toFixed(1) : "0.0";

    const card = (v, l) =>
      '<div class="stat-card"><div class="stat-value">' + esc(v) + '</div><div class="stat-label">' + esc(l) + "</div></div>";

    const tableOf = (head, rows) =>
      "<table><tr>" + head.map((h) => "<th>" + esc(h) + "</th>").join("") + "</tr>" +
      rows.map((r) => "<tr>" + r.map((c) => "<td>" + esc(c) + "</td>").join("") + "</tr>").join("") +
      "</table>";

    let html = "<h2>Download page traffic (last 30 days)</h2>";
    html += '<div class="stat-grid">' +
      card(views, "Visits") +
      card(num(s.uniques), "Unique visitors (counted per day)") +
      card(downloads, "APK download clicks") +
      card(conv + "%", "Clicks per visit") +
      "</div>";
    html += '<p style="color:#94989F;font-size:12px;margin-top:8px;">Last 24 hours: ' +
      num(s.views_today) + " visits, " + num(s.downloads_today) + " download clicks. Anonymous counts only, no IP addresses stored. A download click means the button was tapped, not that the install finished.</p>";

    if (views + downloads === 0) {
      html += '<p style="color:#94989F;font-size:13px;">No visits recorded yet.</p>';
      return html;
    }

    html += "<h2>By day</h2>" + tableOf(["Day", "Visits", "Downloads"], daily.map((r) => [r.d, num(r.views), num(r.downloads)]));
    html += "<h2>Where visitors come from</h2>" + tableOf(["Source", "Visits", "Downloads"], sources.map((r) => [r.source, num(r.views), num(r.downloads)]));
    html += "<h2>Devices</h2>" + tableOf(["Device", "Visits"], devices.map((r) => [r.device, num(r.views)]));
    return html;
  } catch (err) {
    console.error("trafficStats error:", err.message);
    return '<h2>Download page traffic</h2><p style="color:#94989F;font-size:13px;">Stats are not available yet.</p>';
  }
}

module.exports = { getTrafficHtml, esc };
