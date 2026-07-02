import { pool } from "./db.js";
import { findMatchingIncident } from "./incidentGrouping.js";

export async function getPendingAnalyses(limit = 5) {
  const result = await pool.query(
    `
    SELECT
      aa.*,
      COALESCE(aa.event_type, e.event_type) AS event_type,
      COALESCE(aa.service_name, e.service_name) AS service_name,
      e.description AS event_description,
      e.metric_value,
      e.detected_at
    FROM ai_analyses aa
    JOIN events e
      ON e.id = aa.event_id
    LEFT JOIN alerts a
      ON a.analysis_id = aa.id
    WHERE a.id IS NULL
    ORDER BY aa.created_at ASC
    LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

async function findOpenIncident(analysis) {
  const result = await pool.query(
    `
    SELECT *
    FROM active_incidents
    WHERE event_type = $1
      AND service_name = $2
      AND status = 'OPEN'
    ORDER BY opened_at DESC
    `,
    [
      analysis.event_type,
      analysis.service_name,
    ]
  );

  return findMatchingIncident(analysis, result.rows);
}

async function createIncident(analysis) {
  const result = await pool.query(
    `
    INSERT INTO active_incidents(
      event_type,
      service_name,
      severity,
      latest_event_id,
      latest_analysis_id,
      root_cause,
      recommendations
    )
    VALUES($1,$2,$3,$4,$5,$6,$7)
    RETURNING *
    `,
    [
      analysis.event_type,
      analysis.service_name,
      analysis.severity,
      analysis.event_id,
      analysis.id,
      analysis.root_cause,
      JSON.stringify(analysis.recommendations),
    ]
  );

  return result.rows[0];
}

async function updateIncident(incident, analysis) {
  const result = await pool.query(
    `
    UPDATE active_incidents
    SET
      severity = $1,
      latest_event_id = $2,
      latest_analysis_id = $3,
      root_cause = $4,
      recommendations = $5,
      updated_at = NOW()
    WHERE id = $6
    RETURNING *
    `,
    [
      analysis.severity,
      analysis.event_id,
      analysis.id,
      analysis.root_cause,
      JSON.stringify(analysis.recommendations),
      incident.id,
    ]
  );

  return result.rows[0];
}

function firstRecommendation(recommendations) {
  if (Array.isArray(recommendations) && recommendations.length > 0) {
    return recommendations[0];
  }

  return "Review the context bundle and related service logs.";
}

function buildAlertMessage(analysis, incident) {
  return [
    `[ALERT] ${analysis.severity} ${analysis.event_type} on ${analysis.service_name}`,
    `Incident: ${incident.id}`,
    `Metric: ${analysis.metric_value ?? "n/a"}`,
    `Root cause: ${analysis.root_cause}`,
    `Recommendation: ${firstRecommendation(analysis.recommendations)}`,
  ].join("\n");
}

async function createAlert(analysis, incident, message) {
  const result = await pool.query(
    `
    INSERT INTO alerts(
      analysis_id,
      incident_id,
      severity,
      message
    )
    VALUES($1,$2,$3,$4)
    RETURNING *
    `,
    [
      analysis.id,
      incident.id,
      analysis.severity,
      message,
    ]
  );

  return result.rows[0];
}

async function recordTimeline({
  incidentId,
  eventId,
  analysisId,
  alertId = null,
  type,
  message,
  metadata = {},
}) {
  await pool.query(
    `
    INSERT INTO incident_timeline(
      incident_id,
      event_id,
      analysis_id,
      alert_id,
      timeline_type,
      message,
      metadata
    )
    VALUES($1,$2,$3,$4,$5,$6,$7)
    `,
    [
      incidentId,
      eventId,
      analysisId,
      alertId,
      type,
      message,
      JSON.stringify(metadata),
    ]
  );
}

async function attachExistingTimelineToIncident(incident, analysis) {
  await pool.query(
    `
    UPDATE incident_timeline
    SET incident_id = $1
    WHERE incident_id IS NULL
      AND (
        event_id = $2
        OR analysis_id = $3
      )
    `,
    [
      incident.id,
      analysis.event_id,
      analysis.id,
    ]
  );
}

export async function processAnalysis(analysis) {
  const existingIncident = await findOpenIncident(analysis);
  const incident = existingIncident
    ? await updateIncident(existingIncident, analysis)
    : await createIncident(analysis);

  await attachExistingTimelineToIncident(incident, analysis);

  await recordTimeline({
    incidentId: incident.id,
    eventId: analysis.event_id,
    analysisId: analysis.id,
    type: existingIncident ? "INCIDENT_UPDATED" : "INCIDENT_OPENED",
    message: existingIncident
      ? `Updated incident ${incident.id} from analysis ${analysis.id}`
      : `Opened incident ${incident.id}`,
    metadata: {
      severity: incident.severity,
      event_type: incident.event_type,
      service_name: incident.service_name,
    },
  });

  const message = buildAlertMessage(analysis, incident);
  const alert = await createAlert(analysis, incident, message);

  await recordTimeline({
    incidentId: incident.id,
    eventId: analysis.event_id,
    analysisId: analysis.id,
    alertId: alert.id,
    type: "ALERT_SENT",
    message: `Sent console alert ${alert.id}`,
    metadata: {
      severity: alert.severity,
      channel: alert.channel,
      status: alert.status,
    },
  });

  console.log(message);

  return {
    alert,
    incident,
  };
}
