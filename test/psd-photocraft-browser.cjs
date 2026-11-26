const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const esbuild = require("esbuild");
const { chromium } = require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE || "playwright");

async function main() {
  const { createServer } = await import("vite");
  const root = path.resolve(__dirname, "..");
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "gameflow-photocraft-test-"));
  const server = await createServer({ server: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
  let browser;
  try {
    const host = path.join(temp, "renderer.cjs");
    await esbuild.build({ entryPoints: ["src/photocraft-render.ts"], bundle: true, platform: "node", outfile: host });
    const { renderPhotoCraft } = require(host);
    const bytes = fs.readFileSync(process.env.GAMEFLOW_PSD_FIXTURE || path.join(root, "sample", "6.psd"));
    await server.listen();
    browser = await chromium.launch({ channel: process.env.GAMEFLOW_BROWSER_CHANNEL || "msedge", headless: true });
    const page = await browser.newPage();
    let renders = 0;
    await page.exposeFunction("nativeSlice", async keys => {
      assert.equal(keys.length, 1, "each slice has exactly one PSD source");
      renders++;
      if (renders === 1) return renderPhotoCraft(bytes, keys, path.join(temp, "missing-cli"));
      return renderPhotoCraft(bytes, keys, process.env.GAMEFLOW_PHOTOCRAFT_CLI || "");
    });
    await page.goto(server.resolvedUrls.local[0]);
    const result = await page.evaluate(async ({ base64, root }) => {
      const { openPsd } = await import("/psd/io.ts");
      const { connectPhotoCraft, photoCraftPixels } = await import("/psd/photocraft.ts");
      const { renderSliceExportBatch, generateSliceProducts, loadSliceImage } = await import("/psd/slice-render.ts");
      const { paintSlice } = await import("/runtime/paint-slice.ts");
      const { bindPrototypePsd } = await import(root + "/shared/psd-prototype.ts");
      const { renderedSliceLayer, translateRegion } = await import(root + "/shared/psd-slice-source.ts");
      const { makeSidecar, applySidecar } = await import(root + "/shared/psd-meta.ts");
      const { makePsdDraft } = await import(root + "/shared/psd-draft.ts");
      connectPhotoCraft(async request => {
        try {
          const image = await window.nativeSlice(request.keys);
          window.postMessage({ type: "psdRenderSliceResult", requestId: request.requestId, image });
        } catch (error) { window.postMessage({ type: "psdRenderSliceResult", requestId: request.requestId, error: String(error) }); }
      });
      const file = new File([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], "6.psd");
      const { asset } = await openPsd(file);
      const group = asset.layers.find(l => l.name === "组 1651"), text = asset.layers.find(l => l.name === "前往领取");
      for (const layer of asset.layers) layer.config.enabled = layer === group;
      const firstAttempt = (await generateSliceProducts(asset)).get(group.key);
      if (firstAttempt.status !== "error" || !firstAttempt.error.includes("gameflow.photoCraftCliPath")) throw Error("Missing CLI must surface an actionable error");
      const background = await photoCraftPixels(asset, group);
      const parent = asset.layers.find(l => l.key === group.parentKey);
      if (text.parentKey !== parent.key) throw Error("The fixture must place the label alongside the button group");
      const withText = await photoCraftPixels(asset, parent);
      const canvas = () => document.createElement("canvas");
      const samples = async (image, left = 0, top = 0) => {
        const c = canvas(); c.width = background.width; c.height = background.height;
        const ctx = c.getContext("2d");
        ctx.drawImage(await loadSliceImage(image), -left, -top);
        return ctx.getImageData(0, 0, c.width, c.height).data;
      };
      const original = await samples(asset.preview, background.left, background.top);
      const isolated = await samples(background.image);
      const parentPixels = await samples(withText.image, background.left - withText.left, background.top - withText.top);
      let opaque = 0, maxDifference = 0;
      for (let i = 0; i < isolated.length; i += 4) {
        if (isolated[i + 3] !== 255) continue;
        const x = background.left + (i / 4) % background.width, y = background.top + Math.floor(i / 4 / background.width);
        if (x >= text.left && x < text.left + text.width && y >= text.top && y < text.top + text.height) continue;
        opaque++;
        for (let c = 0; c < 3; c++) maxDifference = Math.max(maxDifference, Math.abs(original[i + c] - isolated[i + c]));
      }
      const labelPixels = rgba => {
        let count = 0;
        for (let i = 0; i < rgba.length; i += 4) if (Math.min(rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]) > 228) count++;
        return count;
      };
      group.config.region = translateRegion({ x: -8, y: -8, width: background.width + 16, height: background.height + 16 }, background, group);
      group.config.nineGrid = { left: 48, right: 48, top: 24, bottom: 24, repeat: false };
      const sidecar = makeSidecar(asset);
      sidecar.layers.find(l => l.sourceKey === group.key).config.additionalLayerIds = [text.metadata.layerId];
      const reopened = applySidecar((await openPsd(file)).asset, sidecar);
      const saved = reopened.layers.find(l => l.key === group.key);
      const bound = bindPrototypePsd({ id: "page", nodes: [{ id: "button-art", name: group.name, type: "image" }] }, "prototype", reopened);
      const product = (await generateSliceProducts(reopened)).get(group.key);
      if (product.status !== "ready") throw Error(product.error);
      const item = (await renderSliceExportBatch(reopened)).items[0];
      const png = await loadSliceImage("data:image/png;base64," + item.base64);
      const preview = canvas(), exported = canvas();
      paintSlice(preview, product.pixels, product.description, 421, 89);
      paintSlice(exported, png, item, 421, 89);
      const exportedPixels = await samples(png.src, 8, 8);
      return { bare: [background.width, background.height], opaque, maxDifference, textCount: labelPixels(parentPixels) - labelPixels(isolated),
        sameGroupPixels: exportedPixels.every((value, i) => value === isolated[i]),
        pageRef: bound.nodes[0].image.art.path, path: product.description.path, region: renderedSliceLayer(saved, background).config.region,
        expectedCanvas: exported.toDataURL(), draft: makePsdDraft(reopened),
        samePreview: preview.toDataURL() === exported.toDataURL(), dimensions: [item.width, item.height],
        transparent: preview.getContext("2d").getImageData(0, 44, 1, 1).data[3], grid: item.nineGrid };
    }, { base64: bytes.toString("base64"), root: "/@fs/" + root.replaceAll("\\", "/") });
    assert.deepEqual(result.bare, [301, 73]);
    assert.ok(result.opaque > 13000);
    assert.ok(result.maxDifference <= 1, "opaque button pixels match the saved PSD composite within 1/255");
    assert.ok(result.textCount > 100, "the parent group includes the white label");
    assert.equal(result.sameGroupPixels, true, "a legacy reference cannot add an outside layer to the exported PNG");
    assert.equal(result.pageRef, result.path);
    assert.deepEqual(result.region, { x: -8, y: -8, width: 317, height: 89 });
    assert.deepEqual(result.dimensions, [317, 89]);
    assert.deepEqual(result.grid, { left: 48, right: 48, top: 24, bottom: 24, repeat: false });
    assert.equal(result.transparent, 0);
    assert.equal(result.samePreview, true);
    assert.equal(renders, 3, "one failed attempt and two distinct successful source renders");
    const buttonLayerOrder = await verifyImportedArt(browser, server.resolvedUrls.local[0], bytes, result.draft, renderPhotoCraft);
    await verifyWorkbench(browser, server.resolvedUrls.local[0], bytes, result, renderPhotoCraft, buttonLayerOrder);
    await verifyBrowserVisibility(browser, server.resolvedUrls.local[0]);
    console.log("PASS layer visibility, group inheritance, canvas picking, legacy and new imported page appearance, sidecar, nine-grid, live prototype canvas and export pixels");
  } finally {
    await browser?.close();
    await server.close();
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

async function verifyImportedArt(browser, url, bytes, draft, renderPhotoCraft) {
  const page = await browser.newPage();
  const base64 = bytes.toString("base64");
  await page.goto(url);
  const fixture = await page.evaluate(async ({ base64, root }) => {
    const { importPsdPrototype, openPsd } = await import("/psd/io.ts");
    const { importedNodes, importSignature } = await import("/psd/import-signature.ts");
    const file = new File([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], "6.psd");
    const imported = await importPsdPrototype(file), { asset } = await openPsd(file, "readPage");
    const frame = { x: 0, y: 0, width: imported.width, height: imported.height };
    const nodes = importedNodes(imported.layers, imported.layers.map((_, i) => ("node" + String(i).padStart(4, "0"))));
    if (importSignature({ frame, nodes }) !== asset.importSignature || !imported.composite || !asset.importCorrections?.length)
      throw Error("Imported visual baseline or clipping corrections missing");
    const patch = asset.importCorrections.find(item => item.name === "多边形 1 拷贝 8");
    const raw = asset.layers.find(item => item.name === patch.name).image;
    const inkOutsideButton = async image => {
      const c = document.createElement("canvas"), img = new Image(); img.src = image; await img.decode();
      c.width = 450; c.height = img.naturalHeight;
      const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0);
    };
    if (!await inkOutsideButton(raw) || await inkOutsideButton(nodes[patch.index].imageData)) throw Error("Button texture still escapes its clipping base");
    // Reconstruct the older import using saved single-layer pixels.
    const { stringFingerprint } = await import(root + "/shared/string-fingerprint.ts");
    const old = nodes.map(({ psdPaint, ...node }) => node);
    for (const c of asset.importCorrections) {
      const layer = asset.layers.find(l => l.name === c.name && l.image && stringFingerprint(l.image) === c.original);
      old[c.index].imageData = layer.image;
    }
    if (importSignature({ frame, nodes: old }) !== asset.legacyImportSignature) throw Error("Legacy import signature mismatch");
    return { frame, old, preview: asset.preview, corrected: patch.image, textureId: nodes[patch.index].id };
  }, { base64, root: "/@fs/" + path.resolve(__dirname, "..").replaceAll("\\", "/") });
  const binding = { source: "6.psd", documentId: draft.documentId };
  const doc = { schemaVersion: 5, elementIdScheme: "nanoid-8", documentId: "imported", title: "预览", requirements: [], interactions: [],
    pages: [{ id: "import01", name: "6", kind: "screen", rootType: "UIStack", frame: fixture.frame, nodes: fixture.old, artPsd: binding }] };
  const unmarked = structuredClone(draft);
  for (const layer of unmarked.layers) layer.config.enabled = false;
  const diamond = unmarked.layers.find(layer => layer.config.name === "图层 1225 拷贝");
  diamond.config.enabled = true;
  await page.exposeFunction("renderLayer", keys => renderPhotoCraft(bytes, keys, process.env.GAMEFLOW_PHOTOCRAFT_CLI || ""));
  await page.addInitScript(({ doc, base64, draft }) => {
    window.setDiamondRegion = region => {
      draft.layers.find(l => l.config.name === "图层 1225 拷贝").config.region = region;
      window.postMessage({ type: "pagePsdChanged", documentId: draft.documentId });
    };
    window.acquireVsCodeApi = () => ({ getState() {}, setState() {}, async postMessage(m) {
      if (m.type === "ready") window.postMessage({ type: "init", document: doc, documentVersion: 1, dirty: false, resourceName: "import.gameflow.json" });
      if (m.type === "pagePsd") window.postMessage({ type: "pagePsdResult", requestId: m.requestId, source: "6.psd", name: "6.psd", base64, draft });
      if (m.type === "psdRenderSlice") window.postMessage({ type: "psdRenderSliceResult", requestId: m.requestId, image: await window.renderLayer(m.keys) });
      if (m.type === "workbenchSettings") window.postMessage({ type: "workbenchSettingsResult", requestId: m.requestId, settings: {} });
      if (m.type === "replaceDocument") {
        window.lastImport = m.document;
        window.postMessage({ type: "documentChanged", document: m.document, documentVersion: m.baseVersion + 1, dirty: true });
      }
    } });
    window.changeImport = (changed, version) => {
      const next = structuredClone(doc);
      if (changed) next.pages[0].nodes.find(n => n.name === "前往领取").text = "已领取";
      window.postMessage({ type: "documentChanged", document: next, documentVersion: version, dirty: false });
    };
  }, { doc, base64, draft: unmarked });
  await page.reload();
  await page.getByRole("button", { name: "美术 PSD资源", exact: true }).click();
  const surface = page.locator('.page-surface[data-psd-components="66"]');
  await surface.waitFor();
  assert.equal(await surface.locator(".node-body").count(), 66);
  assert.equal(await page.locator(".imported-psd-composite").count(), 0);
  await page.getByRole("button", {name:"原型资源", exact:true}).click();
  await page.getByRole("button", { name: "适应画布", exact:true }).click();
  await surface.locator(".psd-text-pixels").first().waitFor();
  const full = await surface.screenshot();
  if (process.env.GAMEFLOW_PREVIEW_SCREENSHOT) fs.writeFileSync(process.env.GAMEFLOW_PREVIEW_SCREENSHOT, full);
  const button = fixture.old.find(n => n.name === "组 1651");
  const text = fixture.old.find(n => n.name === "前往领取");
  const sendHidden = async (id, version) => page.evaluate(({id, version, doc}) => {
    const next = structuredClone(doc);
    if (id) next.pages[0].nodes.find(n => n.id === id).hidden = true;
    window.postMessage({type:"documentChanged", document:next, documentVersion:version, dirty:true});
  }, {id, version, doc});
  await sendHidden(button.id, 2);
  await surface.locator(`[data-node-id="${button.id}"]`).waitFor({state:"detached"});
  await surface.locator(`[data-node-id="${text.id}"] img`).waitFor();
  const hidden = await surface.screenshot();
  const changed = await page.evaluate(async ([before,after]) => {
    const read = async src => {
      const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
      const c = document.createElement("canvas"); c.width=img.width;c.height=img.height;
      const ctx=c.getContext("2d");ctx.drawImage(img,0,0);
      return {px:ctx.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height};
    };
    const a=await read(before),b=await read(after);
    let inside=0,outside=0;
    for(let i=0;i<a.px.length;i+=4) {
      if([0,1,2,3].every(k=>a.px[i+k]===b.px[i+k]))continue;
      const x=i/4%a.w*1500/a.w,y=Math.floor(i/4/a.w)*1334/a.h;
      if(x>310 && x<641 && y>890 && y<1002)inside++;else outside++;
    }
    return {inside,outside};
  }, [full.toString("base64"),hidden.toString("base64")]);
  assert.ok(changed.inside>500, "button background disappears"); assert.equal(changed.outside,0,"unrelated controls retain their pixels");
  await sendHidden(fixture.textureId,3);
  await surface.locator(`[data-node-id="${fixture.textureId}"]`).waitFor({state:"detached"});
  await surface.locator(`[data-node-id="${button.id}"]`).waitFor();
  await sendHidden(null,4);
  await surface.locator(`[data-node-id="${fixture.textureId}"]`).waitFor();
  assert.ok(full.equals(await surface.screenshot()),"restoring the group and texture restores component pixels");
  await page.evaluate(()=>window.changeImport(true,5));
  await surface.getByText("已领取",{exact:true}).waitFor();
  assert.equal(await surface.locator(`[data-node-id="${fixture.textureId}"] img`).getAttribute("src"),fixture.corrected);
  await page.getByRole("button", {name:"美术 PSD资源",exact:true}).click();
  const diamondNode=fixture.old.find(n=>n.name==="图层 1225 拷贝");
  await surface.locator(`[data-node-id="${diamondNode.id}"] canvas[data-resource-path]`).waitFor();
  await page.getByLabel("从 PSD 导入原型",{exact:true}).setInputFiles({name:"6.psd",mimeType:"application/octet-stream",buffer:bytes});
  await page.waitForFunction(()=>window.lastImport?.pages.at(-1)?.nodes.every(n=>n.psdPaint));
  await surface.waitFor();
  await page.getByRole("button", {name:"美术 PSD资源",exact:true}).click();
  await surface.locator(".psd-text-pixels").first().waitFor();
  await page.getByRole("searchbox", { name: "搜索图层" }).fill("组 1651");
  await page.getByRole("button", { name: "隐藏组 1651", exact: true }).click();
  await page.waitForFunction(() => window.lastImport.pages.at(-1).nodes.find(n => n.name === "组 1651").hidden);
  const saved = await page.evaluate(() => window.lastImport);
  const restored = await browser.newPage();
  await restored.addInitScript(doc => {
    window.acquireVsCodeApi = () => ({ getState() {}, setState() {}, postMessage(m) {
      if (m.type === "ready") window.postMessage({ type:"init", document:doc, documentVersion:1, dirty:false, resourceName:"reopened.gameflow.json" });
    }});
  }, { ...saved, pages: [saved.pages.at(-1)] });
  await restored.goto(url);
  await restored.locator('.page-surface[data-psd-components="66"]').waitFor();
  const hiddenId = saved.pages.at(-1).nodes.find(n=>n.name==="组 1651").id;
  assert.equal(await restored.locator(`[data-node-id="${hiddenId}"]`).count(), 0);
  await restored.locator('.page-surface img[alt="前往领取"]').waitFor();
  await restored.close();
  await page.getByRole("button", { name: "显示组 1651", exact: true }).click();
  await page.waitForFunction(() => !window.lastImport.pages.at(-1).nodes.find(n => n.name === "组 1651").hidden);
  const buttonLayerOrder = await page.evaluate(() => {
    const { nodes } = window.lastImport.pages.at(-1);
    const button = nodes.find(n => n.name === "组 1651");
    return nodes.filter(n => n.parentId === button.id).map(n => n.name);
  });
  await page.close();
  return buttonLayerOrder;
}

async function verifyWorkbench(browser, url, bytes, result, renderPhotoCraft, buttonLayerOrder) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const frame = { x: 0, y: 0, width: 421, height: 89 };
  const doc = { schemaVersion: 5, elementIdScheme: "nanoid-8", documentId: "prototype", title: "切图预览", requirements: [], interactions: [],
    pages: [{ id: "page0001", name: "按钮", kind: "screen", frame, artPsd: { source: "6.psd", documentId: result.draft.documentId },
      nodes: [{ id: "image001", name: "组 1651", type: "image", frame }] }] };
  await page.exposeFunction("renderKeys", (keys, mode) => renderPhotoCraft(bytes, keys, process.env.GAMEFLOW_PHOTOCRAFT_CLI || "", mode));
  await page.addInitScript(({ doc, draft, base64 }) => {
    const reply = data => window.postMessage(data);
    window.sliceEdits = 0;
    const source = { name: "6.psd", source: "6.psd", sourceUri: "file:///sample/6.psd", base64 };
    const bare = structuredClone(draft);
    bare.layers.find(layer => layer.config.enabled).config.nineGrid.repeat = true;
    window.openSliceDraft = uri => reply({ type: "psdEditorInit", ...source, sourceUri: uri, configPath: "6.meta.json",
      state: { type: "psdEditorState", version: 1, draft: bare, dirty: true, backup: "none" } });
    window.acquireVsCodeApi = () => ({ getState() {}, setState() {}, async postMessage(message) {
      const requestId = message.requestId;
      if (message.type === "ready") reply({ type: "init", document: doc, documentVersion: 1, dirty: false, resourceName: "button.gameflow.json" });
      if (message.type === "workbenchSettings") reply({ type: "workbenchSettingsResult", requestId, settings: {} });
      if (message.type === "pagePsd" && message.action === "load") reply({ type: "pagePsdResult", ...source, draft, requestId });
      if (message.type === "psdRenderSlice") reply({ type: "psdRenderSliceResult", requestId, image: await window.renderKeys(message.keys) });
      if (message.type === "psdRenderVisibility") reply({ type: "psdRenderVisibilityResult", requestId, image: await window.renderKeys(message.keys, "visibility") });
      if (message.type === "psdEditorEdit") {
        window.sliceEdits++;
        reply({ type: "psdEditorState", requestId, version: message.baseVersion + 1, dirty: true, backup: "none", draft: message.draft });
      }
      if (message.type === "sliceResources") reply({ type: "sliceResourcesResult", requestId, items: [] });
    } });
  }, { doc, draft: result.draft, base64: bytes.toString("base64") });
  await page.goto(url);
  await page.getByRole("button", { name: "美术 PSD资源", exact: true }).click();
  const canvas = page.locator(".page-surface canvas[data-resource-path]").first();
  const matchesExport = (expected => document.querySelector(".page-surface canvas[data-resource-path]")?.toDataURL() === expected);
  await page.waitForFunction(matchesExport, result.expectedCanvas);
  assert.equal(await canvas.getAttribute("data-resource-path"), result.path);
  await page.evaluate(() => window.openSliceDraft("file:///copy/6.psd"));
  await page.locator(".psd-workspace .psd-document-row").first().waitFor({ state: "attached" });
  assert.equal(await canvas.evaluate(element => element.toDataURL()), result.expectedCanvas, "a different PSD file with the same hash cannot replace page art");
  await page.evaluate(() => window.openSliceDraft("file:///sample/6.psd"));
  await page.waitForFunction(expected => {
    const canvas = document.querySelector(".page-surface canvas[data-resource-path]");
    return canvas?.width === 421 && canvas.height === 89 && canvas.toDataURL() !== expected;
  }, result.expectedCanvas);
  await page.evaluate(() => window.postMessage({ type: "psdEditorReveal" }));
  await verifyVisibility(page);
  await page.getByRole("tree").getByRole("button", { name: "组 1651", exact: true }).click();
  const childLabels = page.locator('.psd-tree-row.is-selected + [role="group"] > div > .psd-tree-row > .psd-tree-label');
  assert.deepEqual(await childLabels.allInnerTexts(), buttonLayerOrder, "slice siblings match the imported prototype order");
  assert.equal(await page.getByText("合成来源", { exact: true }).count(), 0);
  assert.equal(await page.getByLabel("加入合成图层").count(), 0);
  await page.getByRole("button", { name: "编辑九宫格", exact: true }).click();
  await page.getByRole("checkbox", { name: "重复填充" }).uncheck();
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await page.getByRole("button", { name: "编辑区域", exact: true }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: /^工作台模式：/ }).click();
  await page.getByRole("menuitem", { name: "原型", exact: true }).click();
  await page.waitForFunction(matchesExport, result.expectedCanvas);
  assert.deepEqual(errors, []);
  await page.close();
}

