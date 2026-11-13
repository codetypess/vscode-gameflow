import { useRef, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, ChevronDown, ChevronUp, Copy, GripHorizontal, ImagePlus, LockKeyhole, Trash2, X } from "lucide-react";
import type { Frame, GameFlowNode, GameFlowPage, NodeStyle } from "../../shared/model";
import { defaultStyle, descendants, inheritedFlag, NODE_LABELS, reparentNode } from "../../shared/editor-ops";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import { Field, ColorField } from "./fields";

export function Inspector({ page, node, onNode, onPage, onDuplicate, onDelete, onClose, onEnter, onImport }: {
  page: GameFlowPage; node: GameFlowNode | null;
  onNode: (id: string, patch: Partial<GameFlowNode>) => void;
  onPage: (transform: (page: GameFlowPage) => GameFlowPage) => void;
  onDuplicate: () => void; onDelete: () => void; onClose: () => void; onEnter: () => void; onImport: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; minX: number; maxX: number; minY: number; maxY: number } | null>(null);
  const locked = node ? inheritedFlag(page, node, "locked") : false;
  const frame = node?.frame ?? page.frame;
  const appearance = { ...defaultStyle(node?.type ?? "rectangle"), ...node?.style };
  const setFrame = (key: keyof Frame, value: string) => {
    const next = { ...frame, [key]: Number(value) };
    if (node) onNode(node.id, { frame: next }); else onPage((item) => ({ ...item, frame: next }));
  };
  const setStyle = (patch: Partial<NodeStyle>) => { if (node) onNode(node.id, { style: { ...node.style, ...patch } }); };
  const reorder = (direction: number) => {
    if (!node) return;
    onPage((item) => {
      const siblings = item.nodes.filter((entry) => entry.parentId === node.parentId);
      const target = siblings[siblings.findIndex((entry) => entry.id === node.id) + direction];
      if (!target) return item;
      const nodes = [...item.nodes];
      const a = nodes.findIndex((entry) => entry.id === node.id);
      const b = nodes.findIndex((entry) => entry.id === target.id);
      [nodes[a], nodes[b]] = [nodes[b], nodes[a]];
      return { ...item, nodes };
    });
  };
  return <aside className="inspector floating-panel" aria-label="悬浮属性面板" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }} onPointerDown={(event) => event.stopPropagation()}>
    <div className="floating-heading inspector-handle" onPointerDown={(event) => {
      if (event.button !== 0 || (event.target as Element).closest("button")) return;
      const panel = event.currentTarget.parentElement!;
      const bounds = panel.getBoundingClientRect();
      const viewport = panel.parentElement!.getBoundingClientRect();
      drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y, minX: viewport.left + 8 - bounds.left + offset.x, maxX: viewport.right - 8 - bounds.right + offset.x, minY: viewport.top + 8 - bounds.top + offset.y, maxY: viewport.bottom - 70 - bounds.top + offset.y };
      event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={(event) => {
      const start = drag.current;
      if (start) setOffset({ x: Math.max(start.minX, Math.min(start.maxX, start.ox + event.clientX - start.x)), y: Math.max(start.minY, Math.min(start.maxY, start.oy + event.clientY - start.y)) });
    }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <GripHorizontal size={14} /><strong>{node ? "控件属性" : "页面属性"}</strong>
      <Button variant="ghost" size="icon" aria-label={collapsed ? "展开属性面板" : "收起属性面板"} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</Button>
      <Button variant="ghost" size="icon" aria-label="关闭属性面板" onClick={onClose}><X size={14} /></Button>
    </div>
    {!collapsed ? <div className="inspector-content" key={node?.id ?? page.id}>
      <div className="selection-kind">{node ? NODE_LABELS[node.type] : page.kind === "modal" ? "弹窗" : "页面"}<span>{node ? "控件" : `${page.nodes.length} 个控件`}</span></div>
      <Field label={node ? "控件名称" : "页面名称"} value={node?.name ?? page.name} disabled={locked} validate={(name) => !!name.trim()} onCommit={(name) => {
        if (!name.trim()) return;
        if (node) onNode(node.id, { name: name.trim() }); else onPage((item) => ({ ...item, name: name.trim() }));
      }} />
      <div className="property-section-title">位置与尺寸</div>
      <div className="property-grid">{(["x", "y", "width", "height"] as const).map((key) => <Field key={key} label={key === "width" ? "W" : key === "height" ? "H" : key.toUpperCase()} type="number" value={Math.round(frame[key] * 10) / 10} min={key === "width" || key === "height" ? 8 : undefined} disabled={locked} onCommit={(value) => setFrame(key, value)} />)}</div>
      {node ? <>
        <label className="property-field"><span>父容器</span><select aria-label="父容器" disabled={locked} value={node.parentId ?? ""} onChange={(event) => onPage((item) => reparentNode(item, node.id, event.target.value || undefined))}>
          <option value="">页面根节点</option>{page.nodes.filter((item) => ["container", "rectangle"].includes(item.type) && !descendants(page, node.id).has(item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        {locked ? <div className="locked-message"><LockKeyhole size={13} />控件已锁定，请在图层树中解锁</div> : null}
        <Separator />
        {["text", "button", "input"].includes(node.type) ? <>
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
        <Separator /><div className="property-section-title">图层顺序</div><div className="action-row"><Button variant="outline" size="sm" disabled={locked} onClick={() => reorder(1)}><ArrowUp size={13} />上移</Button><Button variant="outline" size="sm" disabled={locked} onClick={() => reorder(-1)}><ArrowDown size={13} />下移</Button></div>
      </> : <>
        <label className="property-field"><span>页面类型</span><select aria-label="页面类型" value={page.kind} onChange={(event) => onPage((item) => ({ ...item, kind: event.target.value as "screen" | "modal" }))}><option value="screen">页面</option><option value="modal">弹窗</option></select></label>
        <ColorField label="页面背景" value={page.background ?? "#ffffff"} onCommit={(background) => onPage((item) => ({ ...item, background }))} />
        <Button size="sm" variant="outline" onClick={onEnter}>进入页面编辑</Button>
      </>}
      <Separator /><div className="action-row"><Button variant="outline" size="sm" onClick={onDuplicate} disabled={locked}><Copy size={13} />复制</Button><Button variant="ghost" size="sm" className="delete-button" onClick={onDelete} disabled={locked}><Trash2 size={13} />删除</Button></div>
    </div> : null}
  </aside>;
}
