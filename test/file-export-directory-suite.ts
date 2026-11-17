import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EXPORT_DIRECTORY_PATTERN, exportDestination, exportDirectoryError, exportDirectorySegments, normalizeExportDirectory } from "../shared/export-directory";
import { createDefaultGameFlowDocument, parseGameFlowDocument, serializeGameFlowDocument, validateGameFlowDocument } from "../shared/model";
import { isWebviewToHostMessage } from "../shared/protocol";

export const fileExportDirectoryTests = [
  { name: "file export directories normalize input and compose root plus nested relative paths", run() {
    assert.equal(normalizeExportDirectory(" ui\\login "), "ui/login");
    assert.equal(normalizeExportDirectory("  "), undefined);
    for (const value of ["ui/login", "登录界面/按钮", "ui version2/Main", "file.name"]) assert.equal(exportDirectoryError(value), null, value);
    assert.deepEqual(exportDirectorySegments("ui/login"), ["ui", "login"]);
    assert.deepEqual(exportDirectorySegments(), []);
    assert.equal(exportDestination("D:\\assets\\", "ui/login"), "D:\\assets/ui/login");
    assert.equal(exportDestination("/assets/", "ui/login"), "/assets/ui/login");
    assert.equal(exportDestination("D:\\assets"), "D:\\assets");
    assert.equal(exportDestination(undefined, "ui/login"), undefined);
  } },
  { name: "file export directory rejects absolute paths traversal and nonportable segments at every boundary", run() {
    const pattern = new RegExp(JSON.parse(readFileSync("schemas/gameflow.schema.json", "utf8")).properties.exportDirectory.pattern);
    assert.equal(pattern.source, new RegExp(EXPORT_DIRECTORY_PATTERN).source);
    for (const invalid of ["", "/ui", "C:/ui", "\\\\host\\share", "ui\\login", "../other", "ui/../other", "./ui", "ui/./child", "ui//login", "ui/", "ui/name.", "ui/name ", "CON", "ui/nul.png", "LPT1/name", "a?b", "a\nb", "ui/login\n", "ui/login\r", "a".repeat(513), 4, null, [], {}]) {
      const document = { ...createDefaultGameFlowDocument(), exportDirectory: invalid };
      assert.ok(exportDirectoryError(invalid), String(invalid));
      assert.throws(() => exportDirectorySegments(invalid as string));
      assert.equal(validateGameFlowDocument(document).ok, false);
      assert.equal(isWebviewToHostMessage({ type: "replaceDocument", baseVersion: 1, document }), false);
      if (typeof invalid === "string" && invalid.length <= 512) assert.equal(pattern.test(invalid), false, invalid);
    }
  } },
  { name: "each GameFlow persists its own export directory and keeps legacy documents unchanged", run() {
    for (const schemaVersion of [1, 2, 3, 4, 5] as const) {
      const initial = { ...createDefaultGameFlowDocument(), schemaVersion };
      assert.equal(Object.hasOwn(parseGameFlowDocument(serializeGameFlowDocument(initial)), "exportDirectory"), false);
      const first = { ...initial, exportDirectory: "ui/login" }, second = { ...initial, documentId: "other-file", exportDirectory: "ui/inventory" };
      assert.equal(parseGameFlowDocument(serializeGameFlowDocument(first)).exportDirectory, "ui/login");
      assert.equal(parseGameFlowDocument(serializeGameFlowDocument(second)).exportDirectory, "ui/inventory");
      assert.equal(isWebviewToHostMessage({ type: "replaceDocument", baseVersion: 1, document: first }), true);
      const cleared = { ...first, exportDirectory: undefined };
      assert.equal(Object.hasOwn(parseGameFlowDocument(serializeGameFlowDocument(cleared)), "exportDirectory"), false);
      assert.equal(first.exportDirectory, "ui/login");
      assert.equal(second.exportDirectory, "ui/inventory");
    }
  } }
];
