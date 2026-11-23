import { registerClassAlias } from "./class-alias";
import { UIBox } from "./ui-box";

/** 以显式子节点表达选中外观的复选控件。 */
@registerClassAlias("UICheckBox")
@Laya.regClass()
@Laya.classInfo({
    menu: "自定义UI",
    icon: "plugins/type-icons/node/CheckBox.svg",
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
export class UICheckBox extends UIBox {
    private _skin: Laya.Sprite | null = null;
    private _skinVisible = true;
    private _selected = false;
    private _disabled = false;

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
                throw new TypeError("UICheckBox skin must be a live direct Sprite child or null");
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
        if (this._selected === value) {
            return;
        }
        this._selected = value;
        if (this._skin) {
            this._skin.visible = value;
        }
        this.event(Laya.Event.CHANGE);
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
    }

    override onPreDestroy(): void {
        this._releaseSkin();
        super.onPreDestroy();
    }

    private _onClick(): void {
        if (Laya.LayaEnv.isPlaying && !this._disabled) {
            this.selected = !this._selected;
        }
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
            throw new TypeError(`UICheckBox ${name} must be a boolean`);
        }
    }

    private _assertMutable(): void {
        if (this.destroyed) {
            throw new Error("Cannot change UICheckBox after destroy");
        }
    }
}
