import { Request, Response } from "express";
import { mapResult } from "../helpers/result.helper";
import { Result } from "../types/result";

/**
 * Logs in the order 1, 4, 3, 2 — never 1, 2, 3, 4 — because of how the Node
 * event loop schedules work relative to the call stack:
 *
 * 1. "1" and "4" are plain synchronous statements, so they execute
 *    immediately as the function body runs, in source order, before the
 *    stack unwinds.
 * 2. `setTimeout(..., 0)` does not queue a callback for "0ms from now"; it
 *    hands the callback to libuv's timer subsystem, which will only surface
 *    it on a future iteration of the event loop's timers phase — at minimum
 *    one full loop tick away, regardless of the delay value.
 * 3. `Promise.resolve().then(...)` schedules its callback on the microtask
 *    queue, not the macrotask/timer queue. Microtasks are drained completely
 *    by the JS engine immediately after the current synchronous execution
 *    context finishes (i.e. once the call stack is empty) and BEFORE the
 *    event loop is allowed to advance to any other phase, including timers.
 * 4. So the runtime order is: run synchronous code to completion (1, 4) ->
 *    drain the microtask queue (3) -> proceed to the timers phase on a later
 *    loop iteration (2). Microtasks always win the race against a 0ms timer
 *    because they're not competing for the same queue — they're checked at
 *    an earlier point in the loop, every single tick.
 */
const getNodeEventLoop = async (req: Request, res: Response) => {
  console.log("1");

  setTimeout(() => console.log("2"), 0);

  Promise.resolve().then(() => console.log("3"));

  console.log("4");

  res.status(200).json();
};

/**
 * Deliberately naive primality check — O(n) trial division instead of the
 * standard O(sqrt(n)) (looping only up to `Math.sqrt(n)` and skipping even
 * numbers past 2). This is intentional: it maximizes CPU time spent per call
 * so the caller can reliably block the event loop for demonstration purposes.
 */
const isPrimeSync = (n: number): boolean => {
  if (n < 2) return false;
  for (let i = 2; i < n; i++) {
    if (n % i === 0) return false;
  }
  return true;
};

/**
 * This handler runs entirely synchronously and blocks the event loop for
 * the full duration of the computation — here's the technical reason why:
 *
 * 1. Node runs all JS on a single main thread. There is no background
 *    thread executing this for-loop; the same thread that would otherwise
 *    be polling epoll/IOCP for other requests' I/O, running timers, or
 *    draining microtask queues is instead stuck evaluating isPrimeSync in
 *    a tight synchronous loop.
 * 2. Because none of this code performs I/O (no `await`, no callback-based
 *    API), there is no point where control is ever yielded back to the
 *    event loop. The call stack stays non-empty from the first `isPrimeSync`
 *    call until the entire `for (let i = 2; i <= limit; i++)` loop finishes.
 * 3. Consequently, every other in-flight request on this Node process —
 *    including ones that only need to do trivial synchronous work — must
 *    wait, since the event loop can't service any other phase (timers,
 *    I/O callbacks, microtasks) until this handler returns control by
 *    calling `res.status(200).json(results)`.
 * 4. This is the practical cost of CPU-bound work in Node: it doesn't
 *    parallelize across requests the way I/O-bound work does. Fixing it
 *    would require moving the computation off the main thread (e.g. a
 *    worker_thread) or yielding periodically (e.g. chunking the loop with
 *    `setImmediate`) so the event loop gets a chance to run other phases.
 */
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

/**
 * Validates `req.query.input` as a plausible age (a number in [0, 150]) and
 * responds with a `Result<{ input: number }, string>` JSON body:
 * - `{ ok: false, error }` when the input isn't a number or falls outside
 *   the valid range.
 * - `{ ok: true, value: { input } }` otherwise, with the validated number
 *   wrapped via `mapResult` rather than returned bare.
 *
 * Always responds with HTTP 200 — validation failure is communicated through
 * the `ok` flag in the body, not the status code.
 */
const genericConstrain = (req: Request, res: Response) => {
  const n = Number(req.query.input);

  const result: Result<number, string> = isNaN(n)
    ? { ok: false, error: `"${req.query.input}" is not a number` }
    : n < 0 || n > 150
      ? { ok: false, error: `${n} is not a plausible age` }
      : { ok: true, value: n };

  return res.status(200).json(mapResult(result, (value) => ({ input: value })));
};

export const ExerciseController = {
  getNodeEventLoop,
  getCpuHeavy,
  genericConstrain,
};
