const {
  detectCpuSpike,
  detectLatencySpike,
  detectServiceDown
} = require("./rules");

async function run() {

  try {

    await detectCpuSpike();

    await detectLatencySpike();

    await detectServiceDown();

  } catch(err) {

    console.error(err);
  }
}

run();

setInterval(
  run,
  30000
);