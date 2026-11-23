# Prototype UI and Layout Baseline

Date: 2026-11-18
Status: Implemented prototype subset

## Components

页面属性在“页面名称”与“基础属性”之间提供独立的“导出名称”一行，与其他输入对齐，保存为可选 v2 `page.exportName`，供后续生成预制体使用。Enter/失焦提交时去除首尾空白，保留大小写，Escape 恢复，留空移除字段；旧文档不自动填充。修改显示名称、根类型或几何不联动导出名，整页复制保留；支持普通保存、重载及撤销/重做。此名称现用于当前页面的 `.lh` 导出，详见 [页面导出名称](page-export-name.md)。

底部添加菜单和层级树右键提供 16 种原型节点：自由容器、横排、竖排、网格、面板容器、文字、图片、按钮、输入框、列表、复选框、单选框、单选组、进度条、滑块、下拉框。旧矩形节点继续兼容读写和渲染。菜单显示中文名与括号内的 LayaUI 类名，底部菜单不显示快捷键列。`shared/ui-components.ts` 定义类型、中文名、目标 LayaUI 类及能否包含子节点。新 UIButton 默认只有按钮根，UILabel 可通过添加子节点按需创建、删除；无 text 时不显示节点名，UIButton 自身不渲染 text，文案仅由独立 UILabel 表达；自带示例直接更新，不进行旧文档自动转换。容器能力与是否自身绘制分别描述，不根据 UIBox 继承关系推断。

画布根类型包括堆叠界面 (UIStack)、顶层界面 (UITop)、场景界面 (UIScene)，三种界面新建默认尺寸均为 750×1334；组件画板 (UIBox) 初始为 320×240。添加菜单上方“添加到画布”包含四种根类；下方控件区另保留自由容器，仅在页面内启用并添加子容器。UIBox 画板可用于 ItemRender 设计，双击编辑内部节点。UIView 是基础类，不作为可选根类型；默认新建 UIStack。页面属性可改根类型，与 screen/modal 页面形式独立；改类型保留 ID、内容和几何，复制保留类型并生成新 ID。层级树根和属性身份显示实际根类。当前页面可导出目标自定义 UI 类的 `.lh`；运行时层级管理及 ItemRender 业务绑定仍由目标项目负责。

页面属性的“根节点布局”支持配置六项相对游戏父容器的约束及像素/百分比单位，保存为可选 v2 `page.layout`，仅接收 ConstraintLayout 字段。新启用项默认 0，取消写 null；单位切换保留输入数字，不假定预览父级进行换算。当前画布继续按 page.frame 设计尺寸和总览摆放坐标展示，根约束不参与内部控件几何解算；界面明确说明该范围。改名、拖动画板、换根类和整页复制保留配置，复制独立克隆布局对象；支持正常保存和 undo/redo。导出的 Prefab 保留根约束；父容器自适应预览仍为后续工作。

控件状态通过属性面板编辑，包括勾选/禁用、数值范围、方向、输入占位/密码/字数、下拉选项、文字换行/溢出/垂直对齐及图片填充方式。预览不执行游戏业务事件；正式资源与 Prefab 导出从顶栏独立触发。UIList 是可编辑静态子项的网格，不是运行时虚拟列表。

UIImage 可选 `sliceResource` 绑定实际切图；普通图片缺省 fill，显式 contain/cover 保留。切图九宫格按实际产物尺寸重建，支持重复，小于两侧之和时优先保留前侧边界且不扩大目标。资源自然尺寸进入 measured 布局及反向编辑，移动不会意外固化尺寸，缩放只固化改变的轴；锚点、约束、重挂接、复制及组件提取使用同一几何输入。顶栏运行预览复用这些布局/绘制，临时修改控件状态和尺寸可重置且不改设计初值。详见 [切图装载运行预览](runtime-slice-preview.md)。

文字区统一提供 B/I/U/S（加粗、斜体、下划线、删除线）四个独立样式开关，按钮间隔 1px 紧凑排列，不提供字重下拉框；B 读取 fontWeight>=600，开启/关闭写入 700/400，其他样式使用可选布尔 style.italic/underline/strikethrough，缺省 false。“对齐”行分为水平左/中/右与垂直上/中/下两组，共六个图标，分别沿用 style.textAlign 与 widget.valign；每组独立高亮并提供提示。UILabel 默认左/上，其他文字节点沿用已有默认值，移除组件设置中的重复垂直对齐下拉框。组合样式及两轴对齐同步画布、保存与撤销；锁定/继承锁定禁用。详见 [文字样式与对齐](text-formatting-controls.md)。

新 Slider、CheckBox、Radio 创建真实图片部件与独立说明文字，`widget.skinNodeId` 显式引用直接子节点；可从属性面板绑定或清空。Slider 根管理滑块位置，按变换后的滑块跨度计算行程，横向向右、纵向向下增长；坐标、相对约束和直接拖动停用，尺寸和变换可编辑，派生位置不保存。CheckBox/Radio 的选中状态只控制皮肤显隐，原 hidden 值保留，解除绑定恢复其含义；受控皮肤的图层显示按钮禁用。隐藏标记继续参与测量，禁用不自动降低透明度。无图片的模板部件以独立节点自身填充展示，支持普通图片替换。

