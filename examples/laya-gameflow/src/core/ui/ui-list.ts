import { registerClassAlias } from "./class-alias";
import { LayoutError } from "./layout";
import {
    validateListItemSize,
    ListLayout,
    type ListAnchor,
    type UIListScrollAlign,
} from "./list-layout";
import { UIWidget } from "./ui-widget";
import { UIEvent } from "./ui-event";
import { UIPanel } from "./ui-panel";

export type { UIListScrollAlign } from "./list-layout";

type Cell = {
    node: UIWidget;
    initialWidth: number | null;
    initialHeight: number | null;
    index: number;
    dirty: boolean;
};
type ScrollTarget = { index: number; align: UIListScrollAlign };

/** 预制体条目网格列表；滚动时按整行/列虚拟化，None 时全量展示。 */
@registerClassAlias("UIList")
@Laya.regClass()
@Laya.classInfo({
    menu: "自定义UI",
    icon: "plugins/type-icons/node/List.svg",
})
export class UIList<T = unknown> extends UIPanel {
    private _cellPrefab: Laya.Prefab | null = null;
    private _wrapCount = 1;
    private _gapX = 0;
    private _gapY = 0;
    private _data: readonly T[] = [];
    private readonly _geometry = new ListLayout();
    private readonly _cells = new Map<number, Cell>();
    private readonly _pool: Cell[] = [];
    private readonly _dirty = new Set<number>();
    private _templateSize = 0;
    private _templateCrossSize = 0;
    private _templateDirty = true;
    private _resetGeometry = true;
    private _pendingAnchor: ListAnchor | null | undefined;
    private _pendingPosition: number | null = 0;
    private _pendingTarget: ScrollTarget | null = null;
    private _animation: Laya.Tween | null = null;
    private _committing = false;
    private _changingCellData = false;
    private _suspended = false;
    private _disposing = false;
    private _lastPosition = 0;
    private _rangeViewport = -1;
    private _rangeLength = -1;

    constructor() {
        super();
        super.scrollType = Laya.ScrollType.Vertical;
        this._configureListScrollBar();
        this.on(Laya.Event.ADDED, this, this._resumeList);
        this.on(Laya.Event.REMOVED, this, this._suspendList);
    }

    @Laya.property({ type: Laya.Prefab, nullable: true, default: null })
    get cellPrefab(): Laya.Prefab | null {
        return this._cellPrefab;
    }

    set cellPrefab(value: Laya.Prefab | null) {
        this._assertMutable();
        if (value !== null && (!(value instanceof Laya.Prefab) || value.destroyed)) {
            throw new TypeError("UIList cellPrefab must be a live Laya.Prefab");
        }
        if (value === this._cellPrefab) {
            return;
        }
        this.stopScroll();
        this._clearCells();
        value?._addReference();
        this._cellPrefab?._removeReference();
        this._cellPrefab = value;
        this._templateDirty = this._resetGeometry = true;
        this._pendingPosition = 0;
        this._schedule();
    }

    /** Vertical/None 每行列数，Horizontal 每列行数；按条目自身尺寸和间距排列。 */
    @Laya.property({ type: Number, default: 1, min: 1, step: 1, fractionDigits: 0 })
    get wrapCount(): number {
        return this._wrapCount;
    }

    set wrapCount(value: number) {
        this._assertMutable();
        if (!Number.isSafeInteger(value) || value < 1) {
            throw new LayoutError("UIList wrapCount must be a positive safe integer");
        }
        if (value === this._wrapCount) {
            return;
        }
        this.stopScroll();
        this._wrapCount = value;
        this._templateDirty = this._resetGeometry = true;
        this._pendingAnchor = null;
        this._pendingPosition = 0;
        this._schedule();
    }

    @Laya.property({ type: Number, default: 0, step: 1, fractionDigits: 0 })
    get gapX(): number {
        return this._gapX;
    }
    set gapX(value: number) {
        this._setGap("gapX", value);
    }

    @Laya.property({ type: Number, default: 0, step: 1, fractionDigits: 0 })
    get gapY(): number {
        return this._gapY;
    }
    set gapY(value: number) {
        this._setGap("gapY", value);
    }

