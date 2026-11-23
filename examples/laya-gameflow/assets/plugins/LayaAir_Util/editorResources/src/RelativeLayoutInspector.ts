const WIDGET_PATH = "plugins/LayaAir_Util/relative-layout.widget";
const CONSTRAINTS = ["left", "centerX", "right", "top", "centerY", "bottom"] as const;
type Constraint = (typeof CONSTRAINTS)[number];
type ConstraintField = {
    name: Constraint;
    property: Readonly<IEditor.FPropertyDescriptor>;
    input: IEditor.NumericInput;
    text: gui.TextInput;
    unitLabel: gui.TextField;
    unitBackground: gui.Shape;
    checkbox: gui.Button;
    guide: gui.Shape;
    value: unknown;
    draft: string | null;
    revision: number;
    pending: boolean;
};

/** 六个相对约束共用父子框示意图，成员属性继续独立保存。 */
@IEditor.inspectorField("xq.RelativeLayout")
export class RelativeLayoutInspector extends IEditor.PropertyField {
    private readonly _fields: ConstraintField[] = [];
    private _panel!: gui.Widget;
    private _readOnly = false;
    private _data: unknown;
    private _nodeId: unknown;
    private _layoutUnit: unknown;

    @IEditor.onLoad
    static async onLoad(): Promise<void> {
        await gui.UIPackage.resourceMgr.load(WIDGET_PATH);
    }

    override create(): IEditor.IPropertyFieldCreateResult {
        this.watchProps = [...CONSTRAINTS, "layoutUnit"];
        this._panel = gui.UIPackage.createWidgetSync(WIDGET_PATH);
        for (const name of CONSTRAINTS) {
            const property = this.target.getProperty(name);
            const input = this._panel.getChild(`${name}Value`);
            const text = this._panel.getChildByPath(`${name}Value.title`);
            const unitLabel = this._panel.getChildByPath(`${name}Value.title2`);
            const unitBackground = this._panel.getChildByPath(`${name}Value.n8`);
            const checkbox = this._panel.getChild(`${name}Enabled`);
            const guide = this._panel.getChild(`${name}Guide`);
            if (!property) {
                throw new Error(`xq.RelativeLayout 缺少成员属性 ${name}`);
            }
            if (!(input instanceof IEditor.NumericInput) || !(text instanceof gui.TextInput) ||
                !(unitLabel instanceof gui.TextField) || !(unitBackground instanceof gui.Shape) ||
                !(unitBackground.graphics instanceof gui.SRect) ||
                !(checkbox instanceof gui.Button) || !(guide instanceof gui.Shape)) {
                throw new Error(`${WIDGET_PATH} 的 ${name} 控件结构无效`);
            }
            const field: ConstraintField = {
                name, property, input, text, unitLabel, unitBackground, checkbox, guide,
                value: undefined, draft: null, revision: 0, pending: false,
            };
            input.fractionDigits = 0;
            input.step = 1;
            unitBackground.graphics.borderRadius = [0, 5, 5, 0];
            input.on("submit", () => this._commitInput(field));
            // NumericInput 会先格式化；捕获原始输入，避免非法文本被掩盖。
            text.on("changed", () => { field.draft = text.text; });
            text.on("submit", () => this._commitInput(field));
            text.on("focus_out", () => this._commitInput(field));
            checkbox.on("changed", () => this._commitToggle(field));
            this._fields.push(field);
        }
        this.memberProps = this._fields.map((field) => field.property);
        this.refresh();
        return { ui: this._panel, captionDisplay: "normal" };
    }

