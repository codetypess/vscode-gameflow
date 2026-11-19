# Internal VS Code Extension Updates

Status: Verifying
Date: 2026-11-18
Scope: 在 `bit@macmini.bitserver.wang` 上设计内部 VS Code 扩展分发与自动更新设施，先接入 GameFlow，支持继续增加多个扩展。用户已授权按暂定域名 `vsix.bitserver.wang` 实施部署。

## 1. Context

用户要求内部使用、支持多个插件，并尽量简单。推荐以静态文件站点存放 VSIX 和版本目录，配合一个独立的内部更新器扩展。服务端不需要数据库、上传 API 或业务后端；业务插件不必分别实现联网更新逻辑。

截至 2026-11-18 的只读检查：

- SSH 可用；远端为 Apple Silicon Mac mini，macOS 27.0.1，磁盘可用空间约 637 GiB。
- 已安装 Homebrew Nginx、Node.js 25.2.1、Python 3.9.6、OrbStack/Docker，已有 Jenkins。非交互 SSH 的 PATH 只有系统目录，发布脚本必须设置 PATH 或使用工具绝对路径。
- 已有 Homebrew Nginx 配置、系统级 Nginx 进程，以及 `gpt-load-nginx-1` 容器；容器声明映射主机 80 端口，挂载另一个项目的 Nginx 配置。用户级 Homebrew Nginx 服务报告 error。不能假定这些服务可随意重启，也不能直接覆盖配置。
- `macmini.bitserver.wang` 与 `gpt-load.bitserver.wang` 在远端均解析为 `10.168.69.59`。从远端访问这两个域名的 443 均连接失败；这只证明当前测试路径下未连通，不等于已经全面检查外部入口或所有网卡。
- 本仓库扩展 ID 为 `codetypes.vscode-gameflow`，版本为 `0.1.0`，要求 VS Code `^1.105.0`。已有 build/test 与 `.vscodeignore`，尚无 VSIX 打包、内部发布脚本或更新逻辑。

## 2. Goals

- 用户首次安装一个统一更新器，随后可安装并托管多个内部插件。
- 常规发布只需执行一个发布命令；新增插件不要求修改服务端程序或已有业务插件。
- 自动检查、验证下载并调用 VS Code 安装机制；更新器不主动重载窗口。
- 保留历史版本，支持暂停更新、固定版本与明确的手动回退。
- 静态站点与发布数据独立保存，能够整体备份、迁移和恢复。

## 3. Non-Goals

- 不修改业务编辑器功能；分发设施、发布工具与独立更新器属于本轮实施范围。
- 首版不仿制 Marketplace API，不修改 VS Code 安装目录中的 `product.json`。
- 首版不建设管理后台、账号体系、数据库、定制 VS Code 或 Open VSX 服务。
- 首版不承诺 VS Code Web、VS Code Server、Remote SSH、WSL 或 Dev Containers 中的远端插件更新；这些场景单独验证安装位置后再扩展。
- 首版仅发布独立、universal 的桌面扩展，不处理原生二进制平台包或依赖插件的批量安装顺序。

## 4. Current Behavior

当前 GameFlow 在打开自定义编辑器或执行相关命令时激活，没有版本查询、打包发布或后台更新流程。

VS Code 官方文档说明，通过 VSIX 安装的扩展默认关闭该扩展的自动更新。因此，静态存放 VSIX 本身不能实现本需求中的自动更新。

目前官方也提供 Private Marketplace：具备原生插件搜索、安装与更新体验，可作为无外部数据库的无状态 Docker 容器部署。但客户端要求 VS Code Desktop 1.99+，并登录具备有效 GitHub Enterprise、GitHub Copilot Enterprise 或 GitHub Copilot Business 订阅的账号。当前没有团队已满足这些要求的证据，推荐方案不依赖该资格。如果团队全部满足，应优先重新评估官方方案，以减少自维护客户端逻辑。

## 5. Proposed Behavior