    @Laya.property({
        type: Number,
        default: Laya.ScrollType.Vertical,
        enumSource: [
            { name: "不滚动", value: Laya.ScrollType.None },
            { name: "横向", value: Laya.ScrollType.Horizontal },
            { name: "纵向", value: Laya.ScrollType.Vertical },
        ],
    })
    override get scrollType(): Laya.ScrollType {
        return super.scrollType;
    }
    override set scrollType(value: Laya.ScrollType) {
        this._assertMutable();
        if (
            value !== Laya.ScrollType.None &&
            value !== Laya.ScrollType.Horizontal &&
            value !== Laya.ScrollType.Vertical
        ) {
            throw new LayoutError(`unsupported UIList scrollType: ${String(value)}`);
        }
        if (value === super.scrollType) {
            return;
        }
        this.stopScroll();
        this._clearCells();
        super.scrollType = value;
        this._configureListScrollBar();
        this._templateDirty = this._resetGeometry = true;
        this._pendingAnchor = null;
        this._pendingPosition = 0;
        this._schedule();
    }

    /** 只读数组快照；替换数据回到起点，保持阅读位置请用 refreshData。 */
    override get dataSource(): readonly T[] {
        return this._data;
    }
    override set dataSource(value: readonly T[]) {
        this._replaceData(value, false);
    }

    get scrollPosition(): number {
        const rect = this.content?.scrollRect;
        return this._isVertical ? (rect?.y ?? 0) : (rect?.x ?? 0);
    }

    get maxScrollPosition(): number {
        if (this.scrollType === Laya.ScrollType.None) {
            return 0;
        }
        return Math.max(0, this._geometry.totalSize - this._viewportSize());
    }

    override get contentWidth(): number {
        return this._isVertical
            ? (this._geometry?.totalCrossSize ?? 0)
            : (this._geometry?.totalSize ?? 0);
    }
    override get contentHeight(): number {
        return this._isVertical
            ? (this._geometry?.totalSize ?? 0)
            : (this._geometry?.totalCrossSize ?? 0);
    }

    refreshData(data: readonly T[] = this._data): void {
        this._replaceData(data, true);
    }

    refreshItem(index: number): void {
        this._assertMutable();
        this._checkIndex(index);
        this._saveAnchor();
        this._dirty.add(index);
        this._commit();
    }

    getCell(index: number): UIWidget | null {
        this._checkIndex(index);
        return this._cells.get(index)?.node ?? null;
    }

    override scrollTo(x = 0, y = 0): void {
        this._assertMutable();
        if (this.scrollType === Laya.ScrollType.None && (x !== 0 || y !== 0)) {
            throw new LayoutError("UIList cannot scroll when scrollType is None");
        }
        this.stopScroll();
        this._commit();
        super.scrollTo(x, y);
    }

    scrollToIndex(index: number, align: UIListScrollAlign = "start"): void {
        this._assertMutable();
        this._checkTarget(index, align);
        this.stopScroll();
        this._pendingTarget = { index, align };
        this._commit();
    }

    /** duration 单位为秒，动画过程与完成时均按当前测量修正目标。 */
    tweenToIndex(index: number, duration = 0.3, align: UIListScrollAlign = "start"): void {
        this._assertMutable();
        this._checkTarget(index, align);
        if (!Number.isFinite(duration) || duration < 0) {
            throw new RangeError("UIList tween duration must be finite and non-negative");
        }
        this.stopScroll();
        this._commit();
        if (!this._ready()) {
            throw new LayoutError("UIList tween requires a mounted, active, non-zero viewport");
        }
        if (duration === 0) {
            this.scrollToIndex(index, align);
            return;
        }
        const start = this.scrollPosition;
        const progress = { ratio: 0 };
        this._animation = Laya.Tween.create(progress, this)
            .duration(duration * 1000)
            .to("ratio", 1)
            .onUpdate(() => {
                const target = this._geometry.target(index, this._viewportSize(), align);
                this._writePosition(start + (target - start) * progress.ratio);
            })
            .then(() => {
                this._animation = null;
                this.scrollToIndex(index, align);
            });
    }

