# Insert Menu Layout

Status: Done
Date: 2026-11-16
Scope: 底部添加菜单恢复单列布局

## Context and Behavior

此前为减少滚动，将页面根和 16 种控件改为 440px 宽的双列。用户要求恢复单列；当前双列来自 `.insert-grid` 的自适应网格列设置。

- 页面根、控件各自用单列排列，保留中文名称、类名和图标；正常菜单恢复 225px 宽，沿用紧凑行高约 28px。
- 菜单保持向上展开并限制在视口内，高度不足时内部滚动，确保所有条目可访问。
- 窄窗口按可用宽度收缩，始终保持单列。
- 保持添加页面、选择控件放置工具、总览下控件禁用、键盘 Tab 和 Escape 的行为。
- 本轮只调整底部添加菜单，不变更右键菜单、文档或编辑事务。

## Acceptance and Verification

构建通过。浏览器检查页面根和控件均为单列，正常宽 225px；窄/矮视口检查菜单未越界、滚动后可访问末项；添加页面、选择工具和 Escape 关闭有效。纯布局调整不新增镜像 CSS 的测试。

## Risks and Rollback

单列增加纵向占用，由可用高度限位和内部滚动控制。回退菜单布局无需迁移数据。

## Verification Record (2026-11-16)

- `npm run build` 通过，包含扩展和 Webview 的 TypeScript 检查及生产构建。
- 生产构建浏览器预览在 1280×720 下菜单宽 225px，两组均为单列，各项 X 坐标一致；没有横向溢出，总览下控件禁用。
- 360×420 下菜单位于视口内，宽 225px、高 195px；内部滚动至末尾后，下拉框条目完整可见并可点击，页面编辑上下文切换为“点击页面放置下拉框”。
- 添加 UIStack 成功；进入页面后控件全部启用；Tab 从首项移到下一项，Escape 关闭菜单并将焦点返回触发按钮。浏览器无 console error，检查后已恢复默认视口。
- 已保存 `insert-menu-single-column.jpg`；本次为菜单样式调整，未新增自动化测试，未追加真实 Extension Host 验证。

## Previous Verification Record (2026-11-13, 双列版本)

- 构建通过。在 1280×720 和 960×540 视口，20 个按钮完整显示，菜单宽 440px、高 355px，scrollHeight 与 clientHeight 均为 353，无滚动条。
- 360×420 视口回退单列，宽 336px，左右各留 12px，内部允许滚动且无横向溢出；末项可由键盘聚焦，Escape 正常关闭。
- 点击“下拉框 (UIComboBox)”关闭菜单并进入放置工具，画布提示更新为“点击页面放置下拉框”。浏览器 console 无 error。
- 已保存 compact-menu-cyclic-grid.png；未追加真实 Extension Host 验证。
