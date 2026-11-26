"use strict";
const vscode = require("vscode");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const semver = require("semver");
const lib = require("../tools/internal-extensions/lib.cjs");
const TRUST = __UPDATER_TRUST__;
const SELF = "codetypes.internal-updater";

function activate(context) {
  const output = vscode.window.createOutputChannel("Bit 内部插件");
  context.subscriptions.push(output);
  fs.mkdirSync(context.globalStorageUri.fsPath, { recursive: true });
  const stateFile = path.join(context.globalStorageUri.fsPath, "state.json");
  const lockFile = path.join(context.globalStorageUri.fsPath, "install.lock");
  let running = false;
  function log(message) { output.appendLine(`[${new Date().toISOString()}] ${message}`); }
  function initialState() { return { managed: { [SELF]: {} }, excluded: {}, pending: {}, mode: "prompt", revision: 0 }; }
  function state() {
    if (!fs.existsSync(stateFile)) return initialState();
    const value = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    lib.assert(value && value.managed && value.pending && Number.isSafeInteger(value.revision), "更新器状态损坏，请查看日志并恢复备份");
    value.mode = value.mode === "off" ? "off" : "prompt";
    value.excluded ||= {};
    lib.assert(typeof value.excluded === "object" && !Array.isArray(value.excluded), "更新检查暂停设置损坏，请查看日志并恢复备份");
    delete value.independentAutoUpdate;
    return value;
  }
  function save(value) {
    const temporary = `${stateFile}.${crypto.randomUUID()}.tmp`;
    try { fs.writeFileSync(temporary, JSON.stringify(value), { flag: "wx" }); fs.renameSync(temporary, stateFile); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
  function localOnly() {
    lib.assert(!vscode.env.remoteName, "首版请从本地 VS Code 窗口管理插件，远端窗口不执行安装。");
    lib.assert(context.extensionMode === vscode.ExtensionMode.Production, "扩展开发环境不执行内部插件安装。");
  }
  async function locked(work) {
    const token = crypto.randomUUID();
    try {
      const fd = fs.openSync(lockFile, "wx");
      try { fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, token })); } finally { fs.closeSync(fd); }
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        const oldBytes = fs.readFileSync(lockFile, "utf8");
        const owner = JSON.parse(oldBytes);
        let alive = true;
        try { process.kill(owner.pid, 0); } catch (problem) { if (problem.code === "ESRCH") alive = false; }
        if (!alive && fs.readFileSync(lockFile, "utf8") === oldBytes) { fs.unlinkSync(lockFile); return locked(work); }
      } catch { /* An active or incomplete lock must not be stolen. */ }
      throw new Error("另一个窗口正在管理或更新插件，请稍后重试。");
    }
    try { return await work(); }
    finally {
      try { if (JSON.parse(fs.readFileSync(lockFile, "utf8")).token === token) fs.unlinkSync(lockFile); } catch { /* Never remove another owner's lock. */ }
    }
  }
  function server() {
    const inspect = vscode.workspace.getConfiguration("internalUpdater").inspect("serverUrl");
    return lib.sourceUrl(inspect?.globalValue || TRUST.serverUrl).href;
  }
  async function catalog() {
    const result = lib.verifyCatalog(await lib.requestBuffer(new URL("catalog.json", server()), 2 * 1024 * 1024, 15000), TRUST.publicKey, state().revision);
    await locked(() => {
      const current = state();
      lib.assert(result.revision >= current.revision, "拒绝旧版本目录");
      current.revision = result.revision;
      for (const [id, entry] of Object.entries(result.extensions)) {
        if (!entry.hidden && !current.excluded[id] && installedHere(vscode.extensions.getExtension(id))) current.managed[id] ||= {};
      }
      save(current);
    });
    return result;
  }
  function installedHere(extension) {
    return extension && extension.extensionUri.scheme === "file"
      && lib.sameExtensionRoot(extension.extensionPath, context.extensionPath);
  }
  async function install(id, release, allowDowngrade = false) {
    localOnly();
    return locked(async () => {
      const current = state();
      const installed = vscode.extensions.getExtension(id);
      if (installed) lib.assert(installedHere(installed), "扩展不在当前本地安装目录中，拒绝更新开发或其他位置的扩展");
      if (!allowDowngrade && installed && semver.gte(installed.packageJSON.version, release.version)) return false;
      if (current.pending[id]?.version === release.version) { log(`${id}@${release.version} 已安装或正在安装，等待 VS Code 生效`); return false; }
      const temporary = fs.mkdtempSync(path.join(context.globalStorageUri.fsPath, "download-"));
      try {
        log(`下载 ${id}@${release.version}`);
        const bytes = await lib.requestBuffer(lib.resolveReleaseUrl(server(), release.path), release.size, 5 * 60 * 1000);
        lib.assert(bytes.length === release.size && lib.sha256(bytes) === release.sha256, "安装包摘要或大小不匹配");
        const file = path.join(temporary, "extension.vsix");
        fs.writeFileSync(file, bytes, { flag: "wx" });
        const metadata = await lib.readVsix(file);
        lib.assert(metadata.id === id && metadata.manifest.version === release.version && metadata.manifest.engines.vscode === release.engines.vscode, "安装包身份与签名目录不匹配");
        lib.assert(semver.satisfies(vscode.version, metadata.manifest.engines.vscode), "当前 VS Code 版本不兼容");
        current.pending[id] = { version: release.version, at: new Date().toISOString() };
        save(current);
        try { await vscode.commands.executeCommand("workbench.extensions.installExtension", vscode.Uri.file(file)); }
        catch (error) { const failed = state(); delete failed.pending[id]; save(failed); throw error; }
        log(`已安装 ${id}@${release.version}；若 VS Code 要求重载，请保存文档后手动操作`);
        return true;
      } finally {
        const resolved = path.resolve(temporary);
        lib.assert(path.dirname(resolved) === path.resolve(context.globalStorageUri.fsPath) && path.basename(resolved).startsWith("download-"), "拒绝清理非临时目录");
        fs.rmSync(resolved, { recursive: true, force: true });
      }
    });
  }
  async function enroll(id) {
    localOnly();
    const data = await catalog();
    lib.assert(data.extensions[id] && installedHere(vscode.extensions.getExtension(id)), "只能将已安装的目录插件加入托管");
    await locked(() => { const current = state(); delete current.excluded[id]; current.managed[id] ||= {}; save(current); });
    return id;
  }
  async function check(options) {
    const interactive = options?.silent !== true;
    const result = { updated: [], skipped: [], errors: [] };
    if (running) return result;
    if (!interactive && (vscode.env.remoteName || context.extensionMode !== vscode.ExtensionMode.Production || state().mode === "off")) return result;
    running = true;
    try {
      localOnly();
      const data = await catalog();
      const current = state();
      const updates = [];
      for (const [id, managed] of Object.entries(current.managed)) {
        if (current.excluded[id]) continue;
        const extension = vscode.extensions.getExtension(id);
        if (!installedHere(extension)) { result.skipped.push(id); continue; }
        const pending = current.pending[id];
        if (pending?.version === extension.packageJSON.version) delete current.pending[id];
        const release = lib.selectRelease(data.extensions[id], vscode.version, extension.packageJSON.version, managed.pin);
        if (!release || !semver.gt(release.version, extension.packageJSON.version) || current.pending[id]?.version === release.version) continue;
        updates.push({ id, release });
      }
      await locked(() => { const latest = state(); for (const [id, pending] of Object.entries(latest.pending)) if (vscode.extensions.getExtension(id)?.packageJSON.version === pending.version) delete latest.pending[id]; save(latest); });
      if (!updates.length) { if (interactive) vscode.window.showInformationMessage("内部插件已是最新兼容版本，或正在等待 VS Code 生效。"); return result; }
      const versions = updates.map(({ id, release }) => `${data.extensions[id].displayName} ${vscode.extensions.getExtension(id).packageJSON.version} → ${release.version}`).join("；");
      const response = await vscode.window.showInformationMessage(`发现 ${updates.length} 个内部插件更新：${versions}。确认后下载安装，不会主动重载窗口。`, "安装更新", "稍后");
      if (response !== "安装更新") return result;
      updates.sort((a, b) => Number(a.id === SELF) - Number(b.id === SELF));
      for (const { id, release } of updates) {
        try { if (await install(id, release)) result.updated.push(`${id}@${release.version}`); }
        catch (error) { log(`${id}: ${error.message}`); result.errors.push({ id, message: error.message }); }
      }
      if (interactive && result.updated.length) vscode.window.showInformationMessage(`已安装 ${result.updated.length} 个更新；如需重载，请先保存文档。`);
      return result;
    } catch (error) {
      log(`检查失败: ${error.message}`);
      if (interactive) vscode.window.showErrorMessage(`内部插件更新失败：${error.message}`);
      result.errors.push({ message: error.message });
      return result;
    } finally { running = false; }
  }
  async function browse() {
    localOnly();
    const data = await catalog();
    const current = state();
    const items = Object.entries(data.extensions).filter(([, entry]) => !entry.hidden).map(([id, entry]) => ({
      label: entry.displayName, description: id,
      detail: `已安装 ${vscode.extensions.getExtension(id)?.packageJSON.version || "无"} · stable ${entry.channels.stable || "无"} · ${current.excluded[id] ? "已暂停检查" : current.managed[id]?.pin ? `固定 ${current.managed[id].pin}` : "新版提示安装"}`,
      id, entry
    }));
    const item = await vscode.window.showQuickPick(items, { title: "Bit 内部插件", placeHolder: "选择插件进行安装、检查设置或回退" });
    if (!item) return;
    const installed = vscode.extensions.getExtension(item.id);
    const actions = [installed ? "安装最新兼容版本" : "安装插件", ...(installed ? [current.excluded[item.id] ? "恢复更新检查" : "暂停更新检查", "固定版本 / 手动回退"] : [])];
    const action = await vscode.window.showQuickPick(actions, { title: item.label });
    if (!action) return;
    if (action === "暂停更新检查") { await locked(() => { const latest = state(); latest.excluded[item.id] = true; save(latest); }); return; }
    if (action === "恢复更新检查") { await enroll(item.id); return check(); }
    if (action === "固定版本 / 手动回退") {
      const versions = item.entry.releases.filter((release) => semver.satisfies(vscode.version, release.engines.vscode)).sort((a, b) => semver.rcompare(a.version, b.version));
      const choice = await vscode.window.showQuickPick([{ label: "跟随 stable", release: undefined }, ...versions.map((release) => ({ label: release.version, release }))], { title: "固定版本；选择旧版本将执行回退" });
      if (!choice) return;
      if (!choice.release) { await locked(() => { const latest = state(); delete latest.excluded[item.id]; latest.managed[item.id] = {}; save(latest); }); return; }
      const accepted = await vscode.window.showWarningMessage(`将 ${item.label} 固定并安装为 ${choice.release.version}。`, { modal: true }, "继续安装");
      if (accepted !== "继续安装") return;
      await locked(() => { const latest = state(); delete latest.excluded[item.id]; latest.managed[item.id] = { pin: choice.release.version }; delete latest.pending[item.id]; save(latest); });
      await install(item.id, choice.release, true);
      return;
    }
    const release = lib.selectRelease(item.entry, vscode.version);
    lib.assert(release, "没有兼容当前 VS Code 的 stable 版本");
    await locked(() => { const latest = state(); delete latest.excluded[item.id]; latest.managed[item.id] = {}; save(latest); });
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `安装 ${item.label}` }, () => install(item.id, release));
    vscode.window.showInformationMessage(`${item.label} 已安装，后续新版会自动提示；如需重载，请先保存文档。`);
  }
  async function manage() {
    const action = await vscode.window.showQuickPick(["浏览与安装插件", "立即检查更新", "更新模式", "查看日志"], { title: "Bit 内部插件" });
    if (action === "浏览与安装插件") return browse();
    if (action === "立即检查更新") return check();
    if (action === "查看日志") output.show();
    if (action === "更新模式") {
      const option = await vscode.window.showQuickPick([{ label: "自动检查，确认后安装", mode: "prompt" }, { label: "暂停自动检查", mode: "off" }], { title: "内部插件更新模式" });
      if (option) await locked(() => { const latest = state(); latest.mode = option.mode; save(latest); });
    }
  }
  function register(name, handler) {
    context.subscriptions.push(vscode.commands.registerCommand(name, async (...args) => {
      try { return await handler(...args); }
      catch (error) { log(error.message); vscode.window.showErrorMessage(error.message); throw error; }
    }));
  }
  register("internalUpdater.manage", manage);
  register("internalUpdater.browse", browse);
  register("internalUpdater.checkNow", check);
  register("internalUpdater.enroll", enroll);
  register("internalUpdater.showLog", () => output.show());
  context.subscriptions.push(vscode.extensions.onDidChange(() => check({ silent: true })));
  const startup = setTimeout(() => check({ silent: true }), 30000);
  const polling = setInterval(() => check({ silent: true }), 6 * 60 * 60 * 1000);
  context.subscriptions.push({ dispose() { clearTimeout(startup); clearInterval(polling); } });
  log(`已启动；目录公钥固定；更新源 ${server()}；${vscode.env.remoteName ? "远端窗口不执行安装" : "本地桌面"}`);
  return { check, enroll };
}
module.exports = { activate };
