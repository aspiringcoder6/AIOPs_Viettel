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

async function verifyDatabase() {
  await pool.query("SELECT NOW()");
  await ensureSchema();
  console.log("[CONTEXT] Database connected");
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
