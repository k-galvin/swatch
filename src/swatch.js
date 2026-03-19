#! /usr/bin/env node
import * as fs from "node:fs/promises";
import stringify from "graph-stringify";
import compile from "./compiler.js";

const help = `Swatch compiler
Syntax: swatch <filename> <outputType>

Types: parsed, analyzed, optimized, svg`;

async function compileFromFile(filename, outputType) {
  try {
    const buffer = await fs.readFile(filename);
    const compiled = compile(buffer.toString(), outputType);
    console.log(stringify(compiled, "kind") || compiled);
  } catch (e) {
    console.error(`\u001b[31m${e}\u001b[39m`);
    process.exitCode = 1;
  }
}

if (process.argv.length !== 4) {
  console.log(help);
} else {
  compileFromFile(process.argv[2], process.argv[3]);
}
