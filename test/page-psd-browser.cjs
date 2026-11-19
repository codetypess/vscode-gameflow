const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { chromium } = require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 950 }, acceptDownloads: true });
  const page = await context.newPage(), errors = [], output = fs.mkdtempSync(path.join(os.tmpdir(), "gameflow-page-psd-"));
  page.on("pageerror", error => errors.push(error.message));
  const document = { schemaVersion: 5, elementIdScheme: "nanoid-8", documentId: "page-psd-browser", title: "页面 PSD 绑定", requirements: [], interactions: [], pages: [
    { id: "pagea001", name: "绿色页", kind: "screen", frame: { x: 0, y: 0, width: 320, height: 240 }, nodes: [{ id: "nodea001", name: "确认按钮", type: "button", frame: { x: 30, y: 80, width: 240, height: 60 }, normalSkin: { builtin: "button/green" } }] },
    { id: "pageb001", name: "红色页", kind: "screen", frame: { x: 390, y: 0, width: 320, height: 240 }, nodes: [{ id: "nodeb001", name: "确认按钮", type: "button", frame: { x: 30, y: 80, width: 240, height: 60 }, normalSkin: { builtin: "button/red" } }] }
  ] };
  try {
    await context.addInitScript(doc => { if (!localStorage.getItem("page-psd-test-initialized")) { localStorage.setItem("gameflow.prototype.v1", JSON.stringify(doc)); localStorage.setItem("page-psd-test-initialized", "yes"); } }, document);
    await page.goto((process.env.GAMEFLOW_TEST_URL || "http://127.0.0.1:5191") + "/");
    await page.locator(".page-group").first().waitFor();
    await page.getByRole("button", { name: "美术 PSD资源", exact: true }).click();
    assert.equal(await page.locator('[data-art-state="unbound"]').count(), 2);
    assert.equal(await page.locator(".page-surface [data-node-id]").count(), 0);
    for (const id of ["pagea001", "pageb001"]) {
      const surface = page.locator('[data-page-id="' + id + '"] .page-surface');
      assert.equal(await surface.getByRole("button", { name: "生成 PSD", exact: true }).count(), 1);
      assert.equal(await surface.getByRole("button", { name: "绑定 PSD", exact: true }).count(), 1);
    }
    await page.screenshot({ path: path.join(output, "unbound-pages.png") });
    const cancelled = page.waitForEvent("filechooser");
    await page.locator('[data-page-id="pagea001"]').getByRole("button", { name: "绑定 PSD", exact: true }).click();
    await (await cancelled).setFiles([]);
    await page.waitForFunction(() => !document.querySelector('[data-page-id="pagea001"] .page-art-state button').disabled);
    assert.equal(await page.locator('[data-art-state="unbound"]').count(), 2);
    const files = await page.evaluate(async doc => {
      const { generatePrototypePsd } = await import("/runtime/prototype-psd.ts"), { psdTask } = await import("/psd/io.ts");
      const result = [];
      for (const p of doc.pages) {
        const bytes = await generatePrototypePsd(doc, p), asset = await psdTask("read", bytes.buffer, p.id + ".psd");
        const updates = asset.layers.map(layer => [layer.key, { ...layer.metadata, slicing: { ...layer.config, exportName: "same_path" } }]);
        const patched = await psdTask("patch", bytes.buffer, p.id + ".psd", updates);
        result.push(btoa(Array.from(new Uint8Array(patched), n => String.fromCharCode(n)).join("")));
      }
      return result;
    }, document);
    for (let index = 0; index < 2; index++) {
      const id = document.pages[index].id, file = path.join(output, id + ".psd"); fs.writeFileSync(file, Buffer.from(files[index], "base64"));
      const choose = page.waitForEvent("filechooser");
      await page.locator('[data-page-id="' + id + '"]').getByRole("button", { name: "绑定 PSD", exact: true }).click();
      const chooser = await choose;
      if (index === 0) await page.locator('[data-page-id="pageb001"] .page-caption').click();
      await chooser.setFiles(file);
      await page.locator('[data-page-id="' + id + '"] canvas[data-resource-path="unclassified/same_path.png"]').waitFor();
    }
    await page.getByRole("button", { name: "撤销 (Ctrl+Z)", exact: true }).click();
    await page.locator('[data-page-id="pageb001"] [data-art-state="unbound"]').waitFor();
    assert.equal(await page.locator('[data-page-id="pagea001"] canvas[data-resource-path="unclassified/same_path.png"]').count(), 1);
    await page.getByRole("button", { name: "重做 (Ctrl+Shift+Z)", exact: true }).click();
    await page.locator('[data-page-id="pageb001"] canvas[data-resource-path="unclassified/same_path.png"]').waitFor();
    const pixels = await page.locator('.page-surface canvas[data-resource-path="unclassified/same_path.png"]').evaluateAll(canvases => canvases.map(canvas => Array.from(canvas.getContext("2d").getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data)));
    assert.equal(pixels.length, 2); assert.notDeepEqual(pixels[0], pixels[1], "same output names retain each page's own art pixels");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("gameflow.prototype.v1")));
    assert.equal(saved.pages[0].artPsd.source, "pagea001.psd"); assert.equal(saved.pages[1].artPsd.source, "pageb001.psd");
    assert.notEqual(saved.pages[0].artPsd.documentId, saved.pages[1].artPsd.documentId);
    await page.screenshot({ path: path.join(output, "two-bound-pages.png") });
    await page.getByRole("button", { name: "运行预览", exact: true }).click();
    const runtime = page.getByRole("dialog", { name: "运行预览", exact: true });
    await runtime.locator('canvas[data-resource-path="unclassified/same_path.png"]').waitFor();
    await runtime.getByRole("combobox", { name: "预览页面", exact: true }).selectOption("pagea001");
    await page.waitForFunction(expected => { const canvas = document.querySelector('.runtime-page canvas[data-resource-path="unclassified/same_path.png"]'); return canvas && JSON.stringify(Array.from(canvas.getContext("2d").getImageData(canvas.width/2,canvas.height/2,1,1).data)) === JSON.stringify(expected); }, pixels[0]);
    const first = await runtime.locator('canvas[data-resource-path="unclassified/same_path.png"]').evaluate(canvas => Array.from(canvas.getContext("2d").getImageData(canvas.width/2,canvas.height/2,1,1).data));
    await runtime.getByRole("combobox", { name: "预览页面", exact: true }).selectOption("pageb001");
    await page.waitForFunction(before => { const canvas = document.querySelector('.runtime-page canvas[data-resource-path="unclassified/same_path.png"]'); return canvas && JSON.stringify(Array.from(canvas.getContext("2d").getImageData(canvas.width/2,canvas.height/2,1,1).data)) !== JSON.stringify(before); }, first);
    await runtime.getByRole("button", { name: "关闭运行预览", exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: "美术 PSD资源", exact: true }).click();
    await page.locator('[data-art-state="error"]').first().waitFor(); assert.equal(await page.locator('[data-art-state="error"]').count(), 2);
    assert.match(await page.locator(".page-art-state-card").first().innerText(), /重新选择本地 PSD/);
    // Rebinding from the page error restores only that page.
    const choose = page.waitForEvent("filechooser"); await page.locator('[data-page-id="pagea001"]').getByRole("button", { name: "重新绑定 PSD", exact: true }).click();
    await (await choose).setFiles(path.join(output, "pagea001.psd"));
    await page.locator('[data-page-id="pagea001"] canvas[data-resource-path="unclassified/same_path.png"]').waitFor();
    assert.equal(await page.locator('[data-art-state="error"]').count(), 1);
    await page.getByRole("button", { name: "原型资源", exact: true }).click();
    assert.equal(await page.locator(".page-art-state").count(), 0); await page.locator('canvas[data-resource-path="builtin/button/red.png"]').waitFor();
    // Generation saves and binds the targeted page, independent of selection.
    await page.getByRole("button", { name: "美术 PSD资源", exact: true }).click();
    const download = page.waitForEvent("download"); await page.locator('[data-page-id="pageb001"] .page-caption').click();
    await page.getByRole("button", { name: "生成 PSD", exact: true }).click(); await download;
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("gameflow.prototype.v1")).pages[1].artPsd.source !== "pageb001.psd");
    await page.locator('[data-page-id="pageb001"] canvas[data-resource-path^="unclassified/img_"]').waitFor();
    await page.setViewportSize({ width: 520, height: 760 }); await page.screenshot({ path: path.join(output, "narrow.png") });
    await page.goto((process.env.GAMEFLOW_TEST_URL || "http://127.0.0.1:5191") + "/@fs/" + path.join(__dirname, "runtime-preview-browser.html").replaceAll("\\", "/"));
    await page.getByRole("button", { name: "执行像素验收", exact: true }).click();
    await page.waitForFunction(() => { const text = document.querySelector("pre")?.textContent ?? ""; return text.includes("FAIL") || text.split("PASS").length === 8; });
    assert.doesNotMatch(await page.locator("pre").innerText(), /FAIL/);
    await page.getByRole("button", { name: "打开运行预览", exact: true }).click();
    await page.locator('.runtime-page canvas[data-resource-path="unclassified/btn_test.png"]').waitFor();
    await page.getByRole("button", { name: "关闭运行预览", exact: true }).click();
    await page.getByRole("button", { name: "资源改名", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "资源已改名或移动" }).waitFor();
    assert.deepEqual(errors, []); console.log("PASS page PSD: unbound actions, stable binding, same-path isolation, runtime page switch, persistence, reload error/rebind, prototype fallback, generated PSD binding; artifacts: " + output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
