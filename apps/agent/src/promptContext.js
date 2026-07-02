function parseLax(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}

function groupLogKey(log) {
  return [
    log.scenario_name || "no-scenario",
    log.request_id || "no-request",
    log.event_type || "no-event-type",
  ].join("|");
}

function compactLogMessage(message) {
  return String(message || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

export function compactLogsForPrompt(logs, maxGroups = 8, maxEvidencePerGroup = 4) {
  const groups = new Map();

  for (const log of logs.filter((entry) => ["ERROR", "WARN"].includes(entry.level))) {
    const key = groupLogKey(log);
    const existing = groups.get(key) || {
      scenario_name: log.scenario_name,
      request_id: log.request_id,
      event_type: log.event_type,
      service: log.service,
      source_services: new Set(),
      levels: new Set(),
      first_timestamp: log["@timestamp"],
      last_timestamp: log["@timestamp"],
      log_count: 0,
      max_relevance_score: 0,
      evidence: [],
    };

    existing.log_count += 1;
    existing.max_relevance_score = Math.max(
      existing.max_relevance_score,
      Number(log.relevance_score || 0)
    );
    existing.first_timestamp =
      new Date(log["@timestamp"]) < new Date(existing.first_timestamp)
        ? log["@timestamp"]
        : existing.first_timestamp;
    existing.last_timestamp =
      new Date(log["@timestamp"]) > new Date(existing.last_timestamp)
        ? log["@timestamp"]
        : existing.last_timestamp;

    if (log.source_service) existing.source_services.add(log.source_service);
    if (log.level) existing.levels.add(log.level);

    existing.evidence.push({
      level: log.level,
      source_service: log.source_service || log.service,
      message: compactLogMessage(log.message),
      timestamp: log["@timestamp"],
      relevance_score: Number(log.relevance_score || 0),
    });

    groups.set(key, existing);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      source_services: [...group.source_services],
      levels: [...group.levels],
      evidence: group.evidence
        .sort((a, b) => {
          if (b.relevance_score !== a.relevance_score) {
            return b.relevance_score - a.relevance_score;
          }

          return new Date(a.timestamp) - new Date(b.timestamp);
        })
        .slice(0, maxEvidencePerGroup)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
    }))
    .sort((a, b) => {
      if (b.max_relevance_score !== a.max_relevance_score) {
        return b.max_relevance_score - a.max_relevance_score;
      }

      return new Date(a.first_timestamp) - new Date(b.first_timestamp);
    })
    .slice(0, maxGroups);
}

export function buildPromptContext(bundle) {
  const logs    = parseLax(bundle.logs);
  const metrics = parseLax(bundle.metrics);
  const logGroups = compactLogsForPrompt(logs);

  const metricSummary = metrics.map(m => ({
    name: m.name,
    values: Array.isArray(m.values)
      ? m.values.slice(0, 10)
      : [],
  }));

  return {
    event: bundle.event,
    summary: bundle.summary,
    time_window: {
      start: bundle.start_time,
      end: bundle.end_time,
    },
    affected_services: bundle.affected_services,
    log_groups: logGroups,
    metrics: metricSummary,
  };
}
