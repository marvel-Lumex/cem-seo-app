const db = require("../db");

const ready = db.ready && typeof db.ready.then === "function" ? db.ready : Promise.resolve();

ready
  .then(async () => {
    await db.query(
      "CREATE TABLE IF NOT EXISTS page_events (" +
        "id SERIAL PRIMARY KEY, " +
        "event TEXT NOT NULL, " +
        "source TEXT NOT NULL DEFAULT 'direct', " +
        "device TEXT NOT NULL DEFAULT 'other', " +
        "visitor TEXT, " +
        "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"
    );
    await db.query("CREATE INDEX IF NOT EXISTS idx_page_events_created ON page_events (created_at)");
  })
  .catch((err) => console.error("trackSchema error:", err.message));
