# PSD 生成图层身份修复

Status: Done

日期　2026-11-25

星海登录页的「列表」和「服务器列表项」实际保存了由 PSD 生成器按原型节点计算的 UUID。同步补图层沿用了生成模板的身份。当前规范要求新图层使用 8 位小写字母或数字的 Nano ID。

生成器统一使用共享分配器。同步从目标 PSD 已有身份集合中预留 ID 并给新增层分配新身份。重新生成页面时可按同一 PSD 谱系下的原型文档、页面、节点和槽位复用已明确对应的图层 ID。PSD 文档身份、Photoshop 智能对象文件身份和 Laya 资源 UUID 按各自格式持久化。

对星海样例中确认的两个 UUID 执行一次显式迁移，同步替换 PSD 内嵌元数据、切图配置、命中引用和源指纹。验收检查迁移后的非元数据区块、画面和智能对象数据字节一致，以及新生成和同步补层使用短 ID、既有身份保持稳定。

## 全仓扫描结果

| 位置 | 用途 |
| --- | --- |
| `webview/runtime/prototype-psd.ts` | 原先用 `resourceUuid` 生成 PSD 图层身份，已改用共享 Nano ID 分配器。PSD 文档谱系仍使用原有算法。 |
| `webview/runtime/page-psd.ts` | 生成比较初始基线时，未关联节点的后备分配已改用 Nano ID。原生请求仍使用 UUID 区分回包。 |
| `webview/runtime/psd-prefab.ts` | PSD 转 Prefab 为未关联的节点取资源 UUID 的前 8 位，保持同一个图层在多次转换中的投影身份。 |
| `shared/laya-meta.ts`、`shared/prefab-export.ts` | Laya 的资源导入 UUID、`res://` 以及 Prefab 引用。 |
| `src/create-document.ts`、`shared/psd-structure.ts`、`examples/star-sea-login/tools/build-sample.cjs` | GameFlow 和 PSD 文档级身份。 |
| `webview/runtime/psd-smart-object.ts`、`webview/runtime/sync-psd-copy.ts` | Photoshop 置入实例及内嵌文件引用使用 GUID。 |
| 宿主、Webview、内部发布工具 | 请求关联、临时文件名、发布产物暂存与更新器令牌。 |

## 迁移与验证

| 图层 | 原 ID | 迁移后 ID |
| --- | --- | --- |
| 服务器列表项 | `8c80df86-5bfa-516b-a9d8-1cbd5c93ac3f` | `t6od46b5` |
| 列表 | `9d1bfeba-bf7b-5ecf-abe0-9d1daff85a53` | `2xvqxj22` |

三个仓库 PSD、一个嵌入 PSD 和八份画布通过复查。47 个 GameFlow PSD 图层身份均符合短 ID 规则，画布节点、页面和 PSD 同步基线引用中的旧 UUID 数量为零。星海样例的 PSD 非元数据区块、合成画面和智能对象数据通过字节比对。

生成回归在修复前重现了长 UUID。修复后验证生成短 ID、重新生成复用身份、同步给新增层分配短 ID、已有智能对象保留身份。原有双向与单向同步浏览器检查、397 项共享测试及生产构建通过。
