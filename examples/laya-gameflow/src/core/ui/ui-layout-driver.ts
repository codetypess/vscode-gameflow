import { UIWidget } from "./ui-widget";

/**
 * 布局提交入口。当前阶段采用同步、显式根节点刷新；后续可以在这里加入脏根去重，
 * 不改变 UIWidget 的几何契约。
 */
export class UILayoutDriver {
    flush(root: UIWidget): void {
        if (!(root instanceof UIWidget)) {
            throw new TypeError("UILayoutDriver.flush requires a UIWidget root");
        }
        if (!root.parent) {
            throw new Error("UILayoutDriver.flush requires the root to be attached to a parent");
        }
        root.layout();
    }
}

export const uiLayoutDriver = new UILayoutDriver();
