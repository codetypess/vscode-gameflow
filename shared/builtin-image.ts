import builtinImages from "./builtin-images.json";
import { DEFAULT_IMAGE_ID } from "./image-rendering";
import type { NineGrid } from "./psd-meta";

export interface BuiltinImage { id: string; name: string; category: string; width: number; height: number; nineGrid: NineGrid | null; dataUri: string }
export const BUILTIN_IMAGES = builtinImages as BuiltinImage[];
export const builtinImage = (id: string) => BUILTIN_IMAGES.find(image => image.id === id);
export const builtinPath = (id: string, size?: { width: number; height: number }) => {
  const suffix = id === DEFAULT_IMAGE_ID && size ? "_" + String(size.width).replace(".", "p") + "x" + String(size.height).replace(".", "p") : "";
  return "builtin/" + id.replace(/-/g, "_") + suffix + ".png";
};
export const BUILTIN_SOURCE = { documentId: "gameflow-builtin", psdName: "builtin.psd", sourceHash: "0".repeat(64) };
