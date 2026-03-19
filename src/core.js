export function program(metadata, layouts) {
  return { kind: "Program", metadata, layouts };
}

export function variableDeclaration(variable, initializer) {
  return { kind: "VariableDeclaration", variable, initializer };
}

export function variable(name, mutable, type) {
  return { kind: "Variable", name, mutable, type };
}

export function componentDeclaration(component) {
  return { kind: "ComponentDeclaration", component };
}

export function component(name, params, body) {
  return { kind: "Component", name, params, body };
}

export function layout(name, size, body) {
  return { kind: "Layout", name, size, body, intrinsic: true };
}

export function wall(name, from, to, props) {
  return { kind: "Wall", name, from, to, props, intrinsic: true };
}

export function furniture(type, at, props) {
  return { kind: "Furniture", type, at, props, intrinsic: true };
}

export function assignment(target, source) {
  return { kind: "Assignment", target, source };
}

export function ifStatement(test, consequent, alternate) {
  return { kind: "IfStatement", test, consequent, alternate };
}

export function call(callee, args) {
  return { kind: "Call", callee, args };
}

export function repeatStatement(count, body) {
  return { kind: "RepeatStatement", count, body };
}

export function forRangeStatement(iterator, low, op, high, body) {
  return { kind: "ForRangeStatement", iterator, low, op, high, body };
}

export function conditional(test, consequent, alternate, type) {
  return { kind: "Conditional", test, consequent, alternate, type };
}

export function binary(op, left, right, type) {
  return { kind: "BinaryExpression", op, left, right, type };
}

export function unary(op, operand, type) {
  return { kind: "UnaryExpression", op, operand, type };
}

export const floatType = { kind: "FloatType" };
export const intType = { kind: "IntType" };
export const stringType = { kind: "StringType" };
export const booleanType = { kind: "BooleanType" };
export const colorType = { kind: "ColorType" };
export const voidType = { kind: "VoidType" };
export const anyType = { kind: "AnyType" };

export const standardLibrary = Object.freeze({
  int: intType,
  float: floatType,
  number: floatType,
  string: stringType,
  boolean: booleanType,
  color: colorType,
  any: anyType,
  void: voidType,
  π: variable("π", false, floatType),
  WHITE: variable("WHITE", false, colorType),
  BLACK: variable("BLACK", false, colorType),
  RED: variable("RED", false, colorType),
  GREEN: variable("GREEN", false, colorType),
  BLUE: variable("BLUE", false, colorType),
  // Spatial intrinsics
  CM: variable("CM", false, floatType),
  INCH: variable("INCH", false, floatType),
  PT: variable("PT", false, floatType),
});

// Mark intrinsics
for (const entity of Object.values(standardLibrary)) {
  if (entity.kind === "Variable") entity.intrinsic = true;
}

String.prototype.type = stringType;
Number.prototype.type = floatType;
BigInt.prototype.type = intType;
Boolean.prototype.type = booleanType;
