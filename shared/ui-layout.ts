import type { Frame, GameFlowNode, GameFlowPage } from "./model";
import { canHaveChildren, flowType } from "./ui-components";
import type { Constraint } from "./ui-config";

export type SizeSource = "explicit" | "measured" | "stretch";
export interface ResolvedNode { local: Frame; absolute: Frame; widthSource: SizeSource; heightSource: SizeSource; clip?: Frame }
export interface LayoutResult { nodes: Map<string, ResolvedNode>; issues: { nodeId: string; message: string }[] }
export const AXES = {
  x: { size: "width", mode: "widthMode", leading: "left", trailing: "right", center: "centerX", padStart: "paddingLeft", padEnd: "paddingRight", scroll: "scrollX" },
  y: { size: "height", mode: "heightMode", leading: "top", trailing: "bottom", center: "centerY", padStart: "paddingTop", padEnd: "paddingBottom", scroll: "scrollY" }
} as const;
export type Axis = keyof typeof AXES;
export function constraintsFor(axis: Axis): Constraint[] { const a = AXES[axis]; return [a.leading, a.trailing, a.center]; }
export function managedAxis(parent: GameFlowNode | undefined, axis: Axis): boolean {
  const flow = flowType(parent); return flow === "grid" || flow === (axis === "x" ? "hbox" : "vbox");
}
export function intersectFrames(a: Frame, b: Frame): Frame {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  return { x, y, width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x), height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y) };
}

