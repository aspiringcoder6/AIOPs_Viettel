import { pool } from "./db.js";
import { getLogsAroundEvent } from "./logs.js";
import { queryMetric } from "./prometheus.js";

const WINDOW_MINUTES = Number(process.env.CONTEXT_WINDOW_MINUTES || 5);

export async function getPendingEvents(limit = 5) {
  const result = await pool.query(
    `
    SELECT e.*
    FROM events e
    LEFT JOIN context_bundles cb
      ON cb.event_id = e.id
    WHERE cb.id IS NULL
    ORDER BY e.detected_at ASC
    LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

async function getMetricsSnapshot(serviceName) {
  const metrics = [
    queryMetric("service_up", `up{job="${serviceName}"}`),
    queryMetric("request_rate", "sum(rate(http_requests_total[1m]))"),
    queryMetric("error_rate", "sum(rate(http_errors_total[1m])) / sum(rate(http_requests_total[1m])) * 100"),
    queryMetric("latency_seconds", "rate(http_request_duration_seconds_sum[1m]) / rate(http_request_duration_seconds_count[1m])"),
    queryMetric("cpu_usage", "sum by (container_label_com_docker_compose_service) (rate(container_cpu_usage_seconds_total[1m]))"),
    queryMetric("memory_percent", "(container_memory_usage_bytes / container_spec_memory_limit_bytes) * 100"),
  ];

  return Promise.all(metrics);
}

function summarizeBundle(event, logs, metrics) {
  const errorLogs = logs.filter((log) => log.level === "ERROR").length;
  const warnLogs = logs.filter((log) => log.level === "WARN").length;

  return `${event.event_type} on ${event.service_name}: collected ${logs.length} logs (${errorLogs} errors, ${warnLogs} warnings) and ${metrics.length} metric snapshots.`;
}

export async function buildContextBundle(event) {
  const detectedAt = new Date(event.detected_at);
  const startTime = new Date(detectedAt.getTime() - WINDOW_MINUTES * 60 * 1000);
  const endTime = new Date(detectedAt.getTime() + WINDOW_MINUTES * 60 * 1000);

  const [logs, metrics] = await Promise.all([
    getLogsAroundEvent(event, startTime, endTime),
    getMetricsSnapshot(event.service_name),
  ]);

  const affectedServices = [
    ...new Set([
      event.service_name,
      ...logs.map((log) => log.service).filter(Boolean),
    ]),
  ];

  const summary = summarizeBundle(event, logs, metrics);

  const result = await pool.query(
    `
    INSERT INTO context_bundles(
      event_id,
      start_time,
      end_time,
      affected_services,
      logs,
      metrics,
      summary
    )
    VALUES($1,$2,$3,$4,$5,$6,$7)
    RETURNING *
    `,
    [
      event.id,
      startTime,
      endTime,
      JSON.stringify(affectedServices),
      JSON.stringify(logs),
      JSON.stringify(metrics),
      summary,
    ]
  );

  return result.rows[0];
}
