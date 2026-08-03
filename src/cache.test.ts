import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cache } from "./cache";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("cache", () => {
  it("returns undefined for a key that was never set", () => {
    assert.equal(cache.get("missing-key"), undefined);
  });

  it("stores and retrieves a value before its TTL expires", () => {
    cache.set("roundtrip-key", { hello: "world" }, 1000);

    assert.deepEqual(cache.get("roundtrip-key"), { hello: "world" });
  });

  it("expires a value once its TTL has passed", async () => {
    cache.set("expiring-key", "value", 10);

    await delay(20);

    assert.equal(cache.get("expiring-key"), undefined);
  });

  it("removes a value on invalidate", () => {
    cache.set("invalidate-key", "value", 1000);
    cache.invalidate("invalidate-key");

    assert.equal(cache.get("invalidate-key"), undefined);
  });

  it("dumps every live entry with its remaining TTL", () => {
    cache.set("dump-key", "value", 1000);

    const entry = cache.debugDump().find((e) => e.key === "dump-key");

    assert.ok(entry);
    assert.equal(entry.value, "value");
    assert.ok(entry.msRemaining > 0 && entry.msRemaining <= 1000);
  });
});
