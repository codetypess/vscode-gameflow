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
  const server = http.createServer(async (request, response) => {
    requests.push(request.url);
    if (request.url === "/probe/metadata.json" && control.signed) { if (control.beforeMetadata) await control.beforeMetadata(); response.end(control.signed); }
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
  const windowState = { focused: options.focused !== false };
  const focusListeners = [];
  const control = { response: undefined, ...options };
  const storage = path.join(directory, options.profile || "profile");
  const vscode = {
    ExtensionMode: { Production: 1 }, version: options.vscodeVersion || "1.146.0", env: { remoteName: options.remoteName },
    window: {
      state: windowState,
      onDidChangeWindowState: (listener) => { focusListeners.push(listener); return { dispose() { const index = focusListeners.indexOf(listener); if (index >= 0) focusListeners.splice(index, 1); } }; },
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
  return { api, prompts, installs, errors, control, storage, commands, startup: () => timers.find((timer) => timer.delay === 30000).handler(), focus: async (focused) => { windowState.focused = focused; await Promise.all(focusListeners.map((listener) => listener({ focused }))); } };
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

test("publisher transfer requires an explicit same-name source ID and preserves historical packages", async (t) => {
  const directory = temporary(t);
  publisher.initialize(directory);
  const old = await packageFile(directory, "probe", "1.0.0", "codetypes");
  await publisher.publish(directory, old, "stable", false);
  await publisher.publish(directory, await packageFile(directory, "other", "1.0.0"), "stable", false);
  const next = await packageFile(directory, "probe", "1.1.0", "codetypess");
  const metadataPath = path.join(directory, "public/probe/metadata.json");
  const previousMetadata = fs.readFileSync(metadataPath);
  const previousOther = fs.readFileSync(path.join(directory, "public/other/metadata.json"));
  const publicKey = fs.readFileSync(path.join(directory, "signing-public.pem"));
  const catalogPath = path.join(directory, "public/catalog.json");
  const before = lib.verifyCatalog(fs.readFileSync(catalogPath), publicKey);
  await assert.rejects(publisher.publish(directory, next, "stable", false), /another publisher/);
  for (const [channel, from] of [["beta", "codetypes.probe"], ["stable", "codetypes.other"], ["stable", "missing.probe"], ["stable", "codetypess.probe"]]) {
    await assert.rejects(publisher.publish(directory, next, channel, false, from), /replacement|Replacement/);
    assert.deepEqual(fs.readFileSync(metadataPath), previousMetadata);
    assert.equal(lib.verifyCatalog(fs.readFileSync(catalogPath), publicKey).revision, before.revision);
  }
  await publisher.publish(directory, next, "stable", false, "codetypes.probe");
  const after = lib.verifyCatalog(fs.readFileSync(catalogPath), publicKey);
  assert.equal(after.revision, before.revision + 1);
  assert.equal(after.extensions["codetypes.probe"], undefined);
  assert.equal(after.extensions["codetypess.probe"].channels.stable, "1.1.0");
  assert.equal(lib.verifyMetadata(fs.readFileSync(metadataPath), publicKey, "codetypess.probe").version, "1.1.0");
  assert.deepEqual(fs.readFileSync(path.join(directory, "public/probe/1.0.0.vsix")), fs.readFileSync(old));
  assert.deepEqual(fs.readFileSync(path.join(directory, "public", lib.releasePath("codetypes.probe", "1.0.0"))), fs.readFileSync(old));
  assert.deepEqual(fs.readFileSync(path.join(directory, "public/other/metadata.json")), previousOther);
  assert.ok(fs.readdirSync(path.join(directory, "backups")).some(file => lib.verifyCatalog(fs.readFileSync(path.join(directory, "backups", file)), publicKey).extensions["codetypes.probe"]));
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

test("background startup defers until focus and losing focus during metadata defers the prompt", async (t) => {
  const directory = temporary(t);
  const bytes = fs.readFileSync(await packageFile(directory));
  const pair = crypto.generateKeyPairSync("ed25519");
  const control = { bytes, signed: lib.signMetadata(metadata(bytes), pair.privateKey) };
  const server = await serve(t, control);
  const app = boot(t, directory, server.source, pair.publicKey, { focused: false });
  await app.startup();
  assert.equal(server.requests.length, 0, "background windows must not claim an update prompt");
  await app.focus(true);
  assert.equal(app.prompts.length, 1);
  const other = boot(t, directory, server.source, pair.publicKey, { profile: "changed-focus" });
  let arrived;
  let release;
  const requested = new Promise((resolve) => { arrived = resolve; });
  control.beforeMetadata = () => { arrived(); return new Promise((resolve) => { release = resolve; }); };
  const checking = other.startup();
  await requested;
  await other.focus(false);
  release();
  await checking;
  assert.equal(other.prompts.length, 0, "must recheck focus after the network response");
  delete control.beforeMetadata;
  await other.focus(true);
  assert.equal(other.prompts.length, 1);
});

test("an unanswered background notification never holds the install lock or blocks another focused window", async (t) => {
  const directory = temporary(t);
  const bytes = fs.readFileSync(await packageFile(directory));
  const pair = crypto.generateKeyPairSync("ed25519");
  const server = await serve(t, { bytes, signed: lib.signMetadata(metadata(bytes), pair.privateKey) });
  let accept;
  let prompted;
  const ready = new Promise((resolve) => { prompted = resolve; });
  const first = boot(t, directory, server.source, pair.publicKey, { prompt: () => { prompted(); return new Promise((resolve) => { accept = resolve; }); } });
  const second = boot(t, directory, server.source, pair.publicKey, { focused: false, response: "安装更新" });
  const checking = first.startup();
  await ready;
  assert.equal(fs.existsSync(path.join(first.storage, "self-update.lock")), false, "a notification awaiting user input must not own a shared lock");
  await first.focus(false);
  await second.focus(true);
  assert.equal(second.prompts.length, 1);
  assert.deepEqual(second.installs, ["codetypes.probe@1.1.0"]);
  accept("安装更新");
  await checking;
  assert.equal(first.installs.length, 0, "confirmation of an old prompt must recheck shared pending state");
  assert.equal(server.requests.filter((url) => url.endsWith(".vsix")).length, 1);
  assert.equal(fs.existsSync(path.join(first.storage, "self-update.lock")), false);
});

test("returning to the foreground reoffers a missed prompt and old dismissal cannot clear the new prompt", async (t) => {
  const directory = temporary(t);
  const bytes = fs.readFileSync(await packageFile(directory));
  const pair = crypto.generateKeyPairSync("ed25519");
  const server = await serve(t, { bytes, signed: lib.signMetadata(metadata(bytes), pair.privateKey) });
  const choices = [];
  const waiting = [];
  const nextPrompt = () => new Promise((resolve) => waiting.push(resolve));
  const app = boot(t, directory, server.source, pair.publicKey, { prompt: () => new Promise((resolve) => { choices.push(resolve); waiting.shift()(); }) });
  const initialPrompt = nextPrompt();
  const initialCheck = app.startup();
  await initialPrompt;
  await app.focus(false);
  const newPrompt = nextPrompt();
  const focusCheck = app.focus(true);
  await newPrompt;
  assert.equal(app.prompts.length, 2);
  choices[0]("稍后");
  await initialCheck;
  await app.startup();
  assert.equal(app.prompts.length, 2, "an older notification must not erase the current prompt guard");
  choices[1]("稍后");
  await focusCheck;
  assert.equal(app.installs.length, 0);
  assert.equal(fs.existsSync(path.join(app.storage, "self-update.lock")), false);
});

test("workbench confirmation installs while notification is unanswered and does not install twice", async (t) => {
  const directory = temporary(t);
  const bytes = fs.readFileSync(await packageFile(directory));
  const pair = crypto.generateKeyPairSync("ed25519");
  const server = await serve(t, { bytes, signed: lib.signMetadata(metadata(bytes), pair.privateKey) });
  let accept, prompted;
  const ready = new Promise(resolve => { prompted = resolve; });
  const app = boot(t, directory, server.source, pair.publicKey, { prompt: () => { prompted(); return new Promise(resolve => { accept = resolve; }); } });
  const states = [];
  app.api.subscribe(state => states.push(state.status));
  const checking = app.startup();
  await ready;
  assert.equal(app.api.getState().status, "available");
  assert.equal(app.api.getState().version, "1.1.0");
  assert.equal(server.requests.filter(url => url.endsWith(".vsix")).length, 0);
  assert.equal(fs.existsSync(path.join(app.storage, "self-update.lock")), false);
  const installing = app.api.install();
  assert.equal(app.api.getState().status, "installing");
  await app.api.install();
  await installing;
  accept("安装更新"); await checking;
  assert.deepEqual(states, ["available", "installing", "pending"]);
  assert.equal(app.installs.length, 1);
  assert.equal(server.requests.filter(url => url.endsWith(".vsix")).length, 1);
  const restarted = boot(t, directory, server.source, pair.publicKey);
  assert.equal(restarted.api.getState().status, "pending", "pending is available to new panels before a network check");
  const upgraded = boot(t, directory, server.source, pair.publicKey, { version: "1.1.0" });
  await upgraded.startup();
  assert.equal(upgraded.api.getState().status, "current");
});

test("later keeps workbench update visible, failed installs allow retry and listeners dispose", async (t) => {
  const directory = temporary(t);
  const bytes = fs.readFileSync(await packageFile(directory));
  const pair = crypto.generateKeyPairSync("ed25519");
  const control = { bytes, signed: lib.signMetadata(metadata(bytes), pair.privateKey) };
  const server = await serve(t, control);
  const app = boot(t, directory, server.source, pair.publicKey, { response: "稍后", failInstall: true });
  const states = [];
  const subscription = app.api.subscribe(state => states.push(state));
  await app.startup();
  assert.equal(app.api.getState().status, "available");
  assert.equal(app.installs.length, 0);
  await app.api.install();
  assert.equal(app.api.getState().status, "available");
  assert.match(app.api.getState().error, /installation denied/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(app.storage, "self-update.json"))).pendingVersion, undefined);
  app.control.failInstall = false;
  subscription.dispose();
  const count = states.length;
  await app.api.install();
  assert.equal(app.api.getState().status, "pending");
  assert.equal(states.length, count);
});

test("invalid or incompatible metadata never gates the workbench", async (t) => {
  const directory = temporary(t);
  const bytes = fs.readFileSync(await packageFile(directory));
  const pair = crypto.generateKeyPairSync("ed25519");
  const control = { bytes, signed: lib.signMetadata(metadata(bytes, { engines: { vscode: "^999.0.0" } }), pair.privateKey) };
  const server = await serve(t, control);
  const app = boot(t, directory, server.source, pair.publicKey);
  await app.startup();
  assert.equal(app.api.getState().status, "current");
  control.signed = "invalid";
  await app.startup();
  assert.equal(app.api.getState().status, "current");
  await app.api.install();
  assert.equal(app.installs.length, 0);
});
