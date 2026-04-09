import { describe, it } from "node:test";
import assert from "node:assert/strict";
import parse from "../src/parser.js";
import analyze from "../src/analyzer.js";
import generate from "../src/generator.js";
import * as core from "../src/core.js";

const fixtures = [
  {
    name: "minimal layout",
    source: 'Layout "L1" size [100, 100] { }',
    expected: [
      /<svg.*width="100" height="100".*>/,
      /<rect width="100%" height="100%" fill="white" \/>/,
    ],
  },
  {
    name: "loops and math (BigInt safety)",
    source: `
      Layout "LoopTest" size [500, 500] {
        repeat 3 {
          place Chair at [100, 100];
        }
        let base = 2;
        Wall w from [0, 0] to [base ** 3, 10]; 
      }`,
    expected: [/x2="8"/, /(<g class="furniture".*?<circle.*?>.*?){3}/s],
  },
  {
    name: "components and scoped variables",
    source: `
      component Post(x: float, y: float) {
        place Pillar at [x, y] [color: #000000];
      }
      Layout "CompTest" size [200, 200] {
        Post(50.0, 50.0);
        Post(150.0, 150.0);
      }`,
    expected: [/x="30" y="30"/, /x="130" y="130"/, /fill="#000000"/, /rx="6"/],
  },
  {
    name: "assignments and conditionals",
    source: `
      Layout "AssignTest" size [100, 100] {
        let x = 10.0;
        x = 20.0;
        if (x == 20.0) {
          Wall w from [0, 0] to [x, x];
        } else {
          Wall w from [0, 0] to [0, 0];
        }
      }`,
    expected: [/x2="20" y2="20"/],
  },
  {
    name: "for range loops",
    source: `
      Layout "RangeTest" size [500, 500] {
        for i in 1 ... 3 {
          place Pillar at [i * 50.0, i * 50.0];
        }
      }`,
    expected: [
      /(<g class="furniture".*?<rect.*?>.*?){3}/s,
      /x="30" y="30"/,
      /x="130" y="130"/,
    ],
  },
  {
    name: "ternary and logical not",
    source: `
      Layout "TernaryTest" size [100, 100] {
        let x = true ? 50.0 : 0.0;
        let b = !false;
        if (b) {
          Wall w from [0, 0] to [x, x];
        }
      }`,
    expected: [/x2="50" y2="50"/],
  },
  {
    name: "complex logical and arithmetic expressions",
    source: `
      Layout "ComplexTest" size [100, 100] {
        let b = (true && false) || (true || false);
        let m = 10 % 3;
        if (b) {
          Wall w from [0, 0] to [m, m];
        }
      }`,
    expected: [/x2="1" y2="1"/],
  },
  {
    name: "component arithmetic and comparisons",
    source: `
      component Calc(x: float, y: float) {
        let a = x + y;
        let s = x - y;
        let d = x / y;
        let b = x < y;
        if (b) { Wall w from [0, 0] to [a, s] [color: #123456]; }
      }
      Layout "CalcTest" size [100, 100] {
        Calc(5.0, 10.0);
      }`,
    expected: [/x2="15" y2="-5"/, /stroke="#123456"/],
  },
  {
    name: "half-open range and non-block if-else",
    source: `
      Layout "" size [100, 100] {
        for i in 1 ..< 3 {
          if (i == 1) { Wall w1 from [0,0] to [1,1]; }
          else Wall w2 from [0,0] to [2,2];
        }
      }`,
    expected: [/id="Layout_1"/, /x2="1" y2="1"/, /x2="2" y2="2"/],
  },
  {
    name: "else branch of non-constant if",
    source: `
      Layout "ElseTest" size [100, 100] {
        let x = 10;
        if (x < 5) { Wall w1 from [0,0] to [1,1]; }
        else { Wall w2 from [0,0] to [2,2]; }
      }`,
    expected: [/x2="2" y2="2"/],
  },
];