RadioGroup 为可含子节点的容器，`widget.optionNodeIds` 保存同页 Radio 的有序引用及空槽，`selectedIndex=-1` 表示空选。面板提供成员添加、移除和选择，不提供上下移按钮；成员行按删除按钮、序号、节点引用排列，成员序号、“当前选项”下拉框及对应无障碍名称/提示统一从 0 开始，与 selectedIndex 一致。删除按钮默认隐藏，整行悬停或键盘焦点进入时显示，保留槽位避免跳动，锁定时禁用。“添加选项”按钮位于右侧节点引用列，与上方成员引用框左右对齐并同宽。同一成员不可重复或归属两个组。显示树移动不改变分组，数据层改成员顺序保持选中对象，移除成员保留其当前选择。整组复制重映射内部成员，外部引用清空，独立 Radio 副本保留显示的选择状态。

节点皮肤和 RadioGroup 成员使用统一引用框：单击聚焦，Delete / Backspace 清空引用（成员保留空槽）；方框指针图标、双击或 Enter / Space 打开树形选择弹窗。弹窗指明发起节点与属性，标记正在设置、当前绑定及待选节点，类型统一在标记右侧靠右显示；支持搜索、折叠和完整路径。无效候选保留层级但不可提交。确认或双击写入一次，取消/Escape 不修改；弹窗内键盘操作与画布隔离，焦点循环并在关闭后返回触发控件。详见 [节点引用选择](node-reference-picker.md)。

引用实例的属性覆盖保留行/字段标记和右键还原、应用操作；属性行及字段不展示覆盖详情的长悬浮提示，源值与本地值差异通过“覆盖属性”双栏浮层查看。

删除或移出皮肤、删除成员、改变节点类型时，同一事务清除失效关系；删除成员保留空槽并在必要时清空选择。涉及锁定关联节点的关系改写不提交。旧无 skinNodeId 的控件保留低保真显示，可通过“建立默认部件”显式转换，保留根 ID、原布局、状态和已有子节点。实际实现与验收见 [原型复合控件](prototype-control-parts.md)。

底部添加菜单将页面根和控件分别以紧凑单列展示，正常宽 225px，保留中文名称、类名和图标；窄视口按可用宽度收缩，菜单按实际可用高度限位并在必要时内部滚动。最左侧“直选模式”使用带点击射线的鼠标指针（Lucide `MousePointerClick`）；按钮控件使用圆角矩形内带三点的 `RectangleEllipsis`；自由容器使用四块错落排列的线框布局图标 `LayoutDashboard`，包括添加到画布的 UIBox 入口。控件图标在底部快捷入口、添加菜单、图层树、层级导航及图层菜单保持一致。

底部工具条的选中按钮（包括直选模式、虚线框、添加工具及属性面板开关）使用主题主按钮亮色背景及对应前景色，悬停仍保留选中色，使开启状态与普通按钮清楚区分。

## Geometry

属性面板默认一个独立属性一行，最小值/最大值、描边宽度/圆角分别独占一行。普通输入、布尔属性、文字按钮、数值组合、滑块、padding 和容器对齐统一使用 60px 标签列及 7px 列间距，布尔属性为左标签、右复选框。坐标/尺寸/变换等轴分量、padding 四边、布局约束图、样式/对齐/语法等具有组合语义的控件保留成组呈现，窄面板按组换行。详见 [属性面板行与列统一](inspector-property-rows.md)。

布尔属性 label 仅占文字列、间距与复选框所需宽度，右侧空白点击不切换属性；文字、复选框点击与键盘空格继续使用原生激活语义，锁定保护保持有效。该规则同样适用于控件部件的选中状态和文字换行，语法组保留紧凑排列。详见 [复选框点击范围](inspector-checkbox-hit-area.md)。

UILabel 的文字区支持可选 `widget.leading/letterSpacing`（有限正负数，默认 0）、wordWrap、五种 overflow（visible/hidden/scroll/shrink/ellipsis）及 HTML/UBB/模板开关。保留已有原型缺省 wordWrap=true、overflow=hidden。语法按项目 UILabel 源码顺序处理：模板变量替换，再 UBB 转 HTML，再解析文本段；UBB 单独开启即解释 HTML。模板变量为 JSON 标量映射，null/缺省关闭；`{name=default}`、缺失值及反斜杠转义与目标一致。行距、字距、富文本换行和溢出共用目标纯排版算法；shrink/ellipsis 同时考虑宽高，scroll 通过 widget.scrollX/Y 静态偏移。普通文字可多行编辑，Enter 换行、失焦或 Ctrl/Cmd+Enter 一次提交、Escape 恢复。新增字段支持保存、历史与引用实例覆盖/还原。HTML 只生成受控绘制元素，链接不跳转，内联图片在资产路径解析接入前使用尺寸占位。详见 [UILabel 文字属性与语法](label-text-properties.md)。

所有支持子节点的控件，其属性面板“容器布局”分区默认展开，并允许手动收起；复合控件与普通容器采用相同默认状态。

