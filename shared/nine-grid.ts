import type { NineGrid } from "./psd-meta";
export interface NineGridPatch { sx: number; sy: number; sw: number; sh: number; x: number; y: number; width: number; height: number; repeatX: boolean; repeatY: boolean }

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
