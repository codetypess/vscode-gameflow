export type LayoutValue = number | null;

export type LayoutSizeSource = "explicit" | "measured" | "stretch";

export interface LayoutParentRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface LayoutAxisInput {
    position: number;
    size: number;
    scale: number;
    pivot: number;
    explicitSize: boolean;
    measure: () => number;
    center: LayoutValue;
    leading: LayoutValue;
    trailing: LayoutValue;
    parentStart: number;
    parentSize: number;
}

export interface LayoutAxisResult {
    position: number;
    size: number;
    source: LayoutSizeSource;
}

export interface LayoutNodeInput {
    x: number;
    y: number;
    width: number;
    height: number;
    scaleX: number;
    scaleY: number;
    pivotX: number;
    pivotY: number;
    widthSet: boolean;
    heightSet: boolean;
    measureWidth: () => number;
    measureHeight: () => number;
    left: LayoutValue;
    right: LayoutValue;
    centerX: LayoutValue;
    top: LayoutValue;
    bottom: LayoutValue;
    centerY: LayoutValue;
}

export interface LayoutNodeResult {
    x: number;
    y: number;
    width: number;
    height: number;
    widthSource: LayoutSizeSource;
    heightSource: LayoutSizeSource;
}

export class LayoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "LayoutError";
    }
}

function validateNumber(name: string, value: number): void {
    if (!Number.isFinite(value)) {
        throw new LayoutError(`${name} must be a finite number`);
    }
}

function validateConstraint(name: string, value: LayoutValue): void {
    if (value !== null) {
        validateNumber(name, value);
    }
}

function resolveSize(input: LayoutAxisInput): { size: number; source: LayoutSizeSource } {
    const hasStretch = input.leading !== null && input.trailing !== null;
    if (hasStretch) {
        const scale = input.scale === 0 ? 0.01 : input.scale;
        const size = (input.parentSize - input.leading! - input.trailing!) / scale;
        if (size < 0) {
            throw new LayoutError("leading and trailing constraints leave a negative size");
        }
        validateNumber("stretched size", size);
        return { size, source: "stretch" };
    }

    if (input.explicitSize) {
        validateNumber("explicit size", input.size);
        if (input.size < 0) {
            throw new LayoutError("explicit size must be non-negative");
        }
        return { size: input.size, source: "explicit" };
    }

    const size = input.measure();
    validateNumber("measured size", size);
    if (size < 0) {
        throw new LayoutError("measured size must be non-negative");
    }
    return { size, source: "measured" };
}

/**
 * Resolve one axis with the same priority as Laya's Widget:
 * center, leading edge, trailing edge, then the existing position.
 */
export function resolveLayoutAxis(input: LayoutAxisInput): LayoutAxisResult {
    validateNumber("position", input.position);
    validateNumber("size", input.size);
    validateNumber("scale", input.scale);
    validateNumber("pivot", input.pivot);
    validateNumber("parentStart", input.parentStart);
    validateNumber("parentSize", input.parentSize);
    if (input.parentSize < 0) {
        throw new LayoutError("parent size must be non-negative");
    }
    validateConstraint("center", input.center);
    validateConstraint("leading", input.leading);
    validateConstraint("trailing", input.trailing);

    const resolved = resolveSize(input);
    const displaySize = resolved.size * input.scale;
    let position = input.position;
    if (input.center !== null) {
        position = input.parentStart + (input.parentSize - displaySize) * 0.5 + input.center;
        position += input.pivot * input.scale;
    } else if (input.leading !== null) {
        position = input.parentStart + input.leading + input.pivot * input.scale;
    } else if (input.trailing !== null) {
        position =
            input.parentStart + input.parentSize - displaySize - input.trailing + input.pivot * input.scale;
    }
    validateNumber("resolved position", position);
    return { position: Math.round(position), size: resolved.size, source: resolved.source };
}

export function resolveLayout(input: LayoutNodeInput, parent: LayoutParentRect): LayoutNodeResult {
    const horizontal = resolveLayoutAxis({
        position: input.x,
        size: input.width,
        scale: input.scaleX,
        pivot: input.pivotX,
        explicitSize: input.widthSet,
        measure: input.measureWidth,
        center: input.centerX,
        leading: input.left,
        trailing: input.right,
        parentStart: parent.x,
        parentSize: parent.width,
    });
    const vertical = resolveLayoutAxis({
        position: input.y,
        size: input.height,
        scale: input.scaleY,
        pivot: input.pivotY,
        explicitSize: input.heightSet,
        measure: input.measureHeight,
        center: input.centerY,
        leading: input.top,
        trailing: input.bottom,
        parentStart: parent.y,
        parentSize: parent.height,
    });
    return {
        x: horizontal.position,
        y: vertical.position,
        width: horizontal.size,
        height: vertical.size,
        widthSource: horizontal.source,
        heightSource: vertical.source,
    };
}
