import {pool} from './db.js'

const EVENT_COOLDOWN_SECONDS =
  //This change the cooldown to prevent creating a duplicate event in the same service if the event type was recorded recently
  Number(process.env.EVENT_COOLDOWN_SECONDS) ||
  120;

async function findRecentDuplicate(eventType, service) {
  const result = await pool.query(
    `
    SELECT id, detected_at
    FROM events
    WHERE event_type = $1
      AND service_name = $2
      AND detected_at >= NOW() - ($3 * INTERVAL '1 second')
    ORDER BY detected_at DESC
    LIMIT 1
    `,
    [
      eventType,
      service,
      EVENT_COOLDOWN_SECONDS,
    ]
  );

  return result.rows[0] || null;
}

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

    const duplicate = await findRecentDuplicate(
      eventType,
      service
    );

    if (duplicate) {
      console.log(
        `[DETECTOR] Skipped duplicate ${eventType} on ${service}; recent event ${duplicate.id} is inside ${EVENT_COOLDOWN_SECONDS}s cooldown`
      );
      return null;
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

    return {
      eventType,
      service,
      severity,
      description,
      metricValue,
    };
  } catch (err) {
    console.error(`[ERROR] Failed to create event: ${err.message}`);
    throw err;
  }
}
