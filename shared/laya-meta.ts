import type { NineGrid } from "./psd-meta";

/** Keep the path-derived identity used by previously exported GameFlow skins. */
export function resourceUuid(path: string): string {
  const bytes = new TextEncoder().encode("gameflow-resource:" + path);
  const hex = [2166136261, 2166136261 ^ 0x9e3779b9, 2166136261 ^ 0x85ebca6b, 2166136261 ^ 0xc2b2ae35].map(seed => {
    let value = seed;
    for (const byte of bytes) value = Math.imul(value ^ byte, 16777619);
    return (value >>> 0).toString(16).padStart(8, "0");
  }).join("");
  return hex.slice(0,8) + "-" + hex.slice(8,12) + "-5" + hex.slice(13,16) + "-a" + hex.slice(17,20) + "-" + hex.slice(20);
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** An omitted grid is a prefab. A null grid explicitly clears an image's borders. */
export function mergeLayaMeta(path: string, before: Uint8Array | null, grid?: NineGrid | null) {
  let previous: unknown = {};
  if (before) {
    try { previous = JSON.parse(new TextDecoder().decode(before)); }
    catch { throw new Error(path + ".meta 已损坏。"); }
  }
  if (!object(previous)) throw new Error(path + ".meta 须为 JSON 对象。");
  const uuid = previous.uuid === undefined ? resourceUuid(path) : previous.uuid;
  if (typeof uuid !== "string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(uuid))
    throw new Error(path + ".meta 的导入身份无效。");
  const merged: Record<string, unknown> = { ...previous, uuid };
  if (grid !== undefined) {
    const importer = previous.importer === undefined ? {} : previous.importer;
    if (!object(importer)) throw new Error(path + ".meta 的 importer 须为 JSON 对象。");
    const sizeGrid = grid ? [grid.top, grid.right, grid.bottom, grid.left, Number(grid.repeat)] : [0,0,0,0,0];
    merged.importer = { ...importer, textureType: 2, sizeGrid };
  }
  const bytes = JSON.stringify(merged) === JSON.stringify(previous) ? null :
    new TextEncoder().encode(JSON.stringify(merged, null, 2) + "\n");
  return { uuid, bytes };
}
