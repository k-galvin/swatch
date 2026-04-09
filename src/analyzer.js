import * as core from "./core.js";

class Context {
  constructor({
    parent = null,
    locals = new Map(),
    inLoop = false,
    layoutSize = null,
    placedEntities = [],
  }) {
    Object.assign(this, { parent, locals, inLoop, layoutSize, placedEntities });
  }
  add(name, entity) {
    this.locals.set(name, entity);
  }
  lookup(name) {
    return this.locals.get(name) || this.parent?.lookup(name);
  }
  static root() {
    return new Context({
      locals: new Map(Object.entries(core.standardLibrary)),
    });
  }
  newChildContext(props) {
    return new Context({ ...this, ...props, parent: this, locals: new Map() });
  }
}

export default function analyze(match) {
  let context = Context.root();

  function must(condition, message, errorLocation) {
    if (!condition) {
      const prefix = errorLocation.at.source.getLineAndColumnMessage();
      throw new Error(`${prefix}${message}`);
    }
  }

  function mustNotAlreadyBeDeclared(name, at) {
    must(!context.locals.has(name), `Identifier ${name} already declared`, at);
  }

  function mustHaveBeenFound(entity, name, at) {
    must(entity, `Identifier ${name} not declared`, at);
  }

  function equivalent(t1, t2) {
    return (
      t1 === t2 ||
      (t1?.kind === t2?.kind &&
        (t1.kind !== "ArrayType" || equivalent(t1.baseType, t2.baseType)) &&
        (t1.kind !== "OptionalType" || equivalent(t1.baseType, t2.baseType)))
    );
  }

  function assignable(from, to) {
    return (
      equivalent(from, to) ||
      (from === core.intType && to === core.floatType) ||
      to === core.anyType ||
      (to.kind === "OptionalType" && assignable(from, to.baseType))
    );
  }

  function mustHaveNumericType(e, at) {
    must(assignable(e.type, core.floatType), "Expected a number", at);
  }

  function mustHaveBooleanType(e, at) {
    must(equivalent(e.type, core.booleanType), "Expected a boolean", at);
  }

  function mustBothHaveTheSameType(e1, e2, at) {
    must(
      equivalent(e1.type, e2.type) ||
        (assignable(e1.type, core.floatType) &&
          assignable(e2.type, core.floatType)),
      "Operands do not have the same type",
      at,
    );
  }

  function mustBeAssignable(e, { toType: type }, at) {
    must(
      assignable(e.type, type),
      `Cannot assign a ${e.type.description} to a ${type.description}`,
      at,
    );
  }

  function mustBeWithinBounds(point, at, thicknessNode = null) {
    const size = context.layoutSize;
    if (!size) return;
    const [x, y] = point;
    const [w, h] = size;

    const getValue = (node) => {
      if (!node) return null;
      if (node.kind === "IntLiteral" || node.kind === "FloatLiteral")
        return Number(node.value);
      if (node.kind === "UnaryExpression" && node.op === "-") {
        const v = getValue(node.operand);
        return v !== null ? -v : null;
      }
      return null;
    };

    const xv = getValue(x);
    const yv = getValue(y);
    const wv = getValue(w);
    const hv = getValue(h);
    const tv = getValue(thicknessNode) ?? 0;
    const radius = tv / 2;

    if (xv !== null && wv !== null) {
      must(
        xv - radius >= 0 && xv + radius <= wv,
        `X coordinate ${xv} (with radius ${radius}) out of layout bounds [0, ${wv}]`,
        at,
      );
    }
    if (yv !== null && hv !== null) {
      must(
        yv - radius >= 0 && yv + radius <= hv,
        `Y coordinate ${yv} (with radius ${radius}) out of layout bounds [0, ${hv}]`,
        at,
      );
    }
  }

  function mustNotOverlap(entity, at) {
    const getValue = (node) => {
      if (!node) return null;
      if (node.kind === "IntLiteral" || node.kind === "FloatLiteral")
        return Number(node.value);
      if (node.kind === "UnaryExpression" && node.op === "-") {
        const v = getValue(node.operand);
        return v !== null ? -v : null;
      }
      return null;
    };

    const getBounds = (e) => {
      if (e.kind === "Wall") {
        const x1 = getValue(e.from[0]);
        const y1 = getValue(e.from[1]);
        const x2 = getValue(e.to[0]);
        const y2 = getValue(e.to[1]);
        const t = getValue(e.props?.thickness) ?? 8;
        if (x1 === null || y1 === null || x2 === null || y2 === null)
          return null;
        const r = t / 2;
        return {
          minX: Math.min(x1, x2) - r,
          maxX: Math.max(x1, x2) + r,
          minY: Math.min(y1, y2) - r,
          maxY: Math.max(y1, y2) + r,
        };
      } else if (e.kind === "Furniture") {
        const x = getValue(e.at[0]);
        const y = getValue(e.at[1]);
        const s = getValue(e.props?.size ?? e.props?.width) ?? 40;
        if (x === null || y === null) return null;
        const r = s / 2;
        return { minX: x - r, maxX: x + r, minY: y - r, maxY: y + r };
      }
      return null;
    };

    const newBounds = getBounds(entity);
    if (!newBounds) return;

    for (const existing of context.placedEntities) {
      // Rule: Walls can overlap with other walls (for corner joins)
      if (entity.kind === "Wall" && existing.kind === "Wall") continue;

      // Rule: Furniture can overlap with other furniture
      if (entity.kind === "Furniture" && existing.kind === "Furniture")
        continue;

      // Integrated Exception: Sinks, Pillars, etc. can overlap with walls/counters
      const integrated = [
        "sink",
        "faucet",
        "art",
        "node",
        "dot",
        "pillar",
        "post",
        "section",
        "tv",
        "bench",
      ];
      const isIntegrated = (e) => {
        const typeStr = String(
          typeof e.type === "string" ? e.type : e.type.name,
        ).toLowerCase();
        return integrated.some((t) => typeStr.includes(t));
      };

      if (entity.kind === "Furniture" && isIntegrated(entity)) continue;
      if (existing.kind === "Furniture" && isIntegrated(existing)) continue;

      const existingBounds = getBounds(existing);
      if (!existingBounds) continue;

      const overlap = !(
        newBounds.maxX <= existingBounds.minX ||
        newBounds.minX >= existingBounds.maxX ||
        newBounds.maxY <= existingBounds.minY ||
        newBounds.minY >= existingBounds.maxY
      );

      if (overlap) {
        const name1 =
          entity.name ||
          (typeof entity.type === "string" ? entity.type : entity.type.name) ||
          "Object";
        const name2 =
          existing.name ||
          (typeof existing.type === "string"
            ? existing.type
            : existing.type.name) ||
          "Object";
        must(
          false,
          `Spatial collision detected: '${name1}' overlaps with wall '${name2}'`,
          at,
        );
      }
    }
    context.placedEntities.push(entity);
  }

  const builder = match.matcher.grammar.createSemantics().addOperation("rep", {
    Program(metadata, stmts) {
      return core.program(metadata.rep()[0] ?? null, stmts.rep());
    },

    Metadata(_designer, authorNode, _date, dateNode) {
      _designer.rep();
      _date.rep();
      return {
        author: authorNode.rep().value,
        date: dateNode.rep().value,
      };
    },

    id(_first, _rest) {
      return this.sourceString;
    },

    Statement_assign(idNode, _eq, exp, _semi) {
      const target = idNode.rep();
      const source = exp.rep();
      must(target.mutable, "Cannot assign to a constant", { at: idNode });
      mustBeAssignable(source, { toType: target.type }, { at: exp });
      return core.assignment(target, source);
    },

    Statement_call(idNode, _open, args, _close, _semi) {
      const name = idNode.rep();
      const callee = context.lookup(name);
      mustHaveBeenFound(callee, name, { at: idNode });
      const parsedArgs = args.asIteration().children.map((a) => a.rep());
      if (callee.kind === "Component") {
        must(
          parsedArgs.length === callee.params.length,
          `Expected ${callee.params.length} arguments but got ${parsedArgs.length}`,
          { at: args },
        );
        parsedArgs.forEach((arg, i) =>
          mustBeAssignable(
            arg,
            { toType: callee.params[i].type },
            { at: args },
          ),
        );
      }
      const type = callee.kind === "Component" ? core.voidType : callee.type;
      return core.call(callee, parsedArgs, type);
    },

    Statement_if(_if, test, consequent, _else, alternate) {
      const t = test.rep();
      mustHaveBooleanType(t, { at: test });
      context = context.newChildContext();
      const c = consequent.rep();
      context = context.parent;
      context = context.newChildContext();
      const alt = alternate.rep()[0] ?? [];
      const a = Array.isArray(alt) ? alt : [alt];
      context = context.parent;
      return core.ifStatement(t, c, a);
    },

    Statement_repeat(_repeat, exp, block) {
      const count = exp.rep();
      mustHaveNumericType(count, { at: exp });
      context = context.newChildContext({ inLoop: true });
      const body = block.rep();
      context = context.parent;
      return core.repeatStatement(count, body);
    },

    Statement_range(_for, idNode, _in, low, op, high, block) {
      const [l, h] = [low.rep(), high.rep()];
      mustHaveNumericType(l, { at: low });
      mustHaveNumericType(h, { at: high });
      const name = idNode.rep();
      const iterator = core.variable(name, false, core.floatType);
      context = context.newChildContext({ inLoop: true });
      context.add(name, iterator);
      const body = block.rep();
      context = context.parent;
      return core.forRangeStatement(iterator, l, op.sourceString, h, body);
    },

    Statement_break(_break, _semi) {
      must(context.inLoop, "Break can only appear in a loop", { at: _break });
      return core.breakStatement;
    },

    VarDecl(modifier, id, _colon, type, _eq, exp, _semi) {
      const initializer = exp.rep();
      const specifiedType = type.rep()[0] ?? initializer.type;
      mustBeAssignable(initializer, { toType: specifiedType }, { at: exp });
      const mutable = modifier.sourceString === "let";
      const variable = core.variable(id.sourceString, mutable, specifiedType);
      mustNotAlreadyBeDeclared(id.sourceString, { at: id });
      context.add(id.sourceString, variable);
      return core.variableDeclaration(variable, initializer);
    },

    LayoutDecl(_layout, idNode, _size, point, block) {
      const name = idNode.sourceString.replace(/"/g, "");
      const layoutEntity = core.layout(name);
      const size = point.rep();
      context = context.newChildContext({
        inLoop: false,
        layoutSize: size,
        placedEntities: [],
      });
      const body = block.rep();
      context = context.parent;
      layoutEntity.size = size;
      layoutEntity.body = body;
      return layoutEntity;
    },

    ComponentDecl(_comp, id, _open, params, _close, block) {
      const component = core.component(id.sourceString);
      mustNotAlreadyBeDeclared(id.sourceString, { at: id });
      context.add(id.sourceString, component);
      context = context.newChildContext({
        inLoop: false,
        layoutSize: null,
        placedEntities: [],
      });
      component.params = params.asIteration().children.map((p) => p.rep());
      component.body = block.rep();
      context = context.parent;
      return component;
    },

    Param(id, _colon, type) {
      const param = core.variable(id.sourceString, false, type.rep());
      mustNotAlreadyBeDeclared(param.name, { at: id });
      context.add(param.name, param);
      return param;
    },

    WallStmt(_wall, id, _from, p1, _to, p2, props, _semi) {
      const from = p1.rep();
      const to = p2.rep();
      const properties = props.rep()[0] ?? {};
      const thickness = properties.thickness;
      mustBeWithinBounds(from, { at: p1 }, thickness);
      mustBeWithinBounds(to, { at: p2 }, thickness);
      const wall = core.wall(id.sourceString, from, to, properties);
      mustNotOverlap(wall, { at: id });
      return wall;
    },

    PlaceStmt(_place, id, _at, p, props, _semi) {
      const at = p.rep();
      const properties = props.rep()[0] ?? {};
      const size = properties.size ?? properties.width ?? core.intLiteral(40n);
      mustBeWithinBounds(at, { at: p }, size);

      const entity = context.lookup(id.sourceString);
      const type =
        entity?.kind === "Variable" && entity.type === core.stringType
          ? entity
          : id.sourceString;

      const furniture = core.furniture(type, at, properties);
      mustNotOverlap(furniture, { at: id });
      return furniture;
    },

    Type_array(_open, type, _close) {
      return core.arrayType(type.rep());
    },
    Type_optional(type, _q) {
      return core.optionalType(type.rep());
    },
    Type_id(id) {
      const t = context.lookup(id.sourceString);
      mustHaveBeenFound(t, id.sourceString, { at: id });
      return t;
    },

    Point(_open, e1, _comma, e2, _close) {
      const [v1, v2] = [e1.rep(), e2.rep()];
      mustHaveNumericType(v1, { at: e1 });
      mustHaveNumericType(v2, { at: e2 });
      return [v1, v2];
    },
    Props(_open, list, _close) {
      return Object.fromEntries(
        list.asIteration().children.map((c) => c.rep()),
      );
    },
    Prop(id, _colon, exp) {
      return [id.sourceString, exp.rep()];
    },

    Exp_conditional(test, _q, e1, _colon, e2) {
      const t = test.rep();
      mustHaveBooleanType(t, { at: test });
      const [v1, v2] = [e1.rep(), e2.rep()];
      mustBothHaveTheSameType(v1, v2, { at: e1 });
      return core.conditional(t, v1, v2, v1.type);
    },

    Exp1_or(e1, _op, e2) {
      const [v1, v2] = [e1.rep(), e2.rep()];
      mustHaveBooleanType(v1, { at: e1 });
      mustHaveBooleanType(v2, { at: e2 });
      return core.binary("||", v1, v2, core.booleanType);
    },

    Exp2_and(e1, _op, e2) {
      const [v1, v2] = [e1.rep(), e2.rep()];
      mustHaveBooleanType(v1, { at: e1 });
      mustHaveBooleanType(v2, { at: e2 });
      return core.binary("&&", v1, v2, core.booleanType);
    },

    Exp3_compare(e1, op, e2) {
      const [v1, v2] = [e1.rep(), e2.rep()];
      mustBothHaveTheSameType(v1, v2, { at: op });
      return core.binary(op.sourceString, v1, v2, core.booleanType);
    },

    Exp4_add(e1, op, e2) {
      const [v1, v2] = [e1.rep(), e2.rep()];
      if (v1.type === core.stringType || v2.type === core.stringType) {
        return core.binary("+", v1, v2, core.stringType);
      }
      mustHaveNumericType(v1, { at: e1 });
      mustBothHaveTheSameType(v1, v2, { at: op });
      return core.binary(op.sourceString, v1, v2, v1.type);
    },

    Exp5_multiply(e1, op, e2) {
      const [v1, v2] = [e1.rep(), e2.rep()];
      mustHaveNumericType(v1, { at: e1 });
      mustBothHaveTheSameType(v1, v2, { at: op });
      return core.binary(op.sourceString, v1, v2, v1.type);
    },

    Exp6_power(e1, _op, e2) {
      const [v1, v2] = [e1.rep(), e2.rep()];
      mustHaveNumericType(v1, { at: e1 });
      mustBothHaveTheSameType(v1, v2, { at: e1 });
      return core.binary("**", v1, v2, v1.type);
    },

    Exp7_unary(op, e1) {
      const v = e1.rep();
      if (op.sourceString === "-") mustHaveNumericType(v, { at: e1 });
      if (op.sourceString === "!") mustHaveBooleanType(v, { at: e1 });
      return core.unary(op.sourceString, v, v.type);
    },

    Exp8_hash(_hash, e) {
      const val = e.rep();
      return core.unary("#", val, core.intType);
    },

    Exp8_random(_random, e) {
      const val = e.rep();
      return core.unary("random", val, val.type.baseType);
    },

    Exp9(node) {
      return node.rep();
    },
    Exp9_array(_open, elements, _close) {
      return core.arrayLiteral(
        elements.asIteration().children.map((e) => e.rep()),
      );
    },
    Exp9_call(calleeNode, _open, args, _close) {
      const callee = calleeNode.rep();
      const parsedArgs = args.asIteration().children.map((a) => a.rep());
      if (callee.kind === "Component") {
        must(
          parsedArgs.length === callee.params.length,
          `Expected ${callee.params.length} arguments but got ${parsedArgs.length}`,
          { at: args },
        );
        parsedArgs.forEach((arg, i) =>
          mustBeAssignable(
            arg,
            { toType: callee.params[i].type },
            { at: args },
          ),
        );
      }
      const type = callee.kind === "Component" ? core.voidType : callee.type;
      return core.call(callee, parsedArgs, type);
    },
    Exp9_id(idNode) {
      const entity = context.lookup(idNode.sourceString);
      mustHaveBeenFound(entity, idNode.sourceString, { at: idNode });
      return entity;
    },
    Exp9_parens(_open, e, _close) {
      return e.rep();
    },
    true(_) {
      return core.booleanLiteral(true);
    },
    false(_) {
      return core.booleanLiteral(false);
    },
    intlit(_) {
      return core.intLiteral(BigInt(this.sourceString));
    },
    floatlit(_w, _d, _f, _e, _s, _ex) {
      return core.floatLiteral(parseFloat(this.sourceString));
    },
    hexlit(_) {
      return core.colorLiteral(this.sourceString);
    },
    stringlit(_open, chars, _close) {
      return core.stringLiteral(chars.sourceString);
    },

    _iter(...children) {
      return children.map((c) => c.rep());
    },
    _terminal() {
      return this.sourceString;
    },
    Block(_open, stmts, _close) {
      return stmts.children.map((s) => s.rep());
    },
  });

  return builder(match).rep();
}
