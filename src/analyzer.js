import * as core from "./core.js";

class Context {
  constructor({ parent = null, locals = new Map(), inLoop = false, function: f = null }) {
    Object.assign(this, { parent, locals, inLoop, function: f });
  }
  add(name, entity) {
    this.locals.set(name, entity);
  }
  lookup(name) {
    return this.locals.get(name) || this.parent?.lookup(name);
  }
  static root() {
    return new Context({ locals: new Map(Object.entries(core.standardLibrary)) });
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
    must(!context.lookup(name), `Identifier ${name} already declared`, at);
  }

  function mustHaveBeenFound(entity, name, at) {
    must(entity, `Identifier ${name} not declared`, at);
  }

  function equivalent(t1, t2) {
    return t1 === t2 || (!!t1?.kind && t1.kind === t2?.kind);
  }

  function assignable(from, to) {
    return (
      equivalent(from, to) ||
      (from === core.intType && to === core.floatType) ||
      to === core.anyType
    );
  }

  function mustHaveNumericType(e, at) {
    must(assignable(e.type, core.floatType), "Expected a number", at);
  }

  function mustHaveBooleanType(e, at) {
    must(equivalent(e.type, core.booleanType), "Expected a boolean", at);
  }

  function mustBothHaveTheSameType(e1, e2, at) {
    must(equivalent(e1.type, e2.type), "Operands do not have the same type", at);
  }

  function mustBeAssignable(e, { toType: type }, at) {
    const fromStr = e.type.kind.replace("Type", "").toLowerCase();
    const toStr = type.kind.replace("Type", "").toLowerCase();
    must(assignable(e.type, type), `Cannot assign a ${fromStr} to a ${toStr}`, at);
  }

