# 星海远征 · 750×1334 竖版登录页

按用户截图重新安排竖版布局，保留深蓝星空、金色徽记/按钮及原有文案。所有产物设计尺寸均为 **750×1334**。

## 打开方式

- **原型**：在安装 GameFlow 的 VS Code 中打开 `star-sea-login.gameflow.json`。它与仓库 `sample/star-sea-login.gameflow.json` 内容相同。
- **浏览器原型**：启动 `npm run dev:webview -- --port 5187`，访问 `http://127.0.0.1:5187/?sample=star-sea-login`。该样例使用独立浏览器存储；双击页面编辑内部节点。
- **PSD**：在 PSD 切图/合并工作区打开或拖入 `Star-Sea-Login-750x1334.psd`。也可交给美术用 Photoshop 打开。
- **预览**：`prototype-preview.jpg` 裁自工作台 39% 缩放截图并放大至设计尺寸；`workbench-preview.jpg` 保留完整工作台截图。`artwork-preview.png` 为与 PSD 内保存合成图相同的美术图；`comparison-preview.png` 并排展示两者。

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
├─ 开始远征 UIButton
│  ├─ 按钮底图 UIImage
│  └─ 按钮文案 UILabel       开始远征
└─ 底部提示 UILabel          适度游戏，探索更多精彩
```

UIButton 根是透明容器，不另存一份 text。独立 UILabel 可以编辑或删除，UIImage 不包含文案。标题区居中并固定上边距；服务器信息、开始按钮及底部提示使用居中和下边距约束。节点使用父容器局部坐标及独立变量名。

PSD 中上述控件/容器均为命名组；每个 `UIImage` 是导出组，内部只有其对应像素层。`UILabel` 是独立文字层，因此不用在普通图层下嵌套子节点。共 **11 个分组、6 个像素层、5 个文字层**。

## 图片与切图配置

| 图片 | 文件 | 尺寸 | 九宫格上/右/下/左 |
| --- | --- | --- | --- |
| 深空渐变 | `assets/deep_space.png` | 750×1334 | 无 |
| 星点与轨道 | `assets/stars.png` | 750×1334 | 无 |
| 星海徽记 | `assets/emblem.png` | 216×80 | 无 |
| 服务器底板 | `assets/server_bg.png` | 460×64 | 12/12/12/12 |
| 连接状态灯 | `assets/status_dot.png` | 10×10 | 无 |
| 按钮底图 | `assets/button_bg.png` | 490×94 | 20/20/20/20 |

6 个像素层在 PSD 内标记为切图；5 个文字层不勾选切图。当前工作台按内容像素层配置，因此九宫格保存在 UIImage 导出组内的像素层上，选择“按钮底图 · 像素”即可查看。附带的 PNG 是样例生成脚本输出，工作台通用图片导出功能仍沿用现有范围。

`Star-Sea-Login-750x1334.meta.json` 可通过“读取配置”载入，与 PSD 内嵌 slicing 配置一致。`prototype-psd-map.json` 逐项列出 16 个原型页面/节点到 PSD 组/文字层的映射，另记录图片像素层和 PNG 路径。原型节点 ID、GameFlow PSD 图层 ID、PSD 原生数字 ID 独立，不能互换。

元数据沿用样例的 `shmd → 8BIM:gflw` UTF-8 JSON，含 namespace/version/documentId/layerId，以及此样例的 prototype 引用；这是实验样例映射，不代表已接入生产资源回流或 Prefab。`identities.json` 固定此次生成的身份，重复运行脚本会复用。

## 验证记录

- 生产模型校验、布局解算和边界检查通过：1 个 UIStack 页面、15 个原型节点，5 个文字节点；UIButton 子级为 UIImage、UILabel。
- `ag-psd@34.2.0` 回读及独立二进制读取器确认 22 个唯一内嵌身份、完整映射和有效九宫格；保存合成图与输入像素完全一致。
- `psd-tools@1.10.9` 独立读取确认 11 个分组、5 个文字层、6 个像素层。6 份 PNG 与对应层像素完全一致；重新合成的最大通道差为 1。
- 实际浏览器可打开原型和 PSD；按钮文案修改后可一次撤销，图片层勾选与九宫格显示正确，文字层未勾选切图；控制台无 error/warn。
- 177 项共享测试、类型检查和生产构建通过。详细数据见 `verification.json`。
- PSD 文字采用 Microsoft YaHei，并保留栅格预览缓存。尚未执行 Photoshop 打开/再次保存；其他机器缺少字体时需替换字体。本例没有运行时点击逻辑或 Prefab 输出。

## 重建

Python 需要 Pillow；独立验证额外需要 `psd-tools==1.10.9`。Node 复用仓库现有的 `ag-psd@34.2.0`、esbuild 和共享验证器，不增加运行时依赖。Windows 字体路径为 `C:/Windows/Fonts/msyh.ttc`。

```powershell
python examples/star-sea-login/tools/generate-assets.py "$env:TEMP/star-sea-build"
node examples/star-sea-login/tools/build-sample.cjs "$env:TEMP/star-sea-build"
python examples/star-sea-login/tools/verify-independent.py
```

依赖安装在独立目录时，可把该目录作为 `verify-independent.py` 第一个参数。原型截图需在工作台 100% 显示完整页面后另行生成；脚本重建像素、PSD、原型 JSON、映射和基础验证报告，截图与浏览器验收记录需随新版本复核。
