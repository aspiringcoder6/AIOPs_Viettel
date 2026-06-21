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
