import { registerClassAlias } from "./class-alias";
import { LayoutError, type LayoutNodeResult } from "./layout";
import { drawMSDFText, measureMSDFText } from "./msdf-text";
import {
    layoutText,
    type TextGlyph,
    type TextLayout,
    type TextMeasure,
    type TextRun,
} from "./text-layout";
import { UIWidget } from "./ui-widget";

type InlineImage = { texture: Laya.Texture | null; error: Error | null };
type LinkArea = { href: string; rect: Laya.Rectangle };

/** 文本原子控件；普通、BitmapFont 与 MSDF 字体均在自身绘制。 */
@registerClassAlias("UILabel")
@Laya.regClass()
@Laya.classInfo({
    menu: "自定义UI",
    icon: "plugins/type-icons/node/Label.svg",
    properties: [
        { name: "style", inspector: "TextStyle", serializable: false },
        { name: "syntax", inspector: "TextSyntax", serializable: false },
        { name: "align2", caption: "Align", inspector: "TextAlign", serializable: false },
    ],
})
export class UILabel extends UIWidget {
    private readonly _style = Object.assign(new Laya.TextStyle(), { fontSize: 20, leading: 0 });
    private _text = "";
    private _font = "";
    private _realFont = Laya.Config.defaultFont;
    private _fontReady = true;
    private _fontError: Error | null = null;
    private _fontRequest: object | null = null;
    private _bitmapFont: Laya.BitmapFont | null = null;
    private _msdfFont: Laya.MSDFFont | null = null;
    private _fitContent = "no";
    private _html = false;
    private _ubb = false;
    private _templateVars: Record<string, unknown> | null = null;
    private _wordWrap = false;
    private _overflow = "visible";
    private _padding = [0, 0, 0, 0];
    private _bgColor: string | null = null;
    private _borderColor: string | null = null;
    private _singleCharRender = false;
    private _runs: TextRun[] | null = null;
    private _cache: TextLayout | null = null;
    private _cacheKey = "";
    private readonly _images = new Map<string, InlineImage>();
    private _links: LinkArea[] = [];
    private _scrollX = 0;
    private _scrollY = 0;
    private _ready = false;
    private _refreshing = false;
    private _lastWidth = 0;
    private _lastHeight = 0;

    constructor() {
        super();
        this._ready = true;
        this.on(Laya.Event.CLICK, this, this._clickLink);
    }

    @Laya.property({ type: String, default: "", multiline: true, submitOnTyping: true })
    get text(): string {
        return this._text;
    }
    set text(value: string) {
        this._text = value;
        this._invalidate();
    }

    @Laya.property({ type: String, default: "", isAsset: true, inspector: "xq.Font" })
    get font(): string {
        return this._font;
    }
    set font(value: string) {
        if (typeof value !== "string") {
            throw new TypeError("UILabel font must be a string");
        }
        if (value === this._font && !this._fontError) {
            return;
        }
        const request = (this._fontRequest = {});
        this._font = value;
        this._releaseFont();
        this._fontError = null;
        this._fontReady = false;
        this.graphics.clear();
        this._links = [];
        this._invalidate();
        const registered = (
            Laya.Text as unknown as { _bitmapFonts: Record<string, Laya.BitmapFont> }
        )._bitmapFonts[value];
        if (registered) {
            this._applyFont(registered);
        } else if (!value || (!value.startsWith("res://") && !Laya.Utils.getFileExtension(value))) {
            this._realFont = value || Laya.Config.defaultFont;
            this._fontReady = true;
            this._invalidate();
        } else {
            const cached: unknown = Laya.loader.getRes(value);
            if (cached) {
                try {
                    this._applyFont(cached);
                } catch (error: unknown) {
                    this._reportFontError(value, error);
                    throw this._fontError;
                }
            } else {
                void Laya.loader.load(value).then(
                    (resource: unknown) => {
                        if (this.destroyed || this._fontRequest !== request) {
                            return;
                        }
                        try {
                            this._applyFont(resource);
                        } catch (error: unknown) {
                            this._reportFontError(value, error);
                        }
                    },
                    (error: unknown) => {
                        if (!this.destroyed && this._fontRequest === request) {
                            this._reportFontError(value, error);
                        }
                    }
                );
            }
        }
    }

