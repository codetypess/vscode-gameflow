import { useEffect, useMemo, useRef, useState } from "react";
import type { GameFlowDocument, GameFlowPage } from "../../shared/model";
import { bindPagePsd, pagePsdFileName, pagePsdKey } from "../../shared/page-psd";
import type { PsdAsset } from "../../shared/psd-meta";
import { applyPsdDraft } from "../../shared/psd-draft";
import { validComponentPsdFields, validPsdBase64, type ComponentPsdBinding, type PagePsdRequest, type PagePsdResult } from "../../shared/page-psd-protocol";
import { openPsd, psdTask, saveOutput } from "../psd/io";
import { isBrowserPreview, postHostMessage } from "../vscode-api";
import { compareTrees, coordinatedBase, prototypeTree, psdComponentInstances, psdTree } from "../../shared/page-sync";
import type { CanvasComposition } from "../../shared/canvas-instances";
import type { CanvasSources } from "../../shared/canvas-references";
import { allocateElementId, reserveDocumentElementIds } from "../../shared/element-id";
import { prepareComponentPsdGeneration } from "./component-psd";
export type PagePsdState = { key: string; status: "loading" | "ready" | "error"; error?: string };
export interface PagePsdActions {
  states: Record<string, PagePsdState>;
  assets: Record<string, PsdAsset>;
  busy: ReadonlySet<string>;
  run(pageId: string, action: "choose" | "generate"): Promise<void>;
  retry(pageId: string): void;
}
const browserAssets = new Map<string, PsdAsset>();
const syncBytes = new WeakMap<PsdAsset,Uint8Array>();
export function sourceBytes(asset:PsdAsset) {
  const bytes=syncBytes.get(asset);
  if(!bytes) throw new Error("请重新打开同步窗口以读取 PSD 文件。");
  return bytes;
}
function chooseFile(): Promise<File | undefined> {
  return new Promise(resolve => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".psd";
    input.onchange = () => resolve(input.files?.[0]); input.oncancel = () => resolve(undefined); input.click();
  });
}
export function encodePsd(bytes: Uint8Array) {
  let payload = "";
  for (let i = 0; i < bytes.length; i += 8192) payload += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(payload);
}
const decodePsd = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));
export const supportsComponentPsd = () => isBrowserPreview || !!document.querySelector('meta[name="gameflow-component-psd"][content="1"]');
export async function requestPsd(request: Omit<PagePsdRequest, "type" | "requestId">, bytes?: Uint8Array):
  Promise<{ source: string; asset: PsdAsset; componentBindings?: ComponentPsdBinding[] } | undefined> {
  if (isBrowserPreview) {
    if (request.action === "load" || request.action === "review" || request.action === "slice") {
      const asset = browserAssets.get(request.pageId + ":" + pagePsdKey(request.expected));
      if (!asset && request.component) return;
      if (!asset) throw new Error("浏览器刷新后需重新选择本地 PSD；请点击重新绑定 PSD。");
      return { source: request.expected!.source, asset };
    }
    let asset: PsdAsset, source: string;
    const componentBindings: ComponentPsdBinding[] = [];
    const companions = [];
    const names = new Set([request.name?.toLowerCase(), ...Array.from(browserAssets.values(), asset => asset.name.toLowerCase())]);
    for (const output of request.componentOutputs ?? []) {
      const bytes = decodePsd(output.base64);
      const stem = output.name.slice(0, -4);
      let name = output.name;
      for (let index = 2; names.has(name.toLowerCase()); index++) name = `${stem}-${index}.psd`;
      names.add(name.toLowerCase());
      const asset = await psdTask<PsdAsset>("read", bytes.slice().buffer, name);
      companions.push({ name, asset, bytes, pageId: output.pageId });
      componentBindings.push({ canvas: output.canvas, documentId: output.documentId, pageId: output.pageId,
        binding: { documentId: asset.documentId, source: name } });
    }
    if (request.action === "choose") { const file = await chooseFile(); if (!file) return; const opened=await openPsd(file, "readPage"); asset=opened.asset; syncBytes.set(asset,new Uint8Array(opened.bytes)); source = file.name; }
    else { source = request.name!; asset = await psdTask<PsdAsset>("read", new Uint8Array(bytes!).buffer, source); if (!await saveOutput(source, "psd", bytes!)) return; syncBytes.set(asset,bytes!); }
    // A browser file selection has no filesystem URI. Identify this selected snapshot across slice edits.
    asset.sourceUri = "urn:uuid:" + crypto.randomUUID();
    browserAssets.set(request.pageId + ":" + pagePsdKey({ source, documentId: asset.documentId }), asset);
    for (const companion of companions) {
      if (!await saveOutput(companion.name, "psd", companion.bytes)) return;
      companion.asset.sourceUri = "urn:uuid:" + crypto.randomUUID();
      syncBytes.set(companion.asset, companion.bytes);
      browserAssets.set(companion.pageId + ":" + pagePsdKey({ source: companion.name, documentId: companion.asset.documentId }), companion.asset);
    }
    return { source, asset, componentBindings };
  }
  const base64 = bytes && encodePsd(bytes);
  if ((base64 && !validPsdBase64(base64)) || !validComponentPsdFields(request)) throw new Error("PSD 数据超过宿主请求限制。");
  if ((request.component || request.componentOutputs?.length || request.componentChecks?.length) && !supportsComponentPsd())
    throw new Error("请重新加载 VS Code 窗口以使用组件 PSD。");
  const requestId = crypto.randomUUID();
  const result = await new Promise<PagePsdResult>((resolve, reject) => {
    const timer = window.setTimeout(() => { window.removeEventListener("message", receive); reject(new Error("PSD 请求超时，请重试。")); }, 180000);
    const receive = ({ data }: MessageEvent<PagePsdResult>) => { if (data?.type !== "pagePsdResult" || data.requestId !== requestId) return; window.clearTimeout(timer); window.removeEventListener("message", receive); resolve(data); };
    window.addEventListener("message", receive);
    postHostMessage({ ...request, type: "pagePsd", requestId, ...(base64 ? { base64 } : {}) });
  });
  if (request.component && result.missingComponent) return;
  if (result.error) throw new Error(result.error);
  // The native slice editor receives its document through psdEditorInit.
  if (result.cancelled || request.action === "slice") return;
  if (!result.base64 || !result.source || !result.name || !result.draft) throw new Error("PSD 返回数据不完整。");
  const decoded = decodePsd(result.base64);
  const asset = applyPsdDraft(await psdTask<PsdAsset>("readPage", decoded.slice().buffer, result.name), result.draft, true);
  asset.sourceUri = result.sourceUri;
  syncBytes.set(asset,decoded);
  return { source: result.source, asset, componentBindings: result.componentBindings };
}
export function usePagePsds(document: GameFlowDocument | null, read: () => GameFlowDocument | null,
  update: (transform: (document: GameFlowDocument) => GameFlowDocument) => void, observe: (asset: PsdAsset) => void,
  notice: (message: string) => void, project: (document: GameFlowDocument, page: GameFlowPage) => CanvasComposition,
  sources: CanvasSources): PagePsdActions {
  const [assets, setAssets] = useState<Record<string, PsdAsset>>({});
  const [states, setStates] = useState<Record<string, PagePsdState>>({}), [busy, setBusy] = useState<Set<string>>(new Set()), [revision, bump] = useState(0);
  const latest = useRef({ read, update, observe, notice, project, sources }); latest.current = { read, update, observe, notice, project, sources };
  const loads = useRef(new Map<string, { key: string; token: object }>()), actions = useRef(new Map<string, object>());
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; loads.current.clear(); actions.current.clear(); }; }, []);
  const bindingStamp = JSON.stringify([document?.documentId, document?.pages.map(page => [page.id, pagePsdKey(page.artPsd)])]);
  useEffect(() => {
    if (!document) return;
    const valid = new Set(document.pages.map(page => page.id));
    for (const id of loads.current.keys()) if (!valid.has(id)) loads.current.delete(id);
    for (const page of document.pages) {
      const key = document.documentId + pagePsdKey(page.artPsd);
      if (!page.artPsd) { loads.current.delete(page.id); continue; }
      if (loads.current.get(page.id)?.key === key) continue;
      const token = {}, expected = page.artPsd;
      loads.current.set(page.id, { key, token });
      setStates(previous => ({ ...previous, [page.id]: { key: pagePsdKey(expected), status: "loading" } }));
      void requestPsd({ pageId: page.id, action: "load", expected }).then(result => {
        if (!alive.current || loads.current.get(page.id)?.token !== token) return;
        const current = latest.current.read();
        if (current?.documentId !== document.documentId || pagePsdKey(current.pages.find(p => p.id === page.id)?.artPsd) !== pagePsdKey(expected)) return;
        if (!result) throw new Error("PSD 装载已取消。");
        if (result.asset.documentId !== expected.documentId) throw new Error("PSD 身份与页面关联不一致，请重新绑定。");
        latest.current.observe(result.asset);
        setAssets(previous => ({ ...previous, [page.id]: result.asset }));
        setStates(previous => ({ ...previous, [page.id]: { key: pagePsdKey(expected), status: "ready" } }));
      }).catch(error => { if (alive.current && loads.current.get(page.id)?.token === token) setStates(previous => ({ ...previous, [page.id]: { key: pagePsdKey(expected), status: "error", error: String(error).replace(/^Error: /, "") } })); });
    }
  }, [bindingStamp, revision]);
  const retry = (pageId: string) => { loads.current.delete(pageId); bump(n => n + 1); };
  useEffect(() => {
    const changed = ({ data }: MessageEvent) => { if (data?.type !== "pagePsdChanged") return; for (const page of latest.current.read()?.pages ?? []) if (page.artPsd?.documentId === data.documentId) loads.current.delete(page.id); bump(n => n + 1); };
    window.addEventListener("message", changed); return () => window.removeEventListener("message", changed);
  }, []);
  const run = async (pageId: string, action: "choose" | "generate") => {
    const current = latest.current.read(), page = current?.pages.find(page => page.id === pageId);
    if (!current || !page || actions.current.size) return;
    const token = {}, expected = pagePsdKey(page.artPsd); actions.current.set(pageId, token);
    setBusy(previous => new Set(previous).add(pageId));
    try {
      const composition = latest.current.project(current, page);
      const components = psdComponentInstances(composition);
      const previous = states[pageId]?.key === pagePsdKey(page.artPsd) ? assets[pageId]?.layers.map(layer=>layer.metadata) : undefined;
      const generated = action === "generate" && components.size
        ? await prepareComponentPsdGeneration(current, latest.current.sources, composition) : undefined;
      const bytes = action === "generate" ? await (await import("./prototype-psd")).generatePrototypePsd(current, composition.page, components,{ previous, sources: latest.current.sources }, generated?.psds) : undefined;
      if (action === "generate" && JSON.stringify(latest.current.read()) !== JSON.stringify(current))
        throw new Error("画布已变化，请重新生成 PSD。");
      const name = pagePsdFileName(page.name);
      const result = await requestPsd({ pageId, action, expected: page.artPsd, name,
        ...(generated && { componentOutputs: generated.outputs, componentChecks: generated.checks }) }, bytes);
      if (!result || !alive.current || actions.current.get(pageId) !== token) return;
      const now = latest.current.read(), target = now?.pages.find(page => page.id === pageId);
      if (now?.documentId !== current.documentId || !target || pagePsdKey(target.artPsd) !== expected) { latest.current.notice("页面关联已变化，本次结果未应用。"); return; }
      // Validate mappings before applying one atomic edit.
      bindPagePsd(latest.current.project(now, target).page, current.documentId, result.source, result.asset);
      latest.current.observe(result.asset);
      setAssets(previous => ({ ...previous, [pageId]: result.asset }));
      loads.current.set(pageId, { key: current.documentId + pagePsdKey({ source: result.source, documentId: result.asset.documentId }), token });
      let generatedBase=undefined;
      if(action==="generate") {
        const projected=composition.page;
        const reserved = new Set(projected.nodes.map(node=>node.id));
        reserveDocumentElementIds(current,reserved);
        const proto=prototypeTree(projected,components), psd=psdTree(current.documentId,projected,result.asset,()=>allocateElementId(reserved),undefined,false,components);
        generatedBase=coordinatedBase(current.documentId,page.id,result.asset.documentId,compareTrees(proto,psd),{proto,psd});
      }
      const base=generatedBase;
      const componentBindings = new Map(result.componentBindings?.filter(item => !item.canvas).map(item => [item.pageId, item.binding]));
      latest.current.update(document => ({ ...document, pages: document.pages.map(page => {
        if (page.id === pageId) return { ...bindPagePsd(page, current.documentId, result.source, result.asset),
          psdSync: base ?? (pagePsdKey(page.artPsd) === pagePsdKey({ source: result.source, documentId: result.asset.documentId }) ? page.psdSync : undefined) };
        const binding = componentBindings.get(page.id);
        if (!binding || pagePsdKey(page.artPsd) !== pagePsdKey(current.pages.find(item => item.id === page.id)?.artPsd)) return page;
        return { ...page, artPsd: binding, psdSync: undefined };
      }) }));
      for (const id of componentBindings.keys()) retry(id);
      setStates(previous => ({ ...previous, [pageId]: { key: pagePsdKey({ source: result.source, documentId: result.asset.documentId }), status: "ready" } }));
      const count = result.componentBindings?.length ?? 0;
      latest.current.notice((action === "generate" ? "已生成并绑定 PSD：" : "已绑定 PSD：") + result.source +
        (count ? `（含 ${count} 份组件 PSD）` : ""));
    } catch (error) { latest.current.notice(String(error)); }
    finally { actions.current.delete(pageId); if (alive.current) setBusy(previous => { const next = new Set(previous); next.delete(pageId); return next; }); }
  };
  const readyAssets = useMemo(() => Object.fromEntries((document?.pages ?? []).filter(page => page.artPsd && states[page.id]?.key === pagePsdKey(page.artPsd) && states[page.id]?.status === "ready" && assets[page.id]?.documentId === page.artPsd.documentId).map(page => [page.id, assets[page.id]])), [bindingStamp, states, assets]);
  return { states, assets: readyAssets, busy, run, retry };
}