- `shared/ui-layout.ts` 按父局部坐标解析显式尺寸、内容测量和双边拉伸，再组合 `shared/ui-transform.ts` 的仿射矩阵。local 是布局矩形，absolute 是页面空间包围盒，corners 为变换后的四角；父矩阵包含祖先变换与静态滚动。所有视图及编辑操作使用同一算法，计算结果不写盘。
- 六项约束使用 null/缺省关闭，0 有效；单位 absolute 或 percent，10 代表 10%。位置优先 center、leading、trailing、原位置；双边独立决定拉伸尺寸。约束位置四舍五入，尺寸和流布局位置保留小数；无约束旧坐标保留。
- 父内容区扣除四边 padding。HBox 禁止子节点水平约束，VBox 禁止垂直约束；交叉轴的显式约束优先于对齐。justify 均分空间并忽略 gap。Grid 按最大子项宽高确定格子、支持横/纵优先与 wrapCount。隐藏节点仍参与布局，负间隔合法但测量结果不得为负。
- HBox/VBox 子节点的可选 `layout.crossAxisMode` 缺省或 `aligned` 时，无约束交叉轴遵循父容器对齐；`explicit` 时使用当前局部 frame 坐标。取消最后一个交叉轴约束写入 `explicit` 并保留坐标，重新启用约束清除该覆盖。主轴始终自动排布。换父级、根粘贴或切换父容器布局类型时清除覆盖，以沿用新父级的排布规则。
- 可选 `layout.positionOffsetX/Y` 为父空间位置补偿，默认 0，在基础布局或诊断回退后相加，不参与尺寸测量和流式占位。用于保持锚点编辑前后的视觉位置及约束逆算的精度，属性面板不单独显示。后续几何编辑与约束切换扣除补偿再逆算，并保留取整残差；换父级、根粘贴或切换父排布时由固化的局部坐标吸收并清除旧补偿。
- 内容尺寸按子项计算，按轴检查父子测量依赖。非法约束、负拉伸和过大 padding 显示节点诊断，失败轴用原始 frame 回退，文档仍可编辑。
- 可选节点 transform 包含 anchorX/Y（0～1，缺省 0）、scaleX/Y（缺省 1）、skewX/Y 及 rotation（度，缺省 0）。沿用 Laya 的 X 轴 rotation+skewY、Y 轴 rotation-skewX；pivot=anchor×解算尺寸，x/y 为父空间锚点位置，子局部原点仍在左上角。允许有限负缩放及零缩放。约束按有符号缩放长度计算，并补偿 pivot；拉伸尺寸除以 scale，零用 .01 替代。HBox/VBox 使用有符号缩放占位，Grid 使用绝对占位并补镜像与锚点，旋转与倾斜不影响排布占位。
- 文字尺寸采用确定性的低保真估算；图片未接入引擎自然尺寸测量，内容模式沿用保存的 frame 尺寸。完整字体、九宫格和引擎测量须另行接入。
- 容器裁剪使用祖先变换后凸多边形的交集；panel 默认裁剪，list 工厂默认开启裁剪。scrollX/Y 表达静态预览偏移。DOM 使用解算矩阵和逆变换到局部的裁剪多边形，隐藏像素不响应画布选中。不可逆变换隐藏像素与尺寸手柄，可从树选择并修改属性恢复。
- 不跨调用缓存可变页面对象；单次画布渲染复用其解析结果，以兼容现有操作的原地坐标更新。

## Editing

底部工具条以默认关闭的“虚线框”开关替代选择/抓手两个按钮。开启时，为 `COMPONENTS.children=true` 的可见容器（含复合控件与旧矩形）显示虚线辅助边界，叶子不显示；辅助框沿用节点变换与裁剪，不接收指针、不改变节点样式或布局。按钮通过高亮和 aria-pressed 表示状态。开关独立于当前工具、选择与文档历史，切页/模式切换保留，刷新后关闭；选择 V、抓手 H 与空格临时平移继续可用。详见 [容器虚线框](container-outline-toggle.md)。

页面内维护独立于文档的容器编辑路径。默认关闭“直选模式”，画布单击把最深命中映射为当前层的直属子节点；当前容器自身背景、其他分支与画布空白取消选择。双击支持子节点的控件进入其子层（含空容器），文字/输入叶子双击仍聚焦文字属性。双击空白退一级并选中刚退出的容器；页根双击空白保持页内编辑。左上路径导航可进入任意祖先的子层，清空选择；图层树选择直接进入节点父层并选中节点，根选择返回页面层。相机不随层级跳转；退出/重进页面重置路径。结构编辑与撤销后跟随仍有效的选中节点父级，否则退至原路径最近的有效容器。详见 [画布编辑层级](canvas-editing-scope.md)。

底部工具条在虚线框之前提供“直选模式”开关，图标高亮和 aria-pressed 表示状态。开启时单击/双击使用实际命中的可见节点，可跨分支选择后代；容器背景可选自身，隐藏节点不可选，锁定保护保留。选择继续驱动父层路径、树定位、属性和选框；Ctrl/Cmd 可跨分支增减，Shift 只在目标父容器的可见直属节点中取范围。直选期间停用范围遮罩和前景提升，保持页面正常绘制和明暗；关闭恢复当前层规则。切换本身不改变选择、层级、工具、相机或内容历史；切页/模式切换保留，刷新关闭。总览仍选择整页，新增/粘贴仍遵循当前层。详见 [画布直选模式](canvas-direct-selection.md)。

树与画布共享会话选择集合、主节点及范围锚点。单击替换，Ctrl/Cmd 点击增减，Shift 选择锚点到目标的连续区间，Ctrl/Cmd+Shift 追加区间；重复 Shift 保留锚点。树范围只包含当前展开且搜索可见的行，画布范围按当前层直属节点绘制顺序；锚点不可见时选择目标。多选时以最近公共父容器作为编辑层，每个可见节点显示选框，属性面板显示数量和名称，不提供单节点属性字段或缩放手柄。点击已选节点可拖动整组，轻点收为单选；修饰点击不启动拖动。空白/Escape 清空选择，层级导航重置选择；结构编辑清理失效 ID，不恢复历史选择集合。详见 [节点多选](node-multiselection.md)。

