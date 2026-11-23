(function (exports, Laya) {
    'use strict';

    class RTScene3DRenderManager {
        get list() {
            return this._list;
        }
        set list(value) {
            this._list = value;
            if (value) {
                let elemnt = this._list.elements;
                for (let i = 0; i < this._list.length; i++) {
                    this.removeRenderObject(elemnt[i]);
                }
                elemnt = value.elements;
                for (let i = 0; i < value.length; i++) {
                    this.addRenderObject(elemnt[i]);
                }
            }
        }
        _addBaseRenderNode(object) {
            this._nativeObj.addBaseRenderNode(object._nativeObj);
        }
        _removeBaseRenderNode(object) {
            this._nativeObj.removeBaseRenderNode(object._nativeObj);
        }
        _clearBaseRenderNode() {
            this._nativeObj.clearBaseRenderNode();
        }
        addRenderObject(object) {
            let agent = this.batchAgentList.get(object._baseRenderNode.renderNodeType);
            if (agent) {
                agent.addRenderNode(object);
                object._batchRender = agent;
            }
            else {
                this._addBaseRenderNode(object._baseRenderNode);
            }
        }
        removeRenderObject(object) {
            let agent = this.batchAgentList.get(object._baseRenderNode.renderNodeType);
            if (agent) {
                agent.removeRenderNode(object);
                object._batchRender = null;
            }
            else {
                this._removeBaseRenderNode(object._baseRenderNode);
            }
        }
        removeMotionObject(object) {
        }
        addMotionObject(object) {
        }
        updateMotionObjects() {
        }
        destroy() {
            var _a;
            (_a = this._list) === null || _a === void 0 ? void 0 : _a.destroy();
            this._clearBaseRenderNode();
            this._list = null;
        }
        constructor() {
            this._list = new Laya.SingletonList();
            this.batchAgentList = new Map();
            this._nativeObj = new window.conchRTScene3DRenderManager();
        }
        registerBatchModuleAgent(renderNodeType, agent) {
            if (!this.batchAgentList.has(renderNodeType)) {
                this.batchAgentList.set(renderNodeType, agent);
                this._nativeObj.registerBatchModuleAgent(renderNodeType, agent._nativeObj);
                for (let i = 0; i < this._list.length; i++) {
                    if (this._list.elements[i].renderNode.renderNodeType == renderNodeType) {
                        agent.addRenderNode(this._list.elements[i]);
                        this._list.elements[i]._batchRender = agent;
                    }
                }
            }
        }
        updateProperty(object, property) {
            let agent = this.batchAgentList.get(object._baseRenderNode.renderNodeType);
            agent && agent.updateProperty(object, property);
        }
    }

    class LayaXBlitRenderFeature {
        _ensureNative() {
            if (!this._nativeObj) {
                this._nativeObj = new window.conchLayaXBlitFeature();
            }
            return this._nativeObj;
        }
        dispatch(element, destRT, globalSD, sceneSD, cameraSD, viewport, scissor, offsetScale) {
            let bf = this._ensureNative();
            bf.setElement(element ? element._nativeObj : null);
            bf.setDestRT(destRT ? destRT._nativeObj : null);
            bf.setShaderData(globalSD ? globalSD._nativeObj : null, sceneSD ? sceneSD._nativeObj : null, cameraSD ? cameraSD._nativeObj : null);
            bf.setViewport(viewport.x, viewport.y, viewport.width, viewport.height);
            bf.setScissor(scissor.x, scissor.y, scissor.z, scissor.w);
            bf.setOffsetScale(offsetScale.x, offsetScale.y, offsetScale.z, offsetScale.w);
            bf.execute();
        }
        destroy() {
            this._nativeObj = null;
        }
    }

    class LayaXRenderContext3D {
        get globalShaderData() { return this._globalShaderData; }
        set globalShaderData(value) {
            this._globalShaderData = value;
            if (this._nativeObj) {
                this._nativeObj.setGlobalShaderData(value ? value._nativeObj : null);
            }
        }
        get sceneData() { return this._sceneData; }
        set sceneData(value) {
            this._sceneData = value;
            if (this._nativeObj) {
                this._nativeObj.setSceneShaderData(value ? value._nativeObj : null);
            }
        }
        get cameraData() { return this._cameraData; }
        set cameraData(value) {
            this._cameraData = value;
            if (this._nativeObj) {
                this._nativeObj.setCameraShaderData(value ? value._nativeObj : null);
            }
        }
        get sceneModuleData() { return this._sceneModuleData; }
        set sceneModuleData(value) {
            this._sceneModuleData = value;
            if (this._nativeObj) {
                this._nativeObj.setSceneModuleData(value ? value._nativeObj : null);
            }
        }
        get cameraModuleData() { return this._cameraModuleData; }
        set cameraModuleData(value) {
            this._cameraModuleData = value;
            if (this._nativeObj) {
                this._nativeObj.setCameraModuleData(value ? value._nativeObj : null);
            }
        }
        get sceneUpdateMask() { return this._sceneUpdateMask; }
        set sceneUpdateMask(value) { this._sceneUpdateMask = value; }
        get cameraUpdateMask() { return this._cameraUpdateMask; }
        set cameraUpdateMask(value) { this._cameraUpdateMask = value; }
        get pipelineMode() { return this._pipelineMode; }
        set pipelineMode(value) { this._pipelineMode = value; }
        get invertY() { return this._invertY; }
        set invertY(value) {
            this._invertY = value;
            if (this._nativeObj) {
                this._nativeObj.setInvertY(value);
            }
        }
        constructor() {
            this._sceneUpdateMask = 0;
            this._cameraUpdateMask = 0;
            this._pipelineMode = "Forward";
            this._invertY = false;
            this.preDrawUniformMaps = new Set();
            this._destRT = null;
            this._viewport = new Laya.Viewport(0, 0, 0, 0);
            this._scissor = new Laya.Vector4();
            this._offsetScale = new Laya.Vector4(0, 0, 1, 1);
            this._clearFlag = Laya.RenderClearFlag.Nothing;
            this._clearColor = new Laya.Color();
            this._clearDepth = 1;
            this._clearStencil = 0;
            this._clearColorRGBA = [];
            this._clearColorEnabled = [];
            this.cameraUpdateMask = 0;
            this._nativeObj = new window.conchLayaXRenderContext();
        }
        setRenderTarget(value, clearFlag) {
            this._destRT = value;
            this._clearFlag = clearFlag !== null && clearFlag !== void 0 ? clearFlag : Laya.RenderClearFlag.Nothing;
        }
        setViewPort(value) {
            value.cloneTo(this._viewport);
        }
        setScissor(value) {
            value.cloneTo(this._scissor);
        }
        setClearData(clearFlag, color, depth, stencil, colorValues) {
            var _a, _b, _c, _d, _e;
            this._clearFlag = clearFlag;
            color.cloneTo(this._clearColor);
            this._clearDepth = depth;
            this._clearStencil = stencil;
            const rgba = this._clearColorRGBA;
            const enabled = this._clearColorEnabled;
            const count = (clearFlag & Laya.RenderClearFlag.Color) ? (_a = colorValues === null || colorValues === void 0 ? void 0 : colorValues.length) !== null && _a !== void 0 ? _a : 0 : 0;
            rgba.length = count * 4;
            enabled.length = count;
            for (let i = 0; i < count; i++) {
                const value = colorValues[i];
                enabled[i] = value ? 1 : 0;
                rgba[i * 4] = (_b = value === null || value === void 0 ? void 0 : value.r) !== null && _b !== void 0 ? _b : 0;
                rgba[i * 4 + 1] = (_c = value === null || value === void 0 ? void 0 : value.g) !== null && _c !== void 0 ? _c : 0;
                rgba[i * 4 + 2] = (_d = value === null || value === void 0 ? void 0 : value.b) !== null && _d !== void 0 ? _d : 0;
                rgba[i * 4 + 3] = (_e = value === null || value === void 0 ? void 0 : value.a) !== null && _e !== void 0 ? _e : 0;
            }
            return 0;
        }
        clearRenderTarget() {
            if (this._clearFlag === Laya.RenderClearFlag.Nothing)
                return;
            const cmd = this._clearCommand || (this._clearCommand = new window.conchLayaXSetRenderTargetCMD());
            cmd.setRT(this._destRT ? this._destRT._nativeObj : null);
            cmd.setClearFlag(this._clearFlag);
            const color = this._clearColor;
            cmd.clearColorValue(color.r, color.g, color.b, color.a);
            cmd.clearDepthValue(this._clearDepth);
            cmd.clearStencilValue(this._clearStencil);
            cmd.setClearColorValues(this._clearColorRGBA, this._clearColorEnabled);
            cmd.execute();
            this._clearFlag = Laya.RenderClearFlag.Nothing;
            this._clearColorRGBA.length = 0;
            this._clearColorEnabled.length = 0;
        }
        drawRenderElementList(list) {
            if (!list)
                return 0;
            for (let i = 0, n = list.length; i < n; i++) {
                this.drawRenderElementOne(list.elements[i]);
            }
            return list.length;
        }
        drawRenderElementOne(node) {
            if (!node)
                return 0;
            this.clearRenderTarget();
            if (!this._blitFeature) {
                this._blitFeature = new LayaXBlitRenderFeature();
            }
            this._blitFeature.dispatch(node, this._destRT, this._globalShaderData, this._sceneData, this._cameraData, this._viewport, this._scissor, this._offsetScale);
            return 1;
        }
        runOneCMD(cmd) {
            if (cmd) {
                cmd.apply(this);
            }
        }
        runCMDList(cmds) {
            if (!cmds)
                return;
            for (let i = 0, n = cmds.length; i < n; i++) {
                cmds[i].apply(this);
            }
        }
    }

    class LayaXRenderElement3D {
        constructor() {
            this.sortIndex = 0;
            this._isRender = true;
            this._materialRenderQueue = 0;
            this._materialId = 0;
            this._canDynamicBatch = false;
            this._nativeObj = new window.conchLayaXRenderElement();
        }
        get geometry() { return this._geometry; }
        set geometry(data) {
            this._geometry = data;
            if (this._nativeObj) {
                this._nativeObj.setGeometry(data ? data._nativeObj : null);
            }
        }
        get materialShaderData() { return this._materialShaderData; }
        set materialShaderData(data) {
            if (this._materialShaderData instanceof Laya.LayaXShaderData) {
                this._materialShaderData._removeRenderStateListener(this);
            }
            this._materialShaderData = data;
            if (this._nativeObj) {
                this._nativeObj.setMaterialShaderData(data ? data._nativeObj : null);
            }
            if (data instanceof Laya.LayaXShaderData) {
                data._addRenderStateListener(this);
                this._onRenderStateChanged();
            }
        }
        get renderShaderData() { return this._renderShaderData; }
        set renderShaderData(data) {
            this._renderShaderData = data;
            if (this._nativeObj) {
                this._nativeObj.setRenderShaderData(data ? data._nativeObj : null);
            }
        }
        get transform() { return this._transform; }
        set transform(data) {
            this._transform = data;
            if (this._nativeObj) {
                this._nativeObj.setTransform(data ? data._nativeObj : null);
            }
        }
        get isRender() { return this._isRender; }
        set isRender(data) {
            this._isRender = data;
            if (this._nativeObj) {
                this._nativeObj.setIsRender(data);
            }
        }
        get materialRenderQueue() { return this._materialRenderQueue; }
        set materialRenderQueue(value) {
            this._materialRenderQueue = value;
            if (this._nativeObj) {
                this._nativeObj.setRenderQueue(value);
            }
        }
        get materialId() { return this._materialId; }
        set materialId(value) { this._materialId = value; }
        get owner() { return this._owner; }
        set owner(value) {
            this._owner = value;
            if (this._nativeObj) {
                this._nativeObj.setOwner(value ? value._nativeObj : null);
            }
        }
        get subShader() { return this._subShader; }
        set subShader(value) {
            this._subShader = value;
            if (this._nativeObj) {
                this._nativeObj.setSubShader(value ? value.moduleData._nativeObj : null);
            }
        }
        get canDynamicBatch() { return this._canDynamicBatch; }
        set canDynamicBatch(value) { this._canDynamicBatch = value; }
        _onRenderStateChanged() {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
            let sd = this._materialShaderData;
            if (!sd || !this._nativeObj)
                return;
            let D = Laya.RenderState.Default;
            let blend = (_a = sd.getInt(Laya.Shader3D.BLEND)) !== null && _a !== void 0 ? _a : D.blend;
            let srcBlend = (_b = sd.getInt(Laya.Shader3D.BLEND_SRC)) !== null && _b !== void 0 ? _b : D.srcBlend;
            let dstBlend = (_c = sd.getInt(Laya.Shader3D.BLEND_DST)) !== null && _c !== void 0 ? _c : D.dstBlend;
            let blendEq = (_d = sd.getInt(Laya.Shader3D.BLEND_EQUATION)) !== null && _d !== void 0 ? _d : D.blendEquation;
            let srcBlendRGB = (_e = sd.getInt(Laya.Shader3D.BLEND_SRC_RGB)) !== null && _e !== void 0 ? _e : D.srcBlendRGB;
            let dstBlendRGB = (_f = sd.getInt(Laya.Shader3D.BLEND_DST_RGB)) !== null && _f !== void 0 ? _f : D.dstBlendRGB;
            let srcBlendAlpha = (_g = sd.getInt(Laya.Shader3D.BLEND_SRC_ALPHA)) !== null && _g !== void 0 ? _g : D.srcBlendAlpha;
            let dstBlendAlpha = (_h = sd.getInt(Laya.Shader3D.BLEND_DST_ALPHA)) !== null && _h !== void 0 ? _h : D.dstBlendAlpha;
            let blendEqRGB = (_j = sd.getInt(Laya.Shader3D.BLEND_EQUATION_RGB)) !== null && _j !== void 0 ? _j : D.blendEquationRGB;
            let blendEqAlpha = (_k = sd.getInt(Laya.Shader3D.BLEND_EQUATION_ALPHA)) !== null && _k !== void 0 ? _k : D.blendEquationAlpha;
            let depthTest = (_l = sd.getInt(Laya.Shader3D.DEPTH_TEST)) !== null && _l !== void 0 ? _l : D.depthTest;
            let depthWrite = (_m = sd.getBool(Laya.Shader3D.DEPTH_WRITE)) !== null && _m !== void 0 ? _m : D.depthWrite;
            let stencilTest = (_o = sd.getInt(Laya.Shader3D.STENCIL_TEST)) !== null && _o !== void 0 ? _o : D.stencilTest;
            let stencilWrite = (_p = sd.getBool(Laya.Shader3D.STENCIL_WRITE)) !== null && _p !== void 0 ? _p : D.stencilWrite;
            let stencilRef = (_q = sd.getInt(Laya.Shader3D.STENCIL_Ref)) !== null && _q !== void 0 ? _q : D.stencilRef;
            let stencilReadMask = (_r = sd.getInt(Laya.Shader3D.STENCIL_READ_MASK)) !== null && _r !== void 0 ? _r : D.stencilReadMask;
            let stencilWriteMask = (_s = sd.getInt(Laya.Shader3D.STENCIL_WRITE_MASK)) !== null && _s !== void 0 ? _s : D.stencilWriteMask;
            let stencilOp = sd.getVector3(Laya.Shader3D.STENCIL_Op);
            let stencilFail = stencilOp ? stencilOp.x : D.stencilOp.x;
            let stencilZFail = stencilOp ? stencilOp.y : D.stencilOp.y;
            let stencilPass = stencilOp ? stencilOp.z : D.stencilOp.z;
            let depthBias = (_t = sd.getBool(Laya.Shader3D.DEPTH_BIAS)) !== null && _t !== void 0 ? _t : D.depthBias;
            let depthBiasConstant = (_u = sd.getNumber(Laya.Shader3D.DEPTH_BIAS_CONSTANT)) !== null && _u !== void 0 ? _u : D.depthBiasConstant;
            let depthBiasSlopeScale = (_v = sd.getNumber(Laya.Shader3D.DEPTH_BIAS_SLOPESCALE)) !== null && _v !== void 0 ? _v : D.depthBiasSlopeScale;
            let depthBiasClamp = (_w = sd.getNumber(Laya.Shader3D.DEPTH_BIAS_CLAMP)) !== null && _w !== void 0 ? _w : D.depthBiasClamp;
            let cull = (_x = sd.getInt(Laya.Shader3D.CULL)) !== null && _x !== void 0 ? _x : D.cull;
            this._nativeObj.registerAndSetRenderState(blend, srcBlend, dstBlend, blendEq, srcBlendRGB, dstBlendRGB, srcBlendAlpha, dstBlendAlpha, blendEqRGB, blendEqAlpha, depthTest, depthWrite ? 1 : 0, stencilTest, stencilWrite ? 1 : 0, stencilRef, stencilReadMask, stencilWriteMask, stencilFail, stencilZFail, stencilPass, depthBias ? 1 : 0, depthBiasConstant, depthBiasSlopeScale, depthBiasClamp, cull, LayaXRenderElement3D._defaultFrontFace);
        }
        destroy() {
            if (this._materialShaderData instanceof Laya.LayaXShaderData) {
                this._materialShaderData._removeRenderStateListener(this);
            }
            if (this._nativeObj) {
                this._nativeObj.destroy();
                this._nativeObj = null;
            }
            this._geometry = null;
            this._materialShaderData = null;
            this._renderShaderData = null;
            this._transform = null;
            this._owner = null;
            this._subShader = null;
        }
    }
    LayaXRenderElement3D._defaultFrontFace = 1;

    class LayaXReflectionProbe {
        get boxProjection() { return this._i32[0] !== 0; }
        set boxProjection(value) {
            const v = value ? 1 : 0;
            if (this._i32[0] === v)
                return;
            this._i32[0] = v;
            LayaXReflectionProbe._dirtySet.add(this);
        }
        get bound() { return this._bound; }
        set bound(value) {
            this._bound = value;
            this._nativeObj.setBounds(value ? value._imp._nativeObj : null);
        }
        get ambientMode() { return this._u32[1]; }
        set ambientMode(value) {
            if (this._u32[1] === value)
                return;
            this._u32[1] = value;
            LayaXReflectionProbe._dirtySet.add(this);
        }
        get ambientIntensity() { return this._f32[2]; }
        set ambientIntensity(value) {
            if (this._f32[2] === value)
                return;
            this._f32[2] = value;
            LayaXReflectionProbe._dirtySet.add(this);
        }
        get reflectionIntensity() { return this._f32[3]; }
        set reflectionIntensity(value) {
            if (this._f32[3] === value)
                return;
            this._f32[3] = value;
            LayaXReflectionProbe._dirtySet.add(this);
        }
        get reflectionTexture() { return this._reflectionTexture; }
        set reflectionTexture(value) {
            if (this._reflectionTexture === value)
                return;
            this._reflectionTexture = value;
            this._nativeObj.setReflectionTexture(value ? value._nativeObj : null);
            LayaXReflectionProbe._dirtySet.add(this);
        }
        get iblTex() { return this._iblTex; }
        set iblTex(value) {
            if (this._iblTex === value)
                return;
            this._iblTex = value;
            this._nativeObj.setIblTex(value ? value._nativeObj : null);
            LayaXReflectionProbe._dirtySet.add(this);
        }
        get updateMark() { return this._u32[4]; }
        set updateMark(value) {
            if (this._u32[4] === value)
                return;
            this._u32[4] = value;
            LayaXReflectionProbe._dirtySet.add(this);
        }
        get iblTexRGBD() { return this._i32[5] !== 0; }
        set iblTexRGBD(value) {
            const v = value ? 1 : 0;
            if (this._i32[5] === v)
                return;
            this._i32[5] = v;
            LayaXReflectionProbe._dirtySet.add(this);
        }
        get shaderData() { return this._shaderData; }
        set shaderData(value) {
            this._shaderData = value;
        }
        setProbePosition(value) {
            if (value) {
                value.cloneTo(this._probePosition);
                this._f32[6] = value.x;
                this._f32[6 + 1] = value.y;
                this._f32[6 + 2] = value.z;
                LayaXReflectionProbe._dirtySet.add(this);
            }
        }
        setAmbientColor(value) {
            if (value) {
                value.cloneTo(this._ambientColor);
                this._f32[9] = value.r;
                this._f32[9 + 1] = value.g;
                this._f32[9 + 2] = value.b;
                this._f32[9 + 3] = value.a;
                LayaXReflectionProbe._dirtySet.add(this);
            }
        }
        setAmbientSH(value) {
            this._ambientSH = value;
            this._nativeObj.setAmbientSH(value);
            LayaXReflectionProbe._dirtySet.add(this);
        }
        needUpdate() {
            return this.updateMark != this._updateMaskFlag;
        }
        applyRenderData() {
            this._updateMaskFlag = this.updateMark;
            let data = this._shaderData;
            if (!this.boxProjection) {
                data.removeDefine(Laya.Sprite3DRenderDeclaration.SHADERDEFINE_SPECCUBE_BOX_PROJECTION);
            }
            else {
                data.addDefine(Laya.Sprite3DRenderDeclaration.SHADERDEFINE_SPECCUBE_BOX_PROJECTION);
                data.setVector3(Laya.ReflectionProbe.REFLECTIONCUBE_PROBEPOSITION, this._probePosition);
                data.setVector3(Laya.ReflectionProbe.REFLECTIONCUBE_PROBEBOXMAX, this._bound.getMax());
                data.setVector3(Laya.ReflectionProbe.REFLECTIONCUBE_PROBEBOXMIN, this._bound.getMin());
            }
            if (this.ambientMode == Laya.AmbientMode.SolidColor) {
                data.removeDefine(Laya.Sprite3DRenderDeclaration.SHADERDEFINE_GI_LEGACYIBL);
                data.removeDefine(Laya.ReflectionProbe.SHADERDEFINE_GI_IBL);
                data.setColor(Laya.ReflectionProbe.AMBIENTCOLOR, this._ambientColor);
            }
            else if (this._iblTex && this._ambientSH) {
                data.addDefine(Laya.ReflectionProbe.SHADERDEFINE_GI_IBL);
                data.removeDefine(Laya.Sprite3DRenderDeclaration.SHADERDEFINE_GI_LEGACYIBL);
                if (this._iblTex) {
                    data._setInternalTexture(Laya.ReflectionProbe.IBLTEX, this._iblTex._nativeObj);
                    data.setNumber(Laya.ReflectionProbe.IBLROUGHNESSLEVEL, this._iblTex.maxMipmapLevel);
                }
                this.iblTexRGBD ? data.addDefine(Laya.Sprite3DRenderDeclaration.SHADERDEFINE_IBL_RGBD) : data.removeDefine(Laya.Sprite3DRenderDeclaration.SHADERDEFINE_IBL_RGBD);
                this._ambientSH && data.setBuffer(Laya.ReflectionProbe.AMBIENTSH, this._ambientSH);
            }
            else {
                data.removeDefine(Laya.Sprite3DRenderDeclaration.SHADERDEFINE_GI_LEGACYIBL);
                data.removeDefine(Laya.ReflectionProbe.SHADERDEFINE_GI_IBL);
            }
            data.setNumber(Laya.ReflectionProbe.AMBIENTINTENSITY, this.ambientIntensity);
            data.setNumber(Laya.ReflectionProbe.REFLECTIONINTENSITY, this.reflectionIntensity);
        }
        constructor() {
            this._id = ++LayaXReflectionProbe._idCounter;
            this._updateMaskFlag = -1;
            this._probePosition = new Laya.Vector3();
            this._ambientColor = new Laya.Color();
            this._nativeObj = new window.conchLayaXReflectionProbe();
            this._buf = new ArrayBuffer(13 * 4);
            this._f32 = new Float32Array(this._buf);
            this._i32 = new Int32Array(this._buf);
            this._u32 = new Uint32Array(this._buf);
            this._f32[2] = 1.0;
            this._f32[3] = 1.0;
            this._nativeObj.bindBuffer(this._buf);
            this.shaderData = Laya.LayaGL.renderDeviceFactory.createShaderData();
        }
        destroy() {
            LayaXReflectionProbe._dirtySet.delete(this);
            this._nativeObj.destroy();
            this.shaderData.destroy();
            this.shaderData = null;
        }
    }
    LayaXReflectionProbe._idCounter = 0;
    LayaXReflectionProbe._dirtySet = new Set();

    class LayaXVolumetricGI {
        get irradiance() { return this._irradiance; }
        set irradiance(value) {
            if (this._irradiance === value)
                return;
            this._irradiance = value;
            this._nativeObj.setIrradiance(value ? value._nativeObj : null);
            LayaXVolumetricGI._dirtySet.add(this);
        }
        get distance() { return this._distance; }
        set distance(value) {
            if (this._distance === value)
                return;
            this._distance = value;
            this._nativeObj.setDistance(value ? value._nativeObj : null);
            LayaXVolumetricGI._dirtySet.add(this);
        }
        get bound() { return this._bound; }
        set bound(value) {
            this._bound = value;
            this._nativeObj.setBounds(value ? value._imp._nativeObj : null);
        }
        get intensity() { return this._f32[0]; }
        set intensity(value) {
            if (this._f32[0] === value)
                return;
            this._f32[0] = value;
            LayaXVolumetricGI._dirtySet.add(this);
        }
        get updateMark() { return this._u32[1]; }
        set updateMark(value) {
            if (this._u32[1] === value)
                return;
            this._u32[1] = value;
            LayaXVolumetricGI._dirtySet.add(this);
        }
        get shaderData() { return this._shaderData; }
        set shaderData(value) {
            this._shaderData = value;
        }
        constructor() {
            this._id = ++LayaXVolumetricGI._idCounter;
            this._probeCounts = new Laya.Vector3();
            this._probeStep = new Laya.Vector3();
            this._params = new Laya.Vector4();
            this._nativeObj = new window.conchLayaXVolumetricGI();
            this._buf = new ArrayBuffer(12 * 4);
            this._f32 = new Float32Array(this._buf);
            this._u32 = new Uint32Array(this._buf);
            this._f32[0] = 1.0;
            this._nativeObj.bindBuffer(this._buf);
            this.shaderData = Laya.LayaGL.renderDeviceFactory.createShaderData();
            this._defaultBounds = new Laya.Bounds();
            this.bound = this._defaultBounds;
        }
        setParams(value) {
            value.cloneTo(this._params);
            this._f32[2] = value.x;
            this._f32[2 + 1] = value.y;
            this._f32[2 + 2] = value.z;
            this._f32[2 + 3] = value.w;
        }
        setProbeCounts(value) {
            value.cloneTo(this._probeCounts);
            this._f32[6] = value.x;
            this._f32[6 + 1] = value.y;
            this._f32[6 + 2] = value.z;
        }
        setProbeStep(value) {
            value.cloneTo(this._probeStep);
            this._f32[9] = value.x;
            this._f32[9 + 1] = value.y;
            this._f32[9 + 2] = value.z;
        }
        applyRenderData() {
            let data = this._shaderData;
            data.addDefine(Laya.VolumetricGI.SHADERDEFINE_VOLUMETRICGI);
            data.setVector3(Laya.VolumetricGI.VOLUMETRICGI_PROBECOUNTS, this._probeCounts);
            data.setVector3(Laya.VolumetricGI.VOLUMETRICGI_PROBESTEPS, this._probeStep);
            data.setVector3(Laya.VolumetricGI.VOLUMETRICGI_PROBESTARTPOS, this._bound.getMin());
            data.setVector(Laya.VolumetricGI.VOLUMETRICGI_PROBEPARAMS, this._params);
            data._setInternalTexture(Laya.VolumetricGI.VOLUMETRICGI_IRRADIANCE, this._irradiance ? this._irradiance._nativeObj : null);
            data._setInternalTexture(Laya.VolumetricGI.VOLUMETRICGI_DISTANCE, this._distance ? this._distance._nativeObj : null);
            data.setNumber(Laya.ReflectionProbe.AMBIENTINTENSITY, this.intensity);
        }
        destroy() {
            LayaXVolumetricGI._dirtySet.delete(this);
            this._nativeObj.destroy();
            this.distance = null;
            this.irradiance = null;
            this._shaderData.destroy();
            this._shaderData = null;
        }
    }
    LayaXVolumetricGI._idCounter = 0;
    LayaXVolumetricGI._dirtySet = new Set();

    class LayaXDirCascadeShadowRP {
        constructor() {
            this._nativeObj = new window.conchLayaXDirCascadeShadowRP();
        }
        setShadowCasterCommanBuffer(cmd) {
            this._nativeObj.clearShadowCasterCommandBuffer();
            cmd.forEach(element => {
                this._setCmd(element);
            });
        }
        _setCmd(cmd) {
            cmd._apply(false);
            let cmds = cmd._renderCMDs;
            let nativeobCMDs = [];
            cmds.forEach(element => {
                nativeobCMDs.push(element._nativeObj);
            });
            this._nativeObj.addShadowCasterCommandBuffers(nativeobCMDs);
        }
        setRPData(dirLight, camera, context) {
            this._destShadowRT = Laya.Scene3D._shadowCasterPass.getDirectLightShadowMap(dirLight);
            if (dirLight.transform) {
                let lightWorld = Laya.Matrix4x4.TEMP;
                Laya.Matrix4x4.createFromQuaternion(dirLight.transform.rotation, lightWorld);
                let e = lightWorld.elements;
                dirLight.setOrientation(e[4], e[5], e[6], e[0], e[1], e[2], -e[8], -e[9], -e[10]);
            }
            this._nativeObj.setRPData(dirLight._nativeObj, camera._nativeObj, context._nativeObj, this._destShadowRT._renderTarget._nativeObj);
        }
        setCameraCullInfo(sceneManager) {
            this._nativeObj.setCameraCullInfo(sceneManager._nativeObj);
        }
        destroy() {
        }
    }

    class LayaXForwardAddClusterRP {
        get pipelineMode() { return this._nativeObj.pipelineMode; }
        set pipelineMode(value) { this._nativeObj.pipelineMode = value; }
        get depthPipelineMode() { return this._nativeObj.depthPipelineMode; }
        set depthPipelineMode(value) { this._nativeObj.depthPipelineMode = value; }
        get depthNormalPipelineMode() { return this._nativeObj.depthNormalPipelineMode; }
        set depthNormalPipelineMode(value) { this._nativeObj.depthNormalPipelineMode = value; }
        get depthTextureMode() { return this._u32[3]; }
        set depthTextureMode(value) { this._u32[3] = value; }
        get depthTarget() {
            return this._depthTarget;
        }
        set depthTarget(value) {
            this._depthTarget = value;
            this._nativeObj.setDepthTarget(value ? value._nativeObj : null);
        }
        get destTarget() {
            return this._destTarget;
        }
        set destTarget(value) {
            this._destTarget = value;
            this._nativeObj.setDestTarget(value ? value._nativeObj : null);
        }
        get opaqueMRTTarget() { return this._opaqueMRTTarget; }
        set opaqueMRTTarget(value) {
            this._opaqueMRTTarget = value;
            this._nativeObj.setOpaqueMRTTarget(value ? value._nativeObj : null);
        }
        get opaqueMRTClearColors() { return this._opaqueMRTClearColors; }
        set opaqueMRTClearColors(value) {
            var _a, _b, _c, _d, _e;
            this._opaqueMRTClearColors = value;
            const rgba = this._opaqueMRTClearRGBA;
            const enabled = this._opaqueMRTClearEnabled;
            const count = (_a = value === null || value === void 0 ? void 0 : value.length) !== null && _a !== void 0 ? _a : 0;
            rgba.length = count * 4;
            enabled.length = count;
            for (let i = 0; i < count; i++) {
                const color = value[i];
                enabled[i] = color ? 1 : 0;
                rgba[i * 4] = (_b = color === null || color === void 0 ? void 0 : color.r) !== null && _b !== void 0 ? _b : 0;
                rgba[i * 4 + 1] = (_c = color === null || color === void 0 ? void 0 : color.g) !== null && _c !== void 0 ? _c : 0;
                rgba[i * 4 + 2] = (_d = color === null || color === void 0 ? void 0 : color.b) !== null && _d !== void 0 ? _d : 0;
                rgba[i * 4 + 3] = (_e = color === null || color === void 0 ? void 0 : color.a) !== null && _e !== void 0 ? _e : 0;
            }
            this._nativeObj.setOpaqueMRTClearColors(rgba, enabled);
        }
        get depthNormalTarget() {
            return this._depthNormalTarget;
        }
        set depthNormalTarget(value) {
            this._depthNormalTarget = value;
            this._nativeObj.setDepthNormalTarget(value ? value._nativeObj : null);
        }
        get enableCMD() { return this._u32[2] !== 0; }
        set enableCMD(value) { this._u32[2] = value ? 1 : 0; }
        get enableOpaque() { return this._u32[0] !== 0; }
        set enableOpaque(value) { this._u32[0] = value ? 1 : 0; }
        get enableTransparent() { return this._u32[1] !== 0; }
        set enableTransparent(value) { this._u32[1] = value ? 1 : 0; }
        get camera() {
            return this._camera;
        }
        set camera(value) {
            this._camera = value;
            this._nativeObj.setCameraNodeData(value._nativeObj);
        }
        get clearColor() {
            return this._clearColor;
        }
        set clearColor(value) {
            this._clearColor = value;
            this._f32[5] = value.r;
            this._f32[6] = value.g;
            this._f32[7] = value.b;
            this._f32[8] = value.a;
        }
        get clearFlag() {
            return this._clearFlag;
        }
        set clearFlag(value) {
            this._clearFlag = value;
            this._u32[4] = value;
        }
        setCameraCullInfo(value, sceneManager) {
            let pos = value._transform.position;
            this._u32[19] = value.cullingMask;
            this._u32[20] = value.staticMask;
            this._f32[21] = pos.x;
            this._f32[22] = pos.y;
            this._f32[23] = pos.z;
            this._nativeObj.bindBuffer(this._buf);
        }
        setViewPort(value) {
            this._f32[11] = value.x;
            this._f32[12] = value.y;
            this._f32[13] = value.width;
            this._f32[14] = value.height;
        }
        setScissor(value) {
            this._i32[15] = value.x;
            this._i32[16] = value.y;
            this._i32[17] = value.z;
            this._i32[18] = value.w;
        }
        _getRenderCMDArray(cmds) {
            let nativeobCMDs = [];
            cmds.forEach(element => {
                nativeobCMDs.push(element._nativeObj);
            });
            return nativeobCMDs;
        }
        setSkyRenderNode(value) {
            this._nativeObj.setSkyRenderNode(value ? value._nativeObj : null);
        }
        setBeforeSkyboxCmds(value) {
            if (value && value.length > 0) {
                this._nativeObj.clearBeforeSkyboxCmds();
                value.forEach(element => {
                    element._apply(false);
                    this._nativeObj.addBeforeSkyboxCmds(this._getRenderCMDArray(element._renderCMDs));
                });
            }
            else {
                this._nativeObj.clearBeforeSkyboxCmds();
            }
        }
        setBeforeForwardCmds(value) {
            if (value && value.length > 0) {
                this._nativeObj.clearBeforeForwardCmds();
                value.forEach(element => {
                    element._apply(false);
                    this._nativeObj.addBeforeForwardCmds(this._getRenderCMDArray(element._renderCMDs));
                });
            }
            else {
                this._nativeObj.clearBeforeForwardCmds();
            }
        }
        setBeforeTransparentCmds(value) {
            if (value && value.length > 0) {
                this._nativeObj.clearBeforeTransparentCmds();
                value.forEach(element => {
                    element._apply(false);
                    this._nativeObj.addBeforeTransparentCmds(this._getRenderCMDArray(element._renderCMDs));
                });
            }
            else {
                this._nativeObj.clearBeforeTransparentCmds();
            }
        }
        constructor() {
            this._opaqueMRTClearRGBA = [];
            this._opaqueMRTClearEnabled = [];
            this._nativeObj = new window.conchLayaXForwardAddClusterRP();
            this._buf = new ArrayBuffer(24 * 4);
            this._f32 = new Float32Array(this._buf);
            this._u32 = new Uint32Array(this._buf);
            this._i32 = new Int32Array(this._buf);
            this._u32[0] = 1;
            this._u32[1] = 1;
            this._u32[2] = 0;
            this._u32[3] = 0;
            this._f32[9] = 1.0;
            this._u32[10] = 0;
            this._nativeObj.bindBuffer(this._buf);
        }
        destroy() {
            this._nativeObj = null;
        }
    }

    class LayaXBaseSpotRP {
        constructor() {
            this._nativeObj = new window.conchLayaXBaseSpotRP();
        }
        setShadowCasterCommanBuffer(cmd) {
        }
        setCameraCullInfo(sceneManager) {
            this._nativeObj.setCameraCullInfo(sceneManager._nativeObj);
        }
        setRPData(spotLight, context) {
            this._destShadowRT = Laya.Scene3D._shadowCasterPass.getSpotLightShadowPassData(spotLight);
            this._nativeObj.setRPData(spotLight._nativeObj, context._nativeObj, this._destShadowRT._renderTarget._nativeObj);
        }
        destroy() {
        }
    }

    class LayaXForwardAddRP {
        get shadowCastPass() {
            return this._i32[0] !== 0;
        }
        set shadowCastPass(value) {
            this._i32[0] = value ? 1 : 0;
        }
        get enableDirectLightShadow() {
            return this._i32[1] !== 0;
        }
        set enableDirectLightShadow(value) {
            this._i32[1] = value ? 1 : 0;
        }
        get enableSpotLightShadowPass() {
            return this._i32[2] !== 0;
        }
        set enableSpotLightShadowPass(value) {
            this._i32[2] = value ? 1 : 0;
        }
        get enablePostProcess() {
            return this._i32[3] !== 0;
        }
        set enablePostProcess(value) {
            this._i32[3] = value ? 1 : 0;
        }
        get postProcess() {
            return this._postProcess;
        }
        set postProcess(value) {
            this._postProcess = value;
            value._apply(false);
            this._nativeObj.setPostProcess(this._getRenderCMDArray(value._renderCMDs));
        }
        get finalize() {
            return this._finalize;
        }
        set finalize(value) {
            this._finalize = value;
            value._apply(false);
            this._nativeObj.setfinalize(this._getRenderCMDArray(value._renderCMDs));
        }
        get dirShadowRenderPass() {
            return this._dirLightShadowPass;
        }
        set dirShadowRenderPass(value) {
            this._dirLightShadowPass = value;
            this._nativeObj.setDirectLightShadowPass(value._nativeObj);
        }
        get spotShadowRenderPass() {
            return this._spotShadowRenderPass;
        }
        set spotShadowRenderPass(value) {
            this._spotShadowRenderPass = value;
            this._nativeObj.setSpotLightShadowPass(value._nativeObj);
        }
        get mainRenderpass() {
            return this._mainRenderpass;
        }
        set mainRenderpass(value) {
            this._mainRenderpass = value;
            this._nativeObj.setMainPass(value._nativeObj);
        }
        constructor() {
            this._finalize = new Laya.CommandBuffer();
            this._nativeObj = new window.conchLayaXForwardAddRP();
            this._buf = new ArrayBuffer(4 * 4);
            this._i32 = new Int32Array(this._buf);
            this._nativeObj.bindBuffer(this._buf);
            this.shadowCastPass = false;
            this.enableDirectLightShadow = false;
            this.enableSpotLightShadowPass = false;
            this.dirShadowRenderPass = new LayaXDirCascadeShadowRP();
            this.spotShadowRenderPass = new LayaXBaseSpotRP();
            this.mainRenderpass = new LayaXForwardAddClusterRP();
        }
        _getRenderCMDArray(cmds) {
            let nativeobCMDs = [];
            cmds.forEach(element => {
                nativeobCMDs.push(element._nativeObj);
            });
            return nativeobCMDs;
        }
        setAfterEventCmd(value) {
            if (value && value.length > 0) {
                this._nativeObj.clearAfterAllRenderCmds();
                value.forEach(element => {
                    element._apply(false);
                    this._nativeObj.addAfterAllRenderCmds(this._getRenderCMDArray(element._renderCMDs));
                });
            }
            else {
                this._nativeObj.clearAfterAllRenderCmds();
            }
        }
        setBeforeImageEffect(value) {
            if (value && value.length > 0) {
                this._nativeObj.clearBeforeImageEffectCmds();
                value.forEach(element => {
                    element._apply(false);
                    this._nativeObj.addBeforeImageEffectCmds(this._getRenderCMDArray(element._renderCMDs));
                });
            }
            else {
                this._nativeObj.clearBeforeImageEffectCmds();
            }
        }
        destroy() {
        }
    }

    const viewport$1 = new Laya.Viewport(0, 0, 0, 0);
    const offsetScale$1 = new Laya.Vector4();
    class LayaXRender3DProcess {
        constructor() {
            this._renderPass = new LayaXForwardAddRP();
            this._nativeObj = new window.conchLayaXRT3DRenderProcess();
            this._defaultDepthTex = Laya.RenderTexture.createFromPool(1, 1, Laya.RenderTargetFormat.DEPTH_32, Laya.RenderTargetFormat.None, false, 1);
            this._defaultShadowMap = Laya.ShadowUtils.getTemporaryShadowTexture(1, 1, Laya.ShadowMapFormat.bit16);
            this._nativeObj.setDefaultShadowMap(this._defaultShadowMap._renderTarget._nativeObj);
            let shadowMap = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap("Shadow");
            shadowMap.setDefaultTextureData(Laya.ShadowCasterPass.SHADOW_MAP, this._defaultShadowMap);
            shadowMap.setDefaultTextureData(Laya.ShadowCasterPass.SHADOW_SPOTMAP, this._defaultShadowMap);
        }
        get render3DManager() {
            return this._render3DManager;
        }
        set render3DManager(value) {
            this._render3DManager = value;
            this._nativeObj.renderManager = value._nativeObj;
        }
        destroy() {
            this._renderPass = null;
        }
        initRenderpass(camera, context) {
            camera._renderDataModule.syncProjection();
            let renderpass = this._renderPass.mainRenderpass;
            let renderRT = camera._getRenderTexture();
            let clearConst = 0;
            let clearFlag = camera.clearFlag;
            if (clearFlag == Laya.CameraClearFlags.Sky && !camera.scene.skyRenderer._isAvailable()) {
                clearFlag = Laya.CameraClearFlags.SolidColor;
            }
            let hasStencil = renderRT.depthStencilFormat == Laya.RenderTargetFormat.DEPTHSTENCIL_24_8;
            let stencilFlag = hasStencil ? Laya.RenderClearFlag.Stencil : 0;
            switch (clearFlag) {
                case Laya.CameraClearFlags.DepthOnly:
                case Laya.CameraClearFlags.Sky:
                    clearConst = Laya.RenderClearFlag.Depth | stencilFlag;
                    break;
                case Laya.CameraClearFlags.Nothing:
                    clearConst = 0;
                    break;
                case Laya.CameraClearFlags.ColorOnly:
                    clearConst = Laya.RenderClearFlag.Color;
                    break;
                case Laya.CameraClearFlags.SolidColor:
                default:
                    clearConst = Laya.RenderClearFlag.Color | Laya.RenderClearFlag.Depth | stencilFlag;
                    break;
            }
            let clearValue = camera._linearClearColor;
            clearValue = renderRT.gammaCorrection != 1 ? camera.clearColor : camera._linearClearColor;
            renderpass.camera = camera._renderDataModule;
            renderpass.destTarget = renderRT._getRenderTarget(!!camera.effectiveOpaqueMRT);
            renderpass.clearFlag = clearConst;
            renderpass.clearColor = clearValue;
            renderpass.opaqueMRTTarget = camera.effectiveOpaqueMRT ? renderRT._getRenderTarget() : null;
            renderpass.opaqueMRTClearColors = camera._getOpaqueMRTClearColors((clearConst & Laya.RenderClearFlag.Color) ? clearValue : null);
            let needInternalRT = camera._needInternalRenderTexture();
            renderpass.setCameraCullInfo(camera, this.render3DManager);
            if (needInternalRT) {
                viewport$1.set(0, 0, renderRT.width, renderRT.height);
            }
            else {
                camera.viewport.cloneTo(viewport$1);
            }
            renderpass.setViewPort(viewport$1);
            let scissor = Laya.Vector4.TEMP;
            scissor.setValue(viewport$1.x, viewport$1.y, viewport$1.width, viewport$1.height);
            renderpass.setScissor(scissor);
            renderpass.enableOpaque = Laya.Stat.enableOpaque;
            renderpass.enableTransparent = Laya.Stat.enableTransparent;
            renderpass.enableCMD = Laya.Stat.enableCameraCMD;
            renderpass.setBeforeForwardCmds(camera._cameraEventCommandBuffer[Laya.CameraEventFlags.BeforeForwardOpaque]);
            renderpass.setBeforeSkyboxCmds(camera._cameraEventCommandBuffer[Laya.CameraEventFlags.BeforeSkyBox]);
            renderpass.setBeforeTransparentCmds(camera._cameraEventCommandBuffer[Laya.CameraEventFlags.BeforeTransparent]);
            if (clearFlag == Laya.CameraClearFlags.Sky) {
                renderpass.setSkyRenderNode(camera.scene.skyRenderer._baseRenderNode);
            }
            else {
                renderpass.setSkyRenderNode(null);
            }
            this._renderPass.setBeforeImageEffect(camera._cameraEventCommandBuffer[Laya.CameraEventFlags.BeforeImageEffect]);
            this._renderPass.setAfterEventCmd(camera._cameraEventCommandBuffer[Laya.CameraEventFlags.AfterEveryThing]);
            renderpass.pipelineMode = Laya.RenderContext3D._instance.configPipeLineMode;
            let enableShadow = Laya.Scene3D._updateMark % camera.scene._ShadowMapupdateFrequency == 0 && Laya.Stat.enableShadow;
            this._renderPass.shadowCastPass = enableShadow;
            window.conchLayaXRT3DRenderProcess._addPreDrawUniformMap("Scene3D", context._nativeObj);
            window.conchLayaXRT3DRenderProcess._addPreDrawUniformMap("Global", context._nativeObj);
            context.preDrawUniformMaps = context.preDrawUniformMaps;
            if (enableShadow) {
                let mainDirectionLight = camera.scene._mainDirectionLight;
                let needDirectionShadow = mainDirectionLight && mainDirectionLight.shadowMode != Laya.ShadowMode.None;
                this._renderPass.enableDirectLightShadow = needDirectionShadow;
                if (needDirectionShadow) {
                    let dirLight = mainDirectionLight._dataModule;
                    let camData = camera._renderDataModule;
                    dirLight.syncShadow();
                    this._renderPass.dirShadowRenderPass.setRPData(dirLight, camData, context);
                    this._renderPass.dirShadowRenderPass.setCameraCullInfo(this._render3DManager);
                }
                let mainSpotLight = camera.scene._mainSpotLight;
                let needSpotShadow = mainSpotLight && mainSpotLight.shadowMode != Laya.ShadowMode.None;
                this._renderPass.enableSpotLightShadowPass = needSpotShadow;
                if (needSpotShadow) {
                    let spotLight = mainSpotLight._dataModule;
                    spotLight.syncShadow();
                    this._renderPass.spotShadowRenderPass.setRPData(spotLight, context);
                    this._renderPass.spotShadowRenderPass.setCameraCullInfo(this.render3DManager);
                }
                if (needDirectionShadow || needSpotShadow) {
                    window.conchLayaXRT3DRenderProcess._addPreDrawUniformMap("Shadow", context._nativeObj);
                }
            }
            else {
                window.conchLayaXRT3DRenderProcess._removePreDrawUniformMap("Shadow", context._nativeObj);
            }
            context.preDrawUniformMaps = context.preDrawUniformMaps;
            if (Laya.Stat.enablePostprocess && camera.postProcess && camera.postProcess.enable && camera.postProcess.effects.length > 0) {
                this._renderPass.enablePostProcess = camera.postProcess.enable;
                camera.postProcess._render(camera);
                this._renderPass.postProcess = camera.postProcess._context.command;
            }
            else {
                this._renderPass.enablePostProcess = false;
            }
            this._renderPass.finalize.clear();
            this._renderPass.finalize._camera = camera;
            if (!this._renderPass.enablePostProcess && needInternalRT && camera._offScreenRenderTexture) {
                let dst = camera._offScreenRenderTexture;
                if (Laya.LayaGL.renderEngine._screenInvertY) {
                    offsetScale$1.setValue(camera.normalizedViewport.x, camera.normalizedViewport.y, renderRT.width / dst.width, renderRT.height / dst.height);
                }
                else {
                    offsetScale$1.setValue(camera.normalizedViewport.x, 1.0 - camera.normalizedViewport.y, renderRT.width / dst.width, -renderRT.height / dst.height);
                }
                this._renderPass.finalize.blitScreenQuad(renderRT, camera._offScreenRenderTexture, offsetScale$1);
            }
            this._renderPass.finalize = this._renderPass.finalize;
        }
        renderDepth(camera) {
            this._renderPass.mainRenderpass.depthTarget = null;
            let depthMode = camera.depthTextureMode;
            if (camera.postProcess && camera.postProcess.enable) {
                depthMode |= camera.postProcess.cameraDepthTextureMode;
            }
            if ((depthMode & Laya.DepthTextureMode.Depth) != 0) {
                Laya.Camera.depthPass.getTarget(camera, Laya.DepthTextureMode.Depth, camera.depthTextureFormat);
                const useCachedDepth = camera.canblitDepth && camera.depthTexture === camera._cacheDepthTexture.depthStencilTexture;
                if (useCachedDepth)
                    depthMode &= ~Laya.DepthTextureMode.Depth;
                else
                    this._renderPass.mainRenderpass.depthTarget = camera.depthTexture._getRenderTarget();
                Laya.Camera.depthPass._setupDepthModeShaderValue(Laya.DepthTextureMode.Depth, camera);
            }
            if ((depthMode & Laya.DepthTextureMode.DepthNormals) != 0) {
                Laya.Camera.depthPass.getTarget(camera, Laya.DepthTextureMode.DepthNormals, camera.depthTextureFormat);
                this._renderPass.mainRenderpass.depthNormalTarget = camera.depthNormalTexture._renderTarget;
                camera._shaderValues.setTexture(Laya.DepthPass.DEPTHNORMALSTEXTURE, camera.depthNormalTexture);
                Laya.Camera.depthPass._setupDepthModeShaderValue(Laya.DepthTextureMode.DepthNormals, camera);
            }
            this._renderPass.mainRenderpass.depthTextureMode = depthMode;
        }
        fowardRender(context, camera) {
            LayaXRender3DProcess._flushDirtyProbes();
            Laya.Camera.depthPass.cleanUp(camera);
            context.cameraData.setTexture(Laya.DepthPass.DEPTHTEXTURE, this._defaultDepthTex);
            this.renderDepth(camera);
            this.initRenderpass(camera, context);
            try {
                this.renderFowarAddCameraPass(context, this._renderPass);
            }
            finally {
                this._renderPass.mainRenderpass.opaqueMRTTarget = null;
                this._renderPass.mainRenderpass.opaqueMRTClearColors = null;
            }
        }
        static _flushDirtyProbes() {
            let rpDirty = LayaXReflectionProbe._dirtySet;
            if (rpDirty.size > 0) {
                rpDirty.forEach(probe => probe.applyRenderData());
                rpDirty.clear();
            }
            let giDirty = LayaXVolumetricGI._dirtySet;
            if (giDirty.size > 0) {
                giDirty.forEach(gi => gi.applyRenderData());
                giDirty.clear();
            }
        }
        renderFowarAddCameraPass(context, renderpass) {
            this._nativeObj.renderForwardAddCameraPass(context._nativeObj, renderpass._nativeObj);
        }
    }

    class LayaXSkinRenderElement3D extends LayaXRenderElement3D {
        get skinnedData() {
            return this._skinnedData;
        }
        set skinnedData(data) {
            this._skinnedData = data;
        }
    }
    class LayaXDrawNodeCMDData extends Laya.DrawNodeCMDData {
        constructor() {
            super();
            this.type = Laya.RenderCMDType.DrawNode;
            this._nativeObj = new window.conchLayaXDrawNodeCMD();
        }
        get node() {
            return this._node;
        }
        set node(value) {
            this._node = value;
            this._nativeObj.setBaseRenderNode(value ? value._nativeObj : null);
        }
        get destShaderData() {
            return this._destShaderData;
        }
        set destShaderData(value) {
            this._destShaderData = value;
            this._nativeObj.setShaderData(value ? value._nativeObj : null);
        }
        get destSubShader() {
            return this._destSubShader;
        }
        set destSubShader(value) {
            this._destSubShader = value;
            this._nativeObj.setSubShader(value ? value.moduleData._nativeObj : null);
        }
        get subMeshIndex() {
            return this._subMeshIndex;
        }
        set subMeshIndex(value) {
            this._subMeshIndex = value;
            this._nativeObj.setSubMeshIndex(value);
        }
        apply(_context) {
            this._nativeObj.execute();
        }
    }
    class LayaXBlitQuadCMDData extends Laya.BlitQuadCMDData {
        constructor() {
            super();
            this.type = Laya.RenderCMDType.Blit;
            this._nativeObj = new window.conchLayaXBlitQuadCMD();
        }
        get element() {
            return this._element;
        }
        set element(value) {
            this._element = value;
            this._nativeObj.setRenderElement(value ? value._nativeObj : null);
        }
        get dest() {
            return this._dest;
        }
        set dest(value) {
            this._dest = value;
            this._nativeObj.setDest(value ? value._nativeObj : null);
        }
        get viewport() {
            return this._viewport;
        }
        set viewport(value) {
            this._viewport = value;
            if (value) {
                this._nativeObj.setViewport(value.x, value.y, value.width, value.height);
            }
        }
        get scissor() {
            return this._scissor;
        }
        set scissor(value) {
            this._scissor = value;
            if (value) {
                this._nativeObj.setScissor(value.x, value.y, value.z, value.w);
            }
        }
        get source() {
            return this._source;
        }
        set source(value) {
            this._source = value;
            this._nativeObj.setSource(value ? value._nativeObj : null);
        }
        get offsetScale() {
            return this._offsetScale;
        }
        set offsetScale(value) {
            this._offsetScale = value;
            if (value) {
                this._nativeObj.setOffsetScale(value.x, value.y, value.z, value.w);
            }
        }
        apply(_context) {
            this._nativeObj.execute();
        }
    }
    class LayaXDrawElementCMDData extends Laya.DrawElementCMDData {
        constructor() {
            super();
            this.type = Laya.RenderCMDType.DrawElement;
            this._nativeObj = new window.conchLayaXDrawElementCMD();
        }
        setRenderelements(value) {
            this._nativeObj.clearElement();
            if (value) {
                for (let i = 0, n = value.length; i < n; i++) {
                    this._nativeObj.addOneElement(value[i]._nativeObj);
                }
            }
        }
        apply(_context) {
            this._nativeObj.execute();
        }
    }
    class LayaXSetViewportCMD extends Laya.SetViewportCMD {
        constructor() {
            super();
            this.type = Laya.RenderCMDType.ChangeViewPort;
            this._nativeObj = new window.conchLayaXSetViewportCMD();
        }
        get viewport() {
            return this._viewport;
        }
        set viewport(value) {
            this._viewport = value;
            if (value) {
                this._nativeObj.setViewport(value.x, value.y, value.width, value.height);
            }
        }
        get scissor() {
            return this._scissor;
        }
        set scissor(value) {
            this._scissor = value;
            if (value) {
                this._nativeObj.setScissor(value.x, value.y, value.z, value.w);
            }
        }
        apply(_context) {
            this._nativeObj.execute();
        }
    }
    class LayaXSetRenderTargetCMD extends Laya.SetRenderTargetCMD {
        constructor() {
            super();
            this.type = Laya.RenderCMDType.ChangeRenderTarget;
            this._clearColorRGBA = [];
            this._clearColorEnabled = [];
            this._nativeObj = new window.conchLayaXSetRenderTargetCMD();
        }
        get rt() {
            return this._rt;
        }
        set rt(value) {
            this._rt = value;
            this._nativeObj.setRT(value ? value._nativeObj : null);
        }
        get clearFlag() {
            return this._clearFlag;
        }
        set clearFlag(value) {
            this._clearFlag = value;
            this._nativeObj.setClearFlag(value);
        }
        get clearColorValue() {
            return this._clearColorValue;
        }
        set clearColorValue(value) {
            this._clearColorValue = value === null || value === void 0 ? void 0 : value.clone();
            this._clearColorValues = null;
            if (value) {
                this._nativeObj.clearColorValue(value.r, value.g, value.b, value.a);
            }
        }
        get clearColorValues() { return this._clearColorValues; }
        set clearColorValues(value) {
            var _a, _b, _c, _d, _e, _f;
            super.clearColorValues = value;
            const rgba = this._clearColorRGBA;
            const enabled = this._clearColorEnabled;
            const count = (_b = (_a = this._clearColorValues) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
            rgba.length = count * 4;
            enabled.length = count;
            for (let i = 0; i < count; i++) {
                const color = this._clearColorValues[i];
                enabled[i] = color ? 1 : 0;
                rgba[i * 4] = (_c = color === null || color === void 0 ? void 0 : color.r) !== null && _c !== void 0 ? _c : 0;
                rgba[i * 4 + 1] = (_d = color === null || color === void 0 ? void 0 : color.g) !== null && _d !== void 0 ? _d : 0;
                rgba[i * 4 + 2] = (_e = color === null || color === void 0 ? void 0 : color.b) !== null && _e !== void 0 ? _e : 0;
                rgba[i * 4 + 3] = (_f = color === null || color === void 0 ? void 0 : color.a) !== null && _f !== void 0 ? _f : 0;
            }
            this._nativeObj.setClearColorValues(rgba, enabled);
        }
        get clearDepthValue() {
            return this._clearDepthValue;
        }
        set clearDepthValue(value) {
            this._clearDepthValue = value;
            this._nativeObj.clearDepthValue(value);
        }
        get clearStencilValue() {
            return this._clearStencilValue;
        }
        set clearStencilValue(value) {
            this._clearStencilValue = value;
            this._nativeObj.clearStencilValue(value);
        }
        apply(_context) {
            this._nativeObj.execute();
        }
    }
    class LayaX3DRenderPassFactory {
        createRender3DProcess() {
            return new LayaXRender3DProcess();
        }
        createRenderContext3D() {
            return new LayaXRenderContext3D();
        }
        createSetRenderDataCMD() {
            return new Laya.LayaXSetRenderData();
        }
        createSetShaderDefineCMD() {
            return new Laya.LayaXSetShaderDefine();
        }
        createDrawNodeCMDData() {
            return new LayaXDrawNodeCMDData();
        }
        createBlitQuadCMDData() {
            return new LayaXBlitQuadCMDData();
        }
        createDrawElementCMDData() {
            return new LayaXDrawElementCMDData();
        }
        createSetViewportCMD() {
            return new LayaXSetViewportCMD();
        }
        createSetRenderTargetCMD() {
            return new LayaXSetRenderTargetCMD();
        }
        createSceneRenderManager() {
            return new RTScene3DRenderManager();
        }
        createSkinRenderElement() {
            return new LayaXSkinRenderElement3D();
        }
        createRenderElement3D() {
            return new LayaXRenderElement3D();
        }
    }
    Laya.Laya.addBeforeInitCallback(() => {
        if (Laya.LayaEnv.isModernAPIs && !Laya.Laya3DRender.Render3DPassFactory)
            Laya.Laya3DRender.Render3DPassFactory = new LayaX3DRenderPassFactory();
    });

    class LayaXBounds {
        static setMinMaxBatch(targets, values, count) {
            var _a;
            if (this._batchBusy || count === 0)
                return false;
            const first = targets[0]._imp;
            if (!(first instanceof LayaXBounds) || typeof ((_a = first._nativeObj) === null || _a === void 0 ? void 0 : _a.setMinMaxBatch) !== "function")
                return false;
            this._batchBusy = true;
            try {
                for (let i = 0; i < count; i++) {
                    const target = targets[i];
                    if (!(target._imp instanceof LayaXBounds)
                        || target.setMin !== Laya.Bounds.prototype.setMin || target.setMax !== Laya.Bounds.prototype.setMax)
                        return false;
                    this._batchTargets.push(target._imp._nativeObj);
                }
                if (!first._nativeObj.setMinMaxBatch(this._batchTargets, values.buffer, values.byteOffset, count))
                    throw new Error("LayaX Bounds batch rejected");
                for (let i = 0; i < count; i++) {
                    const target = targets[i]._imp, offset = i * 6;
                    target._boundBox.min.setValue(values[offset], values[offset + 1], values[offset + 2]);
                    target._boundBox.max.setValue(values[offset + 3], values[offset + 4], values[offset + 5]);
                }
                return true;
            }
            finally {
                this._batchTargets.length = 0;
                this._batchBusy = false;
            }
        }
        get min() {
            return this.getMin();
        }
        set min(value) {
            this.setMin(value);
        }
        get max() {
            return this.getMax();
        }
        set max(value) {
            this.setMax(value);
        }
        setMin(value) {
            this._nativeObj.setMin(value.x, value.y, value.z);
            this._boundBox.min.setValue(value.x, value.y, value.z);
        }
        getMin() {
            if (!this._readback)
                this._nativeObj.getMin();
            this._syncBoundBoxFromNative();
            return this._boundBox.min;
        }
        setMax(value) {
            this._nativeObj.setMax(value.x, value.y, value.z);
            this._boundBox.max.setValue(value.x, value.y, value.z);
        }
        getMax() {
            if (!this._readback)
                this._nativeObj.getMax();
            this._syncBoundBoxFromNative();
            return this._boundBox.max;
        }
        setCenter(value) {
            this._nativeObj.setCenter(value.x, value.y, value.z);
        }
        getCenter() {
            if (!this._readback)
                this._nativeObj.getCenter();
            this._syncBoundBoxFromNative();
            const min = this._boundBox.min;
            const max = this._boundBox.max;
            this._center.setValue((min.x + max.x) * 0.5, (min.y + max.y) * 0.5, (min.z + max.z) * 0.5);
            return this._center;
        }
        setExtent(value) {
            this._nativeObj.setExtent(value.x, value.y, value.z);
        }
        getExtent() {
            if (!this._readback)
                this._nativeObj.getExtent();
            this._syncBoundBoxFromNative();
            const min = this._boundBox.min;
            const max = this._boundBox.max;
            this._extent.setValue((max.x - min.x) * 0.5, (max.y - min.y) * 0.5, (max.z - min.z) * 0.5);
            return this._extent;
        }
        constructor(min, max) {
            this._readback = null;
            this._center = new Laya.Vector3();
            this._extent = new Laya.Vector3();
            this._boundBox = new Laya.BoundBox(new Laya.Vector3(), new Laya.Vector3());
            this._nativeObj = new window.conchLayaXBounds();
            if (this._nativeObj.bindReadbackBuffer) {
                const values = new Float32Array(6);
                if (this._nativeObj.bindReadbackBuffer(values.buffer))
                    this._readback = values;
            }
            min && this.setMin(min);
            max && this.setMax(max);
        }
        _tranform(matrix, out) {
            this._nativeObj._tranform(matrix.elements, out._nativeObj);
        }
        _getBoundBox() {
            if (!this._readback)
                this._nativeObj._getBoundBox();
            this._syncBoundBoxFromNative();
            return this._boundBox;
        }
        _syncBoundBoxFromNative() {
            const min = this._boundBox.min;
            const max = this._boundBox.max;
            if (this._readback) {
                min.setValue(this._readback[0], this._readback[1], this._readback[2]);
                max.setValue(this._readback[3], this._readback[4], this._readback[5]);
                return;
            }
            min.setValue(this._nativeObj._minX, this._nativeObj._minY, this._nativeObj._minZ);
            max.setValue(this._nativeObj._maxX, this._nativeObj._maxY, this._nativeObj._maxZ);
        }
        calculateBoundsintersection(bounds) {
            let ownMax = this.getMax();
            let ownMin = this.getMin();
            let calMax = bounds.getMax();
            let calMin = bounds.getMin();
            let thisExtends = this.getExtent();
            let boundExtends = bounds.getExtent();
            let tempV0 = TEMP_VECTOR3_MAX0$1;
            let tempV1 = TEMP_VECTOR3_MAX1$1;
            tempV0.setValue(Math.max(ownMax.x, calMax.x) - Math.min(ownMin.x, calMin.x), Math.max(ownMax.y, calMax.y) - Math.min(ownMin.y, calMin.y), Math.max(ownMax.z, calMax.z) - Math.min(ownMin.z, calMin.z));
            tempV1.setValue((thisExtends.x + boundExtends.x) * 2.0, (thisExtends.y + boundExtends.y) * 2.0, (thisExtends.z + boundExtends.z) * 2.0);
            if (tempV0.x > tempV1.x)
                return -1;
            if (tempV0.y > tempV1.y)
                return -1;
            if (tempV0.z > tempV1.z)
                return -1;
            return (tempV1.x - tempV0.x) * (tempV1.y - tempV0.y) * (tempV1.z - tempV0.z);
        }
        cloneTo(destObject) {
            this._nativeObj.cloneTo(destObject._nativeObj);
        }
        clone() {
            let dest = new LayaXBounds(new Laya.Vector3(), new Laya.Vector3());
            this.cloneTo(dest);
            return dest;
        }
    }
    LayaXBounds._batchTargets = [];
    LayaXBounds._batchBusy = false;
    const TEMP_VECTOR3_MAX0$1 = new Laya.Vector3();
    const TEMP_VECTOR3_MAX1$1 = new Laya.Vector3();

    class LayaXChunkPages {
        static ensure(nativeObj, minFree = LayaXChunkPages.WATERMARK) {
            if (LayaXChunkPages._dead)
                return false;
            let freeCount = nativeObj.chunkPagesFreeCount();
            let registeredThisCall = 0;
            while (freeCount < minFree) {
                if (registeredThisCall >= LayaXChunkPages.MAX_REGISTER_PER_ENSURE) {
                    LayaXChunkPages._dead = true;
                    console.warn("[LayaXChunkPages] reserve limit reached, falling back to native pages");
                    return false;
                }
                const buf = new ArrayBuffer(LayaXChunkPages.PAGE_BYTES);
                const id = nativeObj.chunkPagesRegister(buf);
                if (id === 0xFFFFFFFF) {
                    LayaXChunkPages._dead = true;
                    console.warn("[LayaXChunkPages] register failed, falling back to native pages");
                    return false;
                }
                LayaXChunkPages._pages.push(buf);
                registeredThisCall++;
                freeCount = nativeObj.chunkPagesFreeCount();
            }
            return true;
        }
        static ensureForEntityCreate(nativeObj) {
            return LayaXChunkPages.ensure(nativeObj, LayaXChunkPages.ENTITY_CREATE_RESERVE);
        }
        static page(pageId) {
            return LayaXChunkPages._pages[pageId];
        }
    }
    LayaXChunkPages.PAGE_BYTES = 1 << 20;
    LayaXChunkPages.WATERMARK = 8;
    LayaXChunkPages.ENTITY_CREATE_RESERVE = 16;
    LayaXChunkPages.MAX_REGISTER_PER_ENSURE = 128;
    LayaXChunkPages._pages = [];
    LayaXChunkPages._dead = false;

    const ALL_WORLD_FLAGS = Laya.Transform3D.TRANSFORM_WORLDMATRIX | Laya.Transform3D.TRANSFORM_WORLDPOSITION |
        Laya.Transform3D.TRANSFORM_WORLDQUATERNION | Laya.Transform3D.TRANSFORM_WORLDEULER |
        Laya.Transform3D.TRANSFORM_WORLDSCALE;
    class LayaXTransform3D extends Laya.Transform3D {
        constructor(owner) {
            super(owner);
            this._viewsBound = false;
            this._boundEpoch = -1;
            this._posView = null;
            this._rotView = null;
            this._scaleView = null;
            this._worldView = null;
            this._dirtyWordView = null;
            this._dirtyMask = 0;
            this._checkGen = 0;
            this._checkFrame = -1;
            this._syncGateFrame = -1;
            this._syncGateEpoch = -1;
            this._syncGateStruct = -1;
            this._writeGen = 1;
            this._worldGenSum = -1;
            this._worldGenStruct = -1;
            this._worldGateFrame = -1;
            this._worldGateWrite = -1;
            this._worldGateNative = -1;
            this._worldGateStruct = -1;
            this._subtreeListenerTotal = 0;
            this._worldPosView = null;
        }
        _initProperty() {
            let mem = LayaXTransform3D._sharedNativeMemory;
            if (!mem)
                mem = LayaXTransform3D._sharedNativeMemory =
                    new Laya.NativeMemory(LayaXTransform3D.TRANSFORM_SHARE_MEMORY_SIZE * 4, false);
            this._nativeFloat32Buffer = mem.float32Array;
            this._nativeObj = new window.conchLayaXTransform(mem._buffer);
            this._flagMemory = new Laya.NativeMemory(LayaXTransform3D.FLAG_MEMORY_SIZE * 4, false);
            this._flagU32 = this._flagMemory.Uint32Array;
            if (this._nativeObj.bindChangeFlagBuffer)
                this._nativeObj.bindChangeFlagBuffer(this._flagMemory._buffer);
            this._setTransformFlag(Laya.Transform3D.TRANSFORM_LOCALQUATERNION | Laya.Transform3D.TRANSFORM_LOCALEULER | Laya.Transform3D.TRANSFORM_LOCALMATRIX, false);
            this._setTransformFlag(Laya.Transform3D.TRANSFORM_WORLDPOSITION | Laya.Transform3D.TRANSFORM_WORLDQUATERNION |
                Laya.Transform3D.TRANSFORM_WORLDEULER | Laya.Transform3D.TRANSFORM_WORLDSCALE | Laya.Transform3D.TRANSFORM_WORLDMATRIX, true);
            this.localPosition = this._localPosition;
            this.localRotation = this._localRotation;
            this.localScale = this._localScale;
        }
        onStartListeningToType(type) {
            super.onStartListeningToType(type);
            if (type === Laya.Event.TRANSFORM_CHANGED) {
                this._hasTransformChangedListener = true;
                let p = this._parent;
                while (p) {
                    if (p._subtreeListenerTotal !== undefined)
                        p._subtreeListenerTotal++;
                    p = p._parent;
                }
            }
        }
        createEntity() {
            LayaXChunkPages.ensureForEntityCreate(this._nativeObj);
            this._nativeObj.createEntity();
            this._bindViews();
            this._flagU32[LayaXTransform3D.FLAG_SYNC_IDX] = 0;
            this._pushLocalPos();
            this._pushLocalRot();
            this._pushLocalScale();
            LayaXTransform3D._structGen++;
        }
        destroyEntity() {
            this._nativeObj.destroyEntity();
            this._dropViews();
            this._worldMatrix.elements = new Float32Array(16);
            this._setTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX, true);
            this._writeGen++;
            LayaXTransform3D._worldWriteEpoch++;
            LayaXTransform3D._structGen++;
        }
        _dropViews() {
            this._viewsBound = false;
            this._posView = this._rotView = this._scaleView = this._worldView = null;
            this._dirtyWordView = null;
        }
        _bindViews() {
            const idx = this._nativeObj.getSlotIndex();
            if (idx === 0xFFFFFFFF)
                return;
            if (this._bindPageViews(idx))
                return;
            this._bindExternalViews(idx);
        }
        _bindPageViews(idx) {
            const tLoc = this._nativeObj.getChunkViewLoc(0);
            const wLoc = this._nativeObj.getChunkViewLoc(2);
            if (tLoc < 0 || wLoc < 0)
                return false;
            const tPid = Math.floor(tLoc / 0x100000000), tOff = tLoc - tPid * 0x100000000;
            const wPid = Math.floor(wLoc / 0x100000000), wOff = wLoc - wPid * 0x100000000;
            const tBuf = LayaXChunkPages.page(tPid);
            const wBuf = LayaXChunkPages.page(wPid);
            if (!tBuf || !wBuf)
                return false;
            this._posView = new Float32Array(tBuf, tOff, 3);
            this._rotView = new Float32Array(tBuf, tOff + 12, 4);
            this._scaleView = new Float32Array(tBuf, tOff + 28, 3);
            this._dirtyWordView = new Uint32Array(wBuf, wOff, 1);
            const mLoc = this._nativeObj.getChunkViewLoc(1);
            if (mLoc >= 0) {
                const mPid = Math.floor(mLoc / 0x100000000), mOff = mLoc - mPid * 0x100000000;
                const mBuf = LayaXChunkPages.page(mPid);
                if (mBuf)
                    this._worldView = new Float32Array(mBuf, mOff, 16);
            }
            this._dirtyMask = (1 << (idx & 31)) >>> 0;
            this._viewsBound = true;
            this._bindEpoch();
            return true;
        }
        _bindExternalViews(idx) {
            if (!LayaXTransform3D._zeroCopyProbed) {
                const probe = this._nativeObj.getOwnLocalPos();
                LayaXTransform3D._hasZeroCopy = !!probe && probe.byteLength > 0;
                LayaXTransform3D._zeroCopyProbed = true;
            }
            if (!LayaXTransform3D._hasZeroCopy)
                return;
            this._posView = new Float32Array(this._nativeObj.getOwnLocalPos());
            this._rotView = new Float32Array(this._nativeObj.getOwnLocalRot());
            this._scaleView = new Float32Array(this._nativeObj.getOwnLocalScale());
            this._dirtyWordView = new Uint32Array(this._nativeObj.getOwnDirtyWord());
            this._dirtyMask = (1 << (idx & 31)) >>> 0;
            this._viewsBound = true;
            this._bindEpoch();
            const wbuf = this._nativeObj.getOwnWorldMat();
            if (wbuf && wbuf.byteLength > 0) {
                this._worldView = new Float32Array(wbuf);
            }
        }
        _bindEpoch() {
            if (!LayaXTransform3D._epochView) {
                const eb = this._nativeObj.getEpochView();
                if (eb && eb.byteLength >= 4)
                    LayaXTransform3D._epochView = new Uint32Array(eb);
            }
            if (!LayaXTransform3D._syncEpochProbed) {
                LayaXTransform3D._syncEpochProbed = true;
                if (this._nativeObj.getSyncEpochView) {
                    const sb = this._nativeObj.getSyncEpochView();
                    if (sb && sb.byteLength >= 4)
                        LayaXTransform3D._syncEpochView = new Uint32Array(sb);
                }
            }
            this._boundEpoch = LayaXTransform3D._epochView ? LayaXTransform3D._epochView[0] : -1;
        }
        activeInScene() {
            this.createEntity();
        }
        inActiveInScene() {
            this.destroyEntity();
        }
        get isEntityValid() {
            return this._nativeObj.isEntityValid();
        }
        _pullPos() {
            if (this._viewsBound) {
                this._localPosition.setValue(this._posView[0], this._posView[1], this._posView[2]);
            }
            else {
                this._nativeObj.getLocalPosition();
                let i = LayaXTransform3D.TRANSFORM_LOCALPOS_DATAOFFSET;
                this._localPosition.setValue(this._nativeFloat32Buffer[i], this._nativeFloat32Buffer[i + 1], this._nativeFloat32Buffer[i + 2]);
            }
        }
        _pullRot() {
            if (this._viewsBound) {
                this._localRotation.setValue(this._rotView[0], this._rotView[1], this._rotView[2], this._rotView[3]);
            }
            else {
                this._nativeObj.getLocalRotation();
                let i = LayaXTransform3D.TRANSFORM_LOCALQUATERNION_DATAOFFSET;
                this._localRotation.setValue(this._nativeFloat32Buffer[i], this._nativeFloat32Buffer[i + 1], this._nativeFloat32Buffer[i + 2], this._nativeFloat32Buffer[i + 3]);
            }
            this._setTransformFlag(Laya.Transform3D.TRANSFORM_LOCALEULER, true);
            this._setTransformFlag(Laya.Transform3D.TRANSFORM_LOCALQUATERNION, false);
        }
        _pullScale() {
            if (this._viewsBound) {
                this._localScale.setValue(this._scaleView[0], this._scaleView[1], this._scaleView[2]);
            }
            else {
                this._nativeObj.getLocalScale();
                let i = LayaXTransform3D.TRANSFORM_LOCALSCALE_DATAOFFSET;
                this._localScale.setValue(this._nativeFloat32Buffer[i], this._nativeFloat32Buffer[i + 1], this._nativeFloat32Buffer[i + 2]);
            }
        }
        _checkViewStale() {
            if (this._checkGen === LayaXTransform3D._structGen && this._checkFrame === Laya.Stat.loopCount)
                return;
            this._checkGen = LayaXTransform3D._structGen;
            this._checkFrame = Laya.Stat.loopCount;
            const ev = LayaXTransform3D._epochView;
            const staleBit = this._flagU32[LayaXTransform3D.FLAG_SYNC_IDX] & LayaXTransform3D.VIEW_STALE;
            const epochChanged = !!ev && ev[0] !== (this._boundEpoch >>> 0);
            if (staleBit === 0) {
                if (epochChanged)
                    this._boundEpoch = ev[0];
                return;
            }
            this._flagU32[LayaXTransform3D.FLAG_SYNC_IDX] &= ~LayaXTransform3D.VIEW_STALE;
            this._dropViews();
            this._bindViews();
        }
        _ancestorChainDirty() {
            let p = this._parent;
            while (p) {
                if (p._checkViewStale)
                    p._checkViewStale();
                const dw = p._dirtyWordView;
                if (dw && (dw[0] & p._dirtyMask) !== 0)
                    return true;
                p = p._parent;
            }
            return false;
        }
        static _isTrivialRoot(par) {
            const lp = par._localPosition, lr = par._localRotation, ls = par._localScale;
            return lp.x === 0 && lp.y === 0 && lp.z === 0
                && !par._getTransformFlag(Laya.Transform3D.TRANSFORM_LOCALQUATERNION)
                && lr.x === 0 && lr.y === 0 && lr.z === 0 && lr.w === 1
                && ls.x === 1 && ls.y === 1 && ls.z === 1;
        }
        get worldPositionView() {
            const w = this._worldView;
            if (!w)
                return null;
            let v = this._worldPosView;
            if (!v || v.buffer !== w.buffer || v.byteOffset !== w.byteOffset + 48)
                v = this._worldPosView = new Float32Array(w.buffer, w.byteOffset + 48, 3);
            return v;
        }
        _selfSlotDirty() {
            return this._viewsBound && this._dirtyWordView != null
                && (this._dirtyWordView[0] & this._dirtyMask) !== 0;
        }
        _chainGenSum() {
            this._syncLocal(LayaXTransform3D.SYNC_ALL);
            let sum = this._writeGen;
            let p = this._parent;
            while (p) {
                if (p._syncLocal)
                    p._syncLocal(LayaXTransform3D.SYNC_ALL);
                sum += (p._writeGen | 0);
                p = p._parent;
            }
            return sum;
        }
        _worldNeedRefresh() {
            const sharedEpoch = LayaXTransform3D._syncEpochView;
            const nativeEpoch = sharedEpoch !== null ? sharedEpoch[0] : -1;
            const writeEpoch = LayaXTransform3D._worldWriteEpoch;
            const structure = LayaXTransform3D._structGen, frame = Laya.Stat.loopCount;
            if (sharedEpoch !== null && this._worldGateFrame === frame
                && this._worldGateWrite === writeEpoch && this._worldGateNative === nativeEpoch
                && this._worldGateStruct === structure)
                return false;
            const sum = this._chainGenSum();
            if (sharedEpoch !== null) {
                this._worldGateFrame = frame;
                this._worldGateWrite = writeEpoch;
                this._worldGateNative = nativeEpoch;
                this._worldGateStruct = structure;
            }
            if (sum === this._worldGenSum && this._worldGenStruct === LayaXTransform3D._structGen)
                return false;
            this._worldGenSum = sum;
            this._worldGenStruct = LayaXTransform3D._structGen;
            this._markChainDirtyAll();
            return true;
        }
        _markChainDirtyAll() {
            if ((this._getTransformChangeFlag() & ALL_WORLD_FLAGS) !== ALL_WORLD_FLAGS) {
                this._setTransformFlag(ALL_WORLD_FLAGS, true);
                this._notifyTransformChanged();
            }
        }
        get worldMatrix() {
            const changed = this._worldNeedRefresh();
            if (!changed && !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX))
                return super.worldMatrix;
            if (this._worldView && this._dirtyWordView
                && !this._selfSlotDirty() && !this._ancestorChainDirty()) {
                this._worldMatrix.elements.set(this._worldView);
                this._setTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX, false);
                return this._worldMatrix;
            }
            return super.worldMatrix;
        }
        set worldMatrix(value) {
            super.worldMatrix = value;
        }
        _syncLocal(need) {
            const sev = LayaXTransform3D._syncEpochView;
            if (sev !== null
                && this._syncGateFrame === Laya.Stat.loopCount
                && this._syncGateEpoch === sev[0]
                && this._syncGateStruct === LayaXTransform3D._structGen)
                return;
            this._checkViewStale();
            const pending = this._flagU32[LayaXTransform3D.FLAG_SYNC_IDX] & need;
            if (pending === 0) {
                if (sev !== null && (this._flagU32[LayaXTransform3D.FLAG_SYNC_IDX] & LayaXTransform3D.SYNC_ALL) === 0) {
                    this._syncGateFrame = Laya.Stat.loopCount;
                    this._syncGateEpoch = sev[0];
                    this._syncGateStruct = LayaXTransform3D._structGen;
                }
                return;
            }
            if (pending & LayaXTransform3D.SYNC_POS)
                this._pullPos();
            if (pending & LayaXTransform3D.SYNC_ROT)
                this._pullRot();
            if (pending & LayaXTransform3D.SYNC_SCALE)
                this._pullScale();
            this._flagU32[LayaXTransform3D.FLAG_SYNC_IDX] &= ~pending;
            this._writeGen++;
            LayaXTransform3D._worldWriteEpoch++;
            this._setTransformFlag(Laya.Transform3D.TRANSFORM_LOCALMATRIX, true);
            if (pending & LayaXTransform3D.SYNC_POS)
                this._onWorldPositionTransform();
            if (pending & LayaXTransform3D.SYNC_ROT)
                this._onWorldRotationTransform();
            if (pending & LayaXTransform3D.SYNC_SCALE)
                this._onWorldScaleTransform();
            if (sev !== null && (this._flagU32[LayaXTransform3D.FLAG_SYNC_IDX] & LayaXTransform3D.SYNC_ALL) === 0) {
                this._syncGateFrame = Laya.Stat.loopCount;
                this._syncGateEpoch = sev[0];
                this._syncGateStruct = LayaXTransform3D._structGen;
            }
        }
        set localPosition(value) {
            super.localPosition = value;
            this._pushLocalPos();
        }
        get localPosition() {
            this._syncLocal(LayaXTransform3D.SYNC_POS);
            return super.localPosition;
        }
        set localRotation(value) {
            super.localRotation = value;
            this._pushLocalRot();
        }
        get localRotation() {
            this._syncLocal(LayaXTransform3D.SYNC_ROT);
            return super.localRotation;
        }
        set localScale(value) {
            super.localScale = value;
            this._pushLocalScale();
        }
        get localScale() {
            this._syncLocal(LayaXTransform3D.SYNC_SCALE);
            return super.localScale;
        }
        set localRotationEuler(value) {
            super.localRotationEuler = value;
            this._pushLocalRot();
        }
        get localRotationEuler() {
            this._syncLocal(LayaXTransform3D.SYNC_ROT);
            return super.localRotationEuler;
        }
        set localMatrix(value) {
            super.localMatrix = value;
            this._pushLocalPos();
            this._pushLocalRot();
            this._pushLocalScale();
        }
        get localMatrix() {
            this._syncLocal(LayaXTransform3D.SYNC_ALL);
            return super.localMatrix;
        }
        get localPositionX() {
            this._syncLocal(LayaXTransform3D.SYNC_POS);
            return super.localPositionX;
        }
        set localPositionX(x) { this._syncLocal(LayaXTransform3D.SYNC_POS); super.localPositionX = x; }
        get localPositionY() {
            this._syncLocal(LayaXTransform3D.SYNC_POS);
            return super.localPositionY;
        }
        set localPositionY(y) { this._syncLocal(LayaXTransform3D.SYNC_POS); super.localPositionY = y; }
        get localPositionZ() {
            this._syncLocal(LayaXTransform3D.SYNC_POS);
            return super.localPositionZ;
        }
        set localPositionZ(z) { this._syncLocal(LayaXTransform3D.SYNC_POS); super.localPositionZ = z; }
        get localScaleX() {
            this._syncLocal(LayaXTransform3D.SYNC_SCALE);
            return super.localScaleX;
        }
        set localScaleX(value) { this._syncLocal(LayaXTransform3D.SYNC_SCALE); super.localScaleX = value; }
        get localScaleY() {
            this._syncLocal(LayaXTransform3D.SYNC_SCALE);
            return super.localScaleY;
        }
        set localScaleY(value) { this._syncLocal(LayaXTransform3D.SYNC_SCALE); super.localScaleY = value; }
        get localScaleZ() {
            this._syncLocal(LayaXTransform3D.SYNC_SCALE);
            return super.localScaleZ;
        }
        set localScaleZ(value) { this._syncLocal(LayaXTransform3D.SYNC_SCALE); super.localScaleZ = value; }
        get position() {
            const sev = LayaXTransform3D._syncEpochView;
            if (sev !== null) {
                const frame = Laya.Stat.loopCount, sg = LayaXTransform3D._structGen, se = sev[0];
                let sum = 0;
                let n = this;
                do {
                    if (n._syncGateFrame !== frame || n._syncGateEpoch !== se || n._syncGateStruct !== sg) {
                        sum = -1;
                        break;
                    }
                    sum += n._writeGen;
                    n = n._parent;
                } while (n !== null);
                if (sum >= 0 && sum === this._worldGenSum && this._worldGenStruct === sg
                    && (this._transformFlag & Laya.Transform3D.TRANSFORM_WORLDPOSITION) === 0)
                    return this._position;
            }
            const changed = this._worldNeedRefresh();
            if (!changed && !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDPOSITION))
                return super.position;
            if (this._parent !== null && this._worldView && this._dirtyWordView
                && !this._selfSlotDirty() && !this._ancestorChainDirty()) {
                const w = this._worldView;
                this._position.setValue(w[12], w[13], w[14]);
                this._setTransformFlag(Laya.Transform3D.TRANSFORM_WORLDPOSITION, false);
                return this._position;
            }
            return super.position;
        }
        set position(value) {
            const par = this._parent;
            if (par !== null && par._parent === null && LayaXTransform3D._isTrivialRoot(par)) {
                value.cloneTo(this._localPosition);
                this.localPosition = this._localPosition;
                if (this._position !== value)
                    value.cloneTo(this._position);
                this._setTransformFlag(Laya.Transform3D.TRANSFORM_WORLDPOSITION, false);
                return;
            }
            super.position = value;
        }
        get rotation() {
            this._worldNeedRefresh();
            return super.rotation;
        }
        set rotation(value) { super.rotation = value; }
        get rotationEuler() {
            this._worldNeedRefresh();
            return super.rotationEuler;
        }
        set rotationEuler(value) {
            const par = this._parent;
            if (par !== null && par._parent === null && LayaXTransform3D._isTrivialRoot(par)) {
                this.localRotationEuler = value;
                if (this._rotationEuler !== value)
                    value.cloneTo(this._rotationEuler);
                this._setTransformFlag(Laya.Transform3D.TRANSFORM_WORLDEULER, false);
                return;
            }
            super.rotationEuler = value;
        }
        getWorldLossyScale() {
            this._worldNeedRefresh();
            return super.getWorldLossyScale();
        }
        _onWorldPositionTransform() {
            if (!this._viewsBound) {
                super._onWorldPositionTransform();
                return;
            }
            if (!this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDPOSITION)) {
                this._setTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX | Laya.Transform3D.TRANSFORM_WORLDPOSITION, true);
                this._notifyTransformChanged();
            }
            this._notifySubscribedChildren(0);
        }
        _onWorldRotationTransform() {
            if (!this._viewsBound) {
                super._onWorldRotationTransform();
                return;
            }
            if (!this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDQUATERNION) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDEULER)) {
                this._setTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX | Laya.Transform3D.TRANSFORM_WORLDQUATERNION | Laya.Transform3D.TRANSFORM_WORLDEULER, true);
                this._notifyTransformChanged();
            }
            this._notifySubscribedChildren(1);
        }
        _onWorldScaleTransform() {
            if (!this._viewsBound) {
                super._onWorldScaleTransform();
                return;
            }
            if (!this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDSCALE)) {
                this._setTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX | Laya.Transform3D.TRANSFORM_WORLDSCALE, true);
                this._notifyTransformChanged();
            }
            this._notifySubscribedChildren(2);
        }
        _onWorldPositionRotationTransform() {
            if (!this._viewsBound) {
                super._onWorldPositionRotationTransform();
                return;
            }
            if (!this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDPOSITION) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDQUATERNION) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDEULER)) {
                this._setTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX | Laya.Transform3D.TRANSFORM_WORLDPOSITION | Laya.Transform3D.TRANSFORM_WORLDQUATERNION | Laya.Transform3D.TRANSFORM_WORLDEULER, true);
                this._notifyTransformChanged();
            }
            this._notifySubscribedChildren(1);
        }
        _onWorldPositionScaleTransform() {
            if (!this._viewsBound) {
                super._onWorldPositionScaleTransform();
                return;
            }
            if (!this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDPOSITION) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDSCALE)) {
                this._setTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX | Laya.Transform3D.TRANSFORM_WORLDPOSITION | Laya.Transform3D.TRANSFORM_WORLDSCALE, true);
                this._notifyTransformChanged();
            }
            this._notifySubscribedChildren(2);
        }
        _onWorldTransform() {
            if (!this._viewsBound) {
                super._onWorldTransform();
                return;
            }
            if (!this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDPOSITION) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDQUATERNION) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDEULER) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDSCALE)) {
                this._setTransformFlag(ALL_WORLD_FLAGS, true);
                this._notifyTransformChanged();
            }
            this._notifySubscribedChildren(3);
        }
        _notifySubscribedChildren(mode) {
            if (this._subtreeListenerTotal <= 0)
                return;
            const cs = this._children;
            for (let i = 0, n = cs.length; i < n; i++) {
                const c = cs[i];
                if (!(c instanceof LayaXTransform3D) || !c._viewsBound
                    || c._hasTransformChangedListener || c._subtreeListenerTotal > 0) {
                    switch (mode) {
                        case 0:
                            c._onWorldPositionTransform();
                            break;
                        case 1:
                            c._onWorldPositionRotationTransform();
                            break;
                        case 2:
                            c._onWorldPositionScaleTransform();
                            break;
                        default:
                            c._onWorldTransform();
                            break;
                    }
                }
            }
        }
        _pushLocalPos() {
            this._writeGen++;
            LayaXTransform3D._worldWriteEpoch++;
            this._checkViewStale();
            const lp = this._localPosition;
            if (this._viewsBound) {
                const p = this._posView;
                p[0] = lp.x;
                p[1] = lp.y;
                p[2] = lp.z;
                this._dirtyWordView[0] |= this._dirtyMask;
            }
            else {
                const i = LayaXTransform3D.TRANSFORM_LOCALPOS_DATAOFFSET, f = this._nativeFloat32Buffer;
                f[i] = lp.x;
                f[i + 1] = lp.y;
                f[i + 2] = lp.z;
                this._nativeObj.setLocalPosition();
            }
        }
        _pushLocalRot() {
            this._writeGen++;
            LayaXTransform3D._worldWriteEpoch++;
            this._checkViewStale();
            const lr = this.localRotation;
            if (this._viewsBound) {
                const p = this._rotView;
                p[0] = lr.x;
                p[1] = lr.y;
                p[2] = lr.z;
                p[3] = lr.w;
                this._dirtyWordView[0] |= this._dirtyMask;
            }
            else {
                const i = LayaXTransform3D.TRANSFORM_LOCALQUATERNION_DATAOFFSET, f = this._nativeFloat32Buffer;
                f[i] = lr.x;
                f[i + 1] = lr.y;
                f[i + 2] = lr.z;
                f[i + 3] = lr.w;
                this._nativeObj.setLocalRotation();
            }
        }
        _pushLocalScale() {
            this._writeGen++;
            LayaXTransform3D._worldWriteEpoch++;
            this._checkViewStale();
            const ls = this._localScale;
            if (this._viewsBound) {
                const p = this._scaleView;
                p[0] = ls.x;
                p[1] = ls.y;
                p[2] = ls.z;
                this._dirtyWordView[0] |= this._dirtyMask;
            }
            else {
                const i = LayaXTransform3D.TRANSFORM_LOCALSCALE_DATAOFFSET, f = this._nativeFloat32Buffer;
                f[i] = ls.x;
                f[i + 1] = ls.y;
                f[i + 2] = ls.z;
                this._nativeObj.setLocalScale();
            }
        }
        _setParent(value) {
            const delta = this._subtreeListenerTotal + (this._hasTransformChangedListener ? 1 : 0);
            if (delta > 0 && this._parent !== value) {
                let p = this._parent;
                while (p) {
                    if (p._subtreeListenerTotal !== undefined)
                        p._subtreeListenerTotal -= delta;
                    p = p._parent;
                }
                let q = value;
                while (q) {
                    if (q._subtreeListenerTotal !== undefined)
                        q._subtreeListenerTotal += delta;
                    q = q._parent;
                }
            }
            super._setParent(value);
            this._nativeObj.setParent(value ? value._nativeObj : null);
            this._writeGen++;
            LayaXTransform3D._worldWriteEpoch++;
            LayaXTransform3D._structGen++;
        }
    }
    LayaXTransform3D.TRANSFORM_LOCALQUATERNION_DATAOFFSET = 0;
    LayaXTransform3D.TRANSFORM_LOCALEULER_DATAOFFSET = 4;
    LayaXTransform3D.TRANSFORM_LOCALPOS_DATAOFFSET = 7;
    LayaXTransform3D.TRANSFORM_LOCALSCALE_DATAOFFSET = 10;
    LayaXTransform3D.TRANSFORM_LOCALMATRIX_DATAOFFSET = 13;
    LayaXTransform3D.TRANSFORM_WORLDQUATERNION_DATAOFFSET = 29;
    LayaXTransform3D.TRANSFORM_WORLDEULER_DATAOFFSET = 33;
    LayaXTransform3D.TRANSFORM_WORLDPOS_DATAOFFSET = 36;
    LayaXTransform3D.TRANSFORM_WORLDSCALE_DATAOFFSET = 39;
    LayaXTransform3D.TRANSFORM_WORLDMATRIX_DATAOFFSET = 42;
    LayaXTransform3D.TRANSFORM_CHANGEFLAG_DATAOFFSET = 58;
    LayaXTransform3D.TRANSFORM_RT_SYNC_FLAG_DATAOFFSET = 59;
    LayaXTransform3D.TRANSFORM_SHARE_MEMORY_SIZE = 60;
    LayaXTransform3D.FLAG_CHANGE_IDX = 0;
    LayaXTransform3D.FLAG_SYNC_IDX = 1;
    LayaXTransform3D.FLAG_MEMORY_SIZE = 2;
    LayaXTransform3D.SYNC_POS = 1 << 0;
    LayaXTransform3D.SYNC_ROT = 1 << 1;
    LayaXTransform3D.SYNC_SCALE = 1 << 2;
    LayaXTransform3D.SYNC_ALL = (1 << 0) | (1 << 1) | (1 << 2);
    LayaXTransform3D.VIEW_STALE = 0x80000000;
    LayaXTransform3D._epochView = null;
    LayaXTransform3D._syncEpochView = null;
    LayaXTransform3D._syncEpochProbed = false;
    LayaXTransform3D._structGen = 1;
    LayaXTransform3D._worldWriteEpoch = 1;
    LayaXTransform3D._zeroCopyProbed = false;
    LayaXTransform3D._hasZeroCopy = false;
    LayaXTransform3D._sharedNativeMemory = null;

    class LayaXCameraNodeData {
        get transform() {
            return this._transform;
        }
        set transform(value) {
            this._transform = value;
            this._nativeObj.setTransform(value ? value._nativeObj : null);
        }
        get farplane() {
            return this._f32[18];
        }
        set farplane(value) {
            this._f32[18] = value;
        }
        get nearplane() {
            return this._f32[17];
        }
        set nearplane(value) {
            this._f32[17] = value;
        }
        get fieldOfView() {
            return this._f32[16];
        }
        set fieldOfView(value) {
            this._f32[16] = value;
        }
        get aspectRatio() {
            return this._f32[19];
        }
        set aspectRatio(value) {
            this._f32[19] = value;
        }
        get handle() {
            return this._nativeObj ? this._handleId : 0;
        }
        constructor() {
            this._handleId = 0;
            this._nativeObj = new window.conchLayaXCameraNodeData();
            this._buf = new ArrayBuffer(23 * 4);
            this._f32 = new Float32Array(this._buf);
            this._f32[16] = 60.0;
            this._f32[17] = 0.3;
            this._f32[18] = 1000.0;
            this._f32[19] = 1.0;
            this._f32[22] = -1.0;
            this._nativeObj.bindBuffer(this._buf);
            this._handleId = this._nativeObj.getHandle();
        }
        setProjectionViewMatrix(value) {
            value && this._f32.set(value.elements, 0);
        }
        setForward(x, y, z) {
            this._f32[20] = x;
            this._f32[21] = y;
            this._f32[22] = z;
        }
        syncProjection() {
            this._nativeObj.syncProjection();
        }
        destroy() {
            if (this._nativeObj) {
                this._nativeObj.destroy();
                this._nativeObj = null;
            }
        }
    }

    class LayaXSceneNodeData {
        get lightmapDirtyFlag() {
            return this._nativeObj._lightmapDirtyFlag;
        }
        set lightmapDirtyFlag(value) {
            this._nativeObj._lightmapDirtyFlag = value;
        }
        constructor() {
            this._nativeObj = new window.conchLayaXSceneNodeData();
        }
    }

    class LayaXBaseRenderNode {
        get transform() { return this._transform; }
        set transform(value) {
            this._nativeObj.setTransform(value ? value._nativeObj : null);
            this._transform = value;
        }
        get distanceForSort() { return this._nativeObj.distanceForSort; }
        set distanceForSort(value) { this._nativeObj.distanceForSort = value; }
        get renderOrder() { return this._nativeObj.renderOrder; }
        set renderOrder(value) { this._nativeObj.renderOrder = value; }
        get sortingFudge() { return this._nativeObj.sortingFudge; }
        set sortingFudge(value) { this._nativeObj.sortingFudge = value; }
        get castShadow() { return this._nativeObj.castShadow; }
        set castShadow(value) { this._nativeObj.castShadow = value; }
        get receiveShadow() { return this._nativeObj.receiveShadow; }
        set receiveShadow(value) { this._nativeObj.receiveShadow = value; }
        get enable() { return this._nativeObj.enable; }
        set enable(value) { this._nativeObj.enable = value; }
        get renderbitFlag() { return this._readbackFlags ? this._readbackFlags[0] : this._nativeObj.renderbitFlag; }
        set renderbitFlag(value) { this._nativeObj.renderbitFlag = value; }
        get visibalRangeBit() { return this._nativeObj.visibalRangeBit; }
        set visibalRangeBit(value) { this._nativeObj.visibalRangeBit = value; }
        get visibalMin() { return this._nativeObj.visibalMin; }
        set visibalMin(value) { this._nativeObj.visibalMin = value; }
        get visibalMax() { return this._nativeObj.visibalMax; }
        set visibalMax(value) { this._nativeObj.visibalMax = value; }
        get layer() { return this._nativeObj.layer; }
        set layer(value) { this._nativeObj.layer = value; }
        get renderNodeType() { return this._nativeObj.renderNodeType; }
        set renderNodeType(value) { this._nativeObj.renderNodeType = value; }
        get boundsChange() { return this._boundsChange; }
        set boundsChange(value) { this._boundsChange = value; }
        get staticMask() { return this._nativeObj.staticMask; }
        set staticMask(value) { this._nativeObj.staticMask = value; }
        get lightmapIndex() { return this._nativeObj.lightmapIndex; }
        set lightmapIndex(value) { this._nativeObj.lightmapIndex = value; }
        get reflectionMode() { return this._reflectionMode; }
        set reflectionMode(value) {
            if (this._reflectionMode === value)
                return;
            this._reflectionMode = value;
            this._nativeObj.reflectionMode = value;
        }
        get lightProbUpdateMark() { return this._nativeObj.lightProbUpdateMark; }
        set lightProbUpdateMark(value) { this._nativeObj.lightProbUpdateMark = value; }
        get perCameraUpdate() { return this._readbackFlags ? this._readbackFlags[1] !== 0 : this._nativeObj.perCameraUpdate; }
        set perCameraUpdate(value) { this._nativeObj.perCameraUpdate = value; }
        get bounds() {
            if (this.boundsChange) {
                if (this._nativeBoundsCallbackDisabled && this._caculateBoundingBoxbindFun)
                    this._caculateBoundingBoxbindFun();
                else
                    this._nativeObj._calculateBoundingBox();
                this.boundsChange = false;
            }
            return this._bounds;
        }
        set bounds(value) {
            this._bounds = value;
            this._nativeObj._bounds = value._imp._nativeObj;
        }
        get baseGeometryBounds() { return this._baseGeometryBounds; }
        set baseGeometryBounds(value) {
            this._baseGeometryBounds = value;
            value && this._nativeObj.setBaseGeometryBounds(value._imp._nativeObj);
        }
        setBoundsMode(mode) {
            this._nativeObj.setBoundsMode(mode);
        }
        setBoundsWorldPad(minX, minY, minZ, maxX, maxY, maxZ) {
            this._nativeObj.setBoundsWorldPad(minX, minY, minZ, maxX, maxY, maxZ);
        }
        setWorldBounds(minX, minY, minZ, maxX, maxY, maxZ) {
            this._nativeObj.setWorldBounds(minX, minY, minZ, maxX, maxY, maxZ);
        }
        disableNativeBoundsCallback() {
            this._nativeBoundsCallbackDisabled = true;
            this._nativeObj.disableNativeBoundsCallback();
        }
        get shaderData() { return this._shaderData; }
        set shaderData(value) {
            this._shaderData = value;
            this._nativeObj.setShaderData(value ? value._nativeObj : null);
        }
        get additionShaderData() { return this._additionShaderData; }
        set additionShaderData(value) {
            this._additionShaderData = value;
            this._nativeObj.clearAdditionalMap();
            for (let [key, sd] of this._additionShaderData) {
                this._nativeObj.addOneAddiionalData(key, sd._nativeObj);
            }
        }
        get lightmap() { return this._lightmap; }
        set lightmap(value) {
            this._lightmap = value;
            this._nativeObj.setLightmap(value ? value._nativeObj : null);
        }
        get probeReflection() { return this._probeReflection; }
        set probeReflection(value) {
            this._probeReflection = value;
            this._nativeObj.setProbeReflection(value ? value._nativeObj : null);
        }
        get volumetricGI() { return this._volumetricGI; }
        set volumetricGI(value) {
            this._volumetricGI = value;
            this._nativeObj.setVolumetricGI(value ? value._nativeObj : null);
        }
        get irradientMode() { return this._irradientMode; }
        set irradientMode(value) {
            this._irradientMode = value;
            this._nativeObj.irradianceMode = value;
        }
        get ismoved() {
            return this._ismoved;
        }
        set ismoved(value) {
            this._ismoved.setValue(value.x, value.y);
        }
        set_renderUpdatePreCall(call, fun) {
            this._renderUpdatePreOwner = call;
            this._renderUpdatePreFunction = fun;
            this._renderUpdatePrebindFun = fun.bind(call, Laya.RenderContext3D._instance._contextOBJ);
            this._nativeObj.setRenderUpdatePre(this._renderUpdatePrebindFun);
        }
        isRenderUpdatePreCall(call, fun) {
            return this._renderUpdatePreOwner === call && this._renderUpdatePreFunction === fun;
        }
        set_caculateBoundingBox(call, fun) {
            this._caculateBoundingBoxbindFun = fun.bind(call);
            this._nativeObj.setCalculateBoundingBox(this._caculateBoundingBoxbindFun);
        }
        _getNativeObj() {
            this._nativeObj = new window.conchLayaXBaseRenderNode();
        }
        constructor() {
            this._readbackFlags = null;
            this._boundsChange = false;
            this._reflectionMode = 0;
            this._nativeBoundsCallbackDisabled = false;
            this._additionShaderData = new Map();
            this.lightmapScaleOffset = new Laya.Vector4(1, 1, 0, 0);
            this.lightmapDirtyFlag = -1;
            this._ismoved = new Laya.Vector2();
            this._worldParams = new Laya.Vector4(1, 0, 0, 0);
            this._getNativeObj();
            if (this._nativeObj.bindReadbackFlags) {
                const flags = new Uint32Array(2);
                if (this._nativeObj.bindReadbackFlags(flags.buffer))
                    this._readbackFlags = flags;
            }
            this._defaultBaseGeometryBounds = new Laya.Bounds();
            this.baseGeometryBounds = this._defaultBaseGeometryBounds;
            this.renderelements = [];
            this._nativeObj.worldParams = this._worldParams;
        }
        setNodeCustomData(dataSlot, data) {
            switch (dataSlot) {
                case 0:
                    this._worldParams.y = data;
                    break;
                case 1:
                    this._worldParams.z = data;
                    break;
                case 2:
                    this._worldParams.w = data;
                    break;
            }
            this._nativeObj.worldParams = this._worldParams;
        }
        setRenderelements(value) {
            let tempArray = [];
            this.renderelements.length = 0;
            for (let i = 0; i < value.length; i++) {
                this.renderelements.push(value[i]);
                value[i].owner = this;
                value[i].sortIndex = i;
                tempArray.push(value[i]._nativeObj);
            }
            this._nativeObj.setRenderElements(tempArray);
        }
        setLightmapScaleOffset(value) {
            value && value.cloneTo(this.lightmapScaleOffset);
            this._nativeObj.setLightmapScaleOffset(value);
            if (this._shaderData) {
                this._shaderData.setVector(Laya.RenderableSprite3D.LIGHTMAPSCALEOFFSET, this.lightmapScaleOffset);
            }
        }
        _applyLightMapParams() {
            let shaderValues = this._shaderData;
            if (!shaderValues)
                return;
            if (this._lightmap && this._lightmap.lightmapColor) {
                let lightMap = this._lightmap;
                shaderValues.setVector(Laya.RenderableSprite3D.LIGHTMAPSCALEOFFSET, this.lightmapScaleOffset);
                shaderValues._setInternalTexture(Laya.RenderableSprite3D.LIGHTMAP, lightMap.lightmapColor._nativeObj);
                shaderValues.addDefine(Laya.RenderableSprite3D.SAHDERDEFINE_LIGHTMAP);
                if (lightMap.lightmapDirection) {
                    shaderValues._setInternalTexture(Laya.RenderableSprite3D.LIGHTMAP_DIRECTION, lightMap.lightmapDirection._nativeObj);
                    shaderValues.addDefine(Laya.RenderableSprite3D.SHADERDEFINE_LIGHTMAP_DIRECTIONAL);
                }
                else {
                    shaderValues.removeDefine(Laya.RenderableSprite3D.SHADERDEFINE_LIGHTMAP_DIRECTIONAL);
                }
            }
            else {
                shaderValues.removeDefine(Laya.RenderableSprite3D.SAHDERDEFINE_LIGHTMAP);
                shaderValues.removeDefine(Laya.RenderableSprite3D.SHADERDEFINE_LIGHTMAP_DIRECTIONAL);
            }
        }
        setCommonUniformMap(value) {
            this._nativeObj.setCommonUniformMap(value);
        }
        setOneMaterial(index, mat) {
            if (!this.renderelements[index])
                return;
            this.renderelements[index].materialShaderData = mat.shaderData;
            this.renderelements[index].materialRenderQueue = mat.renderQueue;
            this.renderelements[index].subShader = mat.shader.getSubShaderAt(0);
        }
        _applyLightProb() {
        }
        _applyReflection() {
        }
        destroy() {
            this._nativeObj.destroy();
            for (let i = 0, n = this.renderelements.length; i < n; i++) {
                this.renderelements[i].destroy();
            }
            this.renderelements.length = 0;
            this._baseGeometryBounds = null;
            this.transform = null;
            this._shaderData && this._shaderData.destroy();
        }
    }

    class LayaXMeshRenderNode extends LayaXBaseRenderNode {
        _getNativeObj() {
            this._nativeObj = new window.conchLayaXMeshRenderNode();
        }
    }

    class LayaXSkinRenderNode extends LayaXBaseRenderNode {
        _getNativeObj() {
            this._nativeObj = new window.conchLayaXSkinRenderNode();
        }
        constructor() {
            super();
            this.boneNums = 0;
            this._bonesRegistered = false;
        }
        computeSkinnedData() {
            if (this._bonesRegistered)
                return;
            if (this.boneNums === 0) {
                this._bonesRegistered = true;
                return;
            }
            if (this._nativeObj.tryCommitBoneEntities()) {
                this._bonesRegistered = true;
            }
        }
        setRootBoneTransfom(value) {
            this._nativeObj.setRootBoneTransfom(value.transform._nativeObj);
        }
        setOwnerTransform(value) {
            this._nativeObj.setOwnerTransform(value.transform._nativeObj);
        }
        setCacheMesh(cacheMesh) {
            this._nativeObj.resizeCacheMeshInverseBindPoes(cacheMesh._inverseBindPoses.length);
            for (let i = 0, n = cacheMesh._inverseBindPoses.length; i < n; i++) {
                this._nativeObj.setinverseBindPoseDataByIndex(i, cacheMesh._inverseBindPoses[i]);
            }
            this._nativeObj.resizeMatrixCache(cacheMesh._skinnedMatrixCaches.length);
            for (let i = 0, n = cacheMesh._skinnedMatrixCaches.length; i < n; i++) {
                let cache = cacheMesh._skinnedMatrixCaches[i];
                if (!cache)
                    continue;
                this._nativeObj.setMatrixCacheByIndex(i, cache.batchBoneIndex, cache.batchIndex, cache.subMeshIndex);
            }
            this._nativeObj.setSubMeshCount(cacheMesh.subMeshCount);
            this._nativeObj.resizeBoneIndicesList(cacheMesh.subMeshCount);
            for (let i = 0, n = cacheMesh.subMeshCount; i < n; i++) {
                this._nativeObj.setBoneIndicesList(i, cacheMesh.getSubMesh(i)._boneIndicesList);
            }
            this._nativeObj.commitCacheMeshSkinData();
        }
        setBones(value) {
            this._nativeObj.clearBoneTransform();
            this.boneNums = 0;
            for (let i = 0, n = value.length; i < n; i++) {
                if (value[i]) {
                    this._nativeObj.addBoneTransform(value[i].transform._nativeObj);
                    this.boneNums++;
                }
            }
            this._bonesRegistered = false;
        }
        setSkinnedData(value) {
            this._nativeObj.resizeSkinnedData(value.length);
            for (let i = 0, n = value.length; i < n; i++) {
                this._nativeObj.setSkinnedDataByIndex(i, value[i]);
            }
        }
    }

    class LayaXSimpleSkinRenderNode extends LayaXBaseRenderNode {
        _getNativeObj() {
            this._nativeObj = new window.conchLayaXSimpleSkinRenderNode();
            let buffer = new ArrayBuffer(4 * 4);
            this._shareBuffer = new Float32Array(buffer);
            this._nativeObj.setShareBuffer(buffer);
        }
        constructor() {
            super();
            this._simpleAnimatorParams = new Laya.Vector4();
            this.set_renderUpdatePreCall(this, this._renderUpdate);
        }
        setSimpleAnimatorParams(value) {
            value.cloneTo(this._simpleAnimatorParams);
            this.shaderData.setVector(Laya.SimpleSkinnedMeshSprite3D.SIMPLE_SIMPLEANIMATORPARAMS, this._simpleAnimatorParams);
            this._shareBuffer[0] = value.x;
            this._shareBuffer[1] = value.y;
            this._shareBuffer[2] = value.z;
            this._shareBuffer[3] = value.w;
            this._nativeObj.setSimpleAnimatorParamsByBuffer();
        }
        _renderUpdate(context3D) {
            this.shaderData.setVector(Laya.SimpleSkinnedMeshSprite3D.SIMPLE_SIMPLEANIMATORPARAMS, this._simpleAnimatorParams);
        }
    }

    class LayaXDirectLight {
        get transform() { return this._transform; }
        set transform(value) {
            this._transform = value;
            this._nativeObj.setTransform(value ? value._nativeObj : null);
        }
        get shadowResolution() { return this._u32[0]; }
        set shadowResolution(value) { this._u32[0] = value; }
        get shadowDistance() { return this._f32[1]; }
        set shadowDistance(value) { this._f32[1] = value; }
        get shadowMode() { return this._u32[3]; }
        set shadowMode(value) { this._u32[3] = value; }
        get shadowStrength() { return this._f32[2]; }
        set shadowStrength(value) { this._f32[2] = value; }
        get shadowDepthBias() { return this._f32[4]; }
        set shadowDepthBias(value) { this._f32[4] = value; }
        get shadowNormalBias() { return this._f32[5]; }
        set shadowNormalBias(value) { this._f32[5] = value; }
        get shadowNearPlane() { return this._f32[6]; }
        set shadowNearPlane(value) { this._f32[6] = value; }
        get shadowCascadesMode() { return this._u32[7]; }
        set shadowCascadesMode(value) { this._u32[7] = value; }
        get shadowTwoCascadeSplits() { return this._f32[8]; }
        set shadowTwoCascadeSplits(value) { this._f32[8] = value; }
        setShadowFourCascadeSplits(value) {
            if (value) {
                this._f32[9] = value.x;
                this._f32[9 + 1] = value.y;
                this._f32[9 + 2] = value.z;
            }
        }
        setOrientation(ux, uy, uz, sx, sy, sz, fx, fy, fz) {
            this._f32[12] = ux;
            this._f32[12 + 1] = uy;
            this._f32[12 + 2] = uz;
            this._f32[15] = sx;
            this._f32[15 + 1] = sy;
            this._f32[15 + 2] = sz;
            this._f32[18] = fx;
            this._f32[18 + 1] = fy;
            this._f32[18 + 2] = fz;
        }
        setDirection(value) {
        }
        constructor() {
            this._nativeObj = new window.conchLayaXDirectLight();
            this._buf = new ArrayBuffer(21 * 4);
            this._f32 = new Float32Array(this._buf);
            this._u32 = new Uint32Array(this._buf);
            this._u32[0] = 1024;
            this._f32[1] = 50.0;
            this._f32[2] = 1.0;
            this._u32[3] = 0;
            this._f32[4] = 1.0;
            this._f32[5] = 1.0;
            this._f32[6] = 0.1;
            this._u32[7] = 0;
            this._f32[8] = 1.0 / 3.0;
            this._f32[9] = 0.067;
            this._f32[9 + 1] = 0.2;
            this._f32[9 + 2] = 0.467;
            this._f32[12 + 1] = 1.0;
            this._f32[15] = 1.0;
            this._f32[18 + 2] = -1.0;
            this._nativeObj.bindBuffer(this._buf);
        }
        syncShadow() {
        }
    }

    class LayaXPointLight {
        get transform() { return this._transform; }
        set transform(value) {
            this._transform = value;
            this._nativeObj.setTransform(value ? value._nativeObj : null);
        }
        get range() { return this._f32[0]; }
        set range(value) { this._f32[0] = value; }
        get shadowResolution() { return this._u32[1]; }
        set shadowResolution(value) { this._u32[1] = value; }
        get shadowDistance() { return this._f32[2]; }
        set shadowDistance(value) { this._f32[2] = value; }
        get shadowMode() { return this._u32[3]; }
        set shadowMode(value) { this._u32[3] = value; }
        get shadowStrength() { return this._f32[4]; }
        set shadowStrength(value) { this._f32[4] = value; }
        get shadowDepthBias() { return this._f32[5]; }
        set shadowDepthBias(value) { this._f32[5] = value; }
        get shadowNormalBias() { return this._f32[6]; }
        set shadowNormalBias(value) { this._f32[6] = value; }
        get shadowNearPlane() { return this._f32[7]; }
        set shadowNearPlane(value) { this._f32[7] = value; }
        constructor() {
            this._nativeObj = new window.conchLayaXPointLight();
            this._buf = new ArrayBuffer(8 * 4);
            this._f32 = new Float32Array(this._buf);
            this._u32 = new Uint32Array(this._buf);
            this._nativeObj.bindBuffer(this._buf);
        }
    }

    class LayaXSpotLight {
        get transform() { return this._transform; }
        set transform(value) {
            this._nativeObj.setTransform(value ? value._nativeObj : null);
            this._transform = value;
        }
        get shadowResolution() { return this._u32[19]; }
        set shadowResolution(value) { this._u32[19] = value; }
        get shadowDistance() { return this._f32[24]; }
        set shadowDistance(value) { this._f32[24] = value; }
        get shadowMode() { return this._u32[23]; }
        set shadowMode(value) { this._u32[23] = value; }
        get shadowStrength() { return this._f32[22]; }
        set shadowStrength(value) { this._f32[22] = value; }
        get shadowDepthBias() { return this._f32[20]; }
        set shadowDepthBias(value) { this._f32[20] = value; }
        get shadowNormalBias() { return this._f32[21]; }
        set shadowNormalBias(value) { this._f32[21] = value; }
        get shadowNearPlane() { return this._f32[18]; }
        set shadowNearPlane(value) { this._f32[18] = value; }
        get spotRange() { return this._f32[17]; }
        set spotRange(value) { this._f32[17] = value; }
        get spotAngle() { return this._f32[16]; }
        set spotAngle(value) { this._f32[16] = value; }
        setDirection(value) {
        }
        constructor() {
            this._nativeObj = new window.conchLayaXSpotLight();
            this._buf = new ArrayBuffer(25 * 4);
            this._f32 = new Float32Array(this._buf);
            this._u32 = new Uint32Array(this._buf);
            this._f32[0] = 1.0;
            this._f32[0 + 5] = 1.0;
            this._f32[0 + 10] = 1.0;
            this._f32[0 + 15] = 1.0;
            this._f32[16] = 45.0;
            this._f32[17] = 30.0;
            this._f32[18] = 0.1;
            this._u32[19] = 1024;
            this._f32[20] = 1.0;
            this._f32[21] = 1.0;
            this._f32[22] = 1.0;
            this._u32[23] = 0;
            this._f32[24] = 50.0;
            this._nativeObj.bindBuffer(this._buf);
        }
        syncShadow() {
            if (this._transform) {
                this._f32.set(this._transform.worldMatrix.elements, 0);
            }
        }
    }

    class LayaXLightmapData {
        get offsetX() { return this._f32[0]; }
        set offsetX(value) { this._f32[0] = value; }
        get offsetY() { return this._f32[0 + 1]; }
        set offsetY(value) { this._f32[0 + 1] = value; }
        get offsetZ() { return this._f32[0 + 2]; }
        set offsetZ(value) { this._f32[0 + 2] = value; }
        get offsetW() { return this._f32[0 + 3]; }
        set offsetW(value) { this._f32[0 + 3] = value; }
        get lightmapIndex() { return this._i32[4]; }
        set lightmapIndex(value) { this._i32[4] = value; }
        constructor() {
            this._nativeObj = new window.conchLayaXLightmapData();
            this._buf = new ArrayBuffer(5 * 4);
            this._f32 = new Float32Array(this._buf);
            this._i32 = new Int32Array(this._buf);
            this._i32[4] = -1;
            this._nativeObj.bindBuffer(this._buf);
        }
        get lightmapColor() {
            return this._lightmapColor;
        }
        set lightmapColor(value) {
            this._lightmapColor = value;
            this._nativeObj.setLightmapColor(value ? value._nativeObj : null);
        }
        get lightmapDirection() {
            return this._lightmapDirection;
        }
        set lightmapDirection(value) {
            this._lightmapDirection = value;
            this._nativeObj.setLightmapDirection(value ? value._nativeObj : null);
        }
        destroy() {
            this._nativeObj.destroy();
        }
    }

    class LayaX3DRenderModuleFactory {
        createTransform(owner) {
            return new LayaXTransform3D(owner);
        }
        createBounds(min, max) {
            return new LayaXBounds(min, max);
        }
        setBoundsMinMaxBatch(targets, values, count) {
            return LayaXBounds.setMinMaxBatch(targets, values, count);
        }
        createVolumetricGI() {
            return new LayaXVolumetricGI();
        }
        createReflectionProbe() {
            return new LayaXReflectionProbe();
        }
        createLightmapData() {
            return new LayaXLightmapData();
        }
        createDirectLight() {
            return new LayaXDirectLight();
        }
        createSpotLight() {
            return new LayaXSpotLight();
        }
        createPointLight() {
            return new LayaXPointLight();
        }
        createCameraModuleData() {
            return new LayaXCameraNodeData();
        }
        createSceneModuleData() {
            return new LayaXSceneNodeData();
        }
        createBaseRenderNode() {
            return new LayaXBaseRenderNode();
        }
        createMeshRenderNode() {
            return new LayaXMeshRenderNode();
        }
        createSkinRenderNode() {
            return new LayaXSkinRenderNode();
        }
        createSimpleSkinRenderNode() {
            return new LayaXSimpleSkinRenderNode();
        }
    }
    Laya.Laya.addBeforeInitCallback(() => {
        if (Laya.LayaEnv.isModernAPIs && !Laya.Laya3DRender.Render3DModuleDataFactory)
            Laya.Laya3DRender.Render3DModuleDataFactory = new LayaX3DRenderModuleFactory();
    });

    class RTBaseSpotRP {
        constructor() {
            this._nativeObj = new window.conchRPBaseSpotRP();
        }
        setShadowCasterCommanBuffer(cmd) {
        }
        setCameraCullInfo(sceneManager) {
            this._nativeObj.setCameraCullInfo(sceneManager._nativeObj);
        }
        setRPData(spotLight, context) {
            this._destShadowRT = Laya.Scene3D._shadowCasterPass.getSpotLightShadowPassData(spotLight);
            this._nativeObj.setRPData(spotLight._nativeObj, context._nativeObj, this._destShadowRT._renderTarget._nativeObj);
        }
        destroy() {
        }
    }

    class RTDirCascadeShadowRP {
        constructor() {
            this._nativeObj = new window.conchRTDirCascadeShadowRP();
        }
        setShadowCasterCommanBuffer(cmd) {
            this._nativeObj.clearShadowCasterCommandBuffer();
            cmd.forEach(element => {
                this._setCmd(element);
            });
        }
        _setCmd(cmd) {
            cmd._apply(false);
            let cmds = cmd._renderCMDs;
            let nativeobCMDs = [];
            cmds.forEach(element => {
                nativeobCMDs.push(element._nativeObj);
            });
            this._nativeObj.addShadowCasterCommandBuffers(nativeobCMDs);
        }
        setRPData(dirLight, camera, context) {
            this._destShadowRT = Laya.Scene3D._shadowCasterPass.getDirectLightShadowMap(dirLight);
            this._nativeObj.setRPData(dirLight._nativeObj, camera._nativeObj, context._nativeObj, this._destShadowRT._renderTarget._nativeObj);
        }
        setCameraCullInfo(sceneManager) {
            this._nativeObj.setCameraCullInfo(sceneManager._nativeObj);
        }
        destroy() {
        }
    }

    class RTForwardAddClusterRP {
        get pipelineMode() {
            return this._nativeObj.pipelineMode;
        }
        set pipelineMode(value) {
            this._nativeObj.pipelineMode = value;
        }
        get depthPipelineMode() {
            return this._nativeObj.depthPipelineMode;
        }
        set depthPipelineMode(value) {
            this._nativeObj.depthPipelineMode = value;
        }
        get depthNormalPipelineMode() {
            return this._nativeObj.depthNormalPipelineMode;
        }
        set depthNormalPipelineMode(value) {
            this._nativeObj.depthNormalPipelineMode = value;
        }
        get depthTextureMode() {
            return this._u32[0];
        }
        set depthTextureMode(value) {
            this._u32[0] = value;
        }
        get depthTarget() {
            return this._depthTarget;
        }
        set depthTarget(value) {
            this._depthTarget = value;
            this._nativeObj.setDepthTarget(value ? value._nativeObj : null);
        }
        get destTarget() {
            return this._destTarget;
        }
        set destTarget(value) {
            this._destTarget = value;
            this._nativeObj.setDestTarget(value ? value._nativeObj : null);
        }
        get opaqueMRTTarget() { return this._opaqueMRTTarget; }
        set opaqueMRTTarget(value) {
            this._opaqueMRTTarget = value;
            this._nativeObj.setOpaqueMRTTarget(value ? value._nativeObj : null);
        }
        get opaqueMRTClearColors() { return this._opaqueMRTClearColors; }
        set opaqueMRTClearColors(value) {
            var _a, _b, _c, _d, _e;
            this._opaqueMRTClearColors = value;
            const rgba = this._opaqueMRTClearRGBA;
            const enabled = this._opaqueMRTClearEnabled;
            const count = (_a = value === null || value === void 0 ? void 0 : value.length) !== null && _a !== void 0 ? _a : 0;
            rgba.length = count * 4;
            enabled.length = count;
            for (let i = 0; i < count; i++) {
                const color = value[i];
                enabled[i] = color ? 1 : 0;
                rgba[i * 4] = (_b = color === null || color === void 0 ? void 0 : color.r) !== null && _b !== void 0 ? _b : 0;
                rgba[i * 4 + 1] = (_c = color === null || color === void 0 ? void 0 : color.g) !== null && _c !== void 0 ? _c : 0;
                rgba[i * 4 + 2] = (_d = color === null || color === void 0 ? void 0 : color.b) !== null && _d !== void 0 ? _d : 0;
                rgba[i * 4 + 3] = (_e = color === null || color === void 0 ? void 0 : color.a) !== null && _e !== void 0 ? _e : 0;
            }
            this._nativeObj.setOpaqueMRTClearColors(rgba, enabled);
        }
        get depthNormalTarget() {
            return this._depthNormalTarget;
        }
        set depthNormalTarget(value) {
            this._depthNormalTarget = value;
            this._nativeObj.setDepthNormalTarget(value ? value._nativeObj : null);
        }
        get enableCMD() {
            return this._i32[1] !== 0;
        }
        set enableCMD(value) {
            this._i32[1] = value ? 1 : 0;
        }
        get enableOpaque() {
            return this._i32[2] !== 0;
        }
        set enableOpaque(value) {
            this._i32[2] = value ? 1 : 0;
        }
        get enableTransparent() {
            return this._i32[3] !== 0;
        }
        set enableTransparent(value) {
            this._i32[3] = value ? 1 : 0;
        }
        get skyRenderNode() {
            return this._skyRenderNode;
        }
        set skyRenderNode(value) {
            this._skyRenderNode = value;
            this._nativeObj.setSkyRenderNode(value ? value._nativeObj : null);
        }
        get camera() {
            return this._camera;
        }
        set camera(value) {
            this._camera = value;
            this._nativeObj.setCameraNodeData(value._nativeObj);
        }
        get clearColor() {
            return this._clearColor;
        }
        set clearColor(value) {
            this._clearColor = value;
            this._f32[12] = value.r;
            this._f32[13] = value.g;
            this._f32[14] = value.b;
            this._f32[15] = value.a;
        }
        get clearFlag() {
            return this._clearFlag;
        }
        set clearFlag(value) {
            this._clearFlag = value;
            this._u32[16] = value;
        }
        setCameraCullInfo(value, sceneManager) {
            this._cameraCullInfo.position = value._transform.position;
            this._cameraCullInfo.cullingMask = value.cullingMask;
            this._cameraCullInfo.staticMask = value.staticMask;
            this._cameraCullInfo.boundFrustum = value.boundFrustum;
            this._cameraCullInfo.useOcclusionCulling = value.useOcclusionCulling;
            this._nativeObj.setCameraCullInfo(this._cameraCullInfo, sceneManager._nativeObj);
        }
        setViewPort(value) {
            this._f32[4] = value.x;
            this._f32[5] = value.y;
            this._f32[6] = value.width;
            this._f32[7] = value.height;
        }
        setScissor(value) {
            this._f32[8] = value.x;
            this._f32[9] = value.y;
            this._f32[10] = value.z;
            this._f32[11] = value.w;
        }
        _getRenderCMDArray(cmds) {
            let nativeobCMDs = [];
            cmds.forEach(element => {
                nativeobCMDs.push(element._nativeObj);
            });
            return nativeobCMDs;
        }
        setBeforeForwardCmds(value) {
            if (value && value.length > 0) {
                this._nativeObj.clearBeforeForwardCmds();
                value.forEach(element => {
                    element._apply(false);
                    this._nativeObj.addBeforeForwardCmds(this._getRenderCMDArray(element._renderCMDs));
                });
            }
            else {
                this._nativeObj.clearBeforeForwardCmds();
            }
        }
        setBeforeSkyboxCmds(value) {
            if (value && value.length > 0) {
                this._nativeObj.clearBeforeSkyboxCmds();
                value.forEach(element => {
                    element._apply(false);
                    this._nativeObj.addBeforeSkyboxCmds(this._getRenderCMDArray(element._renderCMDs));
                });
            }
            else {
                this._nativeObj.clearBeforeSkyboxCmds();
            }
        }
        setBeforeTransparentCmds(value) {
            if (value && value.length > 0) {
                this._nativeObj.clearBeforeTransparentCmds();
                value.forEach(element => {
                    element._apply(false);
                    this._nativeObj.addBeforeTransparentCmds(this._getRenderCMDArray(element._renderCMDs));
                });
            }
            else {
                this._nativeObj.clearBeforeTransparentCmds();
            }
        }
        constructor() {
            this._opaqueMRTClearRGBA = [];
            this._opaqueMRTClearEnabled = [];
            this._cameraCullInfo = new Laya.CameraCullInfo();
            this._nativeObj = new window.conchRTForwardAddClusterRP();
            this._mem = new Laya.NativeMemory(17 * 4, false);
            this._f32 = this._mem.float32Array;
            this._i32 = this._mem.int32Array;
            this._u32 = this._mem.Uint32Array;
            this._nativeObj.bindPropertyBuffer(this._mem._buffer);
            this._i32[2] = 1;
            this._i32[3] = 1;
            this._f32[12] = 1;
            this._f32[13] = 1;
            this._f32[14] = 1;
            this._f32[15] = 1;
        }
        destroy() {
            this._nativeObj = null;
        }
    }

    class RTForwardAddRP {
        get shadowCastPass() {
            return this._i32[0] !== 0;
        }
        set shadowCastPass(value) {
            this._i32[0] = value ? 1 : 0;
        }
        get enableDirectLightShadow() {
            return this._i32[1] !== 0;
        }
        set enableDirectLightShadow(value) {
            this._i32[1] = value ? 1 : 0;
        }
        get enableSpotLightShadowPass() {
            return this._i32[2] !== 0;
        }
        set enableSpotLightShadowPass(value) {
            this._i32[2] = value ? 1 : 0;
        }
        get enablePostProcess() {
            return this._i32[3] !== 0;
        }
        set enablePostProcess(value) {
            this._i32[3] = value ? 1 : 0;
        }
        get postProcess() {
            return this._postProcess;
        }
        set postProcess(value) {
            this._postProcess = value;
            value._apply(false);
            this._nativeObj.setPostProcess(this._getRenderCMDArray(value._renderCMDs));
        }
        get finalize() {
            return this._finalize;
        }
        set finalize(value) {
            this._finalize = value;
            value._apply(false);
            this._nativeObj.setfinalize(this._getRenderCMDArray(value._renderCMDs));
        }
        get dirShadowRenderPass() {
            return this._dirLightShadowPass;
        }
        set dirShadowRenderPass(value) {
            this._dirLightShadowPass = value;
            this._nativeObj.setDirectLightShadowPass(value._nativeObj);
        }
        get spotShadowRenderPass() {
            return this._spotShadowRenderPass;
        }
        set spotShadowRenderPass(value) {
            this._spotShadowRenderPass = value;
            this._nativeObj.setSpotLightShadowPass(value._nativeObj);
        }
        get mainRenderpass() {
            return this._mainRenderpass;
        }
        set mainRenderpass(value) {
            this._mainRenderpass = value;
            this._nativeObj.setMainPass(value._nativeObj);
        }
        constructor() {
            this._finalize = new Laya.CommandBuffer();
            this._nativeObj = new window.conchRTForwardAddRP();
            this._mem = new Laya.NativeMemory(4 * 4, false);
            this._i32 = this._mem.int32Array;
            this._nativeObj.bindPropertyBuffer(this._mem._buffer);
            this.shadowCastPass = false;
            this.enableDirectLightShadow = false;
            this.enableSpotLightShadowPass = false;
            this.dirShadowRenderPass = new RTDirCascadeShadowRP();
            this.spotShadowRenderPass = new RTBaseSpotRP();
            this.mainRenderpass = new RTForwardAddClusterRP();
        }
        _getRenderCMDArray(cmds) {
            let nativeobCMDs = [];
            cmds.forEach(element => {
                nativeobCMDs.push(element._nativeObj);
            });
            return nativeobCMDs;
        }
        setAfterEventCmd(value) {
            if (value && value.length > 0) {
                this._nativeObj.clearAfterAllRenderCmds();
                value.forEach(element => {
                    element._apply(false);
                    this._nativeObj.addAfterAllRenderCmds(this._getRenderCMDArray(element._renderCMDs));
                });
            }
            else {
                this._nativeObj.clearAfterAllRenderCmds();
            }
        }
        setBeforeImageEffect(value) {
            if (value && value.length > 0) {
                this._nativeObj.clearBeforeImageEffectCmds();
                value.forEach(element => {
                    element._apply(false);
                    this._nativeObj.addBeforeImageEffectCmds(this._getRenderCMDArray(element._renderCMDs));
                });
            }
            else {
                this._nativeObj.clearBeforeImageEffectCmds();
            }
        }
        destroy() {
        }
    }

    const viewport = new Laya.Viewport(0, 0, 0, 0);
    const offsetScale = new Laya.Vector4();
    new Laya.Vector4();
    class RTRender3DProcess {
        constructor() {
            this._renderPass = new RTForwardAddRP();
            this._nativeObj = new window.conchRT3DRenderProcess();
            this._defaultDepthTex = Laya.RenderTexture.createFromPool(1, 1, Laya.RenderTargetFormat.DEPTH_32, Laya.RenderTargetFormat.None, false, 1);
            this._defaultShadowMap = Laya.ShadowUtils.getTemporaryShadowTexture(1, 1, Laya.ShadowMapFormat.bit16);
            this._nativeObj.setDefaultShadowMap(this._defaultShadowMap._renderTarget._nativeObj);
            let shadowMap = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap("Shadow");
            shadowMap.setDefaultTextureData(Laya.ShadowCasterPass.SHADOW_MAP, this._defaultShadowMap);
            shadowMap.setDefaultTextureData(Laya.ShadowCasterPass.SHADOW_SPOTMAP, this._defaultShadowMap);
        }
        get render3DManager() {
            return this._render3DManager;
        }
        set render3DManager(value) {
            this._render3DManager = value;
            this._nativeObj.renderManager = value._nativeObj;
        }
        destroy() {
            this._renderPass = null;
        }
        initRenderpass(camera, context) {
            let renderpass = this._renderPass.mainRenderpass;
            let renderRT = camera._getRenderTexture();
            let clearConst = 0;
            let clearFlag = camera.clearFlag;
            if (clearFlag == Laya.CameraClearFlags.Sky && !camera.scene.skyRenderer._isAvailable()) {
                clearFlag = Laya.CameraClearFlags.SolidColor;
            }
            let hasStencil = renderRT.depthStencilFormat == Laya.RenderTargetFormat.DEPTHSTENCIL_24_8;
            let stencilFlag = hasStencil ? Laya.RenderClearFlag.Stencil : 0;
            switch (clearFlag) {
                case Laya.CameraClearFlags.DepthOnly:
                case Laya.CameraClearFlags.Sky:
                    clearConst = Laya.RenderClearFlag.Depth | stencilFlag;
                    break;
                case Laya.CameraClearFlags.Nothing:
                    clearConst = 0;
                    break;
                case Laya.CameraClearFlags.ColorOnly:
                    clearConst = Laya.RenderClearFlag.Color;
                    break;
                case Laya.CameraClearFlags.SolidColor:
                default:
                    clearConst = Laya.RenderClearFlag.Color | Laya.RenderClearFlag.Depth | stencilFlag;
                    break;
            }
            let clearValue = camera._linearClearColor;
            clearValue = renderRT.gammaCorrection != 1 ? camera.clearColor : camera._linearClearColor;
            renderpass.camera = camera._renderDataModule;
            renderpass.destTarget = renderRT._getRenderTarget(!!camera.effectiveOpaqueMRT);
            renderpass.clearFlag = clearConst;
            renderpass.clearColor = clearValue;
            renderpass.opaqueMRTTarget = camera.effectiveOpaqueMRT ? renderRT._getRenderTarget() : null;
            renderpass.opaqueMRTClearColors = camera._getOpaqueMRTClearColors((clearConst & Laya.RenderClearFlag.Color) ? clearValue : null);
            let needInternalRT = camera._needInternalRenderTexture();
            renderpass.setCameraCullInfo(camera, this.render3DManager);
            if (needInternalRT) {
                viewport.set(0, 0, renderRT.width, renderRT.height);
            }
            else {
                camera.viewport.cloneTo(viewport);
            }
            renderpass.setViewPort(viewport);
            let scissor = Laya.Vector4.TEMP;
            scissor.setValue(viewport.x, viewport.y, viewport.width, viewport.height);
            renderpass.setScissor(scissor);
            renderpass.enableOpaque = Laya.Stat.enableOpaque;
            renderpass.enableTransparent = Laya.Stat.enableTransparent;
            renderpass.enableCMD = Laya.Stat.enableCameraCMD;
            renderpass.setBeforeSkyboxCmds(camera._cameraEventCommandBuffer[Laya.CameraEventFlags.BeforeSkyBox]);
            renderpass.setBeforeForwardCmds(camera._cameraEventCommandBuffer[Laya.CameraEventFlags.BeforeForwardOpaque]);
            renderpass.setBeforeTransparentCmds(camera._cameraEventCommandBuffer[Laya.CameraEventFlags.BeforeTransparent]);
            this._renderPass.setBeforeImageEffect(camera._cameraEventCommandBuffer[Laya.CameraEventFlags.BeforeImageEffect]);
            this._renderPass.setAfterEventCmd(camera._cameraEventCommandBuffer[Laya.CameraEventFlags.AfterEveryThing]);
            if (clearFlag == Laya.CameraClearFlags.Sky) {
                renderpass.skyRenderNode = camera.scene.skyRenderer._baseRenderNode;
            }
            else {
                renderpass.skyRenderNode = null;
            }
            renderpass.pipelineMode = Laya.RenderContext3D._instance.configPipeLineMode;
            let enableShadow = Laya.Scene3D._updateMark % camera.scene._ShadowMapupdateFrequency == 0 && Laya.Stat.enableShadow;
            this._renderPass.shadowCastPass = enableShadow;
            window.conchRT3DRenderProcess._addPreDrawUniformMap("Scene3D", context._nativeObj);
            window.conchRT3DRenderProcess._addPreDrawUniformMap("Global", context._nativeObj);
            context.preDrawUniformMaps = context.preDrawUniformMaps;
            if (enableShadow) {
                let mainDirectionLight = camera.scene._mainDirectionLight;
                let needDirectionShadow = mainDirectionLight && mainDirectionLight.shadowMode != Laya.ShadowMode.None;
                this._renderPass.enableDirectLightShadow = needDirectionShadow;
                if (needDirectionShadow) {
                    this._renderPass.dirShadowRenderPass.setRPData(mainDirectionLight._dataModule, camera._renderDataModule, context);
                    this._renderPass.dirShadowRenderPass.setCameraCullInfo(this._render3DManager);
                }
                let mainSpotLight = camera.scene._mainSpotLight;
                let needSpotShadow = mainSpotLight && mainSpotLight.shadowMode != Laya.ShadowMode.None;
                this._renderPass.enableSpotLightShadowPass = needSpotShadow;
                if (needSpotShadow) {
                    this._renderPass.spotShadowRenderPass.setRPData(mainSpotLight._dataModule, context);
                    this._renderPass.spotShadowRenderPass.setCameraCullInfo(this.render3DManager);
                }
                if (needDirectionShadow || needSpotShadow) {
                    window.conchRT3DRenderProcess._addPreDrawUniformMap("Shadow", context._nativeObj);
                }
            }
            else {
                window.conchRT3DRenderProcess._removePreDrawUniformMap("Shadow", context._nativeObj);
            }
            context.preDrawUniformMaps = context.preDrawUniformMaps;
            if (Laya.Stat.enablePostprocess && camera.postProcess && camera.postProcess.enable && camera.postProcess.effects.length > 0) {
                this._renderPass.enablePostProcess = camera.postProcess.enable;
                camera.postProcess._render(camera);
                this._renderPass.postProcess = camera.postProcess._context.command;
            }
            else {
                this._renderPass.enablePostProcess = false;
            }
            this._renderPass.finalize.clear();
            if (!this._renderPass.enablePostProcess && needInternalRT && camera._offScreenRenderTexture) {
                let dst = camera._offScreenRenderTexture;
                offsetScale.setValue(camera.normalizedViewport.x, 1.0 - camera.normalizedViewport.y, renderRT.width / dst.width, -renderRT.height / dst.height);
                this._renderPass.finalize.blitScreenQuad(renderRT, camera._offScreenRenderTexture, offsetScale);
            }
            this._renderPass.finalize = this._renderPass.finalize;
        }
        renderDepth(camera) {
            this._renderPass.mainRenderpass.depthTarget = null;
            let depthMode = camera.depthTextureMode;
            if (camera.postProcess && camera.postProcess.enable) {
                depthMode |= camera.postProcess.cameraDepthTextureMode;
            }
            if ((depthMode & Laya.DepthTextureMode.Depth) != 0) {
                Laya.Camera.depthPass.getTarget(camera, Laya.DepthTextureMode.Depth, camera.depthTextureFormat);
                const useCachedDepth = camera.canblitDepth && camera.depthTexture === camera._cacheDepthTexture.depthStencilTexture;
                if (useCachedDepth)
                    depthMode &= ~Laya.DepthTextureMode.Depth;
                else
                    this._renderPass.mainRenderpass.depthTarget = camera.depthTexture._getRenderTarget();
                Laya.Camera.depthPass._setupDepthModeShaderValue(Laya.DepthTextureMode.Depth, camera);
            }
            if ((depthMode & Laya.DepthTextureMode.DepthNormals) != 0) {
                Laya.Camera.depthPass.getTarget(camera, Laya.DepthTextureMode.DepthNormals, camera.depthTextureFormat);
                this._renderPass.mainRenderpass.depthNormalTarget = camera.depthNormalTexture._renderTarget;
                camera._shaderValues.setTexture(Laya.DepthPass.DEPTHNORMALSTEXTURE, camera.depthNormalTexture);
                Laya.Camera.depthPass._setupDepthModeShaderValue(Laya.DepthTextureMode.DepthNormals, camera);
            }
            this._renderPass.mainRenderpass.depthTextureMode = depthMode;
        }
        fowardRender(context, camera) {
            Laya.Camera.depthPass.cleanUp(camera);
            context.cameraData.setTexture(Laya.DepthPass.DEPTHTEXTURE, this._defaultDepthTex);
            this.renderDepth(camera);
            this.initRenderpass(camera, context);
            try {
                this.renderFowarAddCameraPass(context, this._renderPass);
            }
            finally {
                this._renderPass.mainRenderpass.opaqueMRTTarget = null;
                this._renderPass.mainRenderpass.opaqueMRTClearColors = null;
            }
        }
        renderFowarAddCameraPass(context, renderpass) {
            this._nativeObj.renderForwardAddCameraPass(context._nativeObj, renderpass._nativeObj);
        }
    }

    class NativeBounds {
        static setMinMaxBatch(targets, values, count) {
            var _a;
            if (this._batchBusy || count === 0)
                return false;
            const first = targets[0]._imp;
            if (!(first instanceof NativeBounds) || typeof ((_a = first._nativeObj) === null || _a === void 0 ? void 0 : _a.setMinMaxBatch) !== "function")
                return false;
            this._batchBusy = true;
            try {
                for (let i = 0; i < count; i++) {
                    const target = targets[i];
                    if (!(target._imp instanceof NativeBounds)
                        || target.setMin !== Laya.Bounds.prototype.setMin || target.setMax !== Laya.Bounds.prototype.setMax)
                        return false;
                    this._batchTargets.push(target._imp._nativeObj);
                }
                if (!first._nativeObj.setMinMaxBatch(this._batchTargets, values.buffer, values.byteOffset, count))
                    throw new Error("Native Bounds batch rejected");
                return true;
            }
            finally {
                this._batchTargets.length = 0;
                this._batchBusy = false;
            }
        }
        get min() {
            return this.getMin();
        }
        set min(value) {
            this.setMin(value);
        }
        get max() {
            return this.getMax();
        }
        set max(value) {
            this.setMax(value);
        }
        setMin(value) {
            const { x, y, z } = value;
            this._sharedState[12] &= ~3;
            let index = NativeBounds.BOUNDS_MIN_DATAOFFSET;
            this.float32Array[index] = x;
            this.float32Array[index + 1] = y;
            this.float32Array[index + 2] = z;
            this._nativeObj.setMin();
        }
        getMin() {
            var min = this._boundBox.min;
            if ((this._sharedState[12] & ~2) !== (NativeBounds._sharedReady | 1))
                this._nativeObj.getMin();
            let index = NativeBounds.BOUNDS_MIN_DATAOFFSET;
            min.x = this.float32Array[index];
            min.y = this.float32Array[index + 1];
            min.z = this.float32Array[index + 2];
            return min;
        }
        setMax(value) {
            const { x, y, z } = value;
            this._sharedState[12] &= ~3;
            let index = NativeBounds.BOUNDS_MAX_DATAOFFSET;
            this.float32Array[index] = x;
            this.float32Array[index + 1] = y;
            this.float32Array[index + 2] = z;
            this._nativeObj.setMax();
        }
        getMax() {
            var max = this._boundBox.max;
            if ((this._sharedState[12] & ~1) !== (NativeBounds._sharedReady | 2))
                this._nativeObj.getMax();
            let index = NativeBounds.BOUNDS_MAX_DATAOFFSET;
            max.x = this.float32Array[index];
            max.y = this.float32Array[index + 1];
            max.z = this.float32Array[index + 2];
            return max;
        }
        setCenter(value) {
            const { x, y, z } = value;
            this._sharedState[12] &= ~3;
            let index = NativeBounds.BOUNDS_CENTER_DATAOFFSET;
            this.float32Array[index] = x;
            this.float32Array[index + 1] = y;
            this.float32Array[index + 2] = z;
            this._nativeObj.setCenter();
        }
        getCenter() {
            var center = this._center;
            this._nativeObj.getCenter();
            let index = NativeBounds.BOUNDS_CENTER_DATAOFFSET;
            center.x = this.float32Array[index];
            center.y = this.float32Array[index + 1];
            center.z = this.float32Array[index + 2];
            return center;
        }
        setExtent(value) {
            const { x, y, z } = value;
            this._sharedState[12] &= ~3;
            let index = NativeBounds.BOUNDS_EXTENT_DATAOFFSET;
            this.float32Array[index] = x;
            this.float32Array[index + 1] = y;
            this.float32Array[index + 2] = z;
            this._nativeObj.setExtent();
        }
        getExtent() {
            var extent = this._extent;
            this._nativeObj.getExtent();
            let index = NativeBounds.BOUNDS_EXTENT_DATAOFFSET;
            extent.x = this.float32Array[index];
            extent.y = this.float32Array[index + 1];
            extent.z = this.float32Array[index + 2];
            return extent;
        }
        constructor(min, max) {
            this._center = new Laya.Vector3();
            this._extent = new Laya.Vector3();
            this._boundBox = new Laya.BoundBox(new Laya.Vector3(), new Laya.Vector3());
            this.nativeMemory = new Laya.NativeMemory(NativeBounds.BOUNDS_SHARE_MEMORY_SIZE * 4, false);
            this._sharedState = this.nativeMemory.Uint32Array;
            this._sharedState[12] = 0x42580000;
            this._nativeObj = new window.conchBounds(this.nativeMemory._buffer);
            if ((this._sharedState[12] & ~3) !== NativeBounds._sharedReady) {
                this.nativeMemory = new Laya.NativeMemory(12 * 4, true);
                this._nativeObj = new window.conchBounds(this.nativeMemory._buffer);
                this._sharedState = new Uint32Array(13);
            }
            this.float32Array = this.nativeMemory.float32Array;
            min && this.setMin(min);
            max && this.setMax(max);
        }
        _tranform(matrix, out) {
            this._nativeObj._tranform(matrix.elements, out._nativeObj);
        }
        _getBoundBox() {
            if (this._sharedState[12] !== (NativeBounds._sharedReady | 3))
                this._nativeObj._getBoundBox();
            let minIndex = NativeBounds.BOUNDS_MIN_DATAOFFSET;
            let maxIndex = NativeBounds.BOUNDS_MAX_DATAOFFSET;
            this._boundBox.min.x = this.float32Array[minIndex];
            this._boundBox.min.y = this.float32Array[minIndex + 1];
            this._boundBox.min.z = this.float32Array[minIndex + 2];
            this._boundBox.max.x = this.float32Array[maxIndex];
            this._boundBox.max.y = this.float32Array[maxIndex + 1];
            this._boundBox.max.z = this.float32Array[maxIndex + 2];
            return this._boundBox;
        }
        calculateBoundsintersection(bounds) {
            var ownMax = this.getMax();
            var ownMin = this.getMin();
            var calMax = bounds.getMax();
            var calMin = bounds.getMin();
            var tempV0 = TEMP_VECTOR3_MAX0;
            var tempV1 = TEMP_VECTOR3_MAX1;
            var thisExtends = this.getExtent();
            var boundExtends = bounds.getExtent();
            tempV0.setValue(Math.max(ownMax.x, calMax.x) - Math.min(ownMin.x, calMin.x), Math.max(ownMax.y, calMax.y) - Math.min(ownMin.y, calMin.y), Math.max(ownMax.z, calMax.z) - Math.min(ownMin.z, calMin.z));
            tempV1.setValue((thisExtends.x + boundExtends.x) * 2.0, (thisExtends.y + boundExtends.y) * 2.0, (thisExtends.z + boundExtends.z) * 2.0);
            if ((tempV0.x) > (tempV1.x))
                return -1;
            if ((tempV0.y) > (tempV1.y))
                return -1;
            if ((tempV0.z) > (tempV1.z))
                return -1;
            return (tempV1.x - tempV0.x) * (tempV1.y - tempV0.y) * (tempV1.z - tempV0.z);
        }
        cloneTo(destObject) {
            this._nativeObj.cloneTo(destObject._nativeObj);
        }
        clone() {
            var dest = new NativeBounds(new Laya.Vector3(), new Laya.Vector3());
            this.cloneTo(dest);
            return dest;
        }
    }
    NativeBounds._batchTargets = [];
    NativeBounds._batchBusy = false;
    NativeBounds.BOUNDS_MIN_DATAOFFSET = 0;
    NativeBounds.BOUNDS_MAX_DATAOFFSET = 3;
    NativeBounds.BOUNDS_CENTER_DATAOFFSET = 6;
    NativeBounds.BOUNDS_EXTENT_DATAOFFSET = 9;
    NativeBounds.BOUNDS_SHARE_MEMORY_SIZE = 13;
    NativeBounds._sharedReady = 0x42590000;
    const TEMP_VECTOR3_MAX0 = new Laya.Vector3();
    const TEMP_VECTOR3_MAX1 = new Laya.Vector3();

    class RTCameraNodeData {
        get transform() {
            return this._transform;
        }
        set transform(value) {
            this._transform = value;
            this._nativeObj.setTransform(value._nativeObj);
        }
        get farplane() {
            return this._f32[16];
        }
        set farplane(value) {
            this._f32[16] = value;
        }
        get nearplane() {
            return this._f32[17];
        }
        set nearplane(value) {
            this._f32[17] = value;
        }
        get fieldOfView() {
            return this._f32[18];
        }
        set fieldOfView(value) {
            this._f32[18] = value;
        }
        get aspectRatio() {
            return this._f32[19];
        }
        set aspectRatio(value) {
            this._f32[19] = value;
        }
        constructor() {
            this._nativeObj = new window.conchRTCameraNodeData();
            this._mem = new Laya.NativeMemory(20 * 4, false);
            this._f32 = this._mem.float32Array;
            this._nativeObj.bindPropertyBuffer(this._mem._buffer);
        }
        setProjectionViewMatrix(value) {
            if (value)
                this._f32.set(value.elements, 0);
        }
    }
    class RTSceneNodeData {
        get lightmapDirtyFlag() {
            return this._i32[0];
        }
        set lightmapDirtyFlag(value) {
            this._i32[0] = value;
        }
        constructor() {
            this._nativeObj = new window.conchRTSceneNodeData();
            this._mem = new Laya.NativeMemory(1 * 4, false);
            this._i32 = this._mem.int32Array;
            this._nativeObj.bindPropertyBuffer(this._mem._buffer);
            this._i32[0] = -1;
        }
    }

    class RTTransform3D extends Laya.Transform3D {
        constructor(owner) {
            super(owner);
            this._localPosition = new Laya.Vector3(0, 0, 0);
            this._localRotation = new Laya.Quaternion(0, 0, 0, 1);
            this._localScale = new Laya.Vector3(1, 1, 1);
            this._localRotationEuler = new Laya.Vector3(0, 0, 0);
            this._localMatrix = new Laya.Matrix4x4();
            this._position = new Laya.Vector3(0, 0, 0);
            this._rotation = new Laya.Quaternion(0, 0, 0, 1);
            this._scale = new Laya.Vector3(1, 1, 1);
            this._rotationEuler = new Laya.Vector3(0, 0, 0);
            this._worldMatrix = new Laya.Matrix4x4();
            this._rtSyncFlag = 0;
            this._hasTransformChangedListener = false;
            this._isDefaultMatrix = false;
            this._faceInvert = false;
            this._frontFaceValue = 1;
        }
        _initProperty() {
            this._nativeMemory = new Laya.NativeMemory(RTTransform3D.TRANSFORM_SHARE_MEMORY_SIZE * 4, false);
            this._nativeFloat32Buffer = this._nativeMemory.float32Array;
            this._nativeUInt32Buffer = this._nativeMemory.Uint32Array;
            this._nativeObj = new window.conchRTTransform(this._nativeMemory._buffer);
            this._setTransformFlag(Laya.Transform3D.TRANSFORM_WORLDPOSITION | Laya.Transform3D.TRANSFORM_WORLDQUATERNION | Laya.Transform3D.TRANSFORM_WORLDEULER | Laya.Transform3D.TRANSFORM_WORLDSCALE | Laya.Transform3D.TRANSFORM_WORLDMATRIX, true);
            this.rotation = this._rotation;
            this.localScale = this._localScale;
            this.setWorldLossyScale(this._scale);
            this.localRotation = this._localRotation;
        }
        onStartListeningToType(type) {
            super.onStartListeningToType(type);
            if (type === Laya.Event.TRANSFORM_CHANGED)
                this._hasTransformChangedListener = true;
        }
        get isDefaultMatrix() {
            if (this._getTransformFlag(Laya.Transform3D.TRANSFORM_LOCALMATRIX)) {
                this.localMatrix;
            }
            return this._isDefaultMatrix;
        }
        _setTransformFlag(type, value) {
            let flag = this._nativeUInt32Buffer[RTTransform3D.TRANSFORM_CHANGEFLAG_DATAOFFSET];
            if (value)
                flag |= type;
            else
                flag &= ~type;
            this._nativeUInt32Buffer[RTTransform3D.TRANSFORM_CHANGEFLAG_DATAOFFSET] = flag;
        }
        _getTransformFlag(type) {
            return (this._getTransformChangeFlag() & type) != 0;
        }
        _getTransformChangeFlag() {
            return this._nativeUInt32Buffer[RTTransform3D.TRANSFORM_CHANGEFLAG_DATAOFFSET];
        }
        _getRTSyncFlag(type) {
            return (this._nativeUInt32Buffer[RTTransform3D.TRANSFORM_RT_SYNC_FLAG_DATAOFFSET] & type) != 0;
        }
        _setRTSyncFlag(type, value) {
            let flag = this._nativeUInt32Buffer[RTTransform3D.TRANSFORM_RT_SYNC_FLAG_DATAOFFSET];
            if (value)
                flag |= type;
            else
                flag &= ~type;
            this._nativeUInt32Buffer[RTTransform3D.TRANSFORM_RT_SYNC_FLAG_DATAOFFSET] = flag;
        }
        get localPositionX() {
            return this.localPosition.x;
        }
        set localPositionX(x) {
            let localPos = this.localPosition;
            localPos.x = x;
            this.localPosition = localPos;
        }
        get localPositionY() {
            return this.localPosition.y;
        }
        set localPositionY(y) {
            let localPos = this.localPosition;
            localPos.y = y;
            this.localPosition = localPos;
        }
        get localPositionZ() {
            return this.localPosition.z;
        }
        set localPositionZ(z) {
            let localPos = this.localPosition;
            localPos.z = z;
            this.localPosition = localPos;
        }
        get localPosition() {
            if (this._getTransformFlag(Laya.Transform3D.TRANSFORM_LOCALPOS)) {
                this._nativeObj.getLocalPosition();
            }
            if (this._getRTSyncFlag(Laya.Transform3D.TRANSFORM_LOCALPOS)) {
                let index = RTTransform3D.TRANSFORM_LOCALPOS_DATAOFFSET;
                this._localPosition.setValue(this._nativeFloat32Buffer[index], this._nativeFloat32Buffer[index + 1], this._nativeFloat32Buffer[index + 2]);
                this._setRTSyncFlag(Laya.Transform3D.TRANSFORM_LOCALPOS, false);
            }
            return this._localPosition;
        }
        set localPosition(value) {
            let index = RTTransform3D.TRANSFORM_LOCALPOS_DATAOFFSET;
            this._nativeFloat32Buffer[index] = value.x;
            this._nativeFloat32Buffer[index + 1] = value.y;
            this._nativeFloat32Buffer[index + 2] = value.z;
            this._nativeObj.setLocalPosition();
            this._onWorldPositionTransform();
        }
        get localRotation() {
            if (this._getTransformFlag(Laya.Transform3D.TRANSFORM_LOCALQUATERNION)) {
                this._nativeObj.getLocalRotation();
            }
            if (this._getRTSyncFlag(Laya.Transform3D.TRANSFORM_LOCALQUATERNION)) {
                let index = RTTransform3D.TRANSFORM_LOCALQUATERNION_DATAOFFSET;
                this._localRotation.setValue(this._nativeFloat32Buffer[index], this._nativeFloat32Buffer[index + 1], this._nativeFloat32Buffer[index + 2], this._nativeFloat32Buffer[index + 3]);
                this._setRTSyncFlag(Laya.Transform3D.TRANSFORM_LOCALQUATERNION, false);
            }
            return this._localRotation;
        }
        set localRotation(value) {
            value.normalize(this._localRotation);
            let index = RTTransform3D.TRANSFORM_LOCALQUATERNION_DATAOFFSET;
            this._nativeFloat32Buffer[index] = value.x;
            this._nativeFloat32Buffer[index + 1] = value.y;
            this._nativeFloat32Buffer[index + 2] = value.z;
            this._nativeFloat32Buffer[index + 3] = value.w;
            this._nativeObj.setLocalRotation();
            this._onWorldRotationTransform();
        }
        get localScaleX() {
            return this.localScale.x;
        }
        set localScaleX(value) {
            let scale = this.localScale;
            scale.x = value;
            this.localScale = scale;
        }
        get localScaleY() {
            return this.localScale.y;
        }
        set localScaleY(value) {
            let scale = this.localScale;
            scale.y = value;
            this.localScale = scale;
        }
        get localScaleZ() {
            return this.localScale.z;
        }
        set localScaleZ(value) {
            let scale = this.localScale;
            scale.z = value;
            this.localScale = scale;
        }
        get localScale() {
            if (this._getTransformFlag(Laya.Transform3D.TRANSFORM_LOCALPOS)) {
                this._nativeObj.getLocalScale();
            }
            if (this._getRTSyncFlag(Laya.Transform3D.TRANSFORM_LOCALSCALE)) {
                let index = RTTransform3D.TRANSFORM_LOCALSCALE_DATAOFFSET;
                this._localScale.setValue(this._nativeFloat32Buffer[index], this._nativeFloat32Buffer[index + 1], this._nativeFloat32Buffer[index + 2]);
                this._setRTSyncFlag(Laya.Transform3D.TRANSFORM_LOCALSCALE, false);
            }
            return this._localScale;
        }
        set localScale(value) {
            let index = RTTransform3D.TRANSFORM_LOCALSCALE_DATAOFFSET;
            this._nativeFloat32Buffer[index] = value.x;
            this._nativeFloat32Buffer[index + 1] = value.y;
            this._nativeFloat32Buffer[index + 2] = value.z;
            this._nativeObj.setLocalScale();
            this._onWorldScaleTransform();
        }
        get localRotationEuler() {
            if (this._getTransformFlag(Laya.Transform3D.TRANSFORM_LOCALEULER)) {
                this._nativeObj.getLocalRotationEuler();
            }
            if (this._getRTSyncFlag(Laya.Transform3D.TRANSFORM_LOCALEULER)) {
                let index = RTTransform3D.TRANSFORM_LOCALEULER_DATAOFFSET;
                this._localRotationEuler.setValue(this._nativeFloat32Buffer[index], this._nativeFloat32Buffer[index + 1], this._nativeFloat32Buffer[index + 2]);
                this._setRTSyncFlag(Laya.Transform3D.TRANSFORM_LOCALEULER, false);
            }
            return this._localRotationEuler;
        }
        set localRotationEuler(value) {
            let index = RTTransform3D.TRANSFORM_LOCALEULER_DATAOFFSET;
            this._nativeFloat32Buffer[index] = value.x;
            this._nativeFloat32Buffer[index + 1] = value.y;
            this._nativeFloat32Buffer[index + 2] = value.z;
            this._nativeObj.setLocalRotationEuler();
            this._onWorldRotationTransform();
        }
        get localMatrix() {
            if (this._getTransformFlag(Laya.Transform3D.TRANSFORM_LOCALMATRIX)) {
                this._nativeObj.getLocalMatrix();
            }
            if (this._getRTSyncFlag(Laya.Transform3D.TRANSFORM_LOCALEULER)) {
                let index = RTTransform3D.TRANSFORM_LOCALMATRIX_DATAOFFSET;
                for (var i = 0; i < 16; ++i) {
                    this._localMatrix.elements[i] = this._nativeFloat32Buffer[i + index];
                }
                this._setRTSyncFlag(Laya.Transform3D.TRANSFORM_LOCALEULER, false);
            }
            return this._localMatrix;
        }
        set localMatrix(value) {
            let index = RTTransform3D.TRANSFORM_LOCALMATRIX_DATAOFFSET;
            this._nativeFloat32Buffer.set(value.elements, index);
            this._nativeObj.setLocalMatrix();
            this._isDefaultMatrix = value.isIdentity();
            this._onWorldTransform();
        }
        get position() {
            if (this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDPOSITION)) {
                this._nativeObj.getPosition();
            }
            if (this._getRTSyncFlag(Laya.Transform3D.TRANSFORM_WORLDPOSITION)) {
                let index = RTTransform3D.TRANSFORM_WORLDPOS_DATAOFFSET;
                this._position.setValue(this._nativeFloat32Buffer[index], this._nativeFloat32Buffer[index + 1], this._nativeFloat32Buffer[index + 2]);
                this._setRTSyncFlag(Laya.Transform3D.TRANSFORM_WORLDPOSITION, false);
            }
            return this._position;
        }
        set position(value) {
            let index = RTTransform3D.TRANSFORM_WORLDPOS_DATAOFFSET;
            this._nativeFloat32Buffer[index] = value.x;
            this._nativeFloat32Buffer[index + 1] = value.y;
            this._nativeFloat32Buffer[index + 2] = value.z;
            this._nativeObj.setPosition();
            this._onWorldPositionTransform();
        }
        get rotation() {
            if (this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDQUATERNION)) {
                this._nativeObj.getRotation();
            }
            if (this._getRTSyncFlag(Laya.Transform3D.TRANSFORM_WORLDQUATERNION)) {
                let index = RTTransform3D.TRANSFORM_WORLDQUATERNION_DATAOFFSET;
                this._rotation.setValue(this._nativeFloat32Buffer[index], this._nativeFloat32Buffer[index + 1], this._nativeFloat32Buffer[index + 2], this._nativeFloat32Buffer[index + 3]);
                this._setRTSyncFlag(Laya.Transform3D.TRANSFORM_WORLDQUATERNION, false);
            }
            return this._rotation;
        }
        set rotation(value) {
            let index = RTTransform3D.TRANSFORM_WORLDQUATERNION_DATAOFFSET;
            this._nativeFloat32Buffer[index] = value.x;
            this._nativeFloat32Buffer[index + 1] = value.y;
            this._nativeFloat32Buffer[index + 2] = value.z;
            this._nativeFloat32Buffer[index + 3] = value.w;
            this._nativeObj.setRotation();
            this._onWorldRotationTransform();
        }
        get rotationEuler() {
            if (this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDEULER)) {
                this._nativeObj.getRotationEuler();
            }
            if (this._getRTSyncFlag(Laya.Transform3D.TRANSFORM_WORLDEULER)) {
                let index = RTTransform3D.TRANSFORM_WORLDEULER_DATAOFFSET;
                this._rotationEuler.setValue(this._nativeFloat32Buffer[index], this._nativeFloat32Buffer[index + 1], this._nativeFloat32Buffer[index + 2]);
                this._setRTSyncFlag(Laya.Transform3D.TRANSFORM_WORLDEULER, false);
            }
            return this._rotationEuler;
        }
        set rotationEuler(value) {
            let index = RTTransform3D.TRANSFORM_WORLDEULER_DATAOFFSET;
            this._nativeFloat32Buffer[index] = value.x;
            this._nativeFloat32Buffer[index + 1] = value.y;
            this._nativeFloat32Buffer[index + 2] = value.z;
            this._nativeObj.setRotationEuler();
            this._onWorldRotationTransform();
        }
        get worldMatrix() {
            if (this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX)) {
                this._nativeObj.getWorldMatrix();
            }
            if (this._getRTSyncFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX)) {
                let index = RTTransform3D.TRANSFORM_WORLDMATRIX_DATAOFFSET;
                for (var i = 0; i < 16; ++i) {
                    this._worldMatrix.elements[i] = this._nativeFloat32Buffer[i + index];
                }
                this._setRTSyncFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX, false);
            }
            return this._worldMatrix;
        }
        set worldMatrix(value) {
            let index = RTTransform3D.TRANSFORM_WORLDMATRIX_DATAOFFSET;
            this._nativeFloat32Buffer.set(value.elements, index);
            this._nativeObj.setWorldMatrix();
            this._onWorldTransform();
        }
        _setParent(value) {
            super._setParent(value);
            this._nativeObj.setParent(value ? value._nativeObj : null);
        }
        _onWorldPositionRotationTransform() {
            if (!this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDPOSITION) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDQUATERNION) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDEULER)) {
                this._setTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX | Laya.Transform3D.TRANSFORM_WORLDPOSITION | Laya.Transform3D.TRANSFORM_WORLDQUATERNION | Laya.Transform3D.TRANSFORM_WORLDEULER, true);
                this._notifyTransformChanged();
            }
            for (var i = 0, n = this._children.length; i < n; i++)
                this._children[i]._onWorldPositionRotationTransform();
        }
        _onWorldPositionScaleTransform() {
            if (!this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDPOSITION) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDSCALE)) {
                this._setTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX | Laya.Transform3D.TRANSFORM_WORLDPOSITION | Laya.Transform3D.TRANSFORM_WORLDSCALE, true);
                this._notifyTransformChanged();
            }
            for (var i = 0, n = this._children.length; i < n; i++)
                this._children[i]._onWorldPositionScaleTransform();
        }
        _onWorldPositionTransform() {
            if (!this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDPOSITION)) {
                this._setTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX | Laya.Transform3D.TRANSFORM_WORLDPOSITION, true);
                this._notifyTransformChanged();
            }
            if (Laya.Transform3D._inAnimatorBatch) {
                if (this._lastAnimatorFrame === Laya.Transform3D._currentAnimatorFrame)
                    return;
                this._lastAnimatorFrame = Laya.Transform3D._currentAnimatorFrame;
                for (var i = 0, n = this._children.length; i < n; i++)
                    this._children[i]._onWorldTransform();
                return;
            }
            for (var j = 0, m = this._children.length; j < m; j++)
                this._children[j]._onWorldPositionTransform();
        }
        _onWorldRotationTransform() {
            if (!this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDQUATERNION) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDEULER)) {
                this._setTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX | Laya.Transform3D.TRANSFORM_WORLDQUATERNION | Laya.Transform3D.TRANSFORM_WORLDEULER, true);
                this._notifyTransformChanged();
            }
            if (Laya.Transform3D._inAnimatorBatch) {
                if (this._lastAnimatorFrame === Laya.Transform3D._currentAnimatorFrame)
                    return;
                this._lastAnimatorFrame = Laya.Transform3D._currentAnimatorFrame;
                for (var i = 0, n = this._children.length; i < n; i++)
                    this._children[i]._onWorldTransform();
                return;
            }
            for (var j = 0, m = this._children.length; j < m; j++)
                this._children[j]._onWorldPositionRotationTransform();
        }
        _onWorldScaleTransform() {
            if (!this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDSCALE)) {
                this._setTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX | Laya.Transform3D.TRANSFORM_WORLDSCALE, true);
                this._notifyTransformChanged();
            }
            if (Laya.Transform3D._inAnimatorBatch) {
                if (this._lastAnimatorFrame === Laya.Transform3D._currentAnimatorFrame)
                    return;
                this._lastAnimatorFrame = Laya.Transform3D._currentAnimatorFrame;
                for (var i = 0, n = this._children.length; i < n; i++)
                    this._children[i]._onWorldTransform();
                return;
            }
            for (var j = 0, m = this._children.length; j < m; j++)
                this._children[j]._onWorldPositionScaleTransform();
        }
        _onWorldTransform() {
            if (!this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDPOSITION) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDQUATERNION) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDEULER) || !this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDSCALE)) {
                this._setTransformFlag(Laya.Transform3D.TRANSFORM_WORLDMATRIX | Laya.Transform3D.TRANSFORM_WORLDPOSITION | Laya.Transform3D.TRANSFORM_WORLDQUATERNION | Laya.Transform3D.TRANSFORM_WORLDEULER | Laya.Transform3D.TRANSFORM_WORLDSCALE, true);
                this._notifyTransformChanged();
            }
            if (Laya.Transform3D._inAnimatorBatch) {
                if (this._lastAnimatorFrame === Laya.Transform3D._currentAnimatorFrame)
                    return;
                this._lastAnimatorFrame = Laya.Transform3D._currentAnimatorFrame;
            }
            for (var i = 0, n = this._children.length; i < n; i++)
                this._children[i]._onWorldTransform();
        }
        translate(translation, isLocal = true) {
            if (isLocal) {
                Laya.Matrix4x4.createFromQuaternion(this.localRotation, _tempMatrix0);
                Laya.Vector3.transformCoordinate(translation, _tempMatrix0, _tempVector30);
                Laya.Vector3.add(this.localPosition, _tempVector30, this._localPosition);
                this.localPosition = this._localPosition;
            }
            else {
                Laya.Vector3.add(this.position, translation, this._position);
                this.position = this._position;
            }
        }
        rotate(rotation, isLocal = true, isRadian = true) {
            var rot;
            if (isRadian) {
                rot = rotation;
            }
            else {
                Laya.Vector3.scale(rotation, Math.PI / 180.0, _tempVector30);
                rot = _tempVector30;
            }
            Laya.Quaternion.createFromYawPitchRoll(rot.y, rot.x, rot.z, _tempQuaternion0);
            if (isLocal) {
                Laya.Quaternion.multiply(this.localRotation, _tempQuaternion0, this._localRotation);
                this.localRotation = this._localRotation;
            }
            else {
                Laya.Quaternion.multiply(_tempQuaternion0, this.rotation, this._rotation);
                this.rotation = this._rotation;
            }
        }
        getWorldLossyScale() {
            if (this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDSCALE)) {
                this._nativeObj.getWorldLossyScale();
            }
            if (this._getRTSyncFlag(Laya.Transform3D.TRANSFORM_WORLDSCALE)) {
                let index = RTTransform3D.TRANSFORM_WORLDSCALE_DATAOFFSET;
                this._scale.set(this._nativeFloat32Buffer[index], this._nativeFloat32Buffer[index + 1], this._nativeFloat32Buffer[index + 2]);
                this._setRTSyncFlag(Laya.Transform3D.TRANSFORM_WORLDSCALE, false);
            }
            return this._scale;
        }
        setWorldLossyScale(value) {
            let index = RTTransform3D.TRANSFORM_WORLDSCALE_DATAOFFSET;
            this._nativeFloat32Buffer[index] = value.x;
            this._nativeFloat32Buffer[index + 1] = value.y;
            this._nativeFloat32Buffer[index + 2] = value.z;
            this._nativeObj.setWorldLossyScale();
        }
    }
    RTTransform3D.TRANSFORM_LOCALQUATERNION_DATAOFFSET = 0;
    RTTransform3D.TRANSFORM_LOCALEULER_DATAOFFSET = 4;
    RTTransform3D.TRANSFORM_LOCALPOS_DATAOFFSET = 7;
    RTTransform3D.TRANSFORM_LOCALSCALE_DATAOFFSET = 10;
    RTTransform3D.TRANSFORM_LOCALMATRIX_DATAOFFSET = 13;
    RTTransform3D.TRANSFORM_WORLDQUATERNION_DATAOFFSET = 29;
    RTTransform3D.TRANSFORM_WORLDEULER_DATAOFFSET = 33;
    RTTransform3D.TRANSFORM_WORLDPOS_DATAOFFSET = 36;
    RTTransform3D.TRANSFORM_WORLDSCALE_DATAOFFSET = 39;
    RTTransform3D.TRANSFORM_WORLDMATRIX_DATAOFFSET = 42;
    RTTransform3D.TRANSFORM_CHANGEFLAG_DATAOFFSET = 58;
    RTTransform3D.TRANSFORM_RT_SYNC_FLAG_DATAOFFSET = 59;
    RTTransform3D.TRANSFORM_SHARE_MEMORY_SIZE = 60;
    const _tempVector30 = new Laya.Vector3();
    const _tempQuaternion0 = new Laya.Quaternion();
    const _tempMatrix0 = new Laya.Matrix4x4();

    class RTBaseRenderNode {
        get renderOrder() {
            return this._f64[30 / 2];
        }
        set renderOrder(value) {
            this._f64[30 / 2] = value;
        }
        get transform() {
            return this._transform;
        }
        set transform(value) {
            this._nativeObj.setTransform(value ? value._nativeObj : null);
            this._transform = value;
        }
        get distanceForSort() {
            return this._f32[0];
        }
        set distanceForSort(value) {
            this._f32[0] = value;
        }
        get sortingFudge() {
            return this._f32[1];
        }
        set sortingFudge(value) {
            this._f32[1] = value;
        }
        get castShadow() {
            return this._i32[2] !== 0;
        }
        set castShadow(value) {
            this._i32[2] = value ? 1 : 0;
        }
        get enable() {
            return this._i32[4] !== 0;
        }
        set enable(value) {
            this._i32[4] = value ? 1 : 0;
        }
        get renderbitFlag() {
            return this._u32[5];
        }
        set renderbitFlag(value) {
            this._u32[5] = value;
        }
        get layer() {
            return this._u32[9];
        }
        set layer(value) {
            this._u32[9] = value;
        }
        get bounds() {
            if (this.boundsChange) {
                this._nativeObj._calculateBoundingBox();
                this.boundsChange = false;
            }
            return this._bounds;
        }
        set bounds(value) {
            this._bounds = value;
            this._nativeObj._bounds = value._imp._nativeObj;
        }
        get baseGeometryBounds() {
            return this._baseGeometryBounds;
        }
        set baseGeometryBounds(value) {
            this._baseGeometryBounds = value;
            this._nativeObj.setBaseGeometryBounds(value._imp._nativeObj);
        }
        get boundsChange() {
            return this._i32[17] !== 0;
        }
        set boundsChange(value) {
            this._i32[17] = value ? 1 : 0;
        }
        get customCull() {
            return this._i32[28] !== 0;
        }
        set customCull(value) {
            this._i32[28] = value ? 1 : 0;
        }
        get customCullResoult() {
            return this._i32[29] !== 0;
        }
        set customCullResoult(value) {
            this._i32[29] = value ? 1 : 0;
        }
        get staticMask() {
            return this._u32[11];
        }
        set staticMask(value) {
            this._u32[11] = value;
        }
        get shaderData() {
            return this._shaderData;
        }
        set shaderData(value) {
            this._shaderData = value;
            this._nativeObj.setShaderData(value._nativeObj);
        }
        get lightmapIndex() {
            return this._i32[12];
        }
        set lightmapIndex(value) {
            this._i32[12] = value;
        }
        get lightmap() {
            return this._lightmap;
        }
        set lightmap(value) {
            this._lightmap = value;
            this._nativeObj.setLightmap(value ? value._nativeObj : null);
        }
        get probeReflection() {
            return this._probeReflection;
        }
        set probeReflection(value) {
            this._probeReflection = value;
            this._nativeObj.setProbeReflection(value ? value._nativeObj : null);
        }
        get reflectionMode() {
            return this._u32[13];
        }
        set reflectionMode(value) {
            this._u32[13] = value;
        }
        get volumetricGI() {
            return this._volumetricGI;
        }
        set volumetricGI(value) {
            this._volumetricGI = value;
            this._nativeObj.setVolumetricGI(value ? value._nativeObj : null);
        }
        get lightProbUpdateMark() {
            return this._i32[14];
        }
        set lightProbUpdateMark(value) {
            this._i32[14] = value;
        }
        get irradientMode() {
            return this._irradientMode;
        }
        set irradientMode(value) {
            this._irradientMode = value;
            this._u32[15] = value;
        }
        isRenderUpdatePreCall(call, fun) {
            return this._renderUpdatePreCaller === call && this._renderUpdatePreFunction === fun;
        }
        set_renderUpdatePreCall(call, fun) {
            this._renderUpdatePrebindFun = fun.bind(call, Laya.RenderContext3D._instance._contextOBJ);
            this._nativeObj.setRenderUpdatePre(this._renderUpdatePrebindFun);
            this._renderUpdatePreCaller = call;
            this._renderUpdatePreFunction = fun;
        }
        set_caculateBoundingBox(call, fun) {
            this._caculateBoundingBoxbindFun = fun.bind(call);
            this._nativeObj.setCalculateBoundingBox(this._caculateBoundingBoxbindFun);
        }
        _getNativeObj() {
            this._nativeObj = new window.conchRTBaseRenderNode();
        }
        get additionShaderData() {
            return this._additionShaderData;
        }
        set additionShaderData(value) {
            this._additionShaderData = value;
            this._nativeObj.clearAdditionalMap();
            for (let [key, value] of this._additionShaderData) {
                this._nativeObj.addOneAddiionalData(key, value._nativeObj);
            }
        }
        get perCameraUpdate() {
            return this._i32[16] !== 0;
        }
        set perCameraUpdate(value) {
            this._i32[16] = value ? 1 : 0;
        }
        constructor() {
            this._additionShaderData = new Map();
            this._ismoved = new Laya.Vector2();
            this._worldParams = new Laya.Vector4();
            this._getNativeObj();
            this._initPropertyBuffer();
            this._defaultBaseGeometryBounds = new Laya.Bounds();
            this.baseGeometryBounds = this._defaultBaseGeometryBounds;
            this.renderelements = [];
        }
        _initPropertyBuffer() {
            this._mem = new Laya.NativeMemory(32 * 4, false);
            this._f32 = this._mem.float32Array;
            this._f64 = new Float64Array(this._mem._buffer);
            this._i32 = this._mem.int32Array;
            this._u32 = this._mem.Uint32Array;
            this._nativeObj.bindPropertyBuffer(this._mem._buffer);
            this._i32[12] = -1;
            this._i32[14] = -1;
            this._f32[24] = 1;
        }
        get visibalRangeBit() {
            return this._u32[6];
        }
        set visibalRangeBit(value) {
            this._u32[6] = value;
        }
        get visibalMin() {
            return this._f32[7];
        }
        set visibalMin(value) {
            this._f32[7] = value;
        }
        get visibalMax() {
            return this._f32[8];
        }
        set visibalMax(value) {
            this._f32[8] = value;
        }
        get ismoved() {
            return this._ismoved;
        }
        set ismoved(value) {
            this._ismoved.setValue(value.x, value.y);
            this._f32[18] = value.x;
            this._f32[19] = value.y;
        }
        setNodeCustomData(dataSlot, data) {
            switch (dataSlot) {
                case 0:
                    this._worldParams.y = data;
                    break;
                case 1:
                    this._worldParams.z = data;
                    break;
                case 2:
                    this._worldParams.w = data;
                    break;
            }
            this._f32[20] = this._worldParams.x;
            this._f32[21] = this._worldParams.y;
            this._f32[22] = this._worldParams.z;
            this._f32[23] = this._worldParams.w;
        }
        get renderNodeType() {
            return this._u32[10];
        }
        set renderNodeType(value) {
            this._u32[10] = value;
        }
        get receiveShadow() {
            return this._i32[3] !== 0;
        }
        set receiveShadow(value) {
            this._i32[3] = value ? 1 : 0;
        }
        _applyLightProb() {
            this._nativeObj._applyLightProb();
        }
        _applyReflection() {
            this._nativeObj._applyReflection();
        }
        setRenderelements(value, deferUntilSubmit = false) {
            const batch = Laya.GLESGeometryUpdateBatch.active;
            if (!deferUntilSubmit)
                batch === null || batch === void 0 ? void 0 : batch.flush();
            this.renderelements.length = 0;
            for (var i = 0; i < value.length; i++) {
                this.renderelements.push(value[i]);
                value[i].owner = this;
                value[i].sortIndex = i;
            }
            if (deferUntilSubmit && (batch === null || batch === void 0 ? void 0 : batch.bindRenderElements(this._nativeObj, this.renderelements)))
                return;
            const tempArray = this.renderelements.map(element => element._nativeObj);
            this._nativeObj.setRenderElements(tempArray);
        }
        setLightmapScaleOffset(value) {
            this._f32[24] = value.x;
            this._f32[25] = value.y;
            this._f32[26] = value.z;
            this._f32[27] = value.w;
        }
        setCommonUniformMap(value) {
            this._nativeObj.setCommonUniformMap(value);
        }
        setOneMaterial(index, mat) {
            if (!this.renderelements[index])
                return;
            this.renderelements[index].materialShaderData = mat.shaderData;
            this.renderelements[index].materialRenderQueue = mat.renderQueue;
            this.renderelements[index].subShader = mat.shader.getSubShaderAt(0);
        }
        destroy() {
            var _a;
            (_a = Laya.GLESGeometryUpdateBatch.active) === null || _a === void 0 ? void 0 : _a.flush();
            this._nativeObj.destroy();
            for (let i = 0, n = this.renderelements.length; i < n; i++) {
                this.renderelements[i].destroy();
            }
            this.renderelements.length = 0;
            this._baseGeometryBounds = null;
            this.transform = null;
            this._shaderData && this._shaderData.destroy();
        }
    }

    class RTDirectLight {
        get shadowNearPlane() {
            return this._f32[0];
        }
        set shadowNearPlane(value) {
            this._f32[0] = value;
        }
        get shadowCascadesMode() {
            return this._i32[1];
        }
        set shadowCascadesMode(value) {
            this._i32[1] = value;
        }
        get transform() {
            return this._transform;
        }
        set transform(value) {
            this._transform = value;
            this._nativeObj.setTransform(value._nativeObj);
        }
        get shadowResolution() {
            return this._i32[2];
        }
        set shadowResolution(value) {
            this._i32[2] = value;
        }
        get shadowDistance() {
            return this._f32[3];
        }
        set shadowDistance(value) {
            this._f32[3] = value;
        }
        get shadowMode() {
            return this._i32[4];
        }
        set shadowMode(value) {
            this._i32[4] = value;
        }
        get shadowStrength() {
            return this._f32[5];
        }
        set shadowStrength(value) {
            this._f32[5] = value;
        }
        get shadowDepthBias() {
            return this._f32[6];
        }
        set shadowDepthBias(value) {
            this._f32[6] = value;
        }
        get shadowNormalBias() {
            return this._f32[7];
        }
        set shadowNormalBias(value) {
            this._f32[7] = value;
        }
        get shadowTwoCascadeSplits() {
            return this._f32[8];
        }
        set shadowTwoCascadeSplits(value) {
            this._f32[8] = value;
        }
        setShadowFourCascadeSplits(value) {
            if (!value)
                return;
            this._f32[9] = value.x;
            this._f32[10] = value.y;
            this._f32[11] = value.z;
        }
        setDirection(value) {
            value && this._nativeObj.setDirection(value);
        }
        constructor() {
            this._nativeObj = new window.conchRTDirectLight();
            this._mem = new Laya.NativeMemory(12 * 4, false);
            this._f32 = this._mem.float32Array;
            this._i32 = this._mem.int32Array;
            this._nativeObj.bindPropertyBuffer(this._mem._buffer);
        }
    }

    class RTLightmapData {
        constructor() {
            this._nativeObj = new window.conchRTLightmapData();
        }
        get lightmapColor() {
            return this._lightmapColor;
        }
        set lightmapColor(value) {
            this._lightmapColor = value;
            this._nativeObj.setLightmapColor(value._nativeObj);
        }
        get lightmapDirection() {
            return this._lightmapDirection;
        }
        set lightmapDirection(value) {
            this._lightmapDirection = value;
            this._nativeObj.setLightmapDirection(value._nativeObj);
        }
        destroy() {
            this._nativeObj.destroy();
        }
    }

    class RTMeshRenderNode extends RTBaseRenderNode {
    }

    class RTPointLight {
        get transform() {
            return this._transform;
        }
        set transform(value) {
            this._transform = value;
            this._nativeObj.setTransform(value._nativeObj);
        }
        get range() {
            return this._f32[0];
        }
        set range(value) {
            this._f32[0] = value;
        }
        get shadowResolution() {
            return this._f32[1];
        }
        set shadowResolution(value) {
            this._f32[1] = value;
        }
        get shadowDistance() {
            return this._f32[2];
        }
        set shadowDistance(value) {
            this._f32[2] = value;
        }
        ;
        get shadowMode() {
            return this._i32[3];
        }
        set shadowMode(value) {
            this._i32[3] = value;
        }
        ;
        get shadowStrength() {
            return this._f32[4];
        }
        set shadowStrength(value) {
            this._f32[4] = value;
        }
        get shadowDepthBias() {
            return this._f32[5];
        }
        set shadowDepthBias(value) {
            this._f32[5] = value;
        }
        get shadowNormalBias() {
            return this._f32[6];
        }
        set shadowNormalBias(value) {
            this._f32[6] = value;
        }
        get shadowNearPlane() {
            return this._f32[7];
        }
        set shadowNearPlane(value) {
            this._f32[7] = value;
        }
        constructor() {
            this._nativeObj = new window.conchRTPointLight();
            this._mem = new Laya.NativeMemory(8 * 4, false);
            this._f32 = this._mem.float32Array;
            this._i32 = this._mem.int32Array;
            this._nativeObj.bindPropertyBuffer(this._mem._buffer);
        }
    }

    class RTReflectionProb {
        get boxProjection() {
            return this._i32[0] !== 0;
        }
        set boxProjection(value) {
            this._i32[0] = value ? 1 : 0;
        }
        get bound() {
            return this._bound;
        }
        set bound(value) {
            this._bound = value;
            this._nativeObj.setBounds(value._imp._nativeObj);
        }
        get ambientMode() {
            return this._i32[1];
        }
        set ambientMode(value) {
            this._i32[1] = value;
        }
        get ambientIntensity() {
            return this._f32[2];
        }
        set ambientIntensity(value) {
            this._f32[2] = value;
        }
        get reflectionIntensity() {
            return this._f32[3];
        }
        set reflectionIntensity(value) {
            this._f32[3] = value;
        }
        get reflectionTexture() {
            return this._reflectionTexture;
        }
        set reflectionTexture(value) {
            this._reflectionTexture = value;
            if (!value) {
                this._nativeObj.setReflectionTexture(null);
                return;
            }
            this._nativeObj.setReflectionTexture(value._nativeObj);
        }
        get iblTex() {
            return this._iblTex;
        }
        set iblTex(value) {
            this._iblTex = value;
            if (!value) {
                this._nativeObj.setIblTex(null);
                return;
            }
            this._nativeObj.setIblTex(value._nativeObj);
        }
        get updateMark() {
            return this._u32[4];
        }
        set updateMark(value) {
            this._u32[4] = value;
        }
        get iblTexRGBD() {
            return this._i32[5] !== 0;
        }
        set iblTexRGBD(value) {
            this._i32[5] = value ? 1 : 0;
        }
        setProbePosition(value) {
            if (!value)
                return;
            this._f32[6] = value.x;
            this._f32[7] = value.y;
            this._f32[8] = value.z;
        }
        setAmbientColor(value) {
            if (!value)
                return;
            this._f32[9] = value.r;
            this._f32[10] = value.g;
            this._f32[11] = value.b;
            this._f32[12] = value.a;
        }
        setAmbientSH(value) {
            this._ambientSH = value;
            this._nativeObj.setAmbientSH(value);
        }
        constructor() {
            this._id = ++RTReflectionProb._idCounter;
            this._nativeObj = new window.conchRTReflectionProb();
            this._mem = new Laya.NativeMemory(13 * 4, false);
            this._f32 = this._mem.float32Array;
            this._i32 = this._mem.int32Array;
            this._u32 = this._mem.Uint32Array;
            this._nativeObj.bindPropertyBuffer(this._mem._buffer);
            this.shaderData = Laya.LayaGL.renderDeviceFactory.createShaderData();
        }
        get shaderData() {
            return this._shaderData;
        }
        set shaderData(value) {
            this._shaderData = value;
            this._nativeObj.setShaderData(value ? this._shaderData._nativeObj : null);
        }
        destroy() {
            this._nativeObj.destroy();
            this.shaderData.destroy();
            this.shaderData = null;
        }
    }
    RTReflectionProb._idCounter = 0;

    class RTSimpleSkinRenderNode extends RTBaseRenderNode {
        setSimpleAnimatorParams(value) {
            this._float32Array[0] = value.x;
            this._float32Array[1] = value.y;
            this._float32Array[2] = value.z;
            this._float32Array[3] = value.w;
            this._nativeObj.setSimpleAnimatorParamsByBuffer();
        }
        _getNativeObj() {
            this._nativeObj = new window.conchRTSimpleSkinRenderNode();
            this._nativeMemory = new Laya.NativeMemory(4 * 4, true);
            this._nativeObj.setShareBuffer(this._nativeMemory._buffer);
            this._float32Array = this._nativeMemory.float32Array;
        }
        constructor() {
            super();
        }
    }

    class RTSkinRenderNode extends RTBaseRenderNode {
        _getNativeObj() {
            this._nativeObj = new window.conchRTSkinRenderNode();
        }
        constructor() {
            super();
            this.boneNums = 0;
        }
        computeSkinnedData() {
            (this.boneNums != 0) && this._nativeObj.computeSkinnedData(Laya.Stat.loopCount);
        }
        setRootBoneTransfom(value) {
            this._nativeObj.setRootBoneTransfom(value.transform._nativeObj);
        }
        setOwnerTransform(value) {
            this._nativeObj.setOwnerTransform(value.transform._nativeObj);
        }
        setCacheMesh(cacheMesh) {
            this._nativeObj.resizeCacheMeshInverseBindPoes(cacheMesh._inverseBindPoses.length);
            for (var i = 0, n = cacheMesh._inverseBindPoses.length; i < n; i++) {
                this._nativeObj.setinverseBindPoseDataByIndex(i, cacheMesh._inverseBindPoses[i]);
            }
            this._nativeObj.resizeMatrixCache(cacheMesh._skinnedMatrixCaches.length);
            for (var i = 0, n = cacheMesh._skinnedMatrixCaches.length; i < n; i++) {
                let cache = cacheMesh._skinnedMatrixCaches[i];
                if (!cache)
                    continue;
                this._nativeObj.setMatrixCacheByIndex(i, cache.batchBoneIndex, cache.batchIndex, cache.subMeshIndex);
            }
            this._nativeObj.setSubMeshCount(cacheMesh.subMeshCount);
            this._nativeObj.resizeBoneIndicesList(cacheMesh.subMeshCount);
            for (var i = 0, n = cacheMesh.subMeshCount; i < n; i++) {
                this._nativeObj.setBoneIndicesList(i, cacheMesh.getSubMesh(i)._boneIndicesList);
            }
        }
        setBones(value) {
            this._nativeObj.clearBoneTransform();
            for (var i = 0, n = value.length; i < n; i++) {
                if (value[i]) {
                    this._nativeObj.addBoneTransform(value[i].transform._nativeObj);
                    this.boneNums++;
                }
            }
        }
        setSkinnedData(value) {
            this._nativeObj.resizeSkinnedData(value.length);
            for (var i = 0, n = value.length; i < n; i++) {
                this._nativeObj.setSkinnedDataByIndex(i, value[i]);
            }
        }
    }

    class RTSpotLight {
        get transform() {
            return this._transform;
        }
        set transform(value) {
            this._nativeObj.setTransform(value._nativeObj);
            this._transform = value;
        }
        get shadowResolution() {
            return this._f32[0];
        }
        set shadowResolution(value) {
            this._f32[0] = value;
        }
        get shadowDistance() {
            return this._f32[1];
        }
        set shadowDistance(value) {
            this._f32[1] = value;
        }
        get shadowMode() {
            return this._i32[2];
        }
        set shadowMode(value) {
            this._i32[2] = value;
        }
        get shadowStrength() {
            return this._f32[3];
        }
        set shadowStrength(value) {
            this._f32[3] = value;
        }
        get shadowDepthBias() {
            return this._f32[4];
        }
        set shadowDepthBias(value) {
            this._f32[4] = value;
        }
        get shadowNormalBias() {
            return this._f32[5];
        }
        set shadowNormalBias(value) {
            this._f32[5] = value;
        }
        get shadowNearPlane() {
            return this._f32[6];
        }
        set shadowNearPlane(value) {
            this._f32[6] = value;
        }
        get spotRange() {
            return this._f32[7];
        }
        set spotRange(value) {
            this._f32[7] = value;
        }
        get spotAngle() {
            return this._f32[8];
        }
        set spotAngle(value) {
            this._f32[8] = value;
        }
        constructor() {
            this._nativeObj = new window.conchRTSpotLight();
            this._mem = new Laya.NativeMemory(9 * 4, false);
            this._f32 = this._mem.float32Array;
            this._i32 = this._mem.int32Array;
            this._nativeObj.bindPropertyBuffer(this._mem._buffer);
        }
        setDirection(value) {
            this._nativeObj.setDirection(value);
        }
    }

    class RTVolumetricGI {
        get irradiance() {
            return this._irradiance;
        }
        set irradiance(value) {
            this._irradiance = value;
            this._nativeObj.setIrradiance(value ? value._nativeObj : null);
        }
        get distance() {
            return this._distance;
        }
        set distance(value) {
            this._distance = value;
            this._nativeObj.setDistance(value ? value._nativeObj : null);
        }
        get bound() {
            return this._bound;
        }
        set bound(value) {
            this._bound = value;
            this._nativeObj.setBounds(value ? value._imp._nativeObj : null);
        }
        get intensity() {
            return this._f32[0];
        }
        set intensity(value) {
            this._f32[0] = value;
        }
        get updateMark() {
            return this._u32[1];
        }
        set updateMark(value) {
            this._u32[1] = value;
        }
        set shaderData(value) {
            this._shaderData = value;
            this._nativeObj.setShaderData(this._shaderData._nativeObj);
        }
        get shaderData() {
            return this._shaderData;
        }
        constructor() {
            this._id = ++RTVolumetricGI._idCounter;
            this._nativeObj = new window.conchRTVolumetricGI();
            this._mem = new Laya.NativeMemory(12 * 4, false);
            this._f32 = this._mem.float32Array;
            this._u32 = this._mem.Uint32Array;
            this._nativeObj.bindPropertyBuffer(this._mem._buffer);
            this.shaderData = Laya.LayaGL.renderDeviceFactory.createShaderData();
            this._defaultBounds = new Laya.Bounds();
            this.bound = this._defaultBounds;
        }
        setParams(value) {
            this._f32[8] = value.x;
            this._f32[9] = value.y;
            this._f32[10] = value.z;
            this._f32[11] = value.w;
        }
        setProbeCounts(value) {
            this._f32[2] = value.x;
            this._f32[3] = value.y;
            this._f32[4] = value.z;
        }
        setProbeStep(value) {
            this._f32[5] = value.x;
            this._f32[6] = value.y;
            this._f32[7] = value.z;
        }
        destroy() {
            this._nativeObj.destroy();
            this.distance = null;
            this.irradiance = null;
            this._shaderData.destroy();
            this._shaderData = null;
        }
    }
    RTVolumetricGI._idCounter = 0;

    class RT3DRenderModuleFactory {
        createTransform(owner) {
            return new RTTransform3D(owner);
        }
        createBounds(min, max) {
            return new NativeBounds(min, max);
        }
        setBoundsMinMaxBatch(targets, values, count) {
            return NativeBounds.setMinMaxBatch(targets, values, count);
        }
        createVolumetricGI() {
            return new RTVolumetricGI();
        }
        createReflectionProbe() {
            return new RTReflectionProb();
        }
        createLightmapData() {
            return new RTLightmapData();
        }
        createDirectLight() {
            return new RTDirectLight();
        }
        createSpotLight() {
            return new RTSpotLight();
        }
        createPointLight() {
            return new RTPointLight();
        }
        createCameraModuleData() {
            return new RTCameraNodeData();
        }
        createSceneModuleData() {
            return new RTSceneNodeData();
        }
        createBaseRenderNode() {
            return new RTBaseRenderNode();
        }
        createMeshRenderNode() {
            return new RTMeshRenderNode();
        }
        createSkinRenderNode() {
            return new RTSkinRenderNode();
        }
        createSimpleSkinRenderNode() {
            return new RTSimpleSkinRenderNode();
        }
    }
    Laya.Laya.addBeforeInitCallback(() => {
        if (!Laya.Laya3DRender.Render3DModuleDataFactory)
            Laya.Laya3DRender.Render3DModuleDataFactory = new RT3DRenderModuleFactory();
    });

    exports.LayaX3DRenderModuleFactory = LayaX3DRenderModuleFactory;
    exports.LayaX3DRenderPassFactory = LayaX3DRenderPassFactory;
    exports.LayaXBaseRenderNode = LayaXBaseRenderNode;
    exports.LayaXBaseSpotRP = LayaXBaseSpotRP;
    exports.LayaXBlitRenderFeature = LayaXBlitRenderFeature;
    exports.LayaXBounds = LayaXBounds;
    exports.LayaXCameraNodeData = LayaXCameraNodeData;
    exports.LayaXChunkPages = LayaXChunkPages;
    exports.LayaXDirCascadeShadowRP = LayaXDirCascadeShadowRP;
    exports.LayaXDirectLight = LayaXDirectLight;
    exports.LayaXForwardAddClusterRP = LayaXForwardAddClusterRP;
    exports.LayaXForwardAddRP = LayaXForwardAddRP;
    exports.LayaXLightmapData = LayaXLightmapData;
    exports.LayaXMeshRenderNode = LayaXMeshRenderNode;
    exports.LayaXPointLight = LayaXPointLight;
    exports.LayaXReflectionProbe = LayaXReflectionProbe;
    exports.LayaXRender3DProcess = LayaXRender3DProcess;
    exports.LayaXRenderContext3D = LayaXRenderContext3D;
    exports.LayaXRenderElement3D = LayaXRenderElement3D;
    exports.LayaXSceneNodeData = LayaXSceneNodeData;
    exports.LayaXSimpleSkinRenderNode = LayaXSimpleSkinRenderNode;
    exports.LayaXSkinRenderNode = LayaXSkinRenderNode;
    exports.LayaXSpotLight = LayaXSpotLight;
    exports.LayaXTransform3D = LayaXTransform3D;
    exports.LayaXVolumetricGI = LayaXVolumetricGI;
    exports.NativeBounds = NativeBounds;
    exports.RT3DRenderModuleFactory = RT3DRenderModuleFactory;
    exports.RTBaseRenderNode = RTBaseRenderNode;
    exports.RTBaseSpotRP = RTBaseSpotRP;
    exports.RTCameraNodeData = RTCameraNodeData;
    exports.RTDirCascadeShadowRP = RTDirCascadeShadowRP;
    exports.RTDirectLight = RTDirectLight;
    exports.RTForwardAddClusterRP = RTForwardAddClusterRP;
    exports.RTForwardAddRP = RTForwardAddRP;
    exports.RTLightmapData = RTLightmapData;
    exports.RTMeshRenderNode = RTMeshRenderNode;
    exports.RTPointLight = RTPointLight;
    exports.RTReflectionProb = RTReflectionProb;
    exports.RTRender3DProcess = RTRender3DProcess;
    exports.RTScene3DRenderManager = RTScene3DRenderManager;
    exports.RTSceneNodeData = RTSceneNodeData;
    exports.RTSimpleSkinRenderNode = RTSimpleSkinRenderNode;
    exports.RTSkinRenderNode = RTSkinRenderNode;
    exports.RTSpotLight = RTSpotLight;
    exports.RTTransform3D = RTTransform3D;
    exports.RTVolumetricGI = RTVolumetricGI;

})(window.Laya = window.Laya || {}, Laya);
//# sourceMappingURL=laya.modernAPIs_3D.js.map