    @Laya.property({ type: Number, default: 20, min: 1, step: 1, fractionDigits: 0 })
    get fontSize(): number {
        return this._style.fontSize;
    }

    set fontSize(value: number) {
        this._style.fontSize = this._positive("fontSize", value);
        this._invalidate();
    }

    @Laya.property({ type: String, default: "#000000", inspector: "color" })
    get color(): string {
        return this._style.color;
    }

    set color(value: string) {
        this._style.color = value;
        this._invalidate();
    }

    @Laya.property({ type: Boolean, default: false, inspector: null })
    get bold(): boolean {
        return this._style.bold;
    }

    set bold(value: boolean) {
        this._style.bold = value;
        this._invalidate();
    }

    @Laya.property({ type: Boolean, default: false, inspector: null })
    get italic(): boolean {
        return this._style.italic;
    }

    set italic(value: boolean) {
        this._style.italic = value;
        this._invalidate();
    }

    @Laya.property({ type: Boolean, default: false, inspector: null })
    get underline(): boolean {
        return this._style.underline;
    }

    set underline(value: boolean) {
        this._style.underline = value;
        this._invalidate();
    }

    @Laya.property({ type: Boolean, default: false, inspector: null })
    get strikethrough(): boolean {
        return this._style.strikethrough;
    }

    set strikethrough(value: boolean) {
        this._style.strikethrough = value;
        this._invalidate();
    }

    @Laya.property({ type: String, default: "left", inspector: null })
    get align(): string {
        return this._style.align;
    }

    set align(value: string) {
        this._style.align = this._enum("align", value, ["left", "center", "right"]);
        this._invalidate();
    }

    @Laya.property({ type: String, default: "top", inspector: null })
    get valign(): string {
        return this._style.valign;
    }

    set valign(value: string) {
        this._style.valign = this._enum("valign", value, ["top", "middle", "bottom"]);
        this._invalidate();
    }

    @Laya.property({
        type: String,
        default: "middle",
        enumSource: [
            { name: "顶部对齐", value: "top" },
            { name: "垂直居中", value: "middle" },
            { name: "底部对齐", value: "bottom" },
        ],
    })
    get alignItems(): string {
        return this._style.alignItems;
    }

    set alignItems(value: string) {
        this._style.alignItems = this._enum("alignItems", value, ["top", "middle", "bottom"]);
        this._invalidate();
    }

    @Laya.property({ type: Number, default: 0, step: 1, fractionDigits: 0 })
    get leading(): number {
        return this._style.leading;
    }

    set leading(value: number) {
        this._style.leading = this._finite("leading", value);
        this._invalidate();
    }

    @Laya.property({ type: Number, default: 0, step: 1, fractionDigits: 0 })
    get letterSpacing(): number {
        return this._style.letterSpacing;
    }

    set letterSpacing(value: number) {
        this._style.letterSpacing = this._finite("letterSpacing", value);
        this._invalidate();
    }

    @Laya.property({ type: Number, default: 0, min: 0, range: [0, 100], fractionDigits: 0 })
    get stroke(): number {
        return this._style.stroke;
    }

    set stroke(value: number) {
        this._style.stroke = this._nonnegative("stroke", value);
        this._invalidate();
    }

    @Laya.property({ type: String, default: "#000000", inspector: "color" })
    get strokeColor(): string {
        return this._style.strokeColor;
    }

    set strokeColor(value: string) {
        this._style.strokeColor = value;
        this._invalidate();
    }

    @Laya.property({ type: String, inspector: "color", default: null })
    get underlineColor(): string | null {
        return this._style.underlineColor ?? null;
    }
    set underlineColor(value: string | null) {
        this._style.underlineColor = value as string;
        this._invalidate();
    }

