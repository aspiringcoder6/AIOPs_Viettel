// A test file for agent 
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPrompt,
  extractJson,
  normalizeAnalyses,
  normalizeAnalysis,
} from "../src/gemini.js";
import {
  buildPromptContext,
  compactLogsForPrompt,
} from "../src/promptContext.js";

test("extractJson reads fenced model responses", () => {
  const parsed = extractJson(`
\`\`\`json
{
  "severity": "P2",
  "root_cause": "Redis cache churn increased database fallback reads.",
  "confidence": 0.82,
  "recommendations": ["Check Redis memory pressure"]
}
\`\`\`
  `);
  //Check to see if parsed severity correctly
  assert.equal(parsed.severity, "P2");
  //Check to see if parsed root cause correctly
  assert.match(parsed.root_cause, /Redis cache/);
});

test("extractJson reads JSON surrounded by conversational text", () => {
  const parsed = extractJson(`
Result here, hahaha:
{
  "severity": "P1",
  "root_cause": "Postgres pool exhaustion",
  "confidence": 0.9,
  "recommendations": ["Increase pool size"]
}
  `);
  
  assert.equal(parsed.root_cause, "Postgres pool exhaustion");
});

test("normalizeAnalysis clamps weak model output to safe defaults", () => {
  //Check normalized version of the results to see if match
  const normalized = normalizeAnalysis({
    severity: "critical",
    root_cause: "",
    confidence: "0.42",
    recommendations: [],
  });

  assert.equal(normalized.severity, "P3");
  assert.equal(normalized.root_cause, "Root cause unknown");
  assert.equal(normalized.confidence, 0.42);
  assert.deepEqual(normalized.recommendations, [
    "Review related service logs and metrics for the event window.",
  ]);
});

test("normalizeAnalyses accepts a list of incidents", () => {
  const normalized = normalizeAnalyses({
    incidents: [
      {
        severity: "P1",
        event_type: "DATABASE_TIMEOUT",
        service_name: "postgres",
        root_cause: "Postgres connection pool exhaustion",
        confidence: 0.9,
        recommendations: ["Increase pool size"],
        evidence: ["request_id=req-db"],
      },
      {
        severity: "P2",
        event_type: "SEARCH_CLUSTER_PRESSURE",
        service_name: "elasticsearch",
        root_cause: "Elasticsearch circuit breaker pressure",
        confidence: 0.8,
        recommendations: ["Inspect slow queries"],
      },
    ],
  });

  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].event_type, "DATABASE_TIMEOUT");
  assert.equal(normalized[1].service_name, "elasticsearch");
});

test("compactLogsForPrompt groups duplicate scenario logs", () => {
  const groups = compactLogsForPrompt([
    {
      level: "WARN",
      scenario_name: "db-timeout",
      request_id: "req-db",
      event_type: "DATABASE_TIMEOUT",
      service: "node-api",
      source_service: "postgres",
      message: "dependency=postgres query slow",
      "@timestamp": "2026-07-01T10:38:13.069Z",
      relevance_score: 70,
    },
    {
      level: "ERROR",
      scenario_name: "db-timeout",
      request_id: "req-db",
      event_type: "DATABASE_TIMEOUT",
      service: "node-api",
      source_service: "node-api",
      message: "SequelizeConnectionAcquireTimeoutError",
      "@timestamp": "2026-07-01T10:38:13.371Z",
      relevance_score: 100,
    },
    {
      level: "ERROR",
      scenario_name: "elasticsearch-pressure",
      request_id: "req-es",
      event_type: "SEARCH_CLUSTER_PRESSURE",
      service: "node-api",
      source_service: "elasticsearch",
      message: "parent circuit breaker tripped",
      "@timestamp": "2026-07-01T10:38:11.021Z",
      relevance_score: 110,
    },
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].scenario_name, "elasticsearch-pressure");
  assert.equal(groups[1].log_count, 2);
  assert.deepEqual(groups[1].source_services, ["postgres", "node-api"]);
});

test("buildPromptContext sends compact log groups to the prompt", () => {
  const context = buildPromptContext({
    event: { event_type: "ERROR_SPIKE", service_name: "node-api" },
    logs: [
      {
        level: "ERROR",
        scenario_name: "db-timeout",
        request_id: "req-db",
        event_type: "DATABASE_TIMEOUT",
        service: "node-api",
        source_service: "postgres",
        message: "postgres pool exhausted",
        "@timestamp": "2026-07-01T10:38:13.371Z",
        relevance_score: 100,
      },
    ],
    metrics: [],
  });
  const prompt = buildPrompt(context);

  assert.equal(context.log_groups.length, 1);
  assert.match(prompt, /"incidents"/);
  assert.match(prompt, /postgres pool exhausted/);
});
