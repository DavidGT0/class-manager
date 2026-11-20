// The students table. Created automatically on first connection (CREATE TABLE IF NOT EXISTS).
module.exports = `
CREATE TABLE IF NOT EXISTS students (
  id         SERIAL       PRIMARY KEY,
  name       VARCHAR(100) NOT NULL CHECK (length(trim(name))  > 0),
  major      VARCHAR(100) NOT NULL CHECK (length(trim(major)) > 0),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
`;
