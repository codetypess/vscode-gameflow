import type { ImageSlotField } from "./image-slots";

/** Public names of direct children of a PSD control group. */
export const PSD_SLOT_MARKERS = { normalSkin: "@normal", selectedSkin: "@selected", disabledSkin: "@disabled", image: "@image" } as const;
export function psdSlotField(name: string): ImageSlotField | undefined {
  return (Object.keys(PSD_SLOT_MARKERS) as ImageSlotField[]).find(field => PSD_SLOT_MARKERS[field] === name.trim());
}
