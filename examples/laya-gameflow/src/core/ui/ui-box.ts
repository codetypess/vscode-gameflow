import { registerClassAlias } from "./class-alias";
import { LayoutError, type LayoutNodeResult, type LayoutParentRect } from "./layout";
import { UIWidget, type RelativeLayoutUnit } from "./ui-widget";

export type UIBoxAlign = "left" | "center" | "right";
export type UIBoxVAlign = "top" | "middle" | "bottom";

/** UI 容器基类；不会为了布局创建额外节点。 */
@registerClassAlias("UIBox")
@Laya.regClass()
@Laya.classInfo({
    menu: "自定义UI",
    icon: "plugins/type-icons/node/Box.svg",
})
export class UIBox extends UIWidget {
    private _paddingLeft = 0;
    private _paddingRight = 0;
    private _paddingTop = 0;
    private _paddingBottom = 0;
    private _clipContent = false;

    @Laya.property({
        type: String,
        default: "0,0,0,0",
        inspector: "vec4",
        options: { titles: ["U", "R", "D", "L"] },
        min: 0,
        step: 1,
        fractionDigits: 0,
        serializable: false,
    })
    get padding(): string {
        return [
            this._paddingTop,
            this._paddingRight,
            this._paddingBottom,
            this._paddingLeft,
        ].join(",");
    }

    set padding(value: string) {
        if (typeof value !== "string") {
            throw new LayoutError(
                "UIBox padding requires four non-negative integers: top,right,bottom,left"
            );
        }
        const parts = value.split(",");
        const padding = parts.map(Number);
        if (
            parts.length !== 4 ||
            parts.some((part) => !part.trim()) ||
            padding.some((part) => !Number.isInteger(part) || part < 0)
        ) {
            throw new LayoutError(
                "UIBox padding requires four non-negative integers: top,right,bottom,left"
            );
        }
        [this._paddingTop, this._paddingRight, this._paddingBottom, this._paddingLeft] = padding;
        this.requestLayout();
    }

    @Laya.property({
        type: Number,
        default: 0,
        min: 0,
        step: 1,
        fractionDigits: 0,
        hidden: true,
    })
    get paddingLeft(): number {
        return this._paddingLeft;
    }

    set paddingLeft(value: number) {
        this._paddingLeft = this._padding("paddingLeft", value);
        this.requestLayout();
    }

    @Laya.property({
        type: Number,
        default: 0,
        min: 0,
        step: 1,
        fractionDigits: 0,
        hidden: true,
    })
    get paddingRight(): number {
        return this._paddingRight;
    }

    set paddingRight(value: number) {
        this._paddingRight = this._padding("paddingRight", value);
        this.requestLayout();
    }

    @Laya.property({
        type: Number,
        default: 0,
        min: 0,
        step: 1,
        fractionDigits: 0,
        hidden: true,
    })
    get paddingTop(): number {
        return this._paddingTop;
    }

    set paddingTop(value: number) {
        this._paddingTop = this._padding("paddingTop", value);
        this.requestLayout();
    }

    @Laya.property({
        type: Number,
        default: 0,
        min: 0,
        step: 1,
        fractionDigits: 0,
        hidden: true,
    })
    get paddingBottom(): number {
        return this._paddingBottom;
    }

    set paddingBottom(value: number) {
        this._paddingBottom = this._padding("paddingBottom", value);
        this.requestLayout();
    }

    @Laya.property({ type: Boolean, default: false })
    get clipContent(): boolean {
        return this._clipContent;
    }

    set clipContent(value: boolean) {
        this._clipContent = Boolean(value);
        this._updateClipRect();
    }

    protected override getContentRect(): LayoutParentRect {
        // 只读取需要的轴，避免文本测宽时递归触发依赖该文本的父高度测量。
        const getSize = (horizontal: boolean) => {
            const size = horizontal
                ? this.width - this._paddingLeft - this._paddingRight
                : this.height - this._paddingTop - this._paddingBottom;
            if (size < 0) {
                throw new LayoutError("UIBox padding is larger than the box size");
            }
            return size;
        };
        return {
            x: this._paddingLeft,
            y: this._paddingTop,
            get width() {
                return getSize(true);
            },
            get height() {
                return getSize(false);
            },
        };
    }

    protected override validateChildLayoutUnit(child: UIWidget, unit: RelativeLayoutUnit): void {
        if (unit !== "percent") {
            return;
        }
        if (this.widthSource === "measured" &&
            (child.left !== null || child.right !== null || child.centerX !== null)) {
            throw new LayoutError("UIBox percentage constraints require an explicit parent width");
        }
        if (this.heightSource === "measured" &&
            (child.top !== null || child.bottom !== null || child.centerY !== null)) {
            throw new LayoutError("UIBox percentage constraints require an explicit parent height");
        }
    }

    /**
     * UIBox 的未显式尺寸来自参与布局的子项。依赖父级宽度的约束不能参与
     * 本次测量，否则会形成“父宽度决定子宽度、子宽度又决定父宽度”的循环。
     */
    protected override measureWidth(): number {
        let max = 0;
        for (const child of this.getLayoutChildren()) {
            if (child.right !== null || child.centerX !== null ||
                (child.layoutUnit === "percent" && child.left !== null)) {
                throw new LayoutError(
                    `UIBox child ${child.name || child.constructor.name} horizontal constraints require an explicit parent width`
                );
            }
            max = Math.max(max, (child.left ?? child.x) + child.width * child.scaleX);
        }
        return this._paddingLeft + max + this._paddingRight;
    }

    protected override measureHeight(): number {
        let max = 0;
        for (const child of this.getLayoutChildren()) {
            if (child.bottom !== null || child.centerY !== null ||
                (child.layoutUnit === "percent" && child.top !== null)) {
                throw new LayoutError(
                    `UIBox child ${child.name || child.constructor.name} vertical constraints require an explicit parent height`
                );
            }
            max = Math.max(max, (child.top ?? child.y) + child.height * child.scaleY);
        }
        return this._paddingTop + max + this._paddingBottom;
    }

    protected override onLayoutApplied(result: LayoutNodeResult): void {
        this._updateClipRect();
        this.layoutChildren(result);
    }

    protected layoutChildren(_result: LayoutNodeResult | null = null): void {
        for (const child of this.children) {
            if (child instanceof UIWidget) {
                child.requestLayout();
            }
        }
    }

    protected getLayoutChildren(): UIWidget[] {
        return this.children.filter((child): child is UIWidget => child instanceof UIWidget);
    }

    private _updateClipRect(): void {
        if (!this.clipContent || this.destroyed) {
            if (this.scrollRect) {
                this.scrollRect = null as unknown as Laya.Rectangle;
            }
            return;
        }
        const rect = this.scrollRect ?? new Laya.Rectangle();
        rect.setTo(0, 0, this.width, this.height);
        this.scrollRect = rect;
    }

    private _padding(name: string, value: number): number {
        if (!Number.isFinite(value) || value < 0) {
            throw new LayoutError(`${name} must be a non-negative finite number`);
        }
        return value;
    }
}
