import { registerClassAlias } from "./class-alias";
import { UIBox } from "./ui-box";

/** @internal 单选组与成员之间的选择提交协议。 */
export interface UIRadioSelectionGroup {
    selectRadio(radio: UIRadio, selected: boolean): void;
    syncRadioSelection(): void;
    removeRadio(radio: UIRadio): void;
}

/** 以显式子节点表达选中外观的单选控件。 */
@registerClassAlias("UIRadio")
@Laya.regClass()
@Laya.classInfo({
    menu: "自定义UI",
    icon: "plugins/type-icons/node/Radio.svg",
    properties: [
        { name: "texture", hidden: true, serializable: false },
        {
            name: "showEditorBorder",
            type: Boolean,
            default: true,
            caption: "显示虚线框",
            catalog: "编辑器",
        },
    ],
})
export class UIRadio extends UIBox {
    private _skin: Laya.Sprite | null = null;
    private _skinVisible = true;
    private _selected = false;
    private _disabled = false;
    private _selectionGroup: UIRadioSelectionGroup | null = null;

    constructor() {
        super();
        this.showEditorBorder = true;
        this.mouseEnabled = true;
        this.hitTestPrior = true;
        this.on(Laya.Event.CLICK, this, this._onClick);
    }

    @Laya.property({
        type: Laya.Sprite,
        nullable: true,
        default: null,
        tips: "拖拽当前控件的直接子节点；选中时显示，未选中时隐藏，可使用图片或复合容器。",
    })
    get skin(): Laya.Sprite | null {
        return this._skin;
    }

    set skin(value: Laya.Sprite | null) {
        this._assertMutable();
        if (value !== null) {
            if (!(value instanceof Laya.Sprite) || value.destroyed || value.parent !== this) {
                throw new TypeError("UIRadio skin must be a live direct Sprite child or null");
            }
        }
        if (value === this._skin) {
            return;
        }
        this._releaseSkin();
        this._skin = value;
        if (value) {
            this._skinVisible = value.visible;
            value.on(Laya.Event.REMOVED, this, this._releaseSkin);
            value.visible = this._selected;
        }
    }

    @Laya.property({ type: Boolean, default: false })
    get selected(): boolean {
        return this._selected;
    }

    set selected(value: boolean) {
        this._checkState("selected", value);
        if (value === this._selected) {
            return;
        }
        if (this._selectionGroup && !Laya.SerializeUtil.isDeserializing) {
            this._selectionGroup.selectRadio(this, value);
            return;
        }
        this._applySelected(value);
        // 归组成员的反序列化由 onAfterDeserialize 重新提交，不通知中间状态。
        if (!this._selectionGroup) {
            this.event(Laya.Event.CHANGE);
        }
    }

    @Laya.property({ type: Boolean, default: false })
    get disabled(): boolean {
        return this._disabled;
    }

    set disabled(value: boolean) {
        this._checkState("disabled", value);
        this._disabled = value;
        this.mouseEnabled = !value;
    }

    override onAfterDeserialize(): void {
        super.onAfterDeserialize();
        if (this._skin) {
            this._skin.visible = this._selected;
        }
        this.mouseEnabled = !this._disabled;
        this._selectionGroup?.syncRadioSelection();
    }

    /** @internal 预检显式分组关联，不能同时加入两个组。 */
    assertSelectionGroup(group: UIRadioSelectionGroup): void {
        this._assertMutable();
        if (this._selectionGroup && group !== this._selectionGroup) {
            throw new Error("UIRadio already belongs to another selection group");
        }
    }

    /** @internal 由单选组的 options 绑定/解绑，不改变离组成员的选中状态。 */
    setSelectionGroup(group: UIRadioSelectionGroup | null): void {
        if (group) {
            this.assertSelectionGroup(group);
        }
        this._selectionGroup = group;
    }

    /** @internal 仅所属组可提交状态；组在所有成员更新后统一派发 CHANGE。 */
    applyGroupSelection(group: UIRadioSelectionGroup, selected: boolean): boolean {
        this._checkState("selected", selected);
        if (group !== this._selectionGroup) {
            throw new Error("Only the owning selection group can change UIRadio selection");
        }
        return this._applySelected(selected);
    }

    override onPreDestroy(): void {
        this._selectionGroup?.removeRadio(this);
        this._releaseSkin();
        super.onPreDestroy();
    }

    private _onClick(): void {
        if (Laya.LayaEnv.isPlaying && !this._disabled) {
            this.selected = true;
        }
    }

    private _applySelected(value: boolean): boolean {
        const changed = this._selected !== value;
        this._selected = value;
        if (this._skin) {
            this._skin.visible = value;
        }
        return changed;
    }

    private _releaseSkin(): void {
        const skin = this._skin;
        if (!skin) {
            return;
        }
        this._skin = null;
        skin.off(Laya.Event.REMOVED, this, this._releaseSkin);
        if (!skin.destroyed) {
            skin.visible = this._skinVisible;
        }
    }

    private _checkState(name: string, value: boolean): void {
        this._assertMutable();
        if (typeof value !== "boolean") {
            throw new TypeError(`UIRadio ${name} must be a boolean`);
        }
    }

    private _assertMutable(): void {
        if (this.destroyed) {
            throw new Error("Cannot change UIRadio after destroy");
        }
    }
}
