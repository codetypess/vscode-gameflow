const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ channel: process.env.GAMEFLOW_BROWSER_CHANNEL || "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "gameflow-page-art-state-"));
  page.on("pageerror", error => errors.push(error.message));
  const document = {
    schemaVersion: 5,
    elementIdScheme: "nanoid-8",
    documentId: "artstate",
    title: "小画板资源状态",
    requirements: [],
    interactions: [],
    pages: [
      { id: "compact1", name: "短画板", kind: "screen", frame: { x: 0, y: 0, width: 378, height: 40 }, nodes: [] },
      { id: "minimal1", name: "窄画板", kind: "screen", frame: { x: 460, y: 0, width: 160, height: 40 }, nodes: [] }
    ]
  };
  try {
    await context.addInitScript(value => localStorage.setItem("gameflow.prototype.v1", JSON.stringify(value)), document);
    await page.goto((process.env.GAMEFLOW_TEST_URL || "http://127.0.0.1:5191") + "/");
    await page.getByRole("button", { name: "美术 PSD资源", exact: true }).click();
    const compact = page.locator('[data-page-id="compact1"]');
    const minimal = page.locator('[data-page-id="minimal1"]');
    await compact.locator('[data-art-layout="compact"]').waitFor();
    await minimal.locator('[data-art-layout="minimal"]').waitFor();

    for (const board of [compact, minimal]) {
      const surfaceBounds = await board.locator(".page-surface").boundingBox();
      assert.ok(surfaceBounds);
      for (const name of ["生成 PSD", "绑定 PSD"]) {
        const button = board.getByRole("button", { name, exact: true });
        const bounds = await button.boundingBox();
        assert.ok(bounds && bounds.height >= 24, `${name} remains readable on a small board`);
        assert.ok(bounds.x >= surfaceBounds.x - 1 && bounds.y >= surfaceBounds.y - 1);
        assert.ok(bounds.x + bounds.width <= surfaceBounds.x + surfaceBounds.width + 1);
        assert.ok(bounds.y + bounds.height <= surfaceBounds.y + surfaceBounds.height + 1);
      }
    }
    assert.equal(await compact.getByText("未绑定 PSD", { exact: true }).isVisible(), true);
    assert.deepEqual(await compact.locator(".page-art-action-label").allTextContents(), ["生成", "绑定"]);
    assert.equal(await minimal.locator(".page-art-action-label").first().isVisible(), false);
    assert.equal(await minimal.getByRole("button", { name: "生成 PSD", exact: true }).getAttribute("title"), "生成 PSD");
    assert.equal(await minimal.getByRole("button", { name: "绑定 PSD", exact: true }).getAttribute("title"), "绑定 PSD");
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(output, "small-page-art-states.png") });
    console.log(JSON.stringify({ passed: true, checks: ["378x40 compact actions", "160x40 minimal actions"], output }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
