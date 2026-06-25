import {
  ensureSchema,
  pool,
} from "./src/db.js";
import {
  analyzePendingBundle,
  getPendingBundles,
} from "./src/agent.js";

const POLL_INTERVAL_MS =
  Number(process.env.POLL_INTERVAL_MS) ||
  30000;

async function retry(name, action) {
  const maxRetries = Number(process.env.STARTUP_RETRIES || 30);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await action();
      console.log(`[AGENT] ${name} ready`);
      return;
    }
    catch (err) {
      console.log(
        `[AGENT] Waiting for ${name} (${attempt}/${maxRetries}): ${err.message}`
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

  if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
    throw new Error("GROQ_API_KEY or GEMINI_API_KEY is required");
  }
}

async function run() {
  const bundles = await getPendingBundles();

  if (bundles.length === 0) {
    console.log("[AGENT] No pending context bundles");
    return;
  }

  for (const bundle of bundles) {
    try {
      const analysis = await analyzePendingBundle(bundle);
      console.log(
        `[AGENT] Analyzed bundle ${bundle.id} as ${analysis.severity}`
      );
    }
    catch (err) {
      console.error(
        `[AGENT] Failed to analyze bundle ${bundle.id}:`,
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
    console.error("[AGENT] Failed to start:", err.message);
    process.exit(1);
  }
})();
