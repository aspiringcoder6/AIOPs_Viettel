import test from "node:test";
import assert from "node:assert/strict";

import {
  enrichMetrics,
  rankLogs,
  serviceNamesFromDependencies,
} from "../src/contextQuality.js";

test("rankLogs prioritizes event service errors and related service warnings", () => {
  const event = {
    service_name: "node-api",
    event_type: "DATABASE_TIMEOUT",
  };
  const logs = [
    {
      "@timestamp": "2026-06-28T03:28:03.000Z",
      service: "dashboard",
      level: "INFO",
      message: "user opened incident page",
    },
    {
      "@timestamp": "2026-06-28T03:28:01.000Z",
      service: "postgres",
      level: "WARN",
      message: "connection pool waiting clients increased",
    },
    {
      "@timestamp": "2026-06-28T03:28:02.000Z",
      service: "node-api",
      level: "ERROR",
      message: "database timeout failed while creating order",
    },
  ];

  const ranked = rankLogs(logs, event, ["postgres"]);
  const nodeApiLog = ranked.find((log) => log.service === "node-api");
  const dashboardLog = ranked.find((log) => log.service === "dashboard");

  assert.equal(ranked.length, 3);
  assert.ok(nodeApiLog.relevance_score > dashboardLog.relevance_score);
  assert.deepEqual(
    ranked.map((log) => log["@timestamp"]),
    [
      "2026-06-28T03:28:01.000Z",
      "2026-06-28T03:28:02.000Z",
      "2026-06-28T03:28:03.000Z",
    ]
  );
});

test("enrichMetrics keeps event, dependency, and global metrics only", () => {
  const event = {
    service_name: "node-api",
  };
  const metrics = [
    {
      name: "memory_percent",
      query: "memory query",
      results: [
        {
          metric: { container_label_com_docker_compose_service: "node-api" },
          value: [1782600000, "81.5"],
        },
        {
          metric: { container_label_com_docker_compose_service: "postgres" },
          value: [1782600000, "73.2"],
        },
        {
          metric: { container_label_com_docker_compose_service: "dashboard" },
          value: [1782600000, "12.1"],
        },
        {
          metric: {},
          value: [1782600000, "3"],
        },
      ],
    },
  ];

  const enriched = enrichMetrics(metrics, event, ["postgres"]);
  const services = enriched[0].values.map((value) => value.service);

  assert.deepEqual(services, ["node-api", "postgres", "global"]);
});

test("serviceNamesFromDependencies returns related service names", () => {
  const names = serviceNamesFromDependencies([
    { related_service: "postgres", relation_type: "database" },
    { related_service: "redis", relation_type: "cache" },
  ]);

  assert.deepEqual(names, ["postgres", "redis"]);
});
