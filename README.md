# exercise-api

Small Express + TypeScript API used to demonstrate the Node.js event loop.

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
  config/env.ts              # environment variable loading
  controllers/                # request handlers
  helpers/result.helper.ts    # Result<T, E> combinators (e.g. mapResult)
  middleware/errorHandler.ts  # centralized error handler
  routes/                     # route definitions
  types/result.ts             # Result<T, E> discriminated union type
  app.ts                      # express app setup (middleware, routes)
  server.ts                   # entrypoint, starts the HTTP server
```
