import {Client} from "@elastic/elasticsearch"

export const es = new Client({
  node: process.env.ELASTIC_URL || "http://localhost:9200"

});

export async function waitForElasticsearch() {
  const maxRetries = Number(process.env.ELASTIC_RETRIES || 30);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await es.ping();
      console.log("[COLLECTOR] Elasticsearch connected");
      return;
    }
    catch (err) {
      console.log(
        `[COLLECTOR] Waiting for Elasticsearch (${attempt}/${maxRetries}): ${err.message}`
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  throw new Error("Elasticsearch did not become ready");
}