1. 内部下载页提供更新器的 VSIX、安装说明和所有插件的版本列表。用户只需手动安装一次更新器。
2. 更新器暂定 ID 为 `codetypes.internal-updater`，在启动完成后激活；使用原生 Quick Pick 提供插件列表、安装、暂停、固定版本、查看日志和回退操作。
3. 用户选择安装或托管 GameFlow；已有同 ID 的本地安装需要明确加入托管。目录里新增插件不会自动装到所有用户电脑上。
4. 加入托管后默认在启动约 30 秒后检查一次，此后每 6 小时检查。支持立即检查、仅提示和关闭自动更新。
5. 仅升级当前 Profile 内已加入托管且可确认安装位置的插件；版本相同不重复安装，低版本不自动覆盖高版本，不自动开启被禁用的扩展。
6. 校验版本兼容性、文件摘要及包内身份后，通过 VS Code 的 `workbench.extensions.installExtension` 安装本地 VSIX。安装后的生效方式以 VS Code 实际行为为准；如需重启扩展宿主或重载，由用户触发，更新器不主动触发。
7. 更新器自身也在目录中发布并托管；先处理业务插件，最后处理自己的更新，完成后保留待生效状态。
8. 断网或服务停机只影响获取更新，已安装插件继续工作；自动检查失败只记录日志，手动检查时显示可操作的错误。

## 6. Design

### 6.1 Components and Deployment

```text
开发电脑 / 已有 Jenkins
  └─ 校验、打包、SSH 上传、原子发布
       └─ Mac mini 的独立发布目录
            └─ 静态 Nginx 站点：安装页 + catalog.json + VSIX
                 └─ 每台客户端的统一更新器
                      └─ GameFlow / 其他内部插件 / 更新器自身
```

建议远端目录如下；这是计划路径，尚未创建：

```text
/Users/bit/services/vscode-extensions/
  public/
    index.html
    catalog.json
    releases/
      codetypes.vscode-gameflow/0.1.1/universal.vsix
      codetypes.internal-updater/0.1.0/universal.vsix
  staging/
  backups/
  tools/
```

优先新增独立静态站点配置，复用一套已核实的 Nginx 入口。若复用需要改动无关项目的容器，改用独立 `nginx:alpine` 小容器，持久目录只读挂载，内网端口暂定 `18081`，部署时先检查端口占用。发布目录和启动配置独立于 GameFlow 工作树；不把系统 Nginx 和容器 Nginx 都当作必须依赖。

用户明确说明域名与证书尚未配置，暂定 `vsix.bitserver.wang`。本阶段在内网/VPN 使用 HTTP；版本目录采用 Ed25519 签名，公钥随更新器内置，所有包受签名内的 SHA-256 约束。更新器不得从下载站动态信任新公钥。私钥仅保存于远端非公开目录。未来加入 HTTPS 时保留签名验证。HTTP 不提供内容保密性；首次更新器通过当前可信工作区/SSH 交付。写入仅通过 SSH。

`catalog.json` 不使用长缓存，可使用 ETag；不可变版本 VSIX 可以长缓存。读服务没有上传或删除接口。

### 6.2 Catalog and Multiple Extensions

首版维护一个 `schemaVersion: 1` 的目录文件，以完整扩展 ID 为键。一个条目描述插件名称、stable 指针和历史 release 列表。示意如下，摘要为占位值，版本为计划示例：

```json
{
  "schemaVersion": 1,
  "extensions": {
    "codetypes.vscode-gameflow": {
      "displayName": "GameFlow",
      "channels": { "stable": "0.1.1" },
      "releases": [
        {
          "version": "0.1.1",
          "engines": { "vscode": "^1.105.0" },
          "targetPlatform": "universal",
          "path": "releases/codetypes.vscode-gameflow/0.1.1/universal.vsix",
          "sha256": "<64位十六进制摘要>",
          "size": 123456
        }
      ]
    }
  }
}
```

新增插件等于增加新的 ID、release 数据与 VSIX。首版只启用 stable；目录结构保留增加 beta 通道的能力，客户端未选择的通道不会参与更新。真实发布数据中的版本、引擎范围、平台、摘要和尺寸均由安装包提取或计算，不能依靠手填。

### 6.3 Publishing

计划提供统一发布工具，对不同插件复用同一个命令；各仓库只负责常规构建和标准 VSIX 打包。

```text
npm ci → 测试 → vsce package → 发布工具上传 VSIX → 校验远端结果 → 更新 catalog.json
```

- 使用锁定版本的 `@vscode/vsce`；利用现有 `vscode:prepublish` 触发构建，避免重复构建。无需注册公开 Marketplace 账号才能生成 VSIX。
- 发布工具读取 VSIX 的真实扩展 ID、SemVer、engine 和平台，拒绝覆盖已经存在的同 ID / 版本 / 平台文件。
- 通过 SSH 上传到 staging，校验 SHA-256 后移动到同一文件系统下的不可变 release 路径。
- 所有插件的目录提交由同一个服务端短事务持有发布锁：在锁内重新读取现有目录，合并本次条目，再以临时文件和原子 rename 替换 catalog。锁不涵盖耗时构建和上传；并发发布不同插件不会丢失彼此的目录变更。
- 安装包先就位，目录最后更新。中途失败只留下不可达的新包，不能让目录指向未完成上传的文件。
- 首版保留全部已发布 release，并备份每次目录变更；规模增长后再增加清理命令。
- 初期从开发电脑手动发布；之后已有 Jenkins 可调用同一个工具，不引入另一套发布流程。签入源码、触发上线和发布审批策略不在本轮决定。

