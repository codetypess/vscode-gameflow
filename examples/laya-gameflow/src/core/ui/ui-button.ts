import { registerClassAlias } from "./class-alias";
import { UIImage } from "./ui-image";

/** 按钮只处理自身图片、命中和状态；文字必须是预制体中的 UILabel 子节点。 */
@registerClassAlias("UIButton")
@Laya.regClass()
@Laya.classInfo({
    menu: "自定义UI",
    icon: "plugins/type-icons/node/Button.svg",
    properties: [{ name: "skin", type: String, default: "", hidden: true, serializable: false }],
})
export class UIButton extends UIImage {
    private _normalSkin = "";
    private _selectedSkin = "";
    private _disabledSkin = "";
    private _disabled = false;
    private _selected = false;
    private _pressed = false;

    constructor() {
        super();
        this.mouseEnabled = true;
        this.hitTestPrior = true;
        this.on(Laya.Event.MOUSE_DOWN, this, this._onMouseDown);
        this.on(Laya.Event.MOUSE_UP, this, this._onMouseUp);
        this.on(Laya.Event.MOUSE_OUT, this, this._onMouseUp);
    }

    @Laya.property({
        type: String,
        default: "",
        inspector: "asset",
        isAsset: true,
        assetTypeFilter: "Image",
    })
    get normalSkin(): string {
        return this._normalSkin;
    }

    set normalSkin(value: string) {
        this._checkSkin(value);
        this._normalSkin = value;
        this._updateSkin();
    }

    @Laya.property({
        type: String,
        default: "",
        inspector: "asset",
        isAsset: true,
        assetTypeFilter: "Image",
    })
    get selectedSkin(): string {
        return this._selectedSkin;
    }

    set selectedSkin(value: string) {
        this._checkSkin(value);
        this._selectedSkin = value;
        this._updateSkin();
    }

    @Laya.property({
        type: String,
        default: "",
        inspector: "asset",
        isAsset: true,
        assetTypeFilter: "Image",
    })
    get disabledSkin(): string {
        return this._disabledSkin;
    }

    set disabledSkin(value: string) {
        this._checkSkin(value);
        this._disabledSkin = value;
        this._updateSkin();
    }

    @Laya.property({ type: Boolean, default: false })
    get disabled(): boolean {
        return this._disabled;
    }

    set disabled(value: boolean) {
        this._disabled = Boolean(value);
        this.mouseEnabled = !this._disabled;
        if (this._disabled) {
            this._pressed = false;
        }
        this._updateSkin();
    }

    @Laya.property({ type: Boolean, default: false })
    get selected(): boolean {
        return this._selected;
    }

    set selected(value: boolean) {
        this._selected = Boolean(value);
        this._updateSkin();
        this.event(Laya.Event.CHANGE);
    }

    get pressed(): boolean {
        return this._pressed;
    }

    private _onMouseDown(): void {
        if (!this.disabled) {
            this._pressed = true;
        }
    }

    private _onMouseUp(): void {
        this._pressed = false;
    }

    private _updateSkin(): void {
        let skin = this._normalSkin;
        if (this._disabled) {
            skin = this._disabledSkin || skin;
        } else if (this._selected) {
            skin = this._selectedSkin || skin;
        }
        super.skin = skin;
    }

    private _checkSkin(value: string): void {
        if (typeof value !== "string") {
            throw new TypeError("UIButton skin must be a string");
        }
        if (this.destroyed) {
            throw new Error("Cannot set UIButton skin after destroy");
        }
    }
}
