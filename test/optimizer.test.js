import { describe, it } from "node:test";
import assert from "node:assert/strict";
import optimize from "../src/optimizer.js";

describe("The Optimizer", () => {
  it("passes the node through", () => {
    const node = { kind: "Test" };
    assert.deepEqual(optimize(node), node);
  });
});
