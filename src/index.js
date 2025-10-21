import express from "express";
import pkg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pkg;
const PORT = process.env.PORT || 3000;

// اتصال PostgreSQL عبر DATABASE_URL (Render) + SSL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const app = express();
app.use(express.json());

// تأكد من وجود جدول todos عند الإقلاع
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      done BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
})();

// صحة الخدمة
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "api", time: new Date().toISOString() });
});

// فحص قاعدة البيانات
app.get("/db", async (_req, res) => {
  try {
    const r = await pool.query("SELECT NOW() AS now");
    res.json({ ok: true, db_time: r.rows[0].now });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// CRUD للمهام
app.get("/todos", async (_req, res) => {
  const r = await pool.query("SELECT * FROM todos ORDER BY id DESC");
  res.json({ todos: r.rows });
});

app.post("/todos", async (req, res) => {
  const { title } = req.body;
  const r = await pool.query(
    "INSERT INTO todos (title) VALUES ($1) RETURNING *",
    [title]
  );
  res.json({ ok: true, todo: r.rows[0] });
});

app.patch("/todos/:id", async (req, res) => {
  const { id } = req.params;
  const updates = [];
  const vals = [];
  let i = 1;

  if (typeof req.body.title === "string") {
    updates.push(`title=$${i++}`); vals.push(req.body.title);
  }
  if (typeof req.body.done === "boolean") {
    updates.push(`done=$${i++}`); vals.push(req.body.done);
  }
  if (!updates.length) return res.json({ ok: true });

  vals.push(id);
  const sql = `UPDATE todos SET ${updates.join(", ")} WHERE id=$${i} RETURNING *`;
  const r = await pool.query(sql, vals);
  res.json({ ok: true, todo: r.rows[0] });
});

app.delete("/todos/:id", async (req, res) => {
  await pool.query("DELETE FROM todos WHERE id=$1", [req.params.id]);
  res.json({ ok: true, deleted: 1 });
});

// تقديم واجهة المستخدم (public)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "../public")));

app.listen(PORT, () => {
  console.log(`API listening on http://0.0.0.0:${PORT}`);
});
