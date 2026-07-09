import fs from "fs";
import path from "path";
import { Request, Response } from "express";
import { mapResult } from "../helpers/result.helper";
import { Result } from "../types/result";

const STORAGE_DIR = path.join(__dirname, "..", "..", "storage");

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

/**
 * Copies a file the naive way: reads the entire file into a single in-memory
 * Buffer, then writes that whole Buffer back out.
 *
 * `fs.readFileSync`/`fs.writeFileSync` issue their syscalls directly on the
 * main thread — unlike the async fs APIs, they are NOT offloaded to libuv's
 * threadpool. That makes this synchronous and event-loop-blocking for the
 * entire duration of both the read and the write, exactly like `isPrimeSync`
 * above. Memory use also scales with file size: the whole file must fit in
 * the process's heap as one Buffer before a single byte is written out,
 * which caps out entirely for files larger than available memory (or
 * Node's ~2GB Buffer size limit on 32-bit builds).
 */
const copyBuffered = (inputPath: string, outputPath: string): number => {
  const start = Date.now();
  const data = fs.readFileSync(inputPath);
  fs.writeFileSync(outputPath, data);
  return Date.now() - start;
};

/**
 * Copies a file via streams: `.pipe()` reads fixed-size chunks
 * (default `highWaterMark` of 64KB) from a readable stream and writes each
 * chunk to a writable stream as it arrives.
 *
 * This stays non-blocking because the underlying `fs` stream implementation
 * uses the async fs APIs, whose actual disk I/O is offloaded to libuv's
 * threadpool; only the small, fast "chunk is ready" callback runs on the
 * main thread, so the event loop is free to service other requests between
 * chunks. Memory use is bounded by the chunk size, not the file size — a
 * 10GB file costs the same handful of KB in memory as a 10MB one.
 * `.pipe()` also applies backpressure automatically: if the writable side
 * falls behind, it pauses the readable side until the write buffer drains,
 * so a slow destination can't cause unbounded memory growth.
 */
const copyStreamed = (inputPath: string, outputPath: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const readStream = fs.createReadStream(inputPath);
    const writeStream = fs.createWriteStream(outputPath);

    readStream.on("error", reject);
    writeStream.on("error", reject);
    writeStream.on("finish", () => resolve(Date.now() - start));

    readStream.pipe(writeStream);
  });
};

/**
 * Copies `storage/big-file.txt` twice — once with `copyBuffered`, once with
 * `copyStreamed` — and returns how long each approach took, so the
 * event-loop-blocking cost of the naive buffered approach can be observed
 * directly against the non-blocking streamed approach.
 */
const getFileIo = async (req: Request, res: Response) => {
  const inputPath = path.join(STORAGE_DIR, "big-file.txt");

  if (!fs.existsSync(inputPath)) {
    return res
      .status(404)
      .json({ ok: false, error: `${inputPath} does not exist` });
  }

  const bufferedDurationMs = copyBuffered(
    inputPath,
    path.join(STORAGE_DIR, "big-file.buffered-copy.txt"),
  );
  const streamedDurationMs = await copyStreamed(
    inputPath,
    path.join(STORAGE_DIR, "big-file.streamed-copy.txt"),
  );

  const results = { bufferedDurationMs, streamedDurationMs };

  console.log(results);

  res.status(200).json(results);
};

export const ExerciseController = {
  getNodeEventLoop,
  getCpuHeavy,
  genericConstrain,
  getFileIo,
};
