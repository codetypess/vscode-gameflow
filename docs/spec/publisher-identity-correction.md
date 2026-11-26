# Publisher 身份纠正

Status: Done
Date: 2026-11-26
Scope: 更正测试包身份，并把 vscode-gameflow 静态更新目录转交给新 ID。

## 1. Context

用户明确已把 publisher 改成 codetypess，正式插件 ID 是 codetypess.vscode-gameflow。前次忽略目录中的打包脚本错误地用已安装旧 ID 推断需求，强制把 manifest.publisher 覆盖成 codetypes，生成并发布了身份错误的 0.1.7 / 0.1.8。主仓库 package.json 已是 codetypess/0.1.4，根因位于额外的打包流程，非用户配置或更新检查。

## 2. Goals

新包继承源 manifest 的 publisher/name，重新生产构建并生成 0.1.9 起始包和 0.1.10 更新目标。服务器 /vscode-gameflow/metadata.json 签名身份改为 codetypess.vscode-gameflow；历史包保留。

## 3. Non-Goals

不把旧 ID 的安装伪装成原位升级，不删除用户插件或改动本机文档，不改变签名密钥，不覆盖不可变包。

## 4. Current Behavior

发布器会拒绝两个 publisher 占用同名 metadata 目录，这是正确的默认保护。当前目录被 codetypes.vscode-gameflow 占用，stable 为 0.1.8，revision 16。

## 5. Proposed Behavior

更正打包脚本，publisher 不再允许隐式覆盖。新增显式 --replace-id，仅用于用户授权的同名插件 publisher 转交；普通发布继续拒绝冲突。新 stable 发布事务备份旧 catalog，移除旧 ID 的活动目录记录，再发布新 ID 的真实包和签名 metadata，保留磁盘历史 VSIX 及其他插件。目标 ID 已存在、原 ID 不存在、不同插件名或 beta 替换均拒绝。

## 6. Design

复用发布器的共享锁、签名、目录备份和原子 metadata 写入。在锁内校验明确的原 ID 及目标身份，再修改 catalog；新包使用未占用的 0.1.9 / 0.1.10。--replace-id 必须由本机发布 CLI 显式传递。验证命令默认身份从源 package.json.publisher 推导，允许 --id 明确覆盖。

## 7. Implementation Plan

修正打包与验证身份；增加发布器显式同名转交及测试；重新构建打包；先以 0.1.9 stable 完成转交，再发布 0.1.10 stable 供测试更新。

## 8. Testing Plan

分发回归验证默认拒绝 publisher 冲突、显式转交后的签名新 ID、旧包与其他插件不变、无效替换不改现行元信息。读取真实 VSIX manifest 确认两个包的身份及版本；在线验证 signed metadata 和两个下载的 SHA-256。

## 9. Acceptance Criteria

- [x] 新测试包和包内 VSIX identity 为 codetypess.vscode-gameflow。
- [x] 更新目录签名 identity 为新 ID，stable 0.1.10，修订递增。
- [x] 无显式参数的 publisher 冲突仍拒绝，历史包保留。
- [x] 生产构建、分发回归与公开下载验证通过。

验证：生产构建与类型检查通过，31 项分发回归通过，包括默认 publisher 冲突拒绝、显式同名转交、无效转交不改变 metadata/revision、其他插件不变及历史包保留。源 manifest 和两个真实 VSIX 都验证为 codetypess.vscode-gameflow。0.1.9 stable 转交 revision 17，0.1.10 stable 为 revision 18；在线读回 signed catalog 与 metadata，确认旧 ID 已退出活动目录，新 ID 为 stable。主页 app.js 也已修正。服务器原发布工具和下载页备份于 backups/publisher-before-codetypess-r16.cjs 与 site-before-codetypess-r16.js，catalog 由事务自动备份。

公开下载与本地包摘要一致：

- `vscode-gameflow/0.1.9.vsix`：1453654 bytes，SHA-256 `69df95d463489a5fa6db2edad033b79231ebe1a959253cf6ee923c28c749c36c`。
- `vscode-gameflow/0.1.10.vsix`：1453652 bytes，SHA-256 `374f192bb9981c3c39f1b9019c15ba7dbde5d0ba6b55a5e4ce698f8fde4a7578`。

本地包在 `dist/packages/codetypess.vscode-gameflow-0.1.9.vsix` 和 `codetypess.vscode-gameflow-0.1.10.vsix`；完整验证记录在 `dist/workbench-plugin-update/publication-verification.json`。安装留给用户操作，未更改用户当前窗口。

提交前另行导出仅含本任务的暂存区验证：类型检查和生产构建通过；共享测试为 402 项通过、3 项 PSD 夹具用例失败。对未修改 HEAD 独立验证为 400 项通过、完全相同的 3 项失败（组件 PSD companion、PSD sync copy、PSD sync overwrite），本次新增的两个更新桥接用例均通过。工作区 405 项全通过包含另一任务未提交的 PSD 修正，这些修正保持未暂存；本提交不包含它们。对照日志在忽略目录 `dist/update-commit-shared.log` 和 `dist/update-commit-baseline.log`。

## 10. Risks and Rollback

旧 ID 不能安装新 ID 的更新；该行为保留严格身份校验。需要用户安装新 ID 的起始包。目录转交有签名 catalog 备份，历史包不覆盖；如回滚，应以新的递增修订重新发布，而非回退签名修订。
