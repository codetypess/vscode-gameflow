export const CONSTRAINTS = ["left", "right", "centerX", "top", "bottom", "centerY"] as const;
export type Constraint = typeof CONSTRAINTS[number];
export interface NodeLayout {
  left?: number | null; right?: number | null; centerX?: number | null;
  top?: number | null; bottom?: number | null; centerY?: number | null;
  layoutUnit?: "absolute" | "percent";
  widthMode?: "explicit" | "measured"; heightMode?: "explicit" | "measured";
  crossAxisMode?: "aligned" | "explicit";
  paddingLeft?: number; paddingRight?: number; paddingTop?: number; paddingBottom?: number;
  gap?: number; gapX?: number; gapY?: number;
  align?: "left" | "center" | "right" | "justify";
  valign?: "top" | "middle" | "bottom" | "justify";
  direction?: "horizontal" | "vertical"; wrapCount?: number;
  clipContent?: boolean; scrollX?: number; scrollY?: number;
}
export interface WidgetProps {
  selected?: boolean; disabled?: boolean;
  min?: number; max?: number; value?: number; direction?: "horizontal" | "vertical";
  placeholder?: string; password?: boolean; maxChars?: number;
  options?: string[]; selectedIndex?: number;
  wordWrap?: boolean; overflow?: "visible" | "hidden"; valign?: "top" | "middle" | "bottom";
  imageFit?: "contain" | "cover" | "fill";
}

/** Only accepts known, bounded UI fields; layout dependency errors are editable diagnostics. */
export function validateUIConfig(node: Record<string, unknown>, path: string, errors: string[]): boolean {
  const before = errors.length;
  for (const group of ["layout", "widget"] as const) {
    const raw = node[group];
    if (raw === undefined) continue;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) { errors.push(`${path}.${group} must be an object`); continue; }
    const values = raw as Record<string, unknown>;
    const enums: Record<string, string[]> = group === "layout" ? {
      layoutUnit: ["absolute", "percent"], widthMode: ["explicit", "measured"], heightMode: ["explicit", "measured"], crossAxisMode: ["aligned", "explicit"],
      align: ["left", "center", "right", "justify"], valign: ["top", "middle", "bottom", "justify"], direction: ["horizontal", "vertical"]
    } : { direction: ["horizontal", "vertical"], overflow: ["visible", "hidden"], valign: ["top", "middle", "bottom"], imageFit: ["contain", "cover", "fill"] };
    const booleans = group === "layout" ? ["clipContent"] : ["selected", "disabled", "password", "wordWrap"];
    const numbers = group === "layout" ? [...CONSTRAINTS, "paddingLeft", "paddingRight", "paddingTop", "paddingBottom", "gap", "gapX", "gapY", "wrapCount", "scrollX", "scrollY"] : ["min", "max", "value", "maxChars", "selectedIndex"];
    for (const [key, value] of Object.entries(values)) {
      let valid = false;
      if (Object.hasOwn(enums, key)) valid = typeof value === "string" && enums[key].includes(value);
      else if (booleans.includes(key)) valid = typeof value === "boolean";
      else if (numbers.includes(key)) {
        valid = (group === "layout" && CONSTRAINTS.includes(key as Constraint) && value === null) || (typeof value === "number" && Number.isFinite(value));
        if (key.startsWith("padding") || ["scrollX", "scrollY", "maxChars"].includes(key)) valid = valid && Number(value) >= 0;
        if (["wrapCount", "maxChars", "selectedIndex"].includes(key)) valid = valid && Number.isSafeInteger(value) && Number(value) >= (key === "wrapCount" ? 1 : key === "selectedIndex" ? -1 : 0);
      } else if (group === "widget" && key === "placeholder") valid = typeof value === "string";
      else if (group === "widget" && key === "options") valid = Array.isArray(value) && value.length <= 1000 && value.every((item) => typeof item === "string");
      if (!valid) errors.push(`${path}.${group}.${key} is invalid`);
    }
    if (group === "widget") {
      const min = Number(values.min ?? 0), max = Number(values.max ?? 1), value = Number(values.value ?? min);
      if (max <= min || value < min || value > max) errors.push(`${path}.widget range requires min < max and min <= value <= max`);
      if (values.selectedIndex !== undefined && Number(values.selectedIndex) >= (Array.isArray(values.options) ? values.options.length : 3)) errors.push(`${path}.widget.selectedIndex exceeds options`);
    }
  }
  return before === errors.length;
}
