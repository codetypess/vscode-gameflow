const WIDGET_PATH = "plugins/LayaAir_Util/font-input.widget";
const FONT_FILTER = "xq.LabelFont";

// Laya 3.4 的 FontInput 未导出类型；该 widget 的原生脚本继承 gui.Label。
type FontInput = gui.Label & {
    editable: boolean;
    readonly assetInfo: IEditor.IAssetInfo | null;
    allowInternalAssets: boolean;
    allowInternalGUIAssets: boolean;
};

/** 复用原生 FontInput，扩展资源选择与拖放，使同一个 font 字段支持 MSDF。 */
@IEditor.inspectorField("xq.Font")
export class FontInspector extends IEditor.PropertyField {
    private _input!: FontInput;
    private _select!: gui.Button;
    private _selectSysFont!: gui.Button;
    private _readOnly = false;
    private _revision = 0;

    @IEditor.onLoad
    static async onLoad(): Promise<void> {
        Editor.extensionManager.setFileType(["msdf"], IEditor.AssetType.Json);
        await gui.UIPackage.resourceMgr.load(WIDGET_PATH);
    }

    override create(): IEditor.IPropertyFieldCreateResult {
        const row = gui.UIPackage.createWidgetSync(WIDGET_PATH);
        const input = row.getChild("input");
        if (
            !(input instanceof gui.Label) ||
            !("editable" in input) ||
            typeof input.editable !== "boolean" ||
            !("assetInfo" in input)
        ) {
            throw new Error(`${WIDGET_PATH} 的 input 必须是 Laya 3.4 原生 FontInput`);
        }
        const select = input.getChild("select");
        const selectSysFont = input.getChild("selectSysFont");
        if (!(select instanceof gui.Button) || !(selectSysFont instanceof gui.Button)) {
            throw new Error(`${WIDGET_PATH} 的 input 必须包含 select 和 selectSysFont 按钮`);
        }
        this._input = input as FontInput;
        this._select = select;
        this._selectSysFont = selectSysFont;
        this._input.allowInternalAssets = this.property.allowInternalAssets ?? true;
        this._input.allowInternalGUIAssets = this.property.allowInternalGUIAssets ?? false;

        // 原生资源筛选写死为 TTF/BitmapFont；其余显示、系统字体、定位及清除继续由原生处理。
        select.offAll("click");
        select.onClick(this._choose, this);
        select.tooltips = "选择字体资源（TTF / BitmapFont / MSDF）";
        input.offAll("native_drop");
        input.on("native_drop", this._drop, this);
        input.on("submit", this._commitNative, this);
        input.on("removed_from_stage", this._invalidate, this);
        this._syncEnabled();
        return { ui: row };
    }

    override refresh(): void {
        this._invalidate();
        const value: unknown = this.target.getValue();
        if (value === null || value === undefined) {
            this._input.text = "";
        } else if (typeof value === "string") {
            // 原生 FontInput 接收 UUID，并自行查询资源名称和图标。
            this._input.text = value.replace(/^res:\/\//, "");
        } else {
            this.displayError("字体必须是字体名或资源地址字符串");
        }
    }

    override makeReadonly(value: boolean): void {
        super.makeReadonly(value);
        this._invalidate();
        this._readOnly = value;
        if (this._input) {
            this._syncEnabled();
        }
    }

    private _commitNative(event: gui.Event): void {
        if (this._readOnly) {
            this.refresh();
            return;
        }
        const value: unknown = event.data;
        if (typeof value !== "string") {
            this._reportError(new Error("FontInput 提交值必须是字符串"));
            return;
        }
        if (IEditor.utils.isUUID(value)) {
            const asset = this._input.assetInfo;
            if (!asset || asset.id !== value) {
                this._reportError(new Error(`字体资源不存在：${value}`));
                return;
            }
            this._setValue(`res://${asset.id}`);
        } else {
            this._setValue(value);
        }
    }

    private async _choose(event: gui.Event): Promise<void> {
        event.stopPropagation();
        if (this._readOnly) {
            return;
        }
        const revision = ++this._revision;
        try {
            const dialog = await Editor.getDialog(IEditor.SelectResourceDialog);
            if (!this._isCurrent(revision)) {
                return;
            }
            const value = this._input.text;
            await dialog.show(
                this._input,
                IEditor.utils.isUUID(value) ? value : undefined,
                undefined,
                this._input.allowInternalAssets,
                FONT_FILTER,
                this._input.allowInternalGUIAssets
            );
            const asset: IEditor.IAssetInfo | null = await dialog.getResult();
            if (asset && this._isCurrent(revision)) {
                this._setValue(`res://${asset.id}`);
            }
        } catch (error) {
            if (this._isCurrent(revision)) {
                this._reportError(error);
            }
        }
    }

    private async _drop(event: gui.Event): Promise<void> {
        const data = (event.data as DataTransfer).getData("asset");
        if (!data) {
            return;
        }
        event.stopPropagation();
        if (this._readOnly) {
            return;
        }
        const revision = ++this._revision;
        try {
            const [asset] = await Editor.assetDb.filter(
                [data.split(",")[0]], undefined, undefined, FONT_FILTER
            );
            if (!this._isCurrent(revision)) {
                return;
            }
            if (!asset) {
                throw new Error("请选择 TTF、BitmapFont 或 MSDF 字体资源");
            }
            this._setValue(`res://${asset.id}`);
        } catch (error) {
            if (this._isCurrent(revision)) {
                this._reportError(error);
            }
        }
    }

    private _setValue(value: string): void {
        if (!this.target.setValue(value)) {
            this.displayError("字体未通过属性校验");
        }
        this.refresh();
    }

    private _reportError(error: unknown): void {
        this.displayError(error instanceof Error ? error.message : String(error));
        this.refresh();
    }

    private _invalidate(): void {
        this._revision++;
    }

    private _isCurrent(revision: number): boolean {
        return !this._readOnly && revision === this._revision;
    }

    private _syncEnabled(): void {
        this._input.enabled = !this._readOnly;
        this._input.editable = !this._readOnly;
        this._select.enabled = !this._readOnly;
        this._selectSysFont.enabled = !this._readOnly;
    }
}
