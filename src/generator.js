export default function generate(program) {
  const svgLines = [];
  let nextId = 1;

  function getTargetName(base) {
    return `${base}_${nextId++}`;
  }

  function evaluate(node, context) {
    if (node === null) return null;
    if (node === undefined) return null;
    if (typeof node === "bigint") return Number(node);
    if (typeof node !== "object") return node;

    switch (node.kind) {
      case "Variable":
        return context.has(node)
          ? evaluate(context.get(node), context)
          : evaluate(node.value, context);
      case "BinaryExpression": {
        const l = evaluate(node.left, context);
        const r = evaluate(node.right, context);
        if (node.op === "+") {
          return typeof l === "string" || typeof r === "string"
            ? String(l) + String(r)
            : Number(l) + Number(r);
        }
        const nl = Number(l);
        const nr = Number(r);
        switch (node.op) {
          case "-":
            return nl - nr;
          case "*":
            return nl * nr;
          case "/":
            return nl / nr;
          case "**":
            return Math.pow(nl, nr);
          case "<":
            return nl < nr;
          case "==":
            return nl === nr;
          case "&&":
            return nl && nr;
          case "||":
            return nl || nr;
          case "%":
            return nl % nr;
          default:
            return 0;
        }
      }
      case "UnaryExpression":
        const v = evaluate(node.operand, context);
        return node.op === "-" ? -Number(v) : !v;
      case "Conditional":
        return evaluate(node.test, context)
          ? evaluate(node.consequent, context)
          : evaluate(node.alternate, context);
      case "IntLiteral":
      case "FloatLiteral":
        return Number(node.value);
      case "StringLiteral":
      case "BooleanLiteral":
      case "ColorLiteral":
        return node.value;
    }
    return node;
  }

  function execute(stmts, context) {
    const statements = Array.isArray(stmts) ? stmts : [stmts];
    for (const stmt of statements) {
      if (!stmt) continue;
      switch (stmt.kind) {
        case "VariableDeclaration":
          context.set(stmt.variable, evaluate(stmt.initializer, context));
          break;
        case "Assignment":
          context.set(stmt.target, evaluate(stmt.source, context));
          break;
        case "IfStatement":
          execute(
            evaluate(stmt.test, context) ? stmt.consequent : stmt.alternate,
            context,
          );
          break;
        case "RepeatStatement": {
          const count = Number(evaluate(stmt.count, context));
          for (let i = 0; i < count; i++) execute(stmt.body, context);
          break;
        }
        case "ForRangeStatement": {
          const low = Number(evaluate(stmt.low, context));
          const high = Number(evaluate(stmt.high, context));
          for (let i = low; stmt.op === "..." ? i <= high : i < high; i++) {
            context.set(stmt.iterator, i);
            execute(stmt.body, context);
          }
          break;
        }
        case "Call": {
          const callee = stmt.callee;
          const callContext = new Map(context);
          callee.params.forEach((param, i) => {
            callContext.set(param, evaluate(stmt.args[i], context));
          });
          execute(callee.body, callContext);
          break;
        }
        case "Layout": {
          const layoutContext = new Map(context);
          const [w, h] = stmt.size.map((s) =>
            Number(evaluate(s, layoutContext)),
          );
          const layoutId = getTargetName(stmt.name || "Layout");
          svgLines.push(
            `<svg id="${layoutId}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`,
          );
          if (program.metadata) {
            svgLines.push(`  `);
            svgLines.push(
              `  <text x="10" y="20" font-family="Arial" font-size="12" fill="#999">Designer: ${program.metadata.author} | Date: ${program.metadata.date}</text>`,
            );
          }
          svgLines.push(`  <rect width="100%" height="100%" fill="#fcfcfc" />`);
          execute(stmt.body, layoutContext);
          svgLines.push(`</svg>`);
          break;
        }
        case "Wall": {
          const x1 = Number(evaluate(stmt.from[0], context));
          const y1 = Number(evaluate(stmt.from[1], context));
          const x2 = Number(evaluate(stmt.to[0], context));
          const y2 = Number(evaluate(stmt.to[1], context));
          const color = evaluate(stmt.props?.color, context) ?? "black";
          const thickness = Number(
            evaluate(stmt.props?.thickness, context) ?? 4,
          );
          svgLines.push(
            `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${thickness}" stroke-linecap="round" />`,
          );
          break;
        }
        case "Furniture": {
          const cx = Number(evaluate(stmt.at[0], context));
          const cy = Number(evaluate(stmt.at[1], context));
          const color = evaluate(stmt.props?.color, context) ?? "#3498db";
          const label = evaluate(stmt.props?.label, context) ?? stmt.type;
          svgLines.push(
            `  <rect x="${cx - 15}" y="${cy - 15}" width="30" height="30" fill="${color}" rx="4" />`,
          );
          svgLines.push(
            `  <text x="${cx}" y="${cy + 5}" font-family="Arial" font-size="8" text-anchor="middle" fill="white">${label}</text>`,
          );
          break;
        }
      }
    }
  }

  const globalContext = new Map();
  execute(program.statements, globalContext);

  if (svgLines.length === 0) {
    return `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg"></svg>`;
  }

  return svgLines.join("\n");
}
