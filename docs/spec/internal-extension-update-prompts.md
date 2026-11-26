# Internal Extension Update Prompts

Status: Done
Date: 2026-11-25
Scope: 内部更新器在发现新版后提示安装，由用户确认；覆盖首次安装、旧设置迁移及更新器自身升级。

## 1. Context and Current Behavior

变更前独立更新器默认 `mode: auto`，后台检查在 VS Code 允许自动更新或旧状态启用 independentAutoUpdate 时直接下载并安装。用户要求手动安装后持续检查新版，但每次更新都应提示安装。

## 2. Goals and Non-Goals

- 自动检查已托管插件，发现兼容的新版后显示名称、当前版本和目标版本，提供“安装更新”和“稍后”。
- 用户确认前只获取并验证版本目录，不下载或安装 VSIX。取消或稍后均保留现有版本。
- 更新器自身执行相同确认流程。旧 `auto` 和 independentAutoUpdate 设置不再绕过确认；已暂停的检查保持暂停。
- 保留签名验证、版本固定、显式回退、Profile 隔离及本地窗口限制。
- 现行流程由 [embedded-extension-updates.md](embedded-extension-updates.md) 更新：业务插件内置自身检查，仅请求自己的 metadata.json，用户确认后安装；不依赖独立更新器，不修改业务编辑器。

## 3. Proposed Behavior and Design

1. 默认模式为 `prompt`，管理界面只提供“自动检查，确认后安装”和“暂停自动检查”。
2. 读取旧状态时，除 `off` 之外的模式统一按 `prompt` 处理，并清除 independentAutoUpdate。后续正常状态写入完成迁移。
3. 启动 30 秒及每 6 小时的后台检查、手动立即检查均使用同一个安装确认。VS Code 全局自动更新设置不能跳过此确认。
4. 确认按钮按本次列出的兼容升级批次生效；确认后再下载、验包并调用 VS Code 安装命令。手动安装/回退菜单已有明确操作意图，保留现有流程。
5. 拒绝后下次常规检查可再次提示；无更新或已有 pending 版本时不重复安装。
6. 更新更新器版本为 0.1.2，构建可交付 VSIX，并同步安装/发布文档及下载页文字。

## 4. Implementation and Testing Plan

- 同步分发基线、更新器状态与确认流程，更新用户可见文案。
- 使用现有 VM/本地 HTTP 测试实际目录验签、确认与安装行为，覆盖拒绝、确认、重复检查、旧 auto 状态、暂停、全局开关及更新器自身。
- 执行 `npm run test:distribution` 和 `npm run package:updater`，检查发行包版本与内容。
- 记录发布结果及任何线上接入限制；生产端验收不以本地测试替代。

## 5. Acceptance Criteria

- 默认配置发现新版会提示；取消/稍后时 VSIX 请求数和安装次数均为零。
- 点击“安装更新”后下载并安装，后续检查不会重复安装 pending 版本。
- 旧 auto/independentAutoUpdate 及 VS Code 全局自动更新开关均无法跳过确认；off 模式后台不检查，手动仍可检查。
- 更新器自身升级也先提示。
- 分发测试通过，0.1.2 VSIX 打包成功，文档与界面行为一致。

## 6. Risks and Rollback

旧版更新器收到 0.1.2 前仍按旧策略运行，可先在“管理插件 → 更新模式”选择“仅提示”。迁移保留托管列表、固定版本、目录序号及 pending 状态。回退旧版可能重新启用旧自动安装默认值，应通过明确的人工安装处理。

## 7. Verification

- 变更前新增测试确认默认及旧 auto 设置会直接安装两个更新；改动后 `npm run test:distribution` 共 17 项通过（11 项顶层测试及 6 个确认策略场景）。
- 场景覆盖全局自动更新开启/关闭、新安装/旧 auto/旧独立自动更新/明确 prompt/off、关闭提示、稍后、确认、更新器自身、升级顺序、pending 防重复和固定版本保留。确认前 HTTP VSIX 请求数和安装次数为零。
- `npm run package:updater` 成功生成 0.1.2，6 个发行文件，35476 字节；包身份和 manifest 版本校验通过。
- 已通过既有 SSH 发布工具发布 0.1.2；线上目录 revision 为 7，stable 指向 0.1.2。通过 `http://vsix.bitserver.wang/` 实际读取并验签目录，下载包与本地产物逐字节一致，SHA-256 为 `891efc086bd7912d04900a727bf8d99d88b06ba213a2006de6d11c201aadfc41`。
- 下载页已原子更新，域名 HTTP 返回 200，包含“新版提示安装”和“确认后才下载安装”说明，无需再次 reload 主机 Nginx。
- 真实 VS Code smoke runner 改为当前更新器加旧探针，由测试窗口人工确认后验证升级；本轮未重新运行该窗口验收。原 0.1.0→0.1.1 真机证据仍仅代表历史自动安装流程，本次确认行为由上述 VM/HTTP 测试验证。
