import { describe, it } from "node:test";
import assert from "node:assert/strict";
import compile from "../src/compiler.js";

const sample =
  'Designer "Test" Date "2026-03-17" Layout L1 size [100, 100] { }';

describe("The Compiler", () => {
  it("throws on unknown output type", () => {
    assert.throws(() => compile(sample, "pdf"), /Unknown output type/);
  });

  it("accepts 'parsed' option", () => {
    assert.strictEqual(compile(sample, "parsed"), "Syntax is ok");
  });

  it("accepts 'analyzed' option", () => {
    const result = compile(sample, "analyzed");
    assert.strictEqual(result.kind, "Program");
  });

  it("accepts 'optimized' option", () => {
    const result = compile(sample, "optimized");
    assert.strictEqual(result.kind, "Program");
  });

  it("accepts 'svg' option", () => {
    const result = compile(sample, "svg");
    assert.ok(result.startsWith("<svg"));
  });

  it("covers the false branch of the optimized check", () => {
    const source = "Layout L1 size [100, 100] { }";
    const output = compile(source, "svg");
    assert.match(output, /<svg/);
  });
});
