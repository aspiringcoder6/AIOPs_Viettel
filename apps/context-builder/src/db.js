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
    CREATE TABLE IF NOT EXISTS service_dependencies (
      id SERIAL PRIMARY KEY,
      service_name VARCHAR(100) NOT NULL,
      related_service VARCHAR(100) NOT NULL,
      relation_type VARCHAR(50) NOT NULL DEFAULT 'depends_on',
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(service_name, related_service, relation_type)
    )
  `);

  await pool.query(`
    INSERT INTO service_dependencies(service_name, related_service, relation_type)
    VALUES
      ('node-api', 'postgres', 'depends_on'),
      ('node-api', 'redis', 'depends_on'),
      ('node-api', 'nginx', 'proxied_by'),
      ('nginx', 'node-api', 'routes_to'),
      ('collector', 'elasticsearch', 'writes_to'),
      ('context-builder', 'elasticsearch', 'reads_from'),
      ('context-builder', 'postgres', 'writes_to'),
      ('detector', 'prometheus', 'reads_from'),
      ('detector', 'postgres', 'writes_to'),
      ('agent', 'postgres', 'reads_from'),
      ('alert-manager', 'postgres', 'reads_from')
    ON CONFLICT DO NOTHING
  `);
}
