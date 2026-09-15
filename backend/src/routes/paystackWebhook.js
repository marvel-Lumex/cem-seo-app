// Kept separate from billing.js and registered BEFORE the app's global
// express.json() middleware in index.js — Paystack's signature verification
// needs the exact raw, unparsed request bytes, which express.json() would
// otherwise consume first if this were mounted after it.
const express = require("express");
const db = require("../db");
const paystack = require("../services/paystack");

const router = express.Router();

router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["x-paystack-signature"];
  if (!signature || !paystack.verifyWebhookSignature(req.body, signature)) {
    return res.status(401).send("Invalid signature");
  }

  const event = JSON.parse(req.body.toString());

  if (event.event === "charge.success") {
    const { userId, planId } = event.data.metadata || {};
    if (userId && planId) {
      const activeUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await db.query("UPDATE users SET plan = $1, subscription_active_until = $2 WHERE id = $3", [
        planId,
        activeUntil,
        userId,
      ]);
    }
  }

  res.sendStatus(200);
});

module.exports = router;
