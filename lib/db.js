const { Pool } = require('pg');
const SCHEMA = require('./schema');

// On Vercel a "warm" serverless instance keeps this module in memory,
// so the pool is reused between requests instead of reconnecting every time.
let pool = null;
let schemaReady = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL environment variable is not set');

    pool = new Pool({
      connectionString,
      max: Number(process.env.PG_POOL_MAX) || 5,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000,
    });
    pool.on('error', (err) => console.error('Postgres pool error:', err.message));
  }
  return pool;
}

// async: a missing DATABASE_URL becomes a rejected promise instead of a synchronous crash
async function query(text, params) {
  return getPool().query(text, params);
}

// Make sure the connection works and the table exists (runs once per instance).
async function initDB() {
  if (!schemaReady) {
    schemaReady = query(SCHEMA).catch((err) => {
      // Two cold instances may race on CREATE TABLE IF NOT EXISTS - the table exists, so that's fine.
      if (err.code === '23505' || err.code === '42P07') return;
      schemaReady = null; // allow retry on next request
      throw err;
    });
  }
  return schemaReady;
}

async function closeDB() {
  if (pool) await pool.end();
  pool = null;
  schemaReady = null;
}

module.exports = { query, initDB, closeDB };
