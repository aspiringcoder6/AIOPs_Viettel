import { Client } from "@elastic/elasticsearch";

const es = new Client({
  node: process.env.ELASTIC_URL || "http://localhost:9200",
});

export async function getLogsAroundEvent(event, startTime, endTime, relatedServices = []) {
  const services = [
    ...new Set([
      event.service_name,
      ...relatedServices,
    ].filter(Boolean)),
  ];

  const response = await es.search({
    index: "logs-*",
    ignore_unavailable: true,
    size: Number(process.env.CONTEXT_LOG_SEARCH_SIZE || 250),
    sort: [
      {
        "@timestamp": {
          order: "asc",
        },
      },
    ],
    query: {
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
              service: services,
            },
          },
          {
            terms: {
              level: ["ERROR", "WARN"],
            },
          },
        ],
        minimum_should_match: 1,
      },
    },
  });

  return response.hits.hits.map((hit) => hit._source);
}
