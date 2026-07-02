const GEMINI_API_URL =
  process.env.GEMINI_API_URL ||
  "https://generativelanguage.googleapis.com/v1beta";

const GEMINI_MODEL =
  process.env.GEMINI_MODEL ||
  "gemini-2.0-flash";

export function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function getApiKey() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required");
  }

  return process.env.GEMINI_API_KEY;
}

function compactJson(value, maxLength = 12000) {
  if (value === undefined || value === null) return "[]";
  
  const json = JSON.stringify(value, null, 2);

  if (json.length <= maxLength) {
    return json;
  }

  return `${json.slice(0, maxLength)}\n...truncated`;
}

export function buildPrompt(bundle) {
  const logs =
    bundle.log_groups ||
    bundle.significant_logs ||
    bundle.logs ||
    [];

  return `
You are an AI Operations incident analysis agent.

Analyze this detected event and context bundle. Return only valid JSON with this exact shape:
{
  "incidents": [
    {
      "severity": "P1|P2|P3",
      "event_type": "short incident type, preferably from the evidence logs",
      "service_name": "primary affected service",
      "root_cause": "short explanation",
      "confidence": 0.0,
      "recommendations": ["step 1", "step 2"],
      "evidence": ["short log clue 1", "short log clue 2"]
    }
  ]
}

Rules:
- Use P1 for outage, severe error spike, or customer-impacting failure.
- Use P2 for degraded performance, high resource usage, or partial impact.
- Use P3 for weak signal, warning, or informational anomaly.
- If logs contain multiple distinct scenarios, request_ids, event_types, or root causes, return multiple incidents.
- If several logs describe the same request_id/scenario/root cause, merge them into one incident.
- Prefer concrete log evidence over generic metric names.
- Keep evidence short and cite clues such as request_id, scenario_name, source_service, or error text.
- Keep recommendations concrete and operational.

Event:
${compactJson(bundle.event)}

Context summary:
${bundle.summary}

Affected services:
${compactJson(bundle.affected_services, 2000)}

Metrics:
${compactJson(bundle.metrics)}

Logs:
${compactJson(logs)}
`.trim();
}

export function extractJson(text) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Gemini response did not contain JSON");
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

export function normalizeAnalysis(parsed) {
  const severity = String(parsed.severity || "P3").toUpperCase();
  const allowedSeverities = new Set(["P1", "P2", "P3"]);
  const recommendations = Array.isArray(parsed.recommendations)
    ? parsed.recommendations.map(String).filter(Boolean)
    : [];

  return {
    severity: allowedSeverities.has(severity) ? severity : "P3",
    root_cause: String(parsed.root_cause || "Root cause unknown"),
    confidence: Number(parsed.confidence || 0),
    recommendations:
      recommendations.length > 0
        ? recommendations
        : ["Review related service logs and metrics for the event window."],
    event_type: parsed.event_type ? String(parsed.event_type) : undefined,
    service_name: parsed.service_name ? String(parsed.service_name) : undefined,
    evidence: Array.isArray(parsed.evidence)
      ? parsed.evidence.map(String).filter(Boolean)
      : [],
  };
}

export function normalizeAnalyses(parsed) {
  const incidentList = Array.isArray(parsed.incidents)
    ? parsed.incidents
    : [parsed];

  const analyses = incidentList
    .map(normalizeAnalysis)
    .filter((analysis) => analysis.root_cause !== "Root cause unknown");

  return analyses.length > 0
    ? analyses
    : [normalizeAnalysis({})];
}

export async function analyzeWithGemini(bundle) {
  const response = await fetch(
    `${GEMINI_API_URL}/models/${GEMINI_MODEL}:generateContent?key=${getApiKey()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: buildPrompt(bundle),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini request failed ${response.status}: ${body}`);
  }

  const data = await response.json();
  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("") || "";

  const parsed = extractJson(text);

  return normalizeAnalyses(parsed).map((analysis) => ({
    ...analysis,
    provider: "gemini",
    model: GEMINI_MODEL,
    raw_response: text,
  }));
}
