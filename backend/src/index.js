require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const { authLimiter, generalLimiter } = require("./middleware/rateLimit");
const paystackWebhook = require("./routes/paystackWebhook");
const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const projectsRoutes = require("./routes/projects");
const auditRoutes = require("./routes/audit");
const keywordsRoutes = require("./routes/keywords");
const searchConsoleRoutes = require("./routes/searchConsole");
const billingRoutes = require("./routes/billing");

const app = express();

app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled since some pages here use inline <script>
app.use(cors());

// IMPORTANT: the Paystack webhook needs the raw, unparsed request body for
// its signature check, so it's registered here — before the global
// express.json() below would otherwise consume and parse that body first.
app.use("/api/billing/webhook", paystackWebhook);

app.use(express.json({ limit: "100kb" }));

app.get("/health", (req, res) => res.json({ ok: true }));

// Serves the actual password-reset web page — this is what the email
// link opens. Plain HTML/CSS/JS, no framework needed.
app.get("/reset-password", (req, res) => {
  const { token, id } = req.query;
  if (!token || !id) {
    return res.status(400).send("<h2>Invalid reset link</h2><p>This link is missing required information.</p>");
  }

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reset your Cem SEO password</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 400px; margin: 60px auto; padding: 0 20px; background: #0B0C14; color: #E3E1D6; }
  h1 { font-size: 22px; }
  p { color: #94989F; font-size: 14px; line-height: 1.5; }
  input { width: 100%; box-sizing: border-box; padding: 14px; margin-top: 16px; border-radius: 10px; border: 1px solid #292C38; background: #161826; color: #E3E1D6; font-size: 15px; }
  button { width: 100%; padding: 14px; margin-top: 20px; border-radius: 10px; border: none; background: linear-gradient(135deg, #676AF6, #517EEE); color: white; font-weight: 700; font-size: 15px; }
  #message { margin-top: 16px; font-size: 14px; }
  .error { color: #F06666; }
  .success { color: #5ED68C; }
</style>
</head>
<body>
  <h1>Set a new password</h1>
  <p>Choose a new password for your Cem SEO account.</p>
  <input type="password" id="newPassword" placeholder="New password (min. 8 characters)" />
  <button onclick="submitReset()">Reset Password</button>
  <div id="message"></div>

  <script>
    const token = ${JSON.stringify(token)};
    const id = ${JSON.stringify(id)};

    async function submitReset() {
      const newPassword = document.getElementById('newPassword').value;
      const messageEl = document.getElementById('message');
      messageEl.textContent = '';
      messageEl.className = '';

      if (newPassword.length < 8) {
        messageEl.textContent = 'Password must be at least 8 characters.';
        messageEl.className = 'error';
        return;
      }

      try {
        const res = await fetch('/api/auth/reset-password-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, token, newPassword }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Something went wrong');

        messageEl.textContent = '✅ Password reset! You can now close this page and sign in with your new password in the Cem SEO app.';
        messageEl.className = 'success';
        document.querySelector('input').disabled = true;
        document.querySelector('button').disabled = true;
      } catch (err) {
        messageEl.textContent = err.message;
        messageEl.className = 'error';
      }
    }
  </script>
</body>
</html>`);
});

// Where Paystack sends the browser after checkout finishes. The actual
// account upgrade happens via the webhook above (which is reliable even if
// the user closes the browser tab too fast) — this page is just a friendly
// confirmation telling them to go back to the app.
app.get("/payment-complete", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Payment complete — Cem SEO</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 400px; margin: 80px auto; padding: 0 20px; background: #0B0C14; color: #E3E1D6; text-align: center; }
  h1 { font-size: 22px; }
  p { color: #94989F; font-size: 14px; line-height: 1.6; }
</style>
</head>
<body>
  <h1>✅ Payment received</h1>
  <p>You can close this page and return to the Cem SEO app — your plan will update within a few seconds.</p>
</body>
</html>`);
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/dashboard", generalLimiter, dashboardRoutes);
app.use("/api/projects", generalLimiter, projectsRoutes);
app.use("/api/audit", generalLimiter, auditRoutes);
app.use("/api/keywords", generalLimiter, keywordsRoutes);
app.use("/api/gsc", generalLimiter, searchConsoleRoutes);
app.use("/api/billing", generalLimiter, billingRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Cem SEO API running on http://localhost:${PORT}`);
});
