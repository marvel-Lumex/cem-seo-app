const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../db");
const { seedProjectsForUser } = require("../db/seed");
const { requireAuth } = require("../middleware/auth");
const { sendVerificationEmail, sendPasswordResetEmail, sendEmailChangeVerification } = require("../mailer");
const { isValidEmail, isValidName, isValidPassword } = require("../utils/validate");

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
  if (!isValidName(name)) {
    return res.status(400).json({ error: "Name must be between 1 and 100 characters" });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Please enter a valid email address" });
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ error: "Password must be between 8 and 128 characters" });
  }

  const trimmedName = name.trim();
  const lowerEmail = email.trim().toLowerCase();

  const { rows: existingRows } = await db.query("SELECT id FROM users WHERE email = $1", [lowerEmail]);
  if (existingRows[0]) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const code = generateCode();
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { rows: insertedRows } = await db.query(
    `INSERT INTO users (name, email, password_hash, verification_code, verification_expires)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [trimmedName, lowerEmail, passwordHash, code, expires]
  );
  const userId = insertedRows[0].id;

  await db.query("INSERT INTO notification_prefs (user_id) VALUES ($1)", [userId]);
  await seedProjectsForUser(userId);

  try {
    await sendVerificationEmail(lowerEmail, trimmedName, code);
  } catch (err) {
    console.error("Failed to send verification email:", err.message);
  }

  const token = signToken(userId);
  res.status(201).json({
    token,
    user: { id: userId, name: trimmedName, email: lowerEmail, emailVerified: false },
  });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Invalid email or password" });
  }

  const { rows } = await db.query("SELECT * FROM users WHERE email = $1", [email.trim().toLowerCase()]);
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
  if (!name || !isValidName(name)) {
    return res.status(400).json({ error: "Name must be between 1 and 100 characters" });
  }

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

// Starts an email change — sends a verification code to the NEW address to
// confirm the user actually controls it before the swap is made.
router.post("/request-email-change", requireAuth, async (req, res) => {
  const { newEmail } = req.body;
  if (!newEmail || !isValidEmail(newEmail)) {
    return res.status(400).json({ error: "Please enter a valid email address" });
  }

  const lowerNewEmail = newEmail.trim().toLowerCase();

  const { rows: currentRows } = await db.query("SELECT id, name, email FROM users WHERE id = $1", [req.userId]);
  const currentUser = currentRows[0];
  if (!currentUser) return res.status(404).json({ error: "User not found" });

  if (lowerNewEmail === currentUser.email) {
    return res.status(400).json({ error: "That's already your current email" });
  }

  const { rows: existingRows } = await db.query("SELECT id FROM users WHERE email = $1", [lowerNewEmail]);
  if (existingRows[0]) {
    return res.status(409).json({ error: "That email is already in use by another account" });
  }

  const code = generateCode();
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await db.query(
    "UPDATE users SET pending_email = $1, email_change_code = $2, email_change_expires = $3 WHERE id = $4",
    [lowerNewEmail, code, expires, req.userId]
  );

  try {
    await sendEmailChangeVerification(lowerNewEmail, currentUser.name, code);
  } catch (err) {
    console.error("Failed to send email change verification:", err.message);
    return res.status(502).json({ error: "Couldn't send the verification email right now. Try again shortly." });
  }

  res.json({ sent: true });
});

router.post("/confirm-email-change", requireAuth, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "code is required" });

  const { rows } = await db.query("SELECT * FROM users WHERE id = $1", [req.userId]);
  const user = rows[0];
  if (!user) return res.status(404).json({ error: "User not found" });

  if (!user.pending_email || !user.email_change_code) {
    return res.status(400).json({ error: "No email change is pending. Start over from Profile." });
  }
  if (user.email_change_code !== code) {
    return res.status(400).json({ error: "Incorrect code" });
  }
  if (new Date(user.email_change_expires) < new Date()) {
    return res.status(400).json({ error: "Code expired — request a new one from Profile" });
  }

  const { rows: existingRows } = await db.query("SELECT id FROM users WHERE email = $1 AND id != $2", [
    user.pending_email,
    user.id,
  ]);
  if (existingRows[0]) {
    return res.status(409).json({ error: "That email was just taken by another account. Try a different one." });
  }

  await db.query(
    "UPDATE users SET email = $1, pending_email = NULL, email_change_code = NULL, email_change_expires = NULL WHERE id = $2",
    [user.pending_email, user.id]
  );

  const { rows: updatedRows } = await db.query(
    "SELECT id, name, email, email_verified FROM users WHERE id = $1",
    [user.id]
  );
  const updated = updatedRows[0];
  res.json({
    user: { id: updated.id, name: updated.name, email: updated.email, emailVerified: !!updated.email_verified },
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

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email || !isValidEmail(email)) {
    return res.json({ sent: true });
  }

  const { rows } = await db.query("SELECT id, name, email FROM users WHERE email = $1", [email.trim().toLowerCase()]);
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

router.post("/reset-password-token", async (req, res) => {
  const { id, token, newPassword } = req.body;
  if (!id || !token || !newPassword) {
    return res.status(400).json({ error: "id, token, and newPassword are required" });
  }
  if (!isValidPassword(newPassword)) {
    return res.status(400).json({ error: "Password must be between 8 and 128 characters" });
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
  if (!isValidPassword(newPassword)) {
    return res.status(400).json({ error: "New password must be between 8 and 128 characters" });
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
