import { LayoutError } from "./layout";

export type UIListScrollAlign = "start" | "center" | "end";
export type ListAnchor = { index: number; offset: number };

/** 两轴都使用条目自身尺寸，间距不能产生非正或非有限步长。 */
export function validateListItemSize(size: number, gap: number): void {
    if (!Number.isFinite(size) || size <= 0 || !Number.isFinite(size + gap) || size + gap <= 0) {
        throw new LayoutError(
            "UIList item size must be positive and finite, and item size + gap must be positive and finite"
        );
    }
}

/** 按整行/列虚拟化；末端使用前缀最大值，允许负间距及不同尺寸的重叠。 */
export class ListLayout {
    private _sizes: number[] = [];
    private _crossSizes: number[] = [];
    private _crossOffsets: number[] = [];
    private _totalCrossSize = 0;
    private _lineSizes: number[] = [];
    private _offsets: number[] = [];
    private _ends: number[] = [];
    private _gap = 0;
    private _crossGap = 0;
    private _wrapCount = 1;

    get length(): number {
        return this._sizes.length;
    }
    get totalSize(): number {
        return this._ends[this._ends.length - 1] ?? 0;
    }
    get totalCrossSize(): number {
        return this._totalCrossSize;
    }

    reset(
        count: number,
        initialSize: number,
        gap: number,
        wrapCount = 1,
        initialCrossSize = 1,
        crossGap = 0
    ): void {
        validateListItemSize(initialSize, gap);
        validateListItemSize(initialCrossSize, crossGap);
        if (!Number.isSafeInteger(wrapCount) || wrapCount < 1) {
            throw new LayoutError("UIList wrapCount must be a positive safe integer");
        }
        this._gap = gap;
        this._crossGap = crossGap;
        this._wrapCount = wrapCount;
        this._sizes = new Array<number>(count).fill(initialSize);
        this._crossSizes = new Array<number>(count).fill(initialCrossSize);
        this._rebuild();
    }

    update(
        sizes: ReadonlyMap<number, number>,
        crossSizes: ReadonlyMap<number, number> = new Map()
    ): boolean {
        for (const [index, size] of sizes) {
            this.checkIndex(index);
            validateListItemSize(size, this._gap);
        }
        for (const [index, size] of crossSizes) {
            this.checkIndex(index);
            validateListItemSize(size, this._crossGap);
        }
        let changed = false;
        for (const [index, size] of sizes) {
            if (this._sizes[index] !== size) {
                this._sizes[index] = size;
                changed = true;
            }
        }
        for (const [index, size] of crossSizes) {
            if (this._crossSizes[index] !== size) {
                this._crossSizes[index] = size;
                changed = true;
            }
        }
        if (changed) {
            this._rebuild();
        }
        return changed;
    }

    checkIndex(index: number): void {
        if (!Number.isSafeInteger(index) || index < 0 || index >= this.length) {
            throw new RangeError(`UIList index out of range: ${index}`);
        }
    }

    offset(index: number): number {
        this.checkIndex(index);
        return this._offsets[Math.floor(index / this._wrapCount)];
    }
    crossOffset(index: number): number {
        this.checkIndex(index);
        return this._crossOffsets[index];
    }

    range(position: number, viewport: number): { first: number; last: number } {
        if (!this.length) {
            return { first: -1, last: -1 };
        }
        const first = Math.min(this._ends.length - 1, upperBound(this._ends, position));
        const last = Math.min(
            this._ends.length - 1,
            Math.max(first, lowerBound(this._offsets, position + viewport) - 1)
        );
        return {
            first: first * this._wrapCount,
            last: Math.min(this.length - 1, (last + 1) * this._wrapCount - 1),
        };
    }

    anchor(position: number): ListAnchor | null {
        if (!this.length) {
            return null;
        }
        const { first } = this.range(position, 0);
        return { index: first, offset: position - this.offset(first) };
    }

    restore(anchor: ListAnchor | null, viewport: number): number {
        if (!anchor || !this.length) {
            return 0;
        }
        if (anchor.index >= this.length) {
            return Math.max(0, this.totalSize - viewport);
        }
        return this.clamp(this.offset(anchor.index) + anchor.offset, viewport);
    }

    target(index: number, viewport: number, align: UIListScrollAlign): number {
        this.checkIndex(index);
        if (align !== "start" && align !== "center" && align !== "end") {
            throw new LayoutError(`unsupported UIList scroll alignment: ${String(align)}`);
        }
        const factor = align === "start" ? 0 : align === "center" ? 0.5 : 1;
        const line = Math.floor(index / this._wrapCount);
        return this.clamp(
            this._offsets[line] - (viewport - this._lineSizes[line]) * factor,
            viewport
        );
    }

    clamp(position: number, viewport: number): number {
        return Math.max(0, Math.min(Math.max(0, this.totalSize - viewport), position));
    }

    private _rebuild(): void {
        const lines = Math.ceil(this.length / this._wrapCount);
        this._lineSizes = new Array<number>(lines).fill(0);
        this._offsets = new Array<number>(lines);
        this._ends = new Array<number>(lines);
        this._crossOffsets = new Array<number>(this.length);
        this._totalCrossSize = 0;
        let cross = 0;
        for (let index = 0; index < this.length; index++) {
            const line = Math.floor(index / this._wrapCount);
            this._lineSizes[line] = Math.max(this._lineSizes[line], this._sizes[index]);
            if (index % this._wrapCount === 0) {
                cross = 0;
            }
            this._crossOffsets[index] = cross;
            this._totalCrossSize = Math.max(this._totalCrossSize, cross + this._crossSizes[index]);
            cross += this._crossSizes[index] + this._crossGap;
            if (!Number.isFinite(cross) || !Number.isFinite(this._totalCrossSize)) {
                throw new LayoutError("UIList content size must be finite");
            }
        }
        let offset = 0;
        let end = 0;
        for (let line = 0; line < lines; line++) {
            this._offsets[line] = offset;
            end = Math.max(end, offset + this._lineSizes[line]);
            this._ends[line] = end;
            offset += this._lineSizes[line] + this._gap;
        }
        if (!Number.isFinite(offset) || !Number.isFinite(end)) {
            throw new LayoutError("UIList content size must be finite");
        }
    }
}

function lowerBound(values: readonly number[], value: number): number {
    let low = 0;
    let high = values.length;
    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (values[middle] < value) {
            low = middle + 1;
        } else {
            high = middle;
        }
    }
    return low;
}

function upperBound(values: readonly number[], value: number): number {
    let low = 0;
    let high = values.length;
    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (values[middle] <= value) {
            low = middle + 1;
        } else {
            high = middle;
        }
    }
    return low;
}