async function verifyVisibility(page) {
  const eye = page.getByRole("button", { name: "图层可见性：前往领取（64）" });
  const board = page.getByRole("button", { name: "图层可见性：画板 19（84）" });
  const composite = page.locator(".psd-slice-canvas .psd-composite");
  const original = await composite.getAttribute("src");
  async function ink() {
    return composite.evaluate(async img => {
      await img.decode();
      const c = document.createElement("canvas");
      c.width = 126; c.height = 31;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, -412, -925);
      const rgba = ctx.getImageData(0, 0, 126, 31).data;
      let count = 0;
      for (let i = 0; i < rgba.length; i += 4) if (Math.min(...rgba.subarray(i, i + 4)) > 228) count++;
      return count;
    });
  }
  const label = await ink();
  assert.ok(label > 100);
  await eye.click();
  await page.waitForFunction(src => {
    const img = document.querySelector(".psd-slice-canvas .psd-composite");
    return img && img.src !== src;
  }, original);
  assert.ok(await ink() < label / 10, "only the label disappears from the decorated button");
  const box = await composite.boundingBox();
  await page.mouse.click(box.x + box.width * 475 / 1500, box.y + box.height * 940 / 1334);
  const picked = page.locator(".psd-tree-row.is-selected .psd-tree-label");
  await picked.waitFor();
  assert.doesNotMatch(await picked.innerText(), /前往领取/);
  await board.click();
  assert.equal(await eye.isDisabled(), true);
  assert.equal(await page.locator(".psd-visible-layers img").count(), 0);
  await board.click();
  assert.equal(await eye.getAttribute("aria-pressed"), "false");
  await eye.focus(); await page.keyboard.press("Space");
  assert.equal(await composite.getAttribute("src"), original, "restoring visibility reuses the exact saved composite");
  assert.equal(await page.evaluate(() => window.sliceEdits), 0);
}

