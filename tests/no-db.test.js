// Runs in its own process (node --test isolates files), with no DATABASE_URL set.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

delete process.env.DATABASE_URL;

test('server.js can be imported without a DB and without listening (Vercel Express preset)', () => {
  const app = require('../server');
  assert.equal(typeof app, 'function');
});

test('API returns 503 (not a crash) when DATABASE_URL is missing', async () => {
  const app = require('../lib/app');
  const res = await request(app).get('/api/students');
  assert.equal(res.status, 503);
  assert.equal(res.body.error, 'אין חיבור לבסיס הנתונים');

  const health = await request(app).get('/api/health');
  assert.equal(health.status, 503);
});

test('client page is still served when DB is missing', async () => {
  const app = require('../lib/app');
  const res = await request(app).get('/');
  assert.equal(res.status, 200);
});
