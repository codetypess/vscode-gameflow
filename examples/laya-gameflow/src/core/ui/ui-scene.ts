import { registerClassAlias } from "./class-alias";
import { UIView } from "./ui-view";

/** 场景层界面；是否遮住其他界面由外部管理器决定。 */
@registerClassAlias("UIScene")
@Laya.regClass()
@Laya.classInfo({ menu: "自定义UI", icon: "plugins/type-icons/node/Root.svg" })
export class UIScene<TArgs = unknown> extends UIView<TArgs> {
    private _fullscreen = false;

    @Laya.property({ type: Boolean, caption: "全屏", default: false })
    get fullscreen(): boolean {
        return this._fullscreen;
    }

    set fullscreen(value: boolean) {
        this.assertViewMutable();
        if (typeof value !== "boolean") {
            throw new TypeError("UIScene fullscreen must be a boolean");
        }
        this._fullscreen = value;
    }
}
