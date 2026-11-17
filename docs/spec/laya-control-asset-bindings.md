# Laya 复合控件与原型、PSD、Prefab 的部件绑定

Status: Draft
Date: 2026-11-16
Scope: 基于 xq-client 当前源码的协作设计；控件模型第一阶段已完成 [原型复合控件实现](prototype-control-parts.md)，PSD 资源绑定与 Prefab 管线仍为后续设计。

## 1. Context

工作台需要同时服务策划原型、美术 PSD 工作资产和程序使用的 Prefab。Slider、CheckBox、Radio、Button 的外观和行为必须按项目自定义 LayaUI 的契约衔接，否则原型看起来正确，落到 Prefab 时仍要重新组装。用户明确 UIButton 也按容器设计，UILabel 是按需添加的可选子节点，按钮自身不依赖文字节点。

本方案细化 [原型、LayaUI、Prefab 与 PSD 总方案](prototype-layaui-prefab-psd.md)。2026-11-16 只读检查 `C:/Users/bite/Codetypes/xq-client`，HEAD 为 `9d436b0`；本次涉及的 UI 源文件和相关测试没有工作区修改。依据为实际类实现、引擎反序列化测试源码及资源 meta。没有运行目标工程测试、Laya IDE 或 Photoshop，未修改游戏工程。

## 2. Goals

- 原型中的控件可逐步替换为美术外观，保留控件和部件身份。
- 明确控件引用节点、图片节点引用资源、PSD 图层提供资源三种关系。
- 默认模板让策划一次创建可用控件，程序可核对真实节点与引用，美术可独立组织 PSD。
- 已有 Prefab 可建立映射并局部更新，保留业务脚本、未接管属性与额外节点。

## 3. Non-Goals

- 本次不实现导入/导出、改动游戏 UI 库或把草案写成已交付基线。
- 不从 PSD 图层名称、视觉相似性或层级自动推断控件行为。
- 不把整张页面截图作为可交互控件资源，不将全部 PSD 图层自动转换为运行时节点。
- 不增加未经目标库支持的状态皮肤、步进、轨道点击跳值或通用事件脚本生成。

## 4. Current Behavior and Evidence

### 4.1 项目 LayaUI 的实际契约

| 控件 | 已核实行为 | 工作台必须表达的内容 |
| --- | --- | --- |
| `UICheckBox extends UIBox` | `skin: Sprite \| null` 指向存活的直接子节点；`selected` 控制该节点的 `visible`；运行态点击切换；`disabled` 控制根节点鼠标响应 | 背景、选中标记、文字为显式子节点；选中标记可以是图片或复合容器 |
| `UIRadio extends UIBox` | 同样采用直接子节点 skin；点击只设为选中，再次点击不取消；独立 Radio 不自动互斥 | 选中标记引用与分组引用分别管理 |
| `UIRadioGroup extends UIBox` | `options` 是有序的 Radio 节点引用数组，可含空槽；成员可位于 HBox/VBox 或其他容器；`selectedIndex=-1` 表示未选中 | 分组关系独立于父子关系；按 options 顺序编号，不能按图层树顺序重建；成员不可重复或同时加入两个组 |
| `UISlider extends UIBox` | `skin` 指向直接子节点滑块；根管理 min/max/value、direction、滑块位置及拖动；背景和轨道由普通子节点提供 | 绑定滑块节点；滑块外观和尺寸可编辑，位置受控；皮肤为 UIWidget 时，其根禁止相对布局约束，内部后代可正常布局 |
| `UIProgressBar extends UIBox` | skin 指向直接子节点填充；`mode` 为 horizontal/circular；根控制填充宽度或圆形绘制 | 与 Slider 共享“部件引用”基础设施，按各自能力单独适配；圆形仅支持 UIImage/Image，不能导出为 vertical 模式 |
| `UIImage` | skin 是图片地址，texture 是纹理资源属性 | 同名 skin 在不同类上类型不同；节点引用与资源引用不可混为一个通用字符串字段 |
| `UIButton extends UIImage` | 自身绘制状态图片，normalSkin/selectedSkin/pressedSkin/disabledSkin 是资源地址；需要文字时添加显式 UILabel 子节点 | 工作台按具有自身绘制与交互的容器处理，允许没有子节点；可选文字独立编辑，不因继承 UIImage 而视为叶子，也不假定具有 UIBox 全部布局能力 |

