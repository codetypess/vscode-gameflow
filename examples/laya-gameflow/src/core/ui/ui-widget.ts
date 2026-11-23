import { registerClassAlias } from "./class-alias";
import type { LayoutParentRect, LayoutSizeSource } from "./layout";
import { LayoutError, resolveLayout, type LayoutNodeResult } from "./layout";
import { UIEvent } from "./ui-event";

export type RelativeLayoutProperty = "left" | "right" | "centerX" | "top" | "bottom" | "centerY";
export type RelativeLayoutUnit = "absolute" | "percent";

type RelativeLayoutValues = Record<RelativeLayoutProperty, number>;
type RelativeLayoutConstraints = Record<RelativeLayoutProperty, number | null>;
const RELATIVE_LAYOUT_PROPERTIES: readonly RelativeLayoutProperty[] = [
    "left",
    "right",
    "centerX",
    "top",
    "bottom",
    "centerY",
];

/** 所有自定义 UI 节点的 Sprite 基类。 */
@registerClassAlias("UIWidget")
@Laya.regClass()
@Laya.classInfo({
    icon: "plugins/type-icons/node/Widget.svg",
    properties: [
        { name: "x", type: Number, default: 0, onChange: "syncWidgetLayout" },
        { name: "y", type: Number, default: 0, onChange: "syncWidgetLayout" },
        {
            name: "relativeLayout",
            caption: "布局约束",
            catalog: "相对布局",
            catalogOrder: 5,
            inspector: "xq.RelativeLayout",
            serializable: false,
        },
    ],
})
export class UIWidget extends Laya.Sprite {
    private _dataSource: unknown;
    private _showEditorBorder = false;
    private _onceLayout = false;
    private _layoutOnceApplied = false;
    private _layoutUnit: RelativeLayoutUnit = "absolute";
    private _left: number | null = null;
    private _right: number | null = null;
    private _centerX: number | null = null;
    private _top: number | null = null;
    private _bottom: number | null = null;
    private _centerY: number | null = null;

    private _explicitWidth = false;
    private _explicitHeight = false;
    private _writingLayoutSize = false;
    private _layoutResizeDepth = 0;
    private _uiInitialized = false;
    private _layoutResult: LayoutNodeResult | null = null;
    private _layoutParent: Laya.Sprite | null = null;

    constructor() {
        super();
        this._uiInitialized = true;
        this.on(Laya.Event.ADDED, this, this._onAddedToParent);
        this.on(Laya.Event.REMOVED, this, this._onRemovedFromParent);
    }

    /** 只控制场景编辑器的范围提示，运行时不绘制。 */
    @Laya.property({ type: Boolean, default: false, caption: "显示虚线框", catalog: "编辑器" })
    get showEditorBorder(): boolean {
        return this._showEditorBorder;
    }

    set showEditorBorder(value: boolean) {
        if (typeof value !== "boolean") {
            throw new TypeError("UIWidget showEditorBorder must be a boolean");
        }
        if (this.destroyed) {
            throw new LayoutError("UIWidget showEditorBorder cannot change after destruction");
        }
        this._showEditorBorder = value;
    }

    /** 运行时只自动布局一次；手动 layout() 仍可刷新，编辑态始终实时预览。 */
    @Laya.property({
        type: Boolean,
        default: false,
        caption: "仅布局一次",
        catalog: "相对布局",
        position: "before layoutUnit",
        tips: "运行时仅自动布局一次；手动调用 layout() 仍可刷新，关闭后恢复自动刷新。",
    })
    get onceLayout(): boolean {
        return this._onceLayout;
    }

    set onceLayout(value: boolean) {
        if (typeof value !== "boolean") {
            throw new TypeError("UIWidget onceLayout must be a boolean");
        }
        if (this.destroyed) {
            throw new LayoutError("UIWidget onceLayout cannot change after destruction");
        }
        if (value === this._onceLayout) {
            return;
        }
        this._onceLayout = value;
        this._layoutOnceApplied = false;
        this.requestLayout();
    }

