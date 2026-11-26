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
  function boot(name, remoteName, profileExtensions = installed) {
    const subscriptions = [];
    const storage = path.join(directory, name);
    const vscode = {
      ExtensionMode: { Production: 1, Development: 2 }, version: "1.146.0", env: { remoteName },
      window: { createOutputChannel: () => ({ appendLine() {}, dispose() {} }), showInformationMessage: async (_message, ...actions) => actions.includes("安装更新") ? "安装更新" : undefined, showErrorMessage: async () => undefined },
      workspace: { getConfiguration: () => ({ inspect: () => ({ globalValue: source, workspaceValue: "http://attacker/" }), get: () => true }) },
      extensions: { getExtension: (id) => profileExtensions.get(id), onDidChange: () => ({ dispose() {} }) },
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
  assert.equal((await first.api.check({ silent: true })).updated.length, 1);
  assert.equal(installs, 1);
  assert.equal((await first.api.check({ silent: true })).updated.length, 0);
  assert.equal(installs, 1, "pending version must not be repeatedly installed");
  const other = boot("profile-two", undefined, new Map());
  await other.api.check({ silent: true });
  assert.equal(installs, 1, "another Profile must only discover its own installed extensions");
  const remote = boot("remote", "ssh-remote");
  await remote.api.check({ silent: true });
  assert.equal(installs, 1);
  bytes = bytes.replace("Probe", "Tampered");
  assert.equal((await first.api.check({ silent: true })).errors.length, 1);
  assert.equal(installs, 1);
});

test("updater requires confirmation before downloading business or self updates, including legacy auto settings", async (t) => {
  const directory = temporary(t);
  const pair = crypto.generateKeyPairSync("ed25519");
  const data = catalogFor("codetypes.probe", ["1.1.0"]);
  Object.assign(data.extensions, catalogFor("codetypes.internal-updater", ["0.1.2"]).extensions);
  const packages = new Map();
  for (const [id, entry] of Object.entries(data.extensions)) {
    const release = entry.releases[0];
    const file = await fixture(directory, id.split(".")[1], release.version);
    const metadata = await lib.readVsix(file);
    Object.assign(release, { size: metadata.size, sha256: metadata.sha256 });
    entry.displayName = id === "codetypes.probe" ? "业务插件" : "内部更新器";
    packages.set("/" + release.path, fs.readFileSync(file));
  }
  const signed = lib.signCatalog(data, pair.privateKey);
  let catalogRequests = 0;
  let packageRequests = 0;
  const server = http.createServer((request, response) => {
    if (request.url === "/catalog.json") { catalogRequests++; response.end(signed); }
    else if (packages.has(request.url)) { packageRequests++; response.end(packages.get(request.url)); }
    else { response.writeHead(404); response.end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const source = `http://127.0.0.1:${server.address().port}/`;
  const updaterPath = path.resolve(__dirname, "../../internal-updater/extension.cjs");
  const installed = new Map([
    ["codetypes.probe", { extensionPath: "/installed/probe", extensionUri: { scheme: "file" }, packageJSON: { version: "1.0.0" } }],
    ["codetypes.internal-updater", { extensionPath: "/installed/internal-updater", extensionUri: { scheme: "file" }, packageJSON: { version: "0.1.1" } }]
  ]);
  const scenarios = [
    { name: "fresh-global-auto-on", autoUpdate: true },
    { name: "fresh-global-auto-off", autoUpdate: false },
    { name: "legacy-auto", mode: "auto", autoUpdate: true },
    { name: "legacy-independent-auto", mode: "auto", independentAutoUpdate: true, autoUpdate: false },
    { name: "prompt", mode: "prompt", autoUpdate: true },
    { name: "paused", mode: "off", independentAutoUpdate: true, autoUpdate: true }
  ];
  for (const scenario of scenarios) await t.test(scenario.name, async (subtest) => {
    const storage = path.join(directory, scenario.name);
    const stateFile = path.join(storage, "state.json");
    fs.mkdirSync(storage);
    if (scenario.mode) fs.writeFileSync(stateFile, JSON.stringify({ managed: { "codetypes.internal-updater": {}, "codetypes.probe": { pin: "1.1.0" } }, pending: {}, mode: scenario.mode, independentAutoUpdate: scenario.independentAutoUpdate, revision: 0 }));
    const subscriptions = [];
    const prompts = [];
    const installs = [];
    const errors = [];
    let response;
    const vscode = {
      ExtensionMode: { Production: 1 }, version: "1.146.0", env: {},
      window: {
        createOutputChannel: () => ({ appendLine() {}, dispose() {} }),
        showInformationMessage: async (message, ...actions) => { if (!actions.includes("安装更新")) return; prompts.push({ message, actions }); return response; },
        showErrorMessage: async (message) => { errors.push(message); }
      },
      workspace: { getConfiguration: () => ({ inspect: () => ({ globalValue: source }), get: () => scenario.autoUpdate }) },
      extensions: { getExtension: (id) => installed.get(id), onDidChange: () => ({ dispose() {} }) },
      Uri: { file: (value) => ({ fsPath: value }) },
      commands: { registerCommand: () => ({ dispose() {} }), executeCommand: async (command, uri) => { assert.equal(command, "workbench.extensions.installExtension"); const metadata = await lib.readVsix(uri.fsPath); installs.push(`${metadata.id}@${metadata.manifest.version}`); } }
    };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(updaterPath, "utf8"), { module, exports: module.exports, require: (id) => id === "vscode" ? vscode : createRequire(updaterPath)(id), __UPDATER_TRUST__: { serverUrl: source, publicKey: pair.publicKey.export({ type: "spki", format: "pem" }) }, Buffer, URL, setTimeout, setInterval, clearTimeout, clearInterval, process, console });
    const api = module.exports.activate({ globalStorageUri: { fsPath: storage }, extensionPath: "/installed/internal-updater", extensionMode: 1, subscriptions });
    subtest.after(() => { for (const subscription of subscriptions) subscription.dispose(); });
    const beforePackages = packageRequests;
    const beforeCatalogs = catalogRequests;
    let result = await api.check({ silent: true });
    assert.equal(result.errors.length, 0);
    if (scenario.mode === "off") {
      assert.equal(catalogRequests, beforeCatalogs, "paused background checks must not request the catalog");
      assert.equal(prompts.length, 0);
      result = await api.check();
    }
    assert.equal(result.updated.length, 0, "dismissing the prompt must leave installed versions unchanged");
    assert.equal(prompts.length, 1);
    assert.ok(prompts[0].actions.includes("稍后"));
    assert.match(prompts[0].message, /业务插件.*1\.0\.0.*1\.1\.0/);
    assert.match(prompts[0].message, /内部更新器.*0\.1\.1.*0\.1\.2/);
    assert.equal(packageRequests, beforePackages, "no VSIX may be downloaded before confirmation");
    assert.equal(installs.length, 0);
    const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    assert.equal(state.mode, scenario.mode === "off" ? "off" : "prompt");
    assert.equal(Object.hasOwn(state, "independentAutoUpdate"), false);
    if (scenario.mode) assert.equal(state.managed["codetypes.probe"].pin, "1.1.0");
    response = "稍后";
    await api.check();
    assert.equal(packageRequests, beforePackages);
    assert.equal(installs.length, 0);
    response = "安装更新";
    const accepted = await api.check();
    assert.equal(accepted.errors.length, 0);
    assert.equal(accepted.updated.length, 2);
    assert.deepEqual(installs, ["codetypes.probe@1.1.0", "codetypes.internal-updater@0.1.2"]);
    assert.equal(packageRequests, beforePackages + 2);
    const promptCount = prompts.length;
    await api.check();
    assert.equal(prompts.length, promptCount, "pending versions must not prompt again");
    assert.equal(installs.length, 2);
    assert.deepEqual(errors, []);
  });
});

test("updater automatically discovers installed catalog extensions on startup and changes, with persistent pauses", async (t) => {
  const directory = temporary(t);
  const pair = crypto.generateKeyPairSync("ed25519");
  const data = catalogFor("codetypes.probe", ["1.1.0"]);
  for (const name of ["hidden", "development", "remote", "absent"]) Object.assign(data.extensions, catalogFor(`codetypes.${name}`, ["1.1.0"]).extensions);
  data.extensions["codetypes.hidden"].hidden = true;
  const signed = lib.signCatalog(data, pair.privateKey);
  let downloads = 0;
  const server = http.createServer((request, response) => {
    if (request.url === "/catalog.json") response.end(signed);
    else { downloads++; response.writeHead(404); response.end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const source = `http://127.0.0.1:${server.address().port}/`;
  const updaterPath = path.resolve(__dirname, "../../internal-updater/extension.cjs");
  const installed = new Map();
  const storage = path.join(directory, "profile");
  fs.mkdirSync(storage);
  const stateFile = path.join(storage, "state.json");
  fs.writeFileSync(stateFile, JSON.stringify({ managed: { "codetypes.internal-updater": {} }, pending: {}, mode: "prompt", revision: 0 }));
  function boot() {
    const subscriptions = [];
    const commands = new Map();
    const prompts = [];
    const timers = [];
    let changed;
    let chosenAction;
    const vscode = {
      ExtensionMode: { Production: 1 }, version: "1.146.0", env: {},
      window: {
        createOutputChannel: () => ({ appendLine() {}, dispose() {} }),
        showInformationMessage: async (message, ...actions) => { if (actions.includes("安装更新")) prompts.push(message); },
        showErrorMessage: async (message) => assert.fail(message),
        showQuickPick: async (items) => items.find((item) => typeof item === "object" ? item.id === "codetypes.probe" : item === chosenAction)
      },
      workspace: { getConfiguration: () => ({ inspect: () => ({ globalValue: source }) }) },
      extensions: { getExtension: (id) => installed.get(id), onDidChange: (handler) => { changed = handler; return { dispose() { changed = undefined; } }; } },
      commands: { registerCommand: (name, handler) => { commands.set(name, handler); return { dispose() {} }; }, executeCommand: async () => assert.fail("No installation without confirmation") }
    };
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(updaterPath, "utf8"), { module, exports: module.exports, require: (id) => id === "vscode" ? vscode : createRequire(updaterPath)(id), __UPDATER_TRUST__: { serverUrl: source, publicKey: pair.publicKey.export({ type: "spki", format: "pem" }) }, Buffer, URL, setTimeout: (handler, delay) => { const timer = { handler, delay }; timers.push(timer); return timer; }, setInterval: () => ({}), clearTimeout() {}, clearInterval() {}, process, console });
    const api = module.exports.activate({ globalStorageUri: { fsPath: storage }, extensionPath: "/installed/internal-updater", extensionMode: 1, subscriptions });
    const dispose = () => { for (const subscription of subscriptions) subscription.dispose(); };
    t.after(dispose);
    return { api, prompts, dispose, startup: () => timers.find((timer) => timer.delay === 30000).handler(), change: () => changed(), browse: (action) => { chosenAction = action; return commands.get("internalUpdater.browse")(); } };
  }
  const first = boot();
  await first.startup();
  assert.equal(first.prompts.length, 0, "catalog additions must not be offered until installed");
  for (const name of ["probe", "hidden", "development", "remote"]) installed.set(`codetypes.${name}`, { extensionPath: `${name === "development" ? "/development" : "/installed"}/${name}`, extensionUri: { scheme: name === "remote" ? "vscode-remote" : "file" }, packageJSON: { version: "1.0.0" } });
  await first.change();
  assert.equal(first.prompts.length, 1, "manual VSIX installation must trigger discovery without enroll");
  assert.match(first.prompts[0], /1\.0\.0.*1\.1\.0/);
  const discovered = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  assert.deepEqual(Object.keys(discovered.managed).sort(), ["codetypes.internal-updater", "codetypes.probe"]);
  discovered.managed["codetypes.probe"].pin = "1.1.0";
  fs.writeFileSync(stateFile, JSON.stringify(discovered));
  await first.browse("暂停更新检查");
  await first.change();
  assert.equal(first.prompts.length, 1, "discovery must not undo an explicit pause");
  assert.equal(JSON.parse(fs.readFileSync(stateFile, "utf8")).excluded["codetypes.probe"], true);
  first.dispose();
  const restarted = boot();
  await restarted.startup();
  assert.equal(restarted.prompts.length, 0, "pause must survive restart");
  await restarted.browse("恢复更新检查");
  assert.equal(restarted.prompts.length, 1);
  const restored = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  assert.equal(restored.excluded["codetypes.probe"], undefined);
  assert.equal(restored.managed["codetypes.probe"].pin, "1.1.0", "pause/resume must preserve pins");
  assert.equal(downloads, 0);
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
