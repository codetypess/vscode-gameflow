const esbuild = require("esbuild");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

async function main() {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "gameflow-tests-"));
  const outputFile = path.join(temporaryDirectory, "shared-suite.cjs");
  try {
    await esbuild.build({
      entryPoints: [path.join(__dirname, "shared-suite.ts")],
      outfile: outputFile,
      bundle: true,
      platform: "node",
      format: "cjs",
      target: "node20"
    });
    require(outputFile);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
