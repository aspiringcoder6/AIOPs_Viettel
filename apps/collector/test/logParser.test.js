import test from "node:test";
import assert from "node:assert/strict";

import {
  cleanDockerChunk,
  parseLog,
  sanitizeText,
} from "../logParser.js";

test("parseLog extracts scenario metadata from simulator logs", () => {
  const parsed = parseLog(
    "node-api",
    "[SCENARIO:db-timeout] request_id=req-1 source_service=postgres level=ERROR event_type=DATABASE_TIMEOUT connection pool exhausted active=20",
    "2026-07-01T10:00:00.000Z"
  );

  assert.equal(parsed["@timestamp"], "2026-07-01T10:00:00.000Z");
  assert.equal(parsed.service, "node-api");
  assert.equal(parsed.source_service, "postgres");
  assert.equal(parsed.scenario_name, "db-timeout");
  assert.equal(parsed.request_id, "req-1");
  assert.equal(parsed.event_type, "DATABASE_TIMEOUT");
  assert.equal(parsed.level, "ERROR");
});

test("parseLog detects warning and error levels from structured messages", () => {
  assert.equal(
    parseLog("node-api", "level=WARN dependency=redis cache miss storm").level,
    "WARN"
  );
  assert.equal(
    parseLog("node-api", "level=ERROR payment provider failed").level,
    "ERROR"
  );
});

test("sanitizeText removes control characters", () => {
  assert.equal(sanitizeText("hello\u0000\u0002 world"), "hello world");
});

test("cleanDockerChunk strips multiplex headers when present", () => {
  const header = Buffer.alloc(8);
  const payload = Buffer.from("line one\n");
  const cleaned = cleanDockerChunk(Buffer.concat([header, payload]));

  assert.equal(cleaned, "line one");
});
