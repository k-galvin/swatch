export default function generate(program) {
  const targetNames = new Map();
  function getTargetName(entity) {
    if (!targetNames.has(entity)) {
      const suffix = targetNames.size + 1;
      const base = entity.name || entity.type || entity.kind;
      targetNames.set(entity, `${base}_${suffix}`);
    }
    return targetNames.get(entity);
  }

  const svgLines = [];

  for (const layout of program.layouts) {
    if (!layout.intrinsic) continue;
    const [w, h] = layout.size.map(Number);
    const id = getTargetName(layout);
    svgLines.push(
      `<svg id="${id}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`,
    );
    if (program.metadata) {
      svgLines.push(
        `  <!-- Designer: ${program.metadata.author}, Date: ${program.metadata.date} -->`,
      );
    }
    svgLines.push(`  <rect width="100%" height="100%" fill="#fafafa" />`);

    for (const item of layout.body) {
      if (!item.intrinsic) continue;
      if (item.kind === "Wall") {
        const id = getTargetName(item);
        const color = item.props?.color || "black";
        const weight = Number(item.props?.thickness || 4);
        const [x1, y1] = item.from.map(Number);
        const [x2, y2] = item.to.map(Number);
        svgLines.push(
          `  <line id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${weight}" stroke-linecap="round" />`,
        );
      } else if (item.kind === "Furniture") {
        const id = getTargetName(item);
        const color = item.props?.color || "#3498db";
        const [cx, cy] = item.at.map(Number);
        svgLines.push(
          `  <circle id="${id}" cx="${cx}" cy="${cy}" r="12" fill="${color}" />`,
        );
        svgLines.push(
          `  <text x="${cx}" y="${cy + 25}" font-family="Arial" font-size="10" text-anchor="middle" fill="#333">${item.type}</text>`,
        );
      }
    }
    svgLines.push(`</svg>`);
  }
  return svgLines.join("\n");
}
