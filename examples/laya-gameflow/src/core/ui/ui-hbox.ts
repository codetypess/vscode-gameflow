import { registerClassAlias } from "./class-alias";
import { LayoutError } from "./layout";
import { UIBox, type UIBoxAlign, type UIBoxVAlign } from "./ui-box";

export type UIHBoxAlign = UIBoxAlign | "justify";

/** 横向流式布局容器，对应旧体系的 HBox。 */
@registerClassAlias("UIHBox")
@Laya.regClass()
@Laya.classInfo({
    menu: "自定义UI",
    icon: "plugins/type-icons/node/HBox.svg",
    properties: [{
        name: "align2",
        caption: "Align",
        inspector: "xq.BoxAlign",
        options: { justifyAxis: "align" },
        position: "after gap",
        serializable: false,
    }],
})
export class UIHBox extends UIBox {
    private _gap = 0;
    private _align: UIHBoxAlign = "left";
    private _valign: UIBoxVAlign = "top";

    @Laya.property({ type: Number, default: 0, step: 1, fractionDigits: 0 })
    get gap(): number {
        return this._gap;
    }

    set gap(value: number) {
        if (!Number.isFinite(value)) {
            throw new LayoutError("gap must be finite");
        }
        this._gap = value;
        this.requestLayout();
    }

    /** X 轴对齐整行；justify 均分剩余空间并忽略 gap。 */
    @Laya.property({
        type: String,
        default: "left",
        inspector: null,
        enumSource: [
            { name: "左对齐", value: "left" },
            { name: "水平居中", value: "center" },
            { name: "右对齐", value: "right" },
            { name: "均匀分布", value: "justify" },
        ],
    })
    get align(): UIHBoxAlign {
        return this._align;
    }

    set align(value: UIHBoxAlign) {
        if (!["left", "center", "right", "justify"].includes(value)) {
            throw new LayoutError(`unsupported UIHBox align: ${value}`);
        }
        this._align = value;
        this.requestLayout();
    }

    /** Y 轴按每项尺寸分别对齐。 */
    @Laya.property({
        type: String,
        default: "top",
        inspector: null,
        enumSource: [
            { name: "顶部对齐", value: "top" },
            { name: "垂直居中", value: "middle" },
            { name: "底部对齐", value: "bottom" },
        ],
    })
    get valign(): UIBoxVAlign {
        return this._valign;
    }

    set valign(value: UIBoxVAlign) {
        if (!["top", "middle", "bottom"].includes(value)) {
            throw new LayoutError(`unsupported UIHBox valign: ${value}`);
        }
        this._valign = value;
        this.requestLayout();
    }

    protected override layoutChildren(): void {
        const content = this.getContentRect();
        const items = this.getLayoutChildren();
        for (const child of items) {
            if (child.left !== null || child.right !== null || child.centerX !== null) {
                throw new LayoutError(
                    `UIHBox child ${child.name || child.constructor.name} cannot declare horizontal constraints`
                );
            }
            child.requestLayout();
        }
        const childrenWidth = items.reduce((total, child) => total + child.width * child.scaleX, 0);
        const gaps = Math.max(0, items.length - 1);
        const gap = this._align === "justify"
            ? (gaps > 0 ? (content.width - childrenWidth) / gaps : 0)
            : this._gap;
        const totalWidth = childrenWidth + gaps * gap;
        let cursor = content.x;
        if (this._align === "center") {
            cursor += (content.width - totalWidth) * 0.5;
        } else if (this._align === "right") {
            cursor += content.width - totalWidth;
        }
        for (const child of items) {
            const width = child.width * child.scaleX;
            const height = child.height * child.scaleY;
            let y = child.y;
            if (child.top === null && child.bottom === null && child.centerY === null) {
                y = this._crossPosition(content.y, content.height, height);
            }
            child.applyLayoutPosition(cursor, y);
            cursor += width + gap;
        }
    }

    protected override measureWidth(): number {
        const items = this.getLayoutChildren();
        for (const child of items) {
            if (child.left !== null || child.right !== null || child.centerX !== null) {
                throw new LayoutError(
                    `UIHBox child ${child.name || child.constructor.name} horizontal constraints require an explicit parent width`
                );
            }
        }
        const childrenWidth = items.reduce((total, child) => total + child.width * child.scaleX, 0);
        return (
            this.paddingLeft +
            childrenWidth +
            (this._align === "justify" ? 0 : Math.max(0, items.length - 1) * this._gap) +
            this.paddingRight
        );
    }

    protected override measureHeight(): number {
        let max = 0;
        for (const child of this.getLayoutChildren()) {
            if (child.top !== null || child.bottom !== null || child.centerY !== null) {
                throw new LayoutError(
                    `UIHBox child ${child.name || child.constructor.name} vertical constraints require an explicit parent height`
                );
            }
            max = Math.max(max, child.height * child.scaleY);
        }
        return this.paddingTop + max + this.paddingBottom;
    }

    private _crossPosition(start: number, available: number, size: number): number {
        switch (this._valign) {
            case "middle":
                return start + (available - size) * 0.5;
            case "bottom":
                return start + available - size;
            case "top":
                return start;
        }
    }
}
