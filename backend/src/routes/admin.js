const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  const key = req.query.key;
  if (!process.env.ADMIN_SECRET || key !== process.env.ADMIN_SECRET) {
    return res.status(403).send("<h2>Forbidden</h2><p>Missing or incorrect admin key.</p>");
  }

  try {
    const { rows: userCountRows } = await db.query("SELECT COUNT(*) AS count FROM users");
    const { rows: verifiedCountRows } = await db.query("SELECT COUNT(*) AS count FROM users WHERE email_verified = 1");
    const { rows: planRows } = await db.query(
      `SELECT plan, COUNT(*) AS count FROM users WHERE subscription_active_until IS NOT NULL AND subscription_active_until > NOW()::text GROUP BY plan`
    );
    const { rows: recentSignups } = await db.query(
      "SELECT name, email, created_at FROM users ORDER BY created_at DESC LIMIT 10"
    );
    const { rows: projectCountRows } = await db.query("SELECT COUNT(*) AS count FROM projects");
    const { rows: auditCountRows } = await db.query("SELECT COUNT(*) AS count FROM audits");

    // Real recent activity — actual audits being run, by whom, on which
    // site, and their score — this is what "monitoring subscriber
    // activity" actually means, not just aggregate counts.
    const { rows: recentAudits } = await db.query(
      `SELECT u.name, u.email, p.domain, a.health_score, a.run_at
       FROM audits a
       JOIN projects p ON p.id = a.project_id
       JOIN users u ON u.id = p.user_id
       ORDER BY a.run_at DESC LIMIT 15`
    );

    const { rows: gscConnections } = await db.query(
      `SELECT u.name, u.email, p.domain, p.gsc_site_url
       FROM projects p
       JOIN users u ON u.id = p.user_id
       WHERE p.gsc_refresh_token IS NOT NULL
       ORDER BY p.id DESC LIMIT 10`
    );

    const planPrices = { growth: 15000, agency: 50000 };
    let estimatedMonthlyRevenue = 0;
    const planBreakdown = planRows.map((r) => {
      const count = Number(r.count);
      const price = planPrices[r.plan] || 0;
      estimatedMonthlyRevenue += count * price;
      return { plan: r.plan, count };
    });

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cem SEO — Admin</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; background: #0B0C14; color: #E3E1D6; }
  h1 { font-size: 22px; }
  h2 { font-size: 15px; color: #94989F; margin-top: 32px; margin-bottom: 8px; }
  .stat-grid { display: flex; flex-wrap: wrap; gap: 12px; }
  .stat-card { background: #161826; border: 1px solid #292C38; border-radius: 10px; padding: 16px; flex: 1; min-width: 120px; }
  .stat-value { font-size: 24px; font-weight: 700; }
  .stat-label { font-size: 12px; color: #94989F; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { text-align: left; padding: 8px; border-bottom: 1px solid #292C38; font-size: 13px; }
  th { color: #94989F; font-weight: 600; }
  .score-good { color: #5ED68C; }
  .score-mid { color: #F0B259; }
  .score-bad { color: #F06666; }
  .refresh-note { color: #94989F; font-size: 11px; margin-top: 24px; }
</style>
</head>
<body>
  <h1>Cem SEO — Admin Dashboard</h1>

  <h2>Users</h2>
  <div class="stat-grid">
    <div class="stat-card"><div class="stat-value">${userCountRows[0].count}</div><div class="stat-label">Total users</div></div>
    <div class="stat-card"><div class="stat-value">${verifiedCountRows[0].count}</div><div class="stat-label">Verified</div></div>
    <div class="stat-card"><div class="stat-value">${projectCountRows[0].count}</div><div class="stat-label">Sites tracked</div></div>
    <div class="stat-card"><div class="stat-value">${auditCountRows[0].count}</div><div class="stat-label">Audits run</div></div>
  </div>

  <h2>Active subscriptions</h2>
  <div class="stat-grid">
    ${planBreakdown.length > 0 ? planBreakdown.map((p) => `<div class="stat-card"><div class="stat-value">${p.count}</div><div class="stat-label">${p.plan}</div></div>`).join("") : '<p style="color:#94989F;font-size:13px;">No active paid subscriptions yet.</p>'}
  </div>
  <p style="color:#94989F;font-size:12px;margin-top:8px;">Estimated monthly revenue: ₦${estimatedMonthlyRevenue.toLocaleString()} (based on current active plans — not a Paystack-verified figure)</p>

  <h2>Recent audit activity (real usage)</h2>
  <table>
    <tr><th>User</th><th>Site</th><th>Score</th><th>When</th></tr>
    ${recentAudits.length > 0 ? recentAudits.map((a) => {
      const scoreClass = a.health_score >= 80 ? "score-good" : a.health_score >= 50 ? "score-mid" : "score-bad";
      return `<tr><td>${a.name}</td><td>${a.domain}</td><td class="${scoreClass}">${a.health_score}</td><td>${new Date(a.run_at).toLocaleString()}</td></tr>`;
    }).join("") : '<tr><td colspan="4" style="color:#94989F;">No audits run yet.</td></tr>'}
  </table>

  <h2>Search Console connections</h2>
  <table>
    <tr><th>User</th><th>Site</th><th>Connected property</th></tr>
    ${gscConnections.length > 0 ? gscConnections.map((g) => `<tr><td>${g.name}</td><td>${g.domain}</td><td>${g.gsc_site_url}</td></tr>`).join("") : '<tr><td colspan="3" style="color:#94989F;">No one has connected Search Console yet.</td></tr>'}
  </table>

  <h2>Recent signups</h2>
  <table>
    <tr><th>Name</th><th>Email</th><th>Joined</th></tr>
    ${recentSignups.map((u) => `<tr><td>${u.name}</td><td>${u.email}</td><td>${new Date(u.created_at).toLocaleDateString()}</td></tr>`).join("")}
  </table>

  <p class="refresh-note">Refresh this page to see the latest activity — no auto-refresh.</p>
</body>
</html>`);
  } catch (err) {
    console.error("Admin dashboard error:", err.message);
    res.status(500).send("<h2>Something went wrong loading the dashboard.</h2>");
  }
});

module.exports = router;
