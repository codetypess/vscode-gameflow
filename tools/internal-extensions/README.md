# Internal extension distribution

部署主机：`bit@macmini.bitserver.wang`。暂定入口：`http://vsix.bitserver.wang/`（内网）。服务目录：`/Users/bit/services/vscode-extensions`。

## Install

从站点下载统一更新器，使用 VS Code 扩展面板菜单中的“从 VSIX 安装”。随后运行“Bit 内部插件: 浏览与安装插件”。已有 GameFlow 可选择“加入自动更新”；新插件选择“安装并托管”。仅更新明确托管的插件，更新器本身默认托管。

首版仅支持本地桌面窗口和 universal、独立的插件。不自动安装远端窗口中的插件或依赖包，不主动重载窗口。请保存文档后使用 VS Code 的生效提示。可以在“管理插件”中暂停、仅提示或独立启用自动更新，在插件列表中固定版本或回退。

## Publish GameFlow

安装开发依赖后，先增加 package.json 中的版本号，同版本安装包不可覆盖：

```powershell
npm version patch --no-git-tag-version
npm test
npm run package:vsix
npm run publish:internal -- --file dist/packages/codetypes.vscode-gameflow-0.1.1.vsix
```

示例文件名应与实际版本一致。`package:vsix` 使用 vsce，并通过现有 prepublish 执行生产构建。发行包使用 `.vscodeignore` 白名单，只包含 manifest、README、LICENSE、schema、dist/extension.js 和 dist/webview；其他 dist 调试产物不会进入 VSIX。禁止跳过 vsce 的敏感信息检查。

## Publish another extension

任何仓库生成的标准 universal VSIX 都可以交给同一个工具：

```powershell
npm run publish:internal -- --file D:/path/to/another-extension.vsix
```

ID、版本、引擎范围、摘要与尺寸从 VSIX 自动提取。工具通过 SSH 上传并调用远端发布器，不需要给客户端写权限，也不需要在每个业务插件里加入更新代码。

支持 `--host bit@macmini.bitserver.wang`、`--root /Users/bit/services/vscode-extensions`、`--channel stable|beta`。首版客户端仅跟随 stable。`--hidden` 用于验证探针，不在下载页显示；不会自动装给用户。

## Build the updater

```powershell
npm run test:distribution
npm run package:updater
npm run publish:internal -- --file dist/packages/codetypes.internal-updater-0.1.1.vsix
```

正式发布新版本前修改 `internal-updater/package.json` 的版本号。构建使用 `tools/internal-extensions/trust.json` 中的已固定公钥，不能通过 HTTP 下载一个新公钥并自动信任。该文件只含公钥，不含私钥。

## Server operations

```sh
cd /Users/bit/services/vscode-extensions
/usr/local/bin/docker compose -p bit-vsix -f deploy/compose.yml ps
curl -f http://127.0.0.1:18081/healthz
/usr/local/bin/docker compose -p bit-vsix -f deploy/compose.yml logs --tail 50
```

容器只监听 127.0.0.1:18081，发布目录只读挂载。主机 Nginx 的虚拟主机配置位于 `/opt/homebrew/etc/nginx/servers/vsix.bitserver.wang.conf`，转发到此端口。首次生效需要具有远端 sudo 权限的用户执行：

```sh
sudo /opt/homebrew/bin/nginx -c /opt/homebrew/etc/nginx/nginx.conf -g 'pid /var/run/nginx.pid;' -t
sudo /opt/homebrew/bin/nginx -c /opt/homebrew/etc/nginx/nginx.conf -g 'pid /var/run/nginx.pid;' -s reload
```

该实例的 root 主进程使用 `/var/run/nginx.pid`，不能误用 Homebrew 用户服务的默认 pid 文件。不要重建另一个项目的 gpt-load 容器，也不要启动第二个主机 Nginx 争抢 80 端口。

将 stable 指针移回已有版本或暂时撤下，可在 SSH 会话中执行；目录仍会签名并增加序号，客户端不会自动降级：

```sh
/opt/homebrew/bin/node tools/publisher.cjs promote --id codetypes.vscode-gameflow --version 0.1.0
/opt/homebrew/bin/node tools/publisher.cjs promote --id codetypes.vscode-gameflow --version none
```

已升级用户通过更新器的“固定版本 / 手动回退”明确安装旧版。通常优先发布更高版本的修复包。

## Trust, backup and recovery

目录格式是 `{payload: string, signature: base64}`；Ed25519 签名覆盖 payload 的精确 UTF-8 字节。更新器先验签，再解析、检查单调序号、验证安装包 SHA-256 和包内身份。HTTP 阶段不提供内容保密性；首次安装包通过可信工作区或 SSH 交付。以后加 HTTPS 不取消签名验证。

私钥位于服务端 `keys/signing-private.pem`，目录权限 0700、文件权限 0600，从不挂载到公开站点。完整备份服务目录（包括私钥）和主机 Nginx 配置；备份本身也应保持私有。若丢失私钥，需要通过可信渠道重新交付包含新公钥的更新器，不能自动轮换信任。

所有历史安装包保留，backups 中保留每次目录提交前的已签名版本。客户端拒绝低于已见序号的目录，因此恢复旧目录内容时应通过 promote/新的发布事务产生更高序号，不能只覆盖成旧签名文件。

发布使用 `.publish-lock/owner.json` 串行化目录提交，等锁最多 30 秒。遇到进程中断遗留锁，先核实 owner 中的 PID 已退出，再仅删除该锁目录；不要在仍有发布进程时强拆。包先落盘、目录后提交，中断后遗留的同摘要未引用包允许重试提交。

`restart: unless-stopped` 只保证 Docker 已运行时容器恢复。Mac 断电后能否自动开机、登录和启动 OrbStack，需要按实际无人值守要求单独验收。

## Verification

- `npm test`：GameFlow 原有测试。
- `npm run test:distribution`：签名、路径、平台与包身份、版本兼容、并发发布、重复安装、Profile/远端边界与发行包白名单。
- `tools/internal-extensions/smoke.cjs prepare|install`：在 dist/distribution-smoke 建立隔离的真实 VS Code 验证环境。prepare 生成 0.1.0/0.1.1 探针，install 仅修改该隔离 Profile。端到端结果记录在 result.json。

部署实际状态、测试版本和待办项见 `docs/spec/internal-extension-updates.md`。
