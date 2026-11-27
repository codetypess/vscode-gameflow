import { DialogHeading } from "../components/dialog-heading";
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AlertTriangle, Box, Check, ChevronDown, ChevronRight, Crop, Download, Ellipsis, Eye, EyeOff, FileImage, FolderOpen, Grid3X3, ImageIcon, Images, Layers3, MousePointerClick, Redo2, Save, Scissors, Share2, SquareDashed, Type, Undo2, X } from "lucide-react";
import { compositeOwners, enabledSliceLayers, identityProblems, isCompositeGroup, makeSidecar, newLayerIdentity, selectedMergeTree, sidecarName, sliceRegion, validConfig, type PsdAsset, type PsdEmbeddedLayer, type PsdLayer, type PsdLayerMeta, type SliceConfig, type SliceRegion, type NineGrid } from "../../shared/psd-meta";
import { WorkbenchSettingsButton, type WorkbenchSettingsUI } from "../workbench-settings";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Separator } from "../components/ui/separator";
import { ScrollArea } from "../components/ui/scroll-area";
import { AtlasNameInput } from "./atlas-name-input";
import { isBrowserPreview, postHostMessage } from "../vscode-api";
import { openPsd, psdTask, saveOutput } from "./io";
import { NineGridEditor, NineGridPreview } from "./nine-grid-editor";
import { useRenderedSlice } from "./use-rendered-slice";
import { needsPhotoCraft, translateRegion } from "../../shared/psd-slice-source";
import { RegionEditor } from "./region-editor";
import { SliceImage } from "./slice-image";
import { renderSliceExportBatch } from "./slice-render";
import { builtinSlice, builtinSliceDescription } from "../../shared/psd-builtin";
import { PsdSliceCanvas } from "./slice-canvas";
import { usePsdFileDrop } from "./file-drop";
import { hasFileDrag } from "./file-drop-input";
import { cn } from "../lib/utils";
import { defaultLayerVariableName, effectiveExportName, effectiveVariableName, exportNameError, isLayerVariableNameFixed, layerVariableOverride, psdSliceDirectory, sliceExportIssues, SliceExportConflict, type ExportIssue } from "../../shared/psd-export";
import { resourceExport } from "./export";
import { discardBrowserDraft, markBrowserConfigSaved, restoreBrowserDraft, saveBrowserDraft } from "./browser-draft";
import { useToolbarChoice } from "../lib/use-toolbar-choice";
import { consumeHistoryShortcut } from "../lib/history-shortcut";
import "./workspace.css";

export type WorkspaceMode = "prototype" | "merge" | "slice";
type Loaded = { asset: PsdAsset; bytes: ArrayBuffer };
export type OpenBoundSlice = (source: Loaded) => void;
export interface PsdWorkspaceBinding {
  loaded: Loaded; dirty: boolean; pending: boolean; busy: boolean; status: string;
  configPath: string; notice?: string; error?: string;
  change(asset: PsdAsset): void; save(copy: boolean): Promise<void>; history(redo: boolean): Promise<void>; retry(): void;
}
const getChildren = (asset: PsdAsset, key: number) => { const keys = new Set([key]); let previous = 0; while (previous !== keys.size) { previous = keys.size; asset.layers.forEach(l => { if (l.parentKey !== null && keys.has(l.parentKey)) keys.add(l.key); }); } return asset.layers.filter(l => keys.has(l.key)); };
const layerIdentity = (layer: PsdLayer) => layer.metadata.documentId + ":" + layer.metadata.layerId;

const embeddedIcons = { group: Layers3, image: ImageIcon, text: Type, smartObject: Box };

// The PSD reader supplies siblings front to back. The prototype lists them in paint order.
function treeOrder<T>(layers: T[], bottomFirst: boolean) {
  return bottomFirst ? [...layers].reverse() : layers;
}