### 6.4 Client Rules

- 更新器使用 `onStartupFinished`；业务插件不需要调整现有激活条件。
- 更新器按桌面 UI 扩展设计，状态为用户/Profile 范围，更新源与认证不能由工作区设置覆盖。禁止开发模式中的扩展进入自动托管。
- 首版在 Remote SSH、WSL、Dev Containers 等远端窗口停止自动安装，明确提示从本地窗口管理；不能仅凭扩展 ID 猜测本地/远端安装位置。发布正式版前验证本地安装和 Profile 隔离。
- 用 SemVer 和 `engines.vscode` 范围进行比较和兼容判断；不能用字符串或浮点数比较版本。首版拒绝非 universal 包及预发布版本进入 stable。
- 客户端状态包括：托管插件集合、更新模式、固定版本、最近检查、待生效版本和失败退避；本地更新暂停优先于定时任务。用户全局关闭 `extensions.autoUpdate` 时降为仅提示，直到明确选择内部更新器的独立自动更新策略。
- 下载安装顺序执行，同一用户数据目录/Profile 通过跨窗口锁防止重复操作，崩溃后的过期锁可回收。安装成功但尚未生效时记录 pending，避免因宿主仍报告旧版本而重复安装。
- 下载到更新器私有临时目录，限制目录文件大小、VSIX 大小、连接时间和总下载时间；失败清理临时文件并退避。对同一失败版本避免反复弹窗。
- 仅接受用户级配置的 HTTP/HTTPS 源（暂定内网 HTTP）和站内相对下载路径，拒绝目录穿越和跨域重定向；凭据不放 URL、不写日志。
- 安装前验证 SHA-256、尺寸、VSIX 中的 publisher/name/version/engine 和 universal 平台元数据。本阶段用内置公钥验证 Ed25519 签名，再验证签名负载中的 SHA-256；摘要本身不等于签名。保存最大已见目录序号以拒绝回放已见旧目录，不能承诺阻止服务不可达或更新被隐瞒。
- 交由 VS Code 执行真实安装并处理平台策略与必要的信任确认，不自行覆盖扩展安装文件夹，不绕过组织安装限制；自动更新不能解释为绕过 VS Code 的确认或保证全程无交互。
- 仅托管内部发布的 ID；如果同 ID 后来公开发布到 Marketplace，须先确定唯一更新来源，避免两个发布渠道竞争。

### 6.5 Rollback and Operations

- 发现坏版本后，发布方可先移除该版本的 stable 指针，阻止更多用户升级。已经升级的客户端不会因为指针回退就自动降级。
- 客户端通过“安装指定版本/回退”明确选择保留的旧包；也可暂停托管并使用 VS Code 的 Install from VSIX 恢复。通常优先发布更高版本的修复包。
- 服务备份对象为整个发布目录与 Nginx/容器配置；数据目录读写权限与备份恢复需要验收。更新器故障时仍可通过下载页手动安装 VSIX。
- 扩展版本回退不等于业务数据格式回退；GameFlow 若引入文档迁移，仍须独立设计兼容与恢复。
- 首版复用现有机器运行条件。检查显示交流电配置为不休眠，但自动断电恢复未启用；若要求无人值守断电恢复，部署时验证开机后服务与 OrbStack 是否能自动启动，不能只凭容器 restart 策略承诺可用性。

## 7. Implementation Plan

1. **基础分发站点**：创建独立目录、确定 Nginx 入口、建立内网 DNS/HTTPS 与安装说明。退出条件：客户端内网可安全下载一个完整 VSIX，重启服务后数据保留。
2. **发布工具**：增加标准打包和通用 SSH 发布脚本。退出条件：两个不同扩展可连续/并发发布，目录合并正确，中断发布不损坏现有目录，同版本无法覆盖。
3. **统一更新器**：实现插件选择、托管、查询、验证、安装、待生效状态、暂停、固定版本和手动回退。退出条件：GameFlow 升级与第二个测试插件升级均通过真实 Extension Host 验收。
4. **上线收口**：完成失败路径、备份恢复、服务自启动和运行说明。按需接入已有 Jenkins；只有确有远端使用需求时才扩展远端安装能力。

