const assert = require("node:assert/strict");
const { writePsdBuffer } = require("ag-psd");
const { chromium } = require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE || "playwright");
const sample = require("../sample/star-sea-login.gameflow.json");

async function checkPsdOutlines(page) {
  function layer(name, left, top, hidden = false) {
    return { name, left, top, hidden, imageData: { width: 16, height: 12, data: new Uint8ClampedArray(16 * 12 * 4).fill(255) } };
  }
  const psd = writePsdBuffer({ width: 150, height: 100,
    imageData: { width: 150, height: 100, data: new Uint8ClampedArray(150 * 100 * 4).fill(255) }, children: [
    { name: "Top group", children: [{ name: "Nested group", children: [
      layer("Visible first", 10, 12),
      layer("Visible second", 42, 28),
      layer("Hidden layer", 65, 14, true)
    ] }] },
    { name: "Hidden group", hidden: true, children: [layer("Hidden by parent", 86, 14)] },
    layer("Visible at root", 40, 64)
  ] }, { generateThumbnail: false });

  await page.getByRole("button", { name: "工作台模式：原型", exact: true }).click();
  await page.getByRole("menuitem", { name: "PSD 切图", exact: true }).click();
  await page.getByLabel("打开切图 PSD", { exact: true })
    .setInputFiles({ name: "outlines.psd", mimeType: "image/vnd.adobe.photoshop", buffer: psd });
  const toolbar = page.getByRole("toolbar", { name: "PSD 切图工具栏", exact: true });
  const toggle = toolbar.getByRole("button", { name: "虚线框", exact: true });
  await toggle.click().catch(async error => {
    const workspace = page.getByRole("region", { name: "PSD 切图工作区" });
    throw new Error(await workspace.innerText(), { cause: error });
  });
  const outlines = page.locator(".psd-container-outlines rect");
  const bounds = await outlines.evaluateAll(rects => rects.map(rect =>
    ["x", "y", "width", "height"].map(key => Number(rect.getAttribute(key))).join(",")));
  assert.deepEqual(bounds.sort(), [
    "10,12,48,28", "10,12,48,28",
    "10,12,16,12", "42,28,16,12", "40,64,16,12"
  ].sort(), "PSD outlines should cover visible groups and their nested and top-level layers");
  await toggle.click();
  assert.equal(await outlines.count(), 0);
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.GAMEFLOW_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    page.setDefaultTimeout(8000);
    const url = new URL(process.env.GAMEFLOW_TEST_URL || "http://127.0.0.1:5191");
    url.searchParams.set("sample", "star-sea-login");
    await page.goto(url.href);
    const login = sample.pages[0];
    const board = page.locator(`[data-page-id="${login.id}"]`);
    const toggle = page.getByRole("button", { name: "虚线框", exact: true });
    await toggle.click();

    const title = login.nodes.find(node => node.variableName === "titleArea");
    const children = login.nodes.filter(node => node.parentId === title.id);
    assert(children.some(node => node.type === "text") && children.some(node => node.type === "image"));
    const polygons = board.locator(".container-outlines > g > polygon");
    function bounds(element) {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    }
    async function assertOutlines() {
      const outlines = await polygons.evaluateAll(elements => elements.map(element => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      }));
      for (const node of [title, ...children]) {
        const expected = await board.locator(`[data-node-id="${node.id}"]`).evaluate(bounds);
        assert(outlines.some(actual => Object.keys(expected).every(key => Math.abs(expected[key] - actual[key]) < 2)),
          `${node.name} should have a dashed outline at its rendered bounds`);
      }
    }
    await assertOutlines();
    await board.locator(".page-caption").dblclick();
    await page.locator(".page-editing").waitFor();
    await assertOutlines();
    await toggle.click();
    assert.equal(await polygons.count(), 0);
    const psdPage = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    psdPage.setDefaultTimeout(8000);
    await psdPage.goto(url.origin);
    await checkPsdOutlines(psdPage);
    console.log("PASS dashed outlines for prototype nodes and visible PSD layers at multiple depths");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
