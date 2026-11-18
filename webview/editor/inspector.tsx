import { useState, type CSSProperties } from "react";
import { ChevronDown, ChevronUp, ImagePlus, LockKeyhole, X } from "lucide-react";
import type { Frame, GameFlowNode, GameFlowPage, NodeStyle, PageRootType } from "../../shared/model";
import { defaultStyle, inheritedFlag, NODE_LABELS } from "../../shared/editor-ops";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import { ScrollArea } from "../components/ui/scroll-area";
import { Field, ColorField, NumericPropertyRow, SliderPropertyRow } from "./fields";
import { VariableField } from "./variable-field";
import { LabelProperties, LayoutProperties, PageLayoutProperties, WidgetProperties } from "./ui-properties";
import { COMPONENTS, flowType, PAGE_ROOTS, PAGE_ROOT_TYPES, pageRootType } from "../../shared/ui-components";
import { resolvePageLayout, constraintsFor, managedAxis } from "../../shared/ui-layout";
import { editNodeFrame, setNodeAnchor } from "../../shared/ui-edit";
import { hasNodeSkin, sliderOwner } from "../../shared/ui-parts";
import { ControlPartsProperties } from "./control-parts";
import type { ColorPreview } from "../lib/color-edit";
import { CanvasPropertyProvider, type OverrideActions } from "./override-properties";
import type { CanvasNodeInfo } from "../../shared/canvas-instances";
import { TextControls } from "./text-controls";
import { ReferenceBar } from "./reference-bar";
import type { CanvasOverrideManager } from "./override-panel";
import { SliceBindingField } from "../runtime/binding-field";
import { useSliceResources } from "../runtime/resource-context";

