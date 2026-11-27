export const panelMinimum = { prototype: 280, slice: 278 } as const;
export type PanelMode = keyof typeof panelMinimum;
export type PanelSide = "left" | "right";
export type PanelWidths = Record<PanelSide, number>;
export type PanelWidthMessage = { type: "panelWidth"; mode: PanelMode; side: PanelSide; width: number };
export const panelWidthKey = (mode: PanelMode, side: PanelSide) => `gameflow.panelWidth.${mode}.${side}`;

export function isPanelWidthMessage(raw: unknown): raw is PanelWidthMessage {
  if (!raw || typeof raw !== "object") return false;
  const value = raw as Partial<PanelWidthMessage>;
  return value.type === "panelWidth" && (value.mode === "prototype" || value.mode === "slice")
    && (value.side === "left" || value.side === "right") && typeof value.width === "number"
    && Number.isSafeInteger(value.width) && value.width >= panelMinimum[value.mode];
}
