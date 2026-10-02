const express = require("express");
const db = require("../db");

const router = express.Router();

// Simple admin dashboard — protected by a secret key in the URL, not a full
// login system (fine for a solo founder checking in occasionally; revisit
// if more than one person ever needs admin access). Shows real counts
// queried directly from the database, no fabricated numbers.
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
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 20px; background: #0B0C14; color: #E3E1D6; }
  h1 { font-size: 22px; }
  h2 { font-size: 15px; color: #94989F; margin-top: 32px; margin-bottom: 8px; }
  .stat-grid { display: flex; flex-wrap: wrap; gap: 12px; }
  .stat-card { background: #161826; border: 1px solid #292C38; border-radius: 10px; padding: 16px; flex: 1; min-width: 120px; }
  .stat-value { font-size: 24px; font-weight: 700; }
  .stat-label { font-size: 12px; color: #94989F; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { text-align: left; padding: 8px; border-bottom: 1px solid #292C38; font-size: 13px; }
  th { color: #94989F; font-weight: 600; }
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

  <h2>Recent signups</h2>
  <table>
    <tr><th>Name</th><th>Email</th><th>Joined</th></tr>
    ${recentSignups.map((u) => `<tr><td>${u.name}</td><td>${u.email}</td><td>${new Date(u.created_at).toLocaleDateString()}</td></tr>`).join("")}
  </table>
</body>
</html>`);
  } catch (err) {
    console.error("Admin dashboard error:", err.message);
    res.status(500).send("<h2>Something went wrong loading the dashboard.</h2>");
  }
});

module.exports = router;
