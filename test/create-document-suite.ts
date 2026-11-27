import assert from "node:assert/strict";
import { GAMEFLOW_SCHEMA_VERSION, parseGameFlowDocument } from "../shared/model";
import { createGameFlowDocument } from "../src/create-document";
import { referenceHost, Uri } from "./vscode-reference-host";

export const createDocumentTests = [{
  name: "prototype canvases open as independent empty documents with the chosen filename",
  async run() {
    referenceHost.reset();
    const ids = new Set<string>();
    for (const filename of ["商店.v2", "设置.gameflow.json"]) {
      referenceHost.picked = new Uri(`/workspace/${filename}`);
      await createGameFlowDocument("prototype");
      const title = filename.replace(/\.gameflow\.json$/, "");
      const uri = new Uri(`/workspace/${title}.gameflow.json`);
      const saved = parseGameFlowDocument(referenceHost.files.get(uri.path)!.toString());
      assert.equal(saved.title, title);
      assert.equal(saved.schemaVersion, GAMEFLOW_SCHEMA_VERSION);
      assert.equal(saved.elementIdScheme, "nanoid-8");
      assert.deepEqual(saved.requirements, []);
      assert.deepEqual(saved.pages, []);
      assert.deepEqual(saved.interactions, []);
      assert.deepEqual(referenceHost.commands.at(-1), { command: "vscode.openWith", uri, viewType: "gameflow.canvasEditor" });
      ids.add(saved.documentId);
    }
    assert.equal(ids.size, 2);
    assert.equal(referenceHost.files.size, 2);
  }
}, {
  name: "cancelling canvas creation or colliding after suffix completion preserves files and editors",
  async run() {
    referenceHost.reset();
    await createGameFlowDocument("prototype");
    assert.equal(referenceHost.files.size, 0);
    assert.equal(referenceHost.commands.length, 0);

    referenceHost.files.set("/workspace/商店.gameflow.json", "existing");
    referenceHost.picked = new Uri("/workspace/商店");
    await assert.rejects(createGameFlowDocument("prototype"), { code: "FileExists" });
    assert.deepEqual([...referenceHost.files], [["/workspace/商店.gameflow.json", "existing"]]);
    assert.equal(referenceHost.commands.length, 0);
  }
}, {
  name: "the planning canvas command still creates the backpack example",
  async run() {
    referenceHost.reset();
    referenceHost.picked = new Uri("/workspace/策划.gameflow.json");
    await createGameFlowDocument("planning");
    const saved = parseGameFlowDocument(referenceHost.files.get(referenceHost.picked.path)!.toString());
    assert.deepEqual(saved.pages.map(page => page.name), ["主菜单", "背包", "道具详情"]);
  }
}];
