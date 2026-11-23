import { registerClassAlias } from "./class-alias";
import { UIWidget } from "./ui-widget";

export class UIImageBitmap extends Laya.AutoBitmap {
    private _circularFill: number | null = null;
    private _horizontalFillWidth: number | null = null;

    /** 横向进度的满宽；绘制宽度继续取 width，普通图只采样相应部分。 */
    setHorizontalFillWidth(width: number | null): void {
        if (width !== this._horizontalFillWidth) {
            this._horizontalFillWidth = width;
            this.invalidate();
        }
    }

    /** 临时的圆形填充；null 恢复普通图片和九宫格绘制，不进入节点序列化。 */
    setCircularFill(ratio: number | null): void {
        if (ratio !== this._circularFill) {
            this._circularFill = ratio;
            this.invalidate();
        }
    }

    override get source(): Laya.Texture {
        return super.source;
    }

    override set source(value: Laya.Texture) {
        if (!value) {
            this.clear(true);
        }
        super.source = value;
    }

    invalidate(): void {
        this._setChanged();
    }

    setRenderBounds(x: number, y: number, width: number | null, height: number | null): void {
        const offsetX = this._offset?.[0] ?? 0;
        const offsetY = this._offset?.[1] ?? 0;
        const offsetChanged = offsetX !== x || offsetY !== y;
        this._offset = [x, y];
        this.width = width as number;
        this.height = height as number;
        if (offsetChanged) {
            this._setChanged();
        }
    }

    protected override changeSource(): void {
        this._isChanged = false;
        this.clear(true);

        const sizeGrid = this.sizeGrid || this.source?._sizeGrid;
        const source = this.getRenderSource();
        if (!source || !source.bitmap || !this.owner) {
            return;
        }

        const width = this.width;
        const height = this.height;
        if (width <= 0 || height <= 0) {
            return;
        }
        if (this._circularFill !== null) {
            if (this._circularFill > 0) {
                this._drawCircular(source, width, height, this._circularFill);
            }
            return;
        }
        if (this._horizontalFillWidth !== null) {
            if (sizeGrid) {
                this.draw9Grid(source, 0, 0, width, height, sizeGrid, this.color);
            } else {
                this._drawHorizontal(source, width, height, this._horizontalFillWidth);
            }
            return;
        }
        if (!sizeGrid || (source.sourceWidth === width && source.sourceHeight === height)) {
            this.drawTexture(
                source,
                this._offset?.[0] ?? 0,
                this._offset?.[1] ?? 0,
                width,
                height,
                null,
                1,
                this.color,
                null,
                this.uv ?? undefined
            );
        } else {
            this.draw9Grid(source, 0, 0, width, height, sizeGrid, this.color);
        }
    }

    private _drawHorizontal(
        source: Laya.Texture,
        width: number,
        height: number,
        fullWidth: number
    ): void {
        // 保留图集裁掉的透明边及整图映射比例，只截取进度范围内的几何。
        const textureX = (source.offsetX * fullWidth) / source.sourceWidth;
        const textureY = (source.offsetY * height) / source.sourceHeight;
        const textureWidth = (source.width * fullWidth) / source.sourceWidth;
        const textureHeight = (source.height * height) / source.sourceHeight;
        const left = Math.max(0, textureX);
        const top = Math.max(0, textureY);
        const right = Math.min(width, textureX + textureWidth);
        const bottom = Math.min(height, textureY + textureHeight);
        if (right <= left || bottom <= top) {
            return;
        }
        this._drawMesh(
            source,
            [left, top, right, top, right, bottom, left, bottom],
            textureX,
            textureY,
            textureWidth,
            textureHeight
        );
    }

