# F5 Extension Host Startup

Status: Done
Date: 2026-11-23
Scope: 诊断 F5 启动开发宿主后自动退出

## 1. Context

用户报告 F5 打开的开发窗口随即关闭。现有 launch 使用 extensionHost、build:dev，无 extensionTestsPath。2026-11-17 17:17–17:24 主进程日志连续记录开发 extensionHost 在约一秒内 code 134/crashed，window22–27 均无 exthost 激活日志；F5 现场复现相同，调试控制台为空。此前独立 profile 的原生集成测试通过，但未覆盖 F5 调试器附加。

## 2. Goals

定位首次失效边界，恢复 F5 开发窗口与 GameFlow 激活，保留正常断点调试和构建。

## 3. Non-Goals

不改画布或 PSD 行为，不清空用户 VS Code 配置，不重装/升级应用，不终止用户其他窗口。

## 4. Initial Behavior (2026-11-17)

F5 先构建，开发窗口启动，宿主在 JavaScript 日志初始化之前崩溃并导致调试窗口退出。尚未确认是启动环境、Node inspector 还是其他本机运行时原因；code 134 是症状，不能据此修改业务代码。

## 5. Proposed Behavior

F5 完成开发构建后保持开发宿主运行，可打开示例与在扩展中断点。诊断阶段仅临时添加 trace 文件输出，最终配置按证据确定，移除临时跟踪。

## 6. Design

通过调试器 trace、启动参数及无调试/带调试对照缩小故障边界；先确认根因，再在其拥有边界修复。

## 7. Implementation Plan

1. 收集崩溃与调试跟踪，建立最小对照。
2. 确认原因后实施最小修复并同步此文。
3. 复验原 F5 与正常编辑，不扩大到无关代码。

## 8. Testing Plan

F5 原路径复现与修复后回归；构建、必要的窄回归按根因选择。外部 VS Code 运行时问题不能用共享模型测试替代实机结果。

## 9. Acceptance Criteria

能解释 code 134 的具体原因及证据；F5 开发窗口保持、宿主完成激活且断点可用。无法由仓库修复的本机原因须明确记录恢复步骤及未完成验证。

## 10. Risks and Rollback

避免关闭多个工程的 VS Code 或清除配置来掩盖原因。临时 trace 指向忽略的 dist，可随时移除。

## 11. Diagnostic Results (2026-11-17)

- 原配置 F5 于 17:24:34–35 现场复现：window27 创建，extensionHost PID 53328 以 134/crashed 退出，未生成 exthost.log，调试控制台无输出。此前主日志连续记录同类故障。这里只确认失效位于宿主启动/调试初始化阶段，不能把 134 当作具体根因。
- 临时增加调试器 trace 文件输出后，17:27:25 的 PID 43416 正常启动，17:27:26 完成 GameFlow 激活。trace 记录 inspector 附加成功，没有重现原崩溃，因此不能把 trace 当作修复或证明某个启动竞态。
- 完全移除临时 trace、恢复原 launch 后，17:30:09 的 PID 51924 正常启动并在 17:30:10 激活 GameFlow；窗口保持运行。
- 按原配置 Ctrl+Shift+F5 重启，17:33:11 的 PID 14852 正常启动。临时在 `src/extension.ts:13` 设置断点，实机命中并暂停；移除该断点、F5 继续后，示例画布正常显示。当前开发窗口已保留，截图位于忽略的 `dist/f5-host-recovered.png`。
- 没有业务代码或启动配置的持久改动，也未重启其他 VS Code 工程。F5 自带 build:dev 成功；没有对尚未确认的本机崩溃机制添加虚假单元回归。
- **尚未确认**：此前 code 134 的具体 native/inspector 触发原因。恢复后已无法稳定复现；单元测试不能证明该外部故障根治。规格保持 Verifying，不能标成根因修复完成。若同类故障再次出现，应保留当次原生 stderr/诊断报告并对照 inspector 附加，而非增加延时或永久 trace 掩盖现象。

## 12. 2026-11-23 复查

20:37 的两次失败均在本地扩展宿主启动约一秒后以 134 退出。20:38 成功启动的宿主随后激活了 GameFlow。检查时，星海登录示例的工作台检查点包含不同于保存基线的画布内容，基线哈希与磁盘一致。使用隔离的 VS Code 用户数据和文件副本收集原生诊断，分别验证调试器附加、编辑器恢复未保存内容以及源文件完整性。

在 VS Code 1.147.0、js-debug 1.140.1 和内置 Node 24.22.1 上，隔离调试的 PID 48740 复现了 134。原生栈记录了 Electron 预加载期间执行 `internal/inspector_network_tracking.enable`，随后 `node::inspector::Agent::ToggleNetworkTracking` 在 `inspector_agent.cc:1031` 触发断言 `Cannot toggle network tracking, please report this.`。js-debug 的实验性网络视图在调试会话建立时请求 `enableNetworking`，适配器继而发送 `Network.enable`。崩溃发生在 GameFlow 激活及读取草稿之前。

将 `debug.javascript.enableNetworkView` 设为本仓库的工作区设置 `false`，使发起 F5 的调试器跳过这个请求。回归时检查调试器请求、扩展源码断点、恢复内容、原生标签的未保存标记及磁盘原文。

## 13. 实机回归

开发构建 `npm run build:dev` 通过。使用安装的 VS Code、内置 js-debug 和独立用户数据目录，从本仓库的启动配置连续发起 6 次调试。每次均命中 `src/extension.ts` 的激活断点，继续后成功打开星海登录画布副本，并恢复关联的一个 PSD。6 次均确认画布内容与检查点逐字相同、标签保留未保存标记、磁盘副本与保存基线相同。调试适配器记录的 `enableNetworking` 请求为 0，原生退出码 134 出现 0 次。

### 手工回归步骤

1. 复制星海登录示例及其同目录 PSD 和配置。在仓库窗口给 `activate` 设置源码断点，按 F5，在开发窗口打开示例副本。
2. 继续执行，修改一个可辨认的页面名称。确认标签出现未保存标记且磁盘副本仍为旧名称，等待工作台草稿写入。
3. 从仓库窗口停止并再次启动调试。继续执行断点后，打开同一副本，确认窗口保持打开、页面名称恢复、标签仍标记为未保存。多次重复以覆盖原生初始化时序。
