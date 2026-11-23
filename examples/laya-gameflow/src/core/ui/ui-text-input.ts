import { registerClassAlias } from "./class-alias";
import { LayoutError, type LayoutNodeResult } from "./layout";
import { UILabel } from "./ui-label";

type InputType = "text" | "password" | "number" | "email" | "url";
type ConfirmType = "done" | "next" | "search" | "go" | "send";
const INPUT_TYPES: InputType[] = ["text", "password", "number", "email", "url"];
const CONFIRM_TYPES: ConfirmType[] = ["done", "next", "search", "go", "send"];

/** 游戏文字由 UILabel 绘制，实际编辑交给平台；装饰由预制体表达。 */
@registerClassAlias("UITextInput")
@Laya.regClass()
@Laya.classInfo({
    menu: "自定义UI",
    icon: "plugins/type-icons/node/TextInput.svg",
    properties: [
        "html",
        "ubb",
        "templateVars",
        "fitContent",
        "overflow",
        "bgColor",
        "borderColor",
        "syntax",
        "wordWrap",
    ].map((name) => ({ name, hidden: true, serializable: false })),
})
export class UITextInput extends UILabel {
    private _inputText = "";
    private _programRevision = 0;
    private _prompt = "";
    private _promptColor = "#a9a9a9";
    private _editable = true;
    private _multiline = false;
    private _maxChars = 0;
    private _type: InputType = "text";
    private _confirmType: ConfirmType = "done";
    private _editingFont = "";
    private _inlineEditing = false;
    private _editing = false;
    private _initialText = "";
    private _disposing = false;
    private _scrollPending = false;
    private _bridge: BridgeInput | null = null;

    constructor() {
        super();
        super.overflow = "scroll";
        this.valign = "middle";
        this.size(100, 30);
        this.mouseEnabled = true;
        const bridge = (this._bridge = new BridgeInput({
            read: () => this.text,
            revision: () => this._programRevision,
            write: (value) => {
                if (this._disposing) {
                    return;
                }
                this._validateText(value);
                this._inputText = value;
                this._invalidate();
                this._scrollToEnd();
            },
            prepare: () => this._prepareInput(),
            hide: (value) => {
                this._inlineEditing = value;
                this._invalidate();
            },
        }));
        bridge.hideFlags = Laya.HideFlags.HideAndDontSave;
        this.addChild(bridge);
        bridge.on(Laya.Event.FOCUS, this, this._onFocus);
        bridge.on(Laya.Event.BLUR, this, this._onBlur);
        bridge.on(Laya.Event.INPUT, this, () => {
            if (!this._disposing) {
                this.event(Laya.Event.INPUT);
            }
        });
        bridge.on(Laya.Event.ENTER, this, () => {
            if (!this._disposing) {
                this.event(Laya.Event.ENTER);
            }
        });
        bridge.on(Laya.Event.ERROR, this, (error: unknown) => {
            if (!this._disposing) {
                this.event(Laya.Event.ERROR, error);
            }
        });
        this._syncSize();
    }

    @Laya.property({
        type: String,
        default: "",
        multiline: true,
        submitOnTyping: true,
        caption: "文本",
        catalog: "输入",
    })
    override get text(): string {
        return this._inputText;
    }
    override set text(value: string) {
        this._assertMutable();
        this._validateText(value);
        if (value === this._inputText) {
            return;
        }
        this._programRevision++;
        this._inputText = value;
        if (this._editing) {
            this._initialText = value;
        }
        if (this.focus) {
            Laya.PAL.textInput.setText(value);
        }
        this._invalidate();
        this._scrollToEnd();
    }

    @Laya.property({ type: String, default: "", caption: "占位文本", catalog: "输入" })
    get prompt(): string {
        return this._prompt;
    }
    set prompt(value: string) {
        this._assertString(value);
        if (value === this._prompt) {
            return;
        }
        this.focus = false;
        this._prompt = value;
        this._invalidate();
    }

    @Laya.property({
        type: String,
        default: "#a9a9a9",
        inspector: "color",
        caption: "占位颜色",
        catalog: "输入",
    })
    get promptColor(): string {
        return this._promptColor;
    }
    set promptColor(value: string) {
        this._assertString(value);
        if (value === this._promptColor) {
            return;
        }
        this.focus = false;
        this._promptColor = value;
        this._invalidate();
    }

