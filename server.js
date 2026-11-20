// Entry point.
// - Locally (`npm run dev` / `npm start`): starts an HTTP server.
// - On Vercel with the "Express" preset: Vercel imports this file and uses the exported app.
const app = require('./lib/app');
const { initDB } = require('./lib/db');

if (require.main === module) {
  const PORT = process.env.PORT || 3000;

  initDB()
    .then(() => console.log('Connected to PostgreSQL'))
    .catch((err) => console.error('PostgreSQL connection failed:', err.message));

  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