    stopScroll(): void {
        this._cancelAnimation();
        this._pendingTarget = null;
        this.hScrollBar?.stopScroll();
        this.vScrollBar?.stopScroll();
    }

    override refresh(): void {
        this._commit();
    }

    override layout(): void {
        if (!this._cells || this._committing || this._disposing) {
            return;
        }
        super.layout();
    }

    protected override layoutChildren(): void {
        this._commit();
    }
    protected override measureWidth(): number {
        return this.paddingLeft + this.paddingRight;
    }
    protected override measureHeight(): number {
        return this.paddingTop + this.paddingBottom;
    }

    protected override onScrollPositionChanged(): void {
        if (this._cells && !this._committing && this.scrollPosition !== this._lastPosition) {
            this._commit();
        }
    }

    protected override get clipsViewport(): boolean {
        return this.scrollType !== Laya.ScrollType.None;
    }

    protected override createScrollBar(vertical: boolean): Laya.ScrollBar {
        const bar = new UIListScrollBar();
        bar.isVertical = vertical;
        return bar;
    }

    /** 列表自行批量刷新范围，不为每个虚拟节点重复安排 UIPanel 刷新。 */
    override _panelChildChanged(_child?: Laya.Sprite): void {
        this._schedule();
    }

    override onEnable(): void {
        super.onEnable();
        this._resumeList();
    }
    override onDisable(): void {
        this._suspendList();
        super.onDisable();
    }

    override onPreDestroy(): void {
        this._disposing = true;
        this._suspendList();
        this._clearCells();
        this._data = [];
        this._dirty.clear();
        this._pendingAnchor = undefined;
        this._cellPrefab?._removeReference();
        this._cellPrefab = null;
        super.onPreDestroy();
    }

    override onDestroy(): void {
        this.off(Laya.Event.ADDED, this, this._resumeList);
        this.off(Laya.Event.REMOVED, this, this._suspendList);
        super.onDestroy();
    }

    private _replaceData(data: readonly T[], preserve: boolean): void {
        this._assertMutable();
        if (!Array.isArray(data)) {
            throw new TypeError("UIList dataSource must be an array");
        }
        this.stopScroll();
        if (preserve) {
            this._saveAnchor();
        } else {
            this._pendingAnchor = undefined;
            this._pendingPosition = 0;
        }
        const previous = this._data;
        this._data = Object.freeze(Array.from(data));
        this._resetGeometry = true;
        this._commit();
        this.event(UIEvent.DATA_SOURCE_CHANGED, [this._data, previous]);
    }

    private _ready(): boolean {
        return Boolean(
            this._cells &&
            !this.destroyed &&
            !this._disposing &&
            !this._suspended &&
            this.active &&
            this.parent &&
            !Laya.SerializeUtil.isDeserializing &&
            Laya.LayaEnv.isPlaying &&
            this.content.width > 0 &&
            this.content.height > 0
        );
    }

    private _commit(): void {
        if (this._committing || !this._ready()) {
            return;
        }
        this.timer.clearCallLater(this, this._commit);
        this._committing = true;
        try {
            this._commitItems();
        } finally {
            this._committing = false;
        }
        const position = this.scrollPosition;
        if (position !== this._lastPosition) {
            this._lastPosition = position;
            this.event(Laya.Event.CHANGE, position);
        }
    }

