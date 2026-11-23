import { registerClassAlias } from "./class-alias";
import { LayoutError, type LayoutNodeResult } from "./layout";
import { UIBox } from "./ui-box";
import { UIWidget } from "./ui-widget";

export type UISliderDirection = "horizontal" | "vertical";

/** 以显式子节点作为滑块，只管理值域、位置与拖动。 */
@registerClassAlias("UISlider")
@Laya.regClass()
@Laya.classInfo({
    menu: "自定义UI",
    icon: "plugins/type-icons/node/HSlider.svg",
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
export class UISlider extends UIBox {
    private _skin: Laya.Sprite | null = null;
    private _skinX = 0;
    private _skinY = 0;
    private _syncingThumb = false;
    private _direction: UISliderDirection = "horizontal";
    private _min = 0;
    private _max = 1;
    private _value = 0;
    private _dragging = false;
    private _dragPointerStart = 0;
    private _dragPositionStart = 0;
    private _dragValueChanged = false;
    private readonly _dragPoint = new Laya.Point();
    private readonly _skinPoint = new Laya.Point();

    constructor() {
        super();
        this.showEditorBorder = true;
        this.mouseEnabled = true;
        this.on(Laya.Event.MOUSE_DOWN, this, this._onMouseDown);
        this.on(Laya.Event.RESIZE, this, this._syncThumb);
    }

    @Laya.property({
        type: Laya.Sprite,
        nullable: true,
        default: null,
        tips: "拖拽当前控件的直接子节点作为滑块；尺寸和外观由子节点配置，位置由 UISlider 管理。滑块根不设置相对布局约束。",
    })
    get skin(): Laya.Sprite | null {
        return this._skin;
    }

    set skin(value: Laya.Sprite | null) {
        this._assertMutable();
        if (value !== null) {
            if (!(value instanceof Laya.Sprite) || value.destroyed || value.parent !== this) {
                throw new TypeError("UISlider skin must be a live direct Sprite child or null");
            }
            this._checkSkinLayout(value);
        }
        if (value === this._skin) {
            return;
        }
        this._releaseSkin();
        this._skin = value;
        if (value) {
            this._skinX = value.x;
            this._skinY = value.y;
            value.on(Laya.Event.REMOVED, this, this._releaseSkin);
            value.on(Laya.Event.RESIZE, this, this._syncThumb);
            value.on(Laya.Event.TRANSFORM_CHANGED, this, this._syncThumb);
        }
        this._syncThumb();
        this.requestLayout();
    }

    @Laya.property({
        type: String,
        default: "horizontal",
        enumSource: [
            { name: "横向", value: "horizontal" },
            { name: "纵向", value: "vertical" },
        ],
    })
    get direction(): UISliderDirection {
        return this._direction;
    }

    set direction(value: UISliderDirection) {
        this._assertMutable();
        if (value !== "horizontal" && value !== "vertical") {
            throw new LayoutError(`unsupported UISlider direction: ${String(value)}`);
        }
        if (this._direction === value) {
            return;
        }
        this._direction = value;
        this._syncThumb();
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
        this._setValue(value, true);
    }

    get ratio(): number {
        return (this.value - this.min) / (this.max - this.min);
    }

    override onAfterDeserialize(): void {
        super.onAfterDeserialize();
        this.requestLayout();
        this._syncThumb();
    }

    override onPreDestroy(): void {
        this._releaseSkin();
        super.onPreDestroy();
    }

    private _setValue(value: number, emitChange: boolean): boolean {
        this._assertMutable();
        if (!Number.isFinite(value)) {
            throw new LayoutError("slider value must be finite");
        }
        const next = Math.min(this.max, Math.max(this.min, value));
        if (this._value === next) {
            this._syncThumb();
            return false;
        }
        this._value = next;
        this._syncThumb();
        if (emitChange) {
            this.event(Laya.Event.CHANGE);
        }
        return true;
    }

    private _setRange(min: number, max: number): void {
        this._assertMutable();
        if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
            throw new LayoutError("slider max must be greater than min");
        }
        const previous = this._value;
        this._min = min;
        this._max = max;
        this._value = Math.min(this.max, Math.max(this.min, previous));
        this._syncThumb();
        if (this._value !== previous) {
            this.event(Laya.Event.CHANGE);
        }
    }

    protected override layoutChildren(result: LayoutNodeResult | null = null): void {
        super.layoutChildren(result);
        this._syncThumb();
    }

    protected override getLayoutChildren(): UIWidget[] {
        return super.getLayoutChildren().filter((child) => child !== this._skin);
    }

    protected override measureWidth(): number {
        return Math.max(super.measureWidth(), this._getSkinBounds().width);
    }

    protected override measureHeight(): number {
        return Math.max(super.measureHeight(), this._getSkinBounds().height);
    }

    private _getSkinBounds(): Laya.Rectangle {
        const skin = this._skin;
        const rect = new Laya.Rectangle();
        return skin
            ? Laya.SpriteUtils.transformRect(
                  skin,
                  rect.setTo(0, 0, skin.width, skin.height),
                  this,
                  rect
              )
            : rect;
    }

    private get _thumbPosition(): number {
        return this._travelLength * this.ratio;
    }

    private get _travelLength(): number {
        const bounds = this._getSkinBounds();
        const componentLength = this.direction === "horizontal" ? this.width : this.height;
        const thumbLength = this.direction === "horizontal" ? bounds.width : bounds.height;
        return Math.max(0, componentLength - thumbLength);
    }

    private _syncThumb(): void {
        const skin = this._skin;
        if (!skin || this.destroyed || this._syncingThumb) {
            return;
        }
        this._checkSkinLayout(skin);
        this._syncingThumb = true;
        try {
            const { x, y, width, height } = this._getSkinBounds();
            const targetX =
                this.direction === "horizontal"
                    ? Math.max(0, this.width - width) * this.ratio
                    : (this.width - width) * 0.5;
            const targetY =
                this.direction === "vertical"
                    ? Math.max(0, this.height - height) * this.ratio
                    : (this.height - height) * 0.5;
            skin.pos(skin.x + targetX - x, skin.y + targetY - y);
        } finally {
            this._syncingThumb = false;
        }
    }

    private _onMouseDown(event: Laya.Event): void {
        if (!Laya.LayaEnv.isPlaying || this._dragging) {
            return;
        }
        this._syncThumb();
        const point = this._getLocalPointer(event);
        if (!this._isThumbHit(point)) {
            return;
        }
        this._dragging = true;
        this._dragPointerStart = this._getAxisPosition(point);
        this._dragPositionStart = this._thumbPosition;
        this._dragValueChanged = false;
        Laya.stage.on(Laya.Event.MOUSE_MOVE, this, this._onMouseMove);
        Laya.stage.once(Laya.Event.MOUSE_UP, this, this._onMouseUp);
        Laya.stage.once(Laya.Event.MOUSE_OUT, this, this._onMouseUp);
    }

    private _onMouseMove(event: Laya.Event): void {
        if (!this._dragging) {
            return;
        }
        const travelLength = this._travelLength;
        if (travelLength === 0) {
            return;
        }
        const position =
            this._dragPositionStart + this._getPointerPosition(event) - this._dragPointerStart;
        const ratio = Math.min(1, Math.max(0, position / travelLength));
        const value = this.min + ratio * (this.max - this.min);
        this._dragValueChanged = this._setValue(value, true) || this._dragValueChanged;
    }

    private _onMouseUp(): void {
        this._finishDragging(true);
    }

    private _getPointerPosition(event: Laya.Event): number {
        return this._getAxisPosition(this._getLocalPointer(event));
    }

    private _getLocalPointer(event: Laya.Event): Laya.Point {
        return this.globalToLocal(this._dragPoint.setTo(event.stageX, event.stageY));
    }

    private _getAxisPosition(point: Laya.Point): number {
        return this.direction === "horizontal" ? point.x : point.y;
    }

    private _isThumbHit(point: Laya.Point): boolean {
        const skin = this._skin;
        if (
            !skin ||
            !skin.visible ||
            skin.width <= 0 ||
            skin.height <= 0 ||
            skin.scaleX === 0 ||
            skin.scaleY === 0
        ) {
            return false;
        }
        const local = skin.fromParentPoint(this._skinPoint.setTo(point.x, point.y));
        return local.x >= 0 && local.x <= skin.width && local.y >= 0 && local.y <= skin.height;
    }

    private _releaseSkin(): void {
        this._finishDragging(false);
        const skin = this._skin;
        if (!skin) {
            return;
        }
        this._skin = null;
        skin.off(Laya.Event.REMOVED, this, this._releaseSkin);
        skin.off(Laya.Event.RESIZE, this, this._syncThumb);
        skin.off(Laya.Event.TRANSFORM_CHANGED, this, this._syncThumb);
        if (!skin.destroyed) {
            skin.pos(this._skinX, this._skinY);
        }
    }

    private _checkSkinLayout(skin: Laya.Sprite): void {
        if (skin instanceof UIWidget && skin.hasRelativeLayout) {
            throw new LayoutError("UISlider skin must not have relative layout constraints");
        }
    }

    private _assertMutable(): void {
        if (this.destroyed) {
            throw new LayoutError("Cannot change UISlider after destroy");
        }
    }

    private _finishDragging(emitChanged: boolean): void {
        if (!this._dragging) {
            return;
        }
        this._dragging = false;
        Laya.stage.off(Laya.Event.MOUSE_MOVE, this, this._onMouseMove);
        Laya.stage.off(Laya.Event.MOUSE_UP, this, this._onMouseUp);
        Laya.stage.off(Laya.Event.MOUSE_OUT, this, this._onMouseUp);
        if (emitChanged && this._dragValueChanged) {
            this.event(Laya.Event.CHANGED);
        }
        this._dragValueChanged = false;
    }
}
