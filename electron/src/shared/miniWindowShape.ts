export interface MiniShapeRectangle { x: number; y: number; width: number; height: number }

export function getMiniWindowShape(width: number, height: number, cornerRadius: number): MiniShapeRectangle[] {
  width = Math.max(1, Math.round(width));
  height = Math.max(1, Math.round(height));
  const radius = Math.min(32, Math.floor(width / 2), Math.floor(height / 2),
    Math.max(0, Math.round(Number.isFinite(cornerRadius) ? cornerRadius : 24)));
  if (!radius) return [{ x: 0, y: 0, width, height }];
  const strips: MiniShapeRectangle[] = [];
  const append = (y: number, inset: number, rows = 1) => {
    const previous = strips[strips.length - 1];
    if (previous && previous.x === inset && previous.y + previous.height === y) previous.height += rows;
    else strips.push({ x: inset, y, width: width - inset * 2, height: rows });
  };
  // Keep every pixel intersecting the CSS curve; Chromium supplies the antialiased edge.
  const insets = Array.from({ length: radius }, (_, y) => Math.floor(radius - Math.sqrt(radius ** 2 - (radius - y - 1) ** 2)));
  for (let y = 0; y < radius; y++) append(y, insets[y]);
  if (height > radius * 2) append(radius, 0, height - radius * 2);
  for (let y = 0; y < radius; y++) append(height - radius + y, insets[radius - y - 1]);
  return strips;
}
