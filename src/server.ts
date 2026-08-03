import * as WebSocket from "ws";
import app from "./app";
import { PORT } from "./config/env";
import { EventEmitter } from "stream";
import { WebSocketModule } from "./websocket";

const port = PORT ?? "3000";

const server = app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

const wss = new WebSocket.Server({ server });
const eventEmitter = new EventEmitter();

WebSocketModule.runWebSocket(wss, eventEmitter, +port);
