import { pool } from "./db.js";
import { analyzeBundle } from "./providers.js";

//This is to reduce the context bundle to reasonable size
function buildPromptContext(bundle) {
  const parseLax = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
      try { return JSON.parse(val); } catch { return []; }
    }
    return [];
  };

  const logs    = parseLax(bundle.logs);
  const metrics = parseLax(bundle.metrics);

  // Keep only error/warn logs, capped at a safe limit
  const MAX_LOGS = 30;
  const significantLogs = logs
    .filter(log => ["ERROR", "WARN"].includes(log.level))
    .slice(0, MAX_LOGS)
    .map(log => ({
      level: log.level,
      message: log.message,
      timestamp: log["@timestamp"],
      service: log.service,
    }));

  // Flatten metrics to just name + value
  const metricSummary = metrics.map(m => ({
    name: m.name,
    value: m.value,
  }));

  return {
    event: bundle.event,
    summary: bundle.summary,
    time_window: {
      start: bundle.start_time,
      end: bundle.end_time,
    },
    affected_services: bundle.affected_services,
    significant_logs: significantLogs,
    metrics: metricSummary,
  };
}
export async function getPendingBundles(limit = 3) {
  const result = await pool.query(
      `
    SELECT
      cb.id,
      cb.event_id,
      cb.start_time,
      cb.end_time,
      cb.affected_services,
      cb.summary,
      cb.created_at,
      (
        SELECT COALESCE(json_agg(log_entry), '[]'::json)
        FROM (
          SELECT value AS log_entry
          FROM jsonb_array_elements(cb.logs::jsonb)
          WHERE (value->>'level') IN ('ERROR', 'WARN')
          LIMIT 30
        ) filtered_logs
      ) AS logs,
      (
        SELECT COALESCE(json_agg(
          json_build_object('name', m->>'name', 'value', m->>'value')
        ), '[]'::json)
        FROM jsonb_array_elements(cb.metrics::jsonb) m
      ) AS metrics,
      json_build_object(
        'id', e.id,
        'event_type', e.event_type,
        'service_name', e.service_name,
        'severity', e.severity,
        'description', e.description,
        'metric_value', e.metric_value,
        'detected_at', e.detected_at
      ) AS event
    FROM context_bundles cb
    JOIN events e
      ON e.id = cb.event_id
    LEFT JOIN ai_analyses aa
      ON aa.context_bundle_id = cb.id
    WHERE aa.id IS NULL
    ORDER BY cb.created_at ASC
    LIMIT $1
    `,
    [limit]
  );
  return result.rows;
}

export async function saveAnalysis(bundle, analysis) {
  const result = await pool.query(
    `
    INSERT INTO ai_analyses(
      context_bundle_id,
      event_id,
      severity,
      root_cause,
      confidence,
      recommendations,
      provider,
      model,
      raw_response
    )
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *
    `,
    [
      bundle.id,
      bundle.event_id,
      analysis.severity,
      analysis.root_cause,
      analysis.confidence,
      JSON.stringify(analysis.recommendations),
      analysis.provider,
      analysis.model,
      analysis.raw_response,
    ]
  );

  return result.rows[0];
}

export async function analyzePendingBundle(bundle) {
  const promptContext = buildPromptContext(bundle);
  const analysis = await analyzeBundle(promptContext); // For  slim context
  return saveAnalysis(bundle, analysis);
}
