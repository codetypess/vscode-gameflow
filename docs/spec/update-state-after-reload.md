# 重载后恢复更新状态

Status: Done
Date: 2026-11-27
Scope: 宿主恢复与保留 Webview 的更新状态同步。

## 扩展页「重启扩展」现场复现

11 月 27 日，trunk 窗口安装 0.1.13 后，VS Code 1.148 记录了打开的 ui-components.gameflow.json 对停止宿主的 veto。随后新宿主启动，更新日志显示运行版本为 0.1.13。用独立配置确认「仍然重启」后，VS Code 保留已解析的自定义标签页，新的 provider 却没有对应的文档或面板。旧界面继续显示 pending。请求以相同编辑器再次打开时仍会命中这个标签页。完整窗口重载能重新创建文档和面板。

宿主启动时只检查已有的工作台和独立 PSD 标签。标签成为活动页时，通过 VS Code 打开同一资源，等正常解析完成，再核对新 provider 的面板归属。对仍失联的普通干净标签，在原栏重开并使用新宿主的快照。有未保存修改或会影响固定标签及分栏布局时，保留原标签，提供由用户选择的窗口重载。测试覆盖旧界面有按钮而新宿主为 current、正常恢复、后台标签和脏标签，使用独立 VS Code 窗口验证真实重启。

在 VS Code 1.148 的独立配置中安装实际 0.1.15 VSIX，保留 0.1.13 打开的画布，在扩展详情页点击 Restart Extensions 并确认 Restart Anyway。回到画布时，同一窗口已经运行 0.1.15，新宿主持有该文档及一个面板，模式菜单可见，绿色按钮消失。另一次完整窗口重载也恢复正常。418 项共享测试、33 项分发测试、类型检查和生产构建通过。

## 1. Context / Root Cause

用户报告安装更新并 reload 后，已经打开的工作台仍显示「更新插件」。现有 hook 只在 React mount 时发 extensionUpdateReady；attachExtensionUpdates 只订阅后续变化并响应请求，宿主恢复时不主动发送快照。保留的 Webview 不一定重新 mount，已显示的 pending 状态因而没有可靠的恢复同步。隐藏面板也没有重新可见时的状态校准。

用户随后明确入口是扩展页里的「重载」按钮。本项覆盖该入口恢复扩展宿主后，原界面仍被保留时的状态校准。

本机旧日志另有开发宿主同时激活旧、新 publisher 的命令冲突，但最新 Code 进程已退出，不能把该历史日志当成这次新版本实测的现场。当前修复针对能在保留界面/宿主重连测试中独立复现的协议缺口，不靠关闭文件或强制刷新隐藏它。

## 2. Goals

宿主绑定面板时立即推送最新更新快照；面板重新可见时同步；保留界面在窗口恢复焦点、重新可见或 pageshow 时请求最新快照。新版本真正生效时自动恢复模式菜单；仍在旧版本时保持 pending。编辑、保存、dirty 和相机状态不因更新状态同步而改变。

## 3. Non-Goals

不强制刷新 Webview、不自动重载 VS Code，不以磁盘存在新包代替当前宿主版本，不增加定时轮询，不修改文档生命周期。

## 4. Design

沿用现有固定请求和状态消息，宿主桥接负责 attach/reveal 快照，hook 负责页面恢复时的握手。初次载入若尚未接收宿主主动快照，原有 ready 请求仍保证同步；保留界面无需再次 mount。所有新增监听在 dispose/unmount 时移除。状态以更新模块基于实际 context.extension.packageJSON.version 给出的快照为准。

## 5. Plan and Testing

先增加失败回归：保留 pending 界面绑定到新宿主 current，无需再次 ready 就应恢复；隐藏期间变化重新可见时校准；dispose 后不发消息。浏览器验证 pending 到窗口恢复后 current 自动恢复菜单，保存/编辑状态不重置。分发测试验证同版本重启仍 pending、新版本已激活时离线也 current。执行共享/分发测试、类型检查及构建，修复版打包并用同 ID 发布一对测试版本。

## 6. Acceptance Criteria

- [x] 保留界面在宿主恢复后立即收到实际更新状态，不依赖网络检查或重新 mount。
- [x] 重新可见/恢复焦点后校准状态，dispose/unmount 释放监听。
- [x] 已运行新版时恢复模式菜单；旧版本 pending 不提前解除。
- [x] 不修改未保存文档或强制刷新界面。
- [x] 回归、构建及新 VSIX 身份/下载验证通过。

## 7. Risks / Rollback

重复快照必须幂等，恢复事件只读取本地状态，不触发额外下载或网络检查。回滚本次桥接/hook 的生命周期监听即可恢复原状，不影响文件数据。

## Verification

新增的 retained pending → new host current 回归在修复前实际失败（actual pending，expected current），修复后通过；同时验证 reveal 同步和 dispose。当前工作区 406 项共享测试、32 项分发测试、类型检查与生产构建通过。Edge 浏览器验证无需 remount 的 focus/pageshow/visibilitychange 恢复、模式菜单恢复、文档仍存在和保存；原绿色按钮/安装/失败重试/窄屏及独立 PSD 行为均通过。新版本离线启动为 current，而旧宿主仍为 pending 的分发测试通过。证据日志位于忽略目录 dist/reload-regression-before.log、reload-regression-after.log 和 reload-distribution.log。真实用户扩展页重载后的最终验收留待安装修复版复测。

已制作并发布 codetypess.vscode-gameflow 的 0.1.11 → 0.1.12 测试包；stable metadata 签名 revision 20。两个包均读回公开下载并与本地 SHA-256 和大小相符：0.1.11 为 1453754 bytes / a9d66f2b9269fc1fe17980498cc5f4ee71f6640dbeddca41694e0d281c2d53b5；0.1.12 为 1453755 bytes / 9032a7fb089e63640213020049c7a30b12f30d3338807f4d7e9cc7f385172df0。记录在 dist/workbench-plugin-update/reload-publication-verification.json。复测时安装 0.1.11，保持工作台文件打开，经绿色按钮升级 0.1.12 后点扩展页「重载」，预期自动恢复模式菜单。
