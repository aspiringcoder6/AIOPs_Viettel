import crypto from "node:crypto";

//The delay time between each log
const DEFAULT_STEP_DELAY_MS = Number(process.env.SCENARIO_STEP_DELAY_MS || 150);

// The store for all predefined incident, stored as an object
export const incidentScenarios = {
  // The incident for database timeout, here it simulates ranning out of database connections
  "db-timeout": {
    name: "db-timeout",
    title: "Checkout database timeout",
    type: "DATABASE_TIMEOUT",
    httpStatus: 500,
    affectedServices: ["node-api", "postgres", "nginx"],
    expectedRootCause:
      "Postgres connection pool exhaustion during checkout order creation.",
    signals: [
      "postgres pool waiting clients rising",
      "slow CreateOrder query",
      "node-api returns 500 after acquire timeout",
    ],
    steps: [
      {
        level: "INFO",
        service: "node-api",
        message:
          "checkout request started route=/api/orders operation=create_order",
      },
      {
        level: "WARN",
        service: "node-api",
        message:
          "dependency=postgres query=CreateOrder duration_ms=2840 threshold_ms=500",
      },
      {
        level: "ERROR",
        service: "postgres",
        message:
          "connection pool exhausted active=20 idle=0 waiting=18 max=20",
      },
      {
        level: "ERROR",
        service: "node-api",
        message:
          "SequelizeConnectionAcquireTimeoutError timeout acquiring postgres client after 5000ms",
      },
      {
        level: "WARN",
        service: "nginx",
        message:
          "upstream=node-api status=500 request_time=5.24s upstream_response_time=5.20s",
      },
    ],
  },
  //An incident for redis, where the memory cache is full, making it start evicting data
  "cache-storm": {
    name: "cache-storm",
    title: "Redis cache miss storm",
    type: "CACHE_MISS_STORM",
    httpStatus: 503,
    affectedServices: ["node-api", "redis", "postgres"],
    expectedRootCause:
      "Redis cache churn caused cache misses, forcing node-api to overload Postgres.",
    signals: [
      "redis evicted keys increasing",
      "cache hit ratio dropping",
      "fallback database reads increasing",
    ],
    steps: [
      {
        level: "INFO",
        service: "node-api",
        message:
          "product catalog request started route=/api/products source=cache",
      },
      {
        level: "WARN",
        service: "redis",
        message:
          "cache hit ratio dropped hit_ratio=0.31 keyspace_misses=1840 keyspace_hits=826",
      },
      {
        level: "WARN",
        service: "redis",
        message:
          "maxmemory pressure evicted_keys=932 policy=allkeys-lru used_memory_pct=97",
      },
      {
        level: "WARN",
        service: "node-api",
        message:
          "cache miss storm dependency=redis fallback=postgres batch_reads=420",
      },
      {
        level: "ERROR",
        service: "node-api",
        message:
          "request failed status=503 reason=cache_backend_degraded dependency=redis",
      },
    ],
  },
  //Simulate a third party payment app failing
  "payment-provider": {
    name: "payment-provider",
    title: "Payment provider failure",
    type: "THIRD_PARTY_FAILURE",
    httpStatus: 502,
    affectedServices: ["node-api", "nginx"],
    expectedRootCause:
      "Payment provider rejected requests and node-api exhausted retries.",
    signals: [
      "provider returns 401 or 429",
      "retry budget exhausted",
      "checkout endpoint returns 502",
    ],
    steps: [
      {
        level: "INFO",
        service: "node-api",
        message:
          "payment authorization started route=/api/payments provider=vnpay",
      },
      {
        level: "WARN",
        service: "node-api",
        message:
          "dependency=payment-provider status=429 retry_after_ms=2000 attempt=1",
      },
      {
        level: "WARN",
        service: "node-api",
        message:
          "dependency=payment-provider status=429 retry_after_ms=2000 attempt=2",
      },
      {
        level: "ERROR",
        service: "node-api",
        message:
          "payment provider retry budget exhausted provider=vnpay attempts=3 status=429",
      },
      {
        level: "ERROR",
        service: "nginx",
        message:
          "checkout upstream returned 502 route=/api/payments upstream=node-api",
      },
    ],
  },
  // An incident for elastic search for memory and CPU pressure
  "elasticsearch-pressure": {
    name: "elasticsearch-pressure",
    title: "Elasticsearch search pressure",
    type: "SEARCH_CLUSTER_PRESSURE",
    httpStatus: 503,
    affectedServices: ["node-api", "elasticsearch"],
    expectedRootCause:
      "Expensive search queries pushed Elasticsearch into memory and CPU pressure.",
    signals: [
      "search latency over threshold",
      "Elasticsearch circuit breaker warning",
      "node-api search endpoint degraded",
    ],
    steps: [
      {
        level: "INFO",
        service: "node-api",
        message:
          "search request started route=/api/search query_type=wildcard sort=score",
      },
      {
        level: "WARN",
        service: "elasticsearch",
        message:
          "slow query index=logs-* took_ms=4210 threshold_ms=1000 shards=12",
      },
      {
        level: "ERROR",
        service: "elasticsearch",
        message:
          "parent circuit breaker tripped memory_used_pct=96 estimated_size_mb=472",
      },
      {
        level: "WARN",
        service: "node-api",
        message:
          "dependency=elasticsearch search latency_ms=5060 timeout_ms=5000",
      },
      {
        level: "ERROR",
        service: "node-api",
        message:
          "search request failed status=503 reason=elasticsearch_pressure",
      },
    ],
  },
};

export function listScenarios() {
  return Object.values(incidentScenarios).map((scenario) => ({
    name: scenario.name,
    title: scenario.title,
    type: scenario.type,
    httpStatus: scenario.httpStatus,
    affectedServices: scenario.affectedServices,
    signals: scenario.signals,
  }));
}

export function getScenario(name) {
  return incidentScenarios[name] || null;
}

export function formatScenarioLog(scenario, step, requestId) {
  return [
    `[SCENARIO:${scenario.name}]`,
    `request_id=${requestId}`,
    `source_service=${step.service}`,
    `level=${step.level}`,
    `event_type=${scenario.type}`,
    step.message,
  ].join(" ");
}

export async function runScenario(name, options = {}) {
  const scenario = getScenario(name);

  if (!scenario) return null;

  const logger = options.logger || console;
  const requestId = options.requestId || crypto.randomUUID();
  const stepDelayMs =
    options.stepDelayMs === undefined ? DEFAULT_STEP_DELAY_MS : options.stepDelayMs;

  for (const step of scenario.steps) {
    const line = formatScenarioLog(scenario, step, requestId);
    const method =
      step.level === "ERROR" ? "error" : step.level === "WARN" ? "warn" : "log";

    logger[method](line);

    if (stepDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, stepDelayMs));
    }
  }

  return {
    scenario,
    requestId,
  };
}
