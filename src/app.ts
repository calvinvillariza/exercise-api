import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { errorHandler } from "./middleware/errorHandler";
import exerciseRouter from "./routes/exercise.routes";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Files placed in /storage are served as-is, e.g. storage/logo.png -> GET /storage/logo.png
app.use("/storage", express.static(path.join(__dirname, "..", "storage")));

app.use("/api/exercise", exerciseRouter);

app.use(errorHandler);

export default app;
