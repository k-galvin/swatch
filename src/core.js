export class Program {
  constructor(layouts) {
    this.layouts = layouts;
  }
}

export class Layout {
  constructor(name, body) {
    this.name = name;
    this.body = body;
  }
}

export class Wall {
  constructor(name, from, to) {
    this.name = name;
    this.from = from;
    this.to = to;
  }
}

export class Furniture {
  constructor(type, at) {
    this.type = type;
    this.at = at;
  }
}
