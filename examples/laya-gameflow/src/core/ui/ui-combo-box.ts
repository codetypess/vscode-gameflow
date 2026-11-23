import { registerClassAlias } from "./class-alias";
import { LayoutError } from "./layout";
import { UIBox } from "./ui-box";
import { UILabel } from "./ui-label";
import { UIPanel } from "./ui-panel";
import { UIWidget } from "./ui-widget";

const POPUP_Z_ORDER = 1001;

/** 关闭态使用显式子节点，打开时把选项弹到舞台上的下拉框。 */
@registerClassAlias("UIComboBox")
@Laya.regClass()
@Laya.classInfo({
    menu: "自定义UI",
    icon: "plugins/type-icons/node/ComboBox.svg",
    properties: [
        {
            name: "showEditorBorder",
            type: Boolean,
            default: true,
            caption: "显示虚线框",
            catalog: "编辑器",
        },
    ],
})
export class UIComboBox extends UIBox {
    private _textLabel: UILabel | null = null;
    private _textLabelText = "";
    private _labels: string[] = [];
    private _selectedIndex = -1;
    private _defaultLabel = "";
    private _itemHeight = 36;
    private _itemBgColor: string | null = null;
    private _visibleNum = 6;
    private _disabled = false;
    private _isOpen = false;
    private _popup: UIPanel | null = null;
    private _refreshing = false;
    private _pendingLabels: string[] | undefined;
    private _pendingIndex: number | undefined;

    constructor() {
        super();
        this.showEditorBorder = true;
        this.mouseEnabled = true;
        this.hitTestPrior = true;
        this.on(Laya.Event.CLICK, this, this._onClick);
        this.on(Laya.Event.RESIZE, this, this._syncPopup);
        this.on(Laya.Event.UNDISPLAY, this, this._close);
        this.on(Laya.Event.REMOVED, this, this._close);
    }

    override get visible(): boolean {
        return super.visible;
    }

    override set visible(value: boolean) {
        super.visible = value;
        if (value === false && this._isOpen) {
            this._close();
        }
    }

    @Laya.property({
        type: UILabel,
        nullable: true,
        default: null,
        caption: "文本",
        tips: "拖拽当前控件的直接 UILabel 子节点，用于显示当前选项。",
    })
    get textLabel(): UILabel | null {
        return this._textLabel;
    }

    set textLabel(value: UILabel | null) {
        this._assertMutable();
        if (value !== null) {
            if (!(value instanceof UILabel) || value.destroyed || value.parent !== this) {
                throw new TypeError("UIComboBox textLabel must be a live direct UILabel child or null");
            }
        }
        if (value === this._textLabel) {
            return;
        }
        this._releaseTextLabel();
        this._textLabel = value;
        if (value) {
            this._textLabelText = value.text;
            value.on(Laya.Event.REMOVED, this, this._releaseTextLabel);
            if (!Laya.SerializeUtil.isDeserializing) {
                this._syncText();
            }
        }
    }

    @Laya.property({
        type: [String],
        default: [],
        caption: "选项",
        tips: "下拉选项文本。读取结果是副本，修改后需要重新赋值。",
    })
    get labels(): string[] {
        return this._labels.slice();
    }

    set labels(value: readonly string[]) {
        this._assertMutable();
        const labels = this._copyLabels(value);
        if (Laya.SerializeUtil.isDeserializing) {
            this._pendingLabels = labels;
            return;
        }
        this._commitLabels(labels, true);
    }

    @Laya.property({
        type: Number,
        default: -1,
        min: -1,
        step: 1,
        fractionDigits: 0,
        caption: "选中索引",
        tips: "从 0 开始，-1 表示未选中。",
    })
    get selectedIndex(): number {
        return this._selectedIndex;
    }

    set selectedIndex(value: number) {
        this._assertMutable();
        this._validateIndex(value);
        if (Laya.SerializeUtil.isDeserializing) {
            this._pendingIndex = value;
            return;
        }
        if (value >= this._labels.length) {
            throw new RangeError("UIComboBox selectedIndex is outside labels");
        }
        if (value === this._selectedIndex) {
            return;
        }
        this._selectedIndex = value;
        this._syncText();
        if (!this.destroyed) {
            this.event(Laya.Event.CHANGE);
        }
    }

    @Laya.property({ hidden: true, serializable: false })
    get selectedLabel(): string {
        return this._selectedIndex >= 0
            ? this._labels[this._selectedIndex]!
            : this._defaultLabel;
    }

    @Laya.property({ type: String, default: "", caption: "默认文本" })
    get defaultLabel(): string {
        return this._defaultLabel;
    }

    set defaultLabel(value: string) {
        this._assertMutable();
        if (typeof value !== "string") {
            throw new TypeError("UIComboBox defaultLabel must be a string");
        }
        if (value === this._defaultLabel) {
            return;
        }
        this._defaultLabel = value;
        if (this._selectedIndex < 0 && !Laya.SerializeUtil.isDeserializing) {
            this._syncText();
        }
    }

    @Laya.property({
        type: Number,
        default: 6,
        min: 1,
        step: 1,
        fractionDigits: 0,
        caption: "可见行数",
    })
    get visibleNum(): number {
        return this._visibleNum;
    }

    set visibleNum(value: number) {
        this._assertMutable();
        if (!Number.isSafeInteger(value) || value < 1) {
            throw new LayoutError("UIComboBox visibleNum must be a positive safe integer");
        }
        if (value === this._visibleNum) {
            return;
        }
        this._visibleNum = value;
        this._syncPopup();
    }

    @Laya.property({
        type: Number,
        default: 36,
        step: 1,
        fractionDigits: 0,
        caption: "条目高度",
    })
    get itemHeight(): number {
        return this._itemHeight;
    }

    set itemHeight(value: number) {
        this._assertMutable();
        if (!Number.isFinite(value) || value <= 0) {
            throw new LayoutError("UIComboBox itemHeight must be a positive finite number");
        }
        if (value === this._itemHeight) {
            return;
        }
        this._itemHeight = value;
        this._syncPopup();
    }

    @Laya.property({
        type: String,
        inspector: "color",
        nullable: true,
        default: null,
        caption: "条目背景",
    })
    get itemBgColor(): string | null {
        return this._itemBgColor;
    }

    set itemBgColor(value: string | null) {
        this._assertMutable();
        if (value !== null && typeof value !== "string") {
            throw new TypeError("UIComboBox itemBgColor must be a string or null");
        }
        if (value === this._itemBgColor) {
            return;
        }
        this._itemBgColor = value;
        this._syncPopup();
    }

    @Laya.property({ type: Boolean, default: false, caption: "禁用" })
    get disabled(): boolean {
        return this._disabled;
    }

    set disabled(value: boolean) {
        this._assertMutable();
        if (typeof value !== "boolean") {
            throw new TypeError("UIComboBox disabled must be a boolean");
        }
        this._disabled = value;
        this.mouseEnabled = !value;
        if (value) {
            this._close();
        }
    }

    @Laya.property({ hidden: true, serializable: false })
    get isOpen(): boolean {
        return this._isOpen;
    }

    set isOpen(value: boolean) {
        this._assertMutable();
        if (typeof value !== "boolean") {
            throw new TypeError("UIComboBox isOpen must be a boolean");
        }
        if (value === this._isOpen) {
            return;
        }
        if (value) {
            this._open();
            return;
        }
        this._close();
    }

    override onAfterDeserialize(): void {
        super.onAfterDeserialize();
        const labels = this._pendingLabels ?? this._labels;
        const index = this._pendingIndex ?? this._selectedIndex;
        this._pendingLabels = undefined;
        this._pendingIndex = undefined;
        this._validateIndex(index);
        if (index >= labels.length) {
            throw new RangeError("UIComboBox selectedIndex is outside labels");
        }
        this._labels = labels;
        this._selectedIndex = index;
        this._syncText();
        this.mouseEnabled = !this._disabled;
    }

    override onPreDestroy(): void {
        this._close();
        this._releaseTextLabel();
        this._pendingLabels = undefined;
        this._pendingIndex = undefined;
        super.onPreDestroy();
    }

