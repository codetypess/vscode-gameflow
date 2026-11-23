import type { UIBackdropBlur } from "./ui-backdrop-blur";

/** 当前引擎 WebGL 实例级适配；不修改全局渲染器。 */
export interface BackdropContext extends Laya.IRenderContext2D {
    resetFastState(): void;
}

interface BackdropElement extends Laya.IRenderElement2D {
    _prepare(context: BackdropContext): void;
    _render(context: BackdropContext): void;
}

interface BackdropFrame {
    stats: Laya.IStaticsContext;
    target: Laya.InternalRenderTarget | null;
    width: number;
    height: number;
    format: Laya.RenderTargetFormat;
}

/** 每个渲染目标及统计上下文独立持有资源，避免 IDE 辅助帧与游戏帧互相重建。 */
export class BackdropBlurRenderer extends Laya.Mesh2DRender {
    private _backdrop: UIBackdropBlur | null = null;
    private _stats!: Laya.IStaticsContext;
    private readonly _resources: BackdropBlurResources[] = [];
    private _primary: BackdropBlurResources | null = null;
    private readonly _quadSize = new Laya.Vector2();

    constructor() {
        super();
        this.runInEditor = true;
    }

    static assertWebGL(): void {
        const gl: unknown = Laya.LayaGL.renderEngine?._context;
        if (!gl || typeof (gl as WebGLRenderingContext).copyTexSubImage2D !== "function") {
            throw new Error("UIBackdropBlur requires the WebGL renderer");
        }
    }

    initialize(backdrop: UIBackdropBlur): void {
        this._backdrop = backdrop;
        this._stats = Laya.LayaGL.statAgent;
        createBackdropShaders();
        this.useUnitQuad = true;
        this.size = this._quadSize.setValue(backdrop.width, backdrop.height);
        const element = this._getRenderElements()[0] as BackdropElement;
        const prepare = element._prepare;
        const render = element._render;
        if (typeof prepare !== "function" || typeof render !== "function") {
            throw new Error("UIBackdropBlur requires WebGL element _prepare/_render");
        }
        element.noBatch = true;
        // Laya 会先 prepare 全部元素；抓屏必须延迟到本元素真正绘制时。
        element._prepare = () => {};
        element._render = (context) => {
            if (!backdrop.effectEnabled || backdrop.width === 0 || backdrop.height === 0) {
                return;
            }
            const frame = this._getFrame(context);
            const resources = this._getResources(frame);
            const once = Laya.LayaEnv.isPlaying && backdrop.updateMode === "once";
            if (!once || !resources.hasSnapshot) {
                this._captureAndBlur(context, frame);
            }
            const material = resources.material;
            material.setDefine(Laya.Shader3D.getDefineByName("BACKDROP_ONCE"), once);
            material.setVector2("u_FrameSize", this._quadSize.setValue(frame.width, frame.height));
            if (this.sharedMaterial !== material) {
                this.sharedMaterial = material;
            }
            prepare.call(element, context);
            render.call(element, context);
            if (once && resources.snapshotNeedsNotice) {
                resources.snapshotNeedsNotice = false;
                // 辅助帧不能让业务提前隐藏尚未被游戏帧抓取的背景。
                if (frame.stats === this._stats) {
                    backdrop._queueSnapshotReady();
                }
            }
        };
    }

    get hasSnapshot(): boolean {
        return this._primary?.hasSnapshot === true;
    }

    requestSnapshot(): void {
        for (const resources of this._resources) {
            resources.snapshotDirty = true;
            resources.snapshotNeedsNotice = false;
        }
    }

    clearSnapshot(): void {
        for (const resources of this._resources) {
            withBackdropStats(resources.stats, () => resources.releaseTargets());
        }
    }

    override getRenderUpdateMode(): boolean {
        return true;
    }

    override renderUpdate(context: Laya.IRenderContext2D): void {
        super.renderUpdate(context);
        if (this._backdrop) {
            this.size = this._quadSize.setValue(this._backdrop.width, this._backdrop.height);
        }
    }

