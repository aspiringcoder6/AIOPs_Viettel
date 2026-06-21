import docker from "./dockerLogs.js";
import { es } from "./elastic.js";

const allowedServices = [
  "node-api",
  "postgres",
  "redis",
  "nginx"
];
//Strip the multiplexed binary format
function cleanDockerChunk(chunk) {
  if (!chunk || chunk.length <= 8) {
    return "";
  }

  return chunk
    .slice(8)
    .toString("utf8")
    .trim();
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
    message
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