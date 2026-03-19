import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";

describe("The CLI", () => {
  const filename = "test-temp.swatch";
  const source = "Layout L1 size [100, 100] { }";

  it("prints help when no arguments are provided", () => {
    const output = execSync("node src/swatch.js").toString();
    assert.match(output, /Swatch compiler/);
  });

  it("compiles a file to parsed", () => {
    writeFileSync(filename, source);
    try {
      const output = execSync(
        `node src/swatch.js ${filename} parsed`,
      ).toString();
      assert.match(output, /Syntax is ok/);
    } finally {
      unlinkSync(filename);
    }
  });

  it("compiles a file to analyzed", () => {
    writeFileSync(filename, source);
    try {
      const output = execSync(
        `node src/swatch.js ${filename} analyzed`,
      ).toString();
      assert.match(output, /Program/);
    } finally {
      unlinkSync(filename);
    }
  });

  it("compiles a file to svg", () => {
    writeFileSync(filename, source);
    try {
      const output = execSync(`node src/swatch.js ${filename} svg`).toString();
      assert.match(output, /<svg/);
    } finally {
      unlinkSync(filename);
    }
  });

  it("reports errors and sets exit code 1", () => {
    writeFileSync(filename, "Layout {"); // Syntax error
    try {
      assert.throws(
        () => {
          execSync(`node src/swatch.js ${filename} svg`, { stdio: "pipe" });
        },
        (e) => {
          assert.strictEqual(e.status, 1);
          assert.match(e.stderr.toString(), /\u001b\[31m/);
          return true;
        },
      );
    } finally {
      unlinkSync(filename);
    }
  });
});
