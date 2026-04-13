import { describe, it } from "node:test";
import assert from "node:assert/strict";
import parse from "../src/parser.js";

const syntaxChecks = [
  ["simplest layout", 'Layout "L1" size [100, 100] {}'],
  [
    "metadata and layout",
    'Designer "Kate" Date "2026-03-18" Layout L1 size [10, 10] {}',
  ],
  ["variable declarations", "let x = 10; const y = #ff0000;"],
  ["arithmetic expressions", "let z = (x + 5) * 2 / 3 ** 4;"],
  ["logical expressions", "let b = true || false && !true;"],
  ["comparisons", "let c = 5 < 10 == true;"],
  ["conditional expression", "let d = x > 5 ? 1 : 0;"],
  ["coalesce expression", "let e = x ?? 5;"],
  [
    "repeat loop",
    "Layout L size [100, 100] { repeat 5 { place Chair at [0, 0]; } }",
  ],
  [
    "range loop",
    "Layout L size [100, 100] { for i in 1...10 { place Table at [i, i]; } }",
  ],
  ["while loop", "Layout L size [100, 100] { while x < 10 { x = x + 1; } }"],
  [
    "collection loop",
    "Layout L size [100, 100] { for x in [1, 2, 3] { place Chair at [x, x]; } }",
  ],
  ["break statement", "Layout L size [100, 100] { while true { break; } }"],
  ["in operator", "let b = 1 in [1, 2, 3];"],
  [
    "component declaration",
    "component Window(w: number, h: number) { Wall W from [0,0] to [w,h]; }",
  ],
  ["function call in expressions", "let x = f(1, 2) + g();"],
  ["assignment in layout", "Layout L size [10, 10] { x = x + 1; }"],
  ["bump statements", "Layout L size [10, 10] { x++; y--; }"],
  ["complex property", 'place Desk at [0, 0] [color: #aabbcc, label: "Work"];'],
  ["hex colors", "let c = #abc; let d = #112233;"],
  ["comments", "// a comment\nLayout L size [0,0] {} // end"],
  ["array literals", "let a = [1, 2, 3];"],
  ["optional types", "let x: number? = 5;"],
];

const syntaxErrors = [
  ["unclosed layout", "Layout L size [10, 10] {", /Line 1, col 25:/],
  ["missing size keyword", "Layout L [10, 10] { }", /Expected "size"/],
  ["invalid id start", "let 1x = 5;", /Line 1, col 5:/],
  ["missing semicolon", "let x = 5 let y = 10;", /Expected ";"/],
  ["unbalanced parens", "let x = (1 + 2;", /Line 1, col 15:/],
  ["keyword as id", "let place = 5;", /Line 1, col 5:/],
  ["empty props", "place X at [0,0] [];", /Line 1, col 19:/],
  ["missing type in param", "component C(x) {}", /Line 1, col 14:/],
];

describe("The Parser", () => {
  for (const [scenario, source] of syntaxChecks) {
    it(`matches ${scenario}`, () => {
      const match = parse(source);
      assert.ok(match.succeeded());
    });
  }
  for (const [scenario, source, errorMessagePattern] of syntaxErrors) {
    it(`throws on ${scenario}`, () => {
      // We check that the specific Ohm error message is thrown
      assert.throws(() => parse(source), errorMessagePattern);
    });
  }
});
