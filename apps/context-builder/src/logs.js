import { Client } from "@elastic/elasticsearch";

const es = new Client({
  node: process.env.ELASTIC_URL || "http://localhost:9200",
});

export async function getLogsAroundEvent(event, startTime, endTime) {
  const response = await es.search({
    index: "logs-*",
    ignore_unavailable: true,
    size: 100,
    sort: [
      {
        timestamp: {
          order: "asc",
        },
      },
    ],
    query: {
      range: {
        timestamp: {
          gte: startTime.toISOString(),
          lte: endTime.toISOString(),
        },
      },
    },
  });

  return response.hits.hits
    .map((hit) => hit._source)
    .filter((log) => {
      return (
        log.service === event.service_name ||
        log.level === "ERROR" ||
        log.level === "WARN"
      );
    });
}
