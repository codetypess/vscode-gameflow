# Prototype UI Components and Layout

Status: Done
Date: 2026-11-13
Scope: 原型编辑中的 LayaUI 基础组件、布局计算和可持久化配置

## 1. Context / Current Behavior

原型目前仅按 frame 绘制，容器没有布局语义，list/input 缺少创建入口。以外部项目 `xq-client/src/game/app/core/ui` 的 UIWidget、UIBox、UIHBox、UIVBox、UIGrid 为布局依据，落实 Draft `prototype-layaui-prefab-psd.md` 的原型阶段。

## 2. Goals

- 提供自由容器、横排、竖排、网格、面板、文字、图片、按钮、输入框、列表、复选框、单选框、进度条、滑块和下拉框。
- 六边约束（含中心）、绝对/百分比、显式/内容尺寸、padding、gap、对齐和裁剪驱动真实画布几何。
- 布局后的显示、选框、拖动、缩放、换父级、总览一致，保留稳定 ID、保存、撤销和锁定行为。

## 3. Non-Goals

本次不生成 Prefab，不接入 Laya 运行时。列表为静态可编辑子项，不包含数据绑定/虚拟化；控件状态在属性面板编辑，不执行游戏交互。字体测量为确定性的原型估算，不声称与引擎字体逐像素一致。旋转、缩放、pivot、富文本、动态皮肤引用、圆形进度和真实滚动条另行扩展；本次坐标限定 scale=1/pivot=0。

## 4. Proposed Behavior

- 底部 + 和树右键提供组件；保持常用五个快捷工具。新按钮带可编辑的独立文字子节点，旧 button.text 继续显示。
- 属性面板增加组件参数、尺寸来源、约束、容器排布。空约束代表 null，0 为有效值。百分比 10 表示 10%。
- HBox 主轴不允许相对约束；VBox 同理；Grid/list 的子项均不允许相对约束。排布切换清除相冲突的约束；在面板中禁用不适用的输入。
- 主轴拖动按兄弟顺序重排，交叉轴由对齐/约束管理。约束节点移动修改有效偏移；缩放修改尺寸或拉伸边距。换父级固化当前视觉尺寸、移除旧父约束，自由布局保持视觉位置，流式父级按目标顺序排布。
- 非法布局显示具体诊断并使用原始 frame 作可编辑回退，不写回计算结果、不无限递归。

## 5. Design

- schemaVersion 2 新增 layout / widget 配置和组件类型；读取与序列化 v1 原样保留，首次编辑升级到 v2。旧 ID、层级、frame 和外观不迁移重写。
- shared/ui-layout.ts 为纯布局解析器，按轴检测测量循环；独立于 DOM。帧字段保存显式尺寸和自由位置，计算尺寸与来源不持久化。一次画布渲染共享页面解析结果；不跨调用缓存可变文档对象。
- center > leading > trailing > position；双边始终拉伸；位置 Math.round，尺寸保留小数。父内容区减 padding。justify 忽略 gap。Grid 使用最大子项尺寸；hidden 子项仍参与布局，与库一致。负 gap 合法但总尺寸不得为负。
- 内容尺寸的父级拒绝同轴依赖：自由容器允许绝对 leading；HBox/VBox 测量交叉轴拒绝该轴的全部约束。错误保留 nodeId 供界面定位。
- 平面 DOM 使用祖先裁剪矩形的交集，避免不可见内容仍接收点击。面板支持 scrollX/Y 静态预览偏移。
- 组件状态字段严格校验；新控件外观为低保真示意，未来导出需转换为目标库的显式 skin/child 结构。

## 6. Implementation Plan

1. 模型/校验/schema、纯布局和编辑操作。
2. 创建菜单、节点绘制、浮动属性和手势统一几何。
3. 自动测试、浏览器验证和基线同步。

## 7. Testing Plan / Acceptance Criteria

- v1 无变化往返、v2 全部新增字段往返、非法字段拒绝。
- 独立测试六约束、百分比、padding、尺寸来源、HBox/VBox/Grid、justify、隐藏/负间隔、测量循环及错误回退。
- 验证约束移动/缩放、主轴重排、换父级、复制子树和 ID。
- build 和全量测试通过；浏览器验证创建布局容器与控件、修改属性实时排布、选框和撤销。

## 8. Risks and Rollback

实现中旧坐标回归测试暴露跨调用 WeakMap 缓存无法观察原地修改 frame。已移除模型缓存，改为单次渲染共享解析结果；原有测试直接覆盖该失效原因。

原型文本测量与实际引擎会有差异，属性区明确提示。v2 不应交给旧扩展编辑；旧文件加载不自动写盘，修改后通过既有 undo 恢复。完整引擎组件/Prefab 管线仍由原设计 Draft 跟踪。

## 9. Verification Results

- `npm run build` 通过（含 host/Webview TypeScript）；保留已有 Vite 大 bundle 提示。
- `npm test` 64 项通过，包括 23 项 UI 布局/兼容/示例检查。测试因沙箱阻止 esbuild 子进程而使用已授权的提升执行。
- 浏览器独立示例验证：进度 72→45 实时更新并撤销；竖排间距 18→28 使输入框/进度条分别移动到预期位置；画布拖动滑块重排；树右键创建按钮及文字子树、一次撤销；底部 + 放置横排容器；网格 4→3 列换行和超出裁剪，撤销恢复。控制台无 error。
- 浏览器发现滑块轨道从中间起绘，原因是绝对定位未设置 left、继承文字居中导致静态起点偏移；补齐 left:0 后截图确认整条轨道。
- 示例文件 `sample/ui-components.gameflow.json` 已验证可解析且页面增宽后布局无诊断；预览使用独立存储 key。原有用户预览未重载或覆盖。
- 本次未启动真实 VS Code Extension Host 或游戏引擎，不将浏览器验证视为引擎逐像素/Prefab 验收。
- 长期规则已同步到 `11-prototype-ui-layout.md`、产品和架构基线及原管线 Draft。
