#! /usr/bin/env node

/**
 * Swatch CLI
 *
 * This is the entry point for the Swatch compiler when run from the command line.
 * It handles file reading, orchestrates the compilation phases, and manages
 * terminal output (including error aesthetics).
 */

import * as fs from "node:fs/promises";
import stringify from "graph-stringify";
import compile from "./compiler.js";

const HELP_MESSAGE = `Swatch Compiler
-----------------------------------------
Usage: node swatch.js <filename> <target>

Targets:
  parsed    - Checks for syntax errors
  analyzed  - Outputs the decorated AST
  optimized - Outputs the constant-folded AST
  svg       - Generates the final SVG blueprint
-----------------------------------------`;

/**
 * Main process loop.
 * Resolves arguments, reads source files, and prints resulting artifacts.
 */
async function main() {
  if (process.argv.length !== 4) {
    console.log(HELP_MESSAGE);
    return;
  }

  const [, , filename, target] = process.argv;

  try {
    const source = await fs.readFile(filename, "utf-8");
    const result = compile(source, target);

    // Structural outputs (ASTs) are printed as serialized graphs.
    // Textual outputs (SVG, 'Syntax ok') are printed directly.
    if (typeof result === "object") {
      console.log(stringify(result, "kind"));
    } else {
      console.log(result);
    }
  } catch (error) {
    // Report errors in bold red for better CLI visibility.
    console.error(
      `\x1b[31m\x1b[1mError:\x1b[0m \x1b[31m${error.message}\x1b[0m`,
    );
    process.exitCode = 1;
  }
}

main();
