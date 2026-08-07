# exercise-api

[![CI](https://github.com/calvinvillariza/exercise-api/actions/workflows/ci.yml/badge.svg)](https://github.com/calvinvillariza/exercise-api/actions/workflows/ci.yml)

Small Express + TypeScript API used to demonstrate Node.js concepts: the event loop, CPU-bound blocking, file I/O, in-memory caching, and WebSocket broadcasting via `EventEmitter`. Hardened with the baseline expected of a real service (health check, graceful shutdown, rate limiting, tests, lint/format, CI/CD) while staying scoped as a testing/portfolio project.

## Requirements

- Node.js 22+
- Docker (optional, for containerized runs)

## Setup

```bash
npm install
cp .env.example .env
```

## Running locally

```bash
npm run dev        # start with live-reload (ts-node-dev)
npm run build       # compile TypeScript to dist/
npm start           # run the compiled build (dist/server.js)
npm run lint         # ESLint
npm run format       # Prettier --write
npm run typecheck    # tsc --noEmit
npm test             # node:test, via tsx
```

## API

| Method | Path                              | Description                                                                                                                                            |
| ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/`                               | Renders this README as an HTML page — the default view when visiting the deployed URL in a browser                                                    |
| GET    | `/healthz`                        | Health check: `{ status: "ok", uptime }`                                                                                                               |
| GET    | `/api/exercise/event-loop`        | Logs event loop ordering (sync, timer, microtask) to the server console                                                                                |
| GET    | `/api/exercise/cpu-heavy`         | Runs a naive, synchronous prime count up to `?limit` (default 200000), blocking the event loop for the duration                                        |
| GET    | `/api/exercise/generic-constrain` | Validates `?input` as a number in `[0, 150]`; returns `{ ok, value }` or `{ ok, error }`                                                               |
| GET    | `/api/exercise/file-io`           | Copies `storage/big-file.txt` via naive buffering and via `.pipe()` streams, returning both durations                                                  |
| GET    | `/api/exercise/products/:id`      | Cache-aside product lookup: serves from the in-memory cache on hit, otherwise fetches from the (simulated 2s-latency) DB and caches the result for 10s |
| PUT    | `/api/exercise/products/:id`      | Updates a product directly in the DB and invalidates its cache entry                                                                                   |
| GET    | `/api/exercise/cache/debug-dump`  | Dumps the full in-memory cache store, including remaining TTL per key                                                                                  |
| POST   | `/api/exercise/ts-discriminated-union` | Takes an `Order` body and demonstrates TypeScript narrowing a discriminated union (`status: "pending" \| "shipped"`) so `trackingNumber` is only accessible on the `"shipped"` branch |
| POST   | `/api/exercise/login`             | Starts the OIDC demo flow: redirects to the mock IdP's `/authorize` endpoint with a fresh PKCE code challenge, `state`, and `nonce`                    |
| GET    | `/api/exercise/callback`          | OIDC redirect target: exchanges the auth code for tokens, verifies the ID token against the IdP's JWKS, and sets an httpOnly `session_id` cookie       |
| GET    | `/api/exercise/profile`           | Protected page: reads the session cookie, calls the mock resource API with the stored access token, and renders the result                            |
| GET    | `/api/exercise/logout`            | Clears the session cookie                                                                                                                               |
| GET    | `/storage/<filename>`             | Serves static files placed in the `storage/` directory                                                                                                 |

All `/api/exercise/*` routes are rate-limited (100 requests/minute per IP) — `cpu-heavy` and `file-io` are deliberately expensive, so this is a real abuse vector once the API is reachable publicly. `/healthz` is exempt, for use by container/orchestrator health probes.

## WebSocket

The HTTP server also accepts WebSocket upgrades on the same port, e.g. `ws://localhost:8686`.

On connection, the server subscribes the client to an `EventEmitter` that broadcasts a simulated price update (`{ price, ts }`) every 500ms; each client receives updates tagged with its own `clientId`. On disconnect, the client's listener is removed from the emitter.

Every 3s the server logs the current `update` listener count and process heap usage to the console — useful for observing listener buildup/cleanup and memory behavior as clients connect and disconnect.

### Simulating client load

`external/websocket-simulate-client.js` connects the server to a real (non-browser) WebSocket client for observation, without needing a UI. It opens waves of 20 short-lived connections every 2s (each connection closes after 1s), so you can watch the server's listener-count/heap logs rise and fall as each wave connects and disconnects. This is a local dev/debugging tool only — it's not part of the API and is excluded from the Docker build (see `.dockerignore`).

By default it targets `ws://localhost:8686`; set `NODE_ENV=production` to point it at the live Render deployment (`wss://exercise-api-latest.onrender.com`) instead.

Run the server first, then in a separate terminal:

```bash
node external/websocket-simulate-client.js                    # local
NODE_ENV=production node external/websocket-simulate-client.js # live deployment
```

## SSO / OIDC demo

`/api/exercise/login` through `/api/exercise/profile` walk through a real OIDC authorization-code + PKCE flow end to end, backed by two standalone mock services in `external/`:

- `external/idp-server.js` — a mock Identity Provider (think Okta/Auth0). Implements `/authorize`, `/token`, and `/.well-known/jwks.json`, signs tokens with an RS256 key pair generated at startup, and auto-approves a fixed demo user (skips a real login UI, since the point of the exercise is the protocol, not a login form). Listens on port 4000.
- `external/resource-api-server.js` — a mock "real" backend API, entirely separate from the IdP. Verifies an access token's signature locally against the IdP's JWKS instead of calling back to the IdP on every request, then serves `/me`. Listens on port 5000.

`src/services/login.service.ts` holds the SP (service provider) side of the flow: PKCE/nonce tracking for in-flight logins and an in-memory session store, keyed by a `session_id` cookie.

Since the flow starts with a POST (`/login`), you can't just type the URL into a browser's address bar to try it — trigger it via a form/button, or from the browser devtools console:

```js
fetch('/api/exercise/login', { method: 'POST' }).then((r) => (location.href = r.url));
```

Run both mock services locally alongside the API, each in its own terminal:

```bash
node external/idp-server.js
node external/resource-api-server.js
npm run dev
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

The runtime image carries a `HEALTHCHECK` that polls `/healthz`; `docker ps` will show the container as `healthy`/`unhealthy` accordingly.

## CI/CD

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push/PR to `main`:

- **test** — install, lint, typecheck, run the test suite, build
- **publish** — (only on push to `main`, once `test` passes) builds the `runtime` Docker stage and pushes it to [GitHub Container Registry](https://ghcr.io) as `ghcr.io/calvinvillariza/exercise-api:latest` and `:<commit-sha>`

Everything runs on GitHub's own free infrastructure — Actions for CI/CD, GHCR for image hosting — no external account or paid service required. [`.github/dependabot.yml`](.github/dependabot.yml) keeps npm and Actions dependencies up to date on a weekly schedule.

This publishes a container image; it does not stand up a live, running deployment anywhere. Pulling and running the published image is a manual step:

```bash
docker pull ghcr.io/calvinvillariza/exercise-api:latest
docker run -p 8686:8686 -e PORT=8686 ghcr.io/calvinvillariza/exercise-api:latest
```

## Project structure

```
src/
  cache.ts                    # in-memory TTL cache (get/set/invalidate/debugDump)
  cache.test.ts                # unit tests for cache.ts
  config/env.ts                # environment variable loading + validation (PORT, NODE_ENV)
  controllers/                # request handlers
  db/product.ts                # in-memory "DB" of products with simulated latency
  helpers/result.helper.ts    # Result<T, E> combinators (e.g. mapResult)
  helpers/result.helper.test.ts
  in-flight.ts                 # request coalescing (single-flight)
  in-flight.test.ts
  interfaces/IOrder.ts         # Order shape as a flat interface (contrasted with types/order.ts)
  middleware/errorHandler.ts  # centralized error handler
  routes/                     # route definitions
  services/login.service.ts   # SSO demo: PKCE/nonce tracking + in-memory sessions for the OIDC flow
  types/order.ts               # Order type as a discriminated union
  types/product.ts            # Product type
  types/result.ts             # Result<T, E> discriminated union type
  websocket.ts                 # WebSocket server: EventEmitter-based price update broadcast
  app.ts                      # express app setup (middleware, routes, health check)
  app.test.ts                  # supertest integration checks against app.ts
  server.ts                   # entrypoint, starts the HTTP server + WebSocket server, graceful shutdown
storage/                      # static files served at /storage (gitignored, .gitkeep only)
external/
  idp-server.js                # mock OIDC Identity Provider for the SSO demo (port 4000)
  resource-api-server.js       # mock resource API that verifies tokens from idp-server.js (port 5000)
  websocket-simulate-client.js # dev-only load-sim script, excluded from the Docker build
```