describe("The Generator", () => {
  for (const fixture of fixtures) {
    it(`generates correct SVG for ${fixture.name}`, () => {
      const output = generate(analyze(parse(fixture.source)));
      fixture.expected.forEach((pattern) => {
        assert.match(output, pattern);
      });
    });
  }

  it("handles multiple layouts by executing all program statements", () => {
    const source = `
      Layout "L1" size [100, 100] { Wall w from [0,0] to [10,10]; }
      Layout "L2" size [100, 100] { place Chair at [20,20]; }
    `;
    const output = generate(analyze(parse(source)));
    assert.match(output, /<line/);
    assert.match(output, /<rect/);
  });

  it("properly evaluates nested properties in Props", () => {
    const source = `
      let themeColor = #ff0000;
      Layout "Styled" size [100, 100] {
        place Bed at [50, 50] [color: themeColor, label: "Master"];
      }
    `;
    const output = generate(analyze(parse(source)));
    assert.match(output, /fill="#ff0000"/);
    // Bed geometry: size 40 -> w=60, h=40. x = 50 - 30 = 20, y = 50 - 20 = 30
    assert.match(output, /<rect x="20" y="30" width="60" height="40"/);
    // Pillow: x = 20+5 = 25, y = 30+5 = 35. w=20, h=40-10=30
    assert.match(output, /<rect x="25" y="35" width="20" height="30"/);
  });

  it("handles programs with no layouts gracefully", () => {
    const source = "let x = 10;";
    const output = generate(analyze(parse(source)));
    assert.ok(output.includes("<svg"));
  });

  it("ensures walls have round linecaps for clean joins", () => {
    const source = `Layout "L" size [100, 100] { Wall w from [0,0] to [10,10]; }`;
    const output = generate(analyze(parse(source)));
    assert.match(output, /stroke-linecap="round"/);
  });

  it("covers all literal types in evaluate()", () => {
    const program = core.program(null, [
      core.layout(
        "Test",
        [core.intLiteral(100n), core.intLiteral(100n)],
        [
          core.variableDeclaration(
            core.variable("b", false, core.booleanType),
            core.booleanLiteral(true),
          ),
          core.variableDeclaration(
            core.variable("s", false, core.stringType),
            core.stringLiteral("hello"),
          ),
          core.variableDeclaration(
            core.variable("c", false, core.colorType),
            core.colorLiteral("#ffffff"),
          ),
        ],
      ),
    ]);
    const output = generate(program);
    assert.ok(output.includes("<svg"));
  });

  it("handles null statements in execute()", () => {
    const program = core.program(null, [
      core.layout("L", [core.intLiteral(100n), core.intLiteral(100n)], [null]),
    ]);
    const output = generate(program);
    assert.ok(output.includes("<svg"));
  });

  it("covers all furniture archetypes", () => {
    const source = `
      Layout "Archetypes" size [500, 500] {
        place Table at [50, 50];
        place Desk at [150, 150];
        place Sink at [250, 250];
        place Stool at [350, 350];
      }
    `;
    const output = generate(analyze(parse(source)));
    assert.match(output, /<rect.*rx="2"/); // Table/Desk
    assert.match(output, /<circle.*r="14"/); // Sink circle (20 * 0.7)
    assert.match(output, /<circle.*r="20"/); // Stool circle
  });

  it("covers Variable value fallback in evaluate()", () => {
    const v = core.variable("v", false, core.intType);
    v.value = 42n; // Manually add a value
    const program = core.program(null, [
      core.layout(
        "L",
        [core.intLiteral(100n), core.intLiteral(100n)],
        [core.furniture("Chair", [v, v], {})],
      ),
    ]);
    const output = generate(program);
    assert.match(output, /cx="42" cy="42"/);
  });

  it("covers bigint in evaluate()", () => {
    const program = core.program(null, [
      core.layout(
        "L",
        [core.intLiteral(100n), core.intLiteral(100n)],
        [core.furniture("Chair", [42n, 42n], {})],
      ),
    ]);
    const output = generate(program);
    assert.match(output, /cx="42" cy="42"/);
  });

  it("covers non-constant unary and conditional", () => {
    const source = `
      Layout "NonConst" size [100, 100] {
        let x = false;
        let y = 10.0;
        let b = !x; // Not folded because x is variable
        let n = -y; // Not folded because y is variable
        let c = x ? 1.0 : 2.0;
        if (b) { Wall w from [0, 0] to [c, n]; }
      }
    `;
    const output = generate(analyze(parse(source)));
    assert.match(output, /x2="2" y2="-10"/);
  });

  it("covers undefined in evaluate()", () => {
    const program = core.program(null, [
      core.layout(
        "L",
        [core.intLiteral(100n), core.intLiteral(100n)],
        [core.furniture("Chair", [null, null], {})],
      ),
    ]);
    // Manually pass undefined to evaluate via a mock node if possible
    // Or just rely on the fact that furniture at[0] can be undefined
    const output = generate(program);
    assert.ok(output.includes("<svg"));
  });

  it("covers default cases in evaluate()", () => {
    // Manually construct an AST with an unknown binary operator
    const program = core.program(null, [
      core.layout(
        "UnknownOp",
        [core.intLiteral(100n), core.intLiteral(100n)],
        [
          core.variableDeclaration(core.variable("x", false, core.floatType), {
            kind: "BinaryExpression",
            op: "??",
            left: core.intLiteral(1n),
            right: core.intLiteral(2n),
          }),
          core.variableDeclaration(core.variable("y", false, core.anyType), {
            kind: "UnknownKind",
          }),
        ],
      ),
    ]);
    const output = generate(program);
    assert.ok(output.includes("<svg"));
  });

  it("covers string concatenation in evaluate()", () => {
    const program = core.program(null, [
      core.layout(
        "L",
        [core.intLiteral(100n), core.intLiteral(100n)],
        [
          core.variableDeclaration(
            core.variable("s", true, core.stringType),
            core.stringLiteral("Ex"),
          ),
          core.variableDeclaration(
            core.variable("t", true, core.stringType),
            core.binary(
              "+",
              core.variable("s", true, core.stringType),
              core.stringLiteral("hibit"),
              core.stringType,
            ),
          ),
        ],
      ),
    ]);
    const output = generate(program);
    assert.ok(output.includes("<svg"));
  });

  it("covers numeric addition in evaluate()", () => {
    const program = core.program(null, [
      core.layout(
        "L",
        [core.intLiteral(100n), core.intLiteral(100n)],
        [
          core.variableDeclaration(
            core.variable("x", true, core.intType),
            core.intLiteral(1n),
          ),
          core.variableDeclaration(
            core.variable("y", true, core.intType),
            core.binary(
              "+",
              core.variable("x", true, core.intType),
              core.intLiteral(2n),
              core.intType,
            ),
          ),
        ],
      ),
    ]);
    const output = generate(program);
    assert.ok(output.includes("<svg"));
  });

  it("covers non-array statements in execute()", () => {
    const program = core.program(null, [
      core.layout(
        "L",
        [core.intLiteral(100n), core.intLiteral(100n)],
        core.variableDeclaration(
          core.variable("x", false, core.intType),
          core.intLiteral(1n),
        ),
      ),
    ]);
    const output = generate(program);
    assert.ok(output.includes("<svg"));
  });
});
