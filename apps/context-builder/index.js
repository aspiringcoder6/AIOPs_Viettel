import {
  ensureSchema,
  pool,
} from "./src/db.js";
import {
  buildContextBundle,
  getPendingEvents,
} from "./src/contextBuilder.js";

const POLL_INTERVAL_MS =
  Number(process.env.POLL_INTERVAL_MS) ||
  30000;

async function retry(name, action) {
  const maxRetries = Number(process.env.STARTUP_RETRIES || 30);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await action();
      console.log(`[CONTEXT] ${name} connected`);
      return;
    }
    catch (err) {
      console.log(
        `[CONTEXT] Waiting for ${name} (${attempt}/${maxRetries}): ${err.message}`
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  throw new Error(`${name} did not become ready`);
}

async function verifyDatabase() {
  await retry("Database", async () => {
    await pool.query("SELECT NOW()");
    await ensureSchema();
  });
}

async function run() {
  const events = await getPendingEvents();

  if (events.length === 0) {
    console.log("[CONTEXT] No pending events");
    return;
  }

  for (const event of events) {
    try {
      const bundle = await buildContextBundle(event);
      console.log(
        `[CONTEXT] Built bundle ${bundle.id} for event ${event.id}`
      );
    }
    catch (err) {
      console.error(
        `[CONTEXT] Failed to build bundle for event ${event.id}:`,
        err.message
      );
    }
  }
}

(async () => {
  try {
    await verifyDatabase();
    await run();

    if (process.env.RUN_ONCE === "true") {
      await pool.end();
      return;
    }

    setInterval(run, POLL_INTERVAL_MS);
  }
  catch (err) {
    console.error("[CONTEXT] Failed to start:", err.message);
    process.exit(1);
  }
})();
