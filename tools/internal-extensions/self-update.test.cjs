"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const http = require("node:http");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const yazl = require("yazl");
const lib = require("./lib.cjs");
const publisher = require("./publisher.cjs");

function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bit-self-update-test-"));
  t.after(() => { assert.equal(path.dirname(directory), os.tmpdir()); assert.match(path.basename(directory), /^bit-self-update-test-/); fs.rmSync(directory, { recursive: true, force: true }); });
  return directory;
}
async function packageFile(directory, name = "probe", version = "1.1.0", owner = "codetypes") {
  const file = path.join(directory, `${owner}-${name}-${version}.vsix`);
  const zip = new yazl.ZipFile();
  zip.addBuffer(Buffer.from(JSON.stringify({ name, publisher: owner, displayName: "测试插件", version, engines: { vscode: "^1.105.0" } })), "extension/package.json");
  zip.addBuffer(Buffer.from(`<PackageManifest><Identity Id="${name}" Publisher="${owner}" Version="${version}" /></PackageManifest>`), "extension.vsixmanifest");
  zip.end();
  await new Promise((resolve, reject) => { const stream = fs.createWriteStream(file); zip.outputStream.pipe(stream); stream.on("finish", resolve); stream.on("error", reject); });
  return file;
}
function metadata(bytes, extra = {}) {
  return { schemaVersion: 1, id: "codetypes.probe", displayName: "测试插件", version: "1.1.0", engines: { vscode: "^1.105.0" }, url: "1.1.0.vsix", size: bytes.length, sha256: lib.sha256(bytes), revision: 3, ...extra };
}
async function serve(t, control) {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push(request.url);
    if (request.url === "/probe/metadata.json" && control.signed) response.end(control.signed);
    else if (request.url === "/probe/1.1.0.vsix") response.end(control.bytes);
    else { response.writeHead(404); response.end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  return { source: `http://127.0.0.1:${server.address().port}/`, requests };
}
function boot(t, directory, source, publicKey, options = {}) {
  const subscriptions = [];
  const prompts = [];
  const installs = [];
  const errors = [];
  const timers = [];
  const commands = new Map();
  const control = { response: undefined, ...options };
  const storage = path.join(directory, options.profile || "profile");
  const vscode = {
    ExtensionMode: { Production: 1 }, version: options.vscodeVersion || "1.146.0", env: { remoteName: options.remoteName },
    window: {
      createOutputChannel: () => ({ appendLine() {}, show() {}, dispose() {} }),
      showInformationMessage: async (message, ...actions) => {
        if (!actions.includes("安装更新")) return;
        prompts.push(message);
        if (control.prompt) return control.prompt();
        return control.response;
      },
      showErrorMessage: async (message) => { errors.push(message); }
    },
    workspace: { getConfiguration: () => ({ inspect: () => ({ globalValue: options.autoCheck, workspaceValue: false }) }) },
    Uri: { file: (file) => ({ fsPath: file }) },
    commands: {
      registerCommand: (id, handler) => { commands.set(id, handler); return { dispose() {} }; },
      executeCommand: async (id, uri) => {
        assert.equal(id, "workbench.extensions.installExtension");
        const pkg = await lib.readVsix(uri.fsPath);
        installs.push(`${pkg.id}@${pkg.manifest.version}`);
        if (control.failInstall) throw new Error("installation denied");
      }
    }
  };
  const file = path.resolve(__dirname, "self-update.cjs");
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), { module, exports: module.exports, require: (id) => id === "vscode" ? vscode : createRequire(file)(id), __UPDATER_TRUST__: { serverUrl: source, publicKey }, Buffer, URL, process, setTimeout: (handler, delay) => { const timer = { handler, delay }; timers.push(timer); return timer; }, setInterval: () => ({}), clearTimeout() {}, clearInterval() {} });
  const api = module.exports.activateSelfUpdate({ extension: { id: "codetypes.probe", packageJSON: { name: "probe", displayName: "测试插件", version: options.version || "1.0.0" } }, globalStorageUri: { fsPath: storage }, extensionUri: { scheme: options.scheme || "file" }, extensionMode: options.mode || 1, subscriptions }, "probe");
  t.after(() => { for (const subscription of subscriptions) subscription.dispose(); });
  return { api, prompts, installs, errors, control, storage, commands, startup: () => timers.find((timer) => timer.delay === 30000).handler() };
}

test("per-plugin metadata is readable, signed, identity-scoped and rejects unsafe or replayed releases", () => {
  const pair = crypto.generateKeyPairSync("ed25519");
  const original = metadata(Buffer.from("package"));
  const signed = lib.signMetadata(original, pair.privateKey);
  assert.equal(JSON.parse(signed).version, "1.1.0");
  assert.equal(lib.verifyMetadata(Buffer.from(signed), pair.publicKey, original.id, 3).url, "1.1.0.vsix");
  assert.throws(() => lib.verifyMetadata(Buffer.from(signed.replace("测试插件", "篡改插件")), pair.publicKey, original.id), /signature/);
  assert.throws(() => lib.verifyMetadata(Buffer.from(signed), crypto.generateKeyPairSync("ed25519").publicKey, original.id), /signature/);
  assert.throws(() => lib.verifyMetadata(Buffer.from(signed), pair.publicKey, "other.probe"), /identity/);
  assert.throws(() => lib.verifyMetadata(Buffer.from(signed), pair.publicKey, original.id, 4), /rollback/);
  for (const extra of [{ url: "https://other.test/package.vsix" }, { version: "..", url: "...vsix" }, { size: 0 }, { engines: { vscode: "invalid" } }, { schemaVersion: 9 }]) assert.throws(() => lib.signMetadata({ ...original, ...extra }, pair.privateKey));
});

test("publisher creates separate metadata folders, preserves packages and handles stable rollback and removal", async (t) => {
  const directory = temporary(t);
  publisher.initialize(directory);
  const first = await packageFile(directory, "probe", "1.0.0");
  const second = await packageFile(directory, "probe", "1.1.0");
  await publisher.publish(directory, first, "stable", false);
  await publisher.publish(directory, second, "stable", false);
  await publisher.publish(directory, await packageFile(directory, "another"), "stable", false);
  const publicKey = fs.readFileSync(path.join(directory, "signing-public.pem"));
  const ownPath = path.join(directory, "public/probe/metadata.json");
  const own = fs.readFileSync(ownPath);
  assert.equal(lib.verifyMetadata(own, publicKey, "codetypes.probe").version, "1.1.0");
  assert.equal(lib.verifyMetadata(fs.readFileSync(path.join(directory, "public/another/metadata.json")), publicKey, "codetypes.another").version, "1.1.0");
  assert.deepEqual(fs.readFileSync(path.join(directory, "public/probe/1.0.0.vsix")), fs.readFileSync(first));
  assert.deepEqual(fs.readFileSync(path.join(directory, "public/probe/1.1.0.vsix")), fs.readFileSync(second));
  await assert.rejects(publisher.publish(directory, await packageFile(directory, "probe", "2.0.0", "other"), "stable", false), /another publisher/);
  assert.deepEqual(fs.readFileSync(ownPath), own);
  await publisher.promote(directory, "codetypes.probe", "1.0.0");
  const rollback = lib.verifyMetadata(fs.readFileSync(ownPath), publicKey, "codetypes.probe", 4);
  assert.equal(rollback.version, "1.0.0");
  await publisher.promote(directory, "codetypes.probe", "none");
  assert.equal(fs.existsSync(ownPath), false);
  assert.deepEqual(fs.readFileSync(path.join(directory, "public/probe/1.1.0.vsix")), fs.readFileSync(second));
});

test("one installed VSIX checks its own metadata on startup, prompts and installs only after confirmation", async (t) => {
  const directory = temporary(t);
  const bytes = fs.readFileSync(await packageFile(directory));
  const pair = crypto.generateKeyPairSync("ed25519");
  const control = { bytes, signed: lib.signMetadata(metadata(bytes), pair.privateKey) };
  const server = await serve(t, control);
  const app = boot(t, directory, server.source, pair.publicKey);
  await app.startup();
  assert.equal(app.prompts.length, 1);
  assert.match(app.prompts[0], /1\.0\.0.*1\.1\.0/);
  assert.deepEqual(server.requests, ["/probe/metadata.json"]);
  app.control.response = "稍后";
  await app.api.check();
  assert.equal(app.installs.length, 0);
  assert.equal(server.requests.filter((url) => url.endsWith(".vsix")).length, 0);
  app.control.response = "安装更新";
  assert.equal((await app.commands.get("probe.checkForUpdates")()).updated.length, 1);
  assert.deepEqual(app.installs, ["codetypes.probe@1.1.0"]);
  const prompts = app.prompts.length;
  await app.startup();
  assert.equal(app.prompts.length, prompts);
  assert.equal(app.installs.length, 1);
  const restarted = boot(t, directory, server.source, pair.publicKey, { version: "1.1.0" });
  await restarted.startup();
  assert.equal(restarted.prompts.length, 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(app.storage, "self-update.json"))).pendingVersion, undefined);
  assert.ok(server.requests.every((url) => url === "/probe/metadata.json" || url === "/probe/1.1.0.vsix"));
  assert.equal(fs.existsSync(path.join(app.storage, "self-update.lock")), false);
});

