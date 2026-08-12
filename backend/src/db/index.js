const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error(
    "\n❌ DATABASE_URL is not set. Add your Postgres connection string to backend/.env — see README 'Real hosted database (Postgres)' for how to get one free from Neon.\n"
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon (and most managed Postgres providers) require SSL, but their
  // certificates aren't always in Node's default trust store — this is the
  // standard/expected setting for connecting to them.
  ssl: { rejectUnauthorized: false },
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email_verified INTEGER DEFAULT 0,
      verification_code TEXT,
      verification_expires TEXT,
      active_project_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notification_prefs (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      email_notifications INTEGER DEFAULT 1,
      push_notifications INTEGER DEFAULT 1,
      weekly_report INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      domain TEXT NOT NULL,
      status TEXT DEFAULT 'Active',
      seo_score INTEGER DEFAULT 0,
      total_clicks INTEGER DEFAULT 0,
      total_impressions INTEGER DEFAULT 0,
      avg_position REAL DEFAULT 0,
      backlinks INTEGER DEFAULT 0,
      last_audit_at TEXT,
      gsc_refresh_token TEXT,
      gsc_access_token TEXT,
      gsc_token_expires TEXT,
      gsc_site_url TEXT
    );

    CREATE TABLE IF NOT EXISTS audits (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      health_score INTEGER,
      critical_issues INTEGER,
      warnings INTEGER,
      notices INTEGER,
      passed_checks INTEGER,
      top_issues_json TEXT,
      category_scores_json TEXT,
      run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS keywords (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      keyword TEXT NOT NULL,
      volume TEXT,
      difficulty INTEGER,
      match_type TEXT DEFAULT 'broad'
    );
  `);
}

// Runs once at startup — safe to call every boot since CREATE TABLE IF NOT
// EXISTS is a no-op once the schema already exists.
const ready = init().catch((err) => {
  console.error("❌ Failed to initialize database:", err.message);
  process.exit(1);
});

module.exports = {
  pool,
  ready,
  query: (text, params) => pool.query(text, params),
};
