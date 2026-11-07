const db = require("../db");

db.ready
  .then(() =>
    db.query(`
      CREATE TABLE IF NOT EXISTS agency_profiles (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        agency_name TEXT,
        brand_color TEXT,
        logo_url TEXT,
        contact_email TEXT,
        website TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        contact_email TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;
      CREATE TABLE IF NOT EXISTS report_links (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        revoked_at TIMESTAMP,
        last_viewed_at TIMESTAMP,
        view_count INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS report_links_project_idx ON report_links(project_id);
    `)
  )
  .then(() => console.log("Agency tables ready"))
  .catch((err) => console.error("Agency schema init failed:", err.message));
