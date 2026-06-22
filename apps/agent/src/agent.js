import { pool } from "./db.js";
import { analyzeBundle } from "./gemini.js";

export async function getPendingBundles(limit = 3) {
  const result = await pool.query(
    `
    SELECT
      cb.*,
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
      raw_response
    )
    VALUES($1,$2,$3,$4,$5,$6,$7)
    RETURNING *
    `,
    [
      bundle.id,
      bundle.event_id,
      analysis.severity,
      analysis.root_cause,
      analysis.confidence,
      JSON.stringify(analysis.recommendations),
      analysis.raw_response,
    ]
  );

  return result.rows[0];
}

export async function analyzePendingBundle(bundle) {
  const analysis = await analyzeBundle(bundle);

  return saveAnalysis(bundle, analysis);
}
