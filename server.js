const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: {
    rejectUnauthorized: false,
  },
});


// создать таблицу если её ещё нет
pool.query(`
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  color TEXT
)
`);


// проверить соединение
app.get("/", async (req, res) => {
  const result = await pool.query("SELECT NOW()");
  res.send("DB connected: " + result.rows[0].now);
});


// получить все события
app.get("/api/events", async (req, res) => {
  const result = await pool.query("SELECT * FROM events ORDER BY start_date");
  res.json(result.rows);
});


// создать событие
app.post("/api/events", async (req, res) => {
  const { title, start_date, end_date, color } = req.body;

  const result = await pool.query(
    "INSERT INTO events (title, start_date, end_date, color) VALUES ($1,$2,$3,$4) RETURNING *",
    [title, start_date, end_date, color]
  );

  res.json(result.rows[0]);
});


// удалить событие
app.delete("/api/events/:id", async (req, res) => {
  await pool.query("DELETE FROM events WHERE id=$1", [req.params.id]);
  res.sendStatus(204);
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
