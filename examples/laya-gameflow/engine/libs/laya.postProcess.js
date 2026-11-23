(function (exports, Laya) {
    'use strict';

    var BloomVS = "#define SHADER_NAME BloomVS\nvarying vec2 v_Texcoord0;vec4 remapPositionZ(vec4 position){return position;}void main(){gl_Position=vec4(a_PositionTexcoord.xy,0.0,1.0);v_Texcoord0=a_PositionTexcoord.zw;gl_Position=remapPositionZ(gl_Position);}";

    var BloomDownsample13PS = "#define SHADER_NAME BloomDownSample13FS\n#include \"Color.glsl\";\n#include \"Colors.glsl\";\n#include \"Sampling.glsl\";\nvarying vec2 v_Texcoord0;void fragDownsample13(){mediump vec4 color=downsampleBox13Tap(v_Texcoord0,u_MainTex_TexelSize.xy);gl_FragColor=color;}void main(){fragDownsample13();gl_FragColor=outputTransform(gl_FragColor);}";

    var BloomDownsample4PS = "#define SHADER_NAME BloomDownSample4FS\n#include \"Color.glsl\";\n#include \"Colors.glsl\";\n#include \"Sampling.glsl\";\nvarying vec2 v_Texcoord0;void fragDownsample4(){mediump vec4 color=downsampleBox4Tap(v_Texcoord0,u_MainTex_TexelSize.xy);gl_FragColor=color;}void main(){fragDownsample4();gl_FragColor=outputTransform(gl_FragColor);}";

    var BloomPrefilter13PS = "#define SHADER_NAME BloomPreFilter13FS\n#include \"Color.glsl\";\n#include \"Colors.glsl\";\n#include \"Sampling.glsl\";\nvarying vec2 v_Texcoord0;mediump vec4 prefilter(mediump vec4 color,vec2 uv){vec4 autoExposureSampler=texture2D(u_AutoExposureTex,uv);\n#ifdef Gamma_u_AutoExposureTex\nautoExposureSampler=gammaToLinear(autoExposureSampler);\n#endif\nmediump float autoExposure=autoExposureSampler.r;color*=autoExposure;color=min(vec4(u_Params.x),color);color=quadraticThreshold(color,u_Threshold.x,u_Threshold.yzw);return color;}void fragPrefilter13(){mediump vec4 color=downsampleBox13Tap(v_Texcoord0,u_MainTex_TexelSize.xy);gl_FragColor=prefilter(safeHDR(color),v_Texcoord0);}void main(){fragPrefilter13();gl_FragColor=outputTransform(gl_FragColor);}";

    var BloomPrefilter4PS = "#define SHADER_NAME BloomPreFilter4FS\n#include \"Color.glsl\";\n#include \"Colors.glsl\";\n#include \"Sampling.glsl\";\nvarying vec2 v_Texcoord0;mediump vec4 prefilter(mediump vec4 color,vec2 uv){vec4 autoExposureSampler=texture2D(u_AutoExposureTex,uv);\n#ifdef Gamma_u_AutoExposureTex\nautoExposureSampler=gammaToLinear(autoExposureSampler);\n#endif\nmediump float autoExposure=autoExposureSampler.r;color*=autoExposure;color=min(vec4(u_Params.x),color);color=quadraticThreshold(color,u_Threshold.x,u_Threshold.yzw);return color;}void fragPrefilter4(){mediump vec4 color=downsampleBox4Tap(v_Texcoord0,u_MainTex_TexelSize.xy);gl_FragColor=prefilter(safeHDR(color),v_Texcoord0);}void main(){fragPrefilter4();gl_FragColor=outputTransform(gl_FragColor);}";

    var BloomUpsampleBoxPS = "#define SHADER_NAME BloomUpSampleBoxFS\n#include \"Color.glsl\";\n#include \"Colors.glsl\";\n#include \"Sampling.glsl\";\nvarying vec2 v_Texcoord0;mediump vec4 combine(mediump vec4 bloom,vec2 uv){mediump vec4 color=texture2D(u_BloomTex,uv);\n#ifdef Gamma_u_BloomTex\ncolor=gammaToLinear(color);\n#endif\nreturn bloom+color;}void fragUpsampleBox(){mediump vec4 bloom=upsampleBox(v_Texcoord0,u_MainTex_TexelSize.xy,vec4(u_SampleScale));gl_FragColor=combine(bloom,v_Texcoord0);}void main(){fragUpsampleBox();gl_FragColor=outputTransform(gl_FragColor);}";

    var BloomUpsampleTentPS = "#define SHADER_NAME BloomUpSampleTentFS\n#include \"Color.glsl\";\n#include \"Colors.glsl\";\n#include \"Sampling.glsl\";\nvarying vec2 v_Texcoord0;mediump vec4 combine(mediump vec4 bloom,vec2 uv){mediump vec4 color=texture2D(u_BloomTex,uv);\n#ifdef Gamma_u_BloomTex\ncolor=gammaToLinear(color);\n#endif\nreturn bloom+color;}void fragUpsampleTent(){mediump vec4 bloom=upsampleTent(v_Texcoord0,u_MainTex_TexelSize.xy,vec4(u_SampleScale));gl_FragColor=combine(bloom,v_Texcoord0);}void main(){fragUpsampleTent();gl_FragColor=outputTransform(gl_FragColor);}";

    var CompositePS = "#define SHADER_NAME CompositeFS\n#include \"Color.glsl\";\n#include \"Colors.glsl\";\n#include \"Sampling.glsl\";\nvarying vec2 v_Texcoord0;vec4 samplerBloom(vec2 uv){vec4 mainSampler=texture2D(u_BloomTex,uv);\n#ifdef Gamma_u_MainTex\nmainSampler=gammaToLinear(mainSampler);\n#endif\nreturn mainSampler;}mediump vec4 upsampleTentBloom(vec2 uv,vec2 texelSize,vec4 sampleScale){vec4 d=texelSize.xyxy*vec4(1.0,1.0,-1.0,0.0)*sampleScale;mediump vec4 s=samplerBloom(uv-d.xy);s+=samplerBloom(uv-d.wy)*2.0;s+=samplerBloom(uv-d.zy);s+=samplerBloom(uv+d.zw)*2.0;s+=samplerBloom(uv)*4.0;s+=samplerBloom(uv+d.xw)*2.0;s+=samplerBloom(uv+d.zy);s+=samplerBloom(uv+d.wy)*2.0;s+=samplerBloom(uv+d.xy);return s*(1.0/16.0);}mediump vec4 upsampleBoxBloom(vec2 uv,vec2 texelSize,vec4 sampleScale){vec4 d=texelSize.xyxy*vec4(-1.0,-1.0,1.0,1.0)*0.5*sampleScale;mediump vec4 s=samplerBloom(uv+d.xy);s+=samplerBloom(uv+d.zy);s+=samplerBloom(uv+d.xw);s+=samplerBloom(uv+d.zw);return s*(1.0/4.0);}void main(){vec4 autoExposureSampler=texture2D(u_AutoExposureTex,v_Texcoord0);\n#ifdef Gamma_u_AutoExposureTex\nautoExposureSampler=gammaToLinear(autoExposureSampler);\n#endif\nmediump float autoExposure=autoExposureSampler.r;mediump vec4 color=vec4(0.0);color=texture2D(u_MainTex,v_Texcoord0);\n#ifdef Gamma_u_MainTex\ncolor=gammaToLinear(color);\n#endif\ncolor.rgb*=autoExposure;\n#if defined(BLOOM) || defined(BLOOM_LOW)\n#ifdef BLOOM\nmediump vec4 bloom=upsampleTentBloom(v_Texcoord0,u_BloomTex_TexelSize.xy,vec4(u_Bloom_Settings.x));\n#else\nmediump vec4 bloom=upsampleBoxBloom(v_Texcoord0,u_BloomTex_TexelSize.xy,vec4(u_Bloom_Settings.x));\n#endif\nmediump vec4 dirt=vec4(texture2D(u_Bloom_DirtTex,v_Texcoord0*u_Bloom_DirtTileOffset.xy+u_Bloom_DirtTileOffset.zw).rgb,0.0);\n#ifdef Gamma_u_Bloom_DirtTex\ndirt=gammaToLinear(dirt);\n#endif\nbloom*=u_Bloom_Settings.y;dirt*=u_Bloom_Settings.z;mediump vec4 bloomColor=u_Bloom_Color;color+=bloom*bloomColor;color+=dirt*bloom;\n#endif\nmediump vec4 finalColor=color;gl_FragColor=finalColor;gl_FragColor=outputTransform(gl_FragColor);}";

    var CompositeVS = "#define SHADER_NAME CompositeVS\nvarying vec2 v_Texcoord0;vec4 remapPositionZ(vec4 position){return position;}void main(){gl_Position=vec4(a_PositionTexcoord.xy,0.0,1.0);v_Texcoord0=a_PositionTexcoord.zw;gl_Position=remapPositionZ(gl_Position);}";

    var SamplingGLSL = "vec4 samplerTex(vec2 uv){vec4 mainSampler=texture2D(u_MainTex,uv);\n#ifdef Gamma_u_MainTex\nmainSampler=gammaToLinear(mainSampler);\n#endif\nreturn mainSampler;}mediump vec4 downsampleBox13Tap(vec2 uv,vec2 texelSize){mediump vec4 A=samplerTex(uv+texelSize*vec2(-1.0,-1.0));mediump vec4 B=samplerTex(uv+texelSize*vec2(0.0,-1.0));mediump vec4 C=samplerTex(uv+texelSize*vec2(1.0,-1.0));mediump vec4 D=samplerTex(uv+texelSize*vec2(-0.5,-0.5));mediump vec4 E=samplerTex(uv+texelSize*vec2(0.5,-0.5));mediump vec4 F=samplerTex(uv+texelSize*vec2(-1.0,0.0));mediump vec4 G=samplerTex(uv);mediump vec4 H=samplerTex(uv+texelSize*vec2(1.0,0.0));mediump vec4 I=samplerTex(uv+texelSize*vec2(-0.5,0.5));mediump vec4 J=samplerTex(uv+texelSize*vec2(0.5,0.5));mediump vec4 K=samplerTex(uv+texelSize*vec2(-1.0,1.0));mediump vec4 L=samplerTex(uv+texelSize*vec2(0.0,1.0));mediump vec4 M=samplerTex(uv+texelSize*vec2(1.0,1.0));mediump vec2 scale=vec2(0.5,0.125);mediump vec2 div=(1.0/4.0)*scale;mediump vec4 o=(D+E+I+J)*div.x;o+=(A+B+G+F)*div.y;o+=(B+C+H+G)*div.y;o+=(F+G+L+K)*div.y;o+=(G+H+M+L)*div.y;return o;}mediump vec4 downsampleBox4Tap(vec2 uv,vec2 texelSize){vec4 d=texelSize.xyxy*vec4(-1.0,-1.0,1.0,1.0);mediump vec4 s=samplerTex(uv+d.xy);s+=samplerTex(uv+d.zy);s+=samplerTex(uv+d.xw);s+=samplerTex(uv+d.zw);return s*(1.0/4.0);}mediump vec4 upsampleTent(vec2 uv,vec2 texelSize,vec4 sampleScale){vec4 d=texelSize.xyxy*vec4(1.0,1.0,-1.0,0.0)*sampleScale;mediump vec4 s=samplerTex(uv-d.xy);s+=samplerTex(uv-d.wy)*2.0;s+=samplerTex(uv-d.zy);s+=samplerTex(uv+d.zw)*2.0;s+=samplerTex(uv)*4.0;s+=samplerTex(uv+d.xw)*2.0;s+=samplerTex(uv+d.zy);s+=samplerTex(uv+d.wy)*2.0;s+=samplerTex(uv+d.xy);return s*(1.0/16.0);}mediump vec4 upsampleBox(vec2 uv,vec2 texelSize,vec4 sampleScale){vec4 d=texelSize.xyxy*vec4(-1.0,-1.0,1.0,1.0)*0.5*sampleScale;mediump vec4 s=samplerTex(uv+d.xy);s+=samplerTex(uv+d.zy);s+=samplerTex(uv+d.xw);s+=samplerTex(uv+d.zw);return s*(1.0/4.0);}";

    var StdLibGLSL = "#define HALF_MAX 65504.0\n#define FLT_EPSILON 1.192092896e-07\nmediump vec4 safeHDR(mediump vec4 c){return min(c,HALF_MAX);}vec3 positivePow(vec3 base,vec3 power){return pow(max(abs(base),vec3(FLT_EPSILON,FLT_EPSILON,FLT_EPSILON)),power);}";

    var ColorsGLSL = "#include \"StdLib.glsl\";\n#define EPSILON 1.0e-4\nmediump vec4 quadraticThreshold(mediump vec4 color,mediump float threshold,mediump vec3 curve){mediump float br=max(max(color.r,color.g),color.b);mediump float rq=clamp(br-curve.x,0.0,curve.y);rq=curve.z*rq*rq;color*=max(rq,br-threshold)/max(br,EPSILON);return color;}";

    class BloomEffect extends Laya.PostProcessEffect {
        static init() {
            Laya.Shader3D.addInclude("StdLib.glsl", StdLibGLSL);
            Laya.Shader3D.addInclude("Colors.glsl", ColorsGLSL);
            Laya.Shader3D.addInclude("Sampling.glsl", SamplingGLSL);
            var attributeMap = {
                'a_PositionTexcoord': [Laya.VertexMesh.MESH_POSITION0, Laya.ShaderDataType.Vector4]
            };
            var uniformMap = {
                "u_MainTex": Laya.ShaderDataType.Texture2D,
                "u_MainTex_TexelSize": Laya.ShaderDataType.Vector4,
                "u_AutoExposureTex": Laya.ShaderDataType.Texture2D,
                "u_Threshold": Laya.ShaderDataType.Vector4,
                "u_Params": Laya.ShaderDataType.Vector4,
                "u_BloomTex": Laya.ShaderDataType.Texture2D,
                "u_SampleScale": Laya.ShaderDataType.Float,
            };
            var shader = Laya.Shader3D.add("PostProcessBloom");
            shader.shaderType = Laya.ShaderFeatureType.PostProcess;
            var subShader = new Laya.SubShader(attributeMap, uniformMap);
            shader.addSubShader(subShader);
            var shaderPass = subShader.addShaderPass(BloomVS, BloomPrefilter13PS);
            var renderState = shaderPass.renderState;
            renderState = shaderPass.renderState;
            renderState.depthTest = Laya.RenderState.DEPTHTEST_ALWAYS;
            renderState.depthWrite = false;
            renderState.cull = Laya.RenderState.CULL_NONE;
            renderState.blend = Laya.RenderState.BLEND_DISABLE;
            subShader = new Laya.SubShader(attributeMap, uniformMap);
            shader.addSubShader(subShader);
            shaderPass = subShader.addShaderPass(BloomVS, BloomPrefilter4PS);
            renderState = shaderPass.renderState;
            renderState.depthTest = Laya.RenderState.DEPTHTEST_ALWAYS;
            renderState.depthWrite = false;
            renderState.cull = Laya.RenderState.CULL_NONE;
            renderState.blend = Laya.RenderState.BLEND_DISABLE;
            subShader = new Laya.SubShader(attributeMap, uniformMap);
            shader.addSubShader(subShader);
            shaderPass = subShader.addShaderPass(BloomVS, BloomDownsample13PS);
            renderState = shaderPass.renderState;
            renderState.depthTest = Laya.RenderState.DEPTHTEST_ALWAYS;
            renderState.depthWrite = false;
            renderState.cull = Laya.RenderState.CULL_NONE;
            renderState.blend = Laya.RenderState.BLEND_DISABLE;
            subShader = new Laya.SubShader(attributeMap, uniformMap);
            shader.addSubShader(subShader);
            shaderPass = subShader.addShaderPass(BloomVS, BloomDownsample4PS);
            renderState = shaderPass.renderState;
            renderState.depthTest = Laya.RenderState.DEPTHTEST_ALWAYS;
            renderState.depthWrite = false;
            renderState.cull = Laya.RenderState.CULL_NONE;
            renderState.blend = Laya.RenderState.BLEND_DISABLE;
            subShader = new Laya.SubShader(attributeMap, uniformMap);
            shader.addSubShader(subShader);
            shaderPass = subShader.addShaderPass(BloomVS, BloomUpsampleTentPS);
            renderState = shaderPass.renderState;
            renderState.depthTest = Laya.RenderState.DEPTHTEST_ALWAYS;
            renderState.depthWrite = false;
            renderState.cull = Laya.RenderState.CULL_NONE;
            renderState.blend = Laya.RenderState.BLEND_DISABLE;
            subShader = new Laya.SubShader(attributeMap, uniformMap);
            shader.addSubShader(subShader);
            shaderPass = subShader.addShaderPass(BloomVS, BloomUpsampleBoxPS);
            renderState = shaderPass.renderState;
            renderState.depthTest = Laya.RenderState.DEPTHTEST_ALWAYS;
            renderState.depthWrite = false;
            renderState.cull = Laya.RenderState.CULL_NONE;
            renderState.blend = Laya.RenderState.BLEND_DISABLE;
            BloomEffect.CompositeInit();
            BloomEffect.__initDefine__();
        }
        static CompositeInit() {
            let attributeMap = {
                'a_PositionTexcoord': [Laya.VertexMesh.MESH_POSITION0, Laya.ShaderDataType.Vector4],
            };
            let uniformMap = {
                'u_MainTex': Laya.ShaderDataType.Texture2D,
                'u_BloomTex': Laya.ShaderDataType.Texture2D,
                'u_AutoExposureTex': Laya.ShaderDataType.Texture2D,
                'u_Bloom_DirtTex': Laya.ShaderDataType.Texture2D,
                'u_BloomTex_TexelSize': Laya.ShaderDataType.Vector4,
                'u_Bloom_DirtTileOffset': Laya.ShaderDataType.Vector4,
                'u_Bloom_Settings': Laya.ShaderDataType.Vector4,
                'u_Bloom_Color': Laya.ShaderDataType.Color,
            };
            let shader = Laya.Shader3D.add("PostProcessComposite");
            shader.shaderType = Laya.ShaderFeatureType.PostProcess;
            let subShader = new Laya.SubShader(attributeMap, uniformMap);
            shader.addSubShader(subShader);
            let shaderPass = subShader.addShaderPass(CompositeVS, CompositePS);
            shaderPass.statefirst = true;
            let renderState = shaderPass.renderState;
            renderState.depthTest = Laya.RenderState.DEPTHTEST_ALWAYS;
            renderState.depthWrite = false;
            renderState.cull = Laya.RenderState.CULL_NONE;
            renderState.blend = Laya.RenderState.BLEND_DISABLE;
        }
        static __initDefine__() {
            BloomEffect.SHADERVALUE_MAINTEX = Laya.Shader3D.propertyNameToID("u_MainTex");
            BloomEffect.SHADERVALUE_AUTOEXPOSURETEX = Laya.Shader3D.propertyNameToID("u_AutoExposureTex");
            BloomEffect.SHADERVALUE_SAMPLESCALE = Laya.Shader3D.propertyNameToID("u_SampleScale");
            BloomEffect.SHADERVALUE_THRESHOLD = Laya.Shader3D.propertyNameToID("u_Threshold");
            BloomEffect.SHADERVALUE_PARAMS = Laya.Shader3D.propertyNameToID("u_Params");
            BloomEffect.SHADERVALUE_BLOOMTEX = Laya.Shader3D.propertyNameToID("u_BloomTex");
        }
        get clamp() {
            return this._clamp;
        }
        set clamp(value) {
            this._clamp = value;
        }
        get color() {
            return this._color;
        }
        set color(value) {
            this._color = value;
        }
        get fastMode() {
            return this._fastMode;
        }
        set fastMode(value) {
            this._fastMode = value;
        }
        get dirtTexture() {
            return this._dirtTexture;
        }
        set dirtTexture(value) {
            this._dirtTexture && this._dirtTexture._removeReference(1);
            this._dirtTexture = value;
            this._dirtTexture && this._dirtTexture._addReference(1);
        }
        get intensity() {
            return this._intensity;
        }
        set intensity(value) {
            this._intensity = Math.max(value, 0.0);
        }
        get threshold() {
            return this._threshold;
        }
        set threshold(value) {
            this._threshold = Math.max(value, 0.0);
        }
        get softKnee() {
            return this._softKnee;
        }
        set softKnee(value) {
            this._softKnee = Math.min(Math.max(value, 0.0), 1.0);
        }
        get diffusion() {
            return this._diffusion;
        }
        set diffusion(value) {
            this._diffusion = Math.min(Math.max(value, 1), 10);
        }
        get anamorphicRatio() {
            return this._anamorphicRatio;
        }
        set anamorphicRatio(value) {
            this._anamorphicRatio = Math.min(Math.max(value, -1.0), 1.0);
        }
        get dirtIntensity() {
            return this._dirtIntensity;
        }
        set dirtIntensity(value) {
            this._dirtIntensity = Math.max(value, 0.0);
        }
        get resolutionScale() {
            return this._resolutionScale;
        }
        set resolutionScale(value) {
            this._resolutionScale = Math.min(Math.max(value, 0.125), 2.0);
        }
        constructor() {
            super();
            this._shader = null;
            this._shaderData = Laya.LayaGL.renderDeviceFactory.createShaderData(null);
            this._compositeShaderData = Laya.LayaGL.renderDeviceFactory.createShaderData(null);
            this._linearColor = new Laya.Color();
            this._bloomTextureTexelSize = new Laya.Vector4();
            this._shaderThreshold = new Laya.Vector4();
            this._shaderParams = new Laya.Vector4();
            this._pyramid = null;
            this._intensity = 0.0;
            this._threshold = 1.0;
            this._softKnee = 0.5;
            this._diffusion = 7.0;
            this._anamorphicRatio = 0.0;
            this._dirtIntensity = 0.0;
            this._shaderSetting = new Laya.Vector4();
            this._dirtTileOffset = new Laya.Vector4();
            this._fastMode = false;
            this._resolutionScale = 1.0;
            this._dirtTexture = null;
            this._singleton = true;
            this.active = true;
            this.intensity = 1.0;
            this.threshold = 1.0;
            this.softKnee = 0.5;
            this.clamp = 65472;
            this.diffusion = 7;
            this.anamorphicRatio = 0;
            this.color = new Laya.Color(1.0, 1.0, 1.0, 1.0);
        }
        effectInit(postprocess) {
            super.effectInit(postprocess);
            this._shader = Laya.Shader3D.find("PostProcessBloom");
            this._pyramid = new Array(BloomEffect.MAXPYRAMIDSIZE * 2);
        }
        getCameraDepthTextureModeFlag() {
            return 0;
        }
        release(postprocess) {
            super.release(postprocess);
            this._shader = null;
            this._pyramid = [];
        }
        render(context) {
            var cmd = context.command;
            var viewport = context.camera.viewport;
            const shaderData = this._shaderData;
            shaderData.setTexture(BloomEffect.SHADERVALUE_AUTOEXPOSURETEX, Laya.Texture2D.whiteTexture);
            var ratio = this._anamorphicRatio;
            var rw = ratio < 0 ? -ratio : 0;
            var rh = ratio > 0 ? ratio : 0;
            var invScale = 2 / this._resolutionScale;
            var tw = Math.floor(viewport.width / Math.max(invScale - rw, 1));
            var th = Math.floor(viewport.height / Math.max(invScale - rh, 1));
            var s = Math.max(tw, th);
            var logs;
            logs = Math.log2(s) + this._diffusion - 10;
            var logsInt = Math.floor(logs);
            var iterations = Math.min(Math.max(logsInt, 1), BloomEffect.MAXPYRAMIDSIZE);
            var sampleScale = 0.5 + logs - logsInt;
            shaderData.setNumber(BloomEffect.SHADERVALUE_SAMPLESCALE, sampleScale);
            var lthresh = Laya.Color.gammaToLinearSpace(this.threshold);
            var knee = lthresh * this._softKnee + 1e-5;
            this._shaderThreshold.setValue(lthresh, lthresh - knee, knee * 2, 0.25 / knee);
            shaderData.setVector(BloomEffect.SHADERVALUE_THRESHOLD, this._shaderThreshold);
            var lclamp = Laya.Color.gammaToLinearSpace(this.clamp);
            this._shaderParams.setValue(lclamp, 0, 0, 0);
            shaderData.setVector(BloomEffect.SHADERVALUE_PARAMS, this._shaderParams);
            var qualityOffset = this.fastMode ? 1 : 0;
            var lastDownTexture = context.indirectTarget;
            let format = lastDownTexture.format;
            for (var i = 0; i < iterations; i++) {
                var downIndex = i * 2;
                var upIndex = downIndex + 1;
                var subShader = i == 0 ? BloomEffect.SUBSHADER_PREFILTER13 + qualityOffset : BloomEffect.SUBSHADER_DOWNSAMPLE13 + qualityOffset;
                var mipDownTexture = Laya.RenderTexture.createFromPool(tw, th, format, Laya.RenderTargetFormat.None, false, 1, false, true);
                mipDownTexture.filterMode = Laya.FilterMode.Bilinear;
                this._pyramid[downIndex] = mipDownTexture;
                if (i !== iterations - 1) {
                    var mipUpTexture = Laya.RenderTexture.createFromPool(tw, th, format, Laya.RenderTargetFormat.None, false, 1, false, true);
                    mipUpTexture.filterMode = Laya.FilterMode.Bilinear;
                    this._pyramid[upIndex] = mipUpTexture;
                }
                cmd.blitScreenTriangle(lastDownTexture, mipDownTexture, null, this._shader, shaderData, subShader);
                lastDownTexture = mipDownTexture;
                tw = Math.max(Math.floor(tw / 2), 1);
                th = Math.max(Math.floor(th / 2), 1);
            }
            var lastUpTexture = this._pyramid[(iterations - 1) * 2];
            for (i = iterations - 2; i >= 0; i--) {
                downIndex = i * 2;
                upIndex = downIndex + 1;
                mipDownTexture = this._pyramid[downIndex];
                mipUpTexture = this._pyramid[upIndex];
                cmd.setShaderDataTexture(shaderData, BloomEffect.SHADERVALUE_BLOOMTEX, mipDownTexture);
                cmd.blitScreenTriangle(lastUpTexture, mipUpTexture, null, this._shader, shaderData, BloomEffect.SUBSHADER_UPSAMPLETENT + qualityOffset);
                lastUpTexture = mipUpTexture;
            }
            var linearColor = this._linearColor;
            this.color.toLinear(linearColor);
            var intensity = Math.pow(2, this._intensity / 10.0) - 1.0;
            var shaderSettings = this._shaderSetting;
            this._shaderSetting.setValue(sampleScale, intensity, this._dirtIntensity, iterations);
            var usedirtTexture = this._dirtTexture ? this._dirtTexture : Laya.Texture2D.blackTexture;
            var dirtRatio = usedirtTexture.width / usedirtTexture.height;
            var screenRatio = viewport.width / viewport.height;
            var dirtTileOffset = this._dirtTileOffset;
            if (dirtRatio > screenRatio)
                dirtTileOffset.setValue(screenRatio / dirtRatio, 1.0, (1.0 - dirtTileOffset.x) * 0.5, 0.0);
            else if (dirtRatio < screenRatio)
                dirtTileOffset.setValue(1.0, dirtRatio / screenRatio, 0.0, (1.0 - dirtTileOffset.y) * 0.5);
            var compositeShaderData = this._compositeShaderData;
            if (this.fastMode)
                compositeShaderData.addDefine(Laya.PostProcess.SHADERDEFINE_BLOOM_LOW);
            else
                compositeShaderData.addDefine(Laya.PostProcess.SHADERDEFINE_BLOOM);
            this._bloomTextureTexelSize.setValue(1.0 / lastUpTexture.width, 1.0 / lastUpTexture.height, lastUpTexture.width, lastUpTexture.height);
            compositeShaderData.setVector(Laya.PostProcess.SHADERVALUE_BLOOM_DIRTTILEOFFSET, dirtTileOffset);
            compositeShaderData.setVector(Laya.PostProcess.SHADERVALUE_BLOOM_SETTINGS, shaderSettings);
            compositeShaderData.setColor(Laya.PostProcess.SHADERVALUE_BLOOM_COLOR, linearColor);
            compositeShaderData.setTexture(Laya.PostProcess.SHADERVALUE_BLOOM_DIRTTEX, usedirtTexture);
            compositeShaderData.setTexture(BloomEffect.SHADERVALUE_AUTOEXPOSURETEX, Laya.Texture2D.whiteTexture);
            compositeShaderData.setTexture(Laya.PostProcess.SHADERVALUE_BLOOMTEX, lastUpTexture);
            compositeShaderData.setVector(Laya.PostProcess.SHADERVALUE_BLOOMTEX_TEXELSIZE, this._bloomTextureTexelSize);
            let _compositeShader = Laya.Shader3D.find("PostProcessComposite");
            cmd.blitScreenTriangle(context.indirectTarget, context.destination, context.camera._screenOffsetScale, _compositeShader, compositeShaderData, 0);
            for (i = 0; i < iterations; i++) {
                downIndex = i * 2;
                upIndex = downIndex + 1;
                Laya.RenderTexture.recoverToPool(this._pyramid[downIndex]);
                (i !== 0 && i !== iterations - 1) && (Laya.RenderTexture.recoverToPool(this._pyramid[upIndex]));
            }
            context.deferredReleaseTextures.push(lastUpTexture);
        }
    }
    BloomEffect.SUBSHADER_PREFILTER13 = 0;
    BloomEffect.SUBSHADER_PREFILTER4 = 1;
    BloomEffect.SUBSHADER_DOWNSAMPLE13 = 2;
    BloomEffect.SUBSHADER_DOWNSAMPLE4 = 3;
    BloomEffect.SUBSHADER_UPSAMPLETENT = 4;
    BloomEffect.SUBSHADER_UPSAMPLEBOX = 5;
    BloomEffect.MAXPYRAMIDSIZE = 16;
    Laya.Laya.addInitCallback(() => BloomEffect.init());

    var BlitScreenVS = "#define SHADER_NAME BlitVS\nvarying vec2 v_Texcoord0;void main(){gl_Position=vec4(u_OffsetScale.x*2.0-1.0+(a_PositionTexcoord.x+1.0)*u_OffsetScale.z,(1.0-((u_OffsetScale.y*2.0-1.0+(-a_PositionTexcoord.y+1.0)*u_OffsetScale.w)+1.0)/2.0)*2.0-1.0,0.0,1.0);v_Texcoord0=a_PositionTexcoord.zw;}";

    var BlitLUTShader = "#define SHADER_NAME BlitLUTFS\n#include \"Color.glsl\";\n#include \"ColorGrading.glsl\";\n#include \"LUT.glsl\";\nvarying vec2 v_Texcoord0;void main(){gl_FragColor=texture2D(u_MainTex,v_Texcoord0);\n#ifdef Gamma_u_MainTex\ngl_FragColor=gammaToLinear(gl_FragColor);\n#endif\nvec3 color=gl_FragColor.rgb;color*=u_LutParams.w;color=applyLut(linearToLogC(color),u_LutParams.xyz);\n#ifdef CUSTOMLUT\nfloat contrib=u_CustomLutParams.w;vec3 gamma=linearToGamma(color);vec3 userLut=applyLut(u_CustomLut,gamma,u_CustomLutParams);gamma=mix(gamma,userLut,contrib);color=gammaToLinear(gamma);\n#endif\ngl_FragColor.rgb=color;gl_FragColor=outputTransform(gl_FragColor);}";

    var ColorGradingGLSL = "#if !defined(ColorGrading_lib)\n#define ColorGrading_lib\nconst float ACEScc_MAX=1.4679964;const float ACEScc_MIDGRAY=0.4135884;const float LogC_cut=0.011361;const float LogC_a=5.555556;const float LogC_b=0.047996;const float LogC_c=0.244161;const float LogC_d=0.386036;const float LogC_e=5.301883;const float LogC_f=0.092819;float linearToLogC(float x){float o;if(x>LogC_cut){o=LogC_c*log10(max(LogC_a*x+LogC_b,0.0))+LogC_d;}else{o=LogC_e*x+LogC_f;}return o;}vec3 linearToLogC(vec3 x){vec3 logc;logc.x=linearToLogC(x.x);logc.y=linearToLogC(x.y);logc.z=linearToLogC(x.z);return logc;}float logCToLinear(float x){float o;if(x>LogC_e*LogC_cut+LogC_f)o=(pow(10.0,(x-LogC_d)/LogC_c)-LogC_b)/LogC_a;else o=(x-LogC_f)/LogC_e;return o;}vec3 logCToLinear(vec3 x){vec3 linear;linear.x=logCToLinear(x.x);linear.y=logCToLinear(x.y);linear.z=logCToLinear(x.z);return linear;}vec3 RgbToHsv(vec3 c){const vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);const float e=1.0e-4;return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)),d/(q.x+e),q.x);}vec3 HsvToRgb(vec3 c){const vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0);vec3 p=abs(fract(vec3(c.x)+K.xyz)*6.0-K.www);return c.z*mix(vec3(K.x),saturate(p-vec3(K.x)),c.y);}float RotateHue(float value,float low,float hi){return(value<low)? value+hi:(value>hi)? value-hi: value;}const mat3 Linear_to_LMS_MAT=mat3(vec3(3.90405e-1,7.08416e-2,2.31082e-2),vec3(5.49941e-1,9.63172e-1,1.28021e-1),vec3(8.92632e-3,1.35775e-3,9.36245e-1));const mat3 LMS_to_Linear_MAT=mat3(vec3(2.85847e+0,-2.10182e-1,-4.18120e-2),vec3(-1.62879e+0,1.15820e+0,-1.18169e-1),vec3(-2.48910e-2,3.24281e-4,1.06867e+0));float luminance(in vec3 color){\n#ifdef ACES\nfloat luma=dot(color,AP1_RGB2Y);\n#else\nfloat luma=dot(color,vec3(0.2126729,0.7151522,0.0721750));\n#endif\nreturn luma;}vec3 softlight(vec3 base,vec3 blend){vec3 r1=2.0*base*blend+base*base*(1.0-2.0*blend);vec3 r2=sqrt(base)*(2.0*blend-1.0)+2.0*base*(1.0-blend);vec3 t=step(0.5,blend);return r2*t+(1.0-t)*r1;}vec3 colorGrade(in vec3 color){vec3 colorLMS=Linear_to_LMS_MAT*color;colorLMS*=u_ColorBalance.xyz;color=LMS_to_Linear_MAT*colorLMS;\n#ifdef ACES\nvec3 colorLog=ACES_to_ACEScc(sRGB_to_AP0_MAT*color);\n#else\nvec3 colorLog=linearToLogC(color);\n#endif\ncolorLog=(colorLog-vec3(ACEScc_MIDGRAY))*u_HueSatCon.z+vec3(ACEScc_MIDGRAY);\n#ifdef ACES\ncolor=AP0_to_AP1_MAT*ACEScc_to_ACES(colorLog);\n#else\ncolor=logCToLinear(colorLog);\n#endif\ncolor=color*u_ColorFilter.rgb;color=max(vec3(0.0),color);float balance=u_SplitShadows.w;vec3 gamma=linearToGamma(color);float splitLuma=saturate(luminance(color))+balance;vec3 splitShadows=mix(vec3(0.5,0.5,0.5),u_SplitShadows.xyz,1.0-splitLuma);vec3 splitHeighlights=mix(vec3(0.5,0.5,0.5),u_Splithighlights.xyz,splitLuma);gamma=softlight(gamma,splitShadows);gamma=softlight(gamma,splitHeighlights);color=gammaToLinear(gamma);float luma=luminance(color);float shadowFactor=1.0-smoothstep(u_Limits.x,u_Limits.y,luma);float highlightsFactor=smoothstep(u_Limits.z,u_Limits.w,luma);float midtonesFactor=1.0-shadowFactor-highlightsFactor;color=color*u_Shadows.xyz*shadowFactor+color*u_Midtones.xyz*midtonesFactor+color*u_Highlights.xyz*highlightsFactor;color=color*u_Gain.xyz+u_Lift.xyz;color=sign(color)*pow(abs(color),u_Gamma.xyz);vec3 hsv=RgbToHsv(color);float hue=hsv.x+u_HueSatCon.x;hsv.x=RotateHue(hsv.x,0.0,1.0);color=HsvToRgb(hsv);luma=luminance(color);color=vec3(luma)+(vec3(u_HueSatCon.y))*(color-vec3(luma));return color;}\n#endif\n";

    var TonemappingGLSL = "#if !defined(Tonemapping_lib)\n#define Tonemapping_lib\nvec3 tonemap(in vec3 ap1){vec3 color=ap1;\n#ifdef ACES\nvec3 aces=AP1_to_AP0_MAT*color;vec3 oces=RRT(aces);color=ODT_sRGB_100nits(oces);\n#endif\nreturn color;}\n#endif\n";

    var LUTGLSL = "#if !defined(LUT_lib)\n#define LUT_lib\nvec3 applyLut(vec3 uvw,vec3 scaleOffset){uvw.z*=scaleOffset.z;float shift=floor(uvw.z);uvw.xy=uvw.xy*scaleOffset.z*scaleOffset.xy+scaleOffset.xy*0.5;uvw.x+=shift*scaleOffset.y;uvw.xyz=mix(texture2DLodEXT(u_Lut,uvw.xy,0.0).rgb,texture2DLodEXT(u_Lut,uvw.xy+vec2(scaleOffset.y,0.0),0.0).rgb,uvw.z-shift);return uvw;}\n#endif\n";

    var LUTBuilderFS = "#define SHADER_NAME LutBuilder\n#include \"Color.glsl\";\n#ifdef ACES\n#include \"ACES.glsl\";\n#endif\n#include \"ColorGrading.glsl\";\n#include \"Tonemapping.glsl\";\nvarying vec2 v_Texcoord0;vec3 lutValue(vec2 uv,vec4 params){vec3 color;uv-=params.yz;color.r=fract(uv.x*params.x);color.b=uv.x-color.r/params.x;color.g=uv.y;return color*params.w;}void main(){vec2 uv=v_Texcoord0;vec3 color=lutValue(uv,u_LutParams);color=logCToLinear(color);vec3 grade=colorGrade(color);vec3 tone=tonemap(grade);gl_FragColor=vec4(tone,1.0);}";

    var UtillitiesColorGLSL = "#if !defined(UtillitiesColor_lib)\n#define UtillitiesColor_lib\nvec3 XYZ_2_xyY(vec3 XYZ){vec3 xyY;float divisor=max(XYZ.x+XYZ.y+XYZ.z,1e-10);xyY.x=XYZ.x/divisor;xyY.y=XYZ.y/divisor;xyY.z=XYZ.y;return xyY;}vec3 xyY_2_XYZ(vec3 xyY){vec3 XYZ;XYZ.x=xyY.x*xyY.z/max(xyY.y,1e-10);XYZ.y=xyY.z;XYZ.z=(1.0-xyY.x-xyY.y)*xyY.z/max(xyY.y,1e-10);return XYZ;}float rgb_2_yc(vec3 rgb,float ycRadiusWeight){float r=rgb.r;float g=rgb.g;float b=rgb.b;float k=b*(b-g)+g*(g-r)+r*(r-b);k=max(MEDIUMP_FLT_MIN,k);float chroma=sqrt(k);return(b+g+r+ycRadiusWeight*chroma)/3.0;}float rgb_2_yc(vec3 rgb){return rgb_2_yc(rgb,1.75);}float rgb_2_hue(vec3 rgb){float hue;if(rgb.x==rgb.y&&rgb.y==rgb.z)hue=0.0;else hue=(180.0*INVERT_PI)*atan(sqrt(3.0)*(rgb.y-rgb.z),2.0*rgb.x-rgb.y-rgb.z);if(hue<0.0){hue=hue+360.0;}return hue;}\n#endif\n";

    var TransformCommonGLSL = "#if !defined(TransformCommon_lib)\n#define TransformCommon_lib\nconst float TINY=1e-10;const mat3 sRGB_to_AP0_MAT=mat3(vec3(0.4395856442,0.0895395735,0.0173871832),vec3(0.3839294030,0.8147498351,0.1087391143),vec3(0.1765327364,0.0956836061,0.8738205876));const mat3 sRGB_to_AP1_MAT=mat3(vec3(0.6131178129,0.0699340823,0.0204629926),vec3(0.3411819959,0.9181030375,0.1067686634),vec3(0.0457873443,0.0119327755,0.8727159106));const mat3 AP1_to_XYZ_MAT=mat3(vec3(0.6624541811,0.2722287168,-0.0055746495),vec3(0.1340042065,0.6740817658,0.0040607335),vec3(0.1561876870,0.0536895174,1.0103391003));const mat3 AP0_to_AP1_MAT=mat3(vec3(1.4514393161,-0.0765537734,0.0083161484),vec3(-0.2365107469,1.1762296998,-0.0060324498),vec3(-0.2149285693,-0.0996759264,0.9977163014));const mat3 AP1_to_AP0_MAT=mat3(vec3(0.6954522414,0.0447945634,-0.0055258826),vec3(0.1406786965,0.8596711185,0.0040252103),vec3(0.1638690622,0.0955343182,1.0015006723));const mat3 XYZ_to_AP1_MAT=mat3(vec3(1.6410233797,-0.6636628587,0.0117218943),vec3(-0.3248032942,1.6153315917,-0.0082844420),vec3(-0.2364246952,0.0167563477,0.9883948585));const vec3 AP1_RGB2Y=vec3(0.2722287168,0.6740817658,0.0536895174);float ACES_to_ACEScc(float x){return(x<0.00003051757)?(log2(0.00001525878+x*0.5)+9.72)/17.52 :(log2(x)+9.72)/17.52;}vec3 ACES_to_ACEScc(vec3 x){x=clamp(x,vec3(0.0),vec3(MEDIUMP_FLT_MAX));x.x=ACES_to_ACEScc(x.x);x.y=ACES_to_ACEScc(x.y);x.z=ACES_to_ACEScc(x.z);return x;}float ACEScc_to_ACES(float x){if(x<-0.3013698630)return(pow(2.0,x*17.52-9.72)-pow(2.0,-16.0))*2.0;else if(x<(log2(MEDIUMP_FLT_MAX)+9.72)/17.52)return pow(2.0,x*17.52-9.72);else return MEDIUMP_FLT_MAX;}vec3 ACEScc_to_ACES(vec3 x){x.x=ACEScc_to_ACES(x.x);x.y=ACEScc_to_ACES(x.y);x.z=ACEScc_to_ACES(x.z);return x;}float rgb_2_saturation(vec3 rgb){float rgbmax=vecmax(rgb);float rgbmin=vecmin(rgb);return(max(rgbmax,TINY)-max(rgbmin,TINY))/max(rgbmax,1e-2);}\n#endif\n";

    var RRTCommonGLSL = "#if !defined(RRTCommon_lib)\n#define RRTCommon_lib\nconst float RRT_GLOW_GAIN=0.05;const float RRT_GLOW_MID=0.08;const float RRT_RED_SCALE=0.82;const float RRT_RED_PIVOT=0.03;const float RRT_RED_HUE=0.;const float RRT_RED_WIDTH=135.;const float RRT_SAT_FACTOR=0.96;float glow_fwd(float ycIn,float glowGainIn,float glowMid){float glowGainOut;if(ycIn<=2.0/3.0*glowMid){glowGainOut=glowGainIn;}else if(ycIn>=2.0*glowMid){glowGainOut=0.0;}else{glowGainOut=glowGainIn*(glowMid/ycIn-0.5);}return glowGainOut;}float sigmoid_shaper(float x){float t=max(1.0-abs(x*0.5),0.0);float y=1.0+sign(x)*(1.0-t*t);return y*0.5;}float center_hue(float hue,float centerH){float hueCentered=hue-centerH;if(hueCentered<-180.0){hueCentered=hueCentered+360.0;}else if(hueCentered>180.0){hueCentered-=360.0;}return hueCentered;}\n#endif\n";

    var ODTCommonGLSL = "#if !defined(ODTCommon_lib)\n#define ODTCommon_lib\nconst float CINEMA_WHITE=48.0;const float CINEMA_BLACK=0.02;const float DIM_SURROUND_GAMMA=0.9811;const float ODT_SAT_FACTOR=0.93;const mat3 D60_to_D65_MAT=mat3(vec3(0.987224,-0.00759836,0.00307257),vec3(-0.00611327,1.00186,-0.00509595),vec3(0.0159533,0.00533002,1.08168));float Y_2_linCV(float Y,float Ymax,float Ymin){return(Y-Ymin)/(Ymax-Ymin);}vec3 darkSurround_to_dimSurround(vec3 linearCV){vec3 XYZ=linearCV*AP1_to_XYZ_MAT;vec3 xyY=XYZ_2_xyY(XYZ);xyY.z=clamp(xyY.z,0.0,MEDIUMP_FLT_MAX);xyY.z=pow(xyY.z,DIM_SURROUND_GAMMA);XYZ=xyY_2_XYZ(xyY);return XYZ*XYZ_to_AP1_MAT;}\n#endif\n";

    var TonescalesGLSL = "#if !defined(Tonescales_lib)\n#define Tonescales_lib\nconst mat3 M=mat3(vec3(0.5,-1.0,0.5),vec3(-1.0,1.0,0.5),vec3(0.5,0.0,0.0));float segmented_spline_c5_fwd(float x){\n#ifdef GRAPHICS_API_GLES3\nconst float coefsLow[6]=float[6](-4.0000000000,-4.0000000000,-3.1573765773,-0.4852499958,1.8477324706,1.8477324706);const float coefsHigh[6]=float[6](-0.7185482425,2.0810307172,3.6681241237,4.0000000000,4.0000000000,4.0000000000);\n#else\nconst float coefsLow_0=-4.0000000000;const float coefsLow_1=-4.0000000000;const float coefsLow_2=-3.1573765773;const float coefsLow_3=-0.4852499958;const float coefsLow_4=1.8477324706;const float coefsLow_5=1.8477324706;const float coefsHigh_0=-0.7185482425;const float coefsHigh_1=2.0810307172;const float coefsHigh_2=3.6681241237;const float coefsHigh_3=4.0000000000;const float coefsHigh_4=4.0000000000;const float coefsHigh_5=4.0000000000;\n#endif\nconst vec2 minPoint=vec2(0.0000054931640625,0.0001);const vec2 midPoint=vec2(0.18,4.8);const vec2 maxPoint=vec2(47185.92,10000.);const float slopeLow=0.0;const float slopeHigh=0.0;const int N_KNOTS_LOW=4;const int N_KNOTS_HIGH=4;float logx=log10(max(x,MEDIUMP_FLT_MIN));float logy;if(logx<=log10(minPoint.x)){logy=logx*slopeLow+(log10(minPoint.y)-slopeLow*log10(minPoint.x));}else if((logx>log10(minPoint.x))&&(logx<log10(midPoint.x))){float knot_coord=float(N_KNOTS_LOW-1)*(logx-log10(minPoint.x))/(log10(midPoint.x)-log10(minPoint.x));int j=int(knot_coord);float t=knot_coord-float(j);vec3 cf;\n#ifdef GRAPHICS_API_GLES3\ncf=vec3(coefsLow[j],coefsLow[j+1],coefsLow[j+2]);\n#else\nif(j<=0){cf=vec3(coefsLow_0,coefsLow_1,coefsLow_2);}else if(j==1){cf=vec3(coefsLow_1,coefsLow_2,coefsLow_3);}else if(j==2){cf=vec3(coefsLow_2,coefsLow_3,coefsLow_4);}else{cf=vec3(coefsLow_3,coefsLow_4,coefsLow_5);}\n#endif\nvec3 monomials=vec3(t*t,t,1.);logy=dot(monomials,M*cf);}else if((logx>=log10(midPoint.x))&&(logx<log10(maxPoint.x))){float knot_coord=float(N_KNOTS_HIGH-1)*(logx-log10(midPoint.x))/(log10(maxPoint.x)-log10(midPoint.x));int j=int(knot_coord);float t=knot_coord-float(j);vec3 cf;\n#ifdef GRAPHICS_API_GLES3\ncf=vec3(coefsHigh[j],coefsHigh[j+1],coefsHigh[j+2]);\n#else\nif(j<=0){cf=vec3(coefsHigh_0,coefsHigh_1,coefsHigh_2);}else if(j==1){cf=vec3(coefsHigh_1,coefsHigh_2,coefsHigh_3);}else if(j==2){cf=vec3(coefsHigh_2,coefsHigh_3,coefsHigh_4);}else{cf=vec3(coefsHigh_3,coefsHigh_4,coefsHigh_5);}\n#endif\nvec3 monomials=vec3(t*t,t,1.);logy=dot(monomials,M*cf);}else{logy=logx*slopeHigh+(log10(maxPoint.y)-slopeHigh*log10(maxPoint.x));}return pow(10.0,logy);}float segmented_spline_c9_fwd(float x){\n#ifdef GRAPHICS_API_GLES3\nconst float coefsLow[10]=float[10](-1.6989700043,-1.6989700043,-1.4779000000,-1.2291000000,-0.8648000000,-0.4480000000,0.0051800000,0.4511080334,0.9113744414,0.9113744414);const float coefsHigh[10]=float[10](0.5154386965,0.8470437783,1.1358000000,1.3802000000,1.5197000000,1.5985000000,1.6467000000,1.6746091357,1.6878733390,1.6878733390);\n#else\nconst float coefsLow_0=-1.6989700043;const float coefsLow_1=-1.6989700043;const float coefsLow_2=-1.4779000000;const float coefsLow_3=-1.2291000000;const float coefsLow_4=-0.8648000000;const float coefsLow_5=-0.4480000000;const float coefsLow_6=0.0051800000;const float coefsLow_7=0.4511080334;const float coefsLow_8=0.9113744414;const float coefsLow_9=0.9113744414;const float coefsHigh_0=0.5154386965;const float coefsHigh_1=0.8470437783;const float coefsHigh_2=1.1358000000;const float coefsHigh_3=1.3802000000;const float coefsHigh_4=1.5197000000;const float coefsHigh_5=1.5985000000;const float coefsHigh_6=1.6467000000;const float coefsHigh_7=1.6746091357;const float coefsHigh_8=1.6878733390;const float coefsHigh_9=1.6878733390;\n#endif\nvec2 minPoint=vec2(segmented_spline_c5_fwd(0.18*pow(2.0,-6.5)),0.02);vec2 midPoint=vec2(segmented_spline_c5_fwd(0.18),4.8);vec2 maxPoint=vec2(segmented_spline_c5_fwd(0.18*pow(2.,6.5)),48.0);const float slopeLow=0.0;const float slopeHigh=0.04;const int N_KNOTS_LOW=8;const int N_KNOTS_HIGH=8;float logx=log10(max(x,MEDIUMP_FLT_MIN));float logy;if(logx<=log10(minPoint.x)){logy=logx*slopeLow+(log10(minPoint.y)-slopeLow*log10(minPoint.x));}else if((logx>log10(minPoint.x))&&(logx<log10(midPoint.x))){float knot_coord=float(N_KNOTS_LOW-1)*(logx-log10(minPoint.x))/(log10(midPoint.x)-log10(minPoint.x));int j=int(knot_coord);float t=knot_coord-float(j);vec3 cf;\n#ifdef GRAPHICS_API_GLES3\ncf=vec3(coefsLow[j],coefsLow[j+1],coefsLow[j+2]);\n#else\nif(j<=0){cf=vec3(coefsLow_0,coefsLow_1,coefsLow_2);}else if(j==1){cf=vec3(coefsLow_1,coefsLow_2,coefsLow_3);}else if(j==2){cf=vec3(coefsLow_2,coefsLow_3,coefsLow_4);}else if(j==3){cf=vec3(coefsLow_3,coefsLow_4,coefsLow_5);}else if(j==4){cf=vec3(coefsLow_4,coefsLow_5,coefsLow_6);}else if(j==5){cf=vec3(coefsLow_5,coefsLow_6,coefsLow_7);}else if(j==6){cf=vec3(coefsLow_6,coefsLow_7,coefsLow_8);}else{cf=vec3(coefsLow_7,coefsLow_8,coefsLow_9);}\n#endif\nvec3 monomials=vec3(t*t,t,1.0);logy=dot(monomials,M*cf);}else if((logx>=log10(midPoint.x))&&(logx<log10(maxPoint.x))){float knot_coord=float(N_KNOTS_HIGH-1)*(logx-log10(midPoint.x))/(log10(maxPoint.x)-log10(midPoint.x));int j=int(knot_coord);float t=knot_coord-float(j);vec3 cf;\n#ifdef GRAPHICS_API_GLES3\ncf=vec3(coefsHigh[j],coefsHigh[j+1],coefsHigh[j+2]);\n#else\nif(j<=0){cf=vec3(coefsHigh_0,coefsHigh_1,coefsHigh_2);}else if(j==1){cf=vec3(coefsHigh_1,coefsHigh_2,coefsHigh_3);}else if(j==2){cf=vec3(coefsHigh_2,coefsHigh_3,coefsHigh_4);}else if(j==3){cf=vec3(coefsHigh_3,coefsHigh_4,coefsHigh_5);}else if(j==4){cf=vec3(coefsHigh_4,coefsHigh_5,coefsHigh_6);}else if(j==5){cf=vec3(coefsHigh_5,coefsHigh_6,coefsHigh_7);}else if(j==6){cf=vec3(coefsHigh_6,coefsHigh_7,coefsHigh_8);}else{cf=vec3(coefsHigh_7,coefsHigh_8,coefsHigh_9);}\n#endif\nvec3 monomials=vec3(t*t,t,1.0);logy=dot(monomials,M*cf);}else{logy=logx*slopeHigh+(log10(maxPoint.y)-slopeHigh*log10(maxPoint.x));}return pow(10.0,logy);}\n#endif\n";

    var RRTGLSL = "#if !defined(RRT_lib)\n#define RRT_lib\n#include \"ACES_RRTCommon.glsl\";\nvec3 RRT(vec3 aces){float saturation=rgb_2_saturation(aces);float ycIn=rgb_2_yc(aces);float s=sigmoid_shaper((saturation-0.4)/0.2);float addedGlow=1.0+glow_fwd(ycIn,RRT_GLOW_GAIN*s,RRT_GLOW_MID);aces*=addedGlow;float hue=rgb_2_hue(aces);float centeredHue=center_hue(hue,RRT_RED_HUE);float hueWeight=smoothstep(0.0,1.0,1.0-abs(2.0*centeredHue/RRT_RED_WIDTH));hueWeight*=hueWeight;aces.r+=hueWeight*saturation*(RRT_RED_PIVOT-aces.r)*(1.-RRT_RED_SCALE);vec3 rgbPre=AP0_to_AP1_MAT*aces;rgbPre=clamp(rgbPre,0.0,MEDIUMP_FLT_MAX);rgbPre=mix(vec3(dot(rgbPre,AP1_RGB2Y)),rgbPre,RRT_SAT_FACTOR);vec3 rgbPost;rgbPost.x=segmented_spline_c5_fwd(rgbPre.x);rgbPost.y=segmented_spline_c5_fwd(rgbPre.y);rgbPost.z=segmented_spline_c5_fwd(rgbPre.z);vec3 rgbOces=AP1_to_AP0_MAT*rgbPost;return rgbOces;}\n#endif\n";

    var ODT_sRGB_100nits_GLSL = "#if !defined(ODT_sRGB_100nits_lib)\n#define ODT_sRGB_100nits_lib\n#include \"ACES_ODTCommon.glsl\";\nconst mat3 XYZ_to_REC709_MAT=mat3(vec3(3.2409699419,-0.9692436363,0.0556300797),vec3(-1.5373831776,1.8759675015,-0.2039769589),vec3(-0.498610760,0.0415550574,1.0569715142));const float DISPGAMMA=2.4;const float OFFSET=0.055;vec3 ODT_sRGB_100nits(vec3 oces){vec3 rgbPre=AP0_to_AP1_MAT*oces;vec3 rgbPost;rgbPost.r=segmented_spline_c9_fwd(rgbPre.r);rgbPost.g=segmented_spline_c9_fwd(rgbPre.g);rgbPost.b=segmented_spline_c9_fwd(rgbPre.b);vec3 linearCV;linearCV.r=Y_2_linCV(rgbPost.r,CINEMA_WHITE,CINEMA_BLACK);linearCV.g=Y_2_linCV(rgbPost.g,CINEMA_WHITE,CINEMA_BLACK);linearCV.b=Y_2_linCV(rgbPost.b,CINEMA_WHITE,CINEMA_BLACK);linearCV=darkSurround_to_dimSurround(linearCV);vec3 XYZ=AP1_to_XYZ_MAT*linearCV;XYZ=D60_to_D65_MAT*XYZ;linearCV=XYZ_to_REC709_MAT*XYZ;linearCV=clamp(linearCV,vec3(0.0),vec3(1.0));return linearCV;}\n#endif\n";

    var ACESGLSL = "\n#if !defined(ACES_lib)\n#define ACES_lib\n#include \"ACES_TransformCommon.glsl\";\n#include \"ACES_UtillitiesColor.glsl\";\n#include \"ACES_Tonescales.glsl\";\n#include \"ACES_RRT.glsl\";\n#include \"ACES_ODT_sRGB_100nits.glsl\";\nvec3 sRGB_to_AP0(vec3 sRGB){return sRGB_to_AP0_MAT*sRGB;}vec3 sRGB_to_AP1(vec3 sRGB){return sRGB_to_AP1_MAT*sRGB;}\n#endif\n";

    class ACESShaderLib {
        static init() {
            Laya.Shader3D.addInclude("ACES_UtillitiesColor.glsl", UtillitiesColorGLSL);
            Laya.Shader3D.addInclude("ACES_TransformCommon.glsl", TransformCommonGLSL);
            Laya.Shader3D.addInclude("ACES_Tonescales.glsl", TonescalesGLSL);
            Laya.Shader3D.addInclude("ACES_RRTCommon.glsl", RRTCommonGLSL);
            Laya.Shader3D.addInclude("ACES_ODTCommon.glsl", ODTCommonGLSL);
            Laya.Shader3D.addInclude("ACES_RRT.glsl", RRTGLSL);
            Laya.Shader3D.addInclude("ACES_ODT_sRGB_100nits.glsl", ODT_sRGB_100nits_GLSL);
            Laya.Shader3D.addInclude("ACES.glsl", ACESGLSL);
        }
    }

    exports.ToneMappingType = void 0;
    (function (ToneMappingType) {
        ToneMappingType[ToneMappingType["None"] = 0] = "None";
        ToneMappingType[ToneMappingType["ACES"] = 1] = "ACES";
    })(exports.ToneMappingType || (exports.ToneMappingType = {}));
    class ColorGradEffect extends Laya.PostProcessEffect {
        static init() {
            ColorGradEffect.__initDefine__();
            Laya.Shader3D.addInclude("ColorGrading.glsl", ColorGradingGLSL);
            Laya.Shader3D.addInclude("Tonemapping.glsl", TonemappingGLSL);
            Laya.Shader3D.addInclude("LUT.glsl", LUTGLSL);
            Laya.SubShader.regIncludeBindUnifrom("ColorGrading.glsl", {
                "u_ColorBalance": Laya.ShaderDataType.Vector3,
                "u_SplitShadows": Laya.ShaderDataType.Vector4,
                "u_Splithighlights": Laya.ShaderDataType.Vector3,
                "u_Shadows": Laya.ShaderDataType.Vector3,
                "u_Midtones": Laya.ShaderDataType.Vector3,
                "u_Highlights": Laya.ShaderDataType.Vector3,
                "u_Limits": Laya.ShaderDataType.Vector4,
                "u_Lift": Laya.ShaderDataType.Vector3,
                "u_Gamma": Laya.ShaderDataType.Vector3,
                "u_Gain": Laya.ShaderDataType.Vector3,
                "u_ColorFilter": Laya.ShaderDataType.Color,
                "u_HueSatCon": Laya.ShaderDataType.Vector4,
            }, {});
            let attributeMap = {
                "a_PositionTexcoord": [Laya.VertexMesh.MESH_POSITION0, Laya.ShaderDataType.Vector4]
            };
            let uniformMap = {
                "u_OffsetScale": Laya.ShaderDataType.Vector4,
                "u_MainTex": Laya.ShaderDataType.Texture2D,
                "u_MainTex_TexelSize": Laya.ShaderDataType.Vector4,
                "u_Lut": Laya.ShaderDataType.Texture2D,
                "u_LutParams": Laya.ShaderDataType.Vector4,
                "u_CustomLut": Laya.ShaderDataType.Texture2D,
                "u_CustomLutParams": Laya.ShaderDataType.Vector4,
            };
            let shader = Laya.Shader3D.add("blitLUTShader");
            shader.shaderType = Laya.ShaderFeatureType.PostProcess;
            let subShader = new Laya.SubShader(attributeMap, uniformMap);
            shader.addSubShader(subShader);
            let pass = subShader.addShaderPass(BlitScreenVS, BlitLUTShader);
            pass.renderState.depthTest = Laya.RenderState.DEPTHTEST_ALWAYS;
            pass.renderState.depthWrite = false;
            pass.renderState.cull = Laya.RenderState.CULL_NONE;
            pass.renderState.blend = Laya.RenderState.BLEND_DISABLE;
            ColorGradEffect.lutBuilderInit();
        }
        static lutBuilderInit() {
            let uniformMap = {
                "u_OffsetScale": Laya.ShaderDataType.Vector4,
                "u_Lut": Laya.ShaderDataType.Texture2D,
                "u_LutParams": Laya.ShaderDataType.Vector4,
            };
            let attributeMap = {
                "a_PositionTexcoord": [Laya.VertexMesh.MESH_POSITION0, Laya.ShaderDataType.Vector4]
            };
            let shader = Laya.Shader3D.add("LUTBuilder");
            shader.shaderType = Laya.ShaderFeatureType.PostProcess;
            let subShader = new Laya.SubShader(attributeMap, uniformMap);
            shader.addSubShader(subShader);
            let pass = subShader.addShaderPass(BlitScreenVS, LUTBuilderFS);
            pass.renderState.depthTest = Laya.RenderState.DEPTHTEST_ALWAYS;
            pass.renderState.depthWrite = false;
            pass.renderState.cull = Laya.RenderState.CULL_NONE;
            pass.renderState.blend = Laya.RenderState.BLEND_DISABLE;
            pass.statefirst = true;
        }
        static __initDefine__() {
            ColorGradEffect.SHADERDEFINE_ACES = Laya.Shader3D.getDefineByName("ACES");
            ColorGradEffect.SHADERDEFINE_CUSTOMLUT = Laya.Shader3D.getDefineByName("CUSTOMLUT");
            ColorGradEffect.SHADERVALUE_LUT = Laya.Shader3D.propertyNameToID("u_Lut");
            ColorGradEffect.SHADERVALUE_LUTPARAMS = Laya.Shader3D.propertyNameToID("u_LutParams");
            ColorGradEffect.SHADERVALUE_CUSTOMLUT = Laya.Shader3D.propertyNameToID("u_CustomLut");
            ColorGradEffect.SHADERVALUE_CUSTOMLUTPARAMS = Laya.Shader3D.propertyNameToID("u_CustomLutParams");
        }
        get toneMapping() {
            return this._toneMapping;
        }
        set toneMapping(value) {
            if (value == this._toneMapping)
                return;
            this._needBuildLUT = true;
            this._toneMapping = value;
        }
        get enableSplitTone() {
            return this._enableSplitTone;
        }
        set enableSplitTone(value) {
            this._enableSplitTone = value;
            this._needBuildLUT = true;
        }
        get splitShadow() {
            return this._splitShadow;
        }
        set splitShadow(value) {
            this._needBuildLUT = true;
            value.cloneTo(this._splitShadow);
        }
        get splithighlights() {
            return this._splithighlights;
        }
        set splithighlights(value) {
            if (this._splithighlights.equal(value))
                return;
            this._needBuildLUT = true;
            value.cloneTo(this._splithighlights);
        }
        get splitBalance() {
            return this._splitBalance;
        }
        set splitBalance(value) {
            this._needBuildLUT = true;
            this._splitBalance = value;
        }
        get enableSMH() {
            return this._enableSMH;
        }
        set enableSMH(value) {
            this._needBuildLUT = true;
            this._enableSMH = value;
        }
        get shadows() {
            return this._shadows;
        }
        set shadows(value) {
            if (this._shadows.equal(value))
                return;
            this._needBuildLUT = true;
            value.cloneTo(this._shadows);
        }
        get midtones() {
            return this._midtones;
        }
        set midtones(value) {
            if (this._midtones.equal(value))
                return;
            this._needBuildLUT = true;
            value.cloneTo(this._midtones);
        }
        get highlights() {
            return this._highlights;
        }
        set highlights(value) {
            if (this._highlights.equal(value))
                return;
            this._needBuildLUT = true;
            value.cloneTo(this._highlights);
        }
        get shadowLimitStart() {
            return this._limits.x;
        }
        set shadowLimitStart(value) {
            this._needBuildLUT = true;
            this._limits.x = Math.min(value, this.shadowLimitEnd);
        }
        get shadowLimitEnd() {
            return this._limits.y;
        }
        set shadowLimitEnd(value) {
            this._needBuildLUT = true;
            this._limits.y = Math.max(value, this.shadowLimitStart);
        }
        get highLightLimitStart() {
            return this._limits.z;
        }
        set highLightLimitStart(value) {
            this._needBuildLUT = true;
            this._limits.z = Math.min(value, this.highLightLimitEnd);
        }
        get highLightLimitEnd() {
            return this._limits.w;
        }
        set highLightLimitEnd(value) {
            this._needBuildLUT = true;
            this._limits.w = Math.max(this.highLightLimitStart, value);
        }
        get enableLiftGammaGain() {
            return this._enableLiftGammaGain;
        }
        set enableLiftGammaGain(value) {
            this._needBuildLUT = true;
            this._enableLiftGammaGain = value;
        }
        get lift() {
            return this._lift;
        }
        set lift(value) {
            if (this.lift.equal(value))
                return;
            this._needBuildLUT = true;
            value.cloneTo(this._lift);
        }
        get gamma() {
            return this._gamma;
        }
        set gamma(value) {
            if (this._gamma.equal(value))
                return;
            this._needBuildLUT = true;
            value.cloneTo(this._gamma);
        }
        get gain() {
            return this._gain;
        }
        set gain(value) {
            if (this._gain.equal(value))
                return;
            this._needBuildLUT = true;
            value.cloneTo(this._gain);
        }
        _StandardIlluminantY(x) {
            return 2.87 * x - 3 * x * x - 0.27509507;
        }
        ;
        _CIExyToLMS(x, y) {
            let Y = 1;
            let X = Y * x / y;
            let Z = Y * (1 - x - y) / y;
            let L = 0.7328 * X + 0.4296 * Y - 0.1624 * Z;
            let M = -0.7036 * X + 1.6975 * Y + 0.0061 * Z;
            let S = 0.0030 * X + 0.0136 * Y + 0.9834 * Z;
            return new Laya.Vector3(L, M, S);
        }
        _ColorBalanceToLMSCoeffs(temperature, tint) {
            let t1 = temperature / 65.0;
            let t2 = tint / 65.0;
            let x = 0.31271 - t1 * (t1 < 0 ? 0.1 : 0.05);
            let y = this._StandardIlluminantY(x) + t2 * 0.05;
            let w1 = new Laya.Vector3(0.949237, 1.03542, 1.08728);
            let w2 = this._CIExyToLMS(x, y);
            this._balance.set(w1.x / w2.x, w1.y / w2.y, w1.z / w2.z);
        }
        get enableBalance() {
            return this._enableBalance;
        }
        set enableBalance(value) {
            this._needBuildLUT = true;
            this._enableBalance = value;
        }
        get tint() {
            return this._tint;
        }
        set tint(value) {
            this._needBuildLUT = true;
            this._tint = value;
            this._ColorBalanceToLMSCoeffs(this._temperature, this._tint);
        }
        get temperature() {
            return this._temperature;
        }
        set temperature(value) {
            this._needBuildLUT = true;
            this._temperature = value;
            this._ColorBalanceToLMSCoeffs(this._temperature, this._tint);
        }
        get enableColorAdjust() {
            return this._enableColorAdjust;
        }
        set enableColorAdjust(value) {
            this._needBuildLUT = true;
            this._enableColorAdjust = value;
        }
        get postExposure() {
            return this._postExposure;
        }
        set postExposure(value) {
            this._postExposure = value;
        }
        get contrast() {
            return this._contrast;
        }
        set contrast(value) {
            this._needBuildLUT = true;
            this._contrast = value;
        }
        get colorFilter() {
            return this._colorFilter;
        }
        set colorFilter(value) {
            this._needBuildLUT = true;
            value.cloneTo(this._colorFilter);
        }
        get HueShift() {
            return this._HueShift;
        }
        set HueShift(value) {
            this._needBuildLUT = true;
            this._HueShift = value;
        }
        get saturation() {
            return this._saturation;
        }
        set saturation(value) {
            this._needBuildLUT = true;
            this._saturation = value;
        }
        constructor() {
            super();
            this._needBuildLUT = false;
            this._lutSize = 32;
            this._enableSplitTone = false;
            this._splitShadow = new Laya.Vector3(0.5, 0.5, 0.5);
            this._splitBalance = 0;
            this._splithighlights = new Laya.Vector3(0.5, 0.5, 0.5);
            this._u_SplitShadow = new Laya.Vector4(0, 0, 0);
            this._enableSMH = false;
            this._shadows = new Laya.Vector3(1, 1, 1);
            this._midtones = new Laya.Vector3(1, 1, 1);
            this._highlights = new Laya.Vector3(1, 1, 1);
            this._limits = new Laya.Vector4(0, 0.33, 0.55, 1);
            this._enableLiftGammaGain = false;
            this._lift = new Laya.Vector3(0, 0, 0);
            this._gamma = new Laya.Vector3(1, 1, 1);
            this._gain = new Laya.Vector3(1, 1, 1);
            this._enableBalance = false;
            this._balance = new Laya.Vector3();
            this._tint = 0;
            this._temperature = 0;
            this._enableColorAdjust = false;
            this._postExposure = 1;
            this._contrast = 1;
            this._colorFilter = new Laya.Color(1, 1, 1);
            this._HueShift = 0;
            this._saturation = 1;
            this._HueSatCon = new Laya.Vector4(0, 1, 1, 0);
            this.default_balance = new Laya.Vector3(1, 1, 1);
            this.default_splitShadow = new Laya.Vector4(0.5, 0.5, 0.5, 0.0);
            this.default_splithighlights = new Laya.Vector3(0.5, 0.5, 0.5);
            this.default_shadow = new Laya.Vector3(1, 1, 1);
            this.default_midtones = new Laya.Vector3(1, 1, 1);
            this.default_highlight = new Laya.Vector3(1, 1, 1);
            this.default_limint = new Laya.Vector4(0.0, 0.3, 0.55, 1.0);
            this.default_lift = new Laya.Vector3(0, 0, 0);
            this.default_gamma = new Laya.Vector3(1, 1, 1);
            this.default_gain = new Laya.Vector3(1, 1, 1);
            this.default_ColorFilter = new Laya.Color(1, 1, 1, 1);
            this.default_HueSatCon = new Laya.Vector4(0, 1, 1, 0);
            this._singleton = true;
            this.active = true;
            this._needBuildLUT = true;
            this._toneMapping = exports.ToneMappingType.None;
            this._blitlutParams = new Laya.Vector4();
            this._lutShaderData = Laya.LayaGL.renderDeviceFactory.createShaderData(null);
            this.lutSize = 32;
            this._lutBuilderMat = new Laya.Material();
            this._lutBuilderMat.lock = true;
        }
        get lutSize() {
            return this._lutSize;
        }
        set lutSize(value) {
            if (value > 32)
                return;
            this._lutSize = value;
            if (this._lutTex)
                this._lutTex.destroy();
            this._lutTex = new Laya.RenderTexture(this._lutSize * this._lutSize, this._lutSize, Laya.RenderTargetFormat.R16G16B16A16, null, false, 1, false, false);
            this._lutTex.anisoLevel = 1;
            this._lutTex.wrapModeU = Laya.WrapMode.Clamp;
            this._lutTex.wrapModeV = Laya.WrapMode.Clamp;
            this._lutTex.filterMode = Laya.FilterMode.Bilinear;
        }
        _buildLUT() {
            if (!this._needBuildLUT)
                return;
            let lutHeight = this.lutSize;
            let lutWidth = this.lutSize * this.lutSize;
            let lutParams = new Laya.Vector4(lutHeight, 0.5 / lutWidth, 0.5 / lutHeight, lutHeight / (lutHeight - 1));
            this._lutBuilderMat.setVector4("u_LutParams", lutParams);
            if (this.enableBalance) {
                this._ColorBalanceToLMSCoeffs(this.temperature, this.tint);
                this._lutBuilderMat.setVector3("u_ColorBalance", this._balance);
            }
            else {
                this._lutBuilderMat.setVector3("u_ColorBalance", this.default_balance);
            }
            if (this.enableSplitTone) {
                this._u_SplitShadow.setValue(this._splitShadow.x, this._splitShadow.y, this._splitShadow.z, this.splitBalance);
                this._lutBuilderMat.setVector4("u_SplitShadows", this._u_SplitShadow);
                this._lutBuilderMat.setVector3("u_Splithighlights", this._splithighlights);
            }
            else {
                this._lutBuilderMat.setVector4("u_SplitShadows", this.default_splitShadow);
                this._lutBuilderMat.setVector3("u_Splithighlights", this.default_splithighlights);
            }
            if (this.enableSMH) {
                this._lutBuilderMat.setVector3("u_Shadows", this._shadows);
                this._lutBuilderMat.setVector3("u_Midtones", this._midtones);
                this._lutBuilderMat.setVector3("u_Highlights", this._highlights);
                this._lutBuilderMat.setVector4("u_Limits", this._limits);
            }
            else {
                this._lutBuilderMat.setVector3("u_Shadows", this.default_shadow);
                this._lutBuilderMat.setVector3("u_Midtones", this.default_midtones);
                this._lutBuilderMat.setVector3("u_Highlights", this.default_highlight);
                this._lutBuilderMat.setVector4("u_Limits", this.default_limint);
            }
            if (this._enableLiftGammaGain) {
                this._lutBuilderMat.setVector3("u_Lift", this._lift);
                this._lutBuilderMat.setVector3("u_Gamma", this._gamma);
                this._lutBuilderMat.setVector3("u_Gain", this._gain);
            }
            else {
                this._lutBuilderMat.setVector3("u_Lift", this.default_lift);
                this._lutBuilderMat.setVector3("u_Gamma", this.default_gamma);
                this._lutBuilderMat.setVector3("u_Gain", this.default_gain);
            }
            if (this.enableColorAdjust) {
                this._HueSatCon.setValue(this._HueShift, this.saturation, this._contrast, 0.0);
                this._lutBuilderMat.setColor("u_ColorFilter", this._colorFilter);
                this._lutBuilderMat.setVector4("u_HueSatCon", this._HueSatCon);
            }
            else {
                this._lutBuilderMat.setColor("u_ColorFilter", this.default_ColorFilter);
                this._lutBuilderMat.setVector4("u_HueSatCon", this.default_HueSatCon);
            }
            if (this._toneMapping == exports.ToneMappingType.ACES) {
                this._lutBuilderMat.addDefine(ColorGradEffect.SHADERDEFINE_ACES);
            }
            else {
                this._lutBuilderMat.removeDefine(ColorGradEffect.SHADERDEFINE_ACES);
            }
            this._postProcess._context.command.blitScreenQuadByMaterial(Laya.Texture2D.whiteTexture, this._lutTex, null, this._lutBuilderMat);
        }
        effectInit(postprocess) {
            super.effectInit(postprocess);
            this._lutBuilderMat.setShaderName("LUTBuilder");
            this._LUTShader = Laya.Shader3D.find("blitLUTShader");
            postprocess._enableColorGrad = true;
            postprocess._ColorGradEffect = this;
            this._postProcess = postprocess;
        }
        release(postprocess) {
            super.release(postprocess);
            postprocess._enableColorGrad = false;
            postprocess._ColorGradEffect = null;
            this._lutBuilderMat.lock = false;
        }
        render(context) {
            let cmd = context.command;
            let source = context.indirectTarget;
            {
                this._blitlutParams.setValue(1 / this._lutTex.width, 1 / this._lutTex.height, this._lutTex.height - 1, this.enableColorAdjust ? this._postExposure : 1);
                this._lutBuilderMat.removeDefine(ColorGradEffect.SHADERDEFINE_CUSTOMLUT);
                this._lutShaderData.setTexture(ColorGradEffect.SHADERVALUE_LUT, this._lutTex);
                this._lutShaderData.setVector(ColorGradEffect.SHADERVALUE_LUTPARAMS, this._blitlutParams);
            }
            cmd.blitScreenTriangle(source, context.destination, null, this._LUTShader, this._lutShaderData);
        }
    }
    Laya.Laya.addInitCallback(() => ACESShaderLib.init());
    Laya.Laya.addInitCallback(() => ColorGradEffect.init());

    var FullScreenVert = "#define SHADER_NAME SCREENVS\nvarying vec2 v_Texcoord0;vec4 remapPositionZ(vec4 position){return position;}void main(){gl_Position=vec4(u_OffsetScale.x*2.0-1.0+(a_PositionTexcoord.x+1.0)*u_OffsetScale.z,(1.0-((u_OffsetScale.y*2.0-1.0+(-a_PositionTexcoord.y+1.0)*u_OffsetScale.w)+1.0)/2.0)*2.0-1.0,0.0,1.0);v_Texcoord0=a_PositionTexcoord.zw;gl_Position=remapPositionZ(gl_Position);}";

    var CoCFS = "#define SHADER_NAME COCFS\n#include \"Camera.glsl\";\nvarying vec2 v_Texcoord0;float Linear01Depth(float z,vec4 zbufferParams){return 1.0/(zbufferParams.x*z+zbufferParams.y);}float LinearEyeDepth(float z,vec4 zbufferParams){return 1.0/(zbufferParams.z*z+zbufferParams.w);}float DecodeFloatRG(vec2 enc){vec2 kDecodeDot=vec2(1.0,1.0/255.0);return dot(enc,kDecodeDot);}void DecodeDepthNormal(vec4 enc,out float depth){depth=DecodeFloatRG(enc.zw);}void main(){vec2 uv=v_Texcoord0;\n#ifdef CAMERA_NORMALDEPTH\nvec4 depthNormal=texture2D(u_CameraDepthNormalTexture,uv);float depth=0.0;DecodeDepthNormal(depthNormal,depth);depth=((1.0/depth)-u_ZBufferParams.y)*(1.0/u_ZBufferParams.x);\n#else\nfloat depth=texture2D(u_CameraDepthTexture,uv).x;\n#endif\ndepth=LinearEyeDepth(depth,u_ZBufferParams);float farStart=u_CoCParams.x;float farEnd=u_CoCParams.y;float coc=(depth-farStart)/(farEnd-farStart);coc=clamp(coc,0.0,1.0);gl_FragColor=vec4(coc,coc,coc,1.0);}";

    var PrefilterFS = "#define SHADER_NAME PrefilterFS\n#include \"Color.glsl\";\nvarying vec2 v_Texcoord0;const int kCount=5;vec2 kTaps[5];void main(){kTaps[0]=vec2(0.0,0.0);kTaps[1]=vec2(0.9,-0.4);kTaps[2]=vec2(-0.9,0.4);kTaps[3]=vec2(0.4,0.9);kTaps[4]=vec2(-0.4,-0.9);vec3 colorAcc=vec3(0.0);float farCoCAcc=0.0;for(int i=0;i<kCount;i++){vec2 uv=u_MainTex_TexelSize.xy*kTaps[i]+v_Texcoord0;vec3 tapColor=texture2D(u_MainTex,uv).rgb;\n#ifdef Gamma_u_MainTex\ntapColor=gammaToLinear(tapColor);\n#endif\nfloat coc=texture2D(u_FullCoCTex,uv).r;colorAcc+=tapColor*coc;farCoCAcc+=coc;}vec3 color=colorAcc*(1.0/float(kCount));float farCoC=farCoCAcc*(1.0/float(kCount));gl_FragColor=vec4(color,farCoC);gl_FragColor=outputTransform(gl_FragColor);}";

    var BlurVFS = "#define SHADER_NAME BlurVFS\n#include \"Color.glsl\";\nvarying vec2 v_Texcoord0;const int kTapCount=3;float kOffsets[3];float kCoeffs[3];vec4 Blur(vec2 dir,float premultiply){kOffsets[0]=-1.33333333;kOffsets[1]=0.00000000;kOffsets[2]=1.33333333;kCoeffs[0]=0.35294118;kCoeffs[1]=0.29411765;kCoeffs[2]=0.3529411;vec2 uv=v_Texcoord0;vec4 halfColor=texture2D(u_MainTex,uv);\n#ifdef Gamma_u_MainTex\nhalfColor=gammaToLinear(halfColor);\n#endif\nfloat samp0CoC=halfColor.a;float maxRadius=u_CoCParams.z;vec2 offset=u_SourceSize.zw*dir*samp0CoC*maxRadius;vec4 acc=vec4(0.0);for(int i=0;i<kTapCount;i++){vec2 sampCoord=uv+kOffsets[i]*offset;vec4 samp=texture2D(u_MainTex,sampCoord);\n#ifdef Gamma_u_MainTex\nsamp=gammaToLinear(samp);\n#endif\nfloat sampCoC=samp.w;vec3 sampColor=samp.xyz;float weight=clamp(1.0-(samp0CoC-sampCoC),0.0,1.0);acc+=vec4(sampColor,1.0)*kCoeffs[i]*weight;}acc.xyz/=acc.w+1e-4;return vec4(acc.xyz,1.0);}void main(){gl_FragColor=Blur(vec2(0.0,1.0),0.0);gl_FragColor=outputTransform(gl_FragColor);}";

    var BlurHFS = "#define SHADER_NAME BlurHFS\n#include \"Color.glsl\";\nvarying vec2 v_Texcoord0;const int kTapCount=3;float kOffsets[3];float kCoeffs[3];vec4 Blur(vec2 dir,float premultiply){kOffsets[0]=-1.33333333;kOffsets[1]=0.00000000;kOffsets[2]=1.33333333;kCoeffs[0]=0.35294118;kCoeffs[1]=0.29411765;kCoeffs[2]=0.3529411;vec2 uv=v_Texcoord0;vec4 halfColor=texture2D(u_MainTex,uv);\n#ifdef Gamma_u_MainTex\nhalfColor=gammaToLinear(halfColor);\n#endif\nfloat samp0CoC=halfColor.a;float maxRadius=u_CoCParams.z;vec2 offset=u_SourceSize.zw*dir*samp0CoC*maxRadius;vec4 acc=vec4(0.0);for(int i=0;i<kTapCount;i++){vec2 sampCoord=uv+kOffsets[i]*offset;vec4 samp=texture2D(u_MainTex,sampCoord);\n#ifdef Gamma_u_MainTex\nsamp=gammaToLinear(samp);\n#endif\nfloat sampCoC=samp.a;vec3 sampColor=samp.rgb;float weight=clamp(1.0-(samp0CoC-sampCoC),0.0,1.0);acc+=vec4(sampColor,sampCoC)*kCoeffs[i]*weight;}acc.xyz/=acc.w+1e-4;return vec4(acc.xyz,samp0CoC);}void main(){gl_FragColor=Blur(vec2(1.0,0.0),1.0);gl_FragColor=outputTransform(gl_FragColor);}";

    var CompositeFS = "#define SHADER_NAME CompositeFS\n#include \"Color.glsl\";\nvarying vec2 v_Texcoord0;void main(){vec2 uv=v_Texcoord0;vec3 baseColor=texture2D(u_MainTex,uv).rgb;\n#ifdef Gamma_u_MainTex\nbaseColor=gammaToLinear(baseColor);\n#endif\nvec4 samplevalue=texture2D(u_BlurCoCTex,uv);vec3 farColor=samplevalue.rgb;float coc=texture2D(u_FullCoCTex,uv).r;vec3 dstColor=vec3(0.0);float dstAlpha=1.0;float blend=sqrt(coc*3.14*2.0);dstColor=farColor*clamp(blend,0.0,1.0);dstAlpha=clamp(1.0-blend,0.0,1.0);gl_FragColor=vec4(baseColor*dstAlpha+dstColor,1.0);gl_FragColor=outputTransform(gl_FragColor);}";

    class GaussianDoF extends Laya.PostProcessEffect {
        get renderBeforeTAA() {
            return true;
        }
        static init() {
            GaussianDoF.SOURCESIZE = Laya.Shader3D.propertyNameToID("u_SourceSize");
            GaussianDoF.COCPARAMS = Laya.Shader3D.propertyNameToID("u_CoCParams");
            GaussianDoF.DEPTHTEXTURE = Laya.Shader3D.propertyNameToID("u_CameraDepthTexture");
            GaussianDoF.NORMALDEPTHTEXTURE = Laya.Shader3D.propertyNameToID("u_CameraDepthNormalTexture");
            GaussianDoF.FULLCOCTEXTURE = Laya.Shader3D.propertyNameToID("u_FullCoCTex");
            GaussianDoF.DOWNSAMPLESCALE = Laya.Shader3D.propertyNameToID("u_DownSampleScale");
            GaussianDoF.BLURCOCTEXTURE = Laya.Shader3D.propertyNameToID("u_BlurCoCTex");
            GaussianDoF.SHADERDEFINE_DEPTHNORMALTEXTURE = Laya.Shader3D.getDefineByName("CAMERA_NORMALDEPTH");
            let attributeMap = {
                'a_PositionTexcoord': [Laya.VertexMesh.MESH_POSITION0, Laya.ShaderDataType.Vector4],
            };
            let uniformMap = {
                "u_MainTex": Laya.ShaderDataType.Texture2D,
                "u_MainTex_TexelSize": Laya.ShaderDataType.Vector4,
                "u_OffsetScale": Laya.ShaderDataType.Vector4,
                "u_CoCParams": Laya.ShaderDataType.Vector3,
                "u_FullCoCTex": Laya.ShaderDataType.Texture2D,
                "u_SourceSize": Laya.ShaderDataType.Vector4,
                "u_DownSampleScale": Laya.ShaderDataType.Vector4,
                "u_BlurCoCTex": Laya.ShaderDataType.Texture2D,
            };
            let shader = Laya.Shader3D.add("GaussianDoF");
            shader.shaderType = Laya.ShaderFeatureType.PostProcess;
            let cocSubShader = new Laya.SubShader(attributeMap, uniformMap);
            shader.addSubShader(cocSubShader);
            let cocPass = cocSubShader.addShaderPass(FullScreenVert, CoCFS);
            cocPass.statefirst = true;
            cocPass.renderState.cull = Laya.RenderState.CULL_NONE;
            let prefilterSubShader = new Laya.SubShader(attributeMap, uniformMap);
            shader.addSubShader(prefilterSubShader);
            let prefilterPass = prefilterSubShader.addShaderPass(FullScreenVert, PrefilterFS);
            prefilterPass.statefirst = true;
            prefilterPass.renderState.cull = Laya.RenderState.CULL_NONE;
            let blurHSubShader = new Laya.SubShader(attributeMap, uniformMap);
            shader.addSubShader(blurHSubShader);
            let blurHPass = blurHSubShader.addShaderPass(FullScreenVert, BlurHFS);
            blurHPass.statefirst = true;
            blurHPass.renderState.cull = Laya.RenderState.CULL_NONE;
            let blurVSubShader = new Laya.SubShader(attributeMap, uniformMap);
            shader.addSubShader(blurVSubShader);
            let blurVPass = blurVSubShader.addShaderPass(FullScreenVert, BlurVFS);
            blurVPass.statefirst = true;
            blurVPass.renderState.cull = Laya.RenderState.CULL_NONE;
            let compositeSubShader = new Laya.SubShader(attributeMap, uniformMap);
            shader.addSubShader(compositeSubShader);
            let compositePass = compositeSubShader.addShaderPass(FullScreenVert, CompositeFS);
            compositePass.statefirst = true;
            compositePass.renderState.cull = Laya.RenderState.CULL_NONE;
        }
        constructor() {
            super();
            this._shader = Laya.Shader3D.find("GaussianDoF");
            this._shaderData = Laya.LayaGL.renderDeviceFactory.createShaderData(null);
            this._cocParams = new Laya.Vector3(10, 30, 1);
            this._shaderData.setVector3(GaussianDoF.COCPARAMS, this._cocParams);
            this._sourceSize = new Laya.Vector4();
            this._dowmSampleScale = new Laya.Vector4();
        }
        get farStart() {
            return this._cocParams.x;
        }
        set farStart(value) {
            this._cocParams.x = value;
            this._shaderData.setVector3(GaussianDoF.COCPARAMS, this._cocParams);
        }
        get farEnd() {
            return this._cocParams.y;
        }
        set farEnd(value) {
            this._cocParams.y = Math.max(this._cocParams.x, value);
            this._shaderData.setVector3(GaussianDoF.COCPARAMS, this._cocParams);
        }
        get maxRadius() {
            return this._cocParams.z;
        }
        set maxRadius(value) {
            this._cocParams.z = Number.isNaN(value) ? 0 : Math.max(0, Math.min(value, 2));
            this._shaderData.setVector3(GaussianDoF.COCPARAMS, this._cocParams);
        }
        _setupShaderValue(context) {
            context.camera;
            this._dowmSampleScale.setValue(0.5, 0.5, 2.0, 2.0);
            this._shaderData.setVector(GaussianDoF.DOWNSAMPLESCALE, this._dowmSampleScale);
        }
        getCameraDepthTextureModeFlag() {
            return Laya.DepthTextureMode.Depth;
        }
        render(context) {
            let cmd = context.command;
            this._setupShaderValue(context);
            let source = context.indirectTarget;
            let shader = this._shader;
            let shaderData = this._shaderData;
            let dataTexFormat = Laya.RenderTargetFormat.R16G16B16A16;
            let fullCoC = Laya.RenderTexture.createFromPool(source.width, source.height, dataTexFormat, Laya.RenderTargetFormat.None, false, 1);
            cmd.blitScreenTriangle(source, fullCoC, null, shader, shaderData, 0);
            fullCoC.filterMode = Laya.FilterMode.Bilinear;
            this._shaderData.setTexture(GaussianDoF.FULLCOCTEXTURE, fullCoC);
            let prefilterTex = Laya.RenderTexture.createFromPool(source.width / 2, source.height / 2, dataTexFormat, Laya.RenderTargetFormat.None, false, 1);
            cmd.blitScreenTriangle(source, prefilterTex, null, shader, shaderData, 1);
            prefilterTex.filterMode = Laya.FilterMode.Bilinear;
            this._sourceSize.setValue(prefilterTex.width, prefilterTex.height, 1.0 / prefilterTex.width, 1.0 / prefilterTex.height);
            this._shaderData.setShaderData(GaussianDoF.SOURCESIZE, Laya.ShaderDataType.Vector4, this._sourceSize);
            let blurHTex = Laya.RenderTexture.createFromPool(prefilterTex.width, prefilterTex.height, dataTexFormat, Laya.RenderTargetFormat.None, false, 1);
            cmd.blitScreenTriangle(prefilterTex, blurHTex, null, this._shader, this._shaderData, 2);
            let blurVTex = Laya.RenderTexture.createFromPool(prefilterTex.width, prefilterTex.height, dataTexFormat, Laya.RenderTargetFormat.None, false, 1);
            cmd.blitScreenTriangle(blurHTex, blurVTex, null, this._shader, this._shaderData, 3);
            blurVTex.filterMode = Laya.FilterMode.Bilinear;
            blurVTex.anisoLevel = 1;
            fullCoC.filterMode = Laya.FilterMode.Point;
            this._shaderData.setTexture(GaussianDoF.BLURCOCTEXTURE, blurVTex);
            cmd.blitScreenTriangle(source, context.destination, null, this._shader, this._shaderData, 4);
            Laya.RenderTexture.recoverToPool(fullCoC);
            Laya.RenderTexture.recoverToPool(prefilterTex);
            Laya.RenderTexture.recoverToPool(blurHTex);
            Laya.RenderTexture.recoverToPool(blurVTex);
        }
    }
    Laya.Laya.addInitCallback(() => GaussianDoF.init());

    class LensFlareElementGeomtry extends Laya.GeometryElement {
        static init() {
            let quadSize = 0.1;
            LensFlareElementGeomtry.lensQuadVertices = new Float32Array([
                quadSize, quadSize, 1, 1,
                -quadSize, quadSize, 0, 1,
                -quadSize, -quadSize, 0, 0,
                quadSize, -quadSize, 1, 0
            ]);
            LensFlareElementGeomtry.lensQuadIndex = new Uint16Array([0, 2, 1, 0, 3, 2]);
            LensFlareElementGeomtry.vertexDeclaration = new Laya.VertexDeclaration(16, [new Laya.VertexElement(0, Laya.VertexElementFormat.Vector4, 0)]);
            LensFlareElementGeomtry.instanceVertexDeclaration = new Laya.VertexDeclaration(16, [new Laya.VertexElement(0, Laya.VertexElementFormat.Vector4, 1)]);
        }
        constructor() {
            super(Laya.MeshTopology.Triangles, Laya.DrawType.DrawElementInstance);
            this.indexFormat = Laya.IndexFormat.UInt16;
            this._createBuffer();
        }
        _createBuffer() {
            this._vertexBuffer = Laya.Laya3DRender.renderOBJCreate.createVertexBuffer3D(LensFlareElementGeomtry.lensQuadVertices.length * 4, Laya.BufferUsage.Dynamic, false);
            this._vertexBuffer.vertexDeclaration = LensFlareElementGeomtry.vertexDeclaration;
            this._vertexBuffer.setData(LensFlareElementGeomtry.lensQuadVertices.buffer);
            this._instanceVertexBuffer = Laya.Laya3DRender.renderOBJCreate.createVertexBuffer3D(LensFlareElementGeomtry.lensFlareElementMax * 4 * 4, Laya.BufferUsage.Dynamic, false);
            this._instanceVertexBuffer.instanceBuffer = true;
            this._instanceVertexBuffer.vertexDeclaration = LensFlareElementGeomtry.instanceVertexDeclaration;
            this._indexBuffer = Laya.Laya3DRender.renderOBJCreate.createIndexBuffer3D(Laya.IndexFormat.UInt16, LensFlareElementGeomtry.lensQuadIndex.length, Laya.BufferUsage.Static, false);
            this._indexBuffer.setData(LensFlareElementGeomtry.lensQuadIndex);
            this.bufferState = new Laya.BufferState();
            this.bufferState.applyState([this._vertexBuffer, this._instanceVertexBuffer], this._indexBuffer);
            this._updateRenderParams(null);
        }
        get instanceBuffer() {
            return this._instanceVertexBuffer;
        }
        _getType() {
            return LensFlareElementGeomtry._type;
        }
        _prepareRender(state) {
            return true;
        }
        destroy() {
            super.destroy();
            this._vertexBuffer.destroy();
            this._instanceVertexBuffer.destroy();
            this.bufferState.destroy();
            this._indexBuffer.destroy();
        }
        _updateRenderParams(state) {
            this.clearRenderParams();
            this.setDrawElemenParams(LensFlareElementGeomtry.lensQuadIndex.length, 0);
        }
    }
    LensFlareElementGeomtry.PositionUV = 0;
    LensFlareElementGeomtry.PositionRotationScale = 1;
    LensFlareElementGeomtry.lensFlareElementMax = 20;
    LensFlareElementGeomtry._type = Laya.GeometryElement._typeCounter++;

    class LensFlareCMD {
        get instanceCount() {
            return this._instanceCount;
        }
        set instanceCount(value) {
            this._instanceCount = value;
        }
        constructor() {
            this._instanceCount = 1;
            this._transform3D = Laya.Laya3DRender.Render3DModuleDataFactory.createTransform(null);
            this._renderElement = new Laya.RenderElement();
            this._renderElement._renderElementOBJ.isRender = true;
            this._lensFlareGeometry = new LensFlareElementGeomtry();
            this._renderElement.setTransform(this._transform3D);
            this._renderElement.setGeometry(this._lensFlareGeometry);
            this._initMaterial();
        }
        _initMaterial() {
            this._materials = new Laya.Material();
            this._materials.lock = true;
            this._materials.setShaderName("LensFlare");
            this._materials.materialRenderMode = Laya.MaterialRenderMode.RENDERMODE_ADDTIVE;
            this._materials.depthTest = Laya.RenderState.DEPTHTEST_ALWAYS;
            this._materials.cull = Laya.RenderState.CULL_NONE;
            this._renderElement.material = this._materials;
            this._renderElement.subShaderIndex = 0;
        }
        set center(value) {
            this._materials.setVector2("u_FlareCenter", value);
        }
        set rotate(value) {
            this._materials.setFloat("u_rotate", value);
        }
        set edgeFade(value) {
            this._materials.setFloat("u_EdgeFade", value);
        }
        get lensFlareElement() {
            return this._lensFlareElementData;
        }
        set lensFlareElement(value) {
            this._lensFlareElementData = value;
            this.applyElementData();
        }
        applyElementData() {
            this._materials.setTexture("u_FlareTexture", this._lensFlareElementData.texture);
            this._materials.setColor("u_Tint", this._lensFlareElementData.tint);
            this._materials.setFloat("u_TintIntensity", this._lensFlareElementData.intensity);
            this._materials.setVector2("u_Postionoffset", this._lensFlareElementData.positionOffset);
            this._materials.setFloat("u_Angularoffset", this._lensFlareElementData.angularOffset);
            if (this._lensFlareElementData.autoRotate) {
                this._materials.addDefine(LensFlareEffect.SHADERDEFINE_AUTOROTATE);
            }
            else {
                this._materials.removeDefine(LensFlareEffect.SHADERDEFINE_AUTOROTATE);
            }
            this._lensFlareGeometry.instanceCount = 1;
            let testFloat = new Float32Array([this._lensFlareElementData.startPosition, Laya.Utils.toAngle(this._lensFlareElementData.rotation), this._lensFlareElementData.scale.x, this._lensFlareElementData.scale.y]);
            this._lensFlareGeometry.instanceBuffer.setData(testFloat.buffer, 0, 0, testFloat.length * 4);
        }
        run(cmd) {
            var context = Laya.RenderContext3D._instance;
            this._materials.setFloat("u_aspectRatio", context.camera.viewport.height / context.camera.viewport.width);
            cmd.drawRenderElement(this._renderElement);
        }
        recover() {
        }
        destroy() {
            this._materials.lock = false;
            this._materials.destroy();
        }
    }

    var LensFlareVS = "#define SHADER_NAME LENSFLARESVS\nvarying vec2 v_Texcoord0;vec2 rotateVector(vec2 pos,vec2 center,float angle){float cosAngle=cos(angle);float sinAngle=sin(angle);vec2 offset=pos-center;vec2 rotatedOffset=vec2(offset.x*cosAngle-offset.y*sinAngle,offset.x*sinAngle+offset.y*cosAngle);return center+rotatedOffset;}vec2 rotateVec2(float rad,vec2 pos){float s=sin(rad);float c=cos(rad);float x=pos.x*c-pos.y*s;float y=pos.x*s+c*pos.y;return vec2(x,y);}vec2 scaleVec2(vec2 scale,vec2 pos){float x=scale.x*pos.x;float y=scale.y*pos.y;return vec2(x,y);}vec2 transVec2(vec2 trans,vec2 pos){float x=pos.x+trans.x;float y=pos.y+trans.y;return vec2(x,y);}void main(){vec2 center=u_FlareCenter;vec2 deltaPos=-2.0*center;vec2 lenFlarePosition=vec2(a_PositionTexcoord.x,a_PositionTexcoord.y);vec2 aspectRadio=vec2(u_aspectRatio,1.0);vec2 scale=vec2(a_DistanceRotationScale.z,a_DistanceRotationScale.w);lenFlarePosition=scaleVec2(scale,lenFlarePosition);\n#ifdef LENSFLAREAUTOROTATE\nlenFlarePosition=rotateVec2(u_rotate,lenFlarePosition);float texRotate=a_DistanceRotationScale.y;lenFlarePosition=rotateVec2(texRotate,lenFlarePosition);\n#endif\nfloat angularoffset=u_Angularoffset;lenFlarePosition=rotateVector(lenFlarePosition,center,angularoffset);lenFlarePosition=scaleVec2(aspectRadio,lenFlarePosition);lenFlarePosition=center+deltaPos*a_DistanceRotationScale.x+lenFlarePosition+u_Postionoffset;gl_Position=vec4(lenFlarePosition.x,lenFlarePosition.y,0.0,1.0);v_Texcoord0=a_PositionTexcoord.zw;}";

    var LensFlareFS = "#define SHADER_NAME LENSFLARESFS\nvarying vec2 v_Texcoord0;void main(){gl_FragColor=texture2D(u_FlareTexture,v_Texcoord0)*u_Tint*u_TintIntensity*u_EdgeFade;}";

    class LensFlareShaderInit {
        static init() {
            let attribute = {
                'a_PositionTexcoord': [LensFlareElementGeomtry.PositionUV, Laya.ShaderDataType.Vector4],
                'a_DistanceRotationScale': [LensFlareElementGeomtry.PositionRotationScale, Laya.ShaderDataType.Vector4],
            };
            let uniformMap = {
                "u_Tint": Laya.ShaderDataType.Color,
                "u_TintIntensity": Laya.ShaderDataType.Float,
                "u_FlareTexture": Laya.ShaderDataType.Texture2D,
                "u_FlareCenter": Laya.ShaderDataType.Vector2,
                "u_aspectRatio": Laya.ShaderDataType.Float,
                "u_rotate": Laya.ShaderDataType.Float,
                "u_Postionoffset": Laya.ShaderDataType.Vector2,
                "u_Angularoffset": Laya.ShaderDataType.Float,
                "u_EdgeFade": Laya.ShaderDataType.Float,
            };
            let defaultValue = {
                "u_Tint": Laya.Color.WHITE,
                "u_aspectRatio": 1,
                "u_EdgeFade": 1.0
            };
            let shader = Laya.Shader3D.add("LensFlare", true, false);
            shader.shaderType = Laya.ShaderFeatureType.PostProcess;
            let subshader = new Laya.SubShader(attribute, uniformMap, defaultValue);
            shader.addSubShader(subshader);
            let pass = subshader.addShaderPass(LensFlareVS, LensFlareFS);
            pass.renderState.cull = Laya.RenderState.CULL_NONE;
        }
    }

    class LensFlareElement {
        constructor() {
            this._active = true;
            this._tint = new Laya.Color(1, 1, 1, 1);
            this._intensity = 1;
            this._texture = Laya.Texture2D.whiteTexture;
            this._positionOffset = new Laya.Vector2(0, 0);
            this._scale = new Laya.Vector2(1, 1);
            this._autoRotate = false;
            this._rotation = 0;
            this._startPosition = 0.0;
            this._angularOffset = 0;
            this._aspectRatio = false;
            this._modulateByLightColor = false;
            this._translationScale = new Laya.Vector2(1, 1);
        }
        get active() {
            return this._active;
        }
        set active(value) {
            this._active = value;
        }
        get tint() {
            return this._tint;
        }
        set tint(value) {
            this._tint = value;
        }
        get intensity() {
            return this._intensity;
        }
        set intensity(value) {
            this._intensity = value;
        }
        get texture() {
            return this._texture;
        }
        set texture(value) {
            this._texture = value;
        }
        get positionOffset() {
            return this._positionOffset;
        }
        set positionOffset(value) {
            this._positionOffset = value;
        }
        get scale() {
            return this._scale;
        }
        set scale(value) {
            this._scale = value;
        }
        get autoRotate() {
            return this._autoRotate;
        }
        set autoRotate(value) {
            this._autoRotate = value;
        }
        get rotation() {
            return this._rotation;
        }
        set rotation(value) {
            this._rotation = value;
        }
        get startPosition() {
            return this._startPosition;
        }
        set startPosition(value) {
            this._startPosition = value;
        }
        get angularOffset() {
            return this._angularOffset;
        }
        set angularOffset(value) {
            this._angularOffset = value;
        }
    }
    class LensFlareData extends Laya.Resource {
        constructor() {
            super(false);
            this.elements = [];
        }
    }
    class LensFlareEffect extends Laya.PostProcessEffect {
        static __initDefine__() {
            LensFlareEffect.SHADERDEFINE_AUTOROTATE = Laya.Shader3D.getDefineByName("LENSFLAREAUTOROTATE");
        }
        static init() {
            LensFlareElementGeomtry.init();
            LensFlareShaderInit.init();
            LensFlareEffect.__initDefine__();
        }
        get lensFlareData() {
            return this._lensFlareData;
        }
        set lensFlareData(value) {
            if (!value)
                return;
            this._flareCMDS.length = 0;
            for (let i = 0; i < value.elements.length; i++) {
                let ele = value.elements[i];
                if (!ele.active)
                    continue;
                var cmd = new LensFlareCMD();
                cmd.lensFlareElement = ele;
                this._flareCMDS.push(cmd);
            }
            this._lensFlareData = value;
            this._needUpdate = true;
        }
        get bindLight() {
            return this._light;
        }
        set bindLight(light) {
            if (!light)
                return;
            this._light = light;
            this._needUpdate = true;
        }
        get effectIntensity() {
            return this._effectIntensity;
        }
        set effectIntensity(value) {
            this._effectIntensity = value;
            this._needUpdate = true;
        }
        get effectScale() {
            return this._effectScale;
        }
        set effectScale(value) {
            this._effectScale = value;
            this._needUpdate = true;
        }
        constructor() {
            super();
            this._edgeFade = 0;
            this._effectIntensity = 1;
            this._effectScale = 1;
            this._needUpdate = false;
            this._singleton = false;
            this._flareCMDS = [];
            this._flareCMDS.push(new LensFlareCMD());
            this._center = new Laya.Vector2();
        }
        _updateEffectData(cmd, edgeFade = 1.0) {
            if (this._flareCMDS.length == 0)
                return;
            for (let i = 0; i < this._flareCMDS.length; i++) {
                this._flareCMDS[i].center = this._center;
                this._flareCMDS[i].rotate = this._rotate;
                this._flareCMDS[i].edgeFade = edgeFade;
                if (this._needUpdate) {
                    let cmdEle = this._flareCMDS[i].lensFlareElement;
                    if (!cmdEle)
                        continue;
                    cmdEle.intensity *= this.effectIntensity;
                    let scale = cmdEle.scale;
                    scale.setValue(scale.x * this.effectScale, scale.y * this.effectScale);
                    cmdEle.scale = scale;
                    this._flareCMDS[i].applyElementData();
                }
                this._flareCMDS[i].run(cmd);
            }
            this._needUpdate = false;
        }
        caculateDirCenter(camera) {
            this._light.direction.cloneTo(_tempV3);
            Laya.Vector3.scale(_tempV3, -10, _tempV3);
            Laya.Vector3.add(camera.transform.position, _tempV3, _tempV3);
            Laya.Vector3.transformV3ToV4(_tempV3, camera.projectionViewMatrix, _tempV4);
            if (_tempV4.w <= 0) {
                this._edgeFade = 0;
                return;
            }
            let centerX = _tempV4.x / _tempV4.w;
            let centerY = _tempV4.y / _tempV4.w;
            this._center.setValue(centerX, centerY);
            let maxDist = Math.abs(centerX) > Math.abs(centerY) ? Math.abs(centerX) : Math.abs(centerY);
            if (maxDist <= 0.8) {
                this._edgeFade = 1.0;
            }
            else if (maxDist >= 1.5) {
                this._edgeFade = 0;
                return;
            }
            else {
                this._edgeFade = 1.0 - (maxDist - 0.8) / 0.7;
            }
            var angle = Laya.Utils.toAngle(Math.atan2(centerX, centerY));
            angle = (angle < 0) ? angle + 360 : angle;
            this._rotate = Math.PI * 2.0 - Math.PI / 180 * Math.round(angle);
        }
        caculatePointCenter(camera) {
            this._needUpdate = true;
        }
        caculateSpotCenter(value) {
            this._needUpdate = true;
        }
        render(context) {
            if (!this._light) {
                return;
            }
            var cmd = context.command;
            let source = context.indirectTarget;
            cmd.setRenderTarget(source, false, false);
            switch (this._light.lightType) {
                case Laya.LightType.Directional:
                    this.caculateDirCenter(context.camera);
                    break;
                case Laya.LightType.Point:
                    break;
                case Laya.LightType.Spot:
                    break;
            }
            if (this._edgeFade > 0) {
                this._updateEffectData(cmd, this._edgeFade);
            }
            cmd.blitScreenQuad(source, context.destination);
        }
        release(postprocess) {
            this._needUpdate = false;
        }
    }
    const _tempV3 = new Laya.Vector3();
    const _tempV4 = new Laya.Vector4();
    Laya.Laya.addInitCallback(() => LensFlareEffect.init());

    class LensFlareSettingsLoader {
        load(task) {
            return task.loader.fetch(task.url, "json", task.progress.createCallback(), task.options).then(data => {
                if (!data)
                    return null;
                let ret = new LensFlareData();
                let elements = data.elements;
                if (!elements)
                    return ret;
                let basePath = Laya.URL.getPath(task.url);
                let textures = elements.map((e) => {
                    var _a;
                    let url = Laya.URL.join(basePath, Laya.URL.getResURLByUUID((_a = e.texture) === null || _a === void 0 ? void 0 : _a._$uuid));
                    if (url)
                        e.texture._$uuid = url;
                    return url;
                }).filter((url) => url != "");
                return Promise.all(textures.map(url => task.loader.load(url, task.options))).then(() => {
                    ret.elements = new Laya.ObjDecoder().decodeObj(elements);
                    return ret;
                });
            });
        }
    }
    Laya.Loader.registerLoader(["lensflare"], LensFlareSettingsLoader);

    class MaterialPostProcessEffect extends Laya.PostProcessEffect {
        constructor() {
            super();
            this._material = null;
            this._postProcess = null;
            this._singleton = false;
        }
        get material() {
            return this._material;
        }
        set material(value) {
            var _a, _b;
            if (this._material === value)
                return;
            if (this._postProcess)
                (_a = this._material) === null || _a === void 0 ? void 0 : _a._removeReference();
            this._material = value;
            if (this._postProcess)
                (_b = this._material) === null || _b === void 0 ? void 0 : _b._addReference();
        }
        effectInit(postprocess) {
            var _a, _b;
            if (this._postProcess === postprocess)
                return;
            if (this._postProcess)
                (_a = this._material) === null || _a === void 0 ? void 0 : _a._removeReference();
            this._postProcess = postprocess;
            (_b = this._material) === null || _b === void 0 ? void 0 : _b._addReference();
        }
        release(postprocess) {
            var _a;
            if (this._postProcess !== postprocess)
                return;
            (_a = this._material) === null || _a === void 0 ? void 0 : _a._removeReference();
            this._postProcess = null;
        }
        render(context) {
            var _a;
            const material = this._material;
            const shader = material && !material.destroyed ? material.shader : null;
            if (!shader || shader.shaderType !== Laya.ShaderFeatureType.PostProcess) {
                context.command.blitScreenTriangle(context.indirectTarget, context.destination);
                return;
            }
            const scene = (_a = context.camera) === null || _a === void 0 ? void 0 : _a.scene;
            if (scene)
                material.shaderData.setNumber(Laya.Scene3D.TIME, scene._shaderValues.getNumber(Laya.Scene3D.TIME));
            context.command.blitScreenTriangle(context.indirectTarget, context.destination, null, shader, material.shaderData);
        }
    }

    var FragAO = "#define SHADER_NAME OcclusionEstimationFS\n#include \"DepthNormalUtil.glsl\";\n#include \"AmbientOcclusion.glsl\";\n#define FIX_SAMPLING_PATTERN\nfloat CheckPerspective(float x){return mix(x,1.0,0.0);}vec3 ReconstructViewPos(vec2 uv,float depth,vec2 p11_22,vec2 p13_31){return vec3((uv*2.0-1.0-p13_31)/p11_22*CheckPerspective(depth),depth);}float UVRandom(float u,float v){float f=dot(vec2(12.9898,78.233),vec2(u,v));return fract(43758.5453*sin(f));}vec2 CosSin(float theta){float sn=sin(theta);float cs=cos(theta);return vec2(cs,sn);}float GradientNoise(vec2 uv){uv=floor(uv*u_MainTex_TexelSize.zw);float f=dot(vec2(0.06711056,0.00583715),uv);return fract(52.9829189*fract(f));}vec3 PickSamplePoint(vec2 uv,float index){\n#if defined(FIX_SAMPLING_PATTERN)\nfloat gn=GradientNoise(uv*DOWNSAMPLE);float u=fract(UVRandom(0.0,index+uv.x*1e-10)+gn)*2.0-1.0;float theta=(UVRandom(1.0,index+uv.x*1e-10)+gn)*TWO_PI;\n#else\nfloat u=UVRandom(uv.x+u_PlugTime.x,uv.y+index)*2.0-1.0;float theta=UVRandom(-uv.x-u_PlugTime.x,uv.y+index)*TWO_PI;\n#endif\nvec3 v=vec3(CosSin(theta)*sqrt(1.0-u*u),u);float l=sqrt((index+1.0)/float(SAMPLE_COUNT))*RADIUS;return v*l;}void main(){vec2 uv=v_Texcoord0;mat3 proj=mat3(u_Projection);vec2 p11_22=vec2(u_Projection[0][0],u_Projection[1][1]);vec2 p13_31=vec2(u_Projection[2][0],u_Projection[2][1]);vec3 norm_o;float depth_o=SampleDepthNormal(uv,norm_o);vec3 vpos_o=ReconstructViewPos(uv,depth_o,p11_22,p13_31);float ao=0.0;for(int s=0;s<int(SAMPLE_COUNT);s++){float s_float=float(s);vec3 v_s1=PickSamplePoint(uv,s_float);v_s1=faceforward(v_s1,-norm_o,v_s1);vec3 vpos_s1=vpos_o+v_s1;vec3 spos_s1=proj*vpos_s1;vec2 uv_s1_01=(spos_s1.xy/CheckPerspective(vpos_s1.z)+1.0)*0.5;float depth_s1=SampleDepth(uv_s1_01);vec3 vpos_s2=ReconstructViewPos(uv_s1_01,depth_s1,p11_22,p13_31);vec3 v_s2=vpos_s2-vpos_o;float a1=max(dot(v_s2,norm_o)-kBeta*depth_o,0.0);float a2=dot(v_s2,v_s2)+EPSILON;ao+=a1/a2;}ao*=RADIUS;ao=PositivePow(ao*INTENSITY/float(SAMPLE_COUNT),kContrast);gl_FragColor=PackAONormal(ao,norm_o);}";

    var AoBlurHorizontal = "#define SHADER_NAME AOBlurHorizontal\n#define BLUR_HIGH_QUALITY 0\nvarying vec2 v_Texcoord0;vec3 GetPackedNormal(vec4 p){return p.gba*2.0-1.0;}float CompareNormal(vec3 d1,vec3 d2){return smoothstep(0.8,1.0,dot(d1,d2));}float GetPackedAO(vec4 p){return p.r;}vec4 PackAONormal(float ao,vec3 normal){return vec4(ao,normal*0.5+0.5);}void main(){vec2 delta=vec2(u_MainTex_TexelSize.x*2.0*u_Delty.x,u_Delty.y*u_MainTex_TexelSize.y*2.0);vec2 uv=v_Texcoord0;vec2 uvtran=uv;vec4 p0=texture2D(u_MainTex,uv);uvtran=uv-delta;vec4 p1a=texture2D(u_MainTex,uvtran);uvtran=uv+delta;vec4 p1b=texture2D(u_MainTex,uvtran);uvtran=uv-delta*2.0;vec4 p2a=texture2D(u_MainTex,uvtran);uvtran=uv+delta*2.0;vec4 p2b=texture2D(u_MainTex,uvtran);uvtran=uv-delta*3.2307692308;vec4 p3a=texture2D(u_MainTex,uvtran);;uvtran=uv+delta*3.2307692308;vec4 p3b=texture2D(u_MainTex,uvtran);;vec3 n0=GetPackedNormal(p0);float w0=0.37004405286;float w1a=CompareNormal(n0,GetPackedNormal(p1a))*0.31718061674;float w1b=CompareNormal(n0,GetPackedNormal(p1b))*0.31718061674;float w2a=CompareNormal(n0,GetPackedNormal(p2a))*0.19823788546;float w2b=CompareNormal(n0,GetPackedNormal(p2b))*0.19823788546;float w3a=CompareNormal(n0,GetPackedNormal(p3a))*0.11453744493;float w3b=CompareNormal(n0,GetPackedNormal(p3b))*0.11453744493;float s;s=GetPackedAO(p0)*w0;s+=GetPackedAO(p1a)*w1a;s+=GetPackedAO(p1b)*w1b;s+=GetPackedAO(p2a)*w2a;s+=GetPackedAO(p2b)*w2b;s+=GetPackedAO(p3a)*w3a;s+=GetPackedAO(p3b)*w3b;s/=w0+w1a+w1b+w2a+w2b+w3a+w3b;gl_FragColor=PackAONormal(s,n0);}";

    var AOComposition = "#define SHADER_NAME AOComposition\n#include \"Color.glsl\";\n#define BLUR_HIGH_QUALITY 0\nvarying vec2 v_Texcoord0;vec3 GetPackedNormal(vec4 p){return p.gba*2.0-1.0;}float CompareNormal(vec3 d1,vec3 d2){return smoothstep(0.8,1.0,dot(d1,d2));}float GetPackedAO(vec4 p){return p.r;}float BlurSmall(vec2 uv,vec2 delta){vec4 p0=texture2D(u_compositionAoTexture,uv);vec2 uvtran=uv+vec2(-delta.x,-delta.y);vec4 p1=texture2D(u_compositionAoTexture,uvtran);uvtran=uv+vec2(delta.x,-delta.y);vec4 p2=texture2D(u_compositionAoTexture,uvtran);uvtran=uv+vec2(-delta.x,delta.y);vec4 p3=texture2D(u_compositionAoTexture,uvtran);uvtran=uv+delta;vec4 p4=texture2D(u_compositionAoTexture,uvtran);vec3 n0=GetPackedNormal(p0);float w0=1.0;float w1=CompareNormal(n0,GetPackedNormal(p1));float w2=CompareNormal(n0,GetPackedNormal(p2));float w3=CompareNormal(n0,GetPackedNormal(p3));float w4=CompareNormal(n0,GetPackedNormal(p4));float s;s=GetPackedAO(p0)*w0;s+=GetPackedAO(p1)*w1;s+=GetPackedAO(p2)*w2;s+=GetPackedAO(p3)*w3;s+=GetPackedAO(p4)*w4;return s/(w0+w1+w2+w3+w4);}void main(){vec2 uv=v_Texcoord0;vec2 delty=u_MainTex_TexelSize.xy;float ao=BlurSmall(uv,delty);vec4 albedo=texture2D(u_MainTex,uv);\n#ifdef Gamma_u_MainTex\nalbedo=gammaToLinear(albedo);\n#endif\nvec4 aocolor=vec4(ao*u_AOColor.rgb,ao);albedo.rgb=albedo.rgb*(1.0-ao)+ao*u_AOColor.rgb*ao;gl_FragColor=albedo;gl_FragColor=outputTransform(gl_FragColor);}";

    var AmbientOcclusion = "#include \"Camera.glsl\";\n#define TWO_PI 6.2831852\n#define EPSILON 1.0e-4\n#define FLT_EPSILON 1.192092896e-07\nconst float kContrast=0.6;const float kGeometryCoeff=0.8;const float kBeta=0.002;varying vec2 v_Texcoord0;\n#if defined(AO_High)\n#define SAMPLE_COUNT 12\n#elif defined(AO_MEDIUM)\n#define SAMPLE_COUNT 8\n#else\n#define SAMPLE_COUNT 4\n#endif\n#ifdef AOLOWEST\n#define SAMPLE_COUNT 8\n#endif\n#ifdef AOLOWEST\n#define SAMPLE_COUNT 8\n#endif\n#define INTENSITY u_AOParams.x\n#define RADIUS u_AOParams.y\n#define DOWNSAMPLE u_AOParams.z\nfloat PositivePow(float base,float power){return pow(max(abs(base),float(FLT_EPSILON)),power);}float CheckBounds(vec2 uv,float d){float ob=0.0;if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0){ob=1.0;}if(d<=0.00001){ob+=1.0;}return ob*1e8;}float SampleDepth(vec2 uv){float depthTex_Depth=SAMPLE_DEPTH_TEXTURE(u_CameraDepthTexture,uv);float depthTex_Linear01Depth=Linear01Depth(depthTex_Depth,u_ZBufferParams);return depthTex_Linear01Depth*u_ProjectionParams.y+CheckBounds(uv,depthTex_Linear01Depth);}vec3 SampleNormal(vec2 uv){vec4 col=texture2D(u_CameraDepthNormalsTexture,uv);vec3 depthNormal_Normal=DecodeViewNormalStereo(col);return depthNormal_Normal*vec3(1.0,1.0,-1.0);}float SampleDepthNormal(vec2 uv,out vec3 normal){normal=SampleNormal(uv);return SampleDepth(uv);}float CompareNormal(vec3 d1,vec3 d2){return smoothstep(kGeometryCoeff,1.0,dot(d1,d2));}vec4 PackAONormal(float ao,vec3 n){return vec4(ao,n*0.5+0.5);}vec3 GetPackedNormal(vec4 p){return p.gba*2.0-1.0;}float GetPackAO(vec4 p){return p.r;}";

    exports.AOQUALITY = void 0;
    (function (AOQUALITY) {
        AOQUALITY[AOQUALITY["High"] = 0] = "High";
        AOQUALITY[AOQUALITY["MEDIUM"] = 1] = "MEDIUM";
        AOQUALITY[AOQUALITY["LOWEST"] = 2] = "LOWEST";
    })(exports.AOQUALITY || (exports.AOQUALITY = {}));
    class ScalableAO extends Laya.PostProcessEffect {
        static init() {
            ScalableAO.BlurDelty = Laya.Shader3D.propertyNameToID("u_Delty");
            ScalableAO.AOColor = Laya.Shader3D.propertyNameToID("u_AOColor");
            ScalableAO.aoTexture = Laya.Shader3D.propertyNameToID("u_compositionAoTexture");
            ScalableAO.AOParams = Laya.Shader3D.propertyNameToID('u_AOParams');
            ScalableAO.SourceTex = Laya.Shader3D.propertyNameToID('u_SourceTex');
            ScalableAO.SHADERDEFINE_AOHigh = Laya.Shader3D.getDefineByName("AO_High");
            ScalableAO.SHADERDEFINE_AOMEDIUM = Laya.Shader3D.getDefineByName("AO_MEDIUM");
            ScalableAO.SHADERDEFINE_LOWEST = Laya.Shader3D.getDefineByName("AO_LOWEST");
            Laya.Shader3D.addInclude("AmbientOcclusion.glsl", AmbientOcclusion);
            let attributeMap = {
                'a_PositionTexcoord': [Laya.VertexMesh.MESH_POSITION0, Laya.ShaderDataType.Vector4]
            };
            let uniformMap = {
                'u_OffsetScale': Laya.ShaderDataType.Vector4,
                'u_MainTex': Laya.ShaderDataType.Texture2D,
                'u_MainTex_TexelSize': Laya.ShaderDataType.Vector4,
                'u_Delty': Laya.ShaderDataType.Vector2,
                'u_PlugTime': Laya.ShaderDataType.Vector4,
                'u_AOParams': Laya.ShaderDataType.Vector3,
                'u_BlurVector': Laya.ShaderDataType.Vector2,
                'u_AOColor': Laya.ShaderDataType.Color,
                'u_compositionAoTexture': Laya.ShaderDataType.Texture2D
            };
            let shader = Laya.Shader3D.add("ScalableAO");
            shader.shaderType = Laya.ShaderFeatureType.PostProcess;
            let subShader = new Laya.SubShader(attributeMap, uniformMap);
            shader.addSubShader(subShader);
            let aoPass = subShader.addShaderPass(BlitScreenVS, FragAO);
            aoPass.statefirst = true;
            aoPass.renderState.cull = Laya.RenderState.CULL_NONE;
            shader = Laya.Shader3D.add("AOBlurHorizontal");
            shader.shaderType = Laya.ShaderFeatureType.PostProcess;
            subShader = new Laya.SubShader(attributeMap, uniformMap);
            shader.addSubShader(subShader);
            let blurPass = subShader.addShaderPass(BlitScreenVS, AoBlurHorizontal);
            blurPass.statefirst = true;
            blurPass.renderState.cull = Laya.RenderState.CULL_NONE;
            shader = Laya.Shader3D.add("AOComposition");
            shader.shaderType = Laya.ShaderFeatureType.PostProcess;
            subShader = new Laya.SubShader(attributeMap, uniformMap);
            shader.addSubShader(subShader);
            let compositionPass = subShader.addShaderPass(BlitScreenVS, AOComposition);
            compositionPass.statefirst = true;
            compositionPass.renderState.cull = Laya.RenderState.CULL_NONE;
        }
        constructor() {
            super();
            this._aoParams = new Laya.Vector3();
            this._aoQuality = exports.AOQUALITY.MEDIUM;
            this._shader = Laya.Shader3D.find("ScalableAO");
            this._shaderData = Laya.LayaGL.renderDeviceFactory.createShaderData(null);
            this._aoParams = new Laya.Vector3(0.12, 0.15, 1);
            this._shaderData.setVector3(ScalableAO.AOParams, this._aoParams);
            this._shaderData.setVector(Laya.BaseCamera.DEPTHZBUFFERPARAMS, new Laya.Vector4());
            this._aoBlurHorizontalShader = Laya.Shader3D.find("AOBlurHorizontal");
            this._aoComposition = Laya.Shader3D.find("AOComposition");
            this.aoQuality = exports.AOQUALITY.MEDIUM;
        }
        get aoColor() {
            return this._shaderData.getColor(ScalableAO.AOColor);
        }
        set aoColor(value) {
            this._shaderData.setColor(ScalableAO.AOColor, value);
        }
        get intensity() {
            return this._aoParams.x;
        }
        set intensity(value) {
            this._aoParams.x = value;
            this._shaderData.setVector3(ScalableAO.AOParams, this._aoParams);
        }
        get radius() {
            return this._aoParams.y;
        }
        set radius(value) {
            this._aoParams.y = value;
            this._shaderData.setVector3(ScalableAO.AOParams, this._aoParams);
        }
        get aoQuality() {
            return this._aoQuality;
        }
        set aoQuality(value) {
            this._aoQuality = value;
            switch (value) {
                case exports.AOQUALITY.High:
                    this._shaderData.addDefine(ScalableAO.SHADERDEFINE_AOHigh);
                    this._shaderData.removeDefine(ScalableAO.SHADERDEFINE_AOMEDIUM);
                    this._shaderData.removeDefine(ScalableAO.SHADERDEFINE_LOWEST);
                    break;
                case exports.AOQUALITY.MEDIUM:
                    this._shaderData.addDefine(ScalableAO.SHADERDEFINE_AOMEDIUM);
                    this._shaderData.removeDefine(ScalableAO.SHADERDEFINE_AOHigh);
                    this._shaderData.removeDefine(ScalableAO.SHADERDEFINE_LOWEST);
                    break;
                case exports.AOQUALITY.LOWEST:
                    this._shaderData.addDefine(ScalableAO.SHADERDEFINE_LOWEST);
                    this._shaderData.removeDefine(ScalableAO.SHADERDEFINE_AOHigh);
                    this._shaderData.removeDefine(ScalableAO.SHADERDEFINE_AOMEDIUM);
                    break;
            }
        }
        getCameraDepthTextureModeFlag() {
            return Laya.DepthTextureMode.DepthAndDepthNormals;
        }
        render(context) {
            let cmd = context.command;
            context.camera.viewport;
            let camera = context.camera;
            camera.depthTextureMode |= Laya.DepthTextureMode.DepthNormals;
            camera.depthTextureMode |= Laya.DepthTextureMode.Depth;
            let depthNormalTexture = camera.depthNormalTexture;
            let depthTexture = camera.depthTexture;
            if (!depthNormalTexture || !depthTexture) {
                return;
            }
            depthNormalTexture.wrapModeU = Laya.WrapMode.Clamp;
            depthNormalTexture.wrapModeV = Laya.WrapMode.Clamp;
            let source = context.indirectTarget;
            let width = source.width;
            let height = source.height;
            let textureFormat = source.colorFormat;
            let depthFormat = Laya.RenderTargetFormat.None;
            let finalTex = Laya.RenderTexture.createFromPool(width, height, textureFormat, depthFormat, false, 1);
            let shader = this._shader;
            let shaderData = this._shaderData;
            cmd.blitScreenTriangle(source, finalTex, null, shader, shaderData, 0);
            let blurTex = Laya.RenderTexture.createFromPool(width, height, textureFormat, depthFormat, false, 1);
            cmd.blitScreenTriangle(finalTex, blurTex, null, this._aoBlurHorizontalShader, shaderData, 0);
            cmd.setShaderDataVector2(shaderData, ScalableAO.BlurDelty, ScalableAO.deltyVector);
            cmd.blitScreenTriangle(blurTex, finalTex, null, this._aoBlurHorizontalShader, this._shaderData, 0);
            cmd.setShaderDataTexture(shaderData, ScalableAO.aoTexture, finalTex);
            cmd.blitScreenTriangle(source, context.destination, null, this._aoComposition, this._shaderData, 0);
            context.deferredReleaseTextures.push(finalTex);
            context.deferredReleaseTextures.push(blurTex);
        }
    }
    ScalableAO.deltyHorizontal = new Laya.Vector2(1.0, 0.0);
    ScalableAO.deltyVector = new Laya.Vector2(0.0, 1.0);
    Laya.Laya.addInitCallback(() => ScalableAO.init());

    var TemporalAAVS = "#define SHADER_NAME TemporalAAVS\nvoid main(){gl_Position=vec4(u_OffsetScale.x*2.0-1.0+(a_PositionTexcoord.x+1.0)*u_OffsetScale.z,1.0-u_OffsetScale.y*2.0-(-a_PositionTexcoord.y+1.0)*u_OffsetScale.w,0.0,1.0);}";

    var TemporalAAFS = "#define SHADER_NAME TemporalAAFS\n#include \"Color.glsl\";\nvec2 taaClampUv(vec2 uv){vec2 halfTexel=0.5*u_MainTex_TexelSize.xy;return clamp(uv,halfTexel,vec2(1.0)-halfTexel);}vec4 taaSampleCurrent(vec2 uv,vec2 offset){vec4 color=texture2DLodEXT(u_MainTex,taaClampUv(uv+u_MainTex_TexelSize.xy*offset),0.0);\n#ifdef Gamma_u_MainTex\ncolor=gammaToLinear(color);\n#endif\nreturn color;}vec4 taaSceneToWorking(vec4 color){\n#ifdef TAA_USE_RGB\nreturn color;\n#else\nconst float chromaBias=128.0/255.0;return vec4(dot(color.rgb,vec3(0.25,0.5,0.25)),dot(color.rgb,vec3(0.5,0.0,-0.5))+chromaBias,dot(color.rgb,vec3(-0.25,0.5,-0.25))+chromaBias,color.a);\n#endif\n}vec4 taaWorkingToScene(vec4 color){\n#ifdef TAA_USE_RGB\nreturn color;\n#else\nconst float chromaBias=128.0/255.0;float co=color.y-chromaBias;float cg=color.z-chromaBias;return vec4(color.x+co-cg,color.x+cg,color.x-co-cg,color.a);\n#endif\n}float taaLuma(vec3 color){\n#ifdef TAA_USE_RGB\nreturn dot(color,vec3(0.2126729,0.7151522,0.0721750));\n#else\nreturn color.x;\n#endif\n}vec4 taaPerceptualBlend(vec4 history,vec4 current,float currentInfluence){vec4 perceptualHistory=history/(taaLuma(history.rgb)+1.0);vec4 perceptualCurrent=current/(taaLuma(current.rgb)+1.0);vec4 perceptualResult=mix(perceptualHistory,perceptualCurrent,currentInfluence);return perceptualResult/(1.0-taaLuma(perceptualResult.rgb));}void taaAdjustColorBox(inout vec4 boxMin,inout vec4 boxMax,inout vec4 moment1,inout vec4 moment2,vec2 uv,vec2 offset){vec4 color=taaSceneToWorking(taaSampleCurrent(uv,offset));boxMin=min(color,boxMin);boxMax=max(color,boxMax);moment1+=color;moment2+=color*color;}vec4 taaFilterCurrent(vec2 uv){vec4 color=taaSampleCurrent(uv,vec2(0.0))*u_TaaFilterWeights0.x;color+=taaSampleCurrent(uv,vec2(0.0,1.0))*u_TaaFilterWeights0.y;color+=taaSampleCurrent(uv,vec2(1.0,0.0))*u_TaaFilterWeights0.z;color+=taaSampleCurrent(uv,vec2(-1.0,0.0))*u_TaaFilterWeights0.w;color+=taaSampleCurrent(uv,vec2(0.0,-1.0))*u_TaaFilterWeights1.x;color+=taaSampleCurrent(uv,vec2(-1.0,1.0))*u_TaaFilterWeights1.y;color+=taaSampleCurrent(uv,vec2(1.0,-1.0))*u_TaaFilterWeights1.z;color+=taaSampleCurrent(uv,vec2(1.0,1.0))*u_TaaFilterWeights1.w;color+=taaSampleCurrent(uv,vec2(-1.0,-1.0))*u_TaaFilterWeights2.x;return taaSceneToWorking(color);}vec4 taaSampleHistory(vec2 uv){return taaSceneToWorking(texture2DLodEXT(u_TaaHistoryTex,taaClampUv(uv),0.0));}vec4 taaSampleHistoryBicubic(vec2 uv){vec2 samplePos=uv*u_MainTex_TexelSize.zw;vec2 tc1=floor(samplePos-0.5)+0.5;vec2 f=samplePos-tc1;vec2 f2=f*f;vec2 f3=f*f2;vec2 w0=-0.5*f3+f2-0.5*f;vec2 w1=1.5*f3-2.5*f2+1.0;vec2 w2=-1.5*f3+2.0*f2+0.5*f;vec2 w3=0.5*f3-0.5*f2;vec2 w12=w1+w2;vec2 tc0=u_MainTex_TexelSize.xy*(tc1-1.0);vec2 tc3=u_MainTex_TexelSize.xy*(tc1+2.0);vec2 tc12=u_MainTex_TexelSize.xy*(tc1+w2/w12);float cw0=w12.x*w0.y;float cw1=w0.x*w12.y;float cw2=w12.x*w12.y;float cw3=w3.x*w12.y;float cw4=w12.x*w3.y;vec4 result=taaSampleHistory(vec2(tc12.x,tc0.y))*cw0;result+=taaSampleHistory(vec2(tc0.x,tc12.y))*cw1;result+=taaSampleHistory(vec2(tc12.x,tc12.y))*cw2;result+=taaSampleHistory(vec2(tc3.x,tc12.y))*cw3;result+=taaSampleHistory(vec2(tc12.x,tc3.y))*cw4;return result/(cw0+cw1+cw2+cw3+cw4);}vec4 taaClipToAabbCenter(vec4 history,vec4 boxMin,vec4 boxMax){vec4 center=0.5*(boxMax+boxMin);vec4 extents=max(0.5*(boxMax-boxMin),vec4(0.00006103515625));vec4 offset=history-center;vec3 unit=abs(offset.rgb/extents.rgb);float maxUnit=max(max(unit.x,unit.y),unit.z);return maxUnit>1.0 ? center+offset/maxUnit : history;}void taaAdjustBestDepth(inout float bestDepth,inout vec2 bestOffset,vec2 uv,vec2 offset){float depth=texture2DLodEXT(u_TaaDepthTex,taaClampUv(uv+u_MainTex_TexelSize.xy*offset),0.0).r;if(depth<bestDepth){bestDepth=depth;bestOffset=offset;}}vec2 taaGetVelocity(vec2 uv,vec2 depthOffset){if(u_TaaParams.z<0.5)return vec2(0.0);vec2 sampleUv=taaClampUv(uv+u_MainTex_TexelSize.xy*depthOffset);vec4 motion=texture2DLodEXT(u_TaaMotionTex,sampleUv,0.0);vec2 velocity=motion.xy;if(motion.a<0.5){float depth=texture2DLodEXT(u_TaaDepthTex,sampleUv,0.0).r;vec2 clipXY=(sampleUv*2.0-1.0)*vec2(1.0,u_TaaScreenYSign);vec4 world=u_TaaResolveInvViewProjection*vec4(clipXY,depth,1.0);if(abs(world.w)<0.0000001)return vec2(0.0);world/=world.w;vec4 currentClip=u_TaaResolveViewProjection*world;vec4 previousClip=u_TaaResolvePreviousViewProjection*world;if(abs(currentClip.w)<0.0000001||previousClip.w<=0.0000001)return vec2(2.0);velocity=(currentClip.xy/currentClip.w-previousClip.xy/previousClip.w)*vec2(0.5,0.5*u_TaaScreenYSign);}return-velocity;}vec4 taaResolve(vec2 uv,int clampQuality,int motionQuality,int historyQuality,int centralFiltering){vec4 colorCenter=centralFiltering>=1 ? taaFilterCurrent(uv): taaSceneToWorking(taaSampleCurrent(uv,vec2(0.0)));if(u_TaaParams.w<0.5)return max(taaWorkingToScene(colorCenter),vec4(0.0));vec4 boxMin=colorCenter;vec4 boxMax=colorCenter;vec4 moment1=colorCenter;vec4 moment2=colorCenter*colorCenter;taaAdjustColorBox(boxMin,boxMax,moment1,moment2,uv,vec2(0.0,-1.0));taaAdjustColorBox(boxMin,boxMax,moment1,moment2,uv,vec2(-1.0,0.0));taaAdjustColorBox(boxMin,boxMax,moment1,moment2,uv,vec2(1.0,0.0));taaAdjustColorBox(boxMin,boxMax,moment1,moment2,uv,vec2(0.0,1.0));if(clampQuality>=1){taaAdjustColorBox(boxMin,boxMax,moment1,moment2,uv,vec2(-1.0,-1.0));taaAdjustColorBox(boxMin,boxMax,moment1,moment2,uv,vec2(1.0,-1.0));taaAdjustColorBox(boxMin,boxMax,moment1,moment2,uv,vec2(-1.0,1.0));taaAdjustColorBox(boxMin,boxMax,moment1,moment2,uv,vec2(1.0,1.0));}if(clampQuality>=2){vec4 mean=moment1/9.0;vec4 stdDev=sqrt(abs(moment2/9.0-mean*mean));boxMin=max(boxMin,mean-u_TaaParams.y*stdDev);boxMax=min(boxMax,mean+u_TaaParams.y*stdDev);}vec2 bestOffset=vec2(0.0);float bestDepth=1.0;if(motionQuality>=1){taaAdjustBestDepth(bestDepth,bestOffset,uv,vec2(0.0));taaAdjustBestDepth(bestDepth,bestOffset,uv,vec2(1.0,0.0));taaAdjustBestDepth(bestDepth,bestOffset,uv,vec2(0.0,-1.0));taaAdjustBestDepth(bestDepth,bestOffset,uv,vec2(-1.0,0.0));taaAdjustBestDepth(bestDepth,bestOffset,uv,vec2(0.0,1.0));}if(motionQuality>=2){taaAdjustBestDepth(bestDepth,bestOffset,uv,vec2(-1.0,-1.0));taaAdjustBestDepth(bestDepth,bestOffset,uv,vec2(1.0,-1.0));taaAdjustBestDepth(bestDepth,bestOffset,uv,vec2(-1.0,1.0));taaAdjustBestDepth(bestDepth,bestOffset,uv,vec2(1.0,1.0));}vec2 velocity=taaGetVelocity(uv,bestOffset);vec2 historyUv=uv+velocity;if(any(greaterThan(abs(historyUv-0.5),vec2(0.5))))return max(taaWorkingToScene(colorCenter),vec4(0.0));vec4 history=historyQuality>=2 ? taaSampleHistoryBicubic(historyUv): taaSampleHistory(historyUv);vec4 clampedHistory=clampQuality>=3 ? taaClipToAabbCenter(history,boxMin,boxMax): clamp(history,boxMin,boxMax);float influence=u_TaaParams.x;return max(taaWorkingToScene(taaPerceptualBlend(clampedHistory,colorCenter,influence)),vec4(0.0));}void main(){vec2 uv=gl_FragCoord.xy*u_MainTex_TexelSize.xy;\n#error TAA_RESOLVE_NOT_SPECIALIZED\ngl_FragColor=outputTransform(gl_FragColor);}";

    var TemporalAACopyFS = "#define SHADER_NAME TemporalAACopyFS\n#include \"Color.glsl\";\nvoid main(){vec2 uv=gl_FragCoord.xy*u_MainTex_TexelSize.xy;gl_FragColor=texture2DLodEXT(u_MainTex,uv,0.0);\n#ifdef Gamma_u_MainTex\ngl_FragColor=gammaToLinear(gl_FragColor);\n#endif\n}";

    var TemporalAASharpenFS = "\n#define SHADER_NAME TemporalAARcasFS\n#include \"Color.glsl\";\nvec4 taaRcasLoad(vec2 uv,vec2 offset){vec2 halfTexel=0.5*u_MainTex_TexelSize.xy;vec4 color=texture2DLodEXT(u_MainTex,clamp(uv+offset*u_MainTex_TexelSize.xy,halfTexel,vec2(1.0)-halfTexel),0.0);\n#ifdef Gamma_u_MainTex\ncolor=gammaToLinear(color);\n#endif\nreturn color;}void main(){vec2 uv=gl_FragCoord.xy*u_MainTex_TexelSize.xy;vec4 center=taaRcasLoad(uv,vec2(0.0));if(u_TaaRcasSharpness<=0.0){gl_FragColor=outputTransform(center);return;}vec3 b=taaRcasLoad(uv,vec2(0.0,-1.0)).rgb;vec3 d=taaRcasLoad(uv,vec2(-1.0,0.0)).rgb;vec3 e=center.rgb;vec3 f=taaRcasLoad(uv,vec2(1.0,0.0)).rgb;vec3 h=taaRcasLoad(uv,vec2(0.0,1.0)).rgb;vec3 peak=max(max(max(b,d),max(e,f)),h);float range=max(1.0,max(max(peak.r,peak.g),peak.b));b/=range;d/=range;e/=range;f/=range;h/=range;vec3 mn4=min(min(b,d),min(f,h));vec3 mx4=max(max(b,d),max(f,h));vec3 hitMin=min(mn4,e)/max(4.0*mx4,vec3(0.000001));vec3 hitMaxDenominator=4.0*mn4-4.0;hitMaxDenominator=max(abs(hitMaxDenominator),vec3(0.000001))*mix(vec3(-1.0),vec3(1.0),step(vec3(0.0000001),hitMaxDenominator));vec3 hitMax=(vec3(1.0)-max(mx4,e))/hitMaxDenominator;vec3 lobes=max(-hitMin,hitMax);float lobe=max(-0.1875,min(max(max(lobes.r,lobes.g),lobes.b),0.0))*u_TaaRcasSharpness;vec3 color=((lobe*(b+d+f+h)+e)/(4.0*lobe+1.0))*range;gl_FragColor=outputTransform(vec4(color,center.a));}";

    exports.TemporalAAQuality = void 0;
    (function (TemporalAAQuality) {
        TemporalAAQuality[TemporalAAQuality["VeryLow"] = 0] = "VeryLow";
        TemporalAAQuality[TemporalAAQuality["Low"] = 1] = "Low";
        TemporalAAQuality[TemporalAAQuality["Medium"] = 2] = "Medium";
        TemporalAAQuality[TemporalAAQuality["High"] = 3] = "High";
        TemporalAAQuality[TemporalAAQuality["VeryHigh"] = 4] = "VeryHigh";
    })(exports.TemporalAAQuality || (exports.TemporalAAQuality = {}));
    class TemporalAAEffect extends Laya.PostProcessEffect {
        constructor() {
            super(...arguments);
            this._paramsValue = new Laya.Vector4();
            this._weights = new Array(9);
            this._weights0 = new Laya.Vector4();
            this._weights1 = new Laya.Vector4();
            this._weights2 = new Laya.Vector4();
        }
        static init() {
            if (TemporalAAEffect._initialized)
                return;
            TemporalAAEffect._initialized = true;
            TemporalAAEffect._historyTexture = Laya.Shader3D.propertyNameToID("u_TaaHistoryTex");
            TemporalAAEffect._motionTexture = Laya.Shader3D.propertyNameToID("u_TaaMotionTex");
            TemporalAAEffect._depthTexture = Laya.Shader3D.propertyNameToID("u_TaaDepthTex");
            TemporalAAEffect._params = Laya.Shader3D.propertyNameToID("u_TaaParams");
            TemporalAAEffect._screenYSign = Laya.Shader3D.propertyNameToID("u_TaaScreenYSign");
            TemporalAAEffect._inverseViewProjection = Laya.Shader3D.propertyNameToID("u_TaaResolveInvViewProjection");
            TemporalAAEffect._viewProjection = Laya.Shader3D.propertyNameToID("u_TaaResolveViewProjection");
            TemporalAAEffect._previousViewProjection = Laya.Shader3D.propertyNameToID("u_TaaResolvePreviousViewProjection");
            TemporalAAEffect._filterWeights0 = Laya.Shader3D.propertyNameToID("u_TaaFilterWeights0");
            TemporalAAEffect._filterWeights1 = Laya.Shader3D.propertyNameToID("u_TaaFilterWeights1");
            TemporalAAEffect._filterWeights2 = Laya.Shader3D.propertyNameToID("u_TaaFilterWeights2");
            TemporalAAEffect._rcasSharpness = Laya.Shader3D.propertyNameToID("u_TaaRcasSharpness");
            TemporalAAEffect._lowPrecision = Laya.Shader3D.getDefineByName("TAA_LOW_PRECISION_SOURCE");
            const attributeMap = {
                a_PositionTexcoord: [Laya.VertexMesh.MESH_POSITION0, Laya.ShaderDataType.Vector4]
            };
            const uniformMap = {
                u_MainTex: Laya.ShaderDataType.Texture2D,
                u_MainTex_TexelSize: Laya.ShaderDataType.Vector4,
                u_OffsetScale: Laya.ShaderDataType.Vector4,
                u_TaaHistoryTex: Laya.ShaderDataType.Texture2D,
                u_TaaMotionTex: Laya.ShaderDataType.Texture2D,
                u_TaaDepthTex: Laya.ShaderDataType.Texture2D,
                u_TaaParams: Laya.ShaderDataType.Vector4,
                u_TaaScreenYSign: Laya.ShaderDataType.Float,
                u_TaaResolveInvViewProjection: Laya.ShaderDataType.Matrix4x4,
                u_TaaResolveViewProjection: Laya.ShaderDataType.Matrix4x4,
                u_TaaResolvePreviousViewProjection: Laya.ShaderDataType.Matrix4x4,
                u_TaaFilterWeights0: Laya.ShaderDataType.Vector4,
                u_TaaFilterWeights1: Laya.ShaderDataType.Vector4,
                u_TaaFilterWeights2: Laya.ShaderDataType.Vector4,
                u_TaaRcasSharpness: Laya.ShaderDataType.Float
            };
            const shader = Laya.Shader3D.add("TemporalAA");
            shader.shaderType = Laya.ShaderFeatureType.PostProcess;
            const qualityArguments = ["0, 0, 0, 0", "0, 1, 1, 0", "2, 2, 1, 0", "2, 2, 2, 0"];
            for (let quality = 0; quality <= exports.TemporalAAQuality.VeryHigh; quality++) {
                let resolve;
                if (quality === exports.TemporalAAQuality.VeryHigh) {
                    resolve = "#ifdef TAA_LOW_PRECISION_SOURCE\n    gl_FragColor = taaResolve(uv, 2, 2, 2, 1);\n#else\n    gl_FragColor = taaResolve(uv, 3, 2, 2, 1);\n#endif";
                }
                else {
                    resolve = "gl_FragColor = taaResolve(uv, " + qualityArguments[quality] + ");";
                }
                const rgbDefine = quality <= exports.TemporalAAQuality.Low ? "#define TAA_USE_RGB\n" : "";
                TemporalAAEffect._addPass(shader, attributeMap, uniformMap, rgbDefine + TemporalAAFS.replace("#error TAA_RESOLVE_NOT_SPECIALIZED", resolve));
            }
            TemporalAAEffect._addPass(shader, attributeMap, uniformMap, TemporalAACopyFS);
            TemporalAAEffect._addPass(shader, attributeMap, uniformMap, TemporalAASharpenFS);
        }
        static _addPass(shader, attributeMap, uniformMap, fragment) {
            const subShader = new Laya.SubShader(attributeMap, uniformMap);
            shader.addSubShader(subShader);
            const pass = subShader.addShaderPass(TemporalAAVS, fragment);
            pass.statefirst = true;
            pass.renderState.depthTest = Laya.RenderState.DEPTHTEST_ALWAYS;
            pass.renderState.depthWrite = false;
            pass.renderState.cull = Laya.RenderState.CULL_NONE;
            pass.renderState.blend = Laya.RenderState.BLEND_DISABLE;
        }
        getCameraDepthTextureModeFlag() {
            return Laya.DepthTextureMode.Depth;
        }
        _setFilterWeights(shaderData, jitter) {
            let sum = 0;
            for (let i = 0; i < 9; i++) {
                const offset = TemporalAAEffect._filterOffsets[i];
                const x = offset[0] - jitter.x;
                const y = offset[1] - jitter.y;
                const weight = Math.exp((-0.5 / 0.22) * (x * x + y * y));
                this._weights[i] = weight;
                sum += weight;
            }
            for (let i = 0; i < 9; i++)
                this._weights[i] /= sum;
            const weights = this._weights;
            this._weights0.setValue(weights[0], weights[1], weights[2], weights[3]);
            this._weights1.setValue(weights[4], weights[5], weights[6], weights[7]);
            this._weights2.setValue(weights[8], 0, 0, 0);
            shaderData.setVector(TemporalAAEffect._filterWeights0, this._weights0);
            shaderData.setVector(TemporalAAEffect._filterWeights1, this._weights1);
            shaderData.setVector(TemporalAAEffect._filterWeights2, this._weights2);
        }
        _renderTAA(context) {
            const camera = context.camera;
            const cameraData = camera._taa;
            const state = cameraData === null || cameraData === void 0 ? void 0 : cameraData.preparedHistory;
            if (!state || !camera.depthTexture || camera.depthTexture.destroyed || !context.indirectTarget || !context.destination)
                return;
            TemporalAAEffect.init();
            this._shader || (this._shader = Laya.Shader3D.find("TemporalAA"));
            const shaderData = state.resolveData;
            const isNewFrame = state.frameIndex !== state.preparedFrameIndex;
            const useHistory = state.valid && isNewFrame && cameraData.newFrame;
            this._paramsValue.setValue(useHistory ? 0.1 : 1, 0.9, useHistory ? 1 : 0, useHistory ? 1 : 0);
            shaderData.setVector(TemporalAAEffect._params, this._paramsValue);
            shaderData.setNumber(TemporalAAEffect._screenYSign, Laya.LayaGL.renderEngine._screenInvertY ? -1 : 1);
            shaderData.setTexture(TemporalAAEffect._historyTexture, state.texture);
            shaderData.setTexture(TemporalAAEffect._motionTexture, camera.getOpaqueAuxiliaryTexture(3));
            shaderData.setTexture(TemporalAAEffect._depthTexture, camera.depthTexture);
            shaderData.setMatrix4x4(TemporalAAEffect._inverseViewProjection, cameraData.invViewProjection);
            shaderData.setMatrix4x4(TemporalAAEffect._viewProjection, cameraData.viewProjection);
            shaderData.setMatrix4x4(TemporalAAEffect._previousViewProjection, cameraData.previousViewProjection);
            if (state.texture.colorFormat === Laya.RenderTargetFormat.R8G8B8 || state.texture.colorFormat === Laya.RenderTargetFormat.R8G8B8A8)
                shaderData.addDefine(TemporalAAEffect._lowPrecision);
            else
                shaderData.removeDefine(TemporalAAEffect._lowPrecision);
            if (cameraData.quality === exports.TemporalAAQuality.VeryHigh)
                this._setFilterWeights(shaderData, cameraData.jitter);
            context.command.blitScreenTriangle(context.indirectTarget, context.destination, null, this._shader, shaderData, cameraData.quality, true);
            if (isNewFrame || !state.valid) {
                context.command.blitScreenTriangle(context.destination, state.texture, null, this._shader, state.copyData, TemporalAAEffect._copyPass, true);
                state.pendingCopy = true;
            }
        }
        _renderSharpen(context) {
            const cameraData = context.camera._taa;
            const state = cameraData === null || cameraData === void 0 ? void 0 : cameraData.preparedHistory;
            if (!state || !context.indirectTarget || !context.destination)
                return;
            TemporalAAEffect.init();
            this._shader || (this._shader = Laya.Shader3D.find("TemporalAA"));
            const sharpening = cameraData.sharpening;
            const sharpness = Math.pow(2, -(1 - sharpening) * 2.5);
            state.sharpenData.setNumber(TemporalAAEffect._rcasSharpness, sharpening > 0 ? sharpness : 0);
            context.command.blitScreenTriangle(context.indirectTarget, context.destination, null, this._shader, state.sharpenData, TemporalAAEffect._sharpenPass, true);
        }
        render(context) {
            this._renderTAA(context);
        }
    }
    TemporalAAEffect._initialized = false;
    TemporalAAEffect._copyPass = 5;
    TemporalAAEffect._sharpenPass = 6;
    TemporalAAEffect._filterOffsets = [
        [0, 0], [0, 1], [1, 0], [-1, 0], [0, -1],
        [-1, 1], [1, -1], [1, 1], [-1, -1]
    ];
    Laya.Laya.addInitCallback(() => TemporalAAEffect.init());

    let c = Laya.ClassUtils.regClass;
    c("BloomEffect", BloomEffect);
    c("GaussianDoF", GaussianDoF);
    c("ScalableAO", ScalableAO);
    c("ColorGradEffect", ColorGradEffect);
    c("TemporalAAEffect", TemporalAAEffect);
    c("LensFlareEffect", LensFlareEffect);
    c("LensFlareElement", LensFlareElement);
    c("LensFlareData", LensFlareData);
    c("MaterialPostProcessEffect", MaterialPostProcessEffect);

    exports.ACESShaderLib = ACESShaderLib;
    exports.BloomEffect = BloomEffect;
    exports.ColorGradEffect = ColorGradEffect;
    exports.GaussianDoF = GaussianDoF;
    exports.LensFlareCMD = LensFlareCMD;
    exports.LensFlareData = LensFlareData;
    exports.LensFlareEffect = LensFlareEffect;
    exports.LensFlareElement = LensFlareElement;
    exports.LensFlareElementGeomtry = LensFlareElementGeomtry;
    exports.LensFlareSettingsLoader = LensFlareSettingsLoader;
    exports.LensFlareShaderInit = LensFlareShaderInit;
    exports.MaterialPostProcessEffect = MaterialPostProcessEffect;
    exports.ScalableAO = ScalableAO;
    exports.TemporalAAEffect = TemporalAAEffect;

})(window.Laya = window.Laya || {}, Laya);
//# sourceMappingURL=laya.postProcess.js.map
