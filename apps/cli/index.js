#!/usr/bin/env node

import {
  listAlerts,
  listIncidents,
  printHelp,
  showIncident,
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

  if (command === "incident") {
    if (!value || Number.isNaN(Number(value))) {
      throw new Error("Usage: aiops incident <id>");
    }

    await showIncident(Number(value));
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
