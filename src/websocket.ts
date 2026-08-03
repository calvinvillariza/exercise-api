import { EventEmitter } from "events";
import * as WebSocket from "ws";

type PriceUpdate = {
  price: number;
  ts: number;
};

const runWebSocket = (
  wss: WebSocket.Server,
  eventEmitter: EventEmitter,
  port: number,
) => {
  eventEmitter.setMaxListeners(1000);

  setInterval(() => {
    eventEmitter.emit("update", { price: Math.random() * 100, ts: Date.now() });
  }, 500);

  console.log(`WebSocket server running on ws://localhost:${port}`);

  let connectionCount = 0;

  wss.on("connection", (ws) => {
    connectionCount++;

    const id = connectionCount;

    console.log(`[CONNECT] client #${id}`);

    const handler = (data: PriceUpdate) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            ...data,
            clientId: id,
          }),
        );
      }
    };

    eventEmitter.on("update", handler);

    ws.on("close", () => {
      eventEmitter.off("update", handler);

      console.log(
        `[DISCONNECT] client #${id} - listener count is now: ${eventEmitter.listenerCount("update")}`,
      );
    });
  });

  setInterval(() => {
    if (global.gc) global.gc();

    const heapUsed = process.memoryUsage().heapUsed;
    const mem = heapUsed / 1024 / 1024;

    console.log(
      `--- STATUS: listener=${eventEmitter.listenerCount("update")} | HEAPUSED=${heapUsed} MEM=${mem.toFixed(2)}MB ---`,
    );
  }, 3000);

  return wss;
};

export const WebSocketModule = {
  runWebSocket,
};
