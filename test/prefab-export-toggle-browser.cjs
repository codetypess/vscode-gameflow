const assert = require("node:assert/strict");
const { chromium } = require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const { createServer } = await import("vite");
  const server = await createServer({ server: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
  await server.listen();
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.GAMEFLOW_BROWSER_CHANNEL || "msedge", headless: true });
    const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
    await page.addInitScript(() => {
      const key = "gameflow.prototype.v1";
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({
        schemaVersion: 5, elementIdScheme: "nanoid-8", documentId: "export-toggle-browser",
        title: "导出测试", requirements: [], interactions: [],
        pages: [{ id: "page0001", name: "登录", exportName: "Login", kind: "screen", frame: { x: 0, y: 0, width: 320, height: 240 },
          nodes: [
            { id: "group001", name: "设计参考", type: "container", frame: { x: 10, y: 10, width: 200, height: 90 } },
            { id: "text0001", parentId: "group001", name: "说明", type: "text", text: "设计说明", frame: { x: 10, y: 8, width: 100, height: 30 } },
            { id: "text0002", name: "标题", type: "text", text: "登录", frame: { x: 10, y: 120, width: 100, height: 30 } }
          ]
        }]
      }));
      let index = 0;
      window.showDirectoryPicker = async () => (await navigator.storage.getDirectory())
        .getDirectoryHandle(["resources", "prefabs"][index++], { create: true });
    });
    await page.goto("http://127.0.0.1:" + server.httpServer.address().port);
    const button = name => page.getByRole("button", { name, exact: true });
    const openPrefab = async () => {
      await button("更多").click();
      await page.getByRole("menuitem", { name: "预制体同步", exact: true }).click();
    };
    const readPrefab = () => page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle("prefabs");
      return JSON.parse(await (await (await dir.getFileHandle("Login.lh")).getFile()).text());
    });
    await page.locator(".page-caption").dblclick();
    await button("工作台设置").click();
    await button("选择资源导出根目录").click();
    await button("选择预制体导出根目录").click();
    await button("完成").click();
    const row = page.locator('[data-layer-id="group001"]');
    await row.click();
    await row.getByRole("button", { name: "展开设计参考" }).click();
    const color = locator => locator.evaluate(element => getComputedStyle(element).color);
    const muted = await color(page.locator(".layer-panel .tree-root small"));
    const assertBranchMuted = async expected => {
      for (const id of ["group001", "text0001"]) {
        assert.equal(await color(page.locator(`[data-layer-id="${id}"] .layer-name`)) === muted, expected, id);
      }
      assert.notEqual(await color(page.locator('[data-layer-id="text0002"] .layer-name')), muted);
    };
    await assertBranchMuted(false);
    const toggle = page.getByRole("checkbox", { name: "导出节点", exact: true });
    const variableBounds = await page.getByRole("textbox", { name: "变量", exact: true }).boundingBox();
    const toggleBounds = await toggle.boundingBox();
    assert(toggleBounds && variableBounds && toggleBounds.y > variableBounds.y + variableBounds.height);
    assert(await toggle.isChecked());
    await openPrefab();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("gameflow.prototype.v1")).pages[0].prefabSync);
    assert((await readPrefab())._$child.some(node => node._$id === "group001"));

    await toggle.uncheck();
    await assertBranchMuted(true);
    await button("撤销 (Ctrl+Z)").click();
    await toggle.and(page.locator(":checked")).waitFor();
    await assertBranchMuted(false);
    await button("重做 (Ctrl+Shift+Z)").click();
    await toggle.and(page.locator(":not(:checked)")).waitFor();
    await assertBranchMuted(true);
    const designNode = page.locator('.page-editing [data-node-id="text0001"]');
    assert(await designNode.isVisible());

    await openPrefab();
    const dialog = page.getByRole("dialog", { name: "预制体同步", exact: true });
    await dialog.getByText("确认应用时将从预制体移除 1 个取消导出的控件分支。").waitFor();
    assert.equal(await dialog.getByText("设计参考", { exact: true }).count(), 0);
    await dialog.getByRole("button", { name: "预演应用", exact: true }).click();
    assert.equal(await dialog.locator('[data-node-id="group001"], [data-node-id="text0001"]').count(), 0);
    await dialog.getByRole("button", { name: "确认应用", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.deepEqual((await readPrefab())._$child.map(node => node._$id), ["text0002"]);
    assert(await designNode.isVisible());
    await page.reload();
    await page.locator(".page-caption").dblclick();
    await row.click();
    assert.equal(await toggle.isChecked(), false);
    await row.getByRole("button", { name: "展开设计参考" }).click();
    await assertBranchMuted(true);
    await toggle.check();
    await assertBranchMuted(false);
    console.log("PASS prefab export checkbox defaults, layer tree colors, undo/redo, previews, file filtering and reload");
  } finally {
    await browser?.close();
    await server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