    @Laya.property({ type: Boolean, default: true, caption: "允许编辑", catalog: "输入" })
    get editable(): boolean {
        return this._editable;
    }
    set editable(value: boolean) {
        this._assertBoolean(value);
        if (value === this._editable) {
            return;
        }
        if (!value) {
            this.focus = false;
        }
        this._editable = value;
        if (this._bridge) {
            this._bridge.mouseEnabled = value;
        }
    }

    @Laya.property({ type: Boolean, default: false, caption: "多行输入", catalog: "输入" })
    get multiline(): boolean {
        return this._multiline;
    }
    set multiline(value: boolean) {
        this._assertBoolean(value);
        if (value === this._multiline) {
            return;
        }
        if (!value && /[\r\n]/.test(this.text)) {
            throw new LayoutError("Single-line input cannot contain line breaks");
        }
        if (value && this.type === "password") {
            throw new LayoutError("Multiline password input is not supported");
        }
        this.focus = false;
        this._multiline = value;
        super.wordWrap = value;
        this.valign = value ? "top" : "middle";
    }

    @Laya.property({
        type: Number,
        default: 0,
        min: 0,
        fractionDigits: 0,
        caption: "长度上限",
        catalog: "输入",
    })
    get maxChars(): number {
        return this._maxChars;
    }
    set maxChars(value: number) {
        this._assertMutable();
        if (!Number.isSafeInteger(value) || value < 0 || (value > 0 && this.text.length > value)) {
            throw new LayoutError("Invalid maxChars or existing text exceeds it");
        }
        if (value !== this._maxChars) {
            this.focus = false;
        }
        this._maxChars = value;
    }

    @Laya.property({
        type: String,
        default: "text",
        enumSource: INPUT_TYPES.map((value, i) => ({
            name: ["文本", "密码", "数字", "邮箱", "网址"][i],
            value,
        })),
        caption: "输入类型",
        catalog: "输入",
    })
    get type(): InputType {
        return this._type;
    }
    set type(value: InputType) {
        this._assertMutable();
        if (!INPUT_TYPES.includes(value) || (value === "password" && this.multiline)) {
            throw new LayoutError("Invalid input type");
        }
        if (value !== this._type) {
            this.focus = false;
        }
        this._type = value;
        this._invalidate();
    }

    @Laya.property({
        type: String,
        default: "done",
        enumSource: CONFIRM_TYPES.map((value, i) => ({
            name: ["完成", "下一项", "搜索", "前往", "发送"][i],
            value,
        })),
        caption: "确认按钮",
        catalog: "输入",
    })
    get confirmType(): ConfirmType {
        return this._confirmType;
    }
    set confirmType(value: ConfirmType) {
        this._assertMutable();
        if (!CONFIRM_TYPES.includes(value)) {
            throw new LayoutError("Invalid confirmType");
        }
        if (value !== this._confirmType) {
            this.focus = false;
        }
        this._confirmType = value;
    }

    @Laya.property({ type: String, default: "", caption: "Web 编辑字体", catalog: "输入" })
    get editingFont(): string {
        return this._editingFont;
    }
    set editingFont(value: string) {
        this._assertString(value);
        if (value !== this._editingFont) {
            this.focus = false;
        }
        this._editingFont = value;
    }

    get capabilities(): Laya.TextInputCapabilities {
        return Laya.PAL.textInput.capabilities;
    }
    get focus(): boolean {
        return !!this._bridge && Laya.PAL.textInput?.target === this._bridge;
    }
    set focus(value: boolean) {
        this._assertBoolean(value);
        if (!this._bridge || !Laya.LayaEnv.isPlaying) {
            return;
        }
        if (value) {
            this._bridge.focus = true;
        } else {
            Laya.PAL.textInput?.endFor(this._bridge).catch((error) => console.error(error));
        }
    }

    setSelection(start: number, end: number): void {
        this._assertMutable();
        if (!this.focus || !this.capabilities.selection) {
            throw new LayoutError("Selection requires an active editor with selection support");
        }
        if (
            !Number.isSafeInteger(start) ||
            !Number.isSafeInteger(end) ||
            start < 0 ||
            end < start ||
            end > this.text.length ||
            this._splitsSurrogate(start) ||
            this._splitsSurrogate(end)
        ) {
            throw new LayoutError("Invalid text selection");
        }
        Laya.PAL.textInput.setSelectionFor(this._bridge!, start, end);
    }
    select(): void {
        this.setSelection(0, this.text.length);
    }

