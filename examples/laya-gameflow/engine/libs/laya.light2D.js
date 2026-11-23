(function (exports, Laya) {
    'use strict';

    class Light2DConfig {
        constructor() {
            this.changeCount = 0;
            this._lightDirection = new Laya.Vector3(-1, 0, 1);
            this._ambientColor = new Laya.Color(0.2, 0.2, 0.2, 0);
            this._ambientLayerMask = -1;
            this._multiSamples = 4;
        }
        notifyChange() {
            this.changeCount++;
        }
        get lightDirection() {
            return this._lightDirection;
        }
        set lightDirection(value) {
            if (this._lightDirection !== value) {
                this._lightDirection = value;
                this.notifyChange();
            }
        }
        get ambientColor() {
            return this._ambientColor;
        }
        set ambientColor(value) {
            if (this._ambientColor !== value) {
                this._ambientColor = value;
            }
            this.notifyChange();
        }
        get ambientLayerMask() {
            return this._ambientLayerMask;
        }
        set ambientLayerMask(value) {
            if (this._ambientLayerMask !== value) {
                this._ambientLayerMask = value;
                this.notifyChange();
            }
        }
        get multiSamples() {
            return this._multiSamples;
        }
        set multiSamples(value) {
            if (this._multiSamples !== value) {
                this._multiSamples = value;
                this.notifyChange();
            }
        }
    }

    class Light2DRenderRes {
        constructor(scene, layer, invertY) {
            this.lights = [];
            this.textures = [];
            this.material = [];
            this.materialShadow = [];
            this.lightMeshs = [];
            this.shadowMeshs = [];
            this.needShadowMesh = [];
            this.sceneModeNum = [];
            this.sceneModeList = [];
            this._layer = 0;
            this._invertY = false;
            this._cmdLightMeshs = [];
            this._cmdShadowMeshs = [];
            this._cmdBuffer = new Laya.CommandBuffer2D('Light2DRender');
            this._layer = layer;
            this._invertY = invertY;
        }
        _initMaterial(material, shadow) {
            if (shadow) {
                material.setShaderName('ShadowGen2D');
                material.setFloat('u_Shadow2DStrength', 0.5);
                material.setColor('u_ShadowColor', new Laya.Color(0, 0, 0, 1));
            }
            else
                material.setShaderName('LightAndShadowGen2D');
            material.setColor('u_LightColor', new Laya.Color(1, 1, 1, 1));
            material.setFloat('u_LightRotation', 0);
            material.setFloat('u_LightIntensity', 1);
            material.setFloat('u_PCFIntensity', 1);
            material.setVector2('u_LightTextureSize', new Laya.Vector2(1, 1));
            material.setVector2('u_LightScale', new Laya.Vector2(1, 1));
            material.setBoolByIndex(Laya.Shader3D.DEPTH_WRITE, false);
            material.setIntByIndex(Laya.Shader3D.DEPTH_TEST, Laya.RenderState.DEPTHTEST_OFF);
            material.setIntByIndex(Laya.Shader3D.BLEND, Laya.RenderState.BLEND_ENABLE_SEPERATE);
            material.setIntByIndex(Laya.Shader3D.BLEND_EQUATION_RGB, Laya.RenderState.BLENDEQUATION_ADD);
            material.setIntByIndex(Laya.Shader3D.BLEND_SRC_RGB, Laya.RenderState.BLENDPARAM_ONE);
            material.setIntByIndex(Laya.Shader3D.BLEND_DST_RGB, Laya.RenderState.BLENDPARAM_ONE);
            material.setIntByIndex(Laya.Shader3D.BLEND_EQUATION_ALPHA, Laya.RenderState.BLENDEQUATION_ADD);
            material.setIntByIndex(Laya.Shader3D.BLEND_SRC_ALPHA, Laya.RenderState.BLENDPARAM_ONE);
            material.setIntByIndex(Laya.Shader3D.BLEND_DST_ALPHA, Laya.RenderState.BLENDPARAM_ONE);
            material.setIntByIndex(Laya.Shader3D.CULL, Laya.RenderState.CULL_NONE);
        }
        setMaterialData(light, material, shadow) {
            const pcfIntensity = light._pcfIntensity();
            if (shadow) {
                material.setColor('u_ShadowColor', light.shadowColor);
                material.setFloat('u_Shadow2DStrength', light.shadowStrength);
            }
            material.setColor('u_LightColor', light.color);
            material.setFloat('u_LightIntensity', light.intensity);
            material.setFloat('u_LightRotation', light.lightRotation);
            material.setVector2('u_LightScale', light.lightScale);
            material.setVector2('u_LightTextureSize', light._getTextureSize());
            material.setFloat('u_PCFIntensity', pcfIntensity);
            if (Light2DManager.SUPPORT_LIGHT_BLEND_MODE) {
                switch (light.lightMode) {
                    default:
                    case exports.Light2DMode.Add:
                        material.setIntByIndex(Laya.Shader3D.BLEND_EQUATION_RGB, Laya.RenderState.BLENDEQUATION_ADD);
                        material.setIntByIndex(Laya.Shader3D.BLEND_SRC_RGB, Laya.RenderState.BLENDPARAM_ONE);
                        material.setIntByIndex(Laya.Shader3D.BLEND_DST_RGB, Laya.RenderState.BLENDPARAM_ONE);
                        break;
                    case exports.Light2DMode.Sub:
                        material.setIntByIndex(Laya.Shader3D.BLEND_EQUATION_RGB, Laya.RenderState.BLENDEQUATION_REVERSE_SUBTRACT);
                        material.setIntByIndex(Laya.Shader3D.BLEND_SRC_RGB, Laya.RenderState.BLENDPARAM_ONE);
                        material.setIntByIndex(Laya.Shader3D.BLEND_DST_RGB, Laya.RenderState.BLENDPARAM_ONE);
                        break;
                    case exports.Light2DMode.Mix:
                        material.setIntByIndex(Laya.Shader3D.BLEND_EQUATION_RGB, Laya.RenderState.BLENDEQUATION_ADD);
                        material.setIntByIndex(Laya.Shader3D.BLEND_SRC_RGB, Laya.RenderState.BLENDPARAM_ONE);
                        material.setIntByIndex(Laya.Shader3D.BLEND_DST_RGB, Laya.RenderState.BLENDPARAM_ONE_MINUS_SRC_ALPHA);
                        break;
                }
            }
        }
        addLights(lights, recover) {
            const length = lights.length;
            if (!Light2DManager.REUSE_MESH && recover)
                this._needRecoverMesh(recover, length);
            this.lights = lights;
            this.textures.length = length;
            this.lightMeshs.length = length;
            this.shadowMeshs.length = length;
            this.needShadowMesh.length = length;
            this.sceneModeList.length = length;
            for (let i = 0; i < 3; i++)
                this.sceneModeNum[i] = 0;
            for (let i = 0; i < length; i++) {
                const light = lights[i];
                const pcf = 1 / light._pcfIntensity() | 0;
                if (!this.lightMeshs[i])
                    this.lightMeshs[i] = [];
                this.lightMeshs[i].length = pcf;
                if (!this.material[i]) {
                    this.material[i] = new Laya.Material();
                    this.material[i]._addReference();
                    this._initMaterial(this.material[i], false);
                }
                else
                    this.setMaterialData(light, this.material[i], false);
                this.textures[i] = light._texLight;
                this.sceneModeNum[light.sceneMode]++;
                this.sceneModeList[i] = light.sceneMode;
            }
            for (let i = 0; i < length; i++) {
                const light = lights[i];
                if (light._isNeedShadowMesh()) {
                    if (!this.materialShadow[i]) {
                        this.materialShadow[i] = new Laya.Material();
                        this.materialShadow[i]._addReference();
                        this._initMaterial(this.materialShadow[i], true);
                    }
                    else
                        this.setMaterialData(light, this.materialShadow[i], true);
                    this.needShadowMesh[i] = true;
                }
                else
                    this.needShadowMesh[i] = false;
            }
        }
        updateLightPCF(light) {
            for (let i = this.lights.length - 1; i > -1; i--) {
                if (this.lights[i] === light) {
                    const pcf = 1 / light._pcfIntensity() | 0;
                    if (!this.lightMeshs[i])
                        this.lightMeshs[i] = [];
                    this.lightMeshs[i].length = pcf;
                }
            }
        }
        _needRecoverMesh(recover, length) {
            for (let i = this.lightMeshs.length - 1; i >= length; i--) {
                if (this.lightMeshs[i]) {
                    const meshs = this.lightMeshs[i];
                    if (meshs[i]) {
                        for (let j = meshs.length - 1; j > -1; j--) {
                            recover.push(meshs[j]);
                            meshs[j] = null;
                        }
                    }
                }
            }
            for (let i = this.shadowMeshs.length - 1; i >= length; i--) {
                if (this.shadowMeshs[i]) {
                    recover.push(this.shadowMeshs[i]);
                    this.shadowMeshs[i] = null;
                }
            }
        }
        setRenderTargetCMD(rt, rtAdd, rtSub) {
            if (!this._cmdRT)
                this._cmdRT = Laya.Set2DRTCMD.create(rt, true, Laya.Color.CLEAR, this._invertY);
            else
                this._cmdRT.renderTexture = rt;
            if (Light2DManager.SUPPORT_LIGHT_SCENE_MODE) {
                if (!this._cmdRTAdd) {
                    if (rtAdd)
                        this._cmdRTAdd = Laya.Set2DRTCMD.create(rtAdd, true, Laya.Color.CLEAR, this._invertY);
                }
                else
                    this._cmdRTAdd.renderTexture = rtAdd;
                if (!this._cmdRTSub) {
                    if (rtSub)
                        this._cmdRTSub = Laya.Set2DRTCMD.create(rtSub, true, Laya.Color.CLEAR, this._invertY);
                }
                else
                    this._cmdRTSub.renderTexture = rtSub;
            }
        }
        buildRenderMeshCMD() {
            for (let i = this._cmdLightMeshs.length - 1; i > -1; i--) {
                const cmds = this._cmdLightMeshs[i];
                for (let j = cmds.length - 1; j > -1; j--)
                    cmds[j].recover();
                cmds.length = 0;
            }
            this._cmdLightMeshs.length = 0;
            for (let i = this._cmdShadowMeshs.length - 1; i > -1; i--)
                if (this._cmdShadowMeshs[i])
                    this._cmdShadowMeshs[i].recover();
            this._cmdShadowMeshs.length = 0;
            const mat = Laya.Matrix.EMPTY;
            for (let i = 0, len = this.lightMeshs.length; i < len; i++) {
                const meshs = this.lightMeshs[i];
                const cmds = this._cmdLightMeshs[i] = [];
                for (let j = meshs.length - 1; j > -1; j--)
                    cmds.push(Laya.DrawMesh2DCMD.create(meshs[j], mat, this.textures[i], Laya.Color.WHITE, this.material[i]));
            }
            for (let i = 0, len = this.shadowMeshs.length; i < len; i++) {
                if (this.needShadowMesh[i])
                    this._cmdShadowMeshs.push(Laya.DrawMesh2DCMD.create(this.shadowMeshs[i], mat, this.textures[i], Laya.Color.WHITE, this.materialShadow[i]));
                else
                    this._cmdShadowMeshs.push(null);
            }
        }
        updateMaterial() {
            for (let i = 0, len = this._cmdLightMeshs.length; i < len; i++) {
                const cmds = this._cmdLightMeshs[i];
                for (let j = 0, len = cmds.length; j < len; j++) {
                    cmds[j].texture = this.textures[i];
                    cmds[j].material = this.material[i];
                }
            }
            for (let i = 0, len = this._cmdShadowMeshs.length; i < len; i++) {
                if (this._cmdShadowMeshs[i]) {
                    this._cmdShadowMeshs[i].texture = this.textures[i];
                    this._cmdShadowMeshs[i].material = this.materialShadow[i];
                }
            }
        }
        updateLightMesh(mesh, i, j) {
            this.lightMeshs[i][j] = mesh;
            if (Light2DManager.REUSE_CMD) {
                if (this._cmdLightMeshs[i] && this._cmdLightMeshs[i][j])
                    this._cmdLightMeshs[i][j].mesh = mesh;
            }
        }
        updateShadowMesh(mesh, i) {
            this.shadowMeshs[i] = mesh;
            if (Light2DManager.REUSE_CMD) {
                if (this._cmdShadowMeshs[i])
                    this._cmdShadowMeshs[i].mesh = mesh;
            }
        }
        enableShadow(light, recover) {
            const layer = this._layer;
            for (let i = this.lights.length - 1; i > -1; i--) {
                if (this.lights[i] === light) {
                    this.needShadowMesh[i] = false;
                    if (!light.shadowEnable
                        || !light._isNeedShadowMesh()
                        || (light.shadowLayerMask & (1 << layer)) === 0) {
                        if (!Light2DManager.REUSE_MESH
                            && recover && this.shadowMeshs[i])
                            recover.push(this.shadowMeshs[i]);
                        this.shadowMeshs[i] = null;
                        if (Light2DManager.REUSE_CMD) {
                            if (this._cmdShadowMeshs[i]) {
                                this._cmdShadowMeshs[i].recover();
                                this._cmdShadowMeshs[i] = null;
                            }
                        }
                    }
                    else {
                        if (Light2DManager.REUSE_CMD) {
                            if (!this._cmdShadowMeshs[i])
                                this._cmdShadowMeshs[i] = Laya.DrawMesh2DCMD.create(this.shadowMeshs[i], Laya.Matrix.EMPTY, this.textures[i], Laya.Color.WHITE, this.materialShadow[i]);
                        }
                        if (!this.materialShadow[i]) {
                            this.materialShadow[i] = new Laya.Material();
                            this.materialShadow[i]._addReference();
                            this._initMaterial(this.materialShadow[i], true);
                        }
                        this.needShadowMesh[i] = true;
                    }
                    return;
                }
            }
        }
        destroy() {
            for (let i = this.material.length - 1; i > -1; i--) {
                if (this.material[i]) {
                    this.material[i]._removeReference();
                    this.material[i] = null;
                }
            }
            for (let i = this.materialShadow.length - 1; i > -1; i--) {
                if (this.materialShadow[i]) {
                    this.materialShadow[i]._removeReference();
                    this.materialShadow[i] = null;
                }
            }
            this.material.length = 0;
            this.materialShadow.length = 0;
        }
        render(rt, rtAdd, rtSub) {
            const length = this.lights.length;
            if (Light2DManager.REUSE_CMD) {
                const _render = (srt, mode) => {
                    this._cmdBuffer.addCacheCommand(srt);
                    for (let i = 0; i < length; i++) {
                        if (!Light2DManager.SUPPORT_LIGHT_SCENE_MODE
                            || this.sceneModeList[i] === mode) {
                            const cmds = this._cmdLightMeshs[i];
                            for (let j = 0, len = cmds.length; j < len; j++) {
                                const cmd = cmds[j];
                                if (cmd.mesh && cmd.material)
                                    this._cmdBuffer.addCacheCommand(cmd);
                            }
                            const cmd = this._cmdShadowMeshs[i];
                            if (cmd && cmd.mesh && cmd.material)
                                this._cmdBuffer.addCacheCommand(cmd);
                        }
                    }
                    this._cmdBuffer.apply(true);
                    this._cmdBuffer.clear(false);
                };
                if (this._cmdRT)
                    _render(this._cmdRT, exports.Light2DMode.Mul);
                if (Light2DManager.SUPPORT_LIGHT_SCENE_MODE) {
                    if (this._cmdRTAdd && this.sceneModeNum[exports.Light2DMode.Add] > 0)
                        _render(this._cmdRTAdd, exports.Light2DMode.Add);
                    if (this._cmdRTSub && this.sceneModeNum[exports.Light2DMode.Sub] > 0)
                        _render(this._cmdRTSub, exports.Light2DMode.Sub);
                }
            }
            else {
                const _render = (rtt, mode) => {
                    this._cmdBuffer.setRenderTarget(rtt, true, Laya.Color.CLEAR, this._invertY);
                    for (let i = 0; i < length; i++) {
                        if (!Light2DManager.SUPPORT_LIGHT_SCENE_MODE
                            || this.sceneModeList[i] === mode) {
                            const meshs = this.lightMeshs[i];
                            for (let j = 0, len = meshs.length; j < len; j++)
                                if (meshs[j] && this.material[i])
                                    this._cmdBuffer.drawMesh(meshs[j], mat, this.textures[i], Laya.Color.WHITE, this.material[i]);
                            const mesh = this.shadowMeshs[i];
                            if (mesh && this.materialShadow[i])
                                this._cmdBuffer.drawMesh(mesh, mat, this.textures[i], Laya.Color.WHITE, this.materialShadow[i]);
                        }
                    }
                    this._cmdBuffer.apply(true);
                    this._cmdBuffer.clear(true);
                };
                const mat = Laya.Matrix.EMPTY;
                _render(rt, exports.Light2DMode.Mul);
                if (Light2DManager.SUPPORT_LIGHT_SCENE_MODE) {
                    if (this.sceneModeNum[exports.Light2DMode.Add] > 0)
                        _render(rtAdd, exports.Light2DMode.Add);
                    if (this.sceneModeNum[exports.Light2DMode.Sub] > 0)
                        _render(rtSub, exports.Light2DMode.Sub);
                }
            }
        }
    }

    class LightLine2D {
        constructor() {
            this.useNormal = false;
        }
        create(ax, ay, bx, by, useNormal = false) {
            this.a ? this.a.setValue(ax, ay) : this.a = new Laya.Vector2(ax, ay);
            this.b ? this.b.setValue(bx, by) : this.b = new Laya.Vector2(bx, by);
            if (useNormal) {
                let n = this.n;
                n ? n.setValue(by - ay, ax - bx)
                    : n = this.n = new Laya.Vector2(by - ay, ax - bx);
                Laya.Vector2.normalize(n, n);
            }
            this.useNormal = useNormal;
            return this;
        }
    }

    class PolygonPoint2D {
        constructor(points) {
            this._points = [];
            if (points)
                this._points.push(...points);
        }
        get points() {
            return this._points;
        }
        set points(value) {
            this._points = value;
        }
        addPoint(x, y, index = -1) {
            if (index < 0) {
                this._points.push(x, y);
            }
            else {
                for (let i = this._points.length; i > index; i--)
                    this._points[i] = this._points[i - 1];
                this._points[index * 2 + 0] = x;
                this._points[index * 2 + 1] = y;
            }
        }
        updatePoint(x, y, index) {
            if (index < (this._points.length / 2 | 0) && index >= 0) {
                this._points[index * 2 + 0] = x;
                this._points[index * 2 + 1] = y;
            }
        }
        removePoint(index) {
            if (index < this._points.length && index >= 0)
                this._points.splice(index, 1);
        }
        clear() {
            this._points.length = 0;
        }
        clone() {
            const poly = new PolygonPoint2D();
            poly._points.push(...this._points);
            return poly;
        }
        cloneTo(other) {
            other._points.length = 0;
            other._points.push(...this._points);
            return other;
        }
    }

    class LightOccluder2DCore {
        set owner(value) {
            this._owner = value;
        }
        set manager(value) {
            this._manager = value;
        }
        get layerMask() {
            return this._layerMask;
        }
        set layerMask(value) {
            if (value !== this._layerMask) {
                this._layerMaskChange(this._layerMask, value);
                this._layerMask = value;
                this._layers.length = 0;
                for (let i = 0; i < Light2DManager.MAX_LAYER; i++)
                    if (value & (1 << i))
                        this._layers.push(i);
            }
        }
        get layers() {
            return this._layers;
        }
        get canInLight() {
            return this._canInLight;
        }
        set canInLight(value) {
            if (value !== this._canInLight) {
                this._canInLight = value;
                this._needUpdate = true;
            }
        }
        get outside() {
            return this._outside;
        }
        set outside(value) {
            if (value !== this._outside) {
                this._outside = value;
                this._needUpdate = true;
                this._clearCache();
            }
        }
        get needUpdate() {
            return this._needUpdate;
        }
        set needUpdate(value) {
            this._needUpdate = value;
        }
        constructor(manager) {
            this._layerMask = 1;
            this._layers = [0];
            this._x = 0;
            this._y = 0;
            this._scaleX = 1;
            this._scaleY = 2;
            this._skewX = 0;
            this._skewY = 0;
            this._rotation = 0;
            this._tfChanged = true;
            this._sceneMatrix = new Laya.Matrix();
            this._canInLight = true;
            this._outside = true;
            this._occluderId = 0;
            this._localRange = new Laya.Rectangle();
            this._worldRange = new Laya.Rectangle();
            this._needUpdate = false;
            this._needTransformPoly = false;
            this._needUpdateLightLocalRange = false;
            this._needUpdateLightWorldRange = false;
            this._select = false;
            this._outsideSegment = [];
            this._segments = [];
            this._segLight = new Laya.Vector2();
            this._tempVec2 = new Laya.Vector2();
            this._manager = manager;
            this._occluderId = LightOccluder2DCore._idCounter++;
        }
        _onEnable() {
            var _a;
            (_a = this._manager) === null || _a === void 0 ? void 0 : _a.addOccluder(this);
        }
        _onDisable() {
            var _a;
            (_a = this._manager) === null || _a === void 0 ? void 0 : _a.removeOccluder(this);
        }
        pos(x, y) {
            if (this._x != x || this._y != y) {
                this._x = x;
                this._y = y;
                this._tfChanged = true;
                this._transformChange();
            }
            return this;
        }
        scale(x, y) {
            if (this._scaleX !== x || this._scaleY !== y) {
                this._scaleX = x;
                this._scaleY = y;
                this._tfChanged = true;
                this._transformChange();
            }
            return this;
        }
        skew(x, y) {
            if (this._skewX !== x || this._skewY !== y) {
                this._skewX = x;
                this._skewY = y;
                this._tfChanged = true;
                this._transformChange();
            }
            return this;
        }
        get x() {
            return this._x;
        }
        set x(value) {
            this.pos(value, this._y);
        }
        get y() {
            return this._y;
        }
        set y(value) {
            this.pos(this._x, value);
        }
        get scaleX() {
            return this._scaleX;
        }
        set scaleX(value) {
            this.scale(value, this._scaleY);
        }
        get scaleY() {
            return this._scaleY;
        }
        set scaleY(value) {
            this.scale(this._scaleX, value);
        }
        get skewX() {
            return this._skewX;
        }
        set skewX(value) {
            this.skew(value, this._skewX);
        }
        get skewY() {
            return this._skewY;
        }
        set skewY(value) {
            this.skew(this._skewX, value);
        }
        get rotation() {
            return this._rotation;
        }
        set rotation(value) {
            if (this._rotation !== value) {
                this._rotation = value;
                this._tfChanged = true;
                this._transformChange();
            }
        }
        get transform() {
            if (!this._tfChanged)
                return this._transform;
            this._tfChanged = false;
            const m = this._transform || (this._transform = new Laya.Matrix());
            const sx = this._scaleX;
            const sy = this._scaleY;
            const sskx = this._skewX;
            const ssky = this._skewY;
            const rot = this._rotation;
            if (rot || sx !== 1 || sy !== 1 || sskx !== 0 || ssky !== 0) {
                m._bTransform = true;
                const skx = (rot - sskx) * 0.0174532922222222;
                const sky = (rot + ssky) * 0.0174532922222222;
                const cx = Math.cos(sky);
                const ssx = Math.sin(sky);
                const cy = Math.sin(skx);
                const ssy = Math.cos(skx);
                m.a = sx * cx;
                m.b = sx * ssx;
                m.c = -sy * cy;
                m.d = sy * ssy;
                m.tx = m.ty = 0;
            }
            else
                m.identity();
            return m;
        }
        set transform(value) {
            this._tfChanged = false;
            const m = this._transform || (this._transform = new Laya.Matrix());
            if (value !== m)
                value.copyTo(m);
            if (value) {
                this._x = m.tx;
                this._y = m.ty;
                m.tx = m.ty = 0;
            }
        }
        _layerMaskChange(oldLayerMask, newLayerMask) {
            var _a;
            (_a = this._manager) === null || _a === void 0 ? void 0 : _a.occluderLayerMaskChange(this, oldLayerMask, newLayerMask);
        }
        _transformChange() {
            var _a;
            this._needUpdate = true;
            this._needTransformPoly = true;
            this._needUpdateLightWorldRange = true;
            (_a = this._manager) === null || _a === void 0 ? void 0 : _a.needCollectOccluderInLight(this.layerMask);
        }
        set polygonPoint(poly) {
            var _a, _b, _c;
            if (poly) {
                this._occluderPolygon = poly;
                this._globalPolygon = poly.clone();
                if (!this._cutPolygon)
                    this._cutPolygon = new PolygonPoint2D();
                else
                    this._cutPolygon.clear();
                this._needUpdate = true;
                this._needTransformPoly = true;
                this._needUpdateLightLocalRange = true;
                this._needUpdateLightWorldRange = true;
                (_a = this._manager) === null || _a === void 0 ? void 0 : _a.addOccluder(this);
            }
            else {
                this._occluderPolygon = null;
                this._globalPolygon = null;
                if (this._cutPolygon)
                    this._cutPolygon.clear();
                (_b = this._manager) === null || _b === void 0 ? void 0 : _b.removeOccluder(this);
            }
            (_c = this._manager) === null || _c === void 0 ? void 0 : _c.needCollectOccluderInLight(this.layerMask);
        }
        get polygonPoint() {
            return this._occluderPolygon;
        }
        _clearCache() {
            const segments = this._segments;
            for (let i = segments.length - 1; i > -1; i--)
                Laya.Pool.recover('LightLine2D', segments[i]);
            segments.length = 0;
            this._segLight.x = Number.POSITIVE_INFINITY;
            this._segLight.y = Number.POSITIVE_INFINITY;
        }
        getSegment(lightX, lightY) {
            if (this._needTransformPoly) {
                this._needTransformPoly = false;
                this._transformPoly();
            }
            lightX |= 0;
            lightY |= 0;
            if (this._segLight.x === lightX && this._segLight.y === lightY) {
                if (Light2DManager.DEBUG)
                    console.log('get segments cache', lightX, lightY);
                return this._segments;
            }
            if (this._globalPolygon) {
                const seg = this._outsideSegment;
                const poly = this._globalPolygon.points;
                const half = this._cutPolygon.points;
                const len = poly.length / 2 | 0;
                this._segLight.x = lightX;
                this._segLight.y = lightY;
                const segments = this._segments;
                for (let i = segments.length - 1; i > -1; i--)
                    Laya.Pool.recover('LightLine2D', segments[i]);
                segments.length = 0;
                if (!this.outside) {
                    if (len > 1) {
                        for (let i = 0; i < len; i++) {
                            const index1 = i * 2;
                            const index2 = ((i + 1) % len) * 2;
                            segments.push(Laya.Pool.getItemByClass('LightLine2D', LightLine2D).create(poly[index1], poly[index1 + 1], poly[index2], poly[index2 + 1]));
                        }
                    }
                }
                else {
                    let a = 0;
                    if (seg.length > 0) {
                        for (let i = 0, n = seg.length; i < n; i++) {
                            a = seg[i];
                            if (a >= 0) {
                                const index1 = a * 2;
                                const index2 = ((a + 1) % len) * 2;
                                segments.push(Laya.Pool.getItemByClass('LightLine2D', LightLine2D).create(poly[index1], poly[index1 + 1], poly[index2], poly[index2 + 1]));
                            }
                            else {
                                a = (-a - 1) * 2;
                                const index1 = a * 2;
                                const index2 = ((a + 1) % len) * 2;
                                segments.push(Laya.Pool.getItemByClass('LightLine2D', LightLine2D).create(half[index1], half[index1 + 1], half[index2], half[index2 + 1]));
                            }
                        }
                    }
                }
            }
            if (Light2DManager.DEBUG)
                console.log('calc occluder segments', lightX, lightY);
            return this._segments;
        }
        _calcLocalRange() {
            if (this._occluderPolygon) {
                const poly = this._occluderPolygon.points;
                let minX = Number.POSITIVE_INFINITY;
                let minY = Number.POSITIVE_INFINITY;
                let maxX = Number.NEGATIVE_INFINITY;
                let maxY = Number.NEGATIVE_INFINITY;
                for (let i = poly.length - 2; i > -1; i -= 2) {
                    const x = poly[i + 0];
                    const y = poly[i + 1];
                    if (minX > x)
                        minX = x;
                    if (maxX < x)
                        maxX = x;
                    if (minY > y)
                        minY = y;
                    if (maxY < y)
                        maxY = y;
                }
                this._localRange.x = minX;
                this._localRange.y = minY;
                this._localRange.width = maxX - minX;
                this._localRange.height = maxY - minY;
            }
            this._needUpdateLightLocalRange = false;
        }
        _calcWorldRange() {
            if (this._needTransformPoly) {
                this._needTransformPoly = false;
                this._transformPoly();
            }
            if (this._globalPolygon) {
                let xmin = Number.POSITIVE_INFINITY;
                let ymin = Number.POSITIVE_INFINITY;
                let xmax = Number.NEGATIVE_INFINITY;
                let ymax = Number.NEGATIVE_INFINITY;
                const polygon = this._globalPolygon.points;
                for (let i = polygon.length - 2; i > -1; i -= 2) {
                    const x = polygon[i + 0];
                    const y = polygon[i + 1];
                    if (xmin > x)
                        xmin = x;
                    if (xmax < x)
                        xmax = x;
                    if (ymin > y)
                        ymin = y;
                    if (ymax < y)
                        ymax = y;
                }
                this._worldRange.x = xmin;
                this._worldRange.y = ymin;
                this._worldRange.width = xmax - xmin;
                this._worldRange.height = ymax - ymin;
            }
            this._needUpdateLightWorldRange = false;
        }
        _getRange() {
            if (this._needUpdateLightLocalRange)
                this._calcLocalRange();
            if (this._needUpdateLightWorldRange)
                this._calcWorldRange();
            return this._worldRange;
        }
        isInLightRange(range) {
            return this._getRange().intersects(range);
        }
        selectByLight(x, y) {
            if (this._occluderPolygon) {
                if (!this.canInLight) {
                    if (this._needTransformPoly) {
                        this._needTransformPoly = false;
                        this._transformPoly();
                    }
                    let intersections = 0;
                    const poly = this._globalPolygon.points;
                    const len = poly.length / 2 | 0;
                    for (let i = 0; i < len; i++) {
                        const currentX = poly[i * 2 + 0];
                        const currentY = poly[i * 2 + 1];
                        const nextX = poly[((i + 1) % len) * 2 + 0];
                        const nextY = poly[((i + 1) % len) * 2 + 1];
                        const cx = currentX;
                        const cy = currentY;
                        const nx = nextX;
                        const ny = nextY;
                        if ((cy > y) !== (ny > y)) {
                            const intersectX = ((nx - cx) * (y - cy)) / (ny - cy) + cx;
                            if (x < intersectX)
                                intersections++;
                        }
                    }
                    if ((intersections % 2) === 1)
                        this._select = false;
                    else
                        this._select = true;
                }
                else
                    this._select = true;
                if (this._select && this.outside)
                    this._selectOutside(this._globalPolygon.points, x, y, this._outsideSegment);
            }
            return this._select;
        }
        _transformPoly() {
            if (this._globalPolygon) {
                let px = this._x;
                let py = this._y;
                let sx = this._scaleX;
                let sy = this._scaleY;
                if (this._owner) {
                    let globalTrans = this._owner.globalTrans;
                    const pp = globalTrans.getPos(Laya.Point.TEMP);
                    px = pp.x;
                    py = pp.y;
                    sx = globalTrans.scaleX;
                    sy = globalTrans.scaleY;
                }
                const globalPoly = this._globalPolygon.points;
                const polygon = this._occluderPolygon.points;
                const len = polygon.length / 2 | 0;
                let m = this._owner ? this._owner.globalTrans.getMatrix() : this.transform;
                if (m) {
                    for (let i = 0; i < len; i++) {
                        const x = polygon[i * 2 + 0];
                        const y = polygon[i * 2 + 1];
                        globalPoly[i * 2 + 0] = m.a * x + m.c * y + px;
                        globalPoly[i * 2 + 1] = m.b * x + m.d * y + py;
                    }
                }
                else {
                    for (let i = 0; i < len; i++) {
                        const x = polygon[i * 2 + 0];
                        const y = polygon[i * 2 + 1];
                        globalPoly[i * 2 + 0] = x * sx + px;
                        globalPoly[i * 2 + 1] = y * sy + py;
                    }
                }
                this._clearCache();
            }
        }
        _selectOutside(polygon, outsidePointX, outsidePointY, outPoly) {
            let abX = 0, abY = 0, cdX = 0, cdY = 0, acX = 0, acY = 0, det = 0, t = 0, u = 0;
            const _intersect = (ax, ay, bx, by, cx, cy, dx, dy, e) => {
                abX = bx - ax;
                abY = by - ay;
                cdX = cx - dx;
                cdY = cy - dy;
                det = abX * cdY - abY * cdX;
                if (Math.abs(det) < Number.EPSILON)
                    return false;
                acX = cx - ax;
                acY = cy - ay;
                t = (acX * cdY - acY * cdX) / det;
                u = (acX * abY - acY * abX) / det;
                if (t >= 0 && t <= 1 && u > 0) {
                    e.x = ax + t * abX;
                    e.y = ay + t * abY;
                    if (Math.abs(e.x - cx) > Number.EPSILON || Math.abs(e.y - cy) > Number.EPSILON)
                        return true;
                }
                return false;
            };
            const _clockwise = (ax, ay, bx, by, cx, cy) => {
                return ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) > 0;
            };
            outPoly.length = 0;
            const cutPoly = this._cutPolygon.points;
            cutPoly.length = 0;
            const n = polygon.length / 2 | 0;
            const outPoint = this._tempVec2;
            let p1x = 0, p1y = 0, p2x = 0, p2y = 0;
            let interP1 = false, interP2 = false;
            for (let i = 0; i < n; i++) {
                p1x = polygon[i * 2 + 0];
                p1y = polygon[i * 2 + 1];
                p2x = polygon[((i + 1) % n) * 2 + 0];
                p2y = polygon[((i + 1) % n) * 2 + 1];
                interP1 = false;
                interP2 = false;
                if (!_clockwise(p1x, p1y, p2x, p2y, outsidePointX, outsidePointY)) {
                    interP1 = true;
                    interP2 = true;
                }
                else {
                    for (let j = 0; j < n; j++) {
                        if (i !== j) {
                            if (_intersect(polygon[j * 2], polygon[j * 2 + 1], polygon[((j + 1) % n) * 2], polygon[((j + 1) % n) * 2 + 1], p1x, p1y, outsidePointX, outsidePointY, outPoint)) {
                                interP1 = true;
                                break;
                            }
                        }
                    }
                    for (let j = 0; j < n; j++) {
                        if (i !== j) {
                            if (_intersect(polygon[j * 2], polygon[j * 2 + 1], polygon[((j + 1) % n) * 2], polygon[((j + 1) % n) * 2 + 1], p2x, p2y, outsidePointX, outsidePointY, outPoint)) {
                                interP2 = true;
                                break;
                            }
                        }
                    }
                }
                if (!interP1 && !interP2)
                    outPoly.push(i);
                if (!interP1 && interP2) {
                    const inter = this._findNearestIntersection(p1x, p1y, p2x, p2y, outsidePointX, outsidePointY, polygon);
                    if (inter) {
                        cutPoly.push(p1x, p1y, inter.x, inter.y);
                        outPoly.push(-cutPoly.length / 4);
                    }
                }
                if (interP1 && !interP2) {
                    const inter = this._findNearestIntersection(p2x, p2y, p1x, p1y, outsidePointX, outsidePointY, polygon);
                    if (inter) {
                        cutPoly.push(inter.x, inter.y, p2x, p2y);
                        outPoly.push(-cutPoly.length / 4);
                    }
                }
            }
        }
        _findNearestIntersection(p1x, p1y, p2x, p2y, outsidePointX, outsidePointY, points) {
            const _distanceBetween = (v1x, v1y, v2x, v2y) => {
                const dx = v1x - v2x;
                const dy = v1y - v2y;
                return Math.sqrt(dx * dx + dy * dy);
            };
            const _lineIntersection = (p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y, out) => {
                const x1 = p1x, y1 = p1y;
                const x2 = p2x, y2 = p2y;
                const x3 = p3x, y3 = p3y;
                const x4 = p4x, y4 = p4y;
                const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
                if (denom === 0)
                    return false;
                const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
                const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
                if (ua <= 0 || ua >= 1 || ub <= 0 || ub >= 1)
                    return false;
                out.x = x1 + ua * (x2 - x1);
                out.y = y1 + ua * (y2 - y1);
                return true;
            };
            let nearestPoint = null;
            let minDistance = Infinity;
            let intersection = new Laya.Vector2();
            let distance = 0;
            for (let i = points.length - 2; i > -1; i -= 2) {
                if (_lineIntersection(p1x, p1y, p2x, p2y, outsidePointX, outsidePointY, points[i], points[i + 1], intersection)) {
                    distance = _distanceBetween(intersection.x, intersection.y, p1x, p1y);
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestPoint = intersection;
                    }
                }
            }
            return nearestPoint;
        }
        destroy() {
            this._onDisable();
            this.owner = null;
            this.manager = null;
        }
    }
    LightOccluder2DCore._idCounter = 0;

    class Occluder2DAgent {
        constructor(manager) {
            this._occluderMap = new Map();
            this._manager = manager;
        }
        addOccluder(index, param) {
            var _a, _b, _c, _d, _e, _f;
            let polygon;
            let occluder = this._occluderMap.get(index);
            const poly = param.poly;
            const layerMask = (_a = param.layerMask) !== null && _a !== void 0 ? _a : 1;
            const px = (_b = param.px) !== null && _b !== void 0 ? _b : 0;
            const py = (_c = param.py) !== null && _c !== void 0 ? _c : 0;
            const sx = (_d = param.sx) !== null && _d !== void 0 ? _d : 1;
            const sy = (_e = param.sy) !== null && _e !== void 0 ? _e : 1;
            const rot = (_f = param.rot) !== null && _f !== void 0 ? _f : 0;
            if (poly instanceof Array) {
                polygon = new PolygonPoint2D();
                for (let i = 0, len = poly.length; i < len; i += 2)
                    polygon.addPoint(poly[i], poly[i + 1]);
            }
            else
                polygon = poly;
            if (!occluder) {
                occluder = new LightOccluder2DCore();
                occluder.manager = this._manager;
                occluder._onEnable();
                this._occluderMap.set(index, occluder);
            }
            occluder.pos(px, py);
            occluder.scale(sx, sy);
            occluder.rotation = rot;
            occluder.polygonPoint = polygon;
            occluder.layerMask = layerMask;
            return occluder;
        }
        getOccluder(index) {
            return this._occluderMap.get(index);
        }
        setPos(index, x, y) {
            const occluder = this._occluderMap.get(index);
            if (occluder)
                occluder.pos(x, y);
            return occluder;
        }
        setRot(index, rot) {
            const occluder = this._occluderMap.get(index);
            if (occluder)
                occluder.rotation = rot;
            return occluder;
        }
        setScale(index, x, y) {
            const occluder = this._occluderMap.get(index);
            if (occluder)
                occluder.scale(x, y);
            return occluder;
        }
        removeOccluder(index) {
            const occluder = this._occluderMap.get(index);
            if (occluder)
                occluder.destroy();
            return this._occluderMap.delete(index);
        }
        clearOccluder() {
            this._occluderMap.forEach(occluder => occluder.destroy());
            this._occluderMap.clear();
        }
    }

    var lightGen_vs = "#define SHADER_NAME FreeformLight_VS\n#include \"Sprite2DVertex.glsl\";\nvoid main(){v_texcoord=a_uv;gl_Position=vec4((a_position.x/u_size.x-0.5)*2.0,(a_position.y/u_size.y-0.5)*2.0,0.0,1.0);\n#ifdef INVERTY\ngl_Position.y=-gl_Position.y;\n#endif\n}";

    var lightGen_ps = "#define SHADER_NAME FreeformLight_PS\n#if defined(GL_FRAGMENT_PRECISION_HIGH)\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n#include \"Sprite2DFrag.glsl\";\nvoid main(){gl_FragColor=vec4(v_texcoord.x);}";

    class LightGenShader2D {
        static __init__() {
            this.renderShader = Laya.Shader3D.add('LightGen2D', false, false);
            this.renderShader.shaderType = Laya.ShaderFeatureType.D2_BaseRenderNode2D;
            const subShader = new Laya.SubShader(this.RenderAttribute, {}, {});
            this.renderShader.addSubShader(subShader);
            subShader.addShaderPass(lightGen_vs, lightGen_ps);
        }
    }
    LightGenShader2D.RenderAttribute = {
        'a_position': [0, Laya.ShaderDataType.Vector4],
        'a_uv': [2, Laya.ShaderDataType.Vector2],
    };

    var shadowGen2D_vs = "#define SHADER_NAME ShadowGen2D_VS\n#include \"Sprite2DVertex.glsl\";\nvec2 rotateAndScaleUV(vec2 uv,float rotation,vec2 scale){vec2 mid=vec2(0.5);float c=cos(rotation);float s=sin(rotation);vec2 ret=vec2(c*(uv.x-mid.x)+s*(uv.y-mid.y)+mid.x,c*(uv.y-mid.y)-s*(uv.x-mid.x)+mid.y);return(ret-mid)*scale+mid;}void main(){v_texcoord=rotateAndScaleUV(a_uv,u_LightRotation,u_LightScale);v_color=min(vec4(1.0),u_LightColor*min(1.0,u_LightIntensity)*(1.0-u_Shadow2DStrength)+u_ShadowColor);gl_Position=vec4((a_position.x/u_size.x-0.5)*2.0,(0.5-a_position.y/u_size.y)*2.0,0.0,1.0);\n#ifdef INVERTY\ngl_Position.y=-gl_Position.y;\n#endif\n}";

    var shadowGen2D_ps = "#define SHADER_NAME ShadowGen2D_PS\n#if defined(GL_FRAGMENT_PRECISION_HIGH)\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n#include \"Sprite2DFrag.glsl\";\nvoid main(){vec2 t=step(vec2(0.0),v_texcoord)*step(v_texcoord,vec2(1.0));gl_FragColor=texture2D(u_baseRender2DTexture,v_texcoord)*v_color*t.x*t.y;}";

    class ShadowGenShader2D {
        static __init__() {
            this.renderShader = Laya.Shader3D.add('ShadowGen2D', false, false);
            this.renderShader.shaderType = Laya.ShaderFeatureType.D2_BaseRenderNode2D;
            const subShader = new Laya.SubShader(this.RenderAttribute, this.RenderUniform, {});
            this.renderShader.addSubShader(subShader);
            subShader.addShaderPass(shadowGen2D_vs, shadowGen2D_ps);
        }
    }
    ShadowGenShader2D.RenderUniform = {
        'u_LightColor': Laya.ShaderDataType.Color,
        'u_ShadowColor': Laya.ShaderDataType.Color,
        'u_LightRotation': Laya.ShaderDataType.Float,
        'u_LightIntensity': Laya.ShaderDataType.Float,
        'u_Shadow2DStrength': Laya.ShaderDataType.Float,
        'u_LightScale': Laya.ShaderDataType.Vector2,
        'u_PCFIntensity': Laya.ShaderDataType.Float,
    };
    ShadowGenShader2D.RenderAttribute = {
        'a_position': [0, Laya.ShaderDataType.Vector4],
        'a_uv': [2, Laya.ShaderDataType.Vector2],
    };

    var lightAndShadowGen2D_vs = "#define SHADER_NAME LightAndShadowGen2D_VS\n#include \"Sprite2DVertex.glsl\";\nvec2 rotateAndScaleUV(vec2 uv,float rotation,vec2 scale){vec2 mid=vec2(0.5);float c=cos(rotation);float s=sin(rotation);vec2 ret=vec2(c*(uv.x-mid.x)+s*(uv.y-mid.y)+mid.x,c*(uv.y-mid.y)-s*(uv.x-mid.x)+mid.y);return(ret-mid)*scale+mid;}void main(){v_texcoord=rotateAndScaleUV(a_uv,u_LightRotation,u_LightScale);v_color=u_LightColor*u_LightIntensity*u_PCFIntensity;gl_Position=vec4((a_position.x/u_size.x-0.5)*2.0,(0.5-a_position.y/u_size.y)*2.0,0.0,1.0);\n#ifdef INVERTY\ngl_Position.y=-gl_Position.y;\n#endif\n}";

    var lightAndShadowGen2D_ps = "#define SHADER_NAME LightAndShadowGen2D_PS\n#if defined(GL_FRAGMENT_PRECISION_HIGH)\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n#include \"Sprite2DFrag.glsl\";\nvoid main(){vec2 t=step(vec2(0.0),v_texcoord)*step(v_texcoord,vec2(1.0));gl_FragColor=texture2D(u_baseRender2DTexture,v_texcoord)*v_color*t.x*t.y;}";

    class LightAndShadowGenShader2D {
        static __init__() {
            this.renderShader = Laya.Shader3D.add('LightAndShadowGen2D', false, false);
            this.renderShader.shaderType = Laya.ShaderFeatureType.D2_BaseRenderNode2D;
            const subShader = new Laya.SubShader(this.RenderAttribute, this.RenderUniform, {});
            this.renderShader.addSubShader(subShader);
            subShader.addShaderPass(lightAndShadowGen2D_vs, lightAndShadowGen2D_ps);
        }
    }
    LightAndShadowGenShader2D.RenderUniform = {
        'u_LightColor': Laya.ShaderDataType.Color,
        'u_LightRotation': Laya.ShaderDataType.Float,
        'u_LightIntensity': Laya.ShaderDataType.Float,
        'u_LightScale': Laya.ShaderDataType.Vector2,
        'u_LightTextureSize': Laya.ShaderDataType.Vector2,
        'u_PCFIntensity': Laya.ShaderDataType.Float,
    };
    LightAndShadowGenShader2D.RenderAttribute = {
        'a_position': [0, Laya.ShaderDataType.Vector4],
        'a_uv': [2, Laya.ShaderDataType.Vector2],
    };

    class LightAndShadow {
        static __init__() {
            LightGenShader2D.__init__();
            ShadowGenShader2D.__init__();
            LightAndShadowGenShader2D.__init__();
            BaseLight2D.__init__();
            Light2DManager.__init__();
        }
    }

    class Light2DManager {
        static clampRTSize(size) {
            const max = Laya.LayaGL.renderEngine.getParams(Laya.RenderParams.MAX_Texture_Size);
            if (max > 0 && size > max) {
                console.warn(`[Light2D] RT size ${size} exceeds device MAX_TEXTURE_SIZE (${max}), clamped. Reduce light outerRadius/range to avoid visual truncation on low-end devices.`);
                return max;
            }
            return size;
        }
        get config() {
            return Light2DManager._config;
        }
        set config(value) {
            Light2DManager._config = value;
            for (let i = this._updateMark.length - 1; i > -1; i--)
                this._updateMark[i]++;
        }
        static __init__() {
            if (!Laya.Scene.scene2DUniformMap)
                Laya.Scene.scene2DUniformMap = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap('Sprite2DGlobal');
        }
        constructor(scene) {
            this.lsTarget = [];
            this.lsTargetAdd = [];
            this.lsTargetSub = [];
            this._PCF = [];
            this._segments = [];
            this._points = [];
            this._param = [];
            this._lights = [];
            this._occluders = [];
            this._works = 0;
            this._updateMark = new Array(Light2DManager.MAX_LAYER).fill(1);
            this._updateLayerLight = new Array(Light2DManager.MAX_LAYER).fill(false);
            this._configChangeCount = 0;
            this._spriteLayer = [];
            this._spriteNumInLayer = new Array(Light2DManager.MAX_LAYER).fill(0);
            this._lightLayer = [];
            this._lightLayerAll = [];
            this._lightSceneModeNum = new Array(Light2DManager.MAX_LAYER).fill(0).map(() => [0, 0, 0]);
            this._lightsInLayer = [];
            this._lightsInLayerAll = [];
            this._occluderLayer = [];
            this._occludersInLayer = [];
            this._occludersInLight = [];
            this._lightRenderRes = [];
            this._sceneInv0 = new Laya.Vector3();
            this._sceneInv1 = new Laya.Vector3();
            this._stageMat0 = new Laya.Vector3();
            this._stageMat1 = new Laya.Vector3();
            this._lightScenePos = new Laya.Point();
            this._recoverFC = 0;
            this._needToRecover = [];
            this._needUpdateLightRes = 0;
            this._needCollectLightInLayer = 0;
            this._needCollectOccluderInLight = 0;
            this._lightsNeedCheckRange = [];
            if (Laya.PlayerConfig.light2D) {
                let light2DConfig = Laya.PlayerConfig.light2D;
                Light2DManager._config = new Light2DConfig();
                Light2DManager._config.ambientColor = new Laya.Color(light2DConfig.ambientColor.r, light2DConfig.ambientColor.g, light2DConfig.ambientColor.b, light2DConfig.ambientColor.a);
                Light2DManager._config.ambientLayerMask = light2DConfig.ambientLayerMask;
                if (light2DConfig.lightDirection) {
                    Light2DManager._config.lightDirection = new Laya.Vector3(light2DConfig.lightDirection.x, light2DConfig.lightDirection.y, light2DConfig.lightDirection.z);
                }
                else {
                    Light2DManager._config.lightDirection = new Laya.Vector3(-1, 0, 1);
                }
                Light2DManager._config.multiSamples = light2DConfig.multiSamples;
            }
            this._scene = scene;
            this._scene._light2DManager = this;
            this._screen = new Laya.Rectangle();
            this._screenPrev = new Laya.Vector2();
            this._screenSchmitt = new Laya.Rectangle();
            this._screenSchmittChange = false;
            this.occluderAgent = new Occluder2DAgent(this);
            this._configChangeCount = this.config.changeCount;
            Laya.ILaya.stage.on(Laya.Event.RESIZE, this, this._onScreenResize);
            this._PCF = [
                new Laya.Vector2(0, 0),
                new Laya.Vector2(-1, 0),
                new Laya.Vector2(1, 0),
                new Laya.Vector2(0, -1),
                new Laya.Vector2(0, 1),
                new Laya.Vector2(-1, -1),
                new Laya.Vector2(1, -1),
                new Laya.Vector2(-1, 1),
                new Laya.Vector2(1, 1),
                new Laya.Vector2(-2, -2),
                new Laya.Vector2(2, -2),
                new Laya.Vector2(-2, 2),
                new Laya.Vector2(2, 2),
            ];
        }
        destroy() {
            for (let i = this._lightRenderRes.length - 1; i > -1; i--) {
                if (this._lightRenderRes[i])
                    this._lightRenderRes[i].destroy();
            }
            this._lightRenderRes.length = 0;
        }
        _onScreenResize() {
            this._lights.forEach(light => light._transformChange());
            this._occluders.forEach(occluder => occluder._transformChange());
        }
        _sceneTransformChange() {
        }
        addRender(node) {
            const layer = node.layer;
            this._spriteNumInLayer[layer]++;
            if (this._spriteNumInLayer[layer] === 1)
                this._spriteLayer.push(layer);
        }
        removeRender(node) {
            const layer = node.layer;
            this._spriteNumInLayer[layer]--;
            if (this._spriteNumInLayer[layer] === 0)
                this._spriteLayer.splice(this._spriteLayer.indexOf(layer), 1);
        }
        Init(data) {
        }
        update(dt) {
        }
        _printTextureToConsoleAsBase64(tex) {
            Laya.Utils.uint8ArrayToArrayBufferAsync(tex).then(str => console.log(str));
        }
        _lightTransformChange(light) {
            this.needCheckLightRange(light);
            if (Light2DManager.DEBUG)
                console.log('light transform change', light);
        }
        _checkLightRange(light) {
            const layers = light.layers;
            for (let i = layers.length - 1; i > -1; i--) {
                const layer = layers[i];
                if (!light._isInRange(this._screenSchmitt)) {
                    const mask = (1 << layer);
                    this.needCollectLightInLayer(mask);
                    this._updateLayerLight[layer] = true;
                }
            }
        }
        needCheckLightRange(light) {
            if (this._lightsNeedCheckRange.indexOf(light) < 0)
                this._lightsNeedCheckRange.push(light);
        }
        needCollectLightInLayer(layerMask) {
            this._needCollectLightInLayer |= layerMask;
        }
        needCollectOccluderInLight(layerMask) {
            this._needCollectOccluderInLight |= layerMask;
        }
        lightLayerMaskChange(light, oldLayerMask, newLayerMask) {
            var _a;
            if (this._lights.indexOf(light) !== -1) {
                for (let i = 0; i < Light2DManager.MAX_LAYER; i++) {
                    const mask = 1 << i;
                    const index = (_a = this._lightsInLayerAll[i]) === null || _a === void 0 ? void 0 : _a.indexOf(light);
                    if (newLayerMask & mask) {
                        if (index === undefined || index === -1) {
                            if (!this._lightsInLayerAll[i])
                                this._lightsInLayerAll[i] = [];
                            this._lightsInLayerAll[i].push(light);
                            if (this._lightLayerAll.indexOf(i) === -1)
                                this._lightLayerAll.push(i);
                            this._collectLightInScreenByLayer(i);
                            this._updateLayerLight[i] = true;
                        }
                    }
                    else if (oldLayerMask & mask) {
                        if (index >= 0) {
                            this._lightsInLayerAll[i].splice(index, 1);
                            if (this._lightsInLayerAll[i].length === 0)
                                this._lightLayerAll.splice(this._lightLayerAll.indexOf(i), 1);
                            this._collectLightInScreenByLayer(i);
                            this._updateLayerLight[i] = true;
                        }
                    }
                }
                if (Light2DManager.DEBUG)
                    console.log('light layer mask change', light, oldLayerMask, newLayerMask);
            }
        }
        lightShadowLayerMaskChange(light, oldLayerMask, newLayerMask) {
            this.needCollectOccluderInLight(oldLayerMask | newLayerMask);
            if (Light2DManager.DEBUG)
                console.log('light shadow layer mask change', light, oldLayerMask, newLayerMask);
        }
        lightShadowPCFChange(light) {
            this._updateLightPCF(light);
            if (Light2DManager.DEBUG)
                console.log('light shadow pcf change', light);
        }
        lightShadowEnableChange(light) {
            const layers = light.layers;
            for (let i = layers.length - 1; i > -1; i--)
                if (this._lightRenderRes[layers[i]])
                    this._lightRenderRes[layers[i]].enableShadow(light, this._needToRecover);
        }
        lightRenderOrderChange(light) {
            const layers = light.layers;
            for (let i = layers.length - 1; i > -1; i--)
                this._collectLightInScreenByLayer(layers[i]);
        }
        clearLight() {
            this._lights.length = 0;
            this._lightLayerAll.length = 0;
            this._lightsInLayerAll.length = 0;
            this._lightsNeedCheckRange.length = 0;
        }
        addLight(light) {
            if (this._lights.indexOf(light) === -1) {
                this._lights.push(light);
                const layers = light.layers;
                for (let i = layers.length - 1; i > -1; i--) {
                    const layer = layers[i];
                    if (!this._lightsInLayerAll[layer])
                        this._lightsInLayerAll[layer] = [];
                    this._lightsInLayerAll[layer].push(light);
                    if (this._lightLayerAll.indexOf(layer) === -1)
                        this._lightLayerAll.push(layer);
                    this._collectLightInScreenByLayer(layer);
                }
                if (Light2DManager.DEBUG)
                    console.log('add light', light);
            }
        }
        removeLight(light) {
            const index = this._lights.indexOf(light);
            if (index >= 0) {
                this._lights.splice(index, 1);
                const layers = light.layers;
                for (let i = layers.length - 1; i > -1; i--) {
                    const layer = layers[i];
                    const idx = this._lightsInLayerAll[layer].indexOf(light);
                    if (idx >= 0) {
                        this._lightsInLayerAll[layer].splice(idx, 1);
                        if (this._lightsInLayerAll[layer].length === 0)
                            this._lightLayerAll.splice(this._lightLayerAll.indexOf(layer), 1);
                        this._collectLightInScreenByLayer(layer);
                        if (this.lsTarget[layer])
                            this._updateLayerLight[layer] = true;
                    }
                }
                this._lightsNeedCheckRange.splice(this._lightsNeedCheckRange.indexOf(light), 1);
                if (Light2DManager.DEBUG)
                    console.log('remove light', light);
            }
        }
        clearOccluder() {
            for (let i = this._occluders.length - 1; i > -1; i--)
                this._needCollectOccluderInLight |= this._occluders[i].layerMask;
            this._occluders.length = 0;
            for (let i = this._occluderLayer.length - 1; i > -1; i--)
                this._occludersInLayer[this._occluderLayer[i]].length = 0;
            this._occluderLayer.length = 0;
        }
        addOccluder(occluder) {
            if (this._occluders.indexOf(occluder) === -1) {
                this._occluders.push(occluder);
                const layers = occluder.layers;
                for (let i = layers.length - 1; i > -1; i--) {
                    const layer = layers[i];
                    if (!this._occludersInLayer[layer])
                        this._occludersInLayer[layer] = [];
                    this._occludersInLayer[layer].push(occluder);
                    if (this._occluderLayer.indexOf(layer) === -1)
                        this._occluderLayer.push(layer);
                }
                this._needCollectOccluderInLight |= occluder.layerMask;
                if (Light2DManager.DEBUG)
                    console.log('add occluder', occluder);
            }
        }
        removeOccluder(occluder) {
            const index = this._occluders.indexOf(occluder);
            if (index >= 0) {
                this._occluders.splice(index, 1);
                const layers = occluder.layers;
                for (let i = layers.length - 1; i > -1; i--) {
                    const layer = layers[i];
                    const idx = this._occludersInLayer[layer].indexOf(occluder);
                    if (idx >= 0) {
                        this._occludersInLayer[layer].splice(idx, 1);
                        if (this._occludersInLayer[layer].length === 0)
                            this._occluderLayer.splice(this._occluderLayer.indexOf(layer), 1);
                    }
                }
                this._needCollectOccluderInLight |= occluder.layerMask;
                if (Light2DManager.DEBUG)
                    console.log('remove occluder', occluder);
            }
        }
        occluderLayerMaskChange(occluder, oldLayerMask, newLayerMask) {
            var _a;
            if (this._occluders.indexOf(occluder) !== -1) {
                for (let i = 0; i < Light2DManager.MAX_LAYER; i++) {
                    const mask = 1 << i;
                    const index = (_a = this._occludersInLayer[i]) === null || _a === void 0 ? void 0 : _a.indexOf(occluder);
                    if (newLayerMask & mask) {
                        if (index === undefined || index === -1) {
                            if (!this._occludersInLayer[i])
                                this._occludersInLayer[i] = [];
                            this._occludersInLayer[i].push(occluder);
                            if (this._occluderLayer.indexOf(i) === -1)
                                this._occluderLayer.push(i);
                        }
                    }
                    else if (oldLayerMask & mask) {
                        if (index >= 0) {
                            this._occludersInLayer[i].splice(index, 1);
                            if (this._occludersInLayer[i].length === 0)
                                this._occluderLayer.splice(this._occluderLayer.indexOf(i), 1);
                        }
                    }
                }
                this._needCollectOccluderInLight |= oldLayerMask;
                this._needCollectOccluderInLight |= newLayerMask;
                if (Light2DManager.DEBUG)
                    console.log('occluder layer change', occluder, oldLayerMask, newLayerMask);
            }
        }
        _buildRenderTexture(width, height) {
            width = Light2DManager.clampRTSize(width);
            height = Light2DManager.clampRTSize(height);
            const tex = new Laya.RenderTexture(width, height, Laya.RenderTargetFormat.R8G8B8A8, null, false, this.config.multiSamples);
            tex.wrapModeU = tex.wrapModeV = Laya.WrapMode.Clamp;
            tex.lock = true;
            return tex;
        }
        _collectLightInScreenByLayer(layer) {
            let lights = this._lightsInLayer[layer];
            const lightsAll = this._lightsInLayerAll[layer];
            const lightSceneModeNum = this._lightSceneModeNum[layer];
            if (!lights)
                lights = this._lightsInLayer[layer] = [];
            else
                lights.length = 0;
            if (!lightsAll || lightsAll.length === 0) {
                const index = this._lightLayer.indexOf(layer);
                if (index >= 0)
                    this._lightLayer.splice(index, 1);
                this._updateLayerRenderRes(layer);
                return;
            }
            if (this._screenSchmitt.width === 0
                || this._screenSchmitt.height === 0)
                return;
            for (let i = lightsAll.length - 1; i > -1; i--) {
                if (lightsAll[i]._isInScreen(this._screenSchmitt)) {
                    lights.push(lightsAll[i]);
                    if (this._lightLayer.indexOf(layer) === -1)
                        this._lightLayer.push(layer);
                }
            }
            if (lights.length === 0) {
                const index = this._lightLayer.indexOf(layer);
                if (index >= 0)
                    this._lightLayer.splice(index, 1);
                this._updateLayerRenderRes(layer);
                return;
            }
            if (Light2DManager.SUPPORT_LIGHT_SCENE_MODE) {
                for (let i = 0; i < 3; i++)
                    lightSceneModeNum[i] = 0;
                for (let i = lights.length - 1; i > -1; i--)
                    lightSceneModeNum[lights[i].sceneMode]++;
            }
            if (Light2DManager.SUPPORT_LIGHT_BLEND_MODE)
                lights.sort((a, b) => a.order - b.order);
            const param = this._param[layer];
            const lsTarget = this.lsTarget[layer];
            const x = this._screenSchmitt.x;
            const y = this._screenSchmitt.y;
            const z = this._screenSchmitt.width;
            const w = this._screenSchmitt.height;
            if (!lsTarget) {
                this._param[layer] = new Laya.Vector4(x, y, z, w);
                this.lsTarget[layer] = this._buildRenderTexture(z, w);
                if (Light2DManager.DEBUG)
                    console.log('create light layer texture', x, y, z, w, layer);
            }
            else if (param.z != z || param.w != w) {
                this._needToRecover.push(lsTarget);
                param.setValue(x, y, z, w);
                this.lsTarget[layer] = this._buildRenderTexture(z, w);
                if (Light2DManager.DEBUG)
                    console.log('update light layer texture', x, y, z, w, layer);
            }
            else {
                param.x = x;
                param.y = y;
            }
            if (Light2DManager.SUPPORT_LIGHT_SCENE_MODE) {
                const lsTargetAdd = this.lsTargetAdd[layer];
                const lsTargetSub = this.lsTargetSub[layer];
                if (lightSceneModeNum[exports.Light2DMode.Add] > 0) {
                    if (!lsTargetAdd)
                        this.lsTargetAdd[layer] = this._buildRenderTexture(z, w);
                    else if (lsTargetAdd.width != z || lsTargetAdd.height != w)
                        this._needToRecover.push(lsTargetAdd);
                    this.lsTargetAdd[layer] = this._buildRenderTexture(z, w);
                }
                if (lightSceneModeNum[exports.Light2DMode.Sub] > 0) {
                    if (!lsTargetSub)
                        this.lsTargetSub[layer] = this._buildRenderTexture(z, w);
                    else if (lsTargetSub.width != z || lsTargetSub.height != w)
                        this._needToRecover.push(lsTargetSub);
                    this.lsTargetSub[layer] = this._buildRenderTexture(z, w);
                }
            }
            for (let i = lights.length - 1; i > -1; i--)
                this._collectOccludersInLight(layer, lights[i], i);
            this._needCollectOccluderInLight &= ~(1 << layer);
            this._updateLayerRenderRes(layer);
            this._updateMark[layer]++;
            if (Light2DManager.DEBUG)
                console.log('collect light in screen by layer', layer);
        }
        _updateLayerRenderRes(layer) {
            if (!this._lightRenderRes[layer])
                this._lightRenderRes[layer] = new Light2DRenderRes(this._scene, layer, false);
            this._lightRenderRes[layer].addLights(this._lightsInLayer[layer], this._needToRecover);
            this._needUpdateLightRes |= (1 << layer);
            if (Light2DManager.REUSE_CMD) {
                this._lightRenderRes[layer].setRenderTargetCMD(this.lsTarget[layer], this.lsTargetAdd[layer], this.lsTargetSub[layer]);
                this._lightRenderRes[layer].buildRenderMeshCMD();
            }
            if (Light2DManager.DEBUG)
                console.log('update layer render res', layer);
        }
        _updateLightPCF(light) {
            const layers = light.layers;
            for (let i = layers.length - 1; i > -1; i--) {
                const layer = layers[i];
                if (this._lightRenderRes[layer])
                    this._lightRenderRes[layer].updateLightPCF(light);
            }
        }
        _getOccluderSegment(layer, sn, lightX, lightY, range, shadow) {
            const x = range.x;
            const y = range.y;
            const w = range.width;
            const h = range.height;
            const segments = this._segments;
            if (segments.length >= 4) {
                for (let i = 0; i < 4; i++)
                    Laya.Pool.recover('LightLine2D', segments[i]);
            }
            segments.length = 0;
            segments.push(Laya.Pool.getItemByClass('LightLine2D', LightLine2D).create(x, y, x + w, y));
            segments.push(Laya.Pool.getItemByClass('LightLine2D', LightLine2D).create(x + w, y, x + w, y + h));
            segments.push(Laya.Pool.getItemByClass('LightLine2D', LightLine2D).create(x + w, y + h, x, y + h));
            segments.push(Laya.Pool.getItemByClass('LightLine2D', LightLine2D).create(x, y + h, x, y));
            if (shadow && this._occludersInLight[layer]) {
                const occluders = this._occludersInLight[layer][sn];
                if (occluders) {
                    for (let i = occluders.length - 1; i > -1; i--) {
                        const occluder = occluders[i];
                        if (occluder.selectByLight(lightX, lightY))
                            segments.push(...occluder.getSegment(lightX, lightY));
                    }
                }
            }
            if (Light2DManager.DEBUG)
                console.log('get occluder segment', layer);
            return segments;
        }
        _collectOccludersInLight(layer, light, sn) {
            const occluders = this._occludersInLayer[layer];
            if (occluders) {
                if (!this._occludersInLight[layer])
                    this._occludersInLight[layer] = [];
                if (!this._occludersInLight[layer][sn])
                    this._occludersInLight[layer][sn] = [];
                const result = this._occludersInLight[layer][sn];
                result.length = 0;
                if (light.shadowLayerMask & (1 << layer)) {
                    const range = light.getLightType() == exports.Light2DType.Direction ?
                        light._getShadowRange(this._screenSchmitt) :
                        light._getWorldRange(this._screenSchmitt);
                    for (let i = occluders.length - 1; i > -1; i--)
                        if (occluders[i].isInLightRange(range))
                            result.push(occluders[i]);
                }
            }
        }
        _recoverResource() {
            if (Laya.ILaya.timer.currFrame > this._recoverFC) {
                if (this._needToRecover.length > 0) {
                    for (let i = this._needToRecover.length - 1; i > -1; i--)
                        this._needToRecover[i].destroy();
                    this._needToRecover.length = 0;
                }
                this._recoverFC = Laya.ILaya.timer.currFrame + 10;
            }
        }
        preRenderUpdate() {
            const currentChangeCount = this.config.changeCount;
            if (this._configChangeCount !== currentChangeCount) {
                this._configChangeCount = currentChangeCount;
                for (let i = this._updateMark.length - 1; i > -1; i--)
                    this._updateMark[i]++;
            }
            this._sceneTransformChange();
            const _isLightUpdate = (light) => {
                return light._needUpdateLightAndShadow;
            };
            const _isOccluderUpdate = (layer, sn) => {
                if (this._occludersInLight[layer]
                    && this._occludersInLight[layer][sn]) {
                    const occluders = this._occludersInLight[layer][sn];
                    for (let i = occluders.length - 1; i > -1; i--)
                        if (occluders[i].needUpdate)
                            return true;
                }
                return false;
            };
            this._recoverResource();
            if (!this._updateScreen())
                return;
            if (this._screenSchmittChange) {
                for (let i = this._lightLayerAll.length - 1; i > -1; i--) {
                    const layer = this._lightLayerAll[i];
                    this._collectLightInScreenByLayer(layer);
                }
            }
            else if (this._needCollectLightInLayer !== 0) {
                for (let i = this._lightLayerAll.length - 1; i > -1; i--) {
                    const layer = this._lightLayerAll[i];
                    if (this._needCollectLightInLayer & (1 << layer))
                        this._collectLightInScreenByLayer(layer);
                }
            }
            if (this._needCollectOccluderInLight !== 0) {
                for (let i = this._lightLayerAll.length - 1; i > -1; i--) {
                    const layer = this._lightLayerAll[i];
                    if (this._needCollectOccluderInLight & (1 << layer)) {
                        const lights = this._lightsInLayer[layer];
                        for (let i = lights.length - 1; i > -1; i--)
                            this._collectOccludersInLight(layer, lights[i], i);
                    }
                }
            }
            for (let i = this._lightsNeedCheckRange.length - 1; i > -1; i--)
                this._checkLightRange(this._lightsNeedCheckRange[i]);
            this._lightsNeedCheckRange.length = 0;
            let works = 0;
            let processedLayerMask = 0;
            for (let i = this._lightLayer.length - 1; i > -1; i--) {
                let needRender = false;
                const layer = this._lightLayer[i];
                const renderRes = this._lightRenderRes[layer];
                const occluders = this._occludersInLayer[layer];
                const layerMask = (1 << layer);
                const x = this._screenSchmitt.x;
                const y = this._screenSchmitt.y;
                if (this._spriteNumInLayer[layer] === 0)
                    continue;
                processedLayerMask |= layerMask;
                if (occluders)
                    for (let j = occluders.length - 1; j > -1; j--)
                        occluders[j]._getRange();
                let lightChange = false;
                let screenChange = false;
                let occluderChange = false;
                if (this._screenSchmittChange
                    || (this._needCollectLightInLayer & layerMask) > 0
                    || (this._needCollectOccluderInLight & layerMask) > 0
                    || (this._needUpdateLightRes & layerMask) > 0)
                    screenChange = true;
                if (this._updateLayerLight[layer]) {
                    this._updateLayerLight[layer] = false;
                    screenChange = true;
                }
                const lights = this._lightsInLayer[layer];
                for (let j = 0, len = lights.length; j < len; j++) {
                    const light = lights[j];
                    const lightMesh = renderRes.lightMeshs[j];
                    const shadowMesh = renderRes.shadowMeshs[j];
                    const material = renderRes.material[j];
                    const materialShadow = renderRes.materialShadow[j];
                    light.getGlobalPos(this._lightScenePos);
                    light.renderLightTexture();
                    if (!screenChange) {
                        lightChange = _isLightUpdate(light);
                        occluderChange = _isOccluderUpdate(layer, j);
                    }
                    if (screenChange || occluderChange || lightChange) {
                        for (let k = lightMesh.length - 1; k > -1; k--) {
                            renderRes.updateLightMesh(this._update(layer, x, y, light, lightMesh[k], k, j), j, k);
                            works++;
                        }
                        renderRes.setMaterialData(light, material, false);
                        renderRes.textures[j] = light._texLight;
                        if (light.shadowLayerMask & layerMask) {
                            if (light._isNeedShadowMesh()) {
                                if (materialShadow) {
                                    renderRes.setMaterialData(light, materialShadow, true);
                                    renderRes.updateShadowMesh(this._updateShadow(layer, x, y, light, shadowMesh, j), j);
                                    works++;
                                }
                            }
                            else
                                renderRes.updateShadowMesh(null, j);
                        }
                        else if (shadowMesh) {
                            if (!Light2DManager.REUSE_MESH)
                                this._needToRecover.push(shadowMesh);
                            renderRes.shadowMeshs[j] = null;
                        }
                        needRender = true;
                    }
                    lightChange = false;
                    occluderChange = false;
                }
                if (needRender) {
                    if (Light2DManager.REUSE_CMD)
                        renderRes.updateMaterial();
                    renderRes.render(this.lsTarget[layer], this.lsTargetAdd[layer], this.lsTargetSub[layer]);
                }
            }
            let clearedLayerMask = 0;
            for (let layer = 0; layer < Light2DManager.MAX_LAYER; layer++) {
                if (this._updateLayerLight[layer] && this._lightLayer.indexOf(layer) === -1) {
                    const renderRes = this._lightRenderRes[layer];
                    if (renderRes) {
                        if (this._needUpdateLightRes & (1 << layer) || renderRes.lights.length > 0) {
                            renderRes.addLights([], this._needToRecover);
                            if (Light2DManager.REUSE_CMD) {
                                renderRes.setRenderTargetCMD(this.lsTarget[layer], this.lsTargetAdd[layer], this.lsTargetSub[layer]);
                                renderRes.buildRenderMeshCMD();
                            }
                        }
                        renderRes.render(this.lsTarget[layer], this.lsTargetAdd[layer], this.lsTargetSub[layer]);
                        this._updateMark[layer]++;
                        clearedLayerMask |= (1 << layer);
                    }
                    this._updateLayerLight[layer] = false;
                }
            }
            for (let i = this._lightLayer.length - 1; i > -1; i--) {
                const layer = this._lightLayer[i];
                const layerMask = (1 << layer);
                if (processedLayerMask & layerMask) {
                    const lights = this._lightsInLayer[layer];
                    for (let j = 0, len = lights.length; j < len; j++)
                        lights[j]._needUpdateLightAndShadow = false;
                }
            }
            for (let j = 0, len = this._occluders.length; j < len; j++) {
                const occluder = this._occluders[j];
                if (occluder.layerMask & processedLayerMask)
                    occluder.needUpdate = false;
            }
            this._screenSchmittChange = false;
            this._needUpdateLightRes &= ~(processedLayerMask | clearedLayerMask);
            this._needCollectLightInLayer &= ~(processedLayerMask | clearedLayerMask);
            this._needCollectOccluderInLight &= ~(processedLayerMask | clearedLayerMask);
            if (Light2DManager.DEBUG) {
                if (this._works !== works) {
                    this._works = works;
                    console.log('works =', works);
                }
            }
        }
        _getLayerUpdateMark(layer) {
            return this._updateMark[layer];
        }
        _updateShaderDataByLayer(layer, shaderData) {
            shaderData.setVector3(BaseLight2D.LIGHTANDSHADOW_LIGHT_DIRECTION, this.config.lightDirection);
            if (this.config.ambientLayerMask & (1 << layer))
                shaderData.setColor(BaseLight2D.LIGHTANDSHADOW_AMBIENT, this.config.ambientColor);
            else
                shaderData.setColor(BaseLight2D.LIGHTANDSHADOW_AMBIENT, Laya.Color.CLEAR);
            if (this.lsTarget[layer]) {
                shaderData.removeDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_EMPTY);
                shaderData.setTexture(BaseLight2D.LIGHTANDSHADOW, this.lsTarget[layer]);
            }
            else {
                shaderData.addDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_EMPTY);
                shaderData.setTexture(BaseLight2D.LIGHTANDSHADOW, null);
            }
            if (this._param[layer])
                shaderData.setVector(BaseLight2D.LIGHTANDSHADOW_PARAM, this._param[layer]);
            if (Light2DManager.SUPPORT_LIGHT_SCENE_MODE) {
                if (this.lsTargetAdd[layer]) {
                    if (shaderData.hasDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_EMPTY))
                        shaderData.removeDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_EMPTY);
                    shaderData.addDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_ADDMODE);
                    shaderData.setTexture(BaseLight2D.LIGHTANDSHADOW_ADDMODE, this.lsTargetAdd[layer]);
                }
                else {
                    shaderData.removeDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_ADDMODE);
                    shaderData.setTexture(BaseLight2D.LIGHTANDSHADOW_ADDMODE, null);
                }
                if (this.lsTargetSub[layer]) {
                    if (shaderData.hasDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_EMPTY))
                        shaderData.removeDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_EMPTY);
                    shaderData.addDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_SUBMODE);
                    shaderData.setTexture(BaseLight2D.LIGHTANDSHADOW_SUBMODE, this.lsTargetSub[layer]);
                }
                else {
                    shaderData.removeDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_SUBMODE);
                    shaderData.setTexture(BaseLight2D.LIGHTANDSHADOW_SUBMODE, null);
                }
            }
        }
        _updateScreen() {
            let cameraRect = null;
            if (this._scene && this._scene._area2Ds && this._scene._area2Ds.size > 0) {
                for (const area of this._scene._area2Ds) {
                    const cam = area.mainCamera;
                    if (cam) {
                        const r = cam._rect;
                        if (r && r.y > r.x && r.w > r.z) {
                            cameraRect = r;
                            break;
                        }
                    }
                }
            }
            if (cameraRect) {
                this._screen.x = cameraRect.x | 0;
                this._screen.y = cameraRect.z | 0;
                this._screen.width = (cameraRect.y - cameraRect.x) | 0;
                this._screen.height = (cameraRect.w - cameraRect.z) | 0;
            }
            else {
                this._screen.x = 0;
                this._screen.y = 0;
                this._screen.width = Laya.RenderState2D.width | 0;
                this._screen.height = Laya.RenderState2D.height | 0;
            }
            if (this._screen.width <= 0 || this._screen.height <= 0)
                return false;
            if (this._screen.x < this._screenSchmitt.x
                || this._screen.y < this._screenSchmitt.y
                || this._screen.x + this._screen.width > this._screenSchmitt.x + this._screenSchmitt.width
                || this._screen.y + this._screen.height > this._screenSchmitt.y + this._screenSchmitt.height
                || this._screenPrev.x !== this._screen.width
                || this._screenPrev.y !== this._screen.height) {
                this._screenPrev.x = this._screen.width;
                this._screenPrev.y = this._screen.height;
                this._screenSchmitt.x = (this._screen.x - Light2DManager.SCREEN_SCHMITT_SIZE) | 0;
                this._screenSchmitt.y = (this._screen.y - Light2DManager.SCREEN_SCHMITT_SIZE) | 0;
                this._screenSchmitt.width = (this._screen.width + Light2DManager.SCREEN_SCHMITT_SIZE * 2) | 0;
                this._screenSchmitt.height = (this._screen.height + Light2DManager.SCREEN_SCHMITT_SIZE * 2) | 0;
                this._screenSchmittChange = true;
                for (let i = this._lights.length - 1; i > -1; i--) {
                    if (this._lights[i].getLightType() === exports.Light2DType.Direction)
                        this._lights[i]._needUpdateLightWorldRange = true;
                }
                if (Light2DManager.DEBUG)
                    console.log('screen schmitt change');
            }
            return true;
        }
        _update(layer, layerOffsetX, layerOffsetY, light, mesh, pcf, sn) {
            const _calcLightX = (light, pcf) => {
                if (light.getLightType() === exports.Light2DType.Direction)
                    return this._screen.x + this._screen.width / 2 -
                        (light.directionVector.x +
                            this._PCF[pcf].x * light.shadowFilterSmooth * 0.01) * Light2DManager.DIRECTION_LIGHT_SIZE / 4;
                return (this._lightScenePos.x + this._PCF[pcf].x * light.shadowFilterSmooth);
            };
            const _calcLightY = (light, pcf) => {
                if (light.getLightType() === exports.Light2DType.Direction)
                    return this._screen.y + this._screen.height / 2 -
                        (light.directionVector.y +
                            this._PCF[pcf].y * light.shadowFilterSmooth * 0.01) * Light2DManager.DIRECTION_LIGHT_SIZE / 4;
                return (this._lightScenePos.y + this._PCF[pcf].y * light.shadowFilterSmooth);
            };
            let ret = mesh;
            const lightX = _calcLightX(light, pcf);
            const lightY = _calcLightY(light, pcf);
            const lightRange = light._getLightRange();
            const worldRange = light._getWorldRange(this._screenSchmitt);
            const lightOffsetX = lightRange.x;
            const lightOffsetY = lightRange.y;
            const lightWidth = lightRange.width;
            const lightHeight = lightRange.height;
            const ss = this._getOccluderSegment(layer, sn, lightX, lightY, worldRange, light.shadowEnable);
            const poly = this._getLightPolygon(lightX, lightY, ss);
            const len = poly.length;
            if (len > 2) {
                let index = 0;
                this._points.length = len * 2;
                for (let i = 0; i < len; i++) {
                    this._points[index++] = poly[i].x;
                    this._points[index++] = poly[i].y;
                }
                ret = this._genLightMesh(lightX, lightY, lightWidth, lightHeight, lightOffsetX, lightOffsetY, layerOffsetX, layerOffsetY, this._points, mesh);
            }
            for (let i = 0; i < len; i++)
                Laya.Pool.recover('Vector4', poly[i]);
            return ret;
        }
        _updateShadow(layer, layerOffsetX, layerOffsetY, light, mesh, sn) {
            const _calcLightX = (light) => {
                if (light.getLightType() == exports.Light2DType.Direction)
                    return this._screen.x + this._screen.width / 2 -
                        light.directionVector.x * Light2DManager.DIRECTION_LIGHT_SIZE / 4;
                return this._lightScenePos.x;
            };
            const _calcLightY = (light) => {
                if (light.getLightType() == exports.Light2DType.Direction)
                    return this._screen.y + this._screen.height / 2 -
                        light.directionVector.y * Light2DManager.DIRECTION_LIGHT_SIZE / 4;
                return this._lightScenePos.y;
            };
            let ret = mesh;
            const lightX = _calcLightX(light);
            const lightY = _calcLightY(light);
            const lightRange = light._getLightRange();
            const worldRange = light._getWorldRange(this._screenSchmitt);
            const lightOffsetX = lightRange.x;
            const lightOffsetY = lightRange.y;
            const lightWidth = lightRange.width;
            const lightHeight = lightRange.height;
            const ss = this._getOccluderSegment(layer, sn, lightX, lightY, worldRange, light.shadowEnable);
            const poly = this._getLightPolygon(lightX, lightY, ss);
            const len = poly.length;
            if (len > 2) {
                let index = 0;
                this._points.length = len * 2;
                for (let i = 0; i < len; i++) {
                    this._points[index++] = poly[i].x;
                    this._points[index++] = poly[i].y;
                }
                const radius = Math.sqrt(worldRange.width ** 2 + worldRange.height ** 2) + 10;
                ret = this._genShadowMesh(lightX, lightY, lightWidth, lightHeight, lightOffsetX, lightOffsetY, layerOffsetX, layerOffsetY, this._points, radius, mesh);
            }
            for (let i = 0; i < len; i++)
                Laya.Pool.recover('Vector4', poly[i]);
            return ret;
        }
        _makeOrUpdateMesh(vertices, indices, mesh) {
            if (mesh) {
                const idx = mesh.getIndices();
                const ver = mesh.getVertices()[0];
                if (Light2DManager.REUSE_MESH
                    && idx.length >= indices.length
                    && ver.byteLength >= vertices.byteLength) {
                    mesh.setIndices(indices);
                    mesh.setVertexByIndex(vertices.buffer, 0);
                    mesh.getSubMesh(0).clearRenderParams();
                    mesh.getSubMesh(0).setDrawElemenParams(indices.length, 0);
                    return mesh;
                }
                else
                    this._needToRecover.push(mesh);
            }
            const declaration = Laya.VertexMesh2D.getVertexDeclaration(['POSITION,UV'], false)[0];
            return Laya.Mesh2D.createMesh2DByPrimitive([vertices], [declaration], indices, Laya.IndexFormat.UInt16, [{ length: indices.length, start: 0 }], true);
        }
        _genLightMesh(lightX, lightY, lightWidth, lightHeight, lightOffsetX, lightOffsetY, layerOffsetX, layerOffsetY, inputPoints, mesh) {
            const vertices = new Float32Array((inputPoints.length / 2 + 1) * 5);
            const indices = new Uint16Array(inputPoints.length / 2 * 3);
            const centerX = lightOffsetX + lightWidth / 2;
            const centerY = lightOffsetY + lightHeight / 2;
            vertices[0] = lightX - layerOffsetX;
            vertices[1] = lightY - layerOffsetY;
            vertices[2] = 0;
            vertices[3] = 0.5 - (centerX - lightX) / lightWidth;
            vertices[4] = 0.5 - (centerY - lightY) / lightHeight;
            let index = 5;
            for (let i = 0; i < inputPoints.length; i += 2) {
                vertices[index++] = inputPoints[i + 0] - layerOffsetX;
                vertices[index++] = inputPoints[i + 1] - layerOffsetY;
                vertices[index++] = 0;
                vertices[index++] = 0.5 + (inputPoints[i + 0] - centerX) / lightWidth;
                vertices[index++] = 0.5 + (inputPoints[i + 1] - centerY) / lightHeight;
            }
            index = 0;
            for (let i = 0; i < inputPoints.length - 2; i += 2) {
                indices[index++] = 0;
                indices[index++] = i / 2 + 1;
                indices[index++] = i / 2 + 2;
            }
            indices[index++] = 0;
            indices[index++] = 1;
            indices[index++] = inputPoints.length / 2;
            return this._makeOrUpdateMesh(vertices, indices, mesh);
        }
        _genShadowMesh(lightX, lightY, lightWidth, lightHeight, lightOffsetX, lightOffsetY, layerOffsetX, layerOffsetY, inputPoints, radius, mesh) {
            const points = [];
            const inds = [];
            const len = inputPoints.length;
            const centerX = lightOffsetX + lightWidth / 2;
            const centerY = lightOffsetY + lightHeight / 2;
            let pointX = 0, pointY = 0;
            let interX = 0, interY = 0;
            let dx = 0, dy = 0, length = 0;
            const _getIntersectionPoint = () => {
                dx = pointX - lightX;
                dy = pointY - lightY;
                length = Math.sqrt(dx * dx + dy * dy);
                interX = lightX + dx / length * radius;
                interY = lightY + dy / length * radius;
            };
            for (let i = 0; i < len; i += 2) {
                pointX = inputPoints[i];
                pointY = inputPoints[i + 1];
                _getIntersectionPoint();
                points.push(pointX, pointY, interX, interY);
            }
            let current = 0, next = 0;
            const pointCount = len / 2;
            for (let i = 0; i < pointCount; i++) {
                current = i * 2;
                next = ((i + 1) % pointCount) * 2;
                inds.push(current, current + 1, next);
                inds.push(current + 1, next + 1, next);
            }
            const vertices = new Float32Array(points.length / 2 * 5);
            const indices = new Uint16Array(inds.length);
            indices.set(inds);
            let index = 0;
            for (let i = 0, len = points.length; i < len; i += 2) {
                vertices[index++] = points[i + 0] - layerOffsetX;
                vertices[index++] = points[i + 1] - layerOffsetY;
                vertices[index++] = 0;
                vertices[index++] = 0.5 + (points[i + 0] - centerX) / lightWidth;
                vertices[index++] = 0.5 + (points[i + 1] - centerY) / lightHeight;
            }
            return this._makeOrUpdateMesh(vertices, indices, mesh);
        }
        _getIntersection(ray, segment, result) {
            const r_px = ray.a.x;
            const r_py = ray.a.y;
            const r_dx = ray.b.x - ray.a.x;
            const r_dy = ray.b.y - ray.a.y;
            const s_px = segment.a.x;
            const s_py = segment.a.y;
            const s_dx = segment.b.x - segment.a.x;
            const s_dy = segment.b.y - segment.a.y;
            const r_mag = Math.sqrt(r_dx * r_dx + r_dy * r_dy);
            const s_mag = Math.sqrt(s_dx * s_dx + s_dy * s_dy);
            if (r_dx / r_mag === s_dx / s_mag && r_dy / r_mag === s_dy / s_mag) {
                return false;
            }
            const T2 = (r_dx * (s_py - r_py) + r_dy * (r_px - s_px)) / (s_dx * r_dy - s_dy * r_dx);
            const T1 = (s_px + s_dx * T2 - r_px) / r_dx;
            if (T1 < 0)
                return false;
            if (T2 < 0 || T2 > 1)
                return false;
            result.x = r_px + r_dx * T1;
            result.y = r_py + r_dy * T1;
            result.z = T1;
            result.w = 0;
            return true;
        }
        _getLightPolygon(lightX, lightY, segments) {
            const points = [];
            for (let i = 0, len = segments.length; i < len; i++)
                points.push(segments[i].a, segments[i].b);
            const _uniquePoints = (points) => {
                const set = {};
                return points.filter(p => {
                    const key = p.x + ',' + p.y;
                    if (key in set) {
                        return false;
                    }
                    else {
                        set[key] = true;
                        return true;
                    }
                });
            };
            const uniquePoints = _uniquePoints(points);
            const uniqueAngles = [];
            for (let i = 0, len = uniquePoints.length; i < len; i++) {
                const uniquePoint = uniquePoints[i];
                const angle = Math.atan2(uniquePoint.y - lightY, uniquePoint.x - lightX);
                uniqueAngles.push(angle - 0.0001, angle, angle + 0.0001);
            }
            const ray = Laya.Pool.getItemByClass('LightLine2D', LightLine2D).create(0, 0, 0, 0);
            const result = Laya.Pool.getItemByClass('Vector4', Laya.Vector4);
            let intersects = [];
            for (let i = 0, len = uniqueAngles.length; i < len; i++) {
                const angle = uniqueAngles[i];
                const dx = Math.cos(angle);
                const dy = Math.sin(angle);
                ray.a.x = lightX;
                ray.a.y = lightY;
                ray.b.x = lightX + dx;
                ray.b.y = lightY + dy;
                let closestIntersect;
                for (let i = 0, len = segments.length; i < len; i++) {
                    if (!this._getIntersection(ray, segments[i], result))
                        continue;
                    if (!closestIntersect) {
                        closestIntersect = Laya.Pool.getItemByClass('Vector4', Laya.Vector4);
                        result.cloneTo(closestIntersect);
                    }
                    else if (result.z < closestIntersect.z)
                        closestIntersect.setValue(result.x, result.y, result.z, result.w);
                }
                if (!closestIntersect)
                    continue;
                closestIntersect.w = angle;
                intersects.push(closestIntersect);
            }
            Laya.Pool.recover('LightLine2D', ray);
            Laya.Pool.recover('Vector4', result);
            intersects = intersects.sort((a, b) => { return a.w - b.w; });
            return intersects;
        }
    }
    Light2DManager._managerName = 'Light2DManager';
    Light2DManager.MAX_LAYER = 32;
    Light2DManager.SCREEN_SCHMITT_SIZE = 200;
    Light2DManager.DIRECTION_LIGHT_SIZE = 20000;
    Light2DManager.REUSE_CMD = true;
    Light2DManager.REUSE_MESH = true;
    Light2DManager.DEBUG = false;
    Light2DManager.SUPPORT_LIGHT_BLEND_MODE = true;
    Light2DManager.SUPPORT_LIGHT_SCENE_MODE = true;
    Light2DManager._config = new Light2DConfig();
    Laya.Scene.regManager(Light2DManager._managerName, Light2DManager);
    Laya.Laya.addInitCallback(LightAndShadow.__init__);

    exports.Light2DType = void 0;
    (function (Light2DType) {
        Light2DType[Light2DType["Base"] = 0] = "Base";
        Light2DType[Light2DType["Spot"] = 1] = "Spot";
        Light2DType[Light2DType["Sprite"] = 2] = "Sprite";
        Light2DType[Light2DType["Freeform"] = 3] = "Freeform";
        Light2DType[Light2DType["Direction"] = 4] = "Direction";
    })(exports.Light2DType || (exports.Light2DType = {}));
    exports.Light2DMode = void 0;
    (function (Light2DMode) {
        Light2DMode[Light2DMode["Add"] = 0] = "Add";
        Light2DMode[Light2DMode["Sub"] = 1] = "Sub";
        Light2DMode[Light2DMode["Mul"] = 2] = "Mul";
        Light2DMode[Light2DMode["Mix"] = 3] = "Mix";
    })(exports.Light2DMode || (exports.Light2DMode = {}));
    exports.ShadowFilterType = void 0;
    (function (ShadowFilterType) {
        ShadowFilterType[ShadowFilterType["None"] = 0] = "None";
        ShadowFilterType[ShadowFilterType["PCF5"] = 1] = "PCF5";
        ShadowFilterType[ShadowFilterType["PCF9"] = 2] = "PCF9";
        ShadowFilterType[ShadowFilterType["PCF13"] = 3] = "PCF13";
    })(exports.ShadowFilterType || (exports.ShadowFilterType = {}));
    class BaseLight2D extends Laya.Component {
        static __init__() {
            BaseLight2D.LIGHTANDSHADOW = Laya.Shader3D.propertyNameToID("u_LightAndShadow2D");
            BaseLight2D.LIGHTANDSHADOW_ADDMODE = Laya.Shader3D.propertyNameToID("u_LightAndShadow2D_AddMode");
            BaseLight2D.LIGHTANDSHADOW_SUBMODE = Laya.Shader3D.propertyNameToID("u_LightAndShadow2D_SubMode");
            BaseLight2D.LIGHTANDSHADOW_LIGHT_DIRECTION = Laya.Shader3D.propertyNameToID("u_LightDirection");
            BaseLight2D.LIGHTANDSHADOW_PARAM = Laya.Shader3D.propertyNameToID("u_LightAndShadow2DParam");
            BaseLight2D.LIGHTANDSHADOW_AMBIENT = Laya.Shader3D.propertyNameToID("u_LightAndShadow2DAmbient");
            const sceneUniform = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap("BaseRender2D");
            sceneUniform.addShaderUniform(BaseLight2D.LIGHTANDSHADOW, "u_LightAndShadow2D", Laya.ShaderDataType.Texture2D);
            sceneUniform.addShaderUniform(BaseLight2D.LIGHTANDSHADOW_ADDMODE, "u_LightAndShadow2D_AddMode", Laya.ShaderDataType.Texture2D);
            sceneUniform.addShaderUniform(BaseLight2D.LIGHTANDSHADOW_SUBMODE, "u_LightAndShadow2D_SubMode", Laya.ShaderDataType.Texture2D);
            sceneUniform.addShaderUniform(BaseLight2D.LIGHTANDSHADOW_LIGHT_DIRECTION, "u_LightDirection", Laya.ShaderDataType.Vector3);
            sceneUniform.addShaderUniform(BaseLight2D.LIGHTANDSHADOW_PARAM, "u_LightAndShadow2DParam", Laya.ShaderDataType.Vector4);
            sceneUniform.addShaderUniform(BaseLight2D.LIGHTANDSHADOW_AMBIENT, "u_LightAndShadow2DAmbient", Laya.ShaderDataType.Color);
        }
        get order() {
            return this._order;
        }
        set order(value) {
            if (this._order !== value) {
                this._order = value;
                this._needUpdateLightAndShadow = true;
                this._notifyLightOrderChange();
            }
        }
        get lightMode() {
            return this._lightMode;
        }
        set lightMode(value) {
            if (this._lightMode !== value) {
                this._lightMode = value;
                this._needUpdateLightAndShadow = true;
            }
        }
        get sceneMode() {
            return this._sceneMode;
        }
        set sceneMode(value) {
            if (this._sceneMode !== value) {
                this._sceneMode = value;
                this._needUpdateLightAndShadow = true;
            }
        }
        get color() {
            return this._color;
        }
        set color(value) {
            if (value === this._color || !value.equal(this._color)) {
                value.cloneTo(this._color);
                this._needUpdateLightAndShadow = true;
            }
        }
        get intensity() {
            return this._intensity;
        }
        set intensity(value) {
            if (value !== this._intensity) {
                this._intensity = value;
                this._needUpdateLightAndShadow = true;
            }
        }
        get antiAlias() {
            return this._antiAlias;
        }
        set antiAlias(value) {
            if (value !== this._antiAlias) {
                this._antiAlias = value;
                this._notifyAntiAliasChange();
            }
        }
        get lightRotation() {
            return this._lightRotation;
        }
        set lightRotation(value) {
            if (value !== this._lightRotation) {
                this._lightRotation = value;
                this._needUpdateLightAndShadow = true;
            }
        }
        get lightScale() {
            return this._lightScale;
        }
        set lightScale(value) {
            if (value === this._lightScale || !Laya.Vector2.equals(value, this._lightScale)) {
                value.cloneTo(this._lightScale);
                this._needUpdateLightAndShadow = true;
            }
        }
        get shadowEnable() {
            return this._shadowEnable;
        }
        set shadowEnable(value) {
            if (value !== this._shadowEnable) {
                this._shadowEnable = value;
                this._needUpdateLightAndShadow = true;
                this._notifyShadowEnableChange();
            }
        }
        get shadowColor() {
            return this._shadowColor;
        }
        set shadowColor(value) {
            if (value === this._shadowColor || !value.equal(this._shadowColor)) {
                value.cloneTo(this._shadowColor);
                this._needUpdateLightAndShadow = true;
            }
        }
        get shadowStrength() {
            return this._shadowStrength;
        }
        set shadowStrength(value) {
            if (value !== this._shadowStrength) {
                this._shadowStrength = value;
                this._needUpdateLightAndShadow = true;
            }
        }
        get shadowFilterType() {
            return this._shadowFilterType;
        }
        set shadowFilterType(value) {
            if (value !== this._shadowFilterType) {
                this._shadowFilterType = value;
                this._needUpdateLightAndShadow = true;
                this._notifyShadowPCFChange();
            }
        }
        get shadowFilterSmooth() {
            return this._shadowFilterSmooth;
        }
        set shadowFilterSmooth(value) {
            if (value !== this._shadowFilterSmooth) {
                this._shadowFilterSmooth = value;
                this._needUpdateLightAndShadow = true;
                this._needUpdateLightWorldRange = true;
            }
        }
        get layerMask() {
            return this._layerMask;
        }
        set layerMask(value) {
            if (value !== this._layerMask) {
                this._needUpdateLightAndShadow = true;
                this._notifyLightLayerMaskChange(this._layerMask, value);
                this._layerMask = value;
                this._layers.length = 0;
                for (let i = 0; i < Light2DManager.MAX_LAYER; i++)
                    if (value & (1 << i))
                        this._layers.push(i);
            }
        }
        get layers() {
            return this._layers;
        }
        get shadowLayerMask() {
            return this._shadowLayerMask;
        }
        set shadowLayerMask(value) {
            if (value !== this._shadowLayerMask) {
                this._needUpdateLightAndShadow = true;
                this._notifyShadowCastLayerMaskChange(this._shadowLayerMask, value);
                this._shadowLayerMask = value;
                this._notifyShadowEnableChange();
            }
        }
        constructor() {
            super();
            this._type = exports.Light2DType.Base;
            this._lightMode = exports.Light2DMode.Add;
            this._sceneMode = exports.Light2DMode.Mul;
            this._order = 0;
            this._color = new Laya.Color(1, 1, 1, 1);
            this._intensity = 1;
            this._antiAlias = false;
            this._lightRotation = 0;
            this._lightScale = new Laya.Vector2(1, 1);
            this._layerMask = 1;
            this._layers = [0];
            this._shadowEnable = false;
            this._shadowColor = new Laya.Color(0, 0, 0, 1);
            this._shadowStrength = 0.5;
            this._shadowFilterSmooth = 1;
            this._shadowLayerMask = 1;
            this._shadowFilterType = exports.ShadowFilterType.None;
            this._localRange = new Laya.Rectangle();
            this._worldRange = new Laya.Rectangle();
            this._lightRange = new Laya.Rectangle();
            this._recoverFC = 0;
            this._needToRecover = [];
            this._inScreen = false;
            this._screenCache = new Laya.Rectangle();
            this._texSize = new Laya.Vector2(1, 1);
            this.showLightTexture = false;
            this._needUpdateLight = false;
            this._needUpdateLightAndShadow = false;
            this._needUpdateLightLocalRange = false;
            this._needUpdateLightWorldRange = false;
            this._lightId = BaseLight2D.idCounter++;
        }
        _notifyLightLayerMaskChange(oldLayerMask, newLayerMask) {
            var _a, _b;
            const light2DManager = (_b = (_a = this.owner) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b._light2DManager;
            if (light2DManager) {
                light2DManager.lightLayerMaskChange(this, oldLayerMask, newLayerMask);
                light2DManager.needCollectLightInLayer(newLayerMask);
            }
        }
        _notifyShadowCastLayerMaskChange(oldLayerMask, newLayerMask) {
            var _a, _b, _c;
            (_c = (_b = (_a = this.owner) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b._light2DManager) === null || _c === void 0 ? void 0 : _c.lightShadowLayerMaskChange(this, oldLayerMask, newLayerMask);
        }
        _notifyShadowPCFChange() {
            var _a, _b;
            const light2DManager = (_b = (_a = this.owner) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b._light2DManager;
            if (light2DManager) {
                light2DManager.lightShadowPCFChange(this);
                light2DManager.needCollectLightInLayer(this.layerMask);
            }
        }
        _notifyShadowEnableChange() {
            var _a, _b, _c;
            (_c = (_b = (_a = this.owner) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b._light2DManager) === null || _c === void 0 ? void 0 : _c.lightShadowEnableChange(this);
        }
        _notifyLightOrderChange() {
            var _a, _b, _c;
            if (Light2DManager.SUPPORT_LIGHT_BLEND_MODE)
                (_c = (_b = (_a = this.owner) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b._light2DManager) === null || _c === void 0 ? void 0 : _c.lightRenderOrderChange(this);
        }
        _notifyAntiAliasChange() { }
        _onEnable() {
            var _a, _b;
            super._onEnable();
            this.owner.on(Laya.Event.TRANSFORM_CHANGED, this, this._transformChange);
            (_b = (_a = this.owner.scene) === null || _a === void 0 ? void 0 : _a._light2DManager) === null || _b === void 0 ? void 0 : _b.addLight(this);
        }
        _onDisable() {
            var _a, _b;
            super._onDisable();
            this._clearScreenCache();
            this.owner.off(Laya.Event.TRANSFORM_CHANGED, this, this._transformChange);
            (_b = (_a = this.owner.scene) === null || _a === void 0 ? void 0 : _a._light2DManager) === null || _b === void 0 ? void 0 : _b.removeLight(this);
        }
        _onDestroy() { }
        _transformChange() {
            var _a, _b, _c;
            this._clearScreenCache();
            this._needUpdateLightAndShadow = true;
            this._needUpdateLightWorldRange = true;
            (_c = (_b = (_a = this.owner) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b._light2DManager) === null || _c === void 0 ? void 0 : _c._lightTransformChange(this);
        }
        _clearScreenCache() {
            this._screenCache.width = 0;
            this._screenCache.height = 0;
        }
        _pcfIntensity() {
            switch (this.shadowFilterType) {
                default:
                case exports.ShadowFilterType.None:
                    return 1;
                case exports.ShadowFilterType.PCF5:
                    return 1 / 5;
                case exports.ShadowFilterType.PCF9:
                    return 1 / 9;
                case exports.ShadowFilterType.PCF13:
                    return 1 / 13;
            }
        }
        _getLocalRange() {
            if (this._needUpdateLightLocalRange)
                this._calcLocalRange();
            return this._localRange;
        }
        _getWorldRange(screen) {
            if (this._needUpdateLightLocalRange)
                this._calcLocalRange();
            if (this._needUpdateLightWorldRange)
                this._calcWorldRange(screen);
            return this._worldRange;
        }
        _getLightRange(screen) {
            if (this._needUpdateLightLocalRange)
                this._calcLocalRange();
            if (this._needUpdateLightWorldRange)
                this._calcWorldRange(screen);
            return this._lightRange;
        }
        _getTextureSize() {
            if (this._texLight) {
                this._texSize.x = this._texLight.width;
                this._texSize.y = this._texLight.height;
            }
            return this._texSize;
        }
        _isNeedShadowMesh() {
            return (!this._shadowColor.equal(Laya.Color.BLACK) || this._shadowStrength < 1) && this.shadowEnable;
        }
        _rectContain(rect1, rect2) {
            return (rect2.x >= rect1.x &&
                rect2.y >= rect1.y &&
                (rect2.x + rect2.width) <= (rect1.x + rect1.width) &&
                (rect2.y + rect2.height) <= (rect1.y + rect1.height));
        }
        getLightType() {
            return this._type;
        }
        getGlobalPosX() {
            return this.owner.globalTrans.x;
        }
        getGlobalPosY() {
            return this.owner.globalTrans.y;
        }
        getGlobalPos(out) {
            this.owner.globalTrans.getPos(out);
            return out;
        }
        setLayerMaskByList(layerList) {
            let layer = 0;
            for (let i = layerList.length - 1; i > -1; i--)
                layer |= (1 << layerList[i]);
            this.layerMask = layer;
        }
        isLayerEnable(layer) {
            return (this.layerMask & (1 << layer));
        }
        setShadowLayerMaskByList(layerList) {
            let shadowLayer = 0;
            for (let i = layerList.length - 1; i > -1; i--)
                shadowLayer |= (1 << layerList[i]);
            this.shadowLayerMask = shadowLayer;
        }
        isShadowLayerEnable(layer) {
            return (this.shadowLayerMask & (1 << layer));
        }
        _printTextureToConsoleAsBase64() {
            if (this._texLight)
                Laya.Utils.uint8ArrayToArrayBufferAsync(this._texLight).then(str => console.log(str));
        }
        _calcLocalRange() {
            this._needUpdateLightLocalRange = false;
        }
        _calcWorldRange(screen) {
            var _a, _b, _c;
            this._needUpdateLightWorldRange = false;
            (_c = (_b = (_a = this.owner) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b._light2DManager) === null || _c === void 0 ? void 0 : _c.needCheckLightRange(this);
        }
        _lightScaleAndRotation() {
            const sx = this.owner.globalTrans.scaleX;
            const sy = this.owner.globalTrans.scaleY;
            Laya.Vector2.TEMP.x = 1 / sx;
            Laya.Vector2.TEMP.y = 1 / sy;
            this.lightScale = Laya.Vector2.TEMP;
            this.lightRotation = this.owner.globalTrans.getSceneRotation() * Math.PI / 180;
        }
        renderLightTexture() {
            if (Laya.ILaya.timer.currFrame > this._recoverFC) {
                if (this._needToRecover.length > 0) {
                    for (let i = this._needToRecover.length - 1; i > -1; i--)
                        this._needToRecover[i].destroy();
                    this._needToRecover.length = 0;
                }
                this._recoverFC = Laya.ILaya.timer.currFrame + 10;
            }
        }
        _isInRange(range) {
            return range && this._rectContain(range, this._getWorldRange());
        }
        _isInScreen(screen) {
            const cache = this._screenCache;
            if (cache.x === screen.x
                && cache.y === screen.y
                && cache.width === screen.width
                && cache.right === screen.height) {
                return this._inScreen;
            }
            this._inScreen = this._getWorldRange().intersects(screen);
            screen.cloneTo(cache);
            return this._inScreen;
        }
        _makeOrUpdateMesh(points, inds, mesh, recover) {
            const vertices = new Float32Array(points.length * 5);
            const indices = new Uint16Array(inds);
            let index = 0, p;
            for (let i = 0, len = points.length; i < len; i++) {
                p = points[i];
                vertices[index++] = p.x;
                vertices[index++] = p.y;
                vertices[index++] = 0;
                vertices[index++] = p.z;
                vertices[index++] = 0;
            }
            if (mesh) {
                const idx = mesh.getIndices();
                const ver = mesh.getVertices()[0];
                if (Light2DManager.REUSE_MESH
                    && idx.length >= indices.length
                    && ver.byteLength >= vertices.byteLength) {
                    mesh.setIndices(indices);
                    mesh.setVertexByIndex(vertices.buffer, 0);
                    mesh.getSubMesh(0).clearRenderParams();
                    mesh.getSubMesh(0).setDrawElemenParams(indices.length, 0);
                    return mesh;
                }
                else if (recover)
                    recover.push(mesh);
            }
            const declaration = Laya.VertexMesh2D.getVertexDeclaration(['POSITION,UV'], false)[0];
            return Laya.Mesh2D.createMesh2DByPrimitive([vertices], [declaration], indices, Laya.IndexFormat.UInt16, [{ length: indices.length, start: 0 }], true);
        }
    }
    BaseLight2D.idCounter = 0;

    class DirectionLight2D extends BaseLight2D {
        constructor(directionAngle = 0) {
            super();
            this._directionAngle = 0;
            this._directionVector = new Laya.Vector2(1, 0);
            this._shadowDistance = 500;
            this._shadowRange = new Laya.Rectangle();
            this._type = exports.Light2DType.Direction;
            this.directionAngle = directionAngle;
            this._calcLocalRange();
        }
        get directionAngle() {
            return this._directionAngle;
        }
        set directionAngle(value) {
            value %= 360;
            if (this._directionAngle !== value) {
                this._directionAngle = value;
                this._directionVector.x = Math.cos(this._directionAngle * Math.PI / 180);
                this._directionVector.y = Math.sin(this._directionAngle * Math.PI / 180);
                this._needUpdateLightAndShadow = true;
            }
        }
        get directionVector() {
            return this._directionVector;
        }
        set directionVector(value) {
            const len = Laya.Vector2.scalarLength(value);
            if (len > 0) {
                const x = value.x / len;
                const y = value.y / len;
                if (value === this._directionVector
                    || this._directionVector.x !== x || this._directionVector.y !== y) {
                    this._directionAngle = Math.atan2(y, x) * 180 / Math.PI;
                    this._directionVector.x = x;
                    this._directionVector.y = y;
                    this._needUpdateLightAndShadow = true;
                }
            }
        }
        get shadowDistance() {
            return this._shadowDistance;
        }
        set shadowDistance(value) {
            var _a, _b, _c;
            if (this._shadowDistance !== value) {
                this._shadowDistance = value;
                this._needUpdateLightAndShadow = true;
                (_c = (_b = (_a = this.owner) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b._light2DManager) === null || _c === void 0 ? void 0 : _c.needCollectOccluderInLight(this.layerMask);
            }
        }
        _getWorldRange(screen) {
            if (screen && !this._screenCache.equals(screen)) {
                screen.cloneTo(this._screenCache);
                this._calcWorldRange(screen);
            }
            return this._worldRange;
        }
        _calcLocalRange() {
            super._calcLocalRange();
            this._localRange.x = -Light2DManager.DIRECTION_LIGHT_SIZE / 2;
            this._localRange.y = -Light2DManager.DIRECTION_LIGHT_SIZE / 2;
            this._localRange.width = Light2DManager.DIRECTION_LIGHT_SIZE;
            this._localRange.height = Light2DManager.DIRECTION_LIGHT_SIZE;
        }
        _calcWorldRange(screen) {
            super._calcWorldRange(screen);
            this._worldRange.x = this._localRange.x + (screen ? (screen.x | 0) : 0);
            this._worldRange.y = this._localRange.y + (screen ? (screen.y | 0) : 0);
            this._worldRange.width = this._localRange.width;
            this._worldRange.height = this._localRange.height;
            this._lightRange.x = this._worldRange.x;
            this._lightRange.y = this._worldRange.x;
            this._lightRange.width = this._worldRange.width;
            this._lightRange.height = this._worldRange.height;
        }
        _getShadowRange(screen) {
            this._shadowRange.x = -this._shadowDistance / 2 + (screen ? (screen.x | 0) : 0);
            this._shadowRange.y = -this._shadowDistance / 2 + (screen ? (screen.y | 0) : 0);
            this._shadowRange.width = Light2DManager.DIRECTION_LIGHT_SIZE;
            this._shadowRange.height = Light2DManager.DIRECTION_LIGHT_SIZE;
            return this._shadowRange;
        }
        _isInRange(range) {
            return true;
        }
        _isInScreen(screen) {
            return true;
        }
    }

    class FreeformLight2D extends BaseLight2D {
        constructor() {
            super();
            this._falloffRange = 1;
            this._localCenter = new Laya.Vector2();
            this._type = exports.Light2DType.Freeform;
            this._material = new Laya.Material();
            this._material.setShaderName('LightGen2D');
            this._material.setBoolByIndex(Laya.Shader3D.DEPTH_WRITE, false);
            this._material.setIntByIndex(Laya.Shader3D.DEPTH_TEST, Laya.RenderState.DEPTHTEST_OFF);
            this._material.setIntByIndex(Laya.Shader3D.BLEND, Laya.RenderState.BLEND_ENABLE_ALL);
            this._material.setIntByIndex(Laya.Shader3D.BLEND_EQUATION, Laya.RenderState.BLENDEQUATION_ADD);
            this._material.setIntByIndex(Laya.Shader3D.BLEND_SRC, Laya.RenderState.BLENDPARAM_SRC_ALPHA);
            this._material.setIntByIndex(Laya.Shader3D.BLEND_DST, Laya.RenderState.BLENDPARAM_ONE_MINUS_SRC_ALPHA);
            this._material.setIntByIndex(Laya.Shader3D.CULL, Laya.RenderState.CULL_NONE);
            this._cmdBuffer = new Laya.CommandBuffer2D('Light2DRender_Freeform');
            this._defaultPoly();
        }
        get falloffRange() {
            return this._falloffRange;
        }
        set falloffRange(value) {
            if (this._falloffRange !== value) {
                this._falloffRange = value;
                this._needUpdateLight = true;
                this._needUpdateLightLocalRange = true;
                this._needUpdateLightWorldRange = true;
                this._clearScreenCache();
                this._limitParam();
            }
        }
        _defaultPoly() {
            if (!this._lightPolygon) {
                const poly = new PolygonPoint2D();
                poly.addPoint(-100, -100);
                poly.addPoint(100, -100);
                poly.addPoint(100, 100);
                poly.addPoint(-100, 100);
                this.polygonPoint = poly;
            }
        }
        set polygonPoint(poly) {
            var _a, _b, _c;
            const light2DManager = (_b = (_a = this.owner) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b._light2DManager;
            if (poly) {
                this._lightPolygon = poly;
                this._globalPolygon = poly.clone();
                this._needUpdateLight = true;
                this._needUpdateLightLocalRange = true;
                this._needUpdateLightWorldRange = true;
                this._clearScreenCache();
                if (this.enabled && ((_c = this.owner) === null || _c === void 0 ? void 0 : _c.activeInHierarchy))
                    light2DManager === null || light2DManager === void 0 ? void 0 : light2DManager.addLight(this);
            }
            else {
                this._lightPolygon = null;
                this._globalPolygon = null;
                light2DManager === null || light2DManager === void 0 ? void 0 : light2DManager.removeLight(this);
            }
            light2DManager === null || light2DManager === void 0 ? void 0 : light2DManager.needCollectLightInLayer(this.layerMask);
        }
        get polygonPoint() {
            return this._lightPolygon;
        }
        getGlobalPosX() {
            return super.getGlobalPosX() + this._localCenter.x;
        }
        getGlobalPosY() {
            return super.getGlobalPosY() + this._localCenter.y;
        }
        _transformChange() {
            var _a, _b, _c;
            if (this._lightPolygon) {
                this._clearScreenCache();
                this._needUpdateLightAndShadow = true;
                this._needUpdateLightWorldRange = true;
                (_c = (_b = (_a = this.owner) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b._light2DManager) === null || _c === void 0 ? void 0 : _c._lightTransformChange(this);
            }
        }
        _calcLocalRange() {
            super._calcLocalRange();
            let xmin = Number.POSITIVE_INFINITY;
            let ymin = Number.POSITIVE_INFINITY;
            let xmax = Number.NEGATIVE_INFINITY;
            let ymax = Number.NEGATIVE_INFINITY;
            const polygon = this._lightPolygon.points;
            for (let i = polygon.length - 2; i > -1; i -= 2) {
                const x = polygon[i + 0];
                const y = polygon[i + 1];
                if (xmin > x)
                    xmin = x;
                if (xmax < x)
                    xmax = x;
                if (ymin > y)
                    ymin = y;
                if (ymax < y)
                    ymax = y;
            }
            let x = (xmax - xmin);
            let y = (ymax - ymin);
            const t = this._falloffRange * FreeformLight2D.FALLOF_WIDTH;
            const w = (x + 2 + t * 2) | 0;
            const h = (y + 2 + t * 2) | 0;
            this._localCenter.x = (xmax + xmin) / 2;
            this._localCenter.y = (ymax + ymin) / 2;
            this._localRange.x = -w / 2;
            this._localRange.y = -h / 2;
            this._localRange.width = w;
            this._localRange.height = h;
        }
        _calcWorldRange(screen) {
            super._calcWorldRange(screen);
            this._lightScaleAndRotation();
            let globalTrans = this.owner.globalTrans;
            const pp = globalTrans.getPos(Laya.Point.TEMP);
            const px = pp.x;
            const py = pp.y;
            const sx = globalTrans.scaleX;
            const sy = globalTrans.scaleY;
            const x = this._localRange.x;
            const y = this._localRange.y;
            const w = this._localRange.width;
            const h = this._localRange.height;
            const m = Math.sqrt((w * sx) ** 2 + (h * sy) ** 2) * 1.2 | 0;
            this._worldRange.x = (px - m / 2 + this._localCenter.x) | 0;
            this._worldRange.y = (py - m / 2 + this._localCenter.y) | 0;
            this._worldRange.width = m;
            this._worldRange.height = m;
            this._lightRange.x = (px + x + this._localCenter.x) | 0;
            this._lightRange.y = (py + y + this._localCenter.y) | 0;
            this._lightRange.width = w;
            this._lightRange.height = h;
            const polygon = this._globalPolygon.points;
            this._lightPolygon.cloneTo(this._globalPolygon);
            for (let i = polygon.length - 2; i > -1; i -= 2) {
                polygon[i + 0] -= (x + this._localCenter.x);
                polygon[i + 1] -= (y + this._localCenter.y);
            }
        }
        _notifyAntiAliasChange() {
            const range = this._getLocalRange();
            this._buildRenderTexture(range.width, range.height);
            this._needUpdateLight = true;
        }
        _buildRenderTexture(width, height) {
            width = Light2DManager.clampRTSize(width);
            height = Light2DManager.clampRTSize(height);
            if (this._texLight)
                this._texLight.destroy();
            const tex = this._texLight = new Laya.RenderTexture(width, height, Laya.RenderTargetFormat.R8G8B8A8, null, false, this.antiAlias ? 4 : 1);
            tex.wrapModeU = tex.wrapModeV = Laya.WrapMode.Clamp;
            if (!this._cmdRT)
                this._cmdRT = Laya.Set2DRTCMD.create(tex, true, Laya.Color.CLEAR, false);
            else
                this._cmdRT.renderTexture = tex;
            tex.lock = true;
        }
        renderLightTexture() {
            var _a;
            super.renderLightTexture();
            if (this._needUpdateLight) {
                this._needUpdateLight = false;
                const range = this._getLocalRange();
                const width = Light2DManager.clampRTSize(range.width);
                const height = Light2DManager.clampRTSize(range.height);
                if (width === 0 || height === 0)
                    return;
                if (!this._texLight || !(this._texLight instanceof Laya.RenderTexture)) {
                    this._buildRenderTexture(width, height);
                    if (Light2DManager.DEBUG)
                        console.log('create freeform light texture', width, height);
                }
                else if (this._texLight.width !== width || this._texLight.height !== height) {
                    this._buildRenderTexture(width, height);
                    if (Light2DManager.DEBUG)
                        console.log('update freeform light texture size', width, height);
                }
                this._getWorldRange();
                const mesh = this._createMesh(this._falloffRange * FreeformLight2D.FALLOF_WIDTH, 8, (_a = this._cmdMesh) === null || _a === void 0 ? void 0 : _a.mesh, this._needToRecover);
                mesh.lock = true;
                if (!this._cmdMesh)
                    this._cmdMesh = Laya.DrawMesh2DCMD.create(mesh, Laya.Matrix.EMPTY, Laya.Texture2D.whiteTexture, Laya.Color.WHITE, this._material);
                else
                    this._cmdMesh.mesh = mesh;
                this._cmdBuffer.addCacheCommand(this._cmdRT);
                this._cmdBuffer.addCacheCommand(this._cmdMesh);
                this._cmdBuffer.apply(true);
                this._cmdBuffer.clear(false);
                this._needUpdateLightAndShadow = true;
                if (Light2DManager.DEBUG) {
                    if (this.showLightTexture)
                        this._printTextureToConsoleAsBase64();
                    console.log('update freeform light texture contain');
                }
            }
        }
        _limitParam() {
            this._falloffRange = Math.max(Math.min(this._falloffRange, 10), 0);
        }
        _createMesh(expand, arcSegments = 8, mesh, recover) {
            const points = [];
            const inds = [];
            const poly = this._globalPolygon.points;
            const len = poly.length / 2 | 0;
            const normal1 = new Laya.Vector2();
            const normal2 = new Laya.Vector2();
            const _isConvex = (ax, ay, bx, by, cx, cy) => {
                return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax) > 0;
            };
            const _getNormal = (ax, ay, bx, by, n) => {
                const dx = bx - ax;
                const dy = by - ay;
                const length = Math.sqrt(dx * dx + dy * dy);
                n.x = dy / length;
                n.y = -dx / length;
            };
            const _intersection = (p1, p2, p3, p4) => {
                const d1 = { x: p2.x - p1.x, y: p2.y - p1.y };
                const d2 = { x: p4.x - p3.x, y: p4.y - p3.y };
                const denominator = d1.x * d2.y - d1.y * d2.x;
                if (Math.abs(denominator) < Number.EPSILON)
                    return null;
                const t = ((p3.x - p1.x) * d2.y - (p3.y - p1.y) * d2.x) / denominator;
                const u = ((p3.x - p1.x) * d1.y - (p3.y - p1.y) * d1.x) / denominator;
                if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
                    return new Laya.Vector3(p1.x + t * d1.x, p1.y + t * d1.y, p1.z);
                }
                return null;
            };
            for (let i = 0; i < len; i++)
                points.push(new Laya.Vector3(poly[i * 2], poly[i * 2 + 1], 1));
            for (let i = 0; i < len; i++) {
                const prev = i - 1 >= 0 ? i - 1 : len - 1;
                const next = (i + 1) % len;
                const next2 = (i + 2) % len;
                _getNormal(poly[i * 2], poly[i * 2 + 1], poly[next * 2], poly[next * 2 + 1], normal1);
                _getNormal(poly[next * 2], poly[next * 2 + 1], poly[next2 * 2], poly[next2 * 2 + 1], normal2);
                const start = points.length;
                const p1 = new Laya.Vector3(poly[i * 2] + expand * normal1.x, poly[i * 2 + 1] + expand * normal1.y, 0);
                const p2 = new Laya.Vector3(poly[next * 2] + expand * normal1.x, poly[next * 2 + 1] + expand * normal1.y, 0);
                if (_isConvex(poly[i * 2], poly[i * 2 + 1], poly[next * 2], poly[next * 2 + 1], poly[next2 * 2], poly[next2 * 2 + 1])) {
                    const angle1 = Math.atan2(normal1.y, normal1.x);
                    const angle2 = Math.atan2(normal2.y, normal2.x);
                    let angleDiff = angle2 - angle1;
                    if (angleDiff < 0)
                        angleDiff += Math.PI * 2;
                    if (_isConvex(poly[prev * 2], poly[prev * 2 + 1], poly[i * 2], poly[i * 2 + 1], poly[next * 2], poly[next * 2 + 1]))
                        points.push(p1, p2);
                    else {
                        _getNormal(poly[prev * 2], poly[prev * 2 + 1], poly[i * 2], poly[i * 2 + 1], normal1);
                        const p3 = new Laya.Vector3(poly[prev * 2] + expand * normal1.x, poly[prev * 2 + 1] + expand * normal1.y, 0);
                        const p4 = new Laya.Vector3(poly[i * 2] + expand * normal1.x, poly[i * 2 + 1] + expand * normal1.y, 0);
                        let t = _intersection(p1, p2, p3, p4);
                        if (!t)
                            t = p1;
                        points.push(t, p2);
                    }
                    inds.push(i, start, start + 1);
                    inds.push(i, start + 1, next);
                    for (let j = 1; j <= arcSegments; j++) {
                        const angle = angle1 + (angleDiff * j) / arcSegments;
                        points.push(new Laya.Vector3(poly[next * 2 + 0] + expand * Math.cos(angle), poly[next * 2 + 1] + expand * Math.sin(angle), 0));
                        inds.push(next, start + j, start + j + 1);
                    }
                }
                else {
                    const p3 = new Laya.Vector3(poly[next * 2] + expand * normal2.x, poly[next * 2 + 1] + expand * normal2.y, 0);
                    const p4 = new Laya.Vector3(poly[next2 * 2] + expand * normal2.x, poly[next2 * 2 + 1] + expand * normal2.y, 0);
                    let t = _intersection(p1, p2, p3, p4);
                    if (!t)
                        t = p2;
                    points.push(p1, t, p4);
                    inds.push(i, start, start + 1);
                    inds.push(i, start + 1, next);
                }
            }
            inds.push(...this._earCut(poly));
            return this._makeOrUpdateMesh(points, inds, mesh, recover);
        }
        _earCut(polygon) {
            const vertices = [];
            let len = polygon.length / 2 | 0;
            for (let i = 0; i < len; i++)
                vertices.push({ x: polygon[i * 2], y: polygon[i * 2 + 1], index: i });
            const triangles = [];
            len = vertices.length;
            if (len < 3)
                return triangles;
            const indices = vertices.map((_, i) => i);
            let vertexCount = len;
            let i = 0, stop = vertexCount;
            while (vertexCount > 2) {
                stop--;
                if (i >= vertexCount)
                    i = 0;
                const a = indices[i];
                const b = indices[(i + 1) % vertexCount];
                const c = indices[(i + 2) % vertexCount];
                if (this._isEarTip(vertices, indices, vertexCount, a, b, c)) {
                    triangles.push(vertices[a].index, vertices[b].index, vertices[c].index);
                    indices.splice((i + 1) % vertexCount, 1);
                    vertexCount--;
                    stop = vertexCount;
                }
                else
                    i++;
                if (stop <= 0)
                    break;
            }
            return triangles;
        }
        _isEarTip(vertices, indices, vertexCount, a, b, c) {
            const _isConvex = (a, b, c) => {
                return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) >= 0;
            };
            return _isConvex(vertices[a], vertices[b], vertices[c]) &&
                !this._containsAnyPoint(vertices, indices, vertexCount, vertices[a], vertices[b], vertices[c], [a, b, c]);
        }
        _containsAnyPoint(vertices, indices, vertexCount, a, b, c, exclude) {
            const _pointInTriangle = (p, a, b, c) => {
                const _triangleArea = (a, b, c) => {
                    return ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
                };
                const area = _triangleArea(a, b, c);
                const area1 = _triangleArea(p, b, c);
                const area2 = _triangleArea(a, p, c);
                const area3 = _triangleArea(a, b, p);
                if (Math.abs(area) < Number.EPSILON)
                    return false;
                const u = area1 / area;
                const v = area2 / area;
                const w = area3 / area;
                return u >= 0 && v >= 0 && w >= 0 && Math.abs(u + v + w - 1) < Number.EPSILON;
            };
            for (let i = 0; i < vertexCount; i++) {
                const index = indices[i];
                if (exclude.includes(index))
                    continue;
                if (_pointInTriangle(vertices[index], a, b, c))
                    return true;
            }
            return false;
        }
        _onDestroy() {
            super._onDestroy();
            if (this._texLight) {
                this._texLight.destroy();
                this._texLight = null;
            }
        }
    }
    FreeformLight2D.FALLOF_WIDTH = 100;

    class LightOccluder2D extends Laya.Component {
        get layerMask() {
            return this._core.layerMask;
        }
        set layerMask(value) {
            this._core.layerMask = value;
        }
        get canInLight() {
            return this._core.canInLight;
        }
        set canInLight(value) {
            this._core.canInLight = value;
        }
        get outside() {
            return this._core.outside;
        }
        set outside(value) {
            this._core.outside = value;
        }
        get polygonPoint() {
            return this._core.polygonPoint;
        }
        set polygonPoint(poly) {
            this._core.polygonPoint = poly;
        }
        constructor() {
            super();
            this._core = new LightOccluder2DCore();
        }
        _onEnable() {
            var _a;
            super._onEnable();
            this.owner.on(Laya.Event.TRANSFORM_CHANGED, this._core, this._core._transformChange);
            this._core.owner = this.owner;
            this._core.manager = (_a = this.owner.scene) === null || _a === void 0 ? void 0 : _a._light2DManager;
            this._core._onEnable();
        }
        _onDisable() {
            super._onDisable();
            this.owner.off(Laya.Event.TRANSFORM_CHANGED, this._core, this._core._transformChange);
            this._core._onDisable();
        }
    }

    class SpotLight2D extends BaseLight2D {
        constructor(innerRadius = 100, outerRadius = 200, innerAngle = 90, outerAngle = 120, falloff = 1) {
            super();
            this._falloffIntensity = 1;
            this._type = exports.Light2DType.Spot;
            this._innerAngle = innerAngle;
            this._outerAngle = outerAngle;
            this._innerRadius = innerRadius;
            this._outerRadius = outerRadius;
            this._falloffIntensity = falloff;
            this._needUpdateLight = true;
            this._needUpdateLightLocalRange = true;
            this._needUpdateLightWorldRange = true;
            this._limitParam();
            this._material = new Laya.Material();
            this._material.setShaderName('LightGen2D');
            this._material.setBoolByIndex(Laya.Shader3D.DEPTH_WRITE, false);
            this._material.setIntByIndex(Laya.Shader3D.DEPTH_TEST, Laya.RenderState.DEPTHTEST_OFF);
            this._material.setIntByIndex(Laya.Shader3D.BLEND, Laya.RenderState.BLEND_ENABLE_ALL);
            this._material.setIntByIndex(Laya.Shader3D.BLEND_EQUATION, Laya.RenderState.BLENDEQUATION_ADD);
            this._material.setIntByIndex(Laya.Shader3D.BLEND_SRC, Laya.RenderState.BLENDPARAM_ONE);
            this._material.setIntByIndex(Laya.Shader3D.BLEND_DST, Laya.RenderState.BLENDPARAM_ONE);
            this._material.setIntByIndex(Laya.Shader3D.CULL, Laya.RenderState.CULL_NONE);
            this._cmdBuffer = new Laya.CommandBuffer2D('Light2DRender_Spot');
        }
        get innerRadius() {
            return this._innerRadius;
        }
        set innerRadius(value) {
            if (this._innerRadius !== value) {
                this._innerRadius = value;
                this._needUpdateLight = true;
                this._needUpdateLightLocalRange = true;
                this._needUpdateLightWorldRange = true;
                super._clearScreenCache();
                this._limitParam();
            }
        }
        get outerRadius() {
            return this._outerRadius;
        }
        set outerRadius(value) {
            if (this._outerRadius !== value) {
                this._outerRadius = value;
                this._needUpdateLight = true;
                this._needUpdateLightLocalRange = true;
                this._needUpdateLightWorldRange = true;
                super._clearScreenCache();
                this._limitParam();
            }
        }
        get innerAngle() {
            return this._innerAngle;
        }
        set innerAngle(value) {
            if (this._innerAngle !== value) {
                this._innerAngle = value;
                this._needUpdateLight = true;
                this._limitParam();
            }
        }
        get outerAngle() {
            return this._outerAngle;
        }
        set outerAngle(value) {
            if (this._outerAngle !== value) {
                this._outerAngle = value;
                this._needUpdateLight = true;
                this._limitParam();
            }
        }
        get falloffIntensity() {
            return this._falloffIntensity;
        }
        set falloffIntensity(value) {
            if (this._falloffIntensity !== value) {
                this._falloffIntensity = value;
                this._needUpdateLight = true;
                this._limitParam();
            }
        }
        _calcLocalRange() {
            super._calcLocalRange();
            const w = this._outerRadius * 2.1 | 0;
            const h = this._outerRadius * 2.1 | 0;
            this._localRange.x = -w / 2;
            this._localRange.y = -h / 2;
            this._localRange.width = w;
            this._localRange.height = h;
        }
        _calcWorldRange(screen) {
            super._calcWorldRange(screen);
            this._lightScaleAndRotation();
            let globalTrans = this.owner.globalTrans;
            const pp = globalTrans.getPos(Laya.Point.TEMP);
            const px = pp.x;
            const py = pp.y;
            const sx = globalTrans.scaleX;
            const sy = globalTrans.scaleY;
            const x = this._localRange.x;
            const y = this._localRange.y;
            const w = this._localRange.width;
            const h = this._localRange.height;
            const m = Math.max(w * sx, h * sy) | 0;
            this._worldRange.x = (px - m / 2) | 0;
            this._worldRange.y = (py - m / 2) | 0;
            this._worldRange.width = m;
            this._worldRange.height = m;
            this._lightRange.x = (px + x) | 0;
            this._lightRange.y = (py + y) | 0;
            this._lightRange.width = w;
            this._lightRange.height = h;
        }
        _notifyAntiAliasChange() {
            const range = this._getLocalRange();
            this._buildRenderTexture(range.width, range.height);
            this._needUpdateLight = true;
        }
        _buildRenderTexture(width, height) {
            width = Light2DManager.clampRTSize(width);
            height = Light2DManager.clampRTSize(height);
            if (this._texLight)
                this._texLight.destroy();
            const tex = this._texLight = new Laya.RenderTexture(width, height, Laya.RenderTargetFormat.R8G8B8A8, null, false, this.antiAlias ? 4 : 1);
            tex.wrapModeU = tex.wrapModeV = Laya.WrapMode.Clamp;
            if (!this._cmdRT)
                this._cmdRT = Laya.Set2DRTCMD.create(tex, true, Laya.Color.CLEAR, false);
            else
                this._cmdRT.renderTexture = tex;
            tex.lock = true;
        }
        renderLightTexture() {
            var _a;
            super.renderLightTexture();
            if (this._needUpdateLight) {
                this._needUpdateLight = false;
                const range = this._getLocalRange();
                const width = Light2DManager.clampRTSize(range.width);
                const height = Light2DManager.clampRTSize(range.height);
                if (width === 0 || height === 0)
                    return;
                if (!this._texLight || !(this._texLight instanceof Laya.RenderTexture)) {
                    this._buildRenderTexture(width, height);
                    if (Light2DManager.DEBUG)
                        console.log('create spot light texture', width, height);
                }
                else if (this._texLight.width !== width || this._texLight.height !== height) {
                    this._buildRenderTexture(width, height);
                    if (Light2DManager.DEBUG)
                        console.log('update spot light texture', width, height);
                }
                const mesh = this._createMesh((_a = this._cmdMesh) === null || _a === void 0 ? void 0 : _a.mesh, this._needToRecover);
                if (!this._cmdMesh)
                    this._cmdMesh = Laya.DrawMesh2DCMD.create(mesh, Laya.Matrix.EMPTY, Laya.Texture2D.whiteTexture, Laya.Color.WHITE, this._material);
                else
                    this._cmdMesh.mesh = mesh;
                mesh.lock = true;
                this._cmdBuffer.addCacheCommand(this._cmdRT);
                this._cmdBuffer.addCacheCommand(this._cmdMesh);
                this._cmdBuffer.apply(true);
                this._cmdBuffer.clear(false);
                this._needUpdateLightAndShadow = true;
                if (Light2DManager.DEBUG) {
                    if (this.showLightTexture)
                        this._printTextureToConsoleAsBase64();
                    console.log('update spot light texture contain');
                }
            }
        }
        _limitParam() {
            this._innerAngle = Math.max(Math.min(this._innerAngle, 360), 0);
            this._outerAngle = Math.max(Math.min(this._outerAngle, 360), 0);
            this._innerRadius = Math.max(Math.min(this._innerRadius, 10000), 1);
            this._outerRadius = Math.max(Math.min(this._outerRadius, 10000), 1);
            this._falloffIntensity = Math.max(Math.min(this._falloffIntensity, 10), 0);
            if (this._outerRadius < this._innerRadius)
                this._outerRadius = this._innerRadius;
            if (this._outerAngle < this._innerAngle)
                this._outerAngle = this._innerAngle;
        }
        _createMesh(mesh, recover) {
            const segments1 = Math.max(4, Math.min(64, this._innerAngle / 5 | 0));
            const segments2 = Math.max(2, Math.min(64, (this._outerAngle - this._innerAngle) / 10 | 0));
            const falloffStep = 10;
            const points = [];
            const inds = [];
            const range = this._getLightRange();
            const centerX = range.width / 2;
            const centerY = range.height / 2;
            const innerAngleRad = this._innerAngle * Math.PI / 180;
            const outerAngleRad = this._outerAngle * Math.PI / 180;
            const angleOffset = -Math.PI / 2;
            const _addFan = (startAngle, endAngle, leftU, rightU, segments) => {
                let start = points.length;
                points.push(new Laya.Vector3(centerX, centerY, 1));
                let s = segments + 1;
                let f = (rightU - leftU) / segments;
                let t = (endAngle - startAngle) / segments;
                let l = (this._outerRadius - this._innerRadius) / falloffStep;
                let r = this._innerRadius / falloffStep;
                for (let j = 0; j < falloffStep; j++) {
                    for (let i = 0; i <= segments; i++) {
                        const angle = startAngle + t * i;
                        const rr = j === 0 ? 1 : r * (j + 1);
                        const x = centerX + rr * Math.cos(angle);
                        const y = centerY + rr * Math.sin(angle);
                        const u = Math.pow(leftU + f * i, this._falloffIntensity);
                        points.push(new Laya.Vector3(x, y, u));
                        if (i > 0) {
                            if (j === 0)
                                inds.push(start, start + i, start + i + 1);
                            else {
                                const ss = s * (j - 1);
                                inds.push(start + i + ss, start + i + s + ss, start + i + s + ss + 1);
                                inds.push(start + i + ss, start + i + s + ss + 1, start + i + ss + 1);
                            }
                        }
                    }
                }
                start += s * (falloffStep - 1);
                for (let j = 0; j < falloffStep; j++) {
                    for (let i = 0; i <= segments; i++) {
                        const angle = startAngle + t * i;
                        const x = centerX + (this._innerRadius + l * (j + 1)) * Math.cos(angle);
                        const y = centerY + (this._innerRadius + l * (j + 1)) * Math.sin(angle);
                        const u2 = Math.pow(leftU + f * i, this._falloffIntensity);
                        const u3 = Math.pow(1 - (j + 1) / falloffStep, this._falloffIntensity);
                        const u = u2 * u3;
                        points.push(new Laya.Vector3(x, y, u));
                        if (i > 0) {
                            const ss = s * j;
                            inds.push(start + i + ss, start + i + s + ss, start + i + s + ss + 1);
                            inds.push(start + i + ss, start + i + s + ss + 1, start + i + ss + 1);
                        }
                    }
                }
            };
            _addFan(-outerAngleRad / 2 + angleOffset, -innerAngleRad / 2 + angleOffset, 0, 1, segments2);
            _addFan(-innerAngleRad / 2 + angleOffset, innerAngleRad / 2 + angleOffset, 1, 1, segments1);
            _addFan(innerAngleRad / 2 + angleOffset, outerAngleRad / 2 + angleOffset, 1, 0, segments2);
            return this._makeOrUpdateMesh(points, inds, mesh, recover);
        }
        _onDestroy() {
            super._onDestroy();
            if (this._texLight) {
                this._texLight.destroy();
                this._texLight = null;
            }
        }
    }

    class SpriteLight2D extends BaseLight2D {
        constructor() {
            super();
            this._type = exports.Light2DType.Sprite;
        }
        set spriteTexture(value) {
            if (this._texLight === value)
                return;
            if (this._texLight)
                this._texLight._removeReference(1);
            this._texLight = value;
            if (value)
                this._texLight._addReference(1);
            this._needUpdateLight = true;
            this._needUpdateLightLocalRange = true;
            this._needUpdateLightWorldRange = true;
            super._clearScreenCache();
        }
        get spriteTexture() {
            return this._texLight;
        }
        _calcLocalRange() {
            super._calcLocalRange();
            const w = (this._texLight ? this._texLight.width : 100) | 0;
            const h = (this._texLight ? this._texLight.height : 100) | 0;
            this._localRange.x = -w / 2;
            this._localRange.y = -h / 2;
            this._localRange.width = w;
            this._localRange.height = h;
        }
        _calcWorldRange(screen) {
            super._calcWorldRange(screen);
            this._lightScaleAndRotation();
            let globalTrans = this.owner.globalTrans;
            const pp = globalTrans.getPos(Laya.Point.TEMP);
            const px = pp.x;
            const py = pp.y;
            const sx = globalTrans.scaleX;
            const sy = globalTrans.scaleY;
            const x = this._localRange.x;
            const y = this._localRange.y;
            const w = this._localRange.width;
            const h = this._localRange.height;
            const m = Math.max(w * sx, h * sy) | 0;
            this._worldRange.x = (px - m / 2) | 0;
            this._worldRange.y = (py - m / 2) | 0;
            this._worldRange.width = m;
            this._worldRange.height = m;
            this._lightRange.x = (px + x) | 0;
            this._lightRange.y = (py + y) | 0;
            this._lightRange.width = w;
            this._lightRange.height = h;
        }
        renderLightTexture() {
            super.renderLightTexture();
            if (this._needUpdateLight) {
                this._needUpdateLight = false;
                this._needUpdateLightAndShadow = true;
                if (Light2DManager.DEBUG)
                    console.log('update sprite light texture');
            }
        }
        _onDestroy() {
            super._onDestroy();
            if (this._texLight) {
                this._texLight._removeReference(1);
                this._texLight = null;
            }
        }
    }

    let c = Laya.ClassUtils.regClass;
    c("BaseLight2D", BaseLight2D);
    c("DirectionLight2D", DirectionLight2D);
    c("SpriteLight2D", SpriteLight2D);
    c("FreeformLight2D", FreeformLight2D);
    c("SpotLight2D", SpotLight2D);
    c("LightOccluder2D", LightOccluder2D);
    c("PolygonPoint2D", PolygonPoint2D);

    class ShowRenderTarget {
        constructor(scene, tex, x, y, width, height) {
            this._sprite = scene.addChild(new Laya.Sprite());
            this._render = this._sprite.addComponent(Laya.Mesh2DRender);
            this._render.lightReceive = false;
            if (tex)
                this._render.texture = tex;
            this._render.sharedMesh = this._genMesh(x, y, width, height);
        }
        setRenderTarget(rt) {
            this._render.texture = rt;
        }
        _genMesh(x, y, width, height) {
            const vertices = new Float32Array(4 * 5);
            const indices = new Uint16Array(2 * 3);
            let index = 0;
            vertices[index++] = x;
            vertices[index++] = y;
            vertices[index++] = 0;
            vertices[index++] = 0;
            vertices[index++] = 1;
            vertices[index++] = x + width;
            vertices[index++] = y;
            vertices[index++] = 0;
            vertices[index++] = 1;
            vertices[index++] = 1;
            vertices[index++] = x + width;
            vertices[index++] = y + height;
            vertices[index++] = 0;
            vertices[index++] = 1;
            vertices[index++] = 0;
            vertices[index++] = x;
            vertices[index++] = y + height;
            vertices[index++] = 0;
            vertices[index++] = 0;
            vertices[index++] = 0;
            index = 0;
            indices[index++] = 0;
            indices[index++] = 1;
            indices[index++] = 3;
            indices[index++] = 1;
            indices[index++] = 2;
            indices[index++] = 3;
            const declaration = Laya.VertexMesh2D.getVertexDeclaration(['POSITION,UV'], false)[0];
            return Laya.Mesh2D.createMesh2DByPrimitive([vertices], [declaration], indices, Laya.IndexFormat.UInt16, [{ length: indices.length, start: 0 }]);
        }
    }

    exports.BaseLight2D = BaseLight2D;
    exports.DirectionLight2D = DirectionLight2D;
    exports.FreeformLight2D = FreeformLight2D;
    exports.Light2DConfig = Light2DConfig;
    exports.Light2DManager = Light2DManager;
    exports.Light2DRenderRes = Light2DRenderRes;
    exports.LightAndShadow = LightAndShadow;
    exports.LightAndShadowGenShader2D = LightAndShadowGenShader2D;
    exports.LightGenShader2D = LightGenShader2D;
    exports.LightLine2D = LightLine2D;
    exports.LightOccluder2D = LightOccluder2D;
    exports.LightOccluder2DCore = LightOccluder2DCore;
    exports.Occluder2DAgent = Occluder2DAgent;
    exports.PolygonPoint2D = PolygonPoint2D;
    exports.ShadowGenShader2D = ShadowGenShader2D;
    exports.ShowRenderTarget = ShowRenderTarget;
    exports.SpotLight2D = SpotLight2D;
    exports.SpriteLight2D = SpriteLight2D;

})(window.Laya = window.Laya || {}, Laya);
//# sourceMappingURL=laya.light2D.js.map