async function verifyBrowserVisibility(browser, url) {
  const { writePsdBuffer } = require("ag-psd");
  const pixel = value => ({ width: 1, height: 1, data: new Uint8ClampedArray([value, 0, 0, 255]) });
  const bytes = writePsdBuffer({ width: 1, height: 1, imageData: pixel(10), children: [
    { id: 1, name: "底色", imageData: pixel(10) },
    { id: 2, name: "初始隐藏组", hidden: true, children: [
      { id: 3, name: "默认显示", imageData: pixel(20) },
      { id: 4, name: "默认隐藏", hidden: true, imageData: pixel(30) }
    ] }
  ] });
  const page = await browser.newPage();
  await page.goto(url);
  await page.getByRole("button", { name: /^工作台模式：/ }).click();
  await page.getByRole("menuitem", { name: "PSD 切图", exact: true }).click();
  await page.getByLabel("打开切图 PSD", { exact: true }).setInputFiles({ name: "flags.psd", mimeType: "application/octet-stream", buffer: bytes });
  const eye = name => page.getByRole("button", { name: "图层可见性：" + name });
  const folder = eye("初始隐藏组（2）"), child = eye("默认显示（3）"), hidden = eye("默认隐藏（4）");
  assert.equal(await child.isDisabled(), true);
  assert.deepEqual(await page.getByRole("tree").locator(".psd-tree-label").allInnerTexts(), ["底色", "初始隐藏组", "默认显示", "默认隐藏"]);
  await folder.click();
  assert.equal(await child.getAttribute("aria-pressed"), "true");
  assert.equal(await hidden.getAttribute("aria-pressed"), "false");
  assert.equal(await page.locator(".psd-visible-layers img").count(), 2);
  const childBox = await child.boundingBox(), groupBox = await folder.boundingBox();
  assert.equal(childBox.x, groupBox.x, "eye buttons align at the right across indentation levels");
  await hidden.click();
  assert.equal(await page.locator(".psd-visible-layers img").count(), 3);
  await folder.click(); await folder.click();
  assert.equal(await hidden.getAttribute("aria-pressed"), "true");
  await page.close();
}
main().catch(error => { console.error(error); process.exitCode = 1; });