    /** 运行时数据；同值不重复通知，事件参数依次为新值和旧值。 */
    @Laya.property({ hidden: true, serializable: false })
    get dataSource(): unknown {
        return this._dataSource;
    }

    set dataSource(value: unknown) {
        if (this.destroyed) {
            throw new LayoutError("UIWidget dataSource cannot change after destruction");
        }
        const previous = this._dataSource;
        if (Object.is(value, previous)) {
            return;
        }
        this._dataSource = value;
        this.event(UIEvent.DATA_SOURCE_CHANGED, [value, previous]);
    }

    override get width(): number {
        return super.width;
    }

    override set width(value: number) {
        this._setExternalWidth(value);
    }

    override get height(): number {
        return super.height;
    }

    override set height(value: number) {
        this._setExternalHeight(value);
    }

    /** 新 UI 的尺寸来源由显式尺寸、控件测量或双边约束决定，不启用 Sprite.autoSize。 */
    @Laya.property({ hidden: true, serializable: false })
    override get autoSize(): boolean {
        return false;
    }

    override set autoSize(value: boolean) {
        if (value) {
            throw new LayoutError("UIWidget does not support autoSize");
        }
        super.autoSize = false;
    }

    override size(width: number | null, height: number | null): this {
        if (width !== null && !Number.isFinite(width)) {
            throw new TypeError("UIWidget width must be finite");
        }
        if (height !== null && !Number.isFinite(height)) {
            throw new TypeError("UIWidget height must be finite");
        }
        if (width !== null && width < 0) {
            throw new LayoutError("UIWidget width must be non-negative");
        }
        if (height !== null && height < 0) {
            throw new LayoutError("UIWidget height must be non-negative");
        }
        if (!this._writingLayoutSize) {
            this._explicitWidth = width !== null;
            this._explicitHeight = height !== null;
        }
        super.size(width as number, height as number);
        if (!this._writingLayoutSize && this._uiInitialized) {
            this.event(Laya.Event.RESIZE);
            this.requestLayout();
        }
        return this;
    }

    @Laya.property({
        type: String,
        default: "absolute",
        caption: "数值单位",
        catalog: "相对布局",
        position: "before relativeLayout",
        enumSource: [
            { name: "绝对值", value: "absolute" },
            { name: "百分比", value: "percent" },
        ],
        tips: "六项约束共用单位。百分比按父内容区宽高计算，10 表示 10%；切换时换算已启用值并保持布局。",
    })
    get layoutUnit(): RelativeLayoutUnit {
        return this._layoutUnit;
    }

    set layoutUnit(value: RelativeLayoutUnit) {
        if (value !== "absolute" && value !== "percent") {
            throw new LayoutError(`unsupported relative layout unit: ${String(value)}`);
        }
        if (value === this._layoutUnit) {
            return;
        }
        // 保存值已经使用目标单位，恢复时不能根据属性顺序再次换算。
        if (!Laya.SerializeUtil?.isDeserializing && this.hasRelativeLayout) {
            if (this.parent instanceof UIWidget) {
                this.parent.validateChildLayoutUnit(this, value);
            }
            const rect = this._requireLayoutParentRect();
            const constraints = this._getRelativeLayoutConstraints();
            for (const name of RELATIVE_LAYOUT_PROPERTIES) {
                const current = constraints[name];
                if (current !== null) {
                    const parentSize = this._getConstraintParentSize(name, rect);
                    const absolute = this.resolveRelativeLayoutValue(current, parentSize)!;
                    constraints[name] = this._fromAbsoluteLayoutValue(absolute, parentSize, value);
                }
            }
            this._writeRelativeLayoutConstraints(constraints);
        }
        this._layoutUnit = value;
        this.requestLayout();
    }

    @Laya.property({
        type: Number,
        nullable: true,
        default: null,
        hidden: true,
    })
    get left(): number | null {
        return this._left;
    }

