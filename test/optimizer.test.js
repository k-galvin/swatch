import { describe, it } from "node:test";
import assert from "node:assert/strict";
import optimize from "../src/optimizer.js";

const binary = (op, left, right) => ({
  kind: "BinaryExpression",
  op,
  left,
  right,
});
const unary = (op, operand) => ({ kind: "UnaryExpression", op, operand });

describe("The Optimizer", () => {
  it("folds constant arithmetic", () => {
    assert.equal(optimize(binary("+", 5n, 8n)), 13n);
    assert.equal(optimize(binary("-", 5n, 8n)), -3n);
    assert.equal(optimize(binary("*", 5n, 8n)), 40n);
    assert.equal(optimize(binary("/", 40n, 8n)), 5n);
    assert.equal(optimize(binary("%", 43n, 10n)), 3n);
    assert.equal(optimize(binary("**", 2n, 3n)), 8n);
    // Floats
    assert.equal(optimize(binary("+", 5.0, 8.0)), 13.0);
    assert.equal(optimize(binary("-", 5.0, 8.0)), -3.0);
    assert.equal(optimize(binary("*", 5.0, 8.0)), 40.0);
    assert.equal(optimize(binary("/", 40.0, 8.0)), 5.0);
    assert.equal(optimize(binary("%", 43.0, 10.0)), 3.0);
    assert.equal(optimize(binary("**", 2.0, 3.0)), 8.0);
  });

  it("folds constant comparisons", () => {
    assert.equal(optimize(binary("<", 5n, 8n)), true);
    assert.equal(optimize(binary("<=", 5n, 5n)), true);
    assert.equal(optimize(binary("==", 5n, 5n)), true);
    assert.equal(optimize(binary("!=", 5n, 5n)), false);
    assert.equal(optimize(binary(">=", 8n, 5n)), true);
    assert.equal(optimize(binary(">", 8n, 5n)), true);
    // Floats
    assert.equal(optimize(binary("<", 5.0, 8.0)), true);
    assert.equal(optimize(binary("<=", 5.0, 5.0)), true);
    assert.equal(optimize(binary("==", 5.0, 5.0)), true);
    assert.equal(optimize(binary("!=", 5.0, 5.0)), false);
    assert.equal(optimize(binary(">=", 8.0, 5.0)), true);
    assert.equal(optimize(binary(">", 8.0, 5.0)), true);
    // Mixed types (should not fold)
    const mixed = binary("<", 5, 8n);
    assert.deepEqual(optimize(mixed), mixed);
    const mixed2 = binary("<", 5n, 8.0);
    assert.deepEqual(optimize(mixed2), mixed2);
  });

  it("folds constant logical ops", () => {
    assert.equal(optimize(binary("&&", true, false)), false);
    assert.equal(optimize(binary("&&", true, true)), true);
    assert.equal(optimize(binary("||", true, false)), true);
    assert.equal(optimize(binary("||", false, true)), true);
    assert.equal(optimize(binary("||", false, false)), false);
    assert.equal(optimize(binary("==", true, true)), true);
    assert.equal(optimize(binary("==", true, false)), false);
    assert.equal(optimize(binary("!=", true, true)), false);
    assert.equal(optimize(binary("!=", true, false)), true);
  });

  it("handles unoptimizable boolean binary expressions", () => {
    const e = binary("<", true, false);
    assert.deepEqual(optimize(e), e);
  });

  it("folds constant unary ops", () => {
    assert.equal(optimize(unary("-", 5n)), -5n);
    assert.equal(optimize(unary("-", 5.0)), -5.0);
    assert.equal(optimize(unary("!", true)), false);
    const u = unary("-", "x");
    assert.deepEqual(optimize(u), u);
    const b = unary("!", "x");
    assert.deepEqual(optimize(b), b);
    const pos = unary("+", 5n);
    assert.deepEqual(optimize(pos), pos);
    const complex = unary("-", { kind: "Unknown" });
    assert.deepEqual(optimize(complex), complex);
  });

  it("performs strength reduction", () => {
    assert.equal(optimize(binary("+", "x", 0n)), "x");
    assert.equal(optimize(binary("+", 0n, "x")), "x");
    assert.equal(optimize(binary("+", "x", 0)), "x");
    assert.equal(optimize(binary("+", 0, "x")), "x");

    assert.equal(optimize(binary("-", "x", 0n)), "x");
    assert.equal(optimize(binary("-", "x", 0)), "x");
    assert.equal(optimize(binary("-", "x", "x")), 0n);

    assert.equal(optimize(binary("*", "x", 1n)), "x");
    assert.equal(optimize(binary("*", 1n, "x")), "x");
    assert.equal(optimize(binary("*", "x", 1)), "x");
    assert.equal(optimize(binary("*", 1, "x")), "x");
    assert.equal(optimize(binary("*", "x", 0n)), 0n);
    assert.equal(optimize(binary("*", 0n, "x")), 0n);
    assert.equal(optimize(binary("*", "x", 0)), 0n);
    assert.equal(optimize(binary("*", 0, "x")), 0n);

    assert.equal(optimize(binary("/", "x", 1n)), "x");
    assert.deepEqual(optimize(binary("/", 1n, "x")), binary("/", 1n, "x"));
    assert.equal(optimize(binary("/", "x", 1)), "x");
    assert.equal(optimize(binary("/", 0n, "x")), 0n);
    assert.equal(optimize(binary("/", 0, "x")), 0n);
    assert.equal(optimize(binary("/", "x", "x")), 1n);

    assert.equal(optimize(binary("**", "x", 0n)), 1n);
    assert.equal(optimize(binary("**", "x", 0)), 1n);
    assert.equal(optimize(binary("**", "x", 1n)), "x");
    assert.equal(optimize(binary("**", "x", 1)), "x");
  });

  it("optimizes Program", () => {
    const program = {
      kind: "Program",
      layouts: [{ kind: "Layout", name: "L", size: [100n, 100n], body: [] }],
    };
    assert.deepEqual(optimize(program), program);
  });

  it("optimizes VariableDeclaration", () => {
    const decl = {
      kind: "VariableDeclaration",
      initializer: binary("+", 1n, 1n),
    };
    const optimized = optimize(decl);
    assert.equal(optimized.initializer, 2n);
  });

  it("optimizes Layout", () => {
    const layout = {
      kind: "Layout",
      name: "L",
      size: [binary("+", 50n, 50n), 100n],
      body: [
        { kind: "Assignment", target: "x", source: "x" },
        {
          kind: "IfStatement",
          test: false,
          consequent: [{ kind: "Wall", name: "W", from: [0, 0], to: [1, 1] }],
          alternate: [{ kind: "Wall", name: "W", from: [0, 0], to: [2, 2] }],
        },
        {
          kind: "IfStatement",
          test: true,
          consequent: [
            { kind: "Wall", name: "W_TRUE", from: [0, 0], to: [3, 3] },
          ],
          alternate: [],
        },
      ],
    };
    const optimized = optimize(layout);
    assert.equal(optimized.size[0], 100n);
    // x = x is gone, if(false) is replaced by alternate, if(true) is replaced by consequent
    assert.equal(optimized.body.length, 2);
    assert.equal(optimized.body[0].kind, "Wall");
    assert.equal(optimized.body[1].name, "W_TRUE");
  });

  it("optimizes ComponentDeclaration", () => {
    const compDecl = {
      kind: "ComponentDeclaration",
      component: {
        kind: "Component",
        body: [{ kind: "Assignment", target: "x", source: "x" }],
      },
    };
    const optimized = optimize(compDecl);
    assert.equal(optimized.component.body.length, 0);
  });

  it("optimizes Wall and Furniture", () => {
    const wall = {
      kind: "Wall",
      from: [binary("+", 0n, 0n), 0n],
      to: [10n, 10n],
      props: { thickness: binary("*", 2n, 2n) },
    };
    const optimizedWall = optimize(wall);
    assert.equal(optimizedWall.from[0], 0n);
    assert.equal(optimizedWall.props.thickness, 4n);

    const furniture = {
      kind: "Furniture",
      at: [binary("+", 5n, 5n), 5n],
      props: { color: "red" },
    };
    const optimizedFurniture = optimize(furniture);
    assert.equal(optimizedFurniture.at[0], 10n);
  });

  it("optimizes Call", () => {
    const call = { kind: "Call", args: [binary("+", 1n, 1n), "y"] };
    const optimized = optimize(call);
    assert.equal(optimized.args[0], 2n);
    assert.equal(optimized.args[1], "y");
  });

  it("handles unoptimizable assignments", () => {
    const assign = { kind: "Assignment", target: "x", source: 1n };
    assert.deepEqual(optimize(assign), assign);
    const selfAssign = { kind: "Assignment", target: "x", source: "x" };
    assert.equal(optimize(selfAssign), null);
  });

  it("handles unoptimizable binary expressions", () => {
    const e = binary("%", "x", "y");
    assert.deepEqual(optimize(e), e);
  });

  it("eliminates dead code in conditionals", () => {
    const condTrue = {
      kind: "Conditional",
      test: true,
      consequent: "yes",
      alternate: "no",
    };
    assert.equal(optimize(condTrue), "yes");
    const condFalse = {
      kind: "Conditional",
      test: false,
      consequent: "yes",
      alternate: "no",
    };
    assert.equal(optimize(condFalse), "no");
    const condUnknown = {
      kind: "Conditional",
      test: "x",
      consequent: "yes",
      alternate: "no",
    };
    assert.deepEqual(optimize(condUnknown), condUnknown);

    const ifTrue = {
      kind: "IfStatement",
      test: true,
      consequent: [
        { kind: "Wall", name: "W", from: [0, 0], to: [1, 1], props: {} },
      ],
      alternate: [],
    };
    assert.deepEqual(optimize(ifTrue), [
      { kind: "Wall", name: "W", from: [0, 0], to: [1, 1], props: {} },
    ]);
    const ifFalse = {
      kind: "IfStatement",
      test: false,
      consequent: [],
      alternate: [
        { kind: "Wall", name: "W", from: [0, 0], to: [2, 2], props: {} },
      ],
    };
    assert.deepEqual(optimize(ifFalse), [
      { kind: "Wall", name: "W", from: [0, 0], to: [2, 2], props: {} },
    ]);

    const ifFalseSingle = {
      kind: "IfStatement",
      test: false,
      consequent: [],
      alternate: {
        kind: "Wall",
        name: "W",
        from: [0, 0],
        to: [2, 2],
        props: {},
      },
    };
    assert.deepEqual(optimize(ifFalseSingle), [
      { kind: "Wall", name: "W", from: [0, 0], to: [2, 2], props: {} },
    ]);

    const ifUnknown = {
      kind: "IfStatement",
      test: "x",
      consequent: [
        { kind: "Wall", name: "W", from: [0, 0], to: [1, 1], props: {} },
      ],
      alternate: [],
    };
    const optimizedIf = optimize(ifUnknown);
    assert.strictEqual(optimizedIf.kind, "IfStatement");
  });

  it("eliminates dead loops", () => {
    const repeatZeroInt = { kind: "RepeatStatement", count: 0n, body: [] };
    assert.equal(optimize(repeatZeroInt), null);
    const repeatZeroFloat = { kind: "RepeatStatement", count: 0, body: [] };
    assert.equal(optimize(repeatZeroFloat), null);
    const repeatFive = {
      kind: "RepeatStatement",
      count: 5n,
      body: [{ kind: "Assignment", target: "x", source: "x" }],
    };
    assert.equal(optimize(repeatFive).body.length, 0);

    const rangeEmpty = {
      kind: "ForRangeStatement",
      low: 5n,
      high: 5n,
      body: [],
    };
    assert.equal(optimize(rangeEmpty), null);
    const rangeEmptyFloat = {
      kind: "ForRangeStatement",
      low: 5.0,
      high: 5.0,
      body: [],
    };
    assert.equal(optimize(rangeEmptyFloat), null);
    const rangeMismatched = {
      kind: "ForRangeStatement",
      low: 5n,
      high: 5,
      body: [],
    };
    assert.ok(optimize(rangeMismatched));
    const rangeFull = {
      kind: "ForRangeStatement",
      low: 0n,
      high: 10n,
      body: [{ kind: "Assignment", target: "x", source: "x" }],
    };
    assert.equal(optimize(rangeFull).body.length, 0);
  });

  it("handles null and primitives", () => {
    assert.equal(optimize(null), null);
    assert.equal(optimize(undefined), undefined);
    assert.equal(optimize(5n), 5n);
    assert.equal(optimize(true), true);
    assert.deepEqual(optimize({ a: 1 }), { a: 1 });
  });

  it("returns the node if kind is unknown", () => {
    const unknown = { kind: "Unknown" };
    assert.deepEqual(optimize(unknown), unknown);
  });
});
