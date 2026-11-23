(function (exports, Laya) {
    'use strict';

    var spine3DVertex = "#if !defined(SpineVertex_lib)\n#define SpineVertex_lib\n#include \"SpineVertexCommon.glsl\";\nuniform mat4 u_WorldMat;uniform vec4 u_WorldInvertFront;struct Vertex{vec3 positionOS;vec3 normalOS;vec2 texCoord0;\n#ifdef UV1\nvec2 texCoord1;\n#endif\nvec4 vertexColor;\n#ifdef LIGHTMAP\nvec4 lightmapScaleOffset;\n#endif LIGHTMAP\n};\n#ifdef LIGHTMAP\n#ifndef GPU_INSTANCE\nuniform vec4 u_LightmapScaleOffset;\n#endif\nvec4 getLightmapScaleOffset(){\n#ifdef GPU_INSTANCE\nreturn a_LightmapScaleOffset;\n#else\nreturn u_LightmapScaleOffset;\n#endif\n}\n#endif\nvoid getVertexParams(inout Vertex vertex){vec4 spinePos2D=getSpinePos();vertex.positionOS=vec3(spinePos2D.xy,0.0);vertex.normalOS=vec3(0.0,0.0,1.0);vertex.vertexColor=vec4(1.0,1.0,1.0,1.0);vertex.vertexColor=a_color;vertex.vertexColor.rgb=pow(vertex.vertexColor.rgb,vec3(2.2));vertex.vertexColor.rgb*=a_color.a;vertex.texCoord0=a_uv;\n#ifdef LIGHTMAP\nvertex.lightmapScaleOffset=getLightmapScaleOffset();\n#endif LIGHTMAP\n}\n#endif\n";

    var spine3DVS = "#define SHADER_NAME Spine3DVS\n#include \"Math.glsl\";\n#include \"Scene.glsl\";\n#include \"SceneFogInput.glsl\";\n#include \"Camera.glsl\";\n#include \"Spine3DVertex.glsl\";\n#ifdef SPINE_BILLBOARD\nuniform mat4 u_spineBillboardMatrix;\n#endif\nvarying vec2 v_texcoord;varying vec4 v_color;varying vec4 v_color2;mat4 getWorldMatrix(){\n#ifdef SPINE_BILLBOARD\nreturn u_spineBillboardMatrix;\n#else\n#ifdef GPU_INSTANCE\nmat4 worldMat=a_WorldMat;\n#else\nmat4 worldMat=u_WorldMat;\n#endif\nreturn worldMat;\n#endif\n}void main(){Vertex vertex;getVertexParams(vertex);v_texcoord=vertex.texCoord0;v_color=vertex.vertexColor;\n#ifdef COLOR2\nv_color2=a_color2;v_color2.rgb=pow(v_color2.rgb,vec3(2.2));\n#else\nv_color2=vec4(0.0,0.0,0.0,1.0);\n#endif\n#ifdef PREMULTIPLYALPHA\nv_color2.xyz=v_color2.xyz*v_color.a;\n#endif\nmat4 worldMat=getWorldMatrix();vec4 pos=worldMat*vec4(vertex.positionOS,1.0);vec3 positionWS=pos.xyz/pos.w;gl_Position=getPositionCS(positionWS);gl_Position=remapPositionZ(gl_Position);\n#ifdef FOG\nFogHandle(gl_Position.z);\n#endif\n}";

    var spine3DFS = "#define SHADER_NAME Spine3DFS\n#include \"Color.glsl\";\n#include \"Scene.glsl\";\n#include \"SceneFog.glsl\";\n#include \"Camera.glsl\";\nvarying vec2 v_texcoord;varying vec4 v_color;varying vec4 v_color2;vec4 getColor(){vec4 color=texture2D(u_spineTexture,v_texcoord.xy);\n#ifdef Gamma_u_spineTexture\ncolor=gammaToLinear(color);\n#endif\nvec4 final;\n#ifdef TWOCOLORTINT\nfinal.a=color.a*v_color.a;final.xyz=((color.a-1.0)*v_color2.a+1.0-color.xyz)*v_color2.xyz+color.xyz*v_color.xyz;\n#else\nfinal=color*v_color;\n#endif\nreturn final;}void main(){gl_FragColor=getColor();gl_FragColor=outputTransform(gl_FragColor);\n#ifdef FOG\ngl_FragColor.rgb=sceneLitFog(gl_FragColor.rgb);\n#endif\n}";

    class Spine3DShaderInit {
        static init() {
            Laya.Shader3D.addInclude("Spine3DVertex.glsl", spine3DVertex);
            Spine3DShaderInit.SPINE_BILLBOARD = Laya.Shader3D.getDefineByName("SPINE_BILLBOARD");
            Spine3DShaderInit.SPINE_BILLBOARD_MATRIX = Laya.Shader3D.propertyNameToID("u_spineBillboardMatrix");
            const commandUniform3D = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap("Spine3D");
            commandUniform3D.addShaderUniformArray(Laya.SpineShaderInit.BONEMAT, "u_sBone", Laya.ShaderDataType.Vector4, 200);
            commandUniform3D.addShaderUniform(Laya.SpineShaderInit.COLOR, "u_color", Laya.ShaderDataType.Vector4);
            commandUniform3D.addShaderUniform(Laya.SpineShaderInit.BONEMAT_0, "u_sBone0", Laya.ShaderDataType.Vector4);
            commandUniform3D.addShaderUniform(Laya.SpineShaderInit.BONEMAT_1, "u_sBone1", Laya.ShaderDataType.Vector4);
            commandUniform3D.addShaderUniform(Laya.SpineShaderInit.SIMPLE_SIMPLEANIMATORPARAMS, "u_SimpleAnimatorParams", Laya.ShaderDataType.Vector4);
            commandUniform3D.addShaderUniform(Laya.SpineShaderInit.SIMPLE_SIMPLEANIMATORTEXTURE, "u_SimpleAnimatorTexture", Laya.ShaderDataType.Texture2D);
            commandUniform3D.addShaderUniform(Laya.SpineShaderInit.SIMPLE_SIMPLEANIMATORTEXTURESIZE, "u_SimpleAnimatorTextureSize", Laya.ShaderDataType.Float);
            commandUniform3D.addShaderUniform(Laya.SpineShaderInit.SPINE_RENDER_SIZE, "u_spineRenderSize", Laya.ShaderDataType.Vector2);
            commandUniform3D.addShaderUniform(Spine3DShaderInit.SPINE_BILLBOARD_MATRIX, "u_spineBillboardMatrix", Laya.ShaderDataType.Matrix4x4);
            let shader3D = Laya.Shader3D.add("Spine3D", true, false);
            shader3D.shaderType = Laya.ShaderFeatureType.D3;
            let uniformMap3D = {
                "u_spineTexture": Laya.ShaderDataType.Texture2D
            };
            let subShader3D = new Laya.SubShader(Laya.SpineShaderInit.textureSpineAttribute, uniformMap3D);
            shader3D.addSubShader(subShader3D);
            subShader3D.addShaderPass(spine3DVS, spine3DFS);
        }
    }

    class Spine3DRenderer extends Laya.BaseRender {
        get renderSize() {
            return this._renderSize;
        }
        set renderSize(value) {
            value.cloneTo(this._renderSize);
            this._baseRenderNode.shaderData.setVector2(Laya.SpineShaderInit.SPINE_RENDER_SIZE, this._renderSize);
        }
        get billboard() {
            return this._billboard;
        }
        set billboard(value) {
            if (this._billboard === value)
                return;
            this._billboard = value;
            if (this._billboard) {
                this._baseRenderNode.shaderData.addDefine(Spine3DShaderInit.SPINE_BILLBOARD);
            }
            else {
                this._baseRenderNode.shaderData.removeDefine(Spine3DShaderInit.SPINE_BILLBOARD);
            }
        }
        constructor() {
            super();
            this.physicsUpdate = 0;
            this._maxDeltaTime = 0.1;
            this._pause = true;
            this._needUpdate = false;
            this._playbackRate = 1.0;
            this.trackIndex = 0;
            this._skinName = "default";
            this._loop = true;
            this._playState = Laya.ESpineRenderState.Stopped;
            this._useFastRender = true;
            this._billboard = false;
            this._enableCache = false;
            this._renderSize = new Laya.Vector2(0, 0);
            this._billboardMatrix = new Laya.Matrix4x4();
            this._cacheMoved = new Laya.Vector2(-1, -1);
            this._worldParams = new Laya.Vector4();
            this._playAudio = false;
            this._skeletonPosition = new Laya.Vector2();
            this._lastSkeletonWorldPosition = new Laya.Vector3();
            this._hasSkeletonWorldPosition = false;
            this._geometryBounds = new Laya.Bounds();
            this._premultipliedAlpha = true;
            this._setPreAlphaFlag = false;
            this._baseRenderNode.baseGeometryBounds = this._geometryBounds;
        }
        _createBaseRenderNode() {
            return Laya.Laya3DRender.Render3DModuleDataFactory.createMeshRenderNode();
        }
        _isMaterialVaild(value) {
            return value.checkType(Laya.ShaderFeatureType.D3);
        }
        _getcommonUniformMap() {
            return ["Sprite3D", "Spine3D"];
        }
        get premultipliedAlpha() {
            return !this._templet || this._setPreAlphaFlag ? this._premultipliedAlpha : this._templet.premultipliedAlpha;
        }
        set premultipliedAlpha(value) {
            this._premultipliedAlpha = value;
            if (!this._spineRender)
                return;
            if (this._setPreAlphaFlag || !this._templet) {
                this._spineRender.premultipliedAlpha = value;
            }
            else {
                this._spineRender.premultipliedAlpha = this._templet._premultipliedAlpha;
            }
        }
        setPremultipliedAlpha(value) {
            this._premultipliedAlpha = value;
            this._spineRender.premultipliedAlpha = value;
            this._setPreAlphaFlag = true;
        }
        _renderUpdate(context3D) {
            let renderNode = this._baseRenderNode;
            renderNode._applyReflection();
            renderNode._applyLightProb();
            if (renderNode.ismoved.x > this._cacheMoved.x || (renderNode.ismoved.x == this._cacheMoved.x && renderNode.ismoved.y > this._cacheMoved.y)) {
                let trans = renderNode.transform;
                renderNode.shaderData.setMatrix4x4(Laya.Sprite3D.WORLDMATRIX, trans.worldMatrix);
                this._worldParams.x = trans.getFrontFaceValue();
                renderNode.shaderData.setVector(Laya.Sprite3D.WORLDINVERTFRONT, this._worldParams);
                renderNode.ismoved.cloneTo(this._cacheMoved);
            }
            this._updateBillboardMatrix(renderNode, context3D);
        }
        _updateBillboardMatrix(renderNode, context3D) {
            var _a;
            if (!this._billboard || !context3D)
                return;
            let cameraTransform = (_a = context3D.cameraModuleData) === null || _a === void 0 ? void 0 : _a.transform;
            if (!cameraTransform)
                return;
            let transform = renderNode.transform;
            let cameraUp = Spine3DRenderer._tempCameraUp;
            let cameraForward = Spine3DRenderer._tempCameraForward;
            cameraTransform.getUp(cameraUp);
            cameraTransform.getForward(cameraForward);
            Laya.Matrix4x4.billboard(transform.position, cameraTransform.position, cameraUp, cameraForward, this._billboardMatrix);
            const lossyScale = transform.getWorldLossyScale();
            const elements = this._billboardMatrix.elements;
            elements[0] *= -lossyScale.x;
            elements[1] *= -lossyScale.x;
            elements[2] *= -lossyScale.x;
            elements[4] *= lossyScale.y;
            elements[5] *= lossyScale.y;
            elements[6] *= lossyScale.y;
            elements[8] *= lossyScale.z;
            elements[9] *= lossyScale.z;
            elements[10] *= lossyScale.z;
            renderNode.shaderData.setMatrix4x4(Spine3DShaderInit.SPINE_BILLBOARD_MATRIX, this._billboardMatrix);
        }
        _onWorldMatNeedChange(flag) {
            super._onWorldMatNeedChange(flag);
            this._baseRenderNode.ismoved.setValue(Laya.Stat.loopCount, Laya.LayaGL.renderEngine._framePassCount);
            this._baseRenderNode.ismoved = this._baseRenderNode.ismoved;
        }
        get source() {
            return this._source;
        }
        set source(value) {
            this._source = value;
            if (value) {
                let template = Laya.ILaya.loader.getRes(value, Laya.Loader.SPINE);
                if (template) {
                    this.templet = template;
                }
                else {
                    Laya.ILaya.loader.load(value, Laya.Loader.SPINE).then((templet) => {
                        if (!this._source || templet && !templet.isCreateFromURL(this._source))
                            return;
                        if (this.destroyed)
                            return;
                        this.templet = templet;
                    });
                }
            }
            else
                this.templet = null;
        }
        get skinName() {
            return this._skinName;
        }
        set skinName(value) {
            this._skinName = value;
            if (this._templet)
                this.showSkinByName(value);
        }
        get animationName() {
            return this._animationName;
        }
        set animationName(value) {
            this._animationName = value;
            if (this._templet)
                this.play(value, this._loop, true);
        }
        get maxDetlaTime() {
            return this._maxDeltaTime;
        }
        set maxDetlaTime(value) {
            this._maxDeltaTime = value;
        }
        get loop() {
            return this._loop;
        }
        set loop(value) {
            this._loop = value;
            if (this._templet)
                this.play(this._animationName, this._loop, true);
        }
        get templet() {
            return this._templet;
        }
        set templet(value) {
            this.init(value);
        }
        set currentTime(value) {
            if (!this._templet)
                return;
            value /= 1000;
            if (value < this._playStart || (!!this._playEnd && value > this._playEnd) || value > this._duration)
                throw new Error("AnimationPlayer: value must large than playStartTime,small than playEndTime.");
            this._spineRender.currentTime = value;
        }
        get currentTime() {
            if (!this._templet)
                return 0;
            return this._spineRender.currentTime;
        }
        get playState() {
            return this._playState;
        }
        get useFastRender() {
            return this._useFastRender;
        }
        set useFastRender(value) {
            if (this._useFastRender === value)
                return;
            this._useFastRender = value;
            if (!this._templet)
                return;
            this._spineRender.mode = value ? Laya.ESpineRenderMode.Optimize : Laya.ESpineRenderMode.Normal;
        }
        get enableCache() {
            return this._enableCache;
        }
        set enableCache(value) {
            if (this._enableCache === value)
                return;
            this._enableCache = value;
            if (this._spineRender) {
                if (value) {
                    this._spineRender.enableCache();
                }
                else {
                    this._spineRender.disableCache();
                }
            }
            if (this._animationName) {
                this.play(this._animationName, this._loop, true, this._playStart, this._playEnd, this._playAudio);
            }
        }
        onEnable() {
            super.onEnable();
            this.owner.on(Laya.Event.TRANSFORM_CHANGED, this, this.onTransformChanged);
            if (this._spineRender && Laya.LayaEnv.isPlaying && this._animationName !== undefined)
                this.play(this._animationName, this._loop, true);
        }
        onDisable() {
            super.onDisable();
            this.owner.off(Laya.Event.TRANSFORM_CHANGED, this, this.onTransformChanged);
        }
        init(templet) {
            if (this.destroyed)
                return;
            if (this._templet || this._spineRender) {
                this.clear();
            }
            this._templet = templet;
            if (!this._templet)
                return;
            this._templet._addReference();
            this._templet.on(Laya.SpineTemplet.EVENT_SPINE_MATERIAL_CHANGE, this, this.onSpineMaterialChange);
            this._spineRender = Laya.SpineConst.factory.createSpineRender3D(this._baseRenderNode);
            this._spineRender.init(templet);
            this._spineRender.mode = this._useFastRender ? Laya.ESpineRenderMode.Optimize : Laya.ESpineRenderMode.Normal;
            this._spineRender.premultipliedAlpha = this._setPreAlphaFlag ? this._premultipliedAlpha : this._templet.premultipliedAlpha;
            this._resetSkeletonPosition();
            if (this._enableCache) {
                this._spineRender.enableCache();
            }
            if (this._renderSize.x !== 0 && this._renderSize.y !== 0) {
                this._baseRenderNode.shaderData.setVector2(Laya.SpineShaderInit.SPINE_RENDER_SIZE, this._renderSize);
            }
            else {
                this._baseRenderNode.shaderData.setVector2(Laya.SpineShaderInit.SPINE_RENDER_SIZE, Laya.Vector2.TEMP.setValue(templet.width, templet.height));
            }
            this.boundsChange = true;
            let skinIndex = this._templet.getSkinIndexByName(this._skinName);
            if (skinIndex != -1)
                this.showSkinByIndex(skinIndex);
            this._initBounds();
            this.onTransformChanged();
            this._spineRender.setEventListener({
                start: (entry) => {
                },
                interrupt: (entry) => {
                },
                end: (entry) => {
                },
                dispose: (entry) => {
                },
                complete: (entry) => {
                    this.owner.event(Laya.Event.END);
                    if (entry.loop) {
                        this._spineRender.complete();
                        this.owner.event(Laya.Event.COMPLETE);
                    }
                    else {
                        this.stop();
                    }
                },
                event: (entry, event) => {
                    let eventData = {
                        audioValue: event.data.audioPath,
                        audioPath: event.data.audioPath,
                        floatValue: event.floatValue,
                        intValue: event.intValue,
                        name: event.data.name,
                        stringValue: event.stringValue,
                        time: event.time * 1000,
                        balance: event.balance,
                        volume: event.volume
                    };
                    this.owner.event(Laya.Event.LABEL, eventData);
                }
            });
            this.owner.event(Laya.Event.READY);
            if (Laya.LayaEnv.isPlaying
                && this.enabled
                && this._animationName !== undefined) {
                this.play(this._animationName, this._loop, true);
            }
        }
        _initBounds() {
            let x = this._templet.x;
            let y = this._templet.y;
            let width = this._templet.width;
            let height = this._templet.height;
            let min = this._geometryBounds.getMin();
            let max = this._geometryBounds.getMax();
            min.x = x;
            min.y = y;
            min.z = 0;
            max.x = width + x;
            max.y = height + y;
            max.z = 0;
            this._geometryBounds.setMin(min);
            this._geometryBounds.setMax(max);
            this._baseRenderNode.baseGeometryBounds = this._geometryBounds;
        }
        play(nameOrIndex, loop, force = true, start = 0, end = 0, playAudio = false) {
            if (!this._templet) {
                console.warn("Spine2DRenderNode.play: templet is not ready, animation:", nameOrIndex);
                return;
            }
            this._playAudio = playAudio;
            start /= 1000;
            end /= 1000;
            this._loop = loop;
            if (start < 0 || end < 0)
                throw new Error("SpineSkeleton: start and end must large than zero.");
            if ((end !== 0) && (start > end))
                throw new Error("SpineSkeleton: start must less than end.");
            if (typeof nameOrIndex == "number") {
                nameOrIndex = this.getAniNameByIndex(nameOrIndex);
            }
            else {
                if (!this.templet.hasAnimation(nameOrIndex))
                    return;
            }
            if (force || this._pause || this._animationName != nameOrIndex) {
                this._animationName = nameOrIndex;
                this._spineRender.play(nameOrIndex, loop, this.trackIndex, start, end);
                let duration = this._spineRender.trackEntry.animation.duration;
                this._duration = duration;
                this._playStart = start;
                this._playEnd = end <= duration ? end : duration;
                if (this._pause) {
                    this._pause = false;
                    this._needUpdate = true;
                }
                this._playState = Laya.ESpineRenderState.Playing;
                this._update();
            }
        }
        _update() {
            const spineRender = this._spineRender;
            if (this.destroyed || !spineRender)
                return;
            let timerDelta = this._enableCache ? Laya.SpineConst.SPINE_STEP : Laya.Laya.timer.delta / 1000;
            if (timerDelta > this._maxDeltaTime)
                timerDelta = this._maxDeltaTime;
            let delta = timerDelta * this._playbackRate;
            let currentPlayTime = spineRender.currentTime;
            this._syncSkeletonPosition();
            spineRender.update(delta);
            if (this.destroyed || spineRender !== this._spineRender) {
                return;
            }
            spineRender.render(currentPlayTime, this.physicsUpdate);
        }
        getAnimNum() {
            return this._templet.getAnimationCount();
        }
        getAniNameByIndex(index) {
            return this._templet.getAniNameByIndex(index);
        }
        getSlotByName(slotName) {
            return this._spineRender.findSlot(slotName);
        }
        playbackRate(value) {
            this._playbackRate = value;
        }
        showSkinByName(name) {
            this.showSkinByIndex(this._templet.getSkinIndexByName(name));
        }
        showSkinByIndex(skinIndex) {
            this._spineRender.showSkinByIndex(skinIndex);
        }
        stop() {
            if (this._playState === Laya.ESpineRenderState.Stopped)
                return;
            this._pause = true;
            this._needUpdate = false;
            this._playState = Laya.ESpineRenderState.Stopped;
            this.owner.event(Laya.Event.STOPPED);
        }
        onUpdate() {
            this._needUpdate && this._update();
        }
        paused() {
            if (!this._pause) {
                this._pause = true;
                this._needUpdate = false;
                this._playState = Laya.ESpineRenderState.Paused;
                this.owner.event(Laya.Event.PAUSED);
            }
        }
        resume() {
            if (this._playState === Laya.ESpineRenderState.Paused) {
                this._pause = false;
                this._needUpdate = true;
                this._playState = Laya.ESpineRenderState.Playing;
            }
        }
        onTransformChanged() {
            this._syncSkeletonPosition();
        }
        _resetSkeletonPosition() {
            this._skeletonPosition.setValue(0, 0);
            this._lastSkeletonWorldPosition.setValue(0, 0, 0);
            this._hasSkeletonWorldPosition = false;
        }
        _syncSkeletonPosition() {
            if (!this._spineRender)
                return;
            let matrix = this.owner.transform.worldMatrix;
            let elements = matrix.elements;
            let worldX = elements[12];
            let worldY = elements[13];
            let worldZ = elements[14];
            if (!this._isPhysicsSyncEnabled()) {
                this._lastSkeletonWorldPosition.setValue(worldX, worldY, worldZ);
                this._hasSkeletonWorldPosition = true;
                return;
            }
            if (!this._hasSkeletonWorldPosition) {
                this._lastSkeletonWorldPosition.setValue(worldX, worldY, worldZ);
                this._hasSkeletonWorldPosition = true;
                this._spineRender.setSkeletonPosition(this._skeletonPosition.x, this._skeletonPosition.y);
                return;
            }
            let deltaX = worldX - this._lastSkeletonWorldPosition.x;
            let deltaY = worldY - this._lastSkeletonWorldPosition.y;
            let deltaZ = worldZ - this._lastSkeletonWorldPosition.z;
            if (deltaX !== 0 || deltaY !== 0 || deltaZ !== 0) {
                let skeletonDeltaX = 0;
                let skeletonDeltaY = 0;
                let xAxisX = elements[0];
                let xAxisY = elements[1];
                let xAxisZ = elements[2];
                let yAxisX = elements[4];
                let yAxisY = elements[5];
                let yAxisZ = elements[6];
                let xAxisLengthSq = xAxisX * xAxisX + xAxisY * xAxisY + xAxisZ * xAxisZ;
                let yAxisLengthSq = yAxisX * yAxisX + yAxisY * yAxisY + yAxisZ * yAxisZ;
                if (xAxisLengthSq > 0)
                    skeletonDeltaX = (deltaX * xAxisX + deltaY * xAxisY + deltaZ * xAxisZ) / xAxisLengthSq;
                if (yAxisLengthSq > 0)
                    skeletonDeltaY = (deltaX * yAxisX + deltaY * yAxisY + deltaZ * yAxisZ) / yAxisLengthSq;
                if (skeletonDeltaX !== 0 || skeletonDeltaY !== 0) {
                    this._skeletonPosition.x += skeletonDeltaX;
                    this._skeletonPosition.y += skeletonDeltaY;
                    this._spineRender.physicsTranslate(skeletonDeltaX, skeletonDeltaY);
                }
            }
            this._lastSkeletonWorldPosition.setValue(worldX, worldY, worldZ);
            this._spineRender.setSkeletonPosition(this._skeletonPosition.x, this._skeletonPosition.y);
        }
        _isPhysicsSyncEnabled() {
            return this.physicsUpdate === 1 || this.physicsUpdate === 2;
        }
        setSlotAttachment(slotName, attachmentName) {
            this.useFastRender = false;
            this._spineRender.setAttachment(slotName, attachmentName);
        }
        clear() {
            this._needUpdate = false;
            this._pause = true;
            const spineRender = this._spineRender;
            this._spineRender = null;
            spineRender === null || spineRender === void 0 ? void 0 : spineRender.destroy();
            this.reset();
        }
        onSpineMaterialChange() {
            if (this._spineRender)
                this._spineRender.clearCacheMaterials();
        }
        reset() {
            var _a;
            (_a = this._spineRender) === null || _a === void 0 ? void 0 : _a.reset();
            if (this._templet) {
                this._templet.off(Laya.SpineTemplet.EVENT_SPINE_MATERIAL_CHANGE, this, this.onSpineMaterialChange);
                this._templet._removeReference(1);
                this._templet = null;
            }
            this._resetSkeletonPosition();
            this._pause = true;
            this._needUpdate = false;
            this._playState = Laya.ESpineRenderState.Stopped;
        }
        _onDestroy() {
            if (this._templet || this._spineRender) {
                this.clear();
            }
            super._onDestroy();
        }
        addAnimation(nameOrIndex, loop = false, delay = 0) {
            delay /= 1000;
            let animationName = nameOrIndex;
            if (typeof animationName == "number") {
                animationName = this.getAniNameByIndex(animationName);
            }
            this._animationName = animationName;
            this._spineRender.addAnimation(animationName, loop, delay, this.trackIndex);
        }
        setMix(fromNameOrIndex, toNameOrIndex, duration) {
            duration /= 1000;
            let fromName = fromNameOrIndex;
            if (typeof fromName == "number") {
                fromName = this.getAniNameByIndex(fromName);
            }
            let toName = toNameOrIndex;
            if (typeof toName == "number") {
                toName = this.getAniNameByIndex(toName);
            }
            this._spineRender.setMix(fromName, toName, duration);
        }
        getBoneByName(boneName) {
            return this._spineRender.findBone(boneName);
        }
        getSkeleton() {
            return this._spineRender.getSkeleton();
        }
        updateWorldTransform(physicsUpdate = this.physicsUpdate) {
            if (this._spineRender) {
                this._spineRender.updateWorldTransform(physicsUpdate);
            }
        }
        physicsTranslate(x, y) {
            this._spineRender.physicsTranslate(x, y);
        }
    }
    Spine3DRenderer._tempCameraUp = new Laya.Vector3();
    Spine3DRenderer._tempCameraForward = new Laya.Vector3();

    let c = Laya.ClassUtils.regClass;
    c("Spine3DRenderer", Spine3DRenderer);
    Laya.Laya.addAfterInitCallback(() => {
        Spine3DShaderInit.init();
    });

    exports.Spine3DRenderer = Spine3DRenderer;
    exports.Spine3DShaderInit = Spine3DShaderInit;

})(window.Laya = window.Laya || {}, Laya);
//# sourceMappingURL=laya.spine3D.js.map
