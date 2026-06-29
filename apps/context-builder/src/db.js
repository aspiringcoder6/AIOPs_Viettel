import { Pool } from "pg";

export const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5433,
  user: process.env.DB_USER || "admin",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_NAME || "aiops",
});

export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS context_bundles (
      id SERIAL PRIMARY KEY,
      event_id INTEGER NOT NULL REFERENCES events(id),
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP NOT NULL,
      affected_services JSONB NOT NULL,
      logs JSONB NOT NULL,
      metrics JSONB NOT NULL,
      summary TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}
