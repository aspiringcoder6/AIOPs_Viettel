import docker from "./dockerLogs.js";
import {
  es,
  waitForElasticsearch,
} from "./elastic.js";
import {
  cleanDockerChunk,
  parseLog,
} from "./logParser.js";

const allowedServices = [
  "node-api",
  "postgres",
  "redis",
  "nginx"
];

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

        const lines = message
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        for (const line of lines) {
          const parsed =
            parseLog(
              service,
              line
            );

          console.log(
            `[${service}] ${parsed.level}: ${line}`
          );

          await es.index({
            index: `logs-${new Date()
              .toISOString()
              .slice(0, 10)}`,
            document: parsed,
            refresh: false
          });
        }
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
