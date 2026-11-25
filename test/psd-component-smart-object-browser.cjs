const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { readPsd } = require("ag-psd");
const { chromium } = require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE || "playwright");

const readOptions = { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true };
const flatten = (layers = []) => layers.flatMap(layer => [layer, ...flatten(layer.children)]);
const decode = base64 => readPsd(Buffer.from(base64, "base64"), readOptions);

async function main() {
  const browser = await chromium.launch({ channel: process.env.GAMEFLOW_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1320, height: 920 } });
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(process.env.GAMEFLOW_TEST_URL || "http://127.0.0.1:5197");
    const root = resolve(__dirname, "..").replaceAll("\\", "/");
    const document = JSON.parse(readFileSync(resolve(root, "sample/star-sea-login.gameflow.json"), "utf8"));
    const files = await page.evaluate(async ({ document, root }) => {
      const { composeCanvasPage } = await import("/@fs/" + root + "/shared/canvas-instances.ts");
      const { psdComponentInstances } = await import("/@fs/" + root + "/shared/page-sync.ts");
      const { generatePrototypePsd } = await import("/runtime/prototype-psd.ts");
      const { psdTask } = await import("/psd/io.ts");
      const base = document.pages[0];
      const instance = base.nodes.find(node => node.variableName === "serverList");
      const duplicate = (id, name, y) => ({ ...instance, id, name, variableName: id, frame: { ...instance.frame, y } });
      const many = { ...base, nodes: [...base.nodes, { ...duplicate("samecopy", "Same", 250), transform: { rotation: 12 } }, duplicate("otherone", "Variant", 310)] };
      const composition = composeCanvasPage(document, many, {});
      const variant = composition.page.nodes.find(node => node.parentId === "otherone" && node.type === "text");
      variant.text = "Variant text";
      const asBase64 = bytes => {
        let binary = "";
        for (let index = 0; index < bytes.length; index += 4096) binary += String.fromCharCode(...bytes.subarray(index,index+4096));
        return btoa(binary);
      };
      const generated = await generatePrototypePsd(document, composition.page, psdComponentInstances(composition));
      const generatedAsset = await psdTask("read", generated.slice().buffer, "generated.psd");
      const ids = generatedAsset.layers.map(layer => layer.metadata.layerId);
      if (new Set(ids).size !== ids.length || ids.some(id => !/^[a-z0-9]{8}$/.test(id)))
        throw new Error("Generated PSD must have unique eight-character layer IDs: " + ids.join(", "));
      const regenerated = await generatePrototypePsd(document, composition.page, psdComponentInstances(composition), {
        previous: generatedAsset.layers.map(layer => layer.metadata)
      });
      const regeneratedAsset = await psdTask("read", regenerated.slice().buffer, "regenerated.psd");
      if (JSON.stringify(regeneratedAsset.layers.map(layer => layer.metadata.layerId)) !== JSON.stringify(ids))
        throw new Error("Regeneration changed the IDs of existing prototype layers.");
      const legacyPage = composeCanvasPage(document, base, {}).page;
      legacyPage.nodes.find(node => node.parentId === instance.id && node.type === "text").text = "Art-authored text";
      const legacy = await generatePrototypePsd(document, legacyPage);
      const asset = await psdTask("read", legacy.slice().buffer, "legacy.psd");
      base.artPsd = { source: "legacy.psd", documentId: asset.documentId };
      delete base.psdSync;
      localStorage.setItem("gameflow.prototype.v1", JSON.stringify(document));
      return { generated: asBase64(generated), legacy: asBase64(legacy) };
    }, { document, root });

    const generated = decode(files.generated);
    const instances = generated.children.filter(layer => layer.placedLayer);
    assert.equal(instances.length, 3);
    assert.equal(instances[0].placedLayer.id, instances[1].placedLayer.id);
    assert.notEqual(instances[0].placedLayer.placed, instances[1].placedLayer.placed);
    assert.notEqual(instances[1].placedLayer.transform[1], instances[1].placedLayer.transform[3], "placement stores the instance rotation");
    assert.notEqual(instances[0].placedLayer.id, instances[2].placedLayer.id);
    assert.equal(new Set(instances.map(layer => layer.placedLayer.id)).size, 2);
    const componentFile = generated.linkedFiles.find(file => file.id === instances[0].placedLayer.id);
    assert.equal(componentFile.name, "服务器列表项.psd");
    assert.equal(generated.linkedFiles.find(file => file.id === instances[2].placedLayer.id).name, componentFile.name);
    assert.ok(flatten(readPsd(componentFile.data, readOptions).children).some(layer => layer.text));

    await page.reload();
    await page.locator(".page-caption").first().click();
    async function menu(item) {
      await page.getByRole("button", { name: "更多", exact: true }).click();
      await page.getByRole("menuitem", { name: item, exact: true }).click();
    }
    const chooser = page.waitForEvent("filechooser");
    await menu("重新绑定 PSD");
    await (await chooser).setFiles({ name: "legacy.psd", mimeType: "image/vnd.adobe.photoshop", buffer: Buffer.from(files.legacy,"base64") });
    await menu("PSD 同步");
    const dialog = page.getByRole("dialog", { name: "PSD 同步" });
    await dialog.getByRole("radio", { name: /转换为智能对象/ }).waitFor();
    await dialog.getByRole("button", { name: "预演应用", exact: true }).click();
    await dialog.getByRole("img", { name: "美术 PSD 合成图" }).waitFor();
    const download = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "确认应用", exact: true }).click({ timeout: 10000 })
      .catch(error => { throw new Error("同步预演失败 " + error.message); });
    const convertedDownload = await download;
    const output = Buffer.concat(await Array.fromAsync(await convertedDownload.createReadStream()));
    await dialog.waitFor({ state: "hidden" });
    const converted = readPsd(output, readOptions);
    const object = flatten(converted.children).find(layer => layer.name === "服务器列表项");
    assert.ok(object?.placedLayer);
    const file = converted.linkedFiles.find(file => file.id === object.placedLayer.id);
    assert.ok(flatten(readPsd(file.data, readOptions).children).some(layer => layer.text?.text === "Art-authored text"));
    await menu("PSD 同步");
    await dialog.getByText("文字与结构已一致").waitFor();
    await dialog.getByRole("button", { name: "关闭同步窗" }).click();

    await page.evaluate(() => {
      const document = JSON.parse(localStorage.getItem("gameflow.prototype.v1"));
      const { nodes } = document.pages[0];
      const title = nodes.find(node => node.type === "text" && node.text?.includes("星海远征"));
      title.text = "测试更新主标题";
      const original = nodes.find(node => node.variableName === "serverList");
      nodes.push({ ...original, id: "newsmart", name: "新增组件", variableName: "newSmart", frame: { ...original.frame, y: 245 } });
      localStorage.setItem("gameflow.prototype.v1", JSON.stringify(document));
    });
    await page.reload();
    await page.locator(".page-caption").first().click();
    const reassociate = page.waitForEvent("filechooser");
    await menu("重新绑定 PSD");
    await (await reassociate).setFiles({ name: convertedDownload.suggestedFilename(), mimeType: "image/vnd.adobe.photoshop", buffer: output });
    await menu("PSD 同步");
    await dialog.getByRole("button", { name: "预演应用", exact: true }).click();
    const nextDownload = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "确认应用", exact: true }).click();
    const rewrittenDownload = await nextDownload;
    const nextBytes = Buffer.concat(await Array.fromAsync(await rewrittenDownload.createReadStream()));
    const rewritten = readPsd(nextBytes, readOptions);
    const kept = flatten(rewritten.children).find(layer => layer.name === "服务器列表项");
    assert.deepEqual(kept.placedLayer, object.placedLayer);
    assert.deepEqual(rewritten.linkedFiles.find(item => item.id === file.id).data, file.data);
    const added = flatten(rewritten.children).find(layer => layer.name === "新增组件");
    assert.ok(added?.placedLayer);
    assert.notEqual(added.placedLayer.id, object.placedLayer.id);
    assert.equal(rewritten.linkedFiles.find(item => item.id === added.placedLayer.id)?.name, "服务器列表项.psd");
    const layerIds = await page.evaluate(async ({ before, after }) => {
      const { psdTask } = await import("/psd/io.ts");
      async function identities(base64) {
        const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
        const asset = await psdTask("read", bytes.buffer, "sync.psd");
        return Object.fromEntries(asset.layers.map(layer => [layer.name, layer.metadata.layerId]));
      }
      return { before: await identities(before), after: await identities(after) };
    }, { before: output.toString("base64"), after: nextBytes.toString("base64") });
    assert.match(layerIds.after["新增组件"], /^[a-z0-9]{8}$/);
    assert.equal(layerIds.after["服务器列表项"], layerIds.before["服务器列表项"]);
    assert.ok(flatten(rewritten.children).some(layer => layer.text?.text === "测试更新主标题"));
    await dialog.waitFor({ state: "hidden" });

    await page.evaluate(() => {
      const document = JSON.parse(localStorage.getItem("gameflow.prototype.v1"));
      const instance = document.pages[0].nodes.find(node => node.variableName === "serverList");
      const template = document.pages.find(page => page.id === instance.prefab.pageId);
      template.nodes.splice(1, 0, { id: "testpic1", parentId: template.componentRootId, type: "image", name: "新增图片",
        frame: { x: 5, y: 7, width: 22, height: 18 }, image: { builtin: "image/default" } });
      localStorage.setItem("gameflow.prototype.v1", JSON.stringify(document));
    });
    await page.reload();
    await page.locator(".page-caption").first().click();
    const reopen = page.waitForEvent("filechooser");
    await menu("重新绑定 PSD");
    await (await reopen).setFiles({ name: rewrittenDownload.suggestedFilename(), mimeType: "image/vnd.adobe.photoshop", buffer: nextBytes });
    await menu("PSD 同步");
    await dialog.locator(".layer-name").filter({ hasText: /^服务器列表项/ }).first().click();
    await dialog.getByRole("radio", { name: /补入智能对象/ }).waitFor();
    await dialog.getByText("新增图片", { exact: true }).waitFor();
    await dialog.getByRole("button", { name: "预演应用", exact: true }).click();
    const [updateDownload] = await Promise.all([
      page.waitForEvent("download"),
      dialog.getByRole("button", { name: "确认应用", exact: true }).click({ timeout: 8000 })
    ]).catch(async error => { throw new Error(await dialog.innerText(), { cause: error }); });
    const updateBytes = Buffer.concat(await Array.fromAsync(await updateDownload.createReadStream()));
    const updated = readPsd(updateBytes, readOptions);
    const updatedObject = flatten(updated.children).find(layer => layer.name === "服务器列表项");
    assert.equal(updatedObject.id, object.id);
    assert.equal(updatedObject.placedLayer.placed, object.placedLayer.placed);
    assert.deepEqual(updatedObject.placedLayer.transform, object.placedLayer.transform);
    const contentsFile = updated.linkedFiles.find(item => item.id === updatedObject.placedLayer.id);
    const updatedContents = flatten(readPsd(contentsFile.data, readOptions).children);
    assert.ok(updatedContents.some(layer => layer.name === "新增图片"));
    assert.ok(updatedContents.some(layer => layer.text?.text === "Art-authored text"));
    await dialog.waitFor({ state: "hidden" });
    await menu("PSD 同步");
    await dialog.getByText("文字与结构已一致").waitFor();
    await dialog.getByRole("button", { name: "关闭同步窗" }).click();

    await menu("PSD 切图");
    const slicing = page.getByRole("region", { name: "PSD 切图工作区" });
    const tree = slicing.getByRole("tree");
    const row = tree.getByRole("treeitem").filter({ has: page.getByRole("button", { name: "服务器列表项", exact: true }) });
    await row.waitFor();
    assert.equal(await row.getAttribute("aria-expanded"), "true");
    const contents = row.locator("..").getByRole("group", { name: "智能对象内容（只读）" });
    await contents.getByRole("treeitem").getByText("服务器名称", { exact: true }).waitFor();
    assert.equal(await contents.getByRole("checkbox").count(), 0);
    await row.getByRole("button", { name: "折叠服务器列表项" }).click();
    assert.equal(await contents.count(), 0);
    await row.getByRole("button", { name: "展开服务器列表项" }).click();
    await contents.getByText("服务器名称", { exact: true }).waitFor();
    await row.getByRole("button", { name: "服务器列表项", exact: true }).click();
    const info = slicing.getByRole("region", { name: "图层信息" });
    await info.getByText(/智能对象 · 378 × 40/).waitFor();
    assert.equal(await info.getByText(layerIds.after["服务器列表项"], { exact: true }).count(), 1);
    assert.deepEqual(errors, []);
    console.log("PASS embedded templates, conversion, later sync and read-only smart object hierarchy in the slice workspace");
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
