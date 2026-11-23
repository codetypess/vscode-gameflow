(function (exports, Laya) {
    'use strict';

    class LayaXSetRendertarget2DCMD extends Laya.SetRendertarget2DCMD {
        constructor() {
            super();
            this._nativeObj = new window.conchLayaXSetRendertarget2DCMD();
            this.type = Laya.RenderCMDType.ChangeRenderTarget;
            this._clearColorValue = new Laya.Color();
        }
        get rt() { return this._rt; }
        set rt(value) {
            this._rt = value;
            this._nativeObj.setRT(value ? value._nativeObj : null, this.size.x, this.size.y);
        }
        get clearColor() { return this._clearColor; }
        set clearColor(value) {
            this._clearColor = value;
            this._nativeObj.setClearColor(value);
        }
        get clearColorValue() { return this._clearColorValue; }
        set clearColorValue(value) {
            value.cloneTo(this._clearColorValue);
            this._nativeObj.clearColorValue(value.r, value.g, value.b, value.a);
        }
        get invertY() { return this._invertY; }
        set invertY(value) {
            this._invertY = value;
            this._nativeObj.setinvertY(value);
        }
        get viewportX() { return this._viewportX; }
        set viewportX(value) {
            this._viewportX = value;
            this._nativeObj.setViewportX(value);
        }
        get viewportY() { return this._viewportY; }
        set viewportY(value) {
            this._viewportY = value;
            this._nativeObj.setViewportY(value);
        }
        apply(_context) {
        }
    }
    class LayaXDraw2DElementCMD extends Laya.Draw2DElementCMD {
        constructor() {
            super();
            this.type = Laya.RenderCMDType.DrawElement;
            this._nativeObj = new window.conchLayaXDraw2DElementCMD();
        }
        setRenderelements(value) {
            this._nativeObj.clearElement();
            for (let i = 0, n = value.length; i < n; i++) {
                this._nativeObj.addOneElement(value[i]._nativeObj);
            }
        }
        apply(_context) {
        }
    }
    class LayaXBlit2DQuadCMD extends Laya.Blit2DQuadCMD {
        constructor() {
            super();
            this._nativeObj = new window.conchLayaXBlit2DQuadCMD();
            this.type = Laya.RenderCMDType.Blit;
            this._offsetScale = new Laya.Vector4();
        }
        get element() { return this._element; }
        set element(value) {
            this._element = value;
            this._nativeObj.setRenderElement(value ? value._nativeObj : null);
        }
        get dest() { return this._dest; }
        set dest(value) {
            this._dest = value;
            this._nativeObj.setDest(value ? value._nativeObj : null);
        }
        get source() { return this._source; }
        set source(value) {
            this._source = value;
            this._nativeObj.setSource(value ? value._nativeObj : null);
        }
        get offsetScale() { return this._offsetScale; }
        set offsetScale(value) {
            value.cloneTo(this._offsetScale);
            const o = this._offsetScale;
            this._nativeObj.setOffsetScale(o.x, o.y, o.z, o.w);
        }
        apply(_context) {
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

    class LayaXGraphicsOp2DFactory {
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

    class LayaXRenderElement2D {
        init() {
            this._nativeObj = new window.conchLayaXRenderElement2D();
        }
        constructor() {
            this._elem2dBuf = new ArrayBuffer(4 * 4);
            this._elem2dI32 = new Int32Array(this._elem2dBuf);
            this._renderStateIsBySprite = true;
            this.init();
            this._nativeObj.bindElem2DBuffer(this._elem2dBuf);
        }
        _onRenderStateChanged() {
            var _a, _b;
            if (!this._nativeObj || !this._subShader)
                return;
            this._registerRS();
            (_b = (_a = this._nativeObj).syncRenderState) === null || _b === void 0 ? void 0 : _b.call(_a);
        }
        _pickMaterialSD() {
            var _a;
            return (_a = this._materialShaderData) !== null && _a !== void 0 ? _a : null;
        }
        _registerRS() {
            var _a, _b, _c, _d;
            const sd = this._pickMaterialSD();
            if (!sd)
                return;
            const pass = (_b = (_a = this._subShader._passes) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : null;
            const rs = (_c = pass === null || pass === void 0 ? void 0 : pass.renderState) !== null && _c !== void 0 ? _c : null;
            const statefirst = (_d = pass === null || pass === void 0 ? void 0 : pass.statefirst) !== null && _d !== void 0 ? _d : false;
            const D = Laya.RenderState.Default;
            const p = (passVal, sdKey, def) => {
                if (statefirst && passVal != null)
                    return passVal;
                const v = sd.getInt(sdKey);
                return (v != null && v !== undefined) ? v : def;
            };
            this._nativeObj.registerMaterialRenderState(p(rs === null || rs === void 0 ? void 0 : rs.blend, Laya.Shader3D.BLEND, D.blend), p(rs === null || rs === void 0 ? void 0 : rs.srcBlend, Laya.Shader3D.BLEND_SRC, D.srcBlend), p(rs === null || rs === void 0 ? void 0 : rs.dstBlend, Laya.Shader3D.BLEND_DST, D.dstBlend), p(rs === null || rs === void 0 ? void 0 : rs.blendEquation, Laya.Shader3D.BLEND_EQUATION, D.blendEquation), p(rs === null || rs === void 0 ? void 0 : rs.srcBlendRGB, Laya.Shader3D.BLEND_SRC_RGB, D.srcBlendRGB), p(rs === null || rs === void 0 ? void 0 : rs.dstBlendRGB, Laya.Shader3D.BLEND_DST_RGB, D.dstBlendRGB), p(rs === null || rs === void 0 ? void 0 : rs.srcBlendAlpha, Laya.Shader3D.BLEND_SRC_ALPHA, D.srcBlendAlpha), p(rs === null || rs === void 0 ? void 0 : rs.dstBlendAlpha, Laya.Shader3D.BLEND_DST_ALPHA, D.dstBlendAlpha), p(rs === null || rs === void 0 ? void 0 : rs.blendEquationRGB, Laya.Shader3D.BLEND_EQUATION_RGB, D.blendEquationRGB), p(rs === null || rs === void 0 ? void 0 : rs.blendEquationAlpha, Laya.Shader3D.BLEND_EQUATION_ALPHA, D.blendEquationAlpha));
        }
        set type(v) { this._elem2dI32[0] = v; }
        get type() { return this._elem2dI32[0]; }
        set geometry(d) {
            this._geometry = d;
            this._nativeObj.setGeometry(d ? d._nativeObj : null);
        }
        get geometry() { return this._geometry; }
        set materialShaderData(d) {
            if (this._materialShaderData)
                this._materialShaderData._removeRenderStateListener(this);
            this._materialShaderData = d;
            this._nativeObj.setMaterialShaderData(d ? d._nativeObj : null);
            if (this._materialShaderData) {
                this._materialShaderData._addRenderStateListener(this);
                this._onRenderStateChanged();
            }
        }
        get materialShaderData() { return this._materialShaderData; }
        set value2DShaderData(d) {
            if (this._value2DShaderData)
                this._value2DShaderData._removeRenderStateListener(this);
            this._value2DShaderData = d;
            this._nativeObj.setValue2DShaderData(d ? d._nativeObj : null);
            if (this._value2DShaderData) {
                this._value2DShaderData._addRenderStateListener(this);
            }
        }
        get value2DShaderData() { return this._value2DShaderData; }
        set globalShaderData(d) {
            this._globalShaderData = d;
            this._nativeObj.setGlobalShaderData(d ? d._nativeObj : null);
        }
        get globalShaderData() { return this._globalShaderData; }
        get subShader() { return this._subShader; }
        set subShader(v) {
            this._subShader = v;
            if (v)
                this._nativeObj.setSubShader(v.moduleData._nativeObj);
            this._onRenderStateChanged();
        }
        get owner() { return this._owner; }
        set owner(v) {
            this._owner = v;
            this._nativeObj.setOwner(v ? v._nativeObj : null);
        }
        get nodeCommonMap() { return this._nodeCommonMap; }
        set nodeCommonMap(v) {
            this._nodeCommonMap = v;
            this._nativeObj.setCommonUniformMap(v);
        }
        get renderStateIsBySprite() { return this._renderStateIsBySprite; }
        set renderStateIsBySprite(v) {
            if (this._renderStateIsBySprite === v)
                return;
            this._renderStateIsBySprite = v;
            this._nativeObj.renderStateIsBySprite = v;
        }
        get noBatch() { return this._elem2dI32[3] !== 0; }
        set noBatch(v) {
            this._elem2dI32[3] = v ? 1 : 0;
        }
        destroy() {
            if (this._materialShaderData)
                this._materialShaderData._removeRenderStateListener(this);
            if (this._value2DShaderData)
                this._value2DShaderData._removeRenderStateListener(this);
            this._nativeObj.destroy();
        }
    }

    class LayaXPrimitiveRenderElement2D extends LayaXRenderElement2D {
        init() {
            this._nativeObj = new window.conchLayaXPrimitiveRenderElement2D();
        }
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
        _pickMaterialSD() {
            var _a, _b;
            return (_b = (_a = this._materialShaderData) !== null && _a !== void 0 ? _a : this._primitiveShaderData) !== null && _b !== void 0 ? _b : null;
        }
        get primitiveShaderData() { return this._primitiveShaderData; }
        set primitiveShaderData(data) {
            if (this._primitiveShaderData)
                this._primitiveShaderData._removeRenderStateListener(this);
            this._primitiveShaderData = data;
            this._nativeObj.setPrimitiveShaderData(data ? data._nativeObj : null);
            if (this._primitiveShaderData) {
                this._primitiveShaderData._addRenderStateListener(this);
                this._onRenderStateChanged();
            }
        }
        destroy() {
            if (this._primitiveShaderData)
                this._primitiveShaderData._removeRenderStateListener(this);
            super.destroy();
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

    class LayaXRenderContext2D {
        constructor() {
            this._ctx2dBuf = new ArrayBuffer(5 * 4);
            this._ctx2dU32 = new Uint32Array(this._ctx2dBuf);
            this._ctx2dI32 = new Int32Array(this._ctx2dBuf);
            this._pipelineMode = "Forward";
            this._nativeObj = new window.conchLayaXRenderContext2D();
            this._nativeObj.bindContext2DBuffer(this._ctx2dBuf);
            this._nativeObj.setGlobalConfigShaderData(Laya.Shader3D._configDefineValues._nativeObj);
            this._nativeObj.setStencilMaskTemplate(LayaXRenderContext2D._getStencilMaskTemplate()._nativeObj);
        }
        static _getStencilMaskTemplate() {
            if (LayaXRenderContext2D._stencilMaskTemplate)
                return LayaXRenderContext2D._stencilMaskTemplate;
            const element = new LayaXRenderElement2D();
            element.geometry = Laya.ShaderDefines2D._stencilGeo;
            element.subShader = Laya.Shader2D.stencilShader.getSubShaderAt(0);
            element.nodeCommonMap = ["BaseRender2D"];
            element.renderStateIsBySprite = true;
            LayaXRenderContext2D._stencilMaskTemplate = element;
            return element;
        }
        get invertY() { return this._ctx2dI32[0] !== 0; }
        set invertY(value) { this._ctx2dI32[0] = value ? 1 : 0; }
        get pipelineMode() { return this._pipelineMode; }
        set pipelineMode(value) { this._pipelineMode = value; }
        get passData() { return this._passData; }
        set passData(value) {
            this._passData = value;
            this._nativeObj.setPassData(value ? value._nativeObj : null);
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
        }
        drawRenderElementList(list) {
            return list.length;
        }
        runOneCMD(cmd) {
            if (cmd) {
                this._nativeObj.runOneCMD(cmd._nativeObj);
            }
        }
        runCMDList(cmds) {
            if (!cmds || cmds.length === 0)
                return;
            let nativeobCMDs = [];
            for (let i = 0, n = cmds.length; i < n; i++) {
                nativeobCMDs.push(cmds[i]._nativeObj);
            }
            this._nativeObj.runCMDList(nativeobCMDs);
        }
    }
    LayaXRenderContext2D._stencilMaskTemplate = null;

    class LayaXSetRenderData extends Laya.SetRenderDataCMD {
        constructor() {
            super();
            this.type = Laya.RenderCMDType.ChangeData;
            this._nativeObj = new window.conchLayaXSetRenderDataCMD();
        }
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
            this._nativeObj.setPropertyID(value);
        }
        get dest() {
            return this._dest;
        }
        set dest(value) {
            this._dest = value;
            this._nativeObj.setDest(value ? value._nativeObj : null);
        }
        get value() {
            return this._value;
        }
        set value(value) {
            switch (this.dataType) {
                case Laya.ShaderDataType.Int:
                    this.data_number = value;
                    this._value = this.data_number;
                    this._nativeObj.setInt(this.data_number | 0);
                    break;
                case Laya.ShaderDataType.Float:
                    this.data_number = value;
                    this._value = this.data_number;
                    this._nativeObj.setFloat(this._value);
                    break;
                case Laya.ShaderDataType.Bool:
                    this.data_number = value;
                    this._value = this.data_number;
                    this._nativeObj.setBool(!!this.data_number);
                    break;
                case Laya.ShaderDataType.Matrix4x4:
                    !this.data_mat && (this.data_mat = new Laya.Matrix4x4());
                    value.cloneTo(this.data_mat);
                    this._value = this.data_mat;
                    this._nativeObj.setMatrix4x4(this._value);
                    break;
                case Laya.ShaderDataType.Color:
                    !this.data_Color && (this.data_Color = new Laya.Color());
                    value.cloneTo(this.data_Color);
                    this._value = this.data_Color;
                    this._nativeObj.setColor(this.data_Color.r, this.data_Color.g, this.data_Color.b, this.data_Color.a);
                    break;
                case Laya.ShaderDataType.Texture2D:
                    this._value = this.data_texture = value;
                    this._nativeObj.setTexture2D(this.data_texture ? this.data_texture._texture._nativeObj : null);
                    break;
                case Laya.ShaderDataType.Vector4:
                    !this.data_v4 && (this.data_v4 = new Laya.Vector4());
                    value.cloneTo(this.data_v4);
                    this._value = this.data_v4;
                    this._nativeObj.setVector(this.data_v4.x, this.data_v4.y, this.data_v4.z, this.data_v4.w);
                    break;
                case Laya.ShaderDataType.Vector2:
                    !this.data_v2 && (this.data_v2 = new Laya.Vector2());
                    value.cloneTo(this.data_v2);
                    this._value = this.data_v2;
                    this._nativeObj.setVector2(this.data_v2.x, this.data_v2.y);
                    break;
                case Laya.ShaderDataType.Vector3:
                    !this.data_v3 && (this.data_v3 = new Laya.Vector3());
                    value.cloneTo(this.data_v3);
                    this._value = this.data_v3;
                    this._nativeObj.setVector3(this.data_v3.x, this.data_v3.y, this.data_v3.z);
                    break;
                case Laya.ShaderDataType.Buffer:
                    this._value = this.data_Buffer = value;
                    this._nativeObj.setBufferValue(this.data_Buffer.buffer, this.data_Buffer.byteLength);
                    break;
            }
        }
        apply(_context) {
            this._nativeObj.execute();
        }
    }
    class LayaXSetShaderDefine extends Laya.SetShaderDefineCMD {
        constructor() {
            super();
            this.type = Laya.RenderCMDType.ChangeShaderDefine;
            this._nativeObj = new window.conchLayaXSetShaderDefineCMD();
        }
        get define() {
            return this._define;
        }
        set define(value) {
            this._define = value;
            this._nativeObj.setDefine(value._index, value._value);
        }
        get dest() {
            return this._dest;
        }
        set dest(value) {
            this._dest = value;
            this._nativeObj.setDest(value ? value._nativeObj : null);
        }
        get add() {
            return this._add;
        }
        set add(value) {
            this._add = value;
            this._nativeObj.setAdd(value);
        }
        apply(_context) {
            this._nativeObj.execute();
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

    class LayaXRTRender2DPass extends RTRender2DPass {
        constructor() {
            super(true);
            this._nativeObj = new window.conchLayaXRender2DPass(this._shaderData._nativeObj);
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
    class LayaXRender2DProcess {
        createTransform2DMemoryFactory() {
            return new RTTransform2DMemoryFactory();
        }
        createRenderElement2D() {
            return new LayaXRenderElement2D();
        }
        createPrimitiveRenderElement2D() {
            return new LayaXPrimitiveRenderElement2D();
        }
        createRenderContext2D() {
            return new LayaXRenderContext2D();
        }
        createBlit2DQuadCMDData() {
            return new LayaXBlit2DQuadCMD();
        }
        createDraw2DElementCMDData() {
            return new LayaXDraw2DElementCMD();
        }
        createSetRendertarget2DCMD() {
            return new LayaXSetRendertarget2DCMD();
        }
        createSetRenderDataCMD() {
            return new LayaXSetRenderData();
        }
        createSetShaderDefineCMD() {
            return new LayaXSetShaderDefine();
        }
        createRender2DPass() {
            return new LayaXRTRender2DPass();
        }
        createRenderStruct2D() {
            return new RTRenderStruct2D();
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
            return new LayaXGraphicsOp2DFactory();
        }
        create2DBaseRenderDataHandle() {
            return new RTBaseRenderDataHandle();
        }
        createMesh2DRenderDataHandle() {
            return new RTMesh2DRenderDataHandle();
        }
        createEmptyRenderDataHandle() {
            return new RTEmptyRender2DDataHandle();
        }
    }
    Laya.Laya.addBeforeInitCallback(() => {
        if (window.conchLayaXRenderElement2D) {
            Laya.LayaGL.render2DRenderPassFactory = new LayaXRender2DProcess();
        }
    });

    exports.LayaXBindingInfoType = void 0;
    (function (LayaXBindingInfoType) {
        LayaXBindingInfoType[LayaXBindingInfoType["buffer"] = 0] = "buffer";
        LayaXBindingInfoType[LayaXBindingInfoType["texture"] = 1] = "texture";
        LayaXBindingInfoType[LayaXBindingInfoType["sampler"] = 2] = "sampler";
        LayaXBindingInfoType[LayaXBindingInfoType["storageBuffer"] = 3] = "storageBuffer";
        LayaXBindingInfoType[LayaXBindingInfoType["storageTexture"] = 4] = "storageTexture";
    })(exports.LayaXBindingInfoType || (exports.LayaXBindingInfoType = {}));
    class LayaXBindGroupHelper {
        static _getCacheKey(groupID, mapNames) {
            return `${groupID}_` + mapNames.join("_");
        }
        static _cloneBindingInfoArray(bindings) {
            return bindings.map(binding => (Object.assign(Object.assign({}, binding), { texture: binding.texture ? Object.assign({}, binding.texture) : undefined, sampler: binding.sampler ? Object.assign({}, binding.sampler) : undefined, buffer: binding.buffer ? Object.assign({}, binding.buffer) : undefined, storageTexture: binding.storageTexture ? Object.assign({}, binding.storageTexture) : undefined })));
        }
        static _getTextureViewDimension(uniformType) {
            switch (uniformType) {
                case Laya.ShaderDataType.Texture2D: return "2d";
                case Laya.ShaderDataType.Texture3D: return "3d";
                case Laya.ShaderDataType.TextureCube: return "cube";
                case Laya.ShaderDataType.Texture2DArray: return "2d-array";
                default: return "2d";
            }
        }
        static createBindingInfoArray(groupID, mapNames) {
            const cacheKey = this._getCacheKey(groupID, mapNames);
            const cached = this._cache.get(cacheKey);
            if (cached)
                return this._cloneBindingInfoArray(cached);
            let bindings = [];
            let bindingIndex = 0;
            for (let i = 0; i < mapNames.length; i++) {
                const commandName = mapNames[i];
                const propertyId = Laya.Shader3D.propertyNameToID(commandName);
                const uniformMap = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap(commandName);
                if (uniformMap._hasUniformBuffer) {
                    let info = {
                        id: 0,
                        name: commandName,
                        set: groupID,
                        binding: bindingIndex++,
                        propertyId: propertyId,
                        sourceMapId: propertyId,
                        type: exports.LayaXBindingInfoType.buffer,
                        bindingType: "uniform",
                        dataType: 0,
                        buffer: { type: "uniform" },
                    };
                    if (commandName == "SkinSprite3D") {
                        info.buffer.hasDynamicOffset = true;
                    }
                    bindings.push(info);
                }
                if (uniformMap && uniformMap._idata) {
                    for (let [propID, prop] of uniformMap._idata) {
                        if (prop.uniformtype >= Laya.ShaderDataType.Texture2D) {
                            let viewDim = this._getTextureViewDimension(prop.uniformtype);
                            bindings.push({
                                id: 0,
                                name: prop.propertyName + "_Texture",
                                set: groupID,
                                binding: bindingIndex++,
                                propertyId: propID,
                                sourceMapId: propertyId,
                                type: exports.LayaXBindingInfoType.texture,
                                bindingType: "texture",
                                dataType: prop.uniformtype,
                                texture: {
                                    sampleType: "float",
                                    viewDimension: viewDim,
                                    multisampled: false,
                                },
                            });
                            bindings.push({
                                id: 0,
                                name: prop.propertyName + "_Sampler",
                                set: groupID,
                                binding: bindingIndex++,
                                propertyId: propID,
                                sourceMapId: propertyId,
                                type: exports.LayaXBindingInfoType.sampler,
                                bindingType: "sampler",
                                dataType: prop.uniformtype,
                                sampler: { type: "filtering" },
                                texture: {
                                    sampleType: "float",
                                    viewDimension: viewDim,
                                    multisampled: false,
                                },
                            });
                        }
                        if (prop.uniformtype == Laya.ShaderDataType.ReadOnlyDeviceBuffer) {
                            bindings.push({
                                id: 0,
                                name: prop.propertyName,
                                set: groupID,
                                binding: bindingIndex++,
                                propertyId: propID,
                                sourceMapId: propertyId,
                                type: exports.LayaXBindingInfoType.storageBuffer,
                                bindingType: "storageBufferReadOnly",
                                dataType: prop.uniformtype,
                                buffer: { type: "read-only-storage" },
                            });
                        }
                        if (prop.uniformtype == Laya.ShaderDataType.DeviceBuffer) {
                            bindings.push({
                                id: 0,
                                name: prop.propertyName,
                                set: groupID,
                                binding: bindingIndex++,
                                propertyId: propID,
                                sourceMapId: propertyId,
                                type: exports.LayaXBindingInfoType.storageBuffer,
                                bindingType: "storageBuffer",
                                dataType: prop.uniformtype,
                                buffer: { type: "storage" },
                            });
                        }
                        if (prop.uniformtype == Laya.ShaderDataType.StorageTexture2D) {
                            bindings.push({
                                id: 0,
                                name: prop.propertyName,
                                set: groupID,
                                binding: bindingIndex++,
                                propertyId: propID,
                                sourceMapId: propertyId,
                                type: exports.LayaXBindingInfoType.storageTexture,
                                bindingType: "storageTexture",
                                dataType: prop.uniformtype,
                                format: prop.format,
                                storageTexture: {
                                    access: prop.access || "write-only",
                                    format: prop.format || "rgba8unorm",
                                    viewDimension: "2d",
                                },
                            });
                        }
                    }
                }
            }
            this._cache.set(cacheKey, bindings);
            return this._cloneBindingInfoArray(bindings);
        }
        static createBindingInfosByUniformMap(groupID, name, cacheName, uniformMap) {
            const cacheKey = this._getCacheKey(groupID, [cacheName]);
            const cached = this._cache.get(cacheKey);
            if (cached)
                return this._cloneBindingInfoArray(cached);
            let bindings = [];
            let bindingIndex = 0;
            const propertyId = Laya.Shader3D.propertyNameToID(name);
            let hasBuffer = false;
            for (let [propID, prop] of uniformMap) {
                if (prop.uniformtype < Laya.ShaderDataType.Texture2D
                    && prop.uniformtype != Laya.ShaderDataType.DeviceBuffer
                    && prop.uniformtype != Laya.ShaderDataType.ReadOnlyDeviceBuffer
                    && prop.uniformtype != Laya.ShaderDataType.StorageTexture2D) {
                    hasBuffer = true;
                    break;
                }
            }
            if (hasBuffer) {
                bindings.push({
                    id: 0,
                    name: name,
                    set: groupID,
                    binding: bindingIndex++,
                    propertyId: propertyId,
                    sourceMapId: propertyId,
                    type: exports.LayaXBindingInfoType.buffer,
                    bindingType: "uniform",
                    dataType: 0,
                    buffer: { type: "uniform" },
                });
            }
            for (let [propID, prop] of uniformMap) {
                if (prop.uniformtype >= Laya.ShaderDataType.Texture2D) {
                    let viewDim = this._getTextureViewDimension(prop.uniformtype);
                    bindings.push({
                        id: 0,
                        name: prop.propertyName + "_Texture",
                        set: groupID,
                        binding: bindingIndex++,
                        propertyId: propID,
                        sourceMapId: propertyId,
                        type: exports.LayaXBindingInfoType.texture,
                        bindingType: "texture",
                        dataType: prop.uniformtype,
                        texture: {
                            sampleType: "float",
                            viewDimension: viewDim,
                            multisampled: false,
                        },
                    });
                    bindings.push({
                        id: 0,
                        name: prop.propertyName + "_Sampler",
                        set: groupID,
                        binding: bindingIndex++,
                        propertyId: propID,
                        sourceMapId: propertyId,
                        type: exports.LayaXBindingInfoType.sampler,
                        bindingType: "sampler",
                        dataType: prop.uniformtype,
                        sampler: { type: "filtering" },
                        texture: {
                            sampleType: "float",
                            viewDimension: viewDim,
                            multisampled: false,
                        },
                    });
                }
                if (prop.uniformtype == Laya.ShaderDataType.ReadOnlyDeviceBuffer) {
                    bindings.push({
                        id: 0,
                        name: prop.propertyName,
                        set: groupID,
                        binding: bindingIndex++,
                        propertyId: propID,
                        sourceMapId: propertyId,
                        type: exports.LayaXBindingInfoType.storageBuffer,
                        bindingType: "storageBufferReadOnly",
                        dataType: prop.uniformtype,
                        buffer: { type: "read-only-storage" },
                    });
                }
                if (prop.uniformtype == Laya.ShaderDataType.DeviceBuffer) {
                    bindings.push({
                        id: 0,
                        name: prop.propertyName,
                        set: groupID,
                        binding: bindingIndex++,
                        propertyId: propID,
                        sourceMapId: propertyId,
                        type: exports.LayaXBindingInfoType.storageBuffer,
                        bindingType: "storageBuffer",
                        dataType: prop.uniformtype,
                        buffer: { type: "storage" },
                    });
                }
                if (prop.uniformtype == Laya.ShaderDataType.StorageTexture2D) {
                    bindings.push({
                        id: 0,
                        name: prop.propertyName,
                        set: groupID,
                        binding: bindingIndex++,
                        propertyId: propID,
                        sourceMapId: propertyId,
                        type: exports.LayaXBindingInfoType.storageTexture,
                        bindingType: "storageTexture",
                        dataType: prop.uniformtype,
                        format: prop.format,
                        storageTexture: {
                            access: prop.access || "write-only",
                            format: prop.format || "rgba8unorm",
                            viewDimension: "2d",
                        },
                    });
                }
            }
            this._cache.set(cacheKey, bindings);
            return this._cloneBindingInfoArray(bindings);
        }
        static computeTextureExits(setIndex, mapNames, bindings) {
            let bitOffset = 0;
            let textureExits = 0;
            for (const name of mapNames) {
                let map = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap(name);
                for (const binding of bindings) {
                    let propertyID = binding.propertyId;
                    if (map.hasPtrID(propertyID)) {
                        if (binding.type === exports.LayaXBindingInfoType.sampler) {
                            let textureBitIndex = map._textureBits.get(propertyID);
                            if (textureBitIndex !== undefined) {
                                let textureBit = textureBitIndex + bitOffset;
                                textureExits |= (1 << textureBit);
                            }
                        }
                    }
                }
                bitOffset += map._textureCount;
            }
            return textureExits;
        }
    }
    LayaXBindGroupHelper._cache = new Map();

    class LayaXBufferState {
        constructor() {
            this._attriLocArray = new Set();
            this._nativeObj = new window.conchLayaXBufferState();
        }
        applyState(vertexBuffers, indexBuffer) {
            this._vertexBuffers = vertexBuffers;
            this._bindedIndexBuffer = indexBuffer;
            this._attriLocArray.clear();
            let tempVertexBuffers = [];
            vertexBuffers.forEach((element) => {
                tempVertexBuffers.push(element._nativeObj);
                let vb = element;
                if (vb.vertexDeclaration && vb.vertexDeclaration._VAElements) {
                    let attriArray = vb.vertexDeclaration._VAElements;
                    for (let j = 0; j < attriArray.length; j++) {
                        this._attriLocArray.add(attriArray[j].shaderLocation);
                    }
                }
            });
            this._nativeObj.applyState(tempVertexBuffers, indexBuffer ? indexBuffer._nativeObj : null);
        }
        destroy() {
            this._nativeObj.destroy();
        }
    }

    class LayaXCommandUniformMap extends Laya.CommandUniformMap {
        constructor(stateName) {
            super(stateName);
            this._idata = new Map();
            this._hasUniformBuffer = false;
            this._textureBits = new Map();
            this._textureCount = 0;
            this._stateName = stateName;
            this._stateID = Laya.Shader3D.propertyNameToID(stateName);
            this._nativeObj = window.conchLayaXCommandUniformMap.create(stateName);
        }
        hasPtrID(propertyID) {
            return this._stateID == propertyID || this._idata.has(propertyID);
        }
        addShaderUniform(propertyID, propertyKey, uniformtype, options) {
            this._nativeObj.addShaderUniform(propertyID, propertyKey, uniformtype);
            let uniform = { id: propertyID, uniformtype: uniformtype, propertyName: propertyKey, arrayLength: 0, format: options === null || options === void 0 ? void 0 : options.format, access: options === null || options === void 0 ? void 0 : options.access };
            this._idata.set(propertyID, uniform);
            if (uniformtype < Laya.ShaderDataType.Texture2D
                && uniformtype != Laya.ShaderDataType.DeviceBuffer
                && uniformtype != Laya.ShaderDataType.ReadOnlyDeviceBuffer
                && uniformtype != Laya.ShaderDataType.StorageTexture2D) {
                this._hasUniformBuffer = true;
            }
            if (uniformtype >= Laya.ShaderDataType.Texture2D) {
                this._textureBits.set(propertyID, this._textureCount);
                this._textureCount++;
            }
        }
        addShaderUniformArray(propertyID, propertyName, uniformtype, arrayLength) {
            this._nativeObj.addShaderUniformArray(propertyID, propertyName, uniformtype, arrayLength);
            this._idata.set(propertyID, { id: propertyID, uniformtype: uniformtype, propertyName: propertyName, arrayLength: arrayLength });
            if (uniformtype < Laya.ShaderDataType.Texture2D
                && uniformtype != Laya.ShaderDataType.DeviceBuffer
                && uniformtype != Laya.ShaderDataType.ReadOnlyDeviceBuffer) {
                this._hasUniformBuffer = true;
            }
        }
        setDefaultTextureData(key, defaultTex) {
            let rtNative = null;
            if (defaultTex) {
                let rt = defaultTex._renderTarget;
                if (rt)
                    rtNative = rt._nativeObj;
            }
            this._nativeObj.setDefaultTextureData(key, rtNative);
        }
    }

    class LayaXReadbackDispatcher {
        static register(id, resolve, reject) {
            this._pending.set(id, { resolve, reject });
        }
        static pump(device) {
            if (!device || !device.pollDeviceEvent)
                return;
            while (device.pollDeviceEvent()) {
                const ty = device.lastEventType();
                const id = device.lastEventReadbackId();
                if (ty === 4 || ty === 5) {
                    const entry = this._pending.get(id);
                    if (!entry)
                        continue;
                    this._pending.delete(id);
                    if (ty === 4)
                        entry.resolve();
                    else
                        entry.reject(new Error("LayaX: GPU readback failed (id=" + id + ")"));
                }
                else if (ty === 0) {
                    this._rejectAll(new Error("LayaX: device lost"));
                }
            }
        }
        static _rejectAll(err) {
            for (const entry of this._pending.values()) {
                try {
                    entry.reject(err);
                }
                catch (_a) { }
            }
            this._pending.clear();
        }
    }
    LayaXReadbackDispatcher._pending = new Map();

    class LayaXVertexBuffer {
        constructor(bufferUsageType) {
            this._instanceBuffer = false;
            this._bufferRef = null;
            this._nativeObj = new window.conchLayaXVertexBuffer(bufferUsageType);
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
            return this._instanceBuffer;
        }
        set instanceBuffer(value) {
            this._instanceBuffer = value;
            this._nativeObj.setInstanceBuffer(value);
        }
        getStorageBuffer() {
            throw new Error("Method not implemented.");
        }
        setData(buffer, bufferOffset, dataStartIndex, dataCount) {
            this._bufferRef = buffer;
            this._nativeObj.setData(buffer, bufferOffset, dataStartIndex, dataCount);
        }
        setDataLength(byteLength) {
            this._nativeObj.setDataLength(byteLength);
        }
        destroy() {
            this._nativeObj.destroy();
            this._bufferRef = null;
        }
    }

    class LayaXDeviceBuffer {
        constructor(usage) {
            this._size = 0;
            this._destroyed = false;
            this._usage = usage;
            this._nativeObj = new window.conchLayaXDeviceBuffer(LayaXDeviceBuffer._convertUsage(usage), LayaXDeviceBuffer._convertHeapType(usage));
        }
        static _convertUsage(usage) {
            let r = 0;
            if (usage & Laya.EDeviceBufferUsage.VERTEX)
                r |= 1 << 0;
            if (usage & Laya.EDeviceBufferUsage.STORAGE)
                r |= 1 << 3;
            if (usage & Laya.EDeviceBufferUsage.INDIRECT)
                r |= 1 << 4;
            if (usage & Laya.EDeviceBufferUsage.COPY_SRC)
                r |= 1 << 5;
            if (usage & Laya.EDeviceBufferUsage.COPY_DST)
                r |= 1 << 6;
            return r;
        }
        static _convertHeapType(usage) {
            if (usage & Laya.EDeviceBufferUsage.MAP_READ)
                return 2;
            if (usage & Laya.EDeviceBufferUsage.MAP_WRITE)
                return 1;
            return 0;
        }
        getNativeBuffer() {
            return this._nativeObj;
        }
        setData(buffer, bufferOffset, dataStartIndex, dataCount) {
            this._nativeObj.setData(buffer, bufferOffset, dataStartIndex, dataCount);
            const required = bufferOffset + dataCount;
            if (required > this._size)
                this._size = required;
        }
        setDataLength(byteLength) {
            if (byteLength !== this._size) {
                this._size = byteLength;
                this._nativeObj.setDataLength(byteLength);
            }
        }
        copyToBuffer(buffer, sourceOffset, destOffset, byteLength) {
            if (buffer instanceof LayaXVertexBuffer) {
                this._nativeObj.copyToVertexBuffer(buffer._nativeObj, sourceOffset, destOffset, byteLength);
            }
            else if (buffer instanceof LayaXDeviceBuffer) {
                this._nativeObj.copyToDeviceBuffer(buffer._nativeObj, sourceOffset, destOffset, byteLength);
            }
            else {
                throw new Error("LayaXDeviceBuffer.copyToBuffer() invalid buffer type");
            }
        }
        copyToTexture() {
        }
        readData(dest, destOffset, srcOffset, byteLength) {
            return new Promise((resolve, reject) => {
                if (this._destroyed) {
                    reject(new Error("LayaXDeviceBuffer.readData: buffer destroyed"));
                    return;
                }
                if (!dest) {
                    reject(new Error("LayaXDeviceBuffer.readData: dest is null"));
                    return;
                }
                if (!Number.isFinite(byteLength) || byteLength <= 0) {
                    reject(new Error("LayaXDeviceBuffer.readData: byteLength must be > 0"));
                    return;
                }
                if (!Number.isFinite(destOffset) || destOffset < 0 ||
                    !Number.isFinite(srcOffset) || srcOffset < 0) {
                    reject(new Error("LayaXDeviceBuffer.readData: offsets must be >= 0"));
                    return;
                }
                if (destOffset + byteLength > dest.byteLength) {
                    reject(new Error("LayaXDeviceBuffer.readData: destOffset + byteLength (" +
                        (destOffset + byteLength) + ") exceeds dest.byteLength (" +
                        dest.byteLength + ")"));
                    return;
                }
                if (this._size > 0 && srcOffset + byteLength > this._size) {
                    reject(new Error("LayaXDeviceBuffer.readData: srcOffset + byteLength (" +
                        (srcOffset + byteLength) + ") exceeds buffer size (" +
                        this._size + ")"));
                    return;
                }
                const id = this._nativeObj.readData(dest, destOffset, srcOffset, byteLength);
                if (!id || id <= 0) {
                    reject(new Error("LayaXDeviceBuffer.readData: submit failed"));
                    return;
                }
                LayaXReadbackDispatcher.register(id, () => { resolve(); }, (e) => { reject(e); });
            });
        }
        destroy() {
            if (this._destroyed)
                return;
            if (this._nativeObj)
                this._nativeObj.destroy();
            this._destroyed = true;
        }
        get destroyed() { return this._destroyed; }
        get size() { return this._size; }
        get usage() { return this._usage; }
    }

    class LayaXIndexBuffer {
        constructor(bufferUsageType) {
            this._bufferRef = null;
            this._indexCount = 0;
            this._nativeObj = new window.conchLayaXIndexBuffer(bufferUsageType);
        }
        get indexType() {
            return this._indexType;
        }
        set indexType(value) {
            this._indexType = value;
            this._nativeObj.setIndexType(value);
        }
        get indexCount() {
            return this._indexCount;
        }
        set indexCount(value) {
            this._indexCount = value;
            this._nativeObj.setIndexCount(value);
        }
        setData(buffer, bufferOffset, dataStartIndex, dataCount) {
            this._bufferRef = buffer;
            this._nativeObj.setData(buffer, bufferOffset, dataStartIndex, dataCount);
        }
        _setIndexDataLength(data) {
            this._nativeObj._setIndexDataLength(data);
        }
        _setIndexData(data, bufferOffset) {
            this._nativeObj._setIndexData(data, bufferOffset);
        }
        destroy() {
            this._nativeObj.destroy();
            this._bufferRef = null;
        }
    }

    class LayaXInternalTex {
        constructor(nativeObj) {
            this._nativeObj = nativeObj;
        }
        get wrapU() {
            return this._nativeObj.wrapU;
        }
        set wrapU(value) {
            var _a, _b;
            this._nativeObj.wrapU = value;
            (_b = (_a = this._nativeObj).syncSamplerParams) === null || _b === void 0 ? void 0 : _b.call(_a);
        }
        get wrapV() {
            return this._nativeObj.wrapV;
        }
        set wrapV(value) {
            var _a, _b;
            this._nativeObj.wrapV = value;
            (_b = (_a = this._nativeObj).syncSamplerParams) === null || _b === void 0 ? void 0 : _b.call(_a);
        }
        get wrapW() {
            return this._nativeObj.wrapW;
        }
        set wrapW(value) {
            var _a, _b;
            this._nativeObj.wrapW = value;
            (_b = (_a = this._nativeObj).syncSamplerParams) === null || _b === void 0 ? void 0 : _b.call(_a);
        }
        set baseMipmapLevel(value) {
            this._nativeObj.baseMipmapLevel = value;
        }
        get baseMipmapLevel() {
            return this._nativeObj.baseMipmapLevel;
        }
        set maxMipmapLevel(value) {
            this._nativeObj.maxMipmapLevel = value;
        }
        get maxMipmapLevel() {
            return this._nativeObj.maxMipmapLevel;
        }
        get compareMode() {
            return this._nativeObj.compareMode;
        }
        set compareMode(value) {
            var _a, _b;
            this._nativeObj.compareMode = value;
            (_b = (_a = this._nativeObj).syncSamplerParams) === null || _b === void 0 ? void 0 : _b.call(_a);
        }
        get anisoLevel() {
            return this._nativeObj.anisoLevel;
        }
        set anisoLevel(value) {
            var _a, _b;
            this._nativeObj.anisoLevel = value;
            (_b = (_a = this._nativeObj).syncSamplerParams) === null || _b === void 0 ? void 0 : _b.call(_a);
        }
        get filterMode() {
            return this._nativeObj.filterMode;
        }
        set filterMode(value) {
            var _a, _b;
            this._nativeObj.filterMode = value;
            (_b = (_a = this._nativeObj).syncSamplerParams) === null || _b === void 0 ? void 0 : _b.call(_a);
        }
        get mipmapCount() {
            return this._nativeObj.mipmapCount;
        }
        get mipmap() {
            return this._nativeObj.mipmap;
        }
        get isPotSize() {
            return this._nativeObj.getIsPotSize();
        }
        get useSRGBLoad() {
            return this._nativeObj.useSRGBLoad;
        }
        get depth() {
            return this._nativeObj.getDepth();
        }
        get gammaCorrection() {
            return this._nativeObj.getGammaCorrection();
        }
        set gammaCorrection(value) {
            this._nativeObj.setGammaCorrection(value);
        }
        get resource() {
            return this._nativeObj;
        }
        get width() {
            return this._nativeObj.getWidth();
        }
        get height() {
            return this._nativeObj.getHeight();
        }
        get gpuMemory() {
            return this._nativeObj.getGPUMemory();
        }
        dispose() {
            this._nativeObj.dispose();
        }
    }

    class LayaXInternalRT {
        constructor(nativeObj, owner = null) {
            this._disposed = false;
            this._propBuf = new ArrayBuffer(7 * 4);
            this._propU32 = new Uint32Array(this._propBuf);
            this._propI32 = new Int32Array(this._propBuf);
            if (!nativeObj)
                throw new Error("Cannot wrap a missing LayaX render target.");
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
                    this._color0TargetRef = new LayaXInternalRT(target, this);
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
                    this._texturesRef.push(element ? new LayaXInternalTex(element) : null);
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
                    this._depthTextureRef = new LayaXInternalTex(nativeObj);
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

    class RTShaderDefine extends Laya.ShaderDefine {
        constructor(index, value) {
            super(index, value);
        }
    }

    class LayaXShaderCompiler {
        constructor() {
        }
        async init() {
            let glslInit;
            const NativeGlslang = globalThis.conchGlslangCompiler;
            this.glslang = new NativeGlslang();
            glslInit = Promise.resolve();
            let nagaInit;
            const NativeNaga = globalThis.conchNagaCompiler;
            this.naga = new NativeNaga();
            nagaInit = Promise.resolve();
            return Promise.all([glslInit, nagaInit]);
        }
        destroy() {
            this.glslang = null;
            this.naga = null;
        }
    }

    class LayaXTextureContext {
        constructor(native) {
            this._native = native;
            this.needBitmap = false;
        }
        createRenderTargetArrayInternal(width, height, depth, colorFormat, depthStencilFormat, generateMipmap, sRGB, multiSamples) {
            return new LayaXInternalRT(this._native.createRenderTargetArrayInternal(width, height, depth, colorFormat, depthStencilFormat ? depthStencilFormat : Laya.RenderTargetFormat.None, generateMipmap, sRGB, multiSamples));
        }
        createTextureInternal(dimension, width, height, format, generateMipmap, sRGB, premultipliedAlpha) {
            var tex = new LayaXInternalTex(this._native.createTextureInternal(dimension, width, height, format, generateMipmap, sRGB, premultipliedAlpha));
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
            return new LayaXInternalTex(this._native.createTexture3DInternal(dimension, width, height, depth, format, generateMipmap, sRGB, premultipliedAlpha));
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
                throw new Error("Cannot bind a disposed LayaX render target.");
            if ((renderTarget === null || renderTarget === void 0 ? void 0 : renderTarget.colorFormats) && faceIndex !== 0)
                throw new RangeError("LayaX MRT only supports 2D attachments at mip level 0.");
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
            return new LayaXInternalRT(this._native.createMultiRenderTargetInternal(width, height, formats, depthStencilFormat !== null && depthStencilFormat !== void 0 ? depthStencilFormat : Laya.RenderTargetFormat.None, color0SRGB));
        }
        createRenderTargetInternal(width, height, colorFormat, depthStencilFormat, generateMipmap, sRGB, multiSamples, storage) {
            return new LayaXInternalRT(this._native.createRenderTargetInternal(width, height, colorFormat, depthStencilFormat ? depthStencilFormat : Laya.RenderTargetFormat.None, generateMipmap, sRGB, multiSamples));
        }
        createRenderTargetCubeInternal(size, colorFormat, depthStencilFormat, generateMipmap, sRGB, multiSamples) {
            return new LayaXInternalRT(this._native.createRenderTargetCubeInternal(size, colorFormat, depthStencilFormat, generateMipmap, sRGB, multiSamples));
        }
        createRenderTextureCubeInternal(dimension, size, format, generateMipmap, sRGB) {
            return new LayaXInternalTex(this._native.createRenderTextureCubeInternal(dimension, size, format, generateMipmap, sRGB));
        }
        createRenderTargetDepthTexture(renderTarget, dimension, width, height) {
            if (!renderTarget || renderTarget.destroyed || renderTarget._owner)
                throw new Error("Cannot replace depth storage on a disposed or borrowed LayaX render target.");
            if (renderTarget.colorFormats && (dimension !== Laya.TextureDimension.Tex2D ||
                width !== renderTarget._textures[0].width || height !== renderTarget._textures[0].height))
                throw new RangeError("LayaX MRT depth dimensions must match its 2D color attachments.");
            const nativeTexture = this._native.createRenderTargetDepthTexture(renderTarget._nativeObj, dimension, width, height);
            if (nativeTexture && renderTarget._depthTextureRef &&
                renderTarget._depthTextureRef._nativeObj === nativeTexture)
                return renderTarget._depthTextureRef;
            const texture = nativeTexture ? new LayaXInternalTex(nativeTexture) : null;
            renderTarget._depthTextureRef = texture;
            return texture;
        }
        readRenderTargetPixelData(renderTarget, xOffset, yOffset, width, height, out) {
            return out;
        }
        async readRenderTargetPixelDataAsync(renderTarget, xOffset, yOffset, width, height, out, attachmentIndex = 0) {
            if (!renderTarget || renderTarget.destroyed)
                throw new Error("Cannot read a missing or disposed LayaX render target.");
            if (!Number.isInteger(attachmentIndex) || attachmentIndex < 0 ||
                (!renderTarget.colorFormats && attachmentIndex !== 0))
                throw new RangeError("Color attachment index is out of range.");
            const texture = renderTarget._textures[attachmentIndex];
            if (!texture)
                throw new RangeError("LayaX color attachment is empty or out of range.");
            if (!Number.isInteger(xOffset) || !Number.isInteger(yOffset) || !Number.isInteger(width) || !Number.isInteger(height) ||
                xOffset < 0 || yOffset < 0 || width <= 0 || height <= 0 || width > texture.width || height > texture.height ||
                xOffset > texture.width - width || yOffset > texture.height - height)
                throw new RangeError("LayaX readback rectangle must be within the color attachment.");
            const format = renderTarget.colorFormats ? renderTarget.colorFormats[attachmentIndex] : renderTarget.colorFormat;
            const bytePixels = format === Laya.RenderTargetFormat.R8G8B8 || format === Laya.RenderTargetFormat.R8G8B8A8;
            const halfPixels = format === Laya.RenderTargetFormat.R16G16B16 || format === Laya.RenderTargetFormat.R16G16B16A16;
            const floatPixels = format === Laya.RenderTargetFormat.R32G32B32 || format === Laya.RenderTargetFormat.R32G32B32A32;
            if (!bytePixels && !halfPixels && !floatPixels)
                throw new TypeError("Unsupported LayaX color format for readback.");
            if (bytePixels ? !(out instanceof Uint8Array || out instanceof Uint8ClampedArray) : !(out instanceof Float32Array))
                throw new TypeError("LayaX color readback requires a byte view for byte attachments and Float32Array for floating-point attachments.");
            const outputBytes = width * height * 4 * (bytePixels ? 1 : 4);
            if (out.byteLength < outputBytes)
                throw new RangeError(`LayaX readback output requires at least ${outputBytes} bytes.`);
            const bytesPerPixel = bytePixels ? 4 : halfPixels ? 8 : 16;
            const unpaddedRow = width * bytesPerPixel;
            const paddedRow = Math.ceil(unpaddedRow / 256) * 256;
            const padded = new Uint8Array(paddedRow * height);
            return new Promise((resolve, reject) => {
                const id = renderTarget.colorFormats
                    ? this._native.readMultiRenderTargetPixelData(renderTarget._nativeObj, xOffset, yOffset, width, height, paddedRow, padded.buffer, attachmentIndex)
                    : this._native.readRenderTargetPixelData(renderTarget._nativeObj, xOffset, yOffset, width, height, paddedRow, padded.buffer);
                if (!id || id <= 0) {
                    reject(new Error("readRenderTargetPixelDataAsync: submit failed"));
                    return;
                }
                LayaXReadbackDispatcher.register(id, () => {
                    if (halfPixels) {
                        const source = new Uint16Array(padded.buffer);
                        const destination = out;
                        for (let row = 0; row < height; row++)
                            for (let i = 0; i < width * 4; i++)
                                destination[row * width * 4 + i] = Laya.HalfFloatUtils.convertToNumber(source[row * paddedRow / 2 + i]);
                    }
                    else if (floatPixels) {
                        const source = new Float32Array(padded.buffer);
                        const destination = out;
                        for (let row = 0; row < height; row++)
                            destination.set(source.subarray(row * paddedRow / 4, row * paddedRow / 4 + width * 4), row * width * 4);
                    }
                    else {
                        const destination = new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
                        for (let row = 0; row < height; row++)
                            destination.set(padded.subarray(row * paddedRow, row * paddedRow + unpaddedRow), row * unpaddedRow);
                    }
                    resolve(out);
                }, (e) => reject(e));
            });
        }
        updateVideoTexture(texture, video, premultiplyAlpha, invertY) {
            if (texture && video) {
                this._native.updateVideoTexture(texture._nativeObj, video._nativeObj.conchImgId, premultiplyAlpha, invertY);
            }
        }
    }

    class LayaXRenderEngine {
        constructor() {
            this._lastTextureMemory = 0;
            this._lastRenderTargetMemory = 0;
            this._lastDeviceBufferMemory = 0;
            this._lastGpuBufferMemory = 0;
            this._lastGpuMemory = 0;
            this._capabilities = new Map();
            this._remapZ = false;
            this._screenInvertY = true;
            this._lodTextureSample = false;
            this._breakTextureSample = false;
            this._nativeObj = new window.conchLayaXDevice();
            this.shaderCompiler = new LayaXShaderCompiler();
            LayaXRenderEngine._instance = this;
        }
        get _framePassCount() {
            return this._nativeObj._framePassCount;
        }
        set _framePassCount(value) {
            this._nativeObj._framePassCount = value;
        }
        initRenderEngine(canvas) {
            this._capabilities.clear();
            this._nativeObj.initRenderEngine(canvas._nativeObj);
            this._textureContext = new LayaXTextureContext(this._nativeObj.getTextureContext());
            Laya.Config._uniformBlock = Laya.Config.enableUniformBufferObject && this.getCapable(Laya.RenderCapable.UnifromBufferObject);
            Laya.Config.matUseUBO = Laya.Config.matUseUBO && this.getCapable(Laya.RenderCapable.UnifromBufferObject);
            this._nativeObj.enableUniformBufferObject = Laya.Config._uniformBlock;
            this._nativeObj.matUseUBO = Laya.Config.matUseUBO;
        }
        resizeOffScreen(width, height) {
            this._nativeObj.resizeOffScreen(width, height);
        }
        getDefineByName(name) {
            let packed = this._nativeObj.getDefineByName(name);
            let index = Math.floor(packed / 4294967296);
            let value = packed - index * 4294967296;
            return new RTShaderDefine(index, value);
        }
        getNamesByDefineData(defineData, out) {
            out.length = 0;
            let names = this._nativeObj.getNamesByDefineData(defineData._nativeObj);
            if (names && names.length > 0) {
                let arr = names.split('\n');
                for (let i = 0; i < arr.length; i++) {
                    if (arr[i].length > 0)
                        out.push(arr[i]);
                }
            }
        }
        addTexGammaDefine(key, value) {
            this._nativeObj.addTexGammaDefine(key, value);
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
            return this._nativeObj.getParams(params);
        }
        getCapable(capatableType) {
            let value = this._capabilities.get(capatableType);
            if (value === undefined) {
                value = this._nativeObj.getCapable(capatableType);
                this._capabilities.set(capatableType, value);
            }
            return value;
        }
        getTextureContext() {
            return this._textureContext;
        }
        startFrame() {
            this._syncStatistics();
            LayaXReadbackDispatcher.pump(this._nativeObj);
        }
        endFrame() {
        }
        _recordAbsoluteMemory(element, bytes, lastBytes) {
            let delta = bytes - lastBytes;
            if (delta !== 0) {
                Laya.LayaGL.statAgent.recordMemoryData(element, delta);
                return bytes;
            }
            return lastBytes;
        }
        _syncStatistics() {
            let nativeObj = this._nativeObj;
            if (!nativeObj || !nativeObj.frameOpaqueDrawCall)
                return;
            let opaque = nativeObj.frameOpaqueDrawCall();
            let transparent = nativeObj.frameTransparentDrawCall();
            let depth = nativeObj.frameDepthDrawCall();
            let shadow = nativeObj.frameShadowDrawCall();
            let instancing = nativeObj.frameInstanceDrawCall ? nativeObj.frameInstanceDrawCall() : 0;
            let indirect = nativeObj.frameIndirectDrawCall ? nativeObj.frameIndirectDrawCall() : 0;
            let triangle = nativeObj.frameTriangle();
            let cullMainTime = nativeObj.frameCullMainTime();
            let draw2D = nativeObj.consumeFrame2DDrawCall ? nativeObj.consumeFrame2DDrawCall() : 0;
            let draw3D = opaque + transparent;
            Laya.LayaGL.statAgent.recordCTData(Laya.StatElement.CT_OpaqueDrawCall, opaque);
            Laya.LayaGL.statAgent.recordCTData(Laya.StatElement.CT_TransDrawCall, transparent);
            Laya.LayaGL.statAgent.recordCTData(Laya.StatElement.CT_DepthCastDrawCall, depth);
            Laya.LayaGL.statAgent.recordCTData(Laya.StatElement.CT_ShadowDrawCall, shadow);
            Laya.LayaGL.statAgent.recordCTData(Laya.StatElement.CT_Instancing_DrawCall, instancing);
            Laya.LayaGL.statAgent.recordCTData(Laya.StatElement.CT_IndirectDrawCall, indirect);
            Laya.LayaGL.statAgent.recordCTData(Laya.StatElement.CT_2DDrawCall, draw2D);
            Laya.LayaGL.statAgent.recordCTData(Laya.StatElement.CT_3DDrawCall, draw3D);
            Laya.LayaGL.statAgent.recordCTData(Laya.StatElement.CT_DrawCall, draw2D + draw3D + depth + shadow);
            Laya.LayaGL.statAgent.recordCTData(Laya.StatElement.CT_Triangle, triangle);
            Laya.LayaGL.statAgent.recordTimeData(Laya.StatElement.T_CullMain, cullMainTime);
            let textureMemory = nativeObj.gpuTextureTotalMemorySize();
            let renderTargetMemory = nativeObj.gpuRenderTargetTotalMemorySize();
            let deviceBufferMemory = nativeObj.gpuDeviceBufferTotalMemorySize();
            let gpuBufferMemory = nativeObj.gpuBufferTotalMemorySize ? nativeObj.gpuBufferTotalMemorySize() : deviceBufferMemory;
            let gpuMemory = textureMemory + renderTargetMemory + gpuBufferMemory;
            this._lastTextureMemory = this._recordAbsoluteMemory(Laya.StatElement.M_AllTexture, textureMemory, this._lastTextureMemory);
            this._lastRenderTargetMemory = this._recordAbsoluteMemory(Laya.StatElement.M_RenderTexture, renderTargetMemory, this._lastRenderTargetMemory);
            this._lastDeviceBufferMemory = this._recordAbsoluteMemory(Laya.StatElement.M_DeviceBuffer, deviceBufferMemory, this._lastDeviceBufferMemory);
            this._lastGpuBufferMemory = this._recordAbsoluteMemory(Laya.StatElement.M_GPUBuffer, gpuBufferMemory, this._lastGpuBufferMemory);
            this._lastGpuMemory = this._recordAbsoluteMemory(Laya.StatElement.M_GPUMemory, gpuMemory, this._lastGpuMemory);
        }
        viewport(x, y, width, height) {
            this._nativeObj.viewport(x, y, width, height);
        }
        scissor(x, y, width, height) {
            this._nativeObj.scissor(x, y, width, height);
        }
    }

    class LayaXRenderGeometry {
        constructor(mode, drawType) {
            this._propBuf = new ArrayBuffer(4 * 4);
            this._propU32 = new Uint32Array(this._propBuf);
            this._nativeObj = new window.conchLayaXRenderGeometry();
            this._nativeObj.bindPropertyBuffer(this._propBuf);
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
            this._nativeObj.setDrawArrayParams(first, count);
        }
        setDrawElemenParams(count, offset) {
            this.drawParams.add(offset);
            this.drawParams.add(count);
            this._nativeObj.setDrawElementParams(count, offset);
        }
        destroy() {
            this._nativeObj.destroy();
        }
        clearRenderParams() {
            this.drawParams.length = 0;
            this._nativeObj.clearRenderParams();
        }
        setIndirectDrawBuffer(buffer, offset) {
            const nativeBuf = buffer ? buffer._nativeObj : null;
            this._nativeObj.setIndirectDrawBuffer(nativeBuf, offset >>> 0);
        }
        set bufferState(value) {
            this._bufferState = value;
            this._nativeObj.setBufferState(value ? value._nativeObj : null);
        }
        get bufferState() {
            return this._bufferState;
        }
        set mode(value) {
            this._nativeObj.setMode(value);
        }
        get mode() {
            return this._propU32[0];
        }
        set drawType(value) {
            this._nativeObj.setDrawType(value);
        }
        get drawType() {
            return this._propU32[1];
        }
        set instanceCount(value) {
            this._nativeObj.setInstanceCount(value);
        }
        get instanceCount() {
            return this._propU32[2];
        }
        set indexFormat(value) {
            this._nativeObj.setIndexFormat(value);
        }
        get indexFormat() {
            return this._propU32[3];
        }
    }

    class LayaXDefineDatas {
        constructor() {
            this._readback = null;
            this._nativeObj = new window.conchLayaXDefineDatas();
            this._nativeObj.create();
            if (this._nativeObj.bindReadback) {
                const words = new Uint32Array(9);
                if (this._nativeObj.bindReadback(words.buffer))
                    this._readback = words;
            }
        }
        get _length() {
            return 0;
        }
        set _length(value) {
        }
        get _mask() {
            return [];
        }
        set _mask(value) {
        }
        _intersectionDefineDatas(define) {
        }
        add(define) {
            const words = this._readback, index = define._index >>> 0, value = define._value >>> 0;
            if ((words === null || words === void 0 ? void 0 : words[0]) && index < words.length - 1 && value !== 0
                && ((words[index + 1] & value) >>> 0) === value)
                return;
            this._nativeObj.add(index, value);
        }
        remove(define) {
            const words = this._readback, index = define._index >>> 0, value = define._value >>> 0;
            if ((words === null || words === void 0 ? void 0 : words[0]) === 1 && index < words.length - 1 && (words[index + 1] & value) === 0)
                return;
            this._nativeObj.remove(index, value);
        }
        addDefineDatas(define) {
            if (define._nativeObj) {
                this._nativeObj.addDefineDatas(define._nativeObj);
            }
        }
        removeDefineDatas(define) {
        }
        has(define) {
            const words = this._readback, index = define._index >>> 0, value = define._value >>> 0;
            return (words === null || words === void 0 ? void 0 : words[0]) && index < words.length - 1
                ? (words[index + 1] & value) !== 0 : this._nativeObj.has(index, value);
        }
        clear() {
            this._nativeObj.clear();
        }
        cloneTo(destObject) {
            const dest = destObject;
            if (dest._nativeObj) {
                this._nativeObj.cloneTo(dest._nativeObj);
            }
        }
        clone() {
            let dest = new LayaXDefineDatas();
            this.cloneTo(dest);
            return dest;
        }
        destroy() {
            this._nativeObj.destroy();
        }
    }

    class LayaXShaderData extends Laya.ShaderData {
        constructor(ownerResource = null, createNativeObj = true) {
            super(ownerResource);
            this._defineDatas = new LayaXDefineDatas();
            this._renderStateListeners = new Set();
            this._handleId = 0;
            if (createNativeObj) {
                this._nativeObj = new window.conchLayaXShaderData(this._defineDatas._nativeObj);
                this._nativeObj.bindMatrixScratch(LayaXShaderData._matScratchBuf);
                this._handleId = this._nativeObj.getHandle();
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
            const textures = this._textureData;
            this._textureData = {};
            for (let index in textures) {
                let tex = textures[index];
                tex && tex._removeReference();
            }
            this._bufferData = {};
            this._deviceBufferData = {};
            this._defineDatas.clear();
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
        static _isRenderStateProp(index) {
            return index === Laya.Shader3D.CULL
                || index === Laya.Shader3D.BLEND
                || index === Laya.Shader3D.BLEND_SRC
                || index === Laya.Shader3D.BLEND_DST
                || index === Laya.Shader3D.BLEND_SRC_RGB
                || index === Laya.Shader3D.BLEND_DST_RGB
                || index === Laya.Shader3D.BLEND_SRC_ALPHA
                || index === Laya.Shader3D.BLEND_DST_ALPHA
                || index === Laya.Shader3D.BLEND_EQUATION
                || index === Laya.Shader3D.BLEND_EQUATION_RGB
                || index === Laya.Shader3D.BLEND_EQUATION_ALPHA
                || index === Laya.Shader3D.DEPTH_TEST
                || index === Laya.Shader3D.DEPTH_WRITE
                || index === Laya.Shader3D.STENCIL_TEST
                || index === Laya.Shader3D.STENCIL_WRITE
                || index === Laya.Shader3D.STENCIL_WRITE_MASK
                || index === Laya.Shader3D.STENCIL_READ_MASK
                || index === Laya.Shader3D.STENCIL_Ref
                || index === Laya.Shader3D.STENCIL_Op
                || index === Laya.Shader3D.DEPTH_BIAS
                || index === Laya.Shader3D.DEPTH_BIAS_CONSTANT
                || index === Laya.Shader3D.DEPTH_BIAS_SLOPESCALE
                || index === Laya.Shader3D.DEPTH_BIAS_CLAMP;
        }
        _notifyRenderStateChanged() {
            if (this._renderStateListeners.size > 0) {
                this._renderStateListeners.forEach(l => l._onRenderStateChanged());
            }
        }
        _addRenderStateListener(listener) {
            this._renderStateListeners.add(listener);
        }
        _removeRenderStateListener(listener) {
            this._renderStateListeners.delete(listener);
        }
        getBool(index) {
            return this._nativeObj.getBool(index);
        }
        setBool(index, value) {
            this._nativeObj.setBool(index, value);
            if (LayaXShaderData._isRenderStateProp(index))
                this._notifyRenderStateChanged();
        }
        getInt(index) {
            return this._nativeObj.getInt(index);
        }
        setInt(index, value) {
            this._nativeObj.setInt(index, value);
            if (LayaXShaderData._isRenderStateProp(index))
                this._notifyRenderStateChanged();
        }
        getNumber(index) {
            return this._nativeObj.getNumber(index);
        }
        setNumber(index, value) {
            this._nativeObj.setNumber(index, value);
            if (LayaXShaderData._isRenderStateProp(index))
                this._notifyRenderStateChanged();
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
            if (index === Laya.Shader3D.STENCIL_Op)
                this._notifyRenderStateChanged();
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
            _tempMatrix4x4.elements.set(LayaXShaderData._matScratch);
            return _tempMatrix4x4;
        }
        setMatrix4x4(index, value) {
            LayaXShaderData._matScratch.set(value.elements);
            this._nativeObj.setMatrix4x4FromScratch(index);
        }
        getMatrix3x3(index) {
            if (!this._nativeObj.getMatrix3x3ToScratch(index))
                return null;
            let _tempMatrix3x3 = new Laya.Matrix3x3();
            _tempMatrix3x3.elements.set(LayaXShaderData._matScratch.subarray(0, 9));
            return _tempMatrix3x3;
        }
        setMatrix3x3(index, value) {
            LayaXShaderData._matScratch.set(value.elements);
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
            value && value._addReference();
            this._textureData[index] = value;
            if (value && value._texture) {
                let tex = value._texture;
                if (tex instanceof LayaXInternalRT) {
                    let colorTex = tex._textures[0];
                    this._setInternalTexture(index, colorTex ? colorTex._nativeObj : null);
                }
                else {
                    this._setInternalTexture(index, tex._nativeObj);
                }
            }
            else {
                this._setInternalTexture(index, null);
            }
            lastValue && lastValue._removeReference();
        }
        _setInternalTexture(index, value) {
            let nativeVal = value ? value : null;
            this._nativeObj._setInternalTexture(index, nativeVal);
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
                        dest.setTexture(parseInt(k), value);
                    }
                }
            }
        }
        clone() {
            var dest = new LayaXShaderData();
            this.cloneTo(dest);
            return dest;
        }
        destroy() {
            this.clearData();
            this._nativeObj.destroy();
            this._defineDatas.destroy();
        }
    }
    LayaXShaderData._matScratchBuf = new ArrayBuffer(16 * 4);
    LayaXShaderData._matScratch = new Float32Array(LayaXShaderData._matScratchBuf);

    function getTypeString(type) {
        switch (type) {
            case Laya.ShaderDataType.Int:
                return "int";
            case Laya.ShaderDataType.Bool:
                return "bool";
            case Laya.ShaderDataType.Float:
                return "float";
            case Laya.ShaderDataType.Vector2:
                return "vec2";
            case Laya.ShaderDataType.Vector3:
                return "vec3";
            case Laya.ShaderDataType.Vector4:
            case Laya.ShaderDataType.Color:
                return "vec4";
            case Laya.ShaderDataType.Vector4u:
                return "uvec4";
            case Laya.ShaderDataType.Matrix4x4:
                return "mat4";
            case Laya.ShaderDataType.Matrix3x3:
                return "mat3";
            case Laya.ShaderDataType.Texture2D:
                return "sampler2D";
            case Laya.ShaderDataType.TextureCube:
                return "samplerCube";
            case Laya.ShaderDataType.Texture2DArray:
                if (Laya.LayaGL.renderEngine.getCapable(Laya.RenderCapable.Texture3D)) {
                    return "sampler2DArray";
                }
                else {
                    return "";
                }
            case Laya.ShaderDataType.Texture3D:
                if (Laya.LayaGL.renderEngine.getCapable(Laya.RenderCapable.Texture3D)) {
                    return "sampler3D";
                }
                else {
                    return "";
                }
            default:
                return "";
        }
    }
    function getTypeDefaultString(type) {
        switch (type) {
            case Laya.ShaderDataType.Int:
                return "0";
            case Laya.ShaderDataType.Bool:
                return "false";
            case Laya.ShaderDataType.Float:
                return "0.0";
            case Laya.ShaderDataType.Vector2:
                return "vec2(0.0)";
            case Laya.ShaderDataType.Vector3:
                return "vec3(0.0)";
            case Laya.ShaderDataType.Vector4:
            case Laya.ShaderDataType.Color:
                return "vec4(0.0)";
            default:
                return "";
        }
    }
    function isSamplerType(type) {
        switch (type) {
            case Laya.ShaderDataType.Texture2D:
            case Laya.ShaderDataType.Texture3D:
            case Laya.ShaderDataType.TextureCube:
            case Laya.ShaderDataType.Texture2DArray:
                return true;
            case Laya.ShaderDataType.None:
            case Laya.ShaderDataType.Int:
            case Laya.ShaderDataType.Bool:
            case Laya.ShaderDataType.Float:
            case Laya.ShaderDataType.Vector2:
            case Laya.ShaderDataType.Vector3:
            case Laya.ShaderDataType.Vector4:
            case Laya.ShaderDataType.Color:
            case Laya.ShaderDataType.Buffer:
            case Laya.ShaderDataType.Matrix4x4:
            case Laya.ShaderDataType.Matrix3x3:
            default:
                return false;
        }
    }

    const uniformRegex = /(?:layout\s*\([^)]*\)\s*)?\buniform\s+(?:(lowp|mediump|highp)\s+)?(?:(?:readonly|writeonly|coherent|volatile|restrict)\s+)*(\w+)\s+(\w+)(\s*\[\s*(\d+)\s*\])?\s*;/gm;
    const uniformBlockRegex = /(?:layout\s*\([^)]*\)\s*)?uniform\s+(\w+)\s*\{([\s\S]*?)\}\s*;/g;
    function removeBindingSuffix(name, suffix) {
        return name.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
    }
    class LayaX_GLSLForVulkanGenerator {
        static layax_process(defines, attributeMap, uniformMap, shaderPassName, materialMap, VS, FS, useTexArray, checkSetNumber, appendSet) {
            const engine = LayaXRenderEngine._instance;
            let defMap = {};
            for (const define of defines) {
                defMap[define] = true;
            }
            defMap["GRAPHICS_API_GLES3"] = true;
            defMap["COLORKEYCOUNT_8"] = true;
            defMap["COLOROVERLIFETIME_COLORKEY_8"] = true;
            defMap["GRADIENTKEYCOUNT_8"] = true;
            let vs = VS.toscript(defMap, []);
            let fs = FS.toscript(defMap, []);
            if (vs[0].indexOf("#version") == 0) {
                vs[0] + '\n';
            }
            if (fs[0].indexOf("#version") == 0) {
                fs[0] + '\n';
            }
            let vertexCode = vs.join('\n');
            let fragmentCode = fs.join('\n');
            const mrtTargetCount = Laya.ShaderMRT.getTargetCount(defines);
            const mrt = mrtTargetCount > 0 || defines.indexOf(Laya.ShaderMRT.defineName) !== -1;
            if (mrtTargetCount)
                fragmentCode = Laya.ShaderMRT.prepare(fragmentCode, mrtTargetCount);
            const defineStrs = defineString(defMap);
            const additionDefineStrs = additionDefineString();
            const precision = `precision highp float;
        precision highp int;`;
            {
                let vs = `layout(std140, column_major) uniform;
#define attribute in
#define varying out
#define textureCube texture
#define texture2D texture

${defineStrs}

${additionDefineStrs}

${vertexCode}
`;
                let resVS = engine.shaderCompiler.glslang.glsl300es_preprocess(vs, "vertex");
                if (!resVS.success) {
                    console.error("vertex shader preprocess error", resVS.info_log);
                }
                vertexCode = resVS.preprocessed_code;
                vertexCode = renameMainFunction(vertexCode, "main_vs");
                let fs = `layout(std140, column_major) uniform;
#define varying in
${mrt ? "" : "out highp vec4 pc_fragColor;\n#define gl_FragColor pc_fragColor"}
#define gl_FragDepthEXT gl_FragDepth
#define texture2D texture
#define textureCube texture
#define texture2DProj textureProj
#define texture2DLodEXT textureLod
#define texture2DProjLodEXT textureProjLod
#define textureCubeLodEXT textureLod
#define texture2DGradEXT textureGrad
#define texture2DProjGradEXT textureProjGrad
#define textureCubeGradEXT textureGrad

${defineStrs}

${additionDefineStrs}

${fragmentCode}
`;
                let resFS = engine.shaderCompiler.glslang.glsl300es_preprocess(fs, "fragment");
                if (!resFS.success) {
                    if (mrt)
                        throw new Error(`LAYA_MRT fragment preprocessing failed: ${resFS.info_log}`);
                    console.error("fragment shader preprocess error", resFS.info_log);
                }
                fragmentCode = resFS.preprocessed_code;
            }
            const attributeStrs = attributeString(attributeMap[0], attributeMap[1]);
            const { varyings, vsOnlyVaryings } = executeVaryings(fragmentCode, vertexCode);
            const vertexVaryingStrs = varyingString(varyings, "out");
            const fragmentVaryingStrs = varyingString(varyings, "in");
            let vsOnlyGlobalStrs = "";
            for (const v of vsOnlyVaryings) {
                vsOnlyGlobalStrs += `${v}\n`;
            }
            const mrtOutputs = mrt ? Laya.ShaderMRT.extract(fragmentCode, mrtTargetCount > 0) : null;
            const fragmentOutStrs = mrtOutputs ? mrtOutputs.declarations : fragmentOutString();
            if (mrtOutputs)
                fragmentCode = mrtOutputs.source;
            let collectionUniforms = new Map();
            const materialUniformNames = new Set();
            if (materialMap && materialMap.size > 0) {
                materialMap.forEach((uniform) => {
                    materialUniformNames.add(uniform.propertyName);
                    if (!collectionUniforms.has(uniform.propertyName)) {
                        collectionUniforms.set(uniform.propertyName, {
                            type: uniform.uniformtype,
                            arrayLength: uniform.arrayLength > 0 ? uniform.arrayLength : undefined,
                            registeredInMaterialMap: true,
                        });
                    }
                });
            }
            const uniformCollect = (match, precision, type, name, arrayDecl, arrayLength) => {
                const oldUniform = collectionUniforms.get(name);
                let u = {
                    type: getShaderDataType(type),
                    declaredInGlsl: true,
                    registeredInMaterialMap: (oldUniform === null || oldUniform === void 0 ? void 0 : oldUniform.registeredInMaterialMap) || materialUniformNames.has(name),
                };
                if (u.type != Laya.ShaderDataType.None) {
                    collectionUniforms.set(name, u);
                }
                if (type == "sampler2DShadow" || type == "samplerCubeShadow" || type == "sampler2DArrayShadow") {
                    u.samplerType = "depth";
                }
                if (type == "sampler2DArray") {
                    u.demision = "2d-array";
                }
                if (type == "samplerCube") {
                    u.demision = "cube";
                }
                if (arrayLength) {
                    let length = parseInt(arrayLength);
                    u.arrayLength = length;
                }
                return "\n";
            };
            vertexCode = vertexCode.replace(uniformRegex, uniformCollect);
            fragmentCode = fragmentCode.replace(uniformRegex, uniformCollect);
            const executeUniforms = (value, key) => {
                value.forEach(uniform => {
                    var _a;
                    if (uniform.type == exports.LayaXBindingInfoType.texture) {
                        let name = removeBindingSuffix(uniform.name, "_Texture");
                        let collect = collectionUniforms.get(name);
                        if (collect) {
                            collect.set = uniform.set;
                        }
                    }
                    if (uniform.type == exports.LayaXBindingInfoType.sampler) {
                        let name = removeBindingSuffix(uniform.name, "_Sampler");
                        let collect = collectionUniforms.get(name);
                        if (collect) {
                            collect.set = uniform.set;
                        }
                        else if (key < checkSetNumber) {
                            uniform.texture.sampleType;
                            if (((_a = uniform.sampler) === null || _a === void 0 ? void 0 : _a.type) == "comparison") ;
                            collectionUniforms.set(name, { type: Laya.ShaderDataType.Texture2D, set: uniform.set });
                        }
                    }
                    if (uniform.type == exports.LayaXBindingInfoType.storageBuffer) {
                        let collect = collectionUniforms.get(uniform.name);
                        if (collect) {
                            collect.set = uniform.set;
                        }
                    }
                    if (uniform.type == exports.LayaXBindingInfoType.buffer) {
                        let name = uniform.name;
                        let commandMap = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap(name);
                        commandMap._idata.forEach((u, i) => {
                            let collect = collectionUniforms.get(u.propertyName);
                            if (collect) {
                                collect.set = uniform.set;
                            }
                        });
                    }
                });
            };
            uniformMap.forEach(executeUniforms);
            if (appendSet >= 0) {
                let wildUniforms = [];
                collectionUniforms.forEach((value, name) => {
                    if (value.set == undefined) {
                        if (value.declaredInGlsl && !value.registeredInMaterialMap) {
                            const arrayInfo = value.arrayLength ? `[${value.arrayLength}]` : "";
                            wildUniforms.push(`${name}${arrayInfo}:${Laya.ShaderDataType[value.type]}`);
                        }
                    }
                });
                if (wildUniforms.length > 0) {
                    console.error(`[LayaX] Shader "${shaderPassName}" declares uniforms in GLSL that are not registered before material creation. ` +
                        `Missing: ${wildUniforms.join(", ")}`);
                }
            }
            vertexCode = vertexCode.replace(uniformBlockRegex, '\n');
            fragmentCode = fragmentCode.replace(uniformBlockRegex, '\n');
            vertexCode = vertexCode.replace(vertexVaryingRegex, '\n');
            fragmentCode = fragmentCode.replace(fragmentVaryingRegex, '\n');
            if (!mrt)
                fragmentCode = fragmentCode.replace(vertexVaryingRegex, "");
            vertexCode = replaceTextureSampler(vertexCode, useTexArray);
            fragmentCode = replaceTextureSampler(fragmentCode, useTexArray);
            {
                let texturePropertyIds = [];
                for (const texName of useTexArray) {
                    if (texName.endsWith("_Texture")) {
                        texturePropertyIds.push(Laya.Shader3D.propertyNameToID(texName.substring(0, texName.length - 8)));
                    }
                }
                uniformMap.forEach((value, key) => {
                    if (key < checkSetNumber)
                        return;
                    let filtered = [];
                    for (const info of value) {
                        if (info.type === exports.LayaXBindingInfoType.texture || info.type === exports.LayaXBindingInfoType.sampler) {
                            if (texturePropertyIds.includes(info.propertyId)) {
                                filtered.push(info);
                            }
                        }
                        else {
                            filtered.push(info);
                        }
                    }
                    for (let i = 0; i < filtered.length; i++) {
                        filtered[i].binding = i;
                    }
                    uniformMap.set(key, filtered);
                });
            }
            vertexCode = vertexCode.replace(/gl_VertexID/g, "gl_VertexIndex");
            fragmentCode = fragmentCode.replace(/gl_VertexID/g, "gl_VertexIndex");
            const uniformStrs = uniformString2(uniformMap, materialMap, useTexArray, collectionUniforms, checkSetNumber, appendSet);
            const glslVersion = "#version 450\n";
            let vertex = `${glslVersion}
${precision}

${defineStrs}

${attributeStrs}

${uniformStrs}

${vertexVaryingStrs}

${vsOnlyGlobalStrs}

${vertexCode}
`;
            let fragment = `${glslVersion}
${precision}

${fragmentOutStrs}

${additionDefineStrs}

${defineStrs}

${uniformStrs}

${fragmentVaryingStrs}

${fragmentCode}
`;
            return {
                vertex,
                fragment,
                hasSampler: collectionUniforms.size > 0
            };
        }
        static proccessCompute(defines, uniformCommandMaps, uniformMaps, node, shaderName) {
            const engine = LayaXRenderEngine._instance;
            let defMap = {};
            for (const define of defines) {
                defMap[define] = true;
            }
            let code = node.toscript(defMap, []);
            let computeCode = code.join('\n');
            const defineStrs = defineString(defMap);
            const glslVersion = "#version 450\n";
            const ssboBindingMap = new Map();
            const getUniformDeclaration = (uniformMaps, usedTex) => {
                let res = "";
                const emittedBlockUniforms = new Set();
                uniformMaps.forEach((value, set) => {
                    for (let uniform of value) {
                        switch (uniform.type) {
                            case exports.LayaXBindingInfoType.storageBuffer: {
                                let setIndex = set;
                                let bindingIndex = uniform.binding;
                                ssboBindingMap.set(uniform.name, { set: setIndex, binding: bindingIndex });
                                break;
                            }
                            case exports.LayaXBindingInfoType.storageTexture:
                                {
                                    let access = wgslAccessToGlsl(uniform.storageTexture.access);
                                    res = `${res}layout(${uniform.format ? uniform.format : "rgba8"}, set=${set}, binding=${uniform.binding}) uniform ${access} image2D ${uniform.name};\n`;
                                    break;
                                }
                            case exports.LayaXBindingInfoType.buffer: {
                                let commandMap = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap(uniform.name);
                                if (commandMap._hasUniformBuffer) {
                                    let uniformMap = commandMap._idata;
                                    res = `${res}${uniformMapString(uniformMap, uniform.name, uniform.set, uniform.binding, true, new Map(), emittedBlockUniforms).code}\n`;
                                }
                                break;
                            }
                            case exports.LayaXBindingInfoType.texture: {
                                const textureName = removeBindingSuffix(uniform.name, "_Texture");
                                if (!usedTex || usedTex.has(textureName)) {
                                    const textureType = getSamplerTextureType(uniform.texture.sampleType, uniform.texture.viewDimension);
                                    res = `${res}layout(set=${set}, binding=${uniform.binding}) uniform ${textureType} ${textureName};\n`;
                                }
                                break;
                            }
                        }
                    }
                });
                return res;
            };
            const uniformStr = getUniformDeclaration(uniformMaps);
            let resCode = getComputeCode(glslVersion, defineStrs, uniformStr, computeCode);
            let preprocessRes = engine.shaderCompiler.glslang.preprocess_compute(resCode, 'compute');
            if (!preprocessRes.success) {
                console.error(`LayaXComputeShader ${shaderName} preprocess error:`, preprocessRes.info_log);
                return {};
            }
            computeCode = computeCode.replace(uniformRegex, "");
            if (preprocessRes.uniforms.size > 0 || preprocessRes.ssbos.size > 0) {
                const exists = new Map();
                uniformMaps.forEach(properties => {
                    for (let uniform of properties) {
                        exists.set(uniform.propertyId, uniform);
                    }
                });
                let additionMaps = uniformCommandMaps[0];
                let addNewUniform = false;
                let uniformNames = preprocessRes.uniforms.keys();
                for (let name of uniformNames) {
                    let propertyId = Laya.Shader3D.propertyNameToID(name);
                    if (!exists.has(propertyId)) {
                        let info = preprocessRes.uniforms.get(name);
                        let type = info.type;
                        info.access;
                        let arrayLength = getArrayLength(type);
                        if (arrayLength > 0) {
                            type = type.substring(0, type.lastIndexOf('['));
                            additionMaps.addShaderUniformArray(propertyId, name, getShaderDataType(type), arrayLength);
                        }
                        else {
                            additionMaps.addShaderUniform(propertyId, name, getShaderDataType(type), info);
                        }
                        addNewUniform = true;
                    }
                }
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
                        switch (uniform.buffer.type) {
                            case "storage":
                                if (access == "readonly") {
                                    console.warn(`Shader ${shaderName} ssbo access type mismatch for ${name}`);
                                }
                                break;
                            case "read-only-storage":
                                if (access != "readonly") {
                                    console.warn(`Shader ${shaderName} ssbo access type mismatch for ${name}`);
                                }
                                break;
                        }
                    }
                }
                if (addNewUniform || addNewSSBO) {
                    uniformMaps.set(0, LayaXBindGroupHelper.createBindingInfoArray(0, [additionMaps._stateName]));
                }
                ssboBindingMap.clear();
                const newUniformStr = getUniformDeclaration(uniformMaps, preprocessRes.uniforms);
                computeCode = ssboStrings(ssboBindingMap, computeCode);
                resCode = getComputeCode(glslVersion, defineStrs, newUniformStr, computeCode);
                return {
                    code: resCode,
                    hasSampler: preprocessRes.samplers.size > 0
                };
            }
            computeCode = ssboStrings(ssboBindingMap, computeCode);
            resCode = getComputeCode(glslVersion, defineStrs, uniformStr, computeCode);
            return {
                code: resCode,
                hasSampler: preprocessRes.samplers.size > 0
            };
        }
    }
    function defineString(defines) {
        let res = "";
        for (const key in defines) {
            if (defines[key]) {
                res += `#define ${key}\n`;
            }
        }
        return res;
    }
    function attributeString(attributeMap, nouseAttributeMap) {
        let res = "";
        let location = 0;
        let attributeDefines = "";
        for (const key in attributeMap) {
            let type = getTypeString(attributeMap[key][1]);
            if (key == "a_BoneIndices") {
                type = "uvec4";
            }
            location = attributeMap[key][0];
            if (type != "") {
                if (type == "mat4") {
                    res = `${res}layout(location = ${location++}) in vec4 ${key}_0;\n`;
                    res = `${res}layout(location = ${location++}) in vec4 ${key}_1;\n`;
                    res = `${res}layout(location = ${location++}) in vec4 ${key}_2;\n`;
                    res = `${res}layout(location = ${location}) in vec4 ${key}_3;\n`;
                    attributeDefines = `${attributeDefines}#define ${key} mat4(${key}_0, ${key}_1, ${key}_2, ${key}_3)\n`;
                }
                else {
                    res = `${res}layout(location = ${location}) in ${type} ${key};\n`;
                }
            }
        }
        for (const key in nouseAttributeMap) {
            let type = getTypeString(nouseAttributeMap[key][1]);
            let defaultValue = getTypeDefaultString(nouseAttributeMap[key][1]);
            if (key == "a_BoneIndices") {
                type = "uvec4";
                defaultValue = "uvec4(0)";
            }
            nouseAttributeMap[key][0];
            if (type != "") {
                if (type == "mat4") {
                    res = `${res}const vec4 ${key}_0 = vec4(0.0);\n`;
                    res = `${res}const vec4 ${key}_1 = vec4(0.0);\n`;
                    res = `${res}const vec4 ${key}_2 = vec4(0.0);\n`;
                    res = `${res}const vec4 ${key}_3 = vec4(0.0);\n`;
                    attributeDefines = `${attributeDefines}#define ${key} mat4(${key}_0, ${key}_1, ${key}_2, ${key}_3)\n`;
                }
                else {
                    res = `${res}const ${type} ${key} =${defaultValue};\n`;
                }
            }
        }
        return `${res}
${attributeDefines}
`;
    }
    function uniformMapString(uniformMap, name, set, bindOffset, skipTexture, collectUniforms, emittedBlockUniforms) {
        var _a;
        let textureUniforms = [];
        let blockUniforms = [];
        uniformMap.forEach(uniform => {
            if (isSamplerType(uniform.uniformtype)) {
                textureUniforms.push(uniform);
            }
            else if (!emittedBlockUniforms.has(uniform.propertyName)) {
                blockUniforms.push(uniform);
                emittedBlockUniforms.add(uniform.propertyName);
            }
        });
        let res = "";
        let binding = bindOffset;
        if (blockUniforms.length > 0) {
            const blockName = /^[A-Za-z_]\w*$/.test(name) ? name : `LayaUBO_${set}_${binding}`;
            res = `${res}layout(std140, set=${set}, binding=${binding++}) uniform ${blockName} {`;
            for (let uniform of blockUniforms) {
                let uniformName = uniform.propertyName;
                if (uniform.arrayLength > 0) {
                    let arrayLength = ((_a = collectUniforms.get(uniformName)) === null || _a === void 0 ? void 0 : _a.arrayLength) || uniform.arrayLength;
                    uniformName = `${uniformName}[${arrayLength}]`;
                }
                let typeStr = getTypeString(uniform.uniformtype);
                if (typeStr != "") {
                    res = `${res}
    ${typeStr} ${uniformName};`;
                }
            }
            res = `${res}
};
`;
        }
        if (!skipTexture && textureUniforms.length > 0) {
            for (let uniform of textureUniforms) {
                switch (uniform.uniformtype) {
                    case Laya.ShaderDataType.Texture2D:
                        res = `${res}layout(set=${set}, binding=${binding++}) uniform texture2D ${uniform.propertyName}_Texture;
 layout(set=${set}, binding=${binding++}) uniform sampler ${uniform.propertyName}_Sampler;
`;
                        break;
                    case Laya.ShaderDataType.TextureCube:
                        res = `${res}layout(set=${set}, binding=${binding++}) uniform texture2D ${uniform.propertyName}_Texture;
layout(set=${set}, binding=${binding++}) uniform sampler ${uniform.propertyName}_Sampler;
`;
                        break;
                    case Laya.ShaderDataType.Texture2DArray:
                    case Laya.ShaderDataType.Texture3D:
                }
            }
        }
        return {
            code: res,
            binding: binding
        };
    }
    function uniformString2(uniformSetMap, materialMap, usedTexSet, collectUniforms, checkSetNumber, appendSet) {
        let res = "";
        let samplerMap = new Map();
        const emittedBlockUniforms = new Set();
        uniformSetMap.forEach((value, key) => {
            var _a;
            if (value.length > 0) {
                for (let uniform of value) {
                    switch (uniform.type) {
                        case exports.LayaXBindingInfoType.storageBuffer:
                            break;
                        case exports.LayaXBindingInfoType.storageTexture:
                            break;
                        case exports.LayaXBindingInfoType.buffer:
                            {
                                let uniformMap = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap(uniform.name)._idata;
                                if (key == appendSet) {
                                    uniformMap = materialMap;
                                }
                                res = `${res}${uniformMapString(uniformMap, uniform.name, uniform.set, uniform.binding, true, collectUniforms, emittedBlockUniforms).code}\n`;
                                break;
                            }
                        case exports.LayaXBindingInfoType.texture:
                            {
                                let textureName = removeBindingSuffix(uniform.name, "_Texture");
                                let collectUniform = collectUniforms.get(textureName);
                                if (collectUniform) {
                                    uniform.texture.sampleType = uniform.texture.sampleType;
                                    uniform.texture.viewDimension = collectUniform.demision || uniform.texture.viewDimension;
                                }
                                let textureType = getDimensionTextureType((_a = uniform.texture) === null || _a === void 0 ? void 0 : _a.viewDimension);
                                res = `${res}layout(set=${uniform.set}, binding=${uniform.binding}) uniform ${textureType} ${uniform.name};\n`;
                                let samplerName = removeBindingSuffix(uniform.name, "_Texture");
                                samplerMap.set(samplerName, uniform);
                            }
                            break;
                        case exports.LayaXBindingInfoType.sampler:
                            {
                                let sampler = "sampler";
                                let samplerName = removeBindingSuffix(uniform.name, "_Sampler");
                                let collectUniform = collectUniforms.get(samplerName);
                                if (collectUniform) {
                                    if (collectUniform.samplerType == "depth") {
                                        uniform.sampler.type = "comparison";
                                        sampler = "samplerShadow";
                                    }
                                }
                                res = `${res}layout(set=${uniform.set}, binding=${uniform.binding}) uniform ${sampler} ${uniform.name};\n`;
                            }
                            break;
                    }
                }
            }
        });
        let samplerDefStrs = "\n";
        samplerMap.forEach((uniform, key) => {
            var _a;
            let sampleType = ((_a = collectUniforms.get(key)) === null || _a === void 0 ? void 0 : _a.samplerType) || uniform.texture.sampleType;
            let sampler = getSamplerTextureType(sampleType, uniform.texture.viewDimension);
            samplerDefStrs += `#define ${key} ${sampler}(${uniform.name}, ${key}_Sampler)\n`;
            uniform.texture.sampleType = sampleType;
        });
        return res + samplerDefStrs;
    }
    function getVaryingRegex(ioType) {
        return new RegExp(`(?:(flat|smooth|noperspective)\\s+)?${ioType}\\s+(?:(lowp|mediump|highp)\\s+)?(\\w+)\\s+(\\w+)\\s*;`, 'g');
    }
    const vertexVaryingRegex = getVaryingRegex("out");
    const fragmentVaryingRegex = getVaryingRegex("in");
    function findVaryings(source, regex) {
        let varyings = [];
        let result;
        while ((result = regex.exec(source)) !== null) {
            const interpolation = result[1] ? `${result[1]} ` : '';
            const precision = result[2] ? `${result[2]} ` : '';
            const type = result[3].trim();
            const name = result[4].trim();
            varyings.push(`${interpolation} ${precision} ${type} ${name};`);
        }
        return varyings;
    }
    function varyingString(varyings, io) {
        let res = "";
        for (let i = 0; i < varyings.length; i++) {
            res += `layout(location = ${i}) ${io} ${varyings[i]}\n`;
        }
        return res;
    }
    function executeVaryings(fsSource, vsSource) {
        let vertexVaryings = findVaryings(vsSource, vertexVaryingRegex);
        let fragmentVaryings = findVaryings(fsSource, fragmentVaryingRegex);
        let varyings = vertexVaryings.filter(item => fragmentVaryings.includes(item));
        let vsOnlyVaryings = vertexVaryings.filter(item => !fragmentVaryings.includes(item));
        return { varyings, vsOnlyVaryings };
    }
    function fragmentOutString(source) {
        return "layout(location = 0) out vec4 pc_fragColor;";
    }
    function replaceTextureSampler(source, usedTexSet) {
        const textureRegx = /texture\s*\(\s*([\w_]+)\s*,\s*([^)]*)\s*\)/g;
        let newSource = source.replace(textureRegx, (match, textureName, uvName) => {
            usedTexSet.add(`${textureName}_Texture`);
            usedTexSet.add(`${textureName}_Sampler`);
            return match;
        });
        const textureProjRegx = /textureProj\s*\(\s*([\w_]+)\s*,\s*([^)]*)\s*\)/g;
        newSource = newSource.replace(textureProjRegx, (match, textureName, uvName) => {
            usedTexSet.add(`${textureName}_Texture`);
            usedTexSet.add(`${textureName}_Sampler`);
            return match;
        });
        const textureLodRegx = /textureLod\s*\(\s*([\w_]+)\s*,\s*([^,]+)\s*,\s*([^)]*)\s*\)/g;
        newSource = newSource.replace(textureLodRegx, (match, textureName, uvName, lodName) => {
            usedTexSet.add(`${textureName}_Texture`);
            usedTexSet.add(`${textureName}_Sampler`);
            return match;
        });
        const textureProjLodRegx = /textureProjLod\s*\(\s*([\w_]+)\s*,\s*([^,]+)\s*,\s*([^)]*)\s*\)/g;
        newSource = newSource.replace(textureProjLodRegx, (match, textureName, uvName, lodName) => {
            usedTexSet.add(`${textureName}_Texture`);
            usedTexSet.add(`${textureName}_Sampler`);
            return match;
        });
        const textureGradRegx = /textureGrad\s*\(\s*([\w_]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]*)\s*\)/g;
        newSource = newSource.replace(textureGradRegx, (match, textureName, uvName, ddxName, ddyName) => {
            usedTexSet.add(`${textureName}_Texture`);
            usedTexSet.add(`${textureName}_Sampler`);
            return match;
        });
        const textureProjGradRegx = /textureProjGrad\s*\(\s*([\w_]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]*)\s*\)/g;
        newSource = newSource.replace(textureProjGradRegx, (match, textureName, uvName, ddxName, ddyName) => {
            usedTexSet.add(`${textureName}_Texture`);
            usedTexSet.add(`${textureName}_Sampler`);
            return match;
        });
        return newSource;
    }
    function additionDefineString() {
        return `
#define MAX_LIGHT_COUNT ${Laya.Config3D.maxLightCount}
#define MAX_LIGHT_COUNT_PER_CLUSTER ${Laya.Config3D._maxAreaLightCountPerClusterAverage}
#define CLUSTER_X_COUNT ${Laya.Config3D.lightClusterCount.x}
#define CLUSTER_Y_COUNT ${Laya.Config3D.lightClusterCount.y}
#define CLUSTER_Z_COUNT ${Laya.Config3D.lightClusterCount.z}
#define MORPH_MAX_COUNT ${Laya.Config3D.maxMorphTargetCount}
#define SHADER_CAPAILITY_LEVEL ${Laya.LayaGL.renderEngine.getParams(Laya.RenderParams.SHADER_CAPAILITY_LEVEL)}
`;
    }
    function getSamplerTextureType(type = "float", dimension = "2d") {
        if (dimension == "2d") {
            switch (type) {
                case "depth":
                    return "sampler2DShadow";
                case "float":
                case "unfilterable-float":
                case "sint":
                case "uint":
                default:
                    return "sampler2D";
            }
        }
        else if (dimension == "cube") {
            switch (type) {
                case "depth":
                    return "samplerCubeShadow";
                default:
                    return "samplerCube";
            }
        }
        else if (dimension == "2d-array") {
            switch (type) {
                case "depth":
                    return "sampler2DArrayShadow";
                default:
                    return "sampler2DArray";
            }
        }
        else if (dimension == "3d") {
            switch (type) {
                case "depth":
                    return "sampler3DShadow";
                default:
                    return "sampler3D";
            }
        }
        else if (dimension == "cube-array") {
            switch (type) {
                case "depth":
                    return "samplerCubeArrayShadow";
                default:
                    return "samplerCubeArray";
            }
        }
        else if (dimension == "1d") {
            switch (type) {
                case "depth":
                    return "sampler1DShadow";
                default:
                    return "sampler1D";
            }
        }
        else {
            return "sampler2D";
        }
    }
    function getDimensionTextureType(type) {
        switch (type) {
            case "1d":
                return "texture1D";
            case "2d":
                return "texture2D";
            case "2d-array":
                return "texture2DArray";
            case "cube":
                return "textureCube";
            case "cube-array":
                return "textureCubeArray";
            case "3d":
                return "texture3D";
            default:
                return "texture2D";
        }
    }
    function getShaderDataType(type) {
        switch (type) {
            case "float":
                return Laya.ShaderDataType.Float;
            case "int":
            case "uint":
                return Laya.ShaderDataType.Int;
            case "bool":
                return Laya.ShaderDataType.Bool;
            case "vec2":
                return Laya.ShaderDataType.Vector2;
            case "vec3":
                return Laya.ShaderDataType.Vector3;
            case "vec4":
                return Laya.ShaderDataType.Vector4;
            case "mat3":
                return Laya.ShaderDataType.Matrix3x3;
            case "mat4":
                return Laya.ShaderDataType.Matrix4x4;
            case "sampler2D":
            case "sampler2DShadow":
                return Laya.ShaderDataType.Texture2D;
            case "samplerCube":
            case "samplerCubeShadow":
                return Laya.ShaderDataType.TextureCube;
            case "sampler2DArray":
            case "sampler2DArrayShadow":
                return Laya.ShaderDataType.Texture2DArray;
            case "image2D":
                return Laya.ShaderDataType.StorageTexture2D;
            default:
                return Laya.ShaderDataType.None;
        }
    }
    function wgslAccessToGlsl(access) {
        switch (access) {
            case "read-only":
                return "readonly";
            case "read-write":
                return "";
            case "write-only":
            default:
                return "writeonly";
        }
    }
    function getArrayLength(name) {
        let endPos = name.lastIndexOf(']');
        let startPos = name.lastIndexOf('[');
        if (startPos != -1 && endPos == name.length - 1) {
            let arrayLengthStr = name.slice(startPos + 1, endPos);
            let arrayLength = parseInt(arrayLengthStr);
            if (!isNaN(arrayLength) && arrayLength > 0) {
                return arrayLength;
            }
        }
        return 0;
    }
    function getComputeCode(glslVersion, defineStrs, uniformStr, computeCode) {
        return `${glslVersion}

layout(std140, column_major) uniform;
layout(std430, column_major) buffer;

${defineStrs}

${uniformStr}

${computeCode}
`;
    }
    const mainFuncRegex = /\bvoid\s+main\s*\(\s*\)/;
    function renameMainFunction(source, newName) {
        const newCode = source.replace(mainFuncRegex, `void ${newName}()`);
        return newCode;
    }
    const ssboRegexCompat = /((?:layout\s*\([^)]*\)\s*)*)\s*((?:(?:readonly|writeonly|coherent|volatile|restrict)\s+)*)buffer\s+([A-Za-z_]\w*)\s*\{([\s\S]*?)\}\s*([A-Za-z_]\w*)?\s*;/g;
    function ssboStrings(ssboBindingMap, code) {
        code = code.replace(ssboRegexCompat, (match, layoutStr, readonlyStr, blockName, body, instanceName) => {
            let bindingInfo = ssboBindingMap.get(blockName);
            if (bindingInfo) {
                let newLayoutStr = `layout(std430, set = ${bindingInfo.set}, binding = ${bindingInfo.binding}) `;
                if (readonlyStr.startsWith("writeonly")) {
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

    class LayaXShaderInstance {
        constructor() {
            this.bindingInfoMap = new Map();
            this._resourcesCacheKey = new Map();
            this.textureExitsMap = new Map();
        }
        _serializeShader() {
            throw new Laya.NotImplementedError();
        }
        _deserialize(buffer) {
            throw new Laya.NotImplementedError();
        }
        _create(shaderProcessInfo, shaderPass) {
            this._shaderPass = shaderPass;
            const moduleData = shaderPass.moduleData;
            const setMapNames = moduleData.compileSetMapNames;
            if (!setMapNames || setMapNames.size === 0) {
                console.warn("LayaXShaderInstance._create: no set→map names available");
            }
            if (setMapNames) {
                for (const [setIndex, mapNames] of setMapNames) {
                    for (const mapName of mapNames) {
                        this._ensureCommandMapPopulated(mapName, shaderPass);
                    }
                    const bindings = LayaXBindGroupHelper.createBindingInfoArray(setIndex, mapNames);
                    this.bindingInfoMap.set(setIndex, bindings);
                    this._resourcesCacheKey.set(setIndex, mapNames);
                }
            }
            let attriLocArray = shaderPass.moduleData.attributeLocations;
            let filteredAttributeMap = {};
            let noUseAttributeMap = {};
            for (const [key, value] of Object.entries(shaderProcessInfo.attributeMap)) {
                if (attriLocArray.has(value[0])) {
                    filteredAttributeMap[key] = value;
                }
                else {
                    noUseAttributeMap[key] = value;
                }
            }
            let useTexSet = new Set();
            let cullTextureSetLayer = shaderProcessInfo.is2D ? 3 : 2;
            let materialSetIndex = -1;
            if (setMapNames) {
                const passName = shaderPass.name;
                for (const [setIndex, mapNames] of setMapNames) {
                    if (mapNames.includes(passName)) {
                        materialSetIndex = setIndex;
                        break;
                    }
                }
            }
            let useMaterial = Laya.Config.matUseUBO;
            Laya.Config.matUseUBO = (!shaderProcessInfo.is2D) && Laya.Config.matUseUBO;
            const glslObj = LayaX_GLSLForVulkanGenerator.layax_process(shaderProcessInfo.defineString, [filteredAttributeMap, noUseAttributeMap], this.bindingInfoMap, shaderPass.name, shaderPass._owner._uniformMap, shaderProcessInfo.vs, shaderProcessInfo.ps, useTexSet, cullTextureSetLayer, materialSetIndex);
            Laya.Config.matUseUBO = useMaterial;
            const engine = LayaXRenderEngine._instance;
            let vs_wgsl = "";
            let fs_wgsl = "";
            {
                let vertexSpvRes = engine.shaderCompiler.glslang.glsl450_to_spirv(glslObj.vertex, "vertex");
                if (!vertexSpvRes.success) {
                    let subShader = this._shaderPass._owner;
                    let shader = subShader._owner;
                    let subIndex = shader._subShaders.indexOf(subShader);
                    let passIndex = subShader._passes.indexOf(this._shaderPass);
                    console.error(`${shader.name}_sub${subIndex}_pass${passIndex}`);
                    console.error(vertexSpvRes.info_log);
                    throw Object.assign(new Error(`${shader.name}_sub${subIndex}_pass${passIndex}: vertex compilation failed: ${vertexSpvRes.info_log}`), { shaderSource: glslObj.vertex });
                }
                let vertexSpirv = new Uint8Array(vertexSpvRes.spirv.buffer, vertexSpvRes.spirv.byteOffset, vertexSpvRes.spirv.byteLength);
                let fragmentSpvRes = engine.shaderCompiler.glslang.glsl450_to_spirv(glslObj.fragment, "fragment");
                if (!fragmentSpvRes.success) {
                    let subShader = this._shaderPass._owner;
                    let shader = subShader._owner;
                    let subIndex = shader._subShaders.indexOf(subShader);
                    let passIndex = subShader._passes.indexOf(this._shaderPass);
                    console.error(`${shader.name}_sub${subIndex}_pass${passIndex}`);
                    console.error(fragmentSpvRes.info_log);
                    throw Object.assign(new Error(`${shader.name}_sub${subIndex}_pass${passIndex}: fragment compilation failed: ${fragmentSpvRes.info_log}`), { shaderSource: glslObj.fragment });
                }
                let fragmentSpv = new Uint8Array(fragmentSpvRes.spirv.buffer, fragmentSpvRes.spirv.byteOffset, fragmentSpvRes.spirv.byteLength);
                vs_wgsl = engine.shaderCompiler.naga.spirv_to_wgsl(vertexSpirv, false);
                fs_wgsl = engine.shaderCompiler.naga.spirv_to_wgsl(fragmentSpv, false);
                if (!vs_wgsl || !fs_wgsl) {
                    let subShader = this._shaderPass._owner;
                    let shader = subShader._owner;
                    console.error(`LayaXShaderInstance: SPIR-V→WGSL conversion failed for ${shader.name}, vs_wgsl=${vs_wgsl ? 'ok' : 'EMPTY'}, fs_wgsl=${fs_wgsl ? 'ok' : 'EMPTY'}`);
                }
            }
            {
                for (const [setIndex, mapNames] of this._resourcesCacheKey) {
                    const bindings = this.bindingInfoMap.get(setIndex);
                    if (!bindings)
                        continue;
                    const textureExits = LayaXBindGroupHelper.computeTextureExits(setIndex, mapNames, bindings);
                    this.textureExitsMap.set(setIndex, textureExits);
                }
            }
            const propertySetMapJson = this._serializeBindingInfoMap();
            const textureExitsJson = this._serializeTextureExits();
            this._nativeObj = new window.conchLayaXShaderInstance();
            let programHandle = this._nativeObj.create(vs_wgsl, fs_wgsl, propertySetMapJson, textureExitsJson);
            if (!programHandle) {
                console.error(`LayaXShaderInstance: create program FAILED! propertySetMap=${propertySetMapJson.substring(0, 200)}`);
            }
        }
        _ensureCommandMapPopulated(mapName, shaderPass) {
            let map = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap(mapName);
            if (mapName === shaderPass.name) {
                for (const [key, value] of shaderPass._owner._uniformMap) {
                    if (!map._idata.has(key)) {
                        if (value.arrayLength > 0) {
                            map.addShaderUniformArray(value.id, value.propertyName, value.uniformtype, value.arrayLength);
                        }
                        else {
                            map.addShaderUniform(value.id, value.propertyName, value.uniformtype);
                        }
                    }
                }
            }
        }
        _serializeBindingInfoMap() {
            const obj = {};
            for (const [setIndex, bindings] of this.bindingInfoMap) {
                obj[setIndex.toString()] = bindings.map(b => {
                    var _a, _b;
                    return ({
                        id: b.id,
                        name: b.name,
                        set: b.set,
                        binding: b.binding,
                        bindingType: b.bindingType,
                        dataType: b.dataType,
                        propertyId: b.propertyId,
                        sourceMapId: b.sourceMapId,
                        hasDynamicOffset: (_b = (_a = b.buffer) === null || _a === void 0 ? void 0 : _a.hasDynamicOffset) !== null && _b !== void 0 ? _b : false,
                        sampler: b.sampler,
                    });
                });
            }
            return JSON.stringify(obj);
        }
        _serializeTextureExits() {
            const obj = {};
            for (const [setIndex, bitmask] of this.textureExitsMap) {
                obj[setIndex.toString()] = bitmask;
            }
            return JSON.stringify(obj);
        }
        _disposeResource() {
            if (this._nativeObj) {
                this._nativeObj.destroy();
            }
            this.bindingInfoMap.clear();
            this._resourcesCacheKey.clear();
            this.textureExitsMap.clear();
        }
    }

    const _defineStrings = [];
    class LayaXComputeShaderInstance {
        constructor(name) {
            this.uniformSetMap = new Map();
            this.compilete = false;
            this.name = name;
        }
        compile(info) {
            const engine = LayaXRenderEngine._instance;
            const node = info.node;
            const compileDefine = info.defineData;
            _defineStrings.length = 0;
            Laya.Shader3D._getNamesByDefineData(compileDefine, _defineStrings);
            const commandMaps = info.uniformMaps;
            for (let i = 0, n = commandMaps.length; i < n; i++) {
                this.uniformSetMap.set(i, LayaXBindGroupHelper.createBindingInfoArray(i, [commandMaps[i]._stateName]));
            }
            this.uniformCommandMap = commandMaps;
            const processResult = LayaX_GLSLForVulkanGenerator.proccessCompute(_defineStrings, this.uniformCommandMap, this.uniformSetMap, node, info.name);
            const glsl = processResult.code;
            const splitSampler = processResult.hasSampler;
            const spvRes = engine.shaderCompiler.glslang.glsl450_combine_to_spirv(glsl, 'compute', splitSampler);
            if (!spvRes.success) {
                console.error(`LayaXComputeShaderInstance '${info.name}' compile error:`, spvRes.info_log);
                return;
            }
            const spirv = new Uint8Array(spvRes.spirv.buffer, spvRes.spirv.byteOffset, spvRes.spirv.byteLength);
            const wgsl = engine.shaderCompiler.naga.spirv_to_wgsl(spirv, false);
            if (!wgsl) {
                console.error(`LayaXComputeShaderInstance '${info.name}': SPIR-V→WGSL conversion failed`);
                return;
            }
            const propertySetMapJson = this._serializeBindingInfoMap();
            this._nativeObj = new window.conchLayaXComputeShaderInstance(wgsl, propertySetMapJson);
            if (!this._nativeObj || !this._nativeObj.getHandle()) {
                console.error(`[LayaX-DBG] create compute program '${info.name}' FAILED!`);
                return;
            }
            console.log(`[LayaX-DBG] create compute program '${info.name}': wgsl_len=${wgsl.length} sets=${Array.from(this.uniformSetMap.keys())}`);
            this.compilete = true;
        }
        _serializeBindingInfoMap() {
            const obj = {};
            for (const [setIndex, bindings] of this.uniformSetMap) {
                obj[setIndex.toString()] = bindings.map(b => {
                    var _a, _b;
                    return ({
                        id: b.id,
                        name: b.name,
                        set: b.set,
                        binding: b.binding,
                        bindingType: b.bindingType,
                        dataType: b.dataType,
                        propertyId: b.propertyId,
                        sourceMapId: b.sourceMapId,
                        hasDynamicOffset: (_b = (_a = b.buffer) === null || _a === void 0 ? void 0 : _a.hasDynamicOffset) !== null && _b !== void 0 ? _b : false,
                        sampler: b.sampler,
                    });
                });
            }
            return JSON.stringify(obj);
        }
    }

    class LayaXComputeContext {
        constructor() {
            this._destroyed = false;
            this._nativeObj = new window.conchLayaXComputeContext();
        }
        clearCMDs() {
            if (this._destroyed)
                return;
            this._nativeObj.clear();
        }
        addDispatchCommand(cmd) {
            if (this._destroyed)
                return;
            const shader = cmd.shader;
            if (!shader || !shader.compilete || !shader._nativeObj)
                return;
            const cmdMaps = shader.uniformCommandMap
                ? shader.uniformCommandMap.map(m => m._nativeObj)
                : [];
            const sdObjs = cmd.shaderData
                ? cmd.shaderData.map(sd => sd._nativeObj)
                : [];
            const p = cmd.dispatchParams;
            this._nativeObj.dispatch(shader._nativeObj, cmdMaps, sdObjs, p.x | 0, (p.y | 0) || 1, (p.z | 0) || 1);
        }
        addDispatchIndirectCommand(cmd) {
            if (this._destroyed)
                return;
            const shader = cmd.shader;
            if (!shader || !shader.compilete || !shader._nativeObj)
                return;
            const cmdMaps = shader.uniformCommandMap
                ? shader.uniformCommandMap.map(m => m._nativeObj)
                : [];
            const sdObjs = cmd.shaderData
                ? cmd.shaderData.map(sd => sd._nativeObj)
                : [];
            const indirectBuf = cmd.indirectBuffer;
            if (!(indirectBuf === null || indirectBuf === void 0 ? void 0 : indirectBuf._nativeObj))
                return;
            this._nativeObj.dispatchIndirect(shader._nativeObj, cmdMaps, sdObjs, indirectBuf._nativeObj, cmd.indirectOffset >>> 0);
        }
        addSetShaderDataCommand(shaderData, propertyID, shaderDataType, value) {
            var _a;
            if (this._destroyed || !shaderData)
                return;
            const sdNative = shaderData._nativeObj;
            if (!sdNative)
                return;
            const sdHandle = shaderData._handleId;
            switch (shaderDataType) {
                case Laya.ShaderDataType.Int:
                    this._nativeObj.setShaderDataInt(sdHandle, propertyID, value | 0);
                    break;
                case Laya.ShaderDataType.Float:
                    this._nativeObj.setShaderDataFloat(sdHandle, propertyID, value);
                    break;
                case Laya.ShaderDataType.Bool:
                    this._nativeObj.setShaderDataBool(sdHandle, propertyID, !!value);
                    break;
                case Laya.ShaderDataType.Vector2: {
                    const v = value;
                    this._nativeObj.setShaderDataVec2(sdHandle, propertyID, v.x, v.y);
                    break;
                }
                case Laya.ShaderDataType.Vector3: {
                    const v = value;
                    this._nativeObj.setShaderDataVec3(sdHandle, propertyID, v.x, v.y, v.z);
                    break;
                }
                case Laya.ShaderDataType.Vector4: {
                    const v = value;
                    this._nativeObj.setShaderDataVec4(sdHandle, propertyID, v.x, v.y, v.z, v.w);
                    break;
                }
                case Laya.ShaderDataType.Color: {
                    const c = value;
                    this._nativeObj.setShaderDataVec4(sdHandle, propertyID, c.r, c.g, c.b, c.a);
                    break;
                }
                case Laya.ShaderDataType.Matrix3x3:
                    this._nativeObj.setShaderDataMat3(sdNative, propertyID, value);
                    break;
                case Laya.ShaderDataType.Matrix4x4:
                    this._nativeObj.setShaderDataMat4(sdNative, propertyID, value);
                    break;
                case Laya.ShaderDataType.Buffer:
                    this._nativeObj.setShaderDataBuffer(sdNative, propertyID, value);
                    break;
                case Laya.ShaderDataType.Texture2D:
                case Laya.ShaderDataType.StorageTexture2D: {
                    let tex = value;
                    if (tex && tex.bitmap)
                        tex = tex.bitmap;
                    let texNative = null;
                    if (tex && tex._texture) {
                        const t = tex._texture;
                        if (t instanceof LayaXInternalRT) {
                            const colorTex = (_a = t._textures) === null || _a === void 0 ? void 0 : _a[0];
                            texNative = colorTex ? colorTex._nativeObj : null;
                        }
                        else {
                            texNative = t._nativeObj;
                        }
                    }
                    this._nativeObj.setShaderDataTexture(sdNative, propertyID, texNative);
                    break;
                }
                case Laya.ShaderDataType.DeviceBuffer:
                case Laya.ShaderDataType.ReadOnlyDeviceBuffer:
                    shaderData.setDeviceBuffer(propertyID, value);
                    break;
            }
        }
        addBufferToBufferCommand(src, dest, sourceOffset = 0, destinationOffset = 0, size) {
            if (this._destroyed)
                return;
            const srcNative = src === null || src === void 0 ? void 0 : src._nativeObj;
            const dstNative = dest === null || dest === void 0 ? void 0 : dest._nativeObj;
            if (!srcNative || !dstNative || !size || size <= 0)
                return;
            this._nativeObj.copyBuffer(srcNative, sourceOffset >>> 0, dstNative, destinationOffset >>> 0, size >>> 0);
        }
        addBufferToTextureCommand(_src, _srcInfo, _dstInfo, _copySize) {
        }
        addTextureToBufferCommand(_srcInfo, _dst, _dstInfo, _copySize) {
        }
        addTextureToTextureCommand(srcTextureInfo, destTextureInfo, copySize) {
            if (this._destroyed)
                return;
            const srcTex = srcTextureInfo === null || srcTextureInfo === void 0 ? void 0 : srcTextureInfo.texture;
            const dstTex = destTextureInfo === null || destTextureInfo === void 0 ? void 0 : destTextureInfo.texture;
            if (!(srcTex === null || srcTex === void 0 ? void 0 : srcTex._nativeObj) || !(dstTex === null || dstTex === void 0 ? void 0 : dstTex._nativeObj))
                return;
            const so = srcTextureInfo.origin;
            const dco = destTextureInfo.origin;
            const ext = LayaXComputeContext._extentToTuple(copySize);
            this._nativeObj.copyTexture(srcTex._nativeObj, srcTextureInfo.mipLevel >>> 0, so.x | 0, so.y | 0, so.z | 0, dstTex._nativeObj, destTextureInfo.mipLevel >>> 0, dco.x | 0, dco.y | 0, dco.z | 0, ext[0], ext[1], ext[2]);
        }
        addClearBufferCommand(dest, destoffset, destCount) {
            if (this._destroyed)
                return;
            const dstNative = dest === null || dest === void 0 ? void 0 : dest._nativeObj;
            if (!dstNative)
                return;
            this._nativeObj.clearBuffer(dstNative, destoffset >>> 0, destCount >>> 0);
        }
        executeCMDs() {
            if (this._destroyed)
                return;
            this._nativeObj.execute();
        }
        destroy() {
            if (this._destroyed)
                return;
            this._destroyed = true;
            this._nativeObj = null;
        }
        static _extentToTuple(extent) {
            var _a;
            if (extent && typeof extent[Symbol.iterator] === "function") {
                const arr = [];
                for (const v of extent) {
                    arr.push(v >>> 0);
                    if (arr.length === 3)
                        break;
                }
                while (arr.length < 3)
                    arr.push(arr.length === 2 ? 1 : 0);
                return [arr[0], arr[1], arr[2]];
            }
            const e = extent;
            return [(e.width >>> 0) || 0, (e.height >>> 0) || 0, (((_a = e.depthOrArrayLayers) !== null && _a !== void 0 ? _a : 1) >>> 0) || 1];
        }
    }

    function isModernAPIsRuntime() {
        return Laya.LayaEnv.isModernAPIs || (typeof window !== "undefined" && window.conchLayaXDevice != null);
    }
    class LayaXRenderDeviceFactory {
        constructor() {
            this.globalBlockMap = {};
        }
        createShaderData(ownerResource) {
            return new LayaXShaderData(ownerResource);
        }
        createGlobalUniformMap(blockName) {
            let comMap = this.globalBlockMap[blockName];
            if (!comMap)
                comMap = this.globalBlockMap[blockName] = new LayaXCommandUniformMap(blockName);
            return comMap;
        }
        createComputeShader(info) {
            const shader = new LayaXComputeShaderInstance(info.name);
            shader.compile(info);
            return shader;
        }
        createComputeContext() {
            return new LayaXComputeContext();
        }
        createShaderInstance(shaderProcessInfo, shaderPass) {
            let shaderIns = new LayaXShaderInstance();
            shaderIns._create(shaderProcessInfo, shaderPass);
            if (Laya.Shader3D.debugMode) {
                let defineString = shaderProcessInfo.defineString;
                let is2D = shaderProcessInfo.is2D;
                Laya.ShaderVariantCollection.active.add(shaderPass, defineString, is2D);
            }
            return shaderIns;
        }
        createIndexBuffer(bufferUsage) {
            return new LayaXIndexBuffer(bufferUsage);
        }
        createVertexBuffer(bufferUsageType) {
            return new LayaXVertexBuffer(bufferUsageType);
        }
        createDeviceBuffer(type) {
            return new LayaXDeviceBuffer(type);
        }
        createBufferState() {
            return new LayaXBufferState();
        }
        createRenderGeometryElement(mode, drawType) {
            return new LayaXRenderGeometry(mode, drawType);
        }
        async createEngine(config, canvas) {
            Laya.TextRenderConfig.premultiplyAlpha = true;
            let engine = new LayaXRenderEngine();
            engine.initRenderEngine(canvas.source);
            new Laya.LayaGL();
            Laya.LayaGL.renderEngine = engine;
            Laya.LayaGL.textureContext = engine.getTextureContext();
            await engine.shaderCompiler.init();
        }
    }
    Laya.Laya.addBeforeInitCallback(() => {
        if (isModernAPIsRuntime()) {
            if (!Laya.LayaGL.renderDeviceFactory)
                Laya.LayaGL.renderDeviceFactory = new LayaXRenderDeviceFactory();
        }
    });

    class LayaXRenderState extends Laya.RenderState {
        constructor() {
            super();
        }
        cloneTo(dest) {
            super.cloneTo(dest);
        }
        clone() {
            let state = new LayaXRenderState();
            this.cloneTo(state);
            return state;
        }
    }

    class LayaXShaderPass {
        constructor(pass) {
            this._statefirst = false;
            this._pipelineMode = "Forward";
            this.is2D = false;
            this.name = "";
            this.nodeCommonMap = [];
            this.additionShaderData = [];
            this.attributeLocations = new Set();
            this.compileSetMapNames = null;
            this._pass = pass;
            this._nativeObj = new window.conchLayaXShaderPass();
            this._nativeObj.create();
            this._validDefine = new LayaXDefineDatas();
            this._renderState = new LayaXRenderState();
            this._renderState.setNull();
            this._compileCallbackBound = this._onCompileCallback.bind(this);
            this._nativeObj.setCompileCallback(this._compileCallbackBound);
        }
        get pipelineMode() {
            return this._pipelineMode;
        }
        set pipelineMode(value) {
            this._pipelineMode = value;
            this._nativeObj.setPipelineMode(value);
        }
        get validDefine() {
            return this._validDefine;
        }
        set validDefine(value) {
            this._validDefine = value;
            this._nativeObj.setValidDefine(this._validDefine._nativeObj);
        }
        get renderState() {
            return this._renderState;
        }
        set renderState(value) {
            this._renderState = value;
        }
        get statefirst() {
            return this._statefirst;
        }
        set statefirst(value) {
            var _a, _b, _c, _d;
            this._statefirst = value;
            (_b = (_a = this._nativeObj) === null || _a === void 0 ? void 0 : _a.setStateFirst) === null || _b === void 0 ? void 0 : _b.call(_a, value);
            if (!value) {
                (_d = (_c = this._nativeObj) === null || _c === void 0 ? void 0 : _c.setRenderStateMask) === null || _d === void 0 ? void 0 : _d.call(_c, 0);
            }
        }
        syncOwnerUniformMap() {
            this._pass._owner.moduleData.setUniformMap(this._pass._owner._uniformMap);
        }
        _parseSetMapNames(str) {
            const result = new Map();
            if (!str)
                return result;
            const parts = str.split(';');
            for (const part of parts) {
                const colonIdx = part.indexOf(':');
                if (colonIdx < 0)
                    continue;
                const setIndex = parseInt(part.substring(0, colonIdx));
                const namesStr = part.substring(colonIdx + 1);
                const names = namesStr ? namesStr.split(',').filter(n => n.length > 0) : [];
                if (!isNaN(setIndex)) {
                    result.set(setIndex, names);
                }
            }
            return result;
        }
        _parseAttributeLocations(str) {
            const result = new Set();
            if (!str)
                return result;
            const parts = str.split(',');
            for (const part of parts) {
                const num = parseInt(part);
                if (!isNaN(num)) {
                    result.add(num);
                }
            }
            return result;
        }
        _syncRenderState() {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12;
            const rs = this._renderState;
            if (!rs)
                return;
            const isSet = (value) => value !== null && value !== undefined;
            const mask = (isSet(rs.blend) ? 1 << 0 : 0) |
                (isSet(rs.srcBlend) ? 1 << 1 : 0) |
                (isSet(rs.dstBlend) ? 1 << 2 : 0) |
                (isSet(rs.blendEquation) ? 1 << 3 : 0) |
                (isSet(rs.srcBlendRGB) ? 1 << 4 : 0) |
                (isSet(rs.dstBlendRGB) ? 1 << 5 : 0) |
                (isSet(rs.srcBlendAlpha) ? 1 << 6 : 0) |
                (isSet(rs.dstBlendAlpha) ? 1 << 7 : 0) |
                (isSet(rs.blendEquationRGB) ? 1 << 8 : 0) |
                (isSet(rs.blendEquationAlpha) ? 1 << 9 : 0) |
                (isSet(rs.depthTest) ? 1 << 10 : 0) |
                (isSet(rs.depthWrite) ? 1 << 11 : 0) |
                (isSet(rs.stencilTest) ? 1 << 12 : 0) |
                (isSet(rs.stencilRef) ? 1 << 13 : 0) |
                (isSet(rs.stencilReadMask) ? 1 << 14 : 0) |
                (isSet(rs.stencilWriteMask) ? 1 << 15 : 0) |
                (isSet((_a = rs.stencilOp) === null || _a === void 0 ? void 0 : _a.x) ? 1 << 16 : 0) |
                (isSet((_b = rs.stencilOp) === null || _b === void 0 ? void 0 : _b.y) ? 1 << 17 : 0) |
                (isSet((_c = rs.stencilOp) === null || _c === void 0 ? void 0 : _c.z) ? 1 << 18 : 0) |
                (isSet(rs.cull) ? 1 << 19 : 0) |
                (isSet(rs.stencilWrite) ? 1 << 20 : 0) |
                (isSet(rs.depthBias) ? 1 << 21 : 0) |
                (isSet(rs.depthBiasConstant) ? 1 << 22 : 0) |
                (isSet(rs.depthBiasSlopeScale) ? 1 << 23 : 0) |
                (isSet(rs.depthBiasClamp) ? 1 << 24 : 0);
            if (mask === 0) {
                (_e = (_d = this._nativeObj) === null || _d === void 0 ? void 0 : _d.setRenderStateMask) === null || _e === void 0 ? void 0 : _e.call(_d, 0);
                return;
            }
            const D = Laya.RenderState.Default;
            const depthWrite = (_f = rs.depthWrite) !== null && _f !== void 0 ? _f : D.depthWrite;
            const rsHandle = this._nativeObj.registerRenderState((_g = rs.blend) !== null && _g !== void 0 ? _g : D.blend, (_h = rs.srcBlend) !== null && _h !== void 0 ? _h : D.srcBlend, (_j = rs.dstBlend) !== null && _j !== void 0 ? _j : D.dstBlend, (_k = rs.blendEquation) !== null && _k !== void 0 ? _k : D.blendEquation, (_l = rs.srcBlendRGB) !== null && _l !== void 0 ? _l : D.srcBlendRGB, (_m = rs.dstBlendRGB) !== null && _m !== void 0 ? _m : D.dstBlendRGB, (_o = rs.srcBlendAlpha) !== null && _o !== void 0 ? _o : D.srcBlendAlpha, (_p = rs.dstBlendAlpha) !== null && _p !== void 0 ? _p : D.dstBlendAlpha, (_q = rs.blendEquationRGB) !== null && _q !== void 0 ? _q : D.blendEquationRGB, (_r = rs.blendEquationAlpha) !== null && _r !== void 0 ? _r : D.blendEquationAlpha, (_s = rs.depthTest) !== null && _s !== void 0 ? _s : D.depthTest, depthWrite ? 1 : 0, (_t = rs.stencilTest) !== null && _t !== void 0 ? _t : D.stencilTest, ((_u = rs.stencilWrite) !== null && _u !== void 0 ? _u : D.stencilWrite) ? 1 : 0, (_v = rs.stencilRef) !== null && _v !== void 0 ? _v : D.stencilRef, (_w = rs.stencilReadMask) !== null && _w !== void 0 ? _w : 0xFF, (_x = rs.stencilWriteMask) !== null && _x !== void 0 ? _x : 0xFF, (_z = (_y = rs.stencilOp) === null || _y === void 0 ? void 0 : _y.x) !== null && _z !== void 0 ? _z : D.stencilOp.x, (_1 = (_0 = rs.stencilOp) === null || _0 === void 0 ? void 0 : _0.y) !== null && _1 !== void 0 ? _1 : D.stencilOp.y, (_3 = (_2 = rs.stencilOp) === null || _2 === void 0 ? void 0 : _2.z) !== null && _3 !== void 0 ? _3 : D.stencilOp.z, ((_4 = rs.depthBias) !== null && _4 !== void 0 ? _4 : D.depthBias) ? 1 : 0, (_5 = rs.depthBiasConstant) !== null && _5 !== void 0 ? _5 : D.depthBiasConstant, (_6 = rs.depthBiasSlopeScale) !== null && _6 !== void 0 ? _6 : D.depthBiasSlopeScale, (_7 = rs.depthBiasClamp) !== null && _7 !== void 0 ? _7 : D.depthBiasClamp, (_8 = rs.cull) !== null && _8 !== void 0 ? _8 : D.cull, 1);
            if (rsHandle) {
                (_10 = (_9 = this._nativeObj) === null || _9 === void 0 ? void 0 : _9.setRenderStateMask) === null || _10 === void 0 ? void 0 : _10.call(_9, mask);
                this._nativeObj.setRenderState(rsHandle);
            }
            else {
                (_12 = (_11 = this._nativeObj) === null || _11 === void 0 ? void 0 : _11.setRenderStateMask) === null || _12 === void 0 ? void 0 : _12.call(_11, 0);
            }
        }
        _onCompileCallback(defineNamesStr, setMapNamesStr, attributeLocationsStr) {
            var _a, _b, _c, _d, _e;
            this._syncRenderState();
            const defineStrings = defineNamesStr
                ? defineNamesStr.split('\n').filter(s => s.length > 0)
                : [];
            this.compileSetMapNames = this._parseSetMapNames(setMapNamesStr);
            this.attributeLocations = this._parseAttributeLocations(attributeLocationsStr);
            const shaderProcessInfo = {
                is2D: this.is2D,
                vs: this._pass._VS,
                ps: this._pass._PS,
                attributeMap: this._pass._owner._attributeMap,
                uniformMap: this._pass._owner._uniformMap,
                defineString: defineStrings,
            };
            try {
                const shaderInstance = Laya.ShaderPass.createShaderInstanceByInfo(this._pass, shaderProcessInfo);
                if (shaderInstance && shaderInstance._nativeObj) {
                    return shaderInstance._nativeObj;
                }
                console.error(`LayaXShaderPass compile callback: shaderInstance or _nativeObj is null`);
            }
            catch (e) {
                const shaderName = ((_b = (_a = this._pass._owner) === null || _a === void 0 ? void 0 : _a._owner) === null || _b === void 0 ? void 0 : _b.name) || "unknown";
                const passIdx = (_e = (_d = (_c = this._pass._owner) === null || _c === void 0 ? void 0 : _c._passes) === null || _d === void 0 ? void 0 : _d.indexOf(this._pass)) !== null && _e !== void 0 ? _e : -1;
                console.error(`LayaXShaderPass compile callback failed: ${shaderName}_pass${passIdx} defines=[${defineNamesStr === null || defineNamesStr === void 0 ? void 0 : defineNamesStr.replace(/\n/g, ',')}]`, e);
            }
            return null;
        }
        setCacheShader(defines, shaderInstance) {
        }
        getCacheShader(defines) {
            return null;
        }
        destroy() {
            if (this._nativeObj) {
                this._nativeObj.destroy();
            }
            if (this._validDefine) {
                this._validDefine.destroy();
            }
        }
    }

    class LayaXSubShader {
        constructor() {
            this._shaderName = "";
            this._pendingUniformMap = null;
            this._uniformPropertyIds = new Set();
            this._nativeObj = new window.conchLayaXSubShader();
            this._nativeObj.create();
        }
        get shaderName() {
            return this._shaderName;
        }
        set shaderName(value) {
            this._shaderName = value;
            this._nativeObj.setName(value);
            this._ensureMaterialMap();
        }
        get enableInstance() {
            return false;
        }
        set enableInstance(value) {
            this._nativeObj.setEnableInstance(value);
        }
        setUniformMap(_uniformMap) {
            this._syncUniformProperties(_uniformMap);
            this._pendingUniformMap = _uniformMap;
            this._ensureMaterialMap();
        }
        _syncUniformProperties(uniformMap) {
            uniformMap.forEach((value) => {
                if (this._uniformPropertyIds.has(value.id)) {
                    return;
                }
                this._nativeObj.addUniformProperty(value.id, value.propertyName, value.uniformtype, value.arrayLength);
                this._uniformPropertyIds.add(value.id);
            });
        }
        _ensureMaterialMap() {
            if (!this._pendingUniformMap || !this._shaderName)
                return;
            let map = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap(this._shaderName);
            this._pendingUniformMap.forEach((value) => {
                if (map._idata.has(value.id)) {
                    return;
                }
                if (value.arrayLength > 0) {
                    map.addShaderUniformArray(value.id, value.propertyName, value.uniformtype, value.arrayLength);
                }
                else {
                    map.addShaderUniform(value.id, value.propertyName, value.uniformtype);
                }
            });
            this._pendingUniformMap = null;
        }
        addShaderPass(pass) {
            const layaxPass = pass;
            layaxPass.syncOwnerUniformMap();
            this._nativeObj.addShaderPass(layaxPass._nativeObj);
        }
        destroy() {
            this._nativeObj.destroy();
        }
    }

    class LayaXUnitRenderModuleDataFactory {
        createRenderState() {
            return new LayaXRenderState();
        }
        createDefineDatas() {
            return new LayaXDefineDatas();
        }
        createSubShader() {
            return new LayaXSubShader();
        }
        createShaderPass(pass) {
            return new LayaXShaderPass(pass);
        }
    }
    Laya.Laya.addBeforeInitCallback(() => {
        if (!Laya.LayaGL.unitRenderModuleDataFactory)
            Laya.LayaGL.unitRenderModuleDataFactory = new LayaXUnitRenderModuleDataFactory();
    });

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
    exports.GraphicsMSDFMeshPayloadWordCount = GraphicsMSDFMeshPayloadWordCount;
    exports.GraphicsMeshPayloadWordCount = GraphicsMeshPayloadWordCount;
    exports.GraphicsQuadPayloadWordCount = GraphicsQuadPayloadWordCount;
    exports.LayaXBindGroupHelper = LayaXBindGroupHelper;
    exports.LayaXBlit2DQuadCMD = LayaXBlit2DQuadCMD;
    exports.LayaXBufferState = LayaXBufferState;
    exports.LayaXCommandUniformMap = LayaXCommandUniformMap;
    exports.LayaXComputeContext = LayaXComputeContext;
    exports.LayaXComputeShaderInstance = LayaXComputeShaderInstance;
    exports.LayaXDefineDatas = LayaXDefineDatas;
    exports.LayaXDeviceBuffer = LayaXDeviceBuffer;
    exports.LayaXDraw2DElementCMD = LayaXDraw2DElementCMD;
    exports.LayaXGraphicsOp2DFactory = LayaXGraphicsOp2DFactory;
    exports.LayaXIndexBuffer = LayaXIndexBuffer;
    exports.LayaXInternalRT = LayaXInternalRT;
    exports.LayaXInternalTex = LayaXInternalTex;
    exports.LayaXPrimitiveRenderElement2D = LayaXPrimitiveRenderElement2D;
    exports.LayaXReadbackDispatcher = LayaXReadbackDispatcher;
    exports.LayaXRender2DProcess = LayaXRender2DProcess;
    exports.LayaXRenderContext2D = LayaXRenderContext2D;
    exports.LayaXRenderDeviceFactory = LayaXRenderDeviceFactory;
    exports.LayaXRenderElement2D = LayaXRenderElement2D;
    exports.LayaXRenderEngine = LayaXRenderEngine;
    exports.LayaXRenderGeometry = LayaXRenderGeometry;
    exports.LayaXRenderState = LayaXRenderState;
    exports.LayaXSetRenderData = LayaXSetRenderData;
    exports.LayaXSetRendertarget2DCMD = LayaXSetRendertarget2DCMD;
    exports.LayaXSetShaderDefine = LayaXSetShaderDefine;
    exports.LayaXShaderCompiler = LayaXShaderCompiler;
    exports.LayaXShaderData = LayaXShaderData;
    exports.LayaXShaderInstance = LayaXShaderInstance;
    exports.LayaXShaderPass = LayaXShaderPass;
    exports.LayaXSubShader = LayaXSubShader;
    exports.LayaXTextureContext = LayaXTextureContext;
    exports.LayaXUnitRenderModuleDataFactory = LayaXUnitRenderModuleDataFactory;
    exports.LayaXVertexBuffer = LayaXVertexBuffer;
    exports.LayaX_GLSLForVulkanGenerator = LayaX_GLSLForVulkanGenerator;
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
    exports.getTypeDefaultString = getTypeDefaultString;
    exports.getTypeString = getTypeString;
    exports.isSamplerType = isSamplerType;
    exports.unpackMSDFParameter = unpackMSDFParameter;
    exports.writeFillTexturePayloadValues = writeFillTexturePayloadValues;
    exports.writeMeshPayloadValues = writeMeshPayloadValues;
    exports.writeOpInfoBuffer = writeOpInfoBuffer;
    exports.writeQuadPayloadValues = writeQuadPayloadValues;

})(window.Laya = window.Laya || {}, Laya);
//# sourceMappingURL=laya.modernAPIs_2D.js.map
