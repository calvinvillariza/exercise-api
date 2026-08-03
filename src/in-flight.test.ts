import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Inflight } from "./in-flight";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Inflight.coalesce", () => {
  it("shares a single in-flight call across concurrent requests for the same key", async () => {
    let callCount = 0;
    const fn = async () => {
      callCount++;
      await delay(20);
      return "result";
    };

    const [a, b, c] = await Promise.all([
      Inflight.coalesce("shared-key", fn),
      Inflight.coalesce("shared-key", fn),
      Inflight.coalesce("shared-key", fn),
    ]);

    assert.equal(callCount, 1);
    assert.deepEqual([a, b, c], ["result", "result", "result"]);
  });

  it("starts a fresh call for the same key once the previous one has settled", async () => {
    let callCount = 0;
    const fn = async () => {
      callCount++;
      return callCount;
    };

    const first = await Inflight.coalesce("sequential-key", fn);
    const second = await Inflight.coalesce("sequential-key", fn);

    assert.equal(first, 1);
    assert.equal(second, 2);
  });
});