    private _open(): void {
        this._assertCanOpen();
        this._isOpen = true;
        this._refreshing = true;
        try {
            this._buildPopup();
            this._bindStage();
        } catch (error) {
            this._close();
            throw error;
        } finally {
            this._refreshing = false;
        }
    }

    private _close(): void {
        if (!this._isOpen && !this._popup) {
            return;
        }
        this._isOpen = false;
        this._unbindStage();
        this._destroyPopup();
    }

    private _syncPopup(): void {
        if (!this._isOpen || this._refreshing) {
            return;
        }
        this._refreshing = true;
        try {
            if (!this._canStayOpen()) {
                this._close();
                return;
            }
            this._destroyPopup();
            this._buildPopup();
        } catch (error) {
            this._close();
            throw error;
        } finally {
            this._refreshing = false;
        }
    }

    private _buildPopup(): void {
        const popup = new UIPanel();
        popup.name = "UIComboBoxPopup";
        popup.hideFlags = Laya.HideFlags.HideAndDontSave;
        popup.mouseEnabled = true;
        const width = this.width;
        const rowHeight = this._itemHeight;
        popup.size(width, 1);
        try {
            for (let index = 0; index < this._labels.length; index++) {
                const item = this._createItem(index);
                popup.addChild(item);
                item.size(width, rowHeight);
                item.layout();
                item.y = index * rowHeight;
            }
            const visibleCount = Math.min(this._visibleNum, this._labels.length);
            popup.scrollType =
                this._labels.length > this._visibleNum
                    ? Laya.ScrollType.Vertical
                    : Laya.ScrollType.None;
            popup.size(width, visibleCount * rowHeight);
            this._placePopup(popup);
            Laya.stage.addChild(popup);
            popup.layout();
            this._popup = popup;
        } catch (error) {
            popup.destroy();
            throw error;
        }
    }

    private _createItem(index: number): UILabel {
        const source = this._textLabel;
        if (!source || source.destroyed) {
            throw new Error("UIComboBox requires textLabel to open");
        }
        const item = new UILabel();
        item.hideFlags = Laya.HideFlags.HideAndDontSave;
        item.mouseEnabled = true;
        this._copyTextStyle(source, item);
        item.text = this._labels[index]!;
        item.bgColor = this._itemBgColor;
        item.on(Laya.Event.CLICK, this, this._onItemClick, [index]);
        return item;
    }

    private _copyTextStyle(source: UILabel, item: UILabel): void {
        item.font = source.font;
        item.fontSize = source.fontSize;
        item.color = source.color;
        item.bold = source.bold;
        item.italic = source.italic;
        item.underline = source.underline;
        item.strikethrough = source.strikethrough;
        item.underlineColor = source.underlineColor;
        item.align = source.align;
        item.valign = source.valign;
        item.alignItems = source.alignItems;
        item.leading = source.leading;
        item.letterSpacing = source.letterSpacing;
        item.stroke = source.stroke;
        item.strokeColor = source.strokeColor;
        item.padding = source.padding;
        item.overflow = source.overflow;
        item.wordWrap = source.wordWrap;
        item.singleCharRender = source.singleCharRender;
    }

    private _placePopup(popup: UIPanel): void {
        const top = this.localToGlobal(new Laya.Point(0, 0));
        const bottom = this.localToGlobal(new Laya.Point(0, this.height));
        const popupHeight = popup.height;
        let y = bottom.y;
        if (bottom.y + popupHeight > Laya.stage.height && top.y - popupHeight >= 0) {
            y = top.y - popupHeight;
        }
        popup.pos(top.x, y);
        popup.zOrder = POPUP_Z_ORDER;
    }

    private _destroyPopup(): void {
        const popup = this._popup;
        if (!popup) {
            return;
        }
        this._popup = null;
        if (popup.destroyed) {
            return;
        }
        try {
            for (const child of [...popup.children]) {
                if (!(child instanceof UIWidget) || child.destroyed) {
                    continue;
                }
                child.off(Laya.Event.CLICK, this, this._onItemClick);
            }
        } finally {
            if (!popup.destroyed) {
                popup.destroy();
            }
        }
    }

