const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { chromium } = require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ channel: process.env.GAMEFLOW_BROWSER_CHANNEL || "msedge", headless: true });
  const output = path.resolve(__dirname, "../dist/workbench-plugin-update");
  fs.mkdirSync(output, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const errors = [];
  await context.addInitScript(() => {
    window.__updateMessages = [];
    window.__updateState = { status: "current" };
    window.acquireVsCodeApi = () => ({ getState() {}, setState() {}, postMessage(message) {
      window.__updateMessages.push(message);
      const send = data => setTimeout(() => window.dispatchEvent(new MessageEvent("message", { data })), 0);
      if (message.type === "ready") send({ type: "init", document: { schemaVersion: 5, elementIdScheme: "nanoid-8", documentId: "update-test", title: "更新测试", requirements: [], interactions: [], pages: [
        { id: "page0001", name: "登录页", kind: "screen", frame: { x: 0, y: 0, width: 320, height: 240 }, nodes: [] }
      ] }, documentVersion: 1, dirty: false, resourceName: "update.gameflow.json" });
      if (message.type === "workbenchSettings") send({ type: "workbenchSettingsResult", requestId: message.requestId, settings: {} });
      if (message.type === "extensionUpdateReady") send({ type: "extensionUpdateState", state: window.__updateState });
      if (message.type === "save") send({ type: "commandCompleted", action: "save" });
    } });
  });
  const url = process.env.GAMEFLOW_TEST_URL || "http://127.0.0.1:5197";
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.route(url + "/", async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace("<head>", '<head><meta name="gameflow-extension-version" content="9.8.7">') });
  });
  const send = state => page.evaluate(state => { window.__updateState = state; window.dispatchEvent(new MessageEvent("message", { data: { type: "extensionUpdateState", state } })); }, state);
  const button = page.getByRole("button", { name: "更新插件", exact: true });
  const trigger = page.getByRole("button", { name: /^工作台模式：/ });
  const mode = async name => { await trigger.click(); await page.getByRole("menuitem", { name, exact: true }).click(); };
  const installs = () => page.evaluate(() => window.__updateMessages.filter(m => m.type === "installExtensionUpdate").length);
  try {
    await page.goto(url);
    await page.locator(".page-group").waitFor();
    const version = page.getByLabel("插件版本 9.8.7", { exact: true });
    assert.equal(await version.textContent(), "v9.8.7", "the running host version takes precedence over the build version");
    await mode("PSD 合并"); assert.equal(await version.isVisible(), true);
    await mode("原型"); assert.equal(await version.isVisible(), true);
    await trigger.click();
    await page.getByRole("menuitem", { name: "PSD 合并", exact: true }).waitFor();
    // The menu is still mounted when the state arrives; its old callback must read the latest gate.
    await page.evaluate(() => {
      const item = [...document.querySelectorAll('[role="menuitem"]')].find(x => x.textContent === "PSD 合并");
      window.__updateState = { status: "available", version: "0.2.0" };
      window.dispatchEvent(new MessageEvent("message", { data: { type: "extensionUpdateState", state: window.__updateState } }));
      item.click();
    });
    await button.waitFor();
    assert.equal(await trigger.count(), 0);
    assert.equal(await page.locator(".workspace-mode-menu").count(), 0);
    assert.equal(await page.getByLabel("页面总览画布", { exact: true }).isVisible(), true);
    await page.evaluate(() => window.dispatchEvent(new MessageEvent("message", { data: { type: "psdEditorReveal" } })));
    assert.equal(await page.getByLabel("页面总览画布", { exact: true }).isVisible(), true);
    await page.mouse.move(1100, 700);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.workspace-update-button')).backgroundColor === "rgb(35, 134, 54)");
    const color = await button.evaluate(el => getComputedStyle(el).backgroundColor);
    assert.equal(color, "rgb(35, 134, 54)");
    assert.equal(await installs(), 0);
    await page.getByRole("button", { name: "保存 (Ctrl+S)", exact: true }).click();
    assert.equal(await page.evaluate(() => window.__updateMessages.some(m => m.type === "save")), true);
    await button.evaluate(el => { el.click(); el.click(); });
    assert.equal(await installs(), 1);
    await send({ status: "installing", version: "0.2.0" });
    await page.waitForFunction(() => document.querySelector('.workspace-update-button')?.disabled);
    await send({ status: "available", version: "0.2.0", error: "测试下载失败" });
    await page.waitForFunction(() => !document.querySelector('.workspace-update-button')?.disabled);
    assert.match(await button.getAttribute("title"), /测试下载失败.*重试/);
    await button.click(); assert.equal(await installs(), 2);
    await send({ status: "pending", version: "0.2.0" });
    assert.equal(await trigger.count(), 0);
    await page.waitForFunction(() => document.querySelector('.workspace-update-button')?.title.includes("已安装"));
    assert.match(await button.getAttribute("title"), /先保存文件/);
    await page.screenshot({ path: path.join(output, "prototype-update.png") });
    for (const event of ["focus", "pageshow", "visibilitychange"]) {
      await send({ status: "pending", version: "0.2.0" }); await button.waitFor();
      await page.evaluate(event => {
        window.__updateState = { status: "current" };
        (event === "visibilitychange" ? document : window).dispatchEvent(new Event(event));
      }, event);
      await trigger.waitFor();
      assert.equal(await button.count(), 0, event + " restores a retained workbench without a remount");
      assert.equal(await page.getByLabel("页面总览画布", { exact: true }).isVisible(), true);
    }
    await mode("PSD 切图");
    await send({ status: "available", version: "0.2.0" }); await button.waitFor();
    await page.evaluate(() => window.dispatchEvent(new MessageEvent("message", { data: { type: "psdEditorReveal" } })));
    assert.equal(await page.getByRole("region", { name: "PSD 切图工作区", exact: true }).isVisible(), true);
    for (const width of [1200, 360]) {
      await page.setViewportSize({ width, height: 800 });
      const rect = await button.boundingBox();
      assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= width);
      const versionRect = await version.boundingBox();
      assert.ok(versionRect && versionRect.x > rect.x + rect.width && versionRect.x + versionRect.width <= width);
      await page.screenshot({ path: path.join(output, `slice-update-${width}.png`) });
    }
    const standalone = await context.newPage();
    standalone.on("pageerror", error => errors.push(error.message));
    await standalone.route(url + "/", async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace("<head>", '<head><meta name="gameflow-editor" content="psd"><meta name="gameflow-extension-version" content="9.8.7">') });
    });
    await standalone.goto(url);
    await standalone.getByText("正在读取 PSD 和配置…").waitFor();
    assert.equal(await standalone.getByLabel("插件版本 9.8.7", { exact: true }).textContent(), "v9.8.7");
    await standalone.evaluate(() => window.dispatchEvent(new MessageEvent("message", { data: { type: "extensionUpdateState", state: { status: "pending", version: "0.2.0" } } })));
    await standalone.getByRole("button", { name: "更新插件", exact: true }).waitFor();
    const preview = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    preview.on("pageerror", error => errors.push(error.message));
    await preview.goto(url + "?sample=star-sea-login");
    const buildVersion = require("../package.json").version;
    await preview.getByLabel("插件版本 " + buildVersion, { exact: true }).waitFor();
    await preview.locator(".topbar").screenshot({ path: path.join(output, "version-topbar.png") });
    assert.deepEqual(errors, []);
    console.log("PASS workbench update: green button, switch guards, save, click deduplication, retry, pending, retained focus/pageshow/visibility recovery, narrow viewport and standalone PSD");
    console.log("Screenshots: " + output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
