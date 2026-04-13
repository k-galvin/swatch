export function program(metadata, statements) {
  return { kind: "Program", metadata, statements };
}

// --- Declaration & Statement Nodes ---

export function variableDeclaration(variable, initializer) {
  return { kind: "VariableDeclaration", variable, initializer };
}

export function variable(name, mutable, type) {
  return { kind: "Variable", name, mutable, type };
}

export function component(name, params, body) {
  return { kind: "Component", name, params, body };
}

export function layout(name, size, body) {
  return { kind: "Layout", name, size, body };
}

export function wall(name, from, to, props) {
  return { kind: "Wall", name, from, to, props };
}

export function furniture(type, at, props) {
  return { kind: "Furniture", type, at, props };
}

export function assignment(target, source) {
  return { kind: "Assignment", target, source };
}

export function bumpStatement(variable, op) {
  return { kind: "BumpStatement", variable, op };
}

export function ifStatement(test, consequent, alternate) {
  return { kind: "IfStatement", test, consequent, alternate };
}

export function whileStatement(test, body) {
  return { kind: "WhileStatement", test, body };
}

export function call(callee, args, type = voidType) {
  return { kind: "Call", callee, args, type };
}

export function repeatStatement(count, body) {
  return { kind: "RepeatStatement", count, body };
}

export function forRangeStatement(iterator, low, op, high, body) {
  return { kind: "ForRangeStatement", iterator, low, op, high, body };
}

export function forCollectionStatement(iterator, collection, body) {
  return { kind: "ForCollectionStatement", iterator, collection, body };
}

export const breakStatement = { kind: "BreakStatement" };

// --- Expression Nodes ---

export function conditional(test, consequent, alternate, type) {
  return { kind: "Conditional", test, consequent, alternate, type };
}

export function binary(op, left, right, type) {
  return { kind: "BinaryExpression", op, left, right, type };
}

export function unary(op, operand, type) {
  return { kind: "UnaryExpression", op, operand, type };
}

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

export function arrayType(baseType) {
  return {
    kind: "ArrayType",
    baseType,
    description: `[${baseType.description}]`,
  };
}

export function optionalType(baseType) {
  return {
    kind: "OptionalType",
    baseType,
    description: `${baseType.description}?`,
  };
}

// --- Standard Library ---

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

// Decorate Standard Library items as intrinsics
for (const entity of Object.values(standardLibrary)) {
  if (entity.kind === "Variable") entity.intrinsic = true;
}
