import {
  detectCpuSpike,
  detectErrorSpike,
  detectLatencySpike,
  detectMemorySpike,
  detectServiceDown,
} from "./rules.js";
import { pool } from "./db.js";
import axios from "axios";

async function retry(name, action) {
  const maxRetries = Number(process.env.STARTUP_RETRIES || 30);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await action();
      console.log(`[DETECTOR] ${name} connected`);
      return;
    }
    catch (err) {
      console.log(
        `[DETECTOR] Waiting for ${name} (${attempt}/${maxRetries}): ${err.message}`
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  throw new Error(`${name} did not become ready`);
}

async function verifyConnections() {
  await retry("Database", async () => {
    await pool.query("SELECT NOW()");
  });

  await retry("Prometheus", async () => {
    const prometheusUrl =
      process.env.PROMETHEUS_URL ||
      "http://localhost:9090";

    await axios.get(`${prometheusUrl}/api/v1/query`, {
      params: {
        query: "up",
      },
    });
  });
}

async function run() {
  console.log("[DETECTOR] Scanning for anomalies...");

  try {
    await detectLatencySpike();
    await detectCpuSpike();
    await detectMemorySpike();
    await detectErrorSpike();
    await detectServiceDown();
    console.log("[DETECTOR] Scan complete");
  }
  catch (err) {
    console.error("[DETECTOR] Error during anomaly detection:", err.message);
    console.error(err);
  }
}

(async () => {
  try {
    await verifyConnections();
    console.log("[DETECTOR] Starting anomaly detection...");
    await run();
    setInterval(run, 30000);
  }
  catch (err) {
    console.error("[DETECTOR] Failed to start:", err.message);
    process.exit(1);
  }
})();