Slider 的位置按滑块经过变换后的尺寸矩形计算：活动轴行程为 `max(0, 控件轴向尺寸 - 滑块轴向跨度)`，交叉轴居中。横向从左向右、纵向从上向下随值增加。只按中可见滑块的尺寸矩形才开始拖动；空白轨道不跳值。值变化发送 CHANGE，有变化的拖动结束发送 CHANGED；程序业务监听继续由项目负责。

CheckBox/Radio 的普通背景和文字不会随 selected 自动换图；disabled 也不自动变灰。选中皮肤虽然可隐藏，仍参与 UIBox 的自然尺寸测量。运行时切换状态不应导致控件根尺寸和命中范围意外收缩。

`test/core/ui-slider.test.ts`、`ui-check-box.test.ts`、`ui-radio.test.ts`、`ui-radio-group.test.ts` 包含 `HierarchyParser.parse` 测试，明确使用 `skin: { _$ref: id }` 与 `options: [{ _$ref: id }]`。这是已读取的测试设计证据，本次未执行。旧工作项提及的 BootstrapScene 示例在当前文件中已不存在，不能当作本轮实物验证结果。

### 4.2 GameFlow 当前缺口

- `shared/ui-components.ts` 已允许这些控件有子节点，但 `WidgetProps` 尚无部件节点引用，类型表尚无 RadioGroup。
- UIButton 已标记 `children: true`，`shared/editor-ops.ts` 的 `makeComponent` 当前创建按钮时会生成独立的文字子节点。这是现有插入模板的行为，不是控件必需结构；用户确认 UILabel 可选。后续接通按钮状态资源与 PSD 绑定时，不得将文字节点作为有效按钮的必要条件。
- `webview/editor/node-view.tsx` 以 DOM 内部勾号、圆点、轨道和滑块展示低保真效果，这些视觉不是可绑定的原型节点。CheckBox/Radio 的文字仍使用根节点 text。
- 当前 Slider 竖向位置使用 `1-ratio`，与目标库的增长方向相反；所有 disabled 控件使用透明度模拟禁用，而目标 CheckBox/Radio 无此视觉行为。这是接入时的语义差异，本次不改现有原型。
- `widget.options: string[]` 服务 ComboBox，不能直接复用于 RadioGroup 的节点引用数组。
- `shared/psd-meta.ts` 已保存 PSD 身份、切图名与九宫格，尚无原型部件到 PSD、资源到 Prefab 的完整绑定；Prefab 接入仍属后续能力。

## 5. Proposed Behavior

### 5.1 三类资产围绕同一个控件协作

| 内容 | 主要维护者 | 负责内容 |
| --- | --- | --- |
| 原型 | 策划 / Agent | 控件语义、布局、部件引用、设计初值、需求说明 |
| PSD 与切图标记 | 美术 | 外观、图层与效果；可指定哪些图层/组要切、切图区域和九宫格等规则 |
| 切图资源与资源描述 | GameFlow 工具 | 按 PSD 和规则执行合成、裁切与图片生成，记录尺寸、透明边界及九宫格，供预览和后续交付使用 |
| Prefab | 程序及项目 UI 制作者 | 目标节点与资源引用、运行时配置、脚本、事件和业务绑定 |
| 持久绑定清单 | 工作台维护，用户审阅采用 | 三者身份对应、资源来源、字段管理范围和上次同步基线 |

