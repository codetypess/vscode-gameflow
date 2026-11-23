import { UIList } from "../../../src/core/ui/ui-list";
import { UIWidget } from "../../../src/core/ui/ui-widget";
import { validateListItemSize } from "../../../src/core/ui/list-layout";
import { drawEditorViewportBorder } from "./ui-viewport-border";

const previews = new Map<UIList, UIListPreview>();

/** 只由 IDE 的 scene bundle 加载，游戏 bundle 不导入此扩展。 */
@IEditorEnv.customEditor(UIList)
export class UIListEditor extends IEditorEnv.CustomEditor {
    override onAwake(): void {
        const list = this.owner as UIList;
        if (Laya.LayaEnv.isPlaying || list.destroyed) {
            return;
        }
        previews.get(list)?.destroy();
        const preview = new UIListPreview(list);
        previews.set(list, preview);
        // UIPanel.addChild 会重定向到业务 content，辅助层必须绕过它。
        list._addChild(preview);
        preview.refresh();
    }

    @IEditorEnv.onUserScriptsUnload
    @IEditorEnv.onUnload
    static cleanup(): void {
        for (const preview of previews.values()) {
            preview.destroy();
        }
    }
}

class UIListPreview extends Laya.Sprite {
    private readonly _items = new Laya.Sprite();
    private readonly _border = new Laya.Sprite();
    private _snapshot: readonly unknown[] = [];
    private _dirty = true;
    private _building = false;

    constructor(private readonly _list: UIList) {
        super();
        this.name = "UIListEditorPreview";
        for (const node of [this, this._items, this._border]) {
            node.hideFlags = Laya.HideFlags.HideAndDontSave;
            node._setBit(Laya.NodeFlags.LOCK_BY_EDITOR, true);
            node.mouseEnabled = false;
        }
        this._border._setBit(Laya.NodeFlags.DISABLE_OUTER_CLIPPING, true);
        this._border._setBit(Laya.NodeFlags.ESCAPE_DRAWING_TO_TEXTURE, true);
        this.addChildren(this._items, this._border);
        Laya.timer.frameLoop(1, this, this.refresh);
    }

    refresh(): void {
        if (this.destroyed) {
            return;
        }
        if (Laya.LayaEnv.isPlaying || this._list.destroyed) {
            this.destroy();
            return;
        }
        if (Laya.SerializeUtil.isDeserializing) {
            return;
        }
        const list = this._list;
        if (this._border.visible !== list.showEditorBorder) {
            this._border.visible = list.showEditorBorder;
            EditorEnv.invalidateFrame();
        }
        const prefab = list.cellPrefab;
        const snapshot = [
            prefab,
            prefab instanceof Laya.PrefabImpl ? prefab.data : null,
            list.scrollType,
            list.wrapCount,
            list.gapX,
            list.gapY,
            list.width,
            list.height,
            list.content.x,
            list.content.y,
            list.content.width,
            list.content.height,
        ];
        if (
            !this._dirty &&
            snapshot.every((value, index) => Object.is(value, this._snapshot[index]))
        ) {
            return;
        }
        this._snapshot = snapshot;
        this._dirty = false;
        this._building = true;
        this._items.destroyChildren();
        try {
            this._drawBorder();
            const width = list.content.width;
            const height = list.content.height;
            this._items.pos(list.content.x, list.content.y);
            this._items.size(width, height);
            this._items.scrollRect =
                list.scrollType === Laya.ScrollType.None
                    ? (null as unknown as Laya.Rectangle)
                    : new Laya.Rectangle(0, 0, width, height);
            if (prefab && width > 0 && height > 0) {
                this._createItems(prefab, width, height);
            }
        } catch (error) {
            this._items.destroyChildren();
            throw error;
        } finally {
            this._building = false;
            EditorEnv.invalidateFrame();
        }
    }

    override onPreDestroy(): void {
        Laya.timer.clear(this, this.refresh);
        previews.delete(this._list);
        super.onPreDestroy();
    }

    private _createItems(prefab: Laya.Prefab, width: number, height: number): void {
        const vertical = this._list.scrollType !== Laya.ScrollType.Horizontal;
        const viewport = vertical ? height : width;
        const mainGap = vertical ? this._list.gapY : this._list.gapX;
        const crossGap = vertical ? this._list.gapX : this._list.gapY;
        let position = 0;
        while (position < viewport) {
            let lineSize = 0;
            let crossOffset = 0;
            for (let slot = 0; slot < this._list.wrapCount; slot++) {
                const node = this._createItem(prefab);
                node.layout();
                const size = vertical ? node.height : node.width;
                const crossSize = vertical ? node.width : node.height;
                validateListItemSize(size, mainGap);
                validateListItemSize(crossSize, crossGap);
                // 和运行态一样在自然布局后提交坐标，条目尺寸不受视口影响。
                node.applyLayoutPosition(
                    vertical ? crossOffset : position,
                    vertical ? position : crossOffset
                );
                crossOffset += crossSize + crossGap;
                if (!Number.isFinite(crossOffset)) {
                    throw new Error("UIList preview content size must be finite");
                }
                lineSize = Math.max(lineSize, size);
                node.on(Laya.Event.RESIZE, this, this._invalidate);
            }
            const step = lineSize + mainGap;
            if (!Number.isFinite(position + step) || position + step === position) {
                throw new Error("UIList preview cell step cannot advance to a finite position");
            }
            position += step;
        }
    }

    private _createItem(prefab: Laya.Prefab): UIWidget {
        const errors: unknown[] = [];
        const node: unknown = prefab.create(undefined, errors);
        if (errors.length || !(node instanceof UIWidget)) {
            if (node instanceof Laya.Node) {
                node.destroy();
            }
            throw new Error(
                errors.length
                    ? `UIList preview cellPrefab creation failed: ${errors.map(String).join("; ")}`
                    : "UIList preview cellPrefab root must be UIWidget"
            );
        }
        // 先接管节点，后续任意校验/布局失败都由 refresh 释放整批预览。
        node.hideFlags |= Laya.HideFlags.HideAndDontSave;
        node._setBit(Laya.NodeFlags.LOCK_BY_EDITOR, true);
        node.mouseEnabled = false;
        this._items.addChild(node);
        if (
            node.hasRelativeLayout ||
            node.scaleX !== 1 ||
            node.scaleY !== 1 ||
            node.rotation !== 0 ||
            node.pivotX !== 0 ||
            node.pivotY !== 0
        ) {
            throw new Error(
                "UIList preview cell root requires no relative constraints, unit scale, zero rotation and pivot"
            );
        }
        return node;
    }

    private _invalidate(): void {
        if (!this._building) {
            this._dirty = true;
        }
    }

    private _drawBorder(): void {
        const width = this._list.width;
        const height = this._list.height;
        this.size(width, height);
        drawEditorViewportBorder(this._border.graphics, width, height);
    }
}
