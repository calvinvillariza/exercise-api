const WebSocket = require("ws");

const WAVE_SIZE = 20;
const WAVE_INTERVAL_MS = 2000;
const CONNECTION_LIFETIME_MS = 1000;

const WS_URL =
  process.env.NODE_ENV === "production"
    ? "wss://exercise-api-latest.onrender.com"
    : "ws://localhost:8686";

let waveNumber = 0;

function runWave() {
  waveNumber++;
  console.log(`\n=== Wave ${waveNumber}: connecting ${WAVE_SIZE} clients ===`);

  for (let i = 0; i < WAVE_SIZE; i++) {
    const ws = new WebSocket(WS_URL);

    ws.on("open", () => {
      setTimeout(() => ws.close(), CONNECTION_LIFETIME_MS);
    });

    ws.on("error", (err) => console.error("client error:", err.message));
  }
}

runWave();
setInterval(runWave, WAVE_INTERVAL_MS);
