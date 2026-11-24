import * as vscode from "vscode";
import { posix, win32 } from "node:path";
import { isPagePsdSource, parseGameFlowDocument, type GameFlowDocument } from "../shared/model";
import { pagePsdKey } from "../shared/page-psd";
import { makePsdDraft } from "../shared/psd-draft";
import { parsePsdBinary } from "../shared/psd-binary";
import { createPsdStructure } from "../shared/psd-structure";
import { applySidecar, sidecarName, type PsdSidecar } from "../shared/psd-meta";
import type { PagePsdRequest, PagePsdResult } from "../shared/page-psd-protocol";
import { bytesHash } from "./psd-document-model";
import type { WorkbenchDocument } from "./workbench-document";
import type { PsdDocument, PsdEditorProvider } from "./psd-editor-provider";
function relativeSource(owner: vscode.Uri, target: vscode.Uri) {
  if (owner.scheme !== target.scheme || owner.authority !== target.authority) throw new Error("PSD 与 GameFlow 必须位于同一文件系统。");
  const windowsFiles = owner.scheme === "file" && /^\/[a-z]:\//i.test(owner.path) && /^\/[a-z]:\//i.test(target.path);
  const source = windowsFiles
    ? win32.relative(win32.dirname(owner.path.slice(1)), target.path.slice(1)).replaceAll("\\", "/")
    : posix.relative(posix.dirname(owner.path), target.path);
  if (!isPagePsdSource(source)) throw new Error("无法保存此 PSD 的相对路径，请选择 GameFlow 同一磁盘中的文件。");
  return source;
}
export function rebasePagePsds(document: GameFlowDocument, from: vscode.Uri, to: vscode.Uri): GameFlowDocument {
  return { ...document, pages: document.pages.map(page => page.artPsd ? { ...page, artPsd: { ...page.artPsd, source: relativeSource(to, vscode.Uri.joinPath(from, "..", page.artPsd.source)) } } : page) };
}
export class PagePsdController {
  private pending = new Map<string, Promise<PsdDocument>>();
  private snapshots = new WeakMap<WorkbenchDocument, Map<string,{stamp:string;draft:ReturnType<typeof makePsdDraft>}>>();
  constructor(
    private readonly psd: PsdEditorProvider,
    private readonly openSlice: (doc: WorkbenchDocument, uri: vscode.Uri, checkBinding: () => void) => Promise<void>
  ) {}
  private async review(doc:WorkbenchDocument, uri:vscode.Uri, expected:string) {
    const name=uri.path.split("/").pop()!;
    const bytes=await vscode.workspace.fs.readFile(uri);
    const hash=bytesHash(bytes);
    let config:Uint8Array|undefined;
    try { config=await vscode.workspace.fs.readFile(vscode.Uri.joinPath(uri,"..",sidecarName(name))); }
    catch(e) { if ((e as {code?:string}).code!=="FileNotFound") throw e; }
    const configHash=config?bytesHash(config):null;
    const live=doc.psds.get(uri.toString())?.model;
    if(live && live.asset.sourceHash===hash && live.configHash===configHash && live.asset.documentId===expected)
      return {bytes,name,draft:makePsdDraft(live.asset)};
    if(live?.dirty) throw new Error("PSD 在外部已变化，当前还有未保存的切图配置。");
    const cache=this.snapshots.get(doc)??new Map();
    this.snapshots.set(doc,cache);
    const stamp=JSON.stringify([hash,configHash,expected]), cached=cache.get(uri.toString());
    if(cached?.stamp===stamp) return {bytes,name,draft:cached.draft};
    let asset=createPsdStructure(parsePsdBinary(bytes),name,hash);
    if(config) {
      const sidecar=JSON.parse(new TextDecoder().decode(config)) as PsdSidecar;
      if(asset.hasEmbeddedIdentity && sidecar.documentId===expected && sidecar.source?.sha256!==hash && Array.isArray(sidecar.layers)) {
        const surviving=new Set(asset.layers.map(l=>l.metadata.layerId));
        asset=applySidecar(asset,{...sidecar,layers:sidecar.layers.filter(l=>surviving.has(l.id))});
      } else asset=applySidecar(asset,sidecar);
    }
    if(asset.documentId!==expected) throw new Error("PSD 身份已变化，请重新绑定页面。");
    const draft=makePsdDraft(asset); cache.set(uri.toString(),{stamp,draft});
    return {bytes,name,draft};
  }
  private async ensure(doc: WorkbenchDocument, uri: vscode.Uri, explicit: boolean): Promise<PsdDocument> {
    const source = uri.toString(), key = doc.uri.toString() + "|" + source;
    const pending = this.pending.get(key); if (pending) return pending;
    const operation = (async () => {
      let model = doc.psds.get(source);
      if (this.psd.documents.has(source) && !model) throw new Error("此 PSD 已在其他工作台或编辑器中打开，请先关闭该会话。");
      const cancellation = new vscode.CancellationTokenSource();
      try {
        if (model) {
          if (bytesHash(await vscode.workspace.fs.readFile(uri)) !== model.model.asset.sourceHash) {
            if (model.model.dirty) throw new Error("PSD 文件已变化且有未保存配置，请先处理 PSD 修改再重新绑定。");
            await this.psd.revertCustomDocument(model, cancellation.token);
          }
        } else {
          if (doc.psds.size >= 32) throw new Error("本工作台已载入 32 份 PSD，请保存并重新打开工作台。");
          model = await this.psd.openCustomDocument(uri, { backupId: undefined, untitledDocumentData: undefined }, cancellation.token, { preview: true, acceptChangedSource: explicit });
          if (doc.disposed) { model.dispose(); throw new Error("工作台已关闭。"); }
          doc.psds.set(source, model);
        }
        if (model.configReadIssue) throw new Error("PSD 配置无法读取：" + model.configReadIssue);
        return model;
      } finally { cancellation.dispose(); }
    })();
    this.pending.set(key, operation);
    try { return await operation; } finally { this.pending.delete(key); }
  }
  async handle(doc: WorkbenchDocument, request: PagePsdRequest): Promise<PagePsdResult> {
    const result: PagePsdResult = { type: "pagePsdResult", requestId: request.requestId };
    let sourceUri: vscode.Uri | undefined;
    try {
      const currentPage = () => {
        const page = parseGameFlowDocument(doc.getText()).pages.find(page => page.id === request.pageId);
        if (!page) throw new Error("目标页面已删除。");
        if (pagePsdKey(page.artPsd) !== pagePsdKey(request.expected)) throw new Error("页面 PSD 关联已变化，请重试。");
        return page;
      };
      const page = currentPage();
      if (request.action==="review") {
        const binding=page.artPsd!, snapshot=await this.review(doc,vscode.Uri.joinPath(doc.uri,"..",binding.source),binding.documentId);
        return {...result,name:snapshot.name,source:binding.source,draft:snapshot.draft,base64:Buffer.from(snapshot.bytes).toString("base64")};
      }
      let uri: vscode.Uri | undefined;
      const boundFile = request.action === "load" || request.action === "slice";
      if (boundFile) uri = vscode.Uri.joinPath(doc.uri, "..", page.artPsd!.source);
      else if (request.action === "choose") uri = (await vscode.window.showOpenDialog({ canSelectMany: false, filters: { Photoshop: ["psd"] }, openLabel: "绑定此页面的 PSD", defaultUri: vscode.Uri.joinPath(doc.uri, "..") }))?.[0];
      else uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.joinPath(doc.uri, "..", request.name!), filters: { Photoshop: ["psd"] }, saveLabel: request.action === "syncCopy" ? "保存同步副本" : "生成并绑定 PSD" });
      if (!uri) return { ...result, cancelled: true };
      sourceUri = uri;
      const source = relativeSource(doc.uri, uri);
      if (request.action === "syncCopy") {
        const input = vscode.Uri.joinPath(doc.uri, "..", page.artPsd!.source);
        const snapshot=await this.review(doc,input,page.artPsd!.documentId);
        if(snapshot.draft.sourceHash!==request.sourceHash || bytesHash(Buffer.from(JSON.stringify(snapshot.draft)))!==request.reviewStamp)
          throw new Error("原 PSD 或配置已变化，请重新比较。");
        const bytes=Buffer.from(request.base64!,"base64");
        const output=createPsdStructure(parsePsdBinary(bytes),request.name!,bytesHash(bytes));
        if(output.documentId!==page.artPsd!.documentId) throw new Error("同步副本的 PSD 身份不匹配。");
        const temporary=vscode.Uri.joinPath(uri,"..","."+crypto.randomUUID()+".sync-tmp");
        try {
          await vscode.workspace.fs.writeFile(temporary,bytes);
          await vscode.workspace.fs.rename(temporary,uri,{overwrite:false});
        } finally {try {await vscode.workspace.fs.delete(temporary);} catch { /* Renamed or absent. */ }}
      } else if (request.action === "generate") {
        const owned = doc.psds.get(uri.toString());
        if (owned?.model.dirty) throw new Error("目标 PSD 有未保存的切图配置，请先保存或放弃修改。");
        if ((this.psd.documents.has(uri.toString()) && this.psd.documents.get(uri.toString()) !== owned) || vscode.workspace.textDocuments.some(text => text.uri.toString() === uri!.toString() && text.isDirty)) throw new Error("目标 PSD 正在其他编辑会话中使用，请先关闭该会话。");
        await vscode.workspace.fs.writeFile(uri, Buffer.from(request.base64!, "base64"));
      }
      const psd = await this.ensure(doc, uri, !boundFile);
      if (boundFile && psd.model.asset.documentId !== page.artPsd!.documentId) throw new Error("PSD 身份与页面关联不一致，请重新绑定。");
      if (request.action === "slice") {
        currentPage();
        await this.openSlice(doc, uri, currentPage);
        return result;
      }
      return { ...result, source, name: uri.path.split("/").pop()!, base64: Buffer.from(psd.bytes).toString("base64"), draft: makePsdDraft(psd.model.asset) };
    } catch (error) { return { ...result, error: error instanceof Error ? error.message : String(error) }; }
    finally {
      // A page preview owns a snapshot, not a persistent editing session.
      const key = sourceUri?.toString(), loaded = key ? doc.psds.get(key) : undefined;
      if (loaded && !loaded.model.dirty && loaded !== doc.currentPsd && !loaded.panels.size) {
        doc.psds.delete(key!);
        loaded.dispose();
      }
    }
  }
}
