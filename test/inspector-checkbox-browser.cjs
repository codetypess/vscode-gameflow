const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { chromium } = require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage(), errors = [];
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "gameflow-inspector-checkbox-"));
  page.on("pageerror", error => errors.push(error.message));
  const node = (id, type, name, y, extra = {}) => ({ id, type, name, frame: { x: 30, y, width: 180, height: 40 }, ...extra });
  const document = {
    schemaVersion: 5, elementIdScheme: "nanoid-8", documentId: "inspector-checkbox-test", title: "复选框点击范围",
    requirements: [], interactions: [], pages: [{
      id: "page0001", name: "测试页面", kind: "screen", frame: { x: 0, y: 0, width: 640, height: 480 }, nodes: [
        node("button01", "button", "测试按钮", 20),
        node("check001", "checkbox", "测试复选", 80),
        node("radio001", "radio", "测试单选", 140),
        node("input001", "input", "测试输入", 200),
        node("text0001", "text", "测试文字", 260, { text: "文字内容" }),
        node("locked01", "button", "锁定按钮", 320, { locked: true })
      ]
    }]
  };
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const selectNode = async name => {
    await page.locator(".layer-panel").getByRole("button", { name, exact: true }).click();
    await settle();
  };
  const checkbox = name => page.locator(".inspector").getByRole("checkbox", { name, exact: true });
  const exerciseToggle = async name => {
    const input = checkbox(name);
    await input.scrollIntoViewIfNeeded();
    const before = await input.isChecked(), bounds = await input.boundingBox();
    const right = await input.evaluate(element => (element.closest(".property-details") || element.closest(".inspector-content")).getBoundingClientRect().right);
    assert.ok(bounds && right > bounds.x + bounds.width + 30, `${name}: visible blank space is required`);
    await page.mouse.click((bounds.x + bounds.width + right) / 2, bounds.y + bounds.height / 2);
    await settle();
    assert.equal(await input.isChecked(), before, `${name}: clicking blank space must not toggle the checkbox`);
    await input.locator("..").locator("span").click();
    await settle();
    assert.equal(await input.isChecked(), !before, `${name}: clicking the label still toggles`);
    await input.click();
    await settle();
    assert.equal(await input.isChecked(), before, `${name}: clicking the checkbox still toggles`);
    await input.focus();
    await input.press("Space");
    await settle();
    assert.equal(await input.isChecked(), !before, `${name}: Space still toggles`);
    await input.press("Space");
    await settle();
    assert.equal(await input.isChecked(), before);
  };
  try {
    await context.addInitScript(doc => localStorage.setItem("gameflow.prototype.v1", JSON.stringify(doc)), document);
    await page.goto(process.env.GAMEFLOW_TEST_URL || "http://127.0.0.1:5191");
    await page.locator(".page-caption").dblclick();
    await page.locator(".page-editing").waitFor();
    await selectNode("测试按钮");
    for (const name of ["选中状态", "禁用状态", "裁剪内容"]) await exerciseToggle(name);

    await checkbox("选中状态").check();
    await settle();
    await page.getByRole("button", { name: /^撤销/ }).click();
    await settle();
    assert.equal(await checkbox("选中状态").isChecked(), false, "undo restores the property");
    await page.getByRole("button", { name: /^重做/ }).click();
    await settle();
    assert.equal(await checkbox("选中状态").isChecked(), true, "redo restores the edit");

    for (const name of ["测试复选", "测试单选"]) {
      await selectNode(name);
      await exerciseToggle("选中状态");
    }
    await selectNode("测试输入");
    await exerciseToggle("密码显示");
    await selectNode("测试文字");
    await exerciseToggle("自动换行");
    for (const name of ["HTML", "UBB", "模板"]) {
      const input = checkbox(name);
      await input.locator("..").locator("span").click();
      await settle();
      assert.equal(await input.isChecked(), true, `${name}: compact syntax labels remain usable`);
      await input.press("Space");
      await settle();
      assert.equal(await input.isChecked(), false);
    }
    await selectNode("锁定按钮");
    for (const name of ["选中状态", "禁用状态", "裁剪内容"]) {
      const input = checkbox(name);
      assert.equal(await input.isDisabled(), true);
      const label = input.locator("..").locator("span");
      await label.scrollIntoViewIfNeeded();
      const bounds = await label.boundingBox();
      await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await settle();
      assert.equal(await input.isChecked(), false, `${name}: locked labels must not edit`);
    }

    await page.setViewportSize({ width: 360, height: 700 });
    await selectNode("测试按钮");
    for (const name of ["选中状态", "禁用状态", "裁剪内容"]) await exerciseToggle(name);
    await page.screenshot({ path: path.join(output, "checkbox-narrow.png") });
    await selectNode("测试文字");
    await exerciseToggle("自动换行");
    const syntax = page.locator(".label-syntax-row");
    await syntax.scrollIntoViewIfNeeded();
    assert.ok(await syntax.evaluate(element => element.scrollWidth <= element.clientWidth), "syntax row fits the narrow inspector");
    await page.setViewportSize({ width: 1400, height: 1000 });
    await selectNode("测试按钮");
    await checkbox("选中状态").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, "checkbox-normal.png") });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, checks: ["blank-space isolation", "label/checkbox/Space activation", "button/container/input/text/checkbox/radio", "undo/redo", "locked properties", "compact syntax labels", "360px narrow viewport"], output }, null, 2));
  } catch (error) {
    await page.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
    console.error("Browser artifacts:", output);
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
