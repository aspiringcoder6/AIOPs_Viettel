import Client from "@elastic/elasticsearch"

const es = new Client({
  node: "http://elasticsearch:9200"
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