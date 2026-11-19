"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const yazl = require("yazl");
const lib = require("./lib.cjs");
const { initialize, publish, promote } = require("./publisher.cjs");

function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bit-vsix-test-"));
  t.after(() => { const absolute = path.resolve(directory); assert.equal(path.dirname(absolute), path.resolve(os.tmpdir())); assert.match(path.basename(absolute), /^bit-vsix-test-/); fs.rmSync(absolute, { recursive: true, force: true }); });
  return directory;
}
async function fixture(directory, name, version, extra = {}, xmlOverride) {
  const file = path.join(directory, `${name}-${version}-${crypto.randomUUID()}.vsix`);
  const zip = new yazl.ZipFile();
  const manifest = { name, publisher: "codetypes", displayName: name, version, engines: { vscode: "^1.105.0" }, ...extra };
  zip.addBuffer(Buffer.from(JSON.stringify(manifest)), "extension/package.json");
  zip.addBuffer(Buffer.from(xmlOverride || `<PackageManifest><Metadata><Identity Id="${name}" Version="${version}" Publisher="codetypes" /></Metadata></PackageManifest>`), "extension.vsixmanifest");
  zip.end();
  await new Promise((resolve, reject) => { const stream = fs.createWriteStream(file); zip.outputStream.pipe(stream); stream.on("finish", resolve); stream.on("error", reject); });
  return file;
}
function catalogFor(id, versions = ["1.0.0", "1.1.0"]) {
  return { schemaVersion: 1, revision: 3, generatedAt: new Date().toISOString(), extensions: { [id]: { displayName: "Probe", channels: { stable: versions.at(-1) }, releases: versions.map((version) => ({ version, engines: { vscode: "^1.105.0" }, targetPlatform: "universal", path: lib.releasePath(id, version), sha256: "a".repeat(64), size: 123 })) } } };
}

test("catalog signatures reject tampering, wrong keys and old revisions", () => {
  const pair = crypto.generateKeyPairSync("ed25519");
  const original = lib.signCatalog(catalogFor("codetypes.probe"), pair.privateKey);
  assert.equal(lib.verifyCatalog(Buffer.from(original), pair.publicKey).revision, 3);
  assert.throws(() => lib.verifyCatalog(Buffer.from(original.replace("Probe", "Other")), pair.publicKey), /signature/);
  assert.throws(() => lib.verifyCatalog(Buffer.from(original), crypto.generateKeyPairSync("ed25519").publicKey), /signature/);
  assert.throws(() => lib.verifyCatalog(Buffer.from(original), pair.publicKey, 4), /rollback/);
});
test("catalog and paths reject unsafe identities, paths, platforms and stable prereleases", () => {
  const cases = [
    (data) => { data.schemaVersion = 9; },
    (data) => { data.extensions["codetypes.probe"].releases[0].path = "../secret"; },
    (data) => { data.extensions["codetypes.probe"].releases[0].targetPlatform = "win32-x64"; },
    (data) => { data.extensions["codetypes.probe"].channels.stable = "9.0.0"; },
    (data) => { data.extensions["codetypes.probe"].releases[0].sha256 = "bad"; }
  ];
  for (const mutate of cases) { const data = catalogFor("codetypes.probe"); mutate(data); assert.throws(() => lib.validateCatalog(data)); }
  assert.throws(() => lib.validateCatalog(catalogFor("codetypes.probe", ["1.0.0-beta.1"])), /prereleases/);
  for (const unsafe of ["../x", "https://evil.test/a", "releases/codetypes.probe/../universal.vsix"]) assert.throws(() => lib.resolveReleaseUrl("http://localhost/", unsafe));
});
test("SemVer selection upgrades, honors engine range and never implicitly downgrades", () => {
  const entry = catalogFor("codetypes.probe", ["1.9.0", "1.10.0", "2.0.0"]).extensions["codetypes.probe"];
  entry.releases[2].engines.vscode = "^1.200.0";
  assert.equal(lib.selectRelease(entry, "1.146.0", "1.9.0").version, "1.10.0");
  assert.equal(lib.selectRelease(entry, "1.146.0", "2.0.0"), undefined);
  assert.equal(lib.selectRelease(entry, "1.100.0"), undefined);
  assert.equal(lib.selectRelease(entry, "1.146.0", "1.10.0", "1.9.0").version, "1.9.0");
});
test("VSIX validation checks package identity, dependencies and platform", async (t) => {
  const directory = temporary(t);
  const good = await fixture(directory, "probe", "1.0.0");
  assert.equal((await lib.readVsix(good)).id, "codetypes.probe");
  await assert.rejects(lib.readVsix(await fixture(directory, "probe", "1.0.0", {}, '<Identity Id="wrong" Version="1.0.0" Publisher="codetypes" />')), /identity mismatch/);
  await assert.rejects(lib.readVsix(await fixture(directory, "probe", "1.0.0", { extensionDependencies: ["x.y"] })), /Dependency/);
  await assert.rejects(lib.readVsix(await fixture(directory, "probe", "1.0.0", {}, '<Identity Id="probe" Version="1.0.0" Publisher="codetypes" TargetPlatform="linux-x64" />')), /universal/);
});
test("publisher preserves two concurrent plugin releases and rejects overwrites or broken uploads", async (t) => {
  const directory = temporary(t);
  initialize(directory);
  const first = await fixture(directory, "probe-one", "1.0.0");
  const second = await fixture(directory, "probe-two", "1.0.0");
  await Promise.all([publish(directory, first, "stable", false), publish(directory, second, "stable", false)]);
  const bytes = fs.readFileSync(path.join(directory, "public/catalog.json"));
  const data = lib.verifyCatalog(bytes, fs.readFileSync(path.join(directory, "signing-public.pem")));
  assert.equal(data.revision, 3);
  assert.deepEqual(Object.keys(data.extensions).sort(), ["codetypes.probe-one", "codetypes.probe-two"]);
  await assert.rejects(publish(directory, first, "stable", false), /Immutable/);
  const corrupt = path.join(directory, "bad.vsix"); fs.writeFileSync(corrupt, "broken");
  await assert.rejects(publish(directory, corrupt, "stable", false));
  assert.deepEqual(fs.readFileSync(path.join(directory, "public/catalog.json")), bytes);
  assert.equal(fs.existsSync(path.join(directory, ".publish-lock")), false);
});