    set left(value: number | null) {
        value = this._constraint("left", value);
        this._retainStretchSize(true, value);
        this._left = value;
        this.requestLayout();
    }

    @Laya.property({
        type: Number,
        nullable: true,
        default: null,
        hidden: true,
    })
    get right(): number | null {
        return this._right;
    }

    set right(value: number | null) {
        value = this._constraint("right", value);
        this._retainStretchSize(true, value);
        this._right = value;
        this.requestLayout();
    }

    @Laya.property({
        type: Number,
        nullable: true,
        default: null,
        hidden: true,
    })
    get centerX(): number | null {
        return this._centerX;
    }

    set centerX(value: number | null) {
        this._centerX = this._constraint("centerX", value);
        this.requestLayout();
    }

    @Laya.property({
        type: Number,
        nullable: true,
        default: null,
        hidden: true,
    })
    get top(): number | null {
        return this._top;
    }

    set top(value: number | null) {
        value = this._constraint("top", value);
        this._retainStretchSize(false, value);
        this._top = value;
        this.requestLayout();
    }

    @Laya.property({
        type: Number,
        nullable: true,
        default: null,
        hidden: true,
    })
    get bottom(): number | null {
        return this._bottom;
    }

    set bottom(value: number | null) {
        value = this._constraint("bottom", value);
        this._retainStretchSize(false, value);
        this._bottom = value;
        this.requestLayout();
    }

    @Laya.property({
        type: Number,
        nullable: true,
        default: null,
        hidden: true,
    })
    get centerY(): number | null {
        return this._centerY;
    }

    set centerY(value: number | null) {
        this._centerY = this._constraint("centerY", value);
        this.requestLayout();
    }

    @Laya.property({
        type: String,
        serializable: false,
        readonly: true,
        caption: "宽度来源",
        catalog: "相对布局",
        enumSource: [
            { name: "显式尺寸", value: "explicit" },
            { name: "内容测量", value: "measured" },
            { name: "双边拉伸", value: "stretch" },
        ],
    })
    get widthSource(): LayoutSizeSource {
        if (this.left !== null && this.right !== null) {
            return "stretch";
        }
        return this.isWidthExplicit ? "explicit" : "measured";
    }

    @Laya.property({
        type: String,
        serializable: false,
        readonly: true,
        caption: "高度来源",
        catalog: "相对布局",
        enumSource: [
            { name: "显式尺寸", value: "explicit" },
            { name: "内容测量", value: "measured" },
            { name: "双边拉伸", value: "stretch" },
        ],
    })
    get heightSource(): LayoutSizeSource {
        if (this.top !== null && this.bottom !== null) {
            return "stretch";
        }
        return this.isHeightExplicit ? "explicit" : "measured";
    }

    get hasRelativeLayout(): boolean {
        return (
            this.left !== null ||
            this.right !== null ||
            this.centerX !== null ||
            this.top !== null ||
            this.bottom !== null ||
            this.centerY !== null
        );
    }

    /** 最近一次提交的布局结果；未挂载或尚未 flush 时为 null。 */
    get layoutRect(): Readonly<LayoutNodeResult> | null {
        return this._layoutResult ? { ...this._layoutResult } : null;
    }

    /** 自动布局请求；运行态 onceLayout 已完成时跳过。 */
    requestLayout(): void {
        if (this._onceLayout && Laya.LayaEnv.isPlaying && this._layoutOnceApplied) {
            return;
        }
        this.layout();
    }

