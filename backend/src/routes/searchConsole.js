const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { getActiveProject } = require("../services/activeProject");
const gsc = require("../services/searchConsole");

const router = express.Router();

router.get("/status", requireAuth, async (req, res) => {
  if (!gsc.isConfigured()) {
    return res.json({ configured: false, connected: false, siteUrl: null });
  }
  const project = await getActiveProject(req.userId);
  if (!project) return res.json({ configured: true, connected: false, siteUrl: null });

  res.json({
    configured: true,
    connected: !!project.gsc_refresh_token,
    siteUrl: project.gsc_site_url || null,
  });
});

// Returns the Google OAuth consent URL for the app to open in a browser.
router.get("/auth-url", requireAuth, async (req, res) => {
  if (!gsc.isConfigured()) {
    return res.status(400).json({ error: "Search Console isn't configured on this server yet." });
  }
  const project = await getActiveProject(req.userId);
  if (!project) return res.status(404).json({ error: "No active project to connect." });

  res.json({ url: gsc.buildAuthUrl(req.userId, project.id) });
});

// Google redirects here after the user approves access in their browser.
// No auth header available at this point — identity comes from the signed
// "state" param instead (see searchConsole.js for details/caveats).
router.get("/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.send(`<h2>Connection cancelled</h2><p>You can close this tab and return to the app.</p>`);
  }

  const decoded = gsc.decodeState(state);
  if (!decoded) {
    return res.status(400).send("<h2>Something went wrong</h2><p>Invalid state — please try connecting again from the app.</p>");
  }

  try {
    const tokens = await gsc.exchangeCodeForTokens(code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await db.query(
      "UPDATE projects SET gsc_refresh_token = $1, gsc_access_token = $2, gsc_token_expires = $3 WHERE id = $4 AND user_id = $5",
      [tokens.refresh_token, tokens.access_token, expiresAt, decoded.projectId, decoded.userId]
    );

    res.send(
      `<h2>✅ Connected!</h2><p>Google Search Console is now linked. You can close this tab and return to the app to pick which site's data to show.</p>`
    );
  } catch (err) {
    res.status(500).send(`<h2>Connection failed</h2><p>${err.message}</p>`);
  }
});

// Lists the user's verified Search Console properties so they can pick
// which one matches this project (GSC property URLs don't always match our
// stored "domain" string exactly — e.g. "sc-domain:example.com" vs "https://example.com/").
router.get("/sites", requireAuth, async (req, res) => {
  const project = await getActiveProject(req.userId);
  if (!project || !project.gsc_refresh_token) {
    return res.status(400).json({ error: "Connect Google Search Console first." });
  }

  try {
    const accessToken = await gsc.getValidAccessToken(project);
    const sites = await gsc.listSites(accessToken);
    res.json(sites);
  } catch (err) {
    res.status(502).json({ error: err.message || "Couldn't list Search Console sites." });
  }
});

router.put("/site", requireAuth, async (req, res) => {
  const { siteUrl } = req.body;
  if (!siteUrl) return res.status(400).json({ error: "siteUrl is required" });

  const project = await getActiveProject(req.userId);
  if (!project) return res.status(404).json({ error: "No active project." });

  await db.query("UPDATE projects SET gsc_site_url = $1 WHERE id = $2", [siteUrl, project.id]);
  res.json({ siteUrl });
});

router.delete("/disconnect", requireAuth, async (req, res) => {
  const project = await getActiveProject(req.userId);
  if (!project) return res.status(404).json({ error: "No active project." });

  await db.query(
    "UPDATE projects SET gsc_refresh_token = NULL, gsc_access_token = NULL, gsc_token_expires = NULL, gsc_site_url = NULL WHERE id = $1",
    [project.id]
  );
  res.json({ disconnected: true });
});

module.exports = router;