test("embedded automatic checks respect user pause, local installs, profiles and engine compatibility", async (t) => {
  const directory = temporary(t);
  const bytes = fs.readFileSync(await packageFile(directory));
  const pair = crypto.generateKeyPairSync("ed25519");
  const server = await serve(t, { bytes, signed: lib.signMetadata(metadata(bytes), pair.privateKey) });
  for (const [name, options] of Object.entries({ paused: { autoCheck: false }, remote: { remoteName: "ssh-remote" }, development: { mode: 2 }, nonFile: { scheme: "vscode-remote" } })) {
    const app = boot(t, directory, server.source, pair.publicKey, { profile: name, ...options });
    const before = server.requests.length;
    await app.startup();
    assert.equal(server.requests.length, before);
    assert.equal(app.prompts.length, 0);
    if (name === "paused") { await app.api.check(); assert.equal(app.prompts.length, 1); }
  }
  const incompatible = boot(t, directory, server.source, pair.publicKey, { profile: "old-code", vscodeVersion: "1.100.0", response: "安装更新" });
  await incompatible.startup();
  assert.equal(incompatible.installs.length, 0);
  assert.equal(incompatible.prompts.length, 0);
  const fresh = boot(t, directory, server.source, pair.publicKey, { profile: "separate-profile" });
  await fresh.startup();
  assert.equal(fresh.prompts.length, 1);
});

test("embedded client rejects tampering, bad packages and stale metadata without installing", async (t) => {
  const directory = temporary(t);
  const bytes = fs.readFileSync(await packageFile(directory));
  const foreign = fs.readFileSync(await packageFile(directory, "other"));
  const pair = crypto.generateKeyPairSync("ed25519");
  const control = { bytes, signed: lib.signMetadata(metadata(bytes), pair.privateKey) };
  const server = await serve(t, control);
  for (const scenario of ["signature", "digest", "identity", "replay", "missing"]) {
    control.bytes = scenario === "identity" ? foreign : bytes;
    control.signed = lib.signMetadata(metadata(control.bytes), pair.privateKey);
    if (scenario === "signature") control.signed = control.signed.replace("测试插件", "篡改插件");
    if (scenario === "digest") { control.bytes = Buffer.from(bytes); control.bytes[control.bytes.length - 1] ^= 1; }
    if (scenario === "missing") control.signed = undefined;
    const app = boot(t, directory, server.source, pair.publicKey, { profile: scenario, response: "安装更新" });
    if (scenario === "replay") { fs.mkdirSync(app.storage); fs.writeFileSync(path.join(app.storage, "self-update.json"), JSON.stringify({ revision: 4 })); }
    assert.equal((await app.api.check()).errors.length, 1, scenario);
    assert.equal(app.installs.length, 0);
    assert.equal(fs.existsSync(path.join(app.storage, "self-update.lock")), false);
  }
  assert.ok(server.requests.every((url) => url.startsWith("/probe/")), "must not fall back to a central catalog or companion extension");
});

test("failed native installation clears pending and temporary files so a later explicit retry can succeed", async (t) => {
  const directory = temporary(t);
  const bytes = fs.readFileSync(await packageFile(directory));
  const pair = crypto.generateKeyPairSync("ed25519");
  const server = await serve(t, { bytes, signed: lib.signMetadata(metadata(bytes), pair.privateKey) });
  const app = boot(t, directory, server.source, pair.publicKey, { response: "安装更新", failInstall: true });
  assert.equal((await app.api.check()).errors.length, 1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(app.storage, "self-update.json"))).pendingVersion, undefined);
  assert.deepEqual(fs.readdirSync(app.storage), ["self-update.json"]);
  app.control.failInstall = false;
  assert.equal((await app.api.check()).updated.length, 1);
  assert.equal(app.installs.length, 2);
});

test("two windows share one prompt and install lock, then release it after dismissal", async (t) => {
  const directory = temporary(t);
  const bytes = fs.readFileSync(await packageFile(directory));
  const pair = crypto.generateKeyPairSync("ed25519");
  const server = await serve(t, { bytes, signed: lib.signMetadata(metadata(bytes), pair.privateKey) });
  let accept;
  let prompted;
  const ready = new Promise((resolve) => { prompted = resolve; });
  const first = boot(t, directory, server.source, pair.publicKey, { prompt: () => { prompted(); return new Promise((resolve) => { accept = resolve; }); } });
  const second = boot(t, directory, server.source, pair.publicKey);
  const checking = first.startup();
  await ready;
  assert.equal((await second.startup()).errors.length, 1);
  assert.equal(second.prompts.length, 0);
  accept("稍后");
  await checking;
  await second.startup();
  assert.equal(second.prompts.length, 1);
  assert.equal(first.installs.length + second.installs.length, 0);
});
