const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { readPsd } = require("ag-psd");
const { chromium } = require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE || "playwright");
const read = bytes => readPsd(bytes, { skipCompositeImageData: true, skipLayerImageData: true, skipThumbnail: true });

async function main() {
  const root = path.resolve(__dirname, "..").replaceAll("\\", "/");
  const doc = JSON.parse(fs.readFileSync(path.join(root, "sample/star-sea-login.gameflow.json"), "utf8"));
  const browser = await chromium.launch({ channel: process.env.GAMEFLOW_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    const page = await browser.newPage();
    await page.addInitScript(doc => localStorage.setItem("gameflow.prototype.v1", JSON.stringify(doc)), doc);
    await page.goto(process.env.GAMEFLOW_TEST_URL || "http://127.0.0.1:5191");
    const previewRows = page.locator(".page-surface [data-cell-index]");
    await previewRows.nth(7).waitFor({ state: "attached" });
    const positions = await previewRows.evaluateAll(rows => rows.map(row => ({
      x: row.offsetLeft, y: row.offsetTop, height: row.offsetHeight, viewport: row.parentElement.clientHeight
    })));
    const result = await page.evaluate(async ({ root, doc }) => {
      const { composeCanvasPage } = await import("/@fs/" + root + "/shared/canvas-instances.ts");
      const { psdComponentInstances, psdTree } = await import("/@fs/" + root + "/shared/page-sync.ts");
      const { generatePrototypePsd } = await import("/runtime/prototype-psd.ts");
      const { prepareComponentPsdGeneration } = await import("/runtime/component-psd.ts");
      const { encodePsd } = await import("/runtime/page-psd.ts");
      const { psdTask } = await import("/psd/io.ts");
      const { applySidecar } = await import("/@fs/" + root + "/shared/psd-meta.ts");
      const { parsePsdBinary, patchPsdMetadata } = await import("/@fs/" + root + "/shared/psd-binary.ts");
      const composition = composeCanvasPage(doc, doc.pages[0], {}), components = psdComponentInstances(composition);
      const generationDoc = structuredClone(doc);
      const cellReference = doc.pages[0].nodes.find(node => node.cellPrefab).cellPrefab;
      delete generationDoc.pages.find(page => page.id === cellReference.pageId).artPsd;
      const sources = await prepareComponentPsdGeneration(generationDoc, {}, composition);
      const bytes = await generatePrototypePsd(doc, composition.page, components, {}, sources.psds);
      const asset = await psdTask("read", bytes.slice().buffer, "login.psd");
      const list = doc.pages[0].nodes.find(node => node.cellPrefab);
      const rows = asset.layers.filter(layer => layer.metadata.listNodeId === list.id);
      const synced = psdTree(doc.documentId, composition.page, asset, () => { throw Error("unexpected control"); }, undefined, true, components);
      const config = rows.map(row => ({ index: row.metadata.listCellIndex, x: row.left, y: row.top, h: row.height,
        w: row.width, slice: row.config.enabled, limitation: row.limitation ?? null }));
      const image = new Image();
      image.src = asset.preview;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = asset.width; canvas.height = asset.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0);
      const pixels = (x, y, w, h) => ctx.getImageData(x, y, w, h).data;
      const first = pixels(148, 576, 378, 40);
      for (let i = 1; i < 7; i++) if (!pixels(148, 576 + i*40, 378, 40).every((v,k) => v === first[k])) throw Error("unequal list rows");
      if (!pixels(148, 856, 378, 2).every((v,k) => v === first[k])) throw Error("partial row mismatch");
      const icon = Array.from(pixels(154, 582, 32, 28)).some((v,i) => i%4 === 0 && v < 160);
      const text = Array.from(pixels(230, 576, 210, 40)).some((v,i) => i%4 === 0 && v < 215);
      // Open exactly the same file as the editor and Photoshop, including its saved composite.
      const source = "/@fs/" + root + "/sample/" + doc.pages[0].artPsd.source;
      const bound = applySidecar(await psdTask("read", await (await fetch(source)).arrayBuffer(), doc.pages[0].artPsd.source),
        await (await fetch(source.replace(/\.psd$/, ".meta.json"))).json());
      const boundRows = bound.layers.filter(layer => layer.metadata.listNodeId === list.id);
      if (boundRows.length !== rows.length || boundRows.some((row,i) => row.smartObject?.hash !== boundRows[0].smartObject?.hash ||
          !row.smartObject?.contents || row.left !== rows[i].left || row.top !== rows[i].top || row.height !== rows[i].height))
        throw Error("页面绑定的 PSD 缺少可见的列表项智能对象");
      const boundComponent = bound.layers.find(layer => layer.metadata.componentSource);
      for (const layer of [...boundRows, boundComponent]) {
        const names = layer?.smartObject?.contents?.map(child => child.name).sort();
        if (JSON.stringify(names) !== JSON.stringify(["图片", "服务器名称"])) throw Error("样例智能对象多了一层组件根容器");
      }
      const readPixels = async uri => {
        const image = new Image(); image.src = uri; await image.decode();
        const copy = document.createElement("canvas"); copy.width = image.width; copy.height = image.height;
        const paint = copy.getContext("2d"); paint.drawImage(image,0,0); return paint;
      };
      const boundPreview = await readPixels(bound.preview);
      for (const rect of [[0,0,64,64],[148,576,460,282]]) {
        const reference = pixels(...rect);
        if (!boundPreview.getImageData(...rect).data.every((v,i) => v === reference[i]))
          throw Error("页面绑定的 PSD 合成像素与原型生成结果不同：" + rect);
      }
      const background = a => a.layers.find(layer => layer.name === "星点与轨道");
      const boundBackground = (await readPixels(background(bound).image)).getImageData(0,0,750,1334).data;
      const generatedBackground = (await readPixels(background(asset).image)).getImageData(0,0,750,1334).data;
      if (!boundBackground.every((v,i) => v === generatedBackground[i])) throw Error("绑定 PSD 背景仍使用旧版默认图片");
      // A nested list lives in an external document and resolves its own local template there.
      const external = structuredClone(doc), template = external.pages[1];
      external.documentId = "external";
      const inner = { ...template, id: "inner", frame: { x: 0, y: 0, width: 12, height: 8 },
        nodes: [{ id: "pic", type: "image", name: "Icon", frame: { x: 0, y: 0, width: 12, height: 8 } }] };
      external.pages = [template, inner];
      template.frame = { x: 0, y: 0, width: 25, height: 8 };
      const nested = { ...list, frame: { ...template.frame }, layout: { scrollType: 1, gapX: 2 },
        cellPrefab: { source: "", documentId: "external", pageId: inner.id } };
      template.nodes = [nested];
      const outside = { ...list, frame: { x: 3, y: 4, width: 39, height: 29 },
        layout: { scrollType: 1, paddingLeft: 2, paddingTop: 3, gapX: 1, gapY: 2, wrapCount: 2 },
        cellPrefab: { source: "other/cells.json", documentId: "external", pageId: template.id } };
      const host = { ...doc.pages[0], frame: { x: 0, y: 0, width: 70, height: 60 }, nodes: [outside] };
      const options = { sources: { "other/cells.json": { source: "other/cells.json", document: external } } };
      const externalBytes = await generatePrototypePsd(doc, host, undefined, options);
      nested.cellPrefab.pageId = template.id;
      let cycle = "";
      try { await generatePrototypePsd(doc, host, undefined, options); } catch (e) { cycle = e.message; }
      const oldPage = { ...composition.page, nodes: composition.page.nodes.map(node => node.id === list.id ? { ...node, cellPrefab: undefined } : node) };
      const oldBytes = await generatePrototypePsd(doc, oldPage, components, {}, sources.psds);
      const oldLayer = parsePsdBinary(oldBytes).layers.find(layer => layer.name === "星点与轨道");
      const meta = oldLayer.metadata;
      const old = patchPsdMetadata(oldBytes, new Map([[oldLayer.key, { ...meta,
        builtinOrigin: { ...meta.builtinOrigin, catalog: "c2aba2a565d8cbd0e0442efbb994e956e81ec2cea179d34fac82ca42ff32c06d" },
        slicing: { ...meta.slicing, nineGrid: { top:34, right:0, bottom:0, left:38, repeat:false } }
      }]]));
      return { bytes: encodePsd(bytes), old: encodePsd(old), nested: encodePsd(externalBytes), cycle, config, icon, text,
        controlsUnderList: synced.filter(node => node.parent === list.id).length,
        defaultGrid: asset.layers.find(layer => layer.name === "星点与轨道").config.nineGrid };
    }, { root, doc });
    assert.deepEqual(result.config.reverse(), Array.from({ length: 8 }, (_, index) => ({
      index, x: 148, y: 576 + index * 40, w: 378, h: index === 7 ? 2 : 40, slice: false, limitation: null
    })));
    assert.deepEqual(result.config.map(row => [row.x-148, row.y-576, row.h]),
      positions.map(row => [row.x, row.y, Math.min(row.height, row.viewport-row.y)]));
    assert.ok(result.icon && result.text);
    assert.equal(result.controlsUnderList, 0);
    assert.deepEqual(result.defaultGrid, { top: 36, right: 0, bottom: 0, left: 40, repeat: false });
    const bytes = Buffer.from(result.bytes, "base64"), psd = read(bytes);
    const rows = psd.children.find(layer => layer.name === "列表").children;
    assert.equal(new Set(rows.map(layer => layer.placedLayer.id)).size, 1);
    assert.equal(new Set(rows.map(layer => layer.placedLayer.placed)).size, 8);
    assert.equal(rows[7].placedLayer.height, 40);
    assert.ok(rows[7].mask);
    const cellFile = psd.linkedFiles.find(file => file.id === rows[0].placedLayer.id);
    assert.equal(cellFile.name, "服务器列表项.psd");
    const cell = read(cellFile.data);
    assert.deepEqual(cell.children.map(layer => layer.name), ["图片", "服务器名称"]);
    assert.equal(cell.children[1].text?.text, "星港一区   ·   连接正常");
    const nested = read(Buffer.from(result.nested, "base64"));
    assert.deepEqual(nested.children[0].children.map(layer => [layer.left, layer.top, layer.right, layer.bottom]),
      [[5,7,30,15], [5,17,30,25], [31,7,42,15], [31,17,42,25]]);
    const nestedFile = read(nested.linkedFiles[0].data);
    assert.equal(nestedFile.children[0].children.length, 2);
    assert.equal(nestedFile.linkedFiles.length, 1);
    assert.equal(read(nestedFile.linkedFiles[0].data).children[0].right, 12);
    assert.match(result.cycle, /循环/);
    await page.locator(".page-caption").first().click();
    async function menu(name) {
      await page.getByRole("button", { name: "更多", exact: true }).click();
      await page.getByRole("menuitem", { name, exact: true }).click();
    }
    const chooser = page.waitForEvent("filechooser");
    await menu("重新绑定 PSD");
    await (await chooser).setFiles({ name: "legacy.psd", mimeType: "image/vnd.adobe.photoshop", buffer: Buffer.from(result.old,"base64") });
    await menu("PSD 同步");
    const dialog = page.getByRole("dialog", { name: "PSD 同步" });
    await dialog.getByRole("button", { name: "预演应用", exact: true }).click();
    const decisions = dialog.getByRole("group", { name: "本轮应用明细" });
    await decisions.getByText(/列表项智能对象.*按引用原型补齐列表项/).waitFor();
    await decisions.getByText(/内置默认图片.*更新默认图片/).waitFor();
    const download = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "确认应用", exact: true }).click();
    const updated = Buffer.concat(await Array.fromAsync(await (await download).createReadStream()));
    assert.equal(read(updated).children.find(layer => layer.name === "列表").children.length, 8);
    await dialog.waitFor({ state: "hidden" });
    await menu("PSD 同步");
    await dialog.getByText("文字与结构已一致").waitFor();
    const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gameflow-list-")), "星海远征 · 登录（列表智能对象）.psd");
    fs.writeFileSync(output, bytes);
    console.log("PASS 星海列表的共享智能对象、内嵌文字、边缘裁剪、切图与同步，以及跨文件嵌套和水平换行\n" + output);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
