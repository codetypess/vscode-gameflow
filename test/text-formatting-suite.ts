import assert from "node:assert/strict";
import { createDefaultGameFlowDocument, parseGameFlowDocument, serializeGameFlowDocument, validateGameFlowDocument } from "../shared/model";
import { isWebviewToHostMessage } from "../shared/protocol";

export const textFormattingTests: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => textFormattingTests.push({ name, run });

test("text formatting combinations and independent alignment axes survive serialization", () => {
  const document = createDefaultGameFlowDocument();
  const node = document.pages[0].nodes[0];
  node.type = "text";
  for (let mask = 0; mask < 16; mask++) {
    for (const textAlign of ["left", "center", "right"] as const) {
      for (const valign of ["top", "middle", "bottom"] as const) {
        node.style = { color: "#123456", fontSize: 18, fontWeight: mask & 1 ? 700 : 400, italic: !!(mask & 2), underline: !!(mask & 4), strikethrough: !!(mask & 8), textAlign };
        node.widget = { wordWrap: true, valign };
        assert.deepEqual(parseGameFlowDocument(serializeGameFlowDocument(document)), document);
      }
    }
  }
  node.style = { fontWeight: 500 };
  const restored = parseGameFlowDocument(serializeGameFlowDocument(document));
  assert.deepEqual(restored.pages[0].nodes[0].style, { fontWeight: 500 }, "old weights and absent optional flags stay intact");
});

test("invalid text style flags are rejected at document and edit-message boundaries", () => {
  for (const key of ["italic", "underline", "strikethrough"] as const) {
    for (const invalid of ["true", 1, null, [], {}]) {
      const document = createDefaultGameFlowDocument();
      const raw = JSON.parse(JSON.stringify(document));
      raw.pages[0].nodes[0].style = { [key]: invalid };
      const result = validateGameFlowDocument(raw);
      assert.equal(result.ok, false);
      assert.ok(result.errors.some(error => error.includes(`style.${key} must be a boolean`)));
      assert.throws(() => parseGameFlowDocument(JSON.stringify(raw)));
      assert.equal(isWebviewToHostMessage({ type: "replaceDocument", baseVersion: 1, document: raw }), false);
    }
  }
});