    @Laya.property({ type: Boolean, default: false })
    get singleCharRender(): boolean {
        return this._singleCharRender;
    }
    set singleCharRender(value: boolean) {
        this._singleCharRender = value;
        this._invalidate();
    }

    @Laya.property({
        type: String,
        default: "no",
        enumSource: [
            { name: "关闭", value: "no" },
            { name: "宽高", value: "yes" },
            { name: "仅高度", value: "height" },
        ],
    })
    get fitContent(): string {
        return this._fitContent;
    }
    set fitContent(value: string) {
        this._fitContent = this._enum("fitContent", value, ["no", "yes", "height"]);
        this._invalidate();
    }

    @Laya.property({ type: Boolean, default: false, inspector: null })
    get html(): boolean {
        return this._html;
    }
    set html(value: boolean) {
        this._html = value;
        this._invalidate();
    }

    @Laya.property({ type: Boolean, default: false, inspector: null })
    get ubb(): boolean {
        return this._ubb;
    }
    set ubb(value: boolean) {
        this._ubb = value;
        this._invalidate();
    }

    @Laya.property({ type: Boolean, default: false, inspector: null })
    get templateVars(): Record<string, unknown> | null {
        return this._templateVars;
    }
    set templateVars(value: Record<string, unknown> | boolean | null) {
        this._templateVars =
            value === true ? {} : value === false || value === null ? null : { ...value };
        this._invalidate();
    }

    setVar(name: string, value: unknown): this {
        if (!this._templateVars) {
            this._templateVars = {};
        }
        this._templateVars[name] = value;
        this._invalidate();
        return this;
    }

    @Laya.property({ type: Boolean, default: false })
    get wordWrap(): boolean {
        return this._wordWrap;
    }
    set wordWrap(value: boolean) {
        this._wordWrap = value;
        this._invalidate();
    }

    @Laya.property({
        type: String,
        default: "visible",
        enumSource: [
            { name: "显示溢出", value: "visible" },
            { name: "裁剪", value: "hidden" },
            { name: "滚动", value: "scroll" },
            { name: "缩小字体", value: "shrink" },
            { name: "省略号", value: "ellipsis" },
        ],
    })
    get overflow(): string {
        return this._overflow;
    }
    set overflow(value: string) {
        this._overflow = this._enum("overflow", value, [
            "visible",
            "hidden",
            "scroll",
            "shrink",
            "ellipsis",
        ]);
        this._invalidate();
    }

    @Laya.property({
        type: String,
        default: "0,0,0,0",
        inspector: "vec4",
        options: { titles: ["U", "R", "D", "L"] },
        min: 0,
        step: 1,
        fractionDigits: 0,
    })
    get padding(): string {
        return this._padding.join(",");
    }
    set padding(value: string) {
        const parts = value.split(",");
        const padding = parts.map(Number);
        if (
            parts.length !== 4 ||
            parts.some((part) => !part.trim()) ||
            padding.some((part) => !Number.isInteger(part) || part < 0)
        ) {
            throw new LayoutError(
                "UILabel padding requires four non-negative integers: top,right,bottom,left"
            );
        }
        this._padding = padding;
        this._invalidate();
    }

    @Laya.property({ type: String, inspector: "color", nullable: true, default: null })
    get bgColor(): string | null {
        return this._bgColor;
    }
    set bgColor(value: string | null) {
        this._bgColor = value;
        this._invalidate();
    }

    @Laya.property({ type: String, inspector: "color", nullable: true, default: null })
    get borderColor(): string | null {
        return this._borderColor;
    }
    set borderColor(value: string | null) {
        this._borderColor = value;
        this._invalidate();
    }

    override get width(): number {
        return this._fitContent === "yes" && this.widthSource !== "stretch"
            ? this.measureWidth()
            : super.width;
    }
    override set width(value: number) {
        super.width = value;
        this._invalidate(false);
    }
    override get height(): number {
        return this._fitContent !== "no" && this.heightSource !== "stretch"
            ? this.measureHeight()
            : super.height;
    }
    override set height(value: number) {
        super.height = value;
        this._invalidate(false);
    }

