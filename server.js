const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: {
    rejectUnauthorized: false,
  },
});

app.use(express.json());
app.use(express.static(__dirname));

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS calendar_state (
      id INTEGER PRIMARY KEY,
      events JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    INSERT INTO calendar_state (id, events)
    VALUES (1, '[]'::jsonb)
    ON CONFLICT (id) DO NOTHING;
  `);
}

app.get("/api/events", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT events FROM calendar_state WHERE id = 1"
    );

    res.json(result.rows[0]?.events || []);
  } catch (error) {
    console.error("GET /api/events error:", error);
    res.status(500).json({ error: "Failed to load events" });
  }
});

app.post("/api/events", async (req, res) => {
  try {
    const events = req.body;

    if (!Array.isArray(events)) {
      return res.status(400).json({ error: "Invalid events format" });
    }

    await pool.query(
      `
      UPDATE calendar_state
      SET events = $1::jsonb,
          updated_at = NOW()
      WHERE id = 1
      `,
      [JSON.stringify(events)]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("POST /api/events error:", error);
    res.status(500).json({ error: "Failed to save events" });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database init failed:", err);
    process.exit(1);
  });
