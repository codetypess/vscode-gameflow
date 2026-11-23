const MSDF_SAFE_EXTENSION = "msdf.json";

/** 跟随字体导出图集，并由发布器重写相对 URL，支持重命名与文件哈希。 */
@IEditorEnv.regAssetExporter(["msdf"])
export class MSDFFontExporter extends IEditorEnv.AssetExporter {
    @IEditorEnv.onLoad
    static onLoad(): void {
        // 构建 ZIP 使用引擎安全表还原逻辑路径；预览时不转换下载地址。
        Laya.URL.overrideExtension(["msdf"], MSDF_SAFE_EXTENSION, true);
    }

    override async handleExport(): Promise<void> {
        // IDE 将此映射同时用于物理文件名和生成的 PlayerConfig。
        this.fileExtensionOverrides.msdf = MSDF_SAFE_EXTENSION;
        const data = await IEditorEnv.utils.readJsonAsync(
            EditorEnv.assetMgr.getFullPath(this.asset)
        );
        if (data?.version !== 1 || typeof data.atlas?.url !== "string" || !data.atlas.url) {
            throw new Error(`无效的 MSDF 字体资源：${this.asset.file}`);
        }
        const deps = this.parseLinks([{ obj: data.atlas, prop: "url", url: data.atlas.url }]);
        if (deps.length !== 1) {
            throw new Error(`MSDF 字体图集不存在：${this.asset.file} -> ${data.atlas.url}`);
        }
        this.exportInfo.deps = deps;
        this.exportInfo.contents[0] = { type: "json", data };
    }
}
