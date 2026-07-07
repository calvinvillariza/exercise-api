import { Request, Response } from "express";

const getNodeEventLoop = async (req: Request, res: Response) => {
  console.log("1");

  setTimeout(() => console.log("2"), 0);

  Promise.resolve().then(() => console.log("3"));

  console.log("4");

  res.status(200).json();
};

export const ExerciseController = {
  getNodeEventLoop,
};
