//Search logs by source_service and dependency and fall back to recent error/scenario logs if strict matching find nothing
function serviceMessageClauses(services) {
  return services.flatMap((service) => [
    {
      match_phrase: {
        message: `source_service=${service}`,
      },
    },
    {
      match_phrase: {
        message: `dependency=${service}`,
      },
    },
    {
      match_phrase: {
        message: service,
      },
    },
  ]);
}

export function buildLogQuery(event, startTime, endTime, relatedServices = []) {
  const services = [
    ...new Set([
      event.service_name,
      ...relatedServices,
    ].filter(Boolean)),
  ];

  const should = [
    {
      terms: {
        service: services,
      },
    },
    {
      terms: {
        source_service: services,
      },
    },
    {
      terms: {
        level: ["ERROR", "WARN"],
      },
    },
    {
      match_phrase: {
        message: "[SCENARIO:",
      },
    },
    ...serviceMessageClauses(services),
  ];

  if (event.event_type) {
    should.push({
      match_phrase: {
        message: String(event.event_type),
      },
    });
  }

  return {
    bool: {
      filter: [
        {
          range: {
            "@timestamp": {
              gte: startTime.toISOString(),
              lte: endTime.toISOString(),
            },
          },
        },
      ],
      should,
      minimum_should_match: 1,
    },
  };
}

export function buildFallbackLogQuery(startTime, endTime) {
  return {
    bool: {
      filter: [
        {
          range: {
            "@timestamp": {
              gte: startTime.toISOString(),
              lte: endTime.toISOString(),
            },
          },
        },
      ],
      should: [
        {
          terms: {
            level: ["ERROR", "WARN"],
          },
        },
        {
          match_phrase: {
            message: "[SCENARIO:",
          },
        },
      ],
      minimum_should_match: 1,
    },
  };
}
