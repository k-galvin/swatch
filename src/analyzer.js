import * as core from "./core.js";

class Context {
  constructor({ parent = null, locals = new Map(), inLoop = false }) {
    Object.assign(this, { parent, locals, inLoop });
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
      context = context.newChildContext({ inLoop: false });
      const size = point.rep();
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
      context = context.newChildContext({ inLoop: false });
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
      return core.wall(
        id.sourceString,
        p1.rep(),
        p2.rep(),
        props.rep()[0] ?? {},
      );
    },

    PlaceStmt(_place, id, _at, p, props, _semi) {
      return core.furniture(id.sourceString, p.rep(), props.rep()[0] ?? {});
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
      return [e1.rep(), e2.rep()];
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
