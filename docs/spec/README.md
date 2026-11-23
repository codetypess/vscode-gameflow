# Spec Index

## Purpose

`docs/spec/` is the repository's Specification-Driven Development entrypoint. It contains two kinds of documents:

- Numbered files: long-lived baseline specs that describe what the system should remain
- Non-numbered kebab-case files: work-item specs that describe one concrete change and how it will be verified

The complete workflow is defined in [../spec-driven-development.md](../spec-driven-development.md).

## Current Baseline

The repository now includes a runnable VS Code extension scaffold, a game UI prototype editor, PSD slice/nine-grid configuration, PNG/provenance export, three image resource modes, prototype PSD generation and current-page Prefab export. The baseline records document authority, the host/Webview boundary, canvas and layer editing, PSD metadata output and VS Code-themed controls; Agent integration, automatic planning-document analysis, complete PSD merging and full target-engine integration remain future work.

When the first non-trivial work item establishes a lasting rule, create the smallest relevant numbered baseline spec and add it to the baseline map below. Suggested numbers are conventions, not requirements:

| Number | Typical subject |
| --- | --- |
| `01` | Product scope and non-goals |
| `02` | Acceptance scenarios |
| `10` | Architecture and ownership boundaries |
| `11+` | Domain model, runtime, protocol, persistence, or editor semantics |
| `90` | Long-lived implementation constraints or sequencing |

## Baseline Map

| Spec | Subject |
| --- | --- |
| [01-product-workspace.md](01-product-workspace.md) | Planning workspace, infinite canvas, page groups and editing scope |
| [10-extension-architecture.md](10-extension-architecture.md) | Extension host, Webview, shared contracts, document authority and evolution boundary |
| [11-prototype-ui-layout.md](11-prototype-ui-layout.md) | Prototype UI components, shared layout geometry, control references and v1/v2/v3/v4/v5 persistence |
| [12-internal-extension-distribution.md](12-internal-extension-distribution.md) | Internal VSIX publication, signed catalogs and standalone updater |

## Active Work Items

- [canvas-prefab-action.md](canvas-prefab-action.md) — Done：移除独立运行预览，Prefab 同步/导出改为画布底部“更多”左侧的状态图标；376 项共享测试、生产构建及三组 Edge 回归通过。

- [workbench-dialog-layout.md](workbench-dialog-layout.md) — 工作台弹窗统一采用页面属性的布局与主题。

- [laya-export-metadata.md](laya-export-metadata.md) — 生成预制体和切图时，按字段合并 Laya UUID 与九宫格。

- [psd-builtin-slices.md](psd-builtin-slices.md) — PSD 切图按图层像素识别并复用内置图片。

- [page-prefab-sync.md](page-prefab-sync.md) — Done。原型与实际 Laya 预制体按稳定属性路径双向审阅页面尺寸、结构、几何、变换、布局、文字和控件字段，双方缺省值按各自运行时语义归一，双画板共用原型尺度；保留脚本和引擎字段。378 项共享测试、Edge 及 Laya 运行时加载验证通过。

- [page-psd-sync.md](page-psd-sync.md) — Verifying。原型使用内置资源，仅同步文字和控件结构。完整节点树与双侧预览标示新增、删除和修改，支持逐项预演。

- [inspector-checkbox-hit-area.md](inspector-checkbox-hit-area.md) — Done：收窄属性面板布尔 label 的点击范围，避免点击右侧空白误切换 checkbox；旧样式复现及修复后 Edge 交互/锁定/历史/窄窗口回归、368 项共享测试与生产构建通过。

- [page-psd-layer-conventions.md](page-psd-layer-conventions.md) — Done：PSD 变量与只读导出名拆行，统一图集/变量命名、状态继承与灰色只读展示；368 项共享测试、VS Code 宿主、两项 Edge 回归及生产构建通过。

- [page-psd-binding.md](page-psd-binding.md) — Done：页面独立保存 PSD 文件关联；美术模式未绑定入口、生成即绑定、后台装载、多页文件资源隔离和保存重开完成。358 项共享测试、46 项原生宿主检查、新增页面浏览器/7 项像素及既有 14 组浏览器回归、生产构建通过。

- [internal-extension-updates.md](internal-extension-updates.md) — Verifying：vsix.bitserver.wang 的分发容器、签名目录、发布工具和更新器已部署；333 项原测试、10 项分发测试及 Windows 真机插件/更新器自身升级通过；等待主机 Nginx 的 sudo reload 完成域名入口验收。