test("HTTP transport rejects redirects, oversized data and timeout", async (t) => {
  const server = http.createServer((request, response) => {
    if (request.url === "/redirect") { response.writeHead(302, { Location: "/ok" }); response.end(); }
    else if (request.url === "/slow") { /* Intentionally never respond. */ }
    else response.end("hello");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await lib.requestBuffer(base + "/ok", 100, 1000)).toString(), "hello");
  await assert.rejects(lib.requestBuffer(base + "/redirect", 100, 1000), /302/);
  await assert.rejects(lib.requestBuffer(base + "/ok", 2, 1000), /size/);
  await assert.rejects(lib.requestBuffer(base + "/slow", 100, 50), /timed out/);
});

test("updater validates signed packages, installs once, isolates profiles and blocks remote windows", async (t) => {
  const directory = temporary(t);
  const file = await fixture(directory, "probe", "1.1.0");
  const metadata = await lib.readVsix(file);
  const pair = crypto.generateKeyPairSync("ed25519");
  const data = catalogFor("codetypes.probe", ["1.1.0"]);
  Object.assign(data.extensions["codetypes.probe"].releases[0], { size: metadata.size, sha256: metadata.sha256 });
  let bytes = lib.signCatalog(data, pair.privateKey);
  const server = http.createServer((request, response) => response.end(request.url === "/catalog.json" ? bytes : fs.readFileSync(file)));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const source = `http://127.0.0.1:${server.address().port}/`;
  const installed = new Map([["codetypes.probe", { id: "codetypes.probe", extensionPath: "/installed/probe", extensionUri: { scheme: "file" }, packageJSON: { version: "1.0.0" } }]]);
  let installs = 0;
  function boot(name, remoteName) {
    const subscriptions = [];
    const storage = path.join(directory, name);
    const vscode = {
      ExtensionMode: { Production: 1, Development: 2 }, version: "1.146.0", env: { remoteName },
      window: { createOutputChannel: () => ({ appendLine() {}, dispose() {} }), showInformationMessage: async () => undefined, showErrorMessage: async () => undefined },
      workspace: { getConfiguration: () => ({ inspect: () => ({ globalValue: source, workspaceValue: "http://attacker/" }), get: () => true }) },
      extensions: { getExtension: (id) => installed.get(id) },
      Uri: { file: (value) => ({ fsPath: value }) },
      commands: { registerCommand: () => ({ dispose() {} }), executeCommand: async (command, uri) => { assert.equal(command, "workbench.extensions.installExtension"); assert.equal((await lib.readVsix(uri.fsPath)).id, "codetypes.probe"); installs++; } }
    };
    const module = { exports: {} };
    const context = { module, exports: module.exports, require: (id) => id === "vscode" ? vscode : createRequire(path.resolve(__dirname, "../../internal-updater/extension.cjs"))(id), __UPDATER_TRUST__: { serverUrl: source, publicKey: pair.publicKey.export({ type: "spki", format: "pem" }) }, Buffer, URL, setTimeout, setInterval, clearTimeout, clearInterval, process, console };
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../../internal-updater/extension.cjs"), "utf8"), context);
    const api = module.exports.activate({ globalStorageUri: { fsPath: storage }, extensionPath: "/installed/internal-updater", extensionMode: 1, subscriptions });
    t.after(() => { for (const subscription of subscriptions) subscription.dispose(); });
    return { api, storage };
  }
  const first = boot("profile-one");
  await first.api.enroll("codetypes.probe");
  assert.equal((await first.api.check({ silent: true })).updated.length, 1);
  assert.equal(installs, 1);
  assert.equal((await first.api.check({ silent: true })).updated.length, 0);
  assert.equal(installs, 1, "pending version must not be repeatedly installed");
  const other = boot("profile-two");
  await other.api.check({ silent: true });
  assert.equal(installs, 1, "another Profile must not inherit enrollment");
  const remote = boot("remote", "ssh-remote");
  await remote.api.check({ silent: true });
  assert.equal(installs, 1);
  bytes = bytes.replace("Probe", "Tampered");
  assert.equal((await first.api.check({ silent: true })).errors.length, 1);
  assert.equal(installs, 1);
});

