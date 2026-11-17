import assert from "node:assert/strict";
import { createDefaultGameFlowDocument, parseGameFlowDocument, serializeGameFlowDocument, validateGameFlowDocument } from "../shared/model";
import { isWebviewToHostMessage } from "../shared/protocol";
import type { GameFlowNode, WidgetProps } from "../shared/model";
import { layoutLabel } from "../shared/label-text";
import { parseLabelRuns, parseLabelTemplate, ubbToHtml } from "../shared/label-syntax";
import { resolvePageLayout } from "../shared/ui-layout";
import { isCanvasProperty, writeProperty, nodeProperties } from "../shared/canvas-instance-data";
import type { TextLayout, TextMeasure } from "../shared/label-layout";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { NodeView } from "../webview/editor/node-view";
import { LabelProperties } from "../webview/editor/ui-properties";
import { composeCanvasPage, editCanvasPage, revertCanvasProperties } from "../shared/canvas-instances";
import { readFileSync } from "node:fs";

export const textFormattingTests: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => textFormattingTests.push({ name, run });
const label = (text: string, widget: WidgetProps = {}): GameFlowNode => ({ id: "label", name: "UILabel", type: "text", text, frame: { x: 0, y: 0, width: 100, height: 40 }, style: { fontSize: 20 }, widget });
const mono: TextMeasure = (text, style, scale) => ({ width: [...text].length * style.fontSize * .5 * scale, height: style.fontSize * scale });
const plain = (result: TextLayout) => result.lines.map(line => line.pieces.map(piece => "text" in piece.run ? piece.run.text : "▧").join(""));

test("UILabel syntax runs are literal by default and UBB enables HTML after templates", () => {
  const text = "[b]{name}[/b]<i>X</i>";
  assert.equal((parseLabelRuns(label(text))[0] as { text: string }).text, text);
  const runs = parseLabelRuns(label(text, { ubb: true, templateVars: { name: "[color=#ff0000]甲[/color]" } }));
  assert.deepEqual(runs.map(run => "text" in run ? run.text : ""), ["甲", "X"]);
  assert.equal(runs[0].style.fontWeight, 700); assert.equal(runs[0].style.color, "#ff0000"); assert.equal(runs[1].style.italic, true);
  assert.equal(runs[1].style.fontWeight, 400, "closing nested tags restores the prior style");
});

test("UILabel templates preserve zero false defaults escapes and unfinished syntax", () => {
  assert.equal(parseLabelTemplate("{a}/{b}/{c=默认}/{d}/{}/\\{a}/{unfinished", { a: 0, b: false, c: null }), "0/false/默认//{}/{a}/{unfinished");
  assert.equal(parseLabelTemplate("{outer{inner}}", { inner: "值" }), "}", "the engine scans to the next closing brace without nesting");
  assert.equal(parseLabelTemplate("{toString=默认}", {}), "默认");
  assert.equal((parseLabelRuns(label("a\r\n\rZ", {}))[0] as { text: string }).text, "a\n\nZ");
});

test("UBB uses target handlers and preserves unknown tags and escaped brackets", () => {
  assert.equal(ubbToHtml("[B]A[/B] [s]B[/s] \\[b]C\\[/b] [unfinished"), "<b>A</b> [s]B[/s] [b]C[/b] [unfinished");
  const runs = parseLabelRuns(label("[u][size=30]字[/size][/u][stroke=2,#ff0000]描[/stroke][url=item:42]物品[/url]", { ubb: true }));
  assert.equal(runs[0].style.fontSize, 30); assert.equal(runs[0].style.underline, true);
  assert.equal(runs[1].style.stroke, 2); assert.equal(runs[1].style.strokeColor, "#ff0000");
  assert.equal(runs[2].link, "item:42"); assert.equal(runs[2].style.underline, true);
  assert.equal(runs[2].style.color, "#263244", "bundled engine's linkColor is null");
  assert.equal(ubbToHtml("[url]item:42[/url]"), '<a href="item:42">item:42</a>');
  assert.equal(ubbToHtml("[img]icon.png[/img]"), '<img src="icon.png"/>');
});

test("HTML text entities styles and line breaks are parsed without active markup", () => {
  const runs = parseLabelRuns(label('<b>A<i>B</i>C</b><br/>D &amp; &#x1F600;<script>bad()</script><font face="Other">E</font>', { html: true }));
  assert.equal(runs.map(run => "text" in run ? run.text : "").join(""), "ABC\nD & 😀E");
  assert.equal(runs[1].style.italic, true); assert.equal(runs[2].style.italic, false); assert.equal(runs[2].style.fontWeight, 700);
  assert.throws(() => parseLabelRuns(label('<font size="-2">bad</font>', { html: true })), /字号/);
  assert.throws(() => parseLabelRuns(label('<input type="text"/>', { html: true })), /不支持/);
});

