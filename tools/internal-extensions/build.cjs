"use strict";
const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");
const root = path.resolve(__dirname, "../..");
async function main() {
  const out = path.join(root, "dist/internal-extensions");
  fs.mkdirSync(out, { recursive: true });
  await esbuild.build({ entryPoints: [path.join(__dirname, "publisher.cjs")], outfile: path.join(out, "publisher.cjs"), bundle: true, platform: "node", target: "node20", format: "cjs" });
  fs.cpSync(path.join(__dirname, "site"), path.join(out, "site"), { recursive: true });
  fs.cpSync(path.join(__dirname, "deploy"), path.join(out, "deploy"), { recursive: true });
  if (!process.argv.includes("--legacy-updater")) return;
  const trustPath = path.join(__dirname, "trust.json");
  if (!fs.existsSync(trustPath)) throw new Error("Missing trust.json; initialize the server and pin its public key before building the updater");
  const trust = JSON.parse(fs.readFileSync(trustPath, "utf8"));
  require("node:crypto").createPublicKey(trust.publicKey);
  await esbuild.build({ entryPoints: [path.join(root, "internal-updater/extension.cjs")], outfile: path.join(root, "internal-updater/dist/extension.js"), bundle: true, platform: "node", target: "node20", format: "cjs", external: ["vscode"], define: { __UPDATER_TRUST__: JSON.stringify(trust) } });
  console.log("Built publisher and pinned-key updater");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
