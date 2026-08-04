import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { errorHandler } from "./middleware/errorHandler";
import exerciseRouter from "./routes/exercise.routes";
import { HomeController } from "./controllers/home.controller";
import { IS_PRODUCTION } from "./config/env";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan(IS_PRODUCTION ? "combined" : "dev"));

app.get("/", HomeController.getHome);

app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

// Files placed in /storage are served as-is, e.g. storage/logo.png -> GET /storage/logo.png
app.use("/storage", express.static(path.join(__dirname, "..", "storage")));

// The exercise routes intentionally include expensive endpoints (e.g. cpu-heavy,
// which blocks the event loop on purpose) — rate-limited to curb casual abuse.
const exerciseLimiter = rateLimit({
  windowMs: 60_000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/exercise", exerciseLimiter, exerciseRouter);

app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.use(errorHandler);

export default app;
