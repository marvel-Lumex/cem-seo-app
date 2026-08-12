const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../db");
const { seedProjectsForUser } = require("../db/seed");
const { requireAuth } = require("../middleware/auth");
const { sendVerificationEmail } = require("../mailer");

const router = express.Router();

function generateCode() {
  return String(crypto.randomInt(100000, 999999));
}

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET || "dev-secret", { expiresIn: "30d" });
}

router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, and password are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const { rows: existingRows } = await db.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
  if (existingRows[0]) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const code = generateCode();
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { rows: insertedRows } = await db.query(
    `INSERT INTO users (name, email, password_hash, verification_code, verification_expires)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [name, email.toLowerCase(), passwordHash, code, expires]
  );
  const userId = insertedRows[0].id;

  await db.query("INSERT INTO notification_prefs (user_id) VALUES ($1)", [userId]);

  // Give new users demo data so the app isn't empty on first login
  await seedProjectsForUser(userId);

  await sendVerificationEmail(email.toLowerCase(), name, code);

  const token = signToken(userId);
  res.status(201).json({
    token,
    user: { id: userId, name, email: email.toLowerCase(), emailVerified: false },
  });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const { rows } = await db.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
  const user = rows[0];
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken(user.id);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, emailVerified: !!user.email_verified },
  });
});

router.post("/verify", requireAuth, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "code is required" });

  const { rows } = await db.query("SELECT * FROM users WHERE id = $1", [req.userId]);
  const user = rows[0];
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.email_verified) return res.json({ verified: true, alreadyVerified: true });

  if (!user.verification_code || user.verification_code !== code) {
    return res.status(400).json({ error: "Incorrect code" });
  }
  if (new Date(user.verification_expires) < new Date()) {
    return res.status(400).json({ error: "Code expired — request a new one" });
  }

  await db.query("UPDATE users SET email_verified = 1, verification_code = NULL WHERE id = $1", [user.id]);
  res.json({ verified: true });
});

router.post("/resend-code", requireAuth, async (req, res) => {
  const { rows } = await db.query("SELECT * FROM users WHERE id = $1", [req.userId]);
  const user = rows[0];
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.email_verified) return res.status(400).json({ error: "Email already verified" });

  const code = generateCode();
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await db.query("UPDATE users SET verification_code = $1, verification_expires = $2 WHERE id = $3", [
    code,
    expires,
    user.id,
  ]);

  await sendVerificationEmail(user.email, user.name, code);
  res.json({ sent: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const { rows } = await db.query(
    "SELECT id, name, email, email_verified FROM users WHERE id = $1",
    [req.userId]
  );
  const user = rows[0];
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json({
    user: { id: user.id, name: user.name, email: user.email, emailVerified: !!user.email_verified },
  });
});

router.put("/profile", requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "name is required" });

  await db.query("UPDATE users SET name = $1 WHERE id = $2", [name.trim(), req.userId]);
  const { rows } = await db.query(
    "SELECT id, name, email, email_verified FROM users WHERE id = $1",
    [req.userId]
  );
  const user = rows[0];
  res.json({
    user: { id: user.id, name: user.name, email: user.email, emailVerified: !!user.email_verified },
  });
});

router.get("/notification-prefs", requireAuth, async (req, res) => {
  const { rows } = await db.query("SELECT * FROM notification_prefs WHERE user_id = $1", [req.userId]);
  const prefs = rows[0];
  if (!prefs) return res.status(404).json({ error: "No preferences found" });
  res.json({
    emailNotifications: !!prefs.email_notifications,
    pushNotifications: !!prefs.push_notifications,
    weeklyReport: !!prefs.weekly_report,
  });
});

router.put("/notification-prefs", requireAuth, async (req, res) => {
  const { emailNotifications, pushNotifications, weeklyReport } = req.body;
  await db.query(
    `UPDATE notification_prefs SET email_notifications = $1, push_notifications = $2, weekly_report = $3 WHERE user_id = $4`,
    [emailNotifications ? 1 : 0, pushNotifications ? 1 : 0, weeklyReport ? 1 : 0, req.userId]
  );
  res.json({ emailNotifications: !!emailNotifications, pushNotifications: !!pushNotifications, weeklyReport: !!weeklyReport });
});

module.exports = router;
