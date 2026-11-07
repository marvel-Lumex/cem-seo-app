const crypto = require("crypto");

function secret() {
  return process.env.REPORT_LINK_SECRET || process.env.JWT_SECRET || "dev-secret";
}

function sign(id) {
  return crypto.createHmac("sha256", secret()).update("report-link:" + id).digest("base64url");
}

function makeToken(id) {
  return id + "." + sign(id);
}

function verifyToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !/^\d{1,9}$/.test(parts[0])) return null;
  const a = Buffer.from(parts[1]);
  const b = Buffer.from(sign(parts[0]));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return Number(parts[0]);
}

module.exports = { makeToken, verifyToken };