- [prototype-art-prefab-resource-modes.md](prototype-art-prefab-resource-modes.md) — Verifying：三种资源模式、69 张内置 PNG、UIButton 三态、控件图片部件、横向/圆形进度、PSD 生成/稳定关联和 Prefab 输出已实现，示例已直接更新；350 项共享测试、14 组浏览器、41 项 PSD/资源宿主、6 项实例宿主检查及生产构建通过。真实 Laya 工程和 Photoshop 往返待验收，复杂 PSD 变换与 imageFit 的目标映射边界已记录。

- [psd-atlas-name.md](psd-atlas-name.md) — Done：文件级图集名默认仅作 placeholder，小写/下划线/拼音首字母统一用于输入、旧配置回读与导出；普通/共享资源统一包含图集名，变量与导出名分行（见 page-psd-layer-conventions）；自定义值进入配置/草稿/PSD 副本/历史并刷新运行预览。322 项共享测试、生产构建、真实 PSD 中英文输入/下划线/跨图层/清空及此前窄窗口验收通过。

- [psd-slice-region.md](psd-slice-region.md) — Done：独立导出尺寸、拖动图片/四边线、方向键微调、滚轮缩放、居中/透明留白/裁剪、九宫格区域适配及配置持久化；313 项共享测试、3 项既有浏览器像素检查、生产构建及真实 PSD/360px 窄窗口/草稿重载验收通过；输入框对齐、外侧聚焦框及方向文字移除，弹窗标题栏普通指针拖动与右下角缩放完成。

- [file-export-directory.md](file-export-directory.md) — Done：本机资源/预制体根目录与 GameFlow 顶层 exportDirectory 分离；设置面板按文件编辑相对目录，图片现按资源根下 shared/unclassified/独立图集目录分类输出，exportDirectory 保留供预制体使用，见 psd-independent-directory。历史 293 项共享测试、33 项宿主检查及浏览器设置验收通过；最新分类规则通过 333 项测试、39 项宿主检查及生产构建。

- [page-export-name.md](page-export-name.md) — Done：页面名称下方新增独立“导出名称”，保存可选页面元数据，供后续 Prefab 生成使用；283 项测试、生产构建及浏览器提交/取消/历史/清空/保存重载验收通过。

- [inspector-property-rows.md](inspector-property-rows.md) — Done：普通属性一行一个，范围及外观属性拆行，标签列/操作区统一对齐，组合控件保留分组；280 项测试、生产构建及普通/窄窗口浏览器验收通过。

- [workbench-toolbar-settings.md](workbench-toolbar-settings.md) — Done：PSD 操作集中顶栏，独立“导出”按钮及工作台设置面板；资源/预制体目录保存在本机 workspaceState，沿用旧目录并在下次导出使用新设置。280 项共享测试、生产构建、29 项真实宿主检查及浏览器真实 PSD/模式切换/520px 窄窗口验收通过。Prefab 导出未接通。

- [psd-in-workbench.md](psd-in-workbench.md) — Verifying：PSD 在当前工作台内打开，聚合原型与 PSD 的原生保存/历史/关闭保护/恢复。10 项真实工作台检查通过，基线同步完成；原生 × 对话框逐按钮点击仍待人工验收。

- [label-text-properties.md](label-text-properties.md) — Done：UILabel 行距、字距、换行、五种溢出、HTML/UBB/模板及多行编辑；目标源码算法适配，保存、历史和实例覆盖联通，277 项测试、生产构建及浏览器交互验收通过，内联图片资产暂为占位。

- [f5-extension-host-startup.md](f5-extension-host-startup.md) — Done。定位到 Node inspector 启动时的网络跟踪断言，工作区关闭实验性调试网络视图。6 次真实调试均命中断点并恢复未保存画布。

- [psd-document-lifecycle.md](psd-document-lifecycle.md) — Verifying：PSD 原生 dirty/save/history/backup、同目录配置自动读取与草稿恢复；独立标签作为工作台默认入口的规则已被 psd-in-workbench 替代，Explorer 可选编辑器保留。关闭对话框逐按钮人工验收待完成。

- [canvas-context-menu.md](canvas-context-menu.md) — Done：总览画板/空白、页内节点/当前层空白右键菜单，复用图层命令及保护；含右键位置新增、重命名对话框和键盘菜单。244 项测试、生产构建及总览/页内/多选/保护/窄窗口浏览器验收通过。