    private _commitItems(): void {
        const viewport = this._viewportSize();
        const anchor =
            this._pendingAnchor === undefined
                ? this._geometry.anchor(this.scrollPosition)
                : this._pendingAnchor;
        const managedNodes = new Set([...this._cells.values()].map((cell) => cell.node));
        if (this.children.some((node) => !managedNodes.has(node as UIWidget))) {
            throw new LayoutError(
                "UIList children are managed by cellPrefab; place decoration outside the list"
            );
        }
        if (this._data.length > 0 && !this._cellPrefab) {
            throw new LayoutError("UIList non-empty data requires cellPrefab");
        }
        if (this._resetGeometry) {
            this._clearVisibleCells();
            if (this._data.length && this._templateDirty) {
                this._measureTemplate();
            }
            this._geometry.reset(
                this._data.length,
                this._data.length ? this._templateSize : 1,
                this._data.length ? this._mainGap() : 0,
                this._wrapCount,
                this._data.length ? this._templateCrossSize : 1,
                this._data.length ? this._crossGap() : 0
            );
            this._resetGeometry = false;
            this._dirty.clear();
            this._refreshRange();
            this._writePosition(this._pendingPosition ?? this._geometry.restore(anchor, viewport));
        }
        const invalidSizes = new Map<number, number>();
        const invalidCrossSizes = new Map<number, number>();
        for (const index of this._dirty) {
            const cell = this._cells.get(index);
            if (cell) {
                this._clearCellData(cell);
                cell.dirty = true;
            } else {
                invalidSizes.set(index, this._templateSize);
                invalidCrossSizes.set(index, this._templateCrossSize);
            }
        }
        this._dirty.clear();
        if (this._geometry.update(invalidSizes, invalidCrossSizes)) {
            this._refreshRange();
            this._writePosition(this._geometry.restore(anchor, viewport));
        }
        // 主轴视口变大可能使末端位置前移，先更新范围再选择可见项。
        if (this._refreshRange()) {
            this._writePosition(this._geometry.restore(anchor, viewport));
        }
        // 每轮只绑定新进入或显式刷新的项；实测变小后继续扩展，直到覆盖视口。
        const laidOut = new Set<Cell>();
        const measured = new Map<number, { main: number; cross: number }>();
        for (;;) {
            if (this._pendingTarget && this._data.length) {
                this._writePosition(
                    this._geometry.target(
                        this._pendingTarget.index,
                        viewport,
                        this._pendingTarget.align
                    )
                );
            }
            const range = this._geometry.range(this.scrollPosition, viewport);
            const all = this.scrollType === Laya.ScrollType.None;
            const first = all ? 0 : Math.max(0, range.first - this._wrapCount);
            const last = all
                ? this._data.length - 1
                : Math.min(this._data.length - 1, range.last + this._wrapCount);
            for (const [index, cell] of this._cells) {
                if (index < first || index > last) {
                    this._cells.delete(index);
                    this._releaseCell(cell);
                }
            }
            const sizes = new Map<number, number>();
            const crossSizes = new Map<number, number>();
            for (let index = first; index <= last; index++) {
                let cell = this._cells.get(index);
                if (!cell) {
                    cell = this._pool.pop() ?? this._createCell();
                    cell.index = index;
                    cell.dirty = true;
                    this._cells.set(index, cell);
                    this.addChild(cell.node);
                }
                if (cell.dirty || !laidOut.has(cell)) {
                    this._layoutCell(cell);
                    laidOut.add(cell);
                }
                const size = this._mainSize(cell.node);
                const crossSize = this._crossSize(cell.node);
                const previous = measured.get(index);
                if (previous && (previous.main !== size || previous.cross !== crossSize)) {
                    throw new LayoutError(
                        `UIList item ${index} changed size repeatedly during layout; data source listeners must stabilize the item`
                    );
                }
                measured.set(index, { main: size, cross: crossSize });
                sizes.set(index, size);
                crossSizes.set(index, crossSize);
            }
            if (!this._geometry.update(sizes, crossSizes)) {
                break;
            }
            this._refreshRange();
            this._writePosition(this._geometry.restore(anchor, viewport));
        }
        for (const [index, cell] of this._cells) {
            const offset = this._geometry.offset(index);
            const crossOffset = this._geometry.crossOffset(index);
            cell.node.applyLayoutPosition(
                this._isVertical ? crossOffset : offset,
                this._isVertical ? offset : crossOffset
            );
        }
        this._pendingAnchor = undefined;
        this._pendingPosition = null;
        this._pendingTarget = null;
    }

    private _layoutCell(cell: Cell): void {
        const node = cell.node;
        if (cell.dirty) {
            // 恢复模板两轴的尺寸来源，避免前一次绑定留下的显式大小污染新数据。
            node.size(cell.initialWidth, cell.initialHeight);
            if (cell.index >= 0) {
                node.dataSource = this._data[cell.index];
            }
            cell.dirty = false;
        }
        this._validateRoot(node);
        node.requestLayout();
        validateListItemSize(this._mainSize(node), this._mainGap());
        validateListItemSize(this._crossSize(node), this._crossGap());
    }