    private _getFrame(context: BackdropContext): BackdropFrame {
        const target = context.getRenderTarget();
        const gl = Laya.LayaGL.renderEngine._context as WebGLRenderingContext;
        let width: number;
        let height: number;
        let format: Laya.RenderTargetFormat;
        if (target === null) {
            width = gl.drawingBufferWidth;
            height = gl.drawingBufferHeight;
            format = gl.getContextAttributes()!.alpha
                ? Laya.RenderTargetFormat.R8G8B8A8
                : Laya.RenderTargetFormat.R8G8B8;
        } else {
            const texture = target._textures?.[0] as
                (Laya.InternalTexture & { target: number }) | undefined;
            if (
                target._isCube !== false ||
                target._samples !== 1 ||
                target._textures?.length !== 1 ||
                !texture ||
                texture.target !== gl.TEXTURE_2D ||
                texture.useSRGBLoad ||
                (target.colorFormat !== Laya.RenderTargetFormat.R8G8B8 &&
                    target.colorFormat !== Laya.RenderTargetFormat.R8G8B8A8)
            ) {
                throw new Error(
                    "UIBackdropBlur requires a single-sample 2D RGB8/RGBA8 color target"
                );
            }
            width = texture.width;
            height = texture.height;
            format = target.colorFormat;
        }
        if (
            !Number.isSafeInteger(width) ||
            !Number.isSafeInteger(height) ||
            width < 1 ||
            height < 1
        ) {
            throw new Error("UIBackdropBlur requires a non-empty integer-sized color target");
        }
        return { target, width, height, format, stats: Laya.LayaGL.statAgent };
    }

    private _getResources(frame: BackdropFrame): BackdropBlurResources {
        let resources = this._resources.find(
            (value) => value.target === frame.target && value.stats === frame.stats
        );
        if (!resources) {
            resources = new BackdropBlurResources(frame.target, frame.stats);
            this._resources.push(resources);
        }
        // 先绑定本次有效目标的材质，再销毁旧目标；引擎不接受 null 材质。
        if (this.sharedMaterial !== resources.material) {
            this.sharedMaterial = resources.material;
        }
        for (let i = this._resources.length - 1; i >= 0; i--) {
            const retired = this._resources[i];
            if (retired.target !== null && retired.target._textures === null) {
                retired.destroy();
                this._resources.splice(i, 1);
                if (this._primary === retired) {
                    this._primary = null;
                }
            }
        }
        if (frame.stats === this._stats) {
            this._primary = resources;
        }
        return resources;
    }

    private _captureAndBlur(context: BackdropContext, frame = this._getFrame(context)): void {
        this._getResources(frame).captureAndBlur(context, frame, this._backdrop!);
    }

    override _onDestroy(): void {
        this.clearSnapshot();
        const elements = this._getRenderElements().slice();
        withBackdropStats(this._stats, () => {
            super._onDestroy();
            for (const element of elements) {
                element.destroy();
            }
        });
        for (const resources of this._resources) {
            resources.destroy();
        }
        this._resources.length = 0;
        this._primary = null;
        this._backdrop = null;
    }
}

/** 仅在同步资源释放期间切回创建者的统计对象，始终恢复调用方上下文。 */
function withBackdropStats<T>(stats: Laya.IStaticsContext, action: () => T): T {
    const previous = Laya.LayaGL.statAgent;
    try {
        Laya.LayaGL.statAgent = stats;
        return action();
    } finally {
        Laya.LayaGL.statAgent = previous;
    }
}

