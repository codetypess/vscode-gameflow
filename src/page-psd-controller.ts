import * as vscode from "vscode";
import { posix } from "node:path";
import { isPagePsdSource, parseGameFlowDocument, type GameFlowDocument } from "../shared/model";
import { pagePsdKey } from "../shared/page-psd";
import { makePsdDraft } from "../shared/psd-draft";
import type { PagePsdRequest, PagePsdResult } from "../shared/page-psd-protocol";
import { bytesHash } from "./psd-document-model";
import type { WorkbenchDocument } from "./workbench-document";
import type { PsdDocument, PsdEditorProvider } from "./psd-editor-provider";
function relativeSource(owner: vscode.Uri, target: vscode.Uri) {
  if (owner.scheme !== target.scheme || owner.authority !== target.authority) throw new Error("PSD 与 GameFlow 必须位于同一文件系统。");
  const source = posix.relative(posix.dirname(owner.path), target.path);
  if (!isPagePsdSource(source)) throw new Error("无法保存此 PSD 的相对路径，请选择 GameFlow 同一磁盘中的文件。");
  return source;
}
export function rebasePagePsds(document: GameFlowDocument, from: vscode.Uri, to: vscode.Uri): GameFlowDocument {
  return { ...document, pages: document.pages.map(page => page.artPsd ? { ...page, artPsd: { ...page.artPsd, source: relativeSource(to, vscode.Uri.joinPath(from, "..", page.artPsd.source)) } } : page) };
}
export class PagePsdController {
  private pending = new Map<string, Promise<PsdDocument>>();
  constructor(private readonly psd: PsdEditorProvider) {}
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
    try {
      const page = parseGameFlowDocument(doc.getText()).pages.find(page => page.id === request.pageId);
      if (!page) throw new Error("目标页面已删除。");
      if (pagePsdKey(page.artPsd) !== pagePsdKey(request.expected)) throw new Error("页面 PSD 关联已变化，请重试。");
      let uri: vscode.Uri | undefined;
      if (request.action === "load") uri = vscode.Uri.joinPath(doc.uri, "..", page.artPsd!.source);
      else if (request.action === "choose") uri = (await vscode.window.showOpenDialog({ canSelectMany: false, filters: { Photoshop: ["psd"] }, openLabel: "绑定此页面的 PSD", defaultUri: vscode.Uri.joinPath(doc.uri, "..") }))?.[0];
      else uri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.joinPath(doc.uri, "..", request.name!), filters: { Photoshop: ["psd"] }, saveLabel: "生成并绑定 PSD" });
      if (!uri) return { ...result, cancelled: true };
      const source = relativeSource(doc.uri, uri);
      if (request.action === "generate") {
        if (this.psd.documents.has(uri.toString()) || vscode.workspace.textDocuments.some(text => text.uri.toString() === uri!.toString() && text.isDirty)) throw new Error("目标 PSD 正在使用，请选择其他文件名。");
        await vscode.workspace.fs.writeFile(uri, Buffer.from(request.base64!, "base64"));
      }
      const psd = await this.ensure(doc, uri, request.action !== "load");
      if (request.action === "load" && psd.model.asset.documentId !== page.artPsd!.documentId) throw new Error("PSD 身份与页面关联不一致，请重新绑定。");
      return { ...result, source, name: uri.path.split("/").pop()!, base64: Buffer.from(psd.bytes).toString("base64"), draft: makePsdDraft(psd.model.asset) };
    } catch (error) { return { ...result, error: error instanceof Error ? error.message : String(error) }; }
  }
}
