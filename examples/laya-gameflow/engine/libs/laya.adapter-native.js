(function (exports, Laya) {
    'use strict';

    class DesktopNativeTextInputContext {
        constructor(api = window.conch) {
            this.capabilities = {
                composition: true,
                surroundingText: false,
                selection: false,
                candidateRect: true,
                virtualKeyboard: false,
                clipboard: false
            };
            this._client = null;
            this._sessionId = 0;
            this._platformActive = false;
            this._editable = false;
            this.onNativeEvent = (sessionId, eventType, text, start, length) => {
                if (!this._client || sessionId !== this._sessionId)
                    return;
                if (eventType === 3) {
                    this._platformActive = false;
                    this._client.platformSuspended(sessionId);
                    return;
                }
                if (eventType === 4) {
                    this._platformActive = true;
                    this._client.platformResumed(sessionId);
                    return;
                }
                if (!this._platformActive)
                    return;
                if (eventType >= 5
                    && eventType <= 10) {
                    this.handleClipboardCommand(sessionId, eventType);
                    return;
                }
                const value = text == null ? "" : String(text);
                if (eventType === 1) {
                    const snapshot = this._client.querySnapshot(sessionId);
                    if (!value) {
                        if (snapshot && snapshot.compositionStart >= 0)
                            this._client.cancelComposition(sessionId);
                        return;
                    }
                    const selectionStart = this.codePointIndexToUtf16(value, start);
                    const selectionEnd = this.codePointIndexToUtf16(value, Math.max(0, start) + Math.max(0, length));
                    this._client.setComposition(sessionId, value, {
                        start: selectionStart,
                        end: selectionEnd
                    });
                }
                else if (eventType === 2) {
                    this._client.commitText(sessionId, value);
                }
            };
            this._api = api;
            this.capabilities.clipboard = typeof (api === null || api === void 0 ? void 0 : api.getClipboardText) === "function"
                && typeof (api === null || api === void 0 ? void 0 : api.setClipboardText) === "function";
        }
        static isSupported(host = window) {
            var _a, _b;
            const os = (_b = (_a = host === null || host === void 0 ? void 0 : host.conchConfig) === null || _a === void 0 ? void 0 : _a.getOS) === null || _b === void 0 ? void 0 : _b.call(_a);
            const api = host === null || host === void 0 ? void 0 : host.conch;
            return os === "Conch-window"
                && typeof (api === null || api === void 0 ? void 0 : api.setTextInputEvtFunction) === "function"
                && typeof (api === null || api === void 0 ? void 0 : api.startTextInput) === "function"
                && typeof (api === null || api === void 0 ? void 0 : api.stopTextInput) === "function"
                && typeof (api === null || api === void 0 ? void 0 : api.setTextInputRect) === "function";
        }
        initialize(client) {
            if (!this._api || !client)
                return false;
            this._client = client;
            this._api.setTextInputEvtFunction(this.onNativeEvent);
            return true;
        }
        shutdown() {
            this.stopPlatformSession(this._sessionId);
            this._client = null;
        }
        beginSession(sessionId, config, _snapshot) {
            if (this._sessionId && this._sessionId !== sessionId)
                this.stopPlatformSession(this._sessionId);
            this._sessionId = sessionId;
            this._editable = config.editable;
            if (this._editable)
                this.startPlatformSession(sessionId);
        }
        updateState(_sessionId, _snapshot) {
        }
        updateCaretRect(sessionId, rect) {
            if (sessionId !== this._sessionId || !this._platformActive)
                return;
            this._api.setTextInputRect(sessionId, Math.round(rect.x), Math.round(rect.y), Math.max(1, Math.round(rect.width)), Math.max(1, Math.round(rect.height)));
        }
        suspendSession(sessionId) {
            if (sessionId === this._sessionId)
                this.stopPlatformSession(sessionId);
        }
        resumeSession(sessionId) {
            if (this._editable && sessionId === this._sessionId)
                this.startPlatformSession(sessionId);
        }
        endSession(sessionId, _policy) {
            if (sessionId !== this._sessionId)
                return;
            this.stopPlatformSession(sessionId);
            this._sessionId = 0;
            this._editable = false;
        }
        showKeyboard(sessionId) {
            if (this._editable && sessionId === this._sessionId)
                this.startPlatformSession(sessionId);
        }
        hideKeyboard(sessionId) {
            if (sessionId === this._sessionId)
                this.stopPlatformSession(sessionId);
        }
        getClipboardText() {
            var _a;
            if (!this.capabilities.clipboard)
                return "";
            return String((_a = this._api.getClipboardText()) !== null && _a !== void 0 ? _a : "");
        }
        setClipboardText(text) {
            return this.capabilities.clipboard
                && this._api.setClipboardText(text == null ? "" : String(text)) !== false;
        }
        startPlatformSession(sessionId) {
            if (this._platformActive || sessionId <= 0)
                return;
            this._platformActive = this._api.startTextInput(sessionId) !== false;
        }
        handleClipboardCommand(sessionId, command) {
            const client = this._client;
            if (!client)
                return;
            if (command === 9) {
                client.undo(sessionId);
                return;
            }
            if (command === 10) {
                client.redo(sessionId);
                return;
            }
            const snapshot = client.querySnapshot(sessionId);
            if (!snapshot)
                return;
            if (command === 8) {
                client.setSelection(sessionId, { start: 0, end: snapshot.text.length });
                return;
            }
            if (command === 7) {
                const text = this.getClipboardText();
                if (text) {
                    client.replaceText(sessionId, {
                        start: snapshot.selectionStart,
                        end: snapshot.selectionEnd
                    }, text);
                }
                return;
            }
            if (snapshot.selectionStart === snapshot.selectionEnd)
                return;
            const start = Math.min(snapshot.selectionStart, snapshot.selectionEnd);
            const end = Math.max(snapshot.selectionStart, snapshot.selectionEnd);
            if (!this.setClipboardText(snapshot.text.substring(start, end)))
                return;
            if (command === 6)
                client.replaceText(sessionId, { start, end }, "");
        }
        stopPlatformSession(sessionId) {
            if (!this._platformActive || sessionId <= 0)
                return;
            this._platformActive = false;
            this._api.stopTextInput(sessionId);
        }
        codePointIndexToUtf16(value, index) {
            let utf16Index = 0;
            let remaining = Math.max(0, Math.trunc(index));
            for (const character of value) {
                if (remaining-- <= 0)
                    break;
                utf16Index += character.length;
            }
            return utf16Index;
        }
    }

    class NativeBrowserAdapter extends Laya.BrowserAdapter {
        constructor() {
            super(...arguments);
            this._visible = true;
        }
        init() {
            Laya.Config.fixedFrames = false;
            Laya.Browser.onLayaRuntime = true;
            Laya.Browser.isDomSupported = false;
            Laya.PAL.g = window.conch;
            Laya.PAL.g.setPreferredFramesPerSecond(Laya.Config.FPS);
            if (window.conchConfig.getOS() == "Conch-ios") {
                Laya.Config.enableUniformBufferObject = false;
                Laya.Config.matUseUBO = false;
            }
            Laya.WasmAdapter.instantiateWasm = (wasmFile, imports) => {
                wasmFile = Laya.WasmAdapter.locateFileDefault(wasmFile);
                return Laya.Laya.loader.fetch(wasmFile, "arraybuffer").then(data => {
                    if (data) {
                        let module = new window.WebAssembly.Module(data);
                        let instance = new window.WebAssembly.Instance(module, imports);
                        let ret = {};
                        ret["instance"] = instance;
                        return ret;
                    }
                    else {
                        console.error("WASM file not found: " + wasmFile);
                        return null;
                    }
                });
            };
            let windowInfo = Laya.PAL.g.getWindowInfo();
            this._pixelRatio = windowInfo.pixelRatio;
            let deviceInfo = Laya.PAL.g.getDeviceInfo();
            let platform = deviceInfo.platform || "";
            this.setPlatform("", platform);
            Laya.PAL.g.onShow(() => {
                this._visible = true;
                this.event(Laya.Event.VISIBILITY_CHANGE, true);
                this.event(Laya.Event.FOCUS);
            });
            Laya.PAL.g.onHide(() => {
                this._visible = false;
                this.event(Laya.Event.VISIBILITY_CHANGE, false);
                this.event(Laya.Event.BLUR);
            });
            if (Laya.PAL.hasAPI("onWindowResize")) {
                Laya.PAL.g.onWindowResize(result => {
                    this.event(Laya.Event.RESIZE);
                });
            }
        }
        getVisibility() {
            return this._visible;
        }
        setWindowSize(width, height) {
            if (!Laya.PAL.hasAPI("setWindowSize")) {
                Laya.PAL.warnIncompatibility("setWindowSize");
                return false;
            }
            return Laya.PAL.g.setWindowSize(width, height);
        }
        setResolution(width, height, fullscreen) {
            if (Laya.PAL.hasAPI("setResolution"))
                return Laya.PAL.g.setResolution(width, height, fullscreen);
            if (!fullscreen && Laya.PAL.hasAPI("setWindowSize"))
                return Laya.PAL.g.setWindowSize(width, height);
            Laya.PAL.warnIncompatibility("setResolution");
            return false;
        }
        setWindowedFullscreen(enabled) {
            if (!Laya.PAL.hasAPI("setWindowedFullscreen")) {
                Laya.PAL.warnIncompatibility("setWindowedFullscreen");
                return false;
            }
            return Laya.PAL.g.setWindowedFullscreen(enabled);
        }
        createMainCanvas() {
            this._canvas = Laya.PAL.g.createCanvas();
            this._canvas.id = "layaCanvas";
            return this._canvas;
        }
        createElement(tagName) {
            let ele;
            if (tagName === "canvas" && typeof (Laya.PAL.g.createCanvas) === "function")
                ele = Laya.PAL.g.createCanvas();
            else
                ele = super.createElement(tagName);
            return ele;
        }
        getElementById(id) {
            if (id === this._canvas.id) {
                return this._canvas;
            }
            return null;
        }
        removeElement(ele) {
        }
        get supportArrayBufferURL() {
            return true;
        }
        createBufferURL(data) {
            return Laya.PAL.g.createBufferURL(data);
        }
        revokeBufferURL(url) {
            return Laya.PAL.g.revokeBufferURL(url);
        }
        onCaptureGlobalError(enabled, func) {
            if (enabled) {
                if (Laya.PAL.hasAPI("onError"))
                    Laya.PAL.g.onError(func);
                if (Laya.PAL.g.onUnhandledRejection)
                    Laya.PAL.g.onUnhandledRejection(func);
            }
            else {
                if (Laya.PAL.hasAPI("offError"))
                    Laya.PAL.g.offError(func);
                if (Laya.PAL.g.offUnhandledRejection)
                    Laya.PAL.g.offUnhandledRejection(func);
            }
        }
    }
    Laya.PAL.register("browser", NativeBrowserAdapter);

    exports.NativeTextInputState = void 0;
    (function (NativeTextInputState) {
        NativeTextInputState[NativeTextInputState["Inactive"] = 0] = "Inactive";
        NativeTextInputState[NativeTextInputState["Active"] = 1] = "Active";
        NativeTextInputState[NativeTextInputState["Composing"] = 2] = "Composing";
        NativeTextInputState[NativeTextInputState["Suspended"] = 3] = "Suspended";
    })(exports.NativeTextInputState || (exports.NativeTextInputState = {}));

    class NativeTextEditor {
        constructor() {
            this._sessionId = 0;
            this._revision = 0;
            this._state = exports.NativeTextInputState.Inactive;
            this._text = "";
            this._selectionStart = 0;
            this._selectionEnd = 0;
            this._compositionText = "";
            this._compositionBaseStart = -1;
            this._compositionBaseEnd = -1;
            this._compositionSelectionStart = 0;
            this._compositionSelectionEnd = 0;
            this._maxLength = 0;
            this._undoHistory = [];
            this._redoHistory = [];
        }
        get sessionId() {
            return this._sessionId;
        }
        get revision() {
            return this._revision;
        }
        get state() {
            return this._state;
        }
        get active() {
            return this._state !== exports.NativeTextInputState.Inactive;
        }
        get composing() {
            return this._compositionBaseStart !== -1;
        }
        get committedText() {
            return this._text;
        }
        get displayText() {
            if (!this.composing)
                return this._text;
            return this._text.substring(0, this._compositionBaseStart)
                + this._compositionText
                + this._text.substring(this._compositionBaseEnd);
        }
        begin(sessionId, text, selectionStart, selectionEnd, maxLength = 0) {
            if (sessionId <= 0)
                throw new Error("Native text input sessionId must be greater than zero.");
            this._sessionId = sessionId;
            this._text = text == null ? "" : String(text);
            this._maxLength = Number.isFinite(maxLength)
                ? Math.max(0, Math.trunc(maxLength))
                : 0;
            const selection = this.normalizeRange(selectionStart, selectionEnd, this._text.length);
            this._selectionStart = selection.start;
            this._selectionEnd = selection.end;
            this.clearComposition();
            this.clearHistory();
            this._state = exports.NativeTextInputState.Active;
            this.touch();
            return this.snapshot();
        }
        end(sessionId, commitComposition) {
            if (!this.accepts(sessionId))
                return null;
            if (this.composing) {
                if (commitComposition)
                    this.commitCompositionInternal(this._compositionText);
                else
                    this.cancelCompositionInternal();
            }
            this._state = exports.NativeTextInputState.Inactive;
            this._sessionId = 0;
            this._maxLength = 0;
            this.clearHistory();
            this.touch();
            return this.snapshot();
        }
        suspend(sessionId) {
            if (!this.accepts(sessionId) || this._state === exports.NativeTextInputState.Suspended)
                return null;
            this._state = exports.NativeTextInputState.Suspended;
            this.touch();
            return this.snapshot();
        }
        resume(sessionId) {
            if (!this.accepts(sessionId) || this._state !== exports.NativeTextInputState.Suspended)
                return null;
            this._state = this.composing ? exports.NativeTextInputState.Composing : exports.NativeTextInputState.Active;
            this.touch();
            return this.snapshot();
        }
        setText(sessionId, text, selectionStart, selectionEnd) {
            if (!this.accepts(sessionId))
                return null;
            const value = text == null ? "" : String(text);
            const start = selectionStart == null ? value.length : selectionStart;
            const end = selectionEnd == null ? start : selectionEnd;
            const selection = this.normalizeRange(start, end, value.length);
            if (this._text === value
                && !this.composing
                && this._selectionStart === selection.start
                && this._selectionEnd === selection.end)
                return this.snapshot();
            const textChanged = this._text !== value;
            this._text = value;
            this._selectionStart = selection.start;
            this._selectionEnd = selection.end;
            this.clearComposition();
            if (textChanged)
                this.clearHistory();
            this._state = exports.NativeTextInputState.Active;
            this.touch();
            return this.snapshot();
        }
        setSelection(sessionId, start, end) {
            if (!this.accepts(sessionId))
                return null;
            const committedComposition = this.composing;
            if (committedComposition) {
                this.recordUndo();
                this.commitCompositionInternal(this._compositionText);
            }
            const selection = this.normalizeRange(start, end, this._text.length);
            if (this._selectionStart === selection.start && this._selectionEnd === selection.end) {
                if (committedComposition)
                    this.touch();
                return this.snapshot();
            }
            this._selectionStart = selection.start;
            this._selectionEnd = selection.end;
            this.touch();
            return this.snapshot();
        }
        setComposition(sessionId, text, selectionStart, selectionEnd) {
            if (!this.accepts(sessionId))
                return null;
            const value = text == null ? "" : String(text);
            const wasComposing = this.composing;
            if (!wasComposing) {
                this._compositionBaseStart = this._selectionStart;
                this._compositionBaseEnd = this._selectionEnd;
            }
            const start = selectionStart == null ? value.length : selectionStart;
            const end = selectionEnd == null ? start : selectionEnd;
            const selection = this.normalizeRange(start, end, value.length);
            if (wasComposing
                && this._compositionText === value
                && this._compositionSelectionStart === selection.start
                && this._compositionSelectionEnd === selection.end)
                return this.snapshot();
            this._compositionText = value;
            this._compositionSelectionStart = selection.start;
            this._compositionSelectionEnd = selection.end;
            this._state = exports.NativeTextInputState.Composing;
            this.touch();
            return this.snapshot();
        }
        commitText(sessionId, text) {
            if (!this.accepts(sessionId))
                return null;
            const value = text == null ? "" : String(text);
            if (this.composing) {
                this.recordUndo();
                this.commitCompositionInternal(value);
            }
            else {
                if (this.rangeReplacementChanges(this._selectionStart, this._selectionEnd, value))
                    this.recordUndo();
                this.replaceRangeInternal(this._selectionStart, this._selectionEnd, value);
            }
            this.touch();
            return this.snapshot();
        }
        finishComposition(sessionId) {
            if (!this.accepts(sessionId) || !this.composing)
                return null;
            this.recordUndo();
            this.commitCompositionInternal(this._compositionText);
            this.touch();
            return this.snapshot();
        }
        cancelComposition(sessionId) {
            if (!this.accepts(sessionId) || !this.composing)
                return null;
            this.cancelCompositionInternal();
            this.touch();
            return this.snapshot();
        }
        replaceText(sessionId, start, end, text) {
            if (!this.accepts(sessionId))
                return null;
            let historyRecorded = false;
            if (this.composing) {
                this.recordUndo();
                historyRecorded = true;
                this.commitCompositionInternal(this._compositionText);
            }
            if (!historyRecorded
                && this.rangeReplacementChanges(start, end, text == null ? "" : String(text)))
                this.recordUndo();
            this.replaceRangeInternal(start, end, text == null ? "" : String(text));
            this.touch();
            return this.snapshot();
        }
        deleteSurroundingText(sessionId, before, after) {
            if (!this.accepts(sessionId))
                return null;
            let historyRecorded = false;
            if (this.composing) {
                this.recordUndo();
                historyRecorded = true;
                this.commitCompositionInternal(this._compositionText);
            }
            if (this._selectionStart !== this._selectionEnd) {
                if (!historyRecorded)
                    this.recordUndo();
                this.replaceRangeInternal(this._selectionStart, this._selectionEnd, "");
            }
            else {
                const safeBefore = Math.max(0, before | 0);
                const safeAfter = Math.max(0, after | 0);
                const start = Math.max(0, this._selectionStart - safeBefore);
                const end = Math.min(this._text.length, this._selectionEnd + safeAfter);
                if (start !== end) {
                    if (!historyRecorded)
                        this.recordUndo();
                    this.replaceRangeInternal(start, end, "");
                }
            }
            this.touch();
            return this.snapshot();
        }
        undo(sessionId) {
            if (!this.accepts(sessionId) || this._undoHistory.length === 0)
                return null;
            if (this.composing)
                this.cancelCompositionInternal();
            this.pushHistory(this._redoHistory, this.captureHistory());
            this.restoreHistory(this._undoHistory.pop());
            this.touch();
            return this.snapshot();
        }
        redo(sessionId) {
            if (!this.accepts(sessionId) || this._redoHistory.length === 0)
                return null;
            if (this.composing)
                this.cancelCompositionInternal();
            this.pushHistory(this._undoHistory, this.captureHistory());
            this.restoreHistory(this._redoHistory.pop());
            this.touch();
            return this.snapshot();
        }
        snapshot() {
            const composing = this.composing;
            const compositionStart = composing ? this._compositionBaseStart : -1;
            const compositionEnd = composing ? compositionStart + this._compositionText.length : -1;
            const selectionStart = composing
                ? compositionStart + this._compositionSelectionStart
                : this._selectionStart;
            const selectionEnd = composing
                ? compositionStart + this._compositionSelectionEnd
                : this._selectionEnd;
            return {
                sessionId: this._sessionId,
                revision: this._revision,
                state: this._state,
                text: this.displayText,
                selectionStart,
                selectionEnd,
                compositionStart,
                compositionEnd
            };
        }
        accepts(sessionId) {
            return sessionId > 0 && sessionId === this._sessionId && this._state !== exports.NativeTextInputState.Inactive;
        }
        normalizeRange(start, end, textLength) {
            let rangeStart = Math.max(0, Math.min(textLength, Number.isFinite(start) ? Math.trunc(start) : 0));
            let rangeEnd = end === -1
                ? textLength
                : Math.max(0, Math.min(textLength, Number.isFinite(end) ? Math.trunc(end) : rangeStart));
            if (rangeStart > rangeEnd) {
                const tmp = rangeStart;
                rangeStart = rangeEnd;
                rangeEnd = tmp;
            }
            return { start: rangeStart, end: rangeEnd };
        }
        replaceRangeInternal(start, end, value) {
            const range = this.normalizeRange(start, end, this._text.length);
            value = this.limitReplacement(value, range);
            this._text = this._text.substring(0, range.start) + value + this._text.substring(range.end);
            this._selectionStart = this._selectionEnd = range.start + value.length;
            this.clearComposition();
            this._state = exports.NativeTextInputState.Active;
        }
        rangeReplacementChanges(start, end, value) {
            const range = this.normalizeRange(start, end, this._text.length);
            value = this.limitReplacement(value, range);
            const nextText = this._text.substring(0, range.start)
                + value
                + this._text.substring(range.end);
            const nextSelection = range.start + value.length;
            return nextText !== this._text
                || this._selectionStart !== nextSelection
                || this._selectionEnd !== nextSelection;
        }
        limitReplacement(value, range) {
            if (this._maxLength <= 0)
                return value;
            const retainedLength = this._text.length - (range.end - range.start);
            const availableLength = Math.max(0, this._maxLength - retainedLength);
            return value.length > availableLength
                ? value.substring(0, availableLength)
                : value;
        }
        commitCompositionInternal(value) {
            this.replaceRangeInternal(this._compositionBaseStart, this._compositionBaseEnd, value);
        }
        cancelCompositionInternal() {
            this._selectionStart = this._compositionBaseStart;
            this._selectionEnd = this._compositionBaseEnd;
            this.clearComposition();
            this._state = exports.NativeTextInputState.Active;
        }
        clearComposition() {
            this._compositionText = "";
            this._compositionBaseStart = -1;
            this._compositionBaseEnd = -1;
            this._compositionSelectionStart = 0;
            this._compositionSelectionEnd = 0;
        }
        captureHistory() {
            return {
                text: this._text,
                selectionStart: this._selectionStart,
                selectionEnd: this._selectionEnd
            };
        }
        recordUndo() {
            this.pushHistory(this._undoHistory, this.captureHistory());
            this._redoHistory.length = 0;
        }
        pushHistory(history, entry) {
            const last = history[history.length - 1];
            if (last
                && last.text === entry.text
                && last.selectionStart === entry.selectionStart
                && last.selectionEnd === entry.selectionEnd)
                return;
            history.push(entry);
            if (history.length > NativeTextEditor.MAX_HISTORY_LENGTH)
                history.shift();
        }
        restoreHistory(entry) {
            this._text = entry.text;
            this._selectionStart = entry.selectionStart;
            this._selectionEnd = entry.selectionEnd;
            this.clearComposition();
            this._state = exports.NativeTextInputState.Active;
        }
        clearHistory() {
            this._undoHistory.length = 0;
            this._redoHistory.length = 0;
        }
        touch() {
            this._revision++;
        }
    }
    NativeTextEditor.MAX_HISTORY_LENGTH = 100;

    exports.NativeTextInputAction = void 0;
    (function (NativeTextInputAction) {
        NativeTextInputAction[NativeTextInputAction["Default"] = 0] = "Default";
        NativeTextInputAction[NativeTextInputAction["Enter"] = 1] = "Enter";
        NativeTextInputAction[NativeTextInputAction["Done"] = 2] = "Done";
        NativeTextInputAction[NativeTextInputAction["Next"] = 3] = "Next";
        NativeTextInputAction[NativeTextInputAction["Search"] = 4] = "Search";
        NativeTextInputAction[NativeTextInputAction["Send"] = 5] = "Send";
    })(exports.NativeTextInputAction || (exports.NativeTextInputAction = {}));
    exports.NativeTextInputEndPolicy = void 0;
    (function (NativeTextInputEndPolicy) {
        NativeTextInputEndPolicy[NativeTextInputEndPolicy["CommitComposition"] = 0] = "CommitComposition";
        NativeTextInputEndPolicy[NativeTextInputEndPolicy["CancelComposition"] = 1] = "CancelComposition";
    })(exports.NativeTextInputEndPolicy || (exports.NativeTextInputEndPolicy = {}));

    class NativeTextInputBridge {
        constructor(context) {
            this.editor = new NativeTextEditor();
            this._nextSessionId = 0;
            this._initialized = false;
            this._context = context;
        }
        initialize() {
            if (!this._initialized)
                this._initialized = this._context.initialize(this);
            return this._initialized;
        }
        shutdown() {
            if (!this._initialized)
                return;
            if (this.editor.active)
                this.end(exports.NativeTextInputEndPolicy.CancelComposition);
            this._context.shutdown();
            this._initialized = false;
        }
        begin(config, text, selectionStart, selectionEnd) {
            if (!this.initialize())
                throw new Error("Native text input context initialization failed.");
            if (this.editor.active)
                this.end(exports.NativeTextInputEndPolicy.CommitComposition);
            const sessionId = ++this._nextSessionId;
            const snapshot = this.editor.begin(sessionId, text, selectionStart, selectionEnd, config.maxLength);
            this._context.beginSession(sessionId, config, snapshot);
            this.notify(snapshot);
            return snapshot;
        }
        end(policy) {
            const sessionId = this.editor.sessionId;
            if (!sessionId)
                return null;
            const snapshot = this.editor.end(sessionId, policy === exports.NativeTextInputEndPolicy.CommitComposition);
            this._context.endSession(sessionId, policy);
            if (snapshot)
                this.notify(snapshot);
            return snapshot;
        }
        suspend() {
            const sessionId = this.editor.sessionId;
            const snapshot = this.editor.suspend(sessionId);
            if (snapshot) {
                this._context.suspendSession(sessionId);
                this.notify(snapshot);
            }
            return snapshot;
        }
        resume() {
            const sessionId = this.editor.sessionId;
            const snapshot = this.editor.resume(sessionId);
            if (snapshot) {
                this._context.resumeSession(sessionId);
                this.publish(snapshot);
            }
            return snapshot;
        }
        updateCaretRect(rect) {
            if (this.editor.active)
                this._context.updateCaretRect(this.editor.sessionId, rect);
        }
        showKeyboard() {
            if (this.editor.active)
                this._context.showKeyboard(this.editor.sessionId);
        }
        hideKeyboard() {
            if (this.editor.active)
                this._context.hideKeyboard(this.editor.sessionId);
        }
        getClipboardText() {
            return this._context.capabilities.clipboard && this._context.getClipboardText
                ? this._context.getClipboardText()
                : "";
        }
        setClipboardText(text) {
            return this._context.capabilities.clipboard && this._context.setClipboardText
                ? this._context.setClipboardText(text)
                : false;
        }
        updateText(text, selectionStart, selectionEnd) {
            if (!this.editor.active)
                return null;
            const snapshot = this.editor.setText(this.editor.sessionId, text, selectionStart, selectionEnd);
            this.publish(snapshot);
            return snapshot;
        }
        updateSelection(start, end) {
            if (!this.editor.active)
                return null;
            const snapshot = this.editor.setSelection(this.editor.sessionId, start, end);
            this.publish(snapshot);
            return snapshot;
        }
        deleteAroundSelection(before, after) {
            if (!this.editor.active)
                return null;
            const snapshot = this.editor.deleteSurroundingText(this.editor.sessionId, before, after);
            this.publish(snapshot);
            return snapshot;
        }
        insertText(text) {
            if (!this.editor.active)
                return null;
            const snapshot = this.editor.commitText(this.editor.sessionId, text);
            this.publish(snapshot);
            return snapshot;
        }
        undo(sessionId = this.editor.sessionId) {
            if (!this.acceptsEdit(sessionId))
                return null;
            const snapshot = this.editor.undo(sessionId);
            this.publish(snapshot);
            return snapshot;
        }
        redo(sessionId = this.editor.sessionId) {
            if (!this.acceptsEdit(sessionId))
                return null;
            const snapshot = this.editor.redo(sessionId);
            this.publish(snapshot);
            return snapshot;
        }
        finishPendingComposition() {
            if (!this.editor.active || !this.editor.composing)
                return null;
            const snapshot = this.editor.finishComposition(this.editor.sessionId);
            this.publish(snapshot);
            return snapshot;
        }
        querySnapshot(sessionId) {
            return this.accepts(sessionId) ? this.editor.snapshot() : null;
        }
        setComposition(sessionId, text, selection) {
            if (!this.acceptsEdit(sessionId))
                return;
            this.publish(this.editor.setComposition(sessionId, text, selection.start, selection.end));
        }
        commitText(sessionId, text) {
            if (!this.acceptsEdit(sessionId))
                return;
            this.publish(this.editor.commitText(sessionId, text));
        }
        finishComposition(sessionId) {
            if (!this.acceptsEdit(sessionId))
                return;
            this.publish(this.editor.finishComposition(sessionId));
        }
        cancelComposition(sessionId) {
            if (!this.acceptsEdit(sessionId))
                return;
            this.publish(this.editor.cancelComposition(sessionId));
        }
        replaceText(sessionId, range, text) {
            if (!this.acceptsEdit(sessionId))
                return;
            this.publish(this.editor.replaceText(sessionId, range.start, range.end, text));
        }
        setSelection(sessionId, selection) {
            if (!this.acceptsEdit(sessionId))
                return;
            this.publish(this.editor.setSelection(sessionId, selection.start, selection.end));
        }
        deleteSurroundingText(sessionId, before, after) {
            if (!this.acceptsEdit(sessionId))
                return;
            this.publish(this.editor.deleteSurroundingText(sessionId, before, after));
        }
        performAction(sessionId, action) {
            if (this.acceptsEdit(sessionId) && this.onAction)
                this.onAction(action);
        }
        platformSuspended(sessionId) {
            if (!this.acceptsEdit(sessionId))
                return;
            if (this.editor.composing)
                this.editor.cancelComposition(sessionId);
            const snapshot = this.editor.suspend(sessionId);
            if (snapshot)
                this.notify(snapshot);
        }
        platformResumed(sessionId) {
            if (!this.accepts(sessionId) || this.editor.state !== exports.NativeTextInputState.Suspended)
                return;
            const snapshot = this.editor.resume(sessionId);
            if (snapshot) {
                this._context.updateState(sessionId, snapshot);
                this.notify(snapshot);
            }
        }
        accepts(sessionId) {
            return sessionId > 0 && sessionId === this.editor.sessionId && this.editor.active;
        }
        acceptsEdit(sessionId) {
            return this.accepts(sessionId) && this.editor.state !== exports.NativeTextInputState.Suspended;
        }
        publish(snapshot) {
            if (!snapshot)
                return;
            this._context.updateState(this.editor.sessionId, snapshot);
            this.notify(snapshot);
        }
        notify(snapshot) {
            if (this.onSnapshotChanged)
                this.onSnapshotChanged(snapshot, this.editor.committedText);
        }
    }

    class NativeTextLayout {
        constructor(target) {
            this._text = "";
            this._lines = [];
            this._target = target;
        }
        refresh(text) {
            this._text = text == null ? "" : String(text);
            this._target.typeset();
            const sourceLines = this._target.lines;
            const lines = [];
            let textIndex = 0;
            for (let i = 0, n = sourceLines.length; i < n; i++) {
                const sourceLine = sourceLines[i];
                const indexedLine = {
                    line: sourceLine,
                    start: textIndex,
                    end: textIndex,
                    commands: []
                };
                let command = sourceLine.cmd;
                while (command) {
                    if (!command.obj && typeof command.text === "string") {
                        const length = Math.min(command.text.length, this._text.length - textIndex);
                        if (length > 0) {
                            indexedLine.commands.push({
                                command,
                                start: textIndex,
                                end: textIndex + length
                            });
                            textIndex += length;
                        }
                    }
                    command = command.next;
                }
                indexedLine.end = textIndex;
                lines.push(indexedLine);
                if (i !== n - 1)
                    textIndex = this.skipLineBreak(textIndex);
            }
            this._lines = lines;
        }
        ensureCurrent() {
            if (this._target._isChanged)
                this.refresh(this._text);
        }
        getCaretRect(index, out = new Laya.Rectangle()) {
            const target = this._target;
            const textLength = this._text.length;
            const normalizedIndex = this.normalizeIndex(index, textLength);
            const padding = target.padding;
            const scrollX = target.scrollX;
            const scrollY = target.scrollY;
            if (this._lines.length === 0 || textLength === 0) {
                const targetInternal = target;
                const fontScale = Number.isFinite(targetInternal._fontSizeScale)
                    ? targetInternal._fontSizeScale
                    : 1;
                const height = Math.max(1, Math.floor(target.fontSize * fontScale) + 1);
                const contentWidth = Math.max(0, target.width - padding[3] - padding[1]);
                let x = padding[3];
                if (target.align === "center")
                    x += Math.floor(contentWidth * 0.5);
                else if (target.align === "right")
                    x += contentWidth;
                return out.setTo(x - scrollX, padding[0] - scrollY, 0, height);
            }
            let fallback = this._lines[0];
            let fallbackX = padding[3] + fallback.line.x - scrollX;
            for (const line of this._lines) {
                const lineX = padding[3] + line.line.x - scrollX;
                const lineY = padding[0] + line.line.y - scrollY;
                if (line.commands.length === 0 && normalizedIndex === line.start)
                    return out.setTo(lineX, lineY, 0, line.line.height);
                for (const item of line.commands) {
                    const command = item.command;
                    if (normalizedIndex === item.start)
                        return out.setTo(lineX + command.x, lineY, 0, line.line.height);
                    if (normalizedIndex > item.start && normalizedIndex < item.end) {
                        const prefixLength = normalizedIndex - item.start;
                        return out.setTo(lineX + command.x + this.measureCommandPrefix(command, prefixLength), lineY, 0, line.line.height);
                    }
                    if (normalizedIndex === item.end) {
                        fallback = line;
                        fallbackX = lineX + command.x + command.width;
                    }
                }
                if (normalizedIndex > line.end) {
                    fallback = line;
                    fallbackX = lineX + line.line.width;
                }
            }
            return out.setTo(fallbackX, padding[0] + fallback.line.y - scrollY, 0, fallback.line.height);
        }
        getIndexAtPoint(x, y) {
            if (this._lines.length === 0 || this._text.length === 0)
                return 0;
            const target = this._target;
            const padding = target.padding;
            const scrollX = target.scrollX;
            const scrollY = target.scrollY;
            const layoutY = y - padding[0] + scrollY;
            let line = this._lines[0];
            for (const candidate of this._lines) {
                line = candidate;
                if (layoutY < candidate.line.y + candidate.line.height)
                    break;
            }
            const lineX = padding[3] + line.line.x - scrollX;
            const localX = x - lineX;
            if (line.commands.length === 0 || localX <= 0)
                return line.start;
            for (const item of line.commands) {
                const command = item.command;
                if (localX <= command.x)
                    return item.start;
                if (localX < command.x + command.width) {
                    return item.start + this.getCommandIndexAtX(command, localX - command.x, item.end - item.start);
                }
            }
            return line.end;
        }
        getRangeRects(start, end, result = []) {
            result.length = 0;
            let rangeStart = this.normalizeIndex(start, this._text.length);
            let rangeEnd = this.normalizeIndex(end, this._text.length);
            if (rangeStart > rangeEnd) {
                const temporary = rangeStart;
                rangeStart = rangeEnd;
                rangeEnd = temporary;
            }
            if (rangeStart === rangeEnd)
                return result;
            const target = this._target;
            const padding = target.padding;
            const scrollX = target.scrollX;
            const scrollY = target.scrollY;
            for (const line of this._lines) {
                const selectionStart = Math.max(rangeStart, line.start);
                const selectionEnd = Math.min(rangeEnd, line.end);
                if (selectionStart >= selectionEnd)
                    continue;
                const lineX = padding[3] + line.line.x - scrollX;
                const x1 = lineX + this.getLineCaretX(line, selectionStart);
                const x2 = lineX + this.getLineCaretX(line, selectionEnd);
                result.push(new Laya.Rectangle(Math.min(x1, x2), padding[0] + line.line.y - scrollY, Math.abs(x2 - x1), line.line.height));
            }
            return result;
        }
        getLineCaretX(line, index) {
            let fallback = 0;
            for (const item of line.commands) {
                const command = item.command;
                if (index <= item.start)
                    return command.x;
                if (index < item.end)
                    return command.x + this.measureCommandPrefix(command, index - item.start);
                fallback = command.x + command.width;
            }
            return fallback;
        }
        getCommandIndexAtX(command, x, textLength) {
            let low = 0;
            let high = textLength;
            while (low < high) {
                const middle = Math.floor((low + high) * 0.5);
                if (this.measureCommandPrefix(command, middle) < x)
                    low = middle + 1;
                else
                    high = middle;
            }
            if (low <= 0)
                return 0;
            const previousWidth = this.measureCommandPrefix(command, low - 1);
            const currentWidth = this.measureCommandPrefix(command, low);
            return x - previousWidth <= currentWidth - x ? low - 1 : low;
        }
        measureCommandPrefix(command, length) {
            const prefixLength = Math.max(0, Math.min(command.text.length, length));
            if (prefixLength === 0)
                return 0;
            if (prefixLength === command.text.length)
                return command.width;
            const text = command.text.substring(0, prefixLength);
            const targetInternal = this._target;
            const spacing = this._target.letterSpacing;
            const bitmapFont = targetInternal._bitmapFont;
            if (bitmapFont)
                return bitmapFont.getTextWidth(text, command.fontSize) + spacing * text.length;
            const oldFont = Laya.Browser.context.font;
            Laya.Browser.context.font = command.ctxFont;
            const width = Laya.Browser.context.measureText(text).width + spacing * text.length;
            Laya.Browser.context.font = oldFont;
            return width;
        }
        skipLineBreak(index) {
            if (this._text.charCodeAt(index) === 13)
                index++;
            if (this._text.charCodeAt(index) === 10)
                index++;
            return index;
        }
        normalizeIndex(index, textLength) {
            return Math.max(0, Math.min(textLength, Number.isFinite(index) ? Math.trunc(index) : 0));
        }
    }

    class NativeTextInputVisual {
        constructor(target, initialText) {
            this._caretVisible = true;
            this._caretRect = new Laya.Rectangle();
            this.selectionColor = "rgba(51, 153, 255, 0.35)";
            this.compositionColor = "#4A90E2";
            this.caretColor = "#000000";
            this.caretWidth = 1;
            this._target = target;
            this._layout = new NativeTextLayout(target);
            this._overlay = new Laya.Sprite();
            this._overlay.name = "__windowsNativeInputOverlay";
            this._overlay.mouseEnabled = false;
            target.addChild(this._overlay);
            this._layout.refresh(initialText);
        }
        update(editor) {
            const snapshot = editor.snapshot();
            this._snapshot = snapshot;
            this._layout.refresh(snapshot.text);
            this.redraw();
        }
        setCaretVisible(value) {
            if (this._caretVisible === value)
                return;
            this._caretVisible = value;
            if (this._snapshot)
                this.redraw();
        }
        dispose() {
            this._snapshot = null;
            this._overlay.removeSelf();
            this._overlay.destroy();
        }
        getCaretRect(index) {
            this._layout.ensureCurrent();
            return this._layout.getCaretRect(index, this._caretRect);
        }
        getIndexAtPoint(x, y) {
            this._layout.ensureCurrent();
            return this._layout.getIndexAtPoint(x, y);
        }
        refresh() {
            this._layout.ensureCurrent();
            this.redraw();
        }
        redraw() {
            const graphics = this._overlay.graphics;
            graphics.clear();
            this.drawSelection();
            this.drawCompositionAndCaret();
            if (this._overlay.parent === this._target)
                this._target.setChildIndex(this._overlay, this._target.numChildren - 1);
        }
        drawSelection() {
            const snapshot = this._snapshot;
            if (!snapshot || snapshot.state === exports.NativeTextInputState.Inactive || snapshot.state === exports.NativeTextInputState.Suspended)
                return;
            if (snapshot.selectionStart === snapshot.selectionEnd)
                return;
            const graphics = this._overlay.graphics;
            const rects = this._layout.getRangeRects(snapshot.selectionStart, snapshot.selectionEnd);
            for (let rect of rects) {
                if (rect.width > 0 && rect.height > 0)
                    graphics.drawRect(rect.x, rect.y, rect.width, rect.height, this.selectionColor);
            }
        }
        drawCompositionAndCaret() {
            const snapshot = this._snapshot;
            if (!snapshot || snapshot.state === exports.NativeTextInputState.Inactive || snapshot.state === exports.NativeTextInputState.Suspended)
                return;
            const graphics = this._overlay.graphics;
            if (snapshot.compositionStart >= 0 && snapshot.compositionEnd > snapshot.compositionStart) {
                const rects = this._layout.getRangeRects(snapshot.compositionStart, snapshot.compositionEnd);
                for (let rect of rects) {
                    const y = rect.y + rect.height - 1;
                    graphics.drawLine(rect.x, y, rect.x + rect.width, y, this.compositionColor, 1);
                }
            }
            if (!this._caretVisible || snapshot.selectionStart !== snapshot.selectionEnd)
                return;
            const caret = this._layout.getCaretRect(snapshot.selectionEnd);
            graphics.drawLine(caret.x, caret.y, caret.x, caret.y + caret.height, this.caretColor, Math.max(1, this.caretWidth));
        }
    }

    const setCanvasText = Object.getOwnPropertyDescriptor(Laya.Text.prototype, "text").set;
    class NativeCanvasTextInputAdapter extends Laya.TextInputAdapter {
        constructor() {
            super();
            this._lastCommittedText = "";
            this._programmaticUpdate = false;
            this._normalizingText = false;
            this._compositionTextExposed = false;
            this._beginFromPointer = false;
            this._pointerSelecting = false;
            this._selectionAnchor = 0;
            this._verticalCaretX = NaN;
            this._caretVisible = true;
            this._lastCaretX = NaN;
            this._lastCaretY = NaN;
            this._lastCaretWidth = NaN;
            this._lastCaretHeight = NaN;
            this._pendingSelectionStart = NaN;
            this._pendingSelectionEnd = NaN;
            this.onSnapshotChanged = (snapshot, committedText) => {
                var _a;
                const target = this._activeTarget;
                if (!target)
                    return;
                this._snapshot = snapshot;
                if (!this._programmaticUpdate && !this._normalizingText) {
                    let normalized = this.validateTargetText(target, committedText);
                    if (target.maxChars > 0 && normalized.length > target.maxChars)
                        normalized = normalized.substring(0, target.maxChars);
                    if (normalized !== committedText) {
                        const previousText = this._lastCommittedText;
                        const caret = Math.min(normalized.length, snapshot.selectionEnd);
                        this._normalizingText = true;
                        try {
                            this._bridge.updateText(normalized, caret, caret);
                        }
                        finally {
                            this._normalizingText = false;
                        }
                        if (previousText !== this._lastCommittedText)
                            target.event(Laya.Event.INPUT);
                        return;
                    }
                }
                const committedTextChanged = committedText !== this._lastCommittedText;
                this.updateCanvasTargetText(target, snapshot.text);
                this._compositionTextExposed = this._bridge.editor.composing;
                if (committedTextChanged) {
                    this._lastCommittedText = committedText;
                    if (!this._programmaticUpdate && !this._normalizingText)
                        target.event(Laya.Event.INPUT);
                }
                (_a = this._visual) === null || _a === void 0 ? void 0 : _a.update(this._bridge.editor);
                this.ensureCaretVisible();
                this.resetCaretBlink();
                this.syncCaretRect();
            };
            this.onPlatformAction = (action) => {
                if (action === exports.NativeTextInputAction.Enter
                    || action === exports.NativeTextInputAction.Done
                    || action === exports.NativeTextInputAction.Search
                    || action === exports.NativeTextInputAction.Send)
                    this.submitSingleLine();
            };
            this._editInline = false;
            this._bridge = new NativeTextInputBridge(new DesktopNativeTextInputContext());
            this._bridge.onSnapshotChanged = this.onSnapshotChanged;
            this._bridge.onAction = this.onPlatformAction;
        }
        begin(target, fromTouchBegin) {
            this._beginFromPointer = !!fromTouchBegin;
            return super.begin(target, fromTouchBegin);
        }
        syncText() {
            const target = this._activeTarget;
            if (target && this._bridge.editor.composing) {
                this.updateCanvasTargetText(target, this._bridge.editor.displayText);
                this._compositionTextExposed = true;
            }
        }
        setText(value) {
            if (!this._bridge.editor.active)
                return;
            this._programmaticUpdate = true;
            try {
                this._bridge.updateText(value, value.length, value.length);
            }
            finally {
                this._programmaticUpdate = false;
            }
        }
        setSelection(startIndex, endIndex) {
            if (!this._bridge.editor.active) {
                this._pendingSelectionStart = startIndex;
                this._pendingSelectionEnd = endIndex;
                return;
            }
            this._bridge.updateSelection(startIndex, endIndex);
            this.resetCaretBlink();
        }
        onBegin() {
            const target = this.target;
            this._activeTarget = target;
            this._lastCommittedText = target.text;
            this._previousOverflow = target.overflow;
            if (target.overflow !== Laya.Text.SCROLL)
                target.overflow = Laya.Text.SCROLL;
            this._visual = new NativeTextInputVisual(target, this._lastCommittedText);
            this._visual.caretColor = target.color;
            target.on(Laya.Event.MOUSE_DOWN, this, this.onPointerDown);
            target.on(Laya.Event.DOUBLE_CLICK, this, this.onDoubleClick);
            Laya.ILaya.stage.on(Laya.Event.MOUSE_MOVE, this, this.onPointerMove);
            Laya.ILaya.stage.on(Laya.Event.MOUSE_UP, this, this.onPointerUp);
            Laya.ILaya.stage.on(Laya.Event.KEY_DOWN, this, this.onCanvasKeyDown);
            Laya.PAL.browser.on(Laya.Event.BLUR, this, this.onWindowBlur);
            Laya.PAL.browser.on(Laya.Event.FOCUS, this, this.onWindowFocus);
            Laya.PAL.browser.on(Laya.Event.RESIZE, this, this.onBrowserResize);
            Laya.ILaya.stage.on(Laya.Event.RESIZE, this, this.onViewportResize);
            Laya.ILaya.systemTimer.loop(500, this, this.toggleCaret);
            Laya.ILaya.systemTimer.frameLoop(1, this, this.syncCaretRect);
            let selection = this._lastCommittedText.length;
            let selectionEnd = selection;
            if (this._beginFromPointer) {
                const point = target.getMousePoint();
                selection = this._visual.getIndexAtPoint(point.x, point.y);
                selectionEnd = selection;
            }
            else if (Number.isFinite(this._pendingSelectionStart)) {
                selection = this._pendingSelectionStart;
                selectionEnd = Number.isFinite(this._pendingSelectionEnd)
                    ? this._pendingSelectionEnd
                    : selection;
            }
            this._beginFromPointer = false;
            this._pendingSelectionStart = NaN;
            this._pendingSelectionEnd = NaN;
            const snapshot = this._bridge.begin(this.createSessionConfig(target), this._lastCommittedText, selection, selectionEnd);
            this._snapshot = snapshot;
            this.resetCaretBlink();
            this.syncCaretRect();
            return Promise.resolve();
        }
        onCanShowKeyboard() {
            var _a;
            if ((_a = this.target) === null || _a === void 0 ? void 0 : _a.editable)
                this._bridge.showKeyboard();
            return Promise.resolve();
        }
        onEnd(target, _complete, _switching) {
            var _a;
            this._bridge.finishPendingComposition();
            this._bridge.end(exports.NativeTextInputEndPolicy.CommitComposition);
            target.off(Laya.Event.MOUSE_DOWN, this, this.onPointerDown);
            target.off(Laya.Event.DOUBLE_CLICK, this, this.onDoubleClick);
            Laya.ILaya.stage.off(Laya.Event.MOUSE_MOVE, this, this.onPointerMove);
            Laya.ILaya.stage.off(Laya.Event.MOUSE_UP, this, this.onPointerUp);
            Laya.ILaya.stage.off(Laya.Event.KEY_DOWN, this, this.onCanvasKeyDown);
            Laya.PAL.browser.off(Laya.Event.BLUR, this, this.onWindowBlur);
            Laya.PAL.browser.off(Laya.Event.FOCUS, this, this.onWindowFocus);
            Laya.PAL.browser.off(Laya.Event.RESIZE, this, this.onBrowserResize);
            Laya.ILaya.stage.off(Laya.Event.RESIZE, this, this.onViewportResize);
            Laya.ILaya.systemTimer.clear(this, this.toggleCaret);
            Laya.ILaya.systemTimer.clear(this, this.syncCaretRect);
            Laya.ILaya.systemTimer.clear(this, this.refreshAfterViewportResize);
            (_a = this._visual) === null || _a === void 0 ? void 0 : _a.dispose();
            if (target.overflow !== this._previousOverflow)
                target.overflow = this._previousOverflow;
            this._previousOverflow = null;
            this._compositionTextExposed = false;
            this._visual = null;
            this._snapshot = null;
            this._activeTarget = null;
            this._pointerSelecting = false;
            return Promise.resolve();
        }
        onCanvasKeyDown(event) {
            const target = this._activeTarget;
            const snapshot = this._snapshot;
            if (!target || !snapshot
                || snapshot.state === exports.NativeTextInputState.Suspended
                || snapshot.state === exports.NativeTextInputState.Inactive)
                return;
            const code = event.code;
            const clipboardCommand = event.ctrlKey && !event.altKey;
            if (clipboardCommand
                && (code === Laya.KeyCode.KeyA || code === Laya.KeyCode.KeyC || code === Laya.KeyCode.KeyV
                    || code === Laya.KeyCode.KeyX || code === Laya.KeyCode.KeyY || code === Laya.KeyCode.KeyZ)) {
                if (!target.editable && code !== Laya.KeyCode.KeyA && code !== Laya.KeyCode.KeyC) {
                    event.preventDefault();
                    return;
                }
                this._bridge.finishPendingComposition();
                const current = this._bridge.editor.snapshot();
                if (code === Laya.KeyCode.KeyA) {
                    this._bridge.updateSelection(0, -1);
                }
                else if (code === Laya.KeyCode.KeyC) {
                    this.copySelection(current.selectionStart, current.selectionEnd);
                }
                else if (code === Laya.KeyCode.KeyX) {
                    if (this.copySelection(current.selectionStart, current.selectionEnd)
                        && current.selectionStart !== current.selectionEnd)
                        this._bridge.insertText("");
                }
                else if (code === Laya.KeyCode.KeyZ) {
                    if (event.shiftKey)
                        this._bridge.redo();
                    else
                        this._bridge.undo();
                }
                else if (code === Laya.KeyCode.KeyY) {
                    this._bridge.redo();
                }
                else {
                    const text = this._bridge.getClipboardText();
                    if (text)
                        this._bridge.insertText(text);
                }
                event.preventDefault();
                this._verticalCaretX = NaN;
                this.resetCaretBlink();
                return;
            }
            if (!target.editable)
                return;
            if (this._bridge.editor.composing) {
                return;
            }
            let verticalMove = false;
            if (code === Laya.KeyCode.Backspace) {
                this._bridge.deleteAroundSelection(1, 0);
            }
            else if (code === Laya.KeyCode.Delete) {
                this._bridge.deleteAroundSelection(0, 1);
            }
            else if (code === Laya.KeyCode.ArrowLeft) {
                const index = snapshot.selectionStart !== snapshot.selectionEnd
                    ? snapshot.selectionStart
                    : Math.max(0, snapshot.selectionStart - 1);
                this._bridge.updateSelection(index, index);
            }
            else if (code === Laya.KeyCode.ArrowRight) {
                const index = snapshot.selectionStart !== snapshot.selectionEnd
                    ? snapshot.selectionEnd
                    : Math.min(this._bridge.editor.committedText.length, snapshot.selectionEnd + 1);
                this._bridge.updateSelection(index, index);
            }
            else if ((code === Laya.KeyCode.ArrowUp || code === Laya.KeyCode.ArrowDown) && target.multiline) {
                const movingUp = code === Laya.KeyCode.ArrowUp;
                const index = snapshot.selectionStart !== snapshot.selectionEnd
                    ? (movingUp ? snapshot.selectionStart : snapshot.selectionEnd)
                    : snapshot.selectionEnd;
                const caret = this._visual.getCaretRect(index);
                if (!Number.isFinite(this._verticalCaretX))
                    this._verticalCaretX = caret.x;
                const y = movingUp
                    ? caret.y - Math.max(1, target.leading + 1)
                    : caret.y + caret.height + 1;
                const nextIndex = this._visual.getIndexAtPoint(this._verticalCaretX, y);
                this._bridge.updateSelection(nextIndex, nextIndex);
                verticalMove = true;
            }
            else if (code === Laya.KeyCode.Home) {
                this._bridge.updateSelection(0, 0);
            }
            else if (code === Laya.KeyCode.End) {
                const index = this._bridge.editor.committedText.length;
                this._bridge.updateSelection(index, index);
            }
            else if (code === Laya.KeyCode.Enter) {
                if (target.multiline)
                    this._bridge.insertText("\n");
                else
                    this.submitSingleLine();
            }
            else {
                return;
            }
            event.preventDefault();
            if (!verticalMove)
                this._verticalCaretX = NaN;
            this.resetCaretBlink();
        }
        submitSingleLine() {
            const target = this._activeTarget;
            if (!target)
                return;
            this._enterEvent.setTo(Laya.Event.ENTER, target, target);
            target.event(Laya.Event.ENTER, this._enterEvent);
            if (!this._enterEvent._defaultPrevented && this._activeTarget === target)
                this.end();
        }
        onPointerDown(event) {
            const target = this._activeTarget;
            if (!target || !this._snapshot)
                return;
            if (target.editable) {
                if (this._bridge.editor.state === exports.NativeTextInputState.Suspended)
                    this._bridge.resume();
                this._bridge.showKeyboard();
            }
            if (!this._snapshot || this._snapshot.state === exports.NativeTextInputState.Inactive)
                return;
            this._pointerSelecting = true;
            this._verticalCaretX = NaN;
            const index = this.getIndexAtPointerEvent(event);
            this._selectionAnchor = index;
            this._bridge.updateSelection(index, index);
            this.resetCaretBlink();
        }
        onPointerMove(event) {
            if (!this._pointerSelecting || !this._snapshot)
                return;
            const index = this.getIndexAtPointerEvent(event);
            this._verticalCaretX = NaN;
            this._bridge.updateSelection(this._selectionAnchor, index);
            this.resetCaretBlink();
        }
        onPointerUp() {
            this._pointerSelecting = false;
        }
        onDoubleClick(event) {
            if (!this._activeTarget || !this._snapshot)
                return;
            this._bridge.finishPendingComposition();
            this._bridge.updateSelection(0, -1);
            this._pointerSelecting = false;
            this._verticalCaretX = NaN;
            event.preventDefault();
            this.resetCaretBlink();
        }
        getIndexAtPointerEvent(_event) {
            const target = this._activeTarget;
            const point = target.getMousePoint();
            return this._visual.getIndexAtPoint(point.x, point.y);
        }
        onWindowBlur() {
            if (this._bridge.editor.active)
                this._bridge.suspend();
        }
        onWindowFocus() {
            if (this._bridge.editor.state === exports.NativeTextInputState.Suspended)
                this._bridge.resume();
            this.invalidateCaretRect();
            Laya.ILaya.systemTimer.frameOnce(1, this, this.refreshAfterViewportResize);
        }
        onBrowserResize() {
            if (Laya.ILaya.stage.screenAdaptationEnabled) {
                Laya.ILaya.stage.event(Laya.Event.WILL_RESIZE);
                Laya.ILaya.stage.updateCanvasSize(true);
            }
            this.onViewportResize();
        }
        onViewportResize() {
            this._pointerSelecting = false;
            this.invalidateCaretRect();
            Laya.ILaya.systemTimer.clear(this, this.refreshAfterViewportResize);
            Laya.ILaya.systemTimer.frameOnce(1, this, this.refreshAfterViewportResize);
        }
        refreshAfterViewportResize() {
            var _a;
            if (!this._activeTarget || !this._snapshot)
                return;
            (_a = this._visual) === null || _a === void 0 ? void 0 : _a.update(this._bridge.editor);
            this.ensureCaretVisible();
            this.invalidateCaretRect();
            this.syncCaretRect();
        }
        toggleCaret() {
            var _a;
            this._caretVisible = !this._caretVisible;
            (_a = this._visual) === null || _a === void 0 ? void 0 : _a.setCaretVisible(this._caretVisible);
        }
        resetCaretBlink() {
            var _a;
            this._caretVisible = true;
            (_a = this._visual) === null || _a === void 0 ? void 0 : _a.setCaretVisible(true);
        }
        syncCaretRect() {
            const target = this._activeTarget;
            const snapshot = this._snapshot;
            if (!target || !snapshot
                || snapshot.state === exports.NativeTextInputState.Inactive
                || snapshot.state === exports.NativeTextInputState.Suspended)
                return;
            const caret = this._visual.getCaretRect(snapshot.selectionEnd);
            const transform = Laya.SpriteUtils.getTransformRelativeToWindow(target, caret.x, caret.y);
            const x = transform.x;
            const y = transform.y;
            const width = Math.max(1, Math.abs(transform.scaleX));
            const height = Math.max(1, caret.height * Math.abs(transform.scaleY));
            if (x === this._lastCaretX && y === this._lastCaretY
                && width === this._lastCaretWidth && height === this._lastCaretHeight)
                return;
            this._lastCaretX = x;
            this._lastCaretY = y;
            this._lastCaretWidth = width;
            this._lastCaretHeight = height;
            this._bridge.updateCaretRect({ x, y, width, height });
        }
        ensureCaretVisible() {
            var _a;
            const target = this._activeTarget;
            const snapshot = this._snapshot;
            if (!target || !snapshot || snapshot.state === exports.NativeTextInputState.Inactive)
                return;
            const padding = target.padding;
            const caret = this._visual.getCaretRect(snapshot.selectionEnd);
            const left = padding[3];
            const right = Math.max(left, target.width - padding[1] - 1);
            const top = padding[0];
            const bottom = Math.max(top, target.height - padding[2] - 1);
            let scrollX = target.scrollX;
            let scrollY = target.scrollY;
            if (caret.x < left)
                scrollX += caret.x - left;
            else if (caret.x > right)
                scrollX += caret.x - right;
            if (caret.y < top)
                scrollY += caret.y - top;
            else if (caret.y + caret.height > bottom)
                scrollY += caret.y + caret.height - bottom;
            let scrolled = false;
            if (scrollX !== target.scrollX) {
                target.scrollX = scrollX;
                scrolled = true;
            }
            if (scrollY !== target.scrollY) {
                target.scrollY = scrollY;
                scrolled = true;
            }
            if (scrolled)
                (_a = this._visual) === null || _a === void 0 ? void 0 : _a.refresh();
        }
        invalidateCaretRect() {
            this._lastCaretX = NaN;
            this._lastCaretY = NaN;
            this._lastCaretWidth = NaN;
            this._lastCaretHeight = NaN;
        }
        copySelection(start, end) {
            if (start === end)
                return false;
            const text = this._bridge.editor.committedText.substring(Math.min(start, end), Math.max(start, end));
            return this._bridge.setClipboardText(text);
        }
        createSessionConfig(target) {
            return {
                multiline: target.multiline,
                editable: target.editable,
                password: target.type === Laya.Input.TYPE_PASSWORD,
                wordWrap: target.wordWrap,
                inputType: target.type,
                action: this.getInputAction(target.confirmType),
                maxLength: target.maxChars <= 0 ? 1E5 : target.maxChars
            };
        }
        updateCanvasTargetText(target, value) {
            let normalized = value == null ? "" : String(value);
            if (!target.multiline)
                normalized = normalized.replace(/\r?\n/g, "");
            setCanvasText.call(target, normalized);
        }
        validateTargetText(target, value) {
            const adapterTarget = this.target;
            this.target = target;
            try {
                return this.validateText(value);
            }
            finally {
                this.target = adapterTarget;
            }
        }
        getInputAction(confirmType) {
            switch (confirmType) {
                case "next": return exports.NativeTextInputAction.Next;
                case "search": return exports.NativeTextInputAction.Search;
                case "go": return exports.NativeTextInputAction.Enter;
                case "send": return exports.NativeTextInputAction.Send;
                default: return exports.NativeTextInputAction.Done;
            }
        }
    }

    class NativeFontAdapter extends Laya.FontAdapter {
        loadFont(task) {
            let fontName = Laya.Utils.replaceFileExtension(Laya.Utils.getBaseName(task.url), "");
            return task.loader.fetch(task.url, "arraybuffer").then(data => {
                if (data)
                    Laya.PAL.g.registerFont(fontName, data);
                return { family: fontName };
            });
        }
    }
    Laya.PAL.register("font", NativeFontAdapter);

    class NativeVideoPlayer extends Laya.VideoPlayerBackend {
        constructor() {
            super(...arguments);
            this._loop = false;
            this._ended = false;
            this._muted = false;
            this._playbackRate = 1;
        }
        get loop() {
            return this._loop;
        }
        set loop(value) {
            this._loop = value;
            if (this.video)
                this.video.loop = value;
        }
        get ended() {
            return this._ended;
        }
        get currentTime() {
            if (this.video)
                return this.video.tell();
            return 0.0;
        }
        set currentTime(value) {
            if (this.video)
                this.video.seek(value * 1000);
        }
        get muted() {
            return this._muted;
        }
        set muted(value) {
            this._muted = value;
            if (this.video)
                this.video.muted = value;
        }
        get playbackRate() {
            return this._playbackRate;
        }
        set playbackRate(value) {
            this._playbackRate = value;
            if (this.video)
                this.video.playbackRate = value;
        }
        onLoad(url) {
            this._ended = false;
            if (this._loaded)
                this.video.destroy();
            this.video = Laya.PAL.g.createVideo(Object.assign({}, this.options, this.getNodeTransform(), {
                src: Laya.URL.postFormatURL(Laya.URL.formatURL(url)),
                autoplay: this._playing,
                loop: this._loop,
                muted: this._muted,
                playbackRate: this._playbackRate,
            }));
            this.video.onEnded(() => this._ended = true);
            this.video.onError((err) => {
                console.error("NativeVideoPlayer: " + Laya.getErrorMsg(err));
            });
            this.setLoaded();
        }
        onPlay() {
            this.video.play();
        }
        onPause() {
            this.video.pause();
        }
        onTransformChanged() {
            if (!this.video)
                return;
            let { x, y, width, height } = this.getNodeTransform();
            this.video.x = x;
            this.video.y = y;
            this.video.width = width;
            this.video.height = height;
        }
        onDestroy() {
            this.video.destroy();
        }
    }

    class NativeVideoTexture extends Laya.VideoTexture {
        constructor() {
            super();
            this._ended = false;
            this._waitFirstFrame = false;
            this.decoder = Laya.PAL.g.createVideoDecoder({
                type: "wemedia"
            });
            this.decoder.on("frame", (res) => {
                this._currentTime = res.pts / 1000;
                if (this._waitFirstFrame) {
                    this._waitFirstFrame = false;
                    if (!this._playing) {
                        this.render(true);
                        this.decoder.wait(true);
                    }
                }
            });
            this.decoder.on("ended", () => {
                if (this._loop)
                    this.decoder.stop().then(() => this.decoder.start(this._startOption));
                else {
                    this._ended = true;
                    this.event("ended");
                }
            });
        }
        get readyState() {
            return this._loaded ? 1 : 0;
        }
        get ended() {
            return this._ended;
        }
        get currentTime() {
            return this._currentTime;
        }
        set currentTime(value) {
            this.decoder.seek(value * 1000);
        }
        onLoad(url) {
            let src = this._source;
            this._ended = false;
            this._waitFirstFrame = false;
            if (this._loaded)
                this.decoder.stop();
            this._loaded = false;
            if (this._source !== src)
                return;
            this._startOption = {};
            this._startOption.source = Laya.URL.postFormatURL(Laya.URL.formatURL(url));
            if (Laya.Browser.isIOSHighPerformanceModePlus)
                this._startOption.videoDataType = 2;
            this.decoder.start(this._startOption).then((res) => {
                this.setLoaded(res.width, res.height, true);
                if (!this._playing)
                    this._waitFirstFrame = true;
            }).catch((err) => {
                console.warn("MgVideoTexture: " + err.message);
            });
        }
        onPlay() {
            this.decoder.wait(false);
        }
        onPause() {
            this.decoder.wait(true);
        }
        onStop() {
            this.decoder.stop();
        }
        onRender() {
            Laya.LayaGL.textureContext.setTextureImageData(this._texture, this.decoder, false, false);
            return true;
        }
        onDestroy() {
            this.decoder.remove();
        }
    }

    class NativeMediaAdapter extends Laya.MediaAdapter {
        init() {
            this.shortAudioClass = Laya.HTMLAudioChannel;
            this.longAudioClass = Laya.HTMLAudioChannel;
            this.videoPlayerClass = NativeVideoPlayer;
            this.videoTextureClass = NativeVideoTexture;
        }
    }
    Laya.PAL.register("media", NativeMediaAdapter);

    class NativeTextInputAdapter extends Laya.TextInputAdapter {
        constructor() {
            super();
            this._editInline = window.conchConfig.getOS() === "Conch-window";
            if (!this._editInline) {
                Laya.PAL.g.onKeyboardInput(this.onKeyboardInput.bind(this));
                Laya.PAL.g.onKeyboardConfirm(this.onKeyboardConfirm.bind(this));
                Laya.PAL.g.onKeyboardComplete(this.onKeyboardComplete.bind(this));
            }
        }
        setText(value) {
            Laya.PAL.g.updateKeyboard({ value });
        }
        onBegin() {
            if (!this._editInline)
                return Promise.resolve();
            this.showInputElement();
            let ele = this._visEle;
            let target = this.target;
            ele.setType(this.target.type);
            ele.setForbidEdit(!this.target.editable);
            ele.setMultiAble(target.multiline);
            if (target.bgColor)
                ele.setBgColor(target.bgColor);
            ele.maxLength = target.maxChars <= 0 ? 1E5 : target.maxChars;
            ele.value = target.text;
            ele.placeholder = target.localizedPrompt;
            let style = ele.style;
            style.fontFamily = target.realFont;
            style.color = target.color;
            style.fontSize = target.fontSize + 'px';
            style.whiteSpace = (target.wordWrap ? "pre-wrap" : "nowrap");
            style.lineHeight = (target.leading + target.fontSize) + "px";
            style.fontStyle = (target.italic ? "italic" : "normal");
            style.fontWeight = (target.bold ? "bold" : "normal");
            style.textAlign = target.align;
            style.padding = "0 0";
            style.direction = Laya.Text.RightToLeft ? "rtl" : "";
            this.setPromptColor();
            this.syncTransform();
            Laya.PAL.browser.on(Laya.Event.RESIZE, this, this._onResize);
            Laya.ILaya.stage.on(Laya.Event.RESIZE, this, this.syncTransform);
            return Promise.resolve();
        }
        _onResize() {
            if (Laya.ILaya.stage.screenAdaptationEnabled) {
                Laya.ILaya.stage.event(Laya.Event.WILL_RESIZE);
                Laya.ILaya.stage.updateCanvasSize(true);
            }
        }
        onCanShowKeyboard() {
            if (this._editInline)
                return super.onCanShowKeyboard();
            let target = this.target;
            if (!target.editable)
                return Promise.resolve();
            return new Promise((resolve, reject) => {
                Laya.PAL.g.showKeyboard({
                    defaultValue: target.text,
                    maxLength: target.maxChars <= 0 ? 1E5 : target.maxChars,
                    multiple: target.multiline,
                    confirmHold: true,
                    confirmType: target.confirmType,
                    keyboardType: 'text',
                    success: resolve,
                    fail: reject
                });
            });
        }
        onEnd(target, complete, switching) {
            if (!this._editInline) {
                if (complete || switching)
                    return Promise.resolve();
                return new Promise((resolve, reject) => {
                    Laya.PAL.g.hideKeyboard({ success: resolve, fail: reject });
                });
            }
            else {
                target.text = this._visEle.value;
                this._visEle.blur();
                this.hideInputElement();
                this._visEle = null;
                Laya.PAL.browser.off(Laya.Event.RESIZE, this, this._onResize);
                Laya.ILaya.stage.off(Laya.Event.RESIZE, this, this.syncTransform);
                return Promise.resolve();
            }
        }
        syncTransform() {
            let padding = this.target.padding;
            let { x, y, scaleX, scaleY } = Laya.SpriteUtils.getTransformRelativeToWindow(this.target, padding[3], padding[0]);
            let w = this.target.width - padding[1] - padding[3];
            let h = this.target.height - padding[0] - padding[2];
            this._visEle.setScale(scaleX, scaleY);
            this._visEle.setSize(w, h);
            this._visEle.setPos(x, y);
        }
        hideInputElement() {
            if (this._editInline)
                this._visEle.setPos(-10000, -10000);
        }
        onKeyboardInput(ev) {
            let str = this.validateText(ev.value);
            if (this.updateTargetText(str))
                this.target.event(Laya.Event.INPUT);
        }
        onKeyboardConfirm(ev) {
            if (!this.target)
                return;
            this.onKeyboardInput(ev);
            this.target.event(Laya.Event.ENTER);
            this.end();
        }
        onKeyboardComplete(ev) {
            this.end(true);
        }
    }
    Laya.PAL.register("textInput", DesktopNativeTextInputContext.isSupported()
        ? NativeCanvasTextInputAdapter
        : NativeTextInputAdapter);

    exports.DesktopNativeTextInputContext = DesktopNativeTextInputContext;
    exports.NativeBrowserAdapter = NativeBrowserAdapter;
    exports.NativeCanvasTextInputAdapter = NativeCanvasTextInputAdapter;
    exports.NativeFontAdapter = NativeFontAdapter;
    exports.NativeMediaAdapter = NativeMediaAdapter;
    exports.NativeTextEditor = NativeTextEditor;
    exports.NativeTextInputAdapter = NativeTextInputAdapter;
    exports.NativeTextInputBridge = NativeTextInputBridge;
    exports.NativeTextInputVisual = NativeTextInputVisual;
    exports.NativeTextLayout = NativeTextLayout;
    exports.NativeVideoPlayer = NativeVideoPlayer;
    exports.NativeVideoTexture = NativeVideoTexture;

})(window.Laya = window.Laya || {}, Laya);
