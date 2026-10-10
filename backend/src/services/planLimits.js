// Single source of truth for what each plan allows.
// Enforced server-side so it applies to every client (app, website, Play build).
const db = require("../db");

const TRIAL_DAYS = 14;

const LIMITS = {
  starter: { maxSites: 1, auditIntervalHours: 168 }, // 1 site, 1 audit/site/week
  growth: { maxSites: 5, auditIntervalHours: 24 }, // 5 sites, 1 audit/site/day
  agency: { maxSites: null, auditIntervalHours: 0 }, // unlimited
};

function getEffectivePlan(user) {
  if (!user) return { plan: "starter", onTrial: false, trialEndsAt: null };

  const unlimited = (process.env.UNLIMITED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (user.email && unlimited.includes(user.email.toLowerCase())) {
    return { plan: "agency", onTrial: false, trialEndsAt: null };
  }

  const paidUntil = user.subscription_active_until ? new Date(user.subscription_active_until) : null;
  if (paidUntil && paidUntil > new Date() && LIMITS[user.plan]) {
    return { plan: user.plan, onTrial: false, trialEndsAt: null };
  }

  if (user.created_at) {
    const trialEndsAt = new Date(new Date(user.created_at).getTime() + TRIAL_DAYS * 86400000);
    if (trialEndsAt > new Date()) return { plan: "growth", onTrial: true, trialEndsAt };
  }

  return { plan: "starter", onTrial: false, trialEndsAt: null };
}

async function getUserLimits(userId) {
  const { rows } = await db.query(
    "SELECT email, plan, subscription_active_until, created_at FROM users WHERE id = $1",
    [userId]
  );
  const eff = getEffectivePlan(rows[0]);
  return { ...eff, ...LIMITS[eff.plan] };
}

module.exports = { TRIAL_DAYS, LIMITS, getEffectivePlan, getUserLimits };
