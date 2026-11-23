import { UIPanel } from "../../../src/core/ui/ui-panel";
import { UIWidget } from "../../../src/core/ui/ui-widget";
import { drawEditorViewportBorder } from "./ui-viewport-border";

const borders = new Map<UIWidget, UIWidgetBorder>();

/** 仅由 IDE 场景 bundle 加载，为 UIWidget 及派生节点提示完整矩形范围。 */
@IEditorEnv.customEditor(UIWidget)
export class UIWidgetEditor extends IEditorEnv.CustomEditor {
    override onAwake(): void {
        const widget = this.owner as UIWidget;
        // 面板和列表保留各自的辅助层，不叠加通用边框。
        if (Laya.LayaEnv.isPlaying || widget.destroyed || widget instanceof UIPanel) {
            return;
        }
        borders.get(widget)?.destroy();
        const border = new UIWidgetBorder(widget);
        borders.set(widget, border);
        widget._addChild(border);
        border.refresh();
    }

    @IEditorEnv.onUserScriptsUnload
    @IEditorEnv.onUnload
    static cleanup(): void {
        for (const border of borders.values()) {
            border.destroy();
        }
    }
}

class UIWidgetBorder extends Laya.Sprite {
    private _lastWidth = -1;
    private _lastHeight = -1;

    constructor(private readonly _widget: UIWidget) {
        super();
        this.name = "UIWidgetEditorBorder";
        this.hideFlags = Laya.HideFlags.HideAndDontSave;
        this._setBit(Laya.NodeFlags.LOCK_BY_EDITOR, true);
        this._setBit(Laya.NodeFlags.DISABLE_OUTER_CLIPPING, true);
        this._setBit(Laya.NodeFlags.ESCAPE_DRAWING_TO_TEXTURE, true);
        this._setBit(Laya.NodeFlags.ESCAPE_LAYOUT, true);
        this.mouseEnabled = false;
        Laya.timer.frameLoop(1, this, this.refresh);
    }

    refresh(): void {
        if (this.destroyed) {
            return;
        }
        if (Laya.LayaEnv.isPlaying || this._widget.destroyed) {
            this.destroy();
            return;
        }
        if (Laya.SerializeUtil.isDeserializing) {
            return;
        }
        if (this.visible !== this._widget.showEditorBorder) {
            this.visible = this._widget.showEditorBorder;
            EditorEnv.invalidateFrame();
        }
        const { width, height } = this._widget;
        if (width === this._lastWidth && height === this._lastHeight) {
            return;
        }
        this._lastWidth = width;
        this._lastHeight = height;
        this.size(width, height);
        drawEditorViewportBorder(this.graphics, width, height);
        EditorEnv.invalidateFrame();
    }

    override onPreDestroy(): void {
        Laya.timer.clear(this, this.refresh);
        borders.delete(this._widget);
        super.onPreDestroy();
    }
}
