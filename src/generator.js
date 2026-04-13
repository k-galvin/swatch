/**
 * Swatch SVG Code Generator
 *
 * This phase transforms the optimized AST into Scalable Vector Graphics (SVG).
 * It handles scope management for variables, executes drawing commands,
 * and applies architectural styling (grids, shadows, line-caps).
 *
 * @param {object} program The root Program node.
 * @returns {string} The final SVG markup.
 */
export default function generate(program) {
  const svgLines = [];
  let nextId = 1;

  /** Generates a unique target name for SVG elements. */
  function getTargetName(base) {
    return `${base}_${nextId++}`;
  }

  /**
   * Recursively evaluates an expression to a concrete JavaScript value.
   * Resolves variables against the provided execution context.
   */
  function evaluate(node, context) {
    if (node === null || node === undefined) return null;
    if (typeof node === "bigint") return Number(node);
    if (typeof node !== "object") return node;

    switch (node.kind) {
      case "Variable":
        return context.has(node)
          ? evaluate(context.get(node), context)
          : evaluate(node.value, context);

      case "BinaryExpression": {
        const leftVal = evaluate(node.left, context);
        const rightVal = evaluate(node.right, context);

        // Special case: String concatenation
        if (node.op === "+") {
          return typeof leftVal === "string" || typeof rightVal === "string"
            ? String(leftVal) + String(rightVal)
            : Number(leftVal) + Number(rightVal);
        }

        const leftNum = Number(leftVal);
        const rightNum = Number(rightVal);

        switch (node.op) {
          case "-":
            return leftNum - rightNum;
          case "*":
            return leftNum * rightNum;
          case "/":
            return leftNum / rightNum;
          case "**":
            return Math.pow(leftNum, rightNum);
          case "<":
            return leftNum < rightNum;
          case "==":
            return leftNum === rightNum;
          case "&&":
            return leftNum && rightNum;
          case "||":
            return leftNum || rightNum;
          case "??":
            return leftVal ?? rightVal;
          case "in":
            return Array.isArray(rightVal) ? rightVal.includes(leftVal) : false;
          case "%":
            return leftNum % rightNum;
          default:
            return 0;
        }
      }

      case "UnaryExpression": {
        const operandVal = evaluate(node.operand, context);
        return node.op === "-" ? -Number(operandVal) : !operandVal;
      }

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

      case "EmptyOptionalLiteral":
        return null;

      case "ArrayLiteral":
        return node.elements.map((element) => evaluate(element, context));
    }
    return node;
  }

  /**
   * Executes a sequence of statements, updating the context or appending to svgLines.
   * Handles loop control signals (e.g., "BREAK").
   */
  function execute(statementsInput, context, labelQueue = null) {
    const statements = Array.isArray(statementsInput)
      ? statementsInput
      : [statementsInput];

    for (const statement of statements) {
      if (!statement) continue;
      if (statement.kind === "BreakStatement") return "BREAK";

      switch (statement.kind) {
        case "VariableDeclaration":
          context.set(
            statement.variable,
            evaluate(statement.initializer, context),
          );
          break;

        case "Assignment":
          context.set(statement.target, evaluate(statement.source, context));
          break;

        case "BumpStatement": {
          const currentVal = Number(evaluate(statement.variable, context));
          context.set(
            statement.variable,
            statement.op === "++" ? currentVal + 1 : currentVal - 1,
          );
          break;
        }

        case "IfStatement": {
          const result = execute(
            evaluate(statement.test, context)
              ? statement.consequent
              : statement.alternate,
            context,
            labelQueue,
          );
          if (result === "BREAK") return "BREAK";
          break;
        }

        case "WhileStatement": {
          while (evaluate(statement.test, context)) {
            if (execute(statement.body, context, labelQueue) === "BREAK") break;
          }
          break;
        }

        case "RepeatStatement": {
          const count = Number(evaluate(statement.count, context));
          for (let i = 0; i < count; i++) {
            if (execute(statement.body, context, labelQueue) === "BREAK") break;
          }
          break;
        }

        case "ForRangeStatement": {
          const low = Number(evaluate(statement.low, context));
          const high = Number(evaluate(statement.high, context));
          for (
            let i = low;
            statement.op === "..." ? i <= high : i < high;
            i++
          ) {
            context.set(statement.iterator, i);
            if (execute(statement.body, context, labelQueue) === "BREAK") break;
          }
          break;
        }

        case "ForCollectionStatement": {
          const collection = evaluate(statement.collection, context);
          for (const item of collection) {
            context.set(statement.iterator, item);
            if (execute(statement.body, context, labelQueue) === "BREAK") break;
          }
          break;
        }

        case "Call": {
          const callee = statement.callee;
          const callContext = new Map(context);
          callee.params.forEach((param, i) => {
            callContext.set(param, evaluate(statement.args[i], context));
          });
          execute(callee.body, callContext, labelQueue);
          break;
        }

        case "Layout": {
          const layoutContext = new Map(context);
          const currentLabels = [];
          const [width, height] = statement.size.map((dimension) =>
            Number(evaluate(dimension, layoutContext)),
          );
          const footerHeight = program.metadata ? 40 : 0;
          const totalHeight = height + footerHeight;
          const layoutId = getTargetName(statement.name || "Layout");

          svgLines.push(
            `<svg id="${layoutId}" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}" xmlns="http://www.w3.org/2000/svg">`,
          );

          // Standard Architectural Background & Grid
          svgLines.push(`  <defs>`);
          svgLines.push(
            `    <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">`,
          );
          svgLines.push(
            `      <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#f0f0f0" stroke-width="1"/>`,
          );
          svgLines.push(
            `      <circle cx="0" cy="0" r="1.5" fill="#e0e0e0" />`,
          );
          svgLines.push(`    </pattern>`);
          svgLines.push(
            `    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">`,
          );
          svgLines.push(
            `      <feGaussianBlur in="SourceAlpha" stdDeviation="3" />`,
          );
          svgLines.push(`      <feOffset dx="2" dy="2" result="offsetblur" />`);
          svgLines.push(
            `      <feComponentTransfer><feFuncA type="linear" slope="0.2"/></feComponentTransfer>`,
          );
          svgLines.push(
            `      <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>`,
          );
          svgLines.push(`    </filter>`);
          svgLines.push(`  </defs>`);

          svgLines.push(`  <rect width="100%" height="100%" fill="white" />`);
          svgLines.push(
            `  <rect width="100%" height="${height}" fill="url(#grid)" />`,
          );

          // Optional Metadata Footer
          if (program.metadata) {
            svgLines.push(
              `  <rect x="0" y="${height}" width="100%" height="${footerHeight}" fill="#f9f9f9" />`,
            );
            svgLines.push(
              `  <line x1="0" y1="${height}" x2="${width}" y2="${height}" stroke="#eee" stroke-width="1" />`,
            );
            svgLines.push(
              `  <text x="15" y="${height + 25}" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#888">`,
            );
            svgLines.push(
              `    DESIGNER: ${program.metadata.author} | DATE: ${program.metadata.date} | ${layoutId}`,
            );
            svgLines.push(`  </text>`);
          }

          execute(statement.body, layoutContext, currentLabels);

          // Flush Label Queue (Vertical stacking collision avoidance)
          const occupied = [];
          for (const label of currentLabels) {
            const { cx, cy, text } = label;
            let finalY = cy;

            while (
              occupied.some(
                (box) =>
                  Math.abs(box.x - cx) < 60 && Math.abs(box.y - finalY) < 15,
              )
            ) {
              finalY += 15;
            }

            occupied.push({ x: cx, y: finalY });

            svgLines.push(`  <g transform="translate(${cx}, ${finalY})">`);
            svgLines.push(
              `    <rect x="-30" y="-8" width="60" height="12" fill="white" fill-opacity="0.9" rx="4" />`,
            );
            svgLines.push(
              `    <text font-family="Arial, sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="#333">${text}</text>`,
            );
            svgLines.push(`  </g>`);
          }

          svgLines.push(`</svg>`);
          break;
        }

        case "Wall": {
          const startX = Number(evaluate(statement.from[0], context));
          const startY = Number(evaluate(statement.from[1], context));
          const endX = Number(evaluate(statement.to[0], context));
          const endY = Number(evaluate(statement.to[1], context));
          const color = evaluate(statement.props?.color, context) ?? "#2c3e50";
          const thickness = Number(
            evaluate(statement.props?.thickness, context) ?? 8,
          );

          // Architectural double-line wall effect
          svgLines.push(
            `  <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="${color}" stroke-width="${thickness}" stroke-linecap="round" />`,
          );
          svgLines.push(
            `  <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="white" stroke-width="${thickness * 0.4}" stroke-linecap="round" opacity="0.3" />`,
          );
          break;
        }

        case "Furniture": {
          const centerX = Number(evaluate(statement.at[0], context));
          const centerY = Number(evaluate(statement.at[1], context));
          const color = evaluate(statement.props?.color, context) ?? "#3498db";
          const typeValue = String(evaluate(statement.type, context));
          const labelText =
            evaluate(statement.props?.label, context) ?? typeValue;
          const dimension = Number(
            evaluate(statement.props?.size, context) ??
              evaluate(statement.props?.width, context) ??
              40,
          );
          const half = dimension / 2;

          svgLines.push(`  <g class="furniture" filter="url(#shadow)">`);
          const archetype = typeValue.toLowerCase();

          if (archetype.includes("chair") || archetype.includes("stool")) {
            svgLines.push(
              `    <circle cx="${centerX}" cy="${centerY}" r="${half}" fill="${color}" />`,
            );
          } else if (
            archetype.includes("table") ||
            archetype.includes("desk")
          ) {
            svgLines.push(
              `    <rect x="${centerX - half}" y="${centerY - half}" width="${dimension}" height="${dimension}" fill="${color}" rx="2" />`,
            );
          } else if (archetype.includes("bed")) {
            svgLines.push(
              `    <rect x="${centerX - dimension * 0.75}" y="${centerY - half}" width="${dimension * 1.5}" height="${dimension}" fill="${color}" rx="4" />`,
            );
            svgLines.push(
              `    <rect x="${centerX - dimension * 0.75 + 5}" y="${centerY - half + 5}" width="20" height="${dimension - 10}" fill="white" opacity="0.2" rx="2" />`,
            );
          } else if (archetype.includes("sink")) {
            svgLines.push(
              `    <rect x="${centerX - half}" y="${centerY - half}" width="${dimension}" height="${dimension}" fill="${color}" rx="4" />`,
            );
            svgLines.push(
              `    <circle cx="${centerX}" cy="${centerY}" r="${half * 0.7}" fill="white" opacity="0.2" />`,
            );
          } else {
            svgLines.push(
              `    <rect x="${centerX - half}" y="${centerY - half}" width="${dimension}" height="${dimension}" fill="${color}" rx="6" />`,
            );
          }
          svgLines.push(`  </g>`);

          if (labelQueue) {
            labelQueue.push({
              cx: centerX,
              cy: centerY + half + 12,
              text: labelText,
            });
          }
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
