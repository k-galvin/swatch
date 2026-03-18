import { describe, it } from "node:test";
import assert from "node:assert/strict";
import parse from "../src/parser.js";

const syntaxChecks = [
  ["minimal layout", "Layout L1 size [100, 100] { }"],
  [
    "full metadata",
    'Designer "Kate" Date "2026-03-17" Layout L1 size [100, 100] { }',
  ],
  [
    "multiple items",
    "Layout L1 size [500, 500] { Wall W1 from [0, 0] to [10, 10] place C1 at [5, 5] }",
  ],
  [
    "underscores",
    "Layout Room_One size [100, 100] { Wall Wall_A from [0, 0] to [5, 5] }",
  ],
  ["comments", "Layout L1 size [100, 100] { // comment \n }"],
  ["matches layout with spaces", 'Layout "Main Gallery" size [100, 100] { }'],
];

const syntaxErrors = [
  ["missing name", "Layout size [100, 100] { }", /Expected not a keyword/],
  ["malformed coordinate", "Layout L1 size [100,] { }", /Expected a digit/],

  [
    "unclosed bracket",
    "Layout L1 size [100, 100] { Wall W from [0,0 to [1,1] }",
    /Expected "\]"/,
  ],
  ["bad keyword", "Room L1 size [100, 100] { }", /Expected "Layout"/],
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
      assert.throws(() => parse(source), errorMessagePattern);
    });
  }
});