    /** 根据当前父节点立即提交布局，手动调用不受 onceLayout 限制。 */
    layout(): void {
        const onceLayout = this._onceLayout && Laya.LayaEnv.isPlaying;
        if (
            !this._uiInitialized ||
            this.destroyed ||
            !this.parent ||
            Laya.SerializeUtil?.isDeserializing
        ) {
            return;
        }
        // 派生控件在 onLayoutApplied 中可能同步请求自动布局，先占用本次提交。
        const previouslyApplied = this._layoutOnceApplied;
        if (onceLayout) {
            this._layoutOnceApplied = true;
        }
        const widthBefore = this.width;
        const heightBefore = this.height;
        try {
            this._bindParentResize();
            const parentRect = this.getLayoutParentRect()!;
            const constraints = this._getRelativeLayoutConstraints();
            for (const name of RELATIVE_LAYOUT_PROPERTIES) {
                constraints[name] = this.resolveRelativeLayoutValue(
                    constraints[name],
                    this._getConstraintParentSize(name, parentRect)
                );
            }
            const result = resolveLayout(
                {
                    x: this.x,
                    y: this.y,
                    width: this.width,
                    height: this.height,
                    scaleX: this.scaleX,
                    scaleY: this.scaleY,
                    pivotX: this.pivotX,
                    pivotY: this.pivotY,
                    widthSet: this.isWidthExplicit,
                    heightSet: this.isHeightExplicit,
                    measureWidth: () => this.measureWidth(),
                    measureHeight: () => this.measureHeight(),
                    ...constraints,
                },
                parentRect
            );
            this._applyLayoutResult(result);
            this.onLayoutApplied(result);
            // 求解过程中不发 RESIZE。提交后尺寸变了再通知一次，引擎 Widget 子节点才能跟着拉高。
            if (
                this._layoutResizeDepth === 0 &&
                (this.width !== widthBefore || this.height !== heightBefore)
            ) {
                this._layoutResizeDepth++;
                try {
                    this.event(Laya.Event.RESIZE);
                } finally {
                    this._layoutResizeDepth--;
                }
            }
        } catch (error) {
            this._layoutOnceApplied = previouslyApplied;
            throw error;
        }
    }

    /** IDE 拖动直接调用此约定方法，Position 面板通过 onChange 调用。 */
    syncWidgetLayout(): void {
        if (this.destroyed || !this.parent || !this.hasRelativeLayout) {
            return;
        }
        const rect = this._requireLayoutParentRect();
        const values = this._getRelativeLayoutValues(rect);
        const constraints = this._getRelativeLayoutConstraints();
        for (const name of RELATIVE_LAYOUT_PROPERTIES) {
            if (constraints[name] !== null) {
                constraints[name] = this._fromAbsoluteLayoutValue(
                    values[name],
                    this._getConstraintParentSize(name, rect),
                    this.layoutUnit
                );
            }
        }
        // 全部计算成功后再写入和布局，避免反算失败时部分更新或拖动位置回弹。
        this._writeRelativeLayoutConstraints(constraints);
        this.requestLayout();
    }

    /** 按当前视觉位置反算单个约束，供编辑器首次启用相对布局时使用。 */
    getRelativeLayoutValue(name: RelativeLayoutProperty): number {
        if (!RELATIVE_LAYOUT_PROPERTIES.includes(name)) {
            throw new LayoutError(`unsupported relative layout property: ${String(name)}`);
        }
        const rect = this._requireLayoutParentRect();
        return this._fromAbsoluteLayoutValue(
            this._getRelativeLayoutValues(rect)[name],
            this._getConstraintParentSize(name, rect),
            this.layoutUnit
        );
    }

    protected onLayoutApplied(_result: LayoutNodeResult): void {
        // UIWidget 本身也可以作为预制体根节点。没有 UIBox 时，子 UIWidget
        // 仍然需要按各自的相对约束递归提交。
        for (const child of this.children) {
            if (child instanceof UIWidget) {
                child.requestLayout();
            }
        }
    }

    protected getContentRect(): LayoutParentRect {
        const getWidth = () => this.width;
        const getHeight = () => this.height;
        return {
            x: 0,
            y: 0,
            get width() {
                return getWidth();
            },
            get height() {
                return getHeight();
            },
        };
    }

    /** 容器可在单位和约束写入前拒绝新的测量依赖。 */
    protected validateChildLayoutUnit(_child: UIWidget, _unit: RelativeLayoutUnit): void {}

