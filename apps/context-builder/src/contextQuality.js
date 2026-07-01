const MAX_CONTEXT_LOGS = Number(process.env.CONTEXT_MAX_LOGS || 80);

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
  if (eventType && message.includes(eventType.replace("_", " ").toLowerCase())) {
    score += 10;
  }

  return score;
}

export function serviceNamesFromDependencies(dependencies) {
  return dependencies.map((dependency) => dependency.related_service);
}

export function rankLogs(logs, event, relatedServices) {
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

export function enrichMetrics(metrics, event, relatedServices) {
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
