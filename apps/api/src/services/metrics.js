import client from "prom-client"

export const register = new client.Registry();

client.collectDefaultMetrics({
  register,
});

export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"],
});
export const errorCounter = new client.Counter({
  name: "http_errors_total",
  help: "Total HTTP errors",
  labelNames: ["method", "route", "status"]
});
export const requestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Request duration",
  labelNames: ["method", "route"],
});
register.registerMetric(requestDuration);
register.registerMetric(httpRequestsTotal);
register.registerMetric(errorCounter);

