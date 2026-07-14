import { Router } from "express";
import { ExerciseController } from "../controllers/exercise.controller";

const exerciseRouter = Router();

exerciseRouter.get("/event-loop", ExerciseController.getNodeEventLoop);
exerciseRouter.get("/cpu-heavy", ExerciseController.getCpuHeavy);
exerciseRouter.get("/generic-constrain", ExerciseController.genericConstrain);
exerciseRouter.get("/file-io", ExerciseController.getFileIo);
exerciseRouter.get("/products/:id", ExerciseController.getProduct);
exerciseRouter.put("/products/:id", ExerciseController.updateProduct);
exerciseRouter.get("/cache/debug-dump", ExerciseController.debugCache);

export default exerciseRouter;
