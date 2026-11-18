import { useSliceResources } from "../runtime/resource-context";
import type { ConstraintLayout, GameFlowNode, GameFlowPage, NodeLayout, WidgetProps, NodeType } from "../../shared/model";
import { canHaveChildren, COMPONENTS, flowType } from "../../shared/ui-components";
import { AXES, managedAxis, resolvePageLayout } from "../../shared/ui-layout";
import { changeContainerType, setNodeConstraint } from "../../shared/ui-edit";
import { Field, NumericPropertyRow, ReadOnlyPropertyRow } from "./fields";
import { ConstraintControl, ContainerAlignment, PaddingControl } from "./layout-controls";
import { sliderOwner } from "../../shared/ui-parts";
import { useOverrideAttributes } from "./override-properties";
import { isTemplateVars } from "../../shared/ui-config";

function Select({ label, value, options, disabled, compact, onChange }: { label: string; value: string; options: readonly (readonly [string, string])[]; disabled?: boolean; compact?: boolean; onChange: (value: string) => void }) {
  const override=useOverrideAttributes(label);
  return <label {...override} className={`property-field${compact ? " compact-property-field" : ""}`}><span>{label}</span><select aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>{options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>;
}
function Toggle({ label, value, disabled, onChange }: { label: string; value: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  const override=useOverrideAttributes(label);
  return <label {...override} className="property-toggle"><input type="checkbox" checked={value} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span>{label}</span></label>;
}

export function PageLayoutProperties({ page, onPage }: {
  page: GameFlowPage; onPage: (transform: (page: GameFlowPage) => GameFlowPage) => void;
}) {
  const layout = page.layout ?? {};
  const set = (patch: Partial<ConstraintLayout>) => onPage(p => ({ ...p, layout: { ...p.layout, ...patch } }));
  return <details className="property-details" open><summary>根节点布局</summary>
    <Select compact label="约束单位" value={layout.layoutUnit ?? "absolute"} options={[["absolute", "像素"], ["percent", "百分比 %"]]} onChange={value => set({ layoutUnit: value as "absolute" | "percent" })} />
    <ConstraintControl layout={layout} disabledX={false} disabledY={false} onChange={set} onToggle={(key, enabled) => onPage(p => ({ ...p, layout: { ...p.layout, [key]: enabled ? p.layout?.[key] ?? 0 : null } }))} />
    <p className="property-hint">相对于游戏父容器生效，画布保持设计尺寸。切换单位保留数值。</p>
  </details>;
}

export function LayoutProperties({ page, node, locked, onNode, onPage, structureProtected }: {
  page: GameFlowPage; node: GameFlowNode; locked: boolean; structureProtected?: boolean;
  onNode: (id: string, patch: Partial<GameFlowNode>) => void; onPage: (transform: (page: GameFlowPage) => GameFlowPage) => void;
}) {
  const resources = useSliceResources();
  const layout = node.layout ?? {}, parent = page.nodes.find((n) => n.id === node.parentId), flow = flowType(node);
  const resolved = resolvePageLayout(page, resources.sizes).nodes.get(node.id)!;
  const set = (patch: Partial<NodeLayout>) => onNode(node.id, { layout: { ...layout, ...patch } });
  return <>
    <details className="property-details" open><summary>尺寸与约束</summary>
      <ReadOnlyPropertyRow label="尺寸来源" fields={(["x", "y"] as const).map((axis) => {
        const source = resolved[axis === "x" ? "widthSource" : "heightSource"], label = axis === "x" ? "宽度来源" : "高度来源";
        return { axis: axis === "x" ? "W" : "H", ariaLabel: label, value: { explicit: "显式尺寸", measured: "内容尺寸", stretch: "双边拉伸" }[source] };
      })} />
      <Select compact label="约束单位" value={layout.layoutUnit ?? "absolute"} disabled={locked} options={[["absolute", "像素"], ["percent", "百分比 %"]]} onChange={(value) => {
        const next = { ...layout, layoutUnit: value as "absolute" | "percent" };
        const parentFrame = parent ? resolvePageLayout(page, resources.sizes).nodes.get(parent.id)!.local : page.frame;
        for (const axis of ["x", "y"] as const) {
          const a = AXES[axis], size = parentFrame[a.size] - (parent?.layout?.[a.padStart] ?? 0) - (parent?.layout?.[a.padEnd] ?? 0);
          if (size <= 0 && value === "percent") return;
          for (const key of [a.leading, a.trailing, a.center]) if (layout[key] != null) next[key] = layout[key]! * (value === "percent" ? 100 / size : size / 100);
        }
        onNode(node.id, { layout: next });
      }} />
      <ConstraintControl layout={layout} disabledX={locked || !!sliderOwner(page, node) || managedAxis(parent, "x")} disabledY={locked || !!sliderOwner(page, node) || managedAxis(parent, "y")} onChange={set} onToggle={(key, enabled) => onPage((p) => setNodeConstraint(p, node.id, key, enabled, resources.sizes))} />
      {flowType(parent) !== "free" ? <p className="property-hint">父容器自动排布：拖动调整顺序；交叉轴可单独定位。</p> : null}
      {node.type === "text" && (layout.widthMode === "measured" || layout.heightMode === "measured") ? <p className="property-hint">文字内容尺寸为原型估算，实际以游戏字体为准。</p> : null}
    </details>
    {canHaveChildren(node) ? <details className="property-details" open><summary>容器布局</summary>
      {["container", "hbox", "vbox", "grid"].includes(node.type) ? <Select label="排布方式" value={node.type} disabled={locked || structureProtected || page.componentRootId === node.id || page.nodes.some((n) => n.parentId === node.id && n.locked)} options={[["container", "自由布局"], ["hbox", "横向排列"], ["vbox", "纵向排列"], ["grid", "网格排列"]]} onChange={(value) => onPage((p) => changeContainerType(p, node.id, value as NodeType, resources.sizes))} /> : null}
      <PaddingControl layout={layout} disabled={locked} onChange={set} />
      {flow === "hbox" || flow === "vbox" ? <Field label="间距" type="number" integer value={layout.gap ?? 0} disabled={locked || (flow === "hbox" ? layout.align === "justify" : layout.valign === "justify")} onCommit={(v) => set({ gap: Number(v) })} /> : null}
      {flow === "grid" ? <>
        <Select label="排列方向" value={layout.direction ?? "horizontal"} disabled={locked} options={[["horizontal", "横向优先"], ["vertical", "纵向优先"]]} onChange={(v) => set({ direction: v as "horizontal" | "vertical" })} />
        <Field label={layout.direction === "vertical" ? "每列数量" : "每行数量"} type="number" integer min={1} max={1000} value={layout.wrapCount ?? (node.type === "list" ? 4 : 2)} disabled={locked} onCommit={(v) => set({ wrapCount: Math.round(Number(v)) })} />
        <NumericPropertyRow label="间距" integer disabled={locked} fields={[{ axis: "X", ariaLabel: "水平间距", value: layout.gapX ?? 0, onCommit: gapX => set({ gapX }) }, { axis: "Y", ariaLabel: "垂直间距", value: layout.gapY ?? 0, onCommit: gapY => set({ gapY }) }]} />
      </> : null}
      {flow !== "free" ? <ContainerAlignment layout={layout} flow={flow} disabled={locked} onChange={set} /> : null}
      <Toggle label="裁剪超出内容" value={layout.clipContent ?? node.type === "panel"} disabled={locked} onChange={(v) => set({ clipContent: v })} />
      {node.type === "panel" || node.type === "list" ? <NumericPropertyRow label="滚动" integer disabled={locked} fields={[{ axis: "X", ariaLabel: "滚动 X", min: 0, value: layout.scrollX ?? 0, onCommit: scrollX => set({ scrollX }) }, { axis: "Y", ariaLabel: "滚动 Y", min: 0, value: layout.scrollY ?? 0, onCommit: scrollY => set({ scrollY }) }]} /> : null}
      {node.type === "list" ? <p className="property-hint">静态列表项可在层级树中编辑、复制和排序。</p> : null}
    </details> : null}
  </>;
}

export function WidgetProperties({ node, locked, onNode }: { node: GameFlowNode; locked: boolean; onNode: (id: string, patch: Partial<GameFlowNode>) => void }) {
  const w = node.widget ?? {};
  const set = (patch: Partial<WidgetProps>) => onNode(node.id, { widget: { ...w, ...patch } });
  const interactive = ["button", "input", "checkbox", "radio", "slider", "combo"].includes(node.type);
  if (!interactive && !["progress", "image"].includes(node.type)) return null;
  return <details className="property-details" open><summary>组件设置 <small>{COMPONENTS[node.type].laya}</small></summary>
    {interactive && node.type !== "slider" ? <Toggle label="禁用状态" value={w.disabled ?? false} disabled={locked} onChange={(v) => set({ disabled: v })} /> : null}
    {["progress", "slider"].includes(node.type) ? <>
      {(["min", "max"] as const).map((key) => <Field key={key} label={key === "min" ? "最小值" : "最大值"} type="number" value={w[key] ?? (key === "min" ? 0 : 1)} disabled={locked} validate={(v) => key === "min" ? Number(v) < (w.max ?? 1) : Number(v) > (w.min ?? 0)} onCommit={(v) => { const min = key === "min" ? Number(v) : w.min ?? 0, max = key === "max" ? Number(v) : w.max ?? 1; set({ [key]: Number(v), value: Math.min(max, Math.max(min, w.value ?? min)) }); }} />)}
      <Field label="当前值" type="number" min={w.min ?? 0} max={w.max ?? 1} value={w.value ?? w.min ?? 0} disabled={locked} onCommit={(v) => set({ value: Number(v) })} />
      <Select label="控件方向" value={w.direction ?? "horizontal"} disabled={locked} options={[["horizontal", "水平"], ["vertical", "垂直"]]} onChange={(v) => set({ direction: v as WidgetProps["direction"] })} />
    </> : null}
    {node.type === "input" ? <><Field label="占位文字" value={w.placeholder ?? "请输入内容"} disabled={locked} onCommit={(v) => set({ placeholder: v })} /><Field label="最大字数（0不限）" type="number" min={0} value={w.maxChars ?? 0} disabled={locked} onCommit={(v) => set({ maxChars: Math.round(Number(v)) })} /><Toggle label="密码显示" value={w.password ?? false} disabled={locked} onChange={(v) => set({ password: v })} /></> : null}
    {node.type === "combo" ? <><Field label="选项（用 | 分隔）" value={(w.options ?? ["选项一", "选项二", "选项三"]).join(" | ")} disabled={locked} onCommit={(v) => { const options = v.split("|").map((s) => s.trim()).filter(Boolean).slice(0, 1000); set({ options, selectedIndex: options.length ? 0 : -1 }); }} /><Select label="当前选项" value={String(w.selectedIndex ?? 0)} disabled={locked} options={[["-1", "未选中"], ...(w.options ?? ["选项一", "选项二", "选项三"]).map((s, i) => [String(i), s] as const)]} onChange={(v) => set({ selectedIndex: Number(v) })} /></> : null}
    {node.type === "image" ? <Select label="图片填充" value={w.imageFit ?? "contain"} disabled={locked} options={[["contain", "完整显示"], ["cover", "覆盖裁剪"], ["fill", "拉伸"]]} onChange={(v) => set({ imageFit: v as WidgetProps["imageFit"] })} /> : null}
  </details>;
}

export function LabelProperties({ node, locked, onNode }: { node: GameFlowNode; locked: boolean; onNode: (id: string, patch: Partial<GameFlowNode>) => void }) {
  const w = node.widget ?? {};
  const set = (patch: Partial<WidgetProps>) => onNode(node.id, { widget: { ...w, ...patch } });
  const syntaxOverride = useOverrideAttributes("文字语法");
  if (node.type !== "text") return null;
  return <>
    <Field label="行距" type="number" step={1} value={w.leading ?? 0} disabled={locked} onCommit={value => set({ leading: Number(value) })} />
    <Field label="字距" type="number" step={1} value={w.letterSpacing ?? 0} disabled={locked} onCommit={value => set({ letterSpacing: Number(value) })} />
    <Toggle label="自动换行" value={w.wordWrap ?? true} disabled={locked} onChange={wordWrap => set({ wordWrap })} />
    <Select label="文字溢出" value={w.overflow ?? "hidden"} disabled={locked} options={[["visible", "显示溢出"], ["hidden", "裁剪"], ["scroll", "滚动"], ["shrink", "缩小字体"], ["ellipsis", "省略号"]]} onChange={overflow => set({ overflow: overflow as WidgetProps["overflow"] })} />
    {w.overflow === "scroll" ? <NumericPropertyRow label="文字滚动" disabled={locked} fields={[{ axis: "X", ariaLabel: "文字滚动 X", min: 0, value: w.scrollX ?? 0, onCommit: scrollX => set({ scrollX }) }, { axis: "Y", ariaLabel: "文字滚动 Y", min: 0, value: w.scrollY ?? 0, onCommit: scrollY => set({ scrollY }) }]} /> : null}
    <div className="label-syntax-row" {...syntaxOverride}><span>语法</span><div>
      <Toggle label="HTML" value={w.html ?? false} disabled={locked} onChange={html => set({ html })} />
      <Toggle label="UBB" value={w.ubb ?? false} disabled={locked} onChange={ubb => set({ ubb })} />
      <Toggle label="模板" value={w.templateVars != null} disabled={locked} onChange={enabled => set({ templateVars: enabled ? {} : null })} />
    </div></div>
    {w.templateVars != null ? <Field label="模板变量" value={JSON.stringify(w.templateVars)} disabled={locked} validate={value => { try { const vars: unknown = JSON.parse(value); return vars !== null && isTemplateVars(vars); } catch { return false; } }} onCommit={value => set({ templateVars: JSON.parse(value) as WidgetProps["templateVars"] })} /> : null}
  </>;
}
