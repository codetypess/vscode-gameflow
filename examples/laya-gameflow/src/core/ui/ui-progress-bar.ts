import { registerClassAlias } from "./class-alias";
import { LayoutError, type LayoutNodeResult } from "./layout";
import { UIBox } from "./ui-box";
import { UIImage, UIImageBitmap } from "./ui-image";
import { UIWidget } from "./ui-widget";

export type UIProgressBarMode = "horizontal" | "circular";

/** 以显式子节点作为填充，通过宽度或图片网格显示进度。 */
@registerClassAlias("UIProgressBar")
@Laya.regClass()
@Laya.classInfo({
    menu: "自定义UI",
    icon: "plugins/type-icons/node/ProgressBar.svg",
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
export class UIProgressBar extends UIBox {
    private _skin: Laya.Sprite | null = null;
    private _skinBitmap: UIImageBitmap | null = null;
    private _skinWidth = 0;
    private _skinWidthExplicit = false;
    private _skinUseSourceSize = false;
    private _skinReady = false;
    private _syncingSkin = false;
    private _mode: UIProgressBarMode = "horizontal";
    private _min = 0;
    private _max = 1;
    private _value = 0;

    constructor() {
        super();
        this.showEditorBorder = true;
        this.on(Laya.Event.RESIZE, this, this._syncSkin);
    }

    @Laya.property({
        type: Laya.Sprite,
        nullable: true,
        default: null,
        tips: "直接子节点作为填充；宽度由进度条内容区及进度管理，根不设相对布局。进度条需显式或拉伸宽度。圆形仅支持 UIImage / Image，按整图绘制。",
    })
    get skin(): Laya.Sprite | null {
        return this._skin;
    }

    set skin(value: Laya.Sprite | null) {
        this._assertMutable();
        if (value !== null) {
            if (!(value instanceof Laya.Sprite) || value.destroyed || value.parent !== this) {
                throw new TypeError(
                    "UIProgressBar skin must be a live direct Sprite child or null"
                );
            }
            if (!Laya.SerializeUtil.isDeserializing) {
                this._checkSkin(value, this.mode);
            }
        }
        if (value === this._skin) {
            return;
        }
        this._releaseSkin();
        this._skin = value;
        if (value) {
            value.on(Laya.Event.REMOVED, this, this._releaseSkin);
            value.on(Laya.Event.RESIZE, this, this._syncSkin);
            value.on(Laya.Event.LOADED, this, this._syncSkin);
        }
        this.requestLayout();
        this._syncSkin();
    }

    @Laya.property({
        type: String,
        default: "horizontal",
        enumSource: [
            { name: "横向", value: "horizontal" },
            { name: "圆形", value: "circular" },
        ],
    })
    get mode(): UIProgressBarMode {
        return this._mode;
    }

    set mode(value: UIProgressBarMode) {
        this._assertMutable();
        if (value !== "horizontal" && value !== "circular") {
            throw new LayoutError(`unsupported UIProgressBar mode: ${String(value)}`);
        }
        if (this._mode === value) {
            return;
        }
        if (this._skin && !Laya.SerializeUtil.isDeserializing) {
            this._checkSkin(this._skin, value);
        }
        this._mode = value;
        this._syncSkin();
    }

    @Laya.property({ type: Number, default: 0 })
    get min(): number {
        return this._min;
    }

    set min(value: number) {
        this._setRange(value, this.max);
    }

    @Laya.property({ type: Number, default: 1 })
    get max(): number {
        return this._max;
    }

    set max(value: number) {
        this._setRange(this.min, value);
    }

    @Laya.property({ type: Number, default: 0 })
    get value(): number {
        return this._value;
    }

    set value(value: number) {
        this._assertMutable();
        if (!Number.isFinite(value)) {
            throw new LayoutError("progress value must be finite");
        }
        this._value = Math.min(this.max, Math.max(this.min, value));
        this._syncSkin();
        this.event(Laya.Event.CHANGE);
    }

    get ratio(): number {
        return (this.value - this.min) / (this.max - this.min);
    }

    override onAfterDeserialize(): void {
        super.onAfterDeserialize();
        this.requestLayout();
        this._syncSkin(true);
    }

    override onPreDestroy(): void {
        this._releaseSkin();
        super.onPreDestroy();
    }

    protected override layoutChildren(result: LayoutNodeResult | null = null): void {
        super.layoutChildren(result);
        this._syncSkin();
    }

    protected override getLayoutChildren(): UIWidget[] {
        return super.getLayoutChildren().filter((child) => child !== this._skin);
    }

    protected override measureHeight(): number {
        return Math.max(
            super.measureHeight(),
            this._getFullSkinBounds().bottom + this.paddingBottom
        );
    }

    private _getFullSkinBounds(): Laya.Rectangle {
        const skin = this._skin;
        const rect = new Laya.Rectangle();
        return skin
            ? Laya.SpriteUtils.transformRect(
                  skin,
                  rect.setTo(0, 0, this.getContentRect().width, skin.height),
                  this,
                  rect
              )
            : rect;
    }

    private _setRange(min: number, max: number): void {
        this._assertMutable();
        if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
            throw new LayoutError("progress max must be greater than min");
        }
        const previous = this._value;
        this._min = min;
        this._max = max;
        this._value = Math.min(max, Math.max(min, previous));
        this._syncSkin();
        if (this._value !== previous) {
            this.event(Laya.Event.CHANGE);
        }
    }

    private _syncSkin(afterDeserialize = false): void {
        const skin = this._skin;
        if (
            !skin ||
            this.destroyed ||
            this._syncingSkin ||
            (Laya.SerializeUtil.isDeserializing && afterDeserialize !== true)
        ) {
            return;
        }
        this._checkSkin(skin, this.mode);
        this._syncingSkin = true;
        try {
            if (!this._skinReady) {
                this._skinWidth = skin.width;
                this._skinWidthExplicit = skin._isWidthSet;
                if (skin instanceof UIImage || skin instanceof Laya.Image) {
                    this._skinUseSourceSize = skin.useSourceSize;
                    this._skinBitmap = this._getImageBitmap(skin);
                }
                this._skinReady = true;
            }
            if (skin instanceof UIImage || skin instanceof Laya.Image) {
                skin.useSourceSize = false;
            }
            const fullWidth = this.getContentRect().width;
            this._skinBitmap?.setCircularFill(this.mode === "circular" ? this.ratio : null);
            this._skinBitmap?.setHorizontalFillWidth(this.mode === "horizontal" ? fullWidth : null);
            skin.width = fullWidth * (this.mode === "horizontal" ? this.ratio : 1);
        } finally {
            this._syncingSkin = false;
        }
    }

    private _releaseSkin(): void {
        const skin = this._skin;
        const bitmap = this._skinBitmap;
        this._skin = null;
        bitmap?.setCircularFill(null);
        bitmap?.setHorizontalFillWidth(null);
        this._skinBitmap = null;
        if (skin) {
            skin.off(Laya.Event.REMOVED, this, this._releaseSkin);
            skin.off(Laya.Event.RESIZE, this, this._syncSkin);
            skin.off(Laya.Event.LOADED, this, this._syncSkin);
            if (!skin.destroyed && this._skinReady) {
                skin.size(
                    (this._skinWidthExplicit ? this._skinWidth : null) as number,
                    (skin._isHeightSet ? skin.height : null) as number
                );
                if (bitmap && !this._skinWidthExplicit) {
                    // 原生 Image 清除显式尺寸后仍把旧 _width 写给 AutoBitmap。
                    bitmap.width = null as unknown as number;
                }
                if (skin instanceof UIImage || skin instanceof Laya.Image) {
                    skin.useSourceSize = this._skinUseSourceSize;
                }
            }
        }
        this._skinReady = false;
    }

    private _checkSkin(skin: Laya.Sprite, mode: UIProgressBarMode): void {
        if (mode === "circular" && !(skin instanceof UIImage) && !(skin instanceof Laya.Image)) {
            throw new LayoutError("UIProgressBar circular skin must be UIImage or Image");
        }
        if (this.widthSource === "measured") {
            throw new LayoutError(
                "UIProgressBar skin requires an explicit or stretched progress width"
            );
        }
        if (
            (skin instanceof UIWidget && skin.hasRelativeLayout) ||
            (skin instanceof Laya.Image &&
                [skin.left, skin.right, skin.top, skin.bottom, skin.centerX, skin.centerY].some(
                    Number.isFinite
                ))
        ) {
            throw new LayoutError("UIProgressBar skin must not have relative layout constraints");
        }
        if (skin.mask) {
            throw new LayoutError("UIProgressBar skin must not have a mask");
        }
        if (
            (skin instanceof UIImage || skin instanceof Laya.Image) &&
            (!(skin.graphics instanceof Laya.AutoBitmap) ||
                (skin === this._skin && this._skinBitmap && skin.graphics !== this._skinBitmap))
        ) {
            throw new LayoutError(
                "UIProgressBar Image skin requires its managed AutoBitmap graphics"
            );
        }
    }

    private _getImageBitmap(skin: UIImage | Laya.Image): UIImageBitmap {
        const original = skin.graphics;
        if (original instanceof UIImageBitmap) {
            return original;
        }
        if (!(original instanceof Laya.AutoBitmap)) {
            throw new LayoutError("UIProgressBar Image skin requires AutoBitmap graphics");
        }
        // 原生 Image 通过 _graphics 的 AutoBitmap 接口访问资源、颜色和尺寸。
        const bitmap = new UIImageBitmap();
        bitmap.width = (skin._isWidthSet ? original.width : null) as number;
        bitmap.height = (skin._isHeightSet ? original.height : null) as number;
        bitmap.color = original.color;
        bitmap.sizeGrid = original.sizeGrid;
        bitmap.uv = original.uv;
        bitmap._offset = original._offset;
        const source = original.source;
        skin.setGraphics(bitmap, true);
        bitmap.source = source;
        return bitmap;
    }

    private _assertMutable(): void {
        if (this.destroyed) {
            throw new LayoutError("Cannot change UIProgressBar after destroy");
        }
    }
}
