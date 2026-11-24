import builtinImages from "./builtin-images.json";
import type { NineGrid } from "./psd-meta";

export interface BuiltinImage { id: string; name: string; category: string; width: number; height: number; nineGrid: NineGrid | null; dataUri: string }
export const BUILTIN_IMAGES = builtinImages as BuiltinImage[];
export const builtinImage = (id: string) => BUILTIN_IMAGES.find(image => image.id === id);
export const builtinPath = (id: string) => "builtin/" + id.replace(/-/g, "_") + ".png";
export const BUILTIN_SOURCE = { documentId: "gameflow-builtin", psdName: "builtin.psd", sourceHash: "0".repeat(64) };

export const legacyDefaultPath = (path: string) => /^builtin\/image\/default_\d+(?:p\d+)?x\d+(?:p\d+)?\.png$/.test(path);

export function isLegacyDefault(path: string, record: { source: typeof BUILTIN_SOURCE; layerId: string; nineGrid: NineGrid | null }) {
  return legacyDefaultPath(path) && record.layerId === "image/default" && record.nineGrid === null &&
    record.source.documentId === BUILTIN_SOURCE.documentId && record.source.psdName === BUILTIN_SOURCE.psdName &&
    record.source.sourceHash === BUILTIN_SOURCE.sourceHash;
}
