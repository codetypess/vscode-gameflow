# 工作台更新插件入口

Status: Done
Date: 2026-11-26
Scope: 内置更新状态同步、工作台左上角入口与工作模式切换保护。

## 1. Context

系统通知容易被忽略。用户要求发现新版时，用绿色底、文字为「更新插件」的按钮替换截图中的左上角工作模式菜单，更新前不允许切换工作区。

## 2. Goals

- 经过签名、身份和兼容性验证的新版在所有已打开及后打开的工作台持续可见。
- 点击「更新插件」就是本次下载安装的明确确认，复用现有安装校验及跨窗口锁。
- 安装中、失败和等待新版生效期间保留入口和模式切换保护；失败可重试。
- 当前工作区编辑、保存和草稿保护继续工作。

## 3. Non-Goals

不修改签名协议、不自动下载或强制重载窗口。不因网络错误、无兼容版本、浏览器预览或开发宿主而锁定工作台。此前打包错误覆盖了源码 publisher，旧 ID 的 0.1.7 / 0.1.8 测试方案已停止；用户确认正式 ID 为 codetypess.vscode-gameflow，纠正打包和目录归属见 [publisher-identity-correction.md](publisher-identity-correction.md)。

## 4. Current Behavior

更新模块只有检查命令和临时 VS Code 通知；Webview 不知道更新状态。工作模式有菜单、页面切图和 PSD reveal 等入口。

## 5. Proposed Behavior

正常状态沿用当前模式菜单。有兼容新版时原位显示绿色「更新插件」，悬停说明目标版本及需要先更新。菜单立即消失，已打开菜单关闭，所有模式切换路径统一拒绝切换。点击按钮直接安装；安装时防重复点击并显示进度图标；失败恢复可点击状态且显示错误；安装成功后提示先保存文件再按 VS Code 提示生效，旧宿主继续保持保护。活动代码已是新版本且检查没有更新时恢复菜单。

独立 PSD 编辑器使用同一按钮。关闭系统通知或选择稍后不清除工作台提示。只有更新模块提供状态，Webview 不提供版本、路径、下载地址或任意命令。

## 6. Design

- 更新模块返回 getState / subscribe / install；状态为 current、available、installing、pending，后面三者包含版本，可带失败说明。
- 宿主桥接每个编辑器面板，Webview 发 extensionUpdateReady 获取快照，发 installExtensionUpdate 确认安装。宿主广播 extensionUpdateState 并在面板销毁时释放监听。
- React hook 同步状态并以 ref 在异步入口中检查最新状态，统一的 switchMode 和 openPageSlice 拦截切换，不改变已打开文档。
- 保存的 pendingVersion 在启动时恢复；共享锁只覆盖短状态写入和安装。系统通知与工作台按钮并发确认只能安装一次。

## 7. Implementation Plan

先实现内置更新状态 API 和安装复用，再接宿主桥接和绿色按钮，最后加模式切换保护并同步基线。

## 8. Testing Plan

分发测试覆盖不确认不下载、关闭通知仍保留状态、按钮确认与系统通知并发、失败重试和 pending 恢复。宿主测试覆盖 ready 快照、多个面板广播、安装请求边界及 dispose。浏览器测试覆盖原型/PSD、已打开菜单和异步 reveal、绿色样式、重复点击、失败/安装成功保护及 360px 宽度。运行共享测试、分发测试、类型检查和生产构建。

## 9. Acceptance Criteria

- [x] 无新版时保留三个模式，发现新版后原位显示绿色「更新插件」。
- [x] 通知关闭和菜单已展开都不能绕过模式切换保护，异步 reveal 同样受保护。
- [x] 点击才下载安装，安装中不重复触发，失败可重试，成功等待生效不提前解锁。
- [x] 新打开的面板和重启后的 pending 状态正确；监听可释放。
- [x] 保存仍可用，浏览器预览和开发宿主不被真实更新锁定。
- [x] 自动测试、类型检查和生产构建通过。

验证结果：`npm test` 405 项、`npm run test:distribution` 30 项、`npm run check` 和 `npm run build` 通过。`test/workbench-update-browser.cjs` 在 Edge 验证绿色样式、展开菜单收到更新时的竞争、异步 reveal、保存、重复点击、失败重试、pending、360px 与独立 PSD；`test/psd-workspace-startup-browser.cjs` 通过，确认原模式菜单和 PSD 恢复不受影响。截图在 `dist/workbench-plugin-update/`。安装通过测试宿主验证，未在用户当前窗口执行安装或重载。

用户要求打包后，读取本机已安装版本为 `codetypes.vscode-gameflow@0.1.6`，基于本次通过生产构建的运行文件，在隔离目录生成同 ID 的 0.1.7 / 0.1.8（主仓库 publisher/version 不变）。两个包均检查 manifest 和实际包含的绿色按钮、更新桥接代码。0.1.7 上传 beta 作测试起点，0.1.8 发布 stable，签名 metadata revision 16。分别从公开下载地址读回，与本地文件大小和 SHA-256 相同：

- 起点：`dist/packages/codetypes.vscode-gameflow-0.1.7.vsix`，1453658 bytes，SHA-256 `c76be80781feec14f1d42d14af8419772ef7da668626d0eb25489c0edeb99f90`；服务器路径 `releases/codetypes.vscode-gameflow/0.1.7/universal.vsix`。
- 目标：`vscode-gameflow/0.1.8.vsix`，1453657 bytes，SHA-256 `6be74d25000e52861686e40a7f7395932c755e3a40812918071d625a4f910ef9`。

上面的旧 ID 包仅保留错误交付的历史记录，不再作为测试入口。新的测试入口为 codetypess.vscode-gameflow 的 0.1.9 → 0.1.10，纠正与验证记录见 [publisher-identity-correction.md](publisher-identity-correction.md)。

## 10. Risks and Rollback

主要风险是异步回调捕获旧状态或安装后过早恢复菜单；统一读取最新状态和 pending 生命周期覆盖。回滚 UI 与桥接即可恢复原有通知，不修改文档数据。
