const db = require("../db");

// One row per Cem SEO user who linked a Pipelume workspace.
// key_enc holds that workspace's connector key, encrypted (see services/pipelume.js).
db.ready
  .then(() =>
    db.query(`
      CREATE TABLE IF NOT EXISTS pipelume_links (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        key_enc TEXT NOT NULL,
        connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_sync_at TIMESTAMP,
        last_error TEXT
      );
    `)
  )
  .then(() => console.log("Pipelume link table ready"))
  .catch((err) => console.error("Pipelume schema init failed:", err.message));