    private _drawCircular(
        source: Laya.Texture,
        width: number,
        height: number,
        ratio: number
    ): void {
        const centerX = width / 2;
        const centerY = height / 2;
        const cornerAngle = Math.atan2(centerX, centerY);
        const cornerAngles = [
            cornerAngle,
            Math.PI - cornerAngle,
            Math.PI + cornerAngle,
            Math.PI * 2 - cornerAngle,
        ];
        const corners = [width, 0, width, height, 0, height, 0, 0];
        const angle = Math.PI * 2 * ratio;
        const points = [centerX, centerY, centerX, 0];
        for (let index = 0; index < cornerAngles.length; index++) {
            if (cornerAngles[index] < angle) {
                points.push(corners[index * 2], corners[index * 2 + 1]);
            }
        }
        if (ratio === 1) {
            points.push(centerX, 0);
        } else {
            const directionX = Math.sin(angle);
            const directionY = -Math.cos(angle);
            const scale = Math.min(
                directionX === 0 ? Infinity : centerX / Math.abs(directionX),
                directionY === 0 ? Infinity : centerY / Math.abs(directionY)
            );
            points.push(centerX + directionX * scale, centerY + directionY * scale);
        }

        this._drawMesh(source, points, 0, 0, width, height);
    }

    private _drawMesh(
        source: Laya.Texture,
        points: number[],
        textureX: number,
        textureY: number,
        textureWidth: number,
        textureHeight: number
    ): void {
        const vertices = new Float32Array(points);
        const uvs = new Float32Array(points.length);
        const indices = new Uint16Array((points.length / 2 - 2) * 3);
        const sourceUV = this.uv ?? source.uv;
        for (let index = 0; index < points.length; index += 2) {
            const x = (points[index] - textureX) / textureWidth;
            const y = (points[index + 1] - textureY) / textureHeight;
            // 四角插值也适用于图集中的旋转 UV。
            for (let axis = 0; axis < 2; axis++) {
                uvs[index + axis] =
                    sourceUV[axis] * (1 - x) * (1 - y) +
                    sourceUV[2 + axis] * x * (1 - y) +
                    sourceUV[4 + axis] * x * y +
                    sourceUV[6 + axis] * (1 - x) * y;
            }
        }
        for (let index = 0; index < indices.length / 3; index++) {
            indices.set([0, index + 1, index + 2], index * 3);
        }
        this.drawTriangles(
            source,
            this._offset?.[0] ?? 0,
            this._offset?.[1] ?? 0,
            vertices,
            uvs,
            indices,
            null,
            1,
            this.color
        );
    }

    protected getRenderSource(): Laya.Texture | null {
        let source = this.source;
        if (!source) {
            return null;
        }

        let stateIndex = this._stateIndex;
        if (stateIndex === null || stateIndex === undefined) {
            const stateNum = source._stateNum || this._stateNum || 1;
            if (!(stateNum > 1)) {
                return source;
            }
            stateIndex = 0;
        }

        const stateNum = source._stateNum || this._stateNum || 1;
        if (stateNum === 1) {
            stateIndex = 0;
        } else if (stateNum === 2) {
            stateIndex = stateIndex === 2 ? 1 : 0;
        } else if (stateNum === 3 && stateIndex === 3) {
            stateIndex = 0;
        }

        const stateHeight = source.sourceHeight / stateNum;
        source = source.getCachedClip(0, stateHeight * stateIndex, source.sourceWidth, stateHeight);
        return source ?? null;
    }
}

/** 图片原子控件；支持图片地址加载和纹理直接注入。 */
@registerClassAlias("UIImage")
@Laya.regClass()
@Laya.classInfo({
    menu: "自定义UI",
    icon: "plugins/type-icons/node/Image.svg",
})
export class UIImage extends UIWidget {
    protected readonly _bitmap: UIImageBitmap;
    private _skin = "";
    private _useSourceSize = false;
    private _settingSourceSize = false;

    constructor() {
        super();
        this._bitmap = this.createBitmap();
        this.setGraphics(this._bitmap, true);
    }

    protected createBitmap(): UIImageBitmap {
        return new UIImageBitmap();
    }

    @Laya.property({
        type: String,
        default: "",
        inspector: "asset",
        isAsset: true,
        assetTypeFilter: "Image",
    })
    get skin(): string {
        return this._skin;
    }