多选的方向键、画布拖动、树排序/改父级、Delete/Backspace、复制/粘贴与生成副本以一次内容事务执行；选中父子时后代不重复处理，复制森林共用 ID 映射保留内部引用。涉及锁定根、移动时不可逆父空间或受 Slider 管理的部件位置时拒绝整组操作；流式容器保持重排语义。右键已选行保留集合，复制/副本/删除针对整组，多选时禁用重命名与类型转换；多选快捷键粘贴使用当前编辑层。

进入容器层时，40% 黑色半透明遮罩压暗点阵背景、页面与其他节点分支，当前容器和后代在遮罩上方保持原有绘制（含祖先透明度、变换与裁剪）。每层始终使用同一遮罩强度，不按深度叠加；切层更新目标子树，页根移除。遮罩不接收指针，不遮挡导航、树、属性及工具条。顶部预留 48px 给路径导航，跟随面板在该区域下方限位。

属性面板只呈现属性，不放图层顺序、上移/下移和复制/删除操作。选中控件或总览中的页面后 Ctrl+D（macOS Cmd+D）生成副本，Delete/Backspace 删除；页内空选时这些快捷键不操作整页。页面内 Ctrl/Cmd+C/V 复制/粘贴子树，空选粘贴进入当前层，选中时仍按容器子级/叶子同级确定位置。工具栏放置使用当前层，页面坐标经容器逆矩阵及滚动换算，锁定或不可逆父容器拒绝放置。图层树 F2 行内重命名。焦点位于输入字段时不触发节点快捷键。右键一级菜单集中编辑操作；新增与转换类型各用二级菜单承载 15 种控件，不再提供冗余的矩形选项。旧 rectangle 类型继续读写和渲染，新建列表的静态子项使用 panel。

原型画板也提供编辑器右键菜单：总览命中画板时可进入编辑、重命名、生成副本、删除和新建画板；总览空白只提供新建及适应画布。页内节点复用图层菜单及锁定/继承保护，遵循逐层或直选命中，右键已选成员保留多选。页内空白清空节点选择但保留当前层，粘贴/新增使用该层；菜单新增按右键页面坐标换算父变换和滚动，并保留同级插入顺序。菜单提供适应画布、返回上一级/总览，支持 Escape、外部点击及画布上的 Shift+F10/菜单键。关闭恢复画布焦点；重命名对话框支持 Enter/Escape、非空去空格提交及焦点循环。右键不放置、拖动或缩放，面板及工具条不会误触画布菜单。详见 [画板右键菜单](canvas-context-menu.md)。

位置、尺寸、锚点、缩放、倾斜、旋转，以及网格间距和滚动复用 NumericPropertyRow：左侧名称、右侧 1～2 个带轴前缀的数值框，支持独立禁用与范围、精度、Enter 提交、Escape 恢复和完整无障碍名称，适配 280px 属性面板。数值框聚焦全选，便于直接替换。属性面板不提供父容器下拉框，调整父子层级使用树拖动。

页面和控件的位置/尺寸组统一命名“基础属性”。控件在旋转下方通过 SliderPropertyRow 编辑不透明度：本地 shadcn/ui Radix 滑块配数字框，范围 0～1、步长 .01、最多两位小数且不补零。滑块拖动/点击/键盘实时同步数字及画布；数字沿用 Enter/失焦提交、Escape 恢复、越界钳制。锁定及继承锁定同时禁用两种输入。沿用 style.opacity、父子叠乘和现有样式事务/保存/撤销，不在外观组重复显示，也不增加页面根不透明度。

填充、描边、文字颜色和页面背景的原生取色器在一次操作内只产生一次文档编辑：连续 input 更新字段及画布的临时颜色预览，原生 change 结束取色并提交最终值，失焦/卸载兜底且不重复提交。开始前后颜色相同则不写历史；再次打开独立计次。一次 undo 恢复开始前颜色（包括 transparent），一次 redo 恢复最终色。预览覆盖绑定具体页面、节点和单个属性，不写入文档、保存数据或宿主队列；外部颜色更新及锁定清理过时草稿。颜色文本框仍在 Enter/失焦时独立提交。详见 [取色历史边界](color-picker-history.md)。

页面根的位置按编辑作用域显示：总览 X/Y 读写 page.frame 的无限画布摆放坐标；进入页面后根 X/Y 只读显示局部原点 0/0，子控件仍编辑父局部坐标。两种作用域的 W/H 都修改设计尺寸，按单键更新 page.frame，避免把局部原点覆盖到总览位置。作用域切换不写文档、不新增坐标字段或历史事务；页内根坐标禁止提交，尺寸编辑、保存重载和 undo/redo 保留总览摆放坐标。

属性顶部身份信息合并成一行，左侧为中文类型及括号类名（如 `横排容器(UIHBox)`），右侧为稳定 ID，去掉独立的“控件”字样；页面同样显示 `页面(UIStack)` 等类型与 ID。窄面板优先保留完整 ID，左侧超长时省略并提供完整提示。

