import { registerClassAlias } from "./class-alias";
import { LayoutError, type LayoutNodeResult, type LayoutParentRect } from "./layout";
import { UIBox } from "./ui-box";

/** 带背景、边框和滚动视口的面板容器。 */
@registerClassAlias("UIPanel")
@Laya.regClass()
@Laya.classInfo({
    menu: "自定义UI",
    icon: "plugins/type-icons/node/Panel.svg",
    properties: [
        {
            name: "showEditorBorder",
            type: Boolean,
            default: true,
            caption: "显示虚线框",
            catalog: "编辑器",
        },
        {
            name: "clipContent",
            type: Boolean,
            default: true,
            hidden: true,
            serializable: false,
        },
    ],
})
export class UIPanel extends UIBox {
    private readonly _content: UIPanelContent;
    private _backgroundColor: string | null = null;
    private _borderColor: string | null = null;
    private _borderWidth = 0;
    private _scrollType: Laya.ScrollType = Laya.ScrollType.None;
    private _vScrollBar: Laya.ScrollBar | null = null;
    private _hScrollBar: Laya.ScrollBar | null = null;
    private _scrollChanged = false;
    private _elasticEnabled = false;
    private _usedCache: string | null = null;

    constructor() {
        super();
        this.showEditorBorder = true;
        this._content = new UIPanelContent(this);
        this._content.hideFlags = Laya.HideFlags.HideAndDontSave;
        this._content._setBit(Laya.NodeFlags.LOCK_BY_EDITOR, true);
        this._addChild(this._content);
        this._setContainer(this._content);
        super.clipContent = this.clipsViewport;
        this.on(Laya.Event.RESIZE, this, this._onPanelResize);
        this._syncContentViewport();
    }

    @Laya.property({
        type: String,
        inspector: "color",
        nullable: true,
        default: null,
    })
    get backgroundColor(): string | null {
        return this._backgroundColor;
    }

    set backgroundColor(value: string | null) {
        this._backgroundColor = value;
        this._redrawPanel();
    }

    @Laya.property({
        type: String,
        inspector: "color",
        nullable: true,
        default: null,
    })
    get borderColor(): string | null {
        return this._borderColor;
    }

    set borderColor(value: string | null) {
        this._borderColor = value;
        this._redrawPanel();
    }

    @Laya.property({ type: Number, default: 0, min: 0 })
    get borderWidth(): number {
        return this._borderWidth;
    }

    set borderWidth(value: number) {
        if (!Number.isFinite(value) || value < 0) {
            throw new LayoutError("borderWidth must be non-negative");
        }
        this._borderWidth = value;
        this._redrawPanel();
    }

    @Laya.property({
        type: Number,
        default: Laya.ScrollType.None,
        enumSource: [
            { name: "不滚动", value: Laya.ScrollType.None },
            { name: "横向", value: Laya.ScrollType.Horizontal },
            { name: "纵向", value: Laya.ScrollType.Vertical },
            { name: "双向", value: Laya.ScrollType.Both },
        ],
    })
    get scrollType(): Laya.ScrollType {
        return this._scrollType;
    }

    set scrollType(value: Laya.ScrollType) {
        if (!this._isScrollType(value)) {
            throw new LayoutError(`unsupported UIPanel scrollType: ${String(value)}`);
        }
        if (this._scrollType === value) {
            return;
        }
        this._scrollType = value;
        this._syncScrollBars();
        super.clipContent = this.clipsViewport;
        this._syncContentViewport();
        this._setScrollChanged();
    }

    @Laya.property({ type: Boolean, default: false })
    get elasticEnabled(): boolean {
        return this._elasticEnabled;
    }

    set elasticEnabled(value: boolean) {
        this._elasticEnabled = Boolean(value);
        const elasticDistance = this._elasticEnabled ? 200 : 0;
        if (this._vScrollBar) {
            this._vScrollBar.elasticDistance = elasticDistance;
        }
        if (this._hScrollBar) {
            this._hScrollBar.elasticDistance = elasticDistance;
        }
    }

    override get clipContent(): boolean {
        return this.clipsViewport;
    }

    override set clipContent(value: boolean) {
        if (value !== this.clipsViewport) {
            throw new LayoutError(`UIPanel clipContent must always be ${this.clipsViewport}`);
        }
        super.clipContent = this.clipsViewport;
        if (this._content) {
            this._syncContentViewport();
        }
    }

    override get cacheAs(): string {
        return super.cacheAs;
    }

    override set cacheAs(value: string) {
        super.cacheAs = value;
        this._usedCache = null;
        this._bindScrollCacheEvents(this._hScrollBar);
        this._bindScrollCacheEvents(this._vScrollBar);
    }

    get vScrollBar(): Laya.ScrollBar | null {
        return this._vScrollBar;
    }

    get hScrollBar(): Laya.ScrollBar | null {
        return this._hScrollBar;
    }

    get content(): Laya.Sprite {
        return this._content;
    }

    get contentWidth(): number {
        return this._measureContentAxis("horizontal");
    }

    get contentHeight(): number {
        return this._measureContentAxis("vertical");
    }

