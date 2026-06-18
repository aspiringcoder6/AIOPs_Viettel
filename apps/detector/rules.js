const { query } = require("./prometheus");
const { createEvent } = require("./detector");
async function detectCpuSpike() {

  const result = await query(`
  sum by (container_label_com_docker_compose_service)
  (
    rate(container_cpu_usage_seconds_total[1m])
  )
  `);

  for (const item of result) {

    const cpu = parseFloat(
      item.value[1]
    );

    const service =
      item.metric
      .container_label_com_docker_compose_service;

    if (!service) continue;

    if (cpu > 0.8) {

      await createEvent(
        "CPU_SPIKE",
        service,
        "P2",
        `CPU usage ${cpu}`
      );
    }
  }
}
async function detectServiceDown() {

  const result = await query(`
  up
  `);

  for (const item of result) {

    const value =
      parseInt(item.value[1]);

    if (value === 0) {

      await createEvent(
        "SERVICE_DOWN",
        item.metric.job,
        "P1",
        "Target unreachable"
      );
    }
  }
}
async function detectLatencySpike() {

  const result = await query(`
  rate(http_request_duration_seconds_sum[1m])
  /
  rate(http_request_duration_seconds_count[1m])
  `);

  for (const item of result) {

    const latency =
      parseFloat(item.value[1]);

    if (latency > 1) {

      await createEvent(
        "LATENCY_SPIKE",
        "node-api",
        "P2",
        `Latency ${latency}s`
      );
    }
  }
}
module.exports = {
  detectCpuSpike,
  detectServiceDown,
  detectLatencySpike
};