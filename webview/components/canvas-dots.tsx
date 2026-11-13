import { canvasDotGrid, type GridCamera } from "../lib/canvas-grid";

export function CanvasDots({ camera }: { camera: GridCamera }) {
  const grid = canvasDotGrid(camera);
  return <div className="canvas-dots" aria-hidden="true" style={{
    backgroundSize: `${grid.spacing}px ${grid.spacing}px`,
    backgroundPosition: `${grid.x}px ${grid.y}px`
  }} />;
}
