import { registerClassAlias } from "./class-alias";
import { LayoutError } from "./layout";
import { UIBox, type UIBoxAlign, type UIBoxVAlign } from "./ui-box";

export type UIVBoxVAlign = UIBoxVAlign | "justify";

/** 纵向流式布局容器，对应旧体系的 VBox。 */
@registerClassAlias("UIVBox")
@Laya.regClass()
@Laya.classInfo({
    menu: "自定义UI",
    icon: "plugins/type-icons/node/VBox.svg",
    properties: [{
        name: "align2",
        caption: "Align",
        inspector: "xq.BoxAlign",
        options: { justifyAxis: "valign" },
        position: "after gap",
        serializable: false,
    }],
})
export class UIVBox extends UIBox {
    private _gap = 0;
    private _align: UIBoxAlign = "left";
    private _valign: UIVBoxVAlign = "top";

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

    /** X 轴按每项尺寸分别对齐。 */
    @Laya.property({
        type: String,
        default: "left",
        inspector: null,
        enumSource: [
            { name: "左对齐", value: "left" },
            { name: "水平居中", value: "center" },
            { name: "右对齐", value: "right" },
        ],
    })
    get align(): UIBoxAlign {
        return this._align;
    }

    set align(value: UIBoxAlign) {
        if (!["left", "center", "right"].includes(value)) {
            throw new LayoutError(`unsupported UIVBox align: ${value}`);
        }
        this._align = value;
        this.requestLayout();
    }

    /** Y 轴对齐整列；justify 均分剩余空间并忽略 gap。 */
    @Laya.property({
        type: String,
        default: "top",
        inspector: null,
        enumSource: [
            { name: "顶部对齐", value: "top" },
            { name: "垂直居中", value: "middle" },
            { name: "底部对齐", value: "bottom" },
            { name: "均匀分布", value: "justify" },
        ],
    })
    get valign(): UIVBoxVAlign {
        return this._valign;
    }

    set valign(value: UIVBoxVAlign) {
        if (!["top", "middle", "bottom", "justify"].includes(value)) {
            throw new LayoutError(`unsupported UIVBox valign: ${value}`);
        }
        this._valign = value;
        this.requestLayout();
    }

    protected override layoutChildren(): void {
        const content = this.getContentRect();
        const items = this.getLayoutChildren();
        for (const child of items) {
            if (child.top !== null || child.bottom !== null || child.centerY !== null) {
                throw new LayoutError(
                    `UIVBox child ${child.name || child.constructor.name} cannot declare vertical constraints`
                );
            }
            child.requestLayout();
        }
        const childrenHeight = items.reduce((total, child) => total + child.height * child.scaleY, 0);
        const gaps = Math.max(0, items.length - 1);
        const gap = this._valign === "justify"
            ? (gaps > 0 ? (content.height - childrenHeight) / gaps : 0)
            : this._gap;
        const totalHeight = childrenHeight + gaps * gap;
        let cursor = content.y;
        if (this._valign === "middle") {
            cursor += (content.height - totalHeight) * 0.5;
        } else if (this._valign === "bottom") {
            cursor += content.height - totalHeight;
        }
        for (const child of items) {
            const width = child.width * child.scaleX;
            const height = child.height * child.scaleY;
            let x = child.x;
            if (child.left === null && child.right === null && child.centerX === null) {
                x = this._crossPosition(content.x, content.width, width);
            }
            child.applyLayoutPosition(x, cursor);
            cursor += height + gap;
        }
    }

    protected override measureWidth(): number {
        let max = 0;
        for (const child of this.getLayoutChildren()) {
            if (child.left !== null || child.right !== null || child.centerX !== null) {
                throw new LayoutError(
                    `UIVBox child ${child.name || child.constructor.name} horizontal constraints require an explicit parent width`
                );
            }
            max = Math.max(max, child.width * child.scaleX);
        }
        return this.paddingLeft + max + this.paddingRight;
    }

    protected override measureHeight(): number {
        const items = this.getLayoutChildren();
        for (const child of items) {
            if (child.top !== null || child.bottom !== null || child.centerY !== null) {
                throw new LayoutError(
                    `UIVBox child ${child.name || child.constructor.name} vertical constraints require an explicit parent height`
                );
            }
        }
        const childrenHeight = items.reduce(
            (total, child) => total + child.height * child.scaleY,
            0
        );
        return (
            this.paddingTop +
            childrenHeight +
            (this._valign === "justify" ? 0 : Math.max(0, items.length - 1) * this._gap) +
            this.paddingBottom
        );
    }

    private _crossPosition(start: number, available: number, size: number): number {
        switch (this._align) {
            case "center":
                return start + (available - size) * 0.5;
            case "right":
                return start + available - size;
            case "left":
                return start;
        }
    }
}
