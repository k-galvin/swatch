# Swatch

<div align="center">
  <img src="docs/swatch_logo.png" width="200" alt="Swatch logo" />
  <p><em>A spatial logic language for generative floor plan visualization.</em></p>
</div>

## The Story
Swatch was born from the need for a simple, declarative way to describe architectural spaces. While professional CAD software is powerful, it is often too heavy for quick ideation and algorithmic layout generation. Swatch provides a lightweight, human-readable syntax that allows designers to define layouts, walls, and furniture with precision, while leveraging programming constructs like loops and components to create complex, generative floor plans that export directly to clean, scalable SVG.

## Features
- **Declarative Layouts**: Define spaces with clear `Layout`, `Wall`, and `place` commands.
- **Generative Power**: Use `for` and `repeat` loops to automate repetitive architectural patterns.
- **Reusable Components**: Define custom `component` blocks to modularize furniture sets or wall configurations.
- **Spatial Types**: Native support for spatial coordinates, units (`CM`, `INCH`, `PT`), and hex colors.
- **Precise Expressions**: Full support for arithmetic, logical, and conditional expressions in properties and coordinates.
- **SVG Export**: Compiles directly to lightweight, high-quality Scalable Vector Graphics.

## Static Checks
The Swatch analyzer performs rigorous safety checks to ensure your designs are semantically sound:
- **Type Safety**: Ensures that assignments and operations are performed on compatible types (e.g., preventing adding a color to a number).
- **Scope Management**: Detects redeclared identifiers and usage of undeclared variables or components.
- **Structural Integrity**: Validates that layouts have sizes and blocks, and that coordinates are provided as numeric points.
- **Loop Integrity**: Ensures that loop counts and range bounds are numeric.
- **Parameter Validation**: Checks that component calls match the expected parameter count and types.

## Swatch vs SVG
Swatch simplifies complex SVG structures into intuitive architectural primitives.

**Swatch:**
```swatch
Layout "Room" size [100, 100] {
  Wall W from [0, 0] to [100, 0] [color: #000, thickness: 5]
}
```

**SVG Output:**
```xml
<svg id="Room_1" width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#fafafa" />
  <line id="W_2" x1="0" y1="0" x2="100" y2="0" stroke="#000" stroke-width="5" stroke-linecap="round" />
</svg>
```

## Links
- **Grammar**: [swatch.ohm](src/swatch.ohm)
- **Website**: [k-galvin.github.io/swatch/](https://k-galvin.github.io/swatch/)
