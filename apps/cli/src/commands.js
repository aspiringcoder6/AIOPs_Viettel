import { pool } from "./db.js";
import {
  formatDate,
  formatList,
  printRows,
} from "./format.js";

export async function listIncidents() {
  const result = await pool.query(`
    SELECT
      id,
      event_type,
      service_name,
      severity,
      status,
      root_cause,
      opened_at,
      updated_at
    FROM active_incidents
    ORDER BY
      CASE severity
        WHEN 'P1' THEN 1
        WHEN 'P2' THEN 2
        ELSE 3
      END,
      opened_at DESC
    LIMIT 20
  `);

  printRows(
    result.rows,
    "No incidents found.",
    (incident) => [
      `#${incident.id} ${incident.severity} ${incident.event_type} on ${incident.service_name}`,
      `Status: ${incident.status}`,
      `Opened: ${formatDate(incident.opened_at)}`,
      `Updated: ${formatDate(incident.updated_at)}`,
      `Root cause: ${incident.root_cause || "n/a"}`,
    ].join("\n")
  );
}

export async function listAlerts() {
  const result = await pool.query(`
    SELECT
      a.id,
      a.incident_id,
      a.severity,
      a.status,
      a.channel,
      a.message,
      a.created_at,
      i.event_type,
      i.service_name
    FROM alerts a
    JOIN active_incidents i
      ON i.id = a.incident_id
    ORDER BY a.created_at DESC
    LIMIT 20
  `);

  printRows(
    result.rows,
    "No alerts found.",
    (alert) => [
      `#${alert.id} ${alert.severity} alert for incident ${alert.incident_id}`,
      `Service: ${alert.service_name}`,
      `Type: ${alert.event_type}`,
      `Channel: ${alert.channel}`,
      `Status: ${alert.status}`,
      `Created: ${formatDate(alert.created_at)}`,
      alert.message,
    ].join("\n")
  );
}

export async function listSuppressedEvents() {
  const result = await pool.query(`
    SELECT
      id,
      event_type,
      service_name,
      severity,
      metric_value,
      duplicate_event_id,
      suppressed_at
    FROM suppressed_events
    ORDER BY suppressed_at DESC
    LIMIT 20
  `);

  printRows(
    result.rows,
    "No suppressed events found.",
    (event) => [
      `#${event.id} ${event.severity} ${event.event_type} on ${event.service_name}`,
      `Metric: ${event.metric_value ?? "n/a"}`,
      `Duplicate of event: ${event.duplicate_event_id}`,
      `Suppressed: ${formatDate(event.suppressed_at)}`,
    ].join("\n")
  );
}

export async function showIncident(id) {
  const result = await pool.query(
    `
    SELECT
      i.*,
      e.description AS event_description,
      e.metric_value,
      e.detected_at,
      aa.confidence,
      aa.provider,
      aa.model,
      aa.created_at AS analyzed_at
    FROM active_incidents i
    LEFT JOIN events e
      ON e.id = i.latest_event_id
    LEFT JOIN ai_analyses aa
      ON aa.id = i.latest_analysis_id
    WHERE i.id = $1
    `,
    [id]
  );

  const incident = result.rows[0];

  if (!incident) {
    console.log(`Incident ${id} not found.`);
    return;
  }

  const alerts = await pool.query(
    `
    SELECT id, severity, channel, status, created_at
    FROM alerts
    WHERE incident_id = $1
    ORDER BY created_at DESC
    `,
    [id]
  );

  console.log([
    `#${incident.id} ${incident.severity} ${incident.event_type} on ${incident.service_name}`,
    `Status: ${incident.status}`,
    `Opened: ${formatDate(incident.opened_at)}`,
    `Updated: ${formatDate(incident.updated_at)}`,
    `Detected: ${formatDate(incident.detected_at)}`,
    `Metric: ${incident.metric_value ?? "n/a"}`,
    `Event: ${incident.event_description || "n/a"}`,
    "",
    `Root cause: ${incident.root_cause || "n/a"}`,
    "",
    "Recommendations:",
    formatList(incident.recommendations),
    "",
    `AI: ${incident.provider || "n/a"} ${incident.model || ""}`.trim(),
    `Confidence: ${incident.confidence ?? "n/a"}`,
    `Analyzed: ${formatDate(incident.analyzed_at)}`,
    "",
    "Alerts:",
    alerts.rows.length === 0
      ? "none"
      : alerts.rows
        .map((alert) => `#${alert.id} ${alert.severity} ${alert.status} via ${alert.channel} at ${formatDate(alert.created_at)}`)
        .join("\n"),
  ].join("\n"));
}

export async function updateIncidentLifecycle(id, status) {
  const resolvedAt =
    status === "RESOLVED"
      ? "NOW()"
      : "NULL";

  const result = await pool.query(
    `
    UPDATE active_incidents
    SET
      status = $1,
      resolved_at = ${resolvedAt},
      updated_at = NOW()
    WHERE id = $2
    RETURNING id, event_type, service_name, severity, status
    `,
    [
      status,
      id,
    ]
  );

  const incident = result.rows[0];

  if (!incident) {
    console.log(`Incident ${id} not found.`);
    return;
  }

  console.log(
    `#${incident.id} ${incident.severity} ${incident.event_type} on ${incident.service_name} is now ${incident.status}`
  );
}

export function printHelp() {
  console.log(`
Usage:
  aiops incidents
  aiops alerts
  aiops incident <id>
  aiops resolve <id>
  aiops reopen <id>
  aiops suppressed

Environment:
  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
`.trim());
}
