import { BackdropBlurRenderer } from "./backdrop-blur-renderer";
import { registerClassAlias } from "./class-alias";
import { UIEvent } from "./ui-event";
import { UIWidget } from "./ui-widget";

export type UIBackdropBlurUpdateMode = "realtime" | "once";

/** 模糊当前颜色目标中先于本节点绘制的内容；弹窗内容应放在本节点之后。 */
@registerClassAlias("UIBackdropBlur")
@Laya.regClass()
@Laya.classInfo({
    menu: "自定义UI",
    icon: "plugins/type-icons/node/Widget.svg",
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
export class UIBackdropBlur extends UIWidget {
    private _blurRadius = 32;
    private _downsample = 2;
    private _effectEnabled = true;
    private _previewInEditor = true;
    private _updateMode: UIBackdropBlurUpdateMode = "realtime";
    private _backdropRenderer: BackdropBlurRenderer | null = null;

    constructor() {
        super();
        this.showEditorBorder = true;
        this.on(Laya.Event.DISPLAY, this, this._createBackdropRenderer);
    }

    @Laya.property({
        type: Boolean,
        default: true,
        caption: "编辑器预览",
        catalog: "编辑器",
        tips: "在场景编辑态实时显示效果；运行时仍按更新模式执行。",
    })
    get previewInEditor(): boolean {
        return this._previewInEditor;
    }

    set previewInEditor(value: boolean) {
        this._assertMutable();
        if (typeof value !== "boolean") {
            throw new TypeError("UIBackdropBlur previewInEditor must be a boolean");
        }
        this._previewInEditor = value;
        if (!Laya.LayaEnv.isPlaying) {
            if (!value) {
                this._destroyBackdropRenderer();
            } else if (this.displayedInStage) {
                this._createBackdropRenderer();
            }
        }
        this.repaint();
    }

    @Laya.property({
        type: Number,
        default: 32,
        min: 0,
        max: 64,
        fractionDigits: 0,
        caption: "模糊半径",

        tips: "当前渲染目标物理像素的近似模糊强度，范围 0～64；0 原样显示，非 CSS 高斯标准差。",
    })
    get blurRadius(): number {
        return this._blurRadius;
    }

    set blurRadius(value: number) {
        this._assertMutable();
        if (!Number.isFinite(value) || value < 0 || value > 64) {
            throw new RangeError("UIBackdropBlur blurRadius must be within 0..64");
        }
        this._blurRadius = value;
        this.repaint();
    }

    @Laya.property({
        type: Number,
        default: 2,
        caption: "降采样倍率",
        enumSource: [
            { name: "1×", value: 1 },
            { name: "2×", value: 2 },
            { name: "4×", value: 4 },
        ],
    })
    get downsample(): number {
        return this._downsample;
    }

    set downsample(value: number) {
        this._assertMutable();
        if (value !== 1 && value !== 2 && value !== 4) {
            throw new RangeError("UIBackdropBlur downsample must be 1, 2 or 4");
        }
        this._downsample = value;
        this.repaint();
    }

    @Laya.property({ type: Boolean, default: true, caption: "启用模糊" })
    get effectEnabled(): boolean {
        return this._effectEnabled;
    }

    set effectEnabled(value: boolean) {
        this._assertMutable();
        if (typeof value !== "boolean") {
            throw new TypeError("UIBackdropBlur effectEnabled must be a boolean");
        }
        this._effectEnabled = value;
        if (!value) {
            this._cancelSnapshotNotice();
        }
        this.repaint();
    }

    @Laya.property({
        type: String,
        default: "realtime",
        caption: "更新模式",
        enumSource: [
            { name: "实时", value: "realtime" },
            { name: "单次", value: "once" },
        ],
        tips: "单次首次绘制后复用快照，参数及目标尺寸变化需显式 refresh；隐藏背景由业务处理。",
    })
    get updateMode(): UIBackdropBlurUpdateMode {
        return this._updateMode;
    }

    set updateMode(value: UIBackdropBlurUpdateMode) {
        this._assertMutable();
        if (value !== "realtime" && value !== "once") {
            throw new TypeError("UIBackdropBlur updateMode must be realtime or once");
        }
        if (this._updateMode === value) {
            return;
        }
        this._updateMode = value;
        this.clearSnapshot();
    }

    /** 非序列化状态；有待刷新的请求时为 false。 */
    get hasSnapshot(): boolean {
        return (
            Laya.LayaEnv.isPlaying &&
            this._updateMode === "once" &&
            this._backdropRenderer?.hasSnapshot === true
        );
    }

    /** 请求下一次有效绘制重抓背景；业务须先恢复待捕获的背景。 */
    refresh(): void {
        this._assertMutable();
        if (this._updateMode !== "once") {
            throw new Error("UIBackdropBlur refresh requires once mode");
        }
        this._cancelSnapshotNotice();
        this._backdropRenderer?.requestSnapshot();
        this.repaint();
    }

    /** 释放缓存；若节点仍可绘制，单次模式会在下一次绘制重新捕获。 */
    clearSnapshot(): void {
        this._assertMutable();
        this._cancelSnapshotNotice();
        this._backdropRenderer?.clearSnapshot();
        this.repaint();
    }

    /** @internal 渲染成功后延迟通知，业务不会在渲染遍历中修改场景树。 */
    _queueSnapshotReady(): void {
        if (Laya.LayaEnv.isPlaying) {
            Laya.timer.frameOnce(1, this, this._dispatchSnapshotReady);
        }
    }

    private _dispatchSnapshotReady(): void {
        if (!this.destroyed && this.effectEnabled && this.displayedInStage && this.hasSnapshot) {
            this.event(UIEvent.BACKDROP_READY);
        }
    }

    private _cancelSnapshotNotice(): void {
        Laya.timer.clear(this, this._dispatchSnapshotReady);
    }

    private _createBackdropRenderer(): void {
        if ((!Laya.LayaEnv.isPlaying && !this._previewInEditor) || this._backdropRenderer) {
            return;
        }
        BackdropBlurRenderer.assertWebGL();
        const renderer = new BackdropBlurRenderer();
        renderer.hideFlags = Laya.HideFlags.HideAndDontSave;
        this.addComponentInstance(renderer);
        renderer.initialize(this);
        this._backdropRenderer = renderer;
    }

    private _destroyBackdropRenderer(): void {
        this._cancelSnapshotNotice();
        this._backdropRenderer?.destroy();
        this._backdropRenderer = null;
    }

    private _assertMutable(): void {
        if (this.destroyed) {
            throw new Error("UIBackdropBlur cannot change after destruction");
        }
    }

    override destroy(destroyChild = true): void {
        // 在 Sprite 组件自动销毁之前清理，保持资源与渲染元素的释放顺序。
        this._destroyBackdropRenderer();
        super.destroy(destroyChild);
    }
}
