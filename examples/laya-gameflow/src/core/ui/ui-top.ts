import { registerClassAlias } from "./class-alias";
import { UIView } from "./ui-view";

/** 顶层提示或浮层；具体层级由外部容器安排。 */
@registerClassAlias("UITop")
@Laya.regClass()
@Laya.classInfo({ menu: "自定义UI", icon: "plugins/type-icons/node/Root.svg" })
export class UITop<TArgs = unknown> extends UIView<TArgs> {}
