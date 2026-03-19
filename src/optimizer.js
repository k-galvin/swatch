import * as core from "./core.js";

export default function optimize(node) {
  if (!node || typeof node !== "object" || !node.kind) return node;

  switch (node.kind) {
    case "Program":
      node.layouts = node.layouts.map(optimize);
      break;
    case "VariableDeclaration":
      node.initializer = optimize(node.initializer);
      break;
    case "Layout":
      node.size = node.size.map(optimize);
      node.body = node.body.flatMap(optimize).filter((s) => s !== null);
      break;
    case "ComponentDeclaration":
      node.component.body = node.component.body
        .flatMap(optimize)
        .filter((s) => s !== null);
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
      node.consequent = node.consequent
        .flatMap(optimize)
        .filter((s) => s !== null);
      node.alternate = (
        Array.isArray(node.alternate) ? node.alternate : [node.alternate]
      )
        .flatMap(optimize)
        .filter((s) => s !== null);
      if (node.test === true) return node.consequent;
      if (node.test === false) return node.alternate;
      break;
    case "RepeatStatement":
      node.count = optimize(node.count);
      if (node.count === 0n || node.count === 0) return null;
      node.body = node.body.flatMap(optimize).filter((s) => s !== null);
      break;
    case "ForRangeStatement":
      node.low = optimize(node.low);
      node.high = optimize(node.high);
      if (typeof node.low === typeof node.high && node.low === node.high)
        return null;
      node.body = node.body.flatMap(optimize).filter((s) => s !== null);
      break;
    case "Conditional":
      node.test = optimize(node.test);
      node.consequent = optimize(node.consequent);
      node.alternate = optimize(node.alternate);
      if (node.test === true) return node.consequent;
      if (node.test === false) return node.alternate;
      break;
    case "BinaryExpression":
      node.left = optimize(node.left);
      node.right = optimize(node.right);
      const [l, r] = [node.left, node.right];
      if (typeof l === "bigint" && typeof r === "bigint") {
        if (node.op === "+") return l + r;
        if (node.op === "-") return l - r;
        if (node.op === "*") return l * r;
        if (node.op === "/") return l / r;
        if (node.op === "%") return l % r;
        if (node.op === "**") return l ** r;
        if (node.op === "<") return l < r;
        if (node.op === "<=") return l <= r;
        if (node.op === "==") return l === r;
        if (node.op === "!=") return l !== r;
        if (node.op === ">=") return l >= r;
        if (node.op === ">") return l > r;
      }
      if (typeof l === "number" && typeof r === "number") {
        if (node.op === "+") return l + r;
        if (node.op === "-") return l - r;
        if (node.op === "*") return l * r;
        if (node.op === "/") return l / r;
        if (node.op === "%") return l % r;
        if (node.op === "**") return l ** r;
        if (node.op === "<") return l < r;
        if (node.op === "<=") return l <= r;
        if (node.op === "==") return l === r;
        if (node.op === "!=") return l !== r;
        if (node.op === ">=") return l >= r;
        if (node.op === ">") return l > r;
      }
      if (typeof l === "boolean" && typeof r === "boolean") {
        if (node.op === "&&") return l && r;
        if (node.op === "||") return l || r;
        if (node.op === "==") return l === r;
        if (node.op === "!=") return l !== r;
      }
      if (node.op === "+") {
        if (l === 0 || l === 0n) return r;
        if (r === 0 || r === 0n) return l;
      }
      if (node.op === "-") {
        if (r === 0 || r === 0n) return l;
        if (l === r) return 0n;
      }
      if (node.op === "*") {
        if (l === 0 || l === 0n || r === 0 || r === 0n) return 0n;
        if (l === 1 || l === 1n) return r;
        if (r === 1 || r === 1n) return l;
      }
      if (node.op === "/") {
        if (l === 0 || l === 0n) return 0n;
        if (r === 1 || r === 1n) return l;
        if (l === r) return 1n;
      }
      if (node.op === "**") {
        if (r === 0 || r === 0n) return 1n;
        if (r === 1 || r === 1n) return l;
      }
      break;
    case "UnaryExpression":
      node.operand = optimize(node.operand);
      if (
        typeof node.operand === "bigint" ||
        typeof node.operand === "number"
      ) {
        if (node.op === "-") return -node.operand;
      }
      if (typeof node.operand === "boolean") {
        if (node.op === "!") return !node.operand;
      }
      break;
    case "Call":
      node.args = node.args.map(optimize);
      break;
  }
  return node;
}