    override refresh(): void {
        const data = this.target.data;
        const nodeId = this._getNodeId();
        const layoutUnit: unknown = this.target.getPropertyValue("layoutUnit");
        const changedTarget = data !== this._data || nodeId !== this._nodeId ||
            layoutUnit !== this._layoutUnit;
        this._data = data;
        this._nodeId = nodeId;
        this._layoutUnit = layoutUnit;
        const percent = layoutUnit === "percent";
        for (const field of this._fields) {
            const value: unknown = this.target.getPropertyValue(field.name);
            if (changedTarget || !Object.is(value, field.value)) {
                field.revision++;
                field.pending = false;
            }
            field.value = value;
            field.draft = null;
            const hasValue = typeof value === "number" && Number.isFinite(value);
            if (value !== null && value !== undefined && !hasValue) {
                this.displayError(`相对布局 ${field.name} 必须是有限数字或 null`);
            }
            field.input.value = hasValue ? value as number : 0;
            field.text.text = hasValue ? String(value) : "";
            field.unitLabel.text = "%";
            field.unitLabel.visible = percent;
            field.unitBackground.visible = percent;
            field.unitBackground.x = field.input.width - 17;
            field.unitLabel.x = field.input.width - 16;
            field.text.x = 4;
            field.text.width = field.input.width - (percent ? 23 : 8);
            field.checkbox.selected = hasValue || field.pending;
            field.checkbox.enabled = !this._readOnly;
            field.input.visible = hasValue;
            field.input.enabled = !this._readOnly && hasValue;
            field.input.editable = field.input.enabled;
            field.guide.visible = hasValue || (field.name !== "centerX" && field.name !== "centerY");
            field.guide.color = hasValue ? 0x51bd80 : 0x56606c;
        }
    }

    override makeReadonly(value: boolean): void {
        super.makeReadonly(value);
        this._readOnly = value;
        for (const field of this._fields) {
            field.revision++;
            field.pending = false;
        }
        if (this._panel) {
            this.refresh();
        }
    }

    private _commitInput(field: ConstraintField): void {
        if (this._readOnly || typeof field.value !== "number" || !Number.isFinite(field.value)) {
            this.refresh();
            return;
        }
        const text = field.draft?.trim();
        const value = text === undefined ? field.input.value : Number(text);
        if (text === undefined && value === this.target.getPropertyValue(field.name)) {
            this.refresh();
            return;
        }
        if (text === "" || !Number.isInteger(value)) {
            this.displayError("请输入整数");
            this.refresh();
            return;
        }
        if (value !== this.target.getPropertyValue(field.name)) {
            this._setValue(field, value);
        }
        field.draft = null;
    }

    private async _commitToggle(field: ConstraintField): Promise<void> {
        const revision = ++field.revision;
        field.pending = false;
        if (this._readOnly) {
            this.refresh();
            return;
        }
        if (!field.checkbox.selected) {
            if (field.value !== null && field.value !== undefined) {
                this._setValue(field, null);
            } else {
                this.refresh();
            }
            return;
        }
        if (field.value !== null && field.value !== undefined) {
            this.refresh();
            return;
        }
        const data = this.target.data;
        const nodeId = this._getNodeId();
        const layoutUnit: unknown = this.target.getPropertyValue("layoutUnit");
        const current = (): boolean => !this._panel.destroyed && !this._readOnly &&
            field.revision === revision && field.checkbox.selected &&
            this.target.data === data && this._getNodeId() === nodeId &&
            this.target.getPropertyValue("layoutUnit") === layoutUnit &&
            Object.is(this.target.getPropertyValue(field.name), field.value);
        field.pending = true;
        try {
            if (typeof nodeId !== "string" || nodeId.length === 0) {
                throw new Error("当前编辑器节点缺少场景节点 id");
            }
            const value: unknown = await Editor.scene.runNodeScript(
                nodeId, "", "getRelativeLayoutValue", field.name
            );
            if (!current()) {
                return;
            }
            if (typeof value !== "number" || !Number.isFinite(value)) {
                throw new Error(`相对布局 ${field.name} 的计算结果必须是有限数字`);
            }
            field.pending = false;
            this._setValue(field, value);
        } catch (error) {
            if (current()) {
                field.pending = false;
                this.displayError(error instanceof Error ? error.message : String(error));
                this.refresh();
            }
        }
    }

    private _getNodeId(): unknown {
        const node = this.inspector.target as Pick<IEditor.IMyNode, "id"> | null;
        return node?.id;
    }

    private _setValue(field: ConstraintField, value: number | null): void {
        try {
            if (!this.target.datas.every((data) => this.target.validate(data, value, field.property))) {
                this.displayError("相对布局值未通过属性校验");
            } else {
                this.target.setPropertyValue(field.name, value);
            }
        } catch (error) {
            this.displayError(error instanceof Error ? error.message : String(error));
        }
        this.refresh();
    }
}