  const builder = match.matcher.grammar.createSemantics().addOperation("rep", {
    Program(metadata, decls) {
      return core.program(metadata.rep()[0] ?? null, decls.rep());
    },

    _iter(...children) {
      return children.map(c => c.rep());
    },

    _terminal() {
      return this.sourceString;
    },

    Metadata(_designer, authorNode, _date, dateNode) {
      return {
        author: authorNode.rep(),
        date: dateNode.rep(),
      };
    },

    LayoutDecl(_layout, idNode, _szKey, point, block) {
      const name = idNode.rep();
      mustNotAlreadyBeDeclared(name, { at: idNode });
      const layoutEntity = core.layout(name);
      context.add(name, layoutEntity);
      
      context = context.newChildContext({ inLoop: false });
      const size = point.rep();
      const body = block.rep();
      context = context.parent;

      layoutEntity.size = size;
      layoutEntity.body = body;
      return layoutEntity;
    },

    VarDecl(modifier, id, _eq, exp, _semicolon) {
      const initializer = exp.rep();
      const mutable = modifier.sourceString === "let";
      const variable = core.variable(id.sourceString, mutable, initializer.type);
      mustNotAlreadyBeDeclared(id.sourceString, { at: id });
      context.add(id.sourceString, variable);
      return core.variableDeclaration(variable, initializer);
    },

    ComponentDecl(_comp, id, _open, params, _close, block) {
      const name = id.sourceString;
      mustNotAlreadyBeDeclared(name, { at: id });
      const component = core.component(name);
      context.add(name, component);

      context = context.newChildContext({ inLoop: false });
      component.params = params.asIteration().children.map(p => p.rep());
      component.body = block.rep();
      context = context.parent;
      return core.componentDeclaration(component);
    },

    Param(id, _colon, type) {
      const param = core.variable(id.sourceString, false, type.rep());
      mustNotAlreadyBeDeclared(param.name, { at: id });
      context.add(param.name, param);
      return param;
    },

    Type(t) {
      const type = context.lookup(t.sourceString);
      mustHaveBeenFound(type, t.sourceString, { at: t });
      return type;
    },

    Block(_open, stmts, _close) {
      return stmts.children.map(s => s.rep());
    },

    WallStmt(_wall, id, _from, p1, _to, p2, props) {
      return core.wall(id.sourceString, p1.rep(), p2.rep(), props.rep()[0] ?? {});
    },

    PlaceStmt(_place, id, _at, p, props) {
      return core.furniture(id.sourceString, p.rep(), props.rep()[0] ?? {});
    },

    AssignStmt(id, _eq, exp, _semicolon) {
      const target = context.lookup(id.sourceString);
      mustHaveBeenFound(target, id.sourceString, { at: id });
      const source = exp.rep();
      mustBeAssignable(source, { toType: target.type }, { at: exp });
      return core.assignment(target, source);
    },

    CallStmt(id, _open, args, _close, _semicolon) {
      const callee = context.lookup(id.sourceString);
      mustHaveBeenFound(callee, id.sourceString, { at: id });
      return core.call(callee, args.asIteration().children.map(a => a.rep()));
    },

    LoopStmt_repeat(_repeat, exp, block) {
      const count = exp.rep();
      mustHaveNumericType(count, { at: exp });
      context = context.newChildContext({ inLoop: true });
      const body = block.rep();
      context = context.parent;
      return core.repeatStatement(count, body);
    },

    LoopStmt_range(_for, id, _in, low, op, high, block) {
      const [l, h] = [low.rep(), high.rep()];
      mustHaveNumericType(l, { at: low });
      mustHaveNumericType(h, { at: high });
      const iterator = core.variable(id.sourceString, false, core.floatType);
      context = context.newChildContext({ inLoop: true });
      context.add(id.sourceString, iterator);
      const body = block.rep();
      context = context.parent;
      return core.forRangeStatement(iterator, l, op.sourceString, h, body);
    },

    Point(_open, e1, _comma, e2, _close) {
      return [e1.rep(), e2.rep()];
    },

    Props(_open, list, _close) {
      return Object.fromEntries(list.asIteration().children.map(c => c.rep()));
    },

    Prop(id, _colon, exp) {
      return [id.sourceString, exp.rep()];
    },

    Exp_conditional(test, _q, e1, _c, e2) {
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
      return core.binary(op.rep(), v1, v2, core.booleanType);
    },

    Exp4_add(e1, op, e2) {
      const [v1, v2] = [e1.rep(), e2.rep()];
      mustHaveNumericType(v1, { at: e1 });
      mustBothHaveTheSameType(v1, v2, { at: op });
      return core.binary(op.rep(), v1, v2, v1.type);
    },

    Exp5_multiply(e1, op, e2) {
      const [v1, v2] = [e1.rep(), e2.rep()];
      mustHaveNumericType(v1, { at: e1 });
      mustBothHaveTheSameType(v1, v2, { at: op });
      return core.binary(op.rep(), v1, v2, v1.type);
    },

    Exp6_power(e1, op, e2) {
      const [v1, v2] = [e1.rep(), e2.rep()];
      mustHaveNumericType(v1, { at: e1 });
      mustBothHaveTheSameType(v1, v2, { at: op });
      return core.binary("**", v1, v2, v1.type);
    },
    Exp7_unary(op, e1) {
      const v = e1.rep();
      const opStr = op.sourceString;
      if (opStr === "-") mustHaveNumericType(v, { at: e1 });
      if (opStr === "!") mustHaveBooleanType(v, { at: e1 });
      return core.unary(opStr, v, v.type);
    },

    Exp8_call(id, _open, args, _close) {
      const callee = context.lookup(id.sourceString);
      mustHaveBeenFound(callee, id.sourceString, { at: id });
      return core.call(callee, args.asIteration().children.map(a => a.rep()));
    },

    Exp8_id(id) {
      const entity = context.lookup(id.sourceString);
      mustHaveBeenFound(entity, id.sourceString, { at: id });
      return entity;
    },

    Exp8_parens(_open, exp, _close) {
      return exp.rep();
    },

    true_keyword(_) { return true; },
    false_keyword(_) { return false; },
    intlit(_) { return BigInt(this.sourceString); },
    floatlit(_whole, _point, _fraction, _e, _sign, _exponent) { return parseFloat(this.sourceString); },
    stringlit(_open, _chars, _close) { return this.sourceString.slice(1, -1); },
    hex(_hash, _digits) { return this.sourceString; },
    
    id(_first, _rest) { return this.sourceString; },
    name(n) { return n.rep(); },
  });

  return builder(match).rep();
}
