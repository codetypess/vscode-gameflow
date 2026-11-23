import { registerClassAlias } from "./class-alias";
import { UIBox } from "./ui-box";

/** 界面根节点；提供参数和动画接口，显隐直接使用 visible。 */
@registerClassAlias("UIView")
@Laya.regClass()
@Laya.classInfo({ menu: "自定义UI", icon: "plugins/type-icons/node/Root.svg" })
export class UIView<TArgs = unknown> extends UIBox {
    private _disposing = false;

    public args: TArgs | undefined = undefined;

    /** 外部显式调用；子类可用 Laya.Tween 覆盖，完成时调用 complete。 */
    animateIn(complete: () => void): void {
        this.assertViewMutable();
        complete();
    }

    animateOut(complete: () => void): void {
        this.assertViewMutable();
        complete();
    }

    override onPreDestroy(): void {
        this._disposing = true;
        this.args = undefined;
        super.onPreDestroy();
    }

    /** 派生界面的运行时配置也遵守相同销毁边界。 */
    protected assertViewMutable(): void {
        if (this.destroyed || this._disposing) {
            throw new Error("Cannot change UIView during or after destroy");
        }
    }
}
