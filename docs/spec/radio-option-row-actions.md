# Radio Option Row Actions

Status: Done
Date: 2026-11-16
Scope: 单选组属性面板的成员行操作布局。

## 1. Context and Current Behavior

成员行右侧常驻上移、下移和移除三个按钮，挤占引用框。用户要求删除这些右侧按钮，将删除入口移到序号前并悬停显示。

## 2. Goals and Proposed Behavior

- 移除上移/下移入口；行布局为垃圾桶删除按钮、序号、节点引用框。图标复用 Lucide Trash2，与图层菜单的删除入口一致。
- 删除按钮在该行悬停时显示；键盘焦点进入该行时也显示，仍可通过 Tab 操作。
- 默认保留按钮槽位，显隐不改变序号及引用框位置。
- 删除继续只移除成员槽位、保留节点及其选中状态，可撤销；锁定时禁用。

## 3. Non-Goals

不新增排序手势，不修改成员顺序数据契约、节点树、引用弹窗或持久化。

## 4. Design and Implementation

在 ControlPartsProperties 中移动既有移除按钮，删除上移/下移 JSX；CSS 用 opacity、pointer-events 和 hover/focus-within 控制显示，保持宽度。沿用 setRadioOptions 事务。

## 5. Testing and Acceptance

运行生产构建（含类型检查）和差异空白检查；浏览器验证右侧入口移除、序号前悬停显示、默认隐藏、位置稳定、键盘可达、删除保留节点并可撤销。这是可逆界面调整，不新增镜像 JSX/CSS 的自动化测试。

## 6. Risks and Rollback

避免使用 display:none/visibility:hidden 导致槽位跳动或键盘无法访问。回退仅恢复成员行 JSX/CSS，无数据迁移。

## 7. Verification Record

- 生产构建和 TypeScript 检查通过，保留原有 bundle 大小提示；差异空白检查通过。
- 浏览器中上移/下移按钮数量为 0，行顺序为删除按钮、序号、引用框。离开成员行时两个删除按钮 opacity 均为 0；鼠标移到第二行时为 [0,1]。显隐前后序号和引用框 X 不变。
- Shift+Tab 从引用框进入序号前的删除按钮，按钮正确显示，键盘可达。
- 删除第一个成员后仅剩选项1，选中对象仍为选项1，画布可见节点数维持 22；撤销后恢复两个成员及原选中序号 2。已还原验收数据。
- 浏览器无 error/warn；截图 radio-option-row-actions.jpg 展示首行悬停删除按钮及第二行隐藏状态。本次只调整界面，无新增自动化测试，未重复运行共享模型测试。
- 后续按用户要求将删除按钮的 × 换为 14px Trash2 垃圾桶图标，保留无障碍名称、提示及悬停/键盘显示规则；该图标调整执行类型检查和差异空白检查，不重复行为验收。
