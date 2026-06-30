import { Pool } from "pg";

export const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5433,
  user: process.env.DB_USER || "admin",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_NAME || "aiops",
});
// Just to ensure that the table exits in the schema, will remove when the application is finished
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
      provider VARCHAR(50),
      model VARCHAR(100),
      raw_response TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS incident_timeline (
      id SERIAL PRIMARY KEY,
      incident_id INTEGER REFERENCES active_incidents(id),
      event_id INTEGER REFERENCES events(id),
      analysis_id INTEGER REFERENCES ai_analyses(id),
      alert_id INTEGER REFERENCES alerts(id),
      timeline_type VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE ai_analyses
    ADD COLUMN IF NOT EXISTS provider VARCHAR(50),
    ADD COLUMN IF NOT EXISTS model VARCHAR(100)
  `);
}
