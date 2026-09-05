// Real email delivery via Resend's HTTP API — not SMTP. This matters
// specifically because Render's free tier blocks all outbound SMTP traffic
// (ports 25/465/587) to prevent spam abuse, which is why Gmail SMTP was
// timing out and crashing requests. Resend sends over regular HTTPS, which
// isn't blocked, and has a genuinely free tier (3,000 emails/month).
const RESEND_API_URL = "https://api.resend.com/emails";

const isConfigured = !!process.env.RESEND_API_KEY;

async function sendEmail({ to, subject, text, html }) {
  if (!isConfigured) {
    console.log(`\n📧 [DEV MODE — no RESEND_API_KEY configured] To: ${to} | Subject: ${subject}\n${text}\n`);
    return { sent: false, devMode: true };
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "Cem SEO <onboarding@resend.dev>",
      to,
      subject,
      text,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }

  return { sent: true, devMode: false };
}

async function sendVerificationEmail(toEmail, name, code) {
  return sendEmail({
    to: toEmail,
    subject: "Verify your Cem SEO account",
    text: `Hi ${name},\n\nYour verification code is: ${code}\n\nThis code expires in 15 minutes.`,
    html: `<p>Hi ${name},</p><p>Your verification code is:</p><h2 style="letter-spacing:4px;">${code}</h2><p>This code expires in 15 minutes.</p>`,
  });
}

// Link-based, not code-based — the reset link opens a real web page to
// finish the reset, so there's no need to background the app and come back
// with a typed code (which was causing state loss on the user's device).
async function sendPasswordResetEmail(toEmail, name, resetLink) {
  return sendEmail({
    to: toEmail,
    subject: "Reset your Cem SEO password",
    text: `Hi ${name},\n\nWe received a request to reset your password. Click the link below to choose a new one:\n${resetLink}\n\nThis link expires in 30 minutes. If you didn't request this, you can safely ignore this email.`,
    html: `<p>Hi ${name},</p><p>We received a request to reset your password. Click the link below to choose a new one:</p><p><a href="${resetLink}">${resetLink}</a></p><p>This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.</p>`,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, isConfigured };
