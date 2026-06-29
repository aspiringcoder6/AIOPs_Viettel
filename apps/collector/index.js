import docker from "./dockerLogs.js";
import {
  es,
  waitForElasticsearch,
} from "./elastic.js";

const allowedServices = [
  "node-api",
  "postgres",
  "redis",
  "nginx"
];

function sanitizeText(value) {
  return String(value)
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

//Strip the multiplexed binary format
function cleanDockerChunk(chunk) {
  if (!chunk || chunk.length <= 8) {
    return "";
  }

  const payload = chunk.slice(8).toString("utf8");

  return sanitizeText(payload);
}

function parseLog(service, message) {
  let level = "INFO";

  const lower = message.toLowerCase();

  if (
    lower.includes("error") ||
    lower.includes("exception") ||
    lower.includes("failed")
  ) {
    level = "ERROR";
  }
  else if (
    lower.includes("warn") ||
    lower.includes("warning")
  ) {
    level = "WARN";
  }

  return {
    timestamp: new Date(),
    service,
    level,
    message: sanitizeText(message)
  };
}

async function watchContainer(info) {
  const service =
    info.Labels["com.docker.compose.service"];

  if (!allowedServices.includes(service)) {
    return;
  }

  console.log(
    `[COLLECTOR] Watching ${service}`
  );

  const container =
    docker.getContainer(info.Id);

  const stream =
    await container.logs({
      stdout: true,
      stderr: true,
      follow: true,
      tail: 20
    });

  stream.on(
    "data",
    async (chunk) => {
      try {
        const message =
          cleanDockerChunk(chunk);

        if (!message) {
          return;
        }

        const parsed =
          parseLog(
            service,
            message
          );

        console.log(
          `[${service}] ${parsed.level}: ${message}`
        );

        await es.index({
          index: `logs-${new Date()
            .toISOString()
            .slice(0, 10)}`,
          document: parsed,
          refresh: false
        });
      }
      catch (err) {
        console.error(
          `[COLLECTOR] Failed to index log from ${service}:`,
          err.message
        );
      }
    }
  );

  stream.on(
    "error",
    (err) => {
      console.error(
        `[COLLECTOR] Stream error (${service}):`,
        err.message
      );
    }
  );
}

async function start() {
  await waitForElasticsearch();

  const containers =
    await docker.listContainers();

  console.log(
    `[COLLECTOR] Found ${containers.length} containers`
  );

  for (const container of containers) {
    await watchContainer(container);
  }
}

start().catch(console.error);
