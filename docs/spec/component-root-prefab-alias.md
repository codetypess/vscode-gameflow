# 组件根与预制体根一致性

Status: Done
Date: 2026-11-24
Scope: 从节点提取画布组件后的图层树、引用实例与 Laya Prefab 根结构

## 1. Context

“存到画布”当前把选中的自由容器保存为 `componentRootId`，同时创建一个 UIBox 画板根。引用实例组合时会把这两个根合并为一层，但组件源画板的图层树和 Prefab 生成仍把它们显示或输出为两层。因此同一个“服务器列表项”在引用实例中直接包含文字，在组件源和 Laya 中却多出一个“容器”。

受影响的基线是 `10-extension-architecture.md` 与 `11-prototype-ui-layout.md`。

## 2. Goals

- 组件源画板、引用实例和生成后的 Laya Prefab 对同一个组件显示相同的根与直接子节点。
- 选中的 UIBox 本身成为 Prefab 语义根，不额外输出画板根与组件根两层 UIBox。
- 保留 `componentRootId` 作为根节点属性、布局、覆盖和稳定身份的内部所有者。
- 不可作为 Prefab 根的节点不被静默包装，提示明确包含实际 Laya 类型。
- 旧双层 Prefab 可在同步审阅中作为一项原子结构迁移为单根表示。

## 3. Non-Goals

- 不扩展可提取的根类型；本次仍只接受普通、未锁定且尺寸有效的自由容器 UIBox。
- 不迁移或删除现有 `.gameflow.json` 中的 `componentRootId` 节点。
- 不改变普通页面、普通 UIBox 画板或画布引用实例的 UUID 引用格式。

## 4. Current Behavior

提取操作生成 `UIBox page -> componentRoot UIBox -> children`。组合实例把 `componentRoot` 映射到实例根并跳过重复根，所以编辑主页面时看到 `instance -> children`；组件源图层树和 `planPrefabExport` 仍看到或输出 `page -> componentRoot -> children`。根因是同一内部根只在实例组合边界建立了别名，图层与 Prefab 边界没有复用这条语义。

## 5. Proposed Behavior

带有效 `componentRootId` 的 UIBox 画板把页面根与组件根视为同一个外部根：

- 图层树的根行代表组件根，列表从组件根的直接子节点开始。
- Prefab 根使用页面稳定 ID、导出名称和 UIBox 类型，同时承载组件根的可导出属性，并直接包含组件根的子节点。
- Prefab 同步读取单根产物时，在内存比较树中还原内部组件根身份，使属性和子节点仍写回原来的 `componentRootId`。
- 旧双层产物显示一项“组件根结构”迁移；接受后提升旧组件根并保留可识别的引擎扩展字段，跳过则不改目标文件。
- 对 UILabel 等非法选择显示“根节点不能为 UILabel，仅支持 UIBox”一类提示，不创建替代容器。

## 6. Design

- 权威文档格式不变。别名只存在于图层展示、Prefab 规划和 Prefab 同步投影中，避免复制根属性或引入迁移版本。
- Prefab 规划器仅在 `componentRootId` 指向无父级、非引用的普通 `container`，且页面根为 UIBox 时提升根；非法组件定义直接报错。
- 提升后的根保留页面 ID/名称与组件根内容布局，删除节点级 `x`、`y` 和变量标记；子节点稳定 ID 及控件引用不变。
- 同步比较继续使用内部的页面根和组件根两个逻辑身份。单根 Laya 记录同时投影为页面根属性与组件根属性，写回时再合并成一个记录。
- 旧双层识别依据是 Prefab 根的直接子节点包含 `componentRootId`，不会按名称猜测。

## 7. Implementation Plan

1. 增加数据级回归，复现实例投影单根而 Prefab 输出双根，并覆盖非法根类型提示。
2. 让 Prefab 规划与同步把有效组件根提升为单根，保留旧双层审阅迁移。
3. 让组件源图层树以 `componentRootId` 作为根别名，只列直接子节点。
4. 更新样例 Prefab、编号基线与规格索引，运行完整测试和生产构建。

## 8. Testing Plan

- 提取测试断言非法 UILabel 返回包含 `UILabel` 的根类型提示，且文档不改变。
- Prefab 规划测试断言根下直接是原组件子节点，不再含 `componentRootId` 包装记录，根布局属性仍保留。
- Prefab 同步测试覆盖新单根零差异、根属性往返，以及旧双层只产生一项原子迁移并在接受后零差异。
- 图层树纯投影或渲染测试断言组件根不作为第二行出现，直接子节点位于根行下。
- 运行 `npm test`、`npm run build` 和 `git diff --check`。

## 9. Acceptance Criteria

- “服务器列表项”在组件源、主页面引用实例与 Laya 层级中均直接包含“服务器名称”，没有额外“容器”层。
- 新生成的 `LoginServerListItem.lh` 根为 UIBox，直接子节点为 `serverLabel2`，不存在 `rp12tniu` 包装记录。
- 组件根的间距、内边距、透明度、尺寸和子节点身份不会因提升丢失。
- 非 UIBox 选择不创建画布组件，界面提示实际根类型不能使用。
- 新单根和迁移后的旧文件再次比较为零差异；普通页面与 Prefab UUID 引用测试不回归。

## 10. Risks and Rollback

一个 Laya 根记录同时承载页面身份和组件根属性，可能让页面约束与组件内容布局发生字段冲突。组件画板以组件根内容布局为准，页面只保留尺寸、导出名称和根级约束的既有同步语义；回归覆盖根属性往返。若目标引擎不能加载单根模板，可回退 Prefab 提升和同步投影，文档本身无需降级或迁移。

## 11. Validation

- `npm test`：386 项共享测试通过，包括非法根类型、组件源图层投影、单根 Prefab 导出和旧双层迁移回归。
- `npm run check`：扩展与 Webview TypeScript 检查通过。
- `npm run build`：扩展 bundle 与 Webview 生产构建通过；仅保留既有大 chunk 提示。
- `git diff --check`：通过，无空白错误。
- 浏览器 `?sample=star-sea-login`：组件源根行显示“服务器列表项 UIBox”，图层计数为 1，直接子节点为“服务器名称 serverLabel2”，无额外“容器”层。
- `LoginServerListItem.lh` 解析检查：根为 `qs1b6zrv` / `UIBox`，直接子节点为 `d9jimlmp` / `UILabel`，不再包含 `rp12tniu`。
