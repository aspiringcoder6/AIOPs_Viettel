import {
  ensureSchema,
  pool,
} from "./src/db.js";
import {
  getPendingAnalyses,
  processAnalysis,
} from "./src/alertManager.js";

const POLL_INTERVAL_MS =
  Number(process.env.POLL_INTERVAL_MS) ||
  30000;

async function retry(name, action) {
  const maxRetries = Number(process.env.STARTUP_RETRIES || 30);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await action();
      console.log(`[ALERT-MANAGER] ${name} ready`);
      return;
    }
    catch (err) {
      console.log(
        `[ALERT-MANAGER] Waiting for ${name} (${attempt}/${maxRetries}): ${err.message}`
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  throw new Error(`${name} did not become ready`);
}

async function verifyStartup() {
  await retry("Database", async () => {
    await pool.query("SELECT NOW()");
    await ensureSchema();
  });
}

async function run() {
  const analyses = await getPendingAnalyses();

  if (analyses.length === 0) {
    console.log("[ALERT-MANAGER] No pending analyses");
    return;
  }

  for (const analysis of analyses) {
    try {
      const result = await processAnalysis(analysis);
      console.log(
        `[ALERT-MANAGER] Sent alert ${result.alert.id} for incident ${result.incident.id}`
      );
    }
    catch (err) {
      console.error(
        `[ALERT-MANAGER] Failed to process analysis ${analysis.id}:`,
        err.message
      );
    }
  }
}

(async () => {
  try {
    await verifyStartup();
    await run();

    if (process.env.RUN_ONCE === "true") {
      await pool.end();
      return;
    }

    setInterval(run, POLL_INTERVAL_MS);
  }
  catch (err) {
    console.error("[ALERT-MANAGER] Failed to start:", err.message);
    process.exit(1);
  }
})();