控件显示名称的字段名为“名称”，其下“变量”编辑独立的可选 v2 `variableName`。变量使用便于 JS/TS 代码生成的 ASCII 标识符：以字母、`_` 或 `$` 开头，后续允许数字；禁用 ECMAScript/严格模式保留字、字面量及 `eval`/`arguments`。同页变量名区分大小写且不可重复，不同页面可相同。输入去除首尾空白，留空删除该字段；非法/重名草稿显示内联提示并阻止提交。Enter/失焦提交有效值，Escape 恢复已保存值；锁定节点禁用。名称、变量和 ID 相互独立，普通编辑、类型转换及身份迁移保留变量。复制/粘贴子树在目标页面给冲突变量追加 `2`、`3` 等后缀；复制整页保留变量名。旧节点不自动生成变量；页面属性不增加此字段。

图层树搜索只影响当前页树视图：名称、已保存的变量名、稳定 ID、中文/内部组件类型及 Laya 类名按去除首尾空白后的子串匹配，忽略大小写，隐藏/锁定节点也参与。变量缺省时仍按其他字段匹配，变量搜索不改变变量本身区分大小写的命名/唯一性规则。匹配节点及其祖先保留原顺序和缩进；搜索折叠状态与普通树分开维护，清空恢复原折叠状态。搜索不改变文档、历史或当前选择，搜索期间禁用树拖动，保留其他节点操作。输入框中的 Escape 仅清空搜索，不触发画布取消选择。

原型层级树进入页面时只显示直属节点，容器默认收起；普通视图仅记录显式展开 ID，新建/复制/粘贴的容器也默认收起。手动箭头可开合；画布定位内部节点只展开祖先路径，搜索独立展开匹配路径，清除恢复普通状态。主动新增子节点、粘贴或拖入时展开目标容器以显示结果。离开再进入/刷新恢复默认，不写文档或历史；属性面板分区的默认展开规则独立。详见 [层级树默认收起](layer-tree-default-collapse.md)。

图层树在节点名称旁以紧凑等宽字体标签显示已保存的变量名；无变量时不占位。名称/变量过长时在行内省略，完整名称可在属性面板查看，变量标签悬停可查看完整变量名。节点名称不显示拼接来源路径及操作说明的悬浮提示。变量编辑、清空和撤销/重做后标签随文档状态同步更新，点击变量标签同样选中节点。

原型图层树行的基础左留白为 8px，每级缩进 10px，普通树和搜索结果沿用同一缩进规则。行尾隐藏与锁定按钮紧邻排列，按钮之间不额外留白。

画布直接选中控件时，图层树展开该节点的全部祖先，并以最小纵向滚动让对应行完整可见；重复点击同一控件也会重新定位，已可见则不滚动。若当前搜索排除了目标，先清除搜索；目标仍在结果中则保留搜索并展开路径。定位只响应画布选中请求，不因普通重渲染、手动滚动或折叠持续追踪；不抢焦点、不改变画布视角或文档历史。缩放手柄和抓手平移不触发定位。画布有效 pointerdown 在提交原输入编辑后接管键盘焦点，聚焦不滚动，不增加 Tab 顺序入口；方向键微调时树行仅保留选中背景。键盘通过 Tab 访问树按钮仍显示原焦点提示。详见 [画布键盘焦点修复](canvas-keyboard-focus.md)。

直接从树用鼠标选择也阻止名称按钮的默认取焦，并聚焦无外框的树面板，选择后可直接方向键移动、Delete/Backspace 删除。修饰选择仅在 pointerdown 处理一次，click 不再次切换集合；鼠标打开菜单关闭后回到树面板，键盘菜单保留原按钮焦点。输入字段继续使用自己的键盘编辑行为。

节点复制捕获独立子树快照，剪贴板仅限当前编辑会话，可跨页粘贴。粘贴目标与新增一致；根节点使用复制时解算的局部 frame 加 16px 偏移，清除六项旧父约束并固化尺寸，子节点保持局部数据，全部身份重新分配。空剪贴板和锁定目标禁用粘贴。重命名提交去除首尾空白的非空名称，Enter/失焦提交、Escape 取消。类型转换保留 ID、名称、层级、样式、内容及子节点，复用容器切换的约束规范化；仅在缺省时补上目标文字/widget 默认值。有子节点不能转为叶子类型，存在锁定直属子节点时也不能转换。单个普通 UIBox 可“存到画布”；引用节点提供“编辑源组件”，可展开并添加本地子节点；继承节点的结构和类型受保护。

控件属性面板的六项约束用 checkbox 和方位示意图表达。勾选/取消时从当前解算几何换算同轴全部有效偏移，保持位置与尺寸；取消的字段写 null，最后一个约束取消后保留当前局部坐标，解除双边拉伸后固化当前尺寸为显式尺寸。父容器内容区与 Padding、像素/百分比单位都参与换算；自动排布管理的轴和锁定节点禁用。只为启用项显示数值偏移输入：上/垂直居中/下位于图示右侧，左/水平居中/右位于图示下方，输入框中心对齐对应引导线并使用固定方向槽位；保留完整无障碍名称和悬停说明。正常 280px 面板完整显示，过窄时图示局部横向滚动。“尺寸来源”通过 ReadOnlyPropertyRow 显示并排 W/H 两个只读框，保留宽度来源/高度来源无障碍名称；行标签 48px、控件高 25px，约束单位使用同样的列宽/高度并与输入左边缘对齐，行距 8px。该紧凑样式不影响其他下拉框。“内边距”使用 U/R、D/L 两行紧凑数字框，裁剪开关标为“裁剪内容”。流式容器对齐使用水平/垂直图标组；两端分布仅出现在 HBox 水平轴和 VBox 垂直轴。