    protected override get displayText(): string {
        return this._inputText
            ? this._type === "password"
                ? Array.from(this._inputText, () => "●").join("")
                : this._inputText
            : this._prompt || "";
    }
    protected override get displayColor(): string {
        return this._inputText ? this.color : this._promptColor;
    }
    protected override get textRenderingEnabled(): boolean {
        return !this._inlineEditing;
    }

    private _prepareInput(): void {
        this._assertMutable();
        if (!this._editable || !this._interactive()) {
            throw new LayoutError("Input must be editable, active and displayed");
        }
        if (!this.capabilities.inputTypes.includes(this.type)) {
            throw new LayoutError("Unsupported input type: " + this.type);
        }
        this._validateText(this.text);
        const bridge = this._bridge!;
        this._syncSize();
        bridge.multiline = this.multiline;
        bridge.type = this.type;
        bridge.maxChars = this.maxChars;
        bridge.confirmType = this.confirmType;
        bridge.prompt = this.prompt;
        bridge.promptColor = this.promptColor;
        if (this.capabilities.presentation === "inline") {
            for (
                let node: Laya.Sprite | null = this._bridge;
                node;
                node = node.parent as Laya.Sprite | null
            ) {
                if (
                    node.rotation !== 0 ||
                    node.skewX !== 0 ||
                    node.skewY !== 0 ||
                    node.scaleX <= 0 ||
                    node.scaleY <= 0
                ) {
                    throw new LayoutError(
                        "Inline editing requires positive scale without rotation or skew"
                    );
                }
            }
            bridge.font = this.editingFont || this.resolvedFontFamily;
        }
        bridge.fontSize = this.fontSize;
        bridge.color = this.color;
        bridge.bold = this.bold;
        bridge.italic = this.italic;
        bridge.align = this.align;
        bridge.leading = this.leading;
        bridge.letterSpacing = this.letterSpacing;
        bridge.padding = this.padding.slice();
    }
    private _onFocus(): void {
        if (this._disposing) {
            return;
        }
        this._editing = true;
        this._initialText = this.text;
        Laya.timer.frameLoop(1, this, this._watchInput);
        this.event(Laya.Event.FOCUS);
    }
    private _onBlur(): void {
        Laya.timer.clear(this, this._watchInput);
        if (this._disposing || !this._editing) {
            return;
        }
        this._editing = false;
        this._inlineEditing = false;
        this._invalidate();
        if (this.text !== this._initialText) {
            this.event(Laya.Event.CHANGE);
        }
        if (!this.destroyed && !this._disposing) {
            this.event(Laya.Event.BLUR);
        }
    }
    private _interactive(): boolean {
        if (!this.displayedInStage) {
            return false;
        }
        for (
            let node: Laya.Sprite | null = this._bridge;
            node;
            node = node.parent as Laya.Sprite | null
        ) {
            if (!node.active || !node.visible) {
                return false;
            }
        }
        return true;
    }
    private _watchInput(): void {
        if (!this._interactive()) {
            this.focus = false;
        }
    }
    private _syncSize(): void {
        this._bridge?.size(this.width, this.height);
    }
    private _scrollToEnd(): void {
        this._scrollPending = true;
        this.typeset();
    }
    override typeset(): void {
        super.typeset();
        if (!this._scrollPending || !this.fontReady || Laya.SerializeUtil?.isDeserializing) {
            return;
        }
        this._scrollPending = false;
        if (this.multiline) {
            if (this.scrollY !== this.maxScrollY) {
                this.scrollY = this.maxScrollY;
            }
        } else if (this.scrollX !== this.maxScrollX) {
            this.scrollX = this.maxScrollX;
        }
    }
    override onAfterDeserialize(): void {
        super.onAfterDeserialize();
        this._validateText(this.text, true);
        if (this.multiline && this.type === "password") {
            throw new LayoutError("Multiline password input is not supported");
        }
        this._syncSize();
    }
    private _validateText(value: string, final = false): void {
        if (typeof value !== "string") {
            throw new TypeError("UITextInput text must be a string");
        }
        if (!final && Laya.SerializeUtil?.isDeserializing) {
            return;
        }
        if (
            (!this.multiline && /[\r\n]/.test(value)) ||
            (this.maxChars > 0 && value.length > this.maxChars)
        ) {
            throw new LayoutError("Text violates the input contract");
        }
    }
    private _splitsSurrogate(index: number): boolean {
        return (
            index > 0 &&
            index < this.text.length &&
            /[\uD800-\uDBFF]/.test(this.text[index - 1]) &&
            /[\uDC00-\uDFFF]/.test(this.text[index])
        );
    }
    private _assertMutable(): void {
        if (this.destroyed || this._disposing) {
            throw new LayoutError("UITextInput is destroyed");
        }
    }
    private _assertString(value: string): void {
        this._assertMutable();
        if (typeof value !== "string") {
            throw new TypeError("Expected a string");
        }
    }
    private _assertBoolean(value: boolean): void {
        this._assertMutable();
        if (typeof value !== "boolean") {
            throw new TypeError("Expected a boolean");
        }
    }
    protected override onLayoutApplied(result: LayoutNodeResult): void {
        super.onLayoutApplied(result);
        this._syncSize();
    }
    protected override _transChanged(kind: Laya.TransformKind): void {
        super._transChanged(kind);
        if (this._bridge) {
            this._syncSize();
        }
    }
    override onPreDestroy(): void {
        this._disposing = true;
        Laya.timer.clear(this, this._watchInput);
        if (this._bridge) {
            Laya.PAL.textInput?.endFor(this._bridge).catch((error) => console.error(error));
        }
        super.onPreDestroy();
    }
    override get html(): boolean {
        return false;
    }
    override set html(value: boolean) {
        if (value !== false) {
            throw new LayoutError("Input is plain text");
        }
    }
    override get ubb(): boolean {
        return false;
    }
    override set ubb(value: boolean) {
        if (value !== false) {
            throw new LayoutError("Input is plain text");
        }
    }
    override get templateVars(): Record<string, unknown> | null {
        return null;
    }
    override set templateVars(value: Record<string, unknown> | null) {
        if (value !== null) {
            throw new LayoutError("Input does not support templates");
        }
    }
    override setVar(_name: string, _value: unknown): this {
        throw new LayoutError("Input does not support templates");
    }
    override get wordWrap(): boolean {
        return this.multiline;
    }
    override set wordWrap(value: boolean) {
        if (value !== this.multiline) {
            throw new LayoutError("Input wrapping is controlled by multiline");
        }
    }
    override get fitContent(): string {
        return "no";
    }
    override set fitContent(value: string) {
        if (value !== "no") {
            throw new LayoutError("Input has a fixed viewport");
        }
    }
    override get overflow(): string {
        return "scroll";
    }
    override set overflow(value: string) {
        if (value !== "scroll") {
            throw new LayoutError("Input requires scroll overflow");
        }
    }
    override get bgColor(): string | null {
        return null;
    }
    override set bgColor(value: string | null) {
        if (value !== null) {
            throw new LayoutError("Input backgrounds belong in the prefab");
        }
    }
    override get borderColor(): string | null {
        return null;
    }
    override set borderColor(value: string | null) {
        if (value !== null) {
            throw new LayoutError("Input borders belong in the prefab");
        }
    }
}

