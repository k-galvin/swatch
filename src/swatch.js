#! /usr/bin/env node

import * as fs from "node:fs/promises";
import stringify from "graph-stringify";
import compile from "./compiler.js";

const help = `Swatch Compiler
-----------------------------------------
Usage: node swatch.js <filename> <target>

Targets:
  parsed    - Checks for syntax errors
  analyzed  - Outputs the decorated AST
  optimized - Outputs the constant-folded AST
  svg       - Generates the final SVG blueprint
-----------------------------------------`;

async function main() {
  // Guard clause for arguments
  if (process.argv.length !== 4) {
    console.log(help);
    return;
  }

  const [, , filename, target] = process.argv;

  try {
    const source = await fs.readFile(filename, "utf-8");
    const compiled = compile(source, target);

    // If the output is an object (AST), stringify it.
    // Otherwise, print the raw output (SVG or "Syntax ok").
    if (typeof compiled === "object") {
      console.log(stringify(compiled, "kind"));
    } else {
      console.log(compiled);
    }
  } catch (e) {
    console.error(`\x1b[31m\x1b[1mError:\x1b[0m \x1b[31m${e.message}\x1b[0m`);
    process.exitCode = 1;
  }
}

main();
