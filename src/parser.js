/**
 * Swatch Parser Phase
 *
 * This module loads the Ohm grammar definition and performs the initial
 * syntactic analysis. It produces a concrete match object that serves
 * as the input for the semantic analyzer.
 */

import fs from "node:fs";
import * as ohm from "ohm-js";

const grammar = ohm.grammar(fs.readFileSync("src/swatch.ohm", "utf-8"));

/**
 * Parses Swatch source code against the Ohm grammar.
 * @param {string} sourceCode The raw script content.
 * @returns {object} An Ohm Match object.
 * @throws {Error} If the source code contains syntax errors.
 */
export default function parse(sourceCode) {
  const match = grammar.match(sourceCode);
  if (match.failed()) {
    throw new Error(match.message);
  }
  return match;
}
