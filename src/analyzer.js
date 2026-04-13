import * as core from "./core.js";

/**
 * The Context class manages lexical scopes and spatial state during semantic analysis.
 * It tracks parent scopes, local variable bindings, loop nesting, and layout constraints.
 */
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

  /** Binds a name to an entity in the current local scope. */
  add(name, entity) {
    this.locals.set(name, entity);
  }

  /** Recursively searches for a name starting from the current scope. */
  lookup(name) {
    return this.locals.get(name) || this.parent?.lookup(name);
  }

  /** Creates the initial global context populated with the standard library. */
  static root() {
    return new Context({
      locals: new Map(Object.entries(core.standardLibrary)),
    });
  }

  /** Creates a nested scope inheriting properties from the current context. */
  newChildContext(props) {
    return new Context({ ...this, ...props, parent: this, locals: new Map() });
  }
}

/**
 * Performs semantic analysis on a match result from the parser.
 * This phase checks types, scope, and spatial constraints, producing an AST.
 */
export default function analyze(match) {
  let context = Context.root();

  /**
   * Primary validation gate. Throws a formatted error if the condition is false.
   */
  function must(condition, message, errorLocation) {
    if (!condition) {
      const prefix = errorLocation.at.source.getLineAndColumnMessage();
      throw new Error(`${prefix}${message}`);
    }
  }

  /** Extracts a numeric constant value from an AST node if possible. */
  function getValue(node) {
    if (!node) return null;
    if (node.kind === "IntLiteral" || node.kind === "FloatLiteral") {
      return Number(node.value);
    }
    if (node.kind === "UnaryExpression" && node.op === "-") {
      const operandValue = getValue(node.operand);
      return operandValue !== null ? -operandValue : null;
    }
    return null;
  }

  // --- Static Check Helpers ---

  function mustNotAlreadyBeDeclared(name, at) {
    must(!context.locals.has(name), `Identifier ${name} already declared`, at);
  }

  function mustHaveBeenFound(entity, name, at) {
    must(entity, `Identifier ${name} not declared`, at);
  }

  /** Checks for structural or nominal type equality. */
  function equivalent(type1, type2) {
    return (
      type1 === type2 ||
      (type1?.kind === type2?.kind &&
        (type1.kind !== "ArrayType" ||
          equivalent(type1.baseType, type2.baseType)) &&
        (type1.kind !== "OptionalType" ||
          equivalent(type1.baseType, type2.baseType)))
    );
  }

  /** Checks if a value of one type can be assigned to a target type. */
  function assignable(fromType, toType) {
    return (
      equivalent(fromType, toType) ||
      (fromType === core.intType && toType === core.floatType) ||
      toType === core.anyType ||
      (toType.kind === "OptionalType" && assignable(fromType, toType.baseType))
    );
  }

  function mustHaveNumericType(entity, at) {
    must(assignable(entity.type, core.floatType), "Expected a number", at);
  }

  function mustHaveBooleanType(entity, at) {
    must(equivalent(entity.type, core.booleanType), "Expected a boolean", at);
  }

  function mustBothHaveTheSameType(entity1, entity2, at) {
    must(
      equivalent(entity1.type, entity2.type) ||
        (assignable(entity1.type, core.floatType) &&
          assignable(entity2.type, core.floatType)),
      "Operands do not have the same type",
      at,
    );
  }

  function mustBeAssignable(entity, { toType }, at) {
    must(
      assignable(entity.type, toType),
      `Cannot assign a ${entity.type.description} to a ${toType.description}`,
      at,
    );
  }

  /** Validates that a point is within the current layout's dimensions. */
  function mustBeWithinBounds(point, at, thicknessNode = null) {
    const layoutSize = context.layoutSize;
    if (!layoutSize) return;
    const [x, y] = point;
    const [width, height] = layoutSize;

    const xVal = getValue(x);
    const yVal = getValue(y);
    const widthVal = getValue(width);
    const heightVal = getValue(height);
    const thicknessVal = getValue(thicknessNode) ?? 0;
    const radius = thicknessVal / 2;

    if (xVal !== null && widthVal !== null) {
      must(
        xVal - radius >= 0 && xVal + radius <= widthVal,
        `X coordinate ${xVal} (with radius ${radius}) out of layout bounds [0, ${widthVal}]`,
        at,
      );
    }
    if (yVal !== null && heightVal !== null) {
      must(
        yVal - radius >= 0 && yVal + radius <= heightVal,
        `Y coordinate ${yVal} (with radius ${radius}) out of layout bounds [0, ${heightVal}]`,
        at,
      );
    }
  }

  /**
   * Spatial Collision Check.
   * Ensures that walls and furniture do not overlap, with exemptions for
   * "integrated" items like sinks or pillars.
   */
  function mustNotOverlap(entity, at) {
    const getBounds = (e) => {
      if (e.kind === "Wall") {
        const [x1, y1] = [getValue(e.from[0]), getValue(e.from[1])];
        const [x2, y2] = [getValue(e.to[0]), getValue(e.to[1])];
        if (x1 === null || y1 === null || x2 === null || y2 === null) {
          return null;
        }
        const radius = (getValue(e.props?.thickness) ?? 8) / 2;
        return {
          minX: Math.min(x1, x2) - radius,
          maxX: Math.max(x1, x2) + radius,
          minY: Math.min(y1, y2) - radius,
          maxY: Math.max(y1, y2) + radius,
        };
      }
      const [x, y] = [getValue(e.at[0]), getValue(e.at[1])];
      if (x === null || y === null) return null;
      const radius = (getValue(e.props?.size ?? e.props?.width) ?? 40) / 2;
      return {
        minX: x - radius,
        maxX: x + radius,
        minY: y - radius,
        maxY: y + radius,
      };
    };

    const newBounds = getBounds(entity);
    if (!newBounds) return;

    const INTEGRATED_ARCHETYPES = [
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
      const type = e.type;
      const name = (typeof type === "string" ? type : type.name).toLowerCase();
      return INTEGRATED_ARCHETYPES.some((keyword) => name.includes(keyword));
    };

    if (entity.kind === "Furniture" && isIntegrated(entity)) {
      context.placedEntities.push(entity);
      return;
    }

    for (const existing of context.placedEntities) {
      // Walls can cross other walls; Furniture can cross furniture.
      // Collisions are flagged between Wall <-> Furniture.
      if (entity.kind === "Wall" && existing.kind === "Wall") continue;
      if (entity.kind === "Furniture" && existing.kind === "Furniture") {
        continue;
      }
      if (existing.kind === "Furniture" && isIntegrated(existing)) continue;

      const eb = getBounds(existing);
      if (
        !(
          newBounds.maxX <= eb.minX ||
          newBounds.minX >= eb.maxX ||
          newBounds.maxY <= eb.minY ||
          newBounds.minY >= eb.maxY
        )
      ) {
        const n1 =
          entity.name ||
          (typeof entity.type === "string" ? entity.type : entity.type.name);
        const n2 =
          existing.name ||
          (typeof existing.type === "string"
            ? existing.type
            : existing.type.name);
        must(false, `Spatial collision: '${n1}' overlaps with '${n2}'`, at);
      }
    }
    context.placedEntities.push(entity);
  }

  // --- Semantics Construction ---

  const builder = match.matcher.grammar.createSemantics().addOperation("rep", {
    Program(metadata, stmts) {
      return core.program(metadata.rep()[0] ?? null, stmts.rep());
    },

    Metadata(_designer, authorNode, _date, dateNode) {
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

    Statement_bump(exp, op, _semi) {
      const variable = exp.rep();
      mustHaveNumericType(variable, { at: exp });
      must(variable.mutable, "Cannot bump a constant", { at: exp });
      return core.bumpStatement(variable, op.sourceString);
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
      const testExp = test.rep();
      mustHaveBooleanType(testExp, { at: test });
      context = context.newChildContext();
      const consequentBlock = consequent.rep();
      context = context.parent;
      context = context.newChildContext();
      const alt = alternate.rep()[0] ?? [];
      const alternateBlock = Array.isArray(alt) ? alt : [alt];
      context = context.parent;
      return core.ifStatement(testExp, consequentBlock, alternateBlock);
    },

    Statement_while(_while, test, block) {
      const testExp = test.rep();
      mustHaveBooleanType(testExp, { at: test });
      context = context.newChildContext({ inLoop: true });
      const body = block.rep();
      context = context.parent;
      return core.whileStatement(testExp, body);
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
      const [lowExp, highExp] = [low.rep(), high.rep()];
      mustHaveNumericType(lowExp, { at: low });
      mustHaveNumericType(highExp, { at: high });
      const name = idNode.rep();
      const iterator = core.variable(name, false, core.floatType);
      context = context.newChildContext({ inLoop: true });
      context.add(name, iterator);
      const body = block.rep();
      context = context.parent;
      return core.forRangeStatement(
        iterator,
        lowExp,
        op.sourceString,
        highExp,
        body,
      );
    },

    Statement_collection(_for, idNode, _in, collectionNode, block) {
      const collection = collectionNode.rep();
      must(
        collection.type.kind === "ArrayType",
        "Expected an array for the collection loop",
        { at: collectionNode },
      );
      const name = idNode.rep();
      const iterator = core.variable(name, false, collection.type.baseType);
      context = context.newChildContext({ inLoop: true });
      context.add(name, iterator);
      const body = block.rep();
      context = context.parent;
      return core.forCollectionStatement(iterator, collection, body);
    },

    Statement_break(_break, _semi) {
      must(context.inLoop, "Break can only appear in a loop", { at: _break });
      return core.breakStatement;
    },

    VarDecl(modifier, id, _colon, type, _eq, exp, _semi) {
      const initializer = exp.rep();
      const specifiedType = type.rep()[0] ?? initializer.type;
      mustBeAssignable(initializer, { toType: specifiedType }, { at: exp });
      const isMutable = modifier.sourceString === "let";
      const variable = core.variable(id.sourceString, isMutable, specifiedType);
      mustNotAlreadyBeDeclared(id.sourceString, { at: id });
      context.add(id.sourceString, variable);
      return core.variableDeclaration(variable, initializer);
    },

    LayoutDecl(_layout, idNode, _size, point, block) {
      const name = idNode.sourceString.replace(/"/g, "");
      const layoutEntity = core.layout(name);
      const layoutSize = point.rep();
      context = context.newChildContext({
        inLoop: false,
        layoutSize,
        placedEntities: [],
      });
      const body = block.rep();
      context = context.parent;
      layoutEntity.size = layoutSize;
      layoutEntity.body = body;
      return layoutEntity;
    },

    ComponentDecl(_comp, id, _open, params, _close, block) {
      const componentEntity = core.component(id.sourceString);
      mustNotAlreadyBeDeclared(id.sourceString, { at: id });
      context.add(id.sourceString, componentEntity);
      context = context.newChildContext({
        inLoop: false,
        layoutSize: null,
        placedEntities: [],
      });
      componentEntity.params = params
        .asIteration()
        .children.map((p) => p.rep());
      componentEntity.body = block.rep();
      context = context.parent;
      return componentEntity;
    },

    Param(id, _colon, type) {
      const paramEntity = core.variable(id.sourceString, false, type.rep());
      mustNotAlreadyBeDeclared(paramEntity.name, { at: id });
      context.add(paramEntity.name, paramEntity);
      return paramEntity;
    },

    WallStmt(_wall, id, _from, p1, _to, p2, props, _semi) {
      const startPoint = p1.rep();
      const endPoint = p2.rep();
      const properties = props.rep()[0] ?? {};
      const thickness = properties.thickness;
      mustBeWithinBounds(startPoint, { at: p1 }, thickness);
      mustBeWithinBounds(endPoint, { at: p2 }, thickness);
      const wallEntity = core.wall(
        id.sourceString,
        startPoint,
        endPoint,
        properties,
      );
      mustNotOverlap(wallEntity, { at: id });
      return wallEntity;
    },

    PlaceStmt(_place, id, _at, p, props, _semi) {
      const placementPoint = p.rep();
      const properties = props.rep()[0] ?? {};
      const placementSize =
        properties.size ?? properties.width ?? core.intLiteral(40n);
      mustBeWithinBounds(placementPoint, { at: p }, placementSize);

      const entity = context.lookup(id.sourceString);
      const furnitureType =
        entity?.kind === "Variable" && entity.type === core.stringType
          ? entity
          : id.sourceString;

      const furnitureEntity = core.furniture(
        furnitureType,
        placementPoint,
        properties,
      );
      mustNotOverlap(furnitureEntity, { at: id });
      return furnitureEntity;
    },

    Type_array(_open, innerType, _close) {
      return core.arrayType(innerType.rep());
    },
    Type_optional(innerType, _question) {
      return core.optionalType(innerType.rep());
    },
    Type_id(idNode) {
      const typeEntity = context.lookup(idNode.sourceString);
      mustHaveBeenFound(typeEntity, idNode.sourceString, { at: idNode });
      return typeEntity;
    },

    Point(_open, xExpNode, _comma, yExpNode, _close) {
      const [xExp, yExp] = [xExpNode.rep(), yExpNode.rep()];
      mustHaveNumericType(xExp, { at: xExpNode });
      mustHaveNumericType(yExp, { at: yExpNode });
      return [xExp, yExp];
    },
    Props(_open, propList, _close) {
      return Object.fromEntries(
        propList.asIteration().children.map((prop) => prop.rep()),
      );
    },
    Prop(idNode, _colon, expNode) {
      return [idNode.sourceString, expNode.rep()];
    },

    Exp_conditional(test, _q, e1, _colon, e2) {
      const testExp = test.rep();
      mustHaveBooleanType(testExp, { at: test });
      const [val1, val2] = [e1.rep(), e2.rep()];
      mustBothHaveTheSameType(val1, val2, { at: e1 });
      return core.conditional(testExp, val1, val2, val1.type);
    },

    Exp1_coalesce(e1, _op, e2) {
      const [val1, val2] = [e1.rep(), e2.rep()];
      must(
        val1.type.kind === "OptionalType",
        "Coalesce operator requires an optional left operand",
        { at: e1 },
      );
      must(
        assignable(val2.type, val1.type.baseType),
        `Cannot coalesce a ${val1.type.description} with a ${val2.type.description}`,
        { at: e2 },
      );
      return core.binary("??", val1, val2, val1.type.baseType);
    },

    Exp2_or(e1, _op, e2) {
      const [val1, val2] = [e1.rep(), e2.rep()];
      mustHaveBooleanType(val1, { at: e1 });
      mustHaveBooleanType(val2, { at: e2 });
      return core.binary("||", val1, val2, core.booleanType);
    },

    Exp3_and(e1, _op, e2) {
      const [val1, val2] = [e1.rep(), e2.rep()];
      mustHaveBooleanType(val1, { at: e1 });
      mustHaveBooleanType(val2, { at: e2 });
      return core.binary("&&", val1, val2, core.booleanType);
    },

    Exp4_compare(e1, opNode, e2) {
      const [val1, val2] = [e1.rep(), e2.rep()];
      if (opNode.sourceString === "in") {
        must(
          val2.type.kind === "ArrayType",
          "The 'in' operator requires an array on the right side",
          { at: e2 },
        );
        must(
          assignable(val1.type, val2.type.baseType),
          `Cannot check if a ${val1.type.description} is in a ${val2.type.description}`,
          { at: e1 },
        );
      } else {
        mustBothHaveTheSameType(val1, val2, { at: opNode });
      }
      return core.binary(opNode.sourceString, val1, val2, core.booleanType);
    },

    Exp5_add(e1, opNode, e2) {
      const [val1, val2] = [e1.rep(), e2.rep()];
      if (val1.type === core.stringType || val2.type === core.stringType) {
        return core.binary("+", val1, val2, core.stringType);
      }
      mustHaveNumericType(val1, { at: e1 });
      mustBothHaveTheSameType(val1, val2, { at: opNode });
      return core.binary(opNode.sourceString, val1, val2, val1.type);
    },

    Exp6_multiply(e1, opNode, e2) {
      const [val1, val2] = [e1.rep(), e2.rep()];
      mustHaveNumericType(val1, { at: e1 });
      mustBothHaveTheSameType(val1, val2, { at: opNode });
      return core.binary(opNode.sourceString, val1, val2, val1.type);
    },

    Exp7_power(e1, _op, e2) {
      const [val1, val2] = [e1.rep(), e2.rep()];
      mustHaveNumericType(val1, { at: e1 });
      mustBothHaveTheSameType(val1, val2, { at: e1 });
      return core.binary("**", val1, val2, val1.type);
    },

    Exp8_unary(opNode, e1) {
      const val = e1.rep();
      if (opNode.sourceString === "-") mustHaveNumericType(val, { at: e1 });
      if (opNode.sourceString === "!") mustHaveBooleanType(val, { at: e1 });
      return core.unary(opNode.sourceString, val, val.type);
    },

    Exp9_hash(_hash, expNode) {
      const val = expNode.rep();
      return core.unary("#", val, core.intType);
    },

    Exp9_random(_random, expNode) {
      const val = expNode.rep();
      return core.unary("random", val, val.type.baseType);
    },

    Exp10(node) {
      return node.rep();
    },
    Exp10_no(_no, typeNode) {
      const type = typeNode.rep();
      return { kind: "EmptyOptionalLiteral", type: core.optionalType(type) };
    },
    Exp10_array(_open, elements, _close) {
      return core.arrayLiteral(
        elements.asIteration().children.map((element) => element.rep()),
      );
    },
    Exp10_call(calleeNode, _open, args, _close) {
      const callee = calleeNode.rep();
      const parsedArgs = args.asIteration().children.map((arg) => arg.rep());
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
      const callType =
        callee.kind === "Component" ? core.voidType : callee.type;
      return core.call(callee, parsedArgs, callType);
    },
    Exp10_id(idNode) {
      const entity = context.lookup(idNode.sourceString);
      mustHaveBeenFound(entity, idNode.sourceString, { at: idNode });
      return entity;
    },
    Exp10_parens(_open, expNode, _close) {
      return expNode.rep();
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
      return children.map((child) => child.rep());
    },
    Block(_open, stmts, _close) {
      return stmts.children.map((stmt) => stmt.rep());
    },
  });

  return builder(match).rep();
}
