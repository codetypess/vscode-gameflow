# PSD 属性面板分区

Status: Done
Date: 2026-11-18
Scope: 切图属性的视觉分区，与控件属性面板保持一致。

## Behavior and design

- 最顶部单独放置文档配置（图集名、使用独立目录及普通资源目录提示），其后为图层信息与预览、导出设置、九宫格、导出区域，组间使用控件属性面板相同的 Separator 横线。
- 复用 property-section-title 标题样式和 10px 组内节奏；文档配置始终显示，即使没有选中图层仍可编辑；导出名称、标记切图和共享选项属于所选图层，放入导出设置。最新文档/图层分离要求替代此前导出名称紧接图集名的排序。
- 两侧面板与 PSD 画板顶边跟随对齐，沿用原型面板的 400px 最小可用高度规则；右侧内容变长时缩减内部滚动区域，不因内容高度将整个面板向上抬。画板过低时两侧一起停靠到仍可操作的位置，移回时恢复跟随。标题栏沿用共用 floating-heading 的高度与内边距。
- PSD 属性面板、PSD 图层树及原型图层树复用原型属性面板的 ScrollArea：滚动条覆盖内容边缘，不占用内容宽度；滚动时显示，停止约 800ms 后淡出，拖动滑块期间保持可见。标题、搜索栏、根节点及底部提示留在滚动区域外。图层搜索重置、画布选层定位和拖动边缘自动滚动使用真实 viewport，行为保留；复用 PSD 树的合并面板沿用同样滚动条。
- 保留所有输入、校验、配置持久化、历史及导出行为。较矮窗口沿用面板内滚动。

## Acceptance

1. 各区域边界清楚，横线颜色、标题与控件属性一致；输入框对齐，文档配置与图层配置以横线明确分离。
2. 没有选中图层时文档配置仍可编辑，图集/目录开关影响整个 PSD；选择其他图层时保留这些值。
3. 普通图层和已有九宫格图层的按钮、预览及提示仍位于所属区域。
4. 普通图层与九宫格图层切换、面板内容增减和平移画板时，左右面板顶边始终一致；内部滚动不平移或缩放画布。
5. 属性面板与两种图层树的滚轮、滑块拖动及键盘滚动可用；滚动与停止前后内容宽度一致，停止后滚动条隐藏，标题栏保持固定。原型树搜索/选层定位/拖动滚动仍有效。
6. 生产构建通过；浏览器用真实 PSD 检查普通与九宫格图层，并确认面板内部滚动可达全部控件。本次呈现调整不新增镜像 DOM/CSS 的测试。

## Native canvas scrolling regression

- Reproduced in the 1280×720 real PSD view: pan the image downward, leave the layer viewport at its lower limit, then focus the viewport and press End/Home. The layer viewport stayed at 98px while the outer `.psd-slice-canvas.scrollTop` changed from 0 to 98px; the visible image moved upward 98px without a camera change.
- The camera stages used `overflow: hidden`, which clips visually but remains a native scroll container. Keyboard/focus scrolling can therefore move the stage; stopping React event propagation does not prevent this browser default. The stages must clip without becoming native scroll containers, because all canvas movement belongs to the camera. Use `overflow: clip` for the prototype and PSD stages.
- Regression verification uses the real browser component: wheel/drag/End/Home inside both overflowing panels must leave the outer stage scrollTop at 0 and the image geometry unchanged. The repository has no automated DOM interaction runner for these panels; retain these concrete manual steps rather than adding a test that only checks CSS source text.

## Verification

- `npm run build` passed after the final overlay-scroll and canvas-clipping changes, including both TypeScript projects. The existing Vite chunk-size advisory remains.
- `npm test`: 333 shared tests passed, including two new placement checks for stable common tops across content-height changes and shared docking/resumed following at the 400px threshold.
- Real PSD checks covered unselected document editing, cross-layer atlas/directory state, reserved atlas errors remaining invalid across selection and disabling export, ordinary/nine-grid sections, and internal scrolling to all section controls.
- Before overlay conversion, the 1688×1243 view confirmed image/tree/inspector tops all at 217.5px; panning down 300px kept all at 517.5px while reducing the property viewport. Scrolling 295px left image geometry unchanged.
- After overlay conversion, the 1280×720 PSD view exercised wheel, thumb dragging and Home/End/PageDown. Both viewports stayed 276px wide while bars appeared and disappeared; atlas/export inputs both started at x=1063px and remained 192px wide. Idle bars were absent. Properties reached the 567px lower limit; thumb dragging changed both viewport scroll positions.
- The star-sea prototype sample verified 449px tree content, search reset to zero, clearing search, and canvas selection revealing a corresponding row (190px to 88px). Its viewport stayed 278px wide while the overlay appeared and disappeared. Search, reveal and drag-edge autoscroll target the actual viewport; the drag-edge ref change was checked in the code.
- Native-scroll regression: the original End/Home sequence now leaves PSD stage.scrollTop at 0 with unchanged image geometry. The prototype stage also stayed at 0 with unchanged page geometry. These were real browser interaction checks; no repository DOM interaction runner exists for these panels.
- Screenshot: `psd-overlay-scroll-panels.png` is the latest overlay layout; `psd-document-inspector-alignment.png` preserves the earlier tall-window alignment view. `git diff --check` passed.
