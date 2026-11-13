import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, FileImage, FolderOpen, Grid3X3, ImageIcon, Layers3, Save, Scissors, Upload, X } from "lucide-react";
import { applySidecar, identityProblems, makeSidecar, newLayerIdentity, selectedMergeTree, sidecarName, type PsdAsset, type PsdLayer, type PsdLayerMeta, type SliceConfig } from "../../shared/psd-meta";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { isBrowserPreview } from "../vscode-api";
import { openPsd, psdTask, saveOutput } from "./io";
import { NineGridEditor, NineGridPreview } from "./nine-grid-editor";
import { PsdSliceCanvas } from "./slice-canvas";
import { cn } from "../lib/utils";
import "./workspace.css";

export type WorkspaceMode = "prototype" | "merge" | "slice";
type Loaded = { asset: PsdAsset; bytes: ArrayBuffer };
const getChildren = (asset: PsdAsset, key: number) => { const keys = new Set([key]); let previous = 0; while (previous !== keys.size) { previous = keys.size; asset.layers.forEach(l => { if (l.parentKey !== null && keys.has(l.parentKey)) keys.add(l.key); }); } return asset.layers.filter(l => keys.has(l.key)); };
const layerIdentity = (layer: PsdLayer) => layer.metadata.documentId + ":" + layer.metadata.layerId;

function Tree({ asset, selected, onSelect, checked, toggle, reveal = 0 }: { asset: PsdAsset; selected: number | null; onSelect: (key: number) => void; checked?: (layer: PsdLayer) => boolean; toggle?: (layer: PsdLayer, value: boolean) => void; reveal?: number }) {
  const [collapsed, setCollapsed] = useState(new Set<number>());
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ancestors = new Set<number>();
    let layer = asset.layers.find(l => l.key === selected);
    while (layer?.parentKey !== null && layer?.parentKey !== undefined && !ancestors.has(layer.parentKey)) {
      ancestors.add(layer.parentKey); layer = asset.layers.find(l => l.key === layer!.parentKey);
    }
    setCollapsed(old => [...old].some(key => ancestors.has(key)) ? new Set([...old].filter(key => !ancestors.has(key))) : old);
  }, [selected, asset.sourceHash, reveal]);
  useEffect(() => {
    const tree = container.current, row = tree?.querySelector<HTMLElement>(`[data-layer-key="${selected}"]`);
    if (!tree || !row) return;
    const bounds = tree.getBoundingClientRect(), item = row.getBoundingClientRect();
    if (item.top < bounds.top) tree.scrollTop -= bounds.top - item.top;
    else if (item.bottom > bounds.bottom) tree.scrollTop += item.bottom - bounds.bottom;
  }, [selected, collapsed, reveal]);
  const duplicates = identityProblems(asset);
  const render = (parent: number | null, depth: number): ReactNode => asset.layers.filter(l => l.parentKey === parent).map(l => {
    const children = l.group ? getChildren(asset, l.key).filter(c => !c.group && !!c.image && !c.limitation && !duplicates.includes(c.metadata.layerId)) : [l];
    const count = checked ? children.filter(checked).length : 0;
    const mixed = count > 0 && count < children.length;
    const warning = duplicates.includes(l.metadata.layerId);
    return <div role="none" key={l.key}><div data-layer-key={l.key} className={cn("psd-tree-row", selected === l.key && "is-selected")} role="treeitem" aria-selected={selected === l.key} aria-expanded={l.group ? !collapsed.has(l.key) : undefined} style={{ paddingLeft: 6 + depth * 15 }}>
      {l.group ? <button className="psd-tree-expander" aria-label={`${collapsed.has(l.key) ? "展开" : "折叠"}${l.name}`} onClick={() => setCollapsed(old => { const next = new Set(old); if (next.has(l.key)) next.delete(l.key); else next.add(l.key); return next; })}>{collapsed.has(l.key) ? <ChevronRight size={13} /> : <ChevronDown size={13} />}</button> : <span className="psd-tree-spacer" />}
      {toggle && checked ? <input type="checkbox" aria-label={`选择${l.name}（${l.nativeId ?? l.key}）`} checked={children.length > 0 && count === children.length} ref={el => { if (el) el.indeterminate = mixed; }} disabled={!children.length || warning || (!l.group && (!!l.limitation || !l.image))} onChange={e => toggle(l, e.target.checked)} /> : null}
      <button className="psd-tree-label" onClick={() => onSelect(l.key)} title={`${l.name} · ${l.metadata.layerId}${warning ? " · ID 重复" : ""}`}>{l.group ? <Layers3 size={13} /> : <ImageIcon size={13} />}<span>{l.name}</span>{warning ? <AlertTriangle size={12} className="psd-warning" /> : l.config.nineGrid ? <Grid3X3 size={12} /> : null}</button>
    </div>{l.group && !collapsed.has(l.key) ? <div role="group">{render(l.key, depth + 1)}</div> : null}</div>;
  });
  return <div ref={container} className="psd-layer-tree" role="tree" aria-label={`${asset.name} 图层树`}>{render(null, 0)}</div>;
}