module.exports = { fixture };
test("GameFlow package excludes debug traces, credentials and unrelated dist artifacts", async () => {
  const root = path.resolve(__dirname, "../..");
  const files = await require("@vscode/vsce").listFiles({ cwd: root, dependencies: false });
  const allowed = /^(package\.json|README\.md|LICENSE|schemas\/[^/]+\.json|dist\/extension\.js|dist\/webview\/.*)$/;
  assert.ok(files.length >= 6);
  for (const file of files) assert.match(file.replaceAll("\\", "/"), allowed, `Unintended package entry: ${file}`);
  assert.ok(files.some((file) => file.replaceAll("\\", "/") === "dist/extension.js"));
});
test("Windows install roots compare drive/path casing while rejecting other directories", () => {
  assert.equal(lib.sameExtensionRoot("D:\\Code\\extensions\\probe", "d:\\Code\\extensions\\updater", "win32"), true);
  assert.equal(lib.sameExtensionRoot("D:\\Code\\extensions\\probe", "D:\\development\\updater", "win32"), false);
  assert.equal(lib.sameExtensionRoot("/installed/probe", "/Installed/updater", "darwin"), false);
});
test("channel rollback creates a new signed revision without changing immutable packages", async (t) => {
  const directory = temporary(t); initialize(directory);
  await publish(directory, await fixture(directory, "probe", "1.0.0"), "stable", false);
  await publish(directory, await fixture(directory, "probe", "1.1.0"), "stable", false);
  const publicKey = fs.readFileSync(path.join(directory, "signing-public.pem"));
  await promote(directory, "codetypes.probe", "1.0.0");
  const data = lib.verifyCatalog(fs.readFileSync(path.join(directory, "public/catalog.json")), publicKey, 3);
  assert.equal(data.revision, 4); assert.equal(data.extensions["codetypes.probe"].channels.stable, "1.0.0");
  assert.equal(lib.selectRelease(data.extensions["codetypes.probe"], "1.146.0", "1.1.0"), undefined);
  await promote(directory, "codetypes.probe", "none");
  const withdrawn = lib.verifyCatalog(fs.readFileSync(path.join(directory, "public/catalog.json")), publicKey, 4);
  assert.equal(withdrawn.extensions["codetypes.probe"].channels.stable, undefined);
});