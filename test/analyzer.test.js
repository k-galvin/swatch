import { describe, it } from "node:test";
import assert from "node:assert/strict";
import parse from "../src/parser.js";
import analyze from "../src/analyzer.js";

const semanticChecks = [
  ["variable declarations", "let x = 10 const y = #ff0000"],
  [
    "complex layout",
    'Layout "L1" size [100, 100] { Wall W from [0,0] to [10,10] }',
  ],
  ["arithmetic", "let z = (5 + 5) * 2 / 3 % 4 ** 5 - 1"],
  ["logical ops", "let b = true || false && !true"],
  ["comparisons", "let c = 5 < 10 == true != (3 >= 2) let d = 1 > 0"],
  [
    "repeat loop",
    "Layout L size [10, 10] { repeat 5 { place Chair at [0,0] } }",
  ],
  [
    "range loop",
    "Layout L size [10, 10] { for i in 1...10 { place Table at [i, i] } }",
  ],
  [
    "component and call",
    "component W(x: number) { Wall W1 from [0,0] to [x,x] } Layout L size [10,10] { W(5) }",
  ],
  ["conditional", "let x = true ? 1 : 0"],
  ["assignment", "let x = 1 Layout L size [10,10] { x = 2 }"],
  ["all types", 'let s = "hi" let c = #abc let b = false let n = 1.0'],
  ["metadata", 'Designer "Kate" Date "2026-03-18" Layout L size [0,0] {}'],
  ["id expression", "let x = 1 let y = x"],
  [
    "call in expression",
    "component F(x: number) { } Layout L size [1,1] { let y = F(5) }",
  ],
  ["string concatenation", 'let s = "hello " + "world"'],
  ["numeric addition", "let n = 1 + 2"],
  ["unary logical not", "let b = !true"],
];

const semanticErrors = [
  ["redeclared id", "let x = 1 let x = 2", /Identifier x already declared/],
  ["undeclared id", "x = 1", /Identifier x not declared/],
  [
    "type mismatch assignment",
    "let x = 1 x = true",
    /Cannot assign a boolean to a int/,
  ],
  ["non-numeric repeat", 'repeat "5" {}', /Expected a number/],
  ["non-boolean conditional", "let x = 1 ? 2 : 3", /Expected a boolean/],
  [
    "duplicate layout",
    "Layout L size [0,0] {} Layout L size [0,0] {}",
    /Identifier L already declared/,
  ],
  [
    "mismatched binary types",
    "let x = 1 + true",
    /Operands do not have the same type/,
  ],
  ["mismatched logical types", "let x = true && 1", /Expected a boolean/],
  ["unary type mismatch", "let x = -true", /Expected a number/],
  ["unary logical mismatch", "let x = !1", /Expected a boolean/],
  ["call non-existent function", "f()", /Identifier f not declared/],
  [
    "redeclared param",
    "component C(x: number, x: number) {}",
    /Identifier x already declared/,
  ],
];

describe("The analyzer", () => {
  for (const [scenario, source] of semanticChecks) {
    it(`recognizes ${scenario}`, () => {
      assert.ok(analyze(parse(source)));
    });
  }
  for (const [scenario, source, errorMessagePattern] of semanticErrors) {
    it(`throws on ${scenario}`, () => {
      assert.throws(() => analyze(parse(source)), errorMessagePattern);
    });
  }
});
