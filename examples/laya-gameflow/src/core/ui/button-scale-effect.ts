const REST = 0;
const PRESSED = 1;
const RELEASING = 2;

/** 挂到 2D 节点上后，按下按倍数缩放，松开或移出后回到唤醒时的缩放。 */
@Laya.regClass()
@Laya.classInfo({
    menu: "ButtonEffects",
    caption: "ButtonScaleEffect",
    worldType: "2d",
})
export class ButtonScaleEffect extends Laya.Script {
    declare owner: Laya.Sprite;

    private _scaleX = 0.9;
    private _scaleY = 0.9;
    private _duration = 300;
    private _parentComp: ButtonScaleEffect | null = null;
    private _ownerScaleX = 1;
    private _ownerScaleY = 1;
    private _curState = REST;
    private _curTween: Laya.Tween | null = null;

    isActive = true;

    @Laya.property({
        type: Number,
        default: 0.9,
        step: 0.01,
        fractionDigits: 2,
        caption: "横向缩放",
        tips: "按下后的横向倍数，相对唤醒时的缩放。",
    })
    get scaleX(): number {
        return this._scaleX;
    }

    set scaleX(value: number) {
        this._checkScale("scaleX", value);
        this._scaleX = value;
    }

    @Laya.property({
        type: Number,
        default: 0.9,
        step: 0.01,
        fractionDigits: 2,
        caption: "纵向缩放",
        tips: "按下后的纵向倍数，相对唤醒时的缩放。",
    })
    get scaleY(): number {
        return this._scaleY;
    }

    set scaleY(value: number) {
        this._checkScale("scaleY", value);
        this._scaleY = value;
    }

    @Laya.property({
        type: Number,
        default: 300,
        min: 0,
        step: 1,
        fractionDigits: 0,
        caption: "时长",
        tips: "按下和回弹的毫秒数。",
    })
    get duration(): number {
        return this._duration;
    }

    set duration(value: number) {
        if (this.destroyed) {
            throw new Error("Cannot set ButtonScaleEffect duration after destroy");
        }
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
            throw new TypeError("ButtonScaleEffect duration must be a finite number at least 0");
        }
        this._duration = value;
    }

    @Laya.property({ type: ButtonScaleEffect, caption: "父级效果", nullable: true })
    get parentComp(): ButtonScaleEffect | null {
        return this._parentComp;
    }

    set parentComp(value: ButtonScaleEffect | null) {
        if (this.destroyed) {
            throw new Error("Cannot set ButtonScaleEffect parentComp after destroy");
        }
        if (value === null) {
            this._parentComp = null;
            return;
        }
        if (!(value instanceof ButtonScaleEffect) || value.destroyed || value === this) {
            throw new TypeError(
                "ButtonScaleEffect parentComp must be another live ButtonScaleEffect or null"
            );
        }
        this._parentComp = value;
    }

    get targetScaleX(): number {
        return this._ownerScaleX * this._scaleX;
    }

    get targetScaleY(): number {
        return this._ownerScaleY * this._scaleY;
    }

    override onAwake(): void {
        super.onAwake();
        if (!(this.owner instanceof Laya.Sprite)) {
            throw new TypeError("ButtonScaleEffect requires a Sprite owner");
        }
        this._ownerScaleX = this.owner.scaleX;
        this._ownerScaleY = this.owner.scaleY;
        this.owner.on(Laya.Event.MOUSE_DOWN, this, this._toChangedState);
        this.owner.on(Laya.Event.MOUSE_UP, this, this._toInitState);
        this.owner.on(Laya.Event.MOUSE_OUT, this, this._toInitState);
    }

    override onDestroy(): void {
        this._cancelTween();
        const owner = this.owner;
        if (owner && !owner.destroyed) {
            owner.off(Laya.Event.MOUSE_DOWN, this, this._toChangedState);
            owner.off(Laya.Event.MOUSE_UP, this, this._toInitState);
            owner.off(Laya.Event.MOUSE_OUT, this, this._toInitState);
        }
        super.onDestroy();
    }

    private _toChangedState(): void {
        if (!Laya.LayaEnv.isPlaying || this.destroyed) {
            return;
        }
        if (this._parentComp) {
            this._parentComp.isActive = false;
        }
        if (!this.isActive || this._curState === PRESSED) {
            return;
        }
        this.owner.scale(this._ownerScaleX, this._ownerScaleY);
        this._curState = PRESSED;
        this._tweenTo(this.targetScaleX, this.targetScaleY);
    }

    private _toInitState(): void {
        if (!Laya.LayaEnv.isPlaying || this.destroyed) {
            return;
        }
        if (this._parentComp) {
            this._parentComp.isActive = true;
        }
        if (this._curState === RELEASING) {
            return;
        }
        this._curState = RELEASING;
        this._tweenTo(this._ownerScaleX, this._ownerScaleY);
    }

    private _tweenTo(scaleX: number, scaleY: number): void {
        this._cancelTween();
        const tween = Laya.Tween.create(this.owner, this).duration(this._duration);
        this._curTween = tween;
        tween
            .to("scaleX", scaleX)
            .to("scaleY", scaleY)
            .ease("backOut")
            .then(() => {
                if (this.destroyed || this._curTween !== tween) {
                    return;
                }
                this._curTween = null;
                this._curState = REST;
            });
    }

    private _cancelTween(): void {
        const tween = this._curTween;
        this._curTween = null;
        tween?.kill(false);
    }

    private _checkScale(name: string, value: number): void {
        if (this.destroyed) {
            throw new Error(`Cannot set ButtonScaleEffect ${name} after destroy`);
        }
        if (typeof value !== "number" || !Number.isFinite(value) || !(value > 0)) {
            throw new TypeError(`ButtonScaleEffect ${name} must be a finite number greater than 0`);
        }
    }
}
