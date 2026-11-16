# 画布方向键操作的焦点归属

Status: Done
Date: 2026-11-16
Scope: 修复画布选中后按方向键时，旧层级树按钮出现焦点框的问题。

## 1. Context

用户在画布选中文字并按方向键微调时，左侧层级树名称按钮出现额外的蓝色边框。树行选中背景应保留，画布操作不应激活旧按钮的键盘焦点框。

## 2. Goals

画布直接操作时键盘焦点归属画布；微调、选择及层级树定位正常；Tab 到层级树时仍有可见焦点。

## 3. Non-Goals

不改变节点几何规则、树行选择样式、树的键盘导航或持久化格式。

## 4. Current Behavior and Root Cause

`startGesture` 对画布 pointerdown 调用 preventDefault，以接管拖动，但只主动 blur 输入字段。层级树按钮不属于字段，因默认行为被取消，点击画布不会将焦点从按钮移开。画布 viewport 也没有 tabIndex，不能接管焦点。

浏览器复现：先点击树中文字，再点击画布同一文字，activeElement 仍为 `.layer-name`；按 ArrowRight 后，activeElement 不变但 `:focus-visible` 从 false 变为 true，通用按钮样式绘制 1px 蓝色 outline。树的自动定位代码没有 focus 调用，选中背景与选框本身均正常。

## 5. Proposed Behavior

通过画布现有交互排除条件后，先提交输入编辑，再由可编程聚焦的画布接管焦点，使用 preventScroll 保持视角。画布自身不绘制大范围焦点边框；原有树行、按钮、输入框的焦点提示保留。画布 tabIndex=-1，不增加 Tab 顺序入口。

## 6. Design

只在 `startGesture` 与 viewport 上修复焦点归属，不在树行隐藏 focus-visible。属性面板、工具条、引用弹窗等交互继续按现有排除/事件隔离工作。

## 7. Implementation Plan

1. 为画布启用程序聚焦，在画布有效 pointerdown 时 focus。
2. 复验原场景、不同节点、缩放手柄及输入失焦提交。
3. 验证树按钮 Tab 焦点提示与引用弹窗焦点返回，更新基线。

## 8. Testing Plan

使用本机预览做浏览器交互回归：树选中后点击画布文字并按四个方向键，检查坐标和 activeElement；树选中 A、画布选中 B 时不残留 A 的焦点；Tab 到树按钮时 focus-visible 正常；属性编辑失焦提交、缩放手柄与引用弹窗正常。此问题由浏览器真实焦点与伪类产生，现有纯模型测试无法覆盖，采用 UI 回归而不添加镜像实现的静态断言。运行类型检查/生产构建与差异空白检查。

## 9. Acceptance Criteria

画布按方向键正常微调，焦点在 viewport，树行只保留选中背景；键盘访问树行仍显示焦点提示；输入、弹窗和手柄不受影响，画布不因聚焦滚动。

## 10. Risks and Rollback

聚焦必须发生在面板/按钮排除之后，且不跳过输入提交。回退可撤销 viewport 聚焦改动；不涉及数据迁移。

## 11. Verification Record

- 画布 viewport 增加 tabIndex=-1，在有效 pointerdown 且字段提交之后显式 focus({ preventScroll: true })，画布本身不绘制 outline；未修改层级树的 focus-visible 样式。
- 浏览器原复现修复：四个方向键使文字坐标 (22,7)→(23,7)→(23,8)→(22,8)→(22,7)，焦点始终为 canvas-viewport，树行 focus-visible 数量始终为 0。树选中另一节点后，再点画布文字并微调，也无残留焦点框。
- Tab / Shift+Tab 返回树名称按钮时，focus-visible 为 true 且仍显示 1px 蓝色 outline；随后点画布可正常移交焦点。
- 属性 X 编辑未按 Enter，直接点画布仍正确提交；输入还原后位置恢复。缩放手柄可拖动改变文字宽度，撤销恢复 74；引用弹窗 Escape 后焦点返回原选择按钮。相机 transform 与验证前一致，无聚焦滚动。
- 类型检查、生产构建和差异空白检查通过；浏览器控制台无 error/warn，已保存修复截图。此修复采用真实浏览器交互回归，无新增自动化测试，未运行真实 Extension Host 验收。
