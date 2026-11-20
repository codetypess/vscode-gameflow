# 属性面板复选框点击范围

Status: Done
Date: 2026-11-20
Scope: 原型属性面板 `.property-toggle` 的点击范围。

## 1. Context

用户截图标出 UIButton“选中状态 / 禁用状态”右侧的空白，点击该区域会意外切换复选框。

## 2. Goals

空白处不切换属性；文字、复选框和键盘空格继续支持正常操作。

## 3. Non-Goals

不改变文档字段、控件状态语义、属性列宽和面板布局，不修改 PSD 树或覆盖属性批量选择。

## 4. Current Behavior

`ui-properties.tsx` 的 Toggle 和 `control-parts.tsx` 的选中状态均使用原生 label 包裹 checkbox。`.property-toggle` 为未指定宽度的块级 flex：在 details 中占满可用宽度，在 Inspector 的纵向 flex 中被横向拉伸。右侧空白仍在 label 内，浏览器默认激活其 checkbox；并非画布穿透或状态同步错误。相同模式影响裁剪、密码、换行和 CheckBox/Radio 选中属性。

## 5. Proposed Behavior

布尔行的 label 只占文字列、列间距与复选框所需宽度。点击其右侧剩余空白无副作用。维持左标签、右复选框的 60px / 7px 对齐，语法组继续紧凑展示。

## 6. Design

在共享 `.property-toggle` 样式设置内容适配宽度，统一覆盖普通 Toggle、控件部件选中状态及直接位于纵向 flex 的换行属性。保留原生 label 关联、disabled、焦点、覆盖属性菜单与 onChange。无需拦截 click 或复制状态。

## 7. Implementation Plan

1. 添加真实浏览器回归，先在旧样式下确认右侧空白点击失败。
2. 收窄共享 label 的宽度，同步 UI 基线。
3. 验证普通/窄视口、文字/checkbox/空格操作、锁定保护和相邻语法组。

## 8. Testing Plan

通过现有 Vite 预览与 Edge/Playwright，加载独立浏览器上下文的测试文档，点击实际 Inspector 中复选框右侧空白。覆盖 UIButton 两状态、裁剪、密码、换行、CheckBox/Radio 选中状态及文字语法；验证文字点击、checkbox 点击、空格、撤销/重做和锁定保护。运行 `npm test`、`npm run build`、`git diff --check`。

## 9. Acceptance Criteria

- 旧样式在空白点击断言失败，修复后通过。
- 普通与窄视口空白点击均不改变 checkbox；文字与 checkbox 点击、空格仍切换状态。
- 锁定属性仍禁用，撤销/重做正常，语法组仍可操作且不溢出面板。
- 共享测试、生产构建、diff 检查通过。

## 10. Risks and Rollback

内容宽度可能影响共用该类的语法组，浏览器检查其排列和操作。回退单条样式即可恢复原行为，无数据迁移。

## Verification Record

- 2026-11-20：新增 `test/inspector-checkbox-browser.cjs`，在未修复样式下点击“选中状态”右侧空白，实际由 false 变为 true，命中预期回归断言。确认浏览器原生 label 激活机制是根因。
- 修复后 Edge 回归通过：UIButton 选中/禁用、容器裁剪、输入密码、文字换行、CheckBox/Radio 选中状态的空白点击无变化，文字/checkbox 点击和空格正常；撤销/重做、锁定保护、语法组合及 360px 视口通过。浏览器 pageerror 为空。
- 目视检查普通/窄视口截图，属性列对齐及紧凑布局正常。截图位于 `C:/Users/bite/AppData/Local/Temp/gameflow-inspector-checkbox-8o0avE/`。
- `npm test` 368 项共享测试通过；`npm run build`（含双端类型检查）通过，保留既有大包体提示；`git diff --check` 通过。
- 浏览器命令：在本地 Vite 预览启动后运行 `node test/inspector-checkbox-browser.cjs`，可沿用其他浏览器测试的 `GAMEFLOW_TEST_URL` 与 `GAMEFLOW_PLAYWRIGHT_MODULE` 配置。