- [psd-export-names.md](psd-export-names.md) — Done：变量与只读导出名称拆行，统一 `{图集名}_{变量名}`，共享也保留图集，不自动添加 btn/img；详见 [page-psd-layer-conventions.md](page-psd-layer-conventions.md)。保留冲突检测、分类目录和来源清单。

- [canvas-instance-editing.md](canvas-instance-editing.md) — Done：v5 引用实例展开、局部覆盖/附加节点、专色与“+”标记、属性右键还原/应用到源及继承结构保护；引用区简化为单行，覆盖属性默认双栏，支持跨节点逐字段勾选还原/应用。261 项回归、生产构建、浏览器交互及真实 VS Code 跨文件关联撤销/保存验收通过，保留 v1–v4 读取。

- [workspace-mode-icons.md](workspace-mode-icons.md) — Done：恢复原有三模式纯图标和紧凑按钮，移除整组外层框，保留当前模式高亮；生产构建、模式切换及宽/窄窗口浏览器检查通过。

- [canvas-component-references.md](canvas-component-references.md) — Done：UIBox 存到画布并保留关联实例、同文件及跨模块画布引用、源更新和失效诊断；200 项测试、生产构建、宿主适配器文件监听测试和浏览器保存刷新验收通过，真实 Extension Host 人工联调未覆盖。

- [runtime-slice-preview.md](runtime-slice-preview.md) — Done：真实内存切图、持久资源绑定、磁盘来源验证及共享布局/绘制已落地；独立运行预览和临时控件状态后来由 canvas-prefab-action 移除，画布资源模式继续消费这些能力。

- [nine-grid-export-product.md](nine-grid-export-product.md) — Done：无损缩减九宫格中段；预览和导出共用最终纹理尺寸及边距，独立保留布局原尺寸。共享、宿主、浏览器像素及生产构建验证通过。

- [canvas-direct-selection.md](canvas-direct-selection.md) — Done：底部新增默认关闭的直选模式，可直接选择子节点并跨分支多选；180 项测试、生产构建和浏览器选择/拖动/会话验收通过。

- [canvas-zoom-top-left.md](canvas-zoom-top-left.md) — Done：原型缩放条移至画布左上，与层级导航同一行、等高 34px，跟随面板避让；177 项测试、生产构建及总览/页内/窄窗口浏览器验收通过。

- [webview-full-bleed.md](webview-full-bleed.md) — Implementing：清除 VS Code Webview 默认左右内边距，让工作台铺满编辑器内容区。

- [inspector-overlay-scrollbar.md](inspector-overlay-scrollbar.md) — Done：属性面板滚动条覆盖显示、停止后自动隐藏；字段宽度稳定，滚动交互、窄窗口、177 项测试及构建通过。

- [star-sea-login-sample.md](star-sea-login-sample.md) — Done：按最新变量/图集命名与 @image/@normal 约定重建原型、PSD、配置、映射、预览和 ZIP；368 项测试、浏览器及真实宿主检查与生产构建通过，像素保持一致。

- [psd-file-drop.md](psd-file-drop.md) — Verifying：PSD 切图和合并来源 A/B 拖入入口已接入；177 项测试、生产构建及浏览器读取/保护回归通过，操作系统文件拖入手势待实测。

- [layer-tree-default-collapse.md](layer-tree-default-collapse.md) — Done：层级树容器默认收起，保留搜索与选中定位；175 项测试、生产构建及新建/复制/搜索/定位浏览器验收通过。

- [page-insert-camera.md](page-insert-camera.md) — Done：新增界面保持当前视角，页内新增补偿坐标原点；175 项测试、生产构建及四种根类型/历史/导航浏览器回归通过。

- [text-formatting-controls.md](text-formatting-controls.md) — Done：紧凑 B/I/U/S 样式开关、移除字重下拉框及六项对齐；175 项测试、生产构建与浏览器样式/历史/保存刷新/锁定验收通过。

- [color-picker-history.md](color-picker-history.md) — Verifying：连续取色实时预览、结束一次提交；173 项测试、生产构建及浏览器颜色输入/撤销/重做通过，原生弹窗连续拖动待人工验收。

- [container-outline-toggle.md](container-outline-toggle.md) — Done：以默认关闭的“虚线框”开关替代选择/抓手按钮；容器辅助边界、166 项测试、生产构建及浏览器交互验收通过。

