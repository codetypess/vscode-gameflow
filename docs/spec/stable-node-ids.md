# Laya 风格的稳定节点 ID

Status: Done
Date: 2026-11-13
Scope: 当前原型中新建、复制的页面与控件采用 Laya 默认长度的短 ID，保持已有对象身份。

## 1. Context

用户要求以不可变的内置 ID 追踪原型、Prefab 和 PSD，并让原型节点 ID 长度与 Laya 一致。当前交互创建使用 `crypto.randomUUID()`，默认文档使用可读样例 ID。目标项目 `engine/types/editor.d.ts` 的 `IUUIDUtils.genShortId()` 明确默认长度 8，字符为数字/小写字母且首位不是数字。

## 2. Goals

- 新建和复制页面、控件使用 `[a-z][a-z0-9]{7}`。
- 检查当前文档所有页面、节点及同会话已分配 ID，避免短 ID 冲突。
- ID 在改名、移动、换父级、样式编辑、保存/加载中保持；复制重新分配并改写内部引用。

## 3. Non-Goals

不批量迁移已有 ID，不改变 documentId、需求和交互 ID，不实现 Prefab/PSD 导出。

## 4. Current Behavior

`webview/app.tsx` 在创建页面/节点及复制时用 UUID；`shared/editor-ops.ts` 通过注入生成器分配副本 ID，既有移动和保存保留 ID。

## 5. Proposed Behavior

统一短 ID 分配器使用 Web Crypto 随机源，检查占用并有限次重试。每次创建/复制前吸收最新文档中的 ID；会话内保留已经分配的 ID，避免撤销/删除后重用。读取旧文档保持原字符串；8 位是生成规则而非旧文档验证规则。

默认新建画布中的示例页面/节点也获得短 ID，并改写 parentId 和页面跳转目标。仓库已有示例文件作为既有文档保留原 ID。跨文档引用需要带文档/页面作用域，短 ID 不宣称全局唯一。

## 6. Design

`shared/element-id.ts` 提供随机短 ID、占用集合分配和文档 ID 收集；Webview 在一个编辑会话中保留集合，复制同一子树共用分配器。默认文档工厂只在新建时分配，解析/序列化不分配。副本 parentId 与页面交互引用必须指向副本的新 ID。

## 7. Implementation Plan

先建立工作项，再替换所有创建入口、更新默认文档工厂，补充身份与冲突覆盖，最后运行测试和生产构建并同步 baseline。

## 8. Testing Plan

使用可控制候选值验证已占用 ID 的重试和耗尽失败；验证新画布与复制子树的 ID、父引用与唯一性；验证旧 ID 经改名/换父级/保存加载不变。运行 `npm test` 与 `npm run build`。

## 9. Acceptance Criteria

- 所有交互创建和复制入口、默认新建画布的页面/节点 ID 符合 8 位规则。
- 同文档和同一次复制不产生重复 ID，持续冲突明确失败。
- 已保存的长 ID 和可读 ID 正常打开，保存后保持原值。
- 类型检查、共享测试、生产构建通过。

## 10. Risks and Rollback

短 ID 碰撞概率高于 UUID，必须检查占用且不能单独作为跨文档主键。回滚生成器只影响未来创建；任何版本都不能为调整格式重写已有 ID。

## Verification

- `npm test`：25 项共享测试通过，覆盖新画布、短 ID 冲突/耗尽、复制引用和旧 ID 保存加载。沙箱内 esbuild 子进程启动返回 EPERM，获准在沙箱外执行后通过。
- `npm run build`：宿主/Webview 类型检查与生产构建通过。
- 检查所有页面/节点创建和复制入口均使用共享分配器；本次未追加真实 Extension Host 交互验收。

## Follow-up: Document-wide Validation

[document-element-id-uniqueness.md](document-element-id-uniqueness.md) 补齐了加载校验按页面分组导致的漏洞：所有页面根和控件在整份文档内共用唯一空间，v1/v2 的解析、序列化及编辑消息拒绝重复 ID，错误给出两处位置，不自动改号。新增长 ID 兼容、受控碰撞连续复制、恢复复制前状态后不复用会话 ID 及样例往返覆盖；共 77 项测试及构建通过。