function PsdPreview({ asset, selected, children }: { asset: PsdAsset; selected?: PsdLayer | null; children?: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.65);
  useEffect(() => { const el = container.current; if (!el) return; const observer = new ResizeObserver(() => setZoom(Math.min(1, Math.max(.05, (el.clientWidth - 64) / asset.width), Math.max(.05, (el.clientHeight - 70) / asset.height)))); observer.observe(el); return () => observer.disconnect(); }, [asset.width, asset.height]);
  return <div className="psd-document-preview" ref={container}>
    <div className="psd-page-preview" style={{ width: asset.width * zoom, height: asset.height * zoom }}>
      <div className="psd-page-caption"><span>{asset.name}</span><small>{asset.width} × {asset.height}</small></div>
      <div className="psd-preview-world checkerboard" style={{ width: asset.width, height: asset.height, transform: `scale(${zoom})` }}>{children ?? <img className="psd-composite" src={asset.preview} alt={`${asset.name} 整图预览`} />}{selected && !selected.group ? <div className="psd-selected-outline" style={{ left: selected.left, top: selected.top, width: selected.width, height: selected.height, borderWidth: 1 / zoom }} /> : null}</div>
    </div>
  </div>;
}

function ConfirmImport({ onAccept, onCancel, replacing = false }: { onAccept: () => void; onCancel: () => void; replacing?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null); useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="psd-dialog confirm-dialog" onCancel={e => { e.preventDefault(); onCancel(); }}><header><strong>{replacing ? "当前配置尚未保存" : "配置与 PSD 版本不同"}</strong></header><p>{replacing ? "打开另一份 PSD 会替换当前配置。可以取消并先保存 .meta.json，或继续打开新文件。" : "这份配置记录的源文件已发生变化。继续将按有效图层 ID 采用配置，并校验九宫格范围；无法对应的图层会报错。"}</p><footer><Button onClick={onAccept}>{replacing ? "继续打开" : "采用配置"}</Button><Button variant="secondary" onClick={onCancel}>取消</Button></footer></dialog>;
}

