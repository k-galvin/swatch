export default function generate(program) {
  const svgLines = [];
  let nextId = 1;

  function getTargetName(base) {
    return `${base}_${nextId++}`;
  }

  function evaluate(node, context) {
    if (node === null || node === undefined) return null;
    if (typeof node === "bigint") return Number(node);
    if (typeof node !== "object") return node;

    switch (node.kind) {
      case "Variable":
        return context.has(node)
          ? evaluate(context.get(node), context)
          : Number(node.value || 0);
      case "BinaryExpression":
        const l = Number(evaluate(node.left, context));
        const r = Number(evaluate(node.right, context));
        if (node.op === "+") return l + r;
        if (node.op === "-") return l - r;
        if (node.op === "*") return l * r;
        if (node.op === "/") return l / r;
        if (node.op === "%") return l % r;
        if (node.op === "**") return Math.pow(l, r);
        if (node.op === "<") return l < r;
        if (node.op === "<=") return l <= r;
        if (node.op === "==") return l === r;
        if (node.op === "!=") return l !== r;
        if (node.op === ">=") return l >= r;
        if (node.op === ">") return l > r;
        if (node.op === "&&") return l && r;
        if (node.op === "||") return l || r;
        return 0;
      case "UnaryExpression":
        const v = evaluate(node.operand, context);
        return node.op === "-" ? -Number(v) : !v;
      case "Conditional":
        return evaluate(node.test, context)
          ? evaluate(node.consequent, context)
          : evaluate(node.alternate, context);
      default:
        return node;
    }
  }

  function execute(stmts, context) {
    for (const stmt of stmts) {
      if (!stmt) continue;
      switch (stmt.kind) {
        case "VariableDeclaration":
          context.set(stmt.variable, evaluate(stmt.initializer, context));
          break;
        case "Assignment":
          context.set(stmt.target, evaluate(stmt.source, context));
          break;
        case "IfStatement":
          if (evaluate(stmt.test, context)) {
            execute(stmt.consequent, context);
          } else {
            const alt = Array.isArray(stmt.alternate)
              ? stmt.alternate
              : [stmt.alternate];
            execute(alt, context);
          }
          break;
        case "RepeatStatement":
          const count = Number(evaluate(stmt.count, context));
          for (let i = 0; i < count; i++) execute(stmt.body, context);
          break;
        case "ForRangeStatement":
          const low = Number(evaluate(stmt.low, context));
          const high = Number(evaluate(stmt.high, context));
          for (let i = low; stmt.op === "..." ? i <= high : i < high; i++) {
            context.set(stmt.iterator, i);
            execute(stmt.body, context);
          }
          break;
        case "Call": {
          const component = stmt.callee.component || stmt.callee;
          const callContext = new Map(context);
          stmt.args.forEach((arg, i) => {
            callContext.set(component.params[i], evaluate(arg, context));
          });
          execute(component.body, callContext);
          break;
        }
        case "Wall": {
          const id = getTargetName(stmt.name || "Wall");
          const x1 = evaluate(stmt.from[0], context);
          const y1 = evaluate(stmt.from[1], context);
          const x2 = evaluate(stmt.to[0], context);
          const y2 = evaluate(stmt.to[1], context);
          const color = evaluate(stmt.props?.color, context) || "black";
          const thickness = evaluate(stmt.props?.thickness, context) || 4;
          svgLines.push(
            `  <line id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${thickness}" stroke-linecap="round" />`,
          );
          break;
        }
        case "Furniture": {
          const id = getTargetName(stmt.type || "Furniture");
          const cx = evaluate(stmt.at[0], context);
          const cy = evaluate(stmt.at[1], context);
          const color = evaluate(stmt.props?.color, context) || "#3498db";
          const label = evaluate(stmt.props?.label, context) || stmt.type;
          svgLines.push(
            `  <circle id="${id}" cx="${cx}" cy="${cy}" r="12" fill="${color}" />`,
          );
          svgLines.push(
            `  <text x="${cx}" y="${cy + 25}" font-family="Arial" font-size="10" text-anchor="middle" fill="#333">${label}</text>`,
          );
          break;
        }
      }
    }
  }

  const globalContext = new Map();
  for (const layout of program.layouts) {
    if (layout.kind === "VariableDeclaration") {
      globalContext.set(
        layout.variable,
        evaluate(layout.initializer, globalContext),
      );
      continue;
    }
    if (!layout.intrinsic) continue;
    const context = new Map(globalContext);
    const [w, h] = layout.size.map((s) => Number(evaluate(s, context)));
    const layoutId = getTargetName(layout.name || "Layout");
    svgLines.push(
      `<svg id="${layoutId}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`,
    );
    if (program.metadata) {
      svgLines.push(
        `  <!-- Designer: ${program.metadata.author}, Date: ${program.metadata.date} -->`,
      );
    }
    svgLines.push(`  <rect width="100%" height="100%" fill="#fafafa" />`);
    execute(layout.body, context);
    svgLines.push(`</svg>`);
  }
  return svgLines.join("\n");
}
