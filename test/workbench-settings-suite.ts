import assert from "node:assert/strict";
import { isWorkbenchSettingsRequest, readExportSettings } from "../shared/workbench-settings";
import { isWebviewToHostMessage } from "../shared/protocol";

export const workbenchSettingsTests = [
  { name: "workbench settings adopt legacy resources only before new settings exist", run() {
    assert.deepEqual(readExportSettings(undefined, "file:///legacy"), { version: 1, resources: "file:///legacy" });
    const stored = { version: 1, resources: "file:///new", prefabs: "file:///prefabs" };
    const read = readExportSettings(stored, "file:///legacy");
    assert.deepEqual(read, stored); read.resources = "file:///mutated";
    assert.equal(stored.resources, "file:///new");
    assert.deepEqual(readExportSettings({ version: 1 }, "file:///legacy"), { version: 1 });
  } },
  { name: "workbench settings reject corrupt or unknown stored fields", run() {
    for (const invalid of [null, [], "path", {}, { version: 2 }, { version: 1, resources: 5 }, { version: 1, prefabs: "" }, { version: 1, path: "arbitrary" }]) assert.throws(() => readExportSettings(invalid), /设置无效/);
  } },
  { name: "workbench settings protocol accepts fixed actions and refuses arbitrary paths", run() {
    const base = { type: "workbenchSettings", requestId: "settings-test" };
    for (const action of [{ action: "read" }, { action: "choose", directory: "resources" }, { action: "clear", directory: "prefabs" }]) {
      assert.equal(isWorkbenchSettingsRequest({ ...base, ...action }), true);
      assert.equal(isWebviewToHostMessage({ ...base, ...action }), true);
    }
    for (const action of [{ action: "read", directory: "resources" }, { action: "choose", directory: "other" }, { action: "write", directory: "resources" }, { action: "choose", directory: "resources", path: "C:/arbitrary" }, { action: "read", command: "run" }]) {
      assert.equal(isWorkbenchSettingsRequest({ ...base, ...action }), false);
      assert.equal(isWebviewToHostMessage({ ...base, ...action }), false);
    }
  } }
];
