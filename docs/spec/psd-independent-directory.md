# PSD 资源根目录与独立目录

Status: Done
Date: 2026-11-18
Scope: PSD 独立目录选项、保留图集名、根目录资源分类、来源清单与预览读取。

## Context and behavior

选择 PSD 文档时，属性面板的“文档配置”包含图集名和“使用独立目录”复选框，属于当前 PSD，默认不勾选。资源根目录包含 image-files.meta.json、builtin/、shared/、unclassified/。builtin 为内置资源预留，本次不实现原型转预制体。

共享图层始终导出到 shared/{导出名}.png。非共享图层默认导出到 unclassified/{导出名}.png；勾选独立目录后，导出到根目录下 {图集名}/{导出名}.png，不叠加 GameFlow 文件的导出子目录。图集名未自定义时取规范化 PSD 文件名。共享优先于独立目录。普通和共享文件名统一为 `{图集名}_{变量名}`，变量优先取自定义配置，缺省取图层名缩写。

图集名规范为小写、数字和下划线，中文取拼音首字母。builtin、shared、unclassified 为保留名称，大小写与规范化后等价的输入均禁止；保存、草稿、内嵌元数据和导出边界采用同样校验。文件名默认值若命中保留名称，提示用户修改图集名并阻止导出。

开关、图集改名和资源分类改变会更新资源路径；不自动移动、删除已导出的文件或迁移原型绑定。

## Design

- PsdAsset.independentDirectory 为可选布尔值；false 规范为缺省。sidecar、草稿、宿主历史、PSD 内嵌元数据均保留该设置。
- 共享纯函数计算每个图层的根目录相对路径。批次只携带可选的规范化独立目录段；宿主从权威 PSD 派生它，不接受任意客户端目录。待同步修改期间禁用导出。
- image-files.meta.json 位于资源根目录，清单版本 2 以相对文件路径为身份，记录来源、hash、尺寸与九宫格信息。不同目录允许相同基名，单目录大小写冲突仍拒绝。
- 导出以资源根目录为锁粒度，一批可包含 shared 和 atlas/unclassified。写入前检查全部目标与根清单，清单最后写入；失败恢复本批全部文件。仅枚举根和本批目标子目录，避免遍历整个资源库。
- 预览优先读取根清单中的完整路径；保留旧版各目录 gameflow-resources.json 的读取兼容，既有文件不删除。
- 运行预览、资源选择和生成缓存包含独立目录与共享状态，变更后沿用已存在的移动/失效绑定诊断。

## Acceptance and verification

1. 顶部文档配置中包含图集名与独立目录 checkbox，无选中图层时也可编辑，文档级状态经切换图层、撤销/重做、保存与草稿回读一致。
2. 实际导出符合 shared、unclassified、根级 atlas 三种路由；共享优先；自定义变量保留。
3. 根清单登记跨子目录文件，相同基名在不同目录可共存；同路径跨来源非共享冲突、共享覆盖、大小写冲突、竞争修改和回滚仍有效。
4. builtin/shared/unclassified 图集名在输入及持久化/导出边界拒绝；默认文件名命中时允许用户修正；非法目录、类型和冲突内嵌值拒绝。
5. 根清单与旧清单资源均可预览，路径变化后资源列表和绑定诊断一致。
6. 运行共享测试、生产构建、实际宿主导出测试，并用真实 PSD 检查 UI、路径提示、保留名和资源选择。

## Risks and limits

目录开关与分类改变不会自动迁移现有资源和绑定。builtin 仅保留目录，本次不新增预制体功能。原生目录选择器与 Photoshop 往返须分别说明验证范围。

## Verification results

- `npm test`: 333 shared tests passed. Coverage includes document persistence/validation, path identities, same basenames across directories, write/manifest rollback, root-ledger/legacy coexistence, and invalid authoritative records preventing legacy fallback.
- `npm run build` passed, including host/Webview type checks and production bundles. The existing Vite size advisory remains.
- `npm run test:psd-host`: 39 native host checks passed. Real writes verified shared/unclassified/atlas routing, root-level atlas output without GameFlow exportDirectory, host authority over stale client data, shared priority/provenance transfer, dynamic destinations, reserved-name rejection, save/history/backup and runtime reads.
- Real PSD browser checks verified document editing without a selected layer, values surviving layer changes, shared/ordinary path hints, placeholder/default names, normalization, reserved-name errors disabling export, and shared paths in resource selection. The earlier UI phase also verified Chinese initials, clearing overrides and undo.
- Final inspector organization and overlay scrolling are verified in [psd-inspector-sections.md](psd-inspector-sections.md). `git diff --check` passed.
- Limits: browser native directory-picker-to-disk interaction was not run end to end; actual filesystem output was covered by native host checks. Photoshop round-trip and builtin/prefab generation are outside this change.
