import { pool } from "./db.js";
import { getLogsAroundEvent } from "./logs.js";
import { queryMetric } from "./prometheus.js";

const WINDOW_MINUTES = Number(process.env.CONTEXT_WINDOW_MINUTES || 5);
const MAX_CONTEXT_LOGS = Number(process.env.CONTEXT_MAX_LOGS || 80);

function sanitizeText(value) {
  return String(value ?? "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();
}

function sanitizeValue(value) {
  if (typeof value === "string") {
    return sanitizeText(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        sanitizeText(key),
        sanitizeValue(entry),
      ])
    );
  }

  return value;
}

function toSafeJson(value) {
  return JSON.stringify(sanitizeValue(value))
    .replace(/\\u0000/gi, "")
    .replace(/\\u000[1-8bcef]/gi, "")
    .replace(/\\u001[0-9a-f]/gi, "")
    .replace(/\\u007f/gi, "");
}

export async function getPendingEvents(limit = 5) {
  // Select events that have no context bundle (meaning it's pending)
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

async function getRelatedServices(serviceName) {
  const result = await pool.query(
    `
    SELECT related_service, relation_type
    FROM service_dependencies
    WHERE service_name = $1
    ORDER BY relation_type, related_service
    `,
    [serviceName]
  );

  return result.rows;
}

function serviceNamesFromDependencies(dependencies) {
  return dependencies.map((dependency) => dependency.related_service);
}

function getLogScore(log, event, relatedServices) {
  let score = 0;
  const message = String(log.message || "").toLowerCase();
  const eventType = String(event.event_type || "").toLowerCase();

  if (log.service === event.service_name) score += 50;
  if (relatedServices.includes(log.service)) score += 25;
  if (log.level === "ERROR") score += 40;
  if (log.level === "WARN") score += 20;
  if (message.includes("error")) score += 10;
  if (message.includes("failed")) score += 10;
  if (message.includes("exception")) score += 10;
  if (eventType && message.includes(eventType.replace("_", " ").toLowerCase())) score += 10;

  return score;
}

function rankLogs(logs, event, relatedServices) {
  return logs
    .map((log) => ({
      ...log,
      relevance_score: getLogScore(log, event, relatedServices),
    }))
    .sort((a, b) => {
      if (b.relevance_score !== a.relevance_score) {
        return b.relevance_score - a.relevance_score;
      }

      return new Date(a["@timestamp"]) - new Date(b["@timestamp"]);
    })
    .slice(0, MAX_CONTEXT_LOGS)
    .sort((a, b) => new Date(a["@timestamp"]) - new Date(b["@timestamp"]));
}

function metricService(metric) {
  return (
    metric.metric?.container_label_com_docker_compose_service ||
    metric.metric?.job ||
    metric.metric?.container ||
    "global"
  );
}

function compactMetric(metric) {
  return {
    service: metricService(metric),
    value: Number(metric.value?.[1]),
    labels: metric.metric || {},
  };
}

function enrichMetrics(metrics, event, relatedServices) {
  const relevantServices = new Set([
    event.service_name,
    ...relatedServices,
    "global",
  ]);

  return metrics.map((metric) => {
    const values = (metric.results || [])
      .map(compactMetric)
      .filter((value) => {
        return (
          relevantServices.has(value.service) ||
          Object.keys(value.labels).length === 0
        );
      });

    return {
      name: metric.name,
      query: metric.query,
      values,
    };
  });
}

//Get metrics at the moment calling this function
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

function summarizeBundle(event, logs, metrics, dependencies) {
  const errorLogs = logs.filter(l => l.level === "ERROR");
  const warnLogs  = logs.filter(l => l.level === "WARN");
  const relatedServices = dependencies
    .map((dependency) => `${dependency.related_service} (${dependency.relation_type})`)
    .join(", ");
  const metricHighlights = metrics
    .map((metric) => {
      const topValue = metric.values
        .filter((value) => Number.isFinite(value.value))
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];

      if (!topValue) return null;

      return `${metric.name}=${topValue.value} on ${topValue.service}`;
    })
    .filter(Boolean)
    .slice(0, 5)
    .join("; ");

  const topErrors = errorLogs
    .slice(0, 5)
    .map(l => l.message)
    .join("; ");

  return (
    `${event.event_type} on ${event.service_name}: ` +
    `${logs.length} logs (${errorLogs.length} errors, ${warnLogs.length} warnings), ` +
    `${metrics.length} metric groups. ` +
    (relatedServices ? `Related services: ${relatedServices}. ` : "No related services mapped. ") +
    (metricHighlights ? `Metric highlights: ${metricHighlights}. ` : "") +
    (topErrors ? `Top errors: ${topErrors}` : "No errors logged.")
  );
}
export async function buildContextBundle(event) {
  const detectedAt = new Date(event.detected_at);
  const startTime = new Date(detectedAt.getTime() - WINDOW_MINUTES * 60 * 1000);
  const endTime = new Date(detectedAt.getTime() + WINDOW_MINUTES * 60 * 1000);

  const dependencies = await getRelatedServices(event.service_name);
  const relatedServices = serviceNamesFromDependencies(dependencies);

  const [rawLogs, rawMetrics] = await Promise.all([
    getLogsAroundEvent(event, startTime, endTime, relatedServices),
    getMetricsSnapshot(event.service_name),
  ]);

  const logs = sanitizeValue(
    rankLogs(rawLogs, event, relatedServices)
  );
  const metrics = sanitizeValue(
    enrichMetrics(rawMetrics, event, relatedServices)
  );

  const affectedServices = [
    ...new Set([
      event.service_name,
      ...relatedServices,
      ...logs.map((log) => log.service).filter(Boolean),
    ]),
  ];

  const summary = summarizeBundle(event, logs, metrics, dependencies);

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
      toSafeJson(affectedServices),
      toSafeJson(logs),
      toSafeJson(metrics),
      summary,
    ]
  );

  return result.rows[0];
}
