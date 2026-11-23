(function (exports, Laya) {
    'use strict';

    class GLESSetRendertarget2DCMD extends Laya.SetRendertarget2DCMD {
        constructor() {
            super();
            this._nativeObj = new window.conchGLESSetRendertarget2DCMD();
            this.type = Laya.RenderCMDType.ChangeRenderTarget;
            this._clearColorValue = new Laya.Color();
        }
        get invertY() {
            return this._invertY;
        }
        set invertY(value) {
            this._invertY = value;
            this._nativeObj.setinvertY(value);
        }
        get clearColorValue() {
            return this._clearColorValue;
        }
        set clearColorValue(value) {
            value.cloneTo(this._clearColorValue);
            this._nativeObj.clearColorValue(value);
        }
        get rt() {
            return this._rt;
        }
        set rt(value) {
            this._rt = value;
            if (value) {
                this._nativeObj.setRT(value._nativeObj, this.size.x, this.size.y);
            }
            else {
                this._nativeObj.setRT(null, this.size.x, this.size.y);
            }
        }
        get clearColor() {
            return this._clearColor;
        }
        set clearColor(value) {
            this._clearColor = value;
            this._nativeObj.setClearColor(value);
        }
        get viewportX() {
            return this._viewportX;
        }
        set viewportX(value) {
            this._viewportX = value;
            this._nativeObj.setViewportX(value);
        }
        get viewportY() {
            return this._viewportY;
        }
        set viewportY(value) {
            this._viewportY = value;
            this._nativeObj.setViewportY(value);
        }
    }
    class GLESDraw2DElementCMD extends Laya.Draw2DElementCMD {
        constructor() {
            super();
            this.type = Laya.RenderCMDType.DrawElement;
            this._nativeObj = new window.conchGLESDraw2DElementCMD();
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
    class GLESBlit2DQuadCMD extends Laya.Blit2DQuadCMD {
        constructor() {
            super();
            this._nativeObj = new window.conchGLESBlit2DQuadCMD();
            this.type = Laya.RenderCMDType.Blit;
            this._offsetScale = new Laya.Vector4();
        }
        set source(value) {
            this._source = value;
            this._nativeObj.setSource(value._nativeObj);
        }
        get source() {
            return this._source;
        }
        get element() {
            return this._element;
        }
        set element(value) {
            this._element = value;
            this._nativeObj.setRenderElement(value._nativeObj);
        }
        get dest() {
            return this._dest;
        }
        set dest(value) {
            this._dest = value;
            this._nativeObj.setDest(value ? value._nativeObj : null);
        }
        get offsetScale() {
            return this._offsetScale;
        }
        set offsetScale(value) {
            value.cloneTo(this._offsetScale);
            this._nativeObj.setOffsetScale(this._offsetScale);
        }
    }

    const GraphicsQuadPayloadWordCount = 32;
    const GraphicsMeshPayloadWordCount = 26;
    const GraphicsMSDFMeshPayloadWordCount = 32;
    function unpackMSDFParameter(value, out = [0, 0, 0, 0]) {
        value = value >>> 0;
        out[0] = value & 0xff;
        out[1] = (value >>> 8) & 0xff;
        out[2] = (value >>> 16) & 0xff;
        out[3] = (value >>> 24) & 0xff;
        return out;
    }
    function assertMSDFPackedParamsB(value, index) {
        if ((value >>> 24) !== 0)
            throw new Error(`MSDF packedParamsB[${index}] high 8 bits must be zero`);
    }
    function writeQuadPayloadValues(float32, int32, wordOffset, x, y, width, height, u0, v0, u1, v1, packedColor, alpha, blendMode, textureLayer, matrix, uvClip) {
        float32[wordOffset + 0] = x;
        float32[wordOffset + 1] = y;
        float32[wordOffset + 2] = width;
        float32[wordOffset + 3] = height;
        float32[wordOffset + 4] = u0;
        float32[wordOffset + 5] = v0;
        float32[wordOffset + 6] = u1;
        float32[wordOffset + 7] = v1;
        int32[wordOffset + 8] = packedColor;
        float32[wordOffset + 9] = alpha;
        int32[wordOffset + 10] = blendMode;
        int32[wordOffset + 11] = textureLayer || 0;
        if (matrix) {
            float32[wordOffset + 12] = matrix.a;
            float32[wordOffset + 13] = matrix.b;
            float32[wordOffset + 14] = matrix.c;
            float32[wordOffset + 15] = matrix.d;
            float32[wordOffset + 16] = matrix.tx;
            float32[wordOffset + 17] = matrix.ty;
            int32[wordOffset + 18] = 1;
        }
        else {
            float32[wordOffset + 12] = 1;
            float32[wordOffset + 13] = 0;
            float32[wordOffset + 14] = 0;
            float32[wordOffset + 15] = 1;
            float32[wordOffset + 16] = 0;
            float32[wordOffset + 17] = 0;
            int32[wordOffset + 18] = 0;
        }
        writeUVClipPayloadValues(float32, int32, wordOffset, 27, 28, 29, 30, 31, uvClip);
    }
    function writeUVClipPayloadValues(float32, int32, wordOffset, enabledOffset, xOffset, yOffset, widthOffset, heightOffset, uvClip) {
        if (uvClip) {
            int32[wordOffset + enabledOffset] = 1;
            float32[wordOffset + xOffset] = uvClip[0];
            float32[wordOffset + yOffset] = uvClip[1];
            float32[wordOffset + widthOffset] = uvClip[2];
            float32[wordOffset + heightOffset] = uvClip[3];
        }
        else {
            int32[wordOffset + enabledOffset] = 0;
            float32[wordOffset + xOffset] = 0;
            float32[wordOffset + yOffset] = 0;
            float32[wordOffset + widthOffset] = 1;
            float32[wordOffset + heightOffset] = 1;
        }
    }
    function writeFillTexturePayloadValues(float32, int32, wordOffset, x, y, width, height, u0, v0, u1, v1, packedColor, alpha, blendMode, textureLayer, matrix, repeatX, repeatY, offsetX, offsetY, texRangeX, texRangeY, texRangeWidth, texRangeHeight, uvClip) {
        writeQuadPayloadValues(float32, int32, wordOffset, x, y, width, height, u0, v0, u1, v1, packedColor, alpha, blendMode, textureLayer, matrix, uvClip);
        float32[wordOffset + 19] = repeatX;
        float32[wordOffset + 20] = repeatY;
        float32[wordOffset + 21] = offsetX;
        float32[wordOffset + 22] = offsetY;
        float32[wordOffset + 23] = texRangeX;
        float32[wordOffset + 24] = texRangeY;
        float32[wordOffset + 25] = texRangeWidth;
        float32[wordOffset + 26] = texRangeHeight;
    }
    function writeOpInfoBuffer(owner, profile, changeMask, version, vertexCount, indexCount, stateKey, typeKey, textureKey, packedColor, localAlpha, bodyWordCount, recordCount) {
        let int32 = owner.int32;
        let float32 = owner.float32;
        int32[0] = profile;
        int32[1] = changeMask;
        int32[2] = version;
        int32[3] = vertexCount;
        int32[4] = indexCount;
        int32[5] = stateKey;
        int32[6] = typeKey;
        int32[7] = textureKey;
        int32[8] = packedColor;
        float32[9] = localAlpha;
        int32[10] = 16;
        int32[11] = bodyWordCount;
        int32[12] = recordCount;
    }
    function writeMeshPayloadValues(float32, int32, wordOffset, x, y, packedColor, alpha, blendMode, textureLayer, matrix, vertexCount, indexCount, hasUV, hasColors, vertexDataOffset, uvDataOffset, indexDataOffset, colorDataOffset, uvClip) {
        float32[wordOffset + 0] = x;
        float32[wordOffset + 1] = y;
        int32[wordOffset + 2] = packedColor;
        float32[wordOffset + 3] = alpha;
        int32[wordOffset + 4] = blendMode;
        int32[wordOffset + 5] = textureLayer || 0;
        if (matrix) {
            float32[wordOffset + 6] = matrix.a;
            float32[wordOffset + 7] = matrix.b;
            float32[wordOffset + 8] = matrix.c;
            float32[wordOffset + 9] = matrix.d;
            float32[wordOffset + 10] = matrix.tx;
            float32[wordOffset + 11] = matrix.ty;
            int32[wordOffset + 12] = 1;
        }
        else {
            float32[wordOffset + 6] = 1;
            float32[wordOffset + 7] = 0;
            float32[wordOffset + 8] = 0;
            float32[wordOffset + 9] = 1;
            float32[wordOffset + 10] = 0;
            float32[wordOffset + 11] = 0;
            int32[wordOffset + 12] = 0;
        }
        int32[wordOffset + 13] = vertexCount;
        int32[wordOffset + 14] = indexCount;
        int32[wordOffset + 15] = hasUV ? 1 : 0;
        int32[wordOffset + 16] = hasColors ? 1 : 0;
        int32[wordOffset + 17] = vertexDataOffset;
        int32[wordOffset + 18] = uvDataOffset;
        int32[wordOffset + 19] = indexDataOffset;
        int32[wordOffset + 20] = colorDataOffset;
        writeUVClipPayloadValues(float32, int32, wordOffset, 21, 22, 23, 24, 25, uvClip);
    }

    function getNativeTexture(value) {
        if (!value)
            return null;
        let texture = value._texture;
        return texture ? texture._nativeObj || null : null;
    }
    function getTextureId(value) {
        return value ? value.id : 0;
    }
    function getNativeWindow() {
        return window;
    }
    class RTGraphicsOp2D {
        constructor(kind, opType, opProfile, commandIndex, commandId, initialBodyWordCount) {
            this.kind = kind;
            this.opType = opType;
            this.opProfile = opProfile;
            this.commandIndex = commandIndex;
            this.commandId = commandId;
            this.dirtyFlags = 23;
            this._nativeObj = null;
            this._version = 0;
            this._retainedRecordCount = 0;
            this._texture = null;
            this._textureInternal = null;
            this._renderStateScratch = { stateKey: 0, typeKey: 0, textureKey: 0, texture: null };
            this._nativeTextureArray = [];
            this._nativeTextureIdArray = [];
            this._nativePayloadBuffer = null;
            this._nativeTexture = null;
            this._nativeTextureId = 0;
            this._buffer = new ArrayBuffer((16 + initialBodyWordCount) * 4);
            this._float32 = new Float32Array(this._buffer);
            this._int32 = new Int32Array(this._buffer);
            this._int32[0] = opProfile;
            this._int32[10] = 16;
            this._nativeObj = this._createNativeObject();
            if (this._nativeObj) {
                this._nativePayloadBuffer = this._buffer;
            }
        }
        get buffer() {
            return this._buffer;
        }
        get float32() {
            return this._float32;
        }
        get int32() {
            return this._int32;
        }
        get recordCount() {
            return this._int32[12] || 0;
        }
        setCommandIndex(value) {
            this.commandIndex = value;
        }
        set recordCount(value) {
            this._int32[12] = value | 0;
        }
        get texture() {
            return this._texture;
        }
        set texture(value) {
            this._setTexture(value, true);
        }
        _setTexture(value, syncNative) {
            value = value || null;
            let internalTexture = value ? value._texture : null;
            let wrapperChanged = this._texture !== value || this._textureInternal !== internalTexture;
            this._texture = value;
            this._textureInternal = internalTexture;
            if (wrapperChanged)
                this.markDirty(4);
            if (syncNative && this._syncNativeTextureIfChanged())
                this.markDirty(4);
        }
        canUpdate(commandId) {
            return this.commandId === commandId;
        }
        resetRecords() {
            this._retainedRecordCount = this.recordCount;
            this.recordCount = 0;
        }
        writeStructureSignature(out, offset) {
            out[offset] = this._int32[3];
            out[offset + 1] = this._int32[4];
            out[offset + 2] = this._int32[11];
            out[offset + 3] = 0;
        }
        matchesStructureSignature(source, offset) {
            return this.int32[3] === source[offset]
                && this.int32[4] === source[offset + 1]
                && this.int32[11] === source[offset + 2]
                && source[offset + 3] === 0;
        }
        clearStructureDirty() {
            this.dirtyFlags &= ~1;
            this._int32[1] &= ~1;
        }
        markDirty(flags) {
            this.dirtyFlags |= flags;
            if (this._int32)
                this._int32[1] |= flags;
        }
        clearDirty() {
            this.dirtyFlags = 0;
            if (this._int32)
                this._int32[1] = 0;
        }
        destroy() {
            if (this._nativeObj)
                this._nativeObj.destroy();
            this._nativeObj = null;
            this._texture = null;
            this._textureInternal = null;
            this._nativeTextureArray.length = 0;
            this._nativeTextureIdArray.length = 0;
            this._nativePayloadBuffer = null;
            this._nativeTexture = null;
            this._nativeTextureId = 0;
        }
        _reserveBufferWords(bodyWordCount) {
            let requiredWordCount = 16 + bodyWordCount;
            if (this._int32.length >= requiredWordCount)
                return;
            let nextWordCount = Math.max(requiredWordCount, this._int32.length * 2, 16 + 1);
            let nextBuffer = new ArrayBuffer(nextWordCount * 4);
            new Uint8Array(nextBuffer).set(new Uint8Array(this._buffer));
            this._buffer = nextBuffer;
            this._float32 = new Float32Array(nextBuffer);
            this._int32 = new Int32Array(nextBuffer);
            this._nativePayloadBuffer = null;
        }
        _writeOpInfoBuffer(changeMask, version, vertexCount, indexCount, stateKey, typeKey, textureKey, packedColor, localAlpha, bodyWordCount) {
            this._reserveBufferWords(bodyWordCount);
            writeOpInfoBuffer(this, this.opProfile, changeMask, version, vertexCount, indexCount, stateKey, typeKey, textureKey, packedColor, localAlpha, bodyWordCount, this.recordCount);
        }
        _writeOpRenderStateBuffer(changeMask, version, vertexCount, indexCount, blendMode, texture, fillTexture, packedColor, localAlpha, bodyWordCount, defineBits = 0) {
            changeMask |= this.dirtyFlags | this._int32[1];
            if (this._int32[11] > 0 && (changeMask & 4) === 0) {
                let existingDefineBits = this._int32[6] & ~((1 << Laya.ShaderDefines2D.TYPE_KEY_DEFINE_SHIFT) - 1);
                this._writeOpInfoBuffer(changeMask, version, vertexCount, indexCount, blendMode, existingDefineBits | defineBits | blendMode, this._int32[7], packedColor, localAlpha, bodyWordCount);
                return;
            }
            let renderState = Laya.GraphicsOpRenderStateHelper.getRenderState(texture, blendMode, fillTexture, false, false, this._renderStateScratch);
            this._writeOpInfoBuffer(changeMask, version, vertexCount, indexCount, renderState.stateKey, renderState.typeKey | defineBits, renderState.textureKey, packedColor, localAlpha, bodyWordCount);
        }
        _refreshOpRenderStateBuffer(fillTexture = this.kind === 3) {
            if (!this._int32 || this._int32[11] <= 0)
                return;
            let renderState = Laya.GraphicsOpRenderStateHelper.getRenderState(this._texture, this._int32[5], fillTexture, false, false, this._renderStateScratch);
            this._int32[5] = renderState.stateKey;
            this._int32[6] = renderState.typeKey;
            this._int32[7] = renderState.textureKey;
        }
        _syncNativePayloadIfNeeded() {
            let nativeObj = this._nativeObj;
            if (!nativeObj || this._nativePayloadBuffer === this.buffer)
                return;
            nativeObj.setPayload(this.buffer);
            this._nativePayloadBuffer = this.buffer;
        }
        _syncNativeTextureIfChanged() {
            let nativeObj = this._nativeObj;
            if (!nativeObj)
                return false;
            let texture = getNativeTexture(this._texture);
            let textureId = getTextureId(this._texture);
            if (this._nativeTexture === texture && this._nativeTextureId === textureId)
                return false;
            this._nativeTexture = texture;
            this._nativeTextureId = textureId;
            nativeObj.setTexture(texture, textureId);
            return true;
        }
        get _bodyWordOffset() {
            return 16;
        }
        _getQuadPayloadChangeMask(recordIndex, wordOffset, x, y, width, height, u0, v0, u1, v1, packedColor, alpha, blendMode, textureLayer, matrix, uvClip, repeatX, repeatY, offsetX, offsetY, texRangeX, texRangeY, texRangeWidth, texRangeHeight) {
            let hadRecord = recordIndex < this._retainedRecordCount || recordIndex < this.recordCount;
            if (!hadRecord)
                return 23;
            let f32 = this._float32;
            let i32 = this._int32;
            let fround = Math.fround;
            let changeMask = this.dirtyFlags & 4;
            let nextHasMatrix = matrix ? 1 : 0;
            let nextUVClipEnabled = uvClip ? 1 : 0;
            if (f32[wordOffset + 0] !== fround(x)
                || f32[wordOffset + 1] !== fround(y)
                || f32[wordOffset + 2] !== fround(width)
                || f32[wordOffset + 3] !== fround(height)
                || f32[wordOffset + 4] !== fround(u0)
                || f32[wordOffset + 5] !== fround(v0)
                || f32[wordOffset + 6] !== fround(u1)
                || f32[wordOffset + 7] !== fround(v1)
                || i32[wordOffset + 11] !== (textureLayer || 0)
                || i32[wordOffset + 18] !== nextHasMatrix
                || f32[wordOffset + 12] !== fround(matrix ? matrix.a : 1)
                || f32[wordOffset + 13] !== fround(matrix ? matrix.b : 0)
                || f32[wordOffset + 14] !== fround(matrix ? matrix.c : 0)
                || f32[wordOffset + 15] !== fround(matrix ? matrix.d : 1)
                || f32[wordOffset + 16] !== fround(matrix ? matrix.tx : 0)
                || f32[wordOffset + 17] !== fround(matrix ? matrix.ty : 0)
                || i32[wordOffset + 27] !== nextUVClipEnabled
                || f32[wordOffset + 28] !== fround(uvClip ? uvClip[0] : 0)
                || f32[wordOffset + 29] !== fround(uvClip ? uvClip[1] : 0)
                || f32[wordOffset + 30] !== fround(uvClip ? uvClip[2] : 1)
                || f32[wordOffset + 31] !== fround(uvClip ? uvClip[3] : 1))
                changeMask |= 2;
            if (repeatX != null && (f32[wordOffset + 19] !== fround(repeatX)
                || f32[wordOffset + 20] !== fround(repeatY)
                || f32[wordOffset + 21] !== fround(offsetX)
                || f32[wordOffset + 22] !== fround(offsetY)
                || f32[wordOffset + 23] !== fround(texRangeX)
                || f32[wordOffset + 24] !== fround(texRangeY)
                || f32[wordOffset + 25] !== fround(texRangeWidth)
                || f32[wordOffset + 26] !== fround(texRangeHeight)))
                changeMask |= 2;
            if (i32[wordOffset + 10] !== blendMode)
                changeMask |= 16;
            if (i32[wordOffset + 8] !== packedColor
                || f32[wordOffset + 9] !== fround(alpha))
                changeMask |= 16 | 2;
            return changeMask;
        }
        _createNativeObject() {
            let ctor = this._getNativeConstructor();
            return ctor ? new ctor(null, this.commandIndex, this._buffer) : null;
        }
        _getNativeConstructor() {
            let nativeWindow = getNativeWindow();
            switch (this.kind) {
                case 1:
                    return nativeWindow.conchRTTextureQuadGraphicsOp || null;
                case 3:
                    return nativeWindow.conchRTFillTextureGraphicsOp || null;
                case 2:
                    return nativeWindow.conchRTSolidQuadGraphicsOp || null;
                case 4:
                    return nativeWindow.conchRTMeshGraphicsOp || null;
                case 7:
                    return nativeWindow.conchRTMSDFMeshGraphicsOp || null;
                case 5:
                    return nativeWindow.conchRTMultiQuadGraphicsOp || null;
                case 6:
                    return nativeWindow.conchRTTextGraphicsOp || null;
            }
            return null;
        }
    }
    class RTGraphicsTextureQuadOp2D extends RTGraphicsOp2D {
        constructor(kind, commandIndex, commandId) {
            super(kind, "textureQuad", 1, commandIndex, commandId, GraphicsQuadPayloadWordCount);
        }
        writeRecord(x, y, width, height, u0, v0, u1, v1, packedColor, alpha, blendMode, textureLayer, matrix, uvClip) {
            let changeMask = this._getQuadPayloadChangeMask(0, this._bodyWordOffset, x, y, width, height, u0, v0, u1, v1, packedColor, alpha, blendMode, textureLayer, matrix, uvClip);
            this.recordCount = 1;
            if (changeMask !== 0) {
                writeQuadPayloadValues(this.float32, this.int32, this._bodyWordOffset, x, y, width, height, u0, v0, u1, v1, packedColor, alpha, blendMode, textureLayer, matrix, uvClip);
                this.markDirty(changeMask);
                this._writeOpRenderStateBuffer(changeMask, ++this._version, 4, 6, blendMode, this.texture, false, packedColor, alpha, GraphicsQuadPayloadWordCount);
            }
            this._syncNativePayloadIfNeeded();
        }
    }
    class RTGraphicsSolidQuadOp2D extends RTGraphicsOp2D {
        constructor(kind, commandIndex, commandId) {
            super(kind, "solidQuad", 3, commandIndex, commandId, GraphicsQuadPayloadWordCount);
        }
        writeRecord(x, y, width, height, packedColor, alpha, blendMode, matrix) {
            let changeMask = this._getQuadPayloadChangeMask(0, this._bodyWordOffset, x, y, width, height, 0, 0, 0, 0, packedColor, alpha, blendMode, 0, matrix, null);
            this.recordCount = 1;
            if (changeMask !== 0) {
                writeQuadPayloadValues(this.float32, this.int32, this._bodyWordOffset, x, y, width, height, 0, 0, 0, 0, packedColor, alpha, blendMode, 0, matrix, null);
                this.markDirty(changeMask);
                this._writeOpRenderStateBuffer(changeMask, ++this._version, 4, 6, blendMode, null, false, packedColor, alpha, GraphicsQuadPayloadWordCount);
            }
            this._syncNativePayloadIfNeeded();
        }
    }
    class RTGraphicsFillTextureOp2D extends RTGraphicsOp2D {
        constructor(kind, commandIndex, commandId) {
            super(kind, "fillTexture", 5, commandIndex, commandId, GraphicsQuadPayloadWordCount);
        }
        writeRecord(x, y, width, height, u0, v0, u1, v1, repeatX, repeatY, offsetX, offsetY, texRangeX, texRangeY, texRangeWidth, texRangeHeight, packedColor, alpha, blendMode, textureLayer, matrix, uvClip) {
            let changeMask = this._getQuadPayloadChangeMask(0, this._bodyWordOffset, x, y, width, height, u0, v0, u1, v1, packedColor, alpha, blendMode, textureLayer, matrix, uvClip, repeatX, repeatY, offsetX, offsetY, texRangeX, texRangeY, texRangeWidth, texRangeHeight);
            this.recordCount = 1;
            if (changeMask !== 0) {
                writeFillTexturePayloadValues(this.float32, this.int32, this._bodyWordOffset, x, y, width, height, u0, v0, u1, v1, packedColor, alpha, blendMode, textureLayer, matrix, repeatX, repeatY, offsetX, offsetY, texRangeX, texRangeY, texRangeWidth, texRangeHeight, uvClip);
                this.markDirty(changeMask);
                this._writeOpRenderStateBuffer(changeMask, ++this._version, 4, 6, blendMode, this.texture, true, packedColor, alpha, GraphicsQuadPayloadWordCount);
            }
            this._syncNativePayloadIfNeeded();
        }
    }
    class RTGraphicsMeshOp2D extends RTGraphicsOp2D {
        constructor(kind, commandIndex, commandId, opProfile = 8, bodyWordCount = GraphicsMeshPayloadWordCount, opType = "mesh") {
            super(kind, opType, opProfile, commandIndex, commandId, bodyWordCount);
        }
        writeMesh(x, y, vertices, vertexOffset, vertexCount, uvs, uvOffset, indices, indexOffset, indexCount, colors, colorOffset, packedColor, alpha, blendMode, textureLayer, matrix, uvClip) {
            let vertexWordCount = vertexCount * 2;
            let uvWordCount = uvs ? vertexCount * 2 : 0;
            let indexWordCount = indexCount;
            let colorWordCount = colors ? vertexCount * 4 : 0;
            let vertexDataOffset = GraphicsMeshPayloadWordCount;
            let uvDataOffset = vertexDataOffset + vertexWordCount;
            let indexDataOffset = uvDataOffset + uvWordCount;
            let colorDataOffset = indexDataOffset + indexWordCount;
            let bodyWordCount = colorDataOffset + colorWordCount;
            let bodyOffset = this._bodyWordOffset;
            this._reserveBufferWords(bodyWordCount);
            if (this._meshPayloadMatches(bodyOffset, bodyWordCount, x, y, vertices, vertexOffset, vertexCount, uvs, uvOffset, indices, indexOffset, indexCount, colors, colorOffset, packedColor, alpha, blendMode, textureLayer, matrix, uvClip)) {
                this.recordCount = 1;
                return;
            }
            writeMeshPayloadValues(this.float32, this.int32, bodyOffset, x, y, packedColor, alpha, blendMode, textureLayer, matrix, vertexCount, indexCount, !!uvs, !!colors, vertexDataOffset, uvs ? uvDataOffset : 0, indexDataOffset, colors ? colorDataOffset : 0, uvClip);
            this._copyNumberValues(vertices, vertexOffset, this.float32, bodyOffset + vertexDataOffset, vertexWordCount);
            if (uvs)
                this._copyNumberValues(uvs, uvOffset, this.float32, bodyOffset + uvDataOffset, uvWordCount);
            this._copyNumberValues(indices, indexOffset, this.int32, bodyOffset + indexDataOffset, indexWordCount);
            if (colors)
                this._copyNumberValues(colors, colorOffset, this.float32, bodyOffset + colorDataOffset, colorWordCount);
            this.recordCount = 1;
            let changeMask = 2 | 4 | 16;
            this.markDirty(changeMask);
            this._writeOpRenderStateBuffer(changeMask, ++this._version, vertexCount, indexCount, blendMode, this.texture, false, packedColor, alpha, bodyWordCount);
            this._syncNativePayloadIfNeeded();
        }
        _meshPayloadMatches(bodyOffset, bodyWordCount, x, y, vertices, vertexOffset, vertexCount, uvs, uvOffset, indices, indexOffset, indexCount, colors, colorOffset, packedColor, alpha, blendMode, textureLayer, matrix, uvClip) {
            if (this._retainedRecordCount <= 0 && this.recordCount <= 0
                || this.dirtyFlags !== 0
                || this.int32[11] !== bodyWordCount)
                return false;
            let f32 = this.float32;
            let i32 = this.int32;
            let fround = Math.fround;
            let vertexDataOffset = GraphicsMeshPayloadWordCount;
            let uvDataOffset = vertexDataOffset + vertexCount * 2;
            let indexDataOffset = uvDataOffset + (uvs ? vertexCount * 2 : 0);
            let colorDataOffset = indexDataOffset + indexCount;
            if (f32[bodyOffset + 0] !== fround(x)
                || f32[bodyOffset + 1] !== fround(y)
                || i32[bodyOffset + 2] !== packedColor
                || f32[bodyOffset + 3] !== fround(alpha)
                || i32[bodyOffset + 4] !== blendMode
                || i32[bodyOffset + 5] !== (textureLayer || 0)
                || i32[bodyOffset + 12] !== (matrix ? 1 : 0)
                || f32[bodyOffset + 6] !== fround(matrix ? matrix.a : 1)
                || f32[bodyOffset + 7] !== fround(matrix ? matrix.b : 0)
                || f32[bodyOffset + 8] !== fround(matrix ? matrix.c : 0)
                || f32[bodyOffset + 9] !== fround(matrix ? matrix.d : 1)
                || f32[bodyOffset + 10] !== fround(matrix ? matrix.tx : 0)
                || f32[bodyOffset + 11] !== fround(matrix ? matrix.ty : 0)
                || i32[bodyOffset + 13] !== vertexCount
                || i32[bodyOffset + 14] !== indexCount
                || i32[bodyOffset + 15] !== (uvs ? 1 : 0)
                || i32[bodyOffset + 16] !== (colors ? 1 : 0)
                || i32[bodyOffset + 17] !== vertexDataOffset
                || i32[bodyOffset + 18] !== (uvs ? uvDataOffset : 0)
                || i32[bodyOffset + 19] !== indexDataOffset
                || i32[bodyOffset + 20] !== (colors ? colorDataOffset : 0)
                || i32[bodyOffset + 21] !== (uvClip ? 1 : 0)
                || f32[bodyOffset + 22] !== fround(uvClip ? uvClip[0] : 0)
                || f32[bodyOffset + 23] !== fround(uvClip ? uvClip[1] : 0)
                || f32[bodyOffset + 24] !== fround(uvClip ? uvClip[2] : 1)
                || f32[bodyOffset + 25] !== fround(uvClip ? uvClip[3] : 1))
                return false;
            for (let i = 0, count = vertexCount * 2; i < count; i++) {
                if (f32[bodyOffset + vertexDataOffset + i] !== fround(vertices[vertexOffset + i]))
                    return false;
                if (uvs && f32[bodyOffset + uvDataOffset + i] !== fround(uvs[uvOffset + i]))
                    return false;
            }
            for (let i = 0; i < indexCount; i++) {
                if (i32[bodyOffset + indexDataOffset + i] !== (indices[indexOffset + i] | 0))
                    return false;
            }
            if (colors) {
                for (let i = 0, count = vertexCount * 4; i < count; i++) {
                    if (f32[bodyOffset + colorDataOffset + i] !== fround(colors[colorOffset + i]))
                        return false;
                }
            }
            return true;
        }
        _copyNumberValues(source, sourceOffset, target, targetOffset, count) {
            for (let i = 0; i < count; i++)
                target[targetOffset + i] = source[sourceOffset + i];
        }
    }
    class RTGraphicsMSDFMeshOp2D extends RTGraphicsMeshOp2D {
        constructor(kind, commandIndex, commandId) {
            super(kind, commandIndex, commandId, 9, GraphicsMSDFMeshPayloadWordCount, "msdfMesh");
            if (!this._nativeObj)
                throw new Error("MSDF 2D rendering is unavailable: native backend did not provide conchRTMSDFMeshGraphicsOp");
        }
        writeMSDFMesh(x, y, vertices, vertexOffset, vertexCount, uvs, uvOffset, indices, indexOffset, indexCount, fillColors, outlineColors, glowColors, shadowColors, packedParamsA, packedParamsB, packedColor, alpha, blendMode, matrix, uvClip) {
            if (!uvs || vertexCount <= 0 || indexCount <= 0)
                throw new RangeError("MSDF mesh requires non-empty vertices, UVs and indices");
            if (vertexOffset < 0 || vertexOffset + vertexCount * 2 > vertices.length || uvOffset < 0 || uvOffset + vertexCount * 2 > uvs.length
                || indexOffset < 0 || indexOffset + indexCount > indices.length)
                throw new RangeError("MSDF mesh input range is outside the supplied arrays");
            for (let i = 0; i < vertexCount; i++) {
                if (fillColors.length <= i || outlineColors.length <= i || glowColors.length <= i || shadowColors.length <= i
                    || packedParamsA.length <= i || packedParamsB.length <= i)
                    throw new RangeError("MSDF per-vertex arrays must contain vertexCount entries");
                assertMSDFPackedParamsB(packedParamsB[i], i);
            }
            for (let i = 0; i < indexCount; i++) {
                let index = indices[indexOffset + i];
                if (!Number.isInteger(index) || index < 0 || index >= vertexCount)
                    throw new RangeError(`MSDF index ${index} at ${i} is outside vertexCount`);
            }
            let vertexWordCount = vertexCount * 2;
            let indexDataOffset = GraphicsMSDFMeshPayloadWordCount + vertexWordCount * 2;
            let fillColorDataOffset = indexDataOffset + indexCount;
            let outlineColorDataOffset = fillColorDataOffset + vertexCount;
            let glowColorDataOffset = outlineColorDataOffset + vertexCount;
            let shadowColorDataOffset = glowColorDataOffset + vertexCount;
            let paramsADataOffset = shadowColorDataOffset + vertexCount;
            let paramsBDataOffset = paramsADataOffset + vertexCount;
            let bodyWordCount = paramsBDataOffset + vertexCount;
            let bodyOffset = this._bodyWordOffset;
            this._reserveBufferWords(bodyWordCount);
            writeMeshPayloadValues(this.float32, this.int32, bodyOffset, x, y, packedColor, alpha, blendMode, 0, matrix, vertexCount, indexCount, true, false, GraphicsMSDFMeshPayloadWordCount, GraphicsMSDFMeshPayloadWordCount + vertexWordCount, indexDataOffset, 0, uvClip);
            this.int32[bodyOffset + 26] = fillColorDataOffset;
            this.int32[bodyOffset + 27] = outlineColorDataOffset;
            this.int32[bodyOffset + 28] = glowColorDataOffset;
            this.int32[bodyOffset + 29] = shadowColorDataOffset;
            this.int32[bodyOffset + 30] = paramsADataOffset;
            this.int32[bodyOffset + 31] = paramsBDataOffset;
            this._copyNumberValues(vertices, vertexOffset, this.float32, bodyOffset + GraphicsMSDFMeshPayloadWordCount, vertexWordCount);
            this._copyNumberValues(uvs, uvOffset, this.float32, bodyOffset + GraphicsMSDFMeshPayloadWordCount + vertexWordCount, vertexWordCount);
            this._copyNumberValues(indices, indexOffset, this.int32, bodyOffset + indexDataOffset, indexCount);
            this._copyNumberValues(fillColors, 0, this.int32, bodyOffset + fillColorDataOffset, vertexCount);
            this._copyNumberValues(outlineColors, 0, this.int32, bodyOffset + outlineColorDataOffset, vertexCount);
            this._copyNumberValues(glowColors, 0, this.int32, bodyOffset + glowColorDataOffset, vertexCount);
            this._copyNumberValues(shadowColors, 0, this.int32, bodyOffset + shadowColorDataOffset, vertexCount);
            this._copyNumberValues(packedParamsA, 0, this.int32, bodyOffset + paramsADataOffset, vertexCount);
            this._copyNumberValues(packedParamsB, 0, this.int32, bodyOffset + paramsBDataOffset, vertexCount);
            this.recordCount = 1;
            let changeMask = 2 | 4 | 16;
            this.markDirty(changeMask);
            this._writeOpRenderStateBuffer(changeMask, ++this._version, vertexCount, indexCount, blendMode, this.texture, false, packedColor, alpha, bodyWordCount, Laya.ShaderDefines2D.DEFINE_BIT_MSDF);
            this._syncNativePayloadIfNeeded();
        }
    }
    class RTGraphicsMultiQuadOp2D extends RTGraphicsOp2D {
        constructor(kind, commandIndex, commandId, opType = "multiQuad", opProfile = 6) {
            super(kind, opType, opProfile, commandIndex, commandId, GraphicsQuadPayloadWordCount);
            this.textures = [];
            this._textureGroupLayoutVersion = 0;
            this._nativeTextures = [];
            this._nativeTextureIds = [];
        }
        writeStructureSignature(out, offset) {
            super.writeStructureSignature(out, offset);
            out[offset + 3] = this._textureGroupLayoutVersion;
        }
        matchesStructureSignature(source, offset) {
            return this.int32[3] === source[offset]
                && this.int32[4] === source[offset + 1]
                && this.int32[11] === source[offset + 2]
                && this._textureGroupLayoutVersion === source[offset + 3];
        }
        setTextures(textures, count = textures ? textures.length : 0) {
            let previousCount = this.textures.length;
            let changed = previousCount !== count;
            let groupChanged = previousCount !== count;
            let nativeArrayChanged = this._nativeTextureArray.length !== count || this._nativeTextureIdArray.length !== count;
            let previousOldTexture = null;
            let previousNewTexture = null;
            this._nativeTextures.length = count;
            this._nativeTextureIds.length = count;
            for (let i = 0; i < count; i++) {
                let oldTexture = this.textures[i] || null;
                let texture = textures[i] || null;
                if (oldTexture !== texture)
                    changed = true;
                if (i > 0 && (oldTexture !== previousOldTexture) !== (texture !== previousNewTexture))
                    groupChanged = true;
                this.textures[i] = texture;
                previousOldTexture = oldTexture;
                previousNewTexture = texture;
                let nativeTexture = getNativeTexture(texture);
                let textureId = getTextureId(texture);
                this._nativeTextures[i] = nativeTexture;
                this._nativeTextureIds[i] = textureId;
                if (this._nativeTextureArray[i] !== nativeTexture || this._nativeTextureIdArray[i] !== textureId)
                    nativeArrayChanged = true;
            }
            this.textures.length = count;
            let firstTexture = count > 0 ? this.textures[0] : null;
            let firstTextureChanged = this.texture !== firstTexture || this._textureInternal !== (firstTexture ? firstTexture._texture : null);
            if (firstTextureChanged)
                changed = true;
            this._setTexture(firstTexture, false);
            if (firstTextureChanged)
                this._refreshOpRenderStateBuffer(false);
            let payloadChanged = this._nativePayloadBuffer !== this.buffer;
            if (nativeArrayChanged) {
                if (this._nativeObj) {
                    if (payloadChanged) {
                        this._nativeObj.finalizePayloadAndTextures(this.buffer, this._nativeTextures, this._nativeTextureIds);
                        this._nativePayloadBuffer = this.buffer;
                    }
                    else {
                        this._nativeObj.setTextureArray(this._nativeTextures, this._nativeTextureIds);
                    }
                }
                let previousNativeTextures = this._nativeTextureArray;
                let previousNativeTextureIds = this._nativeTextureIdArray;
                this._nativeTextureArray = this._nativeTextures;
                this._nativeTextureIdArray = this._nativeTextureIds;
                this._nativeTextures = previousNativeTextures;
                this._nativeTextureIds = previousNativeTextureIds;
            }
            if (changed || nativeArrayChanged)
                this.markDirty(4);
            if (groupChanged) {
                this._textureGroupLayoutVersion++;
                this.markDirty(1);
            }
            if (!nativeArrayChanged || !payloadChanged)
                this._syncNativePayloadIfNeeded();
        }
        addRecord(x, y, width, height, u0, v0, u1, v1, packedColor, alpha, blendMode, textureLayer, matrix, uvClip) {
            let recordIndex = this.recordCount;
            let bodyWordCount = (this.recordCount + 1) * GraphicsQuadPayloadWordCount;
            this._reserveBufferWords(bodyWordCount);
            let wordOffset = this._bodyWordOffset + recordIndex * GraphicsQuadPayloadWordCount;
            let changeMask = this._getQuadPayloadChangeMask(recordIndex, wordOffset, x, y, width, height, u0, v0, u1, v1, packedColor, alpha, blendMode, textureLayer, matrix, uvClip);
            if (changeMask !== 0)
                writeQuadPayloadValues(this.float32, this.int32, wordOffset, x, y, width, height, u0, v0, u1, v1, packedColor, alpha, blendMode, textureLayer, matrix, uvClip);
            this.recordCount++;
            if (changeMask !== 0) {
                this.markDirty(changeMask);
                this._version++;
            }
            this._writeOpRenderStateBuffer(this.dirtyFlags, this._version, this.recordCount * 4, this.recordCount * 6, blendMode, this.texture, false, packedColor, alpha, bodyWordCount);
        }
    }
    class RTGraphicsTextOp2D extends RTGraphicsMultiQuadOp2D {
        constructor(kind, commandIndex, commandId) {
            super(kind, commandIndex, commandId, "text", 7);
        }
    }

    class GLESGraphicsOp2DFactory {
        createTextureQuadOp(commandIndex, commandId) {
            return new RTGraphicsTextureQuadOp2D(1, commandIndex, commandId);
        }
        createFillTextureOp(commandIndex, commandId) {
            return new RTGraphicsFillTextureOp2D(3, commandIndex, commandId);
        }
        createSolidQuadOp(commandIndex, commandId) {
            return new RTGraphicsSolidQuadOp2D(2, commandIndex, commandId);
        }
        createMeshOp(commandIndex, commandId) {
            return new RTGraphicsMeshOp2D(4, commandIndex, commandId);
        }
        createMSDFMeshOp(commandIndex, commandId) {
            return new RTGraphicsMSDFMeshOp2D(7, commandIndex, commandId);
        }
        createMultiQuadOp(commandIndex, commandId) {
            return new RTGraphicsMultiQuadOp2D(5, commandIndex, commandId);
        }
        createTextOp(commandIndex, commandId) {
            return new RTGraphicsTextOp2D(6, commandIndex, commandId);
        }
    }

    class RTDefineDatas {
        constructor() {
            this._nativeObj = new window.conchRTDefineDatas();
        }
        get _length() {
            return this._nativeObj._length;
        }
        set _length(value) {
            this._nativeObj._length = value;
        }
        get _mask() {
            return this._nativeObj._mask;
        }
        set _mask(value) {
            this._nativeObj._mask = value;
        }
        _intersectionDefineDatas(define) {
            this._nativeObj._intersectionDefineDatas(define);
        }
        add(define) {
            this._nativeObj.add(define._index, define._value);
        }
        remove(define) {
            this._nativeObj.remove(define._index, define._value);
        }
        addDefineDatas(define) {
            this._nativeObj.addDefineDatas(define._nativeObj);
        }
        removeDefineDatas(define) {
            this._nativeObj.removeDefineDatas(define._nativeObj);
        }
        has(define) {
            return this._nativeObj.has(define._index, define._value);
        }
        clear() {
            this._nativeObj.clear();
        }
        cloneTo(destObject) {
            this._nativeObj.cloneTo(destObject._nativeObj);
        }
        clone() {
            var dest = new RTDefineDatas();
            this.cloneTo(dest);
            return dest;
        }
        destroy() {
            this._nativeObj.destroy();
        }
    }

    class RTRenderState extends Laya.RenderState {
        set cull(value) {
            this._nativeObj.cull = value;
        }
        get cull() {
            return this._nativeObj.cull;
        }
        set blend(value) {
            this._nativeObj.blend = value;
        }
        get blend() {
            return this._nativeObj.blend;
        }
        set srcBlend(value) {
            this._nativeObj.srcBlend = value;
        }
        get srcBlend() {
            return this._nativeObj.srcBlend;
        }
        set dstBlend(value) {
            this._nativeObj.dstBlend = value;
        }
        get dstBlend() {
            return this._nativeObj.dstBlend;
        }
        set srcBlendRGB(value) {
            this._nativeObj.srcBlendRGB = value;
        }
        get srcBlendRGB() {
            return this._nativeObj.srcBlendRGB;
        }
        set dstBlendRGB(value) {
            this._nativeObj.dstBlendRGB = value;
        }
        get dstBlendRGB() {
            return this._nativeObj.dstBlendRGB;
        }
        set srcBlendAlpha(value) {
            this._nativeObj.srcBlendAlpha = value;
        }
        get srcBlendAlpha() {
            return this._nativeObj.srcBlendAlpha;
        }
        set dstBlendAlpha(value) {
            this._nativeObj.dstBlendAlpha = value;
        }
        get dstBlendAlpha() {
            return this._nativeObj.dstBlendAlpha;
        }
        set blendEquation(value) {
            this._nativeObj.blendEquation = value;
        }
        get blendEquation() {
            return this._nativeObj.blendEquation;
        }
        set blendEquationRGB(value) {
            this._nativeObj.blendEquationRGB = value;
        }
        get blendEquationRGB() {
            return this._nativeObj.blendEquationRGB;
        }
        set blendEquationAlpha(value) {
            this._nativeObj.blendEquationAlpha = value;
        }
        get blendEquationAlpha() {
            return this._nativeObj.blendEquationAlpha;
        }
        set depthTest(value) {
            this._nativeObj.depthTest = value;
        }
        get depthTest() {
            return this._nativeObj.depthTest;
        }
        set depthWrite(value) {
            this._nativeObj.depthWrite = value;
        }
        get depthWrite() {
            return this._nativeObj.depthWrite;
        }
        set stencilWrite(value) {
            this._nativeObj.stencilWrite = value;
        }
        get stencilWrite() {
            return this._nativeObj.stencilWrite;
        }
        set stencilTest(value) {
            this._nativeObj.stencilTest = value;
        }
        get stencilTest() {
            return this._nativeObj.stencilTest;
        }
        set stencilRef(value) {
            this._nativeObj.stencilRef = value;
        }
        get stencilRef() {
            return this._nativeObj.stencilRef;
        }
        set stencilOp(value) {
            this._nativeObj.setStencilOp(value);
        }
        get stencilOp() {
            let value = this._nativeObj.getStencilOp();
            let _tempVector3 = new Laya.Vector3();
            _tempVector3.x = value.x;
            _tempVector3.y = value.y;
            _tempVector3.z = value.z;
            return _tempVector3;
        }
        get stencilWriteMask() {
            return this._nativeObj.stencilWriteMask;
        }
        set stencilWriteMask(value) {
            this._nativeObj.stencilWriteMask = value;
        }
        get stencilReadMask() {
            return this._nativeObj.stencilReadMask;
        }
        set stencilReadMask(value) {
            this._nativeObj.stencilReadMask = value;
        }
        get depthBias() {
            return this._nativeObj.depthBias;
        }
        set depthBias(value) {
            this._nativeObj.depthBias = value;
        }
        get depthBiasConstant() {
            return this._nativeObj.depthBiasConstant;
        }
        set depthBiasConstant(value) {
            this._nativeObj.depthBiasConstant = value;
        }
        get depthBiasSlopeScale() {
            return this._nativeObj.depthBiasSlopeScale;
        }
        set depthBiasSlopeScale(value) {
            this._nativeObj.depthBiasSlopeScale = value;
        }
        get depthBiasClamp() {
            return this._nativeObj.depthBiasClamp;
        }
        set depthBiasClamp(value) {
            this._nativeObj.depthBiasClamp = value;
        }
        setNull() {
            this._nativeObj.setNull();
        }
        createObj() {
            this._nativeObj = new window.conchRenderState();
        }
        constructor() {
            super();
        }
        cloneTo(dest) {
            this._nativeObj.cloneTo(dest._nativeObj);
        }
        clone() {
            let state = new RTRenderState();
            this.cloneTo(state);
            return state;
        }
    }

    class RTShaderPass {
        constructor(pass) {
            this._validDefine = new RTDefineDatas();
            this.is2D = false;
            this._nativeObj = new window.conchRTShaderPass();
            this._createShaderInstanceFun = this.nativeCreateShaderInstance.bind(this);
            this._nativeObj.setCreateShaderInstanceFunction(this._createShaderInstanceFun);
            this.renderState = new RTRenderState();
            this.renderState.setNull();
            this._pass = pass;
        }
        get additionShaderData() {
            return this._additionShaderData;
        }
        set additionShaderData(value) {
            this._additionShaderData = value;
            this._nativeObj.setAdditionShaderData(value);
        }
        get nodeCommonMap() {
            return this._nodeCommonMap;
        }
        set nodeCommonMap(value) {
            this._nativeObj.setCommonUniformMap(value);
        }
        static getGlobalCompileDefine() {
            if (!RTShaderPass._globalCompileDefine) {
                RTShaderPass._globalCompileDefine = new RTDefineDatas();
            }
            return RTShaderPass._globalCompileDefine;
        }
        get statefirst() {
            return this._nativeObj._statefirst;
        }
        set statefirst(value) {
            this._nativeObj._statefirst = value;
        }
        get renderState() {
            return this._renderState;
        }
        set renderState(value) {
            this._renderState = value;
            this._nativeObj.setRenderState(value._nativeObj);
        }
        get pipelineMode() {
            return this._nativeObj._pipelineMode;
        }
        set pipelineMode(value) {
            this._nativeObj._pipelineMode = value;
        }
        get validDefine() {
            return this._validDefine;
        }
        set validDefine(value) {
            this._validDefine = value;
            this._nativeObj.setValidDefine(value._nativeObj);
        }
        nativeCreateShaderInstance() {
            var shaderIns = this._pass.withCompile(RTShaderPass.getGlobalCompileDefine(), this._nativeObj.is2D);
            return shaderIns._nativeObj;
        }
        destroy() {
            this._nativeObj.destroy();
        }
        setCacheShader(defines, shaderInstance) {
            this._nativeObj.setCacheShader(defines._nativeObj, shaderInstance._nativeObj, shaderInstance);
        }
        getCacheShader(defines) {
            return this._nativeObj.getCacheShader(defines._nativeObj);
        }
    }
    RTShaderPass._globalCompileDefine = null;

    class GLESRenderElement2D {
        set type(value) {
            this._elem2dI32[0] = value;
        }
        get type() {
            return this._elem2dI32[0];
        }
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
        set value2DShaderData(data) {
            this._value2DShaderData = data;
            this._nativeObj.setValue2DShaderData(data ? data._nativeObj : null);
        }
        get value2DShaderData() {
            return this._value2DShaderData;
        }
        set globalShaderData(data) {
            this._globalShaderData = data;
            this._nativeObj.setGlobalShaderData(data ? data._nativeObj : null);
        }
        get globalShaderData() {
            return this._globalShaderData;
        }
        get subShader() {
            return this._subShader;
        }
        set subShader(value) {
            this._subShader = value;
            if (value) {
                this._nativeObj.setSubShader(value.moduleData._nativeObj);
            }
        }
        init() {
            this._nativeObj = new window.conchGLESRenderElement2D();
            window.conchGLESRenderElement2D.setCompileDefine(RTShaderPass.getGlobalCompileDefine()._nativeObj);
        }
        constructor() {
            this._elem2dBuf = new ArrayBuffer(4 * 4);
            this._elem2dI32 = new Int32Array(this._elem2dBuf);
            this._renderStateIsBySprite = true;
            this.init();
            this._nativeObj.bindElem2DBuffer(this._elem2dBuf);
        }
        get owner() {
            return this._owner;
        }
        set owner(value) {
            this._owner = value;
            this._nativeObj.setOwner(value ? value._nativeObj : null);
        }
        get nodeCommonMap() {
            return this._nodeCommonMap;
        }
        set nodeCommonMap(value) {
            this._nodeCommonMap = value;
            this._nativeObj.setCommonUniformMap(value);
        }
        get renderStateIsBySprite() {
            return this._renderStateIsBySprite;
        }
        set renderStateIsBySprite(value) {
            this._renderStateIsBySprite = value;
            this._nativeObj.renderStateIsBySprite = value;
        }
        get noBatch() {
            return this._elem2dI32[3] !== 0;
        }
        set noBatch(value) {
            this._elem2dI32[3] = value ? 1 : 0;
        }
        destroy() {
            this._nativeObj.destroy();
        }
    }

    class GLESPrimitiveRenderElement2D extends GLESRenderElement2D {
        set typeKey(value) {
            this._elem2dI32[1] = value;
        }
        get typeKey() {
            return this._elem2dI32[1];
        }
        set textureKey(value) {
            this._elem2dI32[2] = value;
        }
        get textureKey() {
            return this._elem2dI32[2];
        }
        init() {
            this._nativeObj = new window.conchGLESPrimitiveRenderElement2D();
            window.conchGLESRenderElement2D.setCompileDefine(RTShaderPass.getGlobalCompileDefine()._nativeObj);
        }
        get primitiveShaderData() {
            return this._primitiveShaderData;
        }
        set primitiveShaderData(data) {
            this._primitiveShaderData = data;
            this._nativeObj.setPrimitiveShaderData(data ? data._nativeObj : null);
        }
    }

    class RTRender2DPass {
        get enable() {
            return this._propsI32[0] !== 0;
        }
        set enable(value) {
            this._propsI32[0] = value ? 1 : 0;
        }
        get enableBatch() {
            return this._enableBatch;
        }
        set enableBatch(value) {
            this._enableBatch = value;
            this._nativeObj.enableBatch = value;
        }
        get isSupport() {
            return this._propsI32[1] !== 0;
        }
        set isSupport(value) {
            this._propsI32[1] = value ? 1 : 0;
        }
        get root() {
            return this._root;
        }
        set root(value) {
            this._root = value;
            this._nativeObj.setRoot(value ? value._nativeObj : null);
        }
        set doClearColor(value) {
            this._propsI32[3] = value ? 1 : 0;
        }
        get doClearColor() {
            return this._propsI32[3] !== 0;
        }
        set mask(value) {
            this._mask = value;
            this._nativeObj.setMask(value ? value._nativeObj : null);
        }
        get mask() {
            return this._mask;
        }
        get repaint() {
            return this._propsI32[2] !== 0;
        }
        set repaint(value) {
            this._propsI32[2] = value ? 1 : 0;
        }
        get renderTexture() {
            return this._renderTexture;
        }
        set renderTexture(value) {
            this._renderTexture = value;
            if (value) {
                this._nativeObj.setRenderTexture(value._renderTarget._nativeObj, value.width, value.height, value._invertY);
            }
            else {
                this._nativeObj.setRenderTexture(null, 0, 0, false);
            }
        }
        get priority() {
            return this._priority;
        }
        set priority(value) {
            this._priority = value;
            this._nativeObj.priority = value;
        }
        set shaderData(value) {
            this._shaderData = value;
        }
        get shaderData() {
            return this._shaderData;
        }
        set offsetMatrix(value) {
            this._renderOffset = value;
            this._propsF32[4] = value.a;
            this._propsF32[5] = value.b;
            this._propsF32[6] = value.c;
            this._propsF32[7] = value.d;
            this._propsF32[8] = value.tx;
            this._propsF32[9] = value.ty;
        }
        get offsetMatrix() {
            return this._renderOffset;
        }
        needRender() {
            return (this._propsI32[0] !== 0 && this._propsI32[1] === 0 && (this._propsI32[2] !== 0 || !this._renderTexture));
        }
        setClearColor(r, g, b, a) {
            this._propsF32[10] = r;
            this._propsF32[11] = g;
            this._propsF32[12] = b;
            this._propsF32[13] = a;
        }
        constructor(skipNative) {
            this._propsBuf = new ArrayBuffer(14 * 4);
            this._propsI32 = new Int32Array(this._propsBuf);
            this._propsF32 = new Float32Array(this._propsBuf);
            this._enableBatch = false;
            this._root = null;
            this.postProcess = null;
            this._enablePostProcess = false;
            this._postProcessShaderDataRef = null;
            this._shaderData = null;
            this._renderOffset = new Laya.Matrix();
            this._shaderData = Laya.LayaGL.renderDeviceFactory.createShaderData(null);
            if (!skipNative) {
                this._nativeObj = new window.conchRTRender2DPass(this._shaderData._nativeObj);
                this._nativeObj.bindPass2DBuffer(this._propsBuf);
                this.enable = true;
                this.enableBatch = true;
                this.isSupport = false;
                this.doClearColor = true;
                this.repaint = true;
                this.priority = 0;
                this.offsetMatrix = new Laya.Matrix();
            }
        }
        fowardRender(context, renderTime) {
            let rt = this.renderTexture;
            if (rt) {
                context.invertY = rt._invertY;
            }
            this._nativeObj.fowardRender(context._nativeObj, renderTime);
        }
        updatePostProcess() {
            let pp = this.postProcess;
            if (pp === null || pp === void 0 ? void 0 : pp._checkEnabled()) {
                let command = pp._context.command;
                this._postProcessShaderDataRef = command.shaderData;
                this._nativeObj.setPostProcessShaderData(this._postProcessShaderDataRef._nativeObj);
                this._nativeObj.setPostProcess(this._getRenderCMDArray(command._renderCMDs));
                this._nativeObj.setEnablePostProcess(true);
                this._enablePostProcess = true;
            }
            else if (this._enablePostProcess) {
                this._nativeObj.setEnablePostProcess(false);
                this._nativeObj.setPostProcessShaderData(null);
                this._postProcessShaderDataRef = null;
                this._enablePostProcess = false;
            }
        }
        _getRenderCMDArray(cmds) {
            let nativeobCMDs = [];
            cmds.forEach(element => {
                nativeobCMDs.push(element._nativeObj);
            });
            return nativeobCMDs;
        }
        destroy() {
            this._nativeObj.destroy();
            this.root = null;
            this.renderTexture = null;
            this.postProcess = null;
            this._postProcessShaderDataRef = null;
            this.shaderData = null;
        }
    }
    class RTRender2DPassManager {
        constructor() {
            this._nativeObj = new window.conchRTRender2DPassManager();
        }
        removePass(pass) {
            this._nativeObj.removePass(pass._nativeObj);
        }
        apply(context, renderTime) {
            this._nativeObj.apply(context._nativeObj, renderTime);
        }
        clear() {
            this._nativeObj.clear();
        }
        addPass(pass) {
            this._nativeObj.addPass(pass._nativeObj);
        }
    }

    class RTRender2DDataHandle {
        constructor(nativeObj) {
            this._nativeObj = nativeObj;
            this._needUseMatrix = true;
        }
        get owner() {
            return this._owner;
        }
        set owner(value) {
            this._setOwnerLocal(value);
            this._nativeObj.setOwner(value ? value._nativeObj : null);
        }
        _setOwnerLocal(value) {
            this._owner = value;
        }
        get needUseMatrix() {
            return this._needUseMatrix;
        }
        set needUseMatrix(value) {
            if (this._needUseMatrix === value)
                return;
            this._setNeedUseMatrixLocal(value);
            this._nativeObj.needUseMatrix = value;
        }
        _setNeedUseMatrixLocal(value) {
            this._needUseMatrix = value;
        }
        destroy() {
            this._nativeObj.destroy();
        }
        inheriteRenderData(context) {
            this._nativeObj.inheriteRenderData(context._nativeObj);
        }
    }
    class RTEmptyRender2DDataHandle extends RTRender2DDataHandle {
        constructor() {
            const nativeObj = new window.conchRTEmptyRender2DDataHandle();
            super(nativeObj);
        }
        inheriteRenderData(_context) {
        }
        destroy() {
        }
    }
    class RTSubStructRenderDataHandle extends RTRender2DDataHandle {
        constructor() {
            let ctor = window.conchRTSubStructRenderDataHandle;
            if (!ctor)
                throw new Error("Native backend has not implemented conchRTSubStructRenderDataHandle");
            super(new ctor());
            this._mask = null;
            this._logicMatrix = null;
            this._subStructUpdateBuffer = new ArrayBuffer(8 * 4);
            this._subStructUpdateFloat32 = new Float32Array(this._subStructUpdateBuffer);
            this._subStructUpdateInt32 = new Int32Array(this._subStructUpdateBuffer);
            this._nativeObj.setSubStructUpdateBuffer(this._subStructUpdateBuffer);
        }
        get mask() {
            return this._mask;
        }
        set mask(value) {
            if (this._mask === value)
                return;
            this._mask = value;
            this._nativeObj.setMask(value ? value._nativeObj : null);
        }
        get logicMatrix() {
            return this._logicMatrix;
        }
        set logicMatrix(value) {
            if (!value) {
                if (!this._logicMatrix)
                    return;
                this._logicMatrix = null;
                this._subStructUpdateInt32[6] = 0;
                return;
            }
            if (!this._logicMatrix)
                this._logicMatrix = new Laya.Matrix();
            value.copyTo(this._logicMatrix);
            let values = this._subStructUpdateFloat32;
            values[0] = value.a;
            values[1] = value.b;
            values[2] = value.c;
            values[3] = value.d;
            values[4] = value.tx;
            values[5] = value.ty;
            this._subStructUpdateInt32[6] = 1;
        }
        destroy() {
            super.destroy();
            this._mask = null;
            this._logicMatrix = null;
            this._subStructUpdateBuffer = null;
            this._subStructUpdateFloat32 = null;
            this._subStructUpdateInt32 = null;
        }
    }
    class RTGraphicsSingleQuadDataHandle extends RTRender2DDataHandle {
        constructor() {
            let ctor = window.conchRTGraphicsSingleQuadDataHandle;
            if (!ctor)
                throw new Error("Native backend has not implemented conchRTGraphicsSingleQuadDataHandle");
            super(new ctor());
            this._graphicsSubShader = null;
            this._graphicsShaderData = null;
            this._graphicsUseSpriteState = true;
            this._graphicsHandleUpdateBuffer = null;
            this._singleQuadPayloadBuffer = null;
            this._singleQuadActive = false;
            this._singleQuadNativeTexture = null;
            this._singleQuadTextureId = 0;
        }
        get owner() {
            return super.owner;
        }
        set owner(value) {
            if (this._owner === value)
                return;
            super.owner = value;
            this._setNeedUseMatrixLocal(true);
            this._singleQuadActive = false;
        }
        setGraphicsHandleUpdateBuffer(buffer) {
            if (this._graphicsHandleUpdateBuffer === buffer)
                return;
            this._graphicsHandleUpdateBuffer = buffer;
            this._nativeObj.setGraphicsHandleUpdateBuffer(buffer);
        }
        setGraphicsMaterialState(subShader, shaderData, useSpriteState) {
            var _a;
            subShader = subShader || null;
            shaderData = shaderData || null;
            if (this._graphicsSubShader === subShader && this._graphicsShaderData === shaderData && this._graphicsUseSpriteState === useSpriteState)
                return;
            this._graphicsSubShader = subShader;
            this._graphicsShaderData = shaderData;
            this._graphicsUseSpriteState = useSpriteState;
            let subShaderHolder = subShader;
            let shaderDataHolder = shaderData;
            this._nativeObj.setGraphicsMaterialState(subShaderHolder ? ((_a = subShaderHolder.moduleData) === null || _a === void 0 ? void 0 : _a._nativeObj) || subShaderHolder._nativeObj || null : null, shaderDataHolder ? shaderDataHolder._nativeObj || null : null, useSpriteState);
        }
        setSingleQuadPayloadBuffer(buffer) {
            if (this._singleQuadPayloadBuffer === buffer)
                return;
            if (this._singleQuadPayloadBuffer)
                throw new Error("SingleQuad payload buffer can only be bound once");
            this._singleQuadPayloadBuffer = buffer;
            this._nativeObj.setSingleQuadPayloadBuffer(buffer);
        }
        syncSingleQuad(texture) {
            if (!this._singleQuadPayloadBuffer)
                return false;
            let internalTexture = texture ? texture._texture : null;
            let nativeTexture = internalTexture ? internalTexture._nativeObj || null : null;
            let textureId = texture ? texture.id : 0;
            if (!this._singleQuadActive || this._singleQuadNativeTexture !== nativeTexture || this._singleQuadTextureId !== textureId) {
                this._singleQuadNativeTexture = nativeTexture;
                this._singleQuadTextureId = textureId;
                let synced = this._nativeObj.syncSingleQuad(nativeTexture, textureId) !== false;
                if (!synced)
                    return false;
            }
            this._singleQuadActive = true;
            this._setNeedUseMatrixLocal(false);
            return true;
        }
        deactivateSingleQuad() {
            if (!this._singleQuadActive)
                return;
            this._nativeObj.deactivateSingleQuad();
            this._singleQuadActive = false;
        }
        destroy() {
            this._graphicsSubShader = null;
            this._graphicsShaderData = null;
            super.destroy();
            this._graphicsHandleUpdateBuffer = null;
            this._singleQuadPayloadBuffer = null;
            this._singleQuadNativeTexture = null;
            this._singleQuadTextureId = 0;
            this._singleQuadActive = false;
        }
    }
    class RTGraphicsCommandStreamDataHandle extends RTRender2DDataHandle {
        constructor() {
            let ctor = window.conchRTGraphicsCommandStreamDataHandle;
            if (!ctor)
                throw new Error("Native backend has not implemented conchRTGraphicsCommandStreamDataHandle");
            super(new ctor());
            this._graphicsSubShader = null;
            this._graphicsShaderData = null;
            this._graphicsUseSpriteState = true;
            this.autoGraphicsDirtySync = true;
            this._graphicsHandleUpdateBuffer = null;
            this._graphicsNativeOps = [];
            this._graphicsOpsActive = false;
        }
        get owner() {
            return super.owner;
        }
        set owner(value) {
            if (this._owner === value)
                return;
            super.owner = value;
            this._setNeedUseMatrixLocal(true);
            this._graphicsOpsActive = false;
        }
        setGraphicsMaterialState(subShader, shaderData, useSpriteState) {
            var _a;
            subShader = subShader || null;
            shaderData = shaderData || null;
            if (this._graphicsSubShader === subShader
                && this._graphicsShaderData === shaderData
                && this._graphicsUseSpriteState === useSpriteState)
                return;
            this._graphicsSubShader = subShader;
            this._graphicsShaderData = shaderData;
            this._graphicsUseSpriteState = useSpriteState;
            let subShaderHolder = subShader;
            let shaderDataHolder = shaderData;
            this._nativeObj.setGraphicsMaterialState(subShaderHolder ? ((_a = subShaderHolder.moduleData) === null || _a === void 0 ? void 0 : _a._nativeObj) || subShaderHolder._nativeObj || null : null, shaderDataHolder ? shaderDataHolder._nativeObj || null : null, useSpriteState);
        }
        setGraphicsHandleUpdateBuffer(buffer) {
            if (this._graphicsHandleUpdateBuffer === buffer)
                return;
            this._graphicsHandleUpdateBuffer = buffer;
            this._nativeObj.setGraphicsHandleUpdateBuffer(buffer);
        }
        syncGraphicsOps(ops) {
            let nativeOps = this._graphicsNativeOps;
            let count = ops ? ops.length : 0;
            nativeOps.length = count;
            for (let i = 0; i < count; i++)
                nativeOps[i] = ops[i]._nativeObj || null;
            this._nativeObj.syncGraphicsOps(nativeOps, count);
            this._setNeedUseMatrixLocal(count === 0);
            this._graphicsOpsActive = count > 0;
        }
        deactivateGraphicsOps() {
            if (!this._graphicsOpsActive)
                return;
            this._nativeObj.deactivateGraphicsOps();
            this._graphicsOpsActive = false;
        }
        inheriteRenderData(context) {
            this._nativeObj.inheriteRenderData(context._nativeObj);
        }
        destroy() {
            this._graphicsSubShader = null;
            this._graphicsShaderData = null;
            super.destroy();
            this._graphicsNativeOps.length = 0;
            this._graphicsHandleUpdateBuffer = null;
            this._graphicsOpsActive = false;
        }
    }
    class RTBaseRenderDataHandle extends RTRender2DDataHandle {
        constructor(nativeObj) {
            super(nativeObj || new window.conchRTRender2DDataHandle());
            this._lightReceive = false;
        }
        get lightReceive() {
            return this._lightReceive;
        }
        set lightReceive(value) {
            this._lightReceive = value;
            if (value) {
                this._owner.spriteShaderData.addDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_ENABLE);
            }
            else {
                this._owner.spriteShaderData.removeDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_ENABLE);
            }
        }
        get owner() {
            return this._owner;
        }
        set owner(value) {
            if (value == this._owner)
                return;
            this._setOwnerLocal(value);
            this._nativeObj.setOwner(value ? value._nativeObj : null);
        }
        _setOwnerLocal(value) {
            if (value == this._owner)
                return;
            if (this._owner) {
                this._owner.spriteShaderData.removeDefine(Laya.BaseRenderNode2D.SHADERDEFINE_BASERENDER2D);
            }
            super._setOwnerLocal(value);
            if (this._owner) {
                this._owner.spriteShaderData.addDefine(Laya.BaseRenderNode2D.SHADERDEFINE_BASERENDER2D);
            }
        }
    }
    class RTMesh2DRenderDataHandle extends RTBaseRenderDataHandle {
        constructor() {
            super(new window.conchRTMesh2DRenderDataHandle());
            this._baseColor = new Laya.Color(1, 1, 1, 1);
            this._tilingOffset = new Laya.Vector4();
            this.baseColor = new Laya.Color(1, 1, 1, 1);
        }
        get tilingOffset() {
            return this._tilingOffset;
        }
        set tilingOffset(value) {
            if (!value)
                return;
            this._owner.spriteShaderData.setVector(Laya.BaseRenderNode2D.TILINGOFFSET, value);
            value ? value.cloneTo(this._tilingOffset) : null;
        }
        get baseColor() {
            return this._baseColor;
        }
        set baseColor(value) {
            if (value != this._baseColor && this._baseColor.equal(value))
                return;
            value = value ? value : Laya.Color.BLACK;
            value.cloneTo(this._baseColor);
            this._owner.spriteShaderData.setColor(Laya.BaseRenderNode2D.BASERENDER2DCOLOR, this._baseColor);
            this._nativeObj.setBaseColor(this._baseColor);
        }
        get baseTexture() {
            return this._baseTexture;
        }
        set baseTexture(value) {
            if (this._baseTexture != null && value == this._baseTexture)
                return;
            if (this._baseTexture)
                this._baseTexture._removeReference();
            this._baseTexture = value;
            value = value ? value : Laya.Texture2D.whiteTexture;
            this._owner.spriteShaderData.setTexture(Laya.BaseRenderNode2D.BASERENDER2DTEXTURE, value);
            if (value) {
                value._addReference();
                if (value.gammaCorrection != 1) {
                    this._owner.spriteShaderData.addDefine(Laya.ShaderDefines2D.GAMMATEXTURE);
                }
                else {
                    this._owner.spriteShaderData.removeDefine(Laya.ShaderDefines2D.GAMMATEXTURE);
                }
            }
        }
        get normal2DTexture() {
            return this._normal2DTexture;
        }
        set normal2DTexture(value) {
            if (value === this._normal2DTexture)
                return;
            if (this._normal2DTexture)
                this._normal2DTexture._removeReference(1);
            if (value)
                value._addReference();
            this._normal2DTexture = value;
            this._owner.spriteShaderData.setTexture(Laya.BaseRenderNode2D.NORMAL2DTEXTURE, value);
            if (this._normal2DStrength > 0 && this._normal2DTexture)
                this._owner.spriteShaderData.addDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_NORMAL_PARAM);
            else
                this._owner.spriteShaderData.removeDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_NORMAL_PARAM);
        }
        get normal2DStrength() {
            return this._normal2DStrength;
        }
        set normal2DStrength(value) {
            value = Math.max(0, Math.min(1, value));
            if (this._normal2DStrength === value)
                return;
            this._normal2DStrength = value;
            this._owner.spriteShaderData.setNumber(Laya.BaseRenderNode2D.NORMAL2DSTRENGTH, value);
            if (value > 0 && this._normal2DTexture)
                this._owner.spriteShaderData.addDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_NORMAL_PARAM);
            else
                this._owner.spriteShaderData.removeDefine(Laya.BaseRenderNode2D.SHADERDEFINE_LIGHT2D_NORMAL_PARAM);
        }
    }

    const _wm6 = new Float32Array(6);
    class RTGlobalRenderData {
        constructor() {
            this._nativeObj = new window.conchRTGlobalRenderData();
            this._buf = new ArrayBuffer(5 * 4);
            this._f32 = new Float32Array(this._buf);
            this._i32 = new Int32Array(this._buf);
            this._i32[4] = -1;
            this._nativeObj.bindPropertyBuffer(this._buf);
        }
        get cullRect() {
            return this._cullRect;
        }
        set cullRect(value) {
            this._cullRect = value;
            this._f32[0] = value.x;
            this._f32[1] = value.y;
            this._f32[2] = value.z;
            this._f32[3] = value.w;
        }
        get renderLayerMask() {
            return this._i32[4];
        }
        set renderLayerMask(value) {
            this._i32[4] = value;
        }
        get globalShaderData() {
            return this._globalShaderData;
        }
        set globalShaderData(value) {
            this._globalShaderData = value;
            this._nativeObj.setGlobalShaderData(value ? value._nativeObj : null);
        }
    }
    class RTRenderStruct2D {
        get manualRender() {
            return this._manualRender;
        }
        set manualRender(value) {
            this._manualRender = value;
            this._i32[6] = value ? 1 : 0;
        }
        get globalAlpha() {
            const slot = this._transSlot;
            if (slot < 0)
                return 1;
            const store = Laya.Transform2DStore.instance;
            let base = this._i32[15];
            if (this._blendMode === Laya.BlendMode.mask && this.owner && this.owner._maskParent) {
                base = store.getParent(slot);
            }
            if (base < 0)
                return store.dirtyA ? store.computeWorldAlpha(slot) : store.getWorldAlpha(slot);
            return store.getRelativeWorldAlpha(slot, base, store.dirtyA);
        }
        get dcOptimize() {
            return this._dcOptimize;
        }
        set dcOptimize(value) {
            this._dcOptimize = value;
            this._nativeObj.setDcOptimize(value);
        }
        get inheritedDcOptimize() {
            return this._i32[14] !== 0;
        }
        set zIndex(value) {
            this._zIndex = value;
            this._i32[0] = value;
        }
        get zIndex() {
            return this._zIndex;
        }
        set stackingRoot(value) {
            this._stackingRoot = value;
            this._i32[7] = value ? 1 : 0;
        }
        get stackingRoot() {
            return this._stackingRoot;
        }
        get enableCulling() {
            return this._i32[12] !== 0;
        }
        set enableCulling(value) {
            this._nativeObj.setEnableCulling(value);
        }
        get inheritedEnableCulling() {
            return this._i32[13] !== 0;
        }
        set rect(value) {
            value.cloneTo(this._rect);
            this._f32[8] = value.x;
            this._f32[9] = value.y;
            this._f32[10] = value.width;
            this._f32[11] = value.height;
        }
        get rect() {
            return this._rect;
        }
        set renderLayer(value) {
            this._renderLayer = value;
            this._i32[1] = value;
        }
        get renderLayer() {
            return this._renderLayer;
        }
        get subStruct() {
            return this._subStruct;
        }
        set subStruct(value) {
            if (value) {
                value._parent = this._parent;
                value._blendMode = this._blendMode;
            }
            this._subStruct = value;
            this._nativeObj.setSubStruct(value ? value._nativeObj : null);
        }
        set parent(value) {
            this._parent = value;
            if (this._subStruct) {
                this._subStruct._parent = value;
            }
            this._nativeObj.setParent(value ? value._nativeObj : null);
        }
        get parent() {
            return this._parent;
        }
        get children() {
            return this._children;
        }
        set children(value) {
            this._children = value;
            let nativeArray = [];
            for (var i = 0; i < value.length; i++) {
                nativeArray.push(value[i]._nativeObj);
            }
            this._nativeObj.setChildren(nativeArray);
        }
        set renderType(value) {
            this._renderType = value;
            this._i32[2] = value;
        }
        get renderType() {
            return this._renderType;
        }
        set renderUpdateMask(value) {
            this._renderUpdateMask = value;
            this._i32[3] = value;
        }
        get renderUpdateMask() {
            return this._renderUpdateMask;
        }
        get transSlot() {
            return this._transSlot;
        }
        set transSlot(value) {
            this._transSlot = value;
            this._nativeObj.setTransSlot(value);
        }
        getRenderMatrixVersion() {
            return Laya.Transform2DStore.instance.getMatrixFrame(this._transSlot);
        }
        set renderMatrix(value) {
        }
        get renderMatrix() {
            if (this._transSlot >= 0) {
                const store = Laya.Transform2DStore.instance;
                if (store.dirtyM) {
                    store.computeWorldMatrix(this._transSlot, _wm6);
                    this._rmFrame = -1;
                }
                else {
                    const matFrame = store.getMatrixFrame(this._transSlot);
                    if (this._rmFrame === matFrame)
                        return this._renderMatrix;
                    this._rmFrame = matFrame;
                    store.readWorldMatrix(this._transSlot, _wm6);
                }
                const m = this._renderMatrix;
                m.a = _wm6[0];
                m.b = _wm6[1];
                m.c = _wm6[2];
                m.d = _wm6[3];
                m.tx = _wm6[4];
                m.ty = _wm6[5];
                m._checkTransform();
            }
            return this._renderMatrix;
        }
        get alpha() {
            return this._alpha;
        }
        set alpha(value) {
            this._alpha = value;
            this._nativeObj.setAlpha(value);
        }
        get blendMode() {
            var _a;
            if (this._subStruct && this._subStruct.enabled) {
                return Laya.BlendMode.normal;
            }
            return this._blendMode || ((_a = this._parent) === null || _a === void 0 ? void 0 : _a.blendMode) || Laya.BlendMode.normal;
        }
        set blendMode(value) {
            if (this._subStruct && this._subStruct.enabled) {
                this._subStruct._blendMode = value;
            }
            this._blendMode = value;
            this._nativeObj.rt_setBlendMode(this._blendMode);
        }
        get enabled() {
            return this._enabled;
        }
        set enabled(value) {
            this._enabled = value;
            this._i32[4] = value ? 1 : 0;
        }
        get isRenderStruct() {
            return this._isRenderStruct;
        }
        set isRenderStruct(value) {
            this._isRenderStruct = value;
            this._i32[5] = value ? 1 : 0;
        }
        set renderElements(value) {
            this._renderElements = value;
            let nativeArray = [];
            for (let i = 0; i < value.length; i++) {
                nativeArray.push(value[i]._nativeObj);
            }
            this._nativeObj.setRenderElements(nativeArray);
        }
        get renderElements() {
            return this._renderElements;
        }
        set spriteShaderData(value) {
            this._spriteShaderData = value;
            this._nativeObj.setSpriteShaderData(value ? value._nativeObj : null);
        }
        get spriteShaderData() {
            return this._spriteShaderData;
        }
        get renderDataHandler() {
            return this._renderDataHandler;
        }
        set renderDataHandler(value) {
            this._renderDataHandler = value;
            this._nativeObj.setRenderDataHandler(value ? value._nativeObj : null);
            if (value)
                this._renderDataHandler._setOwnerLocal(this);
        }
        set globalRenderData(value) {
            this._globalRenderData = value;
            this._nativeObj.setGlobalRenderData(value ? value._nativeObj : null);
        }
        get globalRenderData() {
            return this._globalRenderData;
        }
        get pass() {
            var _a;
            return this._pass || ((_a = this._parent) === null || _a === void 0 ? void 0 : _a.pass);
        }
        set pass(value) {
            this._pass = value;
            this._nativeObj.setPass(value ? value._nativeObj : null);
        }
        constructor() {
            this._manualRender = false;
            this._clipRect = new Laya.Rectangle(0, 0, 0, 0);
            this._dcOptimize = false;
            this._zIndex = 0;
            this._stackingRoot = false;
            this._rect = new Laya.Rectangle(0, 0, 0, 0);
            this._renderLayer = 1;
            this._parent = null;
            this._children = [];
            this._renderType = -1;
            this._transSlot = -1;
            this._renderMatrix = new Laya.Matrix();
            this._rmFrame = -1;
            this._enabled = true;
            this._renderElements = [];
            this._spriteShaderData = null;
            this._nativeObj = new window.conchRTRenderStruct2D();
            this._buf = new ArrayBuffer(16 * 4);
            this._i32 = new Int32Array(this._buf);
            this._f32 = new Float32Array(this._buf);
            this._nativeObj.bindPropertyBuffer(this._buf);
            this.zIndex = 0;
            this.rect = new Laya.Rectangle(0, 0, 0, 0);
            this.renderLayer = 1;
            this.renderType = -1;
            this.renderUpdateMask = 0;
            this.alpha = 1.0;
            this.blendMode = Laya.BlendMode.invalid;
            this.enabled = true;
            this.isRenderStruct = false;
        }
        setRenderUpdateCallback(func) {
            if (func)
                this._nativeObj.setRenderUpdate(func);
            else
                this._nativeObj.setRenderUpdate(null);
        }
        setClipRect(rect) {
            if (rect) {
                rect.cloneTo(this._clipRect);
                this._clipRect.width = Math.max(this._clipRect.width, 0.0001);
                this._clipRect.height = Math.max(this._clipRect.height, 0.0001);
                this._nativeObj.setClipRect(this._clipRect);
            }
            else {
                this._nativeObj.setClipRect(null);
            }
        }
        setRepaint() {
            this.pass && (this.pass.repaint = true);
        }
        addChild(child, index) {
            child.parent = this;
            this._children.splice(index, 0, child);
            this._nativeObj.addChild(child._nativeObj, index);
            return;
        }
        updateChildIndex(child, oldIndex, index) {
            if (oldIndex === index)
                return;
            this.children.splice(oldIndex, 1);
            if (index >= this.children.length) {
                this.children.push(child);
            }
            else {
                this.children.splice(index, 0, child);
            }
            this._nativeObj.updateChildIndex(child._nativeObj, oldIndex, index);
        }
        removeChild(child) {
            const index = this.children.indexOf(child);
            if (index !== -1) {
                child.parent = null;
                this.children.splice(index, 1);
                this._nativeObj.removeChild(child._nativeObj);
            }
        }
        destroy() {
            this._nativeObj.destroy();
            this._renderElements.length = 0;
            this._renderElements = null;
            this._spriteShaderData = null;
            this._parent = null;
            this._children.length = 0;
            this._children = null;
            this._pass = null;
        }
    }

    class CommonMemoryAllocater {
        static creatBlock(size) {
            const buffer = new ArrayBuffer(size);
            return buffer;
        }
        static freeMemoryBlock(buffer) {
        }
    }

    class NativeMemory {
        constructor(size, shared) {
            if (shared) {
                if (size > NativeMemory._sharedBuffer.byteLength) {
                    throw new Error("NativeMemory:shared buffer not enough");
                }
                this._buffer = NativeMemory._sharedBuffer;
            }
            else {
                this._buffer = CommonMemoryAllocater.creatBlock(size);
            }
            this._byteLength = size;
        }
        get float32Array() {
            if (!this._fdata) {
                this._fdata = new Float32Array(this._buffer);
            }
            return this._fdata;
        }
        get uint8Array() {
            if (!this._byteArray) {
                this._byteArray = new Uint8Array(this._buffer);
            }
            return this._byteArray;
        }
        get int32Array() {
            if (!this._idata) {
                this._idata = new Int32Array(this._buffer);
            }
            return this._idata;
        }
        get Uint32Array() {
            if (!this._uidata) {
                this._uidata = new Uint32Array(this._buffer);
            }
            return this._uidata;
        }
        get Uint16Array() {
            if (!this._uint16data) {
                this._uint16data = new Uint16Array(this._buffer);
            }
            return this._uint16data;
        }
        destroy() {
            if (this._destroyed)
                return;
            this.clear();
            CommonMemoryAllocater.freeMemoryBlock(this._buffer);
            this._destroyed = true;
        }
        clear() {
            this._idata = null;
            this._fdata = null;
            this._uidata = null;
            this._uint16data = null;
            this._byteArray = null;
        }
    }
    NativeMemory.NativeSourceID = 0;
    NativeMemory._sharedBuffer = new ArrayBuffer(256);

    class GLESSetRenderData extends Laya.SetRenderDataCMD {
        get dataType() {
            return this._dataType;
        }
        set dataType(value) {
            this._dataType = value;
            this._u32[1] = value;
        }
        get propertyID() {
            return this._propertyID;
        }
        set propertyID(value) {
            this._propertyID = value;
            this._u32[0] = value;
        }
        get dest() {
            return this._dest;
        }
        set dest(value) {
            this._dest = value;
            this._nativeObj.setDest(value._nativeObj);
        }
        get value() {
            return this._value;
        }
        set value(value) {
            const F = 2;
            switch (this.dataType) {
                case Laya.ShaderDataType.Int:
                    this.data_number = value;
                    this._value = this.data_number;
                    this._i32[18] = this.data_number | 0;
                    break;
                case Laya.ShaderDataType.Float:
                    this.data_number = value;
                    this._value = this.data_number;
                    this._f32[F] = this.data_number;
                    break;
                case Laya.ShaderDataType.Bool:
                    this.data_number = value;
                    this._value = this.data_number;
                    this._i32[19] = this.data_number ? 1 : 0;
                    break;
                case Laya.ShaderDataType.Matrix4x4:
                    !this.data_mat && (this.data_mat = new Laya.Matrix4x4());
                    value.cloneTo(this.data_mat);
                    this._value = this.data_mat;
                    this._f32.set(this.data_mat.elements, F);
                    break;
                case Laya.ShaderDataType.Color:
                    !this.data_Color && (this.data_Color = new Laya.Color());
                    value.cloneTo(this.data_Color);
                    this._value = this.data_Color;
                    this._f32[F] = this.data_Color.r;
                    this._f32[F + 1] = this.data_Color.g;
                    this._f32[F + 2] = this.data_Color.b;
                    this._f32[F + 3] = this.data_Color.a;
                    break;
                case Laya.ShaderDataType.Texture2D:
                    this._value = this.data_texture = value;
                    this._nativeObj.setTexture2D(this.data_texture ? this.data_texture._texture._nativeObj : null);
                    break;
                case Laya.ShaderDataType.Vector4:
                    !this.data_v4 && (this.data_v4 = new Laya.Vector4());
                    value.cloneTo(this.data_v4);
                    this._value = this.data_v4;
                    this._f32[F] = this.data_v4.x;
                    this._f32[F + 1] = this.data_v4.y;
                    this._f32[F + 2] = this.data_v4.z;
                    this._f32[F + 3] = this.data_v4.w;
                    break;
                case Laya.ShaderDataType.Vector2:
                    !this.data_v2 && (this.data_v2 = new Laya.Vector2());
                    value.cloneTo(this.data_v2);
                    this._value = this.data_v2;
                    this._f32[F] = this.data_v2.x;
                    this._f32[F + 1] = this.data_v2.y;
                    break;
                case Laya.ShaderDataType.Vector3:
                    !this.data_v3 && (this.data_v3 = new Laya.Vector3());
                    value.cloneTo(this.data_v3);
                    this._value = this.data_v3;
                    this._f32[F] = this.data_v3.x;
                    this._f32[F + 1] = this.data_v3.y;
                    this._f32[F + 2] = this.data_v3.z;
                    break;
                case Laya.ShaderDataType.Buffer:
                    this._value = this.data_Buffer = value;
                    this._nativeObj.setBufferValue(this.data_Buffer.buffer, this.data_Buffer.byteLength);
                    break;
            }
        }
        constructor() {
            super();
            this.type = Laya.RenderCMDType.ChangeData;
            this._nativeObj = new window.conchGLESSetRenderData();
            this._mem = new NativeMemory(20 * 4, false);
            this._f32 = this._mem.float32Array;
            this._i32 = this._mem.int32Array;
            this._u32 = this._mem.Uint32Array;
            this._nativeObj.bindPropertyBuffer(this._mem._buffer);
        }
    }
    class GLESSetShaderDefine extends Laya.SetShaderDefineCMD {
        get define() {
            return this._define;
        }
        set define(value) {
            this._define = value;
            this._nativeObj.setDefine(value);
        }
        get dest() {
            return this._dest;
        }
        set dest(value) {
            this._dest = value;
            this._nativeObj.setDest(value._nativeObj);
        }
        get add() {
            return this._add;
        }
        set add(value) {
            this._add = value;
            this._nativeObj.setAdd(value);
        }
        constructor() {
            super();
            this.type = Laya.RenderCMDType.ChangeShaderDefine;
            this._nativeObj = new window.conchGLESSetShaderDefine();
        }
    }

    class GLESShaderData extends Laya.ShaderData {
        constructor(ownerResource = null, createNativeObj = true) {
            super(ownerResource);
            this._defineDatas = new RTDefineDatas();
            if (createNativeObj) {
                this._nativeObj = new window.conchGLESShaderData(this._defineDatas._nativeObj);
                this._nativeObj.bindMatrixScratch(GLESShaderData._matScratchBuf);
            }
            else {
                this._nativeObj = null;
            }
            this._textureData = {};
            this._bufferData = {};
            this._deviceBufferData = {};
        }
        getDefineData() {
            return this._defineDatas;
        }
        getData() {
        }
        clearData() {
            this._nativeObj.clearData();
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
        getBool(index) {
            return this._nativeObj.getBool(index);
        }
        setBool(index, value) {
            this._nativeObj.setBool(index, value);
        }
        getInt(index) {
            return this._nativeObj.getInt(index);
        }
        setInt(index, value) {
            this._nativeObj.setInt(index, value);
        }
        getNumber(index) {
            return this._nativeObj.getNumber(index);
        }
        setNumber(index, value) {
            this._nativeObj.setNumber(index, value);
        }
        getVector2(index) {
            let value = this._nativeObj.getVector2(index);
            if (value == null) {
                return value;
            }
            else {
                let _tempVector2 = new Laya.Vector2();
                _tempVector2.x = value.x;
                _tempVector2.y = value.y;
                return _tempVector2;
            }
        }
        setVector2(index, value) {
            this._nativeObj.setVector2(index, value.x, value.y);
        }
        getVector3(index) {
            let value = this._nativeObj.getVector3(index);
            if (value == null) {
                return value;
            }
            else {
                let _tempVector3 = new Laya.Vector3();
                _tempVector3.x = value.x;
                _tempVector3.y = value.y;
                _tempVector3.z = value.z;
                return _tempVector3;
            }
        }
        setVector3(index, value) {
            this._nativeObj.setVector3(index, value.x, value.y, value.z);
        }
        getVector(index) {
            let value = this._nativeObj.getVector(index);
            let _tempVector = new Laya.Vector4();
            _tempVector.x = value.x;
            _tempVector.y = value.y;
            _tempVector.z = value.z;
            _tempVector.w = value.w;
            return _tempVector;
        }
        setVector(index, value) {
            this._nativeObj.setVector(index, value.x, value.y, value.z, value.w);
        }
        getColor(index) {
            let value = this._nativeObj.getColor(index);
            if (value == null) {
                return value;
            }
            else {
                let _tempColor = new Laya.Color();
                _tempColor.r = value.r;
                _tempColor.g = value.g;
                _tempColor.b = value.b;
                _tempColor.a = value.a;
                return _tempColor;
            }
        }
        setColor(index, value) {
            if (!value)
                return;
            this._nativeObj.setColor(index, value.r, value.g, value.b, value.a);
        }
        getMatrix4x4(index) {
            if (!this._nativeObj.getMatrix4x4ToScratch(index))
                return null;
            let _tempMatrix4x4 = new Laya.Matrix4x4();
            _tempMatrix4x4.elements.set(GLESShaderData._matScratch);
            return _tempMatrix4x4;
        }
        setMatrix4x4(index, value) {
            GLESShaderData._matScratch.set(value.elements);
            this._nativeObj.setMatrix4x4FromScratch(index);
        }
        getMatrix3x3(index) {
            if (!this._nativeObj.getMatrix3x3ToScratch(index))
                return null;
            let _tempMatrix3x3 = new Laya.Matrix3x3();
            _tempMatrix3x3.elements.set(GLESShaderData._matScratch.subarray(0, 9));
            return _tempMatrix3x3;
        }
        setMatrix3x3(index, value) {
            GLESShaderData._matScratch.set(value.elements);
            this._nativeObj.setMatrix3x3FromScratch(index);
        }
        getBuffer(index) {
            return null;
        }
        setBuffer(index, value) {
            this._bufferData[index] = value;
            this._nativeObj.setBuffer(index, value);
        }
        setDeviceBuffer(index, value) {
            this._deviceBufferData[index] = value;
            this._nativeObj.setDeviceBuffer(index, value._nativeObj);
        }
        setTexture(index, value) {
            var lastValue = this._textureData[index];
            if (value && value.bitmap)
                value = value.bitmap;
            this._textureData[index] = value;
            if (value && value._texture) {
                this._setInternalTexture(index, value._texture._nativeObj);
            }
            else {
                this._setInternalTexture(index, null);
            }
            lastValue && lastValue._removeReference();
            value && value._addReference();
        }
        _setInternalTexture(index, value) {
            this._nativeObj._setInternalTexture(index, value);
        }
        getTexture(index) {
            return this._textureData[index];
        }
        update(name) {
            this._nativeObj.update(name);
        }
        cloneTo(destObject) {
            this._nativeObj.cloneTo(destObject._nativeObj);
            var dest = destObject;
            var destData = dest._textureData;
            for (var k in this._textureData) {
                var value = this._textureData[k];
                if (value != null) {
                    if (value instanceof Laya.BaseTexture) {
                        destData[k] = value;
                        value._addReference();
                    }
                }
            }
        }
        clone() {
            var dest = new GLESShaderData();
            this.cloneTo(dest);
            return dest;
        }
        destroy() {
            this._nativeObj.destroy();
        }
    }
    GLESShaderData._matScratchBuf = new ArrayBuffer(16 * 4);
    GLESShaderData._matScratch = new Float32Array(GLESShaderData._matScratchBuf);

    class GLESRenderContext2D {
        get invertY() {
            return this._ctx2dI32[0] !== 0;
        }
        set invertY(value) {
            this._ctx2dI32[0] = value ? 1 : 0;
        }
        get pipelineMode() {
            return this._pipelineMode;
        }
        set pipelineMode(value) {
            if (this._pipelineMode === value)
                return;
            this._pipelineMode = value;
            this._nativeObj.pipelineMode = value;
        }
        constructor() {
            this._tempList = [];
            this._ctx2dBuf = new ArrayBuffer(5 * 4);
            this._ctx2dI32 = new Int32Array(this._ctx2dBuf);
            this._ctx2dU32 = new Uint32Array(this._ctx2dBuf);
            this._pipelineMode = "Forward";
            this._passData = null;
            this._passDataShell = new GLESShaderData(null, false);
            this._nativeObj = new window.conchGLESRenderContext2D();
            this._nativeObj.bindContext2DBuffer(this._ctx2dBuf);
            this._nativeObj.setGlobalConfigShaderData(Laya.Shader3D._configDefineValues._nativeObj);
            this._nativeObj.pipelineMode = "Forward";
            this._nativeObj.setStencilMaskTemplate(GLESRenderContext2D._getStencilMaskTemplate()._nativeObj);
        }
        static _getStencilMaskTemplate() {
            if (GLESRenderContext2D._stencilMaskTemplate)
                return GLESRenderContext2D._stencilMaskTemplate;
            const element = new GLESRenderElement2D();
            element.geometry = Laya.ShaderDefines2D._stencilGeo;
            element.subShader = Laya.Shader2D.stencilShader.getSubShaderAt(0);
            element.nodeCommonMap = ["BaseRender2D"];
            element.renderStateIsBySprite = true;
            GLESRenderContext2D._stencilMaskTemplate = element;
            return element;
        }
        get passData() {
            this._passDataShell._nativeObj = this._nativeObj.getPassData();
            return this._passDataShell;
        }
        set passData(value) {
            this._passData = value;
            this._nativeObj.setPassData(value ? value._nativeObj : null);
        }
        drawRenderElementList(list) {
            this._tempList.length = 0;
            let listelement = list.elements;
            listelement.forEach((element) => {
                this._tempList.push(element._nativeObj);
            });
            return this._nativeObj.drawRenderElementList(this._tempList, list.length);
        }
        setRenderTarget(value, clear, clearColor) {
            this._dist = value;
            this._nativeObj.setRenderTarget(value ? value._nativeObj : null, clear, clearColor);
        }
        getRenderTarget() {
            return this._dist;
        }
        setOffscreenView(width, height, x = 0, y = 0) {
            this._ctx2dU32[1] = width;
            this._ctx2dU32[2] = height;
            this._ctx2dI32[3] = x;
            this._ctx2dI32[4] = y;
        }
        getOffscreenView(out) {
            out.setValue(this._ctx2dI32[3], this._ctx2dI32[4], this._ctx2dU32[1], this._ctx2dU32[2]);
        }
        drawRenderElementOne(node) {
            this._nativeObj.drawRenderElementOne(node._nativeObj);
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
    GLESRenderContext2D.isCreateBlitScreenELement = false;
    GLESRenderContext2D._stencilMaskGeometry = null;
    GLESRenderContext2D._stencilMaskTemplate = null;

    let _nativeStore = null;
    function rtNativeStore() {
        return _nativeStore || (_nativeStore = new window.conchRTTransform2DStore());
    }
    class RTTransform2DMemoryFactory {
        constructor() {
            this._native = rtNativeStore();
        }
        createChunkBuffers(chunkIndex, capacity, dirtyWords) {
            const cap = capacity, dw = dirtyWords;
            const cnt4 = cap * 9 + cap + cap * 8 + cap + cap * 8 + 6 * dw + 3 * cap;
            const bytes = cnt4 * 4 + (cap + cap) * 2 + cap;
            const mem = new NativeMemory(bytes, false);
            const buf = mem._buffer;
            let o = 0;
            const f32 = (n) => { const v = new Float32Array(buf, o, n); o += n * 4; return v; };
            const i32 = (n) => { const v = new Int32Array(buf, o, n); o += n * 4; return v; };
            const u32 = (n) => { const v = new Uint32Array(buf, o, n); o += n * 4; return v; };
            const u16 = (n) => { const v = new Uint16Array(buf, o, n); o += n * 2; return v; };
            const u8 = (n) => { const v = new Uint8Array(buf, o, n); o += n; return v; };
            const cb = {
                localTrs: f32(cap * 9),
                localAlpha: f32(cap),
                world: f32(cap * 8),
                parent: i32(cap),
                childrenInline: i32(cap * 8),
                selfDirtyM: u32(dw), treeDirtyM: u32(dw),
                selfDirtyA: u32(dw), treeDirtyA: u32(dw),
                selfDirtyC: u32(dw), treeDirtyC: u32(dw),
                matrixFrame: u32(cap), alphaFrame: u32(cap), cullingFrame: u32(cap),
                childCount: u16(cap), slotGen: u16(cap),
                localFlags: u8(cap),
            };
            this._native.bindChunkBuffer(chunkIndex, buf, cap, dw);
            return cb;
        }
        createControlBuffer(length) {
            const mem = new NativeMemory(length * 4, false);
            this._native.bindControlBuffer(mem._buffer, length);
            return new Int32Array(mem._buffer, 0, length);
        }
        createChangedBuffers(capacity) {
            const slotsMem = new NativeMemory(capacity * 4, false);
            const masksMem = new NativeMemory(capacity * 4, false);
            this._native.bindChangedBuffers(slotsMem._buffer, masksMem._buffer, capacity);
            return {
                slots: new Int32Array(slotsMem._buffer, 0, capacity),
                masks: new Int32Array(masksMem._buffer, 0, capacity),
            };
        }
    }
    class RTTransform2DSweep {
        constructor() {
            this._native = rtNativeStore();
        }
        update(_store, frameId) {
            this._native.update(frameId);
        }
    }
    Laya.Laya.addBeforeInitCallback(() => {
        if (window.conchRTTransform2DStore) {
            Laya.Transform2DStore.sweeper = new RTTransform2DSweep();
        }
    });

    class GLESRender2DProcess {
        createTransform2DMemoryFactory() {
            return new RTTransform2DMemoryFactory();
        }
        createPrimitiveRenderElement2D() {
            return new GLESPrimitiveRenderElement2D();
        }
        createRender2DPassManager() {
            return new RTRender2DPassManager();
        }
        create2DGlobalRenderDataHandle() {
            return new RTGlobalRenderData();
        }
        createSubStructRenderDataHandle() {
            return new RTSubStructRenderDataHandle();
        }
        createGraphicsSingleQuadDataHandle() {
            return new RTGraphicsSingleQuadDataHandle();
        }
        createGraphicsCommandStreamDataHandle() {
            return new RTGraphicsCommandStreamDataHandle();
        }
        createGraphicsOp2DFactory() {
            return new GLESGraphicsOp2DFactory();
        }
        create2DBaseRenderDataHandle() {
            return new RTBaseRenderDataHandle();
        }
        createMesh2DRenderDataHandle() {
            return new RTMesh2DRenderDataHandle();
        }
        createSetRenderDataCMD() {
            return new GLESSetRenderData();
        }
        createSetShaderDefineCMD() {
            return new GLESSetShaderDefine();
        }
        createBlit2DQuadCMDData() {
            return new GLESBlit2DQuadCMD();
        }
        createDraw2DElementCMDData() {
            return new GLESDraw2DElementCMD();
        }
        createSetRendertarget2DCMD() {
            return new GLESSetRendertarget2DCMD;
        }
        createRenderElement2D() {
            return new GLESRenderElement2D();
        }
        createRenderContext2D() {
            return new GLESRenderContext2D();
        }
        createRender2DPass() {
            return new RTRender2DPass();
        }
        createRenderStruct2D() {
            return new RTRenderStruct2D();
        }
        createEmptyRenderDataHandle() {
            return new RTEmptyRender2DDataHandle();
        }
    }
    Laya.Laya.addBeforeInitCallback(() => {
        if (!Laya.LayaGL.render2DRenderPassFactory)
            Laya.LayaGL.render2DRenderPassFactory = new GLESRender2DProcess();
    });

    class GLESMeshRenderBatchAgent {
        constructor() {
            this._nativeObj = new window.conchGLESMeshRenderBatchAgent();
        }
        create() {
        }
        addRenderNode(object) {
            return this._nativeObj.addRenderNode(object._baseRenderNode._nativeObj);
        }
        removeRenderNode(object) {
            return this._nativeObj.removeRenderNode(object._baseRenderNode._nativeObj);
        }
        updateProperty(object, property) {
            this._nativeObj.updateProperty(object._baseRenderNode._nativeObj, property);
        }
        release() {
            this._nativeObj.release();
        }
    }

    class GLESBufferState {
        constructor() {
            this._nativeObj = new window.conchGLESBufferState();
        }
        applyState(vertexBuffers, indexBuffer) {
            this._vertexBuffers = vertexBuffers;
            this._bindedIndexBuffer = indexBuffer;
            let tempVertexBuffers = [];
            vertexBuffers.forEach((element) => {
                tempVertexBuffers.push(element._nativeObj);
            });
            this._nativeObj.applyState(tempVertexBuffers, indexBuffer ? indexBuffer._nativeObj : null);
        }
        destroy() {
            this._nativeObj.destroy();
        }
    }

    class GLESCommandUniformMap extends Laya.CommandUniformMap {
        constructor(stateName) {
            super(stateName);
            this._idata = new Map();
            this._stateName = stateName;
            this._nativeObj = new window.conchGLESCommandUniformMap.create(stateName);
        }
        hasPtrID(propertyID) {
            return this._idata.has(propertyID);
        }
        addShaderUniform(propertyID, propertyKey, uniformtype, options) {
            this._nativeObj.addShaderUniform(propertyID, propertyKey, uniformtype);
            let uniform = { id: propertyID, uniformtype: uniformtype, propertyName: propertyKey, arrayLength: 0, format: options === null || options === void 0 ? void 0 : options.format, access: options === null || options === void 0 ? void 0 : options.access };
            this._idata.set(propertyID, uniform);
        }
        addShaderUniformArray(propertyID, propertyName, uniformtype, arrayLength) {
            this._nativeObj.addShaderUniformArray(propertyID, propertyName, uniformtype, arrayLength);
            this._idata.set(propertyID, { id: propertyID, uniformtype: uniformtype, propertyName: propertyName, arrayLength: arrayLength });
        }
        setDefaultTextureData(key, defaultTex) {
        }
    }

    class RTShaderDefine extends Laya.ShaderDefine {
        constructor(index, value) {
            super(index, value);
        }
    }

    class GLESInternalTex {
        constructor(nativeObj) {
            this._nativeObj = nativeObj;
            const buf = new ArrayBuffer(20 * 4);
            this._propsF32 = new Float32Array(buf);
            this._propsI32 = new Int32Array(buf);
            this._propsU32 = new Uint32Array(buf);
            nativeObj.bindPropertyBuffer(buf);
        }
        get wrapU() {
            return this._propsI32[11];
        }
        set wrapU(value) {
            this._nativeObj.rt_setWrapU(value);
        }
        get wrapV() {
            return this._propsI32[12];
        }
        set wrapV(value) {
            this._nativeObj.rt_setWrapV(value);
        }
        get wrapW() {
            return this._propsI32[13];
        }
        set wrapW(value) {
            this._nativeObj.rt_setWrapW(value);
        }
        set baseMipmapLevel(value) {
            this._nativeObj.rt_setBaseMipmapLevel(value);
        }
        get baseMipmapLevel() {
            return this._propsI32[15];
        }
        set maxMipmapLevel(value) {
            this._nativeObj.rt_setMaxMipmapLevel(value);
        }
        get maxMipmapLevel() {
            return this._propsI32[16];
        }
        get compareMode() {
            return this._propsI32[8];
        }
        set compareMode(value) {
            this._propsI32[8] = value;
        }
        get anisoLevel() {
            return this._propsF32[14];
        }
        set anisoLevel(value) {
            this._nativeObj.rt_setAnisoLevel(value);
        }
        get filterMode() {
            return this._propsI32[10];
        }
        set filterMode(value) {
            this._nativeObj.rt_setFilterMode(value);
        }
        get mipmapCount() {
            return this._propsU32[2];
        }
        get mipmap() {
            return this._propsI32[3] !== 0;
        }
        get isPotSize() {
            return this._propsI32[5] !== 0;
        }
        get useSRGBLoad() {
            return this._propsI32[4] !== 0;
        }
        get depth() {
            return this._propsU32[9];
        }
        get gammaCorrection() {
            return this._propsF32[7];
        }
        set gammaCorrection(value) {
            this._nativeObj.rt_setGammaCorrection(value);
        }
        get resource() {
            return this._nativeObj;
        }
        get width() {
            return this._propsU32[0];
        }
        get height() {
            return this._propsU32[1];
        }
        get gpuMemory() {
            return this._propsU32[6];
        }
        dispose() {
            this._nativeObj.dispose();
        }
    }

    class GLESInternalRT {
        constructor(nativeObj, owner = null) {
            this._disposed = false;
            this._propBuf = new ArrayBuffer(7 * 4);
            this._propU32 = new Uint32Array(this._propBuf);
            this._propI32 = new Int32Array(this._propBuf);
            if (!nativeObj)
                throw new Error("Cannot wrap a missing OpenGLES render target.");
            this._nativeObj = nativeObj;
            this._nativeObj.bindPropertyBuffer(this._propBuf);
            this._owner = owner;
            if (owner) {
                this._texturesRef = [owner._textures[0]];
            }
            else {
                const formats = nativeObj.getColorFormats();
                if (formats.length)
                    this.colorFormats = Object.freeze(formats.map(format => format === Laya.RenderTargetFormat.None ? null : format));
            }
        }
        get destroyed() {
            var _a;
            return this._disposed || !!((_a = this._owner) === null || _a === void 0 ? void 0 : _a.destroyed);
        }
        get _color0Target() {
            if (this.destroyed)
                return null;
            if (!this._color0TargetRef && this.colorFormats) {
                const target = this._nativeObj.getColor0Target();
                if (target)
                    this._color0TargetRef = new GLESInternalRT(target, this);
            }
            return this._color0TargetRef;
        }
        get _isCube() {
            return this._propI32[1] !== 0;
        }
        set _isCube(value) {
            this._propI32[1] = value ? 1 : 0;
        }
        get _samples() {
            return this._propU32[0];
        }
        set _samples(value) {
            this._propU32[0] = value;
        }
        get _generateMipmap() {
            return this._propI32[2] !== 0;
        }
        set _generateMipmap(value) {
            this._propI32[2] = value ? 1 : 0;
        }
        get colorFormat() {
            return this._propI32[3];
        }
        set colorFormat(value) {
            this._propI32[3] = value;
        }
        get depthStencilFormat() {
            return this._propI32[4];
        }
        set depthStencilFormat(value) {
            this._propI32[4] = value;
        }
        get isSRGB() {
            return this._propI32[5] !== 0;
        }
        set isSRGB(value) {
            this._propI32[5] = value ? 1 : 0;
        }
        get gpuMemory() {
            return this._propU32[6];
        }
        set gpuMemory(value) {
            this._propU32[6] = value;
        }
        get _textures() {
            if (this._texturesRef) {
                return this._texturesRef;
            }
            else {
                this._texturesRef = [];
                let textures = this._nativeObj.getTextures();
                textures.forEach((element) => {
                    this._texturesRef.push(element ? new GLESInternalTex(element) : null);
                });
                return this._texturesRef;
            }
        }
        get _depthTexture() {
            if (this._owner)
                return this._owner._depthTexture;
            if (this._depthTextureRef) {
                return this._depthTextureRef;
            }
            else {
                var nativeObj = this._nativeObj.getDepthTexture();
                if (nativeObj)
                    this._depthTextureRef = new GLESInternalTex(nativeObj);
                return this._depthTextureRef;
            }
        }
        dispose() {
            if (this._disposed)
                return;
            this._disposed = true;
            this._nativeObj.dispose();
            this._texturesRef = null;
            this._depthTextureRef = null;
            if (this._color0TargetRef) {
                this._color0TargetRef._disposed = true;
                this._color0TargetRef._texturesRef = null;
                this._color0TargetRef._depthTextureRef = null;
            }
        }
    }

    class GLESTextureContext {
        constructor(native) {
            this._native = native;
            this.needBitmap = false;
        }
        createRenderTargetArrayInternal(width, height, depth, colorFormat, depthStencilFormat, generateMipmap, sRGB, multiSamples) {
            return new GLESInternalRT(this._native.createRenderTargetArrayInternal(width, height, depth, colorFormat, depthStencilFormat ? depthStencilFormat : Laya.RenderTargetFormat.None, generateMipmap, sRGB, multiSamples));
        }
        createTextureInternal(dimension, width, height, format, generateMipmap, sRGB, premultipliedAlpha) {
            var tex = new GLESInternalTex(this._native.createTextureInternal(dimension, width, height, format, generateMipmap, sRGB, premultipliedAlpha));
            return tex;
        }
        setTextureImageData(texture, source, premultiplyAlpha, invertY) {
            if (source instanceof HTMLCanvasElement) {
                throw "native cant draw HTMLCanvasElement";
            }
            if (source.conchImgId !== undefined) {
                this._native.setTextureImageData(texture._nativeObj, source.conchImgId, premultiplyAlpha, invertY);
            }
            else {
                this._native.setTextureImageData(texture._nativeObj, source._nativeObj.conchImgId, premultiplyAlpha, invertY);
            }
        }
        setTexturePixelsData(texture, source, premultiplyAlpha, invertY) {
            this._native.setTexturePixelsData(texture._nativeObj, source, premultiplyAlpha, invertY);
        }
        initVideoTextureData(texture) {
            this._native.initVideoTextureData(texture._nativeObj);
        }
        setTextureSubPixelsData(texture, source, mipmapLevel, generateMipmap, xOffset, yOffset, width, height, premultiplyAlpha, invertY) {
            this._native.setTextureSubPixelsData(texture._nativeObj, source, mipmapLevel, generateMipmap, xOffset, yOffset, width, height, premultiplyAlpha, invertY);
        }
        setTextureSubImageData(texture, source, x, y, premultiplyAlpha, invertY) {
            if (source instanceof HTMLCanvasElement) {
                throw "native cant draw HTMLCanvasElement";
            }
            throw "native not need this function";
        }
        setTexture3DImageData(texture, source, depth, premultiplyAlpha, invertY) {
            this._native.setTexture3DImageData(texture._nativeObj, source.map(function (s) { return s._nativeObj; }), depth, premultiplyAlpha, invertY);
        }
        createTexture3DInternal(dimension, width, height, depth, format, generateMipmap, sRGB, premultipliedAlpha) {
            return new GLESInternalTex(this._native.createTexture3DInternal(dimension, width, height, depth, format, generateMipmap, sRGB, premultipliedAlpha));
        }
        setTexture3DPixelsData(texture, source, depth, premultiplyAlpha, invertY) {
            this._native.setTexture3DPixelsData(texture._nativeObj, source, depth, premultiplyAlpha, invertY);
        }
        setTexture3DSubPixelsData(texture, source, mipmapLevel, generateMipmap, xOffset, yOffset, zOffset, width, height, depth, premultiplyAlpha, invertY) {
            this._native.setTexture3DSubPixelsData(texture._nativeObj, source, mipmapLevel, generateMipmap, xOffset, yOffset, zOffset, width, height, depth, premultiplyAlpha, invertY);
        }
        setTextureHDRData(texture, hdrInfo) {
            let sourceData = hdrInfo.readScanLine();
            this.setTexturePixelsData(texture, sourceData, false, false);
        }
        setTextureDDSData(texture, ddsInfo) {
            this._native.setTextureDDSData(texture._nativeObj, ddsInfo);
        }
        setTextureKTXData(texture, ktxInfo) {
            this._native.setTextureKTXData(texture._nativeObj, ktxInfo);
        }
        setCubeImageData(texture, sources, premultiplyAlpha, invertY) {
            var images = [];
            var length = sources.length;
            for (let index = 0; index < length; index++) {
                images.push(sources[index]._nativeObj);
            }
            this._native.setCubeImageData(texture._nativeObj, images, premultiplyAlpha, invertY);
        }
        setCubePixelsData(texture, source, premultiplyAlpha, invertY) {
            this._native.setCubePixelsData(texture._nativeObj, source, premultiplyAlpha, invertY);
        }
        setCubeSubPixelData(texture, source, mipmapLevel, generateMipmap, xOffset, yOffset, width, height, premultiplyAlpha, invertY) {
            this._native.setCubeSubPixelData(texture._nativeObj, source, mipmapLevel, generateMipmap, xOffset, yOffset, width, height, premultiplyAlpha, invertY);
        }
        setCubeDDSData(texture, ddsInfo) {
            this._native.setCubeDDSData(texture._nativeObj, ddsInfo);
        }
        setCubeKTXData(texture, ktxInfo) {
            this._native.setCubeKTXData(texture._nativeObj, ktxInfo);
        }
        setTextureCompareMode(texture, compareMode) {
            return this._native.setTextureCompareMode(texture._nativeObj, compareMode);
        }
        bindRenderTarget(renderTarget, faceIndex = 0) {
            var _a;
            if (renderTarget === null || renderTarget === void 0 ? void 0 : renderTarget.destroyed)
                throw new Error("Cannot bind a disposed OpenGLES render target.");
            if ((renderTarget === null || renderTarget === void 0 ? void 0 : renderTarget.colorFormats) && faceIndex !== 0)
                throw new RangeError("OpenGLES MRT only supports 2D attachments at mip level 0.");
            this._native.bindRenderTarget((_a = renderTarget === null || renderTarget === void 0 ? void 0 : renderTarget._nativeObj) !== null && _a !== void 0 ? _a : null, faceIndex);
        }
        bindoutScreenTarget() {
            this._native.bindoutScreenTarget();
        }
        unbindRenderTarget(renderTarget) {
            var _a;
            this._native.unbindRenderTarget((_a = renderTarget === null || renderTarget === void 0 ? void 0 : renderTarget._nativeObj) !== null && _a !== void 0 ? _a : null);
        }
        createMultiRenderTargetInternal(width, height, colorFormats, depthStencilFormat, color0SRGB = false) {
            if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width > 0x7fffffff || height > 0x7fffffff)
                throw new RangeError("MRT dimensions must be positive integers.");
            if (!Array.isArray(colorFormats) || !colorFormats.length || colorFormats[0] == null)
                throw new RangeError("MRT requires color attachment 0 and a non-empty color layout.");
            const formats = Array.from(colorFormats, format => {
                if (format == null)
                    return Laya.RenderTargetFormat.None;
                if (!Number.isInteger(format) || format === Laya.RenderTargetFormat.None)
                    throw new TypeError("MRT color formats must be valid format values or null.");
                return format;
            });
            return new GLESInternalRT(this._native.createMultiRenderTargetInternal(width, height, formats, depthStencilFormat, color0SRGB));
        }
        createRenderTargetInternal(width, height, colorFormat, depthStencilFormat, generateMipmap, sRGB, multiSamples, storage) {
            return new GLESInternalRT(this._native.createRenderTargetInternal(width, height, colorFormat, depthStencilFormat ? depthStencilFormat : Laya.RenderTargetFormat.None, generateMipmap, sRGB, multiSamples));
        }
        createRenderTargetCubeInternal(size, colorFormat, depthStencilFormat, generateMipmap, sRGB, multiSamples) {
            return new GLESInternalRT(this._native.createRenderTargetCubeInternal(size, colorFormat, depthStencilFormat, generateMipmap, sRGB, multiSamples));
        }
        createRenderTextureCubeInternal(dimension, size, format, generateMipmap, sRGB) {
            return new GLESInternalTex(this._native.createRenderTextureCubeInternal(dimension, size, format, generateMipmap, sRGB));
        }
        createRenderTargetDepthTexture(renderTarget, dimension, width, height) {
            if (!renderTarget || renderTarget.destroyed || renderTarget._owner)
                throw new Error("Cannot replace depth storage on a disposed or borrowed OpenGLES render target.");
            if (renderTarget.colorFormats && (dimension !== Laya.TextureDimension.Tex2D ||
                width !== renderTarget._textures[0].width || height !== renderTarget._textures[0].height))
                throw new RangeError("MRT depth dimensions must match the 2D color attachments.");
            const nativeTexture = this._native.createRenderTargetDepthTexture(renderTarget._nativeObj, dimension, width, height);
            const texture = nativeTexture ? new GLESInternalTex(nativeTexture) : null;
            renderTarget._depthTextureRef = texture;
            return texture;
        }
        readRenderTargetPixelData(renderTarget, xOffset, yOffset, width, height, out) {
            return this._native.readRenderTargetPixelData(renderTarget._nativeObj, xOffset, yOffset, width, height, out);
        }
        async readRenderTargetPixelDataAsync(renderTarget, xOffset, yOffset, width, height, out, attachmentIndex = 0) {
            if (!Number.isInteger(attachmentIndex) || attachmentIndex < 0)
                throw new RangeError("Color attachment index must be a non-negative integer.");
            if (!renderTarget || renderTarget.destroyed)
                throw new Error("Cannot read a missing or disposed OpenGLES render target.");
            if (!renderTarget.colorFormats) {
                if (attachmentIndex !== 0)
                    throw new RangeError("An ordinary OpenGLES render target only has color attachment 0.");
                return this.readRenderTargetPixelData(renderTarget, xOffset, yOffset, width, height, out);
            }
            const format = renderTarget.colorFormats[attachmentIndex];
            if (attachmentIndex >= renderTarget.colorFormats.length || format == null)
                throw new RangeError("MRT color attachment is empty or out of range.");
            if (!Number.isInteger(xOffset) || !Number.isInteger(yOffset) || !Number.isInteger(width) || !Number.isInteger(height))
                throw new RangeError("MRT readback rectangle must use integer coordinates and dimensions.");
            const texture = renderTarget._textures[attachmentIndex];
            if (xOffset < 0 || yOffset < 0 || width <= 0 || height <= 0 ||
                width > texture.width || height > texture.height || xOffset > texture.width - width || yOffset > texture.height - height)
                throw new RangeError("MRT readback rectangle is outside the color attachment.");
            const bytePixels = format === Laya.RenderTargetFormat.R8G8B8 || format === Laya.RenderTargetFormat.R8G8B8A8;
            if (bytePixels ? !(out instanceof Uint8Array || out instanceof Uint8ClampedArray) : !(out instanceof Float32Array))
                throw new TypeError("MRT readback requires a byte view for byte attachments and Float32Array for floating-point attachments.");
            const byteLength = width * height * 4 * (bytePixels ? 1 : 4);
            if (out.byteLength < byteLength)
                throw new RangeError(`MRT readback output requires at least ${byteLength} bytes.`);
            return this._native.readMultiRenderTargetPixelData(renderTarget._nativeObj, xOffset, yOffset, width, height, out, attachmentIndex);
        }
        updateVideoTexture(texture, video, premultiplyAlpha, invertY) {
            if (texture && video) {
                this._native.updateVideoTexture(texture._nativeObj, video._nativeObj.conchImgId, premultiplyAlpha, invertY);
            }
        }
    }

    exports.GLESMode = void 0;
    (function (GLESMode) {
        GLESMode[GLESMode["Auto"] = 0] = "Auto";
        GLESMode[GLESMode["WebGL2"] = 1] = "WebGL2";
        GLESMode[GLESMode["WebGL1"] = 2] = "WebGL1";
    })(exports.GLESMode || (exports.GLESMode = {}));
    class GLESEngine {
        constructor(config, webglMode = exports.GLESMode.Auto) {
            this._remapZ = true;
            this._screenInvertY = false;
            this._lodTextureSample = true;
            this._breakTextureSample = true;
            this._nativeObj = new window.conchGLESEngine(config, webglMode);
            this._propsBuffer = new ArrayBuffer(2 * 4);
            this._i32 = new Int32Array(this._propsBuffer);
            this._nativeObj.bindPropertyBuffer(this._propsBuffer);
        }
        get _framePassCount() {
            return this._i32[0];
        }
        set _framePassCount(value) {
            this._i32[0] = value;
        }
        endFrame() {
            this._nativeObj.endFrame();
        }
        startFrame() {
            this._i32[1] = Laya.Stat.loopCount;
            this._nativeObj.startFrame();
        }
        resizeOffScreen(width, height) {
            this._nativeObj.resizeOffScreen(width, height);
        }
        getDefineByName(name) {
            let nativeRet = this._nativeObj.getDefineByName(name);
            let ret = new RTShaderDefine(nativeRet._index, nativeRet._value);
            return ret;
        }
        getNamesByDefineData(defineData, out) {
            out.length = 0;
            this._nativeObj.getNamesByDefineData(defineData._nativeObj, out);
        }
        addTexGammaDefine(key, value) {
            this._nativeObj.addTexGammaDefine(key, value);
        }
        initRenderEngine(canvas) {
            this._nativeObj.initRenderEngine(canvas._nativeObj);
            this._GLTextureContext = new GLESTextureContext(this._nativeObj.getTextureContext());
            Laya.Config._uniformBlock = Laya.Config.enableUniformBufferObject && this.getCapable(Laya.RenderCapable.UnifromBufferObject);
            Laya.Config.matUseUBO = Laya.Config.matUseUBO && this.getCapable(Laya.RenderCapable.UnifromBufferObject);
            this._nativeObj.enableUniformBufferObject = Laya.Config._uniformBlock;
            this._nativeObj.matUseUBO = Laya.Config.matUseUBO;
        }
        copySubFrameBuffertoTex(texture, level, xoffset, yoffset, x, y, width, height) {
            this._nativeObj.copySubFrameBuffertoTex(texture._nativeObj, level, xoffset, yoffset, x, y, width, height);
        }
        propertyNameToID(name) {
            return this._nativeObj.propertyNameToID(name);
        }
        propertyIDToName(id) {
            return this._nativeObj.propertyIDToName(id);
        }
        getParams(params) {
            return this._nativeObj.rt_getParams(params);
        }
        getCapable(capatableType) {
            return this._nativeObj.rt_getCapable(capatableType);
        }
        getTextureContext() {
            return this._GLTextureContext;
        }
        viewport(x, y, width, height) {
            this._nativeObj.viewport(x, y, width, height);
        }
        scissor(x, y, width, height) {
            this._nativeObj.scissor(x, y, width, height);
        }
    }

    class GLESGeometryUpdateBatch {
        constructor() {
            this.buffers = [];
            this.sources = [];
            this.geometries = new Set();
            this.nativeGeometries = [];
            this.uploadRanges = new Int32Array(256);
            this.drawRanges = new Int32Array(512);
            this.renderNodes = [];
            this.renderElements = [];
            this.renderElementCounts = new Uint32Array(256);
        }
        static completeCameraRenderUpdateBatch(nodes, cameraMask) {
            var _a;
            const complete = (_a = window.conchRTBaseRenderNode) === null || _a === void 0 ? void 0 : _a.completeCameraRenderUpdateBatch;
            if (!complete || !Number.isInteger(cameraMask) || cameraMask < 0 || cameraMask > 0xffffffff)
                return false;
            if (!nodes.length)
                return true;
            if (!complete(nodes.map(node => node._nativeObj), cameraMask))
                return false;
            this.diagnostics.cameraUpdateCompletions++;
            this.diagnostics.cameraUpdateNodes += nodes.length;
            return true;
        }
        static begin() {
            var _a, _b;
            if (typeof ((_a = window.conchGLESVertexBuffer) === null || _a === void 0 ? void 0 : _a.submitGeometryBatch) !== "function")
                return null;
            const previous = this.active;
            previous === null || previous === void 0 ? void 0 : previous.flush();
            const batch = (_b = this.pool.pop()) !== null && _b !== void 0 ? _b : new GLESGeometryUpdateBatch();
            this.active = batch;
            let finished = false;
            return () => {
                if (finished)
                    return;
                if (this.active !== batch)
                    throw new Error("Geometry update scopes must finish in order");
                finished = true;
                try {
                    batch.flush();
                }
                finally {
                    this.active = previous;
                    this.pool.push(batch);
                }
            };
        }
        upload(buffer, source, offset, start, bytes) {
            const at = this.buffers.length * 4;
            if (bytes === Number.MAX_SAFE_INTEGER)
                bytes = source.byteLength;
            if (![offset, start, bytes].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 0x7fffffff)
                || start + bytes > source.byteLength)
                throw new RangeError("Invalid geometry upload range");
            if (at + 4 > this.uploadRanges.length) {
                const grown = new Int32Array(this.uploadRanges.length * 2);
                grown.set(this.uploadRanges);
                this.uploadRanges = grown;
            }
            this.uploadRanges.set([offset, start, bytes, 0], at);
            this.buffers.push(buffer);
            this.sources.push(source);
        }
        geometry(value) { this.geometries.add(value); }
        bindRenderElements(node, elements) {
            var _a;
            if (typeof ((_a = window.conchRTBaseRenderNode) === null || _a === void 0 ? void 0 : _a.setRenderElementsBatch) !== "function")
                return false;
            const at = this.renderNodes.length;
            if (at === this.renderElementCounts.length) {
                const grown = new Uint32Array(at * 2);
                grown.set(this.renderElementCounts);
                this.renderElementCounts = grown;
            }
            this.renderElementCounts[at] = elements.length;
            this.renderNodes.push(node);
            for (const element of elements)
                this.renderElements.push(element._nativeObj);
            return true;
        }
        flush() {
            if (!this.buffers.length && !this.geometries.size && !this.renderNodes.length)
                return;
            let words = this.geometries.size * 3;
            for (const geometry of this.geometries)
                words += geometry.drawParams.length;
            if (words > this.drawRanges.length)
                this.drawRanges = new Int32Array(Math.max(words, this.drawRanges.length * 2));
            let row = 0, offset = this.geometries.size * 3;
            try {
                for (const geometry of this.geometries) {
                    const params = geometry.drawParams;
                    if (params.length % 2)
                        throw new RangeError("Incomplete geometry draw pair");
                    this.drawRanges.set([offset, params.length / 2, geometry.instanceCount], row * 3);
                    for (let i = 0; i < params.length; ++i) {
                        const value = params.elements[i];
                        if (!Number.isSafeInteger(value) || value < 0 || value > 0x7fffffff)
                            throw new RangeError("Invalid geometry draw range");
                        this.drawRanges[offset++] = value;
                    }
                    this.nativeGeometries.push(geometry._nativeObj);
                    row++;
                }
                const counters = GLESGeometryUpdateBatch.diagnostics;
                if (this.buffers.length || this.geometries.size) {
                    if (!window.conchGLESVertexBuffer.submitGeometryBatch(this.buffers, this.sources, this.uploadRanges.buffer, this.nativeGeometries, this.drawRanges.buffer)) {
                        throw new Error("Native geometry submission batch rejected");
                    }
                    counters.flushes++;
                    counters.uploads += this.buffers.length;
                    counters.geometries += row;
                    for (let i = 0; i < this.buffers.length; ++i)
                        counters.uploadBytes += this.uploadRanges[i * 4 + 2];
                }
                if (this.renderNodes.length) {
                    if (!window.conchRTBaseRenderNode.setRenderElementsBatch(this.renderNodes, this.renderElements, this.renderElementCounts.buffer)) {
                        throw new Error("Native render element batch rejected");
                    }
                    counters.renderNodeFlushes++;
                    counters.renderNodes += this.renderNodes.length;
                    counters.renderElements += this.renderElements.length;
                }
            }
            finally {
                this.buffers.length = this.sources.length = this.nativeGeometries.length = 0;
                this.geometries.clear();
                this.renderNodes.length = this.renderElements.length = 0;
            }
        }
    }
    GLESGeometryUpdateBatch.active = null;
    GLESGeometryUpdateBatch.pool = [];
    GLESGeometryUpdateBatch.diagnostics = { flushes: 0, uploads: 0, geometries: 0, uploadBytes: 0,
        renderNodeFlushes: 0, renderNodes: 0, renderElements: 0,
        cameraUpdateCompletions: 0, cameraUpdateNodes: 0 };

    class GLESIndexBuffer {
        destroy() {
            this._nativeObj.destroy();
        }
        _setIndexDataLength(data) {
            this._nativeObj._setIndexDataLength(data);
        }
        _setIndexData(data, bufferOffset) {
            this._nativeObj._setIndexData(data, bufferOffset);
        }
        get indexType() {
            return this._indexType;
        }
        set indexType(value) {
            this._indexType = value;
            this._nativeObj.rt_setIndexFormat(value);
        }
        get indexCount() {
            return this._nativeObj._indexCount;
        }
        set indexCount(value) {
            this._nativeObj._indexCount = value;
        }
        constructor(targetType, bufferUsageType) {
            this._indexType = Laya.IndexFormat.UInt16;
            this._bufferRef = null;
            this._nativeObj = new window.conchGLESIndexBuffer(targetType, bufferUsageType);
        }
        setData(buffer, bufferOffset, dataStartIndex, dataCount) {
            this._bufferRef = buffer;
            this._nativeObj.setData(buffer, bufferOffset, dataStartIndex, dataCount);
        }
    }

    class GLESShaderInstance {
        constructor() {
            this._attributeMapTemp = new Map();
        }
        _serializeShader() {
            throw new Laya.NotImplementedError();
        }
        _deserialize(buffer) {
            throw new Laya.NotImplementedError();
        }
        _create(shaderProcessInfo, shaderPass) {
            this._shaderPass = shaderPass;
            let useMaterial = Laya.Config.matUseUBO;
            Laya.Config.matUseUBO = (!shaderProcessInfo.is2D) && Laya.Config.matUseUBO;
            let shaderObj = Laya.GLSLCodeGenerator.GLShaderLanguageProcess3D(shaderProcessInfo.defineString, shaderProcessInfo.attributeMap, shaderProcessInfo.uniformMap, shaderProcessInfo.vs, shaderProcessInfo.ps);
            Laya.Config.matUseUBO = useMaterial;
            this._attributeMapTemp.clear();
            for (var k in shaderProcessInfo.attributeMap) {
                this._attributeMapTemp.set(k, shaderProcessInfo.attributeMap[k][0]);
            }
            this._nativeObj = new window.conchGLESShaderInstance(shaderProcessInfo.is2D, shaderObj.vs, shaderObj.fs, this._attributeMapTemp, shaderPass.moduleData._nativeObj);
        }
        _disposeResource() {
            this._nativeObj.destroy();
        }
    }

    class GLESRenderGeometryElement {
        constructor(mode, drawType) {
            this._indexFormatInitialized = false;
            this._nativeObj = new window.conchGLESRenderGeometryElement();
            const buf = new ArrayBuffer(4 * 4);
            this._props = new Uint32Array(buf);
            this._nativeObj.bindPropertyBuffer(buf);
            this.mode = mode;
            this.drawParams = new Laya.FastSinglelist();
            this.drawType = drawType;
        }
        getDrawDataParams(out) {
            out && this.drawParams.cloneTo(out);
        }
        setDrawArrayParams(first, count) {
            this.drawParams.add(first);
            this.drawParams.add(count);
            if (GLESGeometryUpdateBatch.active) {
                GLESGeometryUpdateBatch.active.geometry(this);
                return;
            }
            this._nativeObj.setDrawArrayParams(first, count);
        }
        setDrawElemenParams(count, offset) {
            this.drawParams.add(offset);
            this.drawParams.add(count);
            if (GLESGeometryUpdateBatch.active) {
                GLESGeometryUpdateBatch.active.geometry(this);
                return;
            }
            this._nativeObj.setDrawElementParams(count, offset);
        }
        destroy() {
            var _a;
            (_a = GLESGeometryUpdateBatch.active) === null || _a === void 0 ? void 0 : _a.flush();
            this._nativeObj.destroy();
        }
        clearRenderParams() {
            this.drawParams.length = 0;
            if (GLESGeometryUpdateBatch.active) {
                GLESGeometryUpdateBatch.active.geometry(this);
                return;
            }
            this._nativeObj.clearRenderParams();
        }
        set bufferState(value) {
            this._bufferState = value;
            this._nativeObj.setBufferState(value ? value._nativeObj : null);
        }
        get bufferState() {
            return this._bufferState;
        }
        set mode(value) {
            this._nativeObj.rt_setMode(value);
        }
        get mode() {
            return this._props[0];
        }
        set drawType(value) {
            this._nativeObj.rt_setDrawType(value);
        }
        get drawType() {
            return this._props[1];
        }
        set instanceCount(value) {
            if (GLESGeometryUpdateBatch.active) {
                this._props[2] = value;
                GLESGeometryUpdateBatch.active.geometry(this);
                return;
            }
            this._nativeObj.rt_setInstanceCount(value);
        }
        get instanceCount() {
            return this._props[2];
        }
        set indexFormat(value) {
            if (this._indexFormatInitialized && this._props[3] === value)
                return;
            this._nativeObj.rt_setIndexFormat(value);
            this._indexFormatInitialized = true;
        }
        get indexFormat() {
            return this._props[3];
        }
    }

    class GLESVertexBuffer {
        constructor(targetType, bufferUsageType) {
            this._attributeMapTemp = new Map();
            this._bufferRef = null;
            this._nativeObj = new window.conchGLESVertexBuffer(targetType, bufferUsageType);
        }
        get vertexDeclaration() {
            return this._vertexDeclaration;
        }
        set vertexDeclaration(value) {
            this._vertexDeclaration = value;
            this._shaderValues = this._vertexDeclaration._shaderValues;
            this._nativeObj.clearVertexDeclaration();
            for (var k in this._shaderValues) {
                this._nativeObj.setVertexDeclaration(parseInt(k), this._shaderValues[k]);
            }
        }
        get instanceBuffer() {
            return this._nativeObj._instanceBuffer;
        }
        set instanceBuffer(value) {
            this._nativeObj._instanceBuffer = value;
        }
        getStorageBuffer() {
            throw new Error("Method not implemented.");
        }
        setData(buffer, bufferOffset, dataStartIndex, dataCount) {
            this._bufferRef = buffer;
            if (GLESGeometryUpdateBatch.active) {
                GLESGeometryUpdateBatch.active.upload(this._nativeObj, buffer, bufferOffset, dataStartIndex, dataCount);
                return;
            }
            this._nativeObj.setData(buffer, bufferOffset, dataStartIndex, dataCount);
        }
        setDataLength(byteLength) {
            var _a;
            (_a = GLESGeometryUpdateBatch.active) === null || _a === void 0 ? void 0 : _a.flush();
            this._nativeObj.setDataLength(byteLength);
        }
        destroy() {
            var _a;
            (_a = GLESGeometryUpdateBatch.active) === null || _a === void 0 ? void 0 : _a.flush();
            this._nativeObj.destroy();
            this._bufferRef = null;
        }
    }

    class RTStatisContext extends Laya.DefaultStaticsContext {
        constructor() {
            super();
            this._nativeObj = new window.conchRTStatisContext();
            this._nativeObj.setStatShareBuffer(this._stateArrayMemory._buffer);
            this._nativeObj.setTimeShareBuffer(this._timeArrayMemory._buffer);
        }
        _createStatBuffer() {
            this._stateArrayMemory = new NativeMemory(Laya.StatElement.StatEnd * 4, false);
            this._statArray = this._stateArrayMemory.float32Array;
            this._timeArrayMemory = new NativeMemory(Laya.StatElement.StatEnd * 4, false);
            this._timeArray = this._timeArrayMemory.float32Array;
        }
    }

    const _defineStrings = [];
    function _getTextureType(uniformType) {
        switch (uniformType) {
            case Laya.ShaderDataType.Texture2D:
                return '2d';
            case Laya.ShaderDataType.Texture3D:
                return '3d';
            case Laya.ShaderDataType.TextureCube:
                return 'cube';
            case Laya.ShaderDataType.Texture2DArray:
                return '2d-array';
            default:
                return '2d';
        }
    }
    function getSamplerTextureType(dimension) {
        if (dimension == "2d") {
            return "sampler2D";
        }
        else if (dimension == "cube") {
            return "samplerCube";
        }
        else if (dimension == "2d-array") {
            return "sampler2DArray";
        }
        else if (dimension == "3d") {
            return "sampler3D";
        }
        else if (dimension == "cube-array") {
            return "samplerCubeArray";
        }
        else if (dimension == "1d") {
            return "sampler1D";
        }
        else {
            return "sampler2D";
        }
    }
    const ssboRegexCompat = /((?:layout\s*\([^)]*\)\s*)*)\s*((?:(?:readonly|writeonly|coherent|volatile|restrict)\s+)*)buffer\s+([A-Za-z_]\w*)\s*\{([\s\S]*?)\}\s*([A-Za-z_]\w*)?\s*;/g;
    function ssboStrings(ssboBindingMap, code) {
        code = code.replace(ssboRegexCompat, (match, layoutStr, readonlyStr, blockName, body, instanceName) => {
            let binding = instanceName ? ssboBindingMap.get(instanceName) : undefined;
            if (binding === undefined) {
                binding = ssboBindingMap.get(blockName);
            }
            if (binding !== undefined) {
                let newLayoutStr = `layout(std430, binding=${binding}) `;
                if (readonlyStr && readonlyStr.trim().startsWith("writeonly")) {
                    readonlyStr = " ";
                }
                return `${newLayoutStr}${readonlyStr}buffer ${blockName} {${body}} ${instanceName || ""};\n`;
            }
            else {
                return "";
            }
        });
        return code;
    }
    class GLESComputeShaderInstance {
        constructor(name) {
            this.compilete = false;
            this.uniformMap = new Map();
            this.name = name;
            this._nativeObj = new window.conchGLESComputeShaderInstance();
        }
        glslUniformString(uniformsMap, useUniformBlock, blockName, binding, ssboBindingMap) {
            if (uniformsMap.size == 0) {
                return { code: "", binding: binding };
            }
            if (useUniformBlock) {
                return { code: "", binding: binding };
            }
            else {
                let uniformsStr = "";
                let currentBinding = binding;
                uniformsMap.forEach((uniform, id) => {
                    if (uniform.uniformtype == Laya.ShaderDataType.DeviceBuffer) {
                        if (ssboBindingMap) {
                            ssboBindingMap.set(uniform.propertyName, currentBinding++);
                        }
                    }
                    else if (uniform.uniformtype == Laya.ShaderDataType.ReadOnlyDeviceBuffer) {
                        if (ssboBindingMap) {
                            ssboBindingMap.set(uniform.propertyName, currentBinding++);
                        }
                    }
                    else if (uniform.uniformtype == Laya.ShaderDataType.StorageTexture2D) {
                        let access = uniform.access;
                        uniformsStr = `${uniformsStr}layout(${uniform.format ? uniform.format : "rgba8"}, binding=${currentBinding++}) uniform ${access} image2D ${uniform.propertyName};\n`;
                    }
                    else if (uniform.uniformtype == Laya.ShaderDataType.Buffer) ;
                    else if (uniform.uniformtype >= Laya.ShaderDataType.Texture2D) {
                        const viewDimension = _getTextureType(uniform.uniformtype);
                        const textureType = getSamplerTextureType(viewDimension);
                        uniformsStr = `${uniformsStr}layout(binding=${currentBinding++}) uniform ${textureType} ${uniform.propertyName};\n`;
                    }
                    else {
                        let typeStr = Laya.GLSLCodeGenerator.getAttributeType(uniform.uniformtype);
                        if (typeStr != "") {
                            uniformsStr += `layout(binding=${currentBinding++}) uniform ${typeStr} ${uniform.propertyName};\n`;
                        }
                    }
                });
                return { code: uniformsStr, binding: currentBinding };
            }
        }
        proccessComputeShader(defineString, uniformMaps, CS) {
            var computeHead;
            var defMap = {};
            var defineStr = "";
            let useUniformBlock = false;
            let materialUniformGlsl = "";
            let binding = 0;
            const ssboBindingMap = new Map();
            for (const uniformMap of uniformMaps) {
                let result = this.glslUniformString(uniformMap._idata, useUniformBlock, uniformMap._stateName, binding, ssboBindingMap);
                materialUniformGlsl += result.code;
                binding = result.binding;
                materialUniformGlsl += "\n";
            }
            if (defineString.indexOf("GRAPHICS_API_GLES3") === -1) {
                defineString.push("GRAPHICS_API_GLES3");
            }
            computeHead =
                `#version 310 es
             #if defined(GL_FRAGMENT_PRECISION_HIGH)
                precision highp float;
                precision highp int;
                precision highp sampler2DArray;
                precision highp sampler3D;
                precision highp image2D;
            #else
                precision mediump float;
                precision mediump int;
                precision mediump sampler2DArray;
                precision mediump sampler3D;
                precision mediump image2D;
            #endif
            layout(std140, column_major) uniform;
            layout(std430, column_major) buffer;
            ${materialUniformGlsl}
        `;
            for (var i = 0, n = defineString.length; i < n; i++) {
                var def = defineString[i];
                defineStr += "#define " + def + "\n";
                defMap[def] = true;
            }
            var vs = CS.toscript(defMap, []);
            var vsVersion = '';
            if (vs[0].indexOf('#version') == 0) {
                vsVersion = vs[0] + '\n';
                vs.shift();
            }
            let computeCode = vs.join('\n');
            let dstCS = vsVersion + computeHead + defineStr + computeCode;
            debugger;
            let preprocessRes = this._nativeObj.preprocess(dstCS, 'compute');
            if (!preprocessRes.success) {
                console.error(`GLESComputeShaderInstance ${this.name} preprocess error:`, preprocessRes.info_log);
                return {};
            }
            if (preprocessRes.ssbos && preprocessRes.ssbos.length > 0) {
                const exists = new Map();
                for (const uniformMap of uniformMaps) {
                    uniformMap._idata.forEach((uniform, id) => {
                        exists.set(id, uniform);
                    });
                }
                if (uniformMaps.length === 0) {
                    console.error(`GLESComputeShaderInstance ${this.name} uniformMaps is empty`);
                    return {};
                }
                let additionMaps = uniformMaps[0];
                let addNewSSBO = false;
                let ssboNames = preprocessRes.ssbos.keys();
                for (let name of ssboNames) {
                    let propertyId = Laya.Shader3D.propertyNameToID(name);
                    if (!exists.has(propertyId)) {
                        let shaderType = Laya.ShaderDataType.DeviceBuffer;
                        const access = preprocessRes.ssbos.get(name);
                        if (access == "readonly") {
                            shaderType = Laya.ShaderDataType.ReadOnlyDeviceBuffer;
                        }
                        additionMaps.addShaderUniform(propertyId, name, shaderType, { access });
                        addNewSSBO = true;
                    }
                    else {
                        let uniform = exists.get(propertyId);
                        const access = preprocessRes.ssbos.get(name);
                        if (uniform.uniformtype == Laya.ShaderDataType.DeviceBuffer) {
                            if (access == "readonly") {
                                console.warn(`Shader ${this.name} ssbo access type mismatch for ${name}`);
                            }
                        }
                        else if (uniform.uniformtype == Laya.ShaderDataType.ReadOnlyDeviceBuffer) {
                            if (access != "readonly") {
                                console.warn(`Shader ${this.name} ssbo access type mismatch for ${name}`);
                            }
                        }
                    }
                }
                if (addNewSSBO) {
                    materialUniformGlsl = "";
                    binding = 0;
                    ssboBindingMap.clear();
                    for (const uniformMap of uniformMaps) {
                        let result = this.glslUniformString(uniformMap._idata, useUniformBlock, uniformMap._stateName, binding, ssboBindingMap);
                        materialUniformGlsl += result.code;
                        binding = result.binding;
                        materialUniformGlsl += "\n";
                    }
                    computeHead =
                        `#version 310 es
                     #if defined(GL_FRAGMENT_PRECISION_HIGH)
                        precision highp float;
                        precision highp int;
                        precision highp sampler2DArray;
                        precision highp sampler3D;
                        precision highp image2D;
                    #else
                        precision mediump float;
                        precision mediump int;
                        precision mediump sampler2DArray;
                        precision mediump sampler3D;
                        precision mediump image2D;
                    #endif
                    layout(std140, column_major) uniform;
                    layout(std430, column_major) buffer;
                    ${materialUniformGlsl}
                `;
                    dstCS = vsVersion + computeHead + defineStr + computeCode;
                }
            }
            computeCode = ssboStrings(ssboBindingMap, computeCode);
            dstCS = vsVersion + computeHead + defineStr + computeCode;
            return dstCS;
        }
        compile(info) {
            let compileDefine = info.defineData;
            _defineStrings.length = 0;
            Laya.Shader3D._getNamesByDefineData(compileDefine, _defineStrings);
            const code = this.proccessComputeShader(_defineStrings, info.uniformMaps, info.node);
            let uniformMaps = [];
            for (const uniformMap of info.uniformMaps) {
                uniformMaps.push(uniformMap._nativeObj);
            }
            const success = this._nativeObj.compile(code, uniformMaps);
            if (success) {
                this.compilete = true;
            }
            else {
                throw new Error(`Failed to compile compute shader: ${this.name}`);
            }
        }
        _disposeResource() {
            this._nativeObj.destroy();
        }
    }

    class GLESDeviceBuffer {
        constructor(usage) {
            this._size = 0;
            this._cacheShaderData = new Map();
            this._destroyed = false;
            this._usage = usage;
            this._nativeObj = new window.conchGLESDeviceBuffer(this._convertUsage(usage));
        }
        _convertUsage(usage) {
            let glUsage = 0;
            if (usage & Laya.EDeviceBufferUsage.MAP_READ) {
                glUsage |= 1;
            }
            if (usage & Laya.EDeviceBufferUsage.MAP_WRITE) {
                glUsage |= 2;
            }
            if (usage & Laya.EDeviceBufferUsage.COPY_SRC) {
                glUsage |= 4;
            }
            if (usage & Laya.EDeviceBufferUsage.COPY_DST) {
                glUsage |= 8;
            }
            if (usage & Laya.EDeviceBufferUsage.STORAGE) {
                glUsage |= 16;
            }
            if (usage & Laya.EDeviceBufferUsage.INDIRECT) {
                glUsage |= 32;
            }
            return glUsage;
        }
        getNativeBuffer() {
            return this._nativeObj;
        }
        setData(buffer, bufferOffset, dataStartIndex, dataCount) {
            this._nativeObj.setData(buffer, bufferOffset, dataStartIndex, dataCount);
        }
        setDataLength(byteLength) {
            if (byteLength !== this._size) {
                this._size = byteLength;
                this._nativeObj.setDataLength(byteLength);
            }
        }
        copyToBuffer(buffer, sourceOffset, destOffset, byteLength) {
            if (buffer instanceof GLESVertexBuffer) {
                buffer = buffer;
                this._nativeObj.copyToVertexBuffer(buffer._nativeObj, sourceOffset, destOffset, byteLength);
            }
            else if (buffer instanceof GLESDeviceBuffer) {
                buffer = buffer;
                this._nativeObj.copyToDeviceBuffer(buffer._nativeObj, sourceOffset, destOffset, byteLength);
            }
            else {
                throw new Error("GLESDeviceBuffer.copyToBuffer() invalid buffer type");
            }
        }
        copyToTexture() {
            console.warn("GLESDeviceBuffer.copyToTexture() is not implemented yet");
        }
        readData(dest, destOffset, srcOffset, byteLength) {
            return new Promise((resolve, reject) => {
                const result = this._nativeObj.readData(dest, destOffset, srcOffset, byteLength);
                if (result) {
                    resolve();
                }
                else {
                    reject(new Error("GLESDeviceBuffer.readData failed: native readData returned false."));
                }
            });
        }
        destroy() {
            var _a;
            if (!this._destroyed) {
                if (this._nativeObj) {
                    this._nativeObj.destroy();
                }
                (_a = this._cacheShaderData) === null || _a === void 0 ? void 0 : _a.clear();
                this._cacheShaderData = null;
                this._destroyed = true;
            }
        }
        get destroyed() {
            return this._destroyed;
        }
        get size() {
            return this._size;
        }
        get usage() {
            return this._usage;
        }
    }

    var CommandType;
    (function (CommandType) {
        CommandType[CommandType["Dispatch"] = 0] = "Dispatch";
        CommandType[CommandType["SetShaderData"] = 1] = "SetShaderData";
        CommandType[CommandType["ClearBuffer"] = 2] = "ClearBuffer";
        CommandType[CommandType["BufferToBuffer"] = 3] = "BufferToBuffer";
        CommandType[CommandType["BufferToTexture"] = 4] = "BufferToTexture";
        CommandType[CommandType["TextureToBuffer"] = 5] = "TextureToBuffer";
        CommandType[CommandType["TextureToTexture"] = 6] = "TextureToTexture";
    })(CommandType || (CommandType = {}));
    class IDispatchCommand {
        set shader(value) {
            this._shader = value;
            this._nativeObj.setShader(value._nativeObj);
        }
        set shaderData(value) {
            this._shaderData = value;
            let shaderData = this._shaderData.map(item => item._nativeObj);
            this._nativeObj.setShaderData(shaderData);
        }
        set dispatchParams(value) {
            this._nativeObj.rt_setDispatchParams(value.x, value.y, value.z);
        }
        constructor() {
            this._nativeObj = new window.conchGLESComputeDispatchCommand();
        }
    }
    class ISetShaderDataCommand {
        set shaderData(value) {
            this._shaderData = value;
            this._nativeObj.setShaderData(value._nativeObj);
        }
        set propertyID(value) {
            this._nativeObj.setPropertyID(value);
        }
        set shaderDataType(value) {
            this._shaderDataType = value;
            this._nativeObj.rt_setShaderDataType(value);
        }
        set value(value) {
            this._shaderDataItem = value;
            const obj = this._nativeObj;
            switch (this._shaderDataType) {
                case Laya.ShaderDataType.Int:
                    obj.rt_setItemInt(value);
                    break;
                case Laya.ShaderDataType.Float:
                    obj.rt_setItemFloat(value);
                    break;
                case Laya.ShaderDataType.Bool:
                    obj.rt_setItemBool(!!value);
                    break;
                case Laya.ShaderDataType.Vector2: {
                    const v = value;
                    obj.rt_setItemVec2(v.x, v.y);
                    break;
                }
                case Laya.ShaderDataType.Vector3: {
                    const v = value;
                    obj.rt_setItemVec3(v.x, v.y, v.z);
                    break;
                }
                case Laya.ShaderDataType.Vector4: {
                    const v = value;
                    obj.rt_setItemVec4(v.x, v.y, v.z, v.w);
                    break;
                }
                default:
                    obj.setShaderDataItem(value);
                    break;
            }
        }
        constructor() {
            this._nativeObj = new window.conchGLESComputeSetShaderDataCommand();
        }
    }
    class IBufferToBufferCommand {
        set src(value) {
            this._src = value;
            this._nativeObj.setSrc(value._nativeObj);
        }
        set dest(value) {
            this._dest = value;
            this._nativeObj.setDest(value._nativeObj);
        }
        set sourceOffset(value) {
            this._nativeObj.setSourceOffset(value);
        }
        set destinationOffset(value) {
            this._nativeObj.setDestinationOffset(value);
        }
        set size(value) {
            this._nativeObj.setSize(value);
        }
        constructor() {
            this._nativeObj = new window.conchGLESComputeBufferToBufferCommand();
        }
    }
    class IBufferClearCommand {
        set dest(value) {
            this._dest = value;
            this._nativeObj.setDest(value._nativeObj);
        }
        set destinationOffset(value) {
            this._nativeObj.setDestinationOffset(value);
        }
        set size(value) {
            this._nativeObj.setSize(value);
        }
        constructor() {
            this._nativeObj = new window.conchGLESComputeClearBufferCommand();
        }
    }
    class ITextureToTextureCommand {
        set srcTextureInfo(value) {
            this._nativeObj.setSrcTextureInfo(value);
        }
        set destTextureInfo(value) {
            this._nativeObj.setDestTextureInfo(value);
        }
        set copySize(value) {
            this._nativeObj.setCopySize(value);
        }
        constructor() {
            this._nativeObj = new window.conchGLESComputeTextureToTextureCommand();
        }
    }
    class GLESComputeContext {
        constructor() {
            this.commands = [];
            this._nativeObj = new window.conchGLESComputeContext();
        }
        clearCMDs() {
            this.commands = [];
            this._nativeObj.clearCMDs();
        }
        addDispatchCommand(cmd) {
            let cmdInfo = new IDispatchCommand();
            cmdInfo.shader = cmd.shader;
            cmdInfo.shaderData = cmd.shaderData;
            cmdInfo.dispatchParams = cmd.dispatchParams;
            this.commands.push(cmdInfo);
            this._nativeObj.addCMD(cmdInfo._nativeObj);
        }
        addDispatchIndirectCommand(cmd) {
        }
        addSetShaderDataCommand(shaderData, propertyID, shaderDataType, value) {
            let cmdInfo = new ISetShaderDataCommand();
            cmdInfo.shaderData = shaderData;
            cmdInfo.propertyID = propertyID;
            cmdInfo.shaderDataType = shaderDataType;
            cmdInfo.value = value;
            this.commands.push(cmdInfo);
            this._nativeObj.addCMD(cmdInfo._nativeObj);
        }
        addBufferToBufferCommand(src, dest, sourceOffset = 0, destinationOffset = 0, size) {
            let cmdInfo = new IBufferToBufferCommand();
            cmdInfo.src = src;
            cmdInfo.dest = dest;
            cmdInfo.sourceOffset = sourceOffset;
            cmdInfo.destinationOffset = destinationOffset;
            cmdInfo.size = size || 0;
            this.commands.push(cmdInfo);
            this._nativeObj.addCMD(cmdInfo._nativeObj);
        }
        addBufferToTextureCommand(src, srcTextureInfo, destTextureInfo, copySize) {
        }
        addTextureToBufferCommand(srcTextureInfo, dest, destTextureInfo, copySize) {
        }
        addTextureToTextureCommand(srcTextureInfo, destTextureInfo, copySize) {
            let cmdInfo = new ITextureToTextureCommand();
            cmdInfo.srcTextureInfo = srcTextureInfo;
            cmdInfo.destTextureInfo = destTextureInfo;
            cmdInfo.copySize = copySize;
            this.commands.push(cmdInfo);
            this._nativeObj.addCMD(cmdInfo._nativeObj);
        }
        addClearBufferCommand(dest, destOffset, destCount) {
            let cmdInfo = new IBufferClearCommand();
            cmdInfo.dest = dest;
            cmdInfo.destinationOffset = destOffset;
            cmdInfo.size = destCount;
            this.commands.push(cmdInfo);
            this._nativeObj.addCMD(cmdInfo._nativeObj);
        }
        executeCMDs() {
            this._nativeObj.executeCMDs();
        }
        destroy() {
            this.clearCMDs();
            if (this._nativeObj) {
                this._nativeObj.destroy();
            }
        }
    }

    class GLESRenderDeviceFactory {
        constructor() {
            this.globalBlockMap = {};
        }
        beginGeometryUpdateBatch() { return GLESGeometryUpdateBatch.begin(); }
        getGeometryUpdateBatchDiagnostics() { return Object.assign({}, GLESGeometryUpdateBatch.diagnostics); }
        completeCameraRenderUpdateBatch(nodes, cameraMask) {
            return GLESGeometryUpdateBatch.completeCameraRenderUpdateBatch(nodes, cameraMask);
        }
        createShaderData(ownerResource) {
            return new GLESShaderData(ownerResource);
        }
        createGlobalUniformMap(blockName) {
            let comMap = this.globalBlockMap[blockName];
            if (!comMap)
                comMap = this.globalBlockMap[blockName] = new GLESCommandUniformMap(blockName);
            return comMap;
        }
        createShaderInstance(shaderProcessInfo, shaderPass) {
            let shaderIns = new GLESShaderInstance();
            shaderIns._create(shaderProcessInfo, shaderPass);
            if (Laya.Shader3D.debugMode) {
                let defineString = shaderProcessInfo.defineString;
                let is2D = shaderProcessInfo.is2D;
                Laya.ShaderVariantCollection.active.add(shaderPass, defineString, is2D);
            }
            return shaderIns;
        }
        createIndexBuffer(bufferUsage) {
            return new GLESIndexBuffer(Laya.BufferTargetType.ELEMENT_ARRAY_BUFFER, bufferUsage);
        }
        createVertexBuffer(bufferUsageType) {
            return new GLESVertexBuffer(Laya.BufferTargetType.ARRAY_BUFFER, bufferUsageType);
        }
        createBufferState() {
            return new GLESBufferState();
        }
        createRenderGeometryElement(mode, drawType) {
            return new GLESRenderGeometryElement(mode, drawType);
        }
        createComputeContext() {
            return new GLESComputeContext();
        }
        createComputeShader(info) {
            let shader = new GLESComputeShaderInstance(info.name);
            shader.compile(info);
            return shader;
        }
        createDeviceBuffer(type) {
            return new GLESDeviceBuffer(type);
        }
        createEngine(config, canvas) {
            let engine;
            let glConfig = { stencil: Laya.Config.isStencil, alpha: Laya.Config.isAlpha, antialias: Laya.Config.isAntialias, premultipliedAlpha: Laya.Config.premultipliedAlpha, preserveDrawingBuffer: Laya.Config.preserveDrawingBuffer, depth: Laya.Config.isDepth, failIfMajorPerformanceCaveat: Laya.Config.isfailIfMajorPerformanceCaveat, powerPreference: Laya.Config.powerPreference };
            const webglMode = Laya.Config.useWebGL2 ? exports.GLESMode.Auto : exports.GLESMode.WebGL1;
            engine = new GLESEngine(glConfig, webglMode);
            engine.initRenderEngine(canvas.source);
            new Laya.LayaGL();
            Laya.LayaGL.renderEngine = engine;
            Laya.LayaGL.textureContext = engine.getTextureContext();
            Laya.Laya.addAfterInitCallback(this.afterInit);
            return Promise.resolve();
        }
        afterInit() {
            GLESRenderDeviceFactory._setVertexDec(Laya.VertexMesh.instanceWorldMatrixDeclaration, "instanceWorldMatrixDeclaration");
            GLESRenderDeviceFactory._setVertexDec(Laya.VertexMesh.instanceLightMapScaleOffsetDeclaration, "instanceLightMapScaleOffsetDeclaration");
            GLESRenderDeviceFactory._setVertexDec(Laya.VertexMesh.instanceSimpleAnimatorDeclaration, "instanceSimpleAnimatorDeclaration");
        }
        static _setVertexDec(value, regName) {
            let shaderValues = value._shaderValues;
            for (var k in shaderValues) {
                Laya.LayaGL.renderEngine._nativeObj.regGlobalVertexDeclaration(regName, parseInt(k), shaderValues[k]);
            }
        }
    }
    Laya.Laya.addBeforeInitCallback(() => {
        var _a;
        if (!Laya.LayaGL.renderDeviceFactory) {
            Laya.LayaGL.renderDeviceFactory = new GLESRenderDeviceFactory();
            let statisticsContext = new RTStatisContext();
            (_a = Laya.LayaGL.statAgent) === null || _a === void 0 ? void 0 : _a.cloneTo(statisticsContext);
            Laya.LayaGL.statAgent = statisticsContext;
        }
    });

    class RTSubShader {
        constructor() {
            this._pendingUniformMap = null;
            this._uniformPropertyIds = new Set();
            this._nativeObj = new window.conchRTSubShader();
        }
        get shaderName() {
            return this._shaderName;
        }
        set shaderName(value) {
            this._shaderName = value;
            this._nativeObj.shaderName = value;
        }
        setUniformMap(_uniformMap) {
            this._pendingUniformMap = _uniformMap;
            this._syncUniformProperties(_uniformMap);
        }
        _syncUniformProperties(uniformMap) {
            uniformMap.forEach((value) => {
                if (this._uniformPropertyIds.has(value.id)) {
                    return;
                }
                this._uniformPropertyIds.add(value.id);
                this._nativeObj.addUnifromProperty(value.id, value.propertyName, value.uniformtype, value.arrayLength);
            });
        }
        get enableInstance() {
            return this._nativeObj.enableInstance;
        }
        set enableInstance(value) {
            this._nativeObj.enableInstance = value;
        }
        destroy() {
            this._nativeObj.destroy();
        }
        addShaderPass(pass) {
            if (this._pendingUniformMap) {
                this._syncUniformProperties(this._pendingUniformMap);
            }
            this._nativeObj.addShaderPass(pass._nativeObj);
        }
    }

    class RTUintRenderModuleDataFactory {
        createSubShader() {
            return new RTSubShader();
        }
        createShaderPass(pass) {
            return new RTShaderPass(pass);
        }
        createRenderState() {
            return new RTRenderState();
        }
        createDefineDatas() {
            return new RTDefineDatas();
        }
    }
    Laya.Laya.addBeforeInitCallback(() => {
        if (!Laya.LayaGL.unitRenderModuleDataFactory)
            Laya.LayaGL.unitRenderModuleDataFactory = new RTUintRenderModuleDataFactory();
    });

    exports.CommonMemoryAllocater = CommonMemoryAllocater;
    exports.GLESBlit2DQuadCMD = GLESBlit2DQuadCMD;
    exports.GLESBufferState = GLESBufferState;
    exports.GLESCommandUniformMap = GLESCommandUniformMap;
    exports.GLESComputeContext = GLESComputeContext;
    exports.GLESComputeShaderInstance = GLESComputeShaderInstance;
    exports.GLESDeviceBuffer = GLESDeviceBuffer;
    exports.GLESDraw2DElementCMD = GLESDraw2DElementCMD;
    exports.GLESEngine = GLESEngine;
    exports.GLESGeometryUpdateBatch = GLESGeometryUpdateBatch;
    exports.GLESGraphicsOp2DFactory = GLESGraphicsOp2DFactory;
    exports.GLESIndexBuffer = GLESIndexBuffer;
    exports.GLESInternalRT = GLESInternalRT;
    exports.GLESInternalTex = GLESInternalTex;
    exports.GLESMeshRenderBatchAgent = GLESMeshRenderBatchAgent;
    exports.GLESPrimitiveRenderElement2D = GLESPrimitiveRenderElement2D;
    exports.GLESRender2DProcess = GLESRender2DProcess;
    exports.GLESRenderContext2D = GLESRenderContext2D;
    exports.GLESRenderDeviceFactory = GLESRenderDeviceFactory;
    exports.GLESRenderElement2D = GLESRenderElement2D;
    exports.GLESRenderGeometryElement = GLESRenderGeometryElement;
    exports.GLESSetRenderData = GLESSetRenderData;
    exports.GLESSetRendertarget2DCMD = GLESSetRendertarget2DCMD;
    exports.GLESSetShaderDefine = GLESSetShaderDefine;
    exports.GLESShaderData = GLESShaderData;
    exports.GLESShaderInstance = GLESShaderInstance;
    exports.GLESTextureContext = GLESTextureContext;
    exports.GLESVertexBuffer = GLESVertexBuffer;
    exports.GraphicsMSDFMeshPayloadWordCount = GraphicsMSDFMeshPayloadWordCount;
    exports.GraphicsMeshPayloadWordCount = GraphicsMeshPayloadWordCount;
    exports.GraphicsQuadPayloadWordCount = GraphicsQuadPayloadWordCount;
    exports.NativeMemory = NativeMemory;
    exports.RTBaseRenderDataHandle = RTBaseRenderDataHandle;
    exports.RTDefineDatas = RTDefineDatas;
    exports.RTEmptyRender2DDataHandle = RTEmptyRender2DDataHandle;
    exports.RTGlobalRenderData = RTGlobalRenderData;
    exports.RTGraphicsCommandStreamDataHandle = RTGraphicsCommandStreamDataHandle;
    exports.RTGraphicsFillTextureOp2D = RTGraphicsFillTextureOp2D;
    exports.RTGraphicsMSDFMeshOp2D = RTGraphicsMSDFMeshOp2D;
    exports.RTGraphicsMeshOp2D = RTGraphicsMeshOp2D;
    exports.RTGraphicsMultiQuadOp2D = RTGraphicsMultiQuadOp2D;
    exports.RTGraphicsOp2D = RTGraphicsOp2D;
    exports.RTGraphicsSingleQuadDataHandle = RTGraphicsSingleQuadDataHandle;
    exports.RTGraphicsSolidQuadOp2D = RTGraphicsSolidQuadOp2D;
    exports.RTGraphicsTextOp2D = RTGraphicsTextOp2D;
    exports.RTGraphicsTextureQuadOp2D = RTGraphicsTextureQuadOp2D;
    exports.RTMesh2DRenderDataHandle = RTMesh2DRenderDataHandle;
    exports.RTRender2DDataHandle = RTRender2DDataHandle;
    exports.RTRender2DPass = RTRender2DPass;
    exports.RTRender2DPassManager = RTRender2DPassManager;
    exports.RTRenderState = RTRenderState;
    exports.RTRenderStruct2D = RTRenderStruct2D;
    exports.RTShaderDefine = RTShaderDefine;
    exports.RTShaderPass = RTShaderPass;
    exports.RTStatisContext = RTStatisContext;
    exports.RTSubShader = RTSubShader;
    exports.RTSubStructRenderDataHandle = RTSubStructRenderDataHandle;
    exports.RTTransform2DMemoryFactory = RTTransform2DMemoryFactory;
    exports.RTTransform2DSweep = RTTransform2DSweep;
    exports.RTUintRenderModuleDataFactory = RTUintRenderModuleDataFactory;
    exports.assertMSDFPackedParamsB = assertMSDFPackedParamsB;
    exports.unpackMSDFParameter = unpackMSDFParameter;
    exports.writeFillTexturePayloadValues = writeFillTexturePayloadValues;
    exports.writeMeshPayloadValues = writeMeshPayloadValues;
    exports.writeOpInfoBuffer = writeOpInfoBuffer;
    exports.writeQuadPayloadValues = writeQuadPayloadValues;

})(window.Laya = window.Laya || {}, Laya);
//# sourceMappingURL=laya.opengl_2D.js.map
