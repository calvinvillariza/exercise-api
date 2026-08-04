import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "./app";

describe("GET /", () => {
  it("renders the README as HTML", async () => {
    const res = await request(app).get("/");

    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /html/);
    assert.match(res.text, /<h1[^>]*>exercise-api<\/h1>/);
  });
});

describe("GET /healthz", () => {
  it("reports ok status", async () => {
    const res = await request(app).get("/healthz");

    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
    assert.equal(typeof res.body.uptime, "number");
  });
});

describe("GET /api/exercise/generic-constrain", () => {
  it("accepts a value inside [0, 150]", async () => {
    const res = await request(app).get(
      "/api/exercise/generic-constrain?input=42",
    );

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true, value: { input: 42 } });
  });

  it("rejects a value outside [0, 150]", async () => {
    const res = await request(app).get(
      "/api/exercise/generic-constrain?input=200",
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, false);
  });

  it("rejects a non-numeric value", async () => {
    const res = await request(app).get(
      "/api/exercise/generic-constrain?input=abc",
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, false);
  });
});

describe("unknown routes", () => {
  it("responds with a 404 JSON body", async () => {
    const res = await request(app).get("/nope");

    assert.equal(res.status, 404);
    assert.equal(res.body.message, "Not found");
  });
});

describe("GET /api/exercise/products/:id cache-aside", () => {
  it("misses the cache on the first call, then hits it on the next", async () => {
    // Use an id unlikely to have been cached by another test in this run.
    const id = 2;

    const first = await request(app).get(`/api/exercise/products/${id}`);
    assert.equal(first.status, 200);
    assert.equal(first.body.source, "db");

    const second = await request(app).get(`/api/exercise/products/${id}`);
    assert.equal(second.status, 200);
    assert.equal(second.body.source, "cache");
  });
});