test("UILabel spacing measures Unicode glyphs and negative advances without trailing spacing", () => {
  const positive = layoutLabel(label("A😀B", { letterSpacing: 3 }), null, null, mono);
  assert.equal(positive.width, 36); assert.deepEqual(positive.lines[0].pieces[0].glyphs!.map(g => g.x), [0, 13, 26]);
  const negative = layoutLabel(label("ABC", { letterSpacing: -20 }), null, null, mono);
  assert.equal(negative.width, 30); assert.equal(negative.lines[0].offsetX, -20);
  const lines = layoutLabel(label("A\nB\n", { leading: 5 }), null, null, mono);
  assert.equal(lines.height, 70); assert.deepEqual(lines.lines.map(line => line.y), [0, 25, 50]);
  assert.throws(() => layoutLabel(label("A\nB", { leading: -21 }), null, null, mono), /negative line position/);
});

test("UILabel wrapping keeps words together and splits Chinese and long Unicode words", () => {
  assert.deepEqual(plain(layoutLabel(label("abc def中文😀", { wordWrap: true }), 40, null, mono)), ["abc", "def中", "文😀"]);
  assert.deepEqual(plain(layoutLabel(label("abcdef", { wordWrap: true }), 20, null, mono)), ["ab", "cd", "ef"]);
  assert.deepEqual(plain(layoutLabel(label("abc def中文😀", { wordWrap: false }), 20, null, mono)), ["abc def中文😀"]);
});

test("UILabel overflow clips or scrolls unchanged text and shrinks against both dimensions", () => {
  for (const overflow of ["visible", "hidden", "scroll"] as const) assert.deepEqual(plain(layoutLabel(label("abcdefgh", { overflow, wordWrap: false }), 40, 10, mono)), ["abcdefgh"]);
  const shrunk = layoutLabel(label("abcdefgh", { overflow: "shrink", wordWrap: false }), 40, 8, mono);
  assert.ok(shrunk.scale > .399 && shrunk.scale <= .4); assert.ok(shrunk.width <= 40 && shrunk.height <= 8);
  assert.equal(layoutLabel(label("ab", { overflow: "shrink" }), 100, 100, mono).scale, 1);
});

test("UILabel ellipsis handles horizontal vertical and empty available space", () => {
  assert.deepEqual(plain(layoutLabel(label("abcdefgh", { overflow: "ellipsis", wordWrap: false }), 40, 20, mono)), ["abc…"]);
  assert.deepEqual(plain(layoutLabel(label("abcdef", { overflow: "ellipsis", wordWrap: true }), 30, 20, mono)), ["ab…"]);
  assert.deepEqual(plain(layoutLabel(label("abcdef", { overflow: "ellipsis" }), 5, 20, mono)), [""]);
  assert.deepEqual(plain(layoutLabel(label("abcdef", { overflow: "ellipsis" }), 30, 0, mono)), []);
});

test("UILabel measured dimensions use parsed runs spacing and line leading", () => {
  const node = label("[b]AB[/b]\nC", { ubb: true, leading: 7, letterSpacing: 2, wordWrap: false });
  node.layout = { widthMode: "measured", heightMode: "measured" };
  const page = { id: "p", name: "page", kind: "screen" as const, frame: { x: 0, y: 0, width: 400, height: 600 }, nodes: [node] };
  const result = resolvePageLayout(page); assert.deepEqual(result.issues, []);
  assert.ok(Math.abs(result.nodes.get(node.id)!.local.width - 24.4) < 1e-8); assert.equal(result.nodes.get(node.id)!.local.height, 61);
  node.widget!.leading = -28;
  assert.ok(resolvePageLayout(page).issues.some(issue => issue.nodeId === node.id));
});

test("UILabel new properties survive validation serialization and instance field patches", () => {
  const document = createDefaultGameFlowDocument();
  const node = document.pages[0].nodes[0]; node.type = "text";
  const values: WidgetProps = { leading: -2.5, letterSpacing: 3, html: true, ubb: false, templateVars: { name: "甲", value: 0, enabled: false, empty: null }, overflow: "scroll", scrollX: 5, scrollY: 8 };
  for (const [key, value] of Object.entries(values)) {
    const path = `widget.${key}`; assert.equal(isCanvasProperty(path), true);
    Object.assign(node, writeProperty(node, path, value)); assert.deepEqual(nodeProperties(node)[path], value);
  }
  assert.deepEqual(parseGameFlowDocument(serializeGameFlowDocument(document)), document);
  assert.equal(isWebviewToHostMessage({ type: "replaceDocument", baseVersion: 1, document }), true);
  for (const overflow of ["visible", "hidden", "scroll", "shrink", "ellipsis"] as const) {
    node.widget!.overflow = overflow; assert.equal(validateGameFlowDocument(document).ok, true);
  }
});

