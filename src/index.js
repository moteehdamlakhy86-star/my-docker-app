import express from "express";
import pkg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pkg;

const {
  PORT = 3000,
  POSTGRES_USER,
  POSTGRES_PASSWORD,
  POSTGRES_DB,
  POSTGRES_HOST = "localhost",
  POSTGRES_PORT = 5432
} = process.env;

const pool = new Pool({
  user: POSTGRES_USER,
  password: POSTGRES_PASSWORD,
  database: POSTGRES_DB,
  host: POSTGRES_HOST,
  port: Number(POSTGRES_PORT)
});

const app = express();
app.use(express.json());

// ✅ فحص الصحة
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "api", time: new Date().toISOString() });
});

// ✅ فحص قاعدة البيانات
app.get("/db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as now");
    res.json({ ok: true, db_time: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ✅ إنشاء مهمة جديدة
app.post("/todos", async (req, res) => {
  try {
    const { title } = req.body;
    const result = await pool.query(
      "INSERT INTO todos (title) VALUES ($1) RETURNING *",
      [title]
    );
    res.json({ ok: true, todo: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ✅ جلب المهام
app.get("/todos", async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM todos ORDER BY id ASC");
    res.json({ ok: true, todos: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ✅ تعديل مهمة
app.patch("/todos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, done } = req.body;
    const fields = [];
    const values = [];
    let index = 1;

    if (title !== undefined) {
      fields.push(`title = $${index++}`);
      values.push(title);
    }
    if (done !== undefined) {
      fields.push(`done = $${index++}`);
      values.push(done);
    }

    values.push(id);
    const query = `UPDATE todos SET ${fields.join(", ")} WHERE id = $${index} RETURNING *`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0)
      return res.status(404).json({ ok: false, error: "Todo not found" });

    res.json({ ok: true, todo: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ✅ حذف مهمة
app.delete("/todos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM todos WHERE id = $1", [id]);
    res.json({ ok: true, deleted: result.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ✅ إعداد مجلد public
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "../public")));

// ✅ توجيه الصفحة الرئيسية "/"
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ✅ تشغيل الخادم
app.listen(PORT, () => {
  console.log(`API listening on http://0.0.0.0:${PORT}`);
});
