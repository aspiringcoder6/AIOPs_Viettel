import {query} from './prometheus.js'
import {createEvent} from './detector.js'
export async function detectCpuSpike() {
  try {
    const result = await query(`
    sum by (container_label_com_docker_compose_service)
    (
      rate(container_cpu_usage_seconds_total[1m])
    )
    `);

    if (!result || result.length === 0) {
      console.log('[DETECTOR] CPU: No data available from Prometheus');
      return;
    }

    let anomalies = 0;
    for (const item of result) {
      const cpu = parseFloat(item.value[1]);
      const service = item.metric.container_label_com_docker_compose_service;

      if (!service) continue;
      
      if (cpu > 0.8) {
        const event = await createEvent(
          "CPU_SPIKE",
          service,
          "P2",
          `Abnormal CPU Usage detected`,
          cpu
        );

        if (event) anomalies++;
      }
    }
    
    if (anomalies > 0) {
      console.log(`[DETECTOR] CPU: Found ${anomalies} spike(s)`);
    }
  } catch (err) {
    console.error('[DETECTOR] CPU detection error:', err.message);
  }
}
export async function detectServiceDown() {
  try {
    const result = await query(`
    up
    `);

    if (!result || result.length === 0) {
      console.log('[DETECTOR] Service Down: No data available from Prometheus');
      return;
    }

    let anomalies = 0;
    for (const item of result) {
      const value = parseInt(item.value[1]);

      if (value === 0) {
        const event = await createEvent(
          "SERVICE_DOWN",
          item.metric.job,
          "P1",
          "Target unreachable",
          value
        );

        if (event) anomalies++;
      }
    }
    
    if (anomalies > 0) {
      console.log(`[DETECTOR] Service Down: Found ${anomalies} down service(s)`);
    }
  } catch (err) {
    console.error('[DETECTOR] Service Down detection error:', err.message);
  }
}
export async function detectLatencySpike() {
  try {
    const result = await query(`
    rate(http_request_duration_seconds_sum[1m])
    /
    rate(http_request_duration_seconds_count[1m])
    `);

    if (!result || result.length === 0) {
      console.log('[DETECTOR] Latency: No data available from Prometheus');
      return;
    }

    let anomalies = 0;
    for (const item of result) {
      const latency = parseFloat(item.value[1]);

      if (latency > 1) {
        const event = await createEvent(
          "LATENCY_SPIKE",
          "node-api",
          "P2",
          `Abnormal latency detected`,
          latency
        );

        if (event) anomalies++;
      }
    }
    
    if (anomalies > 0) {
      console.log(`[DETECTOR] Latency: Found ${anomalies} spike(s)`);
    }
  } catch (err) {
    console.error('[DETECTOR] Latency detection error:', err.message);
  }
}
export async function detectErrorSpike() {
  try {

    const result = await query(`
      sum(rate(http_errors_total[1m]))
      /
      sum(rate(http_requests_total[1m])) * 100
    `);

    if (!result || result.length === 0) {
      console.log('[DETECTOR] Error Rate: No data available');
      return;
    }

    let anomalies = 0;

    for (const item of result) {

      const errorRatio =
        parseFloat(item.value[1]);

      if (errorRatio > 5) {

        const event = await createEvent(
          "ERROR_SPIKE",
          "node-api",
          "P1",
          `Abnormal error rate detected`,
          errorRatio
        );

        if (event) anomalies++;
      }
    }

    if (anomalies > 0) {
      console.log(
        `[DETECTOR] Error Rate: Found ${anomalies} spike(s)`
      );
    }

  } catch (err) {
    console.error(
      '[DETECTOR] Error detection error:',
      err.message
    );
  }
}
export async function detectMemorySpike() {

  try {
    //Querying memory percentage
    const result = await query(`
      (container_memory_usage_bytes
      /
      container_spec_memory_limit_bytes)
      * 100
    `);

    if (!result || result.length === 0) {
      console.log(
        '[DETECTOR] Memory: No data available'
      );
      return;
    }

    let anomalies = 0;

    for (const item of result) {

      const service =
        item.metric
        .container_label_com_docker_compose_service;

      if (!service) continue;

      const memoryPercent =
        parseFloat(item.value[1]);

      //If memory rate exceeds 80% then we count it as an anomaly
      if (memoryPercent > 80) {

        const event = await createEvent(
          "MEMORY_SPIKE",
          service,
          "P2",
          `Abnormal memory usage detected`,
          memoryPercent
        );

        if (event) anomalies++;
      }
    }

    if (anomalies > 0) {
      console.log(
        `[DETECTOR] Memory: Found ${anomalies} spike(s)`
      );
    }

  } catch (err) {

    console.error(
      '[DETECTOR] Memory detection error:',
      err.message
    );

  }
}
