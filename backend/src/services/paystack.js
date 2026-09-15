// Real Paystack integration using plain fetch calls (no SDK dependency —
// keeps installs lightweight and avoids any native-module risk, same
// approach used for Google Search Console).
const crypto = require("crypto");

const PAYSTACK_API = "https://api.paystack.co";

// Plan prices in kobo (Paystack's smallest currency unit — 1 NGN = 100 kobo),
// matching the Starter/Growth/Agency tiers already shown in the Billing screen.
// Adjust these numbers anytime — they're the only place pricing is defined.
const PLANS = {
  starter: { name: "Starter", priceKobo: 0, features: ["1 project", "Weekly audits", "Basic keyword search"] },
  growth: {
    name: "Growth",
    priceKobo: 1500000, // ₦15,000/month
    features: ["5 projects", "Daily audits", "Full keyword research", "Email support"],
  },
  agency: {
    name: "Agency",
    priceKobo: 5000000, // ₦50,000/month
    features: ["Unlimited projects", "Real-time audits", "Priority support", "White-label reports"],
  },
};

function isConfigured() {
  return !!process.env.PAYSTACK_SECRET_KEY;
}

function getPlans() {
  return Object.entries(PLANS).map(([id, plan]) => ({
    id,
    name: plan.name,
    priceNaira: plan.priceKobo / 100,
    features: plan.features,
  }));
}

async function initializeTransaction({ email, planId, userId, callbackUrl }) {
  const plan = PLANS[planId];
  if (!plan) throw new Error("Unknown plan");
  if (plan.priceKobo === 0) throw new Error("Starter plan doesn't require payment");

  const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: plan.priceKobo,
      callback_url: callbackUrl,
      metadata: { userId, planId },
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.status) {
    throw new Error(data.message || "Couldn't start payment with Paystack");
  }

  return { authorizationUrl: data.data.authorization_url, reference: data.data.reference };
}

// Verifies that a webhook request genuinely came from Paystack, not an
// attacker pretending to send a "payment succeeded" event. Paystack signs
// every webhook with your secret key — this recomputes that signature and
// compares it to the one they sent.
function verifyWebhookSignature(rawBody, signatureHeader) {
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");
  return hash === signatureHeader;
}

module.exports = { isConfigured, getPlans, initializeTransaction, verifyWebhookSignature, PLANS };