    scrollTo(x = 0, y = 0): void {
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            throw new LayoutError("UIPanel scroll position must be finite");
        }
        if (this._vScrollBar) {
            this._vScrollBar.value = y;
        }
        if (this._hScrollBar) {
            this._hScrollBar.value = x;
        }
        this._applyScrollPosition();
    }

    refresh(): void {
        this._refreshScroll();
    }

    /** @internal */
    _panelChildChanged(child?: Laya.Sprite): void {
        if (child) {
            if (child.parent) {
                child.on(Laya.Event.RESIZE, this, this._setScrollChanged);
            } else {
                child.off(Laya.Event.RESIZE, this, this._setScrollChanged);
            }
        }
        this._setScrollChanged();
        // content 被隐藏，逻辑子节点变化仍须通知可见面板及其正常布局链。
        super._childChanged(child);
    }

    protected override getContentRect(): LayoutParentRect {
        const rect = super.getContentRect();
        return { x: 0, y: 0, width: rect.width, height: rect.height };
    }

    protected override onLayoutApplied(result: LayoutNodeResult): void {
        this._syncContentViewport();
        super.onLayoutApplied(result);
        this._redrawPanel();
        this._refreshScroll();
    }

    /** 内容 scrollRect 提交后的扩展点；子类可据此更新虚拟条目。 */
    protected onScrollPositionChanged(): void {}

    /** 普通面板始终裁剪；列表可按滚动模式控制两层视口。 */
    protected get clipsViewport(): boolean {
        return true;
    }

    protected createScrollBar(vertical: boolean): Laya.ScrollBar {
        return vertical ? new Laya.VScrollBar() : new Laya.HScrollBar();
    }

    /** 停用虚拟容器时取消尚未提交的滚动范围刷新。 */
    protected cancelScrollRefresh(): void {
        this.timer.clearCallLater(this, this._refreshScroll);
        this._scrollChanged = false;
    }

    override onDestroy(): void {
        this.timer.clearCallLater(this, this._refreshScroll);
        for (const child of this.children) {
            child.off(Laya.Event.RESIZE, this, this._setScrollChanged);
        }
        this._hScrollBar?.offAllCaller(this);
        this._vScrollBar?.offAllCaller(this);
        this.off(Laya.Event.RESIZE, this, this._onPanelResize);
        super.onDestroy();
    }

    private _syncScrollBars(): void {
        const needsHorizontal =
            this._scrollType === Laya.ScrollType.Horizontal ||
            this._scrollType === Laya.ScrollType.Both;
        const needsVertical =
            this._scrollType === Laya.ScrollType.Vertical ||
            this._scrollType === Laya.ScrollType.Both;

        if (needsHorizontal) {
            if (!this._hScrollBar) {
                this._createHScrollBar();
            }
        } else if (this._hScrollBar) {
            this._hScrollBar.destroy();
            this._hScrollBar = null;
        }

        if (needsVertical) {
            if (!this._vScrollBar) {
                this._createVScrollBar();
            }
        } else if (this._vScrollBar) {
            this._vScrollBar.destroy();
            this._vScrollBar = null;
        }
    }

    private _createHScrollBar(): void {
        const scrollBar = this.createScrollBar(false);
        this._hScrollBar = scrollBar;
        this._configureScrollBar(scrollBar);
    }

    private _createVScrollBar(): void {
        const scrollBar = this.createScrollBar(true);
        this._vScrollBar = scrollBar;
        this._configureScrollBar(scrollBar);
    }

    private _configureScrollBar(scrollBar: Laya.ScrollBar): void {
        scrollBar.hideFlags = Laya.HideFlags.HideAndDontSave;
        scrollBar._setBit(Laya.NodeFlags.LOCK_BY_EDITOR, true);
        scrollBar.on(Laya.Event.CHANGE, this, this._onScrollBarChange, [scrollBar]);
        scrollBar.target = this._content;
        scrollBar.elasticDistance = this._elasticEnabled ? 200 : 0;
        this._addChild(scrollBar);
        this._bindScrollCacheEvents(scrollBar);
    }

    private _syncContentViewport(): void {
        if (!this._content || this.destroyed) {
            return;
        }
        const rect = super.getContentRect();
        this._content.pos(rect.x, rect.y);
        this._content.size(rect.width, rect.height);
        if (!this.clipsViewport) {
            this._content.scrollRect = null as unknown as Laya.Rectangle;
            return;
        }
        const scrollRect = this._content.scrollRect ?? new Laya.Rectangle();
        scrollRect.setTo(
            this._hScrollBar?.value ?? 0,
            this._vScrollBar?.value ?? 0,
            rect.width,
            rect.height
        );
        this._content.scrollRect = scrollRect;
    }

    private _refreshScroll(): void {
        if (this.destroyed) {
            return;
        }
        this._scrollChanged = false;
        this._syncContentViewport();
        const viewport = super.getContentRect();
        const contentWidth = this.contentWidth;
        const contentHeight = this.contentHeight;
        const verticalOverflow = Boolean(this._vScrollBar && contentHeight > viewport.height);
        const horizontalOverflow = Boolean(this._hScrollBar && contentWidth > viewport.width);
        const visibleWidth = viewport.width - (verticalOverflow ? this._vScrollBar!.width : 0);
        const visibleHeight = viewport.height - (horizontalOverflow ? this._hScrollBar!.height : 0);
        if (visibleWidth < 0 || visibleHeight < 0) {
            throw new LayoutError("UIPanel scroll bars are larger than the content viewport");
        }

        if (this._vScrollBar) {
            this._vScrollBar.pos(viewport.x + viewport.width - this._vScrollBar.width, viewport.y);
            this._vScrollBar.height =
                viewport.height - (horizontalOverflow ? this._hScrollBar!.height : 0);
            this._vScrollBar.scrollSize = Math.max(viewport.height * 0.033, 1);
            this._vScrollBar.thumbPercent = contentHeight > 0 ? visibleHeight / contentHeight : 1;
            this._vScrollBar.setScroll(0, Math.max(0, contentHeight - visibleHeight));
        }
        if (this._hScrollBar) {
            this._hScrollBar.pos(
                viewport.x,
                viewport.y + viewport.height - this._hScrollBar.height
            );
            this._hScrollBar.width =
                viewport.width - (verticalOverflow ? this._vScrollBar!.width : 0);
            this._hScrollBar.scrollSize = Math.max(viewport.width * 0.033, 1);
            this._hScrollBar.thumbPercent = contentWidth > 0 ? visibleWidth / contentWidth : 1;
            this._hScrollBar.setScroll(0, Math.max(0, contentWidth - visibleWidth));
        }
        this._applyScrollPosition();
    }

    private _applyScrollPosition(): void {
        if (!this._content.scrollRect) {
            return;
        }
        const scrollRect = this._content.scrollRect;
        scrollRect.x = Math.round(this._hScrollBar?.value ?? 0);
        scrollRect.y = Math.round(this._vScrollBar?.value ?? 0);
        this._content.scrollRect = scrollRect;
        this.onScrollPositionChanged();
    }

    private _onScrollBarChange(_scrollBar: Laya.ScrollBar): void {
        this._applyScrollPosition();
    }

    private _measureContentAxis(axis: "horizontal" | "vertical"): number {
        let max = 0;
        for (const child of this.children) {
            if (!(child instanceof Laya.Sprite)) {
                continue;
            }
            const position = axis === "horizontal" ? child.x : child.y;
            const size = axis === "horizontal" ? child.width : child.height;
            const scale = axis === "horizontal" ? child.scaleX : child.scaleY;
            const pivot = axis === "horizontal" ? child.pivotX : child.pivotY;
            const start = position - pivot * scale;
            const end = start + size * scale;
            const edge = Math.max(start, end);
            if (!Number.isFinite(edge)) {
                throw new LayoutError(`UIPanel child has a non-finite ${axis} bound`);
            }
            max = Math.max(max, edge);
        }
        return max;
    }

    private _setScrollChanged(): void {
        if (!this._scrollChanged && !this.destroyed) {
            this._scrollChanged = true;
            this.callLater(this._refreshScroll);
        }
    }

    private _onPanelResize(): void {
        if (this.clipsViewport) {
            const clipRect = this.scrollRect ?? new Laya.Rectangle();
            clipRect.setTo(0, 0, this.width, this.height);
            this.scrollRect = clipRect;
        } else {
            this.scrollRect = null as unknown as Laya.Rectangle;
        }
        this._syncContentViewport();
        this._setScrollChanged();
    }

    private _bindScrollCacheEvents(scrollBar: Laya.ScrollBar | null): void {
        if (!scrollBar) {
            return;
        }
        scrollBar.off(Laya.Event.START, this, this._onScrollStart);
        if (super.cacheAs !== "none") {
            scrollBar.on(Laya.Event.START, this, this._onScrollStart);
        }
    }

    private _onScrollStart(): void {
        this._usedCache ??= super.cacheAs;
        super.cacheAs = "none";
        this._hScrollBar?.once(Laya.Event.END, this, this._onScrollEnd);
        this._vScrollBar?.once(Laya.Event.END, this, this._onScrollEnd);
    }

    private _onScrollEnd(): void {
        if (this._usedCache !== null) {
            super.cacheAs = this._usedCache;
        }
    }

    private _redrawPanel(): void {
        if (this.destroyed) {
            return;
        }
        const graphics = this.graphics;
        graphics.clear();
        if (this.backgroundColor !== null || this.borderColor !== null) {
            graphics.drawRect(
                0,
                0,
                this.width,
                this.height,
                this.backgroundColor,
                this.borderColor,
                this.borderWidth
            );
        }
    }

    private _isScrollType(value: Laya.ScrollType): boolean {
        return (
            value === Laya.ScrollType.None ||
            value === Laya.ScrollType.Horizontal ||
            value === Laya.ScrollType.Vertical ||
            value === Laya.ScrollType.Both
        );
    }
}

class UIPanelContent extends Laya.Sprite {
    constructor(private readonly _owner: UIPanel) {
        super();
    }

    protected override _childChanged(child?: Laya.Sprite): void {
        super._childChanged(child);
        this._owner._panelChildChanged(child);
    }
}
