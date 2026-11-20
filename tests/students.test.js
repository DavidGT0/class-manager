const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { startMemoryPostgres } = require('../scripts/memory-postgres');

let pg;
let app;
let db;

before(async () => {
  pg = await startMemoryPostgres();
  process.env.DATABASE_URL = pg.url;
  process.env.PG_POOL_MAX = '1';
  app = require('../lib/app');
  db = require('../lib/db');
  await db.initDB();
});

after(async () => {
  await db.closeDB();
  await pg.stop();
});

beforeEach(async () => {
  await db.query('TRUNCATE students RESTART IDENTITY');
});

test('health check reports DB connected', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok', db: 'connected' });
});

test('CREATE: POST adds a student and trims fields', async () => {
  const res = await request(app).post('/api/students').send({ name: '  Dana Levi ', major: 'Software' });
  assert.equal(res.status, 201);
  assert.equal(res.body.id, 1);
  assert.equal(res.body.name, 'Dana Levi');
  assert.equal(res.body.major, 'Software');
  assert.ok(res.body.createdAt);
});

test('CREATE: missing / empty / non-string fields -> 400', async () => {
  const missing = await request(app).post('/api/students').send({ name: 'Only name' });
  assert.equal(missing.status, 400);
  assert.match(missing.body.error, /מקצוע/);

  const empty = await request(app).post('/api/students').send({ name: '   ', major: 'X' });
  assert.equal(empty.status, 400);

  const notString = await request(app).post('/api/students').send({ name: 5, major: 'X' });
  assert.equal(notString.status, 400);

  const tooLong = await request(app).post('/api/students').send({ name: 'a'.repeat(101), major: 'X' });
  assert.equal(tooLong.status, 400);
});

test('CREATE: ignores unknown fields', async () => {
  const res = await request(app).post('/api/students').send({ name: 'A', major: 'B', admin: true, id: 99 });
  assert.equal(res.status, 201);
  assert.equal(res.body.admin, undefined);
  assert.equal(res.body.id, 1);
});

test('CREATE: SQL injection attempt is stored as plain text', async () => {
  const evil = "x'); DROP TABLE students; --";
  const res = await request(app).post('/api/students').send({ name: evil, major: 'Hack' });
  assert.equal(res.status, 201);
  const list = await request(app).get('/api/students');
  assert.equal(list.body[0].name, evil);
});

test('READ: GET list (newest first) and GET by id', async () => {
  const a = await request(app).post('/api/students').send({ name: 'A', major: 'Math' });
  await request(app).post('/api/students').send({ name: 'B', major: 'Physics' });

  const list = await request(app).get('/api/students');
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.map((s) => s.name), ['B', 'A']);

  const filtered = await request(app).get('/api/students?major=Math');
  assert.equal(filtered.body.length, 1);

  const one = await request(app).get(`/api/students/${a.body.id}`);
  assert.equal(one.status, 200);
  assert.equal(one.body.name, 'A');
});

test('READ: unknown id -> 404, invalid id -> 400', async () => {
  assert.equal((await request(app).get('/api/students/999')).status, 404);
  assert.equal((await request(app).get('/api/students/abc')).status, 400);
  assert.equal((await request(app).get('/api/students/0')).status, 400);
  assert.equal((await request(app).get('/api/students/99999999999')).status, 400);
});

test('UPDATE: PUT changes fields, partial update keeps others', async () => {
  const { body: s } = await request(app).post('/api/students').send({ name: 'A', major: 'Math' });

  const full = await request(app).put(`/api/students/${s.id}`).send({ name: 'A2', major: 'CS' });
  assert.equal(full.status, 200);
  assert.equal(full.body.name, 'A2');
  assert.equal(full.body.major, 'CS');

  const partial = await request(app).put(`/api/students/${s.id}`).send({ major: 'Biology' });
  assert.equal(partial.body.name, 'A2');
  assert.equal(partial.body.major, 'Biology');
});

test('UPDATE: empty name / no fields -> 400, unknown id -> 404', async () => {
  const { body: s } = await request(app).post('/api/students').send({ name: 'A', major: 'Math' });
  assert.equal((await request(app).put(`/api/students/${s.id}`).send({ name: '' })).status, 400);
  assert.equal((await request(app).put(`/api/students/${s.id}`).send({})).status, 400);
  assert.equal((await request(app).put('/api/students/999').send({ name: 'Z' })).status, 404);
});

test('DELETE: removes student, second delete -> 404', async () => {
  const { body: s } = await request(app).post('/api/students').send({ name: 'A', major: 'Math' });
  assert.equal((await request(app).delete(`/api/students/${s.id}`)).status, 204);
  assert.equal((await request(app).delete(`/api/students/${s.id}`)).status, 404);
  assert.equal((await request(app).get('/api/students')).body.length, 0);
});

test('bad JSON -> 400, unknown API route -> 404, client page served', async () => {
  const bad = await request(app).post('/api/students').set('Content-Type', 'application/json').send('{oops');
  assert.equal(bad.status, 400);
  assert.equal((await request(app).get('/api/nope')).status, 404);
  const page = await request(app).get('/');
  assert.equal(page.status, 200);
  assert.match(page.text, /ניהול הכיתה/);
});
