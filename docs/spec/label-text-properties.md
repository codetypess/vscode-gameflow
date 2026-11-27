# UILabel 文字属性与语法

Status: Done
Date: 2026-11-17
Scope: UILabel 的行距、字距、自动换行、五种溢出模式及 HTML / UBB / 模板语法。

## 1. Context

用户要求支持截图红框中的属性。当前只有 wordWrap 和 visible/hidden，显示使用普通 DOM 字符串，内容测量不理解语法或间距。
只读核对 `C:/Users/bite/Codetypes/xq-client` HEAD `a39a700` 的 `ui-label.ts`、`text-layout.ts` 及工程自带 `engine/libs/laya.core.js`，不修改游戏工程。

## 2. Goals

- 属性可编辑、锁定禁用、撤销/重做、保存/重载、引用实例覆盖/还原。
- leading / letterSpacing 接受有限正负数，默认 0。
- overflow 支持 visible、hidden、scroll、shrink、ellipsis。UILabel 缺省 wordWrap=true、overflow=visible，已有控件显式选择的模式优先。
- 语法顺序与源码一致：CRLF 归一化 → templateVars → UBB 转 HTML → HTML 文本段；开启 UBB 即启用 HTML 解析。
- 模板支持 `{name}`、`{name=default}`、反斜杠转义，面板提供模板开关与 JSON 变量编辑。

## 3. Non-Goals

字体资源、BitmapFont/MSDF、描边、padding、fitContent、Prefab 导出、链接跳转和游戏事件不在本次范围。内联图片资源路径尚无项目资产解析器，显示明确占位而不擅自访问游戏资源。

## 4. Current Behavior

UILabel 组件设置只有换行及两项溢出。未知 widget 字段不能通过文档校验；实例覆盖和 JSON Schema 也有字段白名单。

## 5. Proposed Behavior

2026-11-27 更新。新建、从 PSD 同步及重新打开的 UILabel 在缺少溢出设置时默认显示框外文字。画布、属性面板与预制体同步共用这一默认值。只有启用内容裁剪的祖先可以限制默认文字的可见区域。验收覆盖 116 × 27 px 文本框中的 34 px 文字、显式裁剪以及父容器的裁剪边界。

2026-11-17 面板对齐补充：文字样式、六项对齐和语法开关统一使用普通属性行的 60px 标签列及 7px 列间距，操作区左边界与文字内容、字号、行距等输入框一致；语法复选框去除原生外边距，窄面板时按组换行。

在文字设置中加入行距、字距、换行、溢出及一行 HTML/UBB/模板复选框。文字内容使用多行输入：Enter 换行、失焦或 Ctrl/Cmd+Enter 提交、Escape 恢复。模板开启写入空对象，关闭写入 null；已有变量可通过 JSON 对象编辑，值为字符串/数字/布尔/null。未知 UBB 标签保留文字，转义方括号不解释；支持目标默认解析器的 b/i/u/color/size/font/url/img/sup/sub 和工程引擎新增的 stroke，其中 font face 和上下标与目标 HTML 解析器一样不改变字体。HTML 支持目标文本样式和换行，忽略脚本内容与事件属性。

## 6. Design

- 可选字段放在 widget：leading、letterSpacing、html、ubb、templateVars、scrollX/Y；不升级 schemaVersion。
- 从目标纯排版算法适配独立共享模块，注入字体测量。共享布局使用现有确定性估算，浏览器使用 Canvas 普通字体测量；两处共用语法和换行/间距/溢出算法。
- 最终排版结果由 UILabel 视图绘制，shrink 和 ellipsis 同时考虑宽高；scroll 使用静态偏移属性，保持画布滚轮手势。
- HTML/UBB 只生成受控 React 元素，不使用原始 HTML 注入；链接仅绘制样式，图片保留指定尺寸和占位。
- 非法负行位置由布局诊断报告，视图保留可编辑节点而不崩溃。

## 7. Implementation Plan

1. 模型、Schema、实例字段白名单与属性面板。
2. 语法解析、排版和共享测量、画布显示。
3. 定向测试、构建、浏览器验收，更新基线。

## 8. Testing Plan

测试语法顺序/转义/未知标签/嵌套/实体、负字距、英文及中文换行、五种溢出、内容测量、无效字段拒绝、保存及实例覆盖。运行完整共享测试与生产构建；浏览器核对面板编辑、画布结果、撤销/重做和保存重载。

## 9. Acceptance Criteria

- 截图标注的属性都可编辑并影响画布。
- 目标 UBB 文本样式及模板行为有确定性案例覆盖，纯文本默认不解析标记。
- 新字段经过文档与消息校验，保存和实例覆盖不丢失。
- 完整测试与构建通过，验证范围如实记录。

## 10. Risks and Rollback

字体测量仍依赖可用系统字体，不能声明与游戏像素完全一致；图片资产暂显示占位。撤回新增字段、共享排版和视图即可恢复原渲染；原文不被语法解析结果改写。

## 11. Verification

- 2026-11-27 默认溢出变更通过 416 项共享测试和生产构建。Chrome 单向同步回归确认从 PSD 新增到原型的文字在画布上使用 visible，组件回归覆盖 34 px 字号与 27 px 框高、属性面板的默认选项、显式裁剪及父面板边界。
- 2026-11-17：`npm test` 277 项通过，其中新增 14 项 UILabel 定向案例覆盖语法顺序、模板转义、嵌套样式、负字距、Unicode/英文换行、五种溢出、测量诊断、字段校验、保存以及真实引用实例组合/还原。
- `npm run build` 通过（含宿主及 Webview TypeScript 检查）；保留 Vite 既有大包体提示。`git diff --check` 通过。
- 本地浏览器 `http://127.0.0.1:5191/`：游戏标题开启 UBB/模板，`[b][color=#ff6600]{name=标题}[/color][/b]` 配变量后显示橙色粗体“行距与字距”；行距 8、字距 2，第二行起点为 29.6px。
- shrink 在 180×32 框内缩放至 .625；ellipsis 显示“行距与字距…”；scrollY=10 产生 -10px 的行偏移；裁剪/显示切换效果已观察。
- 滚动偏移撤销到 0、重做到 10；无效 JSON 自动还原；锁定后新字段禁用；保存刷新保留富文本结果。
- 多行文案通过 Ctrl+Enter 提交，Escape 后失焦恢复原值；控制台 error/warn 为空。截图保存在 `C:/Users/bite/.codex/visualizations/2026/11/17/01a1e901-2469-7671-9410-2c2d27e49eb6/label-properties.jpg`。
- 本轮没有在真实 Extension Host 中重新进行人工交互，未装载游戏字体/内联图片资源；这些边界不作已验证声明。
