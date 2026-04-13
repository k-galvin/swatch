import { describe, it } from "node:test";
import assert from "node:assert/strict";
import parse from "../src/parser.js";
import analyze from "../src/analyzer.js";

const semanticChecks = [
  ["variables can be printed", "let x = 1; print(x);"],
  ["variables can be reassigned", "let x = 1; x = x + 1;"],
  ["variables can be bumped", "let x = 1; x++; x--;"],
  [
    "all numeric types are float-compatible",
    "let x = 1; let y = 2.5; let z = x + y;",
  ],
  [
    "walls use points and props",
    "Wall w from [0,0] to [10,10] [thickness: 5];",
  ],
  ["place uses points and props", "place Chair at [5,5] [color: #FF0000];"],
  ["conditionals work", "if (true) { let x = 1; } else { let x = 2; }"],
  ["loops work", "repeat 5 { let x = 1; }"],
  ["range loops work", "for i in 0 ... 10 { print(i); }"],
  ["collection loops work", "for x in [1, 2, 3] { print(x); }"],
  ["in operator works", "let b = 1 in [1, 2, 3];"],
  ["while loops work", "let x = 0; while x < 10 { x = x + 1; }"],
  ["break in while loops work", "while true { break; }"],
  ["arrays work", "let a = [1, 2, 3];"],
  ["hex colors work", "let c = #AABBCC;"],
  ["ternary operators work", "let x = true ? 1 : 2;"],
  ["metadata is optional", 'Designer "Alice" Date "2026-03-23" let x = 1;'],
  ["false literal works", "let x = false;"],
  [
    "function call in expressions works",
    "component f(x: float) { print(x); } let y = f(1.0);",
  ],
  ["optional types work", "let x: float? = 1.0;"],
  ["array length works", "let x = #[1, 2, 3];"],
  ["random works", "let x = random [1, 2, 3];"],
  ["any type assignment", 'let x: any = 5; x = "hello";'],
  ["coalesce works", "let x: float? = 1.0; let y = x ?? 2.0;"],
  [
    "string concatenation",
    'let x = "a" + "b"; let y = "a" + 5; let z = 5 + "b";',
  ],
  ["empty array literal", "let x = [];"],
  ["array type declaration", "let x: [float] = [1.0];"],
  [
    "optional type equivalence",
    "let x: float? = 1.0; let y: float? = 2.0; let z = x == y;",
  ],
  [
    "array type equivalence",
    "let x: [float] = [1.0]; let y: [float] = [2.0]; let z = x == y;",
  ],
  ["component call in expression", "component C() {} let x = C();"],
  ["print call in expression", "let x = print(1);"],
  [
    "unary minus on variable in bounds check",
    "Layout L size [100, 100] { let x = 10; place Chair at [-x, 50]; }",
  ],
  [
    "integrated furniture with variable type",
    'Layout L size [100, 100] { let sinkVar = "Table"; Wall w from [0, 50] to [100, 50]; place sinkVar at [50, 50]; }',
  ],
  [
    "place over integrated",
    "Layout L size [100, 100] { place Sink at [50, 50]; Wall w from [0, 50] to [100, 50]; }",
  ],
  [
    "various integrated types",
    "Layout L size [1000, 1000] { place Faucet at [100, 100]; place TV at [200, 200]; place Node at [300, 300]; place Bench at [400, 400]; place Dot at [500, 500]; place Pillar at [600, 600]; place Post at [700, 700]; place Section at [800, 800]; }",
  ],
  ["terminal coverage", "print(π);"],
];

const semanticErrors = [
  ["using undeclared variables", "print(y);", /Identifier y not declared/],
  [
    "redeclaring variables",
    "let x = 1; let x = 2;",
    /Identifier x already declared/,
  ],
  [
    "assigning to constants",
    "const x = 1; x = 2;",
    /Cannot assign to a constant/,
  ],
  [
    "assigning wrong types",
    'let x = 1; x = "hello";',
    /Cannot assign a string to a int/,
  ],
  ["non-boolean if test", "if (1) { }", /Expected a boolean/],
  ["non-boolean while test", "while (1) { }", /Expected a boolean/],
  ["non-numeric repeat count", 'repeat "5" { }', /Expected a number/],
  ["bump non-numeric", 'let x = "a"; x++;', /Expected a number/],
  ["bump constant", "const x = 1; x++;", /Cannot bump a constant/],
  ["non-array collection loop", "for x in 1 { }", /Expected an array/],
  [
    "in operator non-array",
    "let b = 1 in 2;",
    /The 'in' operator requires an array/,
  ],
  [
    "in operator type mismatch",
    'let b = 1 in ["a"];',
    /Cannot check if a int is in a \[string\]/,
  ],
  [
    "coalesce non-optional",
    "let x = 1; let y = x ?? 2;",
    /Coalesce operator requires an optional left operand/,
  ],
  [
    "coalesce type mismatch",
    'let x: float? = 1.0; let y = x ?? "a";',
    /Cannot coalesce a float\? with a string/,
  ],
  [
    "binary operator type mismatch",
    "let x = 1 + true;",
    /Operands do not have the same type/,
  ],
  [
    "array type mismatch",
    'let x: [float] = [1.0]; let y: [string] = ["a"]; let z = x == y;',
    /Operands do not have the same type/,
  ],
  [
    "optional type mismatch",
    'let x: float? = 1.0; let y: string? = "a"; let z = x == y;',
    /Operands do not have the same type/,
  ],
  ["unary operator type mismatch", "let x = -true;", /Expected a number/],
  ["out of loop break", "break;", /Break can only appear in a loop/],
  [
    "X coordinate out of bounds",
    "Layout L size [100, 100] { place Chair at [150, 50]; }",
    /X coordinate 150 \(with radius 20\) out of layout bounds/,
  ],
  [
    "Y coordinate out of bounds",
    "Layout L size [100, 100] { Wall w from [0, 0] to [50, 150]; }",
    /Y coordinate 150 \(with radius 0\) out of layout bounds/,
  ],
  [
    "negative coordinate out of bounds",
    "Layout L size [100, 100] { place Chair at [-10, 50]; }",
    /X coordinate -10 \(with radius 20\) out of layout bounds/,
  ],
  [
    "furniture-wall collision",
    "Layout L size [100, 100] { Wall w from [0, 50] to [100, 50]; place Chair at [50, 50]; }",
    /Spatial collision: 'Chair' overlaps with 'w'/,
  ],
  [
    "furniture-wall collision with variable type",
    'Layout L size [100, 100] { let t = "Chair"; Wall w from [0, 50] to [100, 50]; place t at [50, 50]; }',
    /Spatial collision: 't' overlaps with 'w'/,
  ],
  [
    "wall-furniture collision",
    "Layout L size [100, 100] { place Chair at [50, 50]; Wall w from [0, 50] to [100, 50]; }",
    /Spatial collision: 'w' overlaps with 'Chair'/,
  ],
  [
    "wall-furniture collision with variable type",
    'Layout L size [100, 100] { let t = "Chair"; place t at [50, 50]; Wall w from [0, 50] to [100, 50]; }',
    /Spatial collision: 'w' overlaps with 't'/,
  ],
];

describe("The Analyzer", () => {
  for (const [scenario, source] of semanticChecks) {
    it(`correctly analyzes: ${scenario}`, () => {
      assert.doesNotThrow(() => analyze(parse(source)));
    });
  }
  for (const [scenario, source, errorMessage] of semanticErrors) {
    it(`throws on: ${scenario}`, () => {
      assert.throws(() => analyze(parse(source)), errorMessage);
    });
  }
});