    private _measureTemplate(): void {
        const sample = this._createCell();
        try {
            this.addChild(sample.node);
            sample.node.requestLayout();
            const size = this._mainSize(sample.node);
            const crossSize = this._crossSize(sample.node);
            validateListItemSize(size, this._mainGap());
            validateListItemSize(crossSize, this._crossGap());
            this._templateSize = size;
            this._templateCrossSize = crossSize;
            this._templateDirty = false;
        } catch (error) {
            sample.node.destroy();
            throw error;
        }
        sample.node.removeSelf();
        const previous = this._pool.pop();
        if (previous) {
            this._destroyCell(previous);
        }
        this._pool.push(sample);
    }

    private _createCell(): Cell {
        const errors: unknown[] = [];
        const node = this._cellPrefab!.create(undefined, errors);
        if (errors.length) {
            node?.destroy();
            throw new LayoutError(
                `UIList cellPrefab creation failed: ${errors.map(String).join("; ")}`
            );
        }
        if (!(node instanceof UIWidget)) {
            if (node instanceof Laya.Node) {
                node.destroy();
            }
            throw new LayoutError("UIList cellPrefab root must be UIWidget");
        }
        try {
            this._validateRoot(node);
        } catch (error) {
            node.destroy();
            throw error;
        }
        node.hideFlags = Laya.HideFlags.HideAndDontSave;
        node._setBit(Laya.NodeFlags.LOCK_BY_EDITOR, true);
        node.on(Laya.Event.RESIZE, this, this._schedule);
        return {
            node,
            initialWidth: node.widthSource === "explicit" ? node.width : null,
            initialHeight: node.heightSource === "explicit" ? node.height : null,
            index: -1,
            dirty: false,
        };
    }

    private _validateRoot(node: UIWidget): void {
        if (
            node.destroyed ||
            node.hasRelativeLayout ||
            node.scaleX !== 1 ||
            node.scaleY !== 1 ||
            node.rotation !== 0 ||
            node.pivotX !== 0 ||
            node.pivotY !== 0
        ) {
            throw new LayoutError(
                "UIList cell root requires no relative constraints, unit scale, zero rotation and pivot"
            );
        }
    }

    private _releaseCell(cell: Cell): void {
        this._clearCellData(cell);
        cell.index = -1;
        cell.node.removeSelf();
        this._pool.push(cell);
    }

    private _clearCellData(cell: Cell): void {
        this._changingCellData = true;
        try {
            cell.node.dataSource = undefined;
        } finally {
            this._changingCellData = false;
        }
    }

    private _clearVisibleCells(): void {
        for (const cell of this._cells.values()) {
            this._releaseCell(cell);
        }
        this._cells.clear();
    }

    private _clearCells(): void {
        this._clearVisibleCells();
        for (const cell of this._pool) {
            this._destroyCell(cell);
        }
        this._pool.length = 0;
    }

    private _destroyCell(cell: Cell): void {
        cell.node.off(Laya.Event.RESIZE, this, this._schedule);
        cell.node.destroy();
    }

    private _configureListScrollBar(): void {
        this._rangeViewport = this._rangeLength = -1;
        const bar = this._scrollBar();
        if (bar) {
            bar.hide = true;
            bar.tick = 0;
            bar.off(Laya.Event.START, this, this._onBarStart);
            bar.off(Laya.Event.END, this, this._onBarEnd);
            bar.on(Laya.Event.START, this, this._onBarStart);
            bar.on(Laya.Event.END, this, this._onBarEnd);
        }
    }

