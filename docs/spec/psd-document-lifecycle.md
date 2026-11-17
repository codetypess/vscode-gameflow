# PSD 配置文档生命周期与恢复

Status: Verifying
Date: 2026-11-17
Scope: VS Code PSD 切图独立文档、原生 dirty/save/undo/close/backup、同目录配置自动读取；浏览器保留文件导入并备份配置草稿。

2026-11-17 更新：工作台默认打开独立 PSD 标签的规则由 [工作台内 PSD 会话](psd-in-workbench.md) 替代，原型与 PSD 聚合为当前工作台的原生生命周期；本规格保留独立 Explorer 编辑器及底层 PSD 保存/恢复规则与历史验证记录。操作呈现及本机导出目录遵循 [顶部操作与设置](workbench-toolbar-settings.md)。

## 1. Context

用户确认需要原生关闭提醒、Ctrl+S 保存、自动恢复草稿以及重开 PSD 自动读取配置。当前 PSD 切图暂存于原型的 CustomTextEditor 内，修改只更新 PsdWorkspace 的 React state 和 dirty；宿主只知道原型 TextDocument 的 dirty。beforeunload 无法作为 VS Code 标签关闭的可取消事件，onDidDispose 发生在销毁后。因此 PSD 未保存修改不会触发原生关闭保护，源 bytes/config 均丢失。

## 2. Goals

- 所有元数据编辑进入宿主文档，并触发 VS Code 的原生未保存、撤销/重做、保存和关闭确认。
- 常规保存写 PSD 同目录同名 .meta.json，重开自动读取；PNG 导出/PSD 副本输出为独立操作。
- 草稿备份与正式保存分开，恢复尚未解决的重复 ID 等中间状态，保存失败保留 dirty。
- 编辑、保存及备份有版本顺序，旧响应不能清除新修改。

## 3. Non-Goals

不把 PSD 设置写入原型 JSON，不实现 PSD 美术像素编辑、完整合并或整页运行预览。浏览器无法提供 VS Code 原生关闭确认或任意本地路径读写。

## 4. Current Behavior / Root Cause

webview/psd/workspace.tsx 的 change/undo 仅 setLoaded/setDirty；src/gameflow-editor-provider.ts 的保存只管理 .gameflow.json，psdOutput 只有用户显式点击后的另存为。无宿主 PSD 文档、实时修改协议或 backupCustomDocument。此为状态所有权缺失，并非关闭按钮本身的交互错误。

## 5. Proposed Behavior

- VS Code “打开 PSD”使用原生选择器，以独立 PSD 配置编辑器打开源 PSD。标签对应 PSD，常规保存目标明确显示为同目录 .meta.json；源 PSD 不随 Ctrl+S 改写。原型与 PSD 可分别打开、保存及关闭。
- 注册 gameflow.psdEditor，使用 CustomEditorProvider；配置修改触发 CustomDocumentEditEvent。保存/保存全部/自动保存、撤销重做及关闭确认使用 VS Code 原生生命周期。另存为保存 PSD 副本及配置，避免只复制配置却失去源文件。
- 打开时宿主读取有限大小 PSD、解析元数据结构并自动读取 sidecar。源指纹一致可直接恢复；源变化只能按现有文档/图层身份校验并明确确认。无法匹配时仍可打开原始 PSD 修复身份，保留原配置、展示诊断，替换保存须明确确认。没有 sidecar 时新建配置初始即为 dirty。
- 宿主保存可编辑配置草稿（包括尚未修复的重复 ID）及恢复所需的源 PSD 快照；正式 sidecar 保存仍执行原有身份及九宫格校验。备份落盘完成才显示“草稿已备份”；保存完成显示“配置已保存”。手动“不保存”丢弃本次草稿。
- 重新载入或异常恢复时使用 VS Code backupId；正常打开也可恢复宿主已落盘但尚未正式保存的草稿，并校验源指纹。保存和 revert 更新/移除草稿。旧保存/备份不得覆盖新版本状态。
- 保留浏览器文件导入，按文件名与源 hash 在本地存储配置草稿，重新选择同一 PSD 可恢复；不冒充正式磁盘保存。VS Code Webview 拖入的 File 无可信绝对路径，由原生选择器定位实际源文件后打开受保护标签；Explorer 可通过“打开方式”直接使用 PSD 配置编辑器。

## 6. Design

共享结构解析生成不带像素的 PsdAsset；宿主持有元数据权威，Worker 只解码渲染所需 PNG。受限草稿协议只允许当前图层的配置和身份变更，不允许改变源 geometry、结构或任意路径。Webview 乐观候选按版本串行提交，宿主确认与命令完成显式区分。配置保存前复核源 PSD/sidecar 指纹与脏文本文件，外部变化拒绝覆盖并保留草稿。

独立入口复用切图工作区；原型入口只负责打开 PSD 文档，不再在 VS Code 原型标签内留下未保护的 PSD 编辑。PNG 导出控制器复用现有目录逻辑。备份放入扩展本地存储及 VS Code 指定 backup destination，源文件仅用于恢复，不上传。

## 7. Implementation Plan

1. 共享结构/草稿验证与有版本的文档模型。
2. 宿主 CustomEditorProvider、保存/历史/备份/恢复、原生打开入口。
3. Webview 独立入口、候选队列、工作区绑定及浏览器草稿。
4. 回归测试、真实 VS Code 原生生命周期及 UI 验收、同步基线。

## 8. Testing Plan

共享测试覆盖同源/异源恢复、重复 ID 中间态、非法消息、编辑队列与过期响应。宿主测试覆盖保存失败、保存期间继续编辑、外部源/sidecar 变化、备份恢复和 revert。真实 Extension Host 测试验证原生 tab dirty、undo/redo、save/reopen；通过 UI 验证 × 关闭确认和取消保留修改。浏览器验证原有切图流程及共享默认名仍可用。

## 9. Acceptance Criteria

- 元数据修改后 PSD 标签 dirty，原型文件不变；× 提供保存/不保存/取消。
- Ctrl+S 写当前 PSD 的 sidecar，重开自动恢复名称、共享、九宫格及身份修复。
- 未正式保存的草稿可以恢复；损坏或异源备份明确报错，不覆盖源配置。
- 保存失败保持 dirty；并发编辑不被旧保存清空。
- 相关测试、类型检查和生产构建通过，实测范围和限制记录在本文。

## 10. Risks and Rollback

原生源路径需要由宿主选择；浏览器 File 不提供可信路径。草稿和源 bytes 有存储成本，沿用 32 MB PSD/128 层限制，配置最多 1 MB。文件系统不能保证跨进程原子读改写，保存前验证不能替代外部写锁。可退回显式配置输出，但不得默默恢复无关闭保护的 VS Code 临时编辑模式。

## 11. Verification Results

2026-11-17：实现完成，状态保留 Verifying，待原生关闭对话框逐按钮人工验收。

- `npm run build` 通过，包括宿主和 Webview 类型检查及生产构建；Vite 仍提示已有的超过 500 kB bundle。
- 261 项共享测试通过，其中本次新增 12 项 PSD 文档回归测试，覆盖保存失败、保存期间继续编辑、源文件/配置外部变化、重复 ID 草稿、过期编辑、保存前 flush、像素解码期间初始化及拒绝编辑后的候选保留。测试曾揭示草稿浅拷贝会修改保存基线，现已通过深拷贝隔离快照并验证修复。
- `npm run test:psd-host` 在真实 VS Code Extension Host 通过 13 项检查：原生配置保存、初始身份持久化、原生标签 dirty、撤销/重做、自动草稿检查点、VS Code backup 回调、源 PSD 字节不变、重开自动读取配置、备份恢复保留未保存状态、外部配置冲突保留 dirty、放弃修改清理恢复草稿、另存为生成配套 PSD/配置，以及不兼容配置保留身份修复入口和原配置。结果输出至 `dist/psd-native-report.json`。
- 浏览器使用真实示例 PSD 修改导出名为 `btn_draft_recovery` 并勾选共享；新标签重新选择同一文件后，导出名、共享状态和 20/20/20/20 九宫格恢复，显示“已恢复本地草稿，请保存配置文件。”，控制台无错误。截图：`C:/Users/bite/.codex/visualizations/2026/11/17/01a1e767-6764-7220-ae65-17d5ea266c5b/psd-draft-recovery.jpg`。
- 原生关闭对话框人工验收未完成：隔离测试实例可以运行，但未出现在电脑控制工具的窗口清单中，无法点击 × 及保存/不保存/取消。上述宿主测试验证了原生 dirty、保存和 revert 行为，不能替代对话框逐按钮验收。

待补人工步骤：在重新加载的 Extension Development Host 打开 PSD，修改导出名，点击标签 ×，确认出现保存/不保存/取消；取消后修改仍在，保存后重开读取该名称，不保存后重开恢复已保存配置且不恢复被放弃草稿。升级前先在旧会话手动保存 `.meta.json`，再重启开发宿主并重开 PSD，避免旧版本内存修改在重载时丢失。
