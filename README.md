# exercise-api

Small Express + TypeScript API used to demonstrate Node.js concepts: the event loop, CPU-bound blocking, file I/O, in-memory caching, and WebSocket broadcasting via `EventEmitter`.

## Requirements

- Node.js 22+
- Docker (optional, for containerized runs)

## Setup

```bash
npm install
```

Create a `.env` file in the project root:

```
PORT=8686
```

## Running locally

```bash
npm run dev     # start with live-reload (ts-node-dev)
npm run build   # compile TypeScript to dist/
npm start       # run the compiled build (dist/server.js)
```

## API

| Method | Path                              | Description                                |
| ------ | ---------------------------------- | ------------------------------------------- |
| GET    | `/api/exercise/event-loop`         | Logs event loop ordering (sync, timer, microtask) to the server console |
| GET    | `/api/exercise/cpu-heavy`          | Runs a naive, synchronous prime count up to `?limit` (default 200000), blocking the event loop for the duration |
| GET    | `/api/exercise/generic-constrain`  | Validates `?input` as a number in `[0, 150]`; returns `{ ok, value }` or `{ ok, error }` |
| GET    | `/api/exercise/file-io`            | Copies `storage/big-file.txt` via naive buffering and via `.pipe()` streams, returning both durations |
| GET    | `/api/exercise/products/:id`       | Cache-aside product lookup: serves from the in-memory cache on hit, otherwise fetches from the (simulated 2s-latency) DB and caches the result for 10s |
| PUT    | `/api/exercise/products/:id`       | Updates a product directly in the DB and invalidates its cache entry |
| GET    | `/api/exercise/cache/debug-dump`   | Dumps the full in-memory cache store, including remaining TTL per key |
| GET    | `/storage/<filename>`              | Serves static files placed in the `storage/` directory |

## WebSocket

The HTTP server also accepts WebSocket upgrades on the same port, e.g. `ws://localhost:8686`.

On connection, the server subscribes the client to an `EventEmitter` that broadcasts a simulated price update (`{ price, ts }`) every 500ms; each client receives updates tagged with its own `clientId`. On disconnect, the client's listener is removed from the emitter.

Every 3s the server logs the current `update` listener count and process heap usage to the console — useful for observing listener buildup/cleanup and memory behavior as clients connect and disconnect.

### Simulating client load

`external/websocket-simulate-client.js` connects the server to a real (non-browser) WebSocket client for observation, without needing a UI. It opens waves of 20 short-lived connections against `ws://localhost:8686` every 2s (each connection closes after 1s), so you can watch the server's listener-count/heap logs rise and fall as each wave connects and disconnects.

Run the server first, then in a separate terminal:

```bash
node external/websocket-simulate-client.js
```

## Docker

### Production image

Builds a compiled, production-only image.

```bash
docker compose up --build
```

Serves on `http://localhost:8686`.

### Development (live-reload)

Builds a dev image, bind-mounts `src/` and `tsconfig.json`, and runs `npm run dev` inside the container so edits on the host trigger a restart.

```bash
docker compose -f docker-compose.dev.yml up --build
```

## Project structure

```
src/
  cache.ts                    # in-memory TTL cache (get/set/invalidate/debugDump)
  config/env.ts               # environment variable loading
  controllers/                # request handlers
  db/product.ts                # in-memory "DB" of products with simulated latency
  helpers/result.helper.ts    # Result<T, E> combinators (e.g. mapResult)
  middleware/errorHandler.ts  # centralized error handler
  routes/                     # route definitions
  types/product.ts            # Product type
  types/result.ts             # Result<T, E> discriminated union type
  websocket.ts                 # WebSocket server: EventEmitter-based price update broadcast
  app.ts                      # express app setup (middleware, routes)
  server.ts                   # entrypoint, starts the HTTP server + WebSocket server
storage/                      # static files served at /storage (gitignored, .gitkeep only)
external/
  websocket-simulate-client.js # standalone script that opens waves of short-lived WS connections against the server
```
