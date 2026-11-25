const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.GAMEFLOW_PLAYWRIGHT_MODULE || "playwright");

// The workbench isolates each Canvas patch. Laya samples all patches from one texture.
async function run() {
  const example = path.resolve(__dirname, "../examples/laya-gameflow");
  const file = path.join(example, "assets/gameflow-exported/builtin/image/default.png");
  const { sizeGrid } = JSON.parse(fs.readFileSync(file + ".meta", "utf8")).importer;
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 750, height: 1334 }, deviceScaleFactor: 1 });
    await page.route("http://laya-test.local/", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><body></body>" }));
    await page.route("http://laya-test.local/default.png", route => route.fulfill({ path: file, contentType: "image/png" }));
    await page.goto("http://laya-test.local/");
    for (const module of ["laya.core", "laya.webgl_2D", "laya.d3", "laya.webgl_3D", "laya.ui"])
      await page.addScriptTag({ path: path.join(example, "engine/libs", module + ".js") });
    await page.evaluate(async grid => {
      await Laya.init(750, 1334);
      const texture = await Laya.loader.load("default.png", Laya.Loader.IMAGE);
      const picture = Laya.stage.addChild(new Laya.Sprite());
      picture.graphics.draw9Grid(texture, 0, 0, 750, 1334, grid);
      await new Promise(resolve => Laya.timer.frameOnce(3, null, resolve));
    }, sizeGrid);
    const clip = { x: 0, y: 0, width: 96, height: 96 };
    const capture = await page.screenshot({ clip });
    const result = await page.evaluate(async base64 => {
      const image = new Image();
      image.src = "data:image/png;base64," + base64;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const sample = (x,y) => Array.from(data.slice((y * canvas.width + x) * 4, (y * canvas.width + x) * 4 + 3));
      const background = sample(95,95);
      let bleed = 0, ink = 0;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const delta = Math.abs(data[(y * canvas.width + x) * 4] - background[0]);
        if (x >= 6 && x < 38 && y >= 6 && y < 34) ink += Number(delta > 40);
        else bleed += Number(delta > 1);
      }
      return { background, ink, bleed, right: sample(38,15), below: sample(18,34) };
    }, capture.toString("base64"));
    console.log("Laya 750×1334", result);
    assert.deepEqual(result.background, [227,231,236]);
    assert.ok(result.ink > 150, "the top-left landscape is visible");
    assert.equal(result.bleed, 0, "pixels outside the icon should have the solid background color");
  } finally {
    await browser.close();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
