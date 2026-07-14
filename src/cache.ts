/** Simple in-memory TTL cache. Same behavior as Redis for this exercise's purposes. */

const store = new Map();

const get = (key: string) => {
  const entry = store.get(key);

  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);

    return undefined;
  }

  return entry.value;
};

const set = <T>(key: string, value: T, ttlMs: number) => {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
};

const invalidate = (key: string) => {
  store.delete(key);
};

const debugDump = () => {
  const now = Date.now();
  const cache = [...store.entries()].map(([key, entry]) => {
    return {
      key,
      value: entry.value,
      msRemaining: entry.expiresAt - now,
    };
  });

  return cache;
};

export const cache = {
  get,
  set,
  invalidate,
  debugDump,
};
