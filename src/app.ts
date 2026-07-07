import express from "express";
import cors from "cors";
import helmet from "helmet";
import { errorHandler } from "./middleware/errorHandler";
import exerciseRouter from "./routes/exercise.routes";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use("/api/exercise", exerciseRouter);

app.use(errorHandler);

export default app;
