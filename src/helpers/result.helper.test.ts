import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapResult } from "./result.helper";

describe("mapResult", () => {
  it("applies fn to the value of an ok result", () => {
    const result = mapResult({ ok: true, value: 2 }, (n) => n * 10);

    assert.deepEqual(result, { ok: true, value: 20 });
  });

  it("passes through an error result unchanged", () => {
    const errorResult = { ok: false as const, error: "bad input" };
    const result = mapResult(errorResult, (n: number) => n * 10);

    assert.deepEqual(result, errorResult);
  });
});
