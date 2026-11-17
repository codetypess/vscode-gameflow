# Webview Full Bleed

Status: Implementing
Date: 2026-11-16
Scope: 清除 VS Code Webview 默认左右内边距，使工作台铺满编辑器内容区。

## Context and Root Cause

用户在真实 Extension Development Host 中发现顶栏和画布两侧有空隙，浏览器预览没有同样留白。已核对本机 VS Code 的 `webview/browser/pre/index.html`：宿主注入 `body { margin: 0; padding: 0 20px; }`。现有应用重置 margin、宽高及 overflow，但没有重置 padding，导致 body 的内容盒被缩窄。顶栏内按钮间距与画布缩放不是此留白的来源。

## Behavior and Implementation

应用根容器在共享入口样式显式重置 padding 为 0，覆盖宿主默认值，浏览器预览与扩展内采用相同布局。顶栏背景和画布抵达 Webview 左右边缘；顶栏内部按钮原有间距保留。此修复不改变页面尺寸、相机逻辑、文档或宿主协议。

## Validation

在已打开的扩展开发宿主中重新载入工作台，检查顶栏和画布左右边界；确认原型仍正常显示和进入编辑，PSD 模式仍铺满内容区。执行类型检查和生产构建、现有共享测试及差异检查。共享测试运行于 Node，无 Webview 宿主/CSS 布局环境，无法在该套件复现宿主内边距；此项以宿主默认样式来源及实际插件窗口视觉回归为依据，不添加 CSS 字符串断言。

## Acceptance

- [ ] 真实 VS Code 插件中左右无默认 20px 留白。
- [ ] 原型编辑和 PSD 工作区布局正常，浏览器入口使用相同重置。
- [ ] 构建、共享测试及差异检查通过。

## Rollback

移除入口样式中新加的 padding 重置即可回退；没有数据迁移。