## 8. Testing Plan

- 发布：两个 ID、相同版本拒绝覆盖、摘要失败、上传中断、同时提交目录、异常退出释放锁、备份恢复。
- 目录/客户端：SemVer 排序、引擎不兼容、未知 schema、非法路径、损坏摘要/包身份、stable 不接收预发布、关闭更新、固定版本、低版本指针不降级。
- 真实 VS Code：Windows 与 macOS 本地桌面；首次安装、已有插件加入托管、两个插件独立升级、多窗口并发、pending 防重试、更新器更新自身、Profile 隔离、禁用插件、安装策略拒绝。
- 明确验证远端窗口被阻止自动安装，防止错误安装位置；远端支持不计入首版通过项。
- 编辑器行为：打开有未保存内容的 GameFlow 文档时安装更新，验证更新器不主动重载，记录 VS Code 对更新生效的实际提示；保存后由用户触发生效。
- 运行：内网不可达、HTTPS 证书错误、Basic Auth 失败（如启用）、服务重启、机器重启后的启动条件与恢复。

## 9. Acceptance Criteria

以下为当前实施验收状态；未完成的真实环境检查保留为待验收，不以代码存在代替验证：

- [ ] 内网静态站点提供下载与签名版本目录；域名 DNS 与入口配置状态据实记录。
- [x] 统一更新器 VSIX 已生成并通过真实 VS Code 安装；提供 GameFlow 安装/托管入口。
- [x] 同一发布工具已发布 GameFlow、更新器和隐藏探针，无需修改业务插件。
- [x] Windows VS Code 1.146.0 隔离 Profile 中真实升级探针 0.1.0 → 0.1.1，二次检查不重复安装；更新器无主动重载调用。
- [x] 同一次真实 VS Code 验证中更新器自身 0.1.0 → 0.1.1 成功。
- [ ] 固定版本、暂停、手动回退、断网继续使用、多窗口并发与 pending 行为通过验收。
- [ ] 目录更新原子化、版本包不可变、发布数据可备份恢复。
- [x] 自动检查入口拒绝远端与开发环境，并有自动化边界测试；真实 Remote SSH 手工验收仍在首版范围外。
- [x] 已同步 12-internal-extension-distribution.md，生产构建、333 项既有测试和 10 项新增分发测试通过。

## 10. Risks and Rollback

主要风险是 VS Code 的实际安装/待生效行为与预期不一致、错误判断安装位置、更新源证书未正确配置，以及共享 Nginx 配置影响已有服务。应先用测试 VSIX 在目标桌面版本验证安装命令，再接入 GameFlow；对远端场景明确收窄范围；对入口配置先检查再选择复用或独立容器。

当前方案有一个需要自行维护的客户端更新器。如果团队已满足官方 Private Marketplace 的客户端订阅和登录要求，应优先比较其部署与运维成本。它已经支持原生插件搜索和自动更新，不应基于“VS Code 完全不支持私有市场”的过时前提排除它。

回退部署时可暂停客户端托管并保留已安装插件；关闭新增静态站点不会影响插件本身。发布方恢复已备份的目录只影响后续版本发现，不能替代客户端的明确回退操作。

## References

核对时间：2026-11-18。实施前再次核对目标 VS Code 版本的实际行为。

- VSIX 安装与默认自动更新行为：`https://code.visualstudio.com/docs/configure/extensions/extension-marketplace`
- 内置 VSIX 安装命令：`https://code.visualstudio.com/api/references/commands`
- `onStartupFinished`：`https://code.visualstudio.com/api/references/activation-events`
- 标准打包与 `vsce`：`https://code.visualstudio.com/api/working-with-extensions/publishing-extension`
- 官方 Private Marketplace 的能力及客户端要求：`https://code.visualstudio.com/docs/enterprise/extensions`

## 2026-11-18 Implementation Decisions

