const crypto = require("crypto");
const express = require("express");
const db = require("../db");
const { explainFor } = require("../utils/issueExplain");
const { getGscSnapshot } = require("../services/reportGsc");

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
function darken(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function verdict(score) {
  if (score >= 90) return "Excellent. This site is in strong shape.";
  if (score >= 70) return "Good, with room to improve.";
  if (score >= 50) return "Needs attention. Fixing the items below will help.";
  return "Needs urgent attention. Start with the items below.";
}

const CATEGORY_LABELS = {
  performance: "Performance",
  accessibility: "Accessibility",
  bestPractices: "Best Practices",
  best_practices: "Best Practices",
  seo: "SEO",
};

const PRINT_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';

function page(title, body, color, nonce) {
  const dark = darken(color, 0.72);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { margin: 12mm; }
  body { margin: 0; font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background: #F3F4F9; color: #1B1E2B; }
  .head { background: linear-gradient(135deg, ${color}, ${dark}); color: #fff; padding: 22px 20px 34px; }
  .head-in, .wrap { max-width: 780px; margin: 0 auto; }
  .topline { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 22px; }
  .topline img { max-height: 40px; max-width: 180px; background: #fff; padding: 4px 8px; border-radius: 8px; }
  .brand { font-weight: 800; font-size: 17px; letter-spacing: .2px; }
  .btn { display: inline-flex; align-items: center; gap: 8px; background: #fff; color: ${dark}; border: 0; border-radius: 999px; padding: 10px 16px; font-size: 14px; font-weight: 700; cursor: pointer; }
  .kicker { font-size: 12px; letter-spacing: 2px; opacity: .85; font-weight: 700; }
  .head h1 { margin: 6px 0 14px; font-size: 30px; word-break: break-all; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { background: rgba(255,255,255,.18); border-radius: 999px; padding: 6px 12px; font-size: 13px; }
  .wrap { padding: 0 20px 20px; margin-top: -18px; }
  .card { background: #fff; border: 1px solid #E4E6EE; border-radius: 16px; padding: 20px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(20,24,50,.05); }
  .card h2 { margin: 0 0 14px; font-size: 16px; }
  .muted { color: #6B7080; font-size: 13px; line-height: 1.5; margin: 8px 0 0; }
  .hero { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
  .ring { width: 150px; height: 150px; flex: 0 0 auto; }
  .hero-text { flex: 1 1 220px; }
  .verdict { font-size: 18px; font-weight: 700; margin: 0 0 12px; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; }
  .tile { flex: 1 1 100px; background: #F3F4F9; border-radius: 12px; padding: 12px; text-align: center; }
  .tile b { display: block; font-size: 22px; }
  .tile span { font-size: 12px; color: #6B7080; }
  .bar { margin-bottom: 14px; }
  .bar:last-child { margin-bottom: 0; }
  .bar-top { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 6px; }
  .track { height: 10px; background: #EDEEF3; border-radius: 999px; overflow: hidden; }
  .fill { height: 100%; border-radius: 999px; }
  ol { list-style: none; margin: 0; padding: 0; }
  ol li { display: flex; gap: 12px; padding: 14px 0; border-top: 1px solid #EDEEF3; }
  ol li:first-child { border-top: 0; padding-top: 0; }
  .num { flex: 0 0 28px; height: 28px; border-radius: 50%; background: ${color}; color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .it { font-size: 14px; font-weight: 700; }
  .id { font-size: 13px; color: #5A5F73; margin-top: 4px; line-height: 1.55; }
  .sev { display: inline-block; font-size: 11px; text-transform: uppercase; background: #EEF0F8; color: #4A4F66; border-radius: 6px; padding: 2px 6px; margin-bottom: 4px; }
  svg { max-width: 100%; }
  .chart { width: 100%; height: auto; display: block; }
  .foot { text-align: center; color: #8A8FA3; font-size: 12px; padding: 8px 0 30px; line-height: 1.7; }
  .noprint { font-size: 12px; color: #8A8FA3; text-align: center; margin-bottom: 8px; }
  @media print {
    body { background: #fff; }
    .btn, .noprint { display: none; }
    .card { break-inside: avoid; box-shadow: none; }
    .wrap { margin-top: -10px; }
  }
</style>
</head>
<body>
${body}
${nonce ? `<script nonce="${nonce}">var b=document.getElementById("printBtn");if(b){b.addEventListener("click",function(){window.print();});}</script>` : ""}
</body>
</html>`;
}

function notFound(res) {
  res.status(404).send(
    page(
      "Report not available",
      `<div class="wrap" style="margin-top:40px"><div class="card"><h2>This report link is not available</h2><p class="muted">It may have been turned off by the sender. Please contact them for a new link.</p></div></div>`,
      "#517EEE",
      ""
    )
  );
}

function ring(score) {
  const c = 2 * Math.PI * 58;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * c;
  const col = scoreColor(score);
  return `<svg class="ring" viewBox="0 0 140 140" role="img" aria-label="Score ${score} out of 100"><circle cx="70" cy="70" r="58" fill="none" stroke="#EDEEF3" stroke-width="12"/><circle cx="70" cy="70" r="58" fill="none" stroke="${col}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${dash.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 70 70)"/><text x="70" y="80" text-anchor="middle" font-size="38" font-weight="800" fill="${col}">${score}</text></svg>`;
}

function trendSvg(points, color) {
  if (points.length < 2) return "";
  const w = 600;
  const h = 150;
  const pad = 18;
  const xs = points.map((_, i) => pad + (i * (w - 2 * pad)) / (points.length - 1));
  const ys = points.map((p) => h - pad - (Math.max(0, Math.min(100, p.score)) / 100) * (h - 2 * pad));
  const line = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = `${pad},${h - pad} ${line} ${xs[xs.length - 1].toFixed(1)},${h - pad}`;
  const dots = xs
    .map((x, i) => `<circle cx="${x.toFixed(1)}" cy="${ys[i].toFixed(1)}" r="${i === xs.length - 1 ? 6 : 4}" fill="${color}"/>`)
    .join("");
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Health score trend"><polygon points="${area}" fill="${color}" opacity="0.12"/><polyline points="${line}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${dots}</svg>`;
}

function normalizeIssue(i) {
  if (typeof i === "string") {
    const title = clean(i);
    return title ? { title, detail: explainFor(title), sev: "" } : null;
  }
  if (!i || typeof i !== "object") return null;
  const title = clean(i.title || i.name || i.issue || i.message || i.label || "");
  const detail = explainFor(title) || clean(i.description || i.detail || i.details || i.fix || i.recommendation || i.tip || "");
  const sev = clean(i.severity || i.impact || i.level || "");
  if (!title && !detail) return null;
  return { title: title || detail, detail: title ? detail : "", sev };
}

router.get("/:token", async (req, res) => {
  const nonce = crypto.randomBytes(16).toString("base64");
  res.set({
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
    "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; img-src https:; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
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

    const gsc = await getGscSnapshot(link.id, link.project_id);
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
    const siteUrl = typeof profile.website === "string" && profile.website.startsWith("https://") ? profile.website : null;
    const agencyLink = siteUrl ? `<a href="${esc(siteUrl)}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline">${esc(agencyName)}</a>` : esc(agencyName);

    let body = `<div class="head"><div class="head-in">
      <div class="topline">
        ${logo ? `<img src="${esc(logo)}" alt="${esc(agencyName)}">` : `<div class="brand">${agencyLink}</div>`}
        <button id="printBtn" class="btn" type="button">${PRINT_ICON} Save as PDF</button>
      </div>
      <div class="kicker">CEM SEO REPORT</div>
      <h1>${esc(project.domain)}</h1>
      <div class="chips">
        ${project.client_name ? `<span class="chip">Prepared for ${esc(project.client_name)}</span>` : ""}
        <span class="chip">By ${agencyLink}</span>
        ${audit ? `<span class="chip">Audit date ${esc(dateOnly(audit.run_at))}</span>` : ""}
      </div>
    </div></div><div class="wrap">`;

    if (!audit) {
      body += `<div class="card"><h2>No audit yet</h2><p class="muted">An audit has not been run for this site yet. Please check back soon.</p></div>`;
    } else {
      const score = Math.round(Number(audit.health_score) || 0);
      const crit = Number(audit.critical_issues) || 0;
      const change =
        trend.length >= 2
          ? trend[trend.length - 1].score - trend[0].score
          : null;
      body += `<div class="card"><div class="hero">
          ${ring(score)}
          <div class="hero-text">
            <p class="verdict">${esc(verdict(score))}</p>
            <div class="row">
              <div class="tile"><b style="color:#D63B3B">${esc(audit.critical_issues ?? 0)}</b><span>Critical</span></div>
              <div class="tile"><b style="color:#D98A00">${esc(audit.warnings ?? 0)}</b><span>Warnings</span></div>
              <div class="tile"><b>${esc(audit.notices ?? 0)}</b><span>Notices</span></div>
              <div class="tile"><b style="color:#1B9E5A">${esc(audit.passed_checks ?? 0)}</b><span>Passed</span></div>
            </div>
            ${crit > 0 ? `<p class="muted">${esc(crit)} critical issue${crit === 1 ? "" : "s"} should be fixed first.</p>` : ""}
          </div>
        </div></div>`;

      const cats = parseJson(audit.category_scores_json);
      if (cats && typeof cats === "object") {
        const bars = Object.entries(cats)
          .filter(([, v]) => typeof v === "number" && isFinite(v))
          .map(([k, v]) => {
            const val = Math.round(v <= 1 && v > 0 ? v * 100 : v);
            const col = scoreColor(val);
            return `<div class="bar"><div class="bar-top"><span>${esc(CATEGORY_LABELS[k] || k)}</span><b style="color:${col}">${esc(val)}</b></div><div class="track"><div class="fill" style="width:${Math.max(0, Math.min(100, val))}%;background:${col}"></div></div></div>`;
          })
          .join("");
        if (bars) body += `<div class="card"><h2>Scores by category</h2>${bars}</div>`;
      }

      const svg = trendSvg(trend, color);
      if (svg) {
        const changeText =
          change === null || change === 0
            ? "No change"
            : `${change > 0 ? "Up" : "Down"} ${Math.abs(change)} point${Math.abs(change) === 1 ? "" : "s"}`;
        body += `<div class="card"><h2>Health score over time</h2>${svg}<p class="muted">${esc(dateOnly(trend[0].at))} to ${esc(
          dateOnly(trend[trend.length - 1].at)
        )} &middot; ${esc(changeText)} since the first audit shown</p></div>`;
      }

      const issues = parseJson(audit.top_issues_json);
      const list = Array.isArray(issues) ? issues.slice(0, 8).map(normalizeIssue).filter(Boolean) : [];
      if (list.length) {
        const items = list
          .map(
            (it, n) =>
              `<li><span class="num">${n + 1}</span><div>${it.sev ? `<span class="sev">${esc(it.sev)}</span>` : ""}<div class="it">${esc(
                it.title
              )}</div>${it.detail ? `<div class="id">${esc(it.detail)}</div>` : ""}</div></li>`
          )
          .join("");
        body += `<div class="card"><h2>What to fix first</h2><ol>${items}</ol></div>`;
      }
    }

    if (gsc && Number(gsc.impressions) > 0) {
      body += `<div class="card"><h2>Google search performance</h2><div class="row">
        <div class="tile"><b>${esc(Number(gsc.clicks || 0).toLocaleString("en-US"))}</b><span>Clicks</span></div>
        <div class="tile"><b>${esc(Number(gsc.impressions || 0).toLocaleString("en-US"))}</b><span>Impressions</span></div>
        <div class="tile"><b>${esc(Number(gsc.position || 0).toFixed(1))}</b><span>Avg. position</span></div>
      </div><p class="muted">Source: Google Search Console &middot; ${esc(gsc.startDate)} to ${esc(gsc.endDate)} (last 28 days)</p></div>`;
    }

    body += `<p class="noprint">Tap "Save as PDF", then choose "Save as PDF" as the printer.</p>
      <div class="foot">Prepared by ${agencyLink}${profile.contact_email ? ` &middot; ${esc(profile.contact_email)}` : ""}${
      profile.website && String(profile.website).startsWith("https://") ? `<br>${esc(profile.website)}` : ""
    }<br>Powered by <a href="https://lumexalliance.com" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline">Lumex Alliance</a></div>
    </div>`;

    res.send(page(`SEO Report: ${project.domain}`, body, color, nonce));
  } catch (err) {
    console.error("Report page error:", err.message);
    res.status(500).send("Something went wrong");
  }
});

module.exports = router;
