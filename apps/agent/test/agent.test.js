// A test file for agent 
import test from "node:test";
import assert from "node:assert/strict";

import { extractJson, normalizeAnalysis } from "../src/gemini.js";

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
