# GameFlow 组件与组合部件

写入 JSON 的是下表的 `type`。GameFlow / Laya 的类名用于和策划、程序核对组件语义。对照[完整原型示例](guild-supplies.gameflow.json)可直接跟踪部件 ID 与父级。

## 结构、展示与操作

| JSON 类型 | 对应类 | 生成决策 |
| --- | --- | --- |
| `container` | UIBox | 组织自由布局、叠放、复用与整体移动。UIBox 本身透明，可见底板可用第一层普通 UIImage。 |
| `hbox` / `vbox` | UIHBox / UIVBox | 固定数量的横排按钮、纵排信息等，按兄弟顺序排列，常用 `layout.gap`。 |
| `grid` | UIGrid | 静态、数量明确的矩阵。用 `direction/wrapCount/gapX/gapY` 描述顺序及间距。数据驱动的物品阵列选 UIList 并设置每行列数。 |
| `panel` | UIPanel | 裁剪视口或滚动的一组异构内容。默认裁剪，可用 `layout.clipContent/scrollX/scrollY` 描述设计状态。旧 `rectangle` 也映射到 UIPanel，新建时选表意明确的 panel 或容器加图片。 |
| `text` | UILabel | 叶节点。`name` 是层级名称，`text` 是可见内容。字号、颜色和水平对齐在 `style`，换行、溢出和垂直对齐在 `widget`。 |
| `image` | UIImage | 叶节点。例：`image: {"builtin": "icon/chest"}`。图片填充用 `widget.imageFit` 的 `fill/contain/cover`。按下方内置资源目录选择占位图，直接写入 `image.builtin`。 |
| `button` | UIButton | 根持有 `normalSkin`，如 `{"builtin":"button/blue"}`。可选 `selectedSkin/disabledSkin`，未设时回退普通态。文字按钮在根下建 `text` 子节点；纯图标按钮可省文案。状态用 `widget.selected/disabled`。 |
| `input` | UITextInput | 独立叶节点。用 `widget.placeholder/password/maxChars` 表达输入，`text` 为示例输入值。需要底板、标题时，作为同一区域的兄弟节点。 |
| `list` | UIList | 数据重复项一律通过 `cellPrefab` 引用 UIBox 条目画板，列表上设置视口。详见[画板与引用](boards.md#列表项与普通组件引用)。 |

### 原型内置图片

按钮的 `button/颜色`、色块的 `block/fill-颜色` 和 `block/outline-颜色`、圆形的 `circle/fill-颜色` 和 `circle/outline-颜色` 支持 gray、green、yellow、red、blue、white。通用占位图为 `image/default`。控件专属部件见下表。

图标 ID 以 `icon/` 开头，可用名称包括 settings、plus、minus、star、back、search、close、home、play、pause、refresh、down、up、check、user、sword、shield、heart、bolt、coin、gem、bag、potion、chest、trophy、lock、volume、info。缺少专用美术时可用已有含义接近的图标或占位图，再用独立文字标明用途。

## 可编辑的组合控件

下面每一层都是 `page.nodes[]` 中有独立 ID 和 frame 的真实节点。部件靠 `parentId` 挂在拥有它的控件下，绑定字段的值为节点 ID。背景在前、可见标记或填充在后，文字留足宽度。为一个固定尺寸的部件提供局部 frame 即可。

| 目的与类型 | 子层与图片 | 绑定与状态 |
| --- | --- | --- |
| 可拖动的数值（UISlider，`slider`） | 轨道 UIImage 用 `slider/track`，手柄 UIImage 用 `slider/thumb`。说明或当前值按需用独立 UILabel，给轨道留出净高。 | `widget.skinNodeId` 指向**直接子节点手柄**。`widget.min/max/value` 决定位置，`widget.direction` 为 horizontal 或 vertical。手柄不得设置 left/right/centerX/top/bottom/centerY；运行时根据值在根宽高内移动（纵向从上到下）。需要拉伸的轨道可以单独约束。 |
| 只读进度（UIProgressBar，策划常称 UIProgress，`progress`） | 横向底槽／填充使用 `progress/base`、`progress/fill`；圆形使用 `progress/ring-base`、`progress/ring-fill`。数值文案可另设 UILabel。 | `widget.mode` 取 `horizontal` 或 `circular`。`widget.skinNodeId` 指向**直接子 UIImage 填充**，该图禁用全部六项相对约束。按完整可用区域设计底槽与填充，数值由根的 `min/max/value` 决定；横向动态改宽，圆形保留整图按扇区绘制。 |
| 多项可独立开关（UICheckBox，`checkbox`） | 底框 UIImage `checkbox/base`、选中标记 UIImage `checkbox/mark`、独立说明 UILabel。 | `widget.skinNodeId` 绑定**直接子节点标记**，`widget.selected` 表示勾选状态。标记显隐由控件派生，保留底框和说明可见。 |
| 单个单选项（UIRadio，`radio`） | 底框 UIImage `radio/base`、选中标记 UIImage `radio/mark`、独立说明 UILabel。 | 绑定方式同 checkbox。独立项用 `widget.selected`；加入组后，选择状态由组控制。 |
| 互斥选择（UIRadioGroup，`radioGroup`） | 每个选项创建一套上述 UIRadio 部件；可直接放在组下，等距排布可在组内增加 hbox/vbox。 | `widget.optionNodeIds` 是**有序的同页 radio 根 ID**。父子关系仅组织布局，实际成员以数组为准；每个 radio 只属于一个组且只出现一次。`widget.selectedIndex` 对应数组的有效项，-1 表示未选。 |
| 下拉选择（UIComboBox，`combo`） | 将显示当前选项的 UILabel 做成直接子节点；可增加背景 UIImage 和箭头 `icon/down`。 | `widget.options` 为字符串数组，`selectedIndex` 指向当前项或为 -1。`widget.textLabelNodeId` 绑定该直接 UILabel，显示文字取自所选项。 |

所有数值型控件均需满足 `min < max`、`min ≤ value ≤ max`。进度和滑块使用同一数值范围逻辑，交互意图不同。材料只要求“显示完成度”时用进度条；“玩家调整数量”才使用滑块。草图中的圆点可能是步骤标记，只有文档或图注表明互斥选择时才建单选组。

**组合示意（编辑器层级）**

```text
领取方式  radioGroup    optionNodeIds = [自取根 ID, 邮寄根 ID]，selectedIndex = 0
├─ 自取  radio         skinNodeId = 自取标记 ID
│  ├─ 底框  image
│  ├─ 自取标记  image
│  └─ 自取说明  text
└─ 邮寄  radio         skinNodeId = 邮寄标记 ID
   ├─ 底框  image
   ├─ 邮寄标记  image
   └─ 邮寄说明  text
```

复制组合控件时，为整棵子树分配新 ID，再重映射 parentId、skinNodeId、textLabelNodeId 和 optionNodeIds。检查两个组没有共用同一个选项、滑块绑定到了自己的手柄、进度条绑定到了自己的填充。示例中的百分比、数量文字是可编辑的设计值；改变示例值时同时核对相邻文案。
