/** 编辑器视口虚线；笔画完整落在视口内，避免右边和底边被裁剪。 */
export function drawEditorViewportBorder(
    graphics: Laya.Graphics,
    width: number,
    height: number
): void {
    graphics.clear();
    if (width <= 0 || height <= 0) {
        return;
    }
    const lineWidth = Math.min(1, width, height);
    // DrawLineCmd.run 对 1px 线自动加 0.5；抵消它后再向内缩半个像素。
    const offset = lineWidth === 1 ? 0.5 : 0;
    const start = lineWidth / 2 - offset;
    const right = width - lineWidth / 2 - offset;
    const bottom = height - lineWidth / 2 - offset;
    for (let x = start; x < right; x += 10) {
        const end = Math.min(x + 5, right);
        graphics.drawLine(x, start, end, start, "#000000", lineWidth);
        graphics.drawLine(x, bottom, end, bottom, "#000000", lineWidth);
    }
    for (let y = start; y < bottom; y += 10) {
        const end = Math.min(y + 5, bottom);
        graphics.drawLine(start, y, start, end, "#000000", lineWidth);
        graphics.drawLine(right, y, right, end, "#000000", lineWidth);
    }
}
