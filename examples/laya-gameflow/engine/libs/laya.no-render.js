(function (exports, Laya) {
    'use strict';

    class NoRenderGlobalRenderData {
    }
    class NoRenderDataHandleBase {
        constructor() {
            this._nMatrix_0 = new Laya.Vector3();
            this._nMatrix_1 = new Laya.Vector3();
            this.needUseMatrix = true;
        }
        get owner() { return this._owner; }
        set owner(value) { this._owner = value; }
        destroy() { }
        inheriteRenderData(context) {
            var _a;
            let data = (_a = this._owner) === null || _a === void 0 ? void 0 : _a.spriteShaderData;
            if (!data)
                return;
            if (this.needUseMatrix) {
                let mat = this._owner.renderMatrix;
                this._nMatrix_0.setValue(mat.a, mat.c, mat.tx);
                this._nMatrix_1.setValue(mat.b, mat.d, mat.ty);
                data.setVector3(Laya.ShaderDefines2D.UNIFORM_NMATRIX_0, this._nMatrix_0);
                data.setVector3(Laya.ShaderDefines2D.UNIFORM_NMATRIX_1, this._nMatrix_1);
            }
        }
    }
    class NoRenderEmptyDataHandle extends NoRenderDataHandleBase {
        inheriteRenderData(_context) { }
        destroy() { }
    }
    class NoRenderSubStructDataHandle extends NoRenderDataHandleBase {
        constructor() {
            super(...arguments);
            this.logicMatrix = null;
            this.mask = null;
            this._modifiedFrame = -1;
            this._globalAlpha = 1;
        }
        inheriteRenderData(context) {
            let data = this._owner.spriteShaderData;
            if (!data)
                return;
            let trans = this._owner.trans;
            let mat = trans.matrix;
            if (this._modifiedFrame < trans.modifiedFrame) {
                if (this.logicMatrix) {
                    let temp = Laya.Matrix.TEMP;
                    Laya.Matrix.mul(this.logicMatrix, mat.copyTo(temp), temp);
                    this._nMatrix_0.setValue(temp.a, temp.c, temp.tx);
                    this._nMatrix_1.setValue(temp.b, temp.d, temp.ty);
                }
                else {
                    this._nMatrix_0.setValue(mat.a, mat.c, mat.tx);
                    this._nMatrix_1.setValue(mat.b, mat.d, mat.ty);
                }
                data.setVector3(Laya.ShaderDefines2D.UNIFORM_NMATRIX_0, this._nMatrix_0);
                data.setVector3(Laya.ShaderDefines2D.UNIFORM_NMATRIX_1, this._nMatrix_1);
                this._modifiedFrame = trans.modifiedFrame;
            }
            else if (this._globalAlpha !== this._owner.globalAlpha) {
                this._globalAlpha = this._owner.globalAlpha;
            }
        }
    }
    class NoRenderGraphicsSingleQuadDataHandle extends NoRenderDataHandleBase {
        constructor() {
            super(...arguments);
            this._graphicsSubShader = null;
            this._graphicsShaderData = null;
            this._singleQuadPayloadBuffer = null;
        }
        setGraphicsHandleUpdateBuffer(_buffer) {
        }
        setGraphicsMaterialState(subShader, shaderData, _useSpriteState) {
            this._graphicsSubShader = subShader || null;
            this._graphicsShaderData = shaderData || null;
        }
        setSingleQuadPayloadBuffer(buffer) {
            if (this._singleQuadPayloadBuffer === buffer)
                return;
            if (this._singleQuadPayloadBuffer)
                throw new Error("SingleQuad payload buffer can only be bound once");
            this._singleQuadPayloadBuffer = buffer;
        }
        syncSingleQuad(_texture) {
            return !!this._singleQuadPayloadBuffer;
        }
        deactivateSingleQuad() {
        }
        destroy() {
            this._graphicsSubShader = null;
            this._graphicsShaderData = null;
            this._singleQuadPayloadBuffer = null;
            super.destroy();
        }
    }
    class NoRenderGraphicsCommandStreamDataHandle extends NoRenderDataHandleBase {
        constructor() {
            super(...arguments);
            this.autoGraphicsDirtySync = false;
            this._graphicsSubShader = null;
            this._graphicsShaderData = null;
            this._graphicsHandleUpdateInt32 = null;
        }
        setGraphicsHandleUpdateBuffer(buffer) {
            this._graphicsHandleUpdateInt32 = buffer ? new Int32Array(buffer) : null;
        }
        setGraphicsMaterialState(subShader, shaderData, _useSpriteState) {
            this._graphicsSubShader = subShader || null;
            this._graphicsShaderData = shaderData || null;
        }
        syncGraphicsOps(_ops) {
            let update = this._graphicsHandleUpdateInt32;
            if (!update)
                return;
            update[9] = update[8];
            update[1] = update[0];
        }
        deactivateGraphicsOps() {
        }
        destroy() {
            this._graphicsSubShader = null;
            this._graphicsShaderData = null;
            this._graphicsHandleUpdateInt32 = null;
            super.destroy();
        }
    }
    class NoRenderBaseDataHandle extends NoRenderDataHandleBase {
        constructor() {
            super(...arguments);
            this._lightReceive = false;
        }
        get lightReceive() { return this._lightReceive; }
        set lightReceive(value) {
            var _a;
            this._lightReceive = value;
            if ((_a = this._owner) === null || _a === void 0 ? void 0 : _a.spriteShaderData) {
                if (value) {
                    this._owner.spriteShaderData.addDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_ENABLE);
                }
                else {
                    this._owner.spriteShaderData.removeDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_ENABLE);
                }
            }
        }
        get owner() { return this._owner; }
        set owner(value) {
            var _a, _b;
            if (value === this._owner)
                return;
            if ((_a = this._owner) === null || _a === void 0 ? void 0 : _a.spriteShaderData) {
                this._owner.spriteShaderData.removeDefine(Laya.BaseRenderNode2D.SHADERDEFINE_BASERENDER2D);
            }
            this._owner = value;
            if ((_b = this._owner) === null || _b === void 0 ? void 0 : _b.spriteShaderData) {
                this._owner.spriteShaderData.addDefine(Laya.BaseRenderNode2D.SHADERDEFINE_BASERENDER2D);
            }
        }
    }
    const _setRenderColor = new Laya.Color(1, 1, 1, 1);
    class NoRenderMeshDataHandle extends NoRenderBaseDataHandle {
        constructor() {
            super(...arguments);
            this._baseColor = new Laya.Color(1, 1, 1, 1);
            this._tilingOffset = new Laya.Vector4();
            this._renderAlpha = -1;
        }
        get baseColor() { return this._baseColor; }
        set baseColor(value) {
            var _a, _b;
            if (value !== this._baseColor && this._baseColor.equal(value))
                return;
            value = value ? value : Laya.Color.BLACK;
            value.cloneTo(this._baseColor);
            this._renderAlpha = -1;
            (_b = (_a = this._owner) === null || _a === void 0 ? void 0 : _a.spriteShaderData) === null || _b === void 0 ? void 0 : _b.setColor(Laya.BaseRenderNode2D.BASERENDER2DCOLOR, this._baseColor);
        }
        get baseTexture() { return this._baseTexture; }
        set baseTexture(value) {
            var _a, _b;
            if (this._baseTexture != null && value === this._baseTexture)
                return;
            if (this._baseTexture)
                this._baseTexture._removeReference();
            this._baseTexture = value;
            (_b = (_a = this._owner) === null || _a === void 0 ? void 0 : _a.spriteShaderData) === null || _b === void 0 ? void 0 : _b.setTexture(Laya.BaseRenderNode2D.BASERENDER2DTEXTURE, value);
            if (value)
                value._addReference();
        }
        get tilingOffset() { return this._tilingOffset; }
        set tilingOffset(value) {
            var _a, _b;
            if (!value)
                return;
            (_b = (_a = this._owner) === null || _a === void 0 ? void 0 : _a.spriteShaderData) === null || _b === void 0 ? void 0 : _b.setVector(Laya.BaseRenderNode2D.TILINGOFFSET, value);
            value.cloneTo(this._tilingOffset);
        }
        get normal2DTexture() { return this._normal2DTexture; }
        set normal2DTexture(value) {
            var _a, _b;
            if (value === this._normal2DTexture)
                return;
            if (this._normal2DTexture)
                this._normal2DTexture._removeReference(1);
            if (value)
                value._addReference();
            this._normal2DTexture = value;
            (_b = (_a = this._owner) === null || _a === void 0 ? void 0 : _a.spriteShaderData) === null || _b === void 0 ? void 0 : _b.setTexture(Laya.BaseRenderNode2D.NORMAL2DTEXTURE, value);
        }
        get normal2DStrength() { return this._normal2DStrength; }
        set normal2DStrength(value) {
            var _a, _b;
            value = Math.max(0, Math.min(1, value));
            if (this._normal2DStrength === value)
                return;
            this._normal2DStrength = value;
            (_b = (_a = this._owner) === null || _a === void 0 ? void 0 : _a.spriteShaderData) === null || _b === void 0 ? void 0 : _b.setNumber(Laya.BaseRenderNode2D.NORMAL2DSTRENGTH, value);
        }
        inheriteRenderData(context) {
            super.inheriteRenderData(context);
            if (this._owner && this._renderAlpha !== this._owner.globalAlpha) {
                let a = this._owner.globalAlpha * this._baseColor.a;
                _setRenderColor.setValue(this._baseColor.r, this._baseColor.g, this._baseColor.b, a);
                this._owner.spriteShaderData.setColor(Laya.BaseRenderNode2D.BASERENDER2DCOLOR, _setRenderColor);
                this._renderAlpha = this._owner.globalAlpha;
            }
        }
    }
    const _DefaultClipInfo = {
        clipMatrix: new Laya.Matrix(),
        clipMatDir: new Laya.Vector4(Laya.Const.MAX_CLIP_SIZE, 0, 0, Laya.Const.MAX_CLIP_SIZE),
        clipMatPos: new Laya.Vector4(0, 0, 0, 0),
        _updateFrame: 0,
        clipDepth: 0,
        clipParent: null
    };
    const _DefaultParentData = {
        clipInfo: _DefaultClipInfo,
        blendMode: Laya.BlendMode.invalid,
        globalRenderData: null,
        pass: null,
        enableCulling: false,
        dcOptimize: false,
        globalAlpha: 1,
    };
    var ChildrenUpdateType;
    (function (ChildrenUpdateType) {
        ChildrenUpdateType[ChildrenUpdateType["All"] = -1] = "All";
        ChildrenUpdateType[ChildrenUpdateType["None"] = 0] = "None";
        ChildrenUpdateType[ChildrenUpdateType["Clip"] = 1] = "Clip";
        ChildrenUpdateType[ChildrenUpdateType["Blend"] = 2] = "Blend";
        ChildrenUpdateType[ChildrenUpdateType["Alpha"] = 4] = "Alpha";
        ChildrenUpdateType[ChildrenUpdateType["Pass"] = 8] = "Pass";
        ChildrenUpdateType[ChildrenUpdateType["Global"] = 16] = "Global";
        ChildrenUpdateType[ChildrenUpdateType["Culling"] = 32] = "Culling";
        ChildrenUpdateType[ChildrenUpdateType["DcOptimize"] = 64] = "DcOptimize";
    })(ChildrenUpdateType || (ChildrenUpdateType = {}));
    class NoRenderStruct2D {
        get enableCulling() { return this._enableCulling; }
        set enableCulling(value) {
            this._enableCulling = value;
            this.updateChildren(ChildrenUpdateType.Culling);
        }
        get inheritedEnableCulling() { return this._enableCulling || this._parentData.enableCulling; }
        get dcOptimize() { return this._dcOptimize; }
        set dcOptimize(value) {
            this._dcOptimize = value;
            this.updateChildren(ChildrenUpdateType.DcOptimize);
        }
        get inheritedDcOptimize() { return this._dcOptimize || this._parentData.dcOptimize; }
        getRenderMatrixVersion() { return 0; }
        get renderMatrix() { return this.trans.matrix; }
        set renderMatrix(value) {
            if (!this.trans)
                this.trans = { matrix: new Laya.Matrix(), modifiedFrame: 0 };
            value.copyTo(this.trans.matrix);
            this.trans.modifiedFrame = Laya.Stat.loopCount;
        }
        get globalAlpha() { return this._currentData.globalAlpha; }
        set globalAlpha(value) { this._parentData.globalAlpha = value; }
        get alpha() { return this._alpha; }
        set alpha(value) {
            this._alpha = value;
            this._updateGlobalAlpha(value, this.parent ? this.parent.globalAlpha : 1);
            this.updateChildren(ChildrenUpdateType.Alpha);
        }
        get blendMode() { return this._blendMode || this._currentData.blendMode || Laya.BlendMode.normal; }
        set blendMode(value) {
            this._updateBlendMode(value);
            this._setBlendMode();
            this.updateChildren(ChildrenUpdateType.Blend);
        }
        get renderDataHandler() { return this._renderDataHandler; }
        set renderDataHandler(value) {
            if (this._renderDataHandler)
                this._renderDataHandler.owner = null;
            this._renderDataHandler = value;
            if (value)
                this._renderDataHandler.owner = this;
        }
        get globalRenderData() { return this._globalRenderData || this._currentData.globalRenderData; }
        set globalRenderData(value) {
            this._globalRenderData = value;
            this._updateGlobalShaderData();
            this.updateChildren(ChildrenUpdateType.Global);
        }
        _updateGlobalShaderData() {
            let renderData = this.globalRenderData;
            this._globalShaderData = renderData ? renderData.globalShaderData : null;
            if (this._subStruct)
                this._subStruct._updateGlobalShaderData();
        }
        _updatePriority() {
            if (this._pass) {
                if (this._maskParentPass) {
                    this._pass.priority = this._maskParentPass.priority + 1;
                }
                else if (this._parentData.pass) {
                    this._pass.priority = this._parentData.pass.priority + 1;
                }
                else {
                    this._pass.priority = 0;
                }
            }
        }
        setMaskParentPass(pass) {
            this._maskParentPass = pass;
            this._updatePriority();
            if (this._pass)
                this.updateChildren(ChildrenUpdateType.Pass);
        }
        get pass() { return this._pass || this._currentData.pass; }
        set pass(value) {
            if (value !== this._pass) {
                this._pass = value;
                this._updatePriority();
                this.updateChildren(ChildrenUpdateType.Pass);
            }
        }
        get subStruct() { return this._subStruct; }
        set subStruct(value) {
            if (value === this._subStruct)
                return;
            let updateFlag = 0;
            if (value) {
                let parentData = this._parentData;
                value._blendMode = this._blendMode;
                value._currentData = parentData;
                value._maskParentPass = this._maskParentPass;
                if (parentData.globalAlpha !== 1)
                    updateFlag |= ChildrenUpdateType.Alpha;
                if (!this._globalRenderData && parentData.globalRenderData)
                    updateFlag |= ChildrenUpdateType.Global;
                if (!this._clipInfo && parentData.clipInfo)
                    updateFlag |= ChildrenUpdateType.Clip;
                if (this._blendMode !== Laya.BlendMode.invalid || parentData.blendMode !== Laya.BlendMode.invalid)
                    updateFlag |= ChildrenUpdateType.Blend;
                this._blendMode = Laya.BlendMode.invalid;
                this._currentData = _DefaultParentData;
                value.needUploadAlpha = true;
            }
            else if (this._subStruct) {
                let parentData = this._parentData;
                this._subStruct._currentData = this._subStruct._parentData;
                this._blendMode = this._subStruct._blendMode;
                if (parentData.globalAlpha !== 1)
                    updateFlag |= ChildrenUpdateType.Alpha;
                if (!this._clipInfo && parentData.clipInfo)
                    updateFlag |= ChildrenUpdateType.Clip;
                if (!this._globalRenderData && parentData.globalRenderData)
                    updateFlag |= ChildrenUpdateType.Global;
                if (this._blendMode !== Laya.BlendMode.invalid || parentData.blendMode !== Laya.BlendMode.invalid)
                    updateFlag |= ChildrenUpdateType.Blend;
                this._subStruct._blendMode = Laya.BlendMode.invalid;
                this._subStruct._maskParentPass = null;
                this._currentData = parentData;
            }
            this._subStruct = value;
            this._updateGlobalShaderData();
            this.updateChildren(updateFlag);
            this._setBlendMode();
        }
        constructor() {
            this.transSlot = -1;
            this.manualRender = false;
            this._parentData = Object.assign({}, _DefaultParentData);
            this._currentData = this._parentData;
            this.zIndex = 0;
            this._effectZ = 0;
            this.stackingRoot = false;
            this.rect = new Laya.Rectangle();
            this._enableCulling = false;
            this.renderLayer = 1;
            this.children = [];
            this.renderType = -1;
            this.renderUpdateMask = 0;
            this._alpha = 1.0;
            this._blendMode = Laya.BlendMode.invalid;
            this.needUploadClip = -1;
            this._clipOffset = new Laya.Vector2();
            this.needUploadAlpha = true;
            this.enabled = true;
            this.isRenderStruct = false;
            this.renderElements = null;
            this.spriteShaderData = null;
            this._globalShaderData = null;
            this._globalRenderData = null;
            this._clipRect = null;
            this._clipInfo = null;
            this._uniformClip = false;
            this._rnUpdateFun = null;
            this.trans = { matrix: new Laya.Matrix(), modifiedFrame: Laya.Stat.loopCount };
        }
        setRenderUpdateCallback(func) {
            this._rnUpdateFun = func;
        }
        _handleInterData() {
            let rect = this._clipRect;
            if (rect) {
                let info = this._clipInfo;
                let trans = this.trans;
                let clipInfo = this._currentData.clipInfo;
                let parentClipUpdateFrame = clipInfo && clipInfo !== _DefaultClipInfo ? clipInfo._updateFrame : -1;
                if (trans) {
                    if (info._updateFrame < trans.modifiedFrame || info._updateFrame < parentClipUpdateFrame) {
                        let mat = trans.matrix;
                        let cm = info.clipMatrix;
                        let { x, y, width, height } = rect;
                        width = Math.max(width, 0.0001);
                        height = Math.max(height, 0.0001);
                        let tx = mat.tx, ty = mat.ty;
                        let maskA = width * mat.a, maskB = width * mat.b;
                        let maskC = height * mat.c, maskD = height * mat.d;
                        let rawClipX = x * mat.a + y * mat.c + tx;
                        let rawClipY = x * mat.b + y * mat.d + ty;
                        cm.tx = tx;
                        cm.ty = ty;
                        cm.a = maskA;
                        cm.b = maskB;
                        cm.c = maskC;
                        cm.d = maskD;
                        if (parentClipUpdateFrame !== -1) {
                            let parentClipPos = clipInfo.clipMatPos;
                            let offsetx = parentClipPos.z - parentClipPos.x;
                            let offsety = parentClipPos.w - parentClipPos.y;
                            if (cm.a > 0 && cm.d > 0) {
                                let parentMat = clipInfo.clipMatrix;
                                let parentMinX = parentMat.tx;
                                let parentMinY = parentMat.ty;
                                let parentMaxX = parentMinX + parentMat.a;
                                let parentMaxY = parentMinY + parentMat.d;
                                let cmaxx = tx + cm.a;
                                let cmaxy = ty + cm.d;
                                if (cmaxx <= parentMinX || cmaxy <= parentMinY || tx >= parentMaxX || ty >= parentMaxY) {
                                    cm.a = -0.1;
                                    cm.d = -0.1;
                                }
                                else {
                                    if (tx < parentMinX) {
                                        cm.a -= (parentMinX - tx);
                                        tx = parentMinX;
                                    }
                                    if (cmaxx > parentMaxX) {
                                        cm.a -= (cmaxx - parentMaxX);
                                    }
                                    if (ty < parentMinY) {
                                        cm.d -= (parentMinY - ty);
                                        ty = parentMinY;
                                    }
                                    if (cmaxy > parentMaxY) {
                                        cm.d -= (cmaxy - parentMaxY);
                                    }
                                    if (cm.a <= 0)
                                        cm.a = -0.1;
                                    if (cm.d <= 0)
                                        cm.d = -0.1;
                                    if (cm.tx < parentMinX)
                                        cm.tx = parentMinX;
                                    if (cm.ty < parentMinY)
                                        cm.ty = parentMinY;
                                }
                            }
                            tx += offsetx;
                            ty += offsety;
                            cm.tx = tx;
                            cm.ty = ty;
                        }
                        info.clipMatDir.setValue(cm.a, cm.b, cm.c, cm.d);
                        info.clipMatPos.setValue(rawClipX, rawClipY, tx, ty);
                        info.clipDepth = (parentClipUpdateFrame !== -1 ? clipInfo.clipDepth : 0) + 1;
                        info.clipParent = parentClipUpdateFrame !== -1 ? clipInfo : null;
                        info._updateFrame = Math.max(trans.modifiedFrame, parentClipUpdateFrame);
                    }
                }
            }
            if (this._renderDataHandler) {
                let data = this.spriteShaderData;
                let info = this.getClipInfo();
                if (info !== _DefaultClipInfo) {
                    if (this.needUploadClip < info._updateFrame) {
                        this._clipOffset.setValue(info.clipMatPos.z - info.clipMatPos.x, info.clipMatPos.w - info.clipMatPos.y);
                        data.setVector2(Laya.ShaderDefines2D.UNIFORM_CLIPOFFSET, this._clipOffset);
                        this.needUploadClip = info._updateFrame;
                    }
                    if (!this._uniformClip) {
                        this._uniformClip = true;
                        data.addDefine(Laya.ShaderDefines2D.UNIFORMCLIP);
                    }
                }
                else if (this._uniformClip) {
                    data.removeDefine(Laya.ShaderDefines2D.UNIFORMCLIP);
                    this._uniformClip = false;
                }
                if (this.needUploadAlpha) {
                    data.setNumber(Laya.ShaderDefines2D.UNIFORM_VERTALPHA, this.globalAlpha);
                    this.needUploadAlpha = false;
                }
            }
        }
        _setBlendMode() {
            if (!this.spriteShaderData)
                return;
            Laya.BlendModeHandler.setShaderData(this.blendMode, this.spriteShaderData);
            if (this._subStruct)
                this._subStruct._setBlendMode();
        }
        setClipRect(rect) {
            this._clipRect = rect;
            rect ? this._initClipInfo() : this._clipInfo = null;
            this.updateChildren(ChildrenUpdateType.Clip);
        }
        _initClipInfo() {
            if (!this._clipInfo) {
                this._clipInfo = {
                    clipMatDir: new Laya.Vector4,
                    clipMatPos: new Laya.Vector4,
                    clipMatrix: new Laya.Matrix,
                    _updateFrame: -1,
                    clipDepth: 1,
                    clipParent: null
                };
            }
            else {
                this._clipInfo._updateFrame = -1;
                this._clipInfo.clipDepth = 1;
                this._clipInfo.clipParent = null;
            }
        }
        _updateGlobalAlpha(value, parentAlpha = 1) {
            this._parentData.globalAlpha = parentAlpha * value;
        }
        _updateBlendMode(blendMode) {
            var _a;
            if ((_a = this._subStruct) === null || _a === void 0 ? void 0 : _a.enabled) {
                this._subStruct._blendMode = blendMode;
            }
            else {
                this._blendMode = blendMode;
            }
        }
        getClipInfo() { return this._clipInfo || this._currentData.clipInfo || _DefaultClipInfo; }
        hasClip() { return this.getClipInfo() !== _DefaultClipInfo; }
        updateChildren(type) {
            if (type === ChildrenUpdateType.None)
                return;
            let info, blendMode, alpha;
            let pass = null, enableCulling = false, dcOptimize = false;
            let globalRenderData = null;
            let updateClip = false, updateBlend = false, updateAlpha = false, updatePass = false, updateGlobal = false, updateCulling = false, updateDcOptimize = false;
            if (type & ChildrenUpdateType.Clip) {
                info = this.getClipInfo();
                this.needUploadClip = -1;
                if (this._subStruct)
                    this._subStruct.needUploadClip = -1;
                updateClip = true;
            }
            if (type & ChildrenUpdateType.Blend) {
                blendMode = this.blendMode;
                updateBlend = true;
            }
            if (type & ChildrenUpdateType.Alpha) {
                alpha = this.globalAlpha;
                this.needUploadAlpha = true;
                if (this._subStruct)
                    this._subStruct.needUploadAlpha = true;
                updateAlpha = true;
            }
            if (type & ChildrenUpdateType.Pass) {
                pass = this.pass;
                updatePass = true;
            }
            if (type & ChildrenUpdateType.Global) {
                updateGlobal = true;
                globalRenderData = this.globalRenderData;
            }
            if (type & ChildrenUpdateType.Culling) {
                updateCulling = true;
                enableCulling = this.inheritedEnableCulling;
            }
            if (type & ChildrenUpdateType.DcOptimize) {
                updateDcOptimize = true;
                dcOptimize = this.inheritedDcOptimize;
            }
            for (const child of this.children) {
                let updateChild = false;
                let cpd = child._parentData;
                if (updateClip) {
                    cpd.clipInfo = info;
                    if (!child._clipInfo)
                        updateChild = true;
                }
                if (updateBlend) {
                    if (child._blendMode === Laya.BlendMode.invalid) {
                        cpd.blendMode = blendMode;
                        child._setBlendMode();
                        updateChild = true;
                    }
                }
                if (updateAlpha) {
                    child._updateGlobalAlpha(child.alpha, alpha);
                    updateChild = true;
                }
                if (updatePass) {
                    cpd.pass = pass;
                    updateChild = true;
                }
                if (updateGlobal) {
                    cpd.globalRenderData = globalRenderData;
                    child._updateGlobalShaderData();
                    if (!child._globalRenderData)
                        updateChild = true;
                }
                if (updateCulling) {
                    cpd.enableCulling = enableCulling;
                    updateChild = true;
                }
                if (updateDcOptimize) {
                    cpd.dcOptimize = dcOptimize;
                    updateChild = true;
                }
                if (updateChild)
                    child.updateChildren(type);
            }
        }
        setRepaint() { if (this.pass)
            this.pass.repaint = true; }
        addChild(child, index) {
            child.parent = this;
            this.children.splice(index, 0, child);
            let cpd = child._parentData;
            cpd.clipInfo = this.getClipInfo();
            cpd.blendMode = this.blendMode;
            child._setBlendMode();
            child._updateGlobalAlpha(child.alpha, this.globalAlpha);
            cpd.pass = this.pass;
            child._updatePriority();
            cpd.globalRenderData = this.globalRenderData;
            child._updateGlobalShaderData();
            cpd.enableCulling = this.inheritedEnableCulling;
            cpd.dcOptimize = this.inheritedDcOptimize;
            child.updateChildren(ChildrenUpdateType.All);
        }
        updateChildIndex(child, oldIndex, index) {
            if (oldIndex === index)
                return;
            this.children.splice(oldIndex, 1);
            if (index >= this.children.length)
                this.children.push(child);
            else
                this.children.splice(index, 0, child);
        }
        removeChild(child) {
            const index = this.children.indexOf(child);
            if (index !== -1) {
                child.parent = null;
                this.children.splice(index, 1);
                let cpd = child._parentData;
                cpd.pass = null;
                child._updatePriority();
                cpd.clipInfo = null;
                cpd.blendMode = Laya.BlendMode.invalid;
                child._updateGlobalAlpha(child._alpha);
                cpd.globalRenderData = null;
                child._updateGlobalShaderData();
                cpd.enableCulling = false;
                cpd.dcOptimize = false;
                child.updateChildren(ChildrenUpdateType.All);
            }
        }
        renderUpdate(context) {
            if (this.renderDataHandler)
                this.renderDataHandler.inheriteRenderData(context);
            if (this._rnUpdateFun)
                this._rnUpdateFun(context);
        }
        destroy() {
            this._clipInfo = null;
            this._currentData = null;
            this._parentData = null;
            this._clipRect = null;
            this.renderElements = null;
            this.spriteShaderData = null;
            this.parent = null;
            this.children.length = 0;
            this.children = null;
            this._pass = null;
        }
    }
    class NoRender2DPass {
        get priority() { return this._priority; }
        set priority(value) { this._priority = value; }
        get mask() { return this._mask; }
        set mask(value) {
            if (this._mask)
                this._mask.setMaskParentPass(null);
            this._mask = value;
            if (value)
                value.setMaskParentPass(this);
        }
        get enableBatch() { return this._enableBatch; }
        set enableBatch(value) { this.repaint = true; this._enableBatch = value; }
        constructor() {
            this._priority = 0;
            this.enable = true;
            this.isSupport = false;
            this.postProcess = null;
            this.repaint = true;
            this.doClearColor = true;
            this.root = null;
            this.offsetMatrix = new Laya.Matrix();
            this.shaderData = null;
            this._enableBatch = true;
            this.shaderData = Laya.LayaGL.renderDeviceFactory.createShaderData(null);
        }
        setClearColor(r, g, b, a) { }
        needRender() {
            return this.enable && !this.isSupport && (this.repaint || !this.renderTexture);
        }
        fowardRender(context, renderTime) {
            if (!this.root || this.root.globalAlpha < 0.01)
                return;
            if (this.renderTexture) {
                if (this.renderTexture.width === 0 || this.renderTexture.height === 0)
                    return;
                context.setRenderTarget(this.renderTexture._renderTarget, this.doClearColor, null);
            }
            else {
                let sizeX = Laya.RenderState2D.width, sizeY = Laya.RenderState2D.height;
                if (sizeX === 0 || sizeY === 0)
                    return;
                context.setOffscreenView(sizeX, sizeY);
                context.setRenderTarget(null, this.doClearColor, null);
            }
            context.passData = this.shaderData;
            if (this.repaint && this.root) {
                this._walkAndRenderUpdate(context, this.root);
            }
            this.repaint = false;
        }
        _walkAndRenderUpdate(context, struct) {
            if (!struct.enabled || struct.globalAlpha < 0.01 || this._mask === struct)
                return;
            let renderStruct = (struct.subStruct && struct !== this.root) ? struct.subStruct : struct;
            if (renderStruct.manualRender)
                return;
            renderStruct._handleInterData();
            renderStruct.renderUpdate(context);
            for (let i = 0, n = renderStruct.children.length; i < n; i++) {
                let child = renderStruct.children[i];
                child._effectZ = child.zIndex + struct._effectZ;
                this._walkAndRenderUpdate(context, child);
            }
        }
        updatePostProcess() { }
        destroy() {
            this.root = null;
            this.renderTexture = null;
            this.postProcess = null;
            if (this.shaderData) {
                this.shaderData.destroy();
                this.shaderData = null;
            }
        }
    }
    class NoRender2DPassManager {
        constructor() {
            this._modify = false;
            this._passes = [];
        }
        addPass(pass) {
            if (this._passes.indexOf(pass) !== -1)
                return;
            this._passes.push(pass);
            this._modify = true;
        }
        removePass(pass) {
            let index = this._passes.indexOf(pass);
            if (index === -1)
                return;
            this._passes.splice(index, 1);
            this._modify = true;
        }
        apply(context, renderTime) {
            if (this._modify) {
                this._modify = false;
                this._passes.sort((a, b) => b._priority - a._priority);
            }
            for (const pass of this._passes) {
                if (pass.needRender())
                    pass.fowardRender(context, renderTime);
            }
        }
        clear() { this._passes.length = 0; }
    }

    class NoRenderEngine {
        constructor() {
            this._framePassCount = 0;
            this._propertyNameMap = {};
            this._propertyNameCounter = 0;
        }
        initRenderEngine(canvas) {
        }
        copySubFrameBuffertoTex(texture, level, xoffset, yoffset, x, y, width, height) {
        }
        resizeOffScreen(width, height) {
        }
        endFrame() {
        }
        startFrame() {
        }
        propertyNameToID(name) {
            if (this._propertyNameMap[name] != null) {
                return this._propertyNameMap[name];
            }
            else {
                var id = this._propertyNameCounter++;
                this._propertyNameMap[name] = id;
                this._propertyNameMap[id] = name;
                return id;
            }
        }
        propertyIDToName(id) {
            return this._propertyNameMap[id];
        }
        getDefineByName(name) {
            var define = NoRenderEngine._defineMap[name];
            if (!define) {
                var maskMap = NoRenderEngine._maskMap;
                var counter = NoRenderEngine._defineCounter;
                var index = Math.floor(counter / 32);
                var value = 1 << counter % 32;
                define = new Laya.ShaderDefine(index, value);
                NoRenderEngine._defineMap[name] = define;
                if (index == maskMap.length) {
                    maskMap.length++;
                    maskMap[index] = {};
                }
                maskMap[index][value] = name;
                NoRenderEngine._defineCounter++;
            }
            return define;
        }
        getNamesByDefineData(defineData, out) {
            var maskMap = NoRenderEngine._maskMap;
            var mask = defineData._mask;
            out.length = 0;
            for (var i = 0, n = defineData._length; i < n; i++) {
                var subMaskMap = maskMap[i];
                var subMask = mask[i];
                for (var j = 0; j < 32; j++) {
                    var d = 1 << j;
                    if (subMask > 0 && d > subMask)
                        break;
                    if (subMask & d)
                        out.push(subMaskMap[d]);
                }
            }
        }
        addTexGammaDefine(key, value) {
        }
        getParams(params) {
            return 0;
        }
        getCapable(capatableType) {
            return false;
        }
        getTextureContext() {
            return new NoTextureContext();
        }
    }
    NoRenderEngine._defineMap = {};
    NoRenderEngine._defineCounter = 0;
    NoRenderEngine._maskMap = [];
    class NoInternalTexture {
        constructor() {
            this.filterMode = Laya.FilterMode.Bilinear;
            this.wrapU = Laya.WrapMode.Repeat;
            this.wrapV = Laya.WrapMode.Repeat;
            this.wrapW = Laya.WrapMode.Repeat;
            this.anisoLevel = 1;
            this.baseMipmapLevel = 0;
            this.maxMipmapLevel = 0;
            this.compareMode = Laya.TextureCompareMode.None;
            this.gpuMemory = 0;
            this.useSRGBLoad = false;
            this.gammaCorrection = 1;
        }
        dispose() {
        }
    }
    class NoInternalRT {
        constructor() {
            this._isCube = false;
            this._samples = 1;
            this._generateMipmap = false;
            this._textures = [];
            this.gpuMemory = 0;
        }
        dispose() {
            var _a;
            for (const texture of this._textures)
                texture.dispose();
            this._textures.length = 0;
            (_a = this._depthTexture) === null || _a === void 0 ? void 0 : _a.dispose();
            this._depthTexture = null;
        }
    }
    class NoTextureContext {
        constructor() {
            this.needBitmap = false;
        }
        _createRenderTarget(dimension, width, height, depth, colorFormat, depthStencilFormat, generateMipmap, sRGB, multiSamples) {
            const texture = this.createTexture3DInternal(dimension, width, height, depth, colorFormat, generateMipmap, sRGB, false);
            const renderTarget = new NoInternalRT();
            renderTarget._textures.push(texture);
            renderTarget._isCube = dimension === Laya.TextureDimension.Cube;
            renderTarget._samples = Math.max(1, multiSamples);
            renderTarget._generateMipmap = texture.mipmap;
            renderTarget.colorFormat = colorFormat;
            renderTarget.depthStencilFormat = depthStencilFormat;
            renderTarget.isSRGB = sRGB;
            return renderTarget;
        }
        createRenderTargetArrayInternal(width, height, depth, colorFormat, depthStencilFormat, generateMipmap, sRGB, multiSamples) {
            return this._createRenderTarget(Laya.TextureDimension.Texture2DArray, width, height, depth, colorFormat, depthStencilFormat, generateMipmap, sRGB, multiSamples);
        }
        createTextureInternal(dimension, width, height, format, generateMipmap, sRGB, premultipliedAlpha) {
            let internalTex = new NoInternalTexture();
            internalTex.width = width;
            internalTex.height = height;
            internalTex.depth = 1;
            internalTex.isPotSize = width > 0 && height > 0 && (width & (width - 1)) === 0 && (height & (height - 1)) === 0;
            internalTex.mipmap = generateMipmap;
            internalTex.mipmapCount = generateMipmap ? 1 + Math.floor(Math.log2(Math.max(1, width, height))) : 1;
            internalTex.maxMipmapLevel = internalTex.mipmapCount - 1;
            internalTex.gammaCorrection = sRGB ? 2.2 : 1;
            return internalTex;
        }
        setTextureImageData(texture, source, premultiplyAlpha, invertY) {
        }
        setTextureSubImageData(texture, source, x, y, premultiplyAlpha, invertY) {
        }
        setTexturePixelsData(texture, source, premultiplyAlpha, invertY) {
        }
        initVideoTextureData(texture) {
        }
        setTextureSubPixelsData(texture, source, mipmapLevel, generateMipmap, xOffset, yOffset, width, height, premultiplyAlpha, invertY) {
        }
        setTextureDDSData(texture, ddsInfo) {
        }
        setTextureKTXData(texture, ktxInfo) {
        }
        setTextureHDRData(texture, hdrInfo) {
        }
        setCubeImageData(texture, sources, premultiplyAlpha, invertY) {
        }
        setCubePixelsData(texture, source, premultiplyAlpha, invertY) {
        }
        setCubeSubPixelData(texture, source, mipmapLevel, generateMipmap, xOffset, yOffset, width, height, premultiplyAlpha, invertY) {
        }
        setCubeDDSData(texture, ddsInfo) {
        }
        setCubeKTXData(texture, ktxInfo) {
        }
        setTextureCompareMode(texture, compareMode) {
            texture.compareMode = compareMode;
            return compareMode;
        }
        createMultiRenderTargetInternal(width, height, colorFormats, depthStencilFormat) {
            throw new Error("NoRender createMultiRenderTargetInternal is not implemented.");
        }
        createRenderTargetInternal(width, height, format, depthStencilFormat, generateMipmap, sRGB, multiSamples, storage) {
            return this._createRenderTarget(Laya.TextureDimension.Tex2D, width, height, 1, format, depthStencilFormat, generateMipmap, sRGB, multiSamples);
        }
        createRenderTargetCubeInternal(size, colorFormat, depthStencilFormat, generateMipmap, sRGB, multiSamples) {
            return this._createRenderTarget(Laya.TextureDimension.Cube, size, size, 1, colorFormat, depthStencilFormat, generateMipmap, sRGB, multiSamples);
        }
        createRenderTargetDepthTexture(renderTarget, dimension, width, height) {
            const texture = this.createTextureInternal(dimension, width, height, renderTarget.depthStencilFormat, false, false, false);
            renderTarget._depthTexture = texture;
            return texture;
        }
        bindRenderTarget(renderTarget, faceIndex) {
        }
        bindoutScreenTarget() {
        }
        unbindRenderTarget(renderTarget) {
        }
        readRenderTargetPixelData(renderTarget, xOffset, yOffset, width, height, out) {
            if (!out) {
                const format = renderTarget.colorFormat;
                const floatFormat = format === Laya.RenderTargetFormat.R16G16B16 || format === Laya.RenderTargetFormat.R16G16B16A16 ||
                    format === Laya.RenderTargetFormat.R32G32B32 || format === Laya.RenderTargetFormat.R32G32B32A32;
                const channels = format === Laya.RenderTargetFormat.R8G8B8 || format === Laya.RenderTargetFormat.R16G16B16 ||
                    format === Laya.RenderTargetFormat.R32G32B32 ? 3 : 4;
                out = floatFormat ? new Float32Array(width * height * channels) : new Uint8Array(width * height * channels);
            }
            new Uint8Array(out.buffer, out.byteOffset, out.byteLength).fill(0);
            return out;
        }
        readRenderTargetPixelDataAsync(renderTarget, xOffset, yOffset, width, height, out, attachmentIndex = 0) {
            if (attachmentIndex !== 0)
                return Promise.reject(new Error("NoRender readRenderTargetPixelDataAsync currently only supports color attachment 0."));
            return Promise.resolve(this.readRenderTargetPixelData(renderTarget, xOffset, yOffset, width, height, out));
        }
        updateVideoTexture(texture, video, premultiplyAlpha, invertY) {
        }
        createTexture3DInternal(dimension, width, height, depth, format, generateMipmap, sRGB, premultipliedAlpha) {
            const texture = this.createTextureInternal(dimension, width, height, format, generateMipmap, sRGB, premultipliedAlpha);
            texture.depth = depth;
            if (generateMipmap && dimension === Laya.TextureDimension.Tex3D) {
                texture.mipmapCount = 1 + Math.floor(Math.log2(Math.max(1, width, height, depth)));
                texture.maxMipmapLevel = texture.mipmapCount - 1;
            }
            return texture;
        }
        setTexture3DImageData(texture, source, depth, premultiplyAlpha, invertY) {
        }
        setTexture3DPixelsData(texture, source, depth, premultiplyAlpha, invertY) {
        }
        setTexture3DSubPixelsData(texture, source, mipmapLevel, generateMipmap, xOffset, yOffset, zOffset, width, height, depth, premultiplyAlpha, invertY) {
        }
    }

    class NoRenderDefineDatas {
        constructor() {
            this._mask = [];
            this._length = 0;
        }
        _intersectionDefineDatas(define) {
            var unionMask = define._mask;
            var mask = this._mask;
            for (var i = this._length - 1; i >= 0; i--) {
                var value = mask[i] & unionMask[i];
                if (value === 0 && i === this._length - 1)
                    this._length--;
                else
                    mask[i] = value;
            }
        }
        add(define) {
            var index = define._index;
            var size = index + 1;
            var mask = this._mask;
            var maskStart = this._length;
            if (maskStart < size) {
                (mask.length < size) && (mask.length = size);
                for (; maskStart < index; maskStart++)
                    mask[maskStart] = 0;
                mask[index] = define._value;
                this._length = size;
                return true;
            }
            let last = mask[index];
            mask[index] |= define._value;
            return last !== mask[index];
        }
        remove(define) {
            var index = define._index;
            var mask = this._mask;
            var endIndex = this._length - 1;
            if (index > endIndex)
                return false;
            let lastValue = mask[index];
            var newValue = mask[index] & ~define._value;
            if (index == endIndex && newValue === 0)
                this._length--;
            else
                mask[index] = newValue;
            return lastValue !== newValue;
        }
        addDefineDatas(define) {
            var addMask = define._mask;
            var size = define._length;
            var mask = this._mask;
            var maskStart = this._length;
            if (maskStart < size) {
                mask.length = size;
                for (var i = 0; i < maskStart; i++)
                    mask[i] |= addMask[i];
                for (; i < size; i++)
                    mask[i] = addMask[i];
                this._length = size;
            }
            else {
                for (var i = 0; i < size; i++)
                    mask[i] |= addMask[i];
            }
        }
        removeDefineDatas(define) {
            var removeMask = define._mask;
            var mask = this._mask;
            var endIndex = this._length - 1;
            var i = Math.min(define._length, endIndex);
            for (; i >= 0; i--) {
                var newValue = mask[i] & ~removeMask[i];
                if (i == endIndex && newValue === 0) {
                    endIndex--;
                    this._length--;
                }
                else {
                    mask[i] = newValue;
                }
            }
        }
        has(define) {
            var index = define._index;
            if (index >= this._length)
                return false;
            return (this._mask[index] & define._value) !== 0;
        }
        clear() {
            this._length = 0;
        }
        cloneTo(destObject) {
            var destMask = destObject._mask;
            var mask = this._mask;
            var count = this._length;
            destMask.length = count;
            for (var i = 0; i < count; i++)
                destMask[i] = mask[i];
            destObject._length = count;
        }
        clone() {
            var dest = new NoRenderDefineDatas();
            this.cloneTo(dest);
            return dest;
        }
        destroy() {
            delete this._mask;
        }
    }
    class NoRenderDeviceFactory {
        constructor() {
            this._uniformMaps = new Map();
        }
        createShaderInstance(shaderProcessInfo, shaderPass) {
            return new NoRenderShaderInstance();
        }
        createIndexBuffer(bufferUsage) {
            return new NoRenderIndexBuffer();
        }
        createVertexBuffer(bufferUsageType) {
            return new NoRenderVertexBuffer();
        }
        createBufferState() {
            return new NoRenderBufferState();
        }
        createRenderGeometryElement(mode, drawType) {
            return new NoRenderGeometryElement(mode, drawType);
        }
        createEngine(config, canvas) {
            let engine = new NoRenderEngine();
            engine.initRenderEngine(null);
            Laya.LayaGL.renderEngine = engine;
            Laya.LayaGL.textureContext = engine.getTextureContext();
            return Promise.resolve();
        }
        createGlobalUniformMap(blockName) {
            let map = this._uniformMaps.get(blockName);
            if (!map) {
                map = new NoRenderCommandUnifojrmMap(blockName);
                this._uniformMaps.set(blockName, map);
            }
            return map;
        }
        createShaderData(ownerResource) {
            return new NoRenderShaderData(ownerResource);
        }
    }
    class NoRenderCommandUnifojrmMap extends Laya.CommandUniformMap {
        constructor(stateName) {
            super(stateName);
            this._idata = new Map();
            this._defaultTextures = new Map();
            this._stateID = Laya.LayaGL.renderEngine.propertyNameToID(stateName);
        }
        hasPtrID(propertyID) {
            return this._stateID === propertyID || this._idata.has(propertyID);
        }
        addShaderUniform(propertyID, propertyKey, uniformtype, options) {
            this._idata.set(propertyID, Object.assign({ id: propertyID, propertyName: propertyKey, uniformtype, arrayLength: 0 }, options));
        }
        addShaderUniformArray(propertyID, propertyName, uniformtype, arrayLength, block = "") {
            this._idata.set(propertyID, { id: propertyID, propertyName, uniformtype, arrayLength });
        }
        setDefaultTextureData(key, defaultTex) {
            this._defaultTextures.set(key, defaultTex);
        }
    }
    class NoRenderShaderInstance {
        _serializeShader() {
            return null;
        }
        _deserialize(buffer) {
            return false;
        }
        _create(shaderProcessInfo, shaderPass) {
        }
        _disposeResource() {
        }
    }
    class NoRenderIndexBuffer {
        setData(buffer, bufferOffset, dataStartIndex, dataCount) {
        }
        destroy() {
        }
        _setIndexDataLength(data) {
        }
        _setIndexData(data, bufferOffset) {
        }
    }
    class NoRenderVertexBuffer {
        getStorageBuffer() {
            return null;
        }
        setData(buffer, bufferOffset, dataStartIndex, dataCount) {
        }
        setDataLength(byteLength) {
        }
        destroy() {
        }
    }
    class NoRenderBufferState {
        constructor() {
            this._vertexBuffers = [];
        }
        applyState(vertexBuffers, indexBuffer) {
            this._vertexBuffers = vertexBuffers.slice();
            this._bindedIndexBuffer = indexBuffer;
        }
        destroy() {
        }
    }
    class NoRenderGeometryElement {
        constructor(mode = Laya.MeshTopology.Triangles, drawType = Laya.DrawType.DrawElement) {
            this.instanceCount = 1;
            this.drawParams = new Laya.FastSinglelist();
            this.mode = mode;
            this.drawType = drawType;
        }
        getDrawDataParams(out) {
            out && this.drawParams.cloneTo(out);
        }
        setDrawArrayParams(first, count) {
            this.drawParams.add(first);
            this.drawParams.add(count);
        }
        setDrawElemenParams(count, offset) {
            this.drawParams.add(offset);
            this.drawParams.add(count);
        }
        clearRenderParams() {
            this.drawParams.clear();
        }
        destroy() {
            this.drawParams.clear();
            this.bufferState = null;
        }
    }
    class NoRenderShaderData extends Laya.ShaderData {
        constructor() {
            super(...arguments);
            this._data = {};
            this._defineDatas = new NoRenderDefineDatas();
        }
        getDefineData() {
            return this._defineDatas;
        }
        getData() {
            return this._data;
        }
        addDefine(define) {
            this._defineDatas.add(define);
        }
        addDefines(define) {
            this._defineDatas.addDefineDatas(define);
        }
        removeDefine(define) {
            this._defineDatas.remove(define);
        }
        hasDefine(define) {
            return this._defineDatas.has(define);
        }
        clearDefine() {
            this._defineDatas.clear();
        }
        clearData() {
            for (const k in this._data) {
                const value = this._data[k];
                if (value instanceof Laya.Resource) {
                    value._removeReference();
                }
            }
            this._data = {};
            this.clearDefine();
        }
        getBool(index) {
            return this._data[index];
        }
        setBool(index, value) {
            this._data[index] = value;
        }
        getInt(index) {
            return this._data[index];
        }
        setInt(index, value) {
            this._data[index] = value;
        }
        getNumber(index) {
            return this._data[index];
        }
        setNumber(index, value) {
            this._data[index] = value;
        }
        getVector2(index) {
            return this._data[index];
        }
        setVector2(index, value) {
            const current = this._data[index];
            if (value && current instanceof Laya.Vector2)
                value.cloneTo(current);
            else
                this._data[index] = value ? value.clone() : value;
        }
        getVector3(index) {
            return this._data[index];
        }
        setVector3(index, value) {
            const current = this._data[index];
            if (value && current instanceof Laya.Vector3)
                value.cloneTo(current);
            else
                this._data[index] = value ? value.clone() : value;
        }
        getVector(index) {
            return this._data[index];
        }
        setVector(index, value) {
            const current = this._data[index];
            if (value && current instanceof Laya.Vector4)
                value.cloneTo(current);
            else
                this._data[index] = value ? value.clone() : value;
        }
        getColor(index) {
            return this._data[index];
        }
        setColor(index, value) {
            const current = this._data[index];
            if (value && current instanceof Laya.Color)
                value.cloneTo(current);
            else
                this._data[index] = value ? value.clone() : value;
        }
        getMatrix4x4(index) {
            return this._data[index];
        }
        setMatrix4x4(index, value) {
            const current = this._data[index];
            if (value && current instanceof Laya.Matrix4x4)
                value.cloneTo(current);
            else
                this._data[index] = value ? value.clone() : value;
        }
        getMatrix3x3(index) {
            return this._data[index];
        }
        setMatrix3x3(index, value) {
            const current = this._data[index];
            if (value && current instanceof Laya.Matrix3x3)
                value.cloneTo(current);
            else
                this._data[index] = value ? value.clone() : value;
        }
        getBuffer(index) {
            return this._data[index];
        }
        setBuffer(index, value) {
            this._data[index] = value;
        }
        setTexture(index, value) {
            const previous = this._data[index];
            if (previous === value)
                return;
            value && value._addReference();
            this._data[index] = value;
            if (previous instanceof Laya.Resource)
                previous._removeReference();
        }
        getTexture(index) {
            return this._data[index];
        }
        setShaderData(uniformIndex, type, value) {
            switch (type) {
                case Laya.ShaderDataType.Int:
                    this.setInt(uniformIndex, value);
                    break;
                case Laya.ShaderDataType.Bool:
                    this.setBool(uniformIndex, value);
                    break;
                case Laya.ShaderDataType.Float:
                    this.setNumber(uniformIndex, value);
                    break;
                case Laya.ShaderDataType.Vector2:
                    this.setVector2(uniformIndex, value);
                    break;
                case Laya.ShaderDataType.Vector3:
                    this.setVector3(uniformIndex, value);
                    break;
                case Laya.ShaderDataType.Vector4:
                    this.setVector(uniformIndex, value);
                    break;
                case Laya.ShaderDataType.Color:
                    this.setColor(uniformIndex, value);
                    break;
                case Laya.ShaderDataType.Matrix4x4:
                    this.setMatrix4x4(uniformIndex, value);
                    break;
                case Laya.ShaderDataType.Matrix3x3:
                    this.setMatrix3x3(uniformIndex, value);
                    break;
                case Laya.ShaderDataType.Texture2D:
                case Laya.ShaderDataType.TextureCube:
                case Laya.ShaderDataType.Texture2DArray:
                case Laya.ShaderDataType.Texture3D:
                    this.setTexture(uniformIndex, value);
                    break;
                case Laya.ShaderDataType.Buffer:
                    this.setBuffer(uniformIndex, value);
                    break;
                default:
                    throw new Error(`unkown shader data type: ${type}`);
            }
        }
        getShaderData(uniformIndex, type) {
            switch (type) {
                case Laya.ShaderDataType.Int:
                    return this.getInt(uniformIndex);
                case Laya.ShaderDataType.Bool:
                    return this.getBool(uniformIndex);
                case Laya.ShaderDataType.Float:
                    return this.getNumber(uniformIndex);
                case Laya.ShaderDataType.Vector2:
                    return this.getVector2(uniformIndex);
                case Laya.ShaderDataType.Vector3:
                    return this.getVector3(uniformIndex);
                case Laya.ShaderDataType.Vector4:
                    return this.getVector(uniformIndex);
                case Laya.ShaderDataType.Color:
                    return this.getColor(uniformIndex);
                case Laya.ShaderDataType.Matrix4x4:
                    return this.getMatrix4x4(uniformIndex);
                case Laya.ShaderDataType.Texture2D:
                case Laya.ShaderDataType.TextureCube:
                case Laya.ShaderDataType.Texture2DArray:
                case Laya.ShaderDataType.Texture3D:
                    return this.getTexture(uniformIndex);
                case Laya.ShaderDataType.Buffer:
                    return this.getBuffer(uniformIndex);
                case Laya.ShaderDataType.Matrix3x3:
                    return this.getMatrix3x3(uniformIndex);
                case Laya.ShaderDataType.Matrix4x4:
                    return this.getMatrix4x4(uniformIndex);
                default:
                    throw "unknown shader data type.";
            }
        }
        _setInternalTexture(index, value) {
            const previous = this._data[index];
            this._data[index] = value;
            if (previous instanceof Laya.Resource)
                previous._removeReference();
        }
        update(name) {
        }
        cloneTo(destObject) {
            if (destObject === this)
                return;
            destObject.clearData();
            for (const key in this._data) {
                const value = this._data[key];
                if (value instanceof Laya.Resource) {
                    value._addReference();
                    destObject._data[key] = value;
                }
                else if (value instanceof Float32Array) {
                    destObject._data[key] = value.slice();
                }
                else if (value instanceof Laya.Color || value instanceof Laya.Vector2 || value instanceof Laya.Vector3 ||
                    value instanceof Laya.Vector4 || value instanceof Laya.Matrix3x3 || value instanceof Laya.Matrix4x4) {
                    destObject._data[key] = value.clone();
                }
                else {
                    destObject._data[key] = value;
                }
            }
            this._defineDatas.cloneTo(destObject._defineDatas);
        }
        clone() {
            var dest = new NoRenderShaderData();
            this.cloneTo(dest);
            return dest;
        }
        destroy() {
            if (!this._data)
                return;
            this.clearData();
            this._defineDatas.destroy();
            this._defineDatas = null;
            this._data = null;
        }
    }
    class NoRenderSetRenderData extends Laya.SetRenderDataCMD {
        get dataType() {
            return this._dataType;
        }
        set dataType(value) {
            this._dataType = value;
        }
        get propertyID() {
            return this._propertyID;
        }
        set propertyID(value) {
            this._propertyID = value;
        }
        get dest() {
            return this._dest;
        }
        set dest(value) {
            this._dest = value;
        }
        get value() {
            return this._value;
        }
        set value(value) {
            this._value = value;
        }
        constructor() {
            super();
            this.type = Laya.RenderCMDType.ChangeData;
        }
        apply(context) {
        }
    }
    class NoRenderSetShaderDefine extends Laya.SetShaderDefineCMD {
        get define() {
            return this._define;
        }
        set define(value) {
            this._define = value;
        }
        get dest() {
            return this._dest;
        }
        set dest(value) {
            this._dest = value;
        }
        get add() {
            return this._add;
        }
        set add(value) {
            this._add = value;
        }
        constructor() {
            super();
            this.type = Laya.RenderCMDType.ChangeShaderDefine;
        }
        apply(context) {
        }
    }
    Laya.Laya.addBeforeInitCallback(() => {
        if (!Laya.LayaGL.renderDeviceFactory)
            Laya.LayaGL.renderDeviceFactory = new NoRenderDeviceFactory();
    });

    class NoRenderTransform2DMemoryFactory {
        createChunkBuffers(_chunkIndex, capacity, dirtyWords) {
            const parent = new Int32Array(capacity);
            return {
                localTrs: new Float32Array(capacity * 9),
                localAlpha: new Float32Array(capacity),
                localFlags: new Uint8Array(capacity),
                world: new Float32Array(capacity * 8),
                parent,
                childCount: new Uint16Array(capacity),
                childrenInline: new Int32Array(capacity * 8),
                selfDirtyM: new Uint32Array(dirtyWords),
                treeDirtyM: new Uint32Array(dirtyWords),
                selfDirtyA: new Uint32Array(dirtyWords),
                treeDirtyA: new Uint32Array(dirtyWords),
                selfDirtyC: new Uint32Array(dirtyWords),
                treeDirtyC: new Uint32Array(dirtyWords),
                slotGen: new Uint16Array(capacity),
                matrixFrame: new Uint32Array(capacity),
                alphaFrame: new Uint32Array(capacity),
                cullingFrame: new Uint32Array(capacity),
            };
        }
        createControlBuffer(length) {
            return new Int32Array(length);
        }
        createChangedBuffers(capacity) {
            return { slots: new Int32Array(capacity), masks: new Int32Array(capacity) };
        }
    }

    class NoRenderGraphicsOp2D {
        constructor(kind, commandIndex, commandId) {
            this.kind = kind;
            this.commandIndex = commandIndex;
            this.commandId = commandId;
            this.buffer = new ArrayBuffer(0);
            this.dirtyFlags = 23;
            this.recordCount = 0;
            this.texture = null;
            this.textures = [];
        }
        setCommandIndex(value) {
            this.commandIndex = value;
        }
        get opType() {
            switch (this.kind) {
                case 1:
                    return "textureQuad";
                case 2:
                    return "solidQuad";
                case 3:
                    return "fillTexture";
                case 4:
                    return "mesh";
                case 7:
                    return "msdfMesh";
                case 6:
                    return "text";
                default:
                    return "multiQuad";
            }
        }
        get opProfile() {
            switch (this.kind) {
                case 1:
                    return 1;
                case 2:
                    return 3;
                case 3:
                    return 5;
                case 4:
                    return 8;
                case 7:
                    return 9;
                case 6:
                    return 7;
                default:
                    return 6;
            }
        }
        canUpdate(commandId) {
            return this.commandId === commandId;
        }
        resetRecords() {
            this.recordCount = 0;
        }
        writeStructureSignature(out, offset) {
            out[offset] = this.recordCount;
            out[offset + 1] = 0;
            out[offset + 2] = 0;
            out[offset + 3] = 0;
        }
        matchesStructureSignature(source, offset) {
            return this.recordCount === source[offset] && source[offset + 3] === 0;
        }
        clearStructureDirty() {
            this.dirtyFlags &= ~1;
        }
        markDirty(flags) {
            this.dirtyFlags |= flags;
        }
        clearDirty() {
            this.dirtyFlags = 0;
        }
        writeRecord(...args) {
            this.recordCount = Math.max(1, this.recordCount + (this.kind === 5 || this.kind === 6 ? 1 : 0));
            this.markDirty(2 | 4 | 16);
        }
        setTextures(textures, count = textures ? textures.length : 0) {
            this.textures.length = count;
            for (let i = 0; i < count; i++)
                this.textures[i] = textures[i] || null;
            this.texture = count > 0 ? this.textures[0] : null;
            this.markDirty(4);
        }
        addRecord(x, y, width, height, u0, v0, u1, v1, packedColor, alpha, blendMode, textureLayer, matrix) {
            this.recordCount++;
            this.markDirty(2 | 16);
        }
        writeMesh(x, y, vertices, vertexOffset, vertexCount, uvs, uvOffset, indices, indexOffset, indexCount, colors, colorOffset, packedColor, alpha, blendMode, textureLayer, matrix) {
            this.markDirty(2 | 4 | 16);
        }
        writeMSDFMesh(...args) {
            this.markDirty(2 | 4 | 16);
        }
        destroy() {
            this.texture = null;
        }
    }
    class NoRenderGraphicsOp2DFactory {
        createTextureQuadOp(commandIndex, commandId) {
            return new NoRenderGraphicsOp2D(1, commandIndex, commandId);
        }
        createFillTextureOp(commandIndex, commandId) {
            return new NoRenderGraphicsOp2D(3, commandIndex, commandId);
        }
        createSolidQuadOp(commandIndex, commandId) {
            return new NoRenderGraphicsOp2D(2, commandIndex, commandId);
        }
        createMeshOp(commandIndex, commandId) {
            return new NoRenderGraphicsOp2D(4, commandIndex, commandId);
        }
        createMSDFMeshOp(commandIndex, commandId) {
            return new NoRenderGraphicsOp2D(7, commandIndex, commandId);
        }
        createMultiQuadOp(commandIndex, commandId) {
            return new NoRenderGraphicsOp2D(5, commandIndex, commandId);
        }
        createTextOp(commandIndex, commandId) {
            return new NoRenderGraphicsOp2D(6, commandIndex, commandId);
        }
    }

    class NoRender2DProcess {
        createTransform2DMemoryFactory() {
            return new NoRenderTransform2DMemoryFactory();
        }
        createRender2DPassManager() {
            return new NoRender2DPassManager();
        }
        create2DGlobalRenderDataHandle() {
            return new NoRenderGlobalRenderData();
        }
        createRender2DPass() {
            return new NoRender2DPass();
        }
        createRenderStruct2D() {
            return new NoRenderStruct2D();
        }
        createSubStructRenderDataHandle() {
            return new NoRenderSubStructDataHandle();
        }
        createGraphicsSingleQuadDataHandle() {
            return new NoRenderGraphicsSingleQuadDataHandle();
        }
        createGraphicsCommandStreamDataHandle() {
            return new NoRenderGraphicsCommandStreamDataHandle();
        }
        createGraphicsOp2DFactory() {
            return new NoRenderGraphicsOp2DFactory();
        }
        create2DBaseRenderDataHandle() {
            return new NoRenderBaseDataHandle();
        }
        createMesh2DRenderDataHandle() {
            return new NoRenderMeshDataHandle();
        }
        createSetRenderDataCMD() {
            return new NoRenderSetRenderData();
        }
        createSetShaderDefineCMD() {
            return new NoRenderSetShaderDefine();
        }
        createBlit2DQuadCMDData() {
            return new NoRenderBlit2DquadCMD();
        }
        createDraw2DElementCMDData() {
            return new NoRenderDraw2DElementCMD();
        }
        createSetRendertarget2DCMD() {
            return new NoRenderSetRendertarget2DCMD();
        }
        createRenderElement2D() {
            return new NoRenderElement2D();
        }
        createPrimitiveRenderElement2D() {
            return new NoRenderPrimitiveRenderElement2D();
        }
        createRenderContext2D() {
            return new NoRenderContext2D();
        }
        createEmptyRenderDataHandle() {
            return new NoRenderEmptyDataHandle();
        }
    }
    class NoRenderElement2D {
        destroy() {
        }
    }
    class NoRenderPrimitiveRenderElement2D extends NoRenderElement2D {
        constructor() {
            super(...arguments);
            this.typeKey = 0;
            this.textureKey = 0;
            this.primitiveShaderData = null;
        }
    }
    class NoRenderContext2D {
        constructor() {
            this._renderTarget = null;
            this._offscreenView = new Laya.Vector4();
            this.invertY = false;
            this.pipelineMode = "Forward";
        }
        getRenderTarget() {
            return this._renderTarget;
        }
        setRenderTarget(value, clear, clearColor) {
            this._renderTarget = value;
        }
        setOffscreenView(width, height, x = 0, y = 0) {
            this._offscreenView.setValue(x, y, width, height);
        }
        getOffscreenView(out) {
            this._offscreenView.cloneTo(out);
        }
        drawRenderElementOne(node) {
        }
        drawRenderElementList(list) {
            return 0;
        }
        runOneCMD(cmd) {
        }
        runCMDList(cmds) {
        }
    }
    class NoRenderBlit2DquadCMD extends Laya.Blit2DQuadCMD {
        apply(context) {
        }
    }
    class NoRenderDraw2DElementCMD extends Laya.Draw2DElementCMD {
        setRenderelements(value) {
        }
        apply(context) {
        }
    }
    class NoRenderSetRendertarget2DCMD extends Laya.SetRendertarget2DCMD {
        apply(context) {
        }
    }
    Laya.Laya.addBeforeInitCallback(() => {
        if (!Laya.LayaGL.render2DRenderPassFactory)
            Laya.LayaGL.render2DRenderPassFactory = new NoRender2DProcess();
    });

    class NoRenderDirectLight {
        setShadowFourCascadeSplits(value) { }
        setDirection(value) { }
    }
    class NoRenderSpotLight {
        setDirection(value) { }
    }
    class NoRenderPointLight {
    }
    class NoRenderLightmapData {
        destroy() { }
    }
    class NoRenderReflectionProbe {
        setProbePosition(value) { }
        setAmbientColor(value) { }
        setAmbientSH(value) { }
        destroy() { }
    }
    class NoRenderVolumetricGI {
        constructor() {
            this.bound = new Laya.Bounds();
        }
        setProbeCounts(value) { }
        setProbeStep(value) { }
        setParams(value) { }
        destroy() { }
    }
    class NoRenderCameraNodeData {
        setProjectionViewMatrix(value) { }
    }
    class NoRenderSceneNodeData {
    }
    class NoRenderBaseRenderNode {
        constructor() {
            this.renderOrder = 0;
            this.additionShaderData = new Map();
            this.ismoved = new Laya.Vector2();
            this.perCameraUpdate = false;
        }
        set_renderUpdatePreCall(call, fun) { }
        set_caculateBoundingBox(call, fun) { }
        setRenderelements(value) { }
        setLightmapScaleOffset(value) { }
        setCommonUniformMap(value) { }
        setNodeCustomData(dataSlot, data) { }
        _applyLightProb() { }
        _applyReflection() { }
        destroy() { this.additionShaderData = null; }
    }
    class NoRenderMeshRenderNode extends NoRenderBaseRenderNode {
    }
    class NoRenderSkinRenderNode extends NoRenderMeshRenderNode {
        computeSkinnedData() { }
        setRootBoneTransfom(value) { }
        setOwnerTransform(value) { }
        setCacheMesh(cacheMesh) { }
        setBones(value) { }
        setSkinnedData(value) { }
    }
    class NoRenderSimpleSkinRenderNode extends NoRenderBaseRenderNode {
        setSimpleAnimatorParams(value) { }
    }
    class NoRender3DModuleFactory {
        createTransform(owner) {
            return new Laya.Transform3D(owner);
        }
        createBounds(min, max) {
            return new Laya.BoundsImpl(min, max);
        }
        createVolumetricGI() {
            return new NoRenderVolumetricGI();
        }
        createReflectionProbe() {
            return new NoRenderReflectionProbe();
        }
        createLightmapData() {
            return new NoRenderLightmapData();
        }
        createDirectLight() {
            return new NoRenderDirectLight();
        }
        createSpotLight() {
            return new NoRenderSpotLight();
        }
        createPointLight() {
            return new NoRenderPointLight();
        }
        createCameraModuleData() {
            return new NoRenderCameraNodeData();
        }
        createSceneModuleData() {
            return new NoRenderSceneNodeData();
        }
        createBaseRenderNode() {
            return new NoRenderBaseRenderNode();
        }
        createMeshRenderNode() {
            return new NoRenderMeshRenderNode();
        }
        createSkinRenderNode() {
            return new NoRenderSkinRenderNode();
        }
        createSimpleSkinRenderNode() {
            return new NoRenderSimpleSkinRenderNode();
        }
    }
    Laya.Laya.addBeforeInitCallback(() => {
        if (!Laya.Laya3DRender.Render3DModuleDataFactory) {
            Laya.Laya3DRender.Render3DModuleDataFactory = new NoRender3DModuleFactory();
        }
    });

    class NoRender3DRenderPassFactory {
        createComputeCommandAppatchCMD() {
            return new NoRenderComputeCommandAppatchCMD();
        }
        createRender3DProcess() {
            return new NoRenderRender3DProcess();
        }
        createRenderContext3D() {
            return new NoRenderRenderContext3D();
        }
        createRenderElement3D() {
            return new NoRenderRenderElement3D();
        }
        createSkinRenderElement() {
            return new NoRenderSkinRenderElement3D();
        }
        createSceneRenderManager() {
            return new NoRenderSceneRenderManager();
        }
        createDrawNodeCMDData() {
            return new NoRenderDrawNodeCMDData();
        }
        createBlitQuadCMDData() {
            return new NoRenderBlitQuadCMDData();
        }
        createDrawElementCMDData() {
            return new NoRenderDrawElementCMDData();
        }
        createSetViewportCMD() {
            return new NoRenderSetViewportCMD();
        }
        createSetRenderTargetCMD() {
            return new NoRenderSetRenderTargetCMD();
        }
        createSetRenderDataCMD() {
            return new NoRenderSetRenderData();
        }
        createSetShaderDefineCMD() {
            return new NoRenderSetShaderDefine();
        }
    }
    class NoRenderComputeCommandAppatchCMD extends Laya.ComputeCommandAppatchCMD {
        constructor() {
            super();
            this.type = Laya.RenderCMDType.ComputeCommandAppatch;
        }
        apply(_context) {
        }
    }
    class NoRenderRender3DProcess {
        destroy() {
        }
        fowardRender(context, camera) {
        }
    }
    class NoRenderSceneRenderManager {
        constructor() {
            this.list = new Laya.SingletonList();
            this.baseRenderList = new Laya.SingletonList();
        }
        registerBatchModuleAgent(renderNodeType, agent) {
        }
        updateProperty(object, property) {
        }
        addRenderObject(object) {
        }
        removeRenderObject(object) {
        }
        removeMotionObject(object) {
        }
        addMotionObject(object) {
        }
        updateMotionObjects() {
        }
        destroy() {
            this.list.clear();
            this.baseRenderList.clear();
            this.list = null;
            this.baseRenderList = null;
        }
    }
    class NoRenderRenderContext3D {
        setRenderTarget(value, clearFlag) {
        }
        setViewPort(value) {
        }
        setScissor(value) {
        }
        setClearData(clearFlag, color, depth, stencil, colorValues) {
            return 0;
        }
        drawRenderElementList(list) {
            return 0;
        }
        drawRenderElementOne(node) {
            return 0;
        }
        runOneCMD(cmd) {
        }
        runCMDList(cmds) {
        }
        clearRenderTarget() {
        }
    }
    class NoRenderRenderElement3D {
        constructor() {
            this.sortIndex = 0;
        }
        destroy() {
        }
    }
    class NoRenderSkinRenderElement3D {
        constructor() {
            this.skinnedData = [];
        }
    }
    class NoRenderDrawNodeCMDData extends Laya.DrawNodeCMDData {
        get node() {
            return this._node;
        }
        set node(value) {
            this._node = value;
        }
        get destShaderData() {
            return this._destShaderData;
        }
        set destShaderData(value) {
            this._destShaderData = value;
        }
        get destSubShader() {
            return this._destSubShader;
        }
        set destSubShader(value) {
            this._destSubShader = value;
        }
        get subMeshIndex() {
            return this._subMeshIndex;
        }
        set subMeshIndex(value) {
            this._subMeshIndex = value;
        }
        constructor() {
            super();
            this.type = Laya.RenderCMDType.DrawNode;
        }
        apply(context) {
        }
    }
    class NoRenderBlitQuadCMDData extends Laya.BlitQuadCMDData {
        get dest() {
            return this._dest;
        }
        set dest(value) {
            this._dest = value;
        }
        get viewport() {
            return this._viewport;
        }
        set viewport(value) {
            value.cloneTo(this._viewport);
        }
        get scissor() {
            return this._scissor;
        }
        set scissor(value) {
            value.cloneTo(this._scissor);
        }
        get source() {
            return this._source;
        }
        set source(value) {
            this._source = value;
            if (this._source) {
                this._sourceTexelSize.setValue(1.0 / this._source.width, 1.0 / this._source.height, this._source.width, this._source.height);
            }
        }
        get offsetScale() {
            return this._offsetScale;
        }
        set offsetScale(value) {
            value.cloneTo(this._offsetScale);
        }
        get element() {
            return this._element;
        }
        set element(value) {
            this._element = value;
        }
        constructor() {
            super();
            this.type = Laya.RenderCMDType.Blit;
            this._viewport = new Laya.Viewport();
            this._scissor = new Laya.Vector4();
            this._offsetScale = new Laya.Vector4();
            this._sourceTexelSize = new Laya.Vector4();
        }
        apply(context) {
        }
    }
    class NoRenderDrawElementCMDData extends Laya.DrawElementCMDData {
        constructor() {
            super();
            this._elemets = [];
            this.type = Laya.RenderCMDType.DrawElement;
        }
        setRenderelements(value) {
            this._elemets = value;
        }
        apply(context) {
        }
    }
    class NoRenderSetViewportCMD extends Laya.SetViewportCMD {
        get viewport() {
            return this._viewport;
        }
        set viewport(value) {
            this._viewport = value;
        }
        get scissor() {
            return this._scissor;
        }
        set scissor(value) {
            this._scissor = value;
        }
        constructor() {
            super();
            this.type = Laya.RenderCMDType.ChangeViewPort;
            this.scissor = new Laya.Vector4();
            this.viewport = new Laya.Viewport();
        }
        apply(context) {
        }
    }
    new Laya.Viewport();
    new Laya.Vector4();
    class NoRenderSetRenderTargetCMD extends Laya.SetRenderTargetCMD {
        get rt() {
            return this._rt;
        }
        set rt(value) {
            this._rt = value;
        }
        get clearFlag() {
            return this._clearFlag;
        }
        set clearFlag(value) {
            this._clearFlag = value;
        }
        get clearColorValue() {
            return this._clearColorValue;
        }
        set clearColorValue(value) {
            value.cloneTo(this._clearColorValue);
            this._clearColorValues = null;
        }
        get clearDepthValue() {
            return this._clearDepthValue;
        }
        set clearDepthValue(value) {
            this._clearDepthValue = value;
        }
        get clearStencilValue() {
            return this._clearStencilValue;
        }
        set clearStencilValue(value) {
            this._clearStencilValue = value;
        }
        constructor() {
            super();
            this.type = Laya.RenderCMDType.ChangeRenderTarget;
            this._clearColorValue = new Laya.Color();
        }
        apply(context) {
        }
    }
    Laya.Laya.addBeforeInitCallback(() => {
        if (!Laya.Laya3DRender.Render3DPassFactory)
            Laya.Laya3DRender.Render3DPassFactory = new NoRender3DRenderPassFactory();
    });

    class NoRenderShaderPass {
        _cacheKey(define) {
            let length = define._length;
            while (length > 0 && !define._mask[length - 1])
                length--;
            return define._mask.slice(0, length).join(",");
        }
        get validDefine() { return this._validDefine; }
        set validDefine(value) { this._validDefine = value; }
        get renderState() { return this._renderState; }
        set renderState(value) { this._renderState = value; }
        constructor(pass) {
            this._validDefine = new NoRenderDefineDatas();
            this._renderState = new Laya.RenderState();
            this._cacheShaders = new Map();
            this._renderState.setNull();
        }
        setCacheShader(compileDefine, shader) {
            const key = this._cacheKey(compileDefine);
            if (shader)
                this._cacheShaders.set(key, shader);
            else
                this._cacheShaders.delete(key);
        }
        getCacheShader(compileDefine) {
            compileDefine._intersectionDefineDatas(this._validDefine);
            return this._cacheShaders.get(this._cacheKey(compileDefine)) || null;
        }
        destroy() {
            for (const shader of new Set(this._cacheShaders.values()))
                shader._disposeResource();
            this._cacheShaders.clear();
            this._validDefine.destroy();
        }
    }
    class NoRenderSubShader {
        constructor() {
            this.shaderPasses = [];
            this.uniformMap = new Map();
        }
        addShaderPass(pass) { this.shaderPasses.push(pass); }
        setUniformMap(uniformMap) { this.uniformMap = new Map(uniformMap); }
        destroy() {
            for (const pass of this.shaderPasses)
                pass.destroy();
            this.shaderPasses.length = 0;
            this.uniformMap.clear();
        }
    }
    class NoRenderUnitModuleDataFactory {
        createSubShader() {
            return new NoRenderSubShader();
        }
        createShaderPass(pass) {
            return new NoRenderShaderPass(pass);
        }
        createRenderState() {
            return new Laya.RenderState();
        }
        createDefineDatas() {
            return new NoRenderDefineDatas();
        }
    }
    Laya.Laya.addBeforeInitCallback(() => {
        if (!Laya.LayaGL.unitRenderModuleDataFactory)
            Laya.LayaGL.unitRenderModuleDataFactory = new NoRenderUnitModuleDataFactory();
    });

    exports.NoInternalRT = NoInternalRT;
    exports.NoInternalTexture = NoInternalTexture;
    exports.NoRender2DPass = NoRender2DPass;
    exports.NoRender2DPassManager = NoRender2DPassManager;
    exports.NoRender2DProcess = NoRender2DProcess;
    exports.NoRender3DModuleFactory = NoRender3DModuleFactory;
    exports.NoRender3DRenderPassFactory = NoRender3DRenderPassFactory;
    exports.NoRenderBaseDataHandle = NoRenderBaseDataHandle;
    exports.NoRenderBlit2DquadCMD = NoRenderBlit2DquadCMD;
    exports.NoRenderBlitQuadCMDData = NoRenderBlitQuadCMDData;
    exports.NoRenderBufferState = NoRenderBufferState;
    exports.NoRenderCommandUnifojrmMap = NoRenderCommandUnifojrmMap;
    exports.NoRenderContext2D = NoRenderContext2D;
    exports.NoRenderDefineDatas = NoRenderDefineDatas;
    exports.NoRenderDeviceFactory = NoRenderDeviceFactory;
    exports.NoRenderDraw2DElementCMD = NoRenderDraw2DElementCMD;
    exports.NoRenderDrawElementCMDData = NoRenderDrawElementCMDData;
    exports.NoRenderDrawNodeCMDData = NoRenderDrawNodeCMDData;
    exports.NoRenderElement2D = NoRenderElement2D;
    exports.NoRenderEmptyDataHandle = NoRenderEmptyDataHandle;
    exports.NoRenderEngine = NoRenderEngine;
    exports.NoRenderGeometryElement = NoRenderGeometryElement;
    exports.NoRenderGlobalRenderData = NoRenderGlobalRenderData;
    exports.NoRenderGraphicsCommandStreamDataHandle = NoRenderGraphicsCommandStreamDataHandle;
    exports.NoRenderGraphicsOp2DFactory = NoRenderGraphicsOp2DFactory;
    exports.NoRenderGraphicsSingleQuadDataHandle = NoRenderGraphicsSingleQuadDataHandle;
    exports.NoRenderIndexBuffer = NoRenderIndexBuffer;
    exports.NoRenderMeshDataHandle = NoRenderMeshDataHandle;
    exports.NoRenderPrimitiveRenderElement2D = NoRenderPrimitiveRenderElement2D;
    exports.NoRenderRender3DProcess = NoRenderRender3DProcess;
    exports.NoRenderRenderContext3D = NoRenderRenderContext3D;
    exports.NoRenderRenderElement3D = NoRenderRenderElement3D;
    exports.NoRenderSceneRenderManager = NoRenderSceneRenderManager;
    exports.NoRenderSetRenderData = NoRenderSetRenderData;
    exports.NoRenderSetRenderTargetCMD = NoRenderSetRenderTargetCMD;
    exports.NoRenderSetRendertarget2DCMD = NoRenderSetRendertarget2DCMD;
    exports.NoRenderSetShaderDefine = NoRenderSetShaderDefine;
    exports.NoRenderSetViewportCMD = NoRenderSetViewportCMD;
    exports.NoRenderShaderData = NoRenderShaderData;
    exports.NoRenderShaderInstance = NoRenderShaderInstance;
    exports.NoRenderSkinRenderElement3D = NoRenderSkinRenderElement3D;
    exports.NoRenderStruct2D = NoRenderStruct2D;
    exports.NoRenderSubStructDataHandle = NoRenderSubStructDataHandle;
    exports.NoRenderTransform2DMemoryFactory = NoRenderTransform2DMemoryFactory;
    exports.NoRenderUnitModuleDataFactory = NoRenderUnitModuleDataFactory;
    exports.NoRenderVertexBuffer = NoRenderVertexBuffer;
    exports.NoTextureContext = NoTextureContext;

})(window.Laya = window.Laya || {}, Laya);
//# sourceMappingURL=laya.no-render.js.map
