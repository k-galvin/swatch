import { describe, it } from "node:test";
import assert from "node:assert/strict";
import parse from "../src/parser.js";
import analyze from "../src/analyzer.js";

describe("The Analyzer", () => {
  it("recognizes a valid program with multi-character IDs", () => {
    const source = `
      Designer "Kate" Date "2026-03-17"
      Layout LivingRoom size [500, 500] { 
        Wall ExteriorWall from [0, 0] to [100, 0] [color: #ff0000, thickness: 5]
        place CoffeeTable at [50, 50] 
      }`;
    const result = analyze(parse(source));

    assert.strictEqual(result.layouts[0].name, "LivingRoom");
    assert.strictEqual(result.layouts[0].body[0].name, "ExteriorWall");
    assert.strictEqual(result.metadata.author, "Kate");
  });

  it("handles single-character identifiers and float sizes", () => {
    const source =
      "Layout L size [100.5, 100.5] { Wall W from [0,0] to [1,1] }";
    const result = analyze(parse(source));
    assert.strictEqual(result.layouts[0].name, "L");
    assert.strictEqual(result.layouts[0].size[0], 100.5);
  });

  it("recognizes layout names with spaces (covers string-name slicing)", () => {
    const source = 'Layout "The Master Bedroom" size [500, 500] { }';
    const result = analyze(parse(source));
    assert.strictEqual(result.layouts[0].name, "The Master Bedroom");
  });

  it("handles walls and furniture without optional properties", () => {
    const source =
      'Layout "Empty" size [100, 100] { Wall W from [0,0] to [1,1] place C at [5,5] }';
    const result = analyze(parse(source));
    assert.deepEqual(result.layouts[0].body[0].props, {});
  });

  it("throws on duplicate layout names", () => {
    const source =
      'Layout L1 size [100, 100] { } Layout "L1" size [200, 200] { }';
    assert.throws(() => analyze(parse(source)), /Layout L1 already declared/);
  });

  it("throws when furniture is out of bounds", () => {
    const source = "Layout L1 size [100, 100] { place Chair at [150, 50] }";
    assert.throws(
      () => analyze(parse(source)),
      /Furniture Chair out of bounds/,
    );
  });
});
