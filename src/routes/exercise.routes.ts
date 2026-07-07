import { Router } from "express";
import { ExerciseController } from "../controllers/exercise.controller";

const exerciseRouter = Router();

exerciseRouter.get("/event-loop", ExerciseController.getNodeEventLoop);
exerciseRouter.get("/cpu-heavy", ExerciseController.getCpuHeavy);

export default exerciseRouter;
