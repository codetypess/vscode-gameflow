import * as vscode from "vscode";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CanvasReferenceController } from "../src/canvas-reference-controller";
import { parseGameFlowDocument, serializeGameFlowDocument } from "../shared/model";
import { canvasFingerprint } from "../shared/canvas-instances";
import type { HostToWebviewMessage } from "../shared/protocol";

/** Runs against the actual VS Code text model and native multi-resource history. */
export async function run() {
  const root = process.env.GAMEFLOW_INSTANCE_TEST_ROOT!;
  const report = process.env.GAMEFLOW_INSTANCE_TEST_REPORT!;
  const directory = mkdtempSync(join(tmpdir(), "gameflow-native-instance-"));
  const trace: unknown[] = [];
  let controller: CanvasReferenceController | undefined;
  try {
    const localPath = join(directory,"demo.gameflow.json"), sourcePath = join(directory,"shared-components.gameflow.json");
    writeFileSync(localPath,readFileSync(join(root,"sample/canvas-instance-demo.gameflow.json")));
    writeFileSync(sourcePath,readFileSync(join(root,"sample/shared-components.gameflow.json")));
    const local = await vscode.workspace.openTextDocument(vscode.Uri.file(localPath));
    const source = await vscode.workspace.openTextDocument(vscode.Uri.file(sourcePath));
    const snapshot = (step: string) => trace.push({step,active:vscode.window.activeTextEditor?.document.uri.toString(),localVersion:local.version,sourceVersion:source.version,localLength:local.getText().length,sourceLength:source.getText().length});
    // Native commands run in the workbench; TextDocument notifications cross back
    // to the extension host separately. Observe both model changes before asserting.
    const nativeHistory = async (command: "undo" | "redo", localText: string, sourceText: string) => {
      let complete!: () => void;
      const changed = new Promise<void>(resolve => { complete = resolve; });
      const matches = () => local.getText() === localText && source.getText() === sourceText;
      const subscription = vscode.workspace.onDidChangeTextDocument(() => { if (matches()) complete(); });
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        assert.equal(vscode.window.activeTextEditor?.document.uri.toString(),local.uri.toString(),"native history targets the local editor");
        await vscode.commands.executeCommand(command);
        if (!matches()) await Promise.race([changed,new Promise<never>((_,reject) => {
          timeout=setTimeout(()=>reject(new Error(`${command}: expected document changes were not observed`)),5000);
        })]);
      } finally { subscription.dispose(); if (timeout) clearTimeout(timeout); }
    };
    await vscode.window.showTextDocument(source,{viewColumn:vscode.ViewColumn.Beside});
    await vscode.window.showTextDocument(local,{viewColumn:vscode.ViewColumn.One});
    const originalSource = parseGameFlowDocument(source.getText());
    const dirtySource = {...originalSource,title:"保留源未保存修改"};
    const initial = new vscode.WorkspaceEdit();
    initial.replace(source.uri,new vscode.Range(source.positionAt(0),source.positionAt(source.getText().length)),serializeGameFlowDocument(dirtySource));
    assert.ok(await vscode.workspace.applyEdit(initial));
    const beforeSource=source.getText(),beforeLocal=local.getText();
    const messages: HostToWebviewMessage[]=[];
    controller=new CanvasReferenceController(local,{postMessage:async (message:HostToWebviewMessage)=>{messages.push(message);return true;}} as unknown as vscode.Webview);
    await controller.refresh();
    const expected={"shared-components.gameflow.json":canvasFingerprint(dirtySource)};
    const selected=parseGameFlowDocument(local.getText()).pages[0].nodes.find(n=>n.id==="demoref1")!.instanceEdits!.overrides.map(patch=>({target:patch.target,fields:["text"]}));
    await controller.apply({pageId:"66ht4ruz",ownerId:"demoref1",selections:selected},expected,local.version);
    assert.equal(parseGameFlowDocument(source.getText()).pages[0].nodes.find(n=>n.id==="cardtext")!.text,"A 的本地提示文案");
    assert.equal(parseGameFlowDocument(source.getText()).title,dirtySource.title);
    assert.equal(parseGameFlowDocument(local.getText()).pages[0].nodes.find(n=>n.id==="demoref1")!.instanceEdits!.overrides.length,0);
    assert.equal(source.isDirty,true);
    const appliedSource=source.getText(),appliedLocal=local.getText();
    snapshot("applied");
    await nativeHistory("undo",beforeLocal,beforeSource);
    snapshot("undone");
    assert.equal(source.getText(),beforeSource,"one native undo restores source");
    assert.equal(local.getText(),beforeLocal,"one native undo restores local overrides");
    await nativeHistory("redo",appliedLocal,appliedSource);
    snapshot("redone");
    assert.equal(source.getText(),appliedSource);assert.equal(local.getText(),appliedLocal);
    const after=new vscode.WorkspaceEdit();
    after.insert(local.uri,local.positionAt(local.getText().length),"\n");
    assert.ok(await vscode.workspace.applyEdit(after));
    snapshot("independent edit");
    await nativeHistory("undo",appliedLocal,appliedSource);
    snapshot("independent undo");
    assert.equal(local.getText(),appliedLocal);assert.equal(source.getText(),appliedSource);
    assert.ok(await local.save());assert.ok(await source.save());
    assert.equal(readFileSync(localPath,"utf8"),appliedLocal);assert.equal(readFileSync(sourcePath,"utf8"),appliedSource);
    writeFileSync(report,JSON.stringify({ok:true,checks:["dirty source preservation","cross-file atomic apply","native grouped undo","native grouped redo","subsequent independent undo","save roundtrip"],directory,trace},null,2));
  } catch(error) {
    writeFileSync(report,JSON.stringify({ok:false,error:String(error),stack:error instanceof Error?error.stack:undefined,directory,trace},null,2));
    throw error;
  } finally {controller?.dispose();}
}