    set skin(value: string) {
        if (typeof value !== "string") {
            throw new TypeError("UIImage skin must be a string");
        }
        if (this.destroyed) {
            throw new Error("Cannot set UIImage skin after destroy");
        }
        if (value !== "" && this._skin === value) {
            return;
        }
        this._skin = value;
        if (value === "") {
            this.texture = null as unknown as Laya.Texture;
            return;
        }

        const cached: unknown = Laya.loader.getRes(value, Laya.Loader.IMAGE);
        if (cached !== null && cached !== undefined) {
            this._applySkinTexture(cached, value);
            return;
        }
        void Laya.loader.load(value, Laya.Loader.IMAGE).then(
            (texture: unknown) => {
                if (value === this._skin && !this.destroyed) {
                    this._applySkinTexture(texture, value);
                }
            },
            (reason: unknown) => {
                if (value === this._skin && !this.destroyed) {
                    this._reportSkinError(value, reason);
                }
            }
        );
    }

    override get texture(): Laya.Texture {
        return this._bitmap.source;
    }

    override set texture(value: Laya.Texture) {
        this._bitmap.source = value;
        if (this._useSourceSize && value) {
            this._setSourceSize(value);
        } else {
            this._syncBitmapSize();
        }
        this.pivot(this._anchorX * this.width, this._anchorY * this.height);
        this.repaint();
        this.requestLayout();
    }

    @Laya.property({
        type: String,
        default: "#ffffff",
        inspector: "color",
        showAlpha: false,
    })
    get color(): string {
        return this._bitmap.color;
    }

    set color(value: string) {
        this._bitmap.color = value;
    }

    @Laya.property({
        type: Boolean,
        default: false,
    })
    get useSourceSize(): boolean {
        return this._useSourceSize;
    }

    set useSourceSize(value: boolean) {
        if (this._useSourceSize === value) {
            return;
        }
        if (value && this.texture) {
            this._setSourceSize(this.texture);
        }
        this._useSourceSize = value;
    }

    protected override _transChanged(kind: Laya.TransformKind): void {
        super._transChanged(kind);
        if ((kind & (Laya.TransformKind.Width | Laya.TransformKind.Height)) !== 0) {
            if (!this._settingSourceSize && !Laya.SerializeUtil?.isDeserializing) {
                this._useSourceSize = false;
            }
            this._syncBitmapSize();
        }
    }

    protected override measureWidth(): number {
        return this._bitmap.width;
    }

    protected override measureHeight(): number {
        return this._bitmap.height;
    }

    private _applySkinTexture(texture: unknown, url: string): void {
        if (!(texture instanceof Laya.Texture)) {
            this._reportSkinError(url, new TypeError("Image loader did not return a Texture"));
            return;
        }
        this.texture = texture;
        this.event(Laya.Event.LOADED);
    }

    private _reportSkinError(url: string, reason: unknown): void {
        this.texture = null as unknown as Laya.Texture;
        const error = new Error(`UIImage failed to load skin "${url}": ${String(reason)}`);
        console.error(error, reason);
        this.event(Laya.Event.ERROR, error);
    }

    protected _syncBitmapSize(): void {
        this._setBitmapRenderBounds(
            0,
            0,
            this._isWidthSet ? super.width : null,
            this._isHeightSet ? super.height : null
        );
    }

    protected _setBitmapRenderBounds(
        x: number,
        y: number,
        width: number | null,
        height: number | null
    ): void {
        this._bitmap.setRenderBounds(x, y, width, height);
    }

    private _setSourceSize(texture: Laya.Texture): void {
        this._settingSourceSize = true;
        try {
            const stateNum = texture._stateNum || 1;
            const height = stateNum > 1 ? texture.sourceHeight / stateNum : texture.sourceHeight;
            this.size(texture.sourceWidth, height);
        } finally {
            this._settingSourceSize = false;
        }
    }
}
