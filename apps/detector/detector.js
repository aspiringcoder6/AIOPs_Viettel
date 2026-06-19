import {pool} from './db.js'

export async function createEvent(
  eventType,
  service,
  severity,
  description
) {
  try {
    await pool.query(
      `
      INSERT INTO events(
        event_type,
        service_name,
        severity,
        description
      )
      VALUES($1,$2,$3,$4)
      `,
      [
        eventType,
        service,
        severity,
        description
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
