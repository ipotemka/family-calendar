const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

let events = [];

app.use(express.json());
app.use(express.static(__dirname));

app.get("/api/events", (req, res) => {
  res.json(events);
});

app.post("/api/events", (req, res) => {
  events = req.body;
  res.json({ success: true });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});