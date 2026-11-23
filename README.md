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
- 控件支持真实拖动、八点缩放、名称/文本/字号/坐标/尺寸/父容器编辑。UIBox 透明，背景由普通 UIImage 提供；UIButton 自身持有 normal/selected/disabled 图片，文字由独立 UILabel 提供。
- 原型、美术 PSD、预制体三种资源显示模式复用同一份结构和布局；69 张内置 PNG 提供按钮、色块、圆形、28 个图标及控件部件，按钮和描边色块支持九宫格。
- Radio/Checkbox 的底图、选中标记和文字独立；Slider 使用图片轨道和滑块；ProgressBar 支持横向与圆形进度，ComboBox 通过独立 UILabel 显示选项。
- 当前页面可生成带稳定节点/图片槽位身份的原型 PSD，或导出 Laya `.lh`、PNG、九宫格导入元数据和来源清单；未绑定美术时导出内置资源，已绑定但失效的图片先提示确认。
- “名称”下方可设置独立“变量”，校验合法标识符、保留字及同页重名；留空不设置，复制/粘贴自动避开变量冲突，随文档保存及撤销。
- 页面管理、子树复制删除、隐藏锁定、父级调整、图片配置、撤销重做和保存均写回 JSON，并接入 VS Code 原生 dirty 状态。
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

只调试 Webview 布局时可运行 `npm run dev:webview`。浏览器预览使用示例文档模拟同一套消息协议，编辑内容保存在浏览器本地存储；图片和 Prefab 导出写入用户明确选择的目录。

组件布局示例：[sample/ui-components.gameflow.json](sample/ui-components.gameflow.json)。开发预览地址加 `?sample=ui-components` 可独立体验背包与游戏设置示例，不覆盖原有浏览器预览。新文档格式为 v2。页面与控件 ID 由 Nano ID 生成，长度为 8，仅用小写字母和数字，首位可为数字。未迁移的旧文档首次打开编辑器时，会以一次可撤销编辑重新分配全部页面/控件 ID、更新父子及跳转引用，并写入 `elementIdScheme: "nanoid-8"`；在 VS Code 中需正常保存，浏览器预览会保存到本地存储。已有 v1 文档随首次有效编辑（包括此次迁移）升级到 v2，之后 ID 保持稳定。

## 图片资源与导出

底部的三个图标分别切换“原型”“美术 PSD”“预制体”。原型模式编辑内置图片。后两种模式都需要先为当前页面生成或绑定 PSD，属性框显示实际切图导出名，悬停可看完整 PNG 路径。美术 PSD 预览读取该页的内存切图，预制体预览读取导出的磁盘图片。

新生成的页面 PSD 会记录内置图层的来源和像素指纹。勾选切图后，像素、切图范围和九宫格都与原图一致的图层直接复用 `builtin/` 下的 PNG。改过的图层以及缺少这份记录的旧 PSD 按美术切图命名。

PSD 切图属性分为可编辑的「变量名称」和只读的「导出名称」。变量可主动设置，留空时取公开图层名的拼音首字母，保留英文和数字，略去末尾 UI 类型标注。美术切图的导出名称为 `{图集名}_{变量名}`，共享资源也保留图集名，不自动添加 btn/img 前缀。PSD 按钮组与原型控件同名，直接子层 `@normal`、`@selected`、`@disabled` 分别对应三态，变量由父组追加状态后缀。星海示例父组变量为 `start`，其 `@normal` 导出为 `login_start_normal.png`。状态变量和导出名均只读。UIImage 使用同名切图，或在同名组下放 `@image` 并沿用父组变量。新按钮只设置 normal，selected/disabled 留空时沿用 normal；按钮文字单独编辑 UILabel。自由布局容器的“外观 / 添加背景图片”每按一次新增一个普通 UIImage。

导出时先在“工作台设置”分别选择资源与预制体根目录，再用顶部“导出 Prefab”。导出始终优先采用已绑定美术，和当前显示模式无关。没有 PSD 时可直接导出内置图片；失效绑定会列出受影响的控件、槽位和路径。选择“仍然导出”后保留缺失引用，输出其他正常资源。

“生成 PSD”按原型图片生成 PSD 并绑定当前页，也可以直接用“绑定 PSD”选择美术文件。按钮 PSD 组包含 `@normal`、可选的 `@selected`/`@disabled` 和独立文字层。当前仅支持简单层及普通组内合成；复杂蒙版、效果、混合模式、旋转和裁剪的往返保真，以及真实目标工程装载，仍需进一步验收。

实现及验收边界见 [资源模式说明](docs/spec/prototype-art-prefab-resource-modes.md)。

## 构建结构

- `src/`：扩展宿主、创建命令、自定义编辑器与安全 Webview HTML。
- `shared/`：文档模型、校验、消息协议与基于 Nano ID 的身份分配。
- `webview/`：React 工作台和本地 shadcn/ui 组件源码。
- `schemas/`：`*.gameflow.json` 的 JSON Schema。
- `test/`：共享模型与协议测试。

扩展宿主由 esbuild 输出到 `dist/extension.js`，Webview 由 Vite 输出到 `dist/webview/`。

## 当前边界

这是可运行的游戏 UI 原型编辑器，已提供原型 PSD 和基础 Laya Prefab 输出；尚未在真实 xq-client/Laya 编辑器中完成装载验收，不包含真实 Agent 调用、策划文档自动分析或美术素材生成。后续 Agent 接入约定见 [docs/ai-prototype-contract.md](docs/ai-prototype-contract.md)。当前全量 JSON 更新适合小型低保真文档；出现 Agent 并发编辑、多权威视图或大文档性能问题时，需要升级为宿主会话与细粒度 mutation 模型。
