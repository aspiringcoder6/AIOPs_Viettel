import {Client} from "@elastic/elasticsearch"

export const es = new Client({
  node: process.env.ELASTIC_URL || "http://localhost:9200"

});

await es.index({
  index: "logs",
  document: {
    timestamp: new Date(),
    service: "node-api",
    level: "ERROR",
    message: "Database connection refused"
  }
});