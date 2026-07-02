import { pool } from "./db.js";
import { analyzeBundle } from "./providers.js";
import { buildPromptContext } from "./promptContext.js";
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
        SELECT COALESCE(json_agg(m), '[]'::json)
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
  //The type of event and the service it belongs too
  const eventType = analysis.event_type || bundle.event?.event_type;
  const serviceName = analysis.service_name || bundle.event?.service_name;

  const result = await pool.query(
    `
    INSERT INTO ai_analyses(
      context_bundle_id,
      event_id,
      severity,
      root_cause,
      confidence,
      recommendations,
      event_type,
      service_name,
      provider,
      model,
      raw_response
    )
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *
    `,
    [
      bundle.id,
      bundle.event_id,
      analysis.severity,
      analysis.root_cause,
      analysis.confidence,
      JSON.stringify(analysis.recommendations),
      eventType,
      serviceName,
      analysis.provider,
      analysis.model,
      analysis.raw_response,
    ]
  );

  const saved = result.rows[0];
  //Add to incident timeline to know the life cycle of the incident
  await pool.query(
    `
    INSERT INTO incident_timeline(
      event_id,
      analysis_id,
      timeline_type,
      message,
      metadata
    )
    VALUES($1,$2,$3,$4,$5)
    `,
    [
      bundle.event_id,
      saved.id,
      "AI_ANALYZED",
      `AI analysis ${saved.id} completed with severity ${saved.severity}`,
      JSON.stringify({
        provider: saved.provider,
        model: saved.model,
        confidence: saved.confidence,
        event_type: eventType,
        service_name: serviceName,
        evidence: analysis.evidence || [],
      }),
    ]
  );

  return saved;
}

export async function analyzePendingBundle(bundle) {
  //Can accept one analysis or multiple analysis
  const promptContext = buildPromptContext(bundle);
  const analyses = await analyzeBundle(promptContext);
  const analysisList = Array.isArray(analyses) ? analyses : [analyses];
  const savedAnalyses = [];

  for (const analysis of analysisList) {
    savedAnalyses.push(await saveAnalysis(bundle, analysis));
  }

  return savedAnalyses;
}
