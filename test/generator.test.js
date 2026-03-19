import { describe, it } from "node:test";
import assert from "node:assert/strict";
import parse from "../src/parser.js";
import analyze from "../src/analyzer.js";
import generate from "../src/generator.js";

const fixtures = [
  {
    name: "minimal layout (no metadata)",
    source: "Layout L1 size [100, 100] { }",
    expected: [
      /<svg id="L1_1" width="100" height="100" viewBox="0 0 100 100" xmlns="http:\/\/www.w3.org\/2000\/svg">/,
      /<rect width="100%" height="100%" fill="#fafafa" \/>/,
    ],
  },
  {
    name: "full features (metadata, walls with props, furniture)",
    source: `
      Designer "Kate" Date "2026-03-17"
      Layout L1 size [500, 500] { 
        Wall W1 from [0, 0] to [100, 0] [color: #000000, thickness: 10]
        place Table at [250, 250] [color: #a52a2a, label: "Dinner Table"] 
      }`,
    expected: [
      /<!-- Designer: Kate, Date: 2026-03-17 -->/,
      /<line id="W1_2" x1="0" y1="0" x2="100" y2="0" stroke="#000000" stroke-width="10" stroke-linecap="round" \/>/,
      /<circle id="Table_3" cx="250" cy="250" r="12" fill="#a52a2a" \/>/,
      /<text x="250" y="275".*>Dinner Table<\/text>/,
    ],
  },
  {
    name: "default wall and furniture styles",
    source:
      "Layout L2 size [100, 100] { Wall W1 from [0, 0] to [10, 10] place Stool at [5, 5] }",
    expected: [
      /id="W1_2"/,
      /stroke="black" stroke-width="4"/,
      /id="Stool_3"/,
      /fill="#3498db"/,
    ],
  },
  {
    name: "loops and components",
    source: `
      component C(x: number) {
        Wall W from [0, 0] to [x, x]
      }
      Layout L size [100, 100] {
        repeat 2 { Wall W from [0, 0] to [10, 10] }
        for i in 1...2 { Wall W from [0, 0] to [i, i] }
        for i in 1..<2 { Wall W from [0, 0] to [i, i] }
        for i in 1.0..<2.0 { Wall W from [0, 0] to [i, i] }
        C(50)
      }`,
    expected: [/x2="10"/, /x2="1"/, /x2="2"/, /x2="50"/],
  },
  {
    name: "all operators and conditionals",
    source: `
      Layout L size [100, 100] {
        let x = true ? (10 - 5) * 2 : 0
        let y = false ? 0 : 10 / 2
        Wall W from [0, 0] to [x ** 2, y % 3]
        if (1 < 2 && 2 <= 2 && 1 == 1 && 1 != 2 && 2 >= 2 && 2 > 1 || false) {
          Wall W from [0, 0] to [-10, !true ? 1 : 0]
        }
        if (false) { Wall W from [0,0] to [1,1] } else { Wall W from [0,0] to [2,2] }
      }`,
    expected: [/x2="100"/, /y2="2"/, /x2="-10"/, /y2="0"/, /x2="2" y2="2"/],
  },
  {
    name: "unary not and binary fallback",
    source: `
      Layout L size [100, 100] {
        if (!false) { Wall W from [0, 0] to [1, 1] }
      }`,
    expected: [/x2="1"/],
  },
];

describe("The Generator", () => {
  for (const fixture of fixtures) {
    it(`generates correct SVG for ${fixture.name}`, () => {
      const output = generate(analyze(parse(fixture.source)));

      if (Array.isArray(fixture.expected)) {
        fixture.expected.forEach((pattern) => {
          assert.match(output, pattern);
        });
      } else {
        assert.match(output, fixture.expected);
      }
    });
  }

  it("handles multiple layouts in a single file", () => {
    const source = `
      Layout L1 size [100, 100] { }
      Layout L2 size [200, 200] { }
    `;
    const output = generate(analyze(parse(source)));
    assert.strictEqual(output.split("</svg>").length - 1, 2);
    assert.match(output, /id="L1_1"/);
    assert.match(output, /id="L2_2"/);
  });

  it("skips non-intrinsic items and handles name fallbacks", () => {
    const program = {
      layouts: [
        {
          kind: "Layout",
          name: "L1",
          size: [100, 100],
          intrinsic: true,
          body: [
            { kind: "Something", intrinsic: false },
            {
              kind: "Wall",
              name: "W1",
              from: [0, 0],
              to: [10, 10],
              intrinsic: true,
            },
            { kind: "Furniture", type: "Chair", at: [5, 5], intrinsic: true },
            { kind: "Wall", from: [10, 10], to: [20, 20], intrinsic: true },
          ],
        },
        { kind: "Other", intrinsic: false },
      ],
    };
    const output = generate(program);
    assert.match(output, /id="L1_1"/);
    assert.match(output, /id="W1_2"/);
    assert.match(output, /id="Chair_3"/);
    assert.match(output, /id="Wall_4"/);
    assert.strictEqual(output.includes('id="Other"'), false);
  });

  it("covers all remaining branches in generator.js", () => {
    const y = { kind: "Variable", name: "y", value: 10 };
    const x = { kind: "Variable", name: "x", value: y };
    const z = { kind: "Variable", name: "z", value: 0 };
    const program = {
      metadata: { author: "Kate", date: "2026" },
      layouts: [
        { kind: "VariableDeclaration", variable: y, initializer: 10n },
        { kind: "VariableDeclaration", variable: x, initializer: y },
        { kind: "VariableDeclaration", variable: z, initializer: 0n },
        {
          kind: "Layout",
          intrinsic: true,
          size: [100, 100],
          body: [
            null,
            { kind: "UnknownStatement" },
            {
              kind: "Assignment",
              target: x,
              source: { kind: "BinaryExpression", op: "+", left: x, right: 1 },
            },
            {
              kind: "Assignment",
              target: x,
              source: { kind: "BinaryExpression", op: "-", left: x, right: 1 },
            },
            {
              kind: "Assignment",
              target: x,
              source: { kind: "BinaryExpression", op: "*", left: x, right: 1 },
            },
            {
              kind: "Assignment",
              target: x,
              source: { kind: "BinaryExpression", op: "/", left: x, right: 1 },
            },
            {
              kind: "Assignment",
              target: x,
              source: { kind: "BinaryExpression", op: "%", left: x, right: 1 },
            },
            {
              kind: "Assignment",
              target: x,
              source: { kind: "BinaryExpression", op: "**", left: x, right: 1 },
            },
            {
              kind: "Assignment",
              target: x,
              source: { kind: "BinaryExpression", op: "<", left: x, right: 1 },
            },
            {
              kind: "Assignment",
              target: x,
              source: { kind: "BinaryExpression", op: "<=", left: x, right: 1 },
            },
            {
              kind: "Assignment",
              target: x,
              source: { kind: "BinaryExpression", op: "==", left: x, right: 1 },
            },
            {
              kind: "Assignment",
              target: x,
              source: { kind: "BinaryExpression", op: "!=", left: x, right: 1 },
            },
            {
              kind: "Assignment",
              target: x,
              source: { kind: "BinaryExpression", op: ">=", left: x, right: 1 },
            },
            {
              kind: "Assignment",
              target: x,
              source: { kind: "BinaryExpression", op: ">", left: x, right: 1 },
            },
            {
              kind: "Assignment",
              target: x,
              source: { kind: "BinaryExpression", op: "&&", left: x, right: 1 },
            },
            {
              kind: "Assignment",
              target: x,
              source: { kind: "BinaryExpression", op: "||", left: x, right: 1 },
            },
            {
              kind: "Assignment",
              target: x,
              source: {
                kind: "BinaryExpression",
                op: "???",
                left: x,
                right: 1,
              },
            },
            {
              kind: "IfStatement",
              test: {
                kind: "Conditional",
                test: true,
                consequent: true,
                alternate: false,
              },
              consequent: [],
              alternate: [
                {
                  kind: "VariableDeclaration",
                  variable: { name: "x" },
                  initializer: "primitive",
                },
              ],
            },
            {
              kind: "IfStatement",
              test: {
                kind: "Conditional",
                test: false,
                consequent: true,
                alternate: true,
              },
              consequent: [],
              alternate: [],
            },
            {
              kind: "IfStatement",
              test: false,
              consequent: [],
              alternate: {
                kind: "Wall",
                from: [0, 0],
                to: [1, 1],
                props: { thickness: null },
              },
            },
            {
              kind: "IfStatement",
              test: false,
              consequent: [],
              alternate: [
                { kind: "Wall", from: [0, 0], to: [2, 2], intrinsic: true },
              ],
            },
            {
              kind: "Call",
              callee: { component: { params: [], body: [] } },
              args: [],
            },
            {
              kind: "Call",
              callee: { params: [], body: [] },
              args: [],
            },
            {
              kind: "Furniture",
              at: [50, 50],
              props: {
                color: { kind: "Variable", name: "u", value: 0 },
                label: { kind: "Variable", name: "w" },
              },
            },
            {
              kind: "Furniture",
              at: [50, 50],
              type: null,
              props: {
                label: { kind: "Unknown" },
              },
            },
            {
              kind: "Furniture",
              at: [50, 50],
              type: "",
              props: { label: "" },
            },
            {
              kind: "Furniture",
              at: [50, 50],
              type: "Chair",
              props: { color: null, label: null },
            },
            {
              kind: "Wall",
              from: [0, 0],
              to: [1, 1],
              name: null,
              props: { color: null, thickness: 0 },
            },
            {
              kind: "Wall",
              from: [0, 0],
              to: [1, 1],
              name: "",
              props: { color: "", thickness: null },
            },
            {
              kind: "RepeatStatement",
              count: 0,
              body: [],
            },
            {
              kind: "RepeatStatement",
              count: 1,
              body: [
                {
                  kind: "Assignment",
                  target: y,
                  source: { kind: "UnaryExpression", op: "!", operand: true },
                },
              ],
            },
            {
              kind: "ForRangeStatement",
              iterator: "j",
              low: 10,
              high: 0,
              op: "...",
              body: [],
            },
            {
              kind: "ForRangeStatement",
              iterator: "i",
              low: 0,
              high: 1,
              op: "..",
              body: [],
            },
            {
              kind: "ForRangeStatement",
              iterator: "i",
              low: 0,
              high: 0,
              op: "...",
              body: [],
            },
            {
              kind: "Assignment",
              target: z,
              source: { kind: "Variable", name: "z", value: 0 },
            },
          ],
        },
        {
          kind: "Layout",
          name: null,
          intrinsic: true,
          size: [100, 100],
          body: [],
        },
        {
          kind: "Layout",
          name: "",
          intrinsic: true,
          size: [100, 100],
          body: [],
        },
        { kind: "Layout", intrinsic: false },
      ],
    };
    const output = generate(program);
    assert.match(output, /id="Layout_\d+"/);
    assert.match(output, /id="Wall_\d+"/);
    assert.match(output, /id="Furniture_\d+"/);
  });
});
