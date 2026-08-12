require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const projectsRoutes = require("./routes/projects");
const auditRoutes = require("./routes/audit");
const keywordsRoutes = require("./routes/keywords");
const searchConsoleRoutes = require("./routes/searchConsole");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/keywords", keywordsRoutes);
app.use("/api/gsc", searchConsoleRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Cem SEO API running on http://localhost:${PORT}`);
});
