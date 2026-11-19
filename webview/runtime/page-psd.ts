import { useEffect, useMemo, useRef, useState } from "react";
import type { GameFlowDocument, GameFlowPage } from "../../shared/model";
import { bindPagePsd, pagePsdKey } from "../../shared/page-psd";
import type { PsdAsset } from "../../shared/psd-meta";
import { applyPsdDraft } from "../../shared/psd-draft";
import type { PagePsdRequest, PagePsdResult } from "../../shared/page-psd-protocol";
import { prefabFileName } from "../../shared/prefab-export";
import { openPsd, psdTask, saveOutput } from "../psd/io";
import { isBrowserPreview, postHostMessage } from "../vscode-api";
export type PagePsdState = { key: string; status: "loading" | "ready" | "error"; error?: string };
export interface PagePsdActions {
  states: Record<string, PagePsdState>;
  assets: Record<string, PsdAsset>;
  busy: ReadonlySet<string>;
  run(pageId: string, action: "choose" | "generate"): Promise<void>;
  retry(pageId: string): void;
}
const browserAssets = new Map<string, PsdAsset>();
function chooseFile(): Promise<File | undefined> {
  return new Promise(resolve => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".psd";
    input.onchange = () => resolve(input.files?.[0]); input.oncancel = () => resolve(undefined); input.click();
  });
}
async function requestPsd(request: Omit<PagePsdRequest, "type" | "requestId">, bytes?: Uint8Array): Promise<{ source: string; asset: PsdAsset } | undefined> {
  if (isBrowserPreview) {
    if (request.action === "load") {
      const asset = browserAssets.get(request.pageId + ":" + pagePsdKey(request.expected));
      if (!asset) throw new Error("浏览器刷新后需重新选择本地 PSD；请点击重新绑定 PSD。");
      return { source: request.expected!.source, asset };
    }
    let asset: PsdAsset, source: string;
    if (request.action === "choose") { const file = await chooseFile(); if (!file) return; asset = (await openPsd(file)).asset; source = file.name; }
    else { if (!await saveOutput(request.name!, "psd", bytes!)) return; source = request.name!; asset = await psdTask<PsdAsset>("read", new Uint8Array(bytes!).buffer, source); }
    browserAssets.set(request.pageId + ":" + pagePsdKey({ source, documentId: asset.documentId }), asset);
    return { source, asset };
  }
  let payload = ""; if (bytes) for (let i = 0; i < bytes.length; i += 8192) payload += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const requestId = crypto.randomUUID();
  const result = await new Promise<PagePsdResult>((resolve, reject) => {
    const timer = window.setTimeout(() => { window.removeEventListener("message", receive); reject(new Error("PSD 请求超时，请重试。")); }, 180000);
    const receive = ({ data }: MessageEvent<PagePsdResult>) => { if (data?.type !== "pagePsdResult" || data.requestId !== requestId) return; window.clearTimeout(timer); window.removeEventListener("message", receive); resolve(data); };
    window.addEventListener("message", receive);
    postHostMessage({ ...request, type: "pagePsd", requestId, ...(bytes ? { base64: btoa(payload) } : {}) });
  });
  if (result.error) throw new Error(result.error);
  if (result.cancelled) return;
  if (!result.base64 || !result.source || !result.name || !result.draft) throw new Error("PSD 返回数据不完整。");
  const decoded = Uint8Array.from(atob(result.base64), c => c.charCodeAt(0));
  const asset = applyPsdDraft(await psdTask<PsdAsset>("read", decoded.buffer, result.name), result.draft, true);
  return { source: result.source, asset };
}
export function usePagePsds(document: GameFlowDocument | null, read: () => GameFlowDocument | null, update: (id: string, transform: (page: GameFlowPage) => GameFlowPage) => void, observe: (asset: PsdAsset) => void, notice: (message: string) => void, project: (document: GameFlowDocument, page: GameFlowPage) => GameFlowPage = (_, page) => page): PagePsdActions {
  const [assets, setAssets] = useState<Record<string, PsdAsset>>({});
  const [states, setStates] = useState<Record<string, PagePsdState>>({}), [busy, setBusy] = useState<Set<string>>(new Set()), [revision, bump] = useState(0);
  const latest = useRef({ read, update, observe, notice, project }); latest.current = { read, update, observe, notice, project };
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
    if (!current || !page || actions.current.has(pageId)) return;
    const token = {}, expected = pagePsdKey(page.artPsd); actions.current.set(pageId, token);
    setBusy(previous => new Set(previous).add(pageId));
    try {
      const bytes = action === "generate" ? await (await import("./prototype-psd")).generatePrototypePsd(current, latest.current.project(current, page)) : undefined;
      const result = await requestPsd({ pageId, action, expected: page.artPsd, name: prefabFileName(page).replace(/\.lh$/, ".psd") }, bytes);
      if (!result || !alive.current || actions.current.get(pageId) !== token) return;
      const now = latest.current.read(), target = now?.pages.find(page => page.id === pageId);
      if (now?.documentId !== current.documentId || !target || pagePsdKey(target.artPsd) !== expected) { latest.current.notice("页面关联已变化，本次结果未应用。"); return; }
      // Validate mappings before applying one atomic edit.
      bindPagePsd(target, current.documentId, result.source, result.asset);
      latest.current.observe(result.asset);
      setAssets(previous => ({ ...previous, [pageId]: result.asset }));
      loads.current.set(pageId, { key: current.documentId + pagePsdKey({ source: result.source, documentId: result.asset.documentId }), token });
      latest.current.update(pageId, page => bindPagePsd(page, current.documentId, result.source, result.asset));
      setStates(previous => ({ ...previous, [pageId]: { key: pagePsdKey({ source: result.source, documentId: result.asset.documentId }), status: "ready" } }));
      latest.current.notice((action === "generate" ? "已生成并绑定 PSD：" : "已绑定 PSD：") + result.source);
    } catch (error) { latest.current.notice(String(error)); }
    finally { actions.current.delete(pageId); if (alive.current) setBusy(previous => { const next = new Set(previous); next.delete(pageId); return next; }); }
  };
  const readyAssets = useMemo(() => Object.fromEntries((document?.pages ?? []).filter(page => page.artPsd && states[page.id]?.key === pagePsdKey(page.artPsd) && states[page.id]?.status === "ready" && assets[page.id]?.documentId === page.artPsd.documentId).map(page => [page.id, assets[page.id]])), [bindingStamp, states, assets]);
  return { states, assets: readyAssets, busy, run, retry };
}
