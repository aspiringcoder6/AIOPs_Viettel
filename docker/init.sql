CREATE TABLE users(
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);
INSERT INTO users(name)
VALUES ('TestUser');
CREATE TABLE events (
    id SERIAL PRIMARY KEY,

    event_type VARCHAR(50) NOT NULL,

    service_name VARCHAR(100) NOT NULL,

    severity VARCHAR(10) NOT NULL,

    description TEXT,

    metric_value DOUBLE PRECISION,

    detected_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE suppressed_events (
    id SERIAL PRIMARY KEY,

    event_type VARCHAR(50) NOT NULL,

    service_name VARCHAR(100) NOT NULL,

    severity VARCHAR(10) NOT NULL,

    description TEXT,

    metric_value DOUBLE PRECISION,

    duplicate_event_id INTEGER REFERENCES events(id),

    suppressed_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE active_incidents (
    id SERIAL PRIMARY KEY,

    event_type VARCHAR(50) NOT NULL,

    service_name VARCHAR(100) NOT NULL,

    severity VARCHAR(10) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',

    opened_at TIMESTAMP DEFAULT NOW(),

    resolved_at TIMESTAMP
);

CREATE TABLE context_bundles (
    id SERIAL PRIMARY KEY,

    event_id INTEGER NOT NULL REFERENCES events(id),

    start_time TIMESTAMP NOT NULL,

    end_time TIMESTAMP NOT NULL,

    affected_services JSONB NOT NULL,

    logs JSONB NOT NULL,

    metrics JSONB NOT NULL,

    summary TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE service_dependencies (
    id SERIAL PRIMARY KEY,

    service_name VARCHAR(100) NOT NULL,

    related_service VARCHAR(100) NOT NULL,

    relation_type VARCHAR(50) NOT NULL DEFAULT 'depends_on',

    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(service_name, related_service, relation_type)
);

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
ON CONFLICT DO NOTHING;

CREATE TABLE ai_analyses (
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
);

ALTER TABLE active_incidents
ADD COLUMN IF NOT EXISTS latest_event_id INTEGER REFERENCES events(id),
ADD COLUMN IF NOT EXISTS latest_analysis_id INTEGER REFERENCES ai_analyses(id),
ADD COLUMN IF NOT EXISTS root_cause TEXT,
ADD COLUMN IF NOT EXISTS recommendations JSONB,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,

    analysis_id INTEGER NOT NULL UNIQUE REFERENCES ai_analyses(id),

    incident_id INTEGER NOT NULL REFERENCES active_incidents(id),

    severity VARCHAR(10) NOT NULL,

    channel VARCHAR(50) NOT NULL DEFAULT 'console',

    message TEXT NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'SENT',

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE incident_timeline (
    id SERIAL PRIMARY KEY,

    incident_id INTEGER REFERENCES active_incidents(id),

    event_id INTEGER REFERENCES events(id),

    analysis_id INTEGER REFERENCES ai_analyses(id),

    alert_id INTEGER REFERENCES alerts(id),

    timeline_type VARCHAR(50) NOT NULL,

    message TEXT NOT NULL,

    metadata JSONB,

    created_at TIMESTAMP DEFAULT NOW()
);