- [node-multiselection.md](node-multiselection.md) — Done：树选中后的键盘焦点修复、Ctrl/Shift 多选及整组编辑；167 项测试、构建和浏览器交互验收通过。

- [radio-option-row-actions.md](radio-option-row-actions.md) — Done：移除成员上下移入口，删除按钮放序号前并悬停显示；构建、显隐/键盘/删除撤销浏览器验收通过。

- [canvas-editing-scope.md](canvas-editing-scope.md) — Done：画布逐层选择、双击钻入/返回、路径导航、图层树直达及背景遮罩；154 项测试、生产构建与浏览器交互验收通过。

- [canvas-keyboard-focus.md](canvas-keyboard-focus.md) — Done：画布点击接管键盘焦点，修复方向键操作时旧树行出现焦点框；构建与浏览器交互回归通过。

- [node-reference-picker.md](node-reference-picker.md) — Done：节点引用树形弹窗、绑定上下文及 Delete / Backspace 清空引用；146 项测试、构建和浏览器交互验收通过。

- [prototype-control-parts.md](prototype-control-parts.md) — Done：UIButton 可选文案、Slider/CheckBox/Radio 显式部件、RadioGroup 成员引用及 v3 持久化；140 项测试、类型检查、生产构建及浏览器交互/保存刷新验收通过。
- [prototype-layaui-prefab-psd.md](prototype-layaui-prefab-psd.md) — Draft：原型布局与 LayaUI 对齐、新建/增量更新已有 Prefab、字段管理与冲突协调、PSD 导出/关联对照及美术回流；未替代当前实现基线。
- [laya-control-asset-bindings.md](laya-control-asset-bindings.md) — Draft：按当前 xq-client 节点皮肤契约设计 Slider/CheckBox/Radio 部件、RadioGroup 引用，以及原型、PSD 切图与 Prefab 的资产绑定闭环。
- [psd-three-way-merge.md](psd-three-way-merge.md) — Draft：左侧两份 PSD 的图层树/预览、右侧合并结果；共同基础版本、逐节点采用、PSD 依赖和结果输出。

The completed [psd-independent-directory.md](psd-independent-directory.md) defines root-level shared/unclassified/atlas routing, reserved names, a path-based v2 root ledger, transactional writes and legacy reads. [psd-inspector-sections.md](psd-inspector-sections.md) shows document settings for the PSD selection and slice properties for a layer selection and shares prototype top alignment and overlay scrolling across properties and both layer trees. These changes passed 333 shared tests, production build, 39 native host checks and real PSD/prototype browser checks. [psd-layer-tree-density.md](psd-layer-tree-density.md) and [psd-zoom-top-left.md](psd-zoom-top-left.md) record the compact shared marker and top-left zoom controls; lasting rules are incorporated in the baselines.

The completed [workspace-modes-psd-slicing.md](workspace-modes-psd-slicing.md) records three compact icon modes, real PSD import, slice/nine-grid configuration, same-name sidecars, metadata-only PSD copies and manual selection preview trees. Build, 35 shared tests, browser interactions and independent PSD output parsing passed. Extension Host/Photoshop validation and full merge/export delivery remain separate follow-ups.

The completed [prototype-ui-layout.md](prototype-ui-layout.md) adds 16 prototype components, shared LayaUI constraint/container layout, flow reorder and constraint-aware editing, plus v2 persistence preserving existing v1 identities. Build, 64 tests and browser editing checks passed; engine rendering, runtime binding and Prefab export remain follow-ups.

The completed [prototype-following-panels.md](prototype-following-panels.md) anchors prototype layer/properties panels to page edges using the shared PSD placement algorithm. It follows pan/zoom, clamps within the viewport and clears measured bottom controls. Build, 66 tests and browser pan/zoom, collapse, mode-switch, overview and narrow-window checks passed.

The completed [page-root-types.md](page-root-types.md) adds UIStack/UITop/UIScene page roots, standalone UIBox boards, editable root identity and component class labels. [prototype-panel-top-alignment.md](prototype-panel-top-alignment.md) sets prototype layer/properties widths to 280px each with content-top alignment and a 400px available-height threshold, plus compact visibility/lock spacing; the later adjustments passed 95 tests, build and browser checks. [prototype-layout-controls.md](prototype-layout-controls.md) adds checkbox constraint diagrams, read-only size sources, compact Padding and alignment icon groups. Initial build, 72 tests and browser creation, save/reload, layout editing and responsive checks passed.

