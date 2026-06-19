import Docker from "dockerode"
const docker = new Docker();

const containers = await docker.listContainers();

for (const c of containers) {
  console.log(c.Names[0]);
}