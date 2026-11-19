# 星海远征 · 750×1334 竖版登录页

按用户截图重新安排竖版布局，保留深蓝星空、金色徽记/按钮及原有文案。设计尺寸为 **750×1334**；原型图片与美术 PSD 通过同一份节点结构关联。

## 打开方式

- **原型**：在安装 GameFlow 的 VS Code 中打开 `star-sea-login.gameflow.json`。它与仓库 `sample/star-sea-login.gameflow.json` 内容相同。默认“原型”模式使用内置图片。
- **浏览器**：启动 `npm run dev:webview -- --port 5187`，访问 `http://127.0.0.1:5187/?sample=star-sea-login`。该样例使用独立浏览器存储；双击页面编辑内部节点。
- **美术 PSD**：在工作台打开 `Star-Sea-Login-750x1334.psd`，切换“美术 PSD”资源模式，读取已绑定的内存切图；可用“关联 PSD 图片”按稳定身份重新绑定。
- **预制体**：在“工作台设置”选择资源与预制体根目录，再用“导出 Prefab”。“预制体”资源模式通过原型布局读取导出的 PNG，不读取真实 Prefab 层级。没有打开 PSD 时，已绑定的美术资源需要存在于资源根目录；否则会进入缺图确认流程。
- **预览资料**：`artwork-preview.png` 与当前 PSD 的保存合成图一致。`prototype-preview.jpg`、`workbench-preview.jpg` 和 `comparison-preview.png` 是旧版结构的历史截图，不作为本次资源模式改造的界面验收证据。

## 控件结构

```text
星海远征 · 登录 UIStack
├─ 背景 UIBox
│  ├─ 深空渐变 UIImage
│  └─ 星点与轨道 UIImage
├─ 标题区 UIBox
│  ├─ 星海徽记 UIImage
│  ├─ 游戏标题 UILabel       星海远征
│  └─ 副标题 UILabel         启航，探索未知星域
├─ 服务器信息 UIBox
│  ├─ 服务器底板 UIImage
│  ├─ 连接状态灯 UIImage
│  └─ 服务器名称 UILabel     星港一区 · 连接正常
├─ 开始远征 UIButton         normalSkin → 按钮底图
│  └─ 按钮文案 UILabel       开始远征
└─ 底部提示 UILabel          适度游戏，探索更多精彩
```

UIBox 透明；UIButton 自身持有 normalSkin，不再包含额外背景 UIImage，也没有自身 text 属性。文字由独立 UILabel 提供。标题区居中并固定上边距；服务器信息、开始按钮及底部提示使用居中和下边距约束。节点使用父容器局部坐标及独立变量名。

PSD 中容器为命名组，UIImage 导出组内有对应像素层；UIButton 组内为 `@normal` 图片及独立文字层。新生成数据包含 **10 个分组、6 个像素层、5 个文字层**。

## 图片与切图配置

| 图片 | 文件 | 尺寸 | 九宫格上/右/下/左 |
| --- | --- | --- | --- |
| 深空渐变 | `assets/deep_space.png` | 750×1334 | 无 |
| 星点与轨道 | `assets/stars.png` | 750×1334 | 无 |
| 星海徽记 | `assets/emblem.png` | 216×80 | 无 |
| 服务器底板 | `assets/server_bg.png` | 460×64 | 12/12/12/12 |
| 连接状态灯 | `assets/status_dot.png` | 10×10 | 无 |
| 按钮底图 | `assets/button_bg.png` | 490×94 | 20/20/20/20 |

6 个像素层标记为切图，5 个文字层不勾选切图。按钮底图的九宫格保存在 `@normal` 状态层，其他图片保存在 UIImage 导出组内的像素层上。附带 PNG 是样例生成脚本的产物；通用 Prefab 导出会按当前槽位绑定输出图片、导入元数据和根目录来源清单。

`Star-Sea-Login-750x1334.meta.json` 可通过“读取配置”载入，与 PSD 内嵌 slicing 配置一致。`prototype-psd-map.json` 记录页面与 14 个节点共 **15 项映射**，另记录像素层、按钮 normalSkin 槽位及 PNG 路径。原型节点 ID、GameFlow PSD 图层 ID、PSD 原生数字 ID 相互独立。

元数据沿用 `shmd → 8BIM:gflw` UTF-8 JSON，含 namespace/version/documentId/layerId 和 prototype 引用。图片槽位映射使用稳定身份，不靠名称猜测；`identities.json` 固定生成身份，重复运行脚本会复用。本次直接更新示例和生成脚本，不通过打开旧文档时的自动转换调整结构。

## 验证记录

- 本次生成器通过生产模型校验、布局解算和边界检查：1 个 UIStack 页面、14 个节点、5 个文字节点；UIButton 自身持有 normalSkin，只有独立 UILabel 子节点。
- `ag-psd@34.2.0` 回读和独立二进制读取器确认 21 个唯一内嵌身份、15 项映射和有效九宫格；保存合成图与输入像素完全一致。详细数据及 PSD 哈希见 `verification.json`。
- 本次资源改造通过 349 项共享测试、10 项实际浏览器验收、真实 VS Code PSD/资源及实例宿主测试、类型检查和生产构建。浏览器测试覆盖通用 PSD 的按钮状态层/独立文字回读、Prefab 输出与磁盘资源重载；不代表本示例已经在目标 Laya 工程装载。
- 当前环境未安装 `psd-tools`，本次未重跑该 Python 独立合成验证。旧版节点数量及旧截图的验证记录不用于当前结构。
- PSD 文字使用 Microsoft YaHei，并保留栅格预览缓存。尚未执行 Photoshop 打开/再次保存或真实 Laya 工程装载；本示例未附带生成后的 Prefab，也没有运行时点击逻辑。

## 重建

Python 需要 Pillow；独立验证额外需要 `psd-tools==1.10.9`。Node 复用仓库现有的 `ag-psd@34.2.0`、esbuild 和共享验证器，不增加运行时依赖。Windows 字体路径为 `C:/Windows/Fonts/msyh.ttc`。

```powershell
python examples/star-sea-login/tools/generate-assets.py "$env:TEMP/star-sea-build"
node examples/star-sea-login/tools/build-sample.cjs "$env:TEMP/star-sea-build"
python examples/star-sea-login/tools/verify-independent.py
```

依赖安装在独立目录时，可把该目录作为 `verify-independent.py` 第一个参数。脚本重建像素、PSD、原型 JSON、映射和基础验证报告；工作台截图与人工验收记录需要另行更新。
