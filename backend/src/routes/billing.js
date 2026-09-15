const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const paystack = require("../services/paystack");

const router = express.Router();

router.get("/plans", (req, res) => {
  res.json({ configured: paystack.isConfigured(), plans: paystack.getPlans() });
});

router.get("/status", requireAuth, async (req, res) => {
  const { rows } = await db.query("SELECT plan, subscription_active_until FROM users WHERE id = $1", [req.userId]);
  const user = rows[0];
  const isActive = user?.subscription_active_until ? new Date(user.subscription_active_until) > new Date() : false;

  res.json({
    plan: isActive ? user.plan : "starter",
    activeUntil: isActive ? user.subscription_active_until : null,
  });
});

router.post("/initialize", requireAuth, async (req, res) => {
  if (!paystack.isConfigured()) {
    return res.status(400).json({ error: "Payments aren't configured on this server yet." });
  }

  const { planId } = req.body;
  if (!planId || !paystack.PLANS[planId]) {
    return res.status(400).json({ error: "Please choose a valid plan." });
  }
  if (planId === "starter") {
    return res.status(400).json({ error: "The Starter plan is free — no payment needed." });
  }

  const { rows } = await db.query("SELECT email FROM users WHERE id = $1", [req.userId]);
  const user = rows[0];
  if (!user) return res.status(404).json({ error: "User not found" });

  try {
    const appUrl = process.env.APP_URL || "https://cem-seo-backend.onrender.com";
    const result = await paystack.initializeTransaction({
      email: user.email,
      planId,
      userId: req.userId,
      callbackUrl: `${appUrl}/payment-complete`,
    });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message || "Couldn't start payment right now." });
  }
});

module.exports = router;
