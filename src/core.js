/**
 * Swatch Core Representation & Standard Library
 *
 * This module defines the internal representation (AST nodes) and the built-in
 * type system used by all phases of the Swatch compiler.
 */

/**
 * Creates a Program node, the root of the AST.
 * @param {object} metadata Header information (Designer, Date).
 * @param {Array} statements The top-level script statements.
 */
export function program(metadata, statements) {
  return { kind: "Program", metadata, statements };
}

// --- Declaration & Statement Nodes ---

/** Creates a variable declaration (let/const). */
export function variableDeclaration(variable, initializer) {
  return { kind: "VariableDeclaration", variable, initializer };
}

/** Creates a Variable entity representing a declared identifier. */
export function variable(name, mutable, type) {
  return { kind: "Variable", name, mutable, type };
}

/** Creates a reusable Component definition. */
export function component(name, params, body) {
  return { kind: "Component", name, params, body };
}

/** Creates a Layout definition (the primary SVG canvas). */
export function layout(name, size, body) {
  return { kind: "Layout", name, size, body };
}

/** Creates a Wall drawing command. */
export function wall(name, from, to, props) {
  return { kind: "Wall", name, from, to, props };
}

/** Creates a Furniture placement command. */
export function furniture(type, at, props) {
  return { kind: "Furniture", type, at, props };
}

/** Creates an assignment statement. */
export function assignment(target, source) {
  return { kind: "Assignment", target, source };
}

/** Creates a bump statement (id++ / id--). */
export function bumpStatement(variable, op) {
  return { kind: "BumpStatement", variable, op };
}

/** Creates an if-else control flow statement. */
export function ifStatement(test, consequent, alternate) {
  return { kind: "IfStatement", test, consequent, alternate };
}

/** Creates a while loop statement. */
export function whileStatement(test, body) {
  return { kind: "WhileStatement", test, body };
}

/** Creates a function or component call. */
export function call(callee, args, type = voidType) {
  return { kind: "Call", callee, args, type };
}

/** Creates a repeat loop (count-based iteration). */
export function repeatStatement(count, body) {
  return { kind: "RepeatStatement", count, body };
}

/** Creates a range-based for loop. */
export function forRangeStatement(iterator, low, op, high, body) {
  return { kind: "ForRangeStatement", iterator, low, op, high, body };
}

/** Creates a collection-based for loop (iteration over arrays). */
export function forCollectionStatement(iterator, collection, body) {
  return { kind: "ForCollectionStatement", iterator, collection, body };
}

/** Represents a loop break signal. */
export const breakStatement = { kind: "BreakStatement" };

// --- Expression Nodes ---

/** Creates a ternary conditional expression (a ? b : c). */
export function conditional(test, consequent, alternate, type) {
  return { kind: "Conditional", test, consequent, alternate, type };
}

/** Creates a binary expression (arithmetic, logical, etc.). */
export function binary(op, left, right, type) {
  return { kind: "BinaryExpression", op, left, right, type };
}

/** Creates a unary expression (negation, logical not). */
export function unary(op, operand, type) {
  return { kind: "UnaryExpression", op, operand, type };
}

/** Creates an array literal node. */
export function arrayLiteral(elements) {
  return {
    kind: "ArrayLiteral",
    elements,
    type: arrayType(elements[0]?.type ?? anyType),
  };
}

// Literals wrap raw values with their inferred types
export const intLiteral = (value) => ({
  kind: "IntLiteral",
  value,
  type: intType,
});
export const floatLiteral = (value) => ({
  kind: "FloatLiteral",
  value,
  type: floatType,
});
export const stringLiteral = (value) => ({
  kind: "StringLiteral",
  value,
  type: stringType,
});
export const booleanLiteral = (value) => ({
  kind: "BooleanLiteral",
  value,
  type: booleanType,
});
export const colorLiteral = (value) => ({
  kind: "ColorLiteral",
  value,
  type: colorType,
});

// --- Type System ---

export const floatType = { kind: "FloatType", description: "float" };
export const intType = { kind: "IntType", description: "int" };
export const stringType = { kind: "StringType", description: "string" };
export const booleanType = { kind: "BooleanType", description: "boolean" };
export const colorType = { kind: "ColorType", description: "color" };
export const voidType = { kind: "VoidType", description: "void" };
export const anyType = { kind: "AnyType", description: "any" };

/** Creates an ArrayType for a given base type. */
export function arrayType(baseType) {
  return {
    kind: "ArrayType",
    baseType,
    description: `[${baseType.description}]`,
  };
}

/** Creates an OptionalType for a given base type. */
export function optionalType(baseType) {
  return {
    kind: "OptionalType",
    baseType,
    description: `${baseType.description}?`,
  };
}

// --- Standard Library ---

/**
 * Built-in types and constants available to all Swatch programs.
 * Intrinsics are marked so the generator can handle them as native SVG/JS calls.
 */
export const standardLibrary = Object.freeze({
  int: intType,
  float: floatType,
  number: floatType,
  string: stringType,
  boolean: booleanType,
  color: colorType,
  any: anyType,
  void: voidType,
  print: variable("print", false, anyType),
  π: variable("π", false, floatType),
  WHITE: variable("WHITE", false, colorType),
  BLACK: variable("BLACK", false, colorType),
  RED: variable("RED", false, colorType),
  BLUE: variable("BLUE", false, colorType),
  CM: variable("CM", false, floatType),
  INCH: variable("INCH", false, floatType),
});

// Decorate Standard Library items as intrinsics for the generator
for (const entity of Object.values(standardLibrary)) {
  if (entity.kind === "Variable") entity.intrinsic = true;
}
