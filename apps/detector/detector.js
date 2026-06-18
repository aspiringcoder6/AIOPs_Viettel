const pool = require("./db");

async function createEvent(
  eventType,
  service,
  severity,
  description
) {

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
    `[EVENT] ${eventType} ${service}`
  );
}

module.exports = {
  createEvent
};