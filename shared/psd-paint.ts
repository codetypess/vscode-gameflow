import type { Frame } from "./model";

export interface PsdPaintEffect {
  kind: "inside" | "outside" | "center" | "shadow" | "innerShadow";
  radius: number; x: number; y: number; color: string; opacity: number;
}
export interface PsdPaint {
  key: number;
  clipBase?: number;
  blend?: string;
  effects?: PsdPaintEffect[];
  bitmap?: { image: string; frame: Frame; content: string };
}
export const PSD_BLEND_MODES = ["multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"];
