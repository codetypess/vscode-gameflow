import { UIBox } from "../../../src/core/ui/ui-box";

type Scene = IEditorEnv.IMyScene;
type Navigation = IEditorEnv.INavigationManager & {
    onMouseUp(event: gui.Event, prepared?: boolean): void;
};

const patches = new WeakMap<Scene, { descriptor: PropertyDescriptor | undefined }>();
const scenes = new Set<WeakRef<Scene>>();
let manager: IEditorEnv.ISceneManager | null = null;
let navigationPatch: {
    target: Navigation;
    root: gui.EventDispatcher;
    original: Navigation["onMouseUp"];
    wrapper: Navigation["onMouseUp"];
    descriptor: PropertyDescriptor | undefined;
} | null = null;

/** 精确恢复扩展前的实例属性，继承方法则删除临时实例覆盖。 */
function restoreProperty(
    target: object,
    key: string,
    descriptor: PropertyDescriptor | undefined
): void {
    if (descriptor) {
        Object.defineProperty(target, key, descriptor);
    } else {
        Reflect.deleteProperty(target, key);
    }
}

/** 让自定义 UI 容器使用 IDE 自带的整体选择、双击进入和嵌套选择边界。 */
export class UIBoxSelection {
    @IEditorEnv.onLoad
    @IEditorEnv.onUserScriptsLoad
    static initialize(): void {
        if (Laya.LayaEnv.isPlaying) {
            return;
        }
        const currentManager = EditorEnv.sceneManager;
        const navigation = EditorEnv.navigationManager as Navigation;
        if (
            manager !== currentManager ||
            (navigationPatch && navigationPatch.target !== navigation)
        ) {
            UIBoxSelection.cleanup();
            manager = currentManager;
            manager.onSceneActivated.add(UIBoxSelection.install);
        }
        for (const scene of manager.scenes) {
            UIBoxSelection.install(scene);
        }
        if (!navigationPatch) {
            UIBoxSelection.installNavigation(navigation);
        }
    }

    /** 只在鼠标松开处理内将自定义组的空白选根操作改为取消选择。 */
    private static installNavigation(navigation: Navigation): void {
        const original = navigation.onMouseUp;
        if (typeof original !== "function") {
            throw new TypeError("UIBox selection requires navigation.onMouseUp to be a function");
        }
        const descriptor = Object.getOwnPropertyDescriptor(navigation, "onMouseUp");
        const root = gui.GRoot.inst;
        const wrapper: Navigation["onMouseUp"] = function (
            this: Navigation,
            event,
            prepared
        ): void {
            const scene = EditorEnv.sceneManager.activeScene;
            if (
                Laya.LayaEnv.isPlaying ||
                !this.mode2d ||
                event.input.button !== 0 ||
                !(scene.openedBox instanceof UIBox)
            ) {
                original.call(this, event, prepared);
                return;
            }
            const setSelection = scene.setSelection;
            const selectionDescriptor = Object.getOwnPropertyDescriptor(scene, "setSelection");
            scene.setSelection = function (
                this: Scene,
                ...args: Parameters<Scene["setSelection"]>
            ): void {
                const [nodes] = args;
                if (nodes.length === 1 && nodes[0] === this.prefabRootNode) {
                    this.clearSelection();
                } else {
                    setSelection.apply(this, args);
                }
            };
            try {
                original.call(this, event, prepared);
            } finally {
                restoreProperty(scene, "setSelection", selectionDescriptor);
            }
        };
        navigation.onMouseUp = wrapper;
        root.off("pointer_up", original, navigation);
        root.on("pointer_up", wrapper, navigation);
        navigationPatch = { target: navigation, root, original, wrapper, descriptor };
    }

    private static install(scene: Scene): void {
        if (Laya.LayaEnv.isPlaying || patches.has(scene)) {
            return;
        }
        const original = scene.isBox;
        if (typeof original !== "function") {
            throw new TypeError("UIBox selection requires scene.isBox to be a function");
        }
        const descriptor = Object.getOwnPropertyDescriptor(scene, "isBox");
        scene.isBox = function (this: Scene, node: IEditorEnv.IMyNode): boolean {
            if (!Laya.LayaEnv.isPlaying && node instanceof UIBox) {
                return true;
            }
            return original.call(this, node);
        };
        patches.set(scene, { descriptor });
        scenes.add(new WeakRef(scene));
    }

    @IEditorEnv.onUserScriptsUnload
    @IEditorEnv.onUnload
    static cleanup(): void {
        if (navigationPatch) {
            const { target, root, original, wrapper, descriptor } = navigationPatch;
            root.off("pointer_up", wrapper, target);
            restoreProperty(target, "onMouseUp", descriptor);
            root.on("pointer_up", original, target);
            navigationPatch = null;
        }
        if (manager) {
            manager.onSceneActivated.remove(UIBoxSelection.install);
            manager = null;
        }
        for (const reference of scenes) {
            const scene = reference.deref();
            if (!scene) {
                continue;
            }
            const patch = patches.get(scene)!;
            restoreProperty(scene, "isBox", patch.descriptor);
            patches.delete(scene);
        }
        scenes.clear();
    }
}