位置、尺寸、六项约束偏移、Padding、间距与静态滚动数值使用整数显示，直接输入提交时四舍五入；节点/页面拖动、缩放和方向键编辑的变化坐标/尺寸取整。图示、单位和逆向偏移换算保留必要内部精度，以保持百分比定位与布局几何；旧文档不批量重写，未修改的输入失焦不将内部精度覆盖为显示整数。布局解算仍允许自动排布及旧文档产生的小数几何。

锚点、缩放、倾斜与旋转最多显示两位小数，不补尾零（0、1、0.5、1.25）；步长 .01，直接提交最多保留两位。矩阵及自动换算保留内部精度，未编辑的输入失焦不覆盖原精度。编辑锚点通过 `setNodeAnchor` 将 pivot 的变化经节点线性矩阵换算为父空间坐标补偿，使节点、后代及兄弟的视觉位置/尺寸不变；自由轴写 frame，布局/测量管理的轴写 positionOffset。解算 X/Y 与空心圆更新，锚点与坐标在同一事务保存和撤销。底层文档直接设置锚点仍遵循 Laya 语义。空心圆无填充，保持屏幕像素大小，不随缩放/倾斜变形。选框沿变换后四边，用 outline 避免边框推偏手柄中心；锚点与重合的矩形手柄中心一致。拖动经父矩阵逆变换，尺寸手柄经节点逆矩阵换算局部尺寸并保持对边，直接操作仍遵循整数几何规则，可能有取整偏差；锚点补偿保留精度，不走整数取整。不提供鼠标旋转手柄。

自由节点拖动写 x/y；有约束时写对应偏移，拉伸缩放更新边距。主轴拖动重排兄弟，主轴方向键逐项排序；交叉轴有约束时更新约束，显式交叉轴更新局部 frame。切换布局清除新排布禁止的约束，并固化原拉伸尺寸。锁定节点不可直接编辑。

换父级先解析视觉矩阵与局部尺寸，移除旧约束，固化尺寸；自由父级通过相对仿射矩阵分解保持视觉形状（含滚动），必要时写 skewX，流式父级遵循新顺序。不可逆目标父级拒绝移动且不改变兄弟顺序。子树复制深拷贝 layout/widget/transform，生成新 ID 并重写内部 parentId。所有变化继续经过宿主文档事务及 undo/redo。

## Persistence and Sample

新文件使用 schemaVersion 5；v1/v2/v3/v4 读取和无编辑往返保留原字段/版本/ID，首次有效编辑在同一事务升级到 v5，可撤销。可选 page.rootType 接收 UIStack/UITop/UIScene/UIBox，缺省按 UIStack 显示但不在解析时补写字段。v1 不接收 rootType、新增节点类型及 layout/widget/variableName/transform；v2 校验新增字段和取值。transform 缺省值不在读取时补写，未知字段、非有限数值和越界 anchor 在 codec/协议边界拒绝。变量语法、保留字及版本限制在 JSON Schema 与共享校验中保持一致；共享校验额外拒绝同页变量重名，包含两个字段位置。变量与变换通过现有宿主事务保存及撤销；画布组件源目录使用独立消息，不进入文档事务。

页面根 layout 同样仅限 v2：六项约束接受有限数字或 null，单位 absolute/percent；拒绝其他字段及错误对象/类型。JSON Schema 与共享验证约束一致，旧页面读取不补写布局默认值。

页面根与所有控件在整份文档内共享唯一 ID 空间，包括独立 UIBox 画板。v1/v2 均在共享运行时校验中拒绝跨页面、根与控件、同页控件重号，错误包含 ID 和两个位置；解析/序列化/协议校验不自动分配或修复歧义身份，名字相同不构成冲突。新身份采用 8 位小写字母/数字 Nano ID，首位允许数字。未带 `elementIdScheme: "nanoid-8"` 的旧文档首次进入编辑会话时，独立迁移事务统一重分配页面/控件 ID、更新引用并记录标记；v1 在同一事务升级，可撤销。迁移完成后普通编辑及保存保持 ID，详见 [nanoid-element-ids.md](nanoid-element-ids.md)。

`sample/ui-components.gameflow.json` 包含自适应背包和游戏设置；浏览器 `?sample=ui-components` 使用独立 localStorage key，避免覆盖原有预览文档。PSD 切图绑定与装载见运行预览规格，当前页面可生成并绑定原型 PSD、选择美术 PSD 并导出 Prefab。页面独立保存 PSD 相对路径及身份，切换美术模式无需打开该 PSD 工作区。

## Reusable Canvas Components

`page.componentRootId` identifies an extracted UIBox definition root. Save-to-canvas accepts only one unlocked ordinary UIBox with positive resolved dimensions; contained nodes may have any supported type. It clones and remaps the subtree into a transparent board to the right, normalizes definition-root placement and leaves one linked instance retaining the original ID, affine placement and constraints. Cross-boundary skin/radio references block extraction. The operation is one undoable edit and preserves the camera. New/pasted content defaults inside the definition root; its root type cannot be converted, and moving children cannot create root siblings. Root duplication creates content inside the existing root; whole-board duplication remaps componentRootId. Deleting a definition/root leaves references visibly invalid.

Instances retain `prefab: { source, documentId, pageId }`, type container, independent explicit/constrained dimensions, placement transform, identity, visibility/lock and optional opacity. In v5, `instanceEdits.overrides` stores target + field-level set/unset; `additions` stores full owned nodes with scoped parent/before anchors and optional scoped control references. Source roots alias the instance root. Unmodified properties follow the source, while explicit false/0/null/empty values and unset remain local until reverted. Temporary display IDs never become serialized targets. Any legal canvas root can be referenced; applying synthetic-root properties requires an actual writable component root, otherwise the UI reports why the mapping is unavailable.

