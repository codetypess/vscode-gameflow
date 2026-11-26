const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { chromium } = require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const browser = await chromium.launch({ channel: process.env.GAMEFLOW_BROWSER_CHANNEL || "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await context.newPage(), errors = [], output = fs.mkdtempSync(path.join(os.tmpdir(), "gameflow-psd-startup-"));
  page.on("pageerror", error => errors.push(error.message));
  const document = { schemaVersion: 5, elementIdScheme: "nanoid-8", documentId: "startup-test", title: "未绑定原型", requirements: [], interactions: [], pages: [
    { id: "page0001", name: "登录页", kind: "screen", frame: { x: 0, y: 0, width: 320, height: 240 }, nodes: [] }
  ] };
  try {
    await context.addInitScript(doc => {
      window.__hostMessages = []; window.__heldPsd = []; window.__holdPsd = false;
      window.acquireVsCodeApi = () => ({ getState() {}, setState() {}, postMessage(message) {
        window.__hostMessages.push(message);
        const send = data => setTimeout(() => window.dispatchEvent(new MessageEvent("message", { data })), 0);
        if (message.type === "ready") send({ type: "init", document: doc, documentVersion: 1, dirty: false, resourceName: "startup.gameflow.json" });
        if (message.type === "workbenchSettings") send({ type: "workbenchSettingsResult", requestId: message.requestId, settings: {} });
      } });
      const NativeWorker = window.Worker;
      window.Worker = class extends NativeWorker {
        constructor(...args) {
          super(...args);
          this.addEventListener("message", event => {
            if (window.__holdPsd && event.isTrusted && event.data.result) {
              event.stopImmediatePropagation();
              window.__heldPsd.push(() => this.dispatchEvent(new MessageEvent("message", { data: event.data })));
            }
          });
        }
      };
    }, document);
    await page.goto(process.env.GAMEFLOW_TEST_URL || "http://127.0.0.1:5191");
    const modeTrigger = page.getByRole("button", { name: /^工作台模式：/ });
    const modeMenu = page.locator(".workspace-mode-menu");
    const expectMode = async name => assert.equal(await modeTrigger.getAttribute("aria-label"), "工作台模式：" + name);
    const selectMode = async name => { await modeTrigger.click(); await modeMenu.getByRole("menuitem", { name, exact: true }).click(); };
    const documentActions = page.getByRole("group", { name: "文档操作" });
    const expectActions = async labels => {
      await page.waitForFunction(expected => JSON.stringify(Array.from(document.querySelector('[aria-label="文档操作"]')?.querySelectorAll("button") ?? [], button => button.getAttribute("aria-label"))) === JSON.stringify(expected), labels);
      assert.deepEqual(await documentActions.getByRole("button").evaluateAll(buttons => buttons.map(button => button.getAttribute("aria-label"))), labels);
    };
    await page.locator(".page-group").waitFor();
    await expectActions(["撤销 (Ctrl+Z)", "重做 (Ctrl+Shift+Z)", "保存 (Ctrl+S)", "工作台设置"]);
    await modeTrigger.click();
    await modeMenu.waitFor();
    assert.deepEqual(await modeMenu.getByRole("menuitem").allTextContents(), ["原型", "PSD 合并", "PSD 切图"]);
    assert.equal(await modeMenu.getByRole("menuitem", { name: "原型", exact: true }).getAttribute("aria-current"), "page");
    await page.keyboard.press("Escape");
    await selectMode("PSD 合并");
    await expectActions(["工作台设置"]);
    await selectMode("原型");
    await expectActions(["撤销 (Ctrl+Z)", "重做 (Ctrl+Shift+Z)", "保存 (Ctrl+S)", "工作台设置"]);
    const base64 = fs.readFileSync(path.join(__dirname, "../examples/psd-metadata/GameFlow-PSD-Metadata-Sample.psd")).toString("base64");
    const fixture = await page.evaluate(async ({ base64, root }) => {
      const { psdTask } = await import("/psd/io.ts");
      const { makePsdDraft } = await import("/@fs/" + root + "/shared/psd-draft.ts");
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer;
      const asset = await psdTask("read", bytes, "unrelated.psd");
      return { type: "psdEditorInit", name: "unrelated.psd", base64, state: { type: "psdEditorState", version: 1, draft: makePsdDraft(asset), dirty: false, backup: "none" }, configPath: "unrelated.meta.json" };
    }, { base64, root: path.resolve(__dirname, "..").replaceAll("\\", "/") });
    const send = data => page.evaluate(data => window.dispatchEvent(new MessageEvent("message", { data })), data);
    const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    // A restored session initializes real PSD pixels without any open command.
    await send(fixture);
    await page.locator('.psd-workspace[aria-label="PSD 切图工作区"] .psd-tree-row').first().waitFor({ state: "attached" });
    await settle();
    await expectMode("原型");
    await page.screenshot({ path: path.join(output, "restored-prototype.png") });
    // Explicitly opening the already loaded PSD reveals it without a reload.
    await send({ type: "psdEditorReveal" });
    await modeTrigger.waitFor(); await settle();
    await expectMode("PSD 切图");
    await expectActions(["打开 PSD", "撤销 (Ctrl+Z)", "重做 (Ctrl+Shift+Z)", "保存 (Ctrl+S)", "工作台设置", "更多操作"]);
    assert.ok(await page.locator('.psd-workspace[aria-label="PSD 切图工作区"] .psd-tree-row').first().isVisible());
    await selectMode("原型");
    // Hold a real worker completion to make the navigation race deterministic.
    await page.evaluate(() => { window.__holdPsd = true; });
    await send({ type: "psdEditorReveal" }); await send(fixture);
    await page.waitForFunction(() => window.__heldPsd.length === 1);
    await expectMode("PSD 切图");
    await selectMode("原型");
    await page.evaluate(() => { window.__holdPsd = false; for (const release of window.__heldPsd.splice(0)) release(); });
    await page.locator('.psd-workspace[aria-label="PSD 切图工作区"] .psd-tree-row').first().waitFor({ state: "attached" });
    await settle();
    await expectMode("原型");
    // Plain reinitialization/revert also preserves whichever workspace is selected.
    await send(fixture); await settle();
    await page.locator('.psd-workspace[aria-label="PSD 切图工作区"] .psd-tree-row').first().waitFor({ state: "attached" });
    await settle(); await expectMode("原型");
    await page.getByRole("button", { name: "美术 PSD资源", exact: true }).click();
    assert.equal(await page.locator('[data-art-state="unbound"]').count(), 1);
    assert.equal(await page.locator(".page-surface").getByRole("button", { name: "生成 PSD", exact: true }).count(), 1);
    assert.equal(await page.locator(".page-surface").getByRole("button", { name: "绑定 PSD", exact: true }).count(), 1);
    const messages = await page.evaluate(() => window.__hostMessages);
    assert.equal(messages.some(m => ["replaceDocument", "save", "applyCanvasOverrides", "pagePsd", "psdOutput", "psdEditorEdit", "psdEditorCommand"].includes(m.type)), false, "viewing PSD must not bind, edit or save the GameFlow");
    // An already-running host may serve a newer Webview but ignore the slice action.
    const bound = { ...document.pages[0], artPsd: { source: fixture.name, documentId: fixture.state.draft.documentId } };
    await send({ type: "documentChanged", document: { ...document, pages: [bound] }, documentVersion: 2, dirty: false });
    await page.locator(".page-caption").click();
    const more = page.locator(".canvas-toolbar").getByRole("button", { name: "更多", exact: true });
    await more.click();
    await page.getByRole("menuitem", { name: "PSD 切图", exact: true }).click();
    await page.locator(".editor-notice").filter({ hasText: "重新加载窗口" }).waitFor({ timeout: 3000 });
    assert.equal(await page.evaluate(() => window.__hostMessages.some(m => m.type === "pagePsd" && m.action === "slice")), false);
    await more.click();
    assert.equal(await page.getByRole("menuitem", { name: "重新绑定 PSD" }).isEnabled(), true);
    await page.keyboard.press("Escape");
    // VS Code forwards bubbling keydowns from window even when defaultPrevented is true.
    await page.evaluate(() => {
      window.__forwardedHistory = [];
      window.addEventListener("keydown", event => {
        if ((event.ctrlKey || event.metaKey) && ["z", "y"].includes(event.key.toLowerCase()))
          window.__forwardedHistory.push(event.key);
      });
    });
    const historyMessages = () => page.evaluate(() => window.__hostMessages.filter(m => m.type === "history" || m.type === "psdEditorCommand"));
    await modeTrigger.focus();
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+Shift+z");
    assert.deepEqual((await historyMessages()).map(m => m.action), ["undo"], "redo waits for undo");
    await send({ type: "commandCompleted", action: "undo" });
    assert.deepEqual((await historyMessages()).map(m => m.action), ["undo", "redo"]);
    await send({ type: "commandCompleted", action: "redo" });
    await send({ type: "psdEditorReveal" });
    await page.getByRole("button", { name: "工作台模式：PSD 切图", exact: true }).waitFor();
    await modeTrigger.focus();
    await page.keyboard.press("Control+y");
    const psdHistory = (await historyMessages()).filter(m => m.type === "psdEditorCommand");
    assert.deepEqual(psdHistory.map(m => m.action), ["redo"]);
    await page.keyboard.press("Control+z");
    assert.deepEqual(await page.evaluate(() => window.__forwardedHistory), [], "handled and busy history shortcuts must not also reach VS Code");
    await send({ type: "psdEditorCommandResult", requestId: psdHistory[0].requestId });
    assert.deepEqual(errors, []);
    console.log("PASS PSD startup: restore stays in prototype, explicit open reveals slices, late decode preserves selection, unrelated PSD leaves page unbound and unsaved; screenshots: " + output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