The completed [psd-following-panels.md](psd-following-panels.md) adds wheel zoom and drag pan to the slice canvas, with equally wide layer/properties panels following the PSD while remaining inside the viewport. Build, 38 shared tests and browser interaction/resize checks passed.

The completed [psd-canvas-selection.md](psd-canvas-selection.md) adds direct canvas picking with transparent-pixel pass-through, synchronized tree/properties and separate click/drag gestures. Build, 41 shared tests and real PSD browser selection checks passed.

The completed [nanoid-element-ids.md](nanoid-element-ids.md) replaces handwritten generation with secure Nano ID: eight lowercase letters/digits, numeric first characters allowed. Existing prototype documents migrate page/control IDs and their references once, with a persisted scheme marker and normal undo/save ordering. All 82 tests, the production build and browser save/reload checks passed. It supersedes the generation and legacy-preservation policy in [stable-node-ids.md](stable-node-ids.md); uniqueness and stable identity after migration remain baseline rules.

The completed [document-element-id-uniqueness.md](document-element-id-uniqueness.md) closes cross-page and page/node collision gaps with document-wide identity validation for v1/v2, actionable conflict locations and rejection at parsing, serialization and edit-message boundaries. All 77 tests and the production build passed, including controlled copy collisions, retained session reservations and both checked-in samples.

The completed [compact-insert-menu.md](compact-insert-menu.md) restores a 225px single-column insert menu, with internal scrolling when height is limited; the production build and browser layout, scrolling and keyboard checks passed. [cyclic-canvas-grid.md](cyclic-canvas-grid.md) shares a world-anchored, density-cycling dot grid between prototype and PSD slice canvases; its original build, 79 tests and browser zoom/pan checks passed.

The completed [psd-metadata-sample.md](psd-metadata-sample.md) records a standalone layered PSD fixture, an offline inspector and two art-return checks: ordinary edits preserve metadata, duplication repeats IDs, and the tested layer merge loses metadata. The Draft PSD design now treats merged layers as new objects and manages identity from metadata only; production integration and broader compatibility remain unimplemented.

The completed [layer-tree-context-drag.md](layer-tree-context-drag.md) records context creation/deletion and subtree drag sorting/reparenting in the page layer tree; its lasting rules are incorporated in the product baseline.

The completed [layer-insert-submenu.md](layer-insert-submenu.md) groups 15 creation/type-conversion choices in submenus and adds Copy, Paste, Rename and Duplicate to the layer context menu. Rectangle remains readable but is no longer offered for creation. Replace Prefab is visibly unavailable pending asset integration. The 86 shared tests, production build and browser editing/undo/locking/menu checks passed.

The completed [layer-tree-search.md](layer-tree-search.md) adds current-page layer filtering by name, variable, type or ID, with ancestor paths, match counts, clear/Escape and preserved ordinary expansion state. The variable extension passed all 95 shared tests, production build and browser matching/selection/clear checks; earlier search/collapse/context-menu checks also passed.

The completed [node-variable-names.md](node-variable-names.md) adds optional v2 node variables below the renamed display-name field and shows saved variables beside node names in the layer tree. Shared validation checks binding syntax, reserved words and per-page conflicts; subtree copies allocate available variable names. All 95 shared tests, production build and browser validation/history/copy/lock/save-reload/label checks passed.

The completed [canvas-layer-selection-reveal.md](canvas-layer-selection-reveal.md) reveals canvas-selected prototype controls in the layer tree, expanding ancestors and minimally scrolling even for repeated picks of the same node. Search is retained when it includes the target and cleared otherwise. The 95 shared tests, production build and browser offscreen/collapse/repeat/filter/scroll regression checks passed; component automation remains unavailable.

The completed [constraint-offset-placement.md](constraint-offset-placement.md) aligns constraint inputs with their diagram guides, uses integer direct editing for geometry/layout fields, and converts anchor toggles from current geometry to preserve position and size. Final flow cross-axis removal preserves manual coordinates through optional v2 `crossAxisMode`; new-parent operations reset it. All 102 shared tests, production build and browser placement/toggle/unit/input/lock/history/narrow-panel checks passed; DOM component automation remains unavailable.

The completed [prototype-node-transforms.md](prototype-node-transforms.md) adds shared Laya anchor/scale/skew/rotation geometry, transformed clipping and inverse editing, plus reusable numeric rows. Transform fields show at most two decimals without trailing zeros; numeric focus selects the current value, and a hollow circle marks the anchor with aligned handle centers. The parent dropdown is removed in favor of tree dragging. All 114 shared tests, production build and browser input/selection/drag/resize/lock/history/save-reload checks passed; real engine and VS Code host verification remain separate.

