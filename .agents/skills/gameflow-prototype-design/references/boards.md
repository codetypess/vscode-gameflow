# 画板与引用

## 文档和身份

- 新文件使用 UTF-8 JSON，顶层包含 `schemaVersion: 5`、`elementIdScheme: "nanoid-8"`、稳定的 `documentId`、`title`、`requirements`、`pages`、`interactions`。数组可以为空。需求写齐 `id/text/status/source`。项目中的旧文档可能使用较早版本；编辑时保留现有身份，使用新字段时采用能承载它的版本。
- 新页面和新节点都分配 8 位随机小写字母数字 ID，在整个文档的页面、节点和实例本地新增项之间查重。可先建立“业务名 → ID”映射，再写父子、皮肤、模板和跳转关系。需求与跳转的 ID 分别在各自数组内唯一。独立新文件使用独立文档身份。
- `pages[]` 每项含 `id/name/kind/frame/nodes`。选择 `rootType` 时看用途，常规堆叠界面用 `UIStack`，顶层界面用 `UITop`，场景用 `UIScene`，可复用条目或组件画板用 `UIBox`。`kind` 单独写 `screen` 或 `modal`，与根类型独立。需要后续导出 Prefab 时，给页面和它引用的模板都填写符合项目习惯的 `exportName`。
- `page.frame` 的 x/y 是总览画板位置。按玩家流程摆放页面，在相邻区域放关联弹窗和模板，留出间距。主窗口的 `page.frame.width` 为 750，`height` 为 1334；同一主窗口的状态画板沿用该尺寸。弹窗按内容设置宽高，并在主窗口范围内核对文字换行、按钮和边距。独立 `UIBox` 模板按组件用途取自然尺寸。
- `page.nodes` 是扁平数组。每个节点写 `id/name/type/frame`；同页 `parentId` 形成层级，顶层省略此字段。所有 frame 写齐有限数值 x/y/width/height，宽高为正。节点坐标属于父局部空间，根节点坐标相对页面。同级靠后的节点绘在前面，背景图片先于内容。嵌套时只在新层级内定位一次。
- 页面跳转写 `{ "id": "open-donate", "fromPageId": "p9uk7z2m", "toPageId": "s5vc8e3q", "trigger": "点击物资条目的捐献按钮" }`。两个页面 ID 在本文件中均须存在。记录弹窗取消、确认等有依据的去向。展开详情、改变滑块等页内操作用设计状态或需求文字表达。`trigger` 描述业务动作，当前格式没有节点点击事件字段。

## 层级与自适应

| 场景 | 写法 |
| --- | --- |
| 固定分辨率的标题、插画、条目内图标 | 明确的局部 `frame` 已能表达位置时，省略相对约束。 |
| 操作按钮横排、条目内多行摘要 | 父级用 `hbox` 或 `vbox`；顺序、`gap`、内边距与 `align/valign` 负责排布。横排子项的水平轴、竖排子项的垂直轴、网格子项的双轴由父级管理。 |
| 弹窗宽度可变，关闭按钮应始终靠右上 | 对按钮设置 `layout: {"right": 16, "top": 16}`。背景须铺满可变容器时才用四边 0；尺寸固定的背景可直接给 frame。 |
| 控件在可变区域中保持居中或拉伸 | 居中用 `centerX` 或 `centerY`。同轴两侧偏移定义拉伸，按轴选择一种意图。百分比单位为 `layoutUnit: "percent"`，数值 10 表示 10%。未启用的约束省略或用 null，0 表示已启用。 |
| 长描述、内容决定尺寸 | 文字使用 `widget.wordWrap`、`widget.overflow` 和明确可读区域。确需内容测量时才用 `widthMode/heightMode: "measured"`。测量轴上的子项应能独立确定尺寸与位置，避免父宽取决于子宽、子宽又依赖父宽。 |

页面的 `page.layout` 描述将来游戏中相对宿主的约束，画板仍按设计尺寸预览。滚动列表的条目画板保持自然宽高，根上省略相对约束。