class BackdropBlurResources {
    readonly material: Laya.Material;
    readonly command = new Laya.CommandBuffer2D("UIBackdropBlur");
    capture: Laya.RenderTexture2D | null = null;
    down: Laya.RenderTexture2D[] = [];
    up: Laya.RenderTexture2D[] = [];
    output: Laya.RenderTexture2D | null = null;
    steps: Laya.ShaderData[] = [];
    mixStep: Laya.ShaderData | null = null;
    plan: BackdropBlurPlan | null = null;
    radius = -1;
    sampleScale = 0;
    snapshot: Laya.RenderTexture2D | null = null;
    snapshotDirty = true;
    snapshotNeedsNotice = false;
    private readonly viewport = new Laya.Vector4();
    private readonly frameSize = new Laya.Vector2();

    constructor(
        readonly target: Laya.InternalRenderTarget | null,
        readonly stats: Laya.IStaticsContext
    ) {
        const material = (this.material = new Laya.Material());
        material.setShaderName("BackdropDisplay");
        material.depthWrite = false;
        material.depthTest = Laya.RenderState.DEPTHTEST_OFF;
        material.cull = Laya.RenderState.CULL_NONE;
        material.blend = Laya.RenderState.BLEND_DISABLE;
    }

    get hasSnapshot(): boolean {
        return this.snapshot !== null && !this.snapshotDirty;
    }

    captureAndBlur(context: BackdropContext, frame: BackdropFrame, backdrop: UIBackdropBlur): void {
        const { target, width, height, format } = frame;
        context.getOffscreenView(this.viewport);
        const passData = context.passData;
        const invertY = context.invertY;
        const pipeline = context.pipelineMode;
        try {
            this.ensureTargets(width, height, format, backdrop.downsample, backdrop.blurRadius);
            // 分配 RT 可能改变 framebuffer 绑定，复制前显式恢复当前目标。
            // 引擎以 null 表示主屏幕，声明未包含 null。
            context.setRenderTarget(target!, false, Laya.Color.BLACK);
            Laya.LayaGL.renderEngine.copySubFrameBuffertoTex(
                this.capture!._texture,
                0,
                0,
                0,
                0,
                0,
                width,
                height
            );
            let output = this.capture!;
            if (backdrop.blurRadius > 0) {
                this.command.apply(true, false);
                output = this.output!;
            }
            if (Laya.LayaEnv.isPlaying && backdrop.updateMode === "once") {
                output = this.resolveSnapshot(output, width, height);
            }
            this.material.setTexture("u_Backdrop", output);
            this.material.setTexture("u_Original", this.capture!);
            this.material.setVector2("u_FrameSize", this.frameSize.setValue(width, height));
        } finally {
            context.passData = passData;
            context.pipelineMode = pipeline;
            context.invertY = invertY;
            const view = this.viewport;
            context.setOffscreenView(view.z, view.w, view.x, view.y);
            context.setRenderTarget(target!, false, Laya.Color.BLACK);
            context.resetFastState();
        }
    }

    private resolveSnapshot(
        source: Laya.RenderTexture2D,
        width: number,
        height: number
    ): Laya.RenderTexture2D {
        const target = this.createTarget(width, height);
        const mix = this.plan!.screenMix;
        try {
            this.command.clear();
            const data = this.addPass(
                source,
                target,
                createBackdropShaders().resolve,
                this.capture!
            );
            data.setNumber(Laya.Shader3D.propertyNameToID("u_LevelMix"), mix);
            this.command.apply(true, false);
        } catch (error) {
            target.destroy();
            throw error;
        } finally {
            this.releaseBlurTargets();
        }
        this.snapshot?.destroy();
        this.snapshot = target;
        this.snapshotDirty = false;
        this.snapshotNeedsNotice = true;
        return target;
    }

