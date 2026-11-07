const crypto = require("crypto");
const express = require("express");
const db = require("../db");

const router = express.Router();
const HEX = /^#[0-9a-fA-F]{6}$/;

function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function parseJson(v) {
  if (!v) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}
function dateOnly(v) {
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}
function clean(v) {
  return String(v == null ? "" : v)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_]/g, "")
    .trim()
    .slice(0, 300);
}
function scoreColor(n) {
  return n >= 90 ? "#1B9E5A" : n >= 50 ? "#D98A00" : "#D63B3B";
}

const CATEGORY_LABELS = {
  performance: "Performance",
  accessibility: "Accessibility",
  bestPractices: "Best Practices",
  best_practices: "Best Practices",
  seo: "SEO",
};

function page(title, body, color) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background: #F5F6FA; color: #1B1E2B; }
  .head { background: ${color}; color: #fff; padding: 28px 20px; }
  .head-in, .wrap { max-width: 760px; margin: 0 auto; }
  .head img { max-height: 44px; max-width: 200px; display: block; margin-bottom: 12px; background: #fff; padding: 4px 8px; border-radius: 8px; }
  .head h1 { margin: 0; font-size: 22px; }
  .head p { margin: 6px 0 0; opacity: .9; font-size: 14px; }
  .wrap { padding: 20px; }
  .card { background: #fff; border: 1px solid #E4E6EE; border-radius: 14px; padding: 20px; margin-bottom: 16px; }
  .card h2 { margin: 0 0 12px; font-size: 16px; }
  .muted { color: #6B7080; font-size: 14px; line-height: 1.5; }
  .score { font-size: 56px; font-weight: 800; line-height: 1; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; }
  .tile { flex: 1 1 120px; background: #F5F6FA; border-radius: 10px; padding: 12px; text-align: center; }
  .tile b { display: block; font-size: 22px; }
  .tile span { font-size: 12px; color: #6B7080; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { padding: 12px 0; border-top: 1px solid #EDEEF3; }
  li:first-child { border-top: 0; }
  .it { font-size: 14px; font-weight: 600; }
  .id { font-size: 13px; color: #6B7080; margin-top: 4px; line-height: 1.5; }
  .sev { display: inline-block; font-size: 11px; text-transform: uppercase; background: #EEF0F8; color: #4A4F66; border-radius: 6px; padding: 2px 6px; margin-bottom: 4px; }
  .foot { text-align: center; color: #8A8FA3; font-size: 12px; padding: 8px 0 28px; line-height: 1.6; }
  .noprint { font-size: 12px; color: #8A8FA3; text-align: center; }
  svg { width: 100%; height: auto; display: block; }
  @media print { body { background: #fff; } .noprint { display: none; } .card { break-inside: avoid; } }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function notFound(res) {
  res.status(404).send(
    page(
      "Report not available",
      `<div class="wrap"><div class="card"><h2>This report link is not available</h2><p class="muted">It may have been turned off by the sender. Please contact them for a new link.</p></div></div>`,
      "#517EEE"
    )
  );
}

function trendSvg(points, color) {
  if (points.length < 2) return "";
  const w = 600;
  const h = 140;
  const pad = 16;
  const xs = points.map((_, i) => pad + (i * (w - 2 * pad)) / (points.length - 1));
  const ys = points.map((p) => h - pad - (Math.max(0, Math.min(100, p.score)) / 100) * (h - 2 * pad));
  const line = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const dots = xs.map((x, i) => `<circle cx="${x.toFixed(1)}" cy="${ys[i].toFixed(1)}" r="4" fill="${color}"/>`).join("");
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Health score trend"><polyline points="${line}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>${dots}</svg>`;
}

function renderIssue(i) {
  if (typeof i === "string") return `<li><div class="it">${esc(clean(i))}</div></li>`;
  if (!i || typeof i !== "object") return "";
  const title = clean(i.title || i.name || i.issue || i.message || i.label || "");
  const detail = clean(i.description || i.detail || i.details || i.fix || i.recommendation || i.tip || "");
  const sev = clean(i.severity || i.impact || i.level || "");
  if (!title && !detail) return "";
  return `<li>${sev ? `<span class="sev">${esc(sev)}</span>` : ""}<div class="it">${esc(title || detail)}</div>${
    title && detail ? `<div class="id">${esc(detail)}</div>` : ""
  }</li>`;
}

router.get("/:token", async (req, res) => {
  res.set({
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; img-src https:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  });
  res.type("html");

  try {
    const token = String(req.params.token || "");
    if (token.length < 20 || token.length > 100) return notFound(res);
    const hash = crypto.createHash("sha256").update(token).digest("hex");

    const { rows: linkRows } = await db.query(
      "SELECT id, project_id, user_id FROM report_links WHERE token_hash = $1 AND revoked_at IS NULL",
      [hash]
    );
    const link = linkRows[0];
    if (!link) return notFound(res);

    const { rows: projRows } = await db.query(
      `SELECT p.domain, p.total_clicks, p.total_impressions, p.avg_position,
              (p.gsc_refresh_token IS NOT NULL) AS gsc_connected, c.name AS client_name
       FROM projects p LEFT JOIN clients c ON c.id = p.client_id
       WHERE p.id = $1`,
      [link.project_id]
    );
    const project = projRows[0];
    if (!project) return notFound(res);

    const { rows: profRows } = await db.query("SELECT * FROM agency_profiles WHERE user_id = $1", [link.user_id]);
    const profile = profRows[0] || {};

    const { rows: auditRows } = await db.query(
      "SELECT * FROM audits WHERE project_id = $1 ORDER BY run_at DESC LIMIT 1",
      [link.project_id]
    );
    const audit = auditRows[0];

    const { rows: trendRows } = await db.query(
      "SELECT health_score, run_at FROM audits WHERE project_id = $1 AND health_score IS NOT NULL ORDER BY run_at DESC LIMIT 12",
      [link.project_id]
    );
    const trend = trendRows.reverse().map((r) => ({ score: Number(r.health_score), at: r.run_at }));

    db.query("UPDATE report_links SET view_count = COALESCE(view_count, 0) + 1, last_viewed_at = NOW() WHERE id = $1", [
      link.id,
    ]).catch(() => {});

    const agencyName = profile.agency_name || "Cem SEO";
    const color = HEX.test(profile.brand_color || "") ? profile.brand_color : "#517EEE";
    const logo = typeof profile.logo_url === "string" && profile.logo_url.startsWith("https://") ? profile.logo_url : null;

    let body = `<div class="head"><div class="head-in">
      ${logo ? `<img src="${esc(logo)}" alt="${esc(agencyName)}">` : ""}
      <h1>SEO Report: ${esc(project.domain)}</h1>
      <p>${project.client_name ? `Prepared for ${esc(project.client_name)} by ` : "Prepared by "}${esc(agencyName)}${
      audit ? ` &middot; ${esc(dateOnly(audit.run_at))}` : ""
    }</p>
    </div></div><div class="wrap">`;

    if (!audit) {
      body += `<div class="card"><h2>No audit yet</h2><p class="muted">An audit has not been run for this site yet. Please check back soon.</p></div>`;
    } else {
      const score = Number(audit.health_score) || 0;
      body += `<div class="card"><h2>Overall SEO health</h2>
        <div class="score" style="color:${scoreColor(score)}">${esc(score)}<span style="font-size:20px;color:#6B7080">/100</span></div>
        <div class="row" style="margin-top:16px">
          <div class="tile"><b style="color:#D63B3B">${esc(audit.critical_issues ?? 0)}</b><span>Critical</span></div>
          <div class="tile"><b style="color:#D98A00">${esc(audit.warnings ?? 0)}</b><span>Warnings</span></div>
          <div class="tile"><b>${esc(audit.notices ?? 0)}</b><span>Notices</span></div>
          <div class="tile"><b style="color:#1B9E5A">${esc(audit.passed_checks ?? 0)}</b><span>Passed</span></div>
        </div></div>`;

      const cats = parseJson(audit.category_scores_json);
      if (cats && typeof cats === "object") {
        const tiles = Object.entries(cats)
          .filter(([, v]) => typeof v === "number" && isFinite(v))
          .map(([k, v]) => {
            const val = Math.round(v <= 1 && v > 0 ? v * 100 : v);
            return `<div class="tile"><b style="color:${scoreColor(val)}">${esc(val)}</b><span>${esc(CATEGORY_LABELS[k] || k)}</span></div>`;
          })
          .join("");
        if (tiles) body += `<div class="card"><h2>Scores by category</h2><div class="row">${tiles}</div></div>`;
      }

      const svg = trendSvg(trend, color);
      if (svg) {
        body += `<div class="card"><h2>Health score over time</h2>${svg}<p class="muted">${esc(dateOnly(trend[0].at))} to ${esc(
          dateOnly(trend[trend.length - 1].at)
        )}</p></div>`;
      }

      const issues = parseJson(audit.top_issues_json);
      const items = Array.isArray(issues) ? issues.slice(0, 8).map(renderIssue).filter(Boolean).join("") : "";
      if (items) body += `<div class="card"><h2>What to fix first</h2><ul>${items}</ul></div>`;
    }

    if (project.gsc_connected && Number(project.total_impressions) > 0) {
      body += `<div class="card"><h2>Google search performance</h2><div class="row">
        <div class="tile"><b>${esc(project.total_clicks ?? 0)}</b><span>Clicks</span></div>
        <div class="tile"><b>${esc(project.total_impressions ?? 0)}</b><span>Impressions</span></div>
        <div class="tile"><b>${esc(Number(project.avg_position || 0).toFixed(1))}</b><span>Avg. position</span></div>
      </div></div>`;
    }

    body += `<p class="noprint">To save this report as a PDF, use your browser's Print option.</p>
      <div class="foot">Prepared by ${esc(agencyName)}${profile.contact_email ? ` &middot; ${esc(profile.contact_email)}` : ""}<br>Powered by Cem SEO</div>
    </div>`;

    res.send(page(`SEO Report: ${project.domain}`, body, color));
  } catch (err) {
    console.error("Report page error:", err.message);
    res.status(500).send("Something went wrong");
  }
});

module.exports = router;
