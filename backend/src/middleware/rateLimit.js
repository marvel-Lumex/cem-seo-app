const rateLimit = require("express-rate-limit");

// Strict limiter for auth endpoints (login, signup, forgot-password) — these
// are the highest-value targets for brute-force/spam abuse. 10 requests per
// 15 minutes per IP is generous for a real user (nobody logs in 10 times in
// 15 minutes) but blocks automated password-guessing or signup-spam scripts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many attempts. Please try again in a few minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Looser limiter for general API use (dashboard, audits, keywords) — mainly
// to prevent runaway loops or abuse, not meant to bother real usage patterns.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, generalLimiter };
