type SerializedEntry = Record<string, unknown>;

function rewriteRegisteredType(entry: SerializedEntry): void {
    const type = entry["_$type"];
    if (typeof type === "string") {
        const cls = Laya.ClassUtils.getClass(type);
        if (typeof cls === "function" && cls.name) {
            const namedClass = Laya.ClassUtils.getClass(cls.name);
            if (namedClass === cls) {
                entry["_$type"] = cls.name;
            }
        }
    }

    for (const key of ["_$child", "_$comp"] as const) {
        const children = entry[key];
        if (!Array.isArray(children)) {
            continue;
        }
        for (const child of children) {
            if (child && typeof child === "object") {
                rewriteRegisteredType(child as SerializedEntry);
            }
        }
    }
}

@IEditorEnv.regSceneHook()
class OnSavePrefab implements IEditorEnv.ISceneHook {
    onSaveScene(_scene: IEditorEnv.IMyScene, data: any): void {
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new TypeError("Scene serialization data must be an object");
        }
        rewriteRegisteredType(data as SerializedEntry);
    }
}