    protected override get isWidthExplicit(): boolean {
        return this._fitContent !== "yes" && super.isWidthExplicit;
    }
    protected override get isHeightExplicit(): boolean {
        return this._fitContent === "no" && super.isHeightExplicit;
    }

    get textWidth(): number {
        return this._getTextLayout().width + this._padding[1] + this._padding[3];
    }
    get textHeight(): number {
        return this._getTextLayout().height + this._padding[0] + this._padding[2];
    }
    get maxScrollX(): number {
        return Math.max(0, this.textWidth - this.width);
    }
    get maxScrollY(): number {
        return Math.max(0, this.textHeight - this.height);
    }
    get scrollX(): number {
        return this._scrollX;
    }
    set scrollX(value: number) {
        if (value < 0 || value > this.maxScrollX || !Number.isFinite(value)) {
            throw new LayoutError("UILabel scrollX is outside the content range");
        }
        this._scrollX = value;
        this.callLater(this.typeset);
    }
    get scrollY(): number {
        return this._scrollY;
    }
    set scrollY(value: number) {
        if (value < 0 || value > this.maxScrollY || !Number.isFinite(value)) {
            throw new LayoutError("UILabel scrollY is outside the content range");
        }
        this._scrollY = value;
        this.callLater(this.typeset);
    }

    /** 强制完成本轮排版和绘制；常规属性写入合并到下一帧。 */
    typeset(): void {
        if (
            !this._ready ||
            this._refreshing ||
            this.destroyed ||
            Laya.SerializeUtil?.isDeserializing
        ) {
            return;
        }
        Laya.timer.clearCallLater(this, this.typeset);
        this._refreshing = true;
        try {
            this.graphics.clear();
            this._links = [];
            const result = this._getTextLayout();
            const width = this._axisSize(true) ?? this.textWidth;
            const height = this._axisSize(false) ?? this.textHeight;
            this._draw(result, width, height);
            if (width !== this._lastWidth || height !== this._lastHeight) {
                this._lastWidth = width;
                this._lastHeight = height;
                this.event(Laya.Event.RESIZE);
            }
            this.requestLayout();
        } finally {
            this._refreshing = false;
        }
    }

    protected override measureWidth(): number {
        return this._ready ? this.textWidth : 0;
    }
    protected override measureHeight(): number {
        return this._ready ? this.textHeight : 0;
    }
    protected override onLayoutApplied(result: LayoutNodeResult): void {
        this.typeset();
        super.onLayoutApplied(result);
    }
    protected override _transChanged(kind: Laya.TransformKind): void {
        super._transChanged(kind);
        if (
            kind &
            (Laya.TransformKind.Width | Laya.TransformKind.Height | Laya.TransformKind.Scale)
        ) {
            this._invalidate(false);
        }
    }
    override onDestroy(): void {
        Laya.timer.clearCallLater(this, this.typeset);
        this._releaseFont();
        for (const image of this._images.values()) {
            image.texture?._removeReference();
        }
        this._images.clear();
        this._runs = null;
        this._cache = null;
        this._links = [];
        super.onDestroy();
    }

    /** 派生控件的真实值与显示文本可以分离。 */
    protected get displayText(): string {
        return this._text;
    }
    protected get displayColor(): string {
        return this.color;
    }
    protected get textRenderingEnabled(): boolean {
        return true;
    }
    protected get fontReady(): boolean {
        return this._fontReady && !this._fontError;
    }
    protected get resolvedFontFamily(): string {
        if (!this._fontReady || this._fontError) {
            throw new LayoutError("UILabel font is not ready");
        }
        if (this._bitmapFont || this._msdfFont) {
            throw new LayoutError("Atlas fonts require an explicit editingFont");
        }
        return this._realFont;
    }

