@IEditorEnv.regAssetImporter(["msdf"], { version: 1 })
export class MSDFFontImporter extends IEditorEnv.AssetImporter {
    @IEditorEnv.onLoad
    static onLoad(): void {
        EditorEnv.assetMgr.customAssetFilters["xq.LabelFont"] = (asset) =>
            asset.type === IEditorEnv.AssetType.TTFFont ||
            asset.type === IEditorEnv.AssetType.BitmapFont ||
            asset.file.toLowerCase().endsWith(".msdf");
    }

    override async handleImport(): Promise<void> {
        const data = await IEditorEnv.utils.readJsonAsync(this.assetFullPath);
        if (data?.version !== 1 || typeof data.atlas?.url !== "string" || !data.atlas.url) {
            throw new Error(`无效的 MSDF 字体资源：${this.asset.file}`);
        }
        this.setSubType("MSDFFont");
    }
}
