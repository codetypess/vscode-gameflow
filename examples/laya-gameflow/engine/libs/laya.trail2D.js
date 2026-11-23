(function (exports, Laya) {
    'use strict';

    var TrailVS = "#define SHADER_NAME Trail2DVS\n#include \"Sprite2DVertex.glsl\"\n#include \"TrailVertexUtil.glsl\"\nvoid main(){float normalizeTime=(u_CurTime-a_BirthTime)/u_LifeTime;v_Texcoord0=vec2(a_Texcoord0X,1.0-a_Texcoord0Y)*u_TilingOffset.xy+u_TilingOffset.zw;v_Color=a_Color;vec4 glPos;vec2 globalPos;vec2 trailPos=a_position.xy+a_OffsetVector.xy*getCurWidth(normalizeTime);getGlobalPos(trailPos,globalPos);vec2 viewPos;getViewPos(globalPos,viewPos);clip(viewPos);getProjectPos(viewPos,glPos);gl_Position=glPos;}";

    var TrailFS = "#define SHADER_NAME Trail2DFS\nvarying vec2 v_Texcoord0;varying vec4 v_Color;\n#include \"Sprite2DFrag.glsl\";\nvoid main(){vec4 color=v_Color;vec4 textureColor=texture2D(u_baseRender2DTexture,v_Texcoord0);textureColor=transspaceColor(textureColor);vec4 renderColor=u_baseRenderColor;\n#ifdef GAMMASPACE\nrenderColor=linearToGamma(renderColor);\n#endif\ncolor*=textureColor*renderColor;gl_FragColor=color;}";

    class Trail2DShaderInit {
        static init() {
            Laya.TrailShaderCommon.init();
            let shader = Laya.Shader3D.add("Trail2D", false, false);
            shader.shaderType = Laya.ShaderFeatureType.D2_BaseRenderNode2D;
            let subShader = new Laya.SubShader(Laya.TrailShaderCommon.attributeMap, Laya.TrailShaderCommon.uniformMap, Laya.TrailShaderCommon.defaultValue);
            shader.addSubShader(subShader);
            subShader.addShaderPass(TrailVS, TrailFS);
            let mat = Trail2DRender.defaultTrail2DMaterial = new Laya.Material();
            mat.lock = true;
            mat.setShaderName("Trail2D");
            mat.alphaTest = false;
            mat.depthTest = Laya.RenderState.DEPTHTEST_OFF;
            mat.cull = Laya.RenderState.CULL_NONE;
            mat.blend = Laya.RenderState.BLEND_ENABLE_ALL;
            mat.setIntByIndex(Laya.Shader3D.BLEND_SRC, Laya.RenderState.BLENDPARAM_SRC_ALPHA);
            mat.setIntByIndex(Laya.Shader3D.BLEND_DST, Laya.RenderState.BLENDPARAM_ONE_MINUS_SRC_ALPHA);
        }
    }

    class Trail2DRender extends Laya.BaseRenderNode2D {
        get time() {
            return this._time;
        }
        set time(value) {
            this._time = value;
            if (this._trailFilter)
                this._trailFilter.time = value;
        }
        get minVertexDistance() {
            return this._trailFilter.minVertexDistance;
        }
        set minVertexDistance(value) {
            this._trailFilter.minVertexDistance = value;
        }
        get widthMultiplier() {
            return this._widthMultiplier;
        }
        set widthMultiplier(value) {
            this._widthMultiplier = value;
            if (this._trailFilter)
                this._trailFilter.widthMultiplier = value;
        }
        get widthCurve() {
            return this._trailFilter.widthCurve;
        }
        set widthCurve(value) {
            this._trailFilter.widthCurve = value;
        }
        get colorGradient() {
            return this._trailFilter.colorGradient;
        }
        set colorGradient(value) {
            this._trailFilter.colorGradient = value;
        }
        get textureMode() {
            return this._trailFilter.textureMode;
        }
        set textureMode(value) {
            this._trailFilter.textureMode = value;
        }
        set texture(value) {
            if (!value) {
                value = Laya.Texture2D.whiteTexture;
            }
            if (value == this._baseRender2DTexture)
                return;
            if (this._baseRender2DTexture)
                this._baseRender2DTexture._removeReference(1);
            value._addReference();
            this._baseRender2DTexture = value;
            this._spriteShaderData.setTexture(Laya.BaseRenderNode2D.BASERENDER2DTEXTURE, value);
            if (value.gammaCorrection != 1) {
                this._spriteShaderData.addDefine(Laya.ShaderDefines2D.GAMMATEXTURE);
            }
            else {
                this._spriteShaderData.removeDefine(Laya.ShaderDefines2D.GAMMATEXTURE);
            }
        }
        get texture() {
            return this._baseRender2DTexture;
        }
        set color(value) {
            if (value != this._color && this._color.equal(value))
                return;
            value = value ? value : Laya.Color.BLACK;
            value.cloneTo(this._color);
            this._spriteShaderData.setColor(Laya.BaseRenderNode2D.BASERENDER2DCOLOR, this._color);
        }
        get color() {
            return this._color;
        }
        _isMaterialVaild(value) {
            return value.checkType(Laya.ShaderFeatureType.Effect);
        }
        _getcommonUniformMap() {
            return ["BaseRender2D", "TrailRender"];
        }
        _onAdded() {
            super._onAdded();
            this._trailFilter = new Laya.TrailBaseFilter(this._spriteShaderData);
            this._trailFilter.time = this._time;
            this._trailFilter.widthMultiplier = this._widthMultiplier;
            this._initRender();
        }
        _initRender() {
            let renderElement = Laya.LayaGL.render2DRenderPassFactory.createRenderElement2D();
            renderElement.geometry = this._trailFilter._trialGeometry._geometryElementOBj;
            renderElement.value2DShaderData = this._spriteShaderData;
            renderElement.renderStateIsBySprite = false;
            renderElement.nodeCommonMap = this._getcommonUniformMap();
            renderElement.owner = this.owner._struct;
            Laya.BaseRenderNode2D._setRenderElement2DMaterial(renderElement, this._getElementMaterial(0));
            this._renderElements[0] = renderElement;
            this.owner._struct.renderElements = this._renderElements;
            this._renderHandle.needUseMatrix = false;
        }
        _getElementMaterial(index) {
            return this._materials[index] || Trail2DRender.defaultTrail2DMaterial;
        }
        onPreRender() {
            let curtime = this._trailFilter._curtime += Math.min(Laya.Laya.timer.delta / 1000, 0.016);
            let trailGeometry = this._trailFilter._trialGeometry;
            this._spriteShaderData.setNumber(Laya.TrailShaderCommon.CURTIME, curtime);
            let globalPos = Laya.Point.TEMP;
            this.owner.globalTrans.getPos(globalPos);
            let curPosV3 = Laya.Vector3.TEMP;
            curPosV3.set(globalPos.x, globalPos.y, 0);
            let globalScale = Math.max(Math.abs(this.owner.globalTrans.scaleX), Math.abs(this.owner.globalTrans.scaleY)) || 1;
            trailGeometry._updateDisappear(curtime, this.time);
            if (!Laya.Vector3.equals(this._trailFilter._lastPosition, curPosV3)) {
                if ((trailGeometry._endIndex - trailGeometry._activeIndex) === 0) {
                    trailGeometry._addTrailByFirstPosition(curPosV3, curtime);
                }
                else {
                    var delVector3 = Laya.TrailGeometry._tempVector36;
                    var pointAtoBVector3 = Laya.TrailGeometry._tempVector35;
                    Laya.Vector3.subtract(curPosV3, trailGeometry._lastFixedVertexPosition, delVector3);
                    var forward = Laya.TrailGeometry._tempVector33;
                    forward.setValue(0, 0, 1);
                    Laya.Vector3.cross(delVector3, forward, pointAtoBVector3);
                    Laya.Vector3.normalize(pointAtoBVector3, pointAtoBVector3);
                    Laya.Vector3.scale(pointAtoBVector3, this.widthMultiplier * globalScale / 2, pointAtoBVector3);
                    var delLength = Laya.Vector3.scalarLength(delVector3);
                    trailGeometry._addTrailByNextPosition(curPosV3, curtime, this.minVertexDistance * globalScale, pointAtoBVector3, delLength);
                }
            }
            trailGeometry._updateVertexBufferUV(this.colorGradient, this.textureMode, 50);
            curPosV3.cloneTo(this._trailFilter._lastPosition);
            if (trailGeometry._disappearBoundsMode) ;
            trailGeometry._updateRenderParams();
        }
        clear() {
            this._trailFilter.clear();
        }
        _initDefaultRenderData() {
            this._time = 0.5;
            this._widthMultiplier = 50;
            this._spriteShaderData.setColor(Laya.BaseRenderNode2D.BASERENDER2DCOLOR, this._color);
            this._spriteShaderData.addDefine(Laya.BaseRenderNode2D.SHADERDEFINE_BASERENDER2D);
            this.texture = Laya.Texture2D.whiteTexture;
        }
        constructor() {
            super();
            this._color = new Laya.Color(1, 1, 1, 1);
            this._renderElements = [];
            this._materials = [];
        }
    }
    Laya.Laya.addAfterInitCallback(() => {
        if (!Trail2DRender.defaultTrail2DMaterial)
            Trail2DShaderInit.init();
    });

    let c = Laya.ClassUtils.regClass;
    c("Trail2DRender", Trail2DRender);

    exports.Trail2DRender = Trail2DRender;
    exports.Trail2DShaderInit = Trail2DShaderInit;

})(window.Laya = window.Laya || {}, Laya);
//# sourceMappingURL=laya.trail2D.js.map
