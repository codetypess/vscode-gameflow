import { UIList } from "../../../src/core/ui/ui-list";
import { UIPanel } from "../../../src/core/ui/ui-panel";
import { drawEditorViewportBorder } from "./ui-viewport-border";

const borders = new Map<UIPanel, UIPanelBorder>();

/** 仅在场景编辑器中显示面板范围，不参与运行时绘制或业务子节点。 */
@IEditorEnv.customEditor(UIPanel)
export class UIPanelEditor extends IEditorEnv.CustomEditor {
    override onAwake(): void {
        const panel = this.owner as UIPanel;
        // 列表拥有自己的预览和边框，不叠加父类的编辑器提示。
        if (Laya.LayaEnv.isPlaying || panel.destroyed || panel instanceof UIList) {
            return;
        }
        borders.get(panel)?.destroy();
        const border = new UIPanelBorder(panel);
        borders.set(panel, border);
        panel._addChild(border);
        const extra = panel._extra as { boxOpened?: boolean };
        border.setOpened(extra.boxOpened === true);
        border.refresh();
    }

    override onOpenBox(): void {
        if (!Laya.LayaEnv.isPlaying) {
            borders.get(this.owner as UIPanel)?.setOpened(true);
        }
    }

    override onCloseBox(): void {
        borders.get(this.owner as UIPanel)?.setOpened(false);
    }

    @IEditorEnv.onUserScriptsUnload
    @IEditorEnv.onUnload
    static cleanup(): void {
        for (const border of borders.values()) {
            border.destroy();
        }
    }
}

class UIPanelBorder extends Laya.Sprite {
    private _lastWidth = -1;
    private _lastHeight = -1;
    private readonly _mouseThrough: boolean;
    private _opened = false;
    private _clipping: { panel: boolean; content: boolean } | null = null;
    private readonly _scrollBars = new Map<Laya.ScrollBar, boolean>();

    constructor(private readonly _panel: UIPanel) {
        super();
        this._mouseThrough = _panel.content.mouseThrough;
        // IDE 命中遍历会跳过隐藏节点；穿透 content 才能选择其业务子节点。
        _panel.content.mouseThrough = true;
        this.name = "UIPanelEditorBorder";
        this.hideFlags = Laya.HideFlags.HideAndDontSave;
        this._setBit(Laya.NodeFlags.LOCK_BY_EDITOR, true);
        this._setBit(Laya.NodeFlags.DISABLE_OUTER_CLIPPING, true);
        this._setBit(Laya.NodeFlags.ESCAPE_DRAWING_TO_TEXTURE, true);
        this.mouseEnabled = false;
        Laya.timer.frameLoop(1, this, this.refresh);
    }

    setOpened(opened: boolean): void {
        const panel = this._panel;
        this._opened =
            !Laya.LayaEnv.isPlaying && (opened || panel._getBit(Laya.NodeFlags.EDITING_ROOT_NODE));
        if (this._opened) {
            this._clipping ??= {
                panel: panel._getBit(Laya.NodeFlags.DISABLE_INNER_CLIPPING),
                content: panel.content._getBit(Laya.NodeFlags.DISABLE_INNER_CLIPPING),
            };
            this._setClippingDisabled(panel, true);
            this._setClippingDisabled(panel.content, true);
            this._syncScrollBars();
        } else {
            this._restoreClipping();
        }
        EditorEnv.invalidateFrame();
    }

    refresh(): void {
        if (this.destroyed) {
            return;
        }
        if (Laya.LayaEnv.isPlaying || this._panel.destroyed) {
            this.destroy();
            return;
        }
        if (Laya.SerializeUtil.isDeserializing) {
            return;
        }
        if (this._opened) {
            this._syncScrollBars();
        }
        if (this.visible !== this._panel.showEditorBorder) {
            this.visible = this._panel.showEditorBorder;
            EditorEnv.invalidateFrame();
        }
        const { width, height } = this._panel;
        if (width === this._lastWidth && height === this._lastHeight) {
            return;
        }
        this._lastWidth = width;
        this._lastHeight = height;
        this.size(width, height);
        drawEditorViewportBorder(this.graphics, width, height);
        EditorEnv.invalidateFrame();
    }

    private _syncScrollBars(): void {
        const current = [this._panel.hScrollBar, this._panel.vScrollBar];
        for (const [bar, hidden] of this._scrollBars) {
            if (!current.includes(bar)) {
                if (!bar.destroyed) {
                    bar._setBit(Laya.NodeFlags.FORCE_HIDDEN, hidden);
                }
                this._scrollBars.delete(bar);
            }
        }
        for (const bar of current) {
            if (!bar) {
                continue;
            }
            if (!this._scrollBars.has(bar)) {
                this._scrollBars.set(bar, bar._getBit(Laya.NodeFlags.FORCE_HIDDEN));
            }
            bar._setBit(Laya.NodeFlags.FORCE_HIDDEN, true);
        }
    }

    private _restoreClipping(): void {
        const panel = this._panel;
        if (this._clipping) {
            if (!panel.destroyed) {
                this._setClippingDisabled(panel, this._clipping.panel);
            }
            if (!panel.content.destroyed) {
                this._setClippingDisabled(panel.content, this._clipping.content);
            }
            this._clipping = null;
        }
        for (const [bar, hidden] of this._scrollBars) {
            if (!bar.destroyed) {
                bar._setBit(Laya.NodeFlags.FORCE_HIDDEN, hidden);
            }
        }
        this._scrollBars.clear();
    }

    private _setClippingDisabled(sprite: Laya.Sprite, disabled: boolean): void {
        sprite._setBit(Laya.NodeFlags.DISABLE_INNER_CLIPPING, disabled);
        // IDE 临时替换渲染矩形；重新提交原视口，使 WebGL 重算缓存的裁剪矩阵。
        sprite._struct.setClipRect(sprite.scrollRect);
    }

    override onPreDestroy(): void {
        this._restoreClipping();
        if (!this._panel.content.destroyed) {
            this._panel.content.mouseThrough = this._mouseThrough;
        }
        Laya.timer.clear(this, this.refresh);
        borders.delete(this._panel);
        super.onPreDestroy();
    }
}
