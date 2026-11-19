import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Box, Layers3, LayoutDashboard, RotateCcw, X } from "lucide-react";
import type { GameFlowNode, GameFlowPage } from "../../shared/model";
import { sliceRegion, type PsdAsset } from "../../shared/psd-meta";
import { resolvePageLayout } from "../../shared/ui-layout";
import { mapPoint } from "../../shared/ui-transform";
import { previewControl } from "../../shared/preview-session";
import { NodeView, orderedNodes } from "../editor/node-view";
import { Button } from "../components/ui/button";
import { ResourceCanvas, useSliceResources } from "./resource-context";
import "./preview.css";

import { imageSlotRequest, nodeImageSlot, type ResourceMode } from "../../shared/image-slots";
import { nodeSlots } from "../../shared/prefab-export";

export function RuntimePreview({ resourceMode, onResourceMode, pages, initialPageId, assets, onClose }: { resourceMode?:ResourceMode; onResourceMode?(mode:ResourceMode):void; pages: GameFlowPage[]; initialPageId?: string; assets: PsdAsset[]; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null), stage = useRef<HTMLDivElement>(null), world = useRef<HTMLDivElement>(null);
  const [pageId, setPageId] = useState(initialPageId ?? pages[0]?.id ?? ""), [nodeId, setNodeId] = useState("");
  const baseline = pages.find(p => p.id === pageId) ?? pages[0];
  const [session, setSession] = useState<{ baseline: GameFlowPage | undefined; page: GameFlowPage | undefined }>({ baseline, page: baseline });
  const page = session.baseline === baseline ? session.page : baseline;
  const [zoom, setZoom] = useState(1), [compare, setCompare] = useState(false);
  const resources = useSliceResources(), sizes = resources.sizes;
  const geometry = page ? resolvePageLayout(page, sizes) : null;
  const selected = page?.nodes.find(n => n.id === nodeId), selectedGeometry = selected && geometry?.nodes.get(selected.id);
  const selectedSlot = selected ? nodeImageSlot(selected, resources.mode) : undefined;
  const selectedRequest = imageSlotRequest(selectedSlot, resources.mode ?? "art");
  const selectedResource = selectedRequest.kind === "resource" ? resources.resolve(selectedRequest.ref) : selected?.image === undefined && selected?.sliceResource && resources.mode !== "prototype" ? resources.resolve(selected.sliceResource) : undefined;
  const update = (transform: (p: GameFlowPage) => GameFlowPage) => { if (page) setSession({ baseline, page: transform(page) }); };
  const reset = () => { setSession({ baseline, page: baseline }); setCompare(false); };
  const fit = () => { const bounds = stage.current?.getBoundingClientRect(); if (bounds && page) setZoom(Math.max(.05, Math.min(1, (bounds.width - 64) / page.frame.width, (bounds.height - 64) / page.frame.height))); };
  useEffect(() => { dialog.current?.showModal(); resources.refresh(); }, []);
  useEffect(() => { const el = stage.current; if (!el) return; const observer = new ResizeObserver(fit); observer.observe(el); fit(); return () => observer.disconnect(); }, [page?.id, page?.frame.width, page?.frame.height]);
  const diagnostics = page?.nodes.flatMap(node => nodeSlots(node).flatMap(([field,slot])=>{
    const request=imageSlotRequest(slot,resources.mode??"art");
    if(request.kind==="empty"||request.kind==="builtin")return [];
    const resource=request.kind==="error"?{status:"error" as const,error:request.error}:resources.resolve(request.ref);
    return resource.status==="ready"?[]:[{id:node.id+":"+field,nodeId:node.id,name:node.name+" · "+field,path:request.kind==="resource"?request.ref.path:slot?.builtin??"",message:resource.status==="loading"?"正在生成或装载…":resource.error}];
  })) ?? [];
  const resizeSelected = (width: number, height: number) => {
    if (!selected) return;
    update(p => ({ ...p, nodes: p.nodes.map(n => n.id === selected.id ? { ...n, frame: { ...n.frame, x: selectedGeometry?.local.x ?? n.frame.x, y: selectedGeometry?.local.y ?? n.frame.y, width, height }, layout: { ...n.layout, positionOffsetX: undefined, positionOffsetY: undefined, widthMode: "explicit", heightMode: "explicit", left: undefined, right: undefined, centerX: undefined, top: undefined, bottom: undefined, centerY: undefined } } : n) }));
  };
  const controlAt = (id: string | undefined) => {
    let node = page?.nodes.find(n => n.id === id);
    const seen = new Set<string>();
    while (node && !seen.has(node.id)) {
      seen.add(node.id);
      if (node.widget?.disabled) return undefined;
      if (["slider", "checkbox", "radio"].includes(node.type)) {
        let parent = page?.nodes.find(n => n.id === node!.parentId);
        while (parent && !seen.has(parent.id)) { seen.add(parent.id); if (parent.widget?.disabled) return undefined; parent = page?.nodes.find(n => n.id === parent!.parentId); }
        return node;
      }
      node = page?.nodes.find(n => n.id === node!.parentId);
    }
    return undefined;
  };
  const drag = useRef<string | null>(null);
  const sliderValue = (node: GameFlowNode, event: PointerEvent) => {
    const bounds = world.current?.getBoundingClientRect(), inverse = geometry?.nodes.get(node.id)?.inverse;
    if (!bounds || !inverse) return;
    const point = mapPoint(inverse, { x: (event.clientX - bounds.left) / zoom, y: (event.clientY - bounds.top) / zoom });
    const local = geometry!.nodes.get(node.id)!.local, min = node.widget?.min ?? 0, max = node.widget?.max ?? 1;
    const ratio = node.widget?.direction === "vertical" ? point.y / Math.max(1, local.height) : point.x / Math.max(1, local.width);
    update(p => previewControl(p, node.id, min + Math.max(0, Math.min(1, ratio)) * (max - min)));
  };
  const source = selectedResource?.description?.source.documentId;
  const psd = assets.find(asset => asset.documentId === source) ?? assets.find(asset => page?.nodes.some(n => nodeSlots(n).some(([,slot])=>slot?.art?.source?.documentId === asset.documentId)));
  const sourceLayer = selectedResource?.description && psd?.layers.find(l => l.metadata.layerId === selectedResource.description!.layerId);
  const sourceRegion = sourceLayer && sliceRegion(sourceLayer);
  const product = selectedResource?.status === "ready" ? selectedResource : undefined;
  const design = baseline && selected ? resolvePageLayout(baseline, sizes).nodes.get(selected.id)?.local : undefined;
  return <dialog ref={dialog} className="runtime-preview" aria-label="运行预览" onCancel={e => { e.preventDefault(); onClose(); }} onKeyDown={e => e.stopPropagation()}>
    <header className="runtime-heading"><strong>运行预览</strong>{onResourceMode ? <div className="resource-mode-tools" role="group" aria-label="预览资源显示模式">{([{id:"prototype",label:"原型",icon:LayoutDashboard},{id:"art",label:"美术 PSD",icon:Layers3},{id:"prefab",label:"预制体",icon:Box}] as const).map(({id,label,icon:Icon})=><Button key={id} size="icon" variant="ghost" aria-label={label+"资源"} aria-pressed={resourceMode===id} title={label} onClick={()=>{onResourceMode(id);resources.refresh();}}><Icon size={16}/></Button>)}</div> : null}<select aria-label="预览页面" value={page?.id ?? ""} onChange={e => { setPageId(e.target.value); setNodeId(""); setCompare(false); }}>{pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><span className="runtime-session-note">临时状态</span>
      <Button size="icon" variant="ghost" aria-label="重置预览状态" title="重置预览状态" onClick={reset}><RotateCcw size={15} /></Button><Button size="icon" variant="ghost" aria-label="关闭运行预览" onClick={onClose}><X size={17} /></Button></header>
    <div className="runtime-content"><div className="runtime-main"><div className="runtime-view-tools"><label>缩放 <input aria-label="预览缩放" type="number" min={5} max={300} value={Math.round(zoom * 100)} onChange={e => setZoom(Math.max(.05, Math.min(3, Number(e.target.value) / 100)))} />%</label><Button size="sm" variant="ghost" onClick={fit}>适应窗口</Button><label><input type="checkbox" checked={compare} disabled={!psd} onChange={e => setCompare(e.target.checked)} />PSD 原图对照</label></div>
      <div className="runtime-stage checkerboard" ref={stage}>
        {page && geometry ? <div className="runtime-page-space" style={{ width: page.frame.width * zoom, height: page.frame.height * zoom }}><div ref={world} className="runtime-page" style={{ width: page.frame.width, height: page.frame.height, background: page.background ?? "#ffffff", transform: `scale(${zoom})` }}
          onPointerDown={e => { if (e.button !== 0) return; const id = (e.target as Element).closest<HTMLElement>("[data-node-id]")?.dataset.nodeId; setNodeId(id ?? ""); const control = controlAt(id); if (control?.type === "slider") { drag.current = control.id; e.currentTarget.setPointerCapture(e.pointerId); sliderValue(control, e); } }}
          onPointerMove={e => { const control = page.nodes.find(n => n.id === drag.current); if (control) sliderValue(control, e); }}
          onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
          onClick={e => { const control = controlAt((e.target as Element).closest<HTMLElement>("[data-node-id]")?.dataset.nodeId); if (control && control.type !== "slider") update(p => previewControl(p, control.id)); }}>
          {orderedNodes(page).map(node => <NodeView key={node.id} page={page} node={node} geometry={geometry.nodes.get(node.id)} />)}
          {compare && psd ? <img className="runtime-psd-overlay" src={psd.preview} alt="PSD 原图对照" style={{ width: psd.width, height: psd.height }} /> : null}
          {selectedGeometry ? <div className="runtime-node-outline" style={{ width: selectedGeometry.local.width, height: selectedGeometry.local.height, transform: `matrix(${selectedGeometry.matrix.join(",")})`, borderWidth: 1 / zoom }} /> : null}
        </div></div> : <p>当前没有可预览页面。</p>}
      </div></div>
      <aside className="runtime-inspector"><label className="runtime-field">检查控件<select aria-label="预览检查控件" value={selected?.id ?? ""} onChange={e => setNodeId(e.target.value)}><option value="">选择控件</option>{page?.nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}</select></label>
        {selected && selectedGeometry ? <><strong>{selected.name}</strong><div className="runtime-size-inputs"><label>宽<input aria-label="临时控件宽度" type="number" min={1} max={4096} value={Math.round(selectedGeometry.local.width)} onChange={e => resizeSelected(Math.max(1, Math.min(4096, Number(e.target.value))), selectedGeometry.local.height)} /></label><label>高<input aria-label="临时控件高度" type="number" min={1} max={4096} value={Math.round(selectedGeometry.local.height)} onChange={e => resizeSelected(selectedGeometry.local.width, Math.max(1, Math.min(4096, Number(e.target.value))))} /></label></div>
          {design ? <div className="runtime-size-presets">{[{ label: "设计尺寸", w: design.width, h: design.height }, { label: "加宽", w: design.width * 1.5, h: design.height }, { label: "加高", w: design.width, h: design.height * 1.5 }, { label: "双轴", w: design.width * 1.5, h: design.height * 1.5 }, { label: "小尺寸", w: Math.max(1, (product?.description.nineGrid?.left ?? 8) + (product?.description.nineGrid?.right ?? 8) - 1), h: Math.max(1, (product?.description.nineGrid?.top ?? 8) + (product?.description.nineGrid?.bottom ?? 8) - 1) }].map(p => <Button key={p.label} size="sm" variant="outline" onClick={() => resizeSelected(p.w, p.h)}>{p.label}</Button>)}</div> : null}
          {selected.type === "slider" || selected.type === "progress" ? <label className="runtime-field">当前值<input aria-label={selected.type === "progress" ? "临时进度值" : "临时滑块值"} type="range" min={selected.widget?.min ?? 0} max={selected.widget?.max ?? 1} step="any" disabled={selected.widget?.disabled} value={selected.widget?.value ?? selected.widget?.min ?? 0} onChange={e => update(p => previewControl(p, selected.id, Number(e.target.value)))} /></label> : null}
          {product ? <section className="runtime-product"><strong>实际切图产物</strong><div className="runtime-product-pixels checkerboard" style={{ aspectRatio: `${product.description.width}/${product.description.height}` }}><ResourceCanvas resource={product} width={product.description.width} height={product.description.height} raw label="实际切图产物" /></div><code>{product.description.path}</code><p>纹理：{product.description.width} × {product.description.height} px</p>{product.description.logicalSize ? <p>布局原尺寸：{product.description.logicalSize.width} × {product.description.logicalSize.height} px</p> : null}<p>{product.description.source.psdName} / {product.description.layerName}</p>{product.description.nineGrid ? <p>九宫格：上 {product.description.nineGrid.top} / 右 {product.description.nineGrid.right} / 下 {product.description.nineGrid.bottom} / 左 {product.description.nineGrid.left} · {product.description.nineGrid.repeat ? "重复" : "拉伸"}</p> : null}
            {compare && sourceLayer?.image && sourceRegion ? <><strong>PSD 源对象对照</strong><div className="runtime-product-source checkerboard" style={{ aspectRatio: `${sourceRegion.width}/${sourceRegion.height}` }}><img src={sourceLayer.image} alt="PSD 源对象对照" style={{ position: "absolute", width: `${sourceLayer.width / sourceRegion.width * 100}%`, height: `${sourceLayer.height / sourceRegion.height * 100}%`, left: `${-sourceRegion.x / sourceRegion.width * 100}%`, top: `${-sourceRegion.y / sourceRegion.height * 100}%`, maxWidth: "none" }} /></div></> : null}
          </section> : selectedRequest.kind === "builtin" ? <section className="runtime-product"><strong>内置图片</strong><div className="runtime-product-pixels checkerboard" style={{ aspectRatio: `${selectedRequest.image.width}/${selectedRequest.image.height}` }}><img src={selectedRequest.image.dataUri} alt={selectedRequest.image.name} /></div><p>{selectedRequest.image.name} · {selectedRequest.image.width} × {selectedRequest.image.height} px</p></section> : selectedRequest.kind === "resource" || selected.sliceResource ? <p className="slice-resource-error" role="status">{selectedResource?.status === "error" ? selectedResource.error : "正在装载切图…"}</p> : <p>此控件未绑定切图；图片部件可在属性面板选择资源。</p>}</> : <p>点击页面或选择控件检查切图与临时尺寸。</p>}
        <section className="runtime-diagnostics"><div><strong>装载诊断（{diagnostics.length}）</strong><Button size="sm" variant="ghost" onClick={resources.refresh}>刷新</Button></div>{diagnostics.length ? diagnostics.map(d => <button key={d.id} onClick={() => setNodeId(d.nodeId)}><strong>{d.name}</strong><code>{d.path}</code><span>{d.message}</span></button>) : <p>已绑定资源装载正常。</p>}{geometry?.issues.map((issue, i) => <button key={`layout-${i}`} onClick={() => setNodeId(issue.nodeId)}>{issue.message}</button>)}</section>
      </aside>
    </div>
  </dialog>;
}
