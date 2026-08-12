const nodemailer = require("nodemailer");

const isConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter = null;
if (isConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendVerificationEmail(toEmail, name, code) {
  if (!transporter) {
    // No SMTP configured yet — don't block signup/testing, just surface the
    // code where the developer can see it. Replace this once real SMTP
    // credentials are set in `.env` (see README "Sending real emails").
    console.log(`\n📧 [DEV MODE — no SMTP configured] Verification code for ${toEmail}: ${code}\n`);
    return { sent: false, devMode: true };
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"Cem SEO" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "Verify your Cem SEO account",
    text: `Hi ${name},\n\nYour verification code is: ${code}\n\nThis code expires in 15 minutes.`,
    html: `<p>Hi ${name},</p><p>Your verification code is:</p><h2 style="letter-spacing:4px;">${code}</h2><p>This code expires in 15 minutes.</p>`,
  });

  return { sent: true, devMode: false };
}

module.exports = { sendVerificationEmail, isConfigured };
