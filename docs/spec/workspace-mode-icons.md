# Workspace Mode Icons

Status: Done
Date: 2026-11-17
Scope: 恢复原有三模式图标样式，移除整组按钮的外层框。

## Design

- 保持原型、PSD 合并、PSD 切图三个纯图标按钮，恢复 `LayoutPanelTop`、`GitMerge`、`Scissors`，图标 16px、默认 2px 线宽。
- 按钮恢复 30×22px、2px 圆角和 2px 间距。整组不绘制背景、边框或圆角，也不加内边距；仅当前按钮保留原有主题背景及细描边。
- 三按钮组高 22px，在 40px 顶栏内距顶部 9px；宽窗口居中，窄窗口靠右，位置落在整像素上。
- 保留中文 Tooltip、aria-label、aria-pressed、悬停及键盘焦点，模式切换继续保留原型会话，不改变文档或协议。

## Verification

运行生产构建和差异检查；浏览器检查原有图标、无整组外框、按钮尺寸与单选高亮，验证模式切换和窄窗口位置。该项为可逆展示调整，不新增 CSS/SVG 字符串断言。

## Acceptance

- [x] 三个图标和按钮恢复原有样式，无常驻文字。
- [x] 按钮组无背景、边框和内边距，当前按钮高亮正确。
- [x] 模式切换及宽/窄窗口显示正常。
- [x] 生产构建和差异检查通过。

## Results

- `npm run build`（含两组类型检查）和 `git diff --check` 通过。
- 浏览器实测按钮组背景透明、边框 0px、内边距 0px，整体 94×22px；三个按钮均为 30×22px，使用原有 16px 图标且无常驻文字，仅当前按钮为 pressed。
- 1280px 窗口按钮组坐标为 (593, 9)，360px 窗口为 (256, 9)，右侧保留 10px 留白。PSD 合并、切图及返回原型的切换均正常。
- 效果图及几何记录保存为本轮可视化目录的 `workspace-mode-borderless-full.jpg`、`workspace-mode-borderless-geometry.json`；真实 Extension Host 未重复人工验收。

## Rollback

回退模式切换器图标和 CSS，无数据迁移。
