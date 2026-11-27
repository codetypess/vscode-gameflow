# Internal extension distribution

部署主机：`bit@macmini.bitserver.wang`。入口：`http://vsix.bitserver.wang/`。服务目录：`/Users/bit/services/vscode-extensions`。

## 用户安装

只安装业务插件的 VSIX。原型工作台启动约 15 秒后、之后每五分钟读取：

```text
http://vsix.bitserver.wang/vscode-gameflow/metadata.json
```

发现新版提示“安装更新 / 稍后”，确认后才下载安装。命令面板提供“原型工作台: 检查更新”和“查看更新日志”，用户设置 `gameflow.checkForUpdates` 可关闭自动检查。插件不主动重载窗口，保存文件后按 VS Code 提示操作。

工作台左上角同步显示绿色「更新插件」，点击就是安装确认。关闭系统通知不清除该按钮；新版生效前暂停工作模式切换，编辑与保存仍可用。接入 Webview 时可复用客户端 `getState / subscribe / install` API；下载地址和包校验仍只由宿主更新模块管理。

0.1.0～0.1.2 需要手动安装一次 0.1.3 或更新版本。旧的独立“Bit 内部插件更新器”可以卸载；它不再是依赖，同时保留可能仍会看到它的旧提示。

## 每个插件一个目录

```text
public/
  vscode-gameflow/
    metadata.json
    0.1.3.vsix
    0.1.4.vsix
  another-plugin/
    metadata.json
    1.0.0.vsix
```

metadata 是可读 JSON，主要字段为 id、version、engines.vscode、url、size、sha256。例如 url 为 `0.1.4.vsix`，相对于 metadata 所在目录。发布器还生成 schemaVersion、displayName、revision 和 Ed25519 signature，无需人工维护摘要与签名。

插件只读自己的 metadata，不枚举其他插件、不请求中央 catalog、不依赖另一个插件。目录名取 package.json 的 name，不同发布者不能使用相同目录名。旧 catalog 和 releases 路径仅保留下载列表及历史兼容。

## 发布

增加版本，执行测试、生产打包和发布：

```powershell
npm version patch --no-git-tag-version
npm test
npm run package:vsix
$releaseVersion = node -p "require('./package.json').version"
$releaseId = node -p "require('./package.json').publisher + '.' + require('./package.json').name"
npm run publish:internal -- --file "dist/packages/$releaseId-$releaseVersion.vsix"
```

发布工具从 VSIX 提取身份、版本、引擎和摘要，通过 SSH 上传。先落盘不可覆盖的 VSIX，再原子替换对应 metadata。新增插件只需：

```powershell
npm run publish:internal -- --file D:/path/to/another-plugin.vsix
```

支持 --host、--root、--channel stable|beta。客户端跟随 stable，beta 不成为升级目标。历史版本不可覆盖。发行包沿用 .vscodeignore 运行文件白名单，不能跳过 vsce 的敏感信息检查。

打包身份直接取源 package.json 的 publisher/name，不根据本机安装列表覆盖 publisher。原型工作台的正式 ID 已改为 `codetypess.vscode-gameflow`。同名插件更换 publisher 时，首次 stable 发布可显式传 `--replace-id codetypes.vscode-gameflow`，在一次有备份的发布事务中转交 metadata 目录；旧 VSIX 保留，目标 ID 必须尚未存在。普通发布继续拒绝不同 publisher 占用同名目录。旧 ID 的客户端保持身份校验，需要安装新 ID 的 VSIX。

## 其他插件照这个模式接入

1. 复用 self-update.cjs、lib.cjs 和同一公开 trust.json；semver/yauzl 通过 esbuild 打入自己的 VSIX。
2. manifest 增加 onStartupFinished，activate 中调用 `activateSelfUpdate(context, "自己的命令前缀")`。对应命令为 `<前缀>.checkForUpdates` 和 `<前缀>.showUpdateLog`，可声明命令和 application 范围的 `<前缀>.checkForUpdates` 设置。
3. 构建参考根目录 esbuild.js，将 trust 通过 define.__UPDATER_TRUST__ 固定到产物。发布后自动使用 `<package.name>/metadata.json`。

实际接入见 src/extension.ts、package.json 和 esbuild.js。无需数据库、上传 API、新建虚拟主机或独立更新器。

## 服务与回退

```sh
cd /Users/bit/services/vscode-extensions
/usr/local/bin/docker compose -p bit-vsix -f deploy/compose.yml ps
curl -f http://127.0.0.1:18081/healthz
```

服务仅监听本机 18081，由主机 Nginx 转发。正常发布只写静态文件，不需要 reload Nginx。回退 stable 或撤下升级目标：

```sh
/opt/homebrew/bin/node tools/publisher.cjs promote --id codetypes.vscode-gameflow --version 0.1.3
/opt/homebrew/bin/node tools/publisher.cjs promote --id codetypes.vscode-gameflow --version none
```

回退产生更高 revision；客户端只提示更高版本，不自动降级。撤下 stable 会移除 metadata，历史 VSIX 保留。

私钥保存在 keys/signing-private.pem，不进入 Git 或公开站点。备份整个服务目录和主机 Nginx 配置；恢复旧内容后通过发布器产生新 revision，不能覆盖成旧签名文件。异常锁需先核实 owner PID 已退出，不能强拆活跃锁。

## 验证

- `npm test`：业务共享测试。
- `npm run test:distribution`：元信息、VSIX、发布、内置检查、确认/取消、失败恢复及 Profile/远端/多窗口边界，兼顾旧目录兼容。
- `npm run build:distribution`：构建服务端发布器和下载页；内置客户端由正常 package:vsix 打包。
- `npm run verify:distribution -- --count 50`：对真实 metadata 和安装包重复验签、大小及摘要校验。通过 --name 和 --id 指定其他插件，--failure-dir 保留失败文件。

容器 Nginx 为静态响应发送 X-Accel-Buffering: no，让主机代理流式传输。该设置修复了大包经代理缓冲路径时偶发片段错位；不要在迁移配置时丢失。客户端始终严格验证摘要，不靠重试隐藏错误。

旧 internal-updater/ 和 smoke.cjs 仅保留历史兼容。当前规则和验收见 docs/spec/embedded-extension-updates.md。