test("UILabel invalid spacing syntax variables and scroll offsets are rejected", () => {
  const invalid = { leading: [NaN, Infinity, "2"], letterSpacing: [-Infinity, null], html: [1, "true"], ubb: [null], templateVars: [true, [], "{}", { nested: {} }, { value: Infinity }], overflow: ["auto"], scrollX: [-1, NaN], scrollY: ["0"] };
  for (const [key, values] of Object.entries(invalid)) for (const value of values) {
    const document = createDefaultGameFlowDocument();
    document.pages[0].nodes[0].widget = { [key]: value } as WidgetProps;
    assert.equal(validateGameFlowDocument(document).ok, false, `${key}: ${String(value)}`);
    assert.equal(isWebviewToHostMessage({ type: "replaceDocument", baseVersion: 1, document }), false);
  }
});

test("UILabel instance overrides compose independently and can restore source properties", () => {
  const document = parseGameFlowDocument(readFileSync("sample/canvas-reference-demo.gameflow.json", "utf8"));
  const source = parseGameFlowDocument(readFileSync("sample/shared-components.gameflow.json", "utf8"));
  const sources = { "shared-components.gameflow.json": { source: "shared-components.gameflow.json", document: source } };
  const pageId = document.pages[0].id, composed = composeCanvasPage(document, document.pages[0], sources);
  const [id, meta] = [...composed.info].find(([, info]) => info.ownerId === "demoref1" && info.target.path.at(-1)?.nodeId === "cardtext")!;
  const values: WidgetProps = { leading: 4, letterSpacing: -1, overflow: "ellipsis", ubb: true, html: false, templateVars: { name: "实例文案" } };
  const edited = editCanvasPage(document, pageId, sources, page => ({ ...page, nodes: page.nodes.map(n => n.id === id ? { ...n, widget: { ...n.widget, ...values } } : n) }));
  const saved = parseGameFlowDocument(serializeGameFlowDocument(edited));
  const restored = composeCanvasPage(saved, saved.pages[0], sources);
  for (const [key, value] of Object.entries(values)) assert.deepEqual(restored.page.nodes.find(n => n.id === id)!.widget![key as keyof WidgetProps], value);
  assert.equal(source.pages[0].nodes.find(n => n.id === "cardtext")!.widget?.ubb, undefined);
  const reverted = revertCanvasProperties(saved, "demoref1", meta.target, ["widget.ubb", "widget.templateVars"]);
  const projected = composeCanvasPage(reverted, reverted.pages[0], sources).page.nodes.find(n => n.id === id)!;
  assert.equal(projected.widget?.ubb, undefined); assert.equal(projected.widget?.templateVars, undefined); assert.equal(projected.widget?.leading, 4);
});

test("UILabel view renders controlled rich text scroll offsets and recoverable errors", () => {
  const node = label('[b]AB[/b]<img src="res://icon" width="12" height="14"/>', { ubb: true, overflow: "scroll", scrollX: 5, wordWrap: false });
  node.frame.width = 10;
  const page = { id: "p", name: "page", kind: "screen" as const, frame: { x: 0, y: 0, width: 400, height: 600 }, nodes: [node] };
  const html = renderToStaticMarkup(createElement(NodeView, { page, node }));
  assert.match(html, /font-weight:700/); assert.match(html, /left:-5px/); assert.match(html, /label-inline-image/); assert.doesNotMatch(html, /<img/);
  node.text = '<script>alert(1)</script><font size="-1">bad</font>';
  const bad = renderToStaticMarkup(createElement(NodeView, { page, node }));
  assert.match(bad, /文字排版错误/); assert.doesNotMatch(bad, /<script/);
});

test("UILabel inspector exposes all requested properties and respects locks", () => {
  const html = renderToStaticMarkup(createElement(LabelProperties, { node: label("A", { overflow: "scroll", templateVars: {} }), locked: true, onNode: () => {} }));
  for (const field of ["行距", "字距", "自动换行", "文字溢出", "HTML", "UBB", "模板", "模板变量", "文字滚动 X", "文字滚动 Y"]) assert.ok(html.includes(`aria-label="${field}"`) || html.includes(`>${field}</span>`), field);
  assert.equal((html.match(/<(?:input|select)\b/g) ?? []).length, (html.match(/ disabled=""/g) ?? []).length);
});

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