export function PsdWorkspace({ mode, active }: { mode: "slice" | "merge"; active: boolean }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null), [selectedKey, setSelectedKey] = useState<number | null>(null);
  const [canvasSelection, setCanvasSelection] = useState(0);
  const [editingGrid, setEditingGrid] = useState<number | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false), [pendingImport, setPendingImport] = useState<unknown>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [past, setPast] = useState<PsdAsset[]>([]), [future, setFuture] = useState<PsdAsset[]>([]);
  const input = useRef<HTMLInputElement>(null), configInput = useRef<HTMLInputElement>(null);
  const asset = loaded?.asset, selected = asset?.layers.find(l => l.key === selectedKey) ?? null;
  const change = (next: PsdAsset) => { if (!loaded || busy) return; setPast(p => [...p.slice(-39), loaded.asset]); setFuture([]); setLoaded({ ...loaded, asset: next }); setDirty(true); };
  const patchConfig = (key: number, patch: Partial<SliceConfig>) => { if (asset) change({ ...asset, layers: asset.layers.map(l => l.key === key ? { ...l, config: { ...l.config, ...patch } } : l) }); };
  const undo = (redo = false) => { if (!loaded || busy) return; const source = redo ? future : past, item = source.at(-1); if (!item) return; if (redo) { setFuture(source.slice(0, -1)); setPast([...past, loaded.asset]); } else { setPast(source.slice(0, -1)); setFuture([...future, loaded.asset]); } setLoaded({ ...loaded, asset: item }); setDirty(true); };
  const readFile = async (file?: File, discard = false) => {
    if (!file || busy) return; if (dirty && !discard) { setPendingFile(file); return; } setBusy(true); setMessage("正在读取 PSD…");
    try { const result = await openPsd(file); setLoaded(result); setSelectedKey(result.asset.layers.find(l => l.config.nineGrid)?.key ?? result.asset.layers.find(l => !l.group)?.key ?? null); setPast([]); setFuture([]); setDirty(false); setMessage(identityProblems(result.asset).length ? "存在重复 ID：选中副本后，点击“作为新节点”。" : ""); }
    catch (e) { setMessage(String(e instanceof Error ? e.message : e)); } finally { setBusy(false); }
  };
  const adopt = (raw: unknown) => { if (!asset) return; try { change(applySidecar(asset, raw)); setMessage("已读取配置。保存后可保留本次设置。"); } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); } setPendingImport(null); };
  const readConfig = async (file?: File) => { if (!file || !asset) return; try { if (file.size > 1024 * 1024) throw new Error("配置文件不能超过 1 MB。"); const raw = JSON.parse(await file.text()); if (raw?.schema !== "gameflow.psd-meta") throw new Error("不是 GameFlow PSD 配置。"); if (raw.source?.sha256 !== asset.sourceHash) setPendingImport(raw); else adopt(raw); } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); } };
  const save = async (embedded: boolean) => {
    if (!loaded || busy) return; setBusy(true); setMessage(embedded ? "正在写入 PSD 副本…" : "正在保存配置…");
    try {
      const meta = makeSidecar(loaded.asset);
      const bytes = embedded ? new Uint8Array(await psdTask<ArrayBuffer>("patch", loaded.bytes, asset!.name, loaded.asset.layers.map(l => [l.key, meta.layers.find(m => m.id === l.metadata.layerId)!.metadata] as [number, PsdLayerMeta]))) : new TextEncoder().encode(JSON.stringify(meta, null, 2) + "\n");
      const name = embedded ? asset!.name.replace(/\.psd$/i, "") + "-configured.psd" : sidecarName(asset!.name);
      const saved = await saveOutput(name, embedded ? "psd" : "meta", bytes);
      if (saved) { setDirty(false); setMessage(isBrowserPreview ? `已发起下载：${name}` : `已保存：${name}`); } else setMessage("已取消保存。");
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  useEffect(() => {
    if (!active || mode !== "slice") return;
    const keydown = (e: KeyboardEvent) => { if (editingGrid !== null || pendingImport || pendingFile || busy) return; if (!(e.ctrlKey || e.metaKey)) return; if (e.key.toLowerCase() === "s") { e.preventDefault(); (document.activeElement as HTMLElement)?.blur(); void save(false); } else if (!(e.target as Element).closest("input,textarea") && ["z", "y"].includes(e.key.toLowerCase())) { e.preventDefault(); undo(e.shiftKey || e.key.toLowerCase() === "y"); } };
    window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown);
  });
  useEffect(() => { if (!dirty) return; const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; }; window.addEventListener("beforeunload", unload); return () => window.removeEventListener("beforeunload", unload); }, [dirty]);
  const duplicates = asset ? identityProblems(asset) : [];
  return <section className="psd-workspace" hidden={!active} aria-label={mode === "slice" ? "PSD 切图工作区" : "PSD 合并工作区"}>
    {mode === "merge" ? <MergeWorkspace /> : <>
      <div className="psd-commandbar"><Button size="sm" variant="secondary" disabled={busy} onClick={() => input.current?.click()}><FolderOpen size={14} />打开 PSD</Button><span className="psd-filename">{asset?.name ?? "PSD 切图"}{dirty ? " · 未保存配置" : ""}</span><Button size="sm" variant="ghost" disabled={!asset || busy} onClick={() => configInput.current?.click()}><Upload size={14} />读取配置</Button><Button size="sm" variant="ghost" disabled={!asset || busy} onClick={() => void save(false)}><Save size={14} />保存 .meta.json</Button><Button size="sm" variant="secondary" disabled={!asset || busy} onClick={() => void save(true)}>写入 PSD 副本</Button></div>
      {asset ? <PsdSliceCanvas key={`${asset.sourceHash}:${asset.name}`} asset={asset} selected={selected} active={active} onSelect={key => { setSelectedKey(key); setCanvasSelection(n => n + 1); }}
        tree={<><div className="floating-heading"><Layers3 size={14} /><strong>图层</strong><span>{asset.layers.length}</span></div><div className="psd-hint">勾选需要切图的图层</div><Tree asset={asset} selected={selectedKey} reveal={canvasSelection} onSelect={setSelectedKey} checked={l => l.config.enabled} toggle={(layer, enabled) => { const keys = new Set(getChildren(asset, layer.key).filter(l => !l.group && l.image && !l.limitation && !duplicates.includes(l.metadata.layerId)).map(l => l.key)); change({ ...asset, layers: asset.layers.map(l => keys.has(l.key) ? { ...l, config: { ...l.config, enabled } } : l) }); }} /></>}
        properties={<><div className="floating-heading"><Scissors size={14} /><strong>切图属性</strong></div>{selected ? <div className="psd-properties-content"><div className="psd-section-heading"><strong>{selected.name}</strong><small>{selected.group ? "分组" : `${selected.width} × ${selected.height}`}</small></div><label className="psd-property"><span>图层 ID</span><code>{selected.metadata.layerId}</code></label><label className="psd-property"><span>原生 ID</span><code>{selected.nativeId ?? "无"}</code></label>
          {duplicates.includes(selected.metadata.layerId) ? <div className="psd-warning-box"><AlertTriangle size={14} /><span>此 ID 有多个图层使用。选中副本后分配新身份。</span><Button size="sm" variant="secondary" onClick={() => change(newLayerIdentity(asset, selected.key))}>作为新节点</Button></div> : null}
          {selected.image ? <div className="psd-layer-image checkerboard"><img src={selected.image} alt={`${selected.name} 单层预览`} /></div> : <p className="psd-hint">选择包含图片的子图层设置九宫格。</p>}
          {selected.limitation ? <p className="psd-warning">{selected.limitation}</p> : null}
          <label className="psd-check"><input type="checkbox" checked={selected.config.enabled} disabled={selected.group || !selected.image || !!selected.limitation} onChange={e => patchConfig(selected.key, { enabled: e.target.checked })} />标记为切图</label>
          <label className="psd-property"><span>切图名称</span><Input aria-label="切图名称" value={selected.config.name} maxLength={120} onChange={e => patchConfig(selected.key, { name: e.target.value })} /></label>
          <div className="psd-section-heading"><strong>九宫格</strong><Button size="sm" variant="ghost" disabled={!selected.config.nineGrid} onClick={() => patchConfig(selected.key, { nineGrid: null })}>清除</Button></div>
          {selected.config.nineGrid ? <div className="psd-grid-summary">上 {selected.config.nineGrid.top} · 右 {selected.config.nineGrid.right} · 下 {selected.config.nineGrid.bottom} · 左 {selected.config.nineGrid.left}<small>{selected.config.nineGrid.repeat ? "重复填充" : "拉伸填充"}</small></div> : <p className="psd-hint">尚未设置</p>}
          <Button variant="secondary" disabled={!selected.image || selected.group || !!selected.limitation} onClick={() => setEditingGrid(selected.key)}><Grid3X3 size={14} />编辑九宫格</Button>
          {selected.image && selected.config.nineGrid ? <NineGridPreview image={selected.image} width={selected.width} height={selected.height} grid={selected.config.nineGrid} /> : null}
          <p className="psd-hint">图片导出格式待与 Laya 对齐；当前保存切图配置。</p>
        </div> : <p className="psd-hint">点击画布元素或左侧图层查看属性。</p>}</>}
      /> : <div className="psd-empty"><FileImage size={40} /><h2>从 PSD 开始切图</h2><p>选择图层，标记切图并设置九宫格。</p><Button disabled={busy} onClick={() => input.current?.click()}><FolderOpen size={16} />打开 PSD</Button><small>支持 8 位 RGB · 最大 32 MB</small></div>}
      {message ? <div className="psd-status" role="status">{busy ? null : <Check size={13} />}{message}<button aria-label="关闭提示" onClick={() => setMessage("")}><X size={13} /></button></div> : null}
      <input ref={input} type="file" accept=".psd" className="hidden" aria-label="打开切图 PSD" onChange={e => { void readFile(e.target.files?.[0]); e.target.value = ""; }} /><input ref={configInput} type="file" accept=".json" className="hidden" aria-label="读取 PSD 配置" onChange={e => { void readConfig(e.target.files?.[0]); e.target.value = ""; }} />
      {editingGrid !== null && asset?.layers.find(l => l.key === editingGrid) ? <NineGridEditor layer={asset.layers.find(l => l.key === editingGrid)!} onSave={nineGrid => { patchConfig(editingGrid, { nineGrid, enabled: true }); setEditingGrid(null); }} onCancel={() => setEditingGrid(null)} /> : null}
      {pendingImport ? <ConfirmImport onAccept={() => adopt(pendingImport)} onCancel={() => setPendingImport(null)} /> : null}
      {pendingFile ? <ConfirmImport replacing onAccept={() => { const file = pendingFile; setPendingFile(null); void readFile(file, true); }} onCancel={() => setPendingFile(null)} /> : null}
    </>}
  </section>;
}

