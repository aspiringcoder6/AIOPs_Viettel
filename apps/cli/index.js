#!/usr/bin/env node

import {
  listAlerts,
  listIncidents,
  listSuppressedEvents,
  printHelp,
  showIncident,
  updateIncidentLifecycle,
} from "./src/commands.js";
import { pool } from "./src/db.js";

async function main() {
  const [command, value] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (command === "incidents") {
    await listIncidents();
    return;
  }

  if (command === "alerts") {
    await listAlerts();
    return;
  }

  if (command === "suppressed") {
    await listSuppressedEvents();
    return;
  }

  if (command === "incident") {
    if (!value || Number.isNaN(Number(value))) {
      throw new Error("Usage: aiops incident <id>");
    }

    await showIncident(Number(value));
    return;
  }

  if (command === "resolve" || command === "reopen") {
    if (!value || Number.isNaN(Number(value))) {
      throw new Error(`Usage: aiops ${command} <id>`);
    }

    await updateIncidentLifecycle(
      Number(value),
      command === "resolve" ? "RESOLVED" : "OPEN"
    );
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main()
  .catch((err) => {
    console.error(`[CLI] ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
