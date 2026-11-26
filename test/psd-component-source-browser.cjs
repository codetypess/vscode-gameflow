const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { readPsd } = require("ag-psd");
const { chromium } = require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE || "playwright");

const options = { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true };
const flatten = (layers = []) => layers.flatMap(layer => [layer, ...flatten(layer.children)]);
const storageKey = "gameflow.prototype.v1";
const mimeType = "image/vnd.adobe.photoshop";
const bytesOf = async download => Buffer.concat(await Array.fromAsync(await download.createReadStream()));
const instanceName = "登录页·服务器入口";
const componentName = "服务器列表项.psd";

function objectIn(bytes) {
  const psd = readPsd(bytes, options);
  const layer = flatten(psd.children).find(layer => layer.name === instanceName);
  assert.ok(layer?.placedLayer);
  const file = psd.linkedFiles.find(file => file.id === layer.placedLayer.id);
  return { layer, name: file.name, bytes: Buffer.from(file.data) };
}

async function main() {
  const browser = await chromium.launch({ channel: process.env.GAMEFLOW_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1320, height: 920 } });
    page.setDefaultTimeout(18000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const root = resolve(__dirname, "..").replaceAll("\\", "/");
    const document = JSON.parse(readFileSync(resolve(root, "sample/star-sea-login.gameflow.json"), "utf8"));
    delete document.pages[0].psdSync;
    document.pages[0].nodes.find(node => node.variableName === "serverList").name = instanceName;
    document.pages[0].exportName = "LayaLogin";
    document.pages[1].exportName = "laya-server-list";
    await page.addInitScript(({ document, storageKey }) => {
      if (!localStorage.getItem(storageKey)) localStorage.setItem(storageKey, JSON.stringify(document));
    }, { document, storageKey });
    await page.goto(process.env.GAMEFLOW_TEST_URL || "http://127.0.0.1:5197");
    const captions = page.locator(".page-caption");
    await captions.first().click();
    const menu = async name => {
      await page.getByRole("button", { name: "更多", exact: true }).click();
      await page.getByRole("menuitem", { name, exact: true }).click();
    };
    const generated = [];
    const collect = download => generated.push(download);
    page.on("download", collect);
    await page.getByRole("button", { name: "美术 PSD资源", exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-art-state="error"]').length === 2);
    await menu("生成 PSD");
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).pages[0].psdSync, storageKey);
    await page.waitForFunction(() => document.querySelectorAll("[data-art-state]").length === 0);
    const bindings = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).pages.map(page => page.artPsd), storageKey);
    assert.equal(generated.length, 2);
    page.off("download", collect);
    const pageFilename = document.pages[0].name + ".psd";
    assert.equal(generated[0].suggestedFilename(), pageFilename);
    assert.equal(bindings[0].source, pageFilename);
    const [parent, component] = await Promise.all(bindings.slice(0, 2).map(({ source }) => bytesOf(generated.find(download => download.suggestedFilename() === source))));
    const initial = objectIn(parent);
    assert.equal(bindings[1].source, componentName);
    assert.equal(initial.name, componentName);
    assert.deepEqual(initial.bytes, component);
    assert.deepEqual(readPsd(component, options).children.map(layer => layer.name), ["图片", "服务器名称"]);
    await captions.nth(1).click();
    await menu("PSD 同步");
    const dialog = page.getByRole("dialog", { name: "PSD 同步" });
    await dialog.getByText("文字与结构已一致").waitFor();
    await dialog.getByRole("button", { name: "关闭同步窗" }).click();
    const standaloneSync = await page.evaluate(async ({ document, root, base64 }) => {
      const { prototypeTree, psdTree, applyPrototypeTree } = await import("/@fs/" + root + "/shared/page-sync.ts");
      const { psdTask } = await import("/psd/io.ts");
      const { writeSyncCopy } = await import("/runtime/sync-psd-copy.ts");
      const { generatePrototypePsd } = await import("/runtime/prototype-psd.ts");
      const source = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const asset = await psdTask("read", source.slice().buffer, "component.psd");
      const template = document.pages[1];
      const unexpected = () => { throw Error("unexpected PSD node"); };
      const before = psdTree(document.documentId, template, asset, unexpected);
      const desired = prototypeTree(template).map(node => node.type === "text" ? { ...node, text: "独立同步文字" } : node);
      const updated = applyPrototypeTree(template, desired);
      const result = await writeSyncCopy(document, updated, asset, source, before, desired);
      const after = psdTree(document.documentId, updated, await psdTask("read", result.slice().buffer, "component.psd"), unexpected);
      const text = after.find(node => node.type === "text");
      if (text?.parent !== template.componentRootId || text.text !== "独立同步文字") throw Error("component sync lost the logical root");
      const legacy = await generatePrototypePsd(document, template, undefined, { preserveComponentRoot: true });
      const legacyAsset = await psdTask("read", legacy.slice().buffer, "component.psd");
      const legacyOutput = await writeSyncCopy(document, updated, legacyAsset, legacy,
        psdTree(document.documentId, template, legacyAsset, unexpected), desired);
      const encode = bytes => btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(""));
      return { flat: encode(result), legacy: encode(legacyOutput) };
    }, { document, root, base64: component.toString("base64") });
    assert.deepEqual(readPsd(Buffer.from(standaloneSync.flat, "base64"), options).children.map(layer => layer.name), ["图片", "服务器名称"]);
    const legacyRoot = readPsd(Buffer.from(standaloneSync.legacy, "base64"), options).children[0];
    assert.equal(legacyRoot.name, "容器");
    assert.equal(legacyRoot.children[1].text?.text, "独立同步文字");

    const variants = await page.evaluate(async document => {
      const { generatePrototypePsd } = await import("/runtime/prototype-psd.ts");
      const page = document.pages[1];
      const make = async text => {
        const changed = { ...page, nodes: page.nodes.map(node => node.type === "text" ? { ...node, text } : node) };
        const bytes = await generatePrototypePsd(document, changed);
        return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(""));
      };
      return await Promise.all(["第一次源修改", "第二次源修改", "父PSD手工修改", "第三次源修改"].map(make));
    }, document);
    const bind = async (index, name, bytes) => {
      await captions.nth(index).click();
      const chooser = page.waitForEvent("filechooser");
      await menu("重新绑定 PSD");
      await (await chooser).setFiles({ name, mimeType, buffer: bytes });
    };
    const open = async () => { await captions.first().click(); await menu("PSD 同步"); };
    const apply = async () => {
      const original = await dialog.getByRole("img", { name: "美术 PSD 合成图" }).getAttribute("src");
      await dialog.getByRole("button", { name: "预演应用", exact: true }).click();
      const output = page.waitForEvent("download");
      const confirm = dialog.getByRole("button", { name: "确认应用", exact: true });
      await page.waitForFunction(() => !document.querySelector(".sync-layout").closest("dialog").querySelector("footer button").disabled);
      const preview = await dialog.getByRole("img", { name: "美术 PSD 合成图" }).getAttribute("src");
      await confirm.click();
      const download = await output;
      await dialog.waitFor({ state: "hidden" });
      return { name: download.suggestedFilename(), bytes: await bytesOf(download), previewChanged: preview !== original };
    };
    const source = index => Buffer.from(variants[index], "base64");
    const authoredFilename = "服务器列表美术稿.psd";
    await bind(1, authoredFilename, source(0));
    await open();
    assert.equal(await dialog.getByRole("radio", { name: /更新智能对象/ }).isChecked(), true);
    const updated = await apply();
    assert.equal(updated.previewChanged, true);
    const samePlacement = objectIn(updated.bytes);
    assert.equal(samePlacement.name, componentName);
    assert.deepEqual(samePlacement.bytes, source(0));
    assert.equal(samePlacement.layer.id, initial.layer.id);
    assert.equal(samePlacement.layer.placedLayer.placed, initial.layer.placedLayer.placed);
    assert.deepEqual(samePlacement.layer.placedLayer.transform, initial.layer.placedLayer.transform);
    await open();
    await dialog.getByText("文字与结构已一致").waitFor();
    await dialog.getByRole("button", { name: "关闭同步窗" }).click();

    const manuallyEdited = await page.evaluate(async ({ root, parent, local, instanceName }) => {
      const { default: { readPsd, writePsdUint8Array } } = await import("/@fs/" + root + "/node_modules/.vite/deps/ag-psd.js");
      const { parsePsdBinary, patchPsdMetadata } = await import("/@fs/" + root + "/shared/psd-binary.ts");
      const toBytes = encoded => Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
      const bytes = toBytes(parent);
      const psd = readPsd(bytes, { useImageData: true });
      const flatten = (layers = []) => layers.flatMap(layer => [layer, ...flatten(layer.children)]);
      const layer = flatten(psd.children).find(layer => layer.name === instanceName);
      psd.linkedFiles.find(file => file.id === layer.placedLayer.id).data = toBytes(local);
      const rewritten = writePsdUint8Array(psd);
      const original = parsePsdBinary(bytes);
      const metadata = new Map(original.layers.map(layer => [layer.nativeId, layer.metadata]));
      const updated = patchPsdMetadata(rewritten, new Map(parsePsdBinary(rewritten).layers.filter(layer => metadata.get(layer.nativeId)).map(layer => [layer.key, metadata.get(layer.nativeId)])));
      return btoa(Array.from(updated, byte => String.fromCharCode(byte)).join(""));
    }, { root, parent: updated.bytes.toString("base64"), local: variants[2], instanceName });
    await bind(0, updated.name, Buffer.from(manuallyEdited, "base64"));
    await bind(1, authoredFilename, source(1));
    await open();
    await dialog.getByText("源和内嵌内容均有修改").waitFor();
    assert.equal(await dialog.getByRole("button", { name: "预演应用", exact: true }).isDisabled(), true);
    await dialog.getByRole("radio", { name: "保留当前内嵌内容" }).check();
    const kept = await apply();
    assert.deepEqual(objectIn(kept.bytes).bytes, source(2));
    await open();
    await dialog.getByText("文字与结构已一致").waitFor();
    await dialog.getByRole("button", { name: "关闭同步窗" }).click();
    await bind(1, authoredFilename, source(3));
    await open();
    await dialog.getByText("源和内嵌内容均有修改").waitFor();
    await dialog.getByRole("radio", { name: "更新智能对象", exact: true }).check();
    const resolved = await apply();
    assert.deepEqual(objectIn(resolved.bytes).bytes, source(3));
    const regeneration = page.waitForEvent("download");
    await menu("生成 PSD");
    const regenerated = objectIn(await bytesOf(await regeneration));
    assert.equal(regenerated.name, componentName);
    assert.deepEqual(regenerated.bytes, source(3));
    assert.deepEqual(errors, []);
    console.log("PASS component PSD generation, reuse, updates, conflict choices and stable placement");
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