    protected _invalidate(parse = true): void {
        if (!this._ready || this.destroyed) {
            return;
        }
        if (parse) {
            this._runs = null;
        }
        this._cache = null;
        this.callLater(this.typeset);
    }

    private _axisSize(horizontal: boolean): number | null {
        const leading = horizontal ? this.left : this.top;
        const trailing = horizontal ? this.right : this.bottom;
        if (leading !== null && trailing !== null && this.parent) {
            const rect = this.getLayoutParentRect()!;
            const parentSize = horizontal ? rect.width : rect.height;
            const size =
                (parentSize -
                    this.resolveRelativeLayoutValue(leading, parentSize)! -
                    this.resolveRelativeLayoutValue(trailing, parentSize)!) /
                ((horizontal ? this.scaleX : this.scaleY) || 0.01);
            if (!Number.isFinite(size) || size < 0) {
                throw new LayoutError("UILabel relative constraints leave an invalid content size");
            }
            return size;
        }
        return horizontal
            ? this.isWidthExplicit
                ? super.width
                : null
            : this.isHeightExplicit
              ? super.height
              : null;
    }

    private _getTextLayout(): TextLayout {
        if (this._fontError) {
            throw this._fontError;
        }
        const boxWidth = this._axisSize(true),
            boxHeight = this._axisSize(false);
        const width =
            boxWidth === null ? null : Math.max(0, boxWidth - this._padding[1] - this._padding[3]);
        const height =
            boxHeight === null
                ? null
                : Math.max(0, boxHeight - this._padding[0] - this._padding[2]);
        const key = String(width) + ":" + String(height);
        if (this._cache && this._cacheKey === key) {
            return this._cache;
        }
        if (!this._fontReady) {
            return { lines: [], width: 0, height: 0, scale: 1 };
        }
        if (!this._runs) {
            this._runs = this._parseRuns();
        }
        for (const image of this._images.values()) {
            if (image.error) {
                throw image.error;
            }
        }
        if ([...this._images.values()].some((image) => !image.texture)) {
            return { lines: [], width: 0, height: 0, scale: 1 };
        }
        this._cache = layoutText(this._runs, {
            width,
            height,
            wordWrap: this._wordWrap,
            leading: this.leading,
            letterSpacing: this.letterSpacing,
            singleCharRender: this._singleCharRender,
            overflow: this._overflow,
            style: this._style,
            measure: (text, style, scale) => this._measure(text, style, scale),
        });
        this._cacheKey = key;
        return this._cache;
    }

