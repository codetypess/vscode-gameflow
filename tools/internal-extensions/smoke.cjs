"use strict";
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const root = path.resolve(__dirname, "../..");
const smoke = path.join(root, "dist/distribution-smoke");
const installRoot = path.join(process.env.LOCALAPPDATA, "Programs/Microsoft VS Code");
const code = path.join(installRoot, "Code.exe");
const candidates = fs.readdirSync(installRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(installRoot, entry.name, "resources/app/out/cli.js")).filter((file) => fs.existsSync(file));
if (candidates.length !== 1) throw new Error("Expected exactly one installed VS Code CLI");
const cli = candidates[0];
const settings = path.join(smoke, "user/User/settings.json");
const extensions = path.join(smoke, "extensions");
const updaterVersion = require("../../internal-updater/package.json").version;
function run(binary, args, env) { const result = cp.spawnSync(binary, args, { stdio: "inherit", windowsHide: true, env: env || process.env }); if (result.error) throw result.error; if (result.status) throw new Error(`${binary} exited ${result.status}`); }
function prepare() {
  fs.mkdirSync(path.dirname(settings), { recursive: true });
  fs.mkdirSync(extensions, { recursive: true });
  fs.writeFileSync(settings, JSON.stringify({ "internalUpdater.serverUrl": require("./trust.json").serverUrl, "extensions.autoUpdate": false, "extensions.autoCheckUpdates": false, "update.mode": "none", "telemetry.telemetryLevel": "off", "workbench.startupEditor": "none", "security.workspace.trust.enabled": false }));
  for (const version of ["0.1.0", "0.1.1"]) {
    const folder = path.join(smoke, `probe-${version}`); fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, "package.json"), JSON.stringify({ name: "update-probe", displayName: "Internal Update Probe (deployment test)", description: "Hidden deployment verification fixture", publisher: "codetypes", version, license: "MIT", engines: { vscode: "^1.105.0" }, contributes: { configuration: { title: "Internal Update Probe", properties: { "internalUpdateProbe.fixtureVersion": { type: "string", default: version } } } } }));
    fs.writeFileSync(path.join(folder, "README.md"), "# Internal Update Probe\nHidden deployment verification fixture.\n");
    fs.copyFileSync(path.join(root, "LICENSE"), path.join(folder, "LICENSE"));
    const result = cp.spawnSync(process.execPath, [path.join(path.dirname(require.resolve("@vscode/vsce/package.json")), "vsce"), "package", "--no-dependencies", "--allow-missing-repository", "--out", path.join(smoke, `probe-${version}.vsix`)], { cwd: folder, stdio: "inherit", windowsHide: true });
    if (result.status) throw new Error("Probe packaging failed");
  }
  const runner = path.join(smoke, "runner"); fs.mkdirSync(runner, { recursive: true });
  fs.writeFileSync(path.join(runner, "package.json"), JSON.stringify({ name: "internal-update-test-runner", publisher: "codetypes", version: "0.0.1", engines: { vscode: "^1.105.0" }, main: "./extension.cjs" }));
  fs.writeFileSync(path.join(runner, "extension.cjs"), "exports.activate = () => {};\n");
  fs.writeFileSync(path.join(runner, "run.cjs"), `
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vscode = require('vscode');
exports.run = async function () {
  const resultPath = path.join(process.env.BIT_VSIX_SMOKE_ROOT, 'result.json');
  try {
    const extension = vscode.extensions.getExtension('codetypes.internal-updater');
    assert.ok(extension, 'updater must be installed normally');
    assert.equal(extension.packageJSON.version, '${updaterVersion}');
    const api = await extension.activate();
    await api.enroll('codetypes.update-probe');
    // Accept the native "安装更新" prompt manually in the isolated test window.
    const first = await api.check({ silent: true });
    assert.deepEqual(first.errors, []);
    assert.ok(first.updated.includes('codetypes.update-probe@0.1.1'), JSON.stringify(first));
    const second = await api.check({ silent: true });
    assert.deepEqual(second.errors, []);
    assert.equal(second.updated.length, 0);
    const installed = fs.readdirSync(path.join(process.env.BIT_VSIX_SMOKE_ROOT, 'extensions')).filter(name => name.startsWith('codetypes.update-probe-0.1.1'));
    assert.equal(installed.length, 1, 'VS Code must have installed the updated package');
    fs.writeFileSync(resultPath, JSON.stringify({ ok: true, vscode: vscode.version, first, second, installed, time: new Date().toISOString() }, null, 2));
  } catch (error) { fs.writeFileSync(resultPath, JSON.stringify({ ok: false, message: error.message, stack: error.stack }, null, 2)); throw error; }
};
`);
  console.log(smoke);
}
function install() {
  for (const file of [path.join(root, `dist/packages/codetypes.internal-updater-${updaterVersion}.vsix`), path.join(smoke, "probe-0.1.0.vsix")]) run(code, [cli, "--user-data-dir", path.join(smoke, "user"), "--extensions-dir", extensions, "--install-extension", file, "--force"], { ...process.env, ELECTRON_RUN_AS_NODE: "1" });
}
if (process.argv[2] === "prepare") prepare();
else if (process.argv[2] === "install") install();
else if (process.argv[2] === "paths") console.log(JSON.stringify({ code, cli, smoke, extensions }));
else throw new Error("Use prepare, install or paths");