The completed [anchor-position-preservation.md](anchor-position-preservation.md) changes anchor editing to compensate parent-space coordinates and preserve visual geometry, including constrained/flow nodes and measured parents. Shared inverse editing consumes internal position offsets, and new-parent operations absorb them into local geometry. All 121 tests, production build and browser matrix/coordinate/history/save-reload checks passed; it supersedes the initial fixed-X/Y editing policy.

The completed [basic-properties-opacity.md](basic-properties-opacity.md) renames the geometry group to Basic Properties and moves node opacity into a reusable shadcn/ui slider plus numeric input, using 0–1 with up to two decimals. All 121 shared tests, production build and browser drag/keyboard/precision/lock/history/save-reload checks passed; no model or protocol changes.

The completed [page-root-constraints.md](page-root-constraints.md) adds optional v2 root constraints for all page classes, preserving canvas design geometry and existing history/save flows. It also combines size sources into compact readonly W/H fields and aligns the unit select at the same height and left edge with an 8px row gap. All 127 shared tests, production build and browser geometry/history/reload/lock/alignment checks passed; runtime parent preview and Prefab generation remain separate.

The completed [page-root-local-position.md](page-root-local-position.md) passes editing scope to the Inspector so page roots show readonly local 0/0 inside a page and editable canvas placement in overview. Keyed size edits preserve overview coordinates. All 127 existing shared tests, production build and browser scope/size/history/save-reload/child-editing regression checks passed; DOM component automation is unavailable.

The completed [simplified-prototype-editor.md](simplified-prototype-editor.md), [extension-scaffold.md](extension-scaffold.md), [canvas-insert-toolbar.md](canvas-insert-toolbar.md), [canvas-navigation-inputs.md](canvas-navigation-inputs.md), [infinite-canvas-prototype.md](infinite-canvas-prototype.md) and [canvas-bottom-toolbar.md](canvas-bottom-toolbar.md) record implementation and prototype checks; their lasting rules are incorporated in the numbered baseline specs.

Add active work items as direct children of this directory using lowercase kebab-case names, for example:

- `docs/spec/editor-selection-regression.md`
- `docs/spec/save-lifecycle-regression.md`

Remove completed work items from this list after their lasting decisions have been incorporated into the relevant baseline specs. Git history remains the audit trail.

[PSD 工作区启动与页面绑定隔离](psd-workspace-startup-regression.md) 修复恢复 PSD 抢占原型画布，明确切图打开、页面绑定与保存的独立边界。

[页面 PSD 的 Windows 相对路径修复](page-psd-windows-path-regression.md) — Done：同盘盘符和目录大小写不再误判为跨盘；共享宿主控制器回归与真实 VS Code 另存为验证通过。

- [default-image-rendering.md](default-image-rendering.md) — Done：默认图片灰白背景加居中等比图标，PSD 与尺寸对应的 Prefab PNG 一致；覆盖磁盘读取、内容测量布局及临时预览缩放。364 项共享测试、生产构建及浏览器像素回归通过。

- [resource-mode-selection.md](resource-mode-selection.md) — Done：画布切换三种资源模式清空节点选择，保留页面、相机及层级位置；独立运行预览的历史规则已被 canvas-prefab-action 取代。

- [页面 PSD 图层约定](page-psd-layer-conventions.md) — Done。按公开组名与状态标记自动匹配，两个预览模式使用页面 PSD 并显示导出名。

## Source Of Truth

When sources disagree, use this order unless a work-item explicitly documents a temporary transition:

1. The active work-item spec
2. The affected baseline spec
3. Stable contracts and public interfaces
4. Current implementation

Do not silently accept code as the intended behavior when it conflicts with a spec. Resolve the disagreement by updating either the implementation or the spec and record the decision.

## Reading Order

For non-trivial work:

1. Read [../spec-driven-development.md](../spec-driven-development.md).
2. Read this index and the affected numbered baseline specs, if any.
3. Create or update `docs/spec/<short-slug>.md`.
4. Fix the behavior, design, tests, and acceptance criteria before broad implementation.
5. Keep the work-item synchronized while implementation changes.
6. Update affected baseline specs when the result becomes a lasting rule.

For bug fixes, establish and record the root cause before patching. For tiny mechanical changes, a work-item spec is optional; add one if the scope expands.
