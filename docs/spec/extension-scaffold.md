# VS Code Extension Scaffold

Status: Done
Date: 2026-11-12
Scope: 参考 `vscode-behavior3` 建立 GameFlow 的最小可运行 VS Code 扩展骨架。

## 1. Context

仓库目前只有产品规格与交互概念原型。用户要求参考本地 `D:\Users\bite\Desktop\github\vscode-behavior3` 搭建 VS Code 插件脚手架，为后续无限画布、策划文档分析与 Agent 能力提供真实运行环境。

参考项目采用 TypeScript 扩展宿主、React Webview、共享消息协议、esbuild 与 Vite 双构建。其行为树领域、复杂宿主会话、侧栏 Inspector、G6 图层和 CLI 不属于 GameFlow 当前范围。

## 2. Goals

- 建立可由 VS Code Extension Host 启动的 TypeScript 扩展。
- 为 `*.gameflow.json` 注册自定义编辑器，并让 VS Code 文本文档成为当前权威真源。
- 建立 React Webview、严格 CSP、nonce、本地资源 URI 和 typed host/webview protocol。
- Webview 控件采用 shadcn/ui 的本地组件源码、设计 token 与组合方式，并适配 VS Code 主题变量。
- 提供“新建策划画布”命令，生成有效示例文档并用自定义编辑器打开。
- Webview 显示可识别的无限画布工作台骨架，并完成一条真实的文档修改链路。
- 提供类型检查、单元测试、开发构建、生产构建、监视和调试配置。

## 3. Non-Goals

- 不实现完整无限画布交互、Agent 调用、图像生成、评论服务或 LayaAir 导出。
- 不复制 Behavior3 的业务模型、G6、Ant Design、侧栏 Inspector、CLI 或复杂文档会话。
- 不在本次建立发布账号、Marketplace 配置或 CI。

## 4. Current Behavior

仓库没有 `package.json`、`src/`、`webview/`、构建脚本、扩展清单或自动化测试，无法在 Extension Host 中运行。

## 5. Proposed Behavior

运行 `GameFlow: 新建策划画布` 后，用户选择保存路径，扩展写入一个版本化 `.gameflow.json` 文档并以 `gameflow.canvasEditor` 打开。直接打开匹配文件也使用该编辑器。

Webview 启动后发送 `ready`；宿主返回解析和校验后的文档快照。Webview 可选择页面并修改页面名称，随后发送完整的候选文档。宿主校验候选内容并通过 `WorkspaceEdit` 更新 `TextDocument`；保存、撤销、重做和 dirty 状态由 VS Code 原生文本模型管理。外部文本变化重新下发快照。

若 JSON 无法解析或不符合最小 schema，Webview 显示错误，不覆盖源文件。用户仍可用 VS Code 文本编辑器修复。

## 6. Design

### 6.1 Layers

- `src/`: 扩展激活、命令、自定义编辑器、HTML/CSP 和宿主文件操作。
- `shared/`: 文档模型、验证与 host/webview 消息协议；两端共享且不依赖 DOM/VS Code。
- `webview/`: React 应用、画布工作台壳层与 VS Code adapter。
- `webview/components/ui/`: shadcn/ui 风格的本地基础组件，业务界面不直接依赖远程 UI 资源。
- 仓库根构建配置：扩展的 esbuild 入口、Webview 的 Vite/Tailwind 配置。
- `test/`: 共享模型和协议的 Node 测试。

### 6.2 Document authority

当前使用 `CustomTextEditorProvider`。`TextDocument` 是唯一权威内容，Webview 不直接写文件。所有候选变更在宿主校验后成为一个 `WorkspaceEdit`，从而自然接入 dirty、保存和撤销。

采用这一方案是因为当前只有单编辑器、单文档和全量小文档更新。后续出现 Agent 并发编辑、多 Webview 权威同步、独立历史或大文档性能要求时，再通过新 SDD 引入 host session 和细粒度 mutation reducer。

### 6.3 Build

- esbuild 将 `src/extension.ts` 打包为 CommonJS `dist/extension.js`，`vscode` 保持 external。
- Vite 将 React Webview 输出到 `dist/webview/`，使用相对资源路径。
- Tailwind CSS 编译 shadcn/ui 类名；颜色 token 映射到 VS Code 主题变量，不从 CDN 加载样式。
- TypeScript 对宿主和 Webview 分别做严格类型检查。

### 6.4 Security

Webview 只允许 nonce 脚本、本地 Webview 资源和 VS Code Webview 样式；不启用网络连接。消息在宿主边界进行运行时判别和模型校验。

## 7. Implementation Plan

1. 建立清单、TypeScript、构建、调试与忽略文件。
2. 建立共享模型、默认文档、验证和 typed protocol。
3. 实现扩展激活、新建命令、自定义文本编辑器和安全 Webview HTML。
4. 实现 React 工作台壳层与一条页面重命名链路。
5. 安装依赖，运行 check、test、build，并检查产物。

## 8. Testing Plan

- 共享测试覆盖默认文档有效性、无效 schema 拒绝、协议消息判别和序列化 round-trip。
- `npm run check` 分别检查宿主与 Webview。
- `npm test` 运行共享测试。
- `npm run build` 产出 extension 和 Webview 文件。
- 对构建后的 HTML/JS 做静态检查：无远程资源，扩展清单入口存在，命令与 view type 一致。

## 9. Acceptance Criteria

- [x] `package.json` 声明扩展入口、命令和 `*.gameflow.json` 自定义编辑器。
- [x] 默认文档可创建、校验、序列化，并包含示例页面与画布位置。
- [x] Webview 与宿主通过共享协议完成 ready/init/update/error 流程。
- [x] 页面名称修改通过 `WorkspaceEdit` 更新权威文本内容。
- [x] Webview CSP 不允许任意远程脚本或网络连接。
- [x] Webview 的通用控件由本地 shadcn/ui 组件构成，并能随 VS Code 明暗主题保持可读。
- [x] `npm run check`、`npm test`、`npm run build` 全部通过。
- [x] `.vscode/launch.json` 可启动 Extension Host，构建任务可用。
- [x] README 说明安装依赖、构建和 F5 调试步骤，并明确当前能力边界。
- [x] 长期架构规则同步到编号基线和规格索引。

## 10. Risks and Rollback

全量 JSON 替换适合骨架和小文档，未来复杂编辑可能导致冲突或较粗的撤销粒度。该限制在 README 和架构基线中明确。回退可删除新增源码与构建配置；现有产品规格和原型文档不依赖这些产物。

## 11. Verification Results

- 2026-11-12：`npm run build` 通过，生成 `dist/extension.js` 与 `dist/webview/`。
- 2026-11-12：`npm test` 通过 5 项共享模型和协议测试。
- 2026-11-12：升级到 esbuild 0.28.2 后，完整 `npm audit` 为 0 个已知漏洞。
- 2026-11-12：浏览器预览验证桌面和 390×844 视口；页面改名、双击进入页面、返回总览均正常。
- 2026-11-12：清单命令/view type 与源码一致，CSP 仅允许 nonce 脚本、本地样式资源和动态内联样式，网络连接为 `none`。
