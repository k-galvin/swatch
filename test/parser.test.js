import { describe, it } from "node:test";
import assert from "node:assert/strict";
import parse from "../src/parser.js";

const syntaxChecks = [
  ["simplest layout", 'Layout "L1" size [100, 100] {}'],
  [
    "metadata and layout",
    'Designer "Kate" Date "2026-03-18" Layout L1 size [10, 10] {}',
  ],
  ["variable declarations", "let x = 10 const y = #ff0000"],
  ["arithmetic expressions", "let z = (x + 5) * 2 / 3 ** 4"],
  ["logical expressions", "let b = true || false && !true"],
  ["comparisons", "let c = 5 < 10 == true"],
  ["conditional expression", "let d = x > 5 ? 1 : 0"],
  [
    "repeat loop",
    "Layout L size [100, 100] { repeat 5 { place Chair at [0, 0] } }",
  ],
  [
    "range loop",
    "Layout L size [100, 100] { for i in 1...10 { place Table at [i, i] } }",
  ],
  [
    "component declaration",
    "component Window(w: number, h: number) { Wall W from [0,0] to [w,h] }",
  ],
  ["function call in expressions", "let x = f(1, 2) + g()"],
  ["assignment in layout", "Layout L size [10, 10] { x = x + 1 }"],
  ["complex property", 'place Desk at [0, 0] [color: #aabbcc, label: "Work"]'],
  ["hex colors", "let c = #abc let d = #112233"],
  ["comments", "// a comment\nLayout L size [0,0] {} // end"],
];

const syntaxErrors = [
  ["unclosed layout", "Layout L size [10, 10] {", /Line 1, col 25:/],
  ["missing size", "Layout L { }", /Line 1, col 10:/],
  ["invalid id", "let 1x = 5", /Line 1, col 5:/],
  ["malformed number", "let x = 2.", /Line 1, col 11:/],
  ["unbalanced parens", "let x = (1 + 2", /Line 1, col 15:/],
  ["keyword as id", "let place = 5", /Line 1, col 5:/],
  ["empty props", "place X at [0,0] []", /Line 1, col 19:/],
  ["missing type in param", "component C(x) {}", /Line 1, col 14:/],
];

describe("The parser", () => {
  for (const [scenario, source] of syntaxChecks) {
    it(`matches ${scenario}`, () => {
      assert.ok(parse(source).succeeded());
    });
  }
  for (const [scenario, source, errorMessagePattern] of syntaxErrors) {
    it(`throws on ${scenario}`, () => {
      assert.throws(() => parse(source), errorMessagePattern);
    });
  }
});