一个页面或复用组件应有统一资产入口，显示关联原型、PSD、Prefab，并可切换原型、稿件对照、目标结构。沿用当前原型/PSD 工具，各视图通过同一绑定关系定位对象。界面显示“未绑定”“美术已更新”“待同步”“存在冲突”等可行动状态。

首次关联现有 PSD/Prefab 时建立对应关系；无历史绑定时让用户指定目标。PSD 图层名和 Prefab 节点名可以提供搜索便利，身份以持久 ID 与作用域为准。

### 5.2 插入即带部件，属性面板允许指定引用

工作台的“容器能力”表示可以组织和编辑子节点，与节点是否自身绘制、是否带交互行为分别描述。UIButton、UICheckBox、UIRadio、UISlider 均按容器处理；具体布局和测量仍按各自目标类契约，不能仅根据 `extends UIBox` 判定是否允许子节点，也不能把 UIBox 的全部属性统一施加到所有容器控件。

建议提供以下默认模板，节点全部存在于原型树中，复制整棵控件时重映射内部引用：

```text
音量 UISlider                  同意协议 UICheckBox
├─ 背景长条 UIImage           ├─ 底框 UIImage
├─ 图片 UIImage  ← skin       ├─ 勾选标记 UIImage  ← skin
└─ 说明 UILabel               └─ 文案 UILabel
```

用户给出的典型结构是轨道 UIImage、滑块图片 UIImage、说明 UILabel 三个直接子节点。轨道绑定 PSD 的轨道导出组，图片绑定 PSD 的滑块导出组，说明保持可编辑的运行时文字。控件至少可以由轨道和滑块组成，说明是否存在及其所在布局按页面需要决定。只有滑块确实包含独立图片、文字等运行时内容时，才把滑块做成 UIBox 复合部件；仅为合成一张美术图片而存在的 PSD 装饰层不要求增加 UIBox。

其中名为“图片”的节点承担滑块职责，是因为 Slider.skin 显式引用它；职责不依赖节点名称。Slider 控制该节点的位置，轨道和说明按各自布局配置显示。

这是工作台插入模板的显式创建行为，Laya 控件本身不会创建这些节点。已有 Prefab 沿用自己的结构，不要求节点名称、层级形状与模板完全一致；只有 skin 的直接子节点要求必须满足。

选中根控件时显示值域、状态、方向和部件引用；选中图片部件时显示图片来源、尺寸和九宫格关联。引用选择器列出合法节点，支持点选定位。轨道、底框、文字是推荐的美术角色，不虚构为 Laya 控件的 track/background/label 序列化属性。

Slider 滑块位置显示为“由滑块值控制”，不让普通拖动或相对约束与运行时同时控制它。CheckBox/Radio 选中部件的显示状态由 selected 驱动。原型普通编辑选中节点不触发游戏交互；显式预览模式才允许点选和拖动模拟行为。临时预览状态不直接覆写设计初值，也不把派生的 visible/x/y 写回源节点。

UIButton 使用同样的子节点编辑方式，自身还承载按钮状态图片；UILabel 是可选内容：

```text
确认 UIButton  ← normalSkin / pressedSkin / selectedSkin / disabledSkin 对应 PSD 资源
└─ 文案 UILabel（可选）
```

UIButton 可以没有任何子节点；需要文案时添加 UILabel，需要图标等内容时按需添加 UIImage。文字节点的添加、删除不改变按钮身份及其自身交互能力，校验、预览和 Prefab 导出均不要求按钮必须存在 UILabel。选择 UIButton 编辑整体尺寸、交互状态与状态图片资源；存在 UILabel 时可独立编辑文案、字体和布局。PSD 中按钮背景导出组绑定根按钮的对应状态资源，需要的文字保持独立子节点。工作台的资产绑定需同时支持“控件根自身的图片资源”和“子部件的图片资源”，不强制为 UIButton 额外创建背景 UIImage，也不将其状态资源改成 CheckBox/Slider 式的 skin 节点引用。

