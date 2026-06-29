import { pool } from "./db.js";

export async function getPendingAnalyses(limit = 5) {
  const result = await pool.query(
    `
    SELECT
      aa.*,
      e.event_type,
      e.service_name,
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
    LIMIT 1
    `,
    [
      analysis.event_type,
      analysis.service_name,
    ]
  );

  return result.rows[0] || null;
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

export async function processAnalysis(analysis) {
  const existingIncident = await findOpenIncident(analysis);
  const incident = existingIncident
    ? await updateIncident(existingIncident, analysis)
    : await createIncident(analysis);

  const message = buildAlertMessage(analysis, incident);
  const alert = await createAlert(analysis, incident, message);

  console.log(message);

  return {
    alert,
    incident,
  };
}