/** 只承担命中和 PAL 契约，绝不生成第二份 Canvas 文字。 */
class BridgeInput extends Laya.Input {
    constructor(
        private readonly binding: {
            read(): string;
            revision(): number;
            write(value: string): void;
            prepare(): void;
            hide(value: boolean): void;
        }
    ) {
        super();
    }
    override get text(): string {
        return this.binding.read();
    }
    override set text(value: string) {
        this.binding.write(value);
    }
    override setInputText(value: string): void {
        this.binding.write(value);
    }
    override getInputText(): string {
        return this.binding.read();
    }
    override get inputRevision(): number {
        return this.binding.revision();
    }
    override prepareInput(): void {
        this.binding.prepare();
    }
    override configureInputElement(element: HTMLInputElement | HTMLTextAreaElement): void {
        if (!this.multiline) {
            (element as HTMLInputElement).type = this.type === "password" ? "password" : "text";
        }
        element.inputMode =
            this.type === "number"
                ? "decimal"
                : this.type === "email"
                  ? "email"
                  : this.type === "url"
                    ? "url"
                    : "text";
        if (this.maxChars === 0) {
            element.removeAttribute("maxlength");
        }
    }
    override hideText(value: boolean): void {
        this.binding.hide(value);
    }
    protected override _typeset(): void {
        this._isChanged = false;
        this.graphics.clear();
    }
}
