import fs from "node:fs";
import * as ohm from "ohm-js";

const grammar = ohm.grammar(fs.readFileSync("src/swatch.ohm", "utf-8"));

export default function parse(sourceCode) {
  const match = grammar.match(sourceCode);
  if (match.failed()) {
    throw new Error(match.message);
  }
  return match;
}