### 5.3 PSD 按部件交付，可独立组织图层

PSD 普通像素/文字图层不能包含子图层，图层组可以包含图层及嵌套图层组。原型/Prefab 节点树与 PSD 分组树不要求同构，按用户给出的 Slider 结构建立部件绑定即可：

```text
原型 / Prefab
音量 UISlider
├─ 轨道 UIImage  ← PSD 轨道导出组
├─ 图片 UIImage  ← PSD 滑块导出组；Slider.skin 指向此节点
└─ 说明 UILabel  ← 原型文字；可另行采用 PSD 文字样式
```

轨道、滑块导出组可位于同一个 PSD 组下，也可来自美术稿的不同分组或显式复用的其他 PSD。每个导出组可含多层装饰，合成为对应 UIImage 使用的一张图。说明可参考 PSD 文字层，动态内容保持 UILabel，不烘焙进轨道或滑块图片；文字内容、字体及样式的采用作为单独的受支持映射处理。

按控件结构生成分层 PSD 时，可以另建“音量”组组织交付；已有 PSD 不必增加与 UISlider 一一对应的父组。Slider 根自身不必有像素，也不需要导出一张“整个 Slider”图片。PSD 组在文件中属于可承载元数据的图层记录，可记录组的稳定身份；控件类型、部件角色和对应关系由工作台绑定清单维护，不要求 Photoshop 原生理解 UISlider。

PSD 不提供 Slider 的 min/max/value、节点引用或运行时布局语义，组边界也可能随图层内容变化。控件交互范围和设计尺寸仍由原型/Prefab 保存，不能直接用 PSD 组的像素包围盒覆盖。分层 PSD 导出时可为容器创建组；外部已有 PSD 则按显式绑定使用其现有组织，不要求强制重排。

美术可以把一个滑块画成多个装饰图层，并指定为一个导出组；GameFlow 工具负责将该组切成一张图片，并按已有绑定装载到滑块 UIImage。美术无需手工导出或交付 PNG，切图执行全部由工具负责。需要独立运动、换状态或布局的内容保留为不同部件；动态文字保持 UILabel。PSD 组与运行时节点允许多对一，不要求每一层进入 Prefab。

通过操作将 PSD 图层/导出组绑定到某个图片部件，记录输出尺寸、透明边界和偏移。同一部件不同状态采用稳定导出区域，避免换图时因裁切范围变化而跳位。首批模板可保留固定部件尺寸，美术采用新的源图尺寸时单独预览对命中范围和 Slider 行程的影响。

CheckBox/Radio 先提供底框与选中覆盖层，和现有引擎契约一致；若需求是选中时整套背景、文案颜色和动效一起变化，应另定目标库能力，不能仅增加 PSD 状态组就承诺运行时自动支持。

资源复用应显式选择同一资源身份。不能仅因图片同名或像素相同就合并绑定；PSD 图层复制/合并的身份仍遵循既有元数据规则。美术修改只产生待采用资源，不直接改原型结构或 Prefab。

## 6. Design

### 6.1 用类型区分三种引用

以下为概念模型，不是当前 schema 的新增字段声明：

```text
Slider.skin ──节点引用──> 滑块 UIImage
滑块 UIImage ──资源引用──> 图片 assetId
图片 assetId ──来源绑定──> PSD documentId + layerId / 导出组

原型 nodeId ──目标映射──> Prefab 资源 UUID + 节点 _$id + 实例作用域
RadioGroup.options ──有序节点引用──> Radio A、Radio B、……
```

部件角色（thumb、selectedMark、background、label 等）用于编辑器提示与美术交接，实际行为关系由显式引用决定。节点、PSD 层、图片资源、Prefab 资源各自保持身份；改名不改号，资源 UUID 不等于节点短 ID。