/** LayaUI layout for the prototype's unscaled, unrotated coordinate space. No DOM measurements. */
export function resolvePageLayout(page: GameFlowPage): LayoutResult {
  const result: LayoutResult = { nodes: new Map(), issues: [] };
  const byId = new Map(page.nodes.map((n) => [n.id, n]));
  const children = new Map<string | undefined, GameFlowNode[]>();
  for (const n of page.nodes) { const list = children.get(n.parentId) ?? []; list.push(n); children.set(n.parentId, list); }
  const sizes = new Map<string, { value: number; source: SizeSource }>();
  const computing = new Set<string>();
  const fail = (message: string): never => { throw new Error(message); };
  const has = (n: GameFlowNode, axis: Axis) => constraintsFor(axis).some((key) => n.layout?.[key] != null);
  const pad = (n: GameFlowNode, axis: Axis) => [n.layout?.[AXES[axis].padStart] ?? 0, n.layout?.[AXES[axis].padEnd] ?? 0];
  const source = (n: GameFlowNode, axis: Axis): SizeSource => {
    const a = AXES[axis], l = n.layout;
    return l?.[a.leading] != null && l?.[a.trailing] != null ? "stretch" : l?.[a.mode] === "measured" ? "measured" : "explicit";
  };
  const content = (parent: GameFlowNode | undefined, axis: Axis): { start: number; size: number } => {
    if (!parent) return { start: 0, size: page.frame[AXES[axis].size] };
    const [start, end] = pad(parent, axis), available = size(parent, axis).value - start - end;
    if (available < 0) fail(`${parent.name}：内边距超过容器尺寸`);
    return { start, size: available };
  };
  const offset = (n: GameFlowNode, key: Constraint, available: number) => (n.layout?.[key] ?? 0) * (n.layout?.layoutUnit === "percent" ? available / 100 : 1);
  const size = (n: GameFlowNode, axis: Axis): { value: number; source: SizeSource } => {
    const key = `${n.id}:${axis}`, saved = sizes.get(key); if (saved) return saved;
    if (computing.has(key)) fail(`${n.name}：内容尺寸与子节点约束形成循环依赖`);
    computing.add(key);
    try {
      const a = AXES[axis], s = source(n, axis), l = n.layout;
      let value = n.frame[a.size];
      const parent = byId.get(n.parentId ?? "");
      if (managedAxis(parent, axis) && has(n, axis)) fail(`${n.name}：父容器排布管理${axis === "x" ? "水平" : "垂直"}轴，请清除该轴约束`);
      if (s === "stretch") {
        const p = content(parent, axis);
        value = p.size - offset(n, a.leading, p.size) - offset(n, a.trailing, p.size);
      } else if (s === "measured") {
        const items = children.get(n.id) ?? [], flow = flowType(n), [start, end] = pad(n, axis);
        if (canHaveChildren(n)) {
          const main = flow === (axis === "x" ? "hbox" : "vbox");
          const cross = flow === (axis === "x" ? "vbox" : "hbox");
          for (const child of items) {
            const cl = child.layout;
            if ((flow !== "free" && has(child, axis)) || cl?.[a.trailing] != null || cl?.[a.center] != null || (cl?.layoutUnit === "percent" && cl?.[a.leading] != null)) {
              fail(`${n.name}：内容${axis === "x" ? "宽度" : "高度"}依赖 ${child.name} 的同轴约束，请使用固定尺寸或清除约束`);
            }
          }
          const lengths = items.map((child) => size(child, axis).value);
          if (main) {
            const justify = axis === "x" ? l?.align === "justify" : l?.valign === "justify";
            value = lengths.reduce((sum, v) => sum + v, 0) + Math.max(0, items.length - 1) * (justify ? 0 : l?.gap ?? 0);
          } else if (cross) value = Math.max(0, ...lengths);
          else if (flow === "grid") value = gridExtent(n, axis, lengths);
          else value = Math.max(0, ...items.map((child, i) => (child.layout?.[a.leading] ?? child.frame[axis]) + lengths[i]));
          value += start + end;
        } else if (n.type === "text" || n.type === "input") {
          const font = n.style?.fontSize ?? (n.type === "text" ? 16 : 14);
          const lines = (n.text || n.widget?.placeholder || "").split("\n");
          const widths = lines.map((line) => [...line].reduce((sum, char) => sum + (char.codePointAt(0)! > 255 ? 1 : 0.56) * font, 0));
          if (axis === "x") value = Math.max(0, ...widths);
          else {
            const wrap = n.widget?.wordWrap !== false && source(n, "x") !== "measured";
            const width = wrap ? Math.max(1, size(n, "x").value) : Infinity;
            value = widths.reduce((sum, widthOfLine) => sum + Math.max(1, Math.ceil(widthOfLine / width)), 0) * font * 1.35;
          }
        } // Raster natural dimensions are not persisted; retain its explicit fallback.
      }
      if (!Number.isFinite(value) || value < 0) fail(`${n.name}：布局尺寸必须为非负有限数值`);
      const answer = { value, source: s }; sizes.set(key, answer); return answer;
    } finally { computing.delete(key); }
  };
  const gridExtent = (n: GameFlowNode, axis: Axis, lengths: number[]) => {
    const l = n.layout, wrap = l?.wrapCount ?? (n.type === "list" ? 4 : 2);
    const first = (l?.direction ?? "horizontal") === (axis === "x" ? "horizontal" : "vertical");
    const count = first ? Math.min(wrap, lengths.length) : Math.ceil(lengths.length / wrap);
    return count ? count * Math.max(0, ...lengths) + (count - 1) * (l?.[axis === "x" ? "gapX" : "gapY"] ?? 0) : 0;
  };
  const position = (n: GameFlowNode, axis: Axis): number => {
    const a = AXES[axis], l = n.layout, parent = byId.get(n.parentId ?? ""), flow = flowType(parent);
    const length = size(n, axis).value;
    const p = content(parent, axis);
    if (parent && flow !== "free") {
      const items = children.get(parent.id) ?? [], index = items.indexOf(n), pl = parent.layout;
      const lengths = items.map((child) => size(child, axis).value);
      const align = axis === "x" ? pl?.align ?? "left" : pl?.valign ?? "top";
      const factor = ["center", "middle"].includes(align) ? 0.5 : ["right", "bottom"].includes(align) ? 1 : 0;
      if (managedAxis(parent, axis)) {
        if (flow === "grid") {
          const wrap = pl?.wrapCount ?? (parent.type === "list" ? 4 : 2);
          const first = (pl?.direction ?? "horizontal") === (axis === "x" ? "horizontal" : "vertical");
          const cellIndex = first ? index % wrap : Math.floor(index / wrap);
          const extent = gridExtent(parent, axis, lengths);
          if (extent < 0) fail(`${parent.name}：网格尺寸不能为负`);
          return p.start + (p.size - extent) * factor + cellIndex * (Math.max(0, ...lengths) + (pl?.[axis === "x" ? "gapX" : "gapY"] ?? 0));
        }
        const total = lengths.reduce((sum, v) => sum + v, 0), gaps = Math.max(0, lengths.length - 1);
        const gap = align === "justify" ? gaps ? (p.size - total) / gaps : 0 : pl?.gap ?? 0;
        return p.start + (p.size - total - gap * gaps) * factor + lengths.slice(0, index).reduce((sum, v) => sum + v, 0) + index * gap;
      }
      if (!has(n, axis)) return l?.crossAxisMode === "explicit" ? n.frame[axis] : p.start + (p.size - length) * factor;
    }
    if (has(n, axis) && parent && source(parent, axis) === "measured" && (l?.layoutUnit === "percent" || l?.[a.trailing] != null || l?.[a.center] != null)) fail(`${n.name}：相对约束需要父容器固定尺寸`);
    if (l?.[a.center] != null) return Math.round(p.start + (p.size - length) / 2 + offset(n, a.center, p.size));
    if (l?.[a.leading] != null) return Math.round(p.start + offset(n, a.leading, p.size));
    if (l?.[a.trailing] != null) return Math.round(p.start + p.size - length - offset(n, a.trailing, p.size));
    return n.frame[axis];
  };
  const building = new Set<string>();
  const resolve = (n: GameFlowNode): ResolvedNode => {
    const existing = result.nodes.get(n.id); if (existing) return existing;
    if (building.has(n.id)) throw new Error("循环父级");
    building.add(n.id);
    const local = { ...n.frame };
    const sources: { widthSource: SizeSource; heightSource: SizeSource } = { widthSource: "explicit", heightSource: "explicit" };
    for (const axis of ["x", "y"] as const) {
      try {
        const s = size(n, axis); local[AXES[axis].size] = s.value;
        sources[axis === "x" ? "widthSource" : "heightSource"] = s.source;
        local[axis] = position(n, axis);
      } catch (error) {
        local[axis] = n.frame[axis]; local[AXES[axis].size] = n.frame[AXES[axis].size];
        sources[axis === "x" ? "widthSource" : "heightSource"] = "explicit";
        result.issues.push({ nodeId: n.id, message: error instanceof Error ? error.message : String(error) });
      }
    }
    const parent = byId.get(n.parentId ?? ""), parentGeometry = parent ? resolve(parent) : undefined;
    const absolute = { ...local, x: local.x + (parentGeometry?.absolute.x ?? 0) - (parent?.layout?.scrollX ?? 0), y: local.y + (parentGeometry?.absolute.y ?? 0) - (parent?.layout?.scrollY ?? 0) };
    let clip = parentGeometry?.clip;
    if (parent && parentGeometry && (parent.layout?.clipContent ?? parent.type === "panel")) clip = clip ? intersectFrames(clip, parentGeometry.absolute) : parentGeometry.absolute;
    const resolved = { local, absolute, ...sources, ...(clip ? { clip } : {}) };
    result.nodes.set(n.id, resolved); building.delete(n.id); return resolved;
  };
  for (const node of page.nodes) resolve(node);
  result.issues = result.issues.filter((issue, i, all) => all.findIndex((other) => other.nodeId === issue.nodeId && other.message === issue.message) === i);
  return result;
}
