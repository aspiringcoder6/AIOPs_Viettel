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
    CREATE TABLE IF NOT EXISTS ai_analyses (
      id SERIAL PRIMARY KEY,
      context_bundle_id INTEGER NOT NULL UNIQUE REFERENCES context_bundles(id),
      event_id INTEGER NOT NULL REFERENCES events(id),
      severity VARCHAR(10) NOT NULL,
      root_cause TEXT NOT NULL,
      confidence DOUBLE PRECISION,
      recommendations JSONB NOT NULL,
      raw_response TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}
