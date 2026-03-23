import parse from "./parser.js";
import analyze from "./analyzer.js";
import optimize from "./optimizer.js";
import generate from "./generator.js";

export default function compile(source, outputType) {
  // 1. Validation of output target
  const allowedTypes = ["parsed", "analyzed", "optimized", "svg"];
  if (!allowedTypes.includes(outputType)) {
    throw new Error(
      `Unknown output type: ${outputType}. Allowed: ${allowedTypes.join(", ")}`,
    );
  }

  // 2. Parsing Phase
  const match = parse(source);
  if (outputType === "parsed") return "Syntax is ok";

  // 3. Semantic Analysis Phase
  // This turns the Ohm Match into a decorated AST.
  const analyzed = analyze(match);
  if (outputType === "analyzed") return analyzed;

  // 4. Optimization Phase
  // Performs constant folding and dead code elimination.
  const optimized = optimize(analyzed);
  if (outputType === "optimized") return optimized;

  // 5. Code Generation Phase
  // Final transformation into the SVG blueprint.
  return generate(optimized);
}
