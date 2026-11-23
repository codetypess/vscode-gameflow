import { registerClassAlias } from "./class-alias";
import { LayoutError } from "./layout";
import { UIBox, type UIBoxAlign, type UIBoxVAlign } from "./ui-box";
import type { UIWidget } from "./ui-widget";

export type UIGridDirection = "horizontal" | "vertical";

type GridMetrics = {
    cellWidth: number;
    cellHeight: number;
    width: number;
    height: number;
};

/** 统一格子尺寸，按节点顺序横向或纵向优先排列。 */
@registerClassAlias("UIGrid")
@Laya.regClass()
@Laya.classInfo({
    menu: "自定义UI",
    icon: "plugins/type-icons/node/Grid.svg",
    properties: [{
        name: "align2",
        caption: "Align",
        inspector: "xq.BoxAlign",
        options: { justifyAxis: "none" },
        position: "after gapY",
        serializable: false,
    }],
})
export class UIGrid extends UIBox {
    private _direction: UIGridDirection = "horizontal";
    private _wrapCount = 1;
    private _gapX = 0;
    private _gapY = 0;
    private _align: UIBoxAlign = "left";
    private _valign: UIBoxVAlign = "top";

    @Laya.property({
        type: String,
        default: "horizontal",
        enumSource: [
            { name: "横向", value: "horizontal" },
            { name: "纵向", value: "vertical" },
        ],
    })
    get direction(): UIGridDirection {
        return this._direction;
    }

    set direction(value: UIGridDirection) {
        if (value !== "horizontal" && value !== "vertical") {
            throw new LayoutError(`unsupported UIGrid direction: ${value}`);
        }
        this._direction = value;
        this.requestLayout();
    }

    /** 横向每行、纵向每列最多的项数。 */
    @Laya.property({ type: Number, default: 1, min: 1, step: 1, fractionDigits: 0 })
    get wrapCount(): number {
        return this._wrapCount;
    }

    set wrapCount(value: number) {
        if (!Number.isSafeInteger(value) || value < 1) {
            throw new LayoutError("UIGrid wrapCount must be a positive safe integer");
        }
        this._wrapCount = value;
        this.requestLayout();
    }

    @Laya.property({ type: Number, default: 0, step: 1, fractionDigits: 0 })
    get gapX(): number {
        return this._gapX;
    }

    set gapX(value: number) {
        this._gapX = this._gap("gapX", value);
        this.requestLayout();
    }

    @Laya.property({ type: Number, default: 0, step: 1, fractionDigits: 0 })
    get gapY(): number {
        return this._gapY;
    }

    set gapY(value: number) {
        this._gapY = this._gap("gapY", value);
        this.requestLayout();
    }

    /** 整个网格在内容区内的水平对齐。 */
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
            throw new LayoutError(`unsupported UIGrid align: ${value}`);
        }
        this._align = value;
        this.requestLayout();
    }

    /** 整个网格在内容区内的垂直对齐。 */
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
            throw new LayoutError(`unsupported UIGrid valign: ${value}`);
        }
        this._valign = value;
        this.requestLayout();
    }

    protected override layoutChildren(): void {
        const items = this.getLayoutChildren();
        for (const child of items) {
            this._validateChild(child);
            child.requestLayout();
        }
        const grid = this._measureGrid(items);
        const content = this.getContentRect();
        const startX = content.x + (content.width - grid.width) * this._alignFactor();
        const startY = content.y + (content.height - grid.height) * this._valignFactor();
        const horizontal = this._direction === "horizontal";
        const count = this._wrapCount;
        for (let index = 0; index < items.length; index++) {
            const child = items[index];
            const column = horizontal ? index % count : Math.floor(index / count);
            const row = horizontal ? Math.floor(index / count) : index % count;
            // pivot 与镜像缩放只影响节点原点；显示矩形仍贴齐格子的左上角。
            const pivotX = child.pivotX * child.scaleX - Math.min(0, child.width * child.scaleX);
            const pivotY = child.pivotY * child.scaleY - Math.min(0, child.height * child.scaleY);
            child.applyLayoutPosition(
                startX + column * (grid.cellWidth + this._gapX) + pivotX,
                startY + row * (grid.cellHeight + this._gapY) + pivotY
            );
        }
    }

    protected override measureWidth(): number {
        return this.paddingLeft + this._measureGrid(this.getLayoutChildren()).width + this.paddingRight;
    }

    protected override measureHeight(): number {
        return this.paddingTop + this._measureGrid(this.getLayoutChildren()).height + this.paddingBottom;
    }

    private _measureGrid(items: UIWidget[]): GridMetrics {
        let cellWidth = 0;
        let cellHeight = 0;
        for (const child of items) {
            this._validateChild(child);
            cellWidth = Math.max(cellWidth, Math.abs(child.width * child.scaleX));
            cellHeight = Math.max(cellHeight, Math.abs(child.height * child.scaleY));
        }
        const horizontal = this._direction === "horizontal";
        const columns = horizontal ? Math.min(this._wrapCount, items.length) : Math.ceil(items.length / this._wrapCount);
        const rows = horizontal ? Math.ceil(items.length / this._wrapCount) : Math.min(this._wrapCount, items.length);
        const width = columns === 0 ? 0 : columns * cellWidth + (columns - 1) * this._gapX;
        const height = rows === 0 ? 0 : rows * cellHeight + (rows - 1) * this._gapY;
        if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) {
            throw new LayoutError("UIGrid measured size must be finite and non-negative");
        }
        return { cellWidth, cellHeight, width, height };
    }

    private _validateChild(child: UIWidget): void {
        if (child.hasRelativeLayout) {
            throw new LayoutError(
                `UIGrid child ${child.name || child.constructor.name} cannot declare relative constraints`
            );
        }
    }

    private _gap(name: string, value: number): number {
        if (!Number.isFinite(value)) {
            throw new LayoutError(`UIGrid ${name} must be finite`);
        }
        return value;
    }

    private _alignFactor(): number {
        return this._align === "left" ? 0 : this._align === "center" ? 0.5 : 1;
    }

    private _valignFactor(): number {
        return this._valign === "top" ? 0 : this._valign === "middle" ? 0.5 : 1;
    }
}
