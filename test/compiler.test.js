import { describe, it } from "node:test";
import assert from "node:assert/strict";
import compile from "../src/compiler.js";

// A standard "perfect" Swatch program for testing the pipeline
const sample = `
  Designer "Test" Date "2026-03-17" 
  Layout "L1" size [100, 100] {
    let thickness = 5;
    Wall w1 from [0, 0] to [100, 0] [thickness: thickness];
    place Chair at [50, 50];
  }
`;

describe("The Compiler", () => {
  // --- Interface Tests ---

  it("throws on unknown output type", () => {
    assert.throws(() => compile(sample, "pdf"), /Unknown output type/);
  });

  it("handles empty input or syntax errors gracefully", () => {
    assert.throws(() => compile("Layout {", "svg"), /Expected/);
  });

  // --- Pipeline Stage Tests ---

  it("accepts 'parsed' option (Syntax Check)", () => {
    assert.strictEqual(compile(sample, "parsed"), "Syntax is ok");
  });

  it("accepts 'analyzed' option (Semantic Check)", () => {
    const result = compile(sample, "analyzed");
    // We check that the analyzer produced a valid AST root
    assert.strictEqual(result.kind, "Program");
    assert.ok(Array.isArray(result.statements));
  });

  it("accepts 'optimized' option (Constant Folding Check)", () => {
    const result = compile(sample, "optimized");
    assert.strictEqual(result.kind, "Program");
    // Verify that the optimizer is present and didn't crash
    assert.ok(result.statements.length > 0);
  });

  it("accepts 'svg' option (Code Generation Check)", () => {
    const result = compile(sample, "svg");
    // Basic verification of SVG structure
    assert.ok(result.includes("<svg"));
    assert.ok(result.includes("Designer: Test"));
    assert.ok(result.includes("</svg>"));
  });

  // --- Swatch Specific Integration ---

  it("integrates math and design correctly", () => {
    const mathSource = `Layout "M" size [100 + 100, 200] { Wall w from [0,0] to [10 * 10, 0]; }`;
    const output = compile(mathSource, "svg");
    // Verify that the optimizer and generator resolved 10*10 to 100
    assert.match(output, /x2="100"/);
    // Verify layout size resolved 100+100 to 200
    assert.match(output, /width="200"/);
  });

  it("handles optional metadata branch", () => {
    // Ensuring the compiler doesn't crash if Metadata is missing
    const source = "Layout L1 size [100, 100] { }";
    const output = compile(source, "svg");
    assert.ok(output.includes("<svg"));
  });
});
