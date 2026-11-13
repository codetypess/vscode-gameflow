export type GridCamera = { x: number; y: number; zoom: number };

/** Camera zoom is positive. Each doubling reveals the next finer world grid. */
export function canvasDotGrid(camera: GridCamera) {
  const spacing = 24 * (camera.zoom / 2 ** Math.floor(Math.log2(camera.zoom)));
  // CSS radial gradients put the dot at the tile center; anchor that center at world zero.
  const offset = (position: number) => ((position % spacing) + spacing) % spacing - spacing / 2;
  return { spacing, x: offset(camera.x), y: offset(camera.y) };
}
