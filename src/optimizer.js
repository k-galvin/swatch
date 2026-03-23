import * as core from "./core.js";

export default function optimize(node) {
  if (!node || typeof node !== "object" || !node.kind) return node;

  switch (node.kind) {
    case "Program":
      node.statements = node.statements
        .flatMap(optimize)
        .filter((s) => s !== null);
      break;
    case "VariableDeclaration":
      node.initializer = optimize(node.initializer);
      return node;
    case "Layout":
      node.size = node.size.map(optimize);
      node.body = node.body.flatMap(optimize).filter((s) => s !== null);
      break;
    case "Component":
      node.body = node.body.flatMap(optimize).filter((s) => s !== null);
      break;
    case "Wall":
      node.from = node.from.map(optimize);
      node.to = node.to.map(optimize);
      for (let k in node.props) node.props[k] = optimize(node.props[k]);
      break;
    case "Furniture":
      node.at = node.at.map(optimize);
      for (let k in node.props) node.props[k] = optimize(node.props[k]);
      break;
    case "Assignment":
      node.target = optimize(node.target);
      node.source = optimize(node.source);
      if (node.target === node.source) return null;
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
        .filter((s) => s !== null);
      node.alternate = node.alternate
        .flatMap(optimize)
        .filter((s) => s !== null);
      break;
    case "RepeatStatement":
      node.count = optimize(node.count);
      if (node.count.kind === "IntLiteral" && node.count.value === 0n)
        return null;
      node.body = node.body.flatMap(optimize).filter((s) => s !== null);
      break;
    case "ForRangeStatement":
      node.low = optimize(node.low);
      node.high = optimize(node.high);
      if (
        node.low.kind === "IntLiteral" &&
        node.high.kind === "IntLiteral" &&
        node.low.value === node.high.value
      )
        return null;
      node.body = node.body.flatMap(optimize).filter((s) => s !== null);
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
        node.left.kind &&
        node.left.kind.includes("Literal") &&
        node.right.kind &&
        node.right.kind.includes("Literal")
      ) {
        const [l, r] = [node.left.value, node.right.value];
        if (node.op === "+")
          return typeof l === "string" || typeof r === "string"
            ? core.stringLiteral(String(l) + String(r))
            : core.floatLiteral(Number(l) + Number(r));
        if (node.op === "-") return core.floatLiteral(Number(l) - Number(r));
        if (node.op === "*") return core.floatLiteral(Number(l) * Number(r));
        if (node.op === "/") return core.floatLiteral(Number(l) / Number(r));
        if (node.op === "**")
          return core.floatLiteral(Math.pow(Number(l), Number(r)));
        if (node.op === "<") return core.booleanLiteral(l < r);
        if (node.op === "<=") return core.booleanLiteral(l <= r);
        if (node.op === "==") return core.booleanLiteral(l === r);
        if (node.op === "!=") return core.booleanLiteral(l !== r);
        if (node.op === ">=") return core.booleanLiteral(l >= r);
        if (node.op === ">") return core.booleanLiteral(l > r);
        if (node.op === "&&") return core.booleanLiteral(l && r);
        if (node.op === "||") return core.booleanLiteral(l || r);
      }
      break;
    case "UnaryExpression":
      node.operand = optimize(node.operand);
      if (node.operand.kind && node.operand.kind.includes("Literal")) {
        const v = node.operand.value;
        if (node.op === "-") return core.floatLiteral(-Number(v));
        if (node.op === "!") return core.booleanLiteral(!v);
      }
      break;
    case "Call":
      node.args = node.args.map(optimize);
      break;
  }
  return node;
}
