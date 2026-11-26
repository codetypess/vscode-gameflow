"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { assert, ID_PATTERN, sha256, readVsix, signCatalog, verifyCatalog, signMetadata, releasePath } = require("./lib.cjs");
function option(name, fallback) { const index = process.argv.indexOf(`--${name}`); return index < 0 ? fallback : process.argv[index + 1]; }
function atomicWrite(file, bytes, mode) {
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  try { fs.writeFileSync(temporary, bytes, { flag: "wx", mode }); fs.renameSync(temporary, file); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function initialize(root) {
  fs.mkdirSync(path.join(root, "public"), { recursive: true });
  for (const name of ["keys", "backups", "staging"]) fs.mkdirSync(path.join(root, name), { recursive: true, mode: name === "keys" ? 0o700 : 0o755 });
  const privatePath = path.join(root, "keys/signing-private.pem");
  const publicPath = path.join(root, "signing-public.pem");
  if (!fs.existsSync(privatePath)) {
    assert(!fs.existsSync(publicPath) && !fs.existsSync(path.join(root, "public/catalog.json")), "Refusing to replace a missing signing key");
    const pair = crypto.generateKeyPairSync("ed25519");
    fs.writeFileSync(privatePath, pair.privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600, flag: "wx" });
    fs.writeFileSync(publicPath, pair.publicKey.export({ type: "spki", format: "pem" }), { flag: "wx" });
  }
  if (!fs.existsSync(path.join(root, "public/catalog.json"))) atomicWrite(path.join(root, "public/catalog.json"), signCatalog({ schemaVersion: 1, revision: 1, generatedAt: new Date().toISOString(), extensions: {} }, fs.readFileSync(privatePath)));
  console.log(fs.readFileSync(publicPath, "utf8").trim());
}
function writeMetadata(root, catalog, id, privateKey) {
  const name = id.split(".")[1];
  assert(!Object.keys(catalog.extensions).some((other) => other !== id && other.split(".")[1] === name), `Metadata directory already belongs to another publisher: ${name}`);
  const entry = catalog.extensions[id];
  const directory = path.join(root, "public", name);
  const file = path.join(directory, "metadata.json");
  if (!entry.channels.stable) { if (fs.existsSync(file)) fs.unlinkSync(file); return; }
  const release = entry.releases.find((candidate) => candidate.version === entry.channels.stable);
  const original = path.join(root, "public", release.path);
  assert(sha256(fs.readFileSync(original)) === release.sha256, "Release digest mismatch");
  fs.mkdirSync(directory, { recursive: true });
  const alias = path.join(directory, `${release.version}.vsix`);
  if (fs.existsSync(alias)) assert(sha256(fs.readFileSync(alias)) === release.sha256, "Immutable metadata package differs");
  else fs.copyFileSync(original, alias, fs.constants.COPYFILE_EXCL);
  atomicWrite(file, signMetadata({ schemaVersion: 1, id, displayName: entry.displayName, version: release.version, engines: release.engines, url: `${release.version}.vsix`, size: release.size, sha256: release.sha256, revision: catalog.revision }, privateKey));
}
async function transaction(root, mutate) {
  const lock = path.join(root, ".publish-lock");
  const deadline = Date.now() + 30000;
  for (;;) {
    try { fs.mkdirSync(lock); break; }
    catch (error) { if (error.code !== "EEXIST" || Date.now() >= deadline) throw error; await new Promise((resolve) => setTimeout(resolve, 150)); }
  }
  try {
    fs.writeFileSync(path.join(lock, "owner.json"), JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    const catalogPath = path.join(root, "public/catalog.json");
    const old = fs.readFileSync(catalogPath);
    const catalog = verifyCatalog(old, fs.readFileSync(path.join(root, "signing-public.pem")));
    const result = await mutate(catalog);
    catalog.revision += 1;
    catalog.generatedAt = new Date().toISOString();
    const privateKey = fs.readFileSync(path.join(root, "keys/signing-private.pem"));
    const signed = signCatalog(catalog, privateKey);
    fs.writeFileSync(path.join(root, "backups", `catalog-${catalog.revision - 1}-${crypto.randomUUID()}.json`), old, { flag: "wx" });
    writeMetadata(root, catalog, result.id, privateKey);
    atomicWrite(catalogPath, signed);
    console.log(JSON.stringify({ ...result, revision: catalog.revision }));
    return result;
  } finally {
    if (fs.existsSync(path.join(lock, "owner.json"))) fs.unlinkSync(path.join(lock, "owner.json"));
    fs.rmdirSync(lock);
  }
}
async function publish(root, file, channel, hidden) {
  assert(channel === "stable" || channel === "beta", "Invalid channel");
  const metadata = await readVsix(file);
  if (channel === "stable") assert(!require("semver").prerelease(metadata.manifest.version), "Prerelease cannot enter stable");
  return transaction(root, (catalog) => {
    const relative = releasePath(metadata.id, metadata.manifest.version);
    const target = path.join(root, "public", relative);
    const previous = catalog.extensions[metadata.id];
    assert(!previous?.releases.some((release) => release.version === metadata.manifest.version), `Immutable release already exists: ${metadata.id}@${metadata.manifest.version}`);
    const release = { version: metadata.manifest.version, engines: { vscode: metadata.manifest.engines.vscode }, targetPlatform: "universal", path: relative, sha256: metadata.sha256, size: metadata.size };
    catalog.extensions[metadata.id] = { displayName: metadata.manifest.displayName || metadata.manifest.name, hidden: hidden || Boolean(previous?.hidden), channels: { ...previous?.channels, [channel]: metadata.manifest.version }, releases: [...(previous?.releases || []), release] };
    fs.mkdirSync(path.dirname(target), { recursive: true });
    // An identical, unreferenced file can remain after an interrupted catalog commit.
    if (fs.existsSync(target)) assert(sha256(fs.readFileSync(target)) === metadata.sha256, "Existing orphan release has different content; refusing overwrite");
    else fs.copyFileSync(file, target, fs.constants.COPYFILE_EXCL);
    return { id: metadata.id, version: release.version, sha256: metadata.sha256, path: relative, metadata: `${metadata.manifest.name}/metadata.json` };
  });
}
async function promote(root, id, version, channel = "stable") {
  assert(ID_PATTERN.test(id) && ["stable", "beta"].includes(channel), "Invalid extension ID or channel");
  return transaction(root, (catalog) => {
    const entry = catalog.extensions[id]; assert(entry, "Unknown extension");
    if (version === "none") delete entry.channels[channel];
    else {
      const release = entry.releases.find((candidate) => candidate.version === version); assert(release, "Unknown immutable release");
      assert(sha256(fs.readFileSync(path.join(root, "public", release.path))) === release.sha256, "Release digest mismatch");
      entry.channels[channel] = version;
    }
    return { id, channel, version };
  });
}
async function main() {
  const root = path.resolve(option("root", "/Users/bit/services/vscode-extensions"));
  if (process.argv[2] === "init") initialize(root);
  else if (process.argv[2] === "publish") { assert(option("file"), "--file is required"); await publish(root, path.resolve(option("file")), option("channel", "stable"), process.argv.includes("--hidden")); }
  else if (process.argv[2] === "promote") await promote(root, option("id"), option("version"), option("channel", "stable"));
  else throw new Error("Usage: publisher.cjs init|publish|promote --root DIR [--file package.vsix | --id publisher.name --version VERSION|none]");
}
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { initialize, publish, promote, atomicWrite };
