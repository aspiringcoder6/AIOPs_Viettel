import test from "node:test";
import assert from "node:assert/strict";

import {
  formatScenarioLog,
  getScenario,
  listScenarios,
  runScenario,
} from "../src/services/incidentScenarios.js";

test("scenario catalog exposes realistic runnable scenarios", () => {
  const scenarios = listScenarios();

  assert.ok(scenarios.length >= 4);
  assert.ok(scenarios.some((scenario) => scenario.name === "db-timeout"));

  for (const scenario of scenarios) {
    assert.ok(scenario.title);
    assert.ok(scenario.type);
    assert.ok(scenario.httpStatus >= 500);
    assert.ok(scenario.affectedServices.length >= 2);
    assert.ok(scenario.signals.length >= 2);
  }
});

test("scenario logs include correlation and dependency clues", () => {
  const scenario = getScenario("db-timeout");
  const postgresStep = scenario.steps.find((step) => step.service === "postgres");
  const line = formatScenarioLog(scenario, postgresStep, "req-123");

  assert.match(line, /\[SCENARIO:db-timeout\]/);
  assert.match(line, /request_id=req-123/);
  assert.match(line, /source_service=postgres/);
  assert.match(line, /event_type=DATABASE_TIMEOUT/);
  assert.match(line, /connection pool exhausted/);
});

test("runScenario emits all steps through the expected log levels", async () => {
  const emitted = [];
  const logger = {
    log: (line) => emitted.push({ level: "INFO", line }),
    warn: (line) => emitted.push({ level: "WARN", line }),
    error: (line) => emitted.push({ level: "ERROR", line }),
  };

  const result = await runScenario("cache-storm", {
    logger,
    requestId: "req-cache",
    stepDelayMs: 0,
  });

  assert.equal(result.scenario.name, "cache-storm");
  assert.equal(result.requestId, "req-cache");
  assert.equal(emitted.length, result.scenario.steps.length);
  assert.ok(emitted.some((entry) => entry.level === "ERROR"));
  assert.ok(emitted.every((entry) => entry.line.includes("request_id=req-cache")));
});

test("runScenario returns null for unknown scenarios", async () => {
  const result = await runScenario("not-real", { stepDelayMs: 0 });

  assert.equal(result, null);
});
