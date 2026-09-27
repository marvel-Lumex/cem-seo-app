const db = require("../db");
const { sendEmail } = require("../mailer");

// Now uses the same Resend-based email system as everything else (was
// previously using its own separate, dead Gmail SMTP setup — which never
// actually worked once the backend moved to Render, since Render blocks
// outbound SMTP. Score-drop alert emails were silently failing this whole
// time as a result).

const SCORE_DROP_THRESHOLD = 10;

async function sendAlertEmail(toEmail, name, subject, bodyLines) {
  const text = `Hi ${name},\n\n${bodyLines.join("\n")}\n\n— Cem SEO`;
  const html = `<p>Hi ${name},</p><p>${bodyLines.join("<br/>")}</p><p>— Cem SEO</p>`;

  await sendEmail({ to: toEmail, subject, text, html });
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
