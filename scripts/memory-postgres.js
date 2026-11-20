// Starts a real PostgreSQL (PGlite - Postgres compiled to WASM) in memory and exposes it on a TCP port,
// so the app can connect with a normal DATABASE_URL. Used by the tests and by `npm run dev:memory`.
// Dev-only: nothing here is deployed.
const net = require('net');

// Ask the OS for a free TCP port
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function startMemoryPostgres(port) {
  const { PGlite } = await import('@electric-sql/pglite');
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');

  port = port || (await getFreePort());
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' });
  await server.start();

  return {
    url: `postgres://postgres:postgres@127.0.0.1:${port}/postgres`,
    async stop() {
      await server.stop();
      await db.close();
    },
  };
}

module.exports = { startMemoryPostgres };

// `node scripts/memory-postgres.js` -> run the app on top of an in-memory DB
if (require.main === module) {
  startMemoryPostgres(5433).then(({ url }) => {
    process.env.DATABASE_URL = url;
    process.env.PG_POOL_MAX = '1'; // PGlite handles a single connection
    console.log('In-memory PostgreSQL running (data is lost when you stop the server)');
    require('../server');
  });
}
