require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const { authLimiter, generalLimiter } = require("./middleware/rateLimit");
const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const projectsRoutes = require("./routes/projects");
const auditRoutes = require("./routes/audit");
const keywordsRoutes = require("./routes/keywords");
const searchConsoleRoutes = require("./routes/searchConsole");

const app = express();

// Sets protective HTTP response headers (prevents clickjacking, disables
// content-type sniffing, etc.) — standard baseline hardening.
app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled since the reset-password page uses inline <script>

app.use(cors());
app.use(express.json({ limit: "100kb" })); // caps request body size, prevents oversized-payload abuse

app.get("/health", (req, res) => res.json({ ok: true }));

// Serves the actual password-reset web page — this is what the email
// link opens. Plain HTML/CSS/JS, no framework needed, since it only has
// one job: collect a new password and POST it to the API below.
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

// Auth routes get the strict rate limit — highest-value target for abuse
app.use("/api/auth", authLimiter, authRoutes);

// Everything else gets the looser general limit
app.use("/api/dashboard", generalLimiter, dashboardRoutes);
app.use("/api/projects", generalLimiter, projectsRoutes);
app.use("/api/audit", generalLimiter, auditRoutes);
app.use("/api/keywords", generalLimiter, keywordsRoutes);
app.use("/api/gsc", generalLimiter, searchConsoleRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Cem SEO API running on http://localhost:${PORT}`);
});
