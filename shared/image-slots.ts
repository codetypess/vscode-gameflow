import { builtinImage, builtinPath, type BuiltinImage } from "./builtin-image";
export { BUILTIN_IMAGES, builtinImage, builtinPath, type BuiltinImage } from "./builtin-image";
import type { GameFlowNode } from "./model";
import { isSliceResourceRef, type SliceResourceRef } from "./slice-resources";

export type ResourceMode = "prototype" | "art" | "prefab";
export interface ImageSlot { builtin?: string; art?: SliceResourceRef }
export const BUILTIN_CATEGORIES = ["按钮", "色块", "圆形", "图标", "单选/复选"] as const;
export function isImageSlot(value: unknown): value is ImageSlot | null {
  if (value === null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const slot = value as Record<string, unknown>;
  return Object.keys(slot).every(key => key === "builtin" || key === "art") &&
    (slot.builtin !== undefined || slot.art !== undefined) &&
    (slot.builtin === undefined || typeof slot.builtin === "string" && slot.builtin.split("/").every(part => /^[a-z0-9-]+$/.test(part))) &&
    (slot.art === undefined || isSliceResourceRef(slot.art));
}
export const IMAGE_SLOT_FIELDS = ["image", "normalSkin", "selectedSkin", "disabledSkin"] as const;
export type ImageSlotField = typeof IMAGE_SLOT_FIELDS[number];
export function nodeImageSlot(node: GameFlowNode, mode: ResourceMode = "art"): ImageSlot | null | undefined {
  if (node.type !== "button") return node.image;
  const state = node.widget?.disabled ? node.disabledSkin : node.widget?.selected ? node.selectedSkin : node.normalSkin;
  // Art-only optional states do not invent a prototype picture.
  if (mode === "prototype" && !state?.builtin) return node.normalSkin;
  return state ?? node.normalSkin;
}
export function nodeArtRefs(node: GameFlowNode): SliceResourceRef[] {
  return [...(node.sliceResource ? [node.sliceResource] : []), ...IMAGE_SLOT_FIELDS.flatMap(field => node[field]?.art ? [node[field]!.art!] : [])];
}
export type SlotRequest = { kind: "empty" } | { kind: "builtin"; image: BuiltinImage } | { kind: "resource"; ref: SliceResourceRef } | { kind: "error"; error: string };
export function imageSlotRequest(slot: ImageSlot | null | undefined, mode: ResourceMode, size?: { width: number; height: number }): SlotRequest {
  if (!slot) return { kind: "empty" };
  if (mode !== "prototype" && slot.art) return { kind: "resource", ref: slot.art };
  if (!slot.builtin) return { kind: "empty" };
  const image = builtinImage(slot.builtin);
  if (!image) return { kind: "error", error: "内置图片不存在：" + slot.builtin };
  return mode === "prefab" ? { kind: "resource", ref: { path: builtinPath(image.id, size) } } : { kind: "builtin", image };
}
export const progressRatio = (node: GameFlowNode) => {
  const min = node.widget?.min ?? 0, max = node.widget?.max ?? 1;
  return max <= min ? 0 : Math.max(0, Math.min(1, ((node.widget?.value ?? min) - min) / (max - min)));
};
