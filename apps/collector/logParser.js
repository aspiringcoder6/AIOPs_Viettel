export function sanitizeText(value) {
  return String(value)
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

export function cleanDockerChunk(chunk) {
  if (!chunk || chunk.length === 0) {
    return "";
  }

  const payload = chunk.length > 8 ? chunk.slice(8) : chunk;

  return sanitizeText(payload.toString("utf8"));
}

function detectLevel(message) {
  const lower = message.toLowerCase();
  //Different case of logs, depending on how the services output log, may need to change a bit
  if (
    lower.includes("level=error") ||
    lower.includes(" error ") ||
    lower.includes("error:") ||
    lower.includes("exception") ||
    lower.includes("failed")
  ) {
    return "ERROR";
  }

  if (
    lower.includes("level=warn") ||
    lower.includes(" warn ") ||
    lower.includes("warning") ||
    lower.includes("warn:")
  ) {
    return "WARN";
  }

  return "INFO";
}

function extractToken(message, key) {
  const match = message.match(new RegExp(`${key}=([^\\s]+)`));
  return match ? match[1] : undefined;
}

function extractScenarioName(message) {
  const match = message.match(/\[SCENARIO:([^\]]+)\]/);
  return match ? match[1] : undefined;
}

export function parseLog(service, rawMessage, timestamp = new Date().toISOString()) {
  const message = sanitizeText(rawMessage);
  const scenarioName = extractScenarioName(message);
  const requestId = extractToken(message, "request_id");
  const sourceService = extractToken(message, "source_service");
  const eventType = extractToken(message, "event_type");

  return {
    "@timestamp": timestamp,
    service,
    source_service: sourceService || service,
    scenario_name: scenarioName,
    request_id: requestId,
    event_type: eventType,
    level: detectLevel(message),
    message,
  };
}
