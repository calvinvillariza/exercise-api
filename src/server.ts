import * as WebSocket from "ws";
import app from "./app";
import { PORT } from "./config/env";
import { EventEmitter } from "stream";
import { WebSocketModule } from "./websocket";

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ server });
const eventEmitter = new EventEmitter();

const { stop: stopWebSocket } = WebSocketModule.runWebSocket(
  wss,
  eventEmitter,
  PORT,
);

const shutdown = (signal: string) => {
  console.log(`${signal} received: closing server gracefully`);

  stopWebSocket();

  wss.close(() => {
    server.close((err) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }

      process.exit(0);
    });
  });

  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
