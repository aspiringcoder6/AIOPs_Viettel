import {pool} from './db.js'

export async function createEvent(
  eventType,
  service,
  severity,
  description,
  metric_value
) {
  try {
    const metricValue =
      metric_value === undefined ||
      metric_value === null
        ? null
        : Number(metric_value);

    if (metricValue !== null && Number.isNaN(metricValue)) {
      throw new Error(
        `metric_value must be numeric, received "${metric_value}"`
      );
    }

    await pool.query(
      `
      INSERT INTO events(
        event_type,
        service_name,
        severity,
        description,
        metric_value
      )
      VALUES($1,$2,$3,$4,$5)
      `,
      [
        eventType,
        service,
        severity,
        description,
        metricValue
      ]
    );

    console.log(
      `[ANOMALY] ${eventType} on ${service} [${severity}] - ${description}`
    );
  } catch (err) {
    console.error(`[ERROR] Failed to create event: ${err.message}`);
    throw err;
  }
}
