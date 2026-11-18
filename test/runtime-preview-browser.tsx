import { useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { generateSliceProducts, renderSliceExportBatch } from "../webview/psd/slice-render";
import { paintSlice } from "../webview/runtime/paint-slice";
import { useRuntimeResources } from "../webview/runtime/resources";
import { SliceResourcesProvider } from "../webview/runtime/resource-context";
import { RuntimePreview } from "../webview/runtime/preview";
import { NodeView } from "../webview/editor/node-view";
import type { RuntimeResource } from "../webview/runtime/resource-context";
import type { PsdAsset } from "../shared/psd-meta";
import type { GameFlowPage } from "../shared/model";
import "../webview/style.css";

const source = document.createElement("canvas"); source.width = source.height = 6;
const ctx = source.getContext("2d")!;
const colors = ["#ff0000", "#ff00ff", "#00ff00", "#00ffff", "#000000", "#00ffff", "#0000ff", "#ff00ff", "#ffff00"];
for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) { ctx.fillStyle = colors[y * 3 + x]; ctx.fillRect(x * 2, y * 2, 2, 2); }
ctx.fillStyle = "#ffffff"; ctx.fillRect(3, 2, 1, 1); ctx.fillRect(2, 3, 1, 1);
const asset: PsdAsset = { documentId: "test-psd", name: "预览.psd", sourceHash: "a".repeat(64), hasEmbeddedIdentity: true, width: 6, height: 6, preview: source.toDataURL(), layers: [{ key: 0, parentKey: null, nativeId: 1, name: "按钮", group: false, left: 0, top: 0, width: 6, height: 6, hidden: false, identityOrigin: "embedded", metadata: { namespace: "com.codetypes.gameflow", version: 1, documentId: "test-psd", layerId: "test-layer" }, image: source.toDataURL(), config: { enabled: true, name: "按钮", exportName: "btn_test", nineGrid: { left: 3, right: 3, top: 3, bottom: 3, repeat: true }, region: { x: -1, y: -1, width: 8, height: 8 } } }] };
const page: GameFlowPage = { id: "preview-page", name: "切图装载验收", kind: "screen", frame: { x: 0, y: 0, width: 240, height: 200 }, nodes: [
  { id: "image", name: "九宫格按钮", type: "image", frame: { x: 20, y: 20, width: 100, height: 60 }, style: { fill: "transparent", borderWidth: 0, radius: 0 }, sliceResource: { path: "unclassified/btn_test.png", source: { documentId: "test-psd", layerId: "test-layer" } } },
  { id: "check", name: "选择", type: "checkbox", text: "临时复选", frame: { x: 20, y: 100, width: 100, height: 30 }, widget: { selected: false } },
  { id: "slider", name: "滑块", type: "slider", frame: { x: 20, y: 150, width: 180, height: 20 }, widget: { min: 0, max: 100, value: 20 } }
] };
const readPixel = (canvas: HTMLCanvasElement, x: number, y: number) => [...canvas.getContext("2d")!.getImageData(x, y, 1, 1).data].join(",");
const equal = (actual: unknown, expected: unknown) => { if (actual !== expected) throw new Error(`expected ${expected}, got ${actual}`); };
async function checkPixels() {
  const results: string[] = [], products = await generateSliceProducts(asset), product = products.get(0)!;
  if (product.status !== "ready") throw new Error("生成失败");
  equal(product.pixels.width, 8); equal(product.pixels.height, 8); equal(readPixel(product.pixels, 0, 0), "0,0,0,0"); equal(readPixel(product.pixels, 1, 1), "255,0,0,255"); equal(readPixel(product.pixels, 3, 3), "0,0,0,255");
  results.push("PASS 内存区域真实像素、透明边与产物尺寸");
  const output = document.createElement("canvas");
  paintSlice(output, product.pixels, product.description, 12, 10);
  for (const [x, y, expected] of [[1, 1, "255,0,0,255"], [10, 1, "0,255,0,255"], [1, 8, "0,0,255,255"], [10, 8, "255,255,0,255"], [3, 3, "0,0,0,255"], [4, 3, "255,255,255,255"], [5, 3, "0,0,0,255"], [3, 4, "255,255,255,255"], [11, 0, "0,0,0,0"]] as const) equal(readPixel(output, x, y), expected);
  results.push("PASS 切后九宫格双轴重建、独立角部与重复周期");
  const plainAsset = { ...asset, documentId: "tiny-source", layers: [{ ...asset.layers[0], config: { ...asset.layers[0].config, region: undefined, nineGrid: { left: 2, right: 2, top: 2, bottom: 2, repeat: false } } }] };
  const small = (await generateSliceProducts(plainAsset)).get(0)!;
  if (small.status !== "ready") throw new Error("小图生成失败");
  paintSlice(output, small.pixels, small.description, 1, 1); equal(output.width, 1); equal(output.height, 1); equal(readPixel(output, 0, 0), "255,0,0,255");
  results.push("PASS 小尺寸按 Laya 前侧优先规则绘制，没有放大目标");
  const batch = await renderSliceExportBatch(asset), exported = new Image(); exported.src = `data:image/png;base64,${batch.items[0].base64}`; await exported.decode();
  const decoded = document.createElement("canvas"); decoded.width = exported.width; decoded.height = exported.height; decoded.getContext("2d")!.drawImage(exported, 0, 0);
  equal([...decoded.getContext("2d")!.getImageData(0, 0, 8, 8).data].join(), [...product.pixels.getContext("2d")!.getImageData(0, 0, 8, 8).data].join());
  equal(batch.items[0].nineGrid!.left, 3); results.push("PASS 正式 PNG 与预览共用产物，全部像素和九宫格描述一致");
  const strip = document.createElement("canvas"); strip.width = 30; strip.height = 14;
  const stripCtx = strip.getContext("2d")!;
  for (let y = 0; y < 14; y++) {
    stripCtx.fillStyle = `rgb(${y * 16}, 32, 64)`; stripCtx.fillRect(0, y, 30, 1);
  }
  stripCtx.fillStyle = "#ff0000"; stripCtx.fillRect(1, 0, 2, 14);
  stripCtx.fillStyle = "#00ff00"; stripCtx.fillRect(27, 0, 3, 14);
  const compactAsset = { ...asset, documentId: "compact-source", sourceHash: "c".repeat(64), width: 30, height: 14,
    layers: [{ ...asset.layers[0], width: 30, height: 14, image: strip.toDataURL(), config: { ...asset.layers[0].config,
      nineGrid: { left: 4, right: 3, top: 2, bottom: 2, repeat: false }, region: { x: -1, y: 0, width: 31, height: 14 } } }] };
  const compact = (await generateSliceProducts(compactAsset)).get(0)!;
  if (compact.status !== "ready") throw new Error(compact.status === "error" ? compact.error : "未生成");
  // The transparent left padding and the entire right strip survive. The gradient only allows horizontal shortening.
  equal(compact.pixels.width, 15); equal(compact.pixels.height, 14);
  equal(readPixel(compact.pixels, 0, 4), "0,0,0,0"); equal(readPixel(compact.pixels, 14, 4), "0,255,0,255");
  for (const width of [31, 51]) {
    paintSlice(output, compact.pixels, compact.description, width, 14);
    for (let y = 0; y < 14; y++) for (let x = 0; x < width; x++) {
      const expected = x === 0 ? "0,0,0,0" : x === 2 || x === 3 ? "255,0,0,255" : x >= width - 3 ? "0,255,0,255" : `${y * 16},32,64,255`;
      equal(readPixel(output, x, y), expected);
    }
  }
  const compactBatch = (await renderSliceExportBatch(compactAsset)).items[0];
  const compactPng = new Image(); compactPng.src = `data:image/png;base64,${compactBatch.base64}`; await compactPng.decode();
  equal(compactPng.width, 15); equal(compactBatch.width, 15); equal(compactBatch.nineGrid!.right, 3); equal(compactBatch.logicalSize!.width, 31);
  paintSlice(decoded, compactPng, compactBatch, 51, 14);
  equal(decoded.getContext("2d")!.getImageData(0, 0, 51, 14).data.join(), output.getContext("2d")!.getImageData(0, 0, 51, 14).data.join());
  results.push("PASS 九宫格单轴缩减，透明边及渐变保留，PNG 重建与内存预览一致");
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = () => { throw new Error("预览不应编码 PNG"); };
  try { const uncached = await generateSliceProducts({ ...asset, documentId: "no-encode", sourceHash: "b".repeat(64) }); equal(uncached.get(0)!.status, "ready"); } finally { HTMLCanvasElement.prototype.toDataURL = originalToDataURL; }
  results.push("PASS 新产物生成与预览不调用 PNG 编码");
  // Exercise the assembled node, so a source-layer bypass would fail these pixel assertions.
  const mount = document.createElement("div"), nodeRoot = createRoot(mount); document.body.append(mount);
  const modified = document.createElement("canvas"); modified.width = modified.height = 8; modified.getContext("2d")!.drawImage(product.pixels, 0, 0);
  const renderProduct = (entry: RuntimeResource) => flushSync(() => nodeRoot.render(<SliceResourcesProvider value={{ entries: new Map([["unclassified/btn_test.png", entry]]), sizes: new Map(), resolve: () => entry, refresh() {} }}><NodeView page={page} node={page.nodes[0]} /></SliceResourcesProvider>));
  try {
    const current = { ...product, pixels: modified };
    renderProduct(current); await new Promise(requestAnimationFrame);
    equal(readPixel(mount.querySelector("canvas")!, 1, 1), "255,0,0,255");
    modified.getContext("2d")!.fillStyle = "#8030e0"; modified.getContext("2d")!.fillRect(0, 0, 3, 3);
    renderProduct({ ...current }); await new Promise(requestAnimationFrame);
    equal(readPixel(mount.querySelector("canvas")!, 1, 1), "128,48,224,255"); equal(readPixel(product.pixels, 1, 1), "255,0,0,255");
    renderProduct({ status: "error", error: "产物已损坏" }); await new Promise(requestAnimationFrame);
    equal(mount.querySelectorAll("canvas").length, 0); equal(mount.textContent!.includes("产物已损坏"), true);
    results.push("PASS 生成像素改变直接影响装配节点，产物损坏显示错误且不回退源图");
  } finally { nodeRoot.unmount(); mount.remove(); }
  return results;
}
function Fixture() {
  const [open, setOpen] = useState(false), [results, setResults] = useState<string[]>([]), [assets, setAssets] = useState([asset]);
  const resources = useRuntimeResources(assets, [page]);
  const state = resources.resolve(page.nodes[0].sliceResource!);
  return <SliceResourcesProvider value={resources}><main style={{ padding: 20 }}><h1>运行预览像素验收</h1><button onClick={() => { void checkPixels().then(setResults).catch(e => setResults([`FAIL ${String(e)}`])); }}>执行像素验收</button><button onClick={() => setOpen(true)}>打开运行预览</button><button onClick={() => setAssets([{ ...asset, layers: [{ ...asset.layers[0], config: { ...asset.layers[0].config, exportName: "btn_renamed" } }] }])}>资源改名</button><button onClick={() => setAssets([{ ...asset, layers: [] }])}>删除来源</button><p role="status">资源状态：{state.status}{state.status === "error" ? ` ${state.error}` : ""}</p><pre>{results.join("\n")}</pre><p>设计初值：复选 false；Slider 20；九宫格 100×60。</p>{open ? <RuntimePreview pages={[page]} initialPageId={page.id} assets={assets} onClose={() => setOpen(false)} /> : null}</main></SliceResourcesProvider>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