Layers, canvas, breadcrumbs and Inspector share the composed tree. Inherited nodes use theme-aware reference colors, reference boundaries have a package icon, locally overridden nodes have a dot, and current-layer additions overlay a small “+” on their type icon. Ordinary additions retain ordinary color. Source-owned additions in an outer instance are inherited, without a current-layer plus. Color and accessible names convey separate source/override/addition states; authored artwork colors are unchanged.

Property rows and actual changed fields show local markers with local/source values and source location. Right-click and Shift+F10 provide property/group/node revert/apply, with explicit coupled geometry/range fields. Bulk apply lists targets, paths and proposed values. Revert deletes only the selected current-layer overrides and exposes the latest source; additions and native instance placement remain. Apply writes the direct source definition, including its nested instance layer or real additions, and cleans only promoted overrides. Bindings to current-instance-only additions cannot be promoted. Read-only/missing/stale sources retain all local data. Default browser menus are suppressed throughout layer/Inspector panels while their editor menus remain available.

The Inspector reference header is one compact row: linked source name, Edit and Override Properties. A thin theme-colored divider below the reference section separates it from ordinary name/variable properties. Source paths and ownership details use tooltips; source errors retain a compact indicator. Override Properties opens a two-column panel by default: modified nodes with node/all checkboxes on the left, the active node's property checkboxes and source-to-local values on the right. Choices persist across node navigation, initially select all, and expose coupled geometry/range fields together. Revert Selected and Apply Selected act on the exact checked target/field list in one transaction, preserving unchecked overrides and all additions. Zero selection disables both actions; no overrides shows an empty state. The panel already reviews the source and differences, so applying from it does not repeat the same review in another dialog. Field context menus retain their existing review behavior. The panel stays inside the viewport and preserves both columns in narrow windows.

Inherited deletion/cut/type/reparent/order changes are rejected for every normal edit transaction; mixed protected selections reject atomically. Owned instances and local additions can be deleted. Local additions support ordinary content editing, same-owner movement/order, copying and eligible UIBox extraction. Ordinary subtrees moved into an instance become owned additions. Cross-instance moves remain rejected. Sibling before anchors retain source order; invalid anchors diagnose and temporarily append, missing parents retain recoverable subtrees in a repair group with reattach/copy/delete actions and cycle prevention.

Variables use one scope per reference boundary: the root belongs to its parent scope, descendants/additions to their containing instance. Skin/radio bindings resolve through scoped targets and retain direct-child/type/membership rules. Whole-instance copies preserve linkage and rekey owned additions; inherited ordinary copies are snapshots, retaining nested reference boundaries. Source rename/reparent retains stable addresses; missing/replaced identities never match by name.

`sample/canvas-reference-demo.gameflow.json` remains a v4 compatibility fixture. `sample/canvas-instance-demo.gameflow.json` demonstrates cross-file A/B inheritance, A's local text and a local close button; `sample/canvas-instance-local-demo.gameflow.json` includes the source board for same-file apply. Browser queries `?sample=canvas-instances` and `?sample=canvas-instances-local` use separate storage. See [canvas-instance-editing.md](canvas-instance-editing.md) for validation and native-host history coverage.

## 图片资源模式与交付

