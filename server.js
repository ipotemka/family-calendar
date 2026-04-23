const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// Подключение к Railway Postgres через переменные окружения
const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: { rejectUnauthorized: false },
});

app.use(express.json());
app.use(express.static(__dirname));

// Инициализация таблицы
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS calendar_state (
      id INTEGER PRIMARY KEY,
      events JSONB NOT NULL DEFAULT '[]'::jsonb,
      next_id INTEGER NOT NULL DEFAULT 10,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    INSERT INTO calendar_state (id, events, next_id)
    VALUES (1, '[]'::jsonb, 10)
    ON CONFLICT (id) DO NOTHING;
  `);
}

// Получить события
app.get("/api/events", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT events, next_id FROM calendar_state WHERE id = 1"
    );

    res.json({
      events: result.rows[0]?.events || [],
      nextId: result.rows[0]?.next_id || 10,
    });
  } catch (error) {
    console.error("GET /api/events error:", error);
    res.status(500).json({ error: "Failed to load events" });
  }
});

// Сохранить события
app.post("/api/events", async (req, res) => {
  try {
    const { events, nextId } = req.body;

    if (!Array.isArray(events)) {
      return res.status(400).json({ error: "Invalid events format" });
    }

    await pool.query(
      `
      UPDATE calendar_state
      SET events = $1::jsonb,
          next_id = $2,
          updated_at = NOW()
      WHERE id = 1
      `,
      [JSON.stringify(events), nextId || 10]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("POST /api/events error:", error);
    res.status(500).json({ error: "Failed to save events" });
  }
});

// Главная страница
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Запуск сервера
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} 🚀`);
    });
  })
  .catch((err) => {
    console.error("Database init failed:", err);
    process.exit(1);
  });
