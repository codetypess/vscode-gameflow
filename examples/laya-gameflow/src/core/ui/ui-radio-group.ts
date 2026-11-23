import { registerClassAlias } from "./class-alias";
import { UIBox } from "./ui-box";
import { UIRadio, type UIRadioSelectionGroup } from "./ui-radio";

/** 通过显式节点引用管理 UIRadio 的互斥选择，布局沿用 UIBox。 */
@registerClassAlias("UIRadioGroup")
@Laya.regClass()
@Laya.classInfo({
    menu: "自定义UI",
    icon: "plugins/type-icons/node/RadioGroup.svg",
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
export class UIRadioGroup extends UIBox implements UIRadioSelectionGroup {
    private _options: (UIRadio | null | undefined)[] = [];
    private _selectedIndex = -1;
    private _selectedItem: UIRadio | null = null;
    private _pendingOptions: (UIRadio | null | undefined)[] | undefined;
    private _pendingIndex: number | undefined;
    private _updating = false;
    private _selectionDestroyedDuringNotification = false;
    private _disposing = false;

    constructor() {
        super();
        this.showEditorBorder = true;
    }

    @Laya.property({
        type: [UIRadio],
        default: [],
        nullable: false,
        elementProps: { nullable: true },
        caption: "选项",
        tips: "拖入 UIRadio 节点，按数组顺序编号；可放在 HBox/VBox 等容器中，空项不能选中。",
    })
    get options(): (UIRadio | null | undefined)[] {
        return [...this._options];
    }

    set options(value: readonly (UIRadio | null | undefined)[]) {
        this._assertMutable();
        const options = this._validateOptions(value);
        if (Laya.SerializeUtil.isDeserializing) {
            this._pendingOptions = options;
            return;
        }
        this._replaceOptions(
            options,
            this._selectedItem ? options.indexOf(this._selectedItem) : -1,
            true
        );
    }

    @Laya.property({
        type: Number,
        default: -1,
        min: -1,
        step: 1,
        fractionDigits: 0,
        caption: "选中索引",
        tips: "按 options 数组顺序从 0 编号，-1 表示未选中，不能选择空项。",
    })
    get selectedIndex(): number {
        return this._selectedIndex;
    }

    set selectedIndex(value: number) {
        this._assertMutable();
        this._validateInteger(value);
        if (Laya.SerializeUtil.isDeserializing) {
            this._pendingIndex = value;
            return;
        }
        this._setSelection(value, true);
    }

    @Laya.property({ hidden: true, serializable: false })
    get selectedItem(): UIRadio | null {
        return this._selectedItem;
    }

    set selectedItem(value: UIRadio | null) {
        this._assertMutable();
        if (value === null) {
            this.selectedIndex = -1;
            return;
        }
        if (!(value instanceof UIRadio) || value.destroyed || !this._options.includes(value)) {
            throw new TypeError("UIRadioGroup selectedItem must be a live UIRadio option or null");
        }
        this.selectedIndex = this._options.indexOf(value);
    }

    /** @internal UIRadio.selected 的组内选择入口。 */
    selectRadio(radio: UIRadio, selected: boolean): void {
        this._assertMutable();
        const index = this._options.indexOf(radio);
        if (index === -1 || radio.destroyed) {
            throw new Error("UIRadioGroup selection requires a live option");
        }
        if (selected) {
            this.selectedIndex = index;
        } else if (radio === this._selectedItem) {
            this.selectedIndex = -1;
        }
    }

    /** @internal 成员单独恢复属性后重新应用组保存的选择。 */
    syncRadioSelection(): void {
        this._assertMutable();
        this._setSelection(this._selectedIndex, false);
    }

    override onAfterDeserialize(): void {
        super.onAfterDeserialize();
        this._assertMutable();
        const options = this._pendingOptions ?? this._options;
        const index = this._pendingIndex ?? this._selectedIndex;
        this._pendingOptions = undefined;
        this._pendingIndex = undefined;
        this._replaceOptions(this._validateOptions(options), index, false);
    }

    /** @internal 成员销毁时清空引用槽，保留其余项的索引。 */
    removeRadio(radio: UIRadio): void {
        const index = this._options.indexOf(radio);
        if (index === -1) {
            throw new Error("Cannot remove an unregistered UIRadio option");
        }
        this._options[index] = null;
        radio.setSelectionGroup(null);
        if (radio === this._selectedItem) {
            if (this._updating) {
                // 销毁不能因通知重入而留下失效引用；当前通知结束后再通知清空选择。
                this._selectedIndex = -1;
                this._selectedItem = null;
                this._selectionDestroyedDuringNotification = true;
            } else {
                this._setSelection(-1, true);
            }
        }
    }

    override onPreDestroy(): void {
        this._disposing = true;
        for (const item of this._options) {
            item?.setSelectionGroup(null);
        }
        this._options = [];
        this._pendingOptions = undefined;
        this._pendingIndex = undefined;
        this._selectionDestroyedDuringNotification = false;
        this._selectedItem = null;
        this._selectedIndex = -1;
        super.onPreDestroy();
    }

    private _validateOptions(
        value: readonly (UIRadio | null | undefined)[]
    ): (UIRadio | null | undefined)[] {
        if (!Array.isArray(value)) {
            throw new TypeError("UIRadioGroup options must be an array");
        }
        const seen = new Set<UIRadio>();
        for (const item of value) {
            // 原生 Inspector 调整数组长度时会产生未填入的槽位。
            if (item === null || item === undefined) {
                continue;
            }
            if (!(item instanceof UIRadio) || item.destroyed) {
                throw new TypeError("UIRadioGroup options must contain live UIRadio nodes or null");
            }
            if (seen.has(item)) {
                throw new Error("UIRadioGroup options cannot contain duplicate nodes");
            }
            item.assertSelectionGroup(this);
            seen.add(item);
        }
        return [...value];
    }

    private _replaceOptions(
        options: (UIRadio | null | undefined)[],
        index: number,
        notify: boolean
    ): void {
        this._validateIndex(index, options);
        for (const item of this._options) {
            if (item && !options.includes(item)) {
                item.setSelectionGroup(null);
            }
        }
        for (const item of options) {
            item?.setSelectionGroup(this);
        }
        this._options = options;
        this._setSelection(index, notify);
    }

    private _setSelection(index: number, notify: boolean): void {
        this._validateIndex(index, this._options);
        const selected = index === -1 ? null : this._options[index]!;
        const changed = index !== this._selectedIndex || selected !== this._selectedItem;
        this._updating = true;
        try {
            this._selectedIndex = index;
            this._selectedItem = selected;
            const changedItems: UIRadio[] = [];
            for (const item of this._options) {
                if (item?.applyGroupSelection(this, item === selected)) {
                    changedItems.push(item);
                }
            }
            if (notify) {
                for (const item of changedItems) {
                    if (!this._disposing && !item.destroyed) {
                        item.event(Laya.Event.CHANGE);
                    }
                }
                if (changed || this._selectionDestroyedDuringNotification) {
                    do {
                        this._selectionDestroyedDuringNotification = false;
                        if (!this._disposing) {
                            this.event(Laya.Event.CHANGE);
                        }
                    } while (this._selectionDestroyedDuringNotification);
                }
            }
        } finally {
            this._updating = false;
        }
    }

    private _validateInteger(value: number): void {
        if (!Number.isSafeInteger(value) || value < -1) {
            throw new TypeError(
                "UIRadioGroup selectedIndex must be a safe integer greater than or equal to -1"
            );
        }
    }

    private _validateIndex(value: number, options: readonly (UIRadio | null | undefined)[]): void {
        this._validateInteger(value);
        if (value >= options.length) {
            throw new RangeError("UIRadioGroup selectedIndex is outside the member range");
        }
        if (value !== -1 && (options[value] === null || options[value] === undefined)) {
            throw new Error("UIRadioGroup selectedIndex cannot select an empty option");
        }
    }

    private _assertMutable(): void {
        if (this.destroyed || this._disposing) {
            throw new Error("Cannot change UIRadioGroup after destroy");
        }
        if (this._updating) {
            throw new Error("Cannot change UIRadioGroup during selection notification");
        }
    }
}