    private _onBarStart(): void {
        this._cancelAnimation();
        this.event(Laya.Event.START);
    }
    private _onBarEnd(): void {
        this.event(Laya.Event.END);
    }
    private _scrollBar(): Laya.ScrollBar | null {
        return this._isVertical ? this.vScrollBar : this.hScrollBar;
    }
    private get _isVertical(): boolean {
        return this.scrollType !== Laya.ScrollType.Horizontal;
    }
    private _mainSize(node: UIWidget): number {
        return this._isVertical ? node.height : node.width;
    }
    private _viewportSize(): number {
        return this._isVertical ? this.content.height : this.content.width;
    }
    private _crossSize(node: UIWidget): number {
        return this._isVertical ? node.width : node.height;
    }
    private _mainGap(): number {
        return this._isVertical ? this._gapY : this._gapX;
    }
    private _crossGap(): number {
        return this._isVertical ? this._gapX : this._gapY;
    }

    private _setGap(axis: "gapX" | "gapY", value: number): void {
        this._assertMutable();
        if (!Number.isFinite(value)) {
            throw new LayoutError(`UIList ${axis} must be finite`);
        }
        const main = (axis === "gapY") === this._isVertical;
        const template = main ? this._templateSize : this._templateCrossSize;
        if (template > 0) {
            validateListItemSize(template, value);
        }
        for (const cell of this._cells.values()) {
            validateListItemSize(
                main ? this._mainSize(cell.node) : this._crossSize(cell.node),
                value
            );
        }
        if (value === (axis === "gapX" ? this._gapX : this._gapY)) {
            return;
        }
        this._saveAnchor();
        if (axis === "gapX") {
            this._gapX = value;
        } else {
            this._gapY = value;
        }
        this._resetGeometry = true;
        this._schedule();
    }

    private _writePosition(value: number): void {
        if (this._isVertical) {
            super.scrollTo(0, value);
        } else {
            super.scrollTo(value, 0);
        }
    }

    private _refreshRange(): boolean {
        const viewport = this._viewportSize();
        const length = this._geometry.totalSize;
        if (viewport === this._rangeViewport && length === this._rangeLength) {
            return false;
        }
        this._rangeViewport = viewport;
        this._rangeLength = length;
        super.refresh();
        return true;
    }

    private _saveAnchor(): void {
        if (this._pendingAnchor === undefined) {
            this._pendingAnchor = this._geometry.anchor(this.scrollPosition);
        }
    }
    private _schedule(): void {
        if (this._cells && !this._committing && !this._disposing && !this._suspended) {
            this.callLater(this._commit);
        }
    }
    private _cancelAnimation(): void {
        this._animation?.kill();
        this._animation = null;
    }
    private _resumeList(): void {
        if (!this._cells || this._disposing) {
            return;
        }
        this._suspended = false;
        if (this._scrollBar()) {
            this._scrollBar()!.target = this.content;
        }
        this._schedule();
    }
    private _suspendList(): void {
        this._suspended = true;
        this.stopScroll();
        if (this._scrollBar()) {
            this._scrollBar()!.target = null as unknown as Laya.Sprite;
        }
        this.timer.clearCallLater(this, this._commit);
        this.cancelScrollRefresh();
    }
    private _assertMutable(): void {
        if (this._committing || this._changingCellData || this._disposing || this.destroyed) {
            throw new LayoutError(
                "UIList cannot mutate data or configuration during data source events or destruction"
            );
        }
    }
    private _checkIndex(index: number): void {
        if (!Number.isSafeInteger(index) || index < 0 || index >= this._data.length) {
            throw new RangeError(`UIList index out of range: ${index}`);
        }
    }
    private _checkTarget(index: number, align: UIListScrollAlign): void {
        if (this.scrollType === Laya.ScrollType.None) {
            throw new LayoutError("UIList cannot scroll when scrollType is None");
        }
        this._checkIndex(index);
        if (align !== "start" && align !== "center" && align !== "end") {
            throw new LayoutError(`unsupported UIList scroll alignment: ${String(align)}`);
        }
    }
}

/** Laya.stopScroll 不会复位弹性标记；列表中断后立即恢复合法像素位置。 */
class UIListScrollBar extends Laya.ScrollBar {
    override stopScroll(): void {
        if (!this.target) {
            this._clickOnly = true;
            this._isElastic = false;
            this.value = Math.max(this.min, Math.min(this.max, this.value));
        }
        super.stopScroll();
        this._clickOnly = true;
        this._isElastic = false;
        this.value = Math.max(this.min, Math.min(this.max, this.value));
    }
}