    private _measure(text: string, style: Laya.TextStyle, scale: number): ReturnType<TextMeasure> {
        const size = style.fontSize * scale;
        if (this._msdfFont) {
            return measureMSDFText(this._msdfFont, text, size, this.letterSpacing * scale);
        }
        if (this._bitmapFont) {
            for (const char of Array.from(text)) {
                if (!this._bitmapFont.dict[char.codePointAt(0)!]) {
                    throw new LayoutError(
                        "UILabel bitmap font has no glyph for " + JSON.stringify(char)
                    );
                }
            }
            const factor = this._bitmapFont.autoScaleSize
                ? size / this._bitmapFont.fontSize
                : scale;
            return {
                width: Array.from(text).reduce(
                    (sum, char) =>
                        sum +
                        this._nonnegative(
                            "bitmap glyph advance",
                            this._bitmapFont!.dict[char.codePointAt(0)!].advance!
                        ) *
                            factor,
                    0
                ),
                height: this._bitmapFont.lineHeight * factor,
            };
        }
        const context = Laya.Browser.context;
        context.font =
            (style.italic ? "italic " : "") +
            (style.bold ? "bold " : "") +
            size +
            "px " +
            this._realFont;
        const width =
            this.letterSpacing !== 0 || this._singleCharRender
                ? Array.from(text).reduce((sum, char) => sum + context.measureText(char).width, 0)
                : context.measureText(text).width;
        const height =
            Laya.Render2DProcessor.runner._textRender.getFontHeight(
                this._realFont,
                style.fontSize,
                style.bold
            ) * scale;
        if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) {
            throw new LayoutError("UILabel font measurement returned invalid metrics");
        }
        return { width, height };
    }

    private _parseRuns(): TextRun[] {
        let source = this.displayText.replace(/\r\n?/g, "\n");
        if (this._templateVars) {
            source = Laya.Utils.parseTemplate(source, this._templateVars);
        }
        if (this._ubb) {
            source = Laya.UBBParser.defaultParser.parse(source);
        }
        const elements: Laya.HtmlElement[] = [],
            runs: TextRun[] = [];
        const images = new Set<string>();
        try {
            if (!this._html && !this._ubb) {
                runs.push({
                    text: source,
                    style: Object.assign(new Laya.TextStyle(), this._style, {
                        color: this.displayColor,
                    }),
                });
            } else {
                Laya.HtmlParser.defaultParser.parse(source, this._style, elements);
                let link: string | undefined;
                for (const element of elements) {
                    const style = Object.assign(new Laya.TextStyle(), element.style);
                    if (element.type === Laya.HtmlElementType.Text) {
                        this._positive("HTML fontSize", style.fontSize);
                        this._nonnegative("HTML stroke", style.stroke);
                        runs.push({ text: element.text, style, link });
                    } else if (element.type === Laya.HtmlElementType.Link) {
                        link = element.getAttrString("href");
                        this.mouseEnabled = true;
                    } else if (element.type === Laya.HtmlElementType.LinkEnd) {
                        link = undefined;
                    } else if (element.type === Laya.HtmlElementType.Image) {
                        const url = element.getAttrString("src");
                        if (!url) {
                            throw new LayoutError("UILabel inline image requires src");
                        }
                        images.add(url);
                        const image = this._getImage(url);
                        if (image.error) {
                            throw image.error;
                        }
                        if (image.texture) {
                            const widthAttr: unknown = element.getAttr("width");
                            const heightAttr: unknown = element.getAttr("height");
                            const width =
                                widthAttr === null || widthAttr === undefined
                                    ? image.texture.sourceWidth
                                    : Number(widthAttr);
                            const height =
                                heightAttr === null || heightAttr === undefined
                                    ? image.texture.sourceHeight
                                    : Number(heightAttr);
                            runs.push({
                                texture: image.texture,
                                width: this._nonnegative("image width", width),
                                height: this._nonnegative("image height", height),
                                style,
                                link,
                            });
                        }
                    } else {
                        throw new LayoutError("UILabel does not support HTML form/object elements");
                    }
                }
            }
        } finally {
            Laya.HtmlElement.returnToPool(elements);
            for (const [url, image] of this._images) {
                if (!images.has(url)) {
                    image.texture?._removeReference();
                    this._images.delete(url);
                }
            }
        }
        return runs;
    }

    private _getImage(url: string): InlineImage {
        const existing = this._images.get(url);
        if (existing) {
            return existing;
        }
        const image: InlineImage = { texture: null, error: null };
        this._images.set(url, image);
        const apply = (resource: unknown) => {
            if (!(resource instanceof Laya.Texture)) {
                throw new TypeError("UILabel image loader did not return a Texture: " + url);
            }
            resource._addReference();
            image.texture = resource;
        };
        const cached: unknown = Laya.loader.getRes(url, Laya.Loader.IMAGE);
        if (cached) {
            try {
                apply(cached);
            } catch (reason: unknown) {
                image.error = new Error(
                    "UILabel invalid inline image " + url + ": " + String(reason)
                );
                throw image.error;
            }
        } else {
            const fail = (reason: unknown) => {
                image.error = new Error(
                    "UILabel failed to load inline image " + url + ": " + String(reason)
                );
                this.graphics.clear();
                console.error(image.error);
                this.event(Laya.Event.ERROR, image.error);
            };
            void Laya.loader.load(url, Laya.Loader.IMAGE).then(
                (resource: unknown) => {
                    if (this.destroyed || this._images.get(url) !== image) {
                        return;
                    }
                    try {
                        apply(resource);
                        this._invalidate();
                    } catch (reason: unknown) {
                        fail(reason);
                    }
                },
                (reason: unknown) => {
                    if (!this.destroyed && this._images.get(url) === image) {
                        fail(reason);
                    }
                }
            );
        }
        return image;
    }

    private _applyFont(resource: unknown): void {
        if (resource instanceof Laya.MSDFFont) {
            if (resource.destroyed) {
                throw new TypeError("UILabel MSDF font is destroyed");
            }
            resource._addReference();
            this._msdfFont = resource;
        } else if (resource instanceof Laya.BitmapFont) {
            this._positive("bitmap fontSize", resource.fontSize);
            this._positive("bitmap lineHeight", resource.lineHeight);
            resource._addReference();
            this._bitmapFont = resource;
        } else if (
            resource &&
            typeof (resource as { family?: unknown }).family === "string" &&
            (resource as { family: string }).family.trim()
        ) {
            this._realFont = (resource as { family: string }).family;
        } else {
            throw new TypeError(
                "UILabel font loader requires a font family, BitmapFont or MSDFFont"
            );
        }
        this._fontReady = true;
        this._invalidate();
        this.event(Laya.Event.LOADED);
    }

    private _releaseFont(): void {
        this._bitmapFont?._removeReference();
        this._bitmapFont = null;
        this._msdfFont?._removeReference();
        this._msdfFont = null;
    }

    private _reportFontError(url: string, reason: unknown): void {
        this._fontError = new Error("UILabel failed to load font " + url + ": " + String(reason));
        this.graphics.clear();
        console.error(this._fontError);
        this.event(Laya.Event.ERROR, this._fontError);
    }

    private _draw(result: TextLayout, width: number, height: number): void {
        const graphics = this.graphics;
        this._links = [];
        if (!this.textRenderingEnabled) {
            return;
        }
        this.scrollRect =
            this._overflow !== "visible"
                ? new Laya.Rectangle(0, 0, width, height)
                : (null as unknown as Laya.Rectangle);
        if (this._bgColor || this._borderColor) {
            graphics.drawRect(0, 0, width, height, this._bgColor, this._borderColor, 1);
        }
        const contentWidth = Math.max(0, width - this._padding[1] - this._padding[3]);
        const contentHeight = Math.max(0, height - this._padding[0] - this._padding[2]);
        const scrollX =
            this._overflow === "scroll"
                ? Math.min(this._scrollX, Math.max(0, result.width - contentWidth))
                : 0;
        const scrollY =
            this._overflow === "scroll"
                ? Math.min(this._scrollY, Math.max(0, result.height - contentHeight))
                : 0;
        const offsetY =
            this._padding[0] +
            this._alignOffset(this.valign, contentHeight - result.height) -
            scrollY;
        for (const line of result.lines) {
            const lineX =
                this._padding[3] +
                this._alignOffset(this.align, contentWidth - line.width) -
                scrollX -
                line.offsetX;
            for (const piece of line.pieces) {
                const run = piece.run;
                const x = lineX + piece.x;
                const left = x + piece.offsetX;
                const y =
                    offsetY +
                    line.y +
                    this._alignOffset(this.alignItems, line.height - piece.height);
                if ("text" in run) {
                    this._drawText(
                        run.text,
                        run.style,
                        x,
                        y,
                        piece.width,
                        result.scale,
                        piece.glyphs
                    );
                } else {
                    graphics.drawImage(run.texture, x, y, piece.width, piece.height);
                }
                const thickness = Math.max(1, (run.style.fontSize * result.scale) / 16);
                if (run.style.underline) {
                    graphics.drawLine(
                        left,
                        y + piece.height - thickness,
                        left + piece.width,
                        y + piece.height - thickness,
                        run.style.underlineColor || run.style.color,
                        thickness
                    );
                }
                if (run.style.strikethrough) {
                    graphics.drawLine(
                        left,
                        y + piece.height / 2,
                        left + piece.width,
                        y + piece.height / 2,
                        run.style.strikethroughColor || run.style.color,
                        thickness
                    );
                }
                if (run.link) {
                    this._links.push({
                        href: run.link,
                        rect: new Laya.Rectangle(left, y, piece.width, piece.height),
                    });
                }
            }
        }
    }

    private _drawText(
        text: string,
        style: Laya.TextStyle,
        x: number,
        y: number,
        width: number,
        scale: number,
        glyphs: TextGlyph[] | null
    ): void {
        if (this._msdfFont) {
            if (!glyphs) {
                throw new LayoutError("UILabel MSDF drawing requires measured glyph positions");
            }
            drawMSDFText(
                this.graphics,
                this._msdfFont,
                glyphs,
                style,
                x,
                y,
                style.fontSize * scale,
                style.stroke * scale
            );
        } else if (this._bitmapFont) {
            const font = this._bitmapFont;
            const factor = font.autoScaleSize ? (style.fontSize * scale) / font.fontSize : scale;
            for (const [index, char] of Array.from(text).entries()) {
                const glyph = font.dict[char.codePointAt(0)!];
                const glyphX = glyphs ? x + glyphs[index].x : x;
                if (glyph.texture) {
                    this.graphics.drawImage(
                        glyph.texture,
                        glyphX + glyph.x! * factor,
                        y + glyph.y! * factor,
                        glyph.width! * factor,
                        glyph.height! * factor,
                        font.tint ? style.color : "#ffffff"
                    );
                }
                if (!glyphs) {
                    x += glyph.advance! * factor;
                }
            }
        } else {
            // 字符模式直接消费排版位置，负字距可以向左推进；无字距保留整段 shaping。
            if (glyphs) {
                for (const glyph of glyphs) {
                    this._addTextCommand(glyph.text, style, x + glyph.x, y, glyph.width, scale);
                }
                return;
            }
            this._addTextCommand(text, style, x, y, width, scale);
        }
    }

    private _addTextCommand(
        text: string,
        style: Laya.TextStyle,
        x: number,
        y: number,
        width: number,
        scale: number
    ): void {
        const cmd = Laya.FillTextCmd.create(
            text,
            x,
            y,
            null as unknown as string,
            style.color,
            "left",
            style.stroke * scale,
            style.strokeColor
        );
        cmd.fontFamily = this._realFont;
        cmd.fontSize = style.fontSize * scale;
        cmd.bold = style.bold;
        cmd.italic = style.italic;
        cmd.letterSpacing = 0;
        cmd.singleCharRender = this._singleCharRender;
        cmd._preMeasuredWidth = width;
        this.graphics.addCmd(cmd);
    }

    private _clickLink(): void {
        const x = this.mouseX,
            y = this.mouseY;
        if (this.scrollRect && !this.scrollRect.contains(x, y)) {
            return;
        }
        const hit = this._links.find((link) => link.rect.contains(x, y));
        if (hit) {
            this.event(Laya.Event.LINK, hit.href);
        }
    }

    private _alignOffset(align: string, remaining: number): number {
        return align === "center" || align === "middle"
            ? remaining / 2
            : align === "right" || align === "bottom"
              ? remaining
              : 0;
    }
    private _finite(name: string, value: number): number {
        if (!Number.isFinite(value)) {
            throw new LayoutError("UILabel " + name + " must be finite");
        }
        return value;
    }
    private _nonnegative(name: string, value: number): number {
        if (this._finite(name, value) < 0) {
            throw new LayoutError("UILabel " + name + " must be non-negative");
        }
        return value;
    }
    private _positive(name: string, value: number): number {
        if (this._finite(name, value) <= 0) {
            throw new LayoutError("UILabel " + name + " must be positive");
        }
        return value;
    }
    private _enum(name: string, value: string, values: string[]): string {
        if (!values.includes(value)) {
            throw new LayoutError("UILabel invalid " + name + ": " + value);
        }
        return value;
    }
}
