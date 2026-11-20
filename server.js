// Local entry point: `npm run dev` / `npm start`
const app = require('./lib/app');
const { initDB } = require('./lib/db');

const PORT = process.env.PORT || 3000;

initDB()
  .then(() => console.log('Connected to PostgreSQL'))
  .catch((err) => console.error('PostgreSQL connection failed:', err.message));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
