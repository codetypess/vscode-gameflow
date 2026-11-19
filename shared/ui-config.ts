export const CONSTRAINTS = ["left", "right", "centerX", "top", "bottom", "centerY"] as const;
export type Constraint = typeof CONSTRAINTS[number];
export interface ConstraintLayout {
  left?: number | null; right?: number | null; centerX?: number | null;
  top?: number | null; bottom?: number | null; centerY?: number | null;
  layoutUnit?: "absolute" | "percent";
}
export interface NodeLayout extends ConstraintLayout {
  widthMode?: "explicit" | "measured"; heightMode?: "explicit" | "measured";
  crossAxisMode?: "aligned" | "explicit";
  positionOffsetX?: number; positionOffsetY?: number;
  paddingLeft?: number; paddingRight?: number; paddingTop?: number; paddingBottom?: number;
  gap?: number; gapX?: number; gapY?: number;
  align?: "left" | "center" | "right" | "justify";
  valign?: "top" | "middle" | "bottom" | "justify";
  direction?: "horizontal" | "vertical"; wrapCount?: number;
  clipContent?: boolean; scrollX?: number; scrollY?: number;
}

/** Root constraints describe a future runtime parent, independently of canvas placement. */
export function validateRootLayout(raw: unknown, path: string, errors: string[]): boolean {
  if (raw === undefined) return true;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) { errors.push(`${path} must be an object`); return false; }
  const before = errors.length;
  for (const [key, value] of Object.entries(raw)) {
    const valid = key === "layoutUnit" ? value === "absolute" || value === "percent"
      : CONSTRAINTS.includes(key as Constraint) && (value === null || typeof value === "number" && Number.isFinite(value));
    if (!valid) errors.push(`${path}.${key} is invalid`);
  }
  return errors.length === before;
}
export interface WidgetProps {
  skinNodeId?: string | null;
  textLabelNodeId?: string | null;
  mode?: "horizontal" | "circular";
  optionNodeIds?: (string | null)[];
  selected?: boolean; disabled?: boolean;
  min?: number; max?: number; value?: number; direction?: "horizontal" | "vertical";
  placeholder?: string; password?: boolean; maxChars?: number;
  options?: string[]; selectedIndex?: number;
  wordWrap?: boolean; overflow?: "visible" | "hidden" | "scroll" | "shrink" | "ellipsis"; valign?: "top" | "middle" | "bottom";
  leading?: number; letterSpacing?: number;
  html?: boolean; ubb?: boolean;
  templateVars?: Record<string, string | number | boolean | null> | null;
  scrollX?: number; scrollY?: number;
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
    } : { mode: ["horizontal", "circular"], direction: ["horizontal", "vertical"], overflow: ["visible", "hidden", "scroll", "shrink", "ellipsis"], valign: ["top", "middle", "bottom"], imageFit: ["contain", "cover", "fill"] };
    const booleans = group === "layout" ? ["clipContent"] : ["selected", "disabled", "password", "wordWrap", "html", "ubb"];
    const numbers = group === "layout" ? [...CONSTRAINTS, "paddingLeft", "paddingRight", "paddingTop", "paddingBottom", "gap", "gapX", "gapY", "wrapCount", "scrollX", "scrollY", "positionOffsetX", "positionOffsetY"] : ["min", "max", "value", "maxChars", "selectedIndex", "leading", "letterSpacing", "scrollX", "scrollY"];
    for (const [key, value] of Object.entries(values)) {
      let valid = false;
      if (Object.hasOwn(enums, key)) valid = typeof value === "string" && enums[key].includes(value) && (key !== "mode" || node.type === "progress");
      else if (booleans.includes(key)) valid = typeof value === "boolean";
      else if (numbers.includes(key)) {
        valid = (group === "layout" && CONSTRAINTS.includes(key as Constraint) && value === null) || (typeof value === "number" && Number.isFinite(value));
        if (key.startsWith("padding") || ["scrollX", "scrollY", "maxChars"].includes(key)) valid = valid && Number(value) >= 0;
        if (["wrapCount", "maxChars", "selectedIndex"].includes(key)) valid = valid && Number.isSafeInteger(value) && Number(value) >= (key === "wrapCount" ? 1 : key === "selectedIndex" ? -1 : 0);
      } else if (group === "widget" && key === "skinNodeId") valid = ["checkbox", "radio", "slider", "progress"].includes(String(node.type)) && (value === null || typeof value === "string" && value.length > 0);
      else if (group === "widget" && key === "textLabelNodeId") valid = node.type === "combo" && (value === null || typeof value === "string" && value.length > 0);
      else if (group === "widget" && key === "templateVars") valid = isTemplateVars(value);
      else if (group === "widget" && key === "optionNodeIds") valid = node.type === "radioGroup" && Array.isArray(value) && value.length <= 1000 && value.every(id => id === null || typeof id === "string" && id.length > 0);
      else if (group === "widget" && key === "placeholder") valid = typeof value === "string";
      else if (group === "widget" && key === "options") valid = Array.isArray(value) && value.length <= 1000 && value.every((item) => typeof item === "string");
      if (!valid) errors.push(`${path}.${group}.${key} is invalid`);
    }
    if (group === "widget") {
      const min = Number(values.min ?? 0), max = Number(values.max ?? 1), value = Number(values.value ?? min);
      if (max <= min || value < min || value > max) errors.push(`${path}.widget range requires min < max and min <= value <= max`);
      if (node.type !== "radioGroup" && values.selectedIndex !== undefined && Number(values.selectedIndex) >= (Array.isArray(values.options) ? values.options.length : 3)) errors.push(`${path}.widget.selectedIndex exceeds options`);
    }
  }
  return before === errors.length;
}

export function isTemplateVars(value: unknown): value is WidgetProps["templateVars"] {
  return value === null || !!value && typeof value === "object" && !Array.isArray(value) &&
    Object.values(value).every(item => item === null || typeof item === "string" || typeof item === "boolean" || typeof item === "number" && Number.isFinite(item));
}
