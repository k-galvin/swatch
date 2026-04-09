import { describe, it } from "node:test";
import assert from "node:assert/strict";
import optimize from "../src/optimizer.js";
import * as core from "../src/core.js";

// Helper to create AST nodes for testing
const binary = (op, left, right) => core.binary(op, left, right, core.anyType);
const unary = (op, operand) => core.unary(op, operand, core.anyType);

describe("The Optimizer", () => {
  it("folds constant arithmetic", () => {
    // We expect the optimizer to return a core Literal object
    assert.deepEqual(
      optimize(binary("+", core.intLiteral(5n), core.intLiteral(8n))),
      core.floatLiteral(13),
    );
    assert.deepEqual(
      optimize(binary("-", core.intLiteral(5n), core.intLiteral(8n))),
      core.floatLiteral(-3),
    );
    assert.deepEqual(
      optimize(binary("*", core.intLiteral(5n), core.intLiteral(8n))),
      core.floatLiteral(40),
    );
    assert.deepEqual(
      optimize(binary("/", core.intLiteral(40n), core.intLiteral(8n))),
      core.floatLiteral(5),
    );
    assert.deepEqual(
      optimize(binary("**", core.intLiteral(2n), core.intLiteral(3n))),
      core.floatLiteral(8),
    );
  });

  it("folds constant comparisons", () => {
    assert.deepEqual(
      optimize(binary("<", core.intLiteral(5n), core.intLiteral(8n))),
      core.booleanLiteral(true),
    );
    assert.deepEqual(
      optimize(binary("<=", core.intLiteral(5n), core.intLiteral(5n))),
      core.booleanLiteral(true),
    );
    assert.deepEqual(
      optimize(binary("==", core.intLiteral(5n), core.intLiteral(5n))),
      core.booleanLiteral(true),
    );
    assert.deepEqual(
      optimize(binary("!=", core.intLiteral(5n), core.intLiteral(5n))),
      core.booleanLiteral(false),
    );
    assert.deepEqual(
      optimize(binary(">=", core.intLiteral(5n), core.intLiteral(5n))),
      core.booleanLiteral(true),
    );
    assert.deepEqual(
      optimize(binary(">", core.intLiteral(5n), core.intLiteral(8n))),
      core.booleanLiteral(false),
    );
  });

  it("folds all constant logical ops", () => {
    assert.deepEqual(
      optimize(
        binary("&&", core.booleanLiteral(true), core.booleanLiteral(false)),
      ),
      core.booleanLiteral(false),
    );
    assert.deepEqual(
      optimize(
        binary("||", core.booleanLiteral(false), core.booleanLiteral(false)),
      ),
      core.booleanLiteral(false),
    );
    assert.deepEqual(
      optimize(
        binary("||", core.booleanLiteral(true), core.booleanLiteral(false)),
      ),
      core.booleanLiteral(true),
    );
  });

  it("folds constant unary ops", () => {
    assert.deepEqual(
      optimize(unary("-", core.intLiteral(5n))),
      core.floatLiteral(-5),
    );
    assert.deepEqual(
      optimize(unary("!", core.booleanLiteral(true))),
      core.booleanLiteral(false),
    );
  });

  it("folds constant string concatenation", () => {
    assert.deepEqual(
      optimize(binary("+", core.stringLiteral("a"), core.stringLiteral("b"))),
      core.stringLiteral("ab"),
    );
    assert.deepEqual(
      optimize(binary("+", core.intLiteral(1n), core.stringLiteral("a"))),
      core.stringLiteral("1a"),
    );
  });

  it("optimizes Program and Statements", () => {
    const program = core.program(null, [
      core.variableDeclaration(
        core.variable("x", true, core.intType),
        binary("+", core.intLiteral(1n), core.intLiteral(1n)),
      ),
    ]);
    const optimized = optimize(program);
    assert.strictEqual(
      optimized.statements[0].initializer.kind,
      "FloatLiteral",
    );
    assert.strictEqual(optimized.statements[0].initializer.value, 2);
  });

  it("eliminates dead code in IfStatements", () => {
    const stmt = core.ifStatement(
      core.booleanLiteral(true),
      [core.wall("W1", [0, 0], [10, 10], {})],
      [core.wall("W2", [0, 0], [20, 20], {})],
    );
    const optimized = optimize(stmt);
    assert.strictEqual(optimized.length, 1);
    assert.strictEqual(optimized[0].name, "W1");

    const stmt2 = core.ifStatement(
      core.booleanLiteral(false),
      [core.wall("W1", [0, 0], [1, 1], {})],
      [core.wall("W2", [0, 0], [2, 2], {})],
    );
    const optimized2 = optimize(stmt2);
    assert.strictEqual(optimized2.length, 1);
    assert.strictEqual(optimized2[0].name, "W2");
  });

  it("optimizes non-constant if-statement branches", () => {
    const stmt = core.ifStatement(
      core.variable("test", false, core.booleanType),
      [
        core.assignment(
          core.variable("x", true, core.intType),
          binary("+", core.intLiteral(1n), core.intLiteral(1n)),
        ),
      ],
      [
        core.assignment(
          core.variable("y", true, core.intType),
          binary("+", core.intLiteral(2n), core.intLiteral(2n)),
        ),
      ],
    );
    const optimized = optimize(stmt);
    assert.strictEqual(optimized.consequent[0].source.value, 2);
    assert.strictEqual(optimized.alternate[0].source.value, 4);
  });

  it("eliminates dead RepeatStatements", () => {
    const stmt = core.repeatStatement(core.intLiteral(0n), [
      core.wall("W", [0, 0], [1, 1], {}),
    ]);
    assert.strictEqual(optimize(stmt), null);
  });

  it("optimizes Swatch-specific nodes (Wall/Furniture)", () => {
    const w = core.wall(
      "W",
      [
        binary("+", core.intLiteral(0n), core.intLiteral(0n)),
        core.intLiteral(0n),
      ],
      [core.intLiteral(10n), core.intLiteral(10n)],
      { thickness: binary("*", core.intLiteral(2n), core.intLiteral(2n)) },
    );
    const optimizedW = optimize(w);
    assert.strictEqual(optimizedW.from[0].kind, "FloatLiteral");
    assert.strictEqual(optimizedW.props.thickness.value, 4);

    const f = core.furniture("Chair", [0, 0], {
      rotate: binary("+", core.intLiteral(45n), core.intLiteral(45n)),
    });
    const optimizedF = optimize(f);
    assert.strictEqual(optimizedF.props.rotate.value, 90);
  });

  it("eliminates self-assignments", () => {
    const x = core.variable("x", true, core.intType);
    const stmt = core.assignment(x, x);
    assert.strictEqual(optimize(stmt), null);
  });

  it("handles unoptimizable expressions", () => {
    const expr = binary(
      "+",
      core.variable("x", true, core.intType),
      core.intLiteral(1n),
    );
    assert.deepEqual(optimize(expr), expr);
  });

  it("folds constant ternary operators", () => {
    const cond1 = core.conditional(
      core.booleanLiteral(true),
      core.intLiteral(1n),
      core.intLiteral(2n),
      core.intType,
    );
    assert.deepEqual(optimize(cond1), core.intLiteral(1n));

    const cond2 = core.conditional(
      core.booleanLiteral(false),
      core.intLiteral(1n),
      core.intLiteral(2n),
      core.intType,
    );
    assert.deepEqual(optimize(cond2), core.intLiteral(2n));
  });

  it("optimizes call arguments", () => {
    const c = core.call(core.variable("f", false, core.anyType), [
      binary("+", core.intLiteral(1n), core.intLiteral(1n)),
    ]);
    const optimized = optimize(c);
    assert.strictEqual(optimized.args[0].kind, "FloatLiteral");
  });

  it("optimizes component bodies", () => {
    const c = core.component(
      "C",
      [],
      [
        core.assignment(
          core.variable("x", true, core.intType),
          binary("+", core.intLiteral(1n), core.intLiteral(1n)),
        ),
      ],
    );
    const optimized = optimize(c);
    assert.strictEqual(optimized.body[0].source.value, 2);
  });

  it("optimizes RepeatStatement body", () => {
    const stmt = core.repeatStatement(core.intLiteral(1n), [
      core.assignment(
        core.variable("x", true, core.intType),
        binary("+", core.intLiteral(1n), core.intLiteral(1n)),
      ),
    ]);
    const optimized = optimize(stmt);
    assert.strictEqual(optimized.body[0].source.kind, "FloatLiteral");
  });

  it("optimizes ForRangeStatement low/high", () => {
    const stmt = core.forRangeStatement(
      core.variable("i", false, core.floatType),
      binary("+", core.intLiteral(1n), core.intLiteral(1n)),
      "...",
      binary("+", core.intLiteral(2n), core.intLiteral(2n)),
      [],
    );
    const optimized = optimize(stmt);
    assert.strictEqual(optimized.low.value, 2);
    assert.strictEqual(optimized.high.value, 4);
  });

  it("eliminates empty for-range loops (low == high)", () => {
    const stmt1 = core.forRangeStatement(
      core.variable("i", false, core.floatType),
      core.intLiteral(1n),
      "...",
      core.intLiteral(1n),
      [],
    );
    assert.strictEqual(optimize(stmt1), null);

    const stmt2 = core.forRangeStatement(
      core.variable("i", false, core.floatType),
      core.floatLiteral(1.0),
      "...",
      core.intLiteral(2n),
      [],
    );
    const optimized2 = optimize(stmt2);
    assert.strictEqual(optimized2.low.value, 1.0);
  });

  it("handles unoptimizable unary expressions", () => {
    const expr = unary("-", core.variable("x", false, core.floatType));
    assert.deepEqual(optimize(expr), expr);
  });

  it("handles unoptimizable ternary", () => {
    const cond = core.conditional(
      core.variable("x", false, core.booleanType),
      core.intLiteral(1n),
      core.intLiteral(2n),
      core.intType,
    );
    assert.deepEqual(optimize(cond), cond);
  });
});
