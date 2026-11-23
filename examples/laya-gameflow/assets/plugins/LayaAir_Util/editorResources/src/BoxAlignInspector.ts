const WIDGET_PATH = "plugins/LayaAir_Util/box-align-button.widget";

type AlignAxis = "align" | "valign";
type AlignChoice = { value: string; caption: string; icon: string };
type AlignButton = { axis: AlignAxis; value: string; button: gui.Button };

const HORIZONTAL_CHOICES: readonly AlignChoice[] = [
    { value: "left", caption: "左对齐", icon: "plugins/type-icons/icon/align-start-vertical.svg" },
    { value: "center", caption: "水平居中", icon: "plugins/type-icons/icon/align-center-vertical.svg" },
    { value: "right", caption: "右对齐", icon: "plugins/type-icons/icon/align-end-vertical.svg" },
];
const VERTICAL_CHOICES: readonly AlignChoice[] = [
    { value: "top", caption: "顶部对齐", icon: "plugins/type-icons/icon/align-start-horizontal.svg" },
    { value: "middle", caption: "垂直居中", icon: "plugins/type-icons/icon/align-center-horizontal.svg" },
    { value: "bottom", caption: "底部对齐", icon: "plugins/type-icons/icon/align-end-horizontal.svg" },
];

/** 容器两轴对齐；可选主轴均匀分布，通过标准成员属性提交保存。 */
@IEditor.inspectorField("xq.BoxAlign")
export class BoxAlignInspector extends IEditor.PropertyField {
    private readonly _buttons: AlignButton[] = [];
    private _readOnly = false;

    @IEditor.onLoad
    static async onLoad(): Promise<void> {
        await gui.UIPackage.resourceMgr.load(WIDGET_PATH);
    }

    override create(): IEditor.IPropertyFieldCreateResult {
        const justifyAxis = this.property.options?.justifyAxis;
        if (justifyAxis !== "align" && justifyAxis !== "valign" && justifyAxis !== "none") {
            throw new Error("xq.BoxAlign 必须指定 justifyAxis 为 align、valign 或 none");
        }
        this.watchProps = ["align", "valign"];
        this.memberProps = this.watchProps.map((name) => {
            const property = this.target.getProperty(name);
            if (!property) {
                throw new Error(`xq.BoxAlign 缺少成员属性 ${name}`);
            }
            return property;
        });

        const row = new gui.Widget();
        let cursor = 0;
        for (const axis of ["align", "valign"] as const) {
            const choices = [...(axis === "align" ? HORIZONTAL_CHOICES : VERTICAL_CHOICES)];
            if (axis === justifyAxis) {
                choices.push({
                    value: "justify",
                    caption: axis === "align" ? "水平均匀分布（忽略 gap）" : "垂直均匀分布（忽略 gap）",
                    icon: axis === "align"
                        ? "plugins/type-icons/icon/align-horizontal-space-around.svg"
                        : "plugins/type-icons/icon/align-vertical-space-around.svg",
                });
            }
            for (const choice of choices) {
                const button = gui.UIPackage.createWidgetSync(WIDGET_PATH);
                if (!(button instanceof gui.Button)) {
                    throw new Error(`${WIDGET_PATH} 必须是 gui.Button`);
                }
                button.name = `${axis}.${choice.value}`;
                button.mode = gui.ButtonMode.Radio;
                button.x = cursor;
                button.icon = choice.icon;
                button.tooltips = choice.caption;
                button.enabled = !this._readOnly;
                button.onClick(() => this._commit(axis, choice.value));
                row.addChild(button);
                this._buttons.push({ axis, value: choice.value, button });
                cursor += 22;
            }
            if (axis === "align") {
                cursor += 4;
            }
        }
        row.setSize(cursor - 2, 20);
        return { ui: row };
    }

    override refresh(): void {
        for (const { axis, value, button } of this._buttons) {
            button.selected = this.target.getPropertyValue(axis) === value;
        }
    }

    override makeReadonly(value: boolean): void {
        super.makeReadonly(value);
        this._readOnly = value;
        for (const { button } of this._buttons) {
            button.enabled = !value;
        }
    }

    private _commit(axis: AlignAxis, value: string): void {
        if (!this._readOnly) {
            this.target.setPropertyValue(axis, value);
        }
        this.refresh();
    }
}
