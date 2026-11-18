import { validGrid, type NineGrid } from "./psd-meta";
export interface NineGridPatch { sx: number; sy: number; sw: number; sh: number; x: number; y: number; width: number; height: number; repeatX: boolean; repeatY: boolean }

/** A line spans the entire image, including the two edge strips that stretch with it. */
export function compactNineGrid(pixels: Uint32Array, width: number, height: number, grid: NineGrid) {
  const retain = (length: number, equal: (a: number, b: number) => boolean) => {
    if (!grid.repeat) {
      if (length <= 8) return length;
      for (let i = 1; i < length; i++) if (!equal(0, i)) return length;
      return 8;
    }
    // Find the shortest period of complete lines in linear time without pixel hashes.
    const prefix = new Uint16Array(length);
    for (let i = 1, matched = 0; i < length; i++) {
      while (matched > 0 && !equal(i, matched)) matched = prefix[matched - 1];
      if (equal(i, matched)) matched++;
      prefix[i] = matched;
    }
    const period = length - prefix[length - 1];
    return length % period === 0 ? period : length;
  };
  const axis = (size: number, leading: number, trailing: number, step: number, cross: number, lineCount: number) => {
    const oldEnd = size - trailing;
    const kept = retain(oldEnd - leading, (a, b) => {
      const lhs = (leading + a) * step, rhs = (leading + b) * step;
      for (let i = 0; i < lineCount * cross; i += cross) if (pixels[lhs + i] !== pixels[rhs + i]) return false;
      return true;
    });
    const newEnd = leading + kept;
    return { oldEnd, newEnd, size: newEnd + trailing };
  };
  if (!validGrid(grid, width, height) || pixels.length !== width * height) throw new Error("九宫格与切图尺寸不一致。");
  const x = axis(width, grid.left, grid.right, 1, width, height);
  const y = axis(height, grid.top, grid.bottom, width, 1, width);
  const outputGrid = { ...grid, right: x.size - x.newEnd, bottom: y.size - y.newEnd };
  const segments = (newSize: number, src: number, dst: number) => [
    { src: 0, dst: 0, length: dst }, { src, dst, length: newSize - dst }
  ].filter(segment => segment.length > 0);
  return { width: x.size, height: y.size, nineGrid: outputGrid,
    columns: segments(x.size, x.oldEnd, x.newEnd), rows: segments(y.size, y.oldEnd, y.newEnd) };
}

/** Matches xq-client engine/libs/laya.core.js writeNineGridAxes: leading borders win at small sizes. */
export function nineGridPatches(sw: number, sh: number, width: number, height: number, grid: NineGrid): NineGridPatch[] {
  const axis = (source: number, target: number, leading: number, trailing: number) => {
    const first = Math.min(leading, target), last = Math.max(first, target - Math.min(trailing, target - first));
    return { source: [0, leading, Math.max(leading, source - trailing), source], target: [0, first, last, target] };
  };
  const xx = axis(sw, width, grid.left, grid.right), yy = axis(sh, height, grid.top, grid.bottom), patches: NineGridPatch[] = [];
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
    const patch = { sx: xx.source[x], sy: yy.source[y], sw: xx.source[x + 1] - xx.source[x], sh: yy.source[y + 1] - yy.source[y],
      x: xx.target[x], y: yy.target[y], width: xx.target[x + 1] - xx.target[x], height: yy.target[y + 1] - yy.target[y], repeatX: grid.repeat && x === 1, repeatY: grid.repeat && y === 1 };
    if (patch.sw > 0 && patch.sh > 0 && patch.width > 0 && patch.height > 0) patches.push(patch);
  }
  return patches;
}
