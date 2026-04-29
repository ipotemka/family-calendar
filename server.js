"use strict";

const express   = require("express");
const path      = require("path");
const { Pool }  = require("pg");

const app  = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────────────────────
// PostgreSQL connection
// DATABASE_URL is provided automatically by Railway
// ssl.rejectUnauthorized = false is required by Railway
// ─────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ─────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(__dirname));

// ═════════════════════════════════════════════════════════════
// EVENTS
// ═════════════════════════════════════════════════════════════

// GET /api/events
app.get("/api/events", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        title,
        start_date::TEXT AS start,
        end_date::TEXT   AS "end",
        color_id         AS "colorId"
      FROM events
      ORDER BY start_date
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/events:", err.message);
    res.status(500).json({ error: "Could not load events" });
  }
});

// POST /api/events
app.post("/api/events", async (req, res) => {
  const incoming = req.body;

  if (!Array.isArray(incoming)) {
    return res.status(400).json({ error: "Expected a JSON array" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query("DELETE FROM events");

    for (const ev of incoming) {
      await client.query(
        `INSERT INTO events (id, title, start_date, end_date, color_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [ev.id, ev.title, ev.start, ev.end, ev.colorId ?? "blue"]
      );
    }

    await client.query("COMMIT");

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");

    console.error("POST /api/events:", err.message);

    res.status(500).json({ error: "Could not save events" });
  } finally {
    client.release();
  }
});

// ═════════════════════════════════════════════════════════════
// TASKS
// ═════════════════════════════════════════════════════════════

// GET /api/tasks
app.get("/api/tasks", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        title,
        description,
        due_date::TEXT AS due_date,
        completed,
        created_at,
        updated_at
      FROM tasks
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/tasks:", err.message);
    res.status(500).json({ error: "Could not load tasks" });
  }
});

// POST /api/tasks
app.post("/api/tasks", async (req, res) => {
  const { title, description, due_date } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: "title is required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tasks (title, description, due_date)
       VALUES ($1, $2, $3)
       RETURNING id, title, description,
                 due_date::TEXT AS due_date,
                 completed, created_at, updated_at`,
      [title.trim(), description ?? null, due_date ?? null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /api/tasks:", err.message);
    res.status(500).json({ error: "Could not create task" });
  }
});

// PUT /api/tasks/:id
app.put("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, due_date } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: "title is required" });
  }

  try {
    const result = await pool.query(
      `UPDATE tasks
       SET title=$1, description=$2, due_date=$3
       WHERE id=$4
       RETURNING id, title, description,
                 due_date::TEXT AS due_date,
                 completed, created_at, updated_at`,
      [title.trim(), description ?? null, due_date ?? null, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /api/tasks/:id:", err.message);
    res.status(500).json({ error: "Could not update task" });
  }
});

// PATCH /api/tasks/:id/complete
app.patch("/api/tasks/:id/complete", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE tasks
       SET completed = NOT completed
       WHERE id=$1
       RETURNING id, title, description,
                 due_date::TEXT AS due_date,
                 completed, created_at, updated_at`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("PATCH /api/tasks/:id/complete:", err.message);
    res.status(500).json({ error: "Could not toggle task" });
  }
});

// DELETE /api/tasks/:id
app.delete("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query("DELETE FROM tasks WHERE id=$1", [id]);

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/tasks/:id:", err.message);
    res.status(500).json({ error: "Could not delete task" });
  }
});

// Root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
