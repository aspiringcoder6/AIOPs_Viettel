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
    ALTER TABLE active_incidents
    ADD COLUMN IF NOT EXISTS latest_event_id INTEGER REFERENCES events(id),
    ADD COLUMN IF NOT EXISTS latest_analysis_id INTEGER REFERENCES ai_analyses(id),
    ADD COLUMN IF NOT EXISTS root_cause TEXT,
    ADD COLUMN IF NOT EXISTS recommendations JSONB,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      analysis_id INTEGER NOT NULL UNIQUE REFERENCES ai_analyses(id),
      incident_id INTEGER NOT NULL REFERENCES active_incidents(id),
      severity VARCHAR(10) NOT NULL,
      channel VARCHAR(50) NOT NULL DEFAULT 'console',
      message TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'SENT',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}
