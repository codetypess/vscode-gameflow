/**
 * Registers a stable class-name alias without replacing Laya's script UUID
 * registration performed by `@Laya.regClass()`.
 */
export function registerClassAlias(alias: string): ClassDecorator {
    return (target) => {
        if (typeof alias !== "string" || alias.length === 0 || alias.trim() !== alias) {
            throw new TypeError("A class alias must be a non-empty string");
        }
        const className = alias;
        const registeredClass = Laya.ClassUtils.getClass(className);
        if (registeredClass && registeredClass.name !== target.name) {
            throw new Error(`Class name alias ${className} is already registered`);
        }
        Laya.ClassUtils.regClass(className, target);
    };
}