    private _bindStage(): void {
        Laya.stage.on(Laya.Event.MOUSE_DOWN, this, this._onStageMouseDown);
        Laya.stage.on(Laya.Event.MOUSE_WHEEL, this, this._onStageMouseWheel);
    }

    private _unbindStage(): void {
        Laya.stage.off(Laya.Event.MOUSE_DOWN, this, this._onStageMouseDown);
        Laya.stage.off(Laya.Event.MOUSE_WHEEL, this, this._onStageMouseWheel);
    }

    private _onClick(): void {
        if (!Laya.LayaEnv.isPlaying || this._disabled) {
            return;
        }
        this.isOpen = !this._isOpen;
    }

    private _onItemClick(index: number, event?: Laya.Event): void {
        event?.stopPropagation();
        if (!this._isOpen || this.destroyed || index < 0 || index >= this._labels.length) {
            return;
        }
        const changed = index !== this._selectedIndex;
        this._selectedIndex = index;
        this._syncText();
        this._close();
        if (changed && !this.destroyed) {
            this.event(Laya.Event.CHANGE);
        }
    }

    private _onStageMouseDown(event?: Laya.Event): void {
        if (!this._isOpen) {
            return;
        }
        const target = event?.target as Laya.Node | null | undefined;
        if (target && (this.contains(target) || (this._popup?.contains(target) ?? false))) {
            return;
        }
        this._close();
    }

    private _onStageMouseWheel(event?: Laya.Event): void {
        if (!this._isOpen) {
            return;
        }
        const target = event?.target as Laya.Node | null | undefined;
        if (target && (this._popup?.contains(target) ?? false)) {
            return;
        }
        this._close();
    }

    private _commitLabels(labels: string[], notify: boolean): void {
        const index =
            this._selectedIndex >= 0 && this._selectedIndex < labels.length
                ? this._selectedIndex
                : -1;
        const changed = index !== this._selectedIndex;
        this._labels = labels;
        this._selectedIndex = index;
        this._syncText();
        this._syncPopup();
        if (notify && changed && !this.destroyed) {
            this.event(Laya.Event.CHANGE);
        }
    }

    private _syncText(): void {
        if (!this._textLabel || this._textLabel.destroyed) {
            return;
        }
        this._textLabel.text = this.selectedLabel;
    }

    private _releaseTextLabel(): void {
        const label = this._textLabel;
        if (!label) {
            return;
        }
        this._textLabel = null;
        label.off(Laya.Event.REMOVED, this, this._releaseTextLabel);
        if (!label.destroyed) {
            label.text = this._textLabelText;
        }
    }

    private _copyLabels(value: readonly string[]): string[] {
        if (!Array.isArray(value)) {
            throw new TypeError("UIComboBox labels must be an array of strings");
        }
        const labels: string[] = [];
        for (const label of value) {
            if (typeof label !== "string") {
                throw new TypeError("UIComboBox labels must be an array of strings");
            }
            labels.push(label);
        }
        return labels;
    }

    private _validateIndex(value: number): void {
        if (!Number.isSafeInteger(value) || value < -1) {
            throw new RangeError("UIComboBox selectedIndex must be -1 or a safe integer index");
        }
    }

    private _assertCanOpen(): void {
        if (!this._canStayOpen()) {
            if (!Laya.LayaEnv.isPlaying) {
                throw new Error("UIComboBox can only open while playing");
            }
            if (this._disabled) {
                throw new Error("UIComboBox cannot open while disabled");
            }
            if (!this._textLabel || this._textLabel.destroyed) {
                throw new Error("UIComboBox requires textLabel to open");
            }
            if (this._labels.length === 0) {
                throw new Error("UIComboBox requires labels to open");
            }
            throw new Error("UIComboBox must be visible on stage to open");
        }
    }

    private _canStayOpen(): boolean {
        return (
            Laya.LayaEnv.isPlaying &&
            !this._disabled &&
            this._textLabel !== null &&
            !this._textLabel.destroyed &&
            this._labels.length > 0 &&
            this.visible &&
            this.displayedInStage
        );
    }

    private _assertMutable(): void {
        if (this.destroyed) {
            throw new Error("Cannot change UIComboBox after destroy");
        }
    }
}
