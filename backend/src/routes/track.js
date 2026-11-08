const express = require("express");
const crypto = require("crypto");
const db = require("../db");

const router = express.Router();

const ALLOWED = new Set(["page_view", "download_click"]);
const BOT = /bot|crawl|spider|preview|slurp|facebookexternalhit|headless|lighthouse|monitor/i;

// Small in-memory limiter: 60 events per IP per 10 minutes.
const hits = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX = 60;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (now - v.start > WINDOW_MS) hits.delete(k);
}, WINDOW_MS).unref();

function limited(ip) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.start > WINDOW_MS) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  h.count += 1;
  return h.count > MAX;
}

function deviceOf(ua) {
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/windows|macintosh|linux|cros/i.test(ua)) return "desktop";
  return "other";
}

function sourceOf(utm, ref) {
  const u = String(utm || "").toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 30);
  if (u) return u;
  if (!ref) return "direct";
  let host = "";
  try {
    host = new URL(String(ref).slice(0, 500)).hostname.toLowerCase().replace(/^www\./, "");
  } catch (e) {
    return "direct";
  }
  if (!host || host.endsWith("lumexalliance.com")) return "direct";
  if (host === "lnkd.in" || host.endsWith("linkedin.com")) return "linkedin";
  if (host.includes("google.")) return "google";
  if (host === "t.co" || host.endsWith("twitter.com") || host.endsWith("x.com")) return "x";
  if (host.endsWith("facebook.com")) return "facebook";
  if (host.includes("whatsapp")) return "whatsapp";
  return host.slice(0, 60);
}

// Public, anonymous. Stores no IP address: the visitor id is a hash that
// changes every day, so it can count visitors but never identify anyone.
router.post("/event", async (req, res) => {
  try {
    const ip = req.ip || "unknown";
    if (limited(ip)) return res.status(204).end();

    const body = req.body || {};
    const event = String(body.event || "");
    if (!ALLOWED.has(event)) return res.status(204).end();

    const ua = String(req.get("user-agent") || "").slice(0, 300);
    if (!ua || BOT.test(ua)) return res.status(204).end();

    const day = new Date().toISOString().slice(0, 10);
    const salt = process.env.JWT_SECRET || "cemseo";
    const visitor = crypto
      .createHash("sha256")
      .update(ip + "|" + ua + "|" + day + "|" + salt)
      .digest("hex")
      .slice(0, 16);

    await db.query(
      "INSERT INTO page_events (event, source, device, visitor) VALUES ($1, $2, $3, $4)",
      [event, sourceOf(body.utm, body.ref), deviceOf(ua), visitor]
    );
  } catch (err) {
    console.error("track error:", err.message);
  }
  res.status(204).end();
});

module.exports = router;
