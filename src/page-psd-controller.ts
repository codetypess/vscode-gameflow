import * as vscode from "vscode";
import { posix, win32 } from "node:path";
import { isPagePsdSource, parseGameFlowDocument, serializeGameFlowDocument, type GameFlowDocument } from "../shared/model";
import { pagePsdKey } from "../shared/page-psd";
import { makePsdDraft } from "../shared/psd-draft";
import { parsePsdBinary } from "../shared/psd-binary";
import { createPsdStructure } from "../shared/psd-structure";
import { applySidecar, makeSidecar, sidecarName, type PsdAsset, type PsdSidecar } from "../shared/psd-meta";
import type { ComponentPage, ComponentPsdBinding, PagePsdRequest, PagePsdResult } from "../shared/page-psd-protocol";
import type { CanvasDocumentAccess, CanvasText } from "./canvas-reference-controller";
import { bytesHash } from "./psd-document-model";
import { validPsdFilename } from "../shared/page-psd-protocol";
import type { WorkbenchDocument } from "./workbench-document";
import { atomicWrite } from "./psd-file-io";
import type { PsdDocument, PsdEditorProvider } from "./psd-editor-provider";
type ComponentAccess = CanvasDocumentAccess & { openSource(source: string): Promise<CanvasText> };
function fileKey(uri: vscode.Uri) {
  const path = uri.scheme === "file" && /^\/[a-z]:\//i.test(uri.path) ? uri.path.toLowerCase() : uri.path;
  return JSON.stringify([uri.scheme, uri.authority, path]);
}
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
  private reviewedSources = new WeakMap<WorkbenchDocument, Map<string, vscode.Uri>>();

  private rememberRenderSource(doc: WorkbenchDocument, hash: string, uri: vscode.Uri) {
    const sources = this.reviewedSources.get(doc) ?? new Map<string, vscode.Uri>();
    sources.set(hash, uri);
    this.reviewedSources.set(doc, sources);
  }

  async renderSource(doc: WorkbenchDocument, hash: string) {
    for (const psd of doc.psds.values()) if (psd.model.asset.sourceHash === hash) return psd.bytes;
    const uri = this.reviewedSources.get(doc)?.get(hash);
    return uri && vscode.workspace.fs.readFile(uri);
  }
  private pending = new Map<string, Promise<PsdDocument>>();
  async importSource(doc: WorkbenchDocument, pageId: string) {
    const page = parseGameFlowDocument(doc.getText()).pages.find(item => item.id === pageId);
    if (!page?.psdImportPreview) return;
    const name = page.psdImportPreview.filename ?? page.name + ".psd";
    if (!validPsdFilename(name)) return;
    const uri = vscode.Uri.joinPath(doc.uri, "..", name);
    try {
      if ((await vscode.workspace.fs.stat(uri)).size > 32 * 1024 * 1024) return;
      const bytes = await vscode.workspace.fs.readFile(uri);
      if (bytes.length > 32 * 1024 * 1024) return;
      this.rememberRenderSource(doc, bytesHash(bytes), uri);
      return { name, base64: Buffer.from(bytes).toString("base64") };
    } catch { return; }
  }
  private snapshots = new WeakMap<WorkbenchDocument, Map<string,{stamp:string;draft:ReturnType<typeof makePsdDraft>}>>();
  private overwriting = new Set<string>();
  constructor(
    private readonly psd: PsdEditorProvider,
    private readonly openSlice: (doc: WorkbenchDocument, uri: vscode.Uri, checkBinding: () => void) => Promise<void>
  ) {}
  private async componentPage(doc: WorkbenchDocument, target: ComponentPage, access?: ComponentAccess) {
    const owner = target.canvas ? await access?.openSource(target.canvas) : doc;
    if (!owner) throw new Error("组件画布不可用。");
    const version = owner.version;
    const document = parseGameFlowDocument(owner.getText());
    const page = document.pages.find(item => item.id === target.pageId);
    if (document.documentId !== target.documentId || !page) throw new Error("组件画布已变化，请重新比较。");
    return { owner, version, document, page };
  }
  private async componentSnapshot(owner: CanvasText, binding: NonNullable<GameFlowDocument["pages"][number]["artPsd"]>) {
    const uri = vscode.Uri.joinPath(owner.uri, "..", binding.source);
    const name = posix.basename(uri.path);
    const bytes = await vscode.workspace.fs.readFile(uri);
    const asset = createPsdStructure(parsePsdBinary(bytes), name, bytesHash(bytes));
    if (asset.hasEmbeddedIdentity && asset.documentId !== binding.documentId)
      throw new Error("组件 PSD 身份已变化，请重新绑定。");
    // A regular Photoshop file has no GameFlow identity. Its explicit path owns this binding.
    const draft = makePsdDraft({ ...asset, documentId: binding.documentId, layers: asset.layers.map(layer => ({
      ...layer, metadata: { ...layer.metadata, documentId: binding.documentId },
    })) });
    return { name, bytes, draft };
  }
  private async checkComponents(doc: WorkbenchDocument, request: PagePsdRequest, destination?: vscode.Uri, access?: ComponentAccess) {
    for (const check of request.componentChecks ?? []) {
      const { owner, page } = await this.componentPage(doc, check, access);
      if (pagePsdKey(page.artPsd) !== pagePsdKey(check.binding)) throw new Error("组件 PSD 关联已变化，请重新比较。");
      const uri = vscode.Uri.joinPath(owner.uri, "..", check.binding.source);
      if (destination && fileKey(uri) === fileKey(destination)) throw new Error("请选择与组件源 PSD 不同的保存路径。");
      if (bytesHash(await vscode.workspace.fs.readFile(uri)) !== check.hash)
        throw new Error("组件 PSD 已变化，请重新比较：" + page.name);
    }
  }
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
      return {bytes,name,config,draft:makePsdDraft(live.asset)};
    if(live?.dirty) throw new Error("PSD 在外部已变化，当前还有未保存的切图配置。");
    const cache=this.snapshots.get(doc)??new Map();
    this.snapshots.set(doc,cache);
    const stamp=JSON.stringify([hash,configHash,expected]), cached=cache.get(uri.toString());
    if(cached?.stamp===stamp) return {bytes,name,config,draft:cached.draft};
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
    return {bytes,name,config,draft};
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
  private async overwriteSyncSource(
    doc: WorkbenchDocument, uri: vscode.Uri, bytes: Uint8Array, output: PsdAsset,
    checkSource: () => ReturnType<PagePsdController["review"]>
  ) {
    const key = fileKey(uri);
    if (this.overwriting.has(key)) throw new Error("该 PSD 正在保存同步结果，请重新比较。");
    this.overwriting.add(key);
    try {
      const configUri = vscode.Uri.joinPath(uri, "..", sidecarName(output.name));
      const configKey = fileKey(configUri);
      const checkSessions = () => {
        const open = [...this.psd.documents.values()].find(psd => fileKey(psd.uri) === key);
        if (open && doc.psds.get(open.uri.toString()) !== open) throw new Error("此 PSD 正在其他编辑器中打开，请关闭该会话或另存。");
        if (open?.model.dirty || vscode.workspace.textDocuments.some(text =>
          text.isDirty && [key, configKey].includes(fileKey(text.uri))))
          throw new Error("PSD 或切图配置有未保存修改，请保存后重新比较。");
        return open;
      };
      const open = checkSessions();
      if (open) await this.psd.flush(open);
      const snapshot = await checkSource();
      const configHash = snapshot.config && bytesHash(snapshot.config);
      const config = snapshot.config && new TextEncoder().encode(JSON.stringify(makeSidecar(output), null, 2) + "\n");
      if (config && config.length > 1024 * 1024) throw new Error("PSD 配置超过 1 MB。");
      await atomicWrite(uri, bytes, async () => {
        const current = await checkSource();
        if ((current.config && bytesHash(current.config)) !== configHash)
          throw new Error("切图配置已变化，请重新比较。");
        checkSessions();
      });
      if (config) {
        try {
          await atomicWrite(configUri, config, async () => {
            const current = await vscode.workspace.fs.readFile(configUri);
            if (bytesHash(current) !== configHash) throw new Error("切图配置已变化，请重新比较。");
            checkSessions();
          });
        }
        catch (error) {
          try {
            await atomicWrite(uri, snapshot.bytes, async () => {
              if (bytesHash(await vscode.workspace.fs.readFile(uri)) !== output.sourceHash)
                throw new Error("原文件在保存期间已被其他编辑器修改。");
            });
          } catch (rollback) {
            throw new Error(`切图配置保存失败（${String(error)}），恢复原 PSD 失败（${String(rollback)}）。`);
          }
          throw error;
        }
      }
      if (open && !open.disposed && !open.model.dirty) {
        const cancellation = new vscode.CancellationTokenSource();
        try { await this.psd.revertCustomDocument(open, cancellation.token); }
        finally { cancellation.dispose(); }
      }
      return makePsdDraft(output);
    } finally {
      this.overwriting.delete(key);
    }
  }
  private async saveSyncCopy(doc: WorkbenchDocument, request: PagePsdRequest, checkBinding: () => void, access?: ComponentAccess) {
    const binding = request.expected!;
    const name = request.name!;
    const input = vscode.Uri.joinPath(doc.uri, "..", binding.source);
    const bytes = Buffer.from(request.base64!, "base64");
    const output = createPsdStructure(parsePsdBinary(bytes), name, bytesHash(bytes));
    if (output.documentId !== binding.documentId) throw new Error("同步副本的 PSD 身份不匹配。");
    const version = doc.version;
    const checkSource = async () => {
      const snapshot = await this.review(doc, input, binding.documentId);
      await this.checkComponents(doc, request, input, access);
      checkBinding();
      if (doc.disposed || doc.version !== version || snapshot.draft.sourceHash !== request.sourceHash ||
        bytesHash(Buffer.from(JSON.stringify(snapshot.draft))) !== request.reviewStamp)
        throw new Error("原型、PSD 或切图配置已变化，请重新比较。");
      return snapshot;
    };
    let defaultUri = input;
    for (;;) {
      const uri = await vscode.window.showSaveDialog({ defaultUri, filters: { Photoshop: ["psd"] }, saveLabel: "保存同步结果" });
      if (!uri) return;
      const source = relativeSource(doc.uri, uri);
      if (fileKey(uri) === fileKey(input)) {
        const draft = await this.overwriteSyncSource(doc, input, bytes, { ...output, name: posix.basename(input.path) }, checkSource);
        return { uri: input, source: binding.source, draft };
      }
      await checkSource();
      await this.checkComponents(doc, request, uri, access);

      const temporary = vscode.Uri.joinPath(uri, "..", "." + crypto.randomUUID() + ".sync-tmp");
      try {
        await vscode.workspace.fs.writeFile(temporary, bytes);
        try {
          await checkSource();
          await vscode.workspace.fs.rename(temporary, uri, { overwrite: false });
          return { uri, source };
        } catch (error) {
          if (!(error instanceof vscode.FileSystemError && error.code === "FileExists")) throw error;
        }
      } finally {
        try { await vscode.workspace.fs.delete(temporary); } catch { /* Renamed or absent. */ }
      }

      const pickAnother = "另选文件";
      const choice = await vscode.window.showWarningMessage(
        `「${posix.basename(uri.path)}」已存在。请使用新的文件名保存 PSD 同步副本。`,
        { modal: true }, pickAnother
      );
      if (choice !== pickAnother) return;
      defaultUri = vscode.Uri.joinPath(uri, "..", name);
    }
  }
  async handle(doc: WorkbenchDocument, request: PagePsdRequest, access?: ComponentAccess): Promise<PagePsdResult> {
    const result: PagePsdResult = { type: "pagePsdResult", requestId: request.requestId };
    let sourceUri: vscode.Uri | undefined;
    let generationLock: string | undefined;
    let replaced: { uri: vscode.Uri; hash: string; previous?: Uint8Array } | undefined;
    const created = new Map<vscode.Uri, string>();
    try {
      const version = doc.version;
      const component = request.component && await this.componentPage(doc, request.component, access);
      const owner = component ? component.owner : doc;
      const currentPage = () => {
        const page = parseGameFlowDocument(owner.getText()).pages.find(page => page.id === request.pageId);
        if (!page) throw new Error("目标页面已删除。");
        if (pagePsdKey(page.artPsd) !== pagePsdKey(request.expected)) throw new Error("页面 PSD 关联已变化，请重试。");
        return page;
      };
      const page = currentPage();
      if (request.action==="review") {
        const binding=page.artPsd!, snapshot=component ? await this.componentSnapshot(owner, binding)
          : await this.review(doc,vscode.Uri.joinPath(owner.uri,"..",binding.source),binding.documentId);
        currentPage();
        this.rememberRenderSource(doc, snapshot.draft.sourceHash, vscode.Uri.joinPath(owner.uri, "..", binding.source));
        return {...result,sourceUri:vscode.Uri.joinPath(owner.uri, "..", binding.source).toString(),name:snapshot.name,source:binding.source,draft:snapshot.draft,base64:Buffer.from(snapshot.bytes).toString("base64")};
      }
      let uri: vscode.Uri | undefined;
      let source: string | undefined;
      const boundFile = request.action === "load" || request.action === "slice";
      if (request.action === "syncCopy") {
        const copy = await this.saveSyncCopy(doc, request, currentPage, access);
        if (!copy) return { ...result, cancelled: true };
        if (copy.draft) {
          this.rememberRenderSource(doc, copy.draft.sourceHash, copy.uri);
          return { ...result, sourceUri: copy.uri.toString(), source: copy.source, name: posix.basename(copy.uri.path), base64: request.base64, draft: copy.draft };
        }
        ({ uri, source } = copy);
      } else if (boundFile) uri = vscode.Uri.joinPath(doc.uri, "..", page.artPsd!.source);
      else if (request.action === "choose") uri = (await vscode.window.showOpenDialog({ canSelectMany: false, filters: { Photoshop: ["psd"] }, openLabel: "绑定此页面的 PSD", defaultUri: vscode.Uri.joinPath(doc.uri, "..") }))?.[0];
      else uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.joinPath(doc.uri, "..", request.name!), filters: { Photoshop: ["psd"] }, saveLabel: "生成并绑定 PSD" });
      if (!uri) return { ...result, cancelled: true };
      sourceUri = uri;
      source ??= relativeSource(doc.uri, uri);
      const componentBindings: ComponentPsdBinding[] = [];
      const external = new Map<CanvasText, { document: CanvasText; version: number; draft: GameFlowDocument }>();
      if (request.action === "generate") {
        if (doc.disposed || doc.version !== version) throw new Error("画布已变化，请重新生成 PSD。");
        const key = fileKey(uri);
        if (this.overwriting.has(key)) throw new Error("该 PSD 正在保存，请重新生成。");
        this.overwriting.add(key);
        generationLock = key;
        await this.checkComponents(doc, request, uri, access);
        const targets = new Set<string>();
        for (const output of request.componentOutputs ?? []) {
          const target = await this.componentPage(doc, output, access);
          const key = JSON.stringify([fileKey(target.owner.uri), target.page.id]);
          if (target.page.id === page.id && target.owner === doc || target.page.artPsd || targets.has(key))
            throw new Error("组件 PSD 关联已变化，请重新生成。");
          targets.add(key);
          const ownerStat = target.owner === doc ? undefined : await vscode.workspace.fs.stat(target.owner.uri);
          if (ownerStat?.permissions && (ownerStat.permissions & vscode.FilePermission.Readonly) ||
              vscode.workspace.fs.isWritableFileSystem(target.owner.uri.scheme) === false)
            throw new Error("组件画布为只读文件：" + target.page.name);
          const bytes = Buffer.from(output.base64, "base64"), hash = bytesHash(bytes);
          const structure = createPsdStructure(parsePsdBinary(bytes), output.name, hash);
          if (!structure.hasEmbeddedIdentity) throw new Error("生成的组件 PSD 缺少文档身份。");
          const stem = output.name.slice(0, -4);
          let componentUri: vscode.Uri | undefined;
          for (let attempt = 0; attempt < 100 && !componentUri; attempt++) {
            const name = attempt ? `${stem.slice(0, 140)}-${attempt + 1}.psd` : output.name;
            const candidate = vscode.Uri.joinPath(target.owner.uri, "..", name);
            if (fileKey(candidate) === fileKey(uri) || [...this.psd.documents.values()].some(item => fileKey(item.uri) === fileKey(candidate))) continue;
            try {
              await atomicWrite(candidate, bytes, undefined, false);
              componentUri = candidate;
              created.set(candidate, hash);
            } catch (error) {
              if (!(error instanceof vscode.FileSystemError && error.code === "FileExists")) throw error;
            }
          }
          if (!componentUri) throw new Error("找不到可用的组件 PSD 文件名：" + output.name);
          const binding = { documentId: structure.documentId, source: relativeSource(target.owner.uri, componentUri) };
          componentBindings.push({ canvas: output.canvas, documentId: output.documentId, pageId: output.pageId, binding });
          if (target.owner !== doc) {
            const pending = external.get(target.owner) ?? { document: target.owner, version: target.version, draft: target.document };
            pending.draft = { ...pending.draft, pages: pending.draft.pages.map(item => item.id === target.page.id ? { ...item, artPsd: binding } : item) };
            external.set(target.owner, pending);
          }
        }
        const owned = doc.psds.get(uri.toString());
        if (owned?.model.dirty) throw new Error("目标 PSD 有未保存的切图配置，请先保存或放弃修改。");
        if ((this.psd.documents.has(uri.toString()) && this.psd.documents.get(uri.toString()) !== owned) || vscode.workspace.textDocuments.some(text => text.uri.toString() === uri!.toString() && text.isDirty)) throw new Error("目标 PSD 正在其他编辑会话中使用，请先关闭该会话。");
        const bytes = Buffer.from(request.base64!, "base64");
        let previous: Uint8Array | undefined;
        await atomicWrite(uri, bytes, async () => {
          await this.checkComponents(doc, request, uri, access);
          currentPage();
          if (doc.disposed || doc.version !== version) throw new Error("画布已变化，请重新生成 PSD。");
          if ([...external.values()].some(item => item.document.version !== item.version))
            throw new Error("组件画布已变化，请重新生成 PSD。");
          if (created.size) {
            try { previous = await vscode.workspace.fs.readFile(uri); }
            catch (error) { if ((error as { code?: string }).code !== "FileNotFound") throw error; }
          }
        });
        if (created.size) replaced = { uri, hash: bytesHash(bytes), previous };
      }
      const psd = await this.ensure(doc, uri, !boundFile);
      if (boundFile && psd.model.asset.documentId !== page.artPsd!.documentId) throw new Error("PSD 身份与页面关联不一致，请重新绑定。");
      if (request.action === "slice") {
        currentPage();
        await this.openSlice(doc, uri, currentPage);
        return result;
      }
      if (external.size) await access!.apply([...external.values()].map(item => ({
        document: item.document, version: item.version, text: serializeGameFlowDocument(item.draft),
      })));
      created.clear();
      this.rememberRenderSource(doc, psd.model.asset.sourceHash, uri);
      return { ...result, sourceUri: uri.toString(), source, name: uri.path.split("/").pop()!, base64: Buffer.from(psd.bytes).toString("base64"),
        draft: makePsdDraft(psd.model.asset), componentBindings };
    } catch (error) {
      let rollbackIssue = "";
      if (replaced) {
        try {
          const { uri, hash, previous } = replaced;
          const verify = async () => {
            if (bytesHash(await vscode.workspace.fs.readFile(uri)) !== hash) throw new Error("页面 PSD 在保存期间已被修改。");
          };
          if (previous) await atomicWrite(uri, previous, verify);
          else { await verify(); await vscode.workspace.fs.delete(uri); }
        } catch (rollback) { rollbackIssue = "。恢复页面 PSD 失败：" + String(rollback); }
      }
      for (const [uri, hash] of created) {
        try { if (bytesHash(await vscode.workspace.fs.readFile(uri)) === hash) await vscode.workspace.fs.delete(uri); }
        catch { /* A moved or separately edited component file belongs to its current owner. */ }
      }
      return { ...result, error: (error instanceof Error ? error.message : String(error)) + rollbackIssue };
    }
    finally {
      if (generationLock) this.overwriting.delete(generationLock);
      // A page preview owns a snapshot, not a persistent editing session.
      const key = sourceUri?.toString(), loaded = key ? doc.psds.get(key) : undefined;
      if (loaded && !loaded.model.dirty && loaded !== doc.currentPsd && !loaded.panels.size) {
        doc.psds.delete(key!);
        loaded.dispose();
      }
    }
  }
}
