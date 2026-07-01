import test from "node:test";
import assert from "node:assert/strict";

import {
  findMatchingIncident,
  rootCauseSignature,
  shouldSplitByRootCause,
} from "../src/incidentGrouping.js";

test("ERROR_SPIKE splits open incidents by root cause by default", () => {
  assert.equal(shouldSplitByRootCause("ERROR_SPIKE"), true);
  assert.equal(shouldSplitByRootCause("error_spike"), true);
});

test("metric driven events keep normal open incident grouping", () => {
  assert.equal(shouldSplitByRootCause("CPU_SPIKE"), false);
  assert.equal(shouldSplitByRootCause("MEMORY_SPIKE"), false);
});

test("rootCauseSignature normalizes punctuation and casing", () => {
  assert.equal(
    rootCauseSignature("Postgres pool exhaustion during checkout."),
    "postgres pool exhaustion during checkout"
  );
});

test("ERROR_SPIKE matches only same root cause candidates", () => {
  const candidates = [
    {
      id: 1,
      root_cause: "Redis cache churn caused database fallback reads.",
    },
    {
      id: 2,
      root_cause: "Postgres connection pool exhaustion during checkout.",
    },
  ];
  const analysis = {
    event_type: "ERROR_SPIKE",
    root_cause: "postgres connection pool exhaustion during checkout",
  };

  const match = findMatchingIncident(analysis, candidates);

  assert.equal(match.id, 2);
});

test("ERROR_SPIKE opens a new incident for a different root cause", () => {
  const analysis = {
    event_type: "ERROR_SPIKE",
    root_cause: "Payment provider rejected requests with HTTP 429.",
  };

  const match = findMatchingIncident(analysis, [
    {
      id: 1,
      root_cause: "Postgres connection pool exhaustion during checkout.",
    },
  ]);

  assert.equal(match, null);
});

test("non ERROR_SPIKE events keep the newest open incident candidate", () => {
  const match = findMatchingIncident(
    {
      event_type: "CPU_SPIKE",
      root_cause: "Different wording should not matter.",
    },
    [
      {
        id: 3,
        root_cause: "Existing CPU incident.",
      },
    ]
  );

  assert.equal(match.id, 3);
});
