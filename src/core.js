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

export const floatType = "number";
export const intType = "number"; // In swatch, numbers are just numbers
export const stringType = "string";
export const booleanType = "boolean";
export const colorType = "color";
export const voidType = "void";
export const anyType = "any";

export const standardLibrary = Object.freeze({
  number: floatType,
  string: stringType,
  boolean: booleanType,
  color: colorType,
  π: variable("π", false, floatType),
  // Add some spatial intrinsics
  CM: variable("CM", false, floatType),
  INCH: variable("INCH", false, floatType),
});

String.prototype.type = stringType;
Number.prototype.type = floatType;
BigInt.prototype.type = intType;
Boolean.prototype.type = booleanType;
