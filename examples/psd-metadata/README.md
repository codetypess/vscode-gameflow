# GameFlow PSD 图层元数据测试样例

把整个文件夹发给美术即可。主文件是 **GameFlow-PSD-Metadata-Sample.psd**。

## 文件内容

- 960 × 640、RGB、8 位，游戏登录界面示例。
- 5 个分组、10 个内容图层；标题、提示、按钮文字等 5 层带可编辑文字数据。
- 文字使用「黑体 / SimHei」。没有此字体时，可在 Photoshop 中替换为美术常用字体；请记录替换情况。
- 15 个图层/分组均在 PSD 内附加独立的 GameFlow ID 和 role；按钮底图额外带 state 与九宫格边距示例。
- 图形是普通像素层，文字是文字层；不含智能对象、链接资源或图层特效。
- 本样例用于测试元数据和分层交接，尚未在 Photoshop 中实测打开、保存。

## 美术怎么试

1. 打开 PSD，确认画面与 `preview.png` 大致一致，分组、图层和文字可编辑。
2. 不修改内容，另存为 `01-save-only.psd`，保留图层。这一步单独验证 Photoshop 的基础保存行为。
3. 回到原始样例，将「开始按钮」改名为「进入游戏」，移动这个分组，修改其中「按钮文字」，另存为 `02-edit.psd`。
4. 再复制「开始按钮」分组并改名，新增一个普通图层，另存为 `03-copy.psd`。可以额外测试把分组拖到另一个文档。
5. 解压整个包后，双击 `inspect.html`，在浏览器中选择各份保存后的 PSD，查看读取结果并保存检查报告。检查器不上传文件，不需要安装插件；PSD 图层面板本身通常不显示这些附加属性。
6. 把修改后的 PSD、检查报告以及 Photoshop 的版本号一起交回。截图/PNG 无法替代 PSD 验证元数据。

如果 Photoshop 提示文字需更新、字体缺失或文件格式问题，请记录提示，保留未修改的源文件。测试时使用另存副本。

## 怎么判断结果

| 操作 | 重点观察 |
| --- | --- |
| 直接另存 | 原有 15 个 ID 和附加属性是否保留 |
| 改名、移动、改文字 | 原图层的 GameFlow ID 是否仍相同，属性是否保留 |
| 复制图层/分组 | 副本是否复制相同 ID，或不再有元数据；两种情况都需要记录 |
| 新增普通图层 | 没有 GameFlow ID 是正常的，未来由工具分配 |
| 删除、合并、栅格化 | ID 可能消失或归属变化，不能仅凭名称判定身份 |

检查器默认用 `baseline-data.js` 中的原始对照数据比较。选择 PSD 后，表格显示从所选文件实际读出的数据。出现「原始 ID 未找到」可能表示图层删除，也可能是元数据丢失，需要结合操作判断。副本 ID 重复不等于文件损坏，说明工具需要为副本分配新身份。

## 交付文件

- `GameFlow-PSD-Metadata-Sample.psd`：实际分层 PSD，元数据就在文件内部。
- `preview.png`：原始画面预览。
- `inspect.html`、`metadata-reader.js`、`baseline-data.js`：离线检查器，三个文件放在一起。
- `expected-metadata.json`：原始属性对照、图层树和示例原型节点映射。
- `verification.json`：独立解析器的验证记录。
- `tools/`：仓库内重建/验证脚本；美术交接 ZIP 不需要这些开发脚本。

## 技术记录

这次采用实验格式：图层记录 → Additional Layer Information → `shmd` → 签名 `8BIM`、自定义 key `gflw` → UTF-8 JSON。命名空间为 `com.codetypes.gameflow`，版本为 1，记录文档谱系 ID、8 位图层 ID、role，以及可选 state/slice。它是自定义元数据项，不占用 Photoshop 已有的内建字段，不是已正式注册的第三方格式。

示例设置 metadata item 的 copy-on-sheet-duplication 标志，但该标志不保证所有复制操作的行为，也不会为副本自动生成新 ID。GameFlow 的 8 位字符串 ID 与 Photoshop `lyid` 数字图层 ID 分开；原型节点与图层的映射在外部清单示范，一份按钮可对应多个图层。

`ag-psd@34.2.0` 写入像素/文字/分组，样例脚本扩展其 `shmd` 写入器；标准库不会把我们的自定义 JSON 映射为普通属性。以独立二进制读取器和 `psd-tools@1.10.9` 回读检查，验证文件中确实存在元数据。普通读取库忽略该自定义 key 不等于数据已经丢失，但若用忽略它的库重新写出文件，数据可能被移除。

这些验证不能代替 Photoshop 保存测试；是否作为生产方案，要等美术的版本和实际保存结果。扩展目前没有集成这个示例导出器/检查器。

检查器的解析代码已读取实际 PSD 并通过语法检查；本次内置浏览器因本地 `file:` 地址策略限制无法预览，因此浏览器选择文件/报告下载的交互尚未验收。

## 开发者重建

依赖可安装在临时目录，不需要修改扩展的 package.json：

```powershell
npm install --prefix "$env:TEMP\gameflow-psd-tools" --no-save --package-lock=false --ignore-scripts ag-psd@34.2.0
python -m pip install --target "$env:TEMP\gameflow-psd-python" psd-tools==1.10.9
python examples/psd-metadata/tools/generate-assets.py "$env:TEMP\gameflow-psd-assets"
node examples/psd-metadata/tools/build-sample.cjs "$env:TEMP\gameflow-psd-tools\node_modules" "$env:TEMP\gameflow-psd-assets"
python examples/psd-metadata/tools/verify-independent.py "$env:TEMP\gameflow-psd-python"
```

生成像素需 Pillow 和 Windows 黑体文件。脚本在创建样例时使用内部 API，并非可用于任意 PSD 的通用重写工具。
