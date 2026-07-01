const DEFAULT_ROOT_CAUSE_SPLIT_EVENT_TYPES = "ERROR_SPIKE";

export function parseEventTypeList(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((eventType) => eventType.trim().toUpperCase())
      .filter(Boolean)
  );
}

export function shouldSplitByRootCause(
  eventType,
  configuredTypes =
    process.env.ROOT_CAUSE_SPLIT_EVENT_TYPES ||
    DEFAULT_ROOT_CAUSE_SPLIT_EVENT_TYPES
) {
  return parseEventTypeList(configuredTypes).has(String(eventType).toUpperCase());
}

export function rootCauseSignature(rootCause) {
  return String(rootCause || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

//Since Error spike is special and can happen due to a bunch of different reason 
export function findMatchingIncident(analysis, candidates) {
  if (!shouldSplitByRootCause(analysis.event_type)) {
    return candidates[0] || null;
  }

  const analysisSignature = rootCauseSignature(analysis.root_cause);

  if (!analysisSignature) {
    return null;
  }

  return (
    candidates.find((candidate) => {
      return rootCauseSignature(candidate.root_cause) === analysisSignature;
    }) || null
  );
}