## 列表项与普通组件引用

**同构数据项**（背包格、排行榜行、任务卡）使用一张独立 `rootType: "UIBox"` 画板设计一个条目。画板宽高就是一个条目的自然尺寸，节点放在条目局部坐标内。业务页放一个 `list`，例如下列节点：

```json
{
  "id": "n8uz6w4y",
  "name": "物资征集列表",
  "type": "list",
  "frame": { "x": 33, "y": 352, "width": 684, "height": 950 },
  "layout": { "scrollType": 2, "wrapCount": 1, "gapY": 16 },
  "cellPrefab": { "source": "", "documentId": "guild-supplies-example", "pageId": "c4mf2y8k" }
}
```

- 本文件引用用空 `source`。跨文件引用用相对于**引用方文件**的 `.gameflow.json` 路径，以 `/` 分隔，并核对目标文件里的 `documentId`、`pageId`。原型引入使用这三个字段；磁盘 Prefab 的 UUID 是另一种来源，仅在确有对应工程资产时使用。
- `scrollType` 的 2 为纵向、1 为横向、0 为不滚动。纵向的 `wrapCount` 是每行列数，横向是每列行数。`gapX/gapY` 设置条目间距。用“内边距 + 一行／列的条目尺寸和间距”核对视口。滚动方向允许部分露出下一项。
- 列表仅持有 `cellPrefab`。预览器会重复绘制模板，条目实例无需写入业务页的 `nodes`。在需要表现零项时，让相应状态显示空态内容并收起列表。同一列表只有一个条目模板；异构需求可用分区或模板内状态表达。
- **整块复用**（例如多页共享头像卡）选用独立画板。使用方写 `type: "container"`、局部 `frame` 和 `prefab: {"source": "", "documentId": "…", "pageId": "…"}`。内容和子树保存在源画板；普通实例可以放进当地容器。简单的新组件画板可直接使用其页面根。沿用提取生成的 `componentRootId` 时，它应指向本页无父级的普通 `container`，其子树包含该组件内容。
- 让引用始终从使用者指向可解析的来源，同时检查 `prefab` 与 `cellPrefab` 形成的依赖链，排除自引用、间接循环和移走的目标文件。

## 复核生成结果

1. 重新解析生成文件，用支持 JSON Schema Draft 2020-12 的工具加载[本技能的格式定义](gameflow.schema.json)。PowerShell 7.4+ 可离线运行 `Test-Json -LiteralPath "原型.gameflow.json" -SchemaFile "技能目录/references/gameflow.schema.json"`；其他环境可用 `check-jsonschema --schemafile "技能目录/references/gameflow.schema.json" "原型.gameflow.json"`。该定义取自 GameFlow 的 `schemas/gameflow.schema.json`。
2. 逐页索引 ID。检查父链可终止于本页根、父节点支持子项、跳转两端存在。解析每个画板引用，核对目标文档身份、根类型、尺寸及循环。根据组件表核对直接部件引用、组成员和选中索引。确认引用列表没有手工重复行。
   对本次生成或替换的占位图，逐一核对页面、模板及实例编辑（含新增节点和属性覆盖）。图片槽和各状态皮肤槽只引用有效的 `builtin` ID。发现用于占位的 `imageData`、`art` 或 `sliceResource` 时，替换为对应内置资源并清除该占位原有的图片数据和外部引用。
3. 有 GameFlow 源码时可调用 `shared/model.ts` 的 `validateGameFlowDocument`、`shared/ui-layout.ts` 的 `resolvePageLayout`（检查 `issues`），并用 `composeCanvasPage`、`resolveCellPage` 核对实例和条目模板。在独立策划项目中也能依据前两步和设计尺寸检查层级、引用与几何。
4. 从主入口走到每个目的地并返回。换一个选中项或滑块／进度示例值，核对改变的是正确部件。核对主窗口为 750 × 1334、弹窗能容纳实际内容，再检查相对约束是否确有作用，检查按钮文案、空态和裁剪区域。只将实际执行的检查写成交付记录。
