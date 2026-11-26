# GameFlow First Release Update Test

Status: Superseded
Date: 2026-11-26
Scope: 提供真实 GameFlow 初次安装包和升级目标，通过内部分发服务手工验收新版安装提示。

最新测试改为只安装内置检查的原型工作台 0.1.3，再自动提示 0.1.4，不再安装独立更新器。步骤和证据见 [embedded-extension-updates.md](embedded-extension-updates.md)，以下为旧轮次记录。

## 1. Context and Goals

用户要求生成插件并放到服务器，以实际安装验证更新问题。服务器已有不可覆盖的 GameFlow 0.1.0 和提示确认更新器 0.1.2，目录 revision 为 7。

保留 0.1.0 作为手动安装起点，以已提交的 `55b30990d1966e9d2529a6d20b8648b4ce70e741` 代码构建 GameFlow 0.1.1，发布 stable。初始包和目标包使用同一扩展 ID `codetypes.vscode-gameflow`，测试实际业务插件的版本检查、稍后、确认安装和重载生效。

后续用户要求取消手动加入并将插件更名为“原型工作台”：当前测试组合更新为更新器 0.1.3、初装 GameFlow 0.1.0、目标原型工作台 0.1.2。自动发现规则见 [internal-extension-auto-discovery.md](internal-extension-auto-discovery.md)。下方 0.1.1 的构建记录保留为第一轮发布证据。

## 2. Build and Publication

- 从指定 Git 提交导出独立源码快照；快照仅叠加 0.1.1 的 manifest/lock 版本号，使用 `npm ci --ignore-scripts --no-audit --no-fund` 安装独立锁定依赖。
- 在快照中执行共享测试、生产检查及 VSIX 打包，检查包身份、版本和摘要。通过既有 SSH 发布器上传，不覆盖 0.1.0 或其他历史包。
- 发布后将工作区 manifest/lock 版本同步到 0.1.1，作为后续发布起点。
- 不改动业务编辑器行为；本轮未提交的 PSD 预览等改动保留在工作区，不进入已固定来源的测试包。

## 3. Acceptance and User Steps

1. 从内部服务器下载并手动安装更新器 0.1.3 和 GameFlow 0.1.0。
2. 使用本地 VS Code 普通窗口，确保扩展安装信任提示已处理；已有更高版本时，建议使用隔离 Profile/测试安装目录，避免隐式降级。
3. 更新器会自动识别本机已安装的内部插件，无需手动加入；重载窗口后约 30 秒自动检查，也可用命令面板“Bit 内部插件: 立即检查更新”即时触发。
4. 应提示“原型工作台 0.1.0 → 0.1.2”，提供“安装更新”和“稍后”。
5. 先选“稍后”，已安装版本应保持 0.1.0；再次检查并点击“安装更新”，才开始下载校验和安装。
6. 如 VS Code 提示重载，保存文件后操作，扩展面板显示“原型工作台”0.1.2，ID 保持 `codetypes.vscode-gameflow`；再次检查无可安装升级。

## 4. Verification and Limits

- 独立快照构建中 403 项共享测试通过，TypeScript 检查和生产构建通过，17 项分发测试通过。VSIX 为 14 个文件、4839734 字节，身份为 `codetypes.vscode-gameflow@0.1.1`，SHA-256 为 `485c2ac916ffc287d6ff3ff067ce1f319ac6dbd383ab50d9df89317cd02f6616`。
- 已通过 SSH 发布为 stable，线上签名目录 revision 为 8。工作区 manifest 和 lock 已同步为 0.1.1。
- GameFlow 0.1.0、0.1.1 和更新器 0.1.2 的域名下载均与本地文件逐字节一致，校验签名目录、大小和摘要通过。记录位于忽略的 `dist/release-0.1.1-55b3099/online-verification.json`。
- 初次复用 node_modules junction 时，vsce 的 npm 依赖树检查误判多个依赖；改为快照独立 npm ci 后构建与所有测试通过，主工作区依赖未改变。
- 用户电脑上的提示点击、安装和重载验收仍待实际操作确认，不以服务器下载成功代替。

追加发布：原型工作台 0.1.2 与更新器 0.1.3 已发布，目录 revision 为 10，名称及文件摘要验证通过；403 项共享测试和 18 项分发测试通过。用户截图确认 0.1.0 已安装，现由更新器自动发现并提示，无需额外加入。详细包信息与当前验收见 [internal-extension-auto-discovery.md](internal-extension-auto-discovery.md)。

### Download anomaly under investigation

首次发布后域名下载 0.1.1 出现一次完整长度但摘要不一致：实际 `92e8f659ac02f7c6b422e8205fb486661f8069ca7f7676bffec5af0cfb3911d5`，签名目录预期为上述 `485c…`。服务器磁盘及容器直连下载摘要正确，随后三次域名下载均与本地文件逐字节一致。尚未确认首次异常的根因，未以猜测修改 Nginx 或客户端，不关闭摘要检查。若用户验收再次遇到摘要错误，应保留失败文件，进一步比较传输路径；更新器应继续拒绝不匹配的包。

## 5. Download Links

- 初装起点：[GameFlow 0.1.0](http://vsix.bitserver.wang/releases/codetypes.vscode-gameflow/0.1.0/universal.vsix)
- 更新器：[Bit 内部插件更新器 0.1.3](http://vsix.bitserver.wang/releases/codetypes.internal-updater/0.1.3/universal.vsix)
- 升级目标：[原型工作台 0.1.2](http://vsix.bitserver.wang/releases/codetypes.vscode-gameflow/0.1.2/universal.vsix)

## 6. Rollback

历史包保留；如测试目标异常，可将 stable 指回既有 0.1.0，发布新的签名目录序号。客户端不自动降级，已安装用户需明确手动回退。
