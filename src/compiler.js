/**
 * Swatch Compiler Orchestrator
 *
 * This module coordinates the four phases of the Swatch compiler:
 * 1. Parsing (Ohm)
 * 2. Semantic Analysis (Static Checking)
 * 3. Optimization (AST Transformations)
 * 4. Code Generation (SVG)
 */

import parse from "./parser.js";
import analyze from "./analyzer.js";
import optimize from "./optimizer.js";
import generate from "./generator.js";

/**
 * Compiles Swatch source code into the requested output format.
 * @param {string} source The raw script content.
 * @param {string} outputType The desired target ('parsed', 'analyzed', 'optimized', 'svg').
 * @returns {string|object} The resulting compiler artifact.
 * @throws {Error} If any phase of compilation fails.
 */
export default function compile(source, outputType) {
  const allowedTypes = ["parsed", "analyzed", "optimized", "svg"];
  if (!allowedTypes.includes(outputType)) {
    throw new Error(
      `Unknown output type: ${outputType}. Allowed: ${allowedTypes.join(", ")}`,
    );
  }

  // Phase 1: Syntactic Analysis
  const match = parse(source);
  if (outputType === "parsed") return "Syntax is ok";

  // Phase 2: Semantic Analysis
  const analyzed = analyze(match);
  if (outputType === "analyzed") return analyzed;

  // Phase 3: Optimization
  const optimized = optimize(analyzed);
  if (outputType === "optimized") return optimized;

  // Phase 4: Code Generation
  return generate(optimized);
}
