# GameFlow

GameFlow 是一个面向游戏策划的 VS Code 扩展骨架，用同一份结构化文档组织策划需求、UI 页面组、页面内节点和页面跳转。

当前版本提供：

- `*.gameflow.json` 自定义编辑器。
- `GameFlow: 新建策划画布` 命令。
- React + shadcn/ui Webview 工作台。
- 页面总览、页面组拖动、滚轮定点缩放、空白画布抓手平移、双击进入页面内部视图；总览没有固定侧栏。
- 页面内部显示可折叠层级树和 VS Code 风格悬浮属性面板；添加菜单提供容器、横排/竖排/网格、面板、文字/图片/按钮、输入框/列表、复选框/单选框、进度条/滑块/下拉框等 15 种节点，兼容旧矩形节点。
- 支持像素/百分比约束、贴边/居中/拉伸、内容尺寸、内边距/间距/对齐、裁剪及静态滚动；布局控件主轴拖动改变排序。文字内容尺寸为原型估算。
- 图层树和属性面板贴近页面两侧，跟随画布缩放/平移并保持在屏幕内；窄窗口自动缩窄，长面板内部滚动，避开底部工具条。
- 图层标题下方可按名称、类型或 ID 搜索当前页节点，保留匹配节点的父级路径；支持清除和 Escape，清空后恢复原折叠状态。
- 层级树右键可复制、粘贴、重命名、生成副本和删除节点；新增和类型转换收在二级菜单中。替换预制体入口待接入。拖动行的上/下边缘排序，拖到容器中部移入，拖到页面根移出；换父级保持画布位置。
- 控件支持真实拖动、八点缩放、名称/文本/字号/坐标/尺寸/样式/父容器编辑，文字默认透明无框，按钮保持按钮外观，图片嵌入后显示真实图像。
- “名称”下方可设置独立“变量”，校验合法标识符、保留字及同页重名；留空不设置，复制/粘贴自动避开变量冲突，随文档保存及撤销。
- 页面管理、子树复制删除、隐藏锁定、父级调整、图片导入、撤销重做和保存均写回 JSON，并接入 VS Code 原生 dirty 状态。
- 严格 CSP、共享 TypeScript 协议和宿主侧运行时校验。

## 开发

环境要求：Node.js 20.19+，VS Code 1.105+。

```bash
npm install
npm run check
npm test
npm run build
```

在 VS Code 中打开本仓库后按 `F5`，会先执行开发构建并启动 Extension Host。随后运行 `GameFlow: 新建策划画布`，或打开 [sample/backpack.gameflow.json](sample/backpack.gameflow.json)。

只调试 Webview 布局时可运行 `npm run dev:webview`。浏览器预览使用内存中的示例文档模拟同一套消息协议，不读写项目文件。

组件布局示例：[sample/ui-components.gameflow.json](sample/ui-components.gameflow.json)。开发预览地址加 `?sample=ui-components` 可独立体验背包与游戏设置示例，不覆盖原有浏览器预览。新文档格式为 v2。页面与控件 ID 由 Nano ID 生成，长度为 8，仅用小写字母和数字，首位可为数字。未迁移的旧文档首次打开编辑器时，会以一次可撤销编辑重新分配全部页面/控件 ID、更新父子及跳转引用，并写入 `elementIdScheme: "nanoid-8"`；在 VS Code 中需正常保存，浏览器预览会保存到本地存储。已有 v1 文档随首次有效编辑（包括此次迁移）升级到 v2，之后 ID 保持稳定。

## 构建结构

- `src/`：扩展宿主、创建命令、自定义编辑器与安全 Webview HTML。
- `shared/`：文档模型、校验、消息协议与基于 Nano ID 的身份分配。
- `webview/`：React 工作台和本地 shadcn/ui 组件源码。
- `schemas/`：`*.gameflow.json` 的 JSON Schema。
- `test/`：共享模型与协议测试。

扩展宿主由 esbuild 输出到 `dist/extension.js`，Webview 由 Vite 输出到 `dist/webview/`。

## 当前边界

这是可运行的低保真原型编辑器，不包含真实 Agent 调用、策划文档自动分析、美术素材生成或 LayaAir 导出。后续 Agent 接入约定见 [docs/ai-prototype-contract.md](docs/ai-prototype-contract.md)。当前全量 JSON 更新适合小型低保真文档；出现 Agent 并发编辑、多权威视图或大文档性能问题时，需要升级为宿主会话与细粒度 mutation 模型。
