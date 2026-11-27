const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ channel: process.env.GAMEFLOW_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 940 } });
    page.setDefaultTimeout(10000);
    const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const prototype = [".layer-panel", ".inspector"], slice = [".psd-tree-panel", ".psd-properties"];
    async function widths(selectors) {
      await settle();
      return Promise.all(selectors.map(async selector => Math.round((await page.locator(selector).boundingBox()).width)));
    }
    async function drag(selector, edge, dx) {
      const handle = page.locator(selector).locator(`.panel-resize-edge[data-edge=${edge}]`);
      const { x, y, width, height } = await handle.boundingBox();
      const start = x + width / 2, center = y + height / 2;
      await page.mouse.move(start, center);
      await page.mouse.down();
      await page.mouse.move(start + dx, center, { steps: 5 });
      await page.mouse.up();
      await settle();
    }
    async function assertDocked(selector, side, artwork, viewport) {
      const panel = await page.locator(selector).boundingBox();
      const board = await artwork.boundingBox();
      const canvas = await page.locator(viewport).boundingBox();
      const expectedX = side === "left"
        ? Math.max(canvas.x + 12, board.x - 16 - panel.width)
        : Math.min(canvas.x + canvas.width - 12 - panel.width, board.x + board.width + 16);
      assert.ok(Math.abs(panel.x - expectedX) <= 1, `${selector} should dock at ${expectedX} after release, got ${panel.x}`);
    }
    async function mode(name) {
      await page.getByRole("button", { name: /^工作台模式/ }).click();
      await page.getByRole("menuitem", { name, exact: true }).click();
    }
    async function openPsd() {
      await mode("PSD 切图");
      await page.getByLabel("打开切图 PSD", { exact: true }).setInputFiles(path.join(__dirname, "../examples/psd-metadata/GameFlow-PSD-Metadata-Sample.psd"));
      await page.locator(slice[0]).waitFor();
    }
    const url = new URL(process.env.GAMEFLOW_TEST_URL || "http://127.0.0.1:5191");
    url.searchParams.set("sample", "ui-components");
    await page.goto(url.href);
    await page.locator(".page-caption").first().dblclick();
    assert.deepEqual(await widths(prototype), [280, 280]);
    const board = page.locator(".page-editing");
    const before = await board.boundingBox();
    await drag(prototype[0], "right", 120);
    await assertDocked(prototype[0], "left", board, ".canvas-viewport");
    await drag(prototype[1], "left", -70);
    assert.deepEqual(await widths(prototype), [400, 350]);
    assert.deepEqual(await board.boundingBox(), before);
    await drag(prototype[0], "left", 20);
    await drag(prototype[1], "right", -20);
    assert.deepEqual(await widths(prototype), [380, 330]);
    // The inspector now docks against the viewport's right margin after shrinking.
    await drag(prototype[1], "left", -20);
    await drag(prototype[0], "right", -180);
    assert.deepEqual(await widths(prototype), [280, 350]);
    await drag(prototype[0], "right", 120);
    await page.setViewportSize({ width: 460, height: 880 });
    const narrow = await widths(prototype);
    assert.equal(narrow[0], narrow[1]);
    assert(narrow[0] < 280);
    await page.setViewportSize({ width: 1600, height: 940 });
    assert.deepEqual(await widths(prototype), [400, 350]);

    await openPsd();
    assert.deepEqual(await widths(slice), [278, 278]);
    await drag(slice[1], "left", -90);
    await drag(slice[0], "right", 70);
    assert.deepEqual(await widths(slice), [348, 368]);
    await drag(slice[1], "left", 160);
    assert.deepEqual(await widths(slice), [348, 278]);
    await assertDocked(slice[1], "right", page.locator(".psd-page-preview"), ".psd-slice-canvas");
    await drag(slice[1], "left", -90);
    await mode("原型");
    assert.deepEqual(await widths(prototype), [400, 350]);

    await page.reload();
    await page.locator(".page-caption").first().click();
    assert.deepEqual(await widths([".inspector"]), [350]);
    await drag(prototype[1], "left", 50);
    assert.deepEqual(await widths([".inspector"]), [300]);
    await assertDocked(prototype[1], "right", page.locator(".page-selected"), ".canvas-viewport");
    await drag(prototype[1], "left", -50);
    await page.locator(".page-caption").first().dblclick();
    assert.deepEqual(await widths(prototype), [400, 350]);
    await openPsd();
    assert.deepEqual(await widths(slice), [348, 368]);
    console.log("PASS independent prototype and slice panel dragging, minimum widths, narrow viewport and reload");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
