"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const lib = require("./lib.cjs");
const trust = require("./trust.json");
function option(name, fallback) { const at = process.argv.indexOf(`--${name}`); return at < 0 ? fallback : process.argv[at + 1]; }
async function main() {
  const name = option("name", "vscode-gameflow");
  const id = option("id", `${require("../../package.json").publisher}.${name}`);
  const count = Number(option("count", "1"));
  lib.assert(/^[a-z0-9-]+$/.test(name) && lib.ID_PATTERN.test(id), "Invalid plugin name or ID");
  lib.assert(Number.isSafeInteger(count) && count > 0 && count <= 100, "Count must be 1..100");
  const endpoint = new URL(`${name}/metadata.json`, lib.sourceUrl(trust.serverUrl));
  const failureDirectory = option("failure-dir");
  let failed = 0;
  let revision = 0;
  let version;
  for (let i = 0; i < count; i++) {
    const metadata = lib.verifyMetadata(await lib.requestBuffer(endpoint, 64 * 1024, 15000), trust.publicKey, id, revision);
    revision = metadata.revision;
    version = metadata.version;
    const bytes = await lib.requestBuffer(new URL(metadata.url, endpoint), metadata.size, 30000);
    if (bytes.length !== metadata.size || lib.sha256(bytes) !== metadata.sha256) {
      failed++;
      if (failureDirectory) { fs.mkdirSync(path.resolve(failureDirectory), { recursive: true }); fs.writeFileSync(path.join(failureDirectory, `failed-${crypto.randomUUID()}.vsix`), bytes, { flag: "wx" }); }
    }
  }
  console.log(JSON.stringify({ endpoint: endpoint.href, id, version, revision, total: count, failed, ok: failed === 0 }));
  if (failed) process.exitCode = 1;
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
