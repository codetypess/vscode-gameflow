const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { writePsdBuffer } = require("ag-psd");
const { chromium } = require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE || "playwright");

const pixels = { width: 30, height: 20, data: new Uint8ClampedArray(30 * 20 * 4).fill(255) };
const pixelLayer = (name, left, top) => ({ name, left, top, imageData: pixels });
const layeredPsd = writePsdBuffer({ width: 320, height: 240, children: [
  pixelLayer("背景", 0, 0),
  { name: "容器", hidden: true, children: [
    pixelLayer("图标", 20, 30),
    { name: "文字", left: 60, top: 45, imageData: pixels,
      text: { text: "确认\n购买", style: { fontSize: 18, fillColor: { r: 18, g: 52, b: 86 } } } },
  ] },
  pixelLayer("前景", 90, 100),
] });

async function run() {
  const browser = await chromium.launch({ channel: process.env.GAMEFLOW_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.addInitScript(() => {
      if (!localStorage.getItem("gameflow.prototype.v1")) localStorage.setItem("gameflow.prototype.v1", JSON.stringify({
        schemaVersion: 5, elementIdScheme: "nanoid-8", documentId: "psd-import-browser", title: "测试画布",
        requirements: [], interactions: [], pages: [
          { id: "existing", name: "已有页面", kind: "screen", frame: { x: 20, y: 10, width: 200, height: 100 }, nodes: [] },
        ],
      }));
    });
    await page.goto(process.env.GAMEFLOW_TEST_URL || "http://127.0.0.1:5191");
    const inspector = page.getByRole("status").filter({ hasText: /导入 PSD 失败|已导入/ });
    const more = page.locator(".canvas-toolbar").getByRole("button", { name: "更多", exact: true });
    const importItem = page.getByRole("menuitem", { name: "从 PSD 导入原型…" });
    const snapshot = () => page.evaluate(() => JSON.parse(localStorage.getItem("gameflow.prototype.v1")));
    const importFile = async files => {
      await more.click();
      assert.equal(await importItem.isEnabled(), true);
      const chosen = page.waitForEvent("filechooser");
      await importItem.click();
      await (await chosen).setFiles(files);
    };
    await more.waitFor();
    assert.equal(await page.locator(".page-selected").count(), 0);
    const initial = await snapshot();
    await importFile([]);
    assert.deepEqual(await snapshot(), initial);
    await importFile({ name: "bad.psd", mimeType: "application/octet-stream", buffer: Buffer.from("bad file") });
    await inspector.filter({ hasText: "导入 PSD 失败" }).waitFor();
    assert.deepEqual(await snapshot(), initial);

    await page.getByRole("button", { name: "美术 PSD资源", exact: true }).click();
    await importFile({ name: "购买.PSD", mimeType: "application/octet-stream", buffer: layeredPsd });
    await inspector.filter({ hasText: "已导入 5 个图层" }).waitFor();
    await page.getByRole("button", { name: "总览", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "原型资源", exact: true }).getAttribute("aria-pressed"), "true");
    const imported = (await snapshot()).pages.at(-1);
    assert.equal(imported.name, "购买");
    assert.deepEqual(imported.frame, { x: 300, y: 0, width: 320, height: 240 });
    assert.deepEqual(imported.nodes.map(node => [node.name, node.type]), [
      ["背景", "image"], ["容器", "container"], ["图标", "image"], ["文字", "text"], ["前景", "image"],
    ]);
    const [, group, icon, label, foreground] = imported.nodes;
    assert.deepEqual(group.frame, { x: 20, y: 30, width: 70, height: 35 });
    assert.equal(group.hidden, true);
    assert.equal(icon.hidden, undefined);
    assert.equal(icon.parentId, group.id);
    assert.equal(label.parentId, group.id);
    assert.deepEqual(label.frame, { x: 40, y: 15, width: 30, height: 20 });
    assert.equal(label.text, "确认\n购买");
    assert.equal(label.style.fontSize, 18);
    assert.equal(label.style.color, "#123456");
    const image = page.locator(`[data-node-id="${foreground.id}"] img`);
    await image.waitFor();
    assert.equal(await image.evaluate(node => node.decode().then(() => node.naturalWidth)), 30);
    assert.equal(await page.locator(`[data-node-id="${icon.id}"] img`).count(), 0);
    await page.locator(`[data-layer-id="${foreground.id}"]`).click();
    await page.getByText("内嵌图片", { exact: true }).waitFor();
    await page.getByRole("button", { name: "撤销 (Ctrl+Z)", exact: true }).click();
    await page.getByRole("button", { name: "总览", exact: true }).waitFor({ state: "hidden" });
    assert.deepEqual(await snapshot(), initial);
    await page.getByRole("button", { name: "重做 (Ctrl+Shift+Z)", exact: true }).click();
    await page.locator(`[data-page-id="${imported.id}"]`).waitFor();
    await page.reload();
    await page.locator(`[data-page-id="${imported.id}"]`).waitFor();
    assert.deepEqual((await snapshot()).pages.at(-1), imported);

    const sample = path.join(__dirname, "../sample/星海远征 · 登录.psd");
    const original = fs.readFileSync(sample);
    await importFile(sample);
    await page.getByText("已导入", { exact: false }).first().waitFor();
    await page.getByRole("button", { name: "总览", exact: true }).waitFor();
    const real = (await snapshot()).pages.at(-1);
    assert.equal(real.name, "星海远征 · 登录");
    assert.ok(real.nodes.some(node => node.type === "container"));
    assert.ok(real.nodes.some(node => node.type === "text"));
    assert.ok(real.nodes.some(node => node.imageData));
    assert.deepEqual(fs.readFileSync(sample), original);
    assert.deepEqual(pageErrors, []);
    console.log(`PSD import passed with synthetic and real files (${real.nodes.length} sample layers).`);
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
