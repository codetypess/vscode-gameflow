const esbuild = require("esbuild");

const isWatch = process.argv.includes("--watch");
const isDev = isWatch || process.argv.includes("--dev");

const options = {
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node20",
  external: ["vscode"],
  sourcemap: isDev,
  minify: false,
  logLevel: "info"
};

async function main() {
  if (isWatch) {
    const context = await esbuild.context(options);
    await context.watch();
    console.log("[esbuild] watching...");
    return;
  }

  await esbuild.build(options);
  console.log("[esbuild] built dist/extension.js");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
