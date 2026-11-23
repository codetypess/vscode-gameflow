import { registerClassAlias } from "./class-alias";
import { UIView } from "./ui-view";

/** 堆叠窗口；层级和显隐由外部管理器决定。 */
@registerClassAlias("UIStack")
@Laya.regClass()
@Laya.classInfo({ menu: "自定义UI", icon: "plugins/type-icons/node/Root.svg" })
export class UIStack<TArgs = unknown> extends UIView<TArgs> {
    private _fullscreen = false;
    private _autoClose = true;
    private _isModal = false;
    private _isBackdropBlur = true;
    private _isPopupCenter = false;
    private _animationTarget: Laya.Sprite | null = null;
    private _animation: Laya.Tween | null = null;
    private readonly _initPos = new Laya.Point();

    constructor() {
        super();
        this.on(Laya.Event.ADDED, this, this._handleAdded);
        this.on(Laya.Event.REMOVED, this, this._resetAnimation);
    }

    @Laya.property({ type: Boolean, caption: "全屏", default: false })
    get fullscreen(): boolean {
        return this._fullscreen;
    }

    set fullscreen(value: boolean) {
        this._checkBoolean("fullscreen", value);
        this._fullscreen = value;
    }

    /** 供外部关闭流程读取，节点自身不执行关闭。 */
    @Laya.property({ type: Boolean, caption: "自动关闭", default: true })
    get autoClose(): boolean {
        return this._autoClose;
    }

    set autoClose(value: boolean) {
        this._checkBoolean("autoClose", value);
        this._autoClose = value;
    }

    /** 供外部管理流程读取，节点自身不创建遮罩。 */
    @Laya.property({ type: Boolean, caption: "窗口模式", default: false })
    get isModal(): boolean {
        return this._isModal;
    }

    set isModal(value: boolean) {
        this._checkBoolean("isModal", value);
        this._isModal = value;
    }

    /** 由 UIManager 读取，仅对当前有效模态窗口生效。 */
    @Laya.property({
        type: Boolean,
        caption: "背景模糊",
        default: true,
        tips: "窗口模式下模糊背景；关闭后保留背景输入阻挡和自动关闭。",
    })
    get isBackdropBlur(): boolean {
        return this._isBackdropBlur;
    }

    set isBackdropBlur(value: boolean) {
        this._checkBoolean("isBackdropBlur", value);
        this._isBackdropBlur = value;
    }

    @Laya.property({ type: Boolean, caption: "居中弹出", default: false })
    get isPopupCenter(): boolean {
        return this._isPopupCenter;
    }

    set isPopupCenter(value: boolean) {
        this._checkBoolean("isPopupCenter", value);
        this._isPopupCenter = value;
    }

    @Laya.property({
        type: Laya.Sprite,
        caption: "动画节点",
        nullable: true,
        default: null,
        tips: "拖拽当前窗口内的动画节点，入退场时接管其位置和缩放。",
    })
    get animationTarget(): Laya.Sprite | null {
        return this._animationTarget;
    }

    set animationTarget(value: Laya.Sprite | null) {
        this.assertViewMutable();
        if (
            value !== null &&
            (!(value instanceof Laya.Sprite) || value.destroyed || !this.isAncestorOf(value))
        ) {
            throw new TypeError("UIStack animationTarget must be a live Sprite descendant or null");
        }
        if (value === this._animationTarget) {
            return;
        }
        this._releaseAnimationTarget();
        this._animationTarget = value;
        if (value) {
            this._initPos.setTo(value.x, value.y);
            value.on(Laya.Event.REMOVED, this, this._releaseAnimationTarget);
        }
    }

    override animateIn(complete: () => void): void {
        this.assertViewMutable();
        this._cancelAnimation();
        const target = this._animationTarget;
        if (!target) {
            complete();
            return;
        }
        const center = target.parent!.globalToLocal(
            new Laya.Point(Laya.stage.width / 2, Laya.stage.height / 2)
        );
        this._animation = Laya.Tween.create(target, this)
            .duration(300)
            .go("x", center.x, this._initPos.x)
            .go("y", center.y, this._initPos.y)
            .go("scaleX", 0, 1)
            .go("scaleY", 0, 1)
            .ease("backOut")
            .then(() => {
                this._animation = null;
                complete();
            });
        this._animation.seek(0);
    }

    override animateOut(complete: () => void): void {
        this.assertViewMutable();
        this._cancelAnimation();
        const target = this._animationTarget;
        if (!target) {
            complete();
            return;
        }
        const center = target.parent!.globalToLocal(
            new Laya.Point(Laya.stage.width / 2, Laya.stage.height / 2)
        );
        this._animation = Laya.Tween.create(target, this)
            .duration(300)
            .to("x", center.x)
            .to("y", center.y)
            .to("scaleX", 0)
            .to("scaleY", 0)
            .ease("backIn")
            .then(() => {
                this._animation = null;
                complete();
            });
    }

    override onAfterDeserialize(): void {
        super.onAfterDeserialize();
        this._handleAdded();
    }

    override onPreDestroy(): void {
        this._releaseAnimationTarget();
        super.onPreDestroy();
    }

    private _checkBoolean(name: string, value: boolean): void {
        this.assertViewMutable();
        if (typeof value !== "boolean") {
            throw new TypeError(`UIStack ${name} must be a boolean`);
        }
    }

    private _handleAdded(): void {
        if (!Laya.LayaEnv.isPlaying || !this.parent) {
            return;
        }
        this._centerPopup();
        const target = this._animationTarget;
        if (target) {
            this._initPos.setTo(target.x, target.y);
        }
    }

    private _centerPopup(): void {
        if (!Laya.LayaEnv.isPlaying || !this.parent || !this._isPopupCenter) {
            return;
        }
        if (Laya.SerializeUtil.isDeserializing) {
            // 父容器可能在子节点之后恢复尺寸，等整棵预制体就绪再计算。
            this.callLater(this._centerPopup);
            return;
        }
        const rect = this.getLayoutParentRect()!;
        this.pos(
            Math.round(
                rect.x + (rect.width - this.width * this.scaleX) / 2 + this.pivotX * this.scaleX
            ),
            Math.round(
                rect.y + (rect.height - this.height * this.scaleY) / 2 + this.pivotY * this.scaleY
            )
        );
    }

    private _cancelAnimation(): void {
        const animation = this._animation;
        this._animation = null;
        animation?.kill();
    }

    private _resetAnimation(): void {
        this._cancelAnimation();
        const target = this._animationTarget;
        if (target && !target.destroyed) {
            target.pos(this._initPos.x, this._initPos.y).scale(1, 1);
        }
    }

    private _releaseAnimationTarget(): void {
        this._resetAnimation();
        this._animationTarget?.off(Laya.Event.REMOVED, this, this._releaseAnimationTarget);
        this._animationTarget = null;
    }
}
