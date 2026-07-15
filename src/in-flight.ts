const inFlight = new Map<string, Promise<unknown>>();

/**
 * Request coalescing (a.k.a. single-flight): if `fn` is already running for
 * `key`, callers piggyback on that same in-flight promise instead of
 * triggering a duplicate call. This is what prevents a "thundering herd" of
 * concurrent cache misses on the same key from each hitting the DB — see
 * `getProduct` in `exercise.controller.ts` for the caller-side example.
 *
 * The map entry is removed as soon as `fn` settles (success or failure), so
 * the next call for `key` — whether concurrent or later — always starts a
 * fresh call rather than replaying a stale result.
 */
const coalesce = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
  if (inFlight.has(key)) {
    return inFlight.get(key) as Promise<T>;
  }

  const promise = fn().finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, promise);

  return promise;
};

export const Inflight = {
  coalesce,
};
