const DEFAULT_BYPASS_COOLDOWN_EVENT_TYPES = "ERROR_SPIKE";

export function parseEventTypeList(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((eventType) => eventType.trim().toUpperCase())
      .filter(Boolean)
  );
}
//For now, let's not supress ERROR_SPIKE type events
export function shouldBypassCooldown(
  eventType,
  configuredTypes =
    process.env.BYPASS_COOLDOWN_EVENT_TYPES ||
    DEFAULT_BYPASS_COOLDOWN_EVENT_TYPES
) {
  return parseEventTypeList(configuredTypes).has(String(eventType).toUpperCase());
}