RadioGroup 的选中项按 options 顺序导出为 selectedIndex；允许 -1，保留已有空槽。重新排列 options 时保持选中对象并更新索引；显示树重排不修改 options。首版将新建分组引用限制在同一页面/导出根，超出当前导出作用域明确报告；这属于工作台初期边界，不能误写为 Laya 的直接子节点限制。

引用校验同时覆盖复制、粘贴、换父级和删除：复制整个复合控件要重映射皮肤；复制整个组要重映射内部成员；局部复制不能把同一 Radio 隐式加入第二组。移动 skin 离开根节点或删除被引用对象需先解除/重绑关系，按可撤销事务提交。

### 6.2 预览与目标导出共享控件契约

2026-11-17 用户明确：运行预览基于工作台已有组件实现，聚焦切图后的装载情况，复用原型的布局和控件渲染。已支持行为与项目 Laya UI 不一致时按工作台 BUG 修复并补回归，不另写一套预览规则，也不要求启动游戏引擎。实施范围见 [切图装载运行预览](runtime-slice-preview.md)。

九宫格由工具在内存中生成切图图片/纹理及配套配置，直接装载到控件；内存产物已经是真实数据，预览不要求先落盘或编码再解码。正式导出将同一产物按需编码并保存。验收同时包含设计尺寸还原及宽/高分别变化的重建效果，避免错误分界在原尺寸下刚好拼回而被漏检。切图产物缺失或损坏必须报告，不使用切前原图掩盖问题。

按类定义支持属性、节点槽位类型、直接子级约束、受控几何/显示字段、预览规则与序列化规则。预览依据实际节点及引用计算，不再为接入控件额外绘制一份独立勾号或滑块。未绑定图片时明确显示占位资源状态。

新模型需要版本化，并单独规定旧低保真节点的升级规则；本草案不启动自动迁移。当前 schema 和保存行为继续作为现有实现基线。

目标适配器应产生类似 `skin: { "_$ref": "thumb-id" }` 的节点引用；图片资源根据 UIImage 的实际可序列化属性和目标资源索引输出。九宫格最终落到纹理资源导入配置，不能写成 UIImage 的虚构 sizeGrid 属性。当前实物 `assets/svn/tmp-texture/progress.png.meta` 已包含 `importer.sizeGrid`，具体顺序、repeat 转换和 IDE 往返在实现阶段验证。

对比 Slider 至少覆盖 min、中值、max，横向和纵向，并计入滑块尺寸、缩放、旋转和锚点；不以 `left: ratio * 100%` 代替引擎行程。CheckBox/Radio 验证选中部件可见性、根命中尺寸和 disabled 行为。目标库未提供的能力不从通用 WidgetProps 直接导出。

### 6.3 Prefab 更新与现有资产流水线

沿用总方案的字段管理与三方比较，以当前完整 Prefab 为底稿生成补丁。优先支持替换图片引用及明确接管的布局属性。`_$comp`、业务变量、未知字段和外加节点保持项目当前值；结构与 skin/options 引用作为依赖整体审阅。临时预览状态和游戏运行中的数值不作为同步来源。

PSD 更新一张滑块图片时，只产生资源及其图片引用的候选修改；slider 的 skin 仍引用原滑块节点，RadioGroup 的 options 不变。相同逻辑资源的更新保留资源 UUID；更换为另一个资源则显式修改引用。

`tools/src/res/sync-assets/prefab-map.ts` 已处理客户端业务组件与美术工程 ComponentReflect 的映射，`uuid-check.ts` 已校验资源 UUID 和引用。GameFlow 应把经审阅的资源与 Prefab 修改接入已有流程，明确唯一的落盘目录和负责写入的环节，不再维护一套独立的美术/客户端镜像同步。实际工程目录与发布入口在实施接入时确定，本次不执行同步脚本。

## 7. Implementation Plan