    /** 测量依赖父级拉伸尺寸的控件可在提交布局前取得同一内容区。 */
    protected getLayoutParentRect(): LayoutParentRect | null {
        const parent = this.parent;
        if (parent instanceof UIWidget) {
            return parent.getContentRect();
        }
        return parent ? { x: 0, y: 0, width: parent.width, height: parent.height } : null;
    }

    /** 布局求解及派生控件测量共用的绝对距离。百分数 10 表示父内容区的 10%。 */
    protected resolveRelativeLayoutValue(value: number | null, parentSize: number): number | null {
        if (value === null || this.layoutUnit === "absolute") {
            return value;
        }
        return this._constraint("resolved relative layout value", (value * parentSize) / 100);
    }

    private _fromAbsoluteLayoutValue(
        value: number,
        parentSize: number,
        unit: RelativeLayoutUnit
    ): number {
        if (unit === "percent" && (!Number.isFinite(parentSize) || parentSize <= 0)) {
            throw new LayoutError(
                "relative layout percentage conversion requires a positive parent content size"
            );
        }
        return this._constraint(
            "converted relative layout value",
            unit === "percent" ? (value * 100) / parentSize : value
        )!;
    }

    private _getConstraintParentSize(name: RelativeLayoutProperty, rect: LayoutParentRect): number {
        return name === "left" || name === "right" || name === "centerX" ? rect.width : rect.height;
    }

    private _getRelativeLayoutConstraints(): RelativeLayoutConstraints {
        return {
            left: this.left,
            right: this.right,
            centerX: this.centerX,
            top: this.top,
            bottom: this.bottom,
            centerY: this.centerY,
        };
    }

    private _writeRelativeLayoutConstraints(values: RelativeLayoutConstraints): void {
        this._left = values.left;
        this._right = values.right;
        this._centerX = values.centerX;
        this._top = values.top;
        this._bottom = values.bottom;
        this._centerY = values.centerY;
    }

    private _requireLayoutParentRect(): LayoutParentRect {
        const rect = this.getLayoutParentRect();
        if (!rect) {
            throw new LayoutError("UIWidget relative layout requires a parent");
        }
        return rect;
    }

    private _getRelativeLayoutValues(rect: LayoutParentRect): RelativeLayoutValues {
        const left = this.x - this.pivotX * this.scaleX - rect.x;
        const top = this.y - this.pivotY * this.scaleY - rect.y;
        const availableWidth = rect.width - this.width * this.scaleX;
        const availableHeight = rect.height - this.height * this.scaleY;
        return {
            left,
            right: availableWidth - left,
            centerX: left - availableWidth * 0.5,
            top,
            bottom: availableHeight - top,
            centerY: top - availableHeight * 0.5,
        };
    }

    applyLayoutPosition(x: number, y: number): void {
        this.x = x;
        this.y = y;
    }

    protected get isWidthExplicit(): boolean {
        return this._explicitWidth;
    }

    protected get isHeightExplicit(): boolean {
        return this._explicitHeight;
    }

    protected override _childChanged(child?: Laya.Sprite): void {
        super._childChanged(child);
        this.requestLayout();
    }

    protected override _transChanged(kind: Laya.TransformKind): void {
        super._transChanged(kind);
        if (
            this._uiInitialized &&
            !this._writingLayoutSize &&
            (kind & (Laya.TransformKind.Width | Laya.TransformKind.Height)) !== 0
        ) {
            this.event(Laya.Event.RESIZE);
            if (this.parent instanceof UIWidget) {
                this.parent.requestLayout();
            }
        }
    }

    override onDestroy(): void {
        this._dataSource = undefined;
        if (this._layoutParent) {
            this._layoutParent.off(Laya.Event.RESIZE, this, this._onParentResize);
            this._layoutParent = null;
        }
        super.onDestroy();
    }

    protected override measureWidth(): number {
        return super.measureWidth();
    }

