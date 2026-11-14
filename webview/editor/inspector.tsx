import { useState, type CSSProperties } from "react";
import { AlignCenter, AlignLeft, AlignRight, ChevronDown, ChevronUp, ImagePlus, LockKeyhole, X } from "lucide-react";
import type { Frame, GameFlowNode, GameFlowPage, NodeStyle, PageRootType } from "../../shared/model";
import { defaultStyle, descendants, inheritedFlag, NODE_LABELS, reparentNode } from "../../shared/editor-ops";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import { Field, ColorField } from "./fields";
import { VariableField } from "./variable-field";
import { LayoutProperties, WidgetProperties } from "./ui-properties";
import { canHaveChildren, COMPONENTS, flowType, PAGE_ROOTS, PAGE_ROOT_TYPES, pageRootType } from "../../shared/ui-components";
import { resolvePageLayout, constraintsFor, managedAxis } from "../../shared/ui-layout";
import { editNodeFrame } from "../../shared/ui-edit";

export function Inspector({ page, node, onNode, onPage, onClose, onEnter, onImport, panelRef, panelStyle }: {
  page: GameFlowPage; node: GameFlowNode | null;
  panelRef?: (element: HTMLElement | null) => void; panelStyle?: CSSProperties;
  onNode: (id: string, patch: Partial<GameFlowNode>) => void;
  onPage: (transform: (page: GameFlowPage) => GameFlowPage) => void;
  onClose: () => void; onEnter: () => void; onImport: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const locked = node ? inheritedFlag(page, node, "locked") : false;
  const geometry = resolvePageLayout(page);
  const frame = node ? geometry.nodes.get(node.id)!.local : page.frame;
  const parent = page.nodes.find((n) => n.id === node?.parentId);
  const identityLabel = node ? `${NODE_LABELS[node.type]}(${COMPONENTS[node.type].laya})` : `${page.kind === "modal" ? "弹窗" : "页面"}(${pageRootType(page)})`;
  const appearance = { ...defaultStyle(node?.type ?? "rectangle"), ...node?.style };
  const setFrame = (key: keyof Frame, value: string) => {
    const next = { ...frame, [key]: Number(value) };
    if (node) onPage((item) => editNodeFrame(item, node.id, next)); else onPage((item) => ({ ...item, frame: next }));
  };
  const setStyle = (patch: Partial<NodeStyle>) => { if (node) onNode(node.id, { style: { ...node.style, ...patch } }); };
  return <aside ref={panelRef} className="inspector floating-panel" aria-label="悬浮属性面板" style={panelStyle} onPointerDown={(event) => event.stopPropagation()}>
    <div className="floating-heading">
      <strong>{node ? "控件属性" : "页面属性"}</strong>
      <Button variant="ghost" size="icon" aria-label={collapsed ? "展开属性面板" : "收起属性面板"} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</Button>
      <Button variant="ghost" size="icon" aria-label="关闭属性面板" onClick={onClose}><X size={14} /></Button>
    </div>
    {!collapsed ? <div className="inspector-content" key={node?.id ?? page.id}>
      <div className="component-identity"><span title={identityLabel}>{identityLabel}</span><code title="稳定节点 ID">{node?.id ?? page.id}</code></div>
      {geometry.issues.length ? <div className="layout-diagnostics" role="status"><strong>布局需要调整</strong>{geometry.issues.slice(0, 4).map((issue, i) => <p key={i}>{issue.message}</p>)}<p>暂用原始位置/尺寸显示，可继续修改。</p></div> : null}
      <Field label={node ? "名称" : "页面名称"} value={node?.name ?? page.name} disabled={locked} validate={(name) => !!name.trim()} onCommit={(name) => {
        if (!name.trim()) return;
        if (node) onNode(node.id, { name: name.trim() }); else onPage((item) => ({ ...item, name: name.trim() }));
      }} />
      {node ? <VariableField page={page} node={node} disabled={locked} onCommit={(variableName) => onNode(node.id, { variableName })} /> : null}
      <div className="property-section-title">位置与尺寸</div>
      <div className="property-grid">{(["x", "y", "width", "height"] as const).map((key) => <Field key={key} label={key === "width" ? "W" : key === "height" ? "H" : key.toUpperCase()} type="number" integer value={frame[key]} min={key === "width" || key === "height" ? 8 : undefined} disabled={locked || (!!node && (key === "x" || key === "y") && (managedAxis(parent, key) || (flowType(parent) !== "free" && node.layout?.crossAxisMode !== "explicit" && !constraintsFor(key).some((k) => node.layout?.[k] != null))))} onCommit={(value) => setFrame(key, value)} />)}</div>
      {node ? <>
        <label className="property-field"><span>父容器</span><select aria-label="父容器" disabled={locked} value={node.parentId ?? ""} onChange={(event) => onPage((item) => reparentNode(item, node.id, event.target.value || undefined))}>
          <option value="">页面根节点</option>{page.nodes.filter((item) => canHaveChildren(item) && !inheritedFlag(page, item, "locked") && !descendants(page, node.id).has(item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        {locked ? <div className="locked-message"><LockKeyhole size={13} />控件已锁定，请在图层树中解锁</div> : null}
        <Separator />
        <LayoutProperties page={page} node={node} locked={locked} onNode={onNode} onPage={onPage} />
        <WidgetProperties node={node} locked={locked} onNode={onNode} />
        {(["text", "input", "checkbox", "radio"].includes(node.type) || (node.type === "button" && node.text !== undefined)) ? <>
          <div className="property-section-title">文字</div>
          <Field label="文字内容" value={node.text ?? node.name} disabled={locked} onCommit={(text) => onNode(node.id, { text })} />
          <div className="property-grid"><Field label="字号" type="number" min={1} max={300} value={appearance.fontSize} disabled={locked} onCommit={(fontSize) => setStyle({ fontSize: Number(fontSize) })} />
            <label className="property-field"><span>字重</span><select aria-label="字重" value={appearance.fontWeight} disabled={locked} onChange={(event) => setStyle({ fontWeight: Number(event.target.value) })}><option value={400}>常规</option><option value={500}>中等</option><option value={600}>半粗</option><option value={700}>粗体</option></select></label></div>
          <ColorField label="文字颜色" value={appearance.color} disabled={locked} onCommit={(color) => setStyle({ color })} />
          <div className="alignment-buttons">{(["left", "center", "right"] as const).map((align, i) => {
            const Icon = [AlignLeft, AlignCenter, AlignRight][i];
            return <Button key={align} variant={appearance.textAlign === align ? "secondary" : "ghost"} size="sm" disabled={locked} aria-label={`${["左", "居中", "右"][i]}对齐`} onClick={() => setStyle({ textAlign: align })}><Icon size={15} /></Button>;
          })}</div><Separator />
        </> : null}
        {node.type === "image" ? <Button variant="outline" size="sm" disabled={locked} onClick={onImport}><ImagePlus size={14} />{node.imageData ? "替换图片" : "导入图片"}</Button> : null}
        <div className="property-section-title">外观</div>
        <ColorField label="填充" value={appearance.fill} disabled={locked} onCommit={(fill) => setStyle({ fill })} />
        <Button variant="ghost" size="sm" className="transparent-button" disabled={locked} onClick={() => setStyle({ fill: "transparent" })}>设为透明</Button>
        <ColorField label="描边" value={appearance.borderColor} disabled={locked} onCommit={(borderColor) => setStyle({ borderColor })} />
        <div className="property-grid"><Field label="描边宽度" type="number" min={0} max={40} value={appearance.borderWidth} disabled={locked} onCommit={(value) => setStyle({ borderWidth: Number(value) })} />
          <Field label="圆角" type="number" min={0} value={appearance.radius} disabled={locked} onCommit={(value) => setStyle({ radius: Number(value) })} /></div>
        <Field label="不透明度 %" type="number" min={0} max={100} value={Math.round(appearance.opacity * 100)} disabled={locked} onCommit={(value) => setStyle({ opacity: Number(value) / 100 })} />
      </> : <>
        <label className="property-field"><span>页面类型</span><select aria-label="页面类型" value={pageRootType(page)} onChange={(event) => { const rootType = event.target.value as PageRootType; onPage((item) => ({ ...item, rootType })); }}>
          {PAGE_ROOT_TYPES.map((type) => <option key={type} value={type}>{PAGE_ROOTS[type].label} ({type})</option>)}
        </select></label>
        <label className="property-field"><span>页面形式</span><select aria-label="页面形式" value={page.kind} onChange={(event) => { const kind = event.target.value as "screen" | "modal"; onPage((item) => ({ ...item, kind })); }}><option value="screen">页面</option><option value="modal">弹窗</option></select></label>
        <ColorField label="页面背景" value={page.background ?? "#ffffff"} onCommit={(background) => onPage((item) => ({ ...item, background }))} />
        <Button size="sm" variant="outline" onClick={onEnter}>进入页面编辑</Button>
      </>}
    </div> : null}
  </aside>;
}