export function Inspector({ page, variablePage = page, node, selectedNodes = [], editingPage, onNode, onPage, onColorPreview, onClose, onEnter, onImport, onCreateParts, panelRef, panelStyle, referenceError, referenceName, overrideManager, onOpenSource, referenceMeta, overrideActions, onPsd }: {
  variablePage?: GameFlowPage;
  page: GameFlowPage; node: GameFlowNode | null; editingPage: boolean;
  selectedNodes?: GameFlowNode[];
  panelRef?: (element: HTMLElement | null) => void; panelStyle?: CSSProperties;
  onNode: (id: string, patch: Partial<GameFlowNode>) => void;
  onPage: (transform: (page: GameFlowPage) => GameFlowPage) => void;
  onColorPreview: (preview: ColorPreview | null) => void;
  onClose: () => void; onEnter: () => void; onImport: () => void;
  onCreateParts: () => void;
  onPsd: () => void;
  referenceError?: string; onOpenSource: () => void;
  referenceName?: string; overrideManager?: CanvasOverrideManager;
  referenceMeta?: CanvasNodeInfo; overrideActions?: OverrideActions;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const locked = node ? inheritedFlag(page, node, "locked") : false;
  const resources = useSliceResources();
  const geometry = resolvePageLayout(page, resources.sizes);
  const frame = node ? geometry.nodes.get(node.id)!.local : page.frame;
  const parent = page.nodes.find((n) => n.id === node?.parentId);
  const identityLabel = node ? `${NODE_LABELS[node.type]}(${COMPONENTS[node.type].laya})` : `${page.kind === "modal" ? "弹窗" : "页面"}(${pageRootType(page)})`;
  const appearance = { ...defaultStyle(node?.type ?? "rectangle"), ...node?.style };
  const setFrame = (key: keyof Frame, value: string) => {
    if (node) onPage((item) => editNodeFrame(item, node.id, { ...frame, [key]: Number(value) }, "resize", resources.sizes));
    else if (!editingPage || key === "width" || key === "height") onPage((item) => ({ ...item, frame: { ...item.frame, [key]: Number(value) } }));
  };
  const setStyle = (patch: Partial<NodeStyle>) => { if (node) onNode(node.id, { style: { ...node.style, ...patch } }); };
  const previewColor = (property: ColorPreview["property"], value: string | null) => onColorPreview(value === null ? null : { pageId: page.id, nodeId: node?.id, property, value });
  return <CanvasPropertyProvider actions={overrideActions}><aside ref={panelRef} className="inspector floating-panel" aria-label="悬浮属性面板" style={panelStyle} onContextMenu={event=>{event.preventDefault();event.stopPropagation();}} onPointerDown={(event) => event.stopPropagation()}>
    <div className="floating-heading">
      <strong>{selectedNodes.length > 1 ? `已选择 ${selectedNodes.length} 个控件` : node ? "控件属性" : "页面属性"}</strong>
      <Button variant="ghost" size="icon" aria-label={collapsed ? "展开属性面板" : "收起属性面板"} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</Button>
      <Button variant="ghost" size="icon" aria-label="关闭属性面板" onClick={onClose}><X size={14} /></Button>
    </div>
    {!collapsed ? <ScrollArea className="inspector-scroll" label="属性内容" key={selectedNodes.length > 1 ? "selection" : node?.id ?? page.id}>
    {selectedNodes.length > 1 ? <div className="inspector-content multiselection-summary">
      <p className="property-hint">Ctrl 点击增减选择 · Shift 点击连续选择</p>
      <ul>{selectedNodes.map(item => <li key={item.id}><span>{item.name}</span><small>{COMPONENTS[item.type].laya}</small></li>)}</ul>
      <p className="property-hint">方向键移动整组 · Delete / Backspace 删除<br />单击控件可编辑它的属性</p>
    </div> : <div className="inspector-content">
      <div className="component-identity"><span title={identityLabel}>{identityLabel}</span><code title="稳定节点 ID">{referenceMeta?.target.path.at(-1)?.nodeId ?? node?.id ?? page.id}</code></div>
      {referenceMeta?.ownerId ? <ReferenceBar key={node?.id} meta={referenceMeta} name={referenceName} error={referenceError} manager={overrideManager} onOpenSource={onOpenSource} /> : null}
      {node && node.id === page.componentRootId ? <p className="property-hint">组件根节点：内容与外观同步到引用，根的位置、尺寸和变换由各实例独立保存。</p> : null}
      {geometry.issues.length ? <div className="layout-diagnostics" role="status"><strong>布局需要调整</strong>{geometry.issues.slice(0, 4).map((issue, i) => <p key={i}>{issue.message}</p>)}<p>暂用原始位置/尺寸显示，可继续修改。</p></div> : null}
      <Field label={node ? "名称" : "页面名称"} value={node?.name ?? page.name} disabled={locked} validate={(name) => !!name.trim()} onCommit={(name) => {
        if (!name.trim()) return;
        if (node) onNode(node.id, { name: name.trim() }); else onPage((item) => ({ ...item, name: name.trim() }));
      }} />
      {node ? <VariableField page={variablePage} node={node} disabled={locked} onCommit={(variableName) => onNode(node.id, { variableName })} /> :
        <Field label="导出名称" value={page.exportName ?? ""} onCommit={value => onPage(item => ({ ...item, exportName: value.trim() || undefined }))} />}
      <div className="property-section-title">基础属性</div>
      <NumericPropertyRow label="位置" integer disabled={locked} fields={(["x", "y"] as const).map(key => ({ axis: key.toUpperCase(), ariaLabel: key.toUpperCase(), value: !node && editingPage ? 0 : frame[key], readOnly: !node && editingPage, disabled: !!node && (!!sliderOwner(page, node) || managedAxis(parent, key) || (flowType(parent) !== "free" && node.layout?.crossAxisMode !== "explicit" && !constraintsFor(key).some(k => node.layout?.[k] != null))), onCommit: value => setFrame(key, String(value)) }))} />
      <NumericPropertyRow label="尺寸" integer disabled={locked} fields={(["width", "height"] as const).map(key => ({ axis: key === "width" ? "W" : "H", ariaLabel: key === "width" ? "W" : "H", value: frame[key], min: 8, onCommit: value => setFrame(key, String(value)) }))} />
      {node ? <>
        {([{ label: "锚点", keys: ["anchorX", "anchorY"], initial: 0 }, { label: "缩放", keys: ["scaleX", "scaleY"], initial: 1 }, { label: "倾斜", keys: ["skewX", "skewY"], initial: 0 }, { label: "旋转", keys: ["rotation"], initial: 0 }] as const).map(row => <NumericPropertyRow key={row.label} label={row.label} precision={2} disabled={locked} fields={row.keys.map((key, i) => ({ axis: key === "rotation" ? "°" : i ? "Y" : "X", ariaLabel: key === "rotation" ? "旋转角度" : `${row.label} ${i ? "Y" : "X"}`, value: node.transform?.[key] ?? row.initial, ...(row.label === "锚点" ? { min: 0, max: 1 } : {}), onCommit: value => key === "anchorX" || key === "anchorY" ? onPage(item => setNodeAnchor(item, node.id, { [key]: value }, resources.sizes)) : onNode(node.id, { transform: { ...node.transform, [key]: value } }) }))} />)}
        <SliderPropertyRow label="不透明度" value={appearance.opacity} disabled={locked} onCommit={opacity => setStyle({ opacity })} />
        {!geometry.nodes.get(node.id)!.inverse ? <p className="property-hint">变换使控件压扁，画布拖动暂不可用；调整缩放或倾斜可恢复。</p> : null}
        {locked ? <div className="locked-message"><LockKeyhole size={13} />控件已锁定，请在图层树中解锁</div> : null}
        <LayoutProperties page={page} node={node} locked={locked} structureProtected={!!referenceMeta?.inherited || !!referenceMeta?.reference} onNode={onNode} onPage={onPage} />
        {!node.prefab ? <><ControlPartsProperties page={page} node={node} locked={locked} onNode={onNode} onPage={onPage} onCreateParts={onCreateParts} />
        <WidgetProperties node={node} locked={locked} onNode={onNode} /></> : null}
        {(["text", "input"].includes(node.type) || (["checkbox", "radio"].includes(node.type) && !hasNodeSkin(node)) || (node.type === "button" && node.text !== undefined)) ? <>
          <div className="property-section-title">文字</div>
          <Field label="文字内容" multiline={node.type === "text"} value={node.text ?? node.name} disabled={locked} onCommit={(text) => onNode(node.id, { text })} />
          <Field label="字号" type="number" min={1} max={300} value={appearance.fontSize} disabled={locked} onCommit={(fontSize) => setStyle({ fontSize: Number(fontSize) })} />
          <ColorField label="文字颜色" value={appearance.color} disabled={locked} onPreview={value => previewColor("color", value)} onCommit={(color) => setStyle({ color })} />
          <TextControls style={appearance} valign={node.widget?.valign ?? (node.type === "text" ? "top" : "middle")} disabled={locked} onStyle={setStyle} onVertical={valign => onNode(node.id, { widget: { ...node.widget, valign } })} />
          <LabelProperties node={node} locked={locked} onNode={onNode} /><Separator />
        </> : null}
        {node.type === "image" ? <><SliceBindingField node={node} disabled={locked} onChange={sliceResource => onNode(node.id, { sliceResource })} onPsd={onPsd} /><Button variant="outline" size="sm" disabled={locked} onClick={onImport}><ImagePlus size={14} />{node.imageData ? "替换图片" : "导入图片"}</Button></> : null}
        {!node.prefab ? <><div className="property-section-title">外观</div>
        <ColorField label="填充" value={appearance.fill} disabled={locked} onPreview={value => previewColor("fill", value)} onCommit={(fill) => setStyle({ fill })} />
        <Button variant="ghost" size="sm" className="transparent-button" disabled={locked} onClick={() => setStyle({ fill: "transparent" })}>设为透明</Button>
        <ColorField label="描边" value={appearance.borderColor} disabled={locked} onPreview={value => previewColor("borderColor", value)} onCommit={(borderColor) => setStyle({ borderColor })} />
        <Field label="描边宽度" type="number" min={0} max={40} value={appearance.borderWidth} disabled={locked} onCommit={(value) => setStyle({ borderWidth: Number(value) })} />
        <Field label="圆角" type="number" min={0} value={appearance.radius} disabled={locked} onCommit={(value) => setStyle({ radius: Number(value) })} /></> : null}
      </> : <>
        <label className="property-field"><span>页面类型</span><select aria-label="页面类型" value={pageRootType(page)} onChange={(event) => { const rootType = event.target.value as PageRootType; onPage((item) => ({ ...item, rootType })); }}>
          {PAGE_ROOT_TYPES.map((type) => <option key={type} value={type}>{PAGE_ROOTS[type].label} ({type})</option>)}
        </select></label>
        <label className="property-field"><span>页面形式</span><select aria-label="页面形式" value={page.kind} onChange={(event) => { const kind = event.target.value as "screen" | "modal"; onPage((item) => ({ ...item, kind })); }}><option value="screen">页面</option><option value="modal">弹窗</option></select></label>
        <ColorField label="页面背景" value={page.background ?? "#ffffff"} onPreview={value => previewColor("background", value)} onCommit={(background) => onPage((item) => ({ ...item, background }))} />
        <PageLayoutProperties page={page} onPage={onPage} />
        <Button size="sm" variant="outline" onClick={onEnter}>进入页面编辑</Button>
      </>}
    </div>}
    </ScrollArea> : null}
  </aside></CanvasPropertyProvider>;
}
