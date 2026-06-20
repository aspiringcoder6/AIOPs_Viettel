import docker from "./dockerLogs.js";

const containers =
  await docker.listContainers();

console.log(containers);
const allowedServices = [
  "node-api",
  "postgres",
  "redis",
  "nginx"
];

function parseLog(
  service,
  message
) {

  let level = "INFO";

  const lower =
    message.toLowerCase();

  if (
    lower.includes("error")
  ) {

    level = "ERROR";

  }

  return {

    timestamp:
      new Date(),

    service,

    level,

    message
  };
}
for (const info of containers) {
    const service =
    info.Labels[
      "com.docker.compose.service"
    ];

    if (
        !allowedServices.includes(service)
    ) {
        continue;
    }

    console.log(
        `Watching ${service}`
    );
    const container =
        docker.getContainer(info.Id);

    const stream =
        await container.logs({

        stdout: true,
        stderr: true,

        follow: true,

        tail: 10
        });

    stream.on(
        "data",
        chunk => {

        console.log(
            info.Names[0],
            chunk.toString()
        );

        }
    );
}
