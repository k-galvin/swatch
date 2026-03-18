import * as core from "./core.js";

export default function analyze(match) {
  const context = { layoutNames: new Set() };

  function must(condition, message, at) {
    if (!condition) {
      const prefix = at.source.getLineAndColumnMessage();
      throw new Error(`${prefix}${message}`);
    }
  }

  const builder = match.matcher.grammar.createSemantics().addOperation("rep", {
    Program(metadata, layouts) {
      return core.program(metadata.rep()[0] ?? null, layouts.rep());
    },

    _iter(...children) {
      return children.map((c) => c.rep());
    },

    _terminal() {
      return this.sourceString;
    },

    Metadata(_designer, authorNode, _date, dateNode) {
      return {
        author: authorNode.rep().slice(1, -1),
        date: dateNode.rep().slice(1, -1),
      };
    },

    Layout(
      _layout,
      idNode,
      _szKey,
      _openS,
      list,
      _closeS,
      _openB,
      body,
      _closeB,
    ) {
      let name = idNode.rep();

      // This branch is now hit because the string rule returns raw quotes
      if (name.startsWith('"')) {
        name = name.slice(1, -1);
      }

      must(
        !context.layoutNames.has(name),
        `Layout ${name} already declared`,
        idNode,
      );
      context.layoutNames.add(name);

      const size = list.asIteration().children.map((c) => c.rep());
      const layoutBody = body.rep();

      for (const item of layoutBody) {
        if (item.kind === "Furniture") {
          const [x, y] = item.at;
          const [w, h] = size;
          must(
            x >= 0 && x <= w && y >= 0 && y <= h,
            `Furniture ${item.type} out of bounds`,
            idNode,
          );
        }
      }
      return core.layout(name, size, layoutBody);
    },

    Wall(_wall, id, _f, _o1, fList, _c1, _t, _o2, tList, _c2, props) {
      return core.wall(
        id.rep(),
        fList.asIteration().children.map((c) => c.rep()),
        tList.asIteration().children.map((c) => c.rep()),
        props.rep()[0] ?? {},
      );
    },

    Furniture(_place, id, _at, _open, list, _close, props) {
      return core.furniture(
        id.rep(),
        list.asIteration().children.map((c) => c.rep()),
        props.rep()[0] ?? {},
      );
    },

    Props(_open, list, _close) {
      return Object.fromEntries(
        list.asIteration().children.map((c) => c.rep()),
      );
    },

    Prop(id, _colon, val) {
      return [id.rep(), val.rep()];
    },

    number_float(_sign, _whole, _dot, _fraction) {
      return parseFloat(this.sourceString);
    },

    number_int(_sign, _whole) {
      return parseFloat(this.sourceString);
    },

    string(_open, _chars, _close) {
      return this.sourceString;
    },

    hex(_hash, _digits) {
      return this.sourceString;
    },

    id(first, rest) {
      const parts = [first.rep(), ...rest.children.map((c) => c.rep())];
      return parts.join("");
    },
  });

  return builder(match).rep();
}