- UIBox 只处理结构、布局、裁剪、显隐和变换，不再绘制 fill、border、radius。自由容器的“外观 / 添加背景图片”每次添加一个普通 UIImage 子节点；流式容器的底图作为普通外部图片单独安排，不引入专用背景角色。旧样式字段可读写，但不用于外观绘制。
- 图片槽位沿用普通属性的标签列，使用 27px 高的紧凑资源框，内含小缩略图、资源名、右端选择图标和框内清空入口；窄面板内保持选择图标可见，长名称省略。未设置图片时统一显示“无 (Image)”，不绘制左侧占位图标，保留右端选择图标。该选择器只在原型模式出现。美术 PSD 与预制体模式使用只读字段显示 PSD 切图的实际导出名，完整相对路径作为悬停提示。
- UIImage 使用 `image: ImageSlot | null`；UIButton 使用独立 `normalSkin`、`selectedSkin`、`disabledSkin`。ImageSlot 分别记录内置 ID 和可选 PSD art 引用；显式 null 表示留空。新按钮只填 normal，状态优先级 disabled > selected > normal，未配置可选态回退 normal，已配置但坏掉的图片报错。
- 底部及运行预览提供原型 / 美术 PSD / 预制体三个资源模式。底部工具栏按直选、虚线框、资源模式组、添加菜单、常用控件、更多菜单排列，末尾“更多”向上展开“生成 PSD”“绑定 PSD”（已有绑定时为重新绑定），右上角只保留 Prefab 导出；只有编辑页面或在总览明确选中页面时可操作，未选择时菜单两项置灰，不默认使用首个页面，处理中禁用。资源模式组位于添加入口左侧；底部不提供属性面板显隐按钮。初始原型，仅使用内置资源；美术模式使用该页面明确绑定的 PSD 内存切图（已绑定页面中未配置美术的槽位使用内置）；美术及预制体模式下，页面尚未绑定时，在画板内显示“生成 PSD”“绑定 PSD”入口；加载中或失败时显示页面级状态和恢复入口；预制体模式只装载磁盘资源。模式是会话状态，不写入原型，不改变导出来源规则。
- 实际切换原型 / 美术 PSD / 预制体时清空节点单选、多选及拖拽预览，关闭节点上下文菜单；保持当前页面、页内编辑位置、相机和层级位置。运行预览同步清空节点检查与原图对照，保留临时控件状态。点击当前激活模式只刷新资源并保留选择，操作不写入文档。详见 [资源模式切换选择](resource-mode-selection.md)。
- 内置默认图片 image/default 按灰白背景 #e3e7ec 铺满控件，图片图标 #657385 居中等比绘制；图标最大宽度 32 个设计像素，宽高各不超过控件的一半，小图缩小、大图不放大。仅实际使用该内置图时采用此规则；美术资源沿用普通图片填充。画布、运行预览及 PSD 共用绘制器；Prefab 依照实际导出资源解算尺寸生成独立 PNG，同尺寸复用、不同尺寸共存，水平进度皮肤按完整宽度生成。预制体模式读取实际导出 PNG，缺失时报错；临时尺寸预览继续使用设计尺寸对应的导出来源。改变设计布局后重新导出；Laya 对导出 PNG 的后续运行时缩放仍遵循 UIImage 原有行为。详见 [默认图片绘制](default-image-rendering.md)。
- 内置库包含 69 张真实 PNG：按钮、填充/描边色块与圆形、默认图片、28 个图标、单选/复选部件、滑块和两种进度部件。选择面板保留按钮 / 色块 / 圆形 / 图标 / 单选/复选五类，沿用现有弹窗主题并固定为 600×520px（小窗口限制在视口内）；分类切换及搜索不改变弹窗尺寸，仅资源网格滚动。纯色色块与描边色块默认上下左右 6px 九宫格。内置按钮采用无高光的纯色填充与描边，保留圆角和九宫格。
- Radio/Checkbox 保留底框与选中标记图片，`skinNodeId` 控制标记；UILabel 独立。Slider 轨道和滑块是图片。ProgressBar 的 `widget.mode` 为 horizontal/circular，`skinNodeId` 为不带相对约束的直接 UIImage 子节点，横向按比例改变宽度，圆形保持整图并按顺时针扇区绘制；模式、数值及引用均持久化。
- ComboBox 可通过 `widget.textLabelNodeId` 引用直接 UILabel 子节点显示选项；背景与箭头普通图片手动添加。UITextInput 独立创建，不自动包装。图片槽位、进度模式和文本引用均支持实例覆盖、复制重映射、保存及撤销。
- 生成原型 PSD 时按钮是组，状态图片分别叫 @normal / @selected / @disabled，UILabel 是独立文字层。图层元数据保留原型文档/页面/节点/槽位身份；页面按同名控件组及直接子层标记匹配槽位，同名 UIImage 切图或同名组下的 @image 对应图片。旧 PSD 可沿用内嵌身份。详见[页面 PSD 图层约定](page-psd-layer-conventions.md)。生成成功即绑定该页面；绑定与槽位关联进入同一撤销事务。简单正常混合的状态分组可合成切图，效果、蒙版和特殊混合继续报不支持。
- Prefab 导出按槽位优先采用绑定美术，无绑定时采用内置；与当前显示模式无关。导出包含 `.lh`、PNG、PNG.meta 的九宫格/导入 UUID 及 image-files.meta.json。已存在的有效导入 UUID 保留。写入前校验两目录，失败恢复本次文件写入；原生切图与 Prefab 导出共用目录锁。
- 失效引用触发“有资源缺失，是否继续导出？”，列出节点/槽位/路径，允许取消或仍然导出。继续保留坏引用并跳过坏图片，空槽位与未配置可选态不误报。预制体模式使用原型结构装载磁盘图，并不检查实际 `.lh` 层级。

GameFlow 打开/恢复均先显示原型画布。打开 PSD 切图只进入切图工作区；恢复和重新装载 PSD 数据不切换工作区。切图会话不代表页面关联，不新增或改写 artPsd，不自动保存 GameFlow；仅页面显式“绑定 PSD”或“生成 PSD”建立可撤销关联，随后按正常流程保存。示例与生成脚本默认未绑定。

页面可选 `artPsd: { source, documentId }` 属于 v5 可选字段；source 相对 GameFlow 目录，允许父目录路径，不接收绝对路径。原生保存重开按绑定自动加载，另存为重算相对路径；多页切图按各自文件隔离，即使导出路径相同也分别预览。浏览器仅缓存当前会话选择的文件，刷新后提示重新绑定。详见 [页面级 PSD 绑定](page-psd-binding.md)。

生成页面 PSD 时，内置图层记录素材 ID、尺寸和像素指纹。切图时对比实际像素、内置资源版本与切图几何。相符时引用同一内置 PNG，变更的图层按 PSD 导出规则处理。缺少指纹的旧 PSD 继续按美术切图处理。详见 [PSD 内置图识别](psd-builtin-slices.md) 与 [资源模式](prototype-art-prefab-resource-modes.md)。

选中页面后，顶栏「导出 Prefab」首次生成并记录共同版本。目标已存在时打开预制体同步窗，已关联页面显示「同步预制体」。按稳定身份比较当前工作副本与真实 `.lh`，支持结构、文案与自由布局基本几何逐项采纳。预制体专属组件可定位查看，保留目标节点上原有的脚本及资源引用。[预制体同步](page-prefab-sync.md)