    private ensureTargets(
        width: number,
        height: number,
        format: Laya.RenderTargetFormat,
        scale: number,
        radius: number
    ): void {
        if (
            this.capture?.width !== width ||
            this.capture.height !== height ||
            this.capture._renderTarget.colorFormat !== format
        ) {
            this.releaseTargets();
            // WebGL2 复制要求源/目的颜色格式一致，不能用默认画布格式推断 RT。
            this.capture = this.createTarget(width, height, format);
        }
        if (this.radius === radius && this.sampleScale === scale) {
            return;
        }
        const plan = planBackdropBlur(width, height, radius, scale);
        if (
            !this.plan ||
            this.plan.sizes.length !== plan.sizes.length ||
            this.plan.baseLevel !== plan.baseLevel
        ) {
            this.releaseBlurTargets();
            const shaders = createBackdropShaders();
            let source = this.capture;
            for (let level = 1; level < plan.sizes.length; level++) {
                const size = plan.sizes[level];
                const target = this.createTarget(size.width, size.height);
                this.down.push(target);
                this.addPass(source, target, shaders.down);
                source = target;
            }
            // 独立的升采样目标，绝不采样当前正在写入的纹理。
            for (let level = plan.sizes.length - 2; level >= plan.baseLevel; level--) {
                const size = plan.sizes[level];
                const target = this.createTarget(size.width, size.height);
                this.up.push(target);
                const original = level === 0 ? this.capture : this.down[level - 1];
                const data = this.addPass(source, target, shaders.up, original);
                if (this.up.length === 1) {
                    this.mixStep = data;
                }
                source = target;
            }
            this.output = source;
        }
        this.mixStep?.setNumber(Laya.Shader3D.propertyNameToID("u_LevelMix"), plan.levelMix);
        this.material.setFloat("u_BlurMix", plan.screenMix);
        this.plan = plan;
        this.sampleScale = scale;
        this.radius = radius;
    }

    private createTarget(
        width: number,
        height: number,
        format = Laya.RenderTargetFormat.R8G8B8A8
    ): Laya.RenderTexture2D {
        const rt = new Laya.RenderTexture2D(width, height, format, Laya.RenderTargetFormat.None);
        rt.filterMode = Laya.FilterMode.Bilinear;
        rt.wrapModeU = rt.wrapModeV = Laya.WrapMode.Clamp;
        return rt;
    }

    private addPass(
        source: Laya.RenderTexture2D,
        target: Laya.RenderTexture2D,
        shader: Laya.Shader3D,
        original?: Laya.RenderTexture2D
    ): Laya.ShaderData {
        const data = Laya.LayaGL.renderDeviceFactory.createShaderData();
        data.setVector2(
            Laya.Shader3D.propertyNameToID("u_Texel"),
            new Laya.Vector2(1 / source.width, 1 / source.height)
        );
        data.setNumber(Laya.Shader3D.propertyNameToID("u_LevelMix"), 1);
        if (original) {
            data.setTexture(Laya.Shader3D.propertyNameToID("u_LevelOriginal"), original);
        }
        this.steps.push(data);
        this.command.blitTextureQuad(source, target, undefined, shader, data);
        return data;
    }

    private releaseBlurTargets(): void {
        this.material.setTexture("u_Backdrop", null!);
        this.command.clear();
        for (const data of this.steps) {
            data.destroy();
        }
        this.steps.length = 0;
        for (const rt of [...this.down, ...this.up]) {
            rt.destroy();
        }
        this.down.length = this.up.length = 0;
        this.mixStep = null;
        this.output = null;
        this.plan = null;
        this.radius = -1;
        this.sampleScale = 0;
    }

    releaseTargets(): void {
        // 引擎允许 null 解除引用，声明仍将参数标为非空。
        this.releaseBlurTargets();
        this.material.setTexture("u_Original", null!);
        this.capture?.destroy();
        this.capture = null;
        this.snapshot?.destroy();
        this.snapshot = null;
        this.snapshotDirty = true;
        this.snapshotNeedsNotice = false;
        this.radius = -1;
        this.sampleScale = 0;
    }

    destroy(): void {
        withBackdropStats(this.stats, () => {
            this.releaseTargets();
            this.command.shaderData.destroy();
            this.material.destroy();
        });
    }
}

