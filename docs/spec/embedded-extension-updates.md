# Embedded Extension Updates

Status: Verifying
Date: 2026-11-26
Scope: 一个 VSIX 内置自身更新检查；每个插件通过自己的 metadata.json 获取版本信息，取消独立更新器安装要求。

## 1. Context and Goals

用户明确要求最简单的使用与接入模式：服务器提供 `http://vsix.bitserver.wang/vscode-gameflow/metadata.json`，插件自己检查。当前独立更新器增加了安装、托管与理解成本，本工作项取代该用户流程。

原型工作台内置共享检查模块，启动约 15 秒后和每五分钟读取自身 metadata，发现新版提示，确认后下载校验并调用 VS Code 安装。不需要其他插件，不需要加入。其他插件复用同一模块和 `<package.name>/metadata.json` 目录规则即可。

## 2. Protocol and Publication

每个插件公开目录为 `<package.name>/`，包含 `metadata.json` 和不可覆盖的 `<version>.vsix`。metadata 是可直接阅读的 JSON：schemaVersion、id、displayName、version、engines.vscode、url（当前目录相对文件名）、size、sha256、revision、signature。保留已有 Ed25519 信任根，对固定顺序的元信息字段签名；客户端内置公钥，不动态信任服务器公钥。

发布器检查 VSIX 的真实身份与版本，落盘安装包，再原子替换单插件 metadata。不同发布者不能抢占同一个插件目录。旧 catalog 与历史下载路径保留兼容；内置客户端不请求 catalog、不枚举其他插件。撤下 stable 时移除对应 metadata，保留历史安装包；回退发布需增加目录序号，客户端不会自动降级。

## 3. Client and User Flow

- 原型工作台增加 onStartupFinished 激活和“检查更新 / 查看更新日志”命令；默认自动检查，可在用户设置 gameflow.checkForUpdates 关闭。工作区设置不能修改更新源或关闭用户的检查设置。
- 每个插件只管理自身 ID，保持原型工作台 ID `codetypes.vscode-gameflow`。VS Code 引擎不兼容或版本相同/更低时不安装。
- 用户点击“安装更新”前不下载 VSIX。关闭提示或选择“稍后”不安装；校验签名、摘要、大小、包内身份、引擎和平台后才交由 VS Code。
- 使用独立状态文件保留已见 revision 和 pending 版本，跨窗口锁防止重复提示/安装；崩溃锁仅在原 PID 已退出时回收。安装失败清理 pending，后续可重试；不主动重载窗口。
- 首版保留本地桌面/正式安装限制；开发、远端窗口不自动安装。旧独立更新器可卸载，且不影响内置检查；同时保留旧更新器时可能仍有其旧提示，不自动替用户卸载。

## 4. Delivery and Tests

- 发布两个真实业务插件版本：0.1.3 为首次内置检查的测试起点，0.1.4 为稳定升级目标。两者来自固定业务源码 55b3099，加本轮命名、启动检查和版本变更；不混入其他正在进行的 PSD 改动。
- 元信息测试覆盖验签、路径、ID、版本/引擎、摘要与旧序号；发布测试覆盖多插件目录、不可覆盖、目录名称冲突及 stable 回退/撤下。
- VM/本地 HTTP 集成测试在没有任何独立更新器 API 的环境中驱动启动检查，覆盖取消/稍后/确认、pending、重启、全局暂停、远端和开发限制、错误签名/安装包、多个窗口竞争。确认请求只访问自己的 metadata 和 VSIX。
- 生产类型检查、共享测试、分发测试与两个 VSIX 打包；线上核对 metadata、版本、名称、签名、VSIX 字节及下载说明。真实用户窗口的弹窗和安装由后续验收确认。

## 5. Acceptance and Rollback

用户仅安装原型工作台 0.1.3，重载后约 30 秒应自动提示 0.1.3 → 0.1.4；点击安装后才更新，无额外更新器或托管操作。服务器 metadata URL 与目录命名可直接给其他插件复用。

历史包保留。回退服务 stable 指针不自动降级已安装用户；旧 0.1.0～0.1.2 没有内置检查，需要一次手动安装 0.1.3 或更新版本。

## 6. Verification

后续多窗口真实验收发现后台窗口提示长期持锁的问题，已在 [self-update-window-focus.md](self-update-window-focus.md) 修复，当前旧 ID 兼容 stable 已升至 0.1.6。下方保留 0.1.3/0.1.4 初始发布记录。

- 固定业务源码快照加本轮内置模块：403 项共享测试、25 项分发测试、两个版本的生产类型检查与 VSIX 打包通过。
- 已发布 0.1.3（内置检查测试起点）和 0.1.4（stable），签名 revision 为 12。两个包均 14 个发行文件，无 extensionDependencies；0.1.3 为 4871059 字节，SHA-256 `16c93011fc3d15e77377b5d5ff4555635e8c2fd320a9751be40d9503db5ea85b`；0.1.4 为 4871060 字节，SHA-256 `2d977fd8b6ff2745a14dc6364b3c2421a69e43b800817e84d01742d90b5da5e7`。
- 正式 metadata URL 为 `http://vsix.bitserver.wang/vscode-gameflow/metadata.json`，已直接读取并验签。两个版本都可通过同目录 `<version>.vsix` 下载，与本地产物逐字节一致；证据位于忽略的 `dist/release-embedded-55b3099/online-verification.json`。
- 原型工作台只访问自己的 metadata 和 VSIX，测试环境没有任何独立更新器 API；启动回调、取消/稍后/确认、重启 pending、暂停、引擎及多窗口锁均有行为验证。
- 用户界面入口和下载页已改为直接下载业务插件；旧独立更新器从下载列表隐藏，历史代码与包保留兼容。示例接入写入 tools/internal-extensions/README.md。
- 实际 VS Code Node 24.22.1 运行时已执行真实下载与签名校验；弹窗点击和 VS Code 安装命令的最终用户窗口验收仍待用户操作，未声称该步骤已实测。

### HTTP transport investigation

部署后下载偶发替换正文的一小段，签名校验正确拒绝。0.1.3 失败副本长度保持 4871059，差异在偏移 1051366～1054285，2910 字节不同；实际内容来自同一文件的更后位置。主机与容器磁盘摘要一致；Node 容器直连 20/20 正确、curl 域名 20/20 正确，但 Node 25 域名 2/20、VS Code Node 24.22.1 域名 2/20 错误，新连接对照 12/50 错误。到达时立即拷贝的数据也错误，排除用户态保留 Buffer 引用被覆盖；排除 Node 大版本和连接复用。

单变量对照确认故障来自主机 Nginx 的缓冲传输路径：只在上游静态服务增加 `X-Accel-Buffering: no` 并重载该容器 Nginx，安装包与客户端代码保持原样，随后 Node 25 和 VS Code Node 24.22.1 各 50 次完整元信息/VSIX 下载校验均零失败。此配置让主机代理直接流式传输，避开代理临时文件/缓冲发送路径；未对 Nginx 内核的具体缺陷作超出证据的归因。

回归工具为 `npm run verify:distribution -- --count 50`，任何摘要失败均返回非零，支持保留失败文件，没有静默重试或跳过摘要。容器配置语法检查通过；旧配置备份为服务端 backups/nginx-before-streaming.conf。12 个临时诊断副本已精确清理，诊断 SSH 隧道已关闭。
