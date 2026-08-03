import { Request, Response, NextFunction } from "express";
import { IS_PRODUCTION } from "../config/env";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong",
    ...(IS_PRODUCTION ? {} : { error: err.message }),
  });
};
