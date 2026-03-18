export function program(metadata, layouts) {
  return { kind: "Program", metadata, layouts };
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