    protected override measureHeight(): number {
        return super.measureHeight();
    }

    private _applyLayoutResult(result: LayoutNodeResult): void {
        if (result.widthSource === "stretch") {
            this._writeLayoutSize(result.width, null);
        }
        if (result.heightSource === "stretch") {
            this._writeLayoutSize(null, result.height);
        }
        this.applyLayoutPosition(result.x, result.y);
        this._layoutResult = result;
    }

    private _writeLayoutSize(width: number | null, height: number | null): void {
        this._writingLayoutSize = true;
        try {
            const currentWidth = width === null && this._isWidthSet ? super.width : null;
            const currentHeight = height === null && this._isHeightSet ? super.height : null;
            super.size(
                (width === null ? currentWidth : width) as number,
                (height === null ? currentHeight : height) as number
            );
        } finally {
            this._writingLayoutSize = false;
        }
    }

    private _retainStretchSize(horizontal: boolean, value: number | null): void {
        if (value !== null || Laya.SerializeUtil?.isDeserializing) {
            return;
        }
        const source = horizontal ? this.widthSource : this.heightSource;
        const appliedSource = horizontal
            ? this._layoutResult?.widthSource
            : this._layoutResult?.heightSource;
        if (source !== "stretch" || appliedSource !== "stretch") {
            return;
        }
        // 拉伸尺寸已写入 Sprite；解除约束前固化该轴，让求解和保存沿用当前尺寸。
        if (horizontal) {
            this._explicitWidth = true;
        } else {
            this._explicitHeight = true;
        }
    }

    private _constraint(name: string, value: number | null): number | null {
        if (value === null) {
            return null;
        }
        if (!Number.isFinite(value)) {
            throw new LayoutError(`${name} must be finite or null`);
        }
        return value;
    }

    private _setExternalWidth(value: number): void {
        if (!Number.isFinite(value)) {
            throw new TypeError("UIWidget width must be finite");
        }
        if (value < 0) {
            throw new LayoutError("UIWidget width must be non-negative");
        }
        const height = this._isHeightSet ? super.height : null;
        this._writingLayoutSize = true;
        try {
            super.size(value, height as number);
        } finally {
            this._writingLayoutSize = false;
        }
        this._explicitWidth = true;
        this.event(Laya.Event.RESIZE);
        this.requestLayout();
    }

    private _setExternalHeight(value: number): void {
        if (!Number.isFinite(value)) {
            throw new TypeError("UIWidget height must be finite");
        }
        if (value < 0) {
            throw new LayoutError("UIWidget height must be non-negative");
        }
        const width = this._isWidthSet ? super.width : null;
        this._writingLayoutSize = true;
        try {
            super.size(width as number, value);
        } finally {
            this._writingLayoutSize = false;
        }
        this._explicitHeight = true;
        this.event(Laya.Event.RESIZE);
        this.requestLayout();
    }

    private _onAddedToParent(): void {
        this._bindParentResize();
        // HierarchyParser 先组装显示树，再在 SerializeUtil.isDeserializing 期间
        // 写入节点属性。延后一轮可以避开半成品约束，确保预制体所有字段写完后再布局。
        this.callLater(this._layoutAfterAdded);
    }

    private _layoutAfterAdded(): void {
        this.requestLayout();
    }

    private _onRemovedFromParent(): void {
        if (this._layoutParent) {
            this._layoutParent.off(Laya.Event.RESIZE, this, this._onParentResize);
            this._layoutParent = null;
        }
    }

    private _bindParentResize(): void {
        const parent = this.parent;
        if (parent === this._layoutParent) {
            return;
        }
        if (this._layoutParent) {
            this._layoutParent.off(Laya.Event.RESIZE, this, this._onParentResize);
        }
        this._layoutParent = parent;
        parent?.on(Laya.Event.RESIZE, this, this._onParentResize);
    }

    private _onParentResize(): void {
        this.requestLayout();
    }
}