function EmbeddedLayerRow({ layer, depth, bottomFirst }: { layer: PsdEmbeddedLayer; depth: number; bottomFirst: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const expandable = layer.children.length > 0;
  const Icon = embeddedIcons[layer.kind];
  return <div role="none">
    <div className="psd-tree-row psd-tree-embedded" role="treeitem" aria-expanded={expandable ? !collapsed : undefined} style={{ paddingLeft: 6 + depth * 10 }}>
      {expandable ? <button className="psd-tree-expander" aria-label={(collapsed ? "展开" : "折叠") + layer.name}
        onClick={() => setCollapsed(value => !value)}>{collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}</button> : <span className="psd-tree-spacer" />}
      <div className="psd-tree-label" title={layer.name}><Icon size={13} aria-hidden="true" /><span>{layer.name}</span></div>
    </div>
    {expandable && !collapsed && <div role="group">{treeOrder(layer.children, bottomFirst).map(child => <EmbeddedLayerRow key={child.key} layer={child} depth={depth + 1} bottomFirst={bottomFirst} />)}</div>}
  </div>;
}

function Tree({ asset, selected, onSelect, checked, toggle, toggleVisibility, owners, individual = false, bottomFirst = false, reveal = 0, issues = [] }: { owners?: ReadonlyMap<number, PsdLayer>; toggleVisibility?: (key: number) => void; individual?: boolean; bottomFirst?: boolean; asset: PsdAsset; selected: number | null; onSelect: (key: number) => void; checked?: (layer: PsdLayer) => boolean; toggle?: (layer: PsdLayer, value: boolean) => void; reveal?: number; issues?: ExportIssue[] }) {
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
  const orderedLayers = treeOrder(asset.layers, bottomFirst);
  const render = (parent: number | null, depth: number, parentHidden = false): ReactNode => orderedLayers.filter(l => l.parentKey === parent).map(l => {
    const children = !individual && l.group ? getChildren(asset, l.key).filter(c => !c.group && !!c.image && !c.limitation && !duplicates.includes(c.metadata.layerId)) : [l];
    const count = checked ? children.filter(checked).length : 0;
    const mixed = count > 0 && count < children.length;
    const warning = duplicates.includes(l.metadata.layerId);
    const branchKeys = new Set(l.group ? getChildren(asset, l.key).map(child => child.key) : [l.key]);
    const conflicts = issues.filter(issue => issue.keys.some(key => branchKeys.has(key)));
    const conflictText = conflicts.map(issue => issue.message).join("\n");
    const contents = l.smartObject?.contents ?? [];
    const expandable = l.group || contents.length > 0;
    const Icon = l.smartObject ? Box : l.group ? Layers3 : l.text ? Type : ImageIcon;
    const expanded = expandable && !collapsed.has(l.key);
    return <div role="none" key={l.key}><div data-layer-key={l.key} className={cn("psd-tree-row", selected === l.key && "is-selected")} role="treeitem" aria-selected={selected === l.key} aria-expanded={expandable ? expanded : undefined} style={{ paddingLeft: 6 + depth * 10 }}>
      {expandable ? <button className="psd-tree-expander" aria-label={(expanded ? "折叠" : "展开") + l.name} onClick={() => setCollapsed(old => { const next = new Set(old); if (next.has(l.key)) next.delete(l.key); else next.add(l.key); return next; })}>{expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button> : <span className="psd-tree-spacer" />}
      {toggle && checked ? <input type="checkbox" aria-label={`选择${l.name}（${l.nativeId ?? l.key}）`} checked={children.length > 0 && count === children.length} ref={el => { if (el) el.indeterminate = mixed; }} disabled={!children.length || warning || (!l.group && (individual ? !l.image && !needsPhotoCraft(l, true) : !!l.limitation || !l.image))} onChange={e => toggle(l, e.target.checked)} /> : null}
      <button className="psd-tree-label" onClick={() => onSelect(l.key)} title={`${l.name} · ${l.metadata.layerId}${warning ? " · ID 重复" : ""}${conflictText ? `\n${conflictText}` : ""}`}><Icon size={13} aria-hidden="true" /><span>{l.name}</span>{!l.group && l.config.enabled && l.config.shared ? <span className="psd-shared-marker" role="img" aria-label={`${l.name}：共享导出`} title="共享导出"><Share2 size={12} aria-hidden="true" /></span> : null}{conflicts.length ? <span className="psd-conflict-marker" role="img" aria-label={`${l.name}：导出冲突`} title={conflictText}><AlertTriangle size={13} aria-hidden="true" /></span> : warning ? <AlertTriangle size={12} className="psd-warning" /> : l.config.nineGrid ? <Grid3X3 size={12} /> : null}</button>
      {owners?.get(l.key)?.key === l.key && (
        <span className="psd-composite-marker" role="img" aria-label="合成图片" title="合成图片"><Images size={13} aria-hidden="true" /></span>
      )}
      {toggleVisibility && <button type="button" className="psd-visibility-toggle" aria-label={`图层可见性：${l.name}（${l.nativeId ?? l.key}）`}
        aria-pressed={!l.hidden} title={parentHidden ? "父组已隐藏" : l.hidden ? "在画布上显示" : "在画布上隐藏"}
        disabled={parentHidden} onClick={() => toggleVisibility(l.key)}>
        {l.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>}
    </div>{expanded && (l.group ? <div role="group">{render(l.key, depth + 1, l.hidden)}</div>
      : <div role="group" aria-label="智能对象内容（只读）">{treeOrder(contents, bottomFirst).map(child => <EmbeddedLayerRow key={child.key} layer={child} depth={depth + 1} bottomFirst={bottomFirst} />)}</div>)}</div>;
  });
  return <ScrollArea className="psd-layer-scroll" label={`${asset.name} 图层内容`} viewportRef={container}><div className="psd-layer-tree" role="tree" aria-label={`${asset.name} 图层树`}>{render(null, 0)}</div></ScrollArea>;
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

function ConfirmReplacement({ onSave, onDiscard, onCancel, busy, error }: { onSave: () => void; onDiscard: () => void; onCancel: () => void; busy: boolean; error: string }) {
  const ref = useRef<HTMLDialogElement>(null); useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="floating-panel workbench-dialog psd-dialog confirm-dialog" aria-label="当前配置尚未保存" onCancel={e => { e.preventDefault(); if (!busy) onCancel(); }}>
    <DialogHeading heading="当前配置尚未保存" onClose={() => { if (!busy) onCancel(); }} />
    <p>切换 PSD 前是否保存当前切图修改？</p>
    {error && <p role="alert">{error}</p>}
    <footer><Button disabled={busy} onClick={onSave}>保存并打开</Button><Button disabled={busy} variant="secondary" onClick={onDiscard}>不保存并打开</Button><Button disabled={busy} variant="secondary" onClick={onCancel}>取消</Button></footer>
  </dialog>;
}

function DropHint({ label }: { label: string }) {
  return <div className="psd-drop-overlay" role="status"><FileImage size={32} /><strong>{label}</strong><span>每次一个 .psd 文件</span></div>;
}

function MergeSourceDrop({ side, disabled, onFile, onError, children }: {
  side: "A" | "B"; disabled: boolean; onFile: (file: File) => void; onError: (message: string) => void; children: ReactNode;
}) {
  const drop = usePsdFileDrop({ disabled, onFile, onError });
  return <section className="psd-merge-pane psd-drop-target" aria-label={`合并来源 ${side}`} {...drop.handlers}>{children}{drop.dragging ? <DropHint label={`松开以打开来源 ${side}`} /> : null}</section>;
}

export function PsdWorkspace({ mode, active, binding, documentActions, settings, exportPending, onAsset, openBoundRef, onReveal }: { mode: "slice" | "merge"; active: boolean; binding?: PsdWorkspaceBinding; documentActions?: HTMLElement | null; settings: WorkbenchSettingsUI; exportPending?: boolean; onAsset?: (asset: PsdAsset) => void; openBoundRef?: Ref<OpenBoundSlice>; onReveal?: () => void }) {
  const [localLoaded, setLoaded] = useState<Loaded | null>(null), [requestedSelection, setSelectedKey] = useState<number | null>(null);
  const [requestedScope, setScopeKey] = useState<number | null>(null);
  const [directSelection, setDirectSelection] = useToolbarChoice("psdDirectSelection", [true, false]);
  const [showContainerOutlines, setShowContainerOutlines] = useToolbarChoice("psdContainerOutlines", [false, true]);
  const loaded = binding?.loaded ?? localLoaded;
  const [canvasSelection, setCanvasSelection] = useState(0);
  const [atlasInputError, setAtlasInputError] = useState<string | null>(null);
  const [directoryIssues, setDirectoryIssues] = useState<ExportIssue[]>([]);
  const [editingGrid, setEditingGrid] = useState<number | null>(null), [working, setBusy] = useState(false), [message, setMessage] = useState("");
  const [editingRegion, setEditingRegion] = useState<number | null>(null);
  const busy = working || !!binding?.busy;
  const [localDirty, setDirty] = useState(false);
  const dirty = binding?.dirty ?? localDirty;
  const [pendingFile, setPendingFile] = useState<File | Loaded | null>(null);
  const [switchError, setSwitchError] = useState("");
  const [past, setPast] = useState<PsdAsset[]>([]), [future, setFuture] = useState<PsdAsset[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const loading = useRef(false);
  const asset = loaded?.asset;
  const owners = useMemo(() => compositeOwners(asset?.layers ?? []), [asset?.layers]);
  const selectedKey = requestedSelection === null ? null : owners.get(requestedSelection)?.key ?? requestedSelection;
  const scopeOwner = requestedScope === null ? undefined : owners.get(requestedScope);
  const scopeKey = scopeOwner ? scopeOwner.parentKey : requestedScope;
  const original = asset?.layers.find(l => l.key === selectedKey) ?? null;
  const rendered = useRenderedSlice(asset, original, active && mode === "slice");
  const selected = rendered.layer;
  const nativeSlices = !isBrowserPreview;
  useEffect(() => { if (asset) onAsset?.(asset); }, [asset, onAsset]);
  const selectCanvasLayer = (key: number | null) => {
    setSelectedKey(key);
    const layer = asset?.layers.find(item => item.key === key);
    if (layer) setScopeKey(layer.parentKey);
    setCanvasSelection(n => n + 1);
  };
  const selectTreeLayer = (key: number) => {
    const layer = asset?.layers.find(item => item.key === key);
    if (!layer) return;
    setScopeKey(layer.parentKey); setSelectedKey(key); setCanvasSelection(n => n + 1);
  };
  const navigateScope = (key: number | null, selectedKey: number | null = null) => {
    setScopeKey(key); setSelectedKey(selectedKey);
    if (selectedKey !== null) setCanvasSelection(n => n + 1);
  };
  const selectedRegion = selected ? sliceRegion(selected) : null;
  useEffect(() => {
    setSelectedKey(null); setScopeKey(null);
  }, [binding?.configPath, binding?.loaded.asset.sourceHash]);
  const backupBrowser = (next: PsdAsset) => { try { saveBrowserDraft(next); } catch { setMessage("草稿备份失败，浏览器存储可能已满，请保存配置文件。"); } };
  const change = (next: PsdAsset) => { if (!loaded || busy) return; setDirectoryIssues([]); if (binding) { binding.change(next); return; } backupBrowser(next); setPast(p => [...p.slice(-39), loaded.asset]); setFuture([]); setLoaded({ ...loaded, asset: next }); setDirty(true); };
  const patchConfig = (key: number, patch: Partial<SliceConfig>) => { if (asset) change({ ...asset, layers: asset.layers.map(l => l.key === key ? { ...l, config: { ...l.config, ...patch } } : l) }); };
  function saveSliceGeometry(region: SliceRegion | undefined, nineGrid: NineGrid | null, enable: boolean) {
    if (!selected || !original) return false;
    const config = { ...original.config, region, nineGrid };
    if (!validConfig(config, selected.width, selected.height)) {
      setMessage("导出区域容纳不下当前九宫格，请调整区域或切线。");
      return false;
    }
    // A group can have smaller PSD bounds than its effects and additional sources.
    // Record its rendered default bounds only when necessary to persist a valid grid.
    const bounds = region ?? (!validConfig(config, original.width, original.height)
      ? { x: 0, y: 0, width: selected.width, height: selected.height } : undefined);
    const stored = bounds && translateRegion(bounds, selected, original);
    if (!validConfig({ ...config, region: stored }, original.width, original.height)) {
      setMessage("导出区域超出可保存的坐标范围，请调整图片位置。");
      return false;
    }
    patchConfig(original.key, { region: stored, nineGrid, enabled: enable || original.config.enabled });
    return true;
  }
  function saveRegion(region: SliceRegion | undefined) {
    if (selected && saveSliceGeometry(region, selected.config.nineGrid, false)) setEditingRegion(null);
  }
  function saveGrid(grid: NineGrid) {
    if (selected && saveSliceGeometry(selected.config.region, grid, true)) setEditingGrid(null);
  }
  const undo = (redo = false) => { if (!loaded || busy) return; if (binding) { void binding.history(redo).catch(error => setMessage(String(error))); return; } const source = redo ? future : past, item = source.at(-1); if (!item) return; setDirectoryIssues([]); if (redo) { setFuture(source.slice(0, -1)); setPast([...past, loaded.asset]); } else { setPast(source.slice(0, -1)); setFuture([...future, loaded.asset]); } backupBrowser(item); setLoaded({ ...loaded, asset: item }); setDirty(true); };
  const openSource = () => { if (isBrowserPreview) input.current?.click(); else postHostMessage({ type: "openPsdEditor" }); };
  const readFile = async (file?: File | Loaded, choice?: "save" | "discard") => {
    if (file && !isBrowserPreview) { setMessage("请在文件选择器中定位此 PSD，将在当前工作台内打开。"); openSource(); return; }
    if (!file || busy || loading.current) return;
    if (dirty && !choice) { setSwitchError(""); setPendingFile(file); return; }
    loading.current = true; setBusy(true); setMessage("正在读取 PSD…");
    try {
      const source = file instanceof File ? await openPsd(file) : file;
      if (choice === "save" && !await save(false, true)) return;
      if (choice === "discard" && loaded) discardBrowserDraft(loaded.asset);
      let draft: ReturnType<typeof restoreBrowserDraft> = null, restoreError = "";
      try { draft = restoreBrowserDraft(source.asset); }
      catch (error) { restoreError = `草稿恢复失败，备份已保留：${String(error)}`; }
      const asset = draft?.asset ?? source.asset;
      setPendingFile(null); setDirectoryIssues([]); setLoaded({ ...source, asset }); setSelectedKey(null); setScopeKey(null); setPast([]); setFuture([]); setDirty(!!draft?.dirty);
      setMessage(restoreError || (draft?.dirty ? "已恢复本地草稿，请保存配置文件。" : identityProblems(asset).length ? "存在重复 ID：选中副本后，点击“作为新节点”。" : ""));
      if (!(file instanceof File)) onReveal?.();
    }
    catch (e) { const error = e instanceof Error ? e.message : String(e); setMessage(error); if (choice) setSwitchError(error); } finally { loading.current = false; setBusy(false); }
  };
  useImperativeHandle(openBoundRef, () => source => {
    if (asset?.documentId === source.asset.documentId && asset.sourceUri === source.asset.sourceUri && asset.sourceHash === source.asset.sourceHash && asset.name === source.asset.name) {
      onReveal?.();
      return;
    }
    if (busy || loading.current) throw new Error("切图工作区正在处理 PSD，请稍后重试。");
    void readFile(source);
  });
  const save = async (embedded: boolean, switching = false) => {
    if (!loaded || busy) return; setBusy(true); setMessage(embedded ? "正在写入 PSD 副本…" : "正在保存配置…");
    try {
      if (binding) { await binding.save(embedded); setMessage(""); return true; }
      const meta = makeSidecar(loaded.asset);
      const bytes = embedded ? new Uint8Array(await psdTask<ArrayBuffer>("patch", loaded.bytes, asset!.name, loaded.asset.layers.map(l => [l.key, meta.layers.find(m => m.id === l.metadata.layerId)!.metadata] as [number, PsdLayerMeta]))) : new TextEncoder().encode(JSON.stringify(meta, null, 2) + "\n");
      const name = embedded ? asset!.name.replace(/\.psd$/i, "") + "-configured.psd" : sidecarName(asset!.name);
      const saved = await saveOutput(name, embedded ? "psd" : "meta", bytes);
      if (saved) {
        if (!embedded) { markBrowserConfigSaved(loaded.asset); setDirty(false); }
        setMessage(isBrowserPreview ? `已发起下载：${name}` : `已保存：${name}`);
      } else setMessage("已取消保存。");
      return saved;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e); setMessage(error);
      if (switching) setSwitchError(error);
      return false;
    } finally { setBusy(false); }
  };
  useEffect(() => {
    if (!active || mode !== "slice") return;
    const keydown = (event: KeyboardEvent) => {
      if (editingGrid !== null || editingRegion !== null || pendingFile || settings.open) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "s") {
        if (busy) return;
        event.preventDefault();
        (document.activeElement as HTMLElement)?.blur();
        void save(false);
        return;
      }
      if (!loaded || (event.target as Element).closest('input, textarea, select, [contenteditable=true], [role=menu], dialog[open]')) return;
      const action = consumeHistoryShortcut(event);
      if (action) undo(action === "redo");
    };
    document.addEventListener("keydown", keydown); return () => document.removeEventListener("keydown", keydown);
  });
  useEffect(() => { if (!dirty || !isBrowserPreview) return; const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; }; window.addEventListener("beforeunload", unload); return () => window.removeEventListener("beforeunload", unload); }, [dirty]);
  const drop = usePsdFileDrop({ disabled: !active || mode !== "slice" || busy || editingGrid !== null || editingRegion !== null || !!pendingFile || settings.open, onFile: file => { void readFile(file); }, onError: setMessage });
  const duplicates = asset ? identityProblems(asset) : [];
  const exportIssues = asset ? sliceExportIssues(asset, nativeSlices) : [];
  const allExportIssues = [...exportIssues, ...directoryIssues];
  const selectedExportName = asset && selected ? effectiveExportName(asset, selected) : "";
  const selectedBuiltin = selected && builtinSlice(selected);
  const nameFixed = !!asset && !!selected && isLayerVariableNameFixed(asset, selected);
  const selectedNameError = selected ? exportNameError(selectedExportName) : null;
  let targetDirectory: string | undefined, targetDirectoryError: string | undefined;
  if (asset) try { targetDirectory = psdSliceDirectory(asset); } catch (error) { targetDirectoryError = error instanceof Error ? error.message : String(error); }
  const exportResources = async () => {
    if (busy || binding?.pending || exportPending || atlasInputError || !asset || !settings.ensureResources()) return;
    setBusy(true); setMessage("正在检查并导出切图…");
    try {
      const result = await resourceExport("export", await renderSliceExportBatch(asset));
      if (!result.cancelled) setDirectoryIssues([]);
      setMessage(result.cancelled ? "" : `已导出 ${result.count} 张图片及来源清单：${result.directory}`);
    } catch (e) {
      if (e instanceof SliceExportConflict && asset) {
        setDirectoryIssues(e.conflicts.map(conflict => ({ keys: enabledSliceLayers(asset).filter(l => effectiveExportName(asset, l) === conflict.name).map(l => l.key), message: conflict.message })));
        setMessage("导出存在冲突，请查看图层树中的警告标记。");
      } else setMessage(e instanceof Error ? e.message : String(e));
    }
    finally { setBusy(false); }
  };
  const revealResources = async () => {
    if (busy || settings.busy || isBrowserPreview || !settings.settings.resourceDirectory) return;
    const result = await settings.reveal("resources");
    if (result?.error) setMessage(result.error);
  };
  return <section className={cn("psd-workspace", mode === "slice" && asset && "has-bottom-toolbar")} hidden={!active} aria-label={mode === "slice" ? "PSD 切图工作区" : "PSD 合并工作区"} {...(mode === "slice" ? drop.handlers : {})}>
    {mode === "merge" ? <MergeWorkspace active={active} /> : <>
      {active && documentActions ? createPortal(<>
        <Button size="icon" variant="ghost" className="workbench-icon" disabled={busy} aria-label="打开 PSD" title="打开 PSD" onClick={openSource}><FolderOpen size={15} /></Button>
        <Button size="icon" variant="ghost" className="workbench-icon workbench-history" disabled={!asset || busy || (!binding && !past.length)} aria-label="撤销 (Ctrl+Z)" title="撤销 (Ctrl+Z)" onClick={() => undo()}><Undo2 size={15} /></Button>
        <Button size="icon" variant="ghost" className="workbench-icon workbench-history" disabled={!asset || busy || (!binding && !future.length)} aria-label="重做 (Ctrl+Shift+Z)" title="重做 (Ctrl+Shift+Z)" onClick={() => undo(true)}><Redo2 size={15} /></Button>
        <Button size="icon" variant="ghost" className="workbench-icon" disabled={!asset || busy} aria-label="保存 (Ctrl+S)" title={`保存 (Ctrl+S)${binding?.configPath ? `\n配置：${binding.configPath}` : ""}`} onClick={() => void save(false)}><Save size={15} /></Button>
        <WorkbenchSettingsButton settings={settings} />
        <DropdownMenu.Root><DropdownMenu.Trigger asChild><Button size="icon" variant="ghost" className="workbench-icon" aria-label="更多操作" title="更多操作"><Ellipsis size={15} /></Button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="layer-context-menu" align="start" sideOffset={5}><DropdownMenu.Item disabled={!asset || busy} onSelect={() => void save(true)}>导出带配置的 PSD…</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>
      </>, documentActions) : null}
      {binding?.notice ? <p className="psd-config-notice">{binding.notice}</p> : null}
      {binding?.error ? <div className="psd-config-notice psd-warning" role="alert">{binding.error}<Button size="sm" variant="ghost" onClick={binding.retry}>重新提交修改</Button></div> : null}
      {asset ? <PsdSliceCanvas key={JSON.stringify([asset.sourceUri ?? asset.name, asset.documentId, asset.sourceHash])} asset={asset} savedWidths={settings.settings.panelWidths?.slice} selected={selected} active={active} directSelection={directSelection} showContainerOutlines={showContainerOutlines} scopeKey={scopeKey} onSelect={selectCanvasLayer} onNavigateScope={navigateScope}
        toolbar={<><Button size="icon" variant={directSelection ? "secondary" : "ghost"} className={cn("psd-toolbar-action", directSelection && "tool-active")} aria-label="直选模式" aria-pressed={directSelection} title="直选模式" onClick={() => setDirectSelection(!directSelection)}><MousePointerClick size={19} /></Button><Button size="icon" variant={showContainerOutlines ? "secondary" : "ghost"} className={cn("psd-toolbar-action", showContainerOutlines && "tool-active")} aria-label="虚线框" aria-pressed={showContainerOutlines} title="虚线框" onClick={() => setShowContainerOutlines(!showContainerOutlines)}><SquareDashed size={19} /></Button><Separator orientation="vertical" /><Button size="icon" variant="ghost" className="psd-toolbar-action" aria-label="导出" disabled={busy || !!binding?.pending || !!exportPending || !!exportIssues.length || !!atlasInputError || !enabledSliceLayers(asset).length} title="导出标记的切图" onClick={() => void exportResources()}><Download size={15} /></Button><Separator orientation="vertical" /><Button size="icon" variant="ghost" className="psd-toolbar-action" aria-label="在文件管理器中打开" disabled={busy || settings.busy || isBrowserPreview || !settings.settings.resourceDirectory} title={isBrowserPreview ? "仅 VS Code 支持在文件管理器中打开" : settings.settings.resourceDirectory ? `在文件管理器中打开 ${settings.settings.resourceDirectory}` : "请先设置资源导出根目录"} onClick={() => void revealResources()}><FolderOpen size={15} /></Button></>}
        tree={(preview, toggleVisibility) => <><div className="floating-heading"><Layers3 size={14} /><strong>图层</strong><span>{preview.layers.length}</span></div>
          <button type="button" className="psd-tree-label psd-document-row" aria-pressed={!selected && scopeKey === null} title={asset.name} onClick={() => navigateScope(null)}>
            <FileImage size={13} /><span>{asset.name}</span>
          </button>
          <div className="psd-hint">勾选需要切图的图层{allExportIssues.length ? <span className="psd-warning" role="status"> · {allExportIssues.length} 项导出冲突</span> : null}</div><Tree bottomFirst individual={nativeSlices} asset={preview} owners={owners} toggleVisibility={toggleVisibility} selected={selectedKey} reveal={canvasSelection} issues={allExportIssues} onSelect={selectTreeLayer} checked={l => l.config.enabled} toggle={(layer, enabled) => { if (nativeSlices) { patchConfig(layer.key, { enabled }); return; } const keys = new Set(getChildren(preview, layer.key).filter(l => !l.group && l.image && !l.limitation && !duplicates.includes(l.metadata.layerId)).map(l => l.key)); change({ ...asset, layers: asset.layers.map(l => keys.has(l.key) ? { ...l, config: { ...l.config, enabled } } : l) }); }} /></>}
        properties={<><div className="floating-heading"><Scissors size={14} /><strong>{selected ? "切图属性" : "文档配置"}</strong></div><ScrollArea className="psd-properties-scroll" label="切图属性内容"><div className="psd-properties-content">
          <section className="psd-property-section" aria-label="文档配置" hidden={!!selected}>
          <label className="psd-property"><span>图集名</span><AtlasNameInput key={asset.sourceHash + asset.documentId} name={asset.name} value={asset.atlasName} disabled={busy} onErrorChange={setAtlasInputError} onChange={atlasName => change({ ...asset, atlasName })} /></label>
          <label className="psd-check"><input type="checkbox" aria-label="使用独立目录" checked={asset.independentDirectory === true} disabled={busy} onChange={e => { const next = { ...asset }; if (e.target.checked) next.independentDirectory = true; else delete next.independentDirectory; change(next); }} />使用独立目录</label>
          {!targetDirectoryError && !atlasInputError ? <p className="psd-hint">普通资源导出到 {targetDirectory}/</p> : null}
          {targetDirectoryError || atlasInputError ? <p className="psd-warning" role="alert">{atlasInputError ?? targetDirectoryError}</p> : null}
          </section>{selected ? <><section className="psd-property-section" aria-label="图层信息"><div className="psd-section-heading"><strong>{selected.name}</strong><small>{selected.group && !isCompositeGroup(selected) ? "分组" : `${selected.smartObject ? "智能对象 · " : ""}${selected.width} × ${selected.height}`}</small></div><label className="psd-property"><span>图层 ID</span><code>{selected.metadata.layerId}</code></label><label className="psd-property"><span>原生 ID</span><code>{selected.nativeId ?? "无"}</code></label>
          {duplicates.includes(selected.metadata.layerId) ? <div className="psd-warning-box"><AlertTriangle size={14} /><span>此 ID 有多个图层使用。选中副本后分配新身份。</span><Button size="sm" variant="secondary" onClick={() => change(newLayerIdentity(asset, selected.key))}>作为新节点</Button></div> : null}
          {rendered.loading ? <p role="status">正在合成切图…</p> : rendered.error ? <p role="alert" className="psd-warning">{rendered.error} <Button size="sm" variant="secondary" onClick={rendered.retry}>重试</Button></p> : selected.image ? <div className="psd-layer-image checkerboard"><SliceImage layer={selected} /></div> : <p className="psd-hint">选择包含图片的子图层设置切图区域和九宫格。</p>}
          </section><Separator /><section className="psd-property-section" aria-label="导出设置"><div className="property-section-title">导出设置</div>
          <label className="psd-property"><span>变量名称</span><Input aria-label="变量名称"
            value={nameFixed ? effectiveVariableName(asset, selected) : layerVariableOverride(asset, selected)}
            placeholder={defaultLayerVariableName(asset, selected)} maxLength={120}
            readOnly={nameFixed} onChange={nameFixed ? undefined : e => patchConfig(selected.key, { variableName: e.target.value })} /></label>
          <label className="psd-property"><span>导出名称</span><Input aria-label="导出名称"
            value={selectedExportName} title={selectedBuiltin ? builtinSliceDescription(selectedBuiltin).path : `${selectedExportName}.png`} aria-invalid={!!selectedNameError} readOnly /></label>
          {selectedBuiltin && <p className="psd-hint">复用内置图片 {builtinSliceDescription(selectedBuiltin).path}</p>}
          {selectedNameError ? <p className="psd-warning" role="alert">{selectedNameError}</p> : null}
          {selected.limitation && !nativeSlices ? <p className="psd-warning">{selected.limitation}</p> : null}
          {allExportIssues.filter(issue => issue.keys.some(key => getChildren(asset, selected.key).some(l => l.key === key))).map((issue, i) => <p key={i} className="psd-warning" role="alert">{issue.message}</p>)}
          {selected.group && <label className="psd-check"><input type="checkbox" checked={isCompositeGroup(selected)} disabled={busy}
            onChange={e => patchConfig(selected.key, e.target.checked ? { composite: true, enabled: true } : { composite: false })} />合成图片</label>}
          <label className="psd-check"><input type="checkbox" checked={selected.config.enabled} disabled={!selected.config.enabled && !(needsPhotoCraft(selected, nativeSlices) ? nativeSlices : selected.image)} onChange={e => patchConfig(selected.key, { enabled: e.target.checked })} />标记为切图</label>
          <label className="psd-check"><input type="checkbox" aria-label="共享资源" checked={selected.config.shared === true} onChange={e => patchConfig(selected.key, { shared: e.target.checked })} />共享资源</label>
          {selected.config.shared ? <p className="psd-hint">导出到 shared/，覆盖同名共享资源并更新来源 PSD。</p> : null}
          </section><Separator /><section className="psd-property-section" aria-label="九宫格"><div className="psd-section-heading property-section-title"><strong>九宫格</strong><Button size="sm" variant="ghost" disabled={!selected.config.nineGrid} onClick={() => patchConfig(selected.key, { nineGrid: null })}>清除</Button></div>
          {selected.config.nineGrid ? <div className="psd-grid-summary">上 {selected.config.nineGrid.top} · 右 {selected.config.nineGrid.right} · 下 {selected.config.nineGrid.bottom} · 左 {selected.config.nineGrid.left}<small>{selected.config.nineGrid.repeat ? "重复填充" : "拉伸填充"}</small></div> : <p className="psd-hint">尚未设置</p>}
          <Button variant="secondary" disabled={!rendered.ready} onClick={() => setEditingGrid(selected.key)}><Grid3X3 size={14} />编辑九宫格</Button>
          {rendered.ready && selected.image && selected.config.nineGrid ? <NineGridPreview image={selected.image} width={selectedRegion!.width} height={selectedRegion!.height} grid={selected.config.nineGrid} region={selected.config.region} /> : null}
          </section><Separator /><section className="psd-property-section" aria-label="导出区域"><div className="psd-section-heading property-section-title"><strong>导出区域</strong><Button size="sm" variant="ghost" aria-label="恢复原始导出区域" disabled={!selected.config.region || !rendered.ready} onClick={() => saveRegion(undefined)}>恢复原始</Button></div>
          <div className="psd-grid-summary">{selectedRegion!.width} × {selectedRegion!.height} px<small>{selected.config.region ? `图片位置 X ${-selectedRegion!.x} · Y ${-selectedRegion!.y}` : "使用图层原始范围"}</small></div>
          <Button variant="secondary" disabled={!rendered.ready} onClick={() => setEditingRegion(selected.key)}><Crop size={14} />编辑区域</Button>
          </section>
          {!binding ? <p className="psd-hint">导出 PNG 和来源清单，九宫格随清单保存。浏览器本地草稿可在重新选择同一 PSD 后恢复。</p> : null}
        </> : null}</div></ScrollArea></>}
      /> : <div className="psd-empty"><FileImage size={40} /><h2>从 PSD 开始切图</h2><p>{isBrowserPreview ? "拖入 PSD 文件，或点击打开。选择图层后可标记切图并设置九宫格。" : "在当前工作台打开 PSD。修改后支持保存，关闭工作台时提醒保存。"}</p><Button disabled={busy} onClick={openSource}><FolderOpen size={16} />打开 PSD</Button><small>支持 8 位 RGB · 最大 32 MB</small></div>}
      {drop.dragging ? <DropHint label="松开以打开 PSD" /> : null}
      {message ? <div className="psd-status" role="status">{busy ? null : <Check size={13} />}{message}<button aria-label="关闭提示" onClick={() => setMessage("")}><X size={13} /></button></div> : null}
      <input ref={input} type="file" accept=".psd" className="hidden" aria-label="打开切图 PSD" onChange={e => { void readFile(e.target.files?.[0]); e.target.value = ""; }} />
      {editingGrid !== null && original && selected?.key === editingGrid && rendered.ready ? <NineGridEditor layer={selected} onSave={saveGrid} onCancel={() => setEditingGrid(null)} /> : null}
      {editingRegion !== null && original && selected?.key === editingRegion && rendered.ready ? <RegionEditor layer={selected} onSave={saveRegion} onCancel={() => setEditingRegion(null)} /> : null}
      {pendingFile ? createPortal(<ConfirmReplacement busy={busy} error={switchError}
        onSave={() => void readFile(pendingFile, "save")} onDiscard={() => void readFile(pendingFile, "discard")}
        onCancel={() => setPendingFile(null)} />, document.body) : null}
    </>}
  </section>;
}

function MergeWorkspace({ active }: { active: boolean }) {
  const [sources, setSources] = useState<{ A: PsdAsset | null; B: PsdAsset | null }>({ A: null, B: null });
  const [choices, setChoices] = useState<Record<string, "A" | "B">>({});
  const [selected, setSelected] = useState<string | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null), target = useRef<"A" | "B">("A");
  const loading = useRef(false);
  const pick = (source: "A" | "B") => { target.current = source; input.current?.click(); };
  const load = async (file?: File, side = target.current) => { if (!file || busy || loading.current) return; loading.current = true; setBusy(true); setMessage(""); try { const { asset } = await openPsd(file); setSources(old => ({ ...old, [side]: asset })); setChoices({}); if (identityProblems(asset).length) setMessage("来源含重复 ID，请先在 PSD 切图中为副本分配新身份并保存。"); } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); } finally { loading.current = false; setBusy(false); } };
  const sizeMismatch = sources.A && sources.B && (sources.A.width !== sources.B.width || sources.A.height !== sources.B.height);
  const result = selectedMergeTree(sources, choices);
  const chosen = result?.layers.filter(l => !l.group) ?? [];
  const toggle = (side: "A" | "B", asset: PsdAsset, layer: PsdLayer, value: boolean) => { if (sizeMismatch) { setMessage("两份 PSD 尺寸不同，请先在美术工具中对齐画布。"); return; } const duplicates = identityProblems(asset); const leaves = getChildren(asset, layer.key).filter(l => !l.group && l.image && !l.limitation && !duplicates.includes(l.metadata.layerId)); setChoices(old => { const next = { ...old }; for (const l of leaves) { const id = layerIdentity(l); if (value) next[id] = side; else if (next[id] === side) delete next[id]; } return next; }); };
  return <div className="psd-merge-workspace" onDragOver={event => { if (hasFileDrag(event.dataTransfer)) { event.preventDefault(); event.dataTransfer.dropEffect = "none"; } }} onDrop={event => { if (hasFileDrag(event.dataTransfer)) { event.preventDefault(); if (!busy) setMessage("请将 PSD 拖到来源 A 或来源 B 区域。"); } }}><div className="psd-commandbar"><strong>PSD 合并</strong><span className="psd-filename">无基础版本 · 手动选择</span><span className="psd-hint">当前提供选层预览，完整 PSD 合并写出尚未接入</span></div>
    <div className="psd-merge-layout"><div className="psd-merge-sources">{(["A", "B"] as const).map(side => { const asset = sources[side]; return <MergeSourceDrop key={side} side={side} disabled={!active || busy} onFile={file => { void load(file, side); }} onError={setMessage}><header><strong>来源 {side}</strong><span>{asset?.name ?? "未选择 PSD"}</span><Button size="sm" variant="ghost" disabled={busy} onClick={() => pick(side)}><FolderOpen size={13} />选择 PSD</Button></header>{asset ? <div className="psd-merge-pane-content"><Tree asset={asset} selected={asset.layers.find(l => layerIdentity(l) === selected)?.key ?? null} onSelect={key => setSelected(layerIdentity(asset.layers.find(l => l.key === key)!))} checked={l => choices[layerIdentity(l)] === side} toggle={(l, v) => toggle(side, asset, l, v)} /><PsdPreview asset={asset} selected={asset.layers.find(l => layerIdentity(l) === selected)} /></div> : <div className="psd-merge-empty"><Button variant="ghost" disabled={busy} onClick={() => pick(side)}>打开来源 {side}</Button><span>或拖入 PSD 到此区域</span></div>}</MergeSourceDrop>; })}</div>
      <section className="psd-merge-pane psd-merge-result"><header><strong>选择结果</strong><span>{chosen.length} 个图层</span><Button size="sm" variant="ghost" onClick={() => setChoices({})} disabled={!chosen.length}>清空选择</Button></header>{result ? <div className="psd-merge-pane-content"><Tree asset={result} selected={result.layers.find(l => layerIdentity(l) === selected)?.key ?? null} onSelect={key => setSelected(layerIdentity(result.layers.find(l => l.key === key)!))} /><PsdPreview asset={result} selected={chosen.find(l => layerIdentity(l) === selected)}>{[...chosen].reverse().filter(l => !l.hidden).map((l, i) => <img key={i} src={l.image} alt={l.name} style={{ position: "absolute", left: l.left, top: l.top, width: l.width, height: l.height }} />)}</PsdPreview></div> : <div className="psd-merge-empty"><Layers3 size={28} /><p>在左侧打开 PSD，勾选采用的图层。</p></div>}</section>
    </div>{message || sizeMismatch ? <div className="psd-status" role="status">{message || "画布尺寸不同，需先对齐后选择。"}</div> : null}<input ref={input} type="file" accept=".psd" className="hidden" aria-label="打开合并来源 PSD" onChange={e => { void load(e.target.files?.[0]); e.target.value = ""; }} /></div>;
}
