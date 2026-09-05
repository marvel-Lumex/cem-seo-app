const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../db");
const { seedProjectsForUser } = require("../db/seed");
const { requireAuth } = require("../middleware/auth");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../mailer");

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
  await seedProjectsForUser(userId);

  try {
    await sendVerificationEmail(email.toLowerCase(), name, code);
  } catch (err) {
    console.error("Failed to send verification email:", err.message);
  }

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

  try {
    await sendVerificationEmail(user.email, user.name, code);
  } catch (err) {
    console.error("Failed to resend verification email:", err.message);
    return res.status(502).json({ error: "Couldn't send the email right now. Try again shortly." });
  }
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

// Link-based reset: emails a real clickable link instead of a typed code.
// Chosen over codes specifically because backgrounding the app to copy a
// code was causing state loss on the user's device — a link opens a normal
// web page instead, no need to return to the app mid-flow at all.
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  const { rows } = await db.query("SELECT id, name, email FROM users WHERE email = $1", [email.toLowerCase()]);
  const user = rows[0];

  if (user) {
    try {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      await db.query(
        "UPDATE users SET reset_token_hash = $1, reset_token_expires = $2 WHERE id = $3",
        [tokenHash, expires, user.id]
      );

      const appUrl = process.env.APP_URL || "https://cem-seo-backend.onrender.com";
      const resetLink = `${appUrl}/reset-password?token=${rawToken}&id=${user.id}`;
      await sendPasswordResetEmail(user.email, user.name, resetLink);
    } catch (err) {
      console.error("Failed to send password reset email:", err.message);
    }
  }

  res.json({ sent: true });
});

// Called by the web reset-password page (see index.js for the page itself),
// not directly by the mobile app.
router.post("/reset-password-token", async (req, res) => {
  const { id, token, newPassword } = req.body;
  if (!id || !token || !newPassword) {
    return res.status(400).json({ error: "id, token, and newPassword are required" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const { rows } = await db.query("SELECT * FROM users WHERE id = $1", [id]);
  const user = rows[0];
  if (!user || !user.reset_token_hash) {
    return res.status(400).json({ error: "This reset link is invalid or has already been used." });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  if (tokenHash !== user.reset_token_hash) {
    return res.status(400).json({ error: "This reset link is invalid or has already been used." });
  }
  if (new Date(user.reset_token_expires) < new Date()) {
    return res.status(400).json({ error: "This reset link has expired. Request a new one from the app." });
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  await db.query(
    "UPDATE users SET password_hash = $1, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = $2",
    [passwordHash, user.id]
  );

  res.json({ reset: true });
});

router.put("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword and newPassword are required" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }

  const { rows } = await db.query("SELECT id, password_hash FROM users WHERE id = $1", [req.userId]);
  const user = rows[0];
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, req.userId]);

  res.json({ changed: true });
});

module.exports = router;