function MergeWorkspace() {
  const [sources, setSources] = useState<{ A: PsdAsset | null; B: PsdAsset | null }>({ A: null, B: null });
  const [choices, setChoices] = useState<Record<string, "A" | "B">>({});
  const [selected, setSelected] = useState<string | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null), target = useRef<"A" | "B">("A");
  const pick = (source: "A" | "B") => { target.current = source; input.current?.click(); };
  const load = async (file?: File) => { if (!file) return; const side = target.current; setBusy(true); setMessage(""); try { const { asset } = await openPsd(file); setSources(old => ({ ...old, [side]: asset })); setChoices({}); if (identityProblems(asset).length) setMessage("来源含重复 ID，请先在 PSD 切图中为副本分配新身份并保存。"); } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } };
  const sizeMismatch = sources.A && sources.B && (sources.A.width !== sources.B.width || sources.A.height !== sources.B.height);
  const result = selectedMergeTree(sources, choices);
  const chosen = result?.layers.filter(l => !l.group) ?? [];
  const toggle = (side: "A" | "B", asset: PsdAsset, layer: PsdLayer, value: boolean) => { if (sizeMismatch) { setMessage("两份 PSD 尺寸不同，请先在美术工具中对齐画布。"); return; } const duplicates = identityProblems(asset); const leaves = getChildren(asset, layer.key).filter(l => !l.group && l.image && !l.limitation && !duplicates.includes(l.metadata.layerId)); setChoices(old => { const next = { ...old }; for (const l of leaves) { const id = layerIdentity(l); if (value) next[id] = side; else if (next[id] === side) delete next[id]; } return next; }); };
  return <><div className="psd-commandbar"><strong>PSD 合并</strong><span className="psd-filename">无基础版本 · 手动选择</span><span className="psd-hint">当前提供选层预览，完整 PSD 合并写出尚未接入</span></div>
    <div className="psd-merge-layout"><div className="psd-merge-sources">{(["A", "B"] as const).map(side => { const asset = sources[side]; return <section className="psd-merge-pane" key={side}><header><strong>来源 {side}</strong><span>{asset?.name ?? "未选择 PSD"}</span><Button size="sm" variant="ghost" disabled={busy} onClick={() => pick(side)}><FolderOpen size={13} />选择 PSD</Button></header>{asset ? <div className="psd-merge-pane-content"><Tree asset={asset} selected={asset.layers.find(l => layerIdentity(l) === selected)?.key ?? null} onSelect={key => setSelected(layerIdentity(asset.layers.find(l => l.key === key)!))} checked={l => choices[layerIdentity(l)] === side} toggle={(l, v) => toggle(side, asset, l, v)} /><PsdPreview asset={asset} selected={asset.layers.find(l => layerIdentity(l) === selected)} /></div> : <div className="psd-merge-empty"><Button variant="ghost" disabled={busy} onClick={() => pick(side)}>打开来源 {side}</Button></div>}</section>; })}</div>
      <section className="psd-merge-pane psd-merge-result"><header><strong>选择结果</strong><span>{chosen.length} 个图层</span><Button size="sm" variant="ghost" onClick={() => setChoices({})} disabled={!chosen.length}>清空选择</Button></header>{result ? <div className="psd-merge-pane-content"><Tree asset={result} selected={result.layers.find(l => layerIdentity(l) === selected)?.key ?? null} onSelect={key => setSelected(layerIdentity(result.layers.find(l => l.key === key)!))} /><PsdPreview asset={result} selected={chosen.find(l => layerIdentity(l) === selected)}>{[...chosen].reverse().filter(l => !l.hidden).map((l, i) => <img key={i} src={l.image} alt={l.name} style={{ position: "absolute", left: l.left, top: l.top, width: l.width, height: l.height }} />)}</PsdPreview></div> : <div className="psd-merge-empty"><Layers3 size={28} /><p>在左侧打开 PSD，勾选采用的图层。</p></div>}</section>
    </div>{message || sizeMismatch ? <div className="psd-status" role="status">{message || "画布尺寸不同，需先对齐后选择。"}</div> : null}<input ref={input} type="file" accept=".psd" className="hidden" aria-label="打开合并来源 PSD" onChange={e => { void load(e.target.files?.[0]); e.target.value = ""; }} /></>;
}
