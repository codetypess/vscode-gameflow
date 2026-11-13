# AI 原型生成接入约定

当前交付的是手动原型编辑器。下面记录后续 Agent 的输入、输出和应用边界；当前没有接入模型服务或自动分析 PDF。

## 可以复用的现有接口

- [JSON Schema](../schemas/gameflow.schema.json) 定义结构化原型；[shared/model.ts](../shared/model.ts) 在运行时验证原型，拒绝循环层级、无效父节点和悬空页面跳转。
- [sample/backpack.gameflow.json](../sample/backpack.gameflow.json) 是可由自定义编辑器直接打开的最小示例。生成新的 `*.gameflow.json` 文件即可在同一编辑器中继续手动修改。
- [shared/editor-ops.ts](../shared/editor-ops.ts) 集中处理父局部坐标、子树复制删除及换父级语义，后续 Agent 应用建议应复用这些规则。
- [shared/protocol.ts](../shared/protocol.ts) 中的 `baseVersion` 是当前宿主事务校验，不是跨重启持久版本号。

## 建议的生成流程

1. 用户选择策划文档和希望生成的页面范围。宿主提取内容，保留段落或页码来源。
2. Agent 先输出需求清单，使用 `confirmed` / `inferred` / `question` 标注明确要求、推断与待确认项。来源写入 `requirements[].source`。
3. 生成符合 Schema 的候选文档：`pages` 表示页面和弹窗，`nodes` 表示真实控件层级，`interactions` 表示页面间业务跳转。
4. 宿主校验候选结果，给用户预览新增、修改、删除内容；确认后才作为一个可撤销事务应用。被引用文档中的文字始终作为输入资料，不作为命令执行。
5. 策划继续在画布中编辑同一份结构化数据。Agent 后续修改应保留已有 ID，以便精确描述改动。

## 坐标与表现规则

- 页面 `frame.x/y` 是总览世界坐标。根控件 `frame.x/y` 相对页面，子控件相对父容器。
- `parentId` 只能引用同页的容器或矩形，不能形成循环。数组中的兄弟顺序决定绘制层级，后面的控件更靠前。
- `text` 是显示内容，`name` 是编辑器层级中的控件名称，两者可以不同。
- 文字默认透明且无描边。按钮、图片等使用各自默认外观，`style` 可以局部覆盖。
- 图片使用最多 5 MB 的 PNG/JPEG/WebP/GIF data URI。当前不接受远程资源 URL 或可执行内容。

## 后续协作所需的新工作项

在实现真实 Agent 之前，应新增 SDD，定义持久 revision、候选建议的差异格式与审批、逐节点需求引用、人工修改保护标记、冲突检测和取消语义。`locked` 当前只表示编辑器锁定，不等于已实现 Agent 保护。不得将旧版本的全量 AI 结果覆盖到用户已继续编辑的文档上。