- 固定工作目录为 `/Users/bit/services/vscode-extensions`，用独立 Nginx 容器仅绑定 `127.0.0.1:18081`，主机已有 Nginx 新增 `vsix.bitserver.wang` 虚拟主机转发到该端口，不重建其他项目容器。
- 初步检查确认域名尚无解析、443 未配置。主机 Nginx 属于 root，`bit` 无免密 sudo；先完成部署和配置文件，最终 reload 如仍需密码则交付具体命令，由用户在远端执行。
- 目录实际格式为 `{payload: string, signature: base64}`，签名覆盖 payload 的精确 UTF-8 字节；payload 内包括 schemaVersion、单调递增 revision、generatedAt 和各插件 releases/channels。先验签再解析并严格验证。
- 统一更新器仅从内置公钥信任发布者；源 URL 只允许用户级设置。首版只处理 stable/universal、本地桌面与当前 Profile。托管、更新模式与固定版本均为 Profile 状态。
- 发布包内置相同共享验证代码，由 esbuild 打包，服务端只需要已有 Node.js，无额外 npm 安装。发布锁使用原子 mkdir/owner token，允许超时后显式恢复，不在未知进程仍运行时自动强拆。
- 首次发布沿用 GameFlow 0.1.0；更新器 0.1.0，另用不激活的探针扩展验证多插件与升级流程，探针不作为普通用户安装项。
- 不以“静态站点可下载”代替真实 VS Code 安装验证；自动更新和 Profile/远端边界均需实测或明确列为未验收。
## Deployment and Verification Record — 2026-11-18

### Deployed

- 独立容器 `bit-vsix-vsix-1` 已运行且 healthy，绑定 `127.0.0.1:18081`；`/healthz` 返回 200。
- 数据、签名私钥、发布器及静态站点分别位于服务根目录的 public、keys、tools 与 deploy；keys 权限 0700、私钥权限 0600；公开 HTTP 请求私钥路径返回 404。
- 当前已签名目录 revision 为 6：GameFlow 0.1.0；更新器 0.1.0/0.1.1（stable 为 0.1.1）；隐藏探针 0.1.0/0.1.1（仅用于验收）。所有 stable 包的远端实际下载大小及 SHA-256 与签名目录一致。
- Windows 侧已将 vsix.bitserver.wang 解析为 10.168.69.59；Mac 本机解析仍未生效，不影响按 Host 接入的 Nginx 虚拟主机。
- 已创建 `/opt/homebrew/etc/nginx/servers/vsix.bitserver.wang.conf`，配置检查通过。root 主机 Nginx 尚未 reload，因为 `bit` 无免密 sudo。域名正式入口仍待用户执行运行说明中的 sudo reload；不把临时 SSH 转发验证描述成域名上线完成。

### Verification

- `npm test`：333 项既有共享测试通过。
- 生产构建及两个正式 VSIX 打包成功；GameFlow 安装包约 951 KB，更新器 0.1.1 约 34 KB。
- `npm run test:distribution`：10 项测试通过，覆盖签名篡改/错误公钥/旧序号、非法目录与路径、版本兼容、VSIX 身份/平台/依赖、双插件并发提交/禁止覆盖、下载重定向/大小/超时、pending 防重复/Profile 隔离/远端排除、发行包白名单、Windows 路径大小写和通道回退的新序号签名。
- Windows 本机安装的 VS Code 1.146.0，使用隔离 user-data-dir 与 extensions-dir：从真实服务读取签名目录，探针与更新器都由 0.1.0 升至 0.1.1；第二次检查 updated/errors 均为空。证据位于 `dist/distribution-smoke/result.json`，不进入发行包。
- 浏览器经临时 SSH 转发已验证下载页、GameFlow/更新器卡片、最新版本链接与历史版本入口；隐藏探针未显示。转发在验证结束后关闭。

### Issues found and resolved

1. 下载路径正则允许版本段 `..`，即使上层目录校验已拒绝该路径，独立下载地址边界仍应拒绝；改为同时验证路径中的 SemVer，原失败用例通过。
2. 真实 Windows VS Code 将两个安装路径的盘符分别表示为 `D:` 和 `d:`，严格字符串比较误判不同安装根。共享边界按 Windows 路径语义比较，补充大小写与不同目录用例，真实升级验证通过。
3. 既有 `.vscodeignore` 允许整个 dist，vsce 扫描拦截旧调试产物。改为运行文件白名单，并测试每个候选文件都属于 manifest/README/LICENSE/schema/extension.js/webview；未关闭敏感信息扫描，未上传调试文件。

### Remaining manual acceptance

- 用户 reload 主机 Nginx 后，从 Windows 按域名验证首页、目录、安装包和首次安装路径。
- macOS 客户端真实安装、手工操作固定版本/回退、多窗口竞争、编辑器存在未保存文档的安装提示，以及整机重启/备份恢复演练尚未逐项实测，不作为已完成验收项。
- 域名与证书由用户明确暂定；当前为签名保护的内网 HTTP，后续启用 HTTPS 时保留当前签名信任根。