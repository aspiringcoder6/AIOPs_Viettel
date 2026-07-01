import { Client } from "@elastic/elasticsearch";
import {
  buildFallbackLogQuery,
  buildLogQuery,
} from "./logQuery.js";

const es = new Client({
  node: process.env.ELASTIC_URL || "http://localhost:9200",
});

async function searchLogs(query, size) {
  const response = await es.search({
    index: "logs-*",
    ignore_unavailable: true,
    size,
    sort: [
      {
        "@timestamp": {
          order: "asc",
        },
      },
    ],
    query,
  });

  return response.hits.hits.map((hit) => hit._source);
}

//Get logs around a certain event of interest
export async function getLogsAroundEvent(event, startTime, endTime, relatedServices = []) {
  const size = Number(process.env.CONTEXT_LOG_SEARCH_SIZE || 250);
  const logs = await searchLogs(
    buildLogQuery(event, startTime, endTime, relatedServices),
    size
  );

  if (logs.length > 0) {
    return logs;
  }

  const fallbackLogs = await searchLogs(
    buildFallbackLogQuery(startTime, endTime),
    Math.min(size, 50)
  );

  if (fallbackLogs.length > 0) {
    console.log(
      `[CONTEXT] Strict log search returned 0 logs for event ${event.id}; using ${fallbackLogs.length} fallback error/scenario logs`
    );
  }

  return fallbackLogs;
}
