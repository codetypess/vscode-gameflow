(function (exports, Laya) {
    'use strict';

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

    class GLESDrawNodeCMDData extends Laya.DrawNodeCMDData {
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
        constructor() {
            super();
            this.type = Laya.RenderCMDType.DrawNode;
            this._nativeObj = new window.conchGLESDrawNodeCMDData();
        }
    }
    class GLESBlitQuadCMDData extends Laya.BlitQuadCMDData {
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
            value.cloneTo(this._viewport);
            this._f32[0] = value.x;
            this._f32[1] = value.y;
            this._f32[2] = value.width;
            this._f32[3] = value.height;
        }
        get scissor() {
            return this._scissor;
        }
        set scissor(value) {
            value.cloneTo(this._scissor);
            this._f32[4] = value.x;
            this._f32[5] = value.y;
            this._f32[6] = value.z;
            this._f32[7] = value.w;
        }
        get source() {
            return this._source;
        }
        set source(value) {
            this._source = value;
            this._nativeObj.setSource(value._nativeObj);
        }
        get offsetScale() {
            return this._offsetScale;
        }
        set offsetScale(value) {
            value.cloneTo(this._offsetScale);
            this._f32[8] = value.x;
            this._f32[9] = value.y;
            this._f32[10] = value.z;
            this._f32[11] = value.w;
        }
        get element() {
            return this._element;
        }
        set element(value) {
            this._element = value;
            this._nativeObj.setRenderElement(value._nativeObj);
        }
        constructor() {
            super();
            this.type = Laya.RenderCMDType.Blit;
            this._viewport = new Laya.Viewport();
            this._scissor = new Laya.Vector4();
            this._offsetScale = new Laya.Vector4();
            this._nativeObj = new window.conchGLESBlitQuadCMDData();
            this._mem = new Laya.NativeMemory(12 * 4, false);
            this._f32 = this._mem.float32Array;
            this._nativeObj.bindPropertyBuffer(this._mem._buffer);
        }
    }
    class GLESDrawElementCMDData extends Laya.DrawElementCMDData {
        constructor() {
            super();
            this.type = Laya.RenderCMDType.DrawElement;
            this._nativeObj = new window.conchGLESDrawElementCMDData();
        }
        setRenderelements(value) {
            this._elemets = value;
            this._nativeObj.clearElement();
            if (value.length == 1) {
                this._nativeObj.addOneElement(value[0]._nativeObj);
            }
            else {
                value.forEach(element => {
                    this._nativeObj.addOneElement(element._nativeObj);
                });
            }
        }
    }
    class GLESSetViewportCMD extends Laya.SetViewportCMD {
        get viewport() {
            return this._viewport;
        }
        set viewport(value) {
            this._viewport = value;
            this._nativeObj.setViewport(value);
        }
        get scissor() {
            return this._scissor;
        }
        set scissor(value) {
            this._scissor = value;
            this._nativeObj.setScissor(value);
        }
        constructor() {
            super();
            this.type = Laya.RenderCMDType.ChangeViewPort;
            this.scissor = new Laya.Vector4();
            this.viewport = new Laya.Viewport();
            this._nativeObj = new window.conchGLESSetViewportCMD();
        }
    }
    class GLESSetRenderTargetCMD extends Laya.SetRenderTargetCMD {
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
            value.cloneTo(this._clearColorValue);
            this._clearColorValues = null;
            this._nativeObj.clearColorValue(value);
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
        constructor() {
            super();
            this._clearColorRGBA = [];
            this._clearColorEnabled = [];
            this.type = Laya.RenderCMDType.ChangeRenderTarget;
            this._clearColorValue = new Laya.Color();
            this._nativeObj = new window.conchGLESSetRenderTargetCMD();
        }
    }

    class GLESRenderContext3D {
        get globalShaderData() {
            return this._globalShaderData;
        }
        set globalShaderData(value) {
            this._globalShaderData = value;
            this._nativeObj.setGlobalShaderData(value ? value._nativeObj : null);
        }
        get sceneData() {
            return this._sceneData;
        }
        set sceneData(value) {
            this._sceneData = value;
            this._nativeObj.setSceneData(value ? value._nativeObj : null);
        }
        get sceneModuleData() {
            return this._sceneModuleData;
        }
        set sceneModuleData(value) {
            this._sceneModuleData = value;
            this._nativeObj.setSceneNodeData(value ? value._nativeObj : null);
        }
        get cameraModuleData() {
            return this._cameraModuleData;
        }
        set cameraModuleData(value) {
            this._cameraModuleData = value;
            this._nativeObj.setCameraNodeData(value ? value._nativeObj : null);
        }
        get cameraData() {
            return this._cameraData;
        }
        set cameraData(value) {
            this._cameraData = value;
            this._nativeObj.setCameraData(value ? value._nativeObj : null);
        }
        get sceneUpdateMask() {
            return this._u32[1];
        }
        set sceneUpdateMask(value) {
            this._u32[1] = value;
        }
        get cameraUpdateMask() {
            return this._u32[0];
        }
        set cameraUpdateMask(value) {
            this._u32[0] = value;
        }
        get pipelineMode() {
            return this._nativeObj._pipelineMode;
        }
        set pipelineMode(value) {
            this._nativeObj._pipelineMode = value;
        }
        get invertY() {
            return this._i32[2] !== 0;
        }
        set invertY(value) {
            this._i32[2] = value ? 1 : 0;
        }
        constructor() {
            this._clearColorRGBA = [];
            this._clearColorEnabled = [];
            this._tempList = [];
            this._nativeObj = new window.conchGLESRenderContext3D();
            this._mem = new Laya.NativeMemory(3 * 4, false);
            this._i32 = this._mem.int32Array;
            this._u32 = this._mem.Uint32Array;
            this._nativeObj.bindPropertyBuffer(this._mem._buffer);
            this._nativeObj.setGlobalConfigShaderData(Laya.Shader3D._configDefineValues._nativeObj);
            this.cameraUpdateMask = 0;
        }
        setRenderTarget(value, clearFlag) {
            this._nativeObj.setRenderTarget(value ? value._nativeObj : null, clearFlag);
        }
        setViewPort(value) {
            this._nativeObj.setViewport(value);
        }
        setScissor(value) {
            this._nativeObj.setScissor(value);
        }
        setClearData(clearFlag, color, depth, stencil, colorValues) {
            var _a, _b, _c, _d;
            const result = this._nativeObj.setClearData(clearFlag, color, depth, stencil);
            if ((clearFlag & Laya.RenderClearFlag.Color) && colorValues) {
                const rgba = this._clearColorRGBA;
                const enabled = this._clearColorEnabled;
                rgba.length = colorValues.length * 4;
                enabled.length = colorValues.length;
                for (let i = 0; i < colorValues.length; i++) {
                    const value = colorValues[i];
                    enabled[i] = value ? 1 : 0;
                    rgba[i * 4] = (_a = value === null || value === void 0 ? void 0 : value.r) !== null && _a !== void 0 ? _a : 0;
                    rgba[i * 4 + 1] = (_b = value === null || value === void 0 ? void 0 : value.g) !== null && _b !== void 0 ? _b : 0;
                    rgba[i * 4 + 2] = (_c = value === null || value === void 0 ? void 0 : value.b) !== null && _c !== void 0 ? _c : 0;
                    rgba[i * 4 + 3] = (_d = value === null || value === void 0 ? void 0 : value.a) !== null && _d !== void 0 ? _d : 0;
                }
                this._nativeObj.setClearColorValues(rgba, enabled);
            }
            return result;
        }
        clearRenderTarget() {
            this._nativeObj.clearRenderTarget();
        }
        drawRenderElementList(list) {
            this._tempList.length = 0;
            let listelement = list.elements;
            listelement.forEach((element) => {
                this._tempList.push(element._nativeObj);
            });
            return this._nativeObj.drawRenderElementList(this._tempList, list.length);
        }
        drawRenderElementOne(node) {
            return this._nativeObj.drawRenderElementOne(node._nativeObj);
        }
        runOneCMD(cmd) {
            this._nativeObj.runOneCMD(cmd._nativeObj);
        }
        runCMDList(cmds) {
            let nativeobCMDs = [];
            cmds.forEach(element => {
                nativeobCMDs.push(element._nativeObj);
            });
            this._nativeObj.runCMDList(nativeobCMDs);
        }
    }

    exports.RenderElementType = void 0;
    (function (RenderElementType) {
        RenderElementType[RenderElementType["Base"] = 0] = "Base";
        RenderElementType[RenderElementType["Skin"] = 1] = "Skin";
        RenderElementType[RenderElementType["Instance"] = 2] = "Instance";
    })(exports.RenderElementType || (exports.RenderElementType = {}));
    class GLESRenderElement3D {
        set geometry(data) {
            this._geometry = data;
            this._nativeObj.setGeometry(data ? data._nativeObj : null);
        }
        get geometry() {
            return this._geometry;
        }
        set materialShaderData(data) {
            this._materialShaderData = data;
            this._nativeObj.setMaterialShaderData(data ? data._nativeObj : null);
        }
        get materialShaderData() {
            return this._materialShaderData;
        }
        set renderShaderData(data) {
            this._renderShaderData = data;
            this._nativeObj.setRenderShaderData(data ? data._nativeObj : null);
        }
        get renderShaderData() {
            return this._renderShaderData;
        }
        set transform(data) {
            this._transform = data;
            this._nativeObj.setTransform(data ? data._nativeObj : null);
        }
        get transform() {
            return this._transform;
        }
        get isRender() {
            return this._i32[0] !== 0;
        }
        set isRender(data) {
            this._i32[0] = data ? 1 : 0;
        }
        get materialRenderQueue() {
            return this._u32[2];
        }
        set materialRenderQueue(value) {
            this._u32[2] = value;
        }
        get owner() {
            return this._owner;
        }
        set owner(value) {
            if (this._owner === value)
                return;
            this._nativeObj.setOwner(value._nativeObj);
            this._owner = value;
        }
        get subShader() {
            return this._subShader;
        }
        set subShader(value) {
            this._subShader = value;
            if (value)
                this._nativeObj.setSubShader(value.moduleData._nativeObj);
        }
        get canDynamicBatch() {
            return this._i32[1] !== 0;
        }
        set canDynamicBatch(value) {
            this._i32[1] = value ? 1 : 0;
        }
        get materialId() {
            return this._u32[3];
        }
        set materialId(value) {
            this._u32[3] = value;
        }
        constructor() {
            this.sortIndex = 0;
            this.init();
            this._mem = new Laya.NativeMemory(4 * 4, false);
            this._i32 = this._mem.int32Array;
            this._u32 = this._mem.Uint32Array;
            this._nativeObj.bindPropertyBuffer(this._mem._buffer);
            window.conchGLESRenderElement3D.setCompileDefine(Laya.RTShaderPass.getGlobalCompileDefine()._nativeObj);
        }
        destroy() {
            var _a, _b;
            (_a = Laya.GLESGeometryUpdateBatch.active) === null || _a === void 0 ? void 0 : _a.flush();
            this._geometry = null;
            this._materialShaderData = null;
            this._renderShaderData = null;
            this._transform = null;
            (_b = this._nativeObj) === null || _b === void 0 ? void 0 : _b.destroy();
        }
        init() {
            this._nativeObj = new window.conchGLESRenderElement3D();
        }
    }

    class GLESSkinRenderElement3D extends GLESRenderElement3D {
        constructor() {
            super();
        }
        get skinnedData() {
            return this._skinnedData;
        }
        set skinnedData(data) {
            this._skinnedData = data;
            this._nativeObj.setSkinnedData(data);
        }
        init() {
            this._nativeObj = new window.conchGLESSkinRenderElement3D();
        }
    }

    class GLES3DRenderPassFactory {
        createMeshRenderBatchModule() {
            return new Laya.GLESMeshRenderBatchAgent();
        }
        createComputeCommandAppatchCMD() {
            throw new Laya.NotImplementedError;
        }
        createRender3DProcess() {
            let renderpass = new RTRender3DProcess();
            return renderpass;
        }
        createRenderContext3D() {
            return new GLESRenderContext3D();
        }
        createSetRenderDataCMD() {
            return new Laya.GLESSetRenderData();
        }
        createSetShaderDefineCMD() {
            return new Laya.GLESSetShaderDefine();
        }
        createDrawNodeCMDData() {
            return new GLESDrawNodeCMDData();
        }
        createBlitQuadCMDData() {
            return new GLESBlitQuadCMDData();
        }
        createDrawElementCMDData() {
            return new GLESDrawElementCMDData();
        }
        createSetViewportCMD() {
            return new GLESSetViewportCMD();
        }
        createSetRenderTargetCMD() {
            return new GLESSetRenderTargetCMD();
        }
        createSceneRenderManager() {
            return new RTScene3DRenderManager();
        }
        createSkinRenderElement() {
            return new GLESSkinRenderElement3D();
        }
        createRenderElement3D() {
            return new GLESRenderElement3D();
        }
    }
    Laya.Laya.addBeforeInitCallback(() => {
        if (!Laya.Laya3DRender.Render3DPassFactory)
            Laya.Laya3DRender.Render3DPassFactory = new GLES3DRenderPassFactory();
    });

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

    exports.GLES3DRenderPassFactory = GLES3DRenderPassFactory;
    exports.GLESBlitQuadCMDData = GLESBlitQuadCMDData;
    exports.GLESDrawElementCMDData = GLESDrawElementCMDData;
    exports.GLESDrawNodeCMDData = GLESDrawNodeCMDData;
    exports.GLESRenderContext3D = GLESRenderContext3D;
    exports.GLESRenderElement3D = GLESRenderElement3D;
    exports.GLESSetRenderTargetCMD = GLESSetRenderTargetCMD;
    exports.GLESSetViewportCMD = GLESSetViewportCMD;
    exports.GLESSkinRenderElement3D = GLESSkinRenderElement3D;
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
//# sourceMappingURL=laya.opengl_3D.js.map
