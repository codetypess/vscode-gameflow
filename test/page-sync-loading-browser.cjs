const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const root = path.resolve(__dirname, "..");
  const example = path.join(root, "examples/star-sea-login");
  const document = require(path.join(example, "star-sea-login.gameflow.json"));
  const name = "Star-Sea-Login-750x1334.psd";
  const base64 = fs.readFileSync(path.join(example, name)).toString("base64");
  const url = process.env.GAMEFLOW_TEST_URL || "http://127.0.0.1:5197";
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const fixture = await browser.newPage();
    await fixture.goto(url);
    const draft = await fixture.evaluate(async ({ base64, name, root }) => {
      const { psdTask } = await import("/psd/io.ts");
      const { makePsdDraft } = await import("/@fs/" + root + "/shared/psd-draft.ts");
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer;
      return makePsdDraft(await psdTask("read", bytes, name));
    }, { base64, name, root: root.replaceAll("\\", "/") });
    await fixture.close();
    document.pages[0].artPsd = { source: name, documentId: draft.documentId };

    for (const supported of [false, true]) {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.addInitScript(({ document, name, base64, draft, supported }) => {
        const send = data => setTimeout(() => window.dispatchEvent(new MessageEvent("message", { data })), 0);
        window.syncRequests = [];
        window.acquireVsCodeApi = () => ({ getState() {}, setState() {}, postMessage(message) {
          if (message.type === "ready") {
            send({ type: "init", document, documentVersion: 1, dirty: false, resourceName: "star-sea-login.gameflow.json" });
          }
          if (message.type !== "pagePsd") return;
          window.syncRequests.push(message);
          const result = { type: "pagePsdResult", requestId: message.requestId, source: name, name, draft };
          // The previous host acknowledges load and silently drops the unknown review action.
          if (message.action === "load" || supported && message.action === "review") send({ ...result, base64 });
        } });
      }, { document, name, base64, draft, supported });
      await page.goto(url);
      if (supported) await page.evaluate(() => {
        const meta = window.document.createElement("meta");
        meta.name = "gameflow-page-psd-sync"; meta.content = "1";
        window.document.head.append(meta);
      });
      await page.locator(".page-caption").first().click();
      await page.getByRole("button", { name: "更多", exact: true }).click();
      await page.getByRole("menuitem", { name: "同步文字与结构" }).click();
      const dialog = page.getByRole("dialog", { name: "同步文字与结构" });
      const tree = dialog.getByRole("navigation");
      try {
        await tree.getByRole("button", { name: "背景 background", exact: true }).waitFor({ timeout: 5000 });
        await dialog.getByRole("img", { name: "美术 PSD 合成图" }).waitFor();
      } catch (error) {
        throw new Error("宿主支持同步=" + supported + "，已发送 " +
          (await page.evaluate(() => window.syncRequests.map(m => m.action))) + "，窗口内容 " + await dialog.innerText(), { cause: error });
      }
      const apply = dialog.locator("footer button").first();
      if (!supported) {
        assert(await apply.isDisabled());
        assert.match(await dialog.getByRole("alert").innerText(), /重新加载窗口/);
        assert.equal(await page.evaluate(() => window.syncRequests.some(m => m.action === "review")), false);
      } else {
        assert(await apply.isEnabled());
        await dialog.getByText("文字与结构已一致").waitFor();
        assert.equal(await page.evaluate(() => window.syncRequests.some(m => m.action === "review")), true);
        assert.equal(await dialog.getByRole("alert").count(), 0);
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log("PASS Star Sea sync reviews the bound PSD on the current host and shows a read-only preview and reload instructions on the previous host");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
