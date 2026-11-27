const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { chromium } = require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ channel: process.env.GAMEFLOW_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1300, height: 850 }, deviceScaleFactor: 2 });
    await page.addInitScript(() => {
      const tile = document.createElement("canvas");
      tile.width = tile.height = 1;
      const ctx = tile.getContext("2d");
      ctx.fillStyle = "#ff00aa";
      ctx.fillRect(0, 0, 1, 1);
      const board = { id: "snapshot", name: "登录/快照", kind: "screen", background: "transparent",
        frame: { x: 0, y: 0, width: 240, height: 180 }, nodes: [
          { id: "graphic1", name: "图片", type: "image", imageData: tile.toDataURL(), frame: { x: 5, y: 5, width: 30, height: 30 } },
          { id: "builtin1", name: "按钮", type: "button", normalSkin: { builtin: "button/gray" }, frame: { x: 40, y: 5, width: 100, height: 40 } },
          { id: "caption1", name: "文字", type: "text", text: "登录", style: { color: "#00ff00", fontSize: 25 }, frame: { x: 10, y: 72, width: 110, height: 40 } },
          { id: "outline1", name: "容器", type: "container", frame: { x: 160, y: 70, width: 30, height: 30 } },
          { id: "bottom01", name: "边角图片", type: "image", imageData: tile.toDataURL(), frame: { x: 230, y: 170, width: 12, height: 12 } }
        ] };
      localStorage.setItem("gameflow.prototype.v1", JSON.stringify({ schemaVersion: 5, elementIdScheme: "nanoid-8", documentId: "snapshot-test",
        title: "画板快照", requirements: [], interactions: [], pages: [
          { ...board, id: "another1", name: "另一张画板", frame: { x: 280, y: 0, width: 160, height: 90 }, background: "#123456", nodes: [] }, board
        ] }));
    });
    await page.goto(process.env.GAMEFLOW_TEST_URL || "http://127.0.0.1:5198");
    const board = page.locator('[data-page-id="snapshot"]');
    await board.locator('canvas[data-resource-path]').waitFor();
    const expectedButton = await board.locator("canvas").evaluate(el =>
      Array.from(el.getContext("2d").getImageData(el.width / 2, el.height / 2, 1, 1).data));
    assert.equal(expectedButton[3], 255);
    const before = await page.evaluate(() => localStorage.getItem("gameflow.prototype.v1"));
    await page.getByRole("button", { name: "虚线框", exact: true }).click();
    await page.getByRole("button", { name: "缩小", exact: true }).click();
    await page.locator('[data-page-id="another1"] .page-caption').click();
    await board.click({ button: "right", position: { x: 10, y: 10 } });
    const menu = page.getByRole("menu", { name: "画板右键菜单" });
    const items = await menu.getByRole("menuitem").allTextContents();
    assert.equal(items[items.indexOf("重命名画板") + 1], "另存为 PNG 快照…");
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 8000 }), menu.getByText("另存为 PNG 快照…").click()
    ]);
    assert.equal(download.suggestedFilename(), "登录_快照.png");
    const png = await fs.readFile(await download.path());
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [240, 180]);
    const pixels = await page.evaluate(async base64 => {
      const image = new Image();
      image.src = "data:image/png;base64," + base64;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0);
      const pixel = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data);
      const text = ctx.getImageData(10, 72, 110, 40).data;
      const guides = ctx.getImageData(155, 65, 40, 40).data;
      return { corner: pixel(0, 0), tile: pixel(20, 20), bottom: pixel(239, 179), button: pixel(90, 25),
        text: text.some((v, i) => i % 4 === 1 && v === 255 && text[i + 2] > 0),
        guides: guides.some((v, i) => i % 4 === 3 && v > 0) };
    }, png.toString("base64"));
    assert.deepEqual(pixels, { corner: [0, 0, 0, 0], tile: [255, 0, 170, 255], bottom: [255, 0, 170, 255],
      button: expectedButton, text: true, guides: false });
    assert.equal(await page.evaluate(() => localStorage.getItem("gameflow.prototype.v1")), before);
    console.log("PASS right-click PNG download, logical size, text, canvas and image pixels, transparency and guide exclusion");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