export interface BackdropBlurPlan {
    readonly sizes: readonly { width: number; height: number }[];
    readonly baseLevel: number;
    readonly levelMix: number;
    readonly screenMix: number;
}

/** 方差近似只用于平滑选择相邻的有界核，不将采样点向远处拉伸。 */
export function planBackdropBlur(
    width: number,
    height: number,
    radius: number,
    scale: number
): BackdropBlurPlan {
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
        throw new RangeError("Backdrop blur requires positive integer dimensions");
    }
    if (!Number.isFinite(radius) || radius < 0 || radius > 64 || ![1, 2, 4].includes(scale)) {
        throw new RangeError("Backdrop blur requires radius 0..64 and scale 1/2/4");
    }
    const sizes = [{ width, height }];
    if (radius === 0) {
        return { sizes, baseLevel: 0, levelMix: 1, screenMix: 0 };
    }
    const baseLevel = Math.log2(scale);
    const targetVariance = (radius * radius) / 4;
    const baseVariance = (5 / 12) * (scale * scale - 1);
    let variance = baseVariance;
    let previousVariance = 0;
    while (sizes.length <= 6) {
        const previous = sizes[sizes.length - 1];
        if (previous.width === 1 && previous.height === 1) {
            break;
        }
        const level = sizes.length;
        sizes.push({
            width: Math.ceil(previous.width / 2),
            height: Math.ceil(previous.height / 2),
        });
        if (level > baseLevel) {
            previousVariance = variance;
            variance += 2.75 * 4 ** (level - 1);
        }
        if (level >= baseLevel && variance >= targetVariance) {
            break;
        }
    }
    const depth = sizes.length - 1;
    const base = Math.min(baseLevel, depth);
    return {
        sizes,
        baseLevel: base,
        levelMix:
            depth > base
                ? Math.min(1, (targetVariance - previousVariance) / (variance - previousVariance))
                : 1,
        screenMix:
            depth === base && baseVariance > 0 ? Math.min(1, targetVariance / baseVariance) : 1,
    };
}

interface BackdropShaders {
    display: Laya.Shader3D;
    down: Laya.Shader3D;
    up: Laya.Shader3D;
    resolve: Laya.Shader3D;
}

let backdropShaders: BackdropShaders | undefined;

