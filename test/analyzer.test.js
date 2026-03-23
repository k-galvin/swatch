import { describe, it } from "node:test";
import assert from "node:assert/strict";
import parse from "../src/parser.js";
import analyze from "../src/analyzer.js";

const semanticChecks = [
  ["variables can be printed", "let x = 1; print(x);"],
  ["variables can be reassigned", "let x = 1; x = x + 1;"],
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
  ["string concatenation", 'let x = "a" + "b"; let y = "a" + 5; let z = 5 + "b";'],
  ["empty array literal", "let x = [];"],
  ["array type declaration", "let x: [float] = [1.0];"],
  ["optional type equivalence", "let x: float? = 1.0; let y: float? = 2.0; let z = x == y;"],
  ["component call in expression", "component C() {} let x = C();"],
  ["print call in expression", "let x = print(1);"],
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
  ["non-numeric repeat count", 'repeat "5" { }', /Expected a number/],
  [
    "binary operator type mismatch",
    "let x = 1 + true;",
    /Operands do not have the same type/,
  ],
  ["unary operator type mismatch", "let x = -true;", /Expected a number/],
  ["out of loop break", "break;", /Break can only appear in a loop/],
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
