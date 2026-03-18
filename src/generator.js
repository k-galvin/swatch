export default function generate(program) {
  const svgLines = [];
  for (const layout of program.layouts) {
    const [w, h] = layout.size;
    svgLines.push(
      `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`,
    );
    if (program.metadata) {
      svgLines.push(`  `);
    }
    svgLines.push(`  <rect width="100%" height="100%" fill="#fafafa" />`);
    for (const item of layout.body) {
      if (item.kind === "Wall") {
        const color = item.props?.color || "black";
        const weight = item.props?.thickness || 4;
        svgLines.push(
          `  <line x1="${item.from[0]}" y1="${item.from[1]}" x2="${item.to[0]}" y2="${item.to[1]}" stroke="${color}" stroke-width="${weight}" stroke-linecap="round" />`,
        );
      } else if (item.kind === "Furniture") {
        const color = item.props?.color || "#3498db";
        svgLines.push(
          `  <circle cx="${item.at[0]}" cy="${item.at[1]}" r="12" fill="${color}" />`,
        );
        svgLines.push(
          `  <text x="${item.at[0]}" y="${item.at[1] + 25}" font-family="Arial" font-size="10" text-anchor="middle" fill="#333">${item.type}</text>`,
        );
      }
    }
    svgLines.push(`</svg>`);
  }
  return svgLines.join("\n");
}
