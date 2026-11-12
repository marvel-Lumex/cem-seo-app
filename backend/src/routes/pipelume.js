const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getUserLimits } = require("../services/planLimits");
const pipelume = require("../services/pipelume");

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(requireAuth);

router.get(
  "/status",
  wrap(async (req, res) => {
    const limits = await getUserLimits(req.userId);
    const link = await pipelume.getLink(req.userId);
    res.json({
      available: pipelume.isConfigured(),
      eligible: limits.plan === "agency",
      connected: !!link,
      connectedAt: link ? link.connectedAt : null,
      lastSyncAt: link ? link.lastSyncAt : null,
      lastError: link ? link.lastError : null,
    });
  })
);

// Called by the connect page after the user signs in. The Pipelume connector key only lets this server send contacts in.
router.post(
  "/link",
  wrap(async (req, res) => {
    if (!pipelume.isConfigured()) return res.status(503).json({ error: "Pipelume linking is not available right now." });
    const limits = await getUserLimits(req.userId);
    if (limits.plan !== "agency") {
      return res.status(403).json({ error: "Linking Pipelume is available on the Agency plan, because it syncs your Clients." });
    }
    const key = req.body && typeof req.body.key === "string" ? req.body.key.trim() : "";
    if (!(await pipelume.checkKey(key))) {
      return res.status(400).json({ error: "That Pipelume key is not valid. Go back to Pipelume and tap Connect Cem SEO again." });
    }
    await pipelume.saveLink(req.userId, key);
    pipelume.syncAll(req.userId); // runs in the background
    res.status(201).json({ connected: true });
  })
);

router.post(
  "/sync",
  wrap(async (req, res) => {
    const link = await pipelume.getLink(req.userId);
    if (!link) return res.status(404).json({ error: "Pipelume is not linked." });
    pipelume.syncAll(req.userId);
    res.json({ started: true });
  })
);

router.delete(
  "/link",
  wrap(async (req, res) => {
    await pipelume.removeLink(req.userId);
    res.json({ connected: false });
  })
);

module.exports = router;
