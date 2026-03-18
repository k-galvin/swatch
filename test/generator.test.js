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
        place Table at [250, 250] [color: #a52a2a] 
      }`,
    expected: [
      /<!-- Designer: Kate, Date: 2026-03-17 -->/,
      /<line id="W1_2" x1="0" y1="0" x2="100" y2="0" stroke="#000000" stroke-width="10" stroke-linecap="round" \/>/,
      /<circle id="Table_3" cx="250" cy="250" r="12" fill="#a52a2a" \/>/,
      /<text x="250" y="275".*>Table<\/text>/,
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
        /fill="#3498db"/
    ],
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
        { kind: "Layout", name: "L1", size: [100, 100], intrinsic: true, body: [
          { kind: "Something", intrinsic: false },
          { kind: "Wall", name: "W1", from: [0, 0], to: [10, 10], intrinsic: true },
          { kind: "Furniture", type: "Chair", at: [5, 5], intrinsic: true },
          { kind: "Wall", from: [10, 10], to: [20, 20], intrinsic: true }
        ]},
        { kind: "Other", intrinsic: false }
      ]
    };
    const output = generate(program);
    assert.match(output, /id="L1_1"/);
    assert.match(output, /id="W1_2"/);
    assert.match(output, /id="Chair_3"/);
    assert.match(output, /id="Wall_4"/);
    assert.strictEqual(output.includes("id=\"Other\""), false);
  });
});