1. **部件模型与原型模板**：加入类型化节点引用、RadioGroup 与三个控件模板，统一预览规则。退出条件：编辑状态、复制和重排时引用及目标语义正确。
2. **PSD 部件绑定与工具切图**：在现有切图工作台选择部件与导出组，配置切图规则，由工具生成图片和资源描述，保留身份、尺寸和九宫格。退出条件：仅凭 PSD 与规则即可生成并预览资源；同一 PSD 改名/重新加工后，仍可定位正确部件并审阅资源更新。
3. **一个页面打通 Prefab**：选择包含音量 Slider、勾选项和一组 Radio 的设置页，在隔离输出目录验证新建与已有 Prefab 局部更新。退出条件：目标引擎加载、IDE 保存重开后关系不变，业务组件保留。
4. **复用与扩展**：验证复用组件实例、UIProgressBar 与 UIButton 状态资源，随后接入项目现有资源同步入口。嵌套 Prefab 的覆盖语义单独验收后开放。

优先完成前三步中的一个完整页面，验证原型 → PSD 交接 → 美术回流 → Prefab 使用闭环，再扩大组件覆盖面。

## 8. Testing Plan

- 节点引用：直接子级限制、错误类型、复制重映射、删除和换父级、撤销重做及保存重开。
- 控件语义：CheckBox 连续切换；Radio 再次点击保持选中；分组排他、空选、空槽与 options 重排；禁用不附加未约定的视觉效果。
- 几何：Slider 双方向与值域端点、皮肤变换、零行程、轨道点击不跳值；隐藏选中标记仍参与测量。
- 资源绑定：PSD 身份保持/失效、导出区域变化、共享资源显式复用、切图重新采用后节点 ID 和资源 UUID 保持。
- Prefab：真实引擎 parse 与 IDE 往返，skin/options 引用有效；只换美术保留业务组件，双方改同一受管理字段显示冲突，未变更同步无内容差异。
- 文档升级另立实施工作项；新引用必须纳入原有 ID 分配、复制、验证和宿主撤销事务。

## 9. Acceptance Criteria

- 插入三个控件后可在树中直接定位并编辑视觉部件，PSD 可绑定到对应图片节点。
- 同一 Slider 在原型和 Laya 中方向、端点、滑块位置一致；CheckBox/Radio 的状态和分组一致。
- 美术替换已绑定部件后，无需重新建立控件、分组及程序接线即可采用新外观。
- 任何“已同步”结果都有有效绑定和基线，完整 Prefab 的未接管内容保留。
- 以上是后续实现的验收目标；本次交付为源码核对与 Draft 设计文档。

## 10. Risks and Rollback

- UI 库变动造成适配漂移：按目标工程版本维护控件契约与实际引擎 fixture；本次发现历史场景样例已移除，验收应选择当时仍存在的材料。
- 图片尺寸影响控件几何：资源更新展示尺寸和行程差异，布局更新单独采用。
- PSD 效果无法被当前解析器准确合成：沿用现有支持范围，复杂导出组需验证实际切图能力后开放。
- 实现分阶段接入；绑定与源文件分别保存，解除绑定保留原型、PSD、Prefab。当前仅增加草案，不改变任何运行时行为。

## References

- GameFlow：`shared/ui-components.ts`、`shared/ui-config.ts`、`shared/psd-meta.ts`、`webview/editor/node-view.tsx`、[原型布局基线](11-prototype-ui-layout.md)。
- xq-client 源码：`src/game/app/core/ui/ui-slider.ts`、`ui-check-box.ts`、`ui-radio.ts`、`ui-radio-group.ts`、`ui-progress-bar.ts`、`ui-image.ts`、`ui-button.ts`。
- xq-client 契约测试：`test/core/ui-slider.test.ts`、`ui-check-box.test.ts`、`ui-radio.test.ts`、`ui-radio-group.test.ts`。
- 资源流程：`assets/svn/tmp-texture/progress.png.meta`、`tools/src/res/sync-assets/prefab-map.ts`、`uuid-check.ts`。
