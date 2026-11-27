# 工作台右上角版本号

Status: Done
Date: 2026-11-27
Scope: 原型及 PSD 工作台顶栏的版本显示。

## Context and Behavior

用户要求在截图标出的顶栏最右侧显示版本号，便于确认当前打开的工作台版本。原型、PSD 合并、PSD 切图及独立 PSD 编辑器统一显示 `v<版本>`，使用次要文字色，保持单行；窄窗口仍可见，文档标题让出空间。版本只展示，不触发更新。

## Design

宿主生成 Webview HTML 时把其 ExtensionContext 中的实际扩展版本写入经过转义的 metadata。共享版本组件读取该值；浏览器预览没有宿主 metadata 时使用当前构建的 package.json.version。两个工作台入口复用组件，样式使用 margin-left:auto 和 flex-shrink:0 固定在右侧。版本状态独立于服务器更新目标和文档数据。

## Verification

沿用 Webview HTML 的 CSP 测试，覆盖宿主提供的版本确实写入 HTML；浏览器验证宿主版本优先于构建版本、三种模式与独立 PSD 共用显示、360px 下位置可见。执行类型检查、生产构建和分发回归；发布新包后检查包身份和下载摘要。

## Acceptance

- [x] 四个工作区入口在右上角显示版本，模式切换后保留。
- [x] 宿主版本和浏览器回退版本来源正确。
- [x] 窄窗口不隐藏版本号，不改变编辑与保存。
- [x] 构建与相关验证通过。

验证结果：421 项共享测试、33 项分发测试、类型检查和正式生产打包通过。Edge 的 workbench-update-browser 验证宿主注入的 9.8.7 覆盖构建版本、原型/合并/切图/独立 PSD、360px 边界及浏览器回退 0.1.16；psd-workspace-startup-browser 通过，实际 PSD 会话和原有操作保持正常。版本顶栏截图在 dist/workbench-plugin-update/version-topbar.png。

已发布 codetypess.vscode-gameflow 0.1.16，metadata revision 28；安装包 1462671 bytes，SHA-256 995bddbd868e68cb4d82d0d1b66291fac8de2cf5916dc0b92977110441a5f3d1。已核对包内宿主/前端/CSS 产物，并从公开地址下载验证与本地一致。记录在 dist/release-0.1.16/release.json。
