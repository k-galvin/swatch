import * as core from "./core.js";

/**
 * Swatch AST Optimizer
 *
 * Performs a series of optimization passes including:
 * - Constant Folding: Evaluates literal expressions at compile time.
 * - Strength Reduction: Simplifies mathematical operations.
 * - Dead Code Elimination: Removes unreachable statements (e.g., if(false)).
 *
 * @param {object} node The AST node to optimize.
 * @returns {object|null} The optimized node, or null if the node is eliminated.
 */
export default function optimize(node) {
  if (!node || typeof node !== "object" || !node.kind) return node;

  switch (node.kind) {
    case "Program":
      node.statements = node.statements
        .flatMap(optimize)
        .filter((statement) => statement !== null);
      break;

    case "VariableDeclaration":
      node.initializer = optimize(node.initializer);
      return node;

    case "Layout":
      node.size = node.size.map(optimize);
      node.body = node.body
        .flatMap(optimize)
        .filter((statement) => statement !== null);
      break;

    case "Component":
      node.body = node.body
        .flatMap(optimize)
        .filter((statement) => statement !== null);
      break;

    case "Wall":
      node.from = node.from.map(optimize);
      node.to = node.to.map(optimize);
      for (const propName in node.props) {
        node.props[propName] = optimize(node.props[propName]);
      }
      break;

    case "Furniture":
      node.at = node.at.map(optimize);
      for (const propName in node.props) {
        node.props[propName] = optimize(node.props[propName]);
      }
      break;

    case "Assignment":
      node.target = optimize(node.target);
      node.source = optimize(node.source);
      if (node.target === node.source) return null;
      break;

    case "BumpStatement":
      node.variable = optimize(node.variable);
      break;

    case "IfStatement":
      node.test = optimize(node.test);
      if (node.test.kind === "BooleanLiteral") {
        return node.test.value
          ? node.consequent.flatMap(optimize)
          : node.alternate.flatMap(optimize);
      }
      node.consequent = node.consequent
        .flatMap(optimize)
        .filter((statement) => statement !== null);
      node.alternate = node.alternate
        .flatMap(optimize)
        .filter((statement) => statement !== null);
      break;

    case "WhileStatement":
      node.test = optimize(node.test);
      if (node.test.kind === "BooleanLiteral" && node.test.value === false) {
        return null;
      }
      node.body = node.body
        .flatMap(optimize)
        .filter((statement) => statement !== null);
      break;

    case "RepeatStatement":
      node.count = optimize(node.count);
      if (node.count.kind === "IntLiteral" && node.count.value === 0n) {
        return null;
      }
      node.body = node.body
        .flatMap(optimize)
        .filter((statement) => statement !== null);
      break;

    case "ForRangeStatement":
      node.low = optimize(node.low);
      node.high = optimize(node.high);
      if (
        node.low.kind === "IntLiteral" &&
        node.high.kind === "IntLiteral" &&
        node.low.value === node.high.value
      ) {
        return null;
      }
      node.body = node.body
        .flatMap(optimize)
        .filter((statement) => statement !== null);
      break;

    case "ForCollectionStatement":
      node.collection = optimize(node.collection);
      node.body = node.body
        .flatMap(optimize)
        .filter((statement) => statement !== null);
      break;

    case "Conditional":
      node.test = optimize(node.test);
      node.consequent = optimize(node.consequent);
      node.alternate = optimize(node.alternate);
      if (node.test.kind === "BooleanLiteral") {
        return node.test.value ? node.consequent : node.alternate;
      }
      break;

    case "BinaryExpression":
      node.left = optimize(node.left);
      node.right = optimize(node.right);
      if (
        node.left.kind?.includes("Literal") &&
        node.right.kind?.includes("Literal")
      ) {
        const leftValue = node.left.value;
        const rightValue = node.right.value;
        if (node.op === "+") {
          return typeof leftValue === "string" || typeof rightValue === "string"
            ? core.stringLiteral(String(leftValue) + String(rightValue))
            : core.floatLiteral(Number(leftValue) + Number(rightValue));
        }
        if (node.op === "-")
          return core.floatLiteral(Number(leftValue) - Number(rightValue));
        if (node.op === "*")
          return core.floatLiteral(Number(leftValue) * Number(rightValue));
        if (node.op === "/")
          return core.floatLiteral(Number(leftValue) / Number(rightValue));
        if (node.op === "**") {
          return core.floatLiteral(
            Math.pow(Number(leftValue), Number(rightValue)),
          );
        }
        if (node.op === "<") return core.booleanLiteral(leftValue < rightValue);
        if (node.op === "<=")
          return core.booleanLiteral(leftValue <= rightValue);
        if (node.op === "==")
          return core.booleanLiteral(leftValue === rightValue);
        if (node.op === "!=")
          return core.booleanLiteral(leftValue !== rightValue);
        if (node.op === ">=")
          return core.booleanLiteral(leftValue >= rightValue);
        if (node.op === ">") return core.booleanLiteral(leftValue > rightValue);
        if (node.op === "&&")
          return core.booleanLiteral(leftValue && rightValue);
        if (node.op === "||")
          return core.booleanLiteral(leftValue || rightValue);
      }
      if (node.op === "in") {
        if (
          node.left.kind?.includes("Literal") &&
          node.right.kind === "ArrayLiteral" &&
          node.right.elements.every((element) =>
            element.kind?.includes("Literal"),
          )
        ) {
          const leftValue = node.left.value;
          const elementValues = node.right.elements.map(
            (element) => element.value,
          );
          return core.booleanLiteral(elementValues.includes(leftValue));
        }
      }
      if (node.op === "??") {
        if (node.left.kind?.includes("Literal")) {
          return node.left;
        }
      }
      break;

    case "UnaryExpression":
      node.operand = optimize(node.operand);
      if (node.operand.kind?.includes("Literal")) {
        const operandValue = node.operand.value;
        if (node.op === "-") return core.floatLiteral(-Number(operandValue));
        if (node.op === "!") return core.booleanLiteral(!operandValue);
      }
      break;

    case "ArrayLiteral":
      node.elements = node.elements.map(optimize);
      break;

    case "Call":
      node.args = node.args.map(optimize);
      break;
  }
  return node;
}
