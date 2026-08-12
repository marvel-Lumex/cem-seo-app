const db = require("../db");
const nodemailer = require("nodemailer");

// Reuses the same SMTP transporter setup as verification emails.
// Kept separate from mailer.js's single-purpose function so alert emails
// can have their own subject/body without overloading sendVerificationEmail.
const isConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
let transporter = null;
if (isConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const SCORE_DROP_THRESHOLD = 10;

async function sendAlertEmail(toEmail, name, subject, bodyLines) {
  const text = `Hi ${name},\n\n${bodyLines.join("\n")}\n\n— Cem SEO`;
  const html = `<p>Hi ${name},</p><p>${bodyLines.join("<br/>")}</p><p>— Cem SEO</p>`;

  if (!transporter) {
    console.log(`\n📧 [DEV MODE — no SMTP configured] Alert for ${toEmail}: ${subject}\n${text}\n`);
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"Cem SEO" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject,
    text,
    html,
  });
}

// Compares a freshly-completed audit against the one before it, and emails
// the user if their score dropped meaningfully or critical issues went up —
// but only if they have email notifications turned on (Notifications screen).
async function checkAndSendAuditAlert(userId, project, newAudit, previousAudit) {
  try {
    const { rows: userRows } = await db.query("SELECT name, email FROM users WHERE id = $1", [userId]);
    const { rows: prefRows } = await db.query("SELECT email_notifications FROM notification_prefs WHERE user_id = $1", [userId]);
    const user = userRows[0];
    const prefs = prefRows[0];
    if (!user || !prefs?.email_notifications) return;

    if (!previousAudit) return; // nothing to compare against on the very first audit

    const scoreDrop = previousAudit.health_score - newAudit.healthScore;
    const criticalIncrease = newAudit.criticalIssues - previousAudit.critical_issues;

    if (scoreDrop >= SCORE_DROP_THRESHOLD) {
      await sendAlertEmail(user.email, user.name, `⚠️ ${project.domain}'s SEO score dropped`, [
        `Your health score for ${project.domain} dropped from ${previousAudit.health_score} to ${newAudit.healthScore}.`,
        `Open Cem SEO to see what changed and what to fix.`,
      ]);
    } else if (criticalIncrease > 0) {
      await sendAlertEmail(user.email, user.name, `⚠️ New critical issues found on ${project.domain}`, [
        `Your latest audit found ${newAudit.criticalIssues} critical issue${newAudit.criticalIssues === 1 ? "" : "s"} on ${project.domain} (up from ${previousAudit.critical_issues}).`,
        `Open Cem SEO to see the details.`,
      ]);
    }
  } catch (err) {
    // Alerts are best-effort — never let an email failure break the audit response
    console.error("Failed to send audit alert:", err.message);
  }
}

module.exports = { checkAndSendAuditAlert };
