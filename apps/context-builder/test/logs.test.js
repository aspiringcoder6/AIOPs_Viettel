import test from "node:test";
import assert from "node:assert/strict";

import { buildLogQuery } from "../src/logQuery.js";

test("buildLogQuery searches service, source service, and scenario clues", () => {
  const query = buildLogQuery(
    {
      service_name: "node-api",
      event_type: "ERROR_SPIKE",
    },
    new Date("2026-07-01T09:51:05.605Z"),
    new Date("2026-07-01T10:01:05.605Z"),
    ["postgres", "redis", "nginx"]
  );

  assert.deepEqual(query.bool.filter[0].range["@timestamp"], {
    gte: "2026-07-01T09:51:05.605Z",
    lte: "2026-07-01T10:01:05.605Z",
  });

  assert.ok(
    query.bool.should.some((clause) => {
      return clause.terms?.service?.includes("node-api");
    })
  );
  assert.ok(
    query.bool.should.some((clause) => {
      return clause.terms?.source_service?.includes("postgres");
    })
  );
  assert.ok(
    query.bool.should.some((clause) => {
      return clause.match_phrase?.message === "[SCENARIO:";
    })
  );
  assert.ok(
    query.bool.should.some((clause) => {
      return clause.match_phrase?.message === "dependency=redis";
    })
  );
});
