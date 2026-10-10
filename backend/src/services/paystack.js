// Real Paystack integration using plain fetch calls (no SDK dependency —
// keeps installs lightweight and avoids any native-module risk, same
// approach used for Google Search Console).
const crypto = require("crypto");

const PAYSTACK_API = "https://api.paystack.co";

// Plan prices in kobo (1 NGN = 100 kobo). Website prices.
// Features list ONLY what the server actually enforces (see planLimits.js).
const PLANS = {
  starter: {
    name: "Starter",
    priceKobo: 0,
    features: ["1 site", "1 audit per site per week", "Basic keyword search"],
  },
  growth: {
    name: "Growth",
    priceKobo: 2500000, // ₦25,000 per 30 days
    features: ["Up to 5 sites", "1 audit per site per day", "Full keyword research", "Email support"],
  },
  agency: {
    name: "Agency",
    priceKobo: 5500000, // ₦55,000 per 30 days
    features: ["Unlimited sites", "Unlimited audits", "Full keyword research", "Priority support"],
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

// Verifies that a webhook request genuinely came from Paystack. Paystack signs
// every webhook with your secret key — this recomputes and compares.
function verifyWebhookSignature(rawBody, signatureHeader) {
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");
  return hash === signatureHeader;
}

module.exports = { isConfigured, getPlans, initializeTransaction, verifyWebhookSignature, PLANS };
