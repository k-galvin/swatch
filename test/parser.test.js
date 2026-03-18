import assert from "node:assert/strict";
import parse from "../src/parser.js";

const syntaxChecks = [
  ["a simple layout", 'Layout "Studio" { Wall North from [0, 0] to [10, 0] }'],
  ["a layout with furniture", 'Layout "Lounge" { place Sofa at [50, 50] }'],
  [
    "multiple elements",
    'Layout "Suite" { Wall W from [0,0] to [1,1] place Bed at [2,2] }',
  ],
  [
    "comments",
    'Layout "X" { // This is a comment \n Wall W from [0,0] to [1,1] }',
  ],
];

const syntaxErrors = [
  [
    "missing closing brace",
    'Layout "Error" { Wall W from [0,0] to [1,1]',
    /Expected "}"/,
  ],
  [
    "invalid coordinates",
    'Layout "Error" { Wall W from [0] to [1,1] }',
    /Expected ","/,
  ],
  [
    "keyword as wall name",
    'Layout "Error" { Wall place from [0,0] to [1,1] }',
    /Expected/,
  ],
  ["a completely broken line", "Furniture Sofa", /Expected/],
  ["invalid starting keyword", "Room MyRoom { }", /Expected/],
];

describe("The Parser", () => {
  for (const [scenario, source] of syntaxChecks) {
    it(`should parse ${scenario}`, () => {
      assert.ok(parse(source));
    });
  }
  for (const [scenario, source, errorMessage] of syntaxErrors) {
    it(`should detect ${scenario}`, () => {
      assert.throws(() => parse(source), errorMessage);
    });
  }
});

describe("The AST Generator", () => {
  it("should produce a Wall object with correct coordinates", () => {
    const source = 'Layout "Test" { Wall North from [10, 20] to [30, 40] }';
    const ast = parse(source);
    const wall = ast.layouts[0].body[0];

    assert.strictEqual(wall.constructor.name, "Wall");
    assert.strictEqual(wall.name, "North");
    assert.deepEqual(wall.from, [10, 20]);
    assert.deepEqual(wall.to, [30, 40]);
  });

  it("should produce a Furniture object", () => {
    const source = 'Layout "Test" { place Sofa at [100, 200] }';
    const ast = parse(source);
    const sofa = ast.layouts[0].body[0];

    assert.strictEqual(sofa.constructor.name, "Furniture");
    assert.strictEqual(sofa.type, "Sofa");
    assert.deepEqual(sofa.at, [100, 200]);
  });

  it("should produce an AST for a complex layout with multiple items", () => {
    const source =
      'Layout "Full" { Wall A from [0,0] to [1,0] Wall B from [1,0] to [1,1] }';
    const ast = parse(source);
    assert.strictEqual(ast.layouts[0].body.length, 2);
  });
});
