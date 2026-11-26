const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { writePsdBuffer } = require("ag-psd");
const { chromium } = require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE || "playwright");

function pixels(width, height, rgb) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) data.set([...rgb, 255], offset);
  return { width, height, data };
}

async function main() {
  const file = { name: "button.psd", mimeType: "image/vnd.adobe.photoshop",
    buffer: writePsdBuffer({ width: 64, height: 40, children: [
      { id: 1, name: "Start", children: [
        { id: 2, name: "@normal", children: [
          { id: 3, name: "描边", left: 8, top: 4, imageData: pixels(40, 20, [60, 80, 100]) },
          { id: 4, name: "高光", left: 10, top: 4, imageData: pixels(20, 4, [180, 200, 220]) },
        ] },
        { id: 5, name: "按钮文案", left: 8, top: 28, imageData: pixels(10, 4, [255, 255, 255]) },
      ] },
    ] }) };
  const { createServer } = await import("vite");
  const server = await createServer({ server: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ channel: process.env.GAMEFLOW_BROWSER_CHANNEL || "msedge", headless: true });
    const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    await page.goto(server.resolvedUrls.local[0]);
    const open = async () => {
      await page.getByRole("button", { name: /^工作台模式：/ }).click();
      await page.getByRole("menuitem", { name: "PSD 切图", exact: true }).click();
      await page.getByLabel("打开切图 PSD", { exact: true }).setInputFiles(file);
    };
    await open();
    const row = name => page.getByRole("tree").getByRole("button", { name, exact: true });
    const composite = page.getByRole("checkbox", { name: "合成图片", exact: true });
    const marked = page.getByRole("checkbox", { name: "标记为切图", exact: true });
    await row("高光").click();
    await marked.check();
    assert.equal(await composite.count(), 0);
    await row("@normal").click();
    await marked.uncheck();
    await composite.check();
    await row("高光").waitFor({ state: "detached" });
    assert.equal(await row("描边").count(), 0);
    assert.equal(await row("按钮文案").count(), 1);
    assert.equal(await marked.isChecked(), true);
    assert.equal(await row("@normal").locator("..").getAttribute("aria-expanded"), null);
    await page.getByRole("button", { name: /^撤销/ }).click();
    await row("高光").waitFor();
    await page.getByRole("button", { name: /^重做/ }).click();
    await row("高光").waitFor({ state: "detached" });

    await row("按钮文案").click();
    const direct = page.getByRole("button", { name: "直选模式", exact: true });
    if (await direct.getAttribute("aria-pressed") !== "true") await direct.click();
    const box = await page.locator(".psd-page-preview").boundingBox();
    await page.mouse.click(box.x + box.width * 15 / 64, box.y + box.height * 6 / 40);
    await composite.waitFor();
    assert.equal(await composite.isChecked(), true);

    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "保存 (Ctrl+S)", exact: true }).click();
    const saved = JSON.parse(await fs.readFile(await (await downloading).path(), "utf8"));
    const result = await page.evaluate(async ({ bytes, saved }) => {
      const { openPsd } = await import("/psd/io.ts");
      const { renderSliceExportBatch, loadSliceImage } = await import("/psd/slice-render.ts");
      const { applySidecar } = await import("/@fs/" + saved.root + "/shared/psd-meta.ts");
      const source = new File([Uint8Array.from(atob(bytes), c => c.charCodeAt(0))], "button.psd");
      const { asset } = await openPsd(source);
      const batch = await renderSliceExportBatch(applySidecar(asset, saved.config));
      const png = await loadSliceImage("data:image/png;base64," + batch.items[0].base64);
      const canvas = document.createElement("canvas");
      canvas.width = png.width; canvas.height = png.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(png, 0, 0);
      return { names: batch.items.map(item => item.name), size: [png.width, png.height],
        stroke: [...ctx.getImageData(0, 0, 1, 1).data], highlight: [...ctx.getImageData(2, 0, 1, 1).data] };
    }, { bytes: file.buffer.toString("base64"), saved: { config: saved, root: process.cwd().replaceAll("\\", "/") } });
    assert.deepEqual(result, { names: ["button_start_normal"], size: [40, 20],
      stroke: [60, 80, 100, 255], highlight: [180, 200, 220, 255] });

    await page.reload();
    await open();
    await row("@normal").click();
    assert.equal(await composite.isChecked(), true);
    await composite.uncheck();
    await row("高光").click();
    assert.equal(await marked.isChecked(), true);
    console.log("PASS composite image tree, selection, undo/redo, saved settings and exported state pixels");
  } finally {
    await browser?.close();
    await server.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
