"use strict";
const vscode = require("vscode");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const semver = require("semver");
const lib = require("./lib.cjs");
const TRUST = __UPDATER_TRUST__;

function activateSelfUpdate(context, namespace) {
  const id = context.extension.id;
  const name = context.extension.packageJSON.name;
  const title = context.extension.packageJSON.displayName || name;
  lib.assert(lib.ID_PATTERN.test(id) && id.split(".")[1] === name, "Invalid self-update extension identity");
  const endpoint = new URL(`${name}/metadata.json`, lib.sourceUrl(TRUST.serverUrl));
  const output = vscode.window.createOutputChannel(`${title} 更新`);
  const stateFile = path.join(context.globalStorageUri.fsPath, "self-update.json");
  const lockFile = path.join(context.globalStorageUri.fsPath, "self-update.lock");
  let checking = false;
  let waitingForFocus = true;
  let prompt;
  let available;
  let installing = false;
  let view = { status: "current" };
  const listeners = new Set();
  const local = !vscode.env.remoteName && context.extensionMode === vscode.ExtensionMode.Production && context.extensionUri.scheme === "file";
  function publish(next) {
    view = next;
    for (const listener of listeners) {
      try { listener({ ...view }); } catch (error) { log(`更新状态监听失败：${error.message}`); }
    }
  }
  function log(message) { output.appendLine(`[${new Date().toISOString()}] ${message}`); }
  function state() {
    if (!fs.existsSync(stateFile)) return { revision: 0 };
    const value = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    lib.assert(Number.isSafeInteger(value.revision) && value.revision >= 0 && (!value.pendingVersion || semver.valid(value.pendingVersion)), "更新状态损坏，请查看更新日志");
    return value;
  }
  function save(value) {
    const temporary = `${stateFile}.${crypto.randomUUID()}.tmp`;
    try { fs.writeFileSync(temporary, JSON.stringify(value), { flag: "wx" }); fs.renameSync(temporary, stateFile); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
  async function locked(work) {
    const token = crypto.randomUUID();
    try {
      const fd = fs.openSync(lockFile, "wx");
      try { fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, token })); } finally { fs.closeSync(fd); }
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        const bytes = fs.readFileSync(lockFile, "utf8");
        const owner = JSON.parse(bytes);
        let alive = true;
        try { process.kill(owner.pid, 0); } catch (problem) { if (problem.code === "ESRCH") alive = false; }
        if (!alive && fs.readFileSync(lockFile, "utf8") === bytes) { fs.unlinkSync(lockFile); return locked(work); }
      } catch { /* Leave active or incomplete locks intact. */ }
      throw new Error("另一个窗口正在检查或安装更新，请稍后重试。");
    }
    try { return await work(); }
    finally { try { if (JSON.parse(fs.readFileSync(lockFile, "utf8")).token === token) fs.unlinkSync(lockFile); } catch { /* Never remove another owner's lock. */ } }
  }
  async function check(options) {
    const interactive = options?.silent !== true;
    const result = { updated: [], errors: [] };
    if (!interactive && (!local || vscode.workspace.getConfiguration(namespace).inspect("checkForUpdates")?.globalValue === false)) return result;
    if (!interactive && !vscode.window.state.focused) {
      waitingForFocus = true;
      log("窗口未聚焦，返回此窗口时再检查更新");
      return result;
    }
    if (checking || installing) return result;
    try {
      lib.assert(local, "请从本地 VS Code 的正式安装中检查更新。");
      fs.mkdirSync(context.globalStorageUri.fsPath, { recursive: true });
      const installed = context.extension.packageJSON.version;
      let metadata;
      let status;
      checking = true;
      try {
        log(`检查当前版本 ${installed}`);
        metadata = lib.verifyMetadata(await lib.requestBuffer(endpoint, 64 * 1024, 15000), TRUST.publicKey, id, state().revision);
        await locked(() => {
          const current = state();
          lib.assert(metadata.revision >= current.revision, "更新元信息已变化，请重新检查。");
          if (current.pendingVersion && semver.lte(current.pendingVersion, installed)) delete current.pendingVersion;
          current.revision = metadata.revision;
          save(current);
          status = current.pendingVersion ? "pending" : semver.gt(metadata.version, installed) && semver.satisfies(vscode.version, metadata.engines.vscode) ? "available" : "current";
          if (!installing) {
            available = status === "available" ? metadata : undefined;
            publish(status === "current" ? { status } : { status, version: current.pendingVersion || metadata.version });
          }
        });
      } finally { checking = false; }
      if (!interactive && !vscode.window.state.focused) { waitingForFocus = true; log("窗口已失焦，返回此窗口时再提示更新"); return result; }
      waitingForFocus = false;
      if (status !== "available") {
        if (interactive) vscode.window.showInformationMessage(status === "pending" ? "更新已安装，请按 VS Code 的提示完成生效。" : "当前已是最新兼容版本。");
        return result;
      }
      if (!interactive && prompt?.version === metadata.version) return result;
      const ownPrompt = { version: metadata.version };
      prompt = ownPrompt;
      log(`发现新版 ${metadata.version}，在当前窗口提示安装`);
      let response;
      try { response = await vscode.window.showInformationMessage(`${title} 有新版本：${installed} → ${metadata.version}。`, "安装更新", "稍后"); }
      finally { if (prompt === ownPrompt) prompt = undefined; }
      if (response !== "安装更新") return result;
      return install(metadata, interactive);
    } catch (error) {
      log(`检查失败：${error.message}`);
      result.errors.push(error.message);
      if (interactive) vscode.window.showErrorMessage(`${title} 更新失败：${error.message}`);
    }
    return result;
  }
  async function install(metadata = available, interactive = true) {
    const result = { updated: [], errors: [] };
    if (installing) return result;
    if (view.status === "pending") {
      if (interactive) vscode.window.showInformationMessage("更新已安装，请先保存文件，再按 VS Code 的提示完成生效。");
      return result;
    }
    if (!metadata) return result;
    installing = true;
    publish({ status: "installing", version: metadata.version });
    try {
      lib.assert(local, "请从本地 VS Code 的正式安装中更新插件。");
      await locked(async () => {
        const current = state();
        if (current.pendingVersion) { publish({ status: "pending", version: current.pendingVersion }); log(`已有更新 ${current.pendingVersion} 等待生效，不重复安装`); return; }
        lib.assert(metadata.revision >= current.revision, "更新元信息已变化，请重新检查。");
        const temporary = fs.mkdtempSync(path.join(context.globalStorageUri.fsPath, "self-update-download-"));
        try {
          log(`下载 ${id}@${metadata.version}`);
          const bytes = await lib.requestBuffer(new URL(metadata.url, endpoint), metadata.size, 5 * 60 * 1000);
          lib.assert(bytes.length === metadata.size && lib.sha256(bytes) === metadata.sha256, "安装包摘要或大小不匹配");
          const file = path.join(temporary, "extension.vsix");
          fs.writeFileSync(file, bytes, { flag: "wx" });
          const pkg = await lib.readVsix(file);
          lib.assert(pkg.id === id && pkg.manifest.version === metadata.version && pkg.manifest.engines.vscode === metadata.engines.vscode, "安装包身份与元信息不匹配");
          current.pendingVersion = metadata.version;
          save(current);
          try { await vscode.commands.executeCommand("workbench.extensions.installExtension", vscode.Uri.file(file)); }
          catch (error) { delete current.pendingVersion; save(current); throw error; }
          result.updated.push(`${id}@${metadata.version}`);
          publish({ status: "pending", version: metadata.version });
          log(`已安装 ${id}@${metadata.version}`);
          vscode.window.showInformationMessage(`${title} ${metadata.version} 已安装。如需重载，请先保存文件，再按 VS Code 提示操作。`);
        } finally {
          lib.assert(path.dirname(path.resolve(temporary)) === path.resolve(context.globalStorageUri.fsPath) && path.basename(temporary).startsWith("self-update-download-"), "拒绝清理非更新临时目录");
          fs.rmSync(temporary, { recursive: true, force: true });
        }
      });
    } catch (error) {
      publish({ status: "available", version: metadata.version, error: error.message });
      log(`安装失败：${error.message}`);
      result.errors.push(error.message);
      if (interactive) vscode.window.showErrorMessage(`${title} 更新失败：${error.message}`);
    } finally { installing = false; }
    return result;
  }
  context.subscriptions.push(output,
    vscode.commands.registerCommand(`${namespace}.checkForUpdates`, () => check()),
    vscode.commands.registerCommand(`${namespace}.showUpdateLog`, () => output.show()),
    vscode.window.onDidChangeWindowState((event) => {
      if (!event.focused && prompt) { prompt = undefined; waitingForFocus = true; }
      if (event.focused && waitingForFocus) return check({ silent: true });
    })
  );
  const startup = setTimeout(() => check({ silent: true }), 30000);
  const polling = setInterval(() => check({ silent: true }), 6 * 60 * 60 * 1000);
  context.subscriptions.push({ dispose() { clearTimeout(startup); clearInterval(polling); listeners.clear(); } });
  log(`自身更新元信息：${endpoint.href}`);
  if (local) {
    try { const pending = state().pendingVersion; if (pending && semver.gt(pending, context.extension.packageJSON.version)) view = { status: "pending", version: pending }; }
    catch (error) { log(error.message); }
  }
  return { check, install: () => install(), getState: () => ({ ...view }), subscribe(listener) { listeners.add(listener); return { dispose() { listeners.delete(listener); } }; } };
}
module.exports = { activateSelfUpdate };
