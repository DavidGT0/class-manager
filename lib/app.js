const path = require('path');
const express = require('express');
const { query, initDB } = require('./db');

const app = express();
app.use(express.json());

// Static client (used when running locally; on Vercel /public is served by the CDN)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Make sure the DB is connected (and the table exists) before any API call
app.use('/api', async (_req, res, next) => {
  try {
    await initDB();
    next();
  } catch (err) {
    console.error('DB connection failed:', err.message);
    res.status(503).json({ error: 'אין חיבור לבסיס הנתונים' });
  }
});

app.get('/api/health', async (_req, res) => {
  await query('SELECT 1');
  res.json({ status: 'ok', db: 'connected' });
});

// Columns returned to the client (snake_case in SQL -> camelCase in JSON)
const COLUMNS = 'id, name, major, created_at AS "createdAt", updated_at AS "updatedAt"';

const FIELDS = [
  ['name', 'שם הסטודנט'],
  ['major', 'מקצוע'],
];

// Validate the request body. partial=true (PUT) allows sending only some of the fields.
function validate(body, partial) {
  const data = {};
  const errors = [];
  for (const [field, label] of FIELDS) {
    const value = body?.[field];
    if (value === undefined || value === null) {
      if (!partial) errors.push(`${label} הוא שדה חובה`);
    } else if (typeof value !== 'string' || !value.trim()) {
      errors.push(`${label} הוא שדה חובה`);
    } else if (value.trim().length > 100) {
      errors.push(`${label} ארוך מדי`);
    } else {
      data[field] = value.trim();
    }
  }
  if (partial && !errors.length && !Object.keys(data).length) errors.push('אין שדות לעדכון');
  return { data, errors };
}

// Validate :id params once for all routes (positive 32-bit integer = SERIAL)
app.param('id', (req, res, next, id) => {
  if (!/^\d+$/.test(id) || Number(id) < 1 || Number(id) > 2147483647) {
    return res.status(400).json({ error: 'מזהה לא תקין' });
  }
  req.studentId = Number(id);
  next();
});

// READ all (optional filter: ?major=...)
app.get('/api/students', async (req, res) => {
  const { major } = req.query;
  const { rows } = major
    ? await query(`SELECT ${COLUMNS} FROM students WHERE major = $1 ORDER BY id DESC`, [String(major)])
    : await query(`SELECT ${COLUMNS} FROM students ORDER BY id DESC`);
  res.json(rows);
});

// READ one
app.get('/api/students/:id', async (req, res) => {
  const { rows } = await query(`SELECT ${COLUMNS} FROM students WHERE id = $1`, [req.studentId]);
  if (!rows.length) return res.status(404).json({ error: 'הסטודנט לא נמצא' });
  res.json(rows[0]);
});

// CREATE
app.post('/api/students', async (req, res) => {
  const { data, errors } = validate(req.body, false);
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });

  const { rows } = await query(
    `INSERT INTO students (name, major) VALUES ($1, $2) RETURNING ${COLUMNS}`,
    [data.name, data.major]
  );
  res.status(201).json(rows[0]);
});

// UPDATE (fields that were not sent keep their current value)
app.put('/api/students/:id', async (req, res) => {
  const { data, errors } = validate(req.body, true);
  if (errors.length) return res.status(400).json({ error: errors.join(', ') });

  const { rows } = await query(
    `UPDATE students
        SET name = COALESCE($1, name),
            major = COALESCE($2, major),
            updated_at = now()
      WHERE id = $3
      RETURNING ${COLUMNS}`,
    [data.name ?? null, data.major ?? null, req.studentId]
  );
  if (!rows.length) return res.status(404).json({ error: 'הסטודנט לא נמצא' });
  res.json(rows[0]);
});

// DELETE
app.delete('/api/students/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM students WHERE id = $1', [req.studentId]);
  if (!rowCount) return res.status(404).json({ error: 'הסטודנט לא נמצא' });
  res.status(204).end();
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'נתיב לא קיים' }));

// Central error handler (Express 5 forwards rejected async handlers here)
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON לא תקין' });
  }
  console.error(err);
  res.status(500).json({ error: 'שגיאת שרת' });
});

module.exports = app;
