import fs from "node:fs";
import * as ohm from "ohm-js";
import * as core from "./core.js";

const grammar = ohm.grammar(fs.readFileSync("src/swatch.ohm"));

const builder = grammar.createSemantics().addOperation("ast", {
  Program(layouts) {
    return new core.Program(layouts.ast());
  },
  Layout(_layout, name, _open, body, _close) {
    return new core.Layout(name.ast(), body.ast());
  },
  Wall(_wall, id, _from, p1, _to, p2) {
    return new core.Wall(id.ast(), p1.ast(), p2.ast());
  },
  Place(_place, id, _at, p) {
    return new core.Furniture(id.ast(), p.ast());
  },
  Point(_open, x, _comma, y, _close) {
    return [x.ast(), y.ast()];
  },
  string(_open, chars, _close) {
    return chars.sourceString;
  },
  id(first, rest) {
    return first.sourceString + rest.sourceString;
  },
  num(digits) {
    return Number(this.sourceString);
  },
  _iter(...children) {
    return children.map((c) => c.ast());
  },
});

export default function parse(sourceCode) {
  const match = grammar.match(sourceCode);
  if (match.failed()) {
    throw new Error(match.message);
  }
  return builder(match).ast();
}