/** 惰性注册；IDE 的 find 会为缺失名称创建占位 shader，不能用它探测是否初始化。 */
function createBackdropShaders(): BackdropShaders {
    if (backdropShaders) {
        return backdropShaders;
    }
    const display = Laya.Shader3D.add("BackdropDisplay");
    display.shaderType = Laya.ShaderFeatureType.D2_BaseRenderNode2D;
    const displaySub = new Laya.SubShader(Laya.Shader2D.Render2DNodeAttribute, {
        u_Backdrop: Laya.ShaderDataType.Texture2D,
        u_Original: Laya.ShaderDataType.Texture2D,
        u_FrameSize: Laya.ShaderDataType.Vector2,
        u_BlurMix: Laya.ShaderDataType.Float,
    });
    display.addSubShader(displaySub);
    displaySub.addShaderPass(
        `
        #include "Sprite2DVertex.glsl";
        void main() {
            vertexInfo info;
            getVertexInfo(info);
            v_texcoord = info.uv;
            v_color = info.color;
            gl_Position = getPosition(info.pos);
        }
    `,
        `
        #include "Sprite2DFrag.glsl";
        uniform sampler2D u_Backdrop;
        uniform sampler2D u_Original;
        uniform vec2 u_FrameSize;
        uniform float u_BlurMix;
        void main() {
            clip();
            // 帧缓冲和抓取纹理同为左下原点，已合成颜色无需再次 gamma 转换。
            vec2 uv = gl_FragCoord.xy / u_FrameSize;
            // 已合成画面按节点透明度替换，避免透明 canvas 上重复叠加原画面 alpha。
            #ifdef BACKDROP_ONCE
                vec4 color = texture2D(u_Backdrop, uv);
                // 不透明快照只采一次；透明度动画仍与冻结的原图混合。
                if (v_color.a < 1.0) {
                    color = mix(texture2D(u_Original, uv), color, v_color.a);
                }
                gl_FragColor = color;
            #else
                gl_FragColor = mix(texture2D(u_Original, uv), texture2D(u_Backdrop, uv), v_color.a * u_BlurMix);
            #endif
        }
    `
    );
    const down = createFilterShader(
        "BackdropDown",
        `
        vec4 color = texture2D(u_MainTex, v_UV) * 4.0;
        color += texture2D(u_MainTex, v_UV + vec2(-u_Texel.x, -u_Texel.y));
        color += texture2D(u_MainTex, v_UV + vec2( u_Texel.x, -u_Texel.y));
        color += texture2D(u_MainTex, v_UV + vec2(-u_Texel.x,  u_Texel.y));
        color += texture2D(u_MainTex, v_UV + vec2( u_Texel.x,  u_Texel.y));
        gl_FragColor = color / 8.0;
    `
    );
    const up = createFilterShader(
        "BackdropUp",
        `
        vec2 d = u_Texel * 0.5;
        vec4 color = texture2D(u_MainTex, v_UV + vec2(-2.0 * d.x, 0.0));
        color += texture2D(u_MainTex, v_UV + vec2(-d.x,  d.y)) * 2.0;
        color += texture2D(u_MainTex, v_UV + vec2(0.0,  2.0 * d.y));
        color += texture2D(u_MainTex, v_UV + vec2( d.x,  d.y)) * 2.0;
        color += texture2D(u_MainTex, v_UV + vec2(2.0 * d.x, 0.0));
        color += texture2D(u_MainTex, v_UV + vec2( d.x, -d.y)) * 2.0;
        color += texture2D(u_MainTex, v_UV + vec2(0.0, -2.0 * d.y));
        color += texture2D(u_MainTex, v_UV + vec2(-d.x, -d.y)) * 2.0;
        gl_FragColor = mix(texture2D(u_LevelOriginal, v_UV), color / 12.0, u_LevelMix);
    `
    );
    const resolve = createFilterShader(
        "BackdropResolve",
        `
        gl_FragColor = mix(texture2D(u_LevelOriginal, v_UV), texture2D(u_MainTex, v_UV), u_LevelMix);
    `
    );
    return (backdropShaders = { display, down, up, resolve });
}

function createFilterShader(name: string, body: string): Laya.Shader3D {
    const shader = Laya.Shader3D.add(name);
    shader.shaderType = Laya.ShaderFeatureType.PostProcess;
    const sub = new Laya.SubShader(
        { a_PositionTexcoord: [0, Laya.ShaderDataType.Vector4] },
        {
            u_MainTex: Laya.ShaderDataType.Texture2D,
            u_Texel: Laya.ShaderDataType.Vector2,
            u_LevelOriginal: Laya.ShaderDataType.Texture2D,
            u_LevelMix: Laya.ShaderDataType.Float,
        }
    );
    shader.addSubShader(sub);
    const pass = sub.addShaderPass(
        `
        varying vec2 v_UV;
        void main() {
            gl_Position = vec4(a_PositionTexcoord.xy, 0.0, 1.0);
            v_UV = a_PositionTexcoord.zw;
        }
    `,
        `
        varying vec2 v_UV;
        uniform sampler2D u_MainTex;
        uniform sampler2D u_LevelOriginal;
        uniform float u_LevelMix;
        uniform vec2 u_Texel;
        void main() {
            ${body}
        }
    `
    );
    pass.statefirst = true;
    pass.renderState.depthWrite = false;
    pass.renderState.depthTest = Laya.RenderState.DEPTHTEST_OFF;
    pass.renderState.blend = Laya.RenderState.BLEND_DISABLE;
    pass.renderState.cull = Laya.RenderState.CULL_NONE;
    return shader;
}
