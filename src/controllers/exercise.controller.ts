import { Request, Response } from "express";

const getNodeEventLoop = async (req: Request, res: Response) => {
  console.log("1");

  setTimeout(() => console.log("2"), 0);

  Promise.resolve().then(() => console.log("3"));

  console.log("4");

  res.status(200).json();
};

// Deliberately naive (O(n) per check instead of O(sqrt(n))) to block the event loop.
const isPrimeSync = (n: number): boolean => {
  if (n < 2) return false;
  for (let i = 2; i < n; i++) {
    if (n % i === 0) return false;
  }
  return true;
};

const getCpuHeavy = (req: Request, res: Response) => {
  const limit = Number(req.query.limit) || 200000;

  const start = Date.now();
  const primes: number[] = [];
  for (let i = 2; i <= limit; i++) {
    if (isPrimeSync(i)) primes.push(i);
  }
  const durationMs = Date.now() - start;
  const results = { limit, count: primes.length, durationMs };

  console.log(results);

  res.status(200).json(results);
};

export const ExerciseController = {
  getNodeEventLoop,
  getCpuHeavy,
};
