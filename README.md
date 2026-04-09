# Swatch

<div align="center">
  <img src="docs/swatch_logo_with_text.png" width="400" alt="Swatch logo" />
  <p><em>A spatial logic language for generative floor plan visualization.</em></p>
  <p>Created by: Kate Galvin</p>
</div>

## The Story

Swatch was born from the need for a simple, declarative way to describe architectural spaces. While professional CAD software is powerful, it is often too heavy for quick ideation and algorithmic layout generation. Swatch provides a lightweight, human-readable syntax that allows designers to define layouts, walls, and furniture with precision, while leveraging programming constructs like loops and components to create complex, generative floor plans that export directly to clean, scalable SVG.

## Features

- **Declarative Layouts**: Define spaces with clear `Layout`, `Wall`, and `place` commands.
- **Generative Power**: Use `for` and `repeat` loops to automate repetitive architectural patterns.
- **Reusable Components**: Define custom `component` blocks to modularize furniture sets or wall configurations.
- **Spatial Types**: Native support for spatial coordinates, units (`CM`, `INCH`, `PT`), and hex colors.
- **Precise Expressions**: Full support for arithmetic, logical, and conditional expressions in properties and coordinates.
- **Architectural SVG Export**: Compiles directly to lightweight, high-quality SVG with professional drafting features like dot-grids, soft shadows, and archetype-based furniture geometry.
- **High-Contrast Design**: Optimized for readability with double-line wall structures and "pill-style" text halos for furniture labels.

## Static and Safety Checks

The Swatch compiler performs a rigorous semantic analysis to ensure that every program is structurally sound, type-safe, and free of logical contradictions before code generation.

### 1. Scope and Identifier Integrity

- **Redeclaration Prevention**: Ensures that variables, components, and layouts are not declared more than once in the same scope.
- **Definite Declaration**: Validates that all identifiers used in expressions, assignments, or component calls have been previously declared.
- **Shadowing Rules**: Manages nested scopes for loops and components, allowing local shadowing while preserving global constants.

### 2. Type Safety

- **Strong Typing**: Enforces strict type checking for all operations. For example, logical operators (`&&`, `||`, `!`) require booleans, while arithmetic operators require numeric types.
- **Assignment Compatibility**: Validates that values assigned to variables match their declared types. The analyzer supports numeric promotion (e.g., assigning an `int` to a `float`) but prevents unsafe narrowing or incompatible assignments.
- **Structural Equality**: Ensures that complex types, such as arrays and optionals, are structurally compatible during assignment and comparison.
- **Branch Consistency**: Guarantees that both branches of a conditional expression (`test ? e1 : e2`) evaluate to the same type.

### 3. Control Flow and Operational Safety

- **Spatial Logic**: A standout feature of the Swatch analyzer. It calculates the physical bounding boxes of all elements, preventing furniture from overlapping with walls (unless specifically allowed as integrated fixtures).
- **Boundary Enforcement**: Validates that all coordinates, when accounting for wall thickness or furniture size, remain strictly within the layout's physical dimensions.
- **Loop Integrity**: Validates that `repeat` counts and `for` range bounds evaluate to numeric types.
- **Contextual Legality**: Restricts the use of the `break` statement to the lexical interior of loop constructs.
- **Immutability Enforcement**: Prevents reassignment to constants (e.g., variables declared with `const` or loop iterators).
- **Component Signature Validation**: Verifies that calls to components provide the correct number of arguments and that each argument's type is assignable to the corresponding parameter.

### 4. Security and Output Integrity

- **Sanitized SVG Generation**: The compiler produces purely declarative SVG code, avoiding the use of `<script>` tags or event handlers, which inherently prevents Cross-Site Scripting (XSS) in the generated output.
- **Coordinate Validation**: Ensures that all spatial coordinates and dimensions are resolved to numeric values, preventing malformed SVG geometries.
- **Memory Safety**: By targeting a high-level representation (SVG) and being implemented in JavaScript, the language is inherently protected against low-level memory corruption vulnerabilities such as buffer overflows.

## Swatch vs SVG

Swatch abstracts away the complexity of SVG's declarative syntax, handling coordinate math, filters, and professional drafting patterns automatically.

**Swatch:**

```swatch
Layout "Office" size [400, 400] {
  Wall North from [0, 0] to [100, 0];
  place Chair at [50, 50] [color: #ff0000];
}
```

**Generated SVG (Simplified):**

```xml
<svg width="400" height="440" viewBox="0 0 400 440">
  <defs>
    <pattern id="grid" ...> ... </pattern>
    <filter id="shadow"> ... </filter>
  </defs>
  <rect fill="white" ... />
  <rect fill="url(#grid)" ... />
  <!-- Architectural Wall -->
  <line x1="0" y1="0" x2="100" y2="0" stroke-linecap="round" ... />
  <!-- Furniture with Shadow -->
  <g filter="url(#shadow)">
    <circle cx="50" cy="50" r="20" fill="#ff0000" />
  </g>
  <!-- Auto-positioned high-contrast label -->
  <g transform="translate(50, 82)">
    <rect width="60" height="12" fill-opacity="0.9" ... />
    <text>Chair</text>
  </g>
  <text>DESIGNER: Kate Galvin | ...</text>
</svg>
```

## Links

- **Grammar**: [swatch.ohm](src/swatch.ohm)
- **Website**: [k-galvin.github.io/swatch/](https://k-galvin.github.io/swatch/)
