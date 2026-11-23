(function (exports, Laya) {
    'use strict';

    exports.Particle2DSimulationSpace = void 0;
    (function (Particle2DSimulationSpace) {
        Particle2DSimulationSpace[Particle2DSimulationSpace["Local"] = 0] = "Local";
        Particle2DSimulationSpace[Particle2DSimulationSpace["World"] = 1] = "World";
    })(exports.Particle2DSimulationSpace || (exports.Particle2DSimulationSpace = {}));
    exports.Particle2DScalingMode = void 0;
    (function (Particle2DScalingMode) {
        Particle2DScalingMode[Particle2DScalingMode["Hierarchy"] = 0] = "Hierarchy";
        Particle2DScalingMode[Particle2DScalingMode["Local"] = 1] = "Local";
    })(exports.Particle2DScalingMode || (exports.Particle2DScalingMode = {}));
    class Main2DModule {
        get startSizeX() {
            return this._startSizeX;
        }
        set startSizeX(value) {
            this._startSizeX = value;
            this._startSizeY.mode = value.mode;
        }
        get startSizeY() {
            return this._startSizeY;
        }
        set startSizeY(value) {
            this._startSizeY = value;
            this._startSizeX.mode = value.mode;
        }
        get startSize() {
            return this.startSizeX;
        }
        set startSize(value) {
            this.startSizeX = value;
        }
        get gravityModifier() {
            return this._gravityModifier;
        }
        set gravityModifier(value) {
            if (typeof value === 'number') {
                this._gravityModifier.setValue(value, value);
            }
            else {
                value.cloneTo(this._gravityModifier);
            }
        }
        get maxParticles() {
            return this._maxParticles;
        }
        set maxParticles(value) {
            this._maxParticles = Math.floor(value);
        }
        constructor() {
            this.duration = 5;
            this.looping = true;
            this.playOnAwake = true;
            this.startDelay = new Laya.ParticleMinMaxCurve();
            this.startLifetime = new Laya.ParticleMinMaxCurve();
            this.startSpeed = new Laya.ParticleMinMaxCurve();
            this.startSize2D = false;
            this._startSizeX = new Laya.ParticleMinMaxCurve();
            this._startSizeY = new Laya.ParticleMinMaxCurve();
            this.startRotation = new Laya.ParticleMinMaxCurve();
            this.startColor = new Laya.ParticleMinMaxGradient();
            this._gravity = new Laya.Vector2();
            this._gravityModifier = new Laya.Vector2(0, 0);
            this._spriteRotAndScale = new Laya.Vector4();
            this._spriteTranslateAndSpace = new Laya.Vector3();
            this.simulationSpace = exports.Particle2DSimulationSpace.Local;
            this.simulationSpeed = 1;
            this.scaleMode = exports.Particle2DScalingMode.Local;
            this._maxParticles = 100;
            this.autoRandomSeed = true;
            this.randomSeed = 0;
            this.unitPixels = 50;
            this.startDelay.mode = Laya.ParticleMinMaxCurveMode.Constant;
            this.startDelay.constant = 0;
            this.startLifetime.mode = Laya.ParticleMinMaxCurveMode.Constant;
            this.startLifetime.constant = 5;
            this.startSpeed.mode = Laya.ParticleMinMaxCurveMode.Constant;
            this.startSpeed.constant = 5;
            this.startSizeX.mode = Laya.ParticleMinMaxCurveMode.Constant;
            this.startSizeX.constant = 0.5;
            this.startSizeY.mode = Laya.ParticleMinMaxCurveMode.Constant;
            this.startSizeY.constant = 0.5;
            this.startRotation.mode = Laya.ParticleMinMaxCurveMode.Constant;
            this.startRotation.constant = 0;
            this.startColor.mode = Laya.ParticleMinMaxGradientMode.Color;
            this.startColor.color.setValue(1, 1, 1, 1);
        }
        cloneTo(destObject) {
            destObject.duration = this.duration;
            destObject.looping = this.looping;
            destObject.playOnAwake = this.playOnAwake;
            this.startDelay.cloneTo(destObject.startDelay);
            this.startLifetime.cloneTo(destObject.startLifetime);
            this.startSpeed.cloneTo(destObject.startSpeed);
            destObject.startSize2D = this.startSize2D;
            this.startSizeX.cloneTo(destObject.startSizeX);
            this.startSizeY.cloneTo(destObject.startSizeY);
            destObject.startRotation = this.startRotation;
            this.startColor.cloneTo(destObject.startColor);
            this.gravityModifier.cloneTo(destObject._gravityModifier);
            destObject.simulationSpace = this.simulationSpace;
            destObject.simulationSpeed = this.simulationSpeed;
            destObject.scaleMode = this.scaleMode;
            destObject.maxParticles = this.maxParticles;
            destObject.autoRandomSeed = this.autoRandomSeed;
            destObject.randomSeed = this.randomSeed;
            destObject.unitPixels = this.unitPixels;
        }
        clone() {
            let dest = new Main2DModule();
            this.cloneTo(dest);
            return dest;
        }
    }

    class Rotation2DOverLifetimeModule {
        constructor() {
            this.enable = true;
            this.angularVelocity = new Laya.ParticleMinMaxCurve();
            this.angularVelocity.mode = Laya.ParticleMinMaxCurveMode.Constant;
            this.angularVelocity.constantMin = 45;
            this.angularVelocity.constantMax = 45;
            this.angularVelocity.curveMin.add(0, 45);
            this.angularVelocity.curveMin.add(1, 45);
            this.angularVelocity.curveMax.add(0, 45);
            this.angularVelocity.curveMax.add(1, 45);
        }
        cloneTo(destObject) {
            destObject.enable = this.enable;
            this.angularVelocity.cloneTo(destObject.angularVelocity);
        }
        clone() {
            let dest = new Rotation2DOverLifetimeModule();
            this.cloneTo(dest);
            return dest;
        }
    }

    exports.Base2DShapeType = void 0;
    (function (Base2DShapeType) {
        Base2DShapeType[Base2DShapeType["Fan"] = 0] = "Fan";
        Base2DShapeType[Base2DShapeType["Circle"] = 1] = "Circle";
        Base2DShapeType[Base2DShapeType["Box"] = 2] = "Box";
        Base2DShapeType[Base2DShapeType["Semicircle"] = 3] = "Semicircle";
        Base2DShapeType[Base2DShapeType["None"] = 4] = "None";
    })(exports.Base2DShapeType || (exports.Base2DShapeType = {}));
    class Base2DShape {
        constructor(type) {
            this.type = exports.Base2DShapeType.None;
            this.posAndDir = new Laya.Vector4();
            this.positionX = 0;
            this.positionY = 0;
            this.scaleX = 1;
            this.scaleY = 1;
            this.rotation = 0;
            this.type = type;
        }
        applyTransform() {
            if (this.scaleX === 1 && this.scaleY === 1 && this.rotation === 0 && this.positionX === 0 && this.positionY === 0) {
                return;
            }
            let x = this.posAndDir.x;
            let y = this.posAndDir.y;
            let dirX = this.posAndDir.z;
            let dirY = this.posAndDir.w;
            x *= this.scaleX;
            y *= this.scaleY;
            dirX *= this.scaleX;
            dirY *= this.scaleY;
            if (this.rotation !== 0) {
                let rad = this.rotation * Math.PI / 180;
                let cos = Math.cos(rad);
                let sin = Math.sin(rad);
                let rx = x * cos - y * sin;
                let ry = x * sin + y * cos;
                x = rx;
                y = ry;
                let rdx = dirX * cos - dirY * sin;
                let rdy = dirX * sin + dirY * cos;
                dirX = rdx;
                dirY = rdy;
            }
            x += this.positionX;
            y += this.positionY;
            let len = Math.sqrt(dirX * dirX + dirY * dirY);
            if (len > 0) {
                dirX /= len;
                dirY /= len;
            }
            this.posAndDir.setValue(x, y, dirX, dirY);
        }
        cloneTransformTo(destObject) {
            destObject.positionX = this.positionX;
            destObject.positionY = this.positionY;
            destObject.scaleX = this.scaleX;
            destObject.scaleY = this.scaleY;
            destObject.rotation = this.rotation;
        }
    }

    const Angle2Radian = Math.PI / 180;
    exports.FanShapeEmitType = void 0;
    (function (FanShapeEmitType) {
        FanShapeEmitType[FanShapeEmitType["Base"] = 0] = "Base";
        FanShapeEmitType[FanShapeEmitType["Area"] = 1] = "Area";
    })(exports.FanShapeEmitType || (exports.FanShapeEmitType = {}));
    class FanShape extends Base2DShape {
        constructor() {
            super(exports.Base2DShapeType.Fan);
            this.angle = 25;
            this.radius = 1;
            this.emitType = exports.FanShapeEmitType.Base;
            this.length = 5;
        }
        getPositionAndDirection(randomFn = Math.random) {
            let radius = this.radius;
            let randomRadius = (randomFn() * 2 - 1);
            let radians = this.angle * randomRadius * Angle2Radian;
            let xDir = Math.sin(radians);
            let yDir = Math.cos(radians);
            let y = 0;
            let x = randomRadius * radius;
            switch (this.emitType) {
                case exports.FanShapeEmitType.Area:
                    {
                        y = this.length * randomFn();
                        x += y * Math.tan(radians);
                        break;
                    }
                case exports.FanShapeEmitType.Base:
            }
            let pAndd = this.posAndDir;
            pAndd.setValue(x, y, xDir, yDir);
            return pAndd;
        }
        cloneTo(destObject) {
            destObject.angle = this.angle;
            destObject.radius = this.radius;
            destObject.emitType = this.emitType;
            destObject.length = this.length;
        }
        clone() {
            let destObject = new FanShape();
            this.cloneTo(destObject);
            return destObject;
        }
    }

    class Shape2DModule {
        constructor() {
            this.enable = true;
            this.alignToDirection = false;
            this.shape = new FanShape();
        }
        cloneTo(destObject) {
            var _a;
            destObject.enable = this.enable;
            destObject.alignToDirection = this.alignToDirection;
            destObject.shape = (_a = this.shape) === null || _a === void 0 ? void 0 : _a.clone();
        }
        clone() {
            let destObject = new Shape2DModule();
            this.cloneTo(destObject);
            return destObject;
        }
    }

    class Box2DShape extends Base2DShape {
        constructor() {
            super(exports.Base2DShapeType.Box);
            this.size = new Laya.Vector2(1, 1);
            this.randomDirection = false;
        }
        getPositionAndDirection(randomFn = Math.random) {
            let x = randomFn() * this.size.x + this.size.x * -0.5;
            let y = randomFn() * this.size.y + this.size.y * -0.5;
            let xDir = 0;
            let yDir = 1;
            if (this.randomDirection) {
                let radians = randomFn() * Math.PI * 2;
                xDir = Math.sin(radians);
                yDir = Math.cos(radians);
            }
            this.posAndDir.setValue(x, y, xDir, yDir);
            return this.posAndDir;
        }
        cloneTo(destObject) {
            this.size.cloneTo(destObject.size);
            destObject.randomDirection = this.randomDirection;
        }
        clone() {
            let destObject = new Box2DShape();
            this.cloneTo(destObject);
            return destObject;
        }
    }

    class Circle2DShape extends Base2DShape {
        constructor() {
            super(exports.Base2DShapeType.Circle);
            this.radius = 1;
            this.emitFromEdge = false;
            this.randomDirction = false;
        }
        getPositionAndDirection(randomFn = Math.random) {
            let radians = randomFn() * Math.PI * 2;
            let xDir = Math.sin(radians);
            let yDir = Math.cos(radians);
            let x = 0;
            let y = 0;
            if (this.emitFromEdge) {
                x = xDir * this.radius;
                y = yDir * this.radius;
            }
            else {
                let length = randomFn() * this.radius;
                x = xDir * length;
                y = yDir * length;
            }
            if (this.randomDirction) {
                let radians = randomFn() * Math.PI * 2;
                xDir = Math.sin(radians);
                yDir = Math.cos(radians);
            }
            this.posAndDir.setValue(x, y, xDir, yDir);
            this.applyTransform();
            return this.posAndDir;
        }
        cloneTo(destObject) {
            destObject.radius = this.radius;
            destObject.emitFromEdge = this.emitFromEdge;
            destObject.randomDirction = this.randomDirction;
            this.cloneTransformTo(destObject);
        }
        clone() {
            let destObject = new Circle2DShape();
            this.cloneTo(destObject);
            return destObject;
        }
    }

    class SemicircleShap extends Base2DShape {
        constructor() {
            super(exports.Base2DShapeType.Semicircle);
            this.radius = 1;
            this.emitFromEdge = false;
            this.randomDirction = false;
        }
        getPositionAndDirection(randomFn = Math.random) {
            let radians = randomFn() * Math.PI - Math.PI * 0.5;
            let xDir = Math.sin(radians);
            let yDir = Math.cos(radians);
            let x = 0;
            let y = 0;
            if (this.emitFromEdge) {
                x = xDir * this.radius;
                y = yDir * this.radius;
            }
            else {
                let length = randomFn() * this.radius;
                x = xDir * length;
                y = yDir * length;
            }
            if (this.randomDirction) {
                let radians = randomFn() * Math.PI - Math.PI * 0.5;
                xDir = Math.sin(radians);
                yDir = Math.cos(radians);
            }
            this.posAndDir.setValue(x, y, xDir, yDir);
            return this.posAndDir;
        }
        cloneTo(destObject) {
            destObject.radius = this.radius;
            destObject.emitFromEdge = this.emitFromEdge;
            destObject.randomDirction = this.randomDirction;
        }
        clone() {
            let destObject = new SemicircleShap();
            this.cloneTo(destObject);
            return destObject;
        }
    }

    class Size2DOverLifetimeModule {
        get x() {
            return this._x;
        }
        set x(value) {
            this._x = value;
            this._y.mode = value.mode;
        }
        get y() {
            return this._y;
        }
        set y(value) {
            this._y = value;
            this._x.mode = value.mode;
        }
        get size() {
            return this.x;
        }
        set size(value) {
            this.x = value;
        }
        constructor() {
            this.enable = true;
            this.separateAxes = false;
            this._x = new Laya.ParticleMinMaxCurve();
            this._y = new Laya.ParticleMinMaxCurve();
            this.x.mode = Laya.ParticleMinMaxCurveMode.Constant;
            this.x.constantMin = 1;
            this.x.constantMax = 1;
            this.x.curveMin.add(0, 0);
            this.x.curveMin.add(1, 1);
            this.x.curveMax.add(0, 0);
            this.x.curveMax.add(1, 1);
            this.y.mode = Laya.ParticleMinMaxCurveMode.Constant;
            this.y.constantMin = 1;
            this.y.constantMax = 1;
            this.y.curveMin.add(0, 0);
            this.y.curveMin.add(1, 1);
            this.y.curveMax.add(0, 0);
            this.y.curveMax.add(1, 1);
        }
        cloneTo(destObject) {
            destObject.enable = this.enable;
            destObject.separateAxes = this.separateAxes;
            this.x.cloneTo(destObject.x);
            this.y.cloneTo(destObject.y);
        }
        clone() {
            let dest = new Size2DOverLifetimeModule();
            this.cloneTo(dest);
            return dest;
        }
    }

    exports.Velocity2DSimulateSpace = void 0;
    (function (Velocity2DSimulateSpace) {
        Velocity2DSimulateSpace[Velocity2DSimulateSpace["Local"] = 0] = "Local";
        Velocity2DSimulateSpace[Velocity2DSimulateSpace["World"] = 1] = "World";
    })(exports.Velocity2DSimulateSpace || (exports.Velocity2DSimulateSpace = {}));
    class Velocity2DOverLifetimeModule {
        get x() {
            return this._x;
        }
        set x(value) {
            this._x = value;
            this._y.mode = value.mode;
        }
        get y() {
            return this._y;
        }
        set y(value) {
            this._y = value;
            this._x.mode = value.mode;
        }
        constructor() {
            this.enable = true;
            this.space = exports.Velocity2DSimulateSpace.Local;
            this._x = new Laya.ParticleMinMaxCurve();
            this._y = new Laya.ParticleMinMaxCurve();
        }
        cloneTo(destObject) {
            destObject.enable = this.enable;
            destObject.space = this.space;
            this.x.cloneTo(destObject.x);
            this.y.cloneTo(destObject.y);
        }
        clone() {
            let dest = new Velocity2DOverLifetimeModule();
            this.cloneTo(dest);
            return dest;
        }
    }

    class Particle2DGeomotry {
        constructor(maxParticleCount, particleDeclaration, meshDeclaration) {
            this.maxParitcleCount = 0;
            this.maxParitcleCount = maxParticleCount;
            this.bufferState = Laya.LayaGL.renderDeviceFactory.createBufferState();
            maxParticleCount += 1;
            {
                let vertexCount = 4 * maxParticleCount;
                let particleBuffer = this.particleBuffer = Laya.LayaGL.renderDeviceFactory.createVertexBuffer(Laya.BufferUsage.Dynamic);
                particleBuffer.vertexDeclaration = particleDeclaration;
                let particleFloatStride = particleDeclaration.vertexStride / 4;
                let particleData = this.particleDatas = new Float32Array(vertexCount * particleFloatStride);
                particleBuffer.setDataLength(particleData.byteLength);
                let meshBuffer = Laya.LayaGL.renderDeviceFactory.createVertexBuffer(Laya.BufferUsage.Static);
                meshBuffer.vertexDeclaration = meshDeclaration;
                let meshFloatStride = meshDeclaration.vertexStride / 4;
                let meshData = new Float32Array(vertexCount * meshFloatStride);
                for (let i = 0; i < maxParticleCount; i++) {
                    let offset = i * 4 * meshFloatStride;
                    let pos0 = offset;
                    meshData[pos0 + 0] = -0.5;
                    meshData[pos0 + 1] = -0.5;
                    meshData[pos0 + 2] = 0;
                    meshData[pos0 + 3] = 0;
                    let pos1 = offset + meshFloatStride;
                    meshData[pos1 + 0] = 0.5;
                    meshData[pos1 + 1] = -0.5;
                    meshData[pos1 + 2] = 1;
                    meshData[pos1 + 3] = 0;
                    let pos2 = offset + 2 * meshFloatStride;
                    meshData[pos2 + 0] = 0.5;
                    meshData[pos2 + 1] = 0.5;
                    meshData[pos2 + 2] = 1;
                    meshData[pos2 + 3] = 1;
                    let pos3 = offset + 3 * meshFloatStride;
                    meshData[pos3 + 0] = -0.5;
                    meshData[pos3 + 1] = 0.5;
                    meshData[pos3 + 2] = 0;
                    meshData[pos3 + 3] = 1;
                }
                meshBuffer.setDataLength(meshData.byteLength);
                meshBuffer.setData(meshData.buffer, 0, 0, meshData.byteLength);
                let indexBuffer = this.indexBuffer = Laya.LayaGL.renderDeviceFactory.createIndexBuffer(Laya.BufferUsage.Static);
                let indexCount = 6 * maxParticleCount;
                let indexFormat = vertexCount > 65535 ? Laya.IndexFormat.UInt32 : Laya.IndexFormat.UInt16;
                let indexData;
                if (indexFormat == Laya.IndexFormat.UInt16) {
                    indexData = new Uint16Array(indexCount);
                }
                else {
                    indexData = new Uint32Array(indexCount);
                }
                const meshIndies = [0, 1, 2, 0, 2, 3];
                for (let i = 0; i < maxParticleCount; i++) {
                    let offset = i * 6;
                    indexData[offset + 0] = meshIndies[0] + 4 * i;
                    indexData[offset + 1] = meshIndies[1] + 4 * i;
                    indexData[offset + 2] = meshIndies[2] + 4 * i;
                    indexData[offset + 3] = meshIndies[3] + 4 * i;
                    indexData[offset + 4] = meshIndies[4] + 4 * i;
                    indexData[offset + 5] = meshIndies[5] + 4 * i;
                }
                indexBuffer.indexCount = indexCount;
                indexBuffer.indexType = indexFormat;
                indexBuffer._setIndexDataLength(indexData.byteLength);
                indexBuffer._setIndexData(indexData, 0);
                this.bufferState.applyState([meshBuffer, particleBuffer], indexBuffer);
            }
            {
                let geometry = Laya.LayaGL.renderDeviceFactory.createRenderGeometryElement(Laya.MeshTopology.Triangles, Laya.DrawType.DrawElement);
                geometry.indexFormat = this.indexBuffer.indexType;
                geometry.bufferState = this.bufferState;
                this.geometry = geometry;
            }
        }
        destroy() {
            this.geometry.destroy();
            this.bufferState.destroy();
        }
    }

    var Particle2DCommon = "#if !defined(ShruikenParticleCommon_glsl)\n#define ShruikenParticleCommon_glsl\n#ifdef GRADIENTKEYCOUNT_8\n#define PARTICLE2D_GRADIENT_VEC4_COUNT 4\n#define PARTICLE2D_GRADIENT_KEY_COUNT 8\n#else\n#define PARTICLE2D_GRADIENT_VEC4_COUNT 2\n#define PARTICLE2D_GRADIENT_KEY_COUNT 4\n#endif\nuniform vec3 u_NMatrix_0;uniform vec3 u_NMatrix_1;uniform vec2 u_size;\n#ifdef COLOROVERLIFETIME\n#ifdef COLOROVERLIFETIME_COLORKEY_8\nuniform vec4 u_GradientRGB[8];uniform vec4 u_GradientAlpha[4];uniform vec4 u_GradientMaxRGB[8];uniform vec4 u_GradientMaxAlpha[4];\n#else\nuniform vec4 u_GradientRGB[4];uniform vec4 u_GradientAlpha[2];uniform vec4 u_GradientMaxRGB[4];uniform vec4 u_GradientMaxAlpha[2];\n#endif\nuniform vec4 u_GradientTimeRange;uniform vec4 u_GradientMaxTimeRange;\n#endif\n#ifdef VELOCITYOVERLIFETIME\nuniform vec4 u_VelocityCurveMinX[PARTICLE2D_GRADIENT_VEC4_COUNT];uniform vec4 u_VelocityCurveMinY[PARTICLE2D_GRADIENT_VEC4_COUNT];uniform vec4 u_VelocityCurveMaxX[PARTICLE2D_GRADIENT_VEC4_COUNT];uniform vec4 u_VelocityCurveMaxY[PARTICLE2D_GRADIENT_VEC4_COUNT];uniform float u_VelocityOverLifetimeSpace;\n#endif\n#ifdef SIZEOVERLIFETIME\nuniform vec4 u_SizeCurveMinX[PARTICLE2D_GRADIENT_VEC4_COUNT];uniform vec4 u_SizeCurveMinY[PARTICLE2D_GRADIENT_VEC4_COUNT];uniform vec4 u_SizeCurveMinTimeRange;uniform vec4 u_SizeCurveMaxX[PARTICLE2D_GRADIENT_VEC4_COUNT];uniform vec4 u_SizeCurveMaxY[PARTICLE2D_GRADIENT_VEC4_COUNT];uniform vec4 u_SizeCurveMaxTimeRange;\n#endif\n#ifdef ROTATIONOVERLIFETIME\nuniform vec4 u_RotationCurveMin[PARTICLE2D_GRADIENT_VEC4_COUNT];uniform vec4 u_RotationCurveMax[PARTICLE2D_GRADIENT_VEC4_COUNT];\n#endif\n#ifdef TEXTURESHEETANIMATION\nuniform vec4 u_TextureSheetFrame[PARTICLE2D_GRADIENT_VEC4_COUNT];uniform vec4 u_TextureSheetFrameMax[PARTICLE2D_GRADIENT_VEC4_COUNT];uniform vec4 u_TextureSheetFrameRange;uniform vec4 u_TextureSheetFrameData;\n#endif\nuniform float u_CurrentTime;uniform float u_UnitPixels;uniform vec4 u_SpriteRotAndScale;varying vec4 v_ParticleColor;varying vec2 v_ParticleUV;\n#ifdef CAMERA2D\nuniform mat3 u_view2D;\n#endif\n#ifdef RENDERTEXTURE\nuniform vec3 u_InvertMat_0;uniform vec3 u_InvertMat_1;\n#endif\n#endif\n";

    var Particle2DFrag = "#if !defined(ShurikenParticleFrag_glsl)\n#define ShurikenParticleFrag_glsl\n#include \"ClipFrag.glsl\"\n#include \"Particle2DCommon.glsl\"\nvec4 getParticleColor(){return v_ParticleColor;}vec2 getParticleUV(){return v_ParticleUV;}\n#endif\n";

    var Particle2DLifetimeColor = "#ifdef COLOROVERLIFETIME\n#ifdef COLOROVERLIFETIME_COLORKEY_8\nvec4 getColorFromGradient(float normalizedAge,vec4 gradientRGB[8],vec4 gradientAlpha[4],vec4 range){vec4 color=vec4(1.0,1.0,1.0,1.0);vec2 colorRange=range.xy;float colorAge=clamp(normalizedAge,colorRange.x,colorRange.y);for(int i=1;i<8;i++){vec4 currentRGB=gradientRGB[i];vec4 lastRGB=gradientRGB[i-1];if(currentRGB.x>=colorAge){float t=(colorAge-lastRGB.x)/(currentRGB.x-lastRGB.x);color.rgb=mix(lastRGB.yzw,currentRGB.yzw,t);break;}}vec2 alphaRange=range.zw;float alphaAge=clamp(normalizedAge,alphaRange.x,alphaRange.y);vec2 alphas[8];alphas[0]=gradientAlpha[0].xy;alphas[1]=gradientAlpha[0].zw;alphas[2]=gradientAlpha[1].xy;alphas[3]=gradientAlpha[1].zw;alphas[4]=gradientAlpha[2].xy;alphas[5]=gradientAlpha[2].zw;alphas[6]=gradientAlpha[3].xy;alphas[7]=gradientAlpha[3].zw;for(int i=1;i<8;i++){vec2 currentAlpha=alphas[i];vec2 lastAlpha=alphas[i-1];if(currentAlpha.x>=alphaAge){float t=(alphaAge-lastAlpha.x)/(currentAlpha.x-lastAlpha.x);color.a=mix(lastAlpha.y,currentAlpha.y,t);break;}}return color;}\n#else\nvec4 getColorFromGradient(float normalizedAge,vec4 gradientRGB[4],vec4 gradientAlpha[2],vec4 range){vec4 color=vec4(1.0,1.0,1.0,1.0);vec2 colorRange=range.xy;float colorAge=clamp(normalizedAge,colorRange.x,colorRange.y);for(int i=1;i<4;i++){vec4 currentRGB=gradientRGB[i];vec4 lastRGB=gradientRGB[i-1];if(currentRGB.x>=colorAge){float t=(colorAge-lastRGB.x)/(currentRGB.x-lastRGB.x);color.rgb=mix(lastRGB.yzw,currentRGB.yzw,t);break;}}vec2 alphaRange=range.zw;float alphaAge=clamp(normalizedAge,alphaRange.x,alphaRange.y);vec2 alphas[4];alphas[0]=gradientAlpha[0].xy;alphas[1]=gradientAlpha[0].zw;alphas[2]=gradientAlpha[1].xy;alphas[3]=gradientAlpha[1].zw;for(int i=1;i<4;i++){vec2 currentAlpha=alphas[i];vec2 lastAlpha=alphas[i-1];if(currentAlpha.x>=alphaAge){float t=(alphaAge-lastAlpha.x)/(currentAlpha.x-lastAlpha.x);color.a=mix(lastAlpha.y,currentAlpha.y,t);break;}}return color;}\n#endif\nvec4 getColorOverLifetime(float normalizedAge){\n#ifdef COLOROVERLIFETIME_RANDOM\nvec4 minColor=getColorFromGradient(normalizedAge,u_GradientRGB,u_GradientAlpha,u_GradientTimeRange);vec4 maxColor=getColorFromGradient(normalizedAge,u_GradientMaxRGB,u_GradientMaxAlpha,u_GradientMaxTimeRange);return mix(minColor,maxColor,a_Random.x);\n#else\nreturn getColorFromGradient(normalizedAge,u_GradientRGB,u_GradientAlpha,u_GradientTimeRange);\n#endif\n}\n#endif\n";

    var Particle2DLifetimeRotation = "#ifdef ROTATIONOVERLIFETIME\nconst float Angle2Radian=0.01745329252;float getRotationOverLifetime(float normalizedAge,float lifetime){float minRotation=getCurveCalculus(normalizedAge,lifetime,u_RotationCurveMin);float maxRotation=getCurveCalculus(normalizedAge,lifetime,u_RotationCurveMax);return mix(minRotation*-1.0*Angle2Radian,maxRotation*-1.0*Angle2Radian,a_Random.w);}\n#endif\n";

    var Particle2DLifetimeSize = "#ifdef SIZEOVERLIFETIME\nvec2 getSizeOverLifetime(float normalizedAge){float minSizeX=getCurveValue(normalizedAge,u_SizeCurveMinX,u_SizeCurveMinTimeRange.xy);float minSizeY=getCurveValue(normalizedAge,u_SizeCurveMinY,u_SizeCurveMinTimeRange.zw);float maxSizeX=getCurveValue(normalizedAge,u_SizeCurveMaxX,u_SizeCurveMaxTimeRange.xy);float maxSizeY=getCurveValue(normalizedAge,u_SizeCurveMaxY,u_SizeCurveMaxTimeRange.zw);vec2 minSize=vec2(minSizeX,minSizeY);vec2 maxSize=vec2(maxSizeX,maxSizeY);vec2 size=mix(minSize,maxSize,vec2(a_Random1.xy));return size;}\n#endif\n";

    var Particle2DLifetimeVelocity = "#ifdef VELOCITYOVERLIFETIME\nvec2 getVelocityOverLifetimeDistance(float normalizedAge,float lifetime){float minDistanceX=getCurveCalculus(normalizedAge,lifetime,u_VelocityCurveMinX);float minDistanceY=getCurveCalculus(normalizedAge,lifetime,u_VelocityCurveMinY);float maxDistanceX=getCurveCalculus(normalizedAge,lifetime,u_VelocityCurveMaxX);float maxDistanceY=getCurveCalculus(normalizedAge,lifetime,u_VelocityCurveMaxY);vec2 minDistance=vec2(minDistanceX,minDistanceY);vec2 maxDistance=vec2(maxDistanceX,maxDistanceY);vec2 dis=mix(minDistance,maxDistance,vec2(a_Random.y,a_Random.z));return dis*vec2(1.0,-1.0);}\n#endif\n";

    var Particle2DTextureSheetAnimation = "#ifdef TEXTURESHEETANIMATION\nvec2 getAnimationUV(float normalizedAge,vec2 uv){float cycles=u_TextureSheetFrameData.z;vec2 gridUV=1.0/u_TextureSheetFrameData.xy;float startFrame=a_SheetFrameData.x;float frameCount=a_SheetFrameData.y;float rowIndex=a_SheetFrameData.z;float cycleTime=mod(normalizedAge*cycles,1.0);float minFrame=getCurveValue(cycleTime,u_TextureSheetFrame,u_TextureSheetFrameRange.xy);float maxFrame=getCurveValue(cycleTime,u_TextureSheetFrameMax,u_TextureSheetFrameRange.zw);float frame=floor(mix(minFrame,maxFrame,a_Random1.y));frame=mod(frame+startFrame,frameCount)+rowIndex*u_TextureSheetFrameData.x;float indexX=floor(mod(frame,u_TextureSheetFrameData.x));float indexY=floor(frame/u_TextureSheetFrameData.x);vec2 uvOffset=vec2(indexX,indexY)*gridUV;return uv*gridUV+uvOffset;}\n#endif\n";

    var Particle2DVertex = "#if !defined(ShurikenParticleVertex_glsl)\n#define ShurikenParticleVertex_glsl\n#include \"ClipVertex.glsl\"\n#include \"Particle2DCommon.glsl\"\n#include \"Curve.glsl\"\n#include \"Particle2DLifetimeColor.glsl\"\n#include \"Particle2DLifetimeRotation.glsl\"\n#include \"Particle2DLifetimeSize.glsl\"\n#include \"Particle2DLifetimeVelocity.glsl\"\n#include \"Particle2DTextureSheetAnimation.glsl\"\nstruct VertexInfo{vec2 position;vec2 uv;};VertexInfo getVertexInfo(){VertexInfo vertex;vertex.position=a_PositionAndUV.xy;vertex.uv=a_PositionAndUV.zw;return vertex;}struct Particle{float age;float lifetime;vec2 position;vec2 startVelocity;vec2 size;vec2 rot;vec2 gravity;vec4 color;vec2 uv;vec2 meshPos;};vec2 transfrom(vec2 pos,vec3 xDir,vec3 yDir){vec2 outPos;outPos.x=xDir.x*pos.x+xDir.y*pos.y+xDir.z;outPos.y=yDir.x*pos.x+yDir.y*pos.y+yDir.z;return outPos;}Particle getParticle(){Particle p;p.age=u_CurrentTime-a_SizeAndTimes.z;p.lifetime=a_SizeAndTimes.w;p.position=a_DirectionAndPosition.zw*vec2(1.0,-1.0);vec4 spriteRotAndScale=mix(u_SpriteRotAndScale,a_SpriteRotAndSacle,a_SpeedSpaceAndRot.y);vec2 spriteRot=spriteRotAndScale.xy;vec2 spriteScale=spriteRotAndScale.zw;mat2 spriteRotMat=mat2(spriteRot.x,spriteRot.y,-spriteRot.y,spriteRot.x);p.position=spriteRotMat*(p.position*spriteScale);float normalizedAge=p.age/p.lifetime;vec2 direction=normalize((a_DirectionAndPosition.xy));float startSpeed=a_SpeedSpaceAndRot.x;p.startVelocity=direction*startSpeed;p.size=a_SizeAndTimes.xy;p.rot=a_SpeedSpaceAndRot.zw;p.gravity=a_SpriteTransAndGravity.zw;p.color=a_StartColor;\n#ifdef COLOROVERLIFETIME\np.color*=getColorOverLifetime(normalizedAge);\n#endif\nVertexInfo vertex=getVertexInfo();p.meshPos=vertex.position;p.uv=vertex.uv;\n#ifdef TEXTURESHEETANIMATION\np.uv=getAnimationUV(normalizedAge,p.uv);\n#endif\nreturn p;}vec4 transPosition(vec2 position,vec3 nMatrix0,vec3 nMatrix1){vec4 pos=vec4(position*u_UnitPixels,0.0,1.0);float x=nMatrix0.x*pos.x+nMatrix0.y*pos.y+nMatrix0.z;float y=nMatrix1.x*pos.x+nMatrix1.y*pos.y+nMatrix1.z;x=(x/u_size.x-0.5)*2.0;y=(0.5-y/u_size.y)*2.0;pos.xy=vec2(x,y);return pos;}void getViewPos(in vec2 globalPos,out vec2 viewPos){\n#ifdef RENDERTEXTURE\nvec2 tempPos=transfrom(globalPos,u_InvertMat_0,u_InvertMat_1);\n#ifdef CAMERA2D\nviewPos.xy=(u_view2D*vec3(tempPos,1.0)).xy+u_size/2.;\n#else\nviewPos.xy=tempPos;\n#endif\n#else\n#ifdef CAMERA2D\nviewPos.xy=(u_view2D*vec3(globalPos,1.0)).xy+u_size/2.;\n#else\nviewPos.xy=globalPos;\n#endif\n#endif\n}void getProjectPos(in vec2 viewPos,out vec4 projectPos){projectPos=vec4((viewPos.x/u_size.x-0.5)*2.0,(0.5-viewPos.y/u_size.y)*2.0,0.,1.0);\n#ifdef INVERTY\nprojectPos.y=-projectPos.y;\n#endif\n}vec4 updateParticlePosition(Particle particle){vec2 position=particle.meshPos;vec4 spriteRotAndScale=mix(u_SpriteRotAndScale,a_SpriteRotAndSacle,a_SpeedSpaceAndRot.y);vec2 spriteRot=spriteRotAndScale.xy;vec2 spriteScale=spriteRotAndScale.zw;mat2 spriteRotMat=mat2(spriteRot.x,spriteRot.y,-spriteRot.y,spriteRot.x);vec2 startVelocity=spriteRotMat*(particle.startVelocity*spriteScale*vec2(1.0,-1.0));vec2 particleOffset=startVelocity*particle.age+0.5*particle.gravity*particle.age*particle.age;vec2 particleSize=particle.size;float normalizedAge=particle.age/particle.lifetime;\n#ifdef SIZEOVERLIFETIME\nvec2 sizeOverLifetime=getSizeOverLifetime(normalizedAge);particleSize*=sizeOverLifetime;\n#endif\nfloat cosAngle=particle.rot.x;float sinAngle=particle.rot.y;mat2 particleRot=mat2(cosAngle,-sinAngle,sinAngle,cosAngle);\n#ifdef ROTATIONOVERLIFETIME\nfloat rotationOverLifetime=getRotationOverLifetime(normalizedAge,particle.lifetime);float cosRot=cos(rotationOverLifetime);float sinRot=sin(rotationOverLifetime);mat2 rotationMat=mat2(cosRot,-sinRot,sinRot,cosRot);particleRot*=rotationMat;\n#endif\nmat2 transMat=particleRot*mat2(particleSize.x,0.0,0.0,particleSize.y);vec2 positionOS=transMat*position;vec2 scale=spriteRotAndScale.zw;vec3 nMatrix0=vec3(1.0*scale.x,0.0,0.0);vec3 nMatrix1=vec3(0.0,1.0*scale.y,0.0);positionOS.x=nMatrix0.x*positionOS.x+nMatrix0.y*positionOS.y+nMatrix0.z;positionOS.y=nMatrix1.x*positionOS.x+nMatrix1.y*positionOS.y+nMatrix1.z;positionOS+=particleOffset;\n#ifdef VELOCITYOVERLIFETIME\nvec2 velocityWorldDistance=getVelocityOverLifetimeDistance(normalizedAge,particle.lifetime);vec2 velocityLocalDistance=spriteRotMat*(velocityWorldDistance*vec2(1.0,-1.0));vec2 velocityDistance=mix(velocityLocalDistance,velocityWorldDistance,u_VelocityOverLifetimeSpace);positionOS+=velocityDistance;\n#endif\nvec2 loaclTrans=vec2(u_NMatrix_0.z,u_NMatrix_1.z);vec2 worldTrans=vec2(a_SpriteTransAndGravity.xy);float space=a_SpeedSpaceAndRot.y;vec2 trans=mix(loaclTrans,worldTrans,space);vec2 positionWS=positionOS+trans/u_UnitPixels;float x=positionWS.x;float y=positionWS.y;x=x+particle.position.x;y=y+particle.position.y;vec4 positionCS=vec4(x*u_UnitPixels,y*u_UnitPixels,0.0,1.0);clip(positionCS.xy);vec2 viewPos;getViewPos(positionCS.xy,viewPos);getProjectPos(viewPos,positionCS);return positionCS;}void shareParticleParams(Particle p){v_ParticleColor=p.color;v_ParticleUV=p.uv;}\n#endif\n";

    var Curve = "#if !defined(GradientNumber_lib)\n#define GradientNumber_lib\nfloat getCurveValue(float time,vec4 curve[PARTICLE2D_GRADIENT_VEC4_COUNT],vec2 range){vec2 curveDatas[PARTICLE2D_GRADIENT_KEY_COUNT];curveDatas[0]=curve[0].xy;curveDatas[1]=curve[0].zw;curveDatas[2]=curve[1].xy;curveDatas[3]=curve[1].zw;\n#ifdef GRADIENTKEYCOUNT_8\ncurveDatas[4]=curve[2].xy;curveDatas[5]=curve[2].zw;curveDatas[6]=curve[3].xy;curveDatas[7]=curve[3].zw;\n#endif\nfloat age=clamp(time,range.x,range.y);float value=curveDatas[0].y;for(int i=1;i<PARTICLE2D_GRADIENT_KEY_COUNT;i++){vec2 current=curveDatas[i];vec2 previous=curveDatas[i-1];if(current.x<=previous.x)break;if(age<=current.x){float t=(age-previous.x)/(current.x-previous.x);return mix(previous.y,current.y,t);}value=current.y;}return value;}float getCurveCalculus(float normalizedAge,float lifetime,vec4 curve[PARTICLE2D_GRADIENT_VEC4_COUNT]){vec2 curveDatas[PARTICLE2D_GRADIENT_KEY_COUNT];curveDatas[0]=curve[0].xy;curveDatas[1]=curve[0].zw;curveDatas[2]=curve[1].xy;curveDatas[3]=curve[1].zw;\n#ifdef GRADIENTKEYCOUNT_8\ncurveDatas[4]=curve[2].xy;curveDatas[5]=curve[2].zw;curveDatas[6]=curve[3].xy;curveDatas[7]=curve[3].zw;\n#endif\nfloat keyTime=min(normalizedAge,curveDatas[0].x);float lastValue=curveDatas[0].y;float totalValue=lifetime*keyTime*lastValue;for(int i=1;i<PARTICLE2D_GRADIENT_KEY_COUNT;i++){vec2 current=curveDatas[i];vec2 previous=curveDatas[i-1];if(current.x<=previous.x)break;float time=max(min(normalizedAge,current.x)-previous.x,0.0);float t=time/(current.x-previous.x);lastValue=mix(previous.y,current.y,t);totalValue+=(previous.y+lastValue)*time*lifetime*0.5;keyTime=max(keyTime,min(normalizedAge,current.x));if(current.x>=normalizedAge)break;}totalValue+=max(normalizedAge-keyTime,0.0)*lifetime*lastValue;return totalValue;}\n#endif\n";

    class Particle2DShader {
        static init() {
            Particle2DShader.GradientKeyCount8Def = Laya.Shader3D.getDefineByName("GRADIENTKEYCOUNT_8");
            Laya.Shader3D.addInclude("Particle2DCommon.glsl", Particle2DCommon);
            Laya.Shader3D.addInclude("Particle2DFrag.glsl", Particle2DFrag);
            Laya.Shader3D.addInclude("Particle2DLifetimeColor.glsl", Particle2DLifetimeColor);
            Laya.Shader3D.addInclude("Particle2DLifetimeRotation.glsl", Particle2DLifetimeRotation);
            Laya.Shader3D.addInclude("Particle2DLifetimeSize.glsl", Particle2DLifetimeSize);
            Laya.Shader3D.addInclude("Particle2DLifetimeVelocity.glsl", Particle2DLifetimeVelocity);
            Laya.Shader3D.addInclude("Particle2DTextureSheetAnimation.glsl", Particle2DTextureSheetAnimation);
            Laya.Shader3D.addInclude("Particle2DVertex.glsl", Particle2DVertex);
            Laya.Shader3D.addInclude("Curve.glsl", Curve);
            const uniformMap = Laya.LayaGL.renderDeviceFactory.createGlobalUniformMap("_Particle2D");
            const addUniform = (name, type) => {
                let index = Laya.Shader3D.propertyNameToID(name);
                uniformMap.addShaderUniform(index, name, type);
                return index;
            };
            const addUniformArray = (name, type, arrayLength) => {
                let index = Laya.Shader3D.propertyNameToID(name);
                uniformMap.addShaderUniformArray(index, name, type, arrayLength);
                return index;
            };
            Particle2DShader.CurrentTime = addUniform("u_CurrentTime", Laya.ShaderDataType.Float);
            Particle2DShader.UnitPixels = addUniform("u_UnitPixels", Laya.ShaderDataType.Float);
            Particle2DShader.SpriteRotAndScale = addUniform("u_SpriteRotAndScale", Laya.ShaderDataType.Vector4);
            {
                Particle2DShader.ColorOverLifetimeDef = Laya.Shader3D.getDefineByName("COLOROVERLIFETIME");
                Particle2DShader.ColorOverLifetimeRandom = Laya.Shader3D.getDefineByName("COLOROVERLIFETIME_RANDOM");
                Particle2DShader.ColorOVerLifetimeColorKey_8 = Laya.Shader3D.getDefineByName("COLOROVERLIFETIME_COLORKEY_8");
                Particle2DShader.GradientRGB = addUniformArray("u_GradientRGB", Laya.ShaderDataType.Vector4, 8);
                Particle2DShader.GradientAlpha = addUniformArray("u_GradientAlpha", Laya.ShaderDataType.Vector4, 4);
                Particle2DShader.GradientTimeRange = addUniform("u_GradientTimeRange", Laya.ShaderDataType.Vector4);
                Particle2DShader.GradientMaxRGB = addUniformArray("u_GradientMaxRGB", Laya.ShaderDataType.Vector4, 8);
                Particle2DShader.GradientMaxAlpha = addUniformArray("u_GradientMaxAlpha", Laya.ShaderDataType.Vector4, 4);
                Particle2DShader.GradientMaxTimeRange = addUniform("u_GradientMaxTimeRange", Laya.ShaderDataType.Vector4);
            }
            {
                Particle2DShader.VelocityOverLifetimeDef = Laya.Shader3D.getDefineByName("VELOCITYOVERLIFETIME");
                Particle2DShader.VelocityCurveMinX = addUniformArray("u_VelocityCurveMinX", Laya.ShaderDataType.Vector4, 4);
                Particle2DShader.VelocityCurveMinY = addUniformArray("u_VelocityCurveMinY", Laya.ShaderDataType.Vector4, 4);
                Particle2DShader.VelocityCurveMaxX = addUniformArray("u_VelocityCurveMaxX", Laya.ShaderDataType.Vector4, 4);
                Particle2DShader.VelocityCurveMaxY = addUniformArray("u_VelocityCurveMaxY", Laya.ShaderDataType.Vector4, 4);
                Particle2DShader.VelocityOverLifetimeSpace = addUniform("u_VelocityOverLifetimeSpace", Laya.ShaderDataType.Float);
            }
            {
                Particle2DShader.SizeOverLifetimeDef = Laya.Shader3D.getDefineByName("SIZEOVERLIFETIME");
                Particle2DShader.SizeCurveMinX = addUniformArray("u_SizeCurveMinX", Laya.ShaderDataType.Vector4, 4);
                Particle2DShader.SizeCurveMinY = addUniformArray("u_SizeCurveMinY", Laya.ShaderDataType.Vector4, 4);
                Particle2DShader.SizeCurveMinTimeRange = addUniform("u_SizeCurveMinTimeRange", Laya.ShaderDataType.Vector4);
                Particle2DShader.SizeCurveMaxX = addUniformArray("u_SizeCurveMaxX", Laya.ShaderDataType.Vector4, 4);
                Particle2DShader.SizeCurveMaxY = addUniformArray("u_SizeCurveMaxY", Laya.ShaderDataType.Vector4, 4);
                Particle2DShader.SizeCurveMaxTimeRange = addUniform("u_SizeCurveMaxTimeRange", Laya.ShaderDataType.Vector4);
            }
            {
                Particle2DShader.RotationOverLifetimeDef = Laya.Shader3D.getDefineByName("ROTATIONOVERLIFETIME");
                Particle2DShader.RotationCurveMin = addUniformArray("u_RotationCurveMin", Laya.ShaderDataType.Vector4, 4);
                Particle2DShader.RotationCurveMax = addUniformArray("u_RotationCurveMax", Laya.ShaderDataType.Vector4, 4);
            }
            {
                Particle2DShader.TextureSheetAnimationDef = Laya.Shader3D.getDefineByName("TEXTURESHEETANIMATION");
                Particle2DShader.TextureSheetFrameData = addUniform("u_TextureSheetFrameData", Laya.ShaderDataType.Vector4);
                Particle2DShader.TextureSheetFrame = addUniformArray("u_TextureSheetFrame", Laya.ShaderDataType.Vector4, 4);
                Particle2DShader.TextureSheetFrameMax = addUniformArray("u_TextureSheetFrameMax", Laya.ShaderDataType.Vector4, 4);
                Particle2DShader.TextureSheetFrameRange = addUniform("u_TextureSheetFrameRange", Laya.ShaderDataType.Vector4);
            }
        }
    }

    exports.Particle2DVertex = void 0;
    (function (Particle2DVertex) {
        Particle2DVertex[Particle2DVertex["PositionAndUV"] = 0] = "PositionAndUV";
        Particle2DVertex[Particle2DVertex["SheetFrameData"] = 7] = "SheetFrameData";
        Particle2DVertex[Particle2DVertex["DirectionAndPosition"] = 8] = "DirectionAndPosition";
        Particle2DVertex[Particle2DVertex["SizeAndTimes"] = 9] = "SizeAndTimes";
        Particle2DVertex[Particle2DVertex["SpeedSpaceAndRot"] = 10] = "SpeedSpaceAndRot";
        Particle2DVertex[Particle2DVertex["StartColor"] = 11] = "StartColor";
        Particle2DVertex[Particle2DVertex["RotationAndScale"] = 12] = "RotationAndScale";
        Particle2DVertex[Particle2DVertex["TransAndGravity"] = 13] = "TransAndGravity";
        Particle2DVertex[Particle2DVertex["Random0"] = 14] = "Random0";
        Particle2DVertex[Particle2DVertex["Random1"] = 15] = "Random1";
    })(exports.Particle2DVertex || (exports.Particle2DVertex = {}));
    class Particle2D {
        constructor() {
            let particleStride = Particle2DVertexMesh.Particle2DDeclaration.vertexStride;
            let buffer = new ArrayBuffer(particleStride);
            this.data = new Float32Array(buffer);
        }
        setDirection(x, y) {
            this.data[0] = x;
            this.data[1] = y;
        }
        setPosition(x, y) {
            this.data[2] = x;
            this.data[3] = y;
        }
        setSize(x, y) {
            this.data[4] = x;
            this.data[5] = y;
        }
        setEmitTime(emitTime) {
            this.data[6] = emitTime;
        }
        setLifetime(lifetime) {
            this.data[7] = lifetime;
        }
        setSpeed(speed) {
            this.data[8] = speed;
        }
        setSimulationSpace(space) {
            this.data[9] = space;
        }
        setRot(cos, sin) {
            this.data[10] = cos;
            this.data[11] = sin;
        }
        setColor(r, g, b, a) {
            this.data[12] = r;
            this.data[13] = g;
            this.data[14] = b;
            this.data[15] = a;
        }
        setSpriteRotAndScale(x, y, z, w) {
            this.data[16] = x;
            this.data[17] = y;
            this.data[18] = z;
            this.data[19] = w;
        }
        setSpriteTrans(x, y) {
            this.data[20] = x;
            this.data[21] = y;
        }
        setGravity(gravityX, gravityY) {
            this.data[22] = gravityX;
            this.data[23] = gravityY;
        }
        setRandom(x, y, z, w) {
            this.data[24] = x;
            this.data[25] = y;
            this.data[26] = z;
            this.data[27] = w;
        }
        setRandom1(x, y, z, w) {
            this.data[28] = x;
            this.data[29] = y;
            this.data[30] = z;
            this.data[31] = w;
        }
        setSheetFrameData(x, y, z, w) {
            this.data[32] = x;
            this.data[33] = y;
            this.data[34] = z;
            this.data[35] = w;
        }
    }
    class Particle2DVertexMesh {
        static init() {
            let particle2DElements = [
                {
                    usage: exports.Particle2DVertex.DirectionAndPosition,
                    format: Laya.VertexElementFormat.Vector4
                },
                {
                    usage: exports.Particle2DVertex.SizeAndTimes,
                    format: Laya.VertexElementFormat.Vector4
                },
                {
                    usage: exports.Particle2DVertex.SpeedSpaceAndRot,
                    format: Laya.VertexElementFormat.Vector4
                },
                {
                    usage: exports.Particle2DVertex.StartColor,
                    format: Laya.VertexElementFormat.Vector4
                },
                {
                    usage: exports.Particle2DVertex.RotationAndScale,
                    format: Laya.VertexElementFormat.Vector4
                },
                {
                    usage: exports.Particle2DVertex.TransAndGravity,
                    format: Laya.VertexElementFormat.Vector4
                },
                {
                    usage: exports.Particle2DVertex.Random0,
                    format: Laya.VertexElementFormat.Vector4
                },
                {
                    usage: exports.Particle2DVertex.Random1,
                    format: Laya.VertexElementFormat.Vector4
                },
                {
                    usage: exports.Particle2DVertex.SheetFrameData,
                    format: Laya.VertexElementFormat.Vector4
                }
            ];
            Particle2DVertexMesh.Particle2DDeclaration = createVertexVertexDeclaration(particle2DElements);
            let particle2DMeshElements = [
                {
                    usage: exports.Particle2DVertex.PositionAndUV,
                    format: Laya.VertexElementFormat.Vector4
                },
            ];
            Particle2DVertexMesh.Particle2DMeshDeclaration = createVertexVertexDeclaration(particle2DMeshElements);
            Particle2DVertexMesh.TempParticle2D = new Particle2D();
            let particleInfo = Particle2DVertexMesh.Particle2DInfo = new Laya.ParticleInfo();
            let declaration = Particle2DVertexMesh.Particle2DDeclaration;
            particleInfo.timeIndex = declaration.getVertexElementByUsage(exports.Particle2DVertex.SizeAndTimes).offset / 4 + 2;
            particleInfo.lifetimeIndex = declaration.getVertexElementByUsage(exports.Particle2DVertex.SizeAndTimes).offset / 4 + 3;
        }
    }
    function getVertexFormatStride(format) {
        switch (format) {
            case Laya.VertexElementFormat.Vector4:
                return 16;
            case Laya.VertexElementFormat.Vector3:
                return 12;
            case Laya.VertexElementFormat.Vector2:
                return 8;
            default:
                throw new Error("Unkonw vertex format.");
        }
    }
    function createVertexVertexDeclaration(vertexElements) {
        let stride = 0;
        let elements = [];
        for (let i = 0; i < vertexElements.length; i++) {
            let element = vertexElements[i];
            let offset = stride;
            let elementStride = getVertexFormatStride(element.format);
            if (elementStride > 0) {
                elements.push(new Laya.VertexElement(offset, element.format, element.usage));
                stride += elementStride;
            }
        }
        return new Laya.VertexDeclaration(stride, elements);
    }

    const _globalPoint = new Laya.Point();
    const _simulateStep = 1.0 / 60.0;
    exports.Particle2DSystemDirtyFlagBits = void 0;
    (function (Particle2DSystemDirtyFlagBits) {
        Particle2DSystemDirtyFlagBits[Particle2DSystemDirtyFlagBits["Velocity2DOverLifetimeBit"] = 1] = "Velocity2DOverLifetimeBit";
        Particle2DSystemDirtyFlagBits[Particle2DSystemDirtyFlagBits["ColorOverLifetimeBit"] = 2] = "ColorOverLifetimeBit";
        Particle2DSystemDirtyFlagBits[Particle2DSystemDirtyFlagBits["Size2DOverLifetimeBit"] = 4] = "Size2DOverLifetimeBit";
        Particle2DSystemDirtyFlagBits[Particle2DSystemDirtyFlagBits["Rotation2DOverLifetimeBit"] = 8] = "Rotation2DOverLifetimeBit";
        Particle2DSystemDirtyFlagBits[Particle2DSystemDirtyFlagBits["TextureSheetAnimationBit"] = 16] = "TextureSheetAnimationBit";
        Particle2DSystemDirtyFlagBits[Particle2DSystemDirtyFlagBits["GradientKeyCountBit"] = 32] = "GradientKeyCountBit";
    })(exports.Particle2DSystemDirtyFlagBits || (exports.Particle2DSystemDirtyFlagBits = {}));
    class ShurikenParticle2DSystem extends Laya.ParticleControler {
        get gradientKeyCount8() {
            return this._gradientKeyCount8;
        }
        set gradientKeyCount8(value) {
            if (this._gradientKeyCount8 === value)
                return;
            this._gradientKeyCount8 = value;
            this._dirtyFlags = ~0;
        }
        get main() {
            return this._main;
        }
        get emission() {
            return this._emission;
        }
        get velocity2DOverLifetime() {
            return this._velocity2DOverLifetime;
        }
        set velocity2DOverLifetime(value) {
            this._velocity2DOverLifetime = value;
            this._dirtyFlags |= exports.Particle2DSystemDirtyFlagBits.Velocity2DOverLifetimeBit;
        }
        get colorOverLifetime() {
            return this._colorOverLifetime;
        }
        set colorOverLifetime(value) {
            this._colorOverLifetime = value;
            this._dirtyFlags |= exports.Particle2DSystemDirtyFlagBits.ColorOverLifetimeBit;
        }
        get size2DOverLifetime() {
            return this._size2DOverLifetime;
        }
        set size2DOverLifetime(value) {
            this._size2DOverLifetime = value;
            this._dirtyFlags |= exports.Particle2DSystemDirtyFlagBits.Size2DOverLifetimeBit;
        }
        get rotation2DOverLifetime() {
            return this._rotation2DOverLifetime;
        }
        set rotation2DOverLifetime(value) {
            this._rotation2DOverLifetime = value;
            this._dirtyFlags |= exports.Particle2DSystemDirtyFlagBits.Rotation2DOverLifetimeBit;
        }
        get textureSheetAnimation() {
            return this._textureSheetAnimation;
        }
        set textureSheetAnimation(value) {
            this._textureSheetAnimation = value;
            this._dirtyFlags |= exports.Particle2DSystemDirtyFlagBits.TextureSheetAnimationBit;
        }
        _initParticleData(particleByteStride, particleInfo) {
            let maxparticles = this.main.maxParticles;
            this._initParticlePool(maxparticles, particleByteStride, particleInfo);
        }
        constructor() {
            super();
            this._dirtyFlags = ~0;
            this._gradientKeyCount8 = false;
            this._rand = new Laya.Rand(0);
            this._randomSeeds = new Uint32Array(16);
            this._getShapeRandom = () => {
                return this._getFloat(14);
            };
            this._main = new Main2DModule();
            this._emission = new Laya.EmissionModule();
            this._dirtyFlags = ~0;
        }
        _getFloat(seedIndex) {
            if (this.main.autoRandomSeed) {
                return Math.random();
            }
            this._rand.seed = this._randomSeeds[seedIndex];
            let value = this._rand.getFloat();
            this._randomSeeds[seedIndex] = this._rand.seed;
            return value;
        }
        play() {
            super.play();
            if (!this.main.autoRandomSeed) {
                this._rand.seed = this.main.randomSeed;
                for (let i = 0; i < this._randomSeeds.length; i++) {
                    this._randomSeeds[i] = this._rand.getUint();
                }
            }
            this.emission._emitAccumulator = 0;
            let globalPoint = _globalPoint;
            this.owner.globalTrans.getPos(globalPoint);
            this.emission._lastPosition.setValue(globalPoint.x, globalPoint.y, 0);
        }
        getPositionAndDirection() {
            if (this.shape && this.shape.enable && this.shape.shape) {
                return this.shape.shape.getPositionAndDirection(this._getShapeRandom);
            }
            else {
                return Laya.Vector4.UnitW;
            }
        }
        _emit(emitTime, age) {
            if (this.particlePool.activeParticleCount >= this.main.maxParticles) {
                return false;
            }
            const main = this.main;
            let particle = Particle2DVertexMesh.TempParticle2D;
            let duration = main.duration;
            let normalizedTime = this.time / duration;
            let lifetimeRandom = curveNeedRandom(main.startLifetime.mode) ? this._getFloat(0) : 0;
            let lifetime = main.startLifetime.evaluate(normalizedTime, lifetimeRandom);
            let startDelayRandom = curveNeedRandom(main.startDelay.mode) ? this._getFloat(1) : 0;
            let startDelay = main.startDelay.evaluate(normalizedTime, startDelayRandom);
            let startSpeedRandom = curveNeedRandom(main.startSpeed.mode) ? this._getFloat(2) : 0;
            let startSpeed = main.startSpeed.evaluate(normalizedTime, startSpeedRandom);
            let startSizeXRandom = curveNeedRandom(main.startSizeX.mode) ? this._getFloat(3) : 0;
            let startSizeX = main.startSizeX.evaluate(normalizedTime, startSizeXRandom);
            let startSizeY = startSizeX;
            if (main.startSize2D) {
                let startSizeYRandom = curveNeedRandom(main.startSizeY.mode) ? this._getFloat(4) : 0;
                startSizeY = main.startSizeY.evaluate(normalizedTime, startSizeYRandom);
            }
            let startRotationRandom = curveNeedRandom(main.startRotation.mode) ? this._getFloat(5) : 0;
            let startRotation = main.startRotation.evaluate(normalizedTime, startRotationRandom);
            let startRadians = -startRotation * Math.PI / 180;
            particle.setEmitTime(emitTime + startDelay);
            particle.setLifetime(lifetime);
            let startPosAndDir = this.getPositionAndDirection();
            particle.setPosition(startPosAndDir.x, startPosAndDir.y);
            particle.setDirection(startPosAndDir.z, startPosAndDir.w);
            particle.setSize(startSizeX, startSizeY);
            particle.setSpeed(startSpeed);
            particle.setGravity(main._gravity.x, main._gravity.y);
            let rotCos = Math.cos(startRadians);
            let rotSin = Math.sin(startRadians);
            if (this.shape && this.shape.enable && this.shape.alignToDirection) {
                let dirX = startPosAndDir.z;
                let dirY = startPosAndDir.w;
                let dirLen = Math.sqrt(dirX * dirX + dirY * dirY);
                if (dirLen > 1e-6) {
                    let baseCos = dirY / dirLen;
                    let baseSin = -dirX / dirLen;
                    let cosPhi = main._spriteRotAndScale.x;
                    let sinPhi = main._spriteRotAndScale.y;
                    let phiLen = Math.sqrt(cosPhi * cosPhi + sinPhi * sinPhi);
                    if (phiLen > 1e-6) {
                        cosPhi /= phiLen;
                        sinPhi /= phiLen;
                    }
                    else {
                        cosPhi = 1;
                        sinPhi = 0;
                    }
                    let cosDir = cosPhi * baseCos + sinPhi * baseSin;
                    let sinDir = -sinPhi * baseCos + cosPhi * baseSin;
                    let cosTotal = rotCos * cosDir - rotSin * sinDir;
                    let sinTotal = rotSin * cosDir + rotCos * sinDir;
                    rotCos = cosTotal;
                    rotSin = sinTotal;
                }
            }
            particle.setRot(rotCos, rotSin);
            let colorOverLifetimeRandom = 0;
            if (this.colorOverLifetime && this.colorOverLifetime.enable) {
                let color = this.colorOverLifetime.color;
                switch (color.mode) {
                    case Laya.ParticleMinMaxGradientMode.TwoGradients:
                        colorOverLifetimeRandom = this._getFloat(7);
                        break;
                }
            }
            let velocityOverLifetimeRandomX = 0;
            let velocityOverLifetimeRandomY = 0;
            if (this.velocity2DOverLifetime && this.velocity2DOverLifetime.enable) {
                let mode = this.velocity2DOverLifetime.x.mode;
                switch (mode) {
                    case Laya.ParticleMinMaxCurveMode.TwoConstants:
                    case Laya.ParticleMinMaxCurveMode.TwoCurves:
                        velocityOverLifetimeRandomX = this._getFloat(8);
                        velocityOverLifetimeRandomY = this._getFloat(9);
                        break;
                }
            }
            let rotation2DOverLifetimeRandom = 0;
            if (this.rotation2DOverLifetime && this.rotation2DOverLifetime.enable) {
                let mode = this.rotation2DOverLifetime.angularVelocity.mode;
                switch (mode) {
                    case Laya.ParticleMinMaxCurveMode.TwoConstants:
                    case Laya.ParticleMinMaxCurveMode.TwoCurves:
                        rotation2DOverLifetimeRandom = this._getFloat(10);
                        break;
                }
            }
            particle.setRandom(colorOverLifetimeRandom, velocityOverLifetimeRandomX, velocityOverLifetimeRandomY, rotation2DOverLifetimeRandom);
            let sizeOverLifetimeRandomX = 0;
            let sizeOverLifetimeRandomY = 0;
            if (this.size2DOverLifetime && this.size2DOverLifetime.enable) {
                let mode = this.size2DOverLifetime.size.mode;
                switch (mode) {
                    case Laya.ParticleMinMaxCurveMode.Constant:
                        {
                            if (this.size2DOverLifetime.separateAxes) {
                                let sizeX = this.size2DOverLifetime.x.constant;
                                let sizeY = this.size2DOverLifetime.y.constant;
                                particle.setSize(startSizeX * sizeX, startSizeY * sizeY);
                            }
                            else {
                                let size = this.size2DOverLifetime.size.constant;
                                particle.setSize(startSizeX * size, startSizeY * size);
                            }
                            break;
                        }
                    case Laya.ParticleMinMaxCurveMode.TwoConstants:
                        {
                            if (this.size2DOverLifetime.separateAxes) {
                                let sizeMinX = this.size2DOverLifetime.x.constantMin;
                                let sizeMinY = this.size2DOverLifetime.y.constantMin;
                                let sizeMaxX = this.size2DOverLifetime.x.constantMax;
                                let sizeMaxY = this.size2DOverLifetime.y.constantMax;
                                let sizeX = sizeMinX + this._getFloat(11) * (sizeMaxX - sizeMinX);
                                let sizeY = sizeMinY + this._getFloat(12) * (sizeMaxY - sizeMinY);
                                particle.setSize(startSizeX * sizeX, startSizeY * sizeY);
                            }
                            else {
                                let sizeMin = this.size2DOverLifetime.size.constantMin;
                                let sizeMax = this.size2DOverLifetime.size.constantMax;
                                let size = sizeMin + this._getFloat(11) * (sizeMax - sizeMin);
                                particle.setSize(startSizeX * size, startSizeY * size);
                            }
                            break;
                        }
                    case Laya.ParticleMinMaxCurveMode.TwoCurves:
                        if (this.size2DOverLifetime.separateAxes) {
                            sizeOverLifetimeRandomX = this._getFloat(11);
                            sizeOverLifetimeRandomY = this._getFloat(12);
                        }
                        else {
                            sizeOverLifetimeRandomX = sizeOverLifetimeRandomY = this._getFloat(11);
                        }
                        break;
                }
            }
            let textureSheetAnimationRandom = 0;
            if (this.textureSheetAnimation && this.textureSheetAnimation.enable) {
                let frame = this.textureSheetAnimation.frame;
                let mode = frame.mode;
                switch (mode) {
                    case Laya.ParticleMinMaxCurveMode.TwoConstants:
                    case Laya.ParticleMinMaxCurveMode.TwoCurves:
                        textureSheetAnimationRandom = this._getFloat(13);
                        break;
                }
            }
            particle.setRandom1(sizeOverLifetimeRandomX, sizeOverLifetimeRandomY, textureSheetAnimationRandom, 0);
            let spriteRotAndScale = main._spriteRotAndScale;
            particle.setSpriteRotAndScale(spriteRotAndScale.x, spriteRotAndScale.y, spriteRotAndScale.z, spriteRotAndScale.w);
            let spriteTransAndSpace = main._spriteTranslateAndSpace;
            particle.setSpriteTrans(spriteTransAndSpace.x, spriteTransAndSpace.y);
            particle.setSimulationSpace(spriteTransAndSpace.z);
            let startColorRandom = gradientNeedRandom(main.startColor.mode) ? this._getFloat(6) : 0;
            let color = main.startColor.evaluate(normalizedTime, startColorRandom);
            particle.setColor(color.r, color.g, color.b, color.a);
            if (this.textureSheetAnimation && this.textureSheetAnimation.enable) {
                this.textureSheetAnimation._calculateSheetFrameData();
                let sheetFrameData = this.textureSheetAnimation._sheetFrameData;
                particle.setSheetFrameData(sheetFrameData.x, sheetFrameData.y, sheetFrameData.z, sheetFrameData.w);
            }
            this.particlePool.addParticleData(particle.data);
            return true;
        }
        _emitOverTime(deltaTime) {
            let normalizedTime = this.time / this.main.duration;
            let rateOverTime = this.emission.rateOverTime;
            let random = curveNeedRandom(rateOverTime.mode) ? this._getFloat(15) : 0;
            let rate = rateOverTime.evaluate(normalizedTime, random);
            this.emission._emitAccumulator += rate * deltaTime;
            while (this.emission._emitAccumulator >= 1) {
                this._emit(this.totalTime, 0);
                this.emission._emitAccumulator -= 1;
            }
        }
        _emitOverDistance() {
            let emission = this.emission;
            if (emission.rateOverDistance <= 0) {
                return;
            }
            let pxielDistance = 1 / emission.rateOverDistance * this.main.unitPixels;
            if (this._emitDistance >= pxielDistance) {
                let count = Math.floor(this._emitDistance / pxielDistance);
                for (let i = 1; i <= count; i++) {
                    let emitTime = this.totalTime;
                    let age = 0;
                    this._emit(emitTime, age);
                    this._emitDistance -= pxielDistance;
                }
            }
        }
        _emitBurst(burst, emitTime) {
            burst.time;
            let count = burst.count;
            let age = this.totalTime - emitTime;
            for (let j = 0; j < count; j++) {
                if (!this._emit(emitTime, age)) {
                    break;
                }
            }
        }
        _emitBursts() {
            let bursts = this.emission._sortedBursts;
            let count = bursts ? bursts.length : 0;
            let duration = this.main.duration;
            let start = this._nextBurstIndex;
            for (let i = start; i < count; i++) {
                let burst = bursts[i];
                if (burst.time > duration) {
                    break;
                }
                let burstTime = this._burstLoopCount * duration + burst.time;
                if (burstTime <= this.totalTime) {
                    this._emitBurst(burst, burstTime);
                    this._nextBurstIndex = i + 1;
                    if (this._nextBurstIndex >= count) {
                        this._nextBurstIndex = (i + 1) % count;
                        this._burstLoopCount++;
                    }
                }
            }
        }
        _update(deltaTime) {
            this._updateParticles(deltaTime * this.main.simulationSpeed);
        }
        _updateParticles(deltaTime) {
            if (this.isPlaying) {
                if (deltaTime <= 0) {
                    return;
                }
                this.time += deltaTime;
                this.totalTime += deltaTime;
                if (this.time >= this.main.duration) {
                    if (this.main.looping) {
                        this.time %= this.main.duration;
                    }
                    else {
                        this._isEmitting = false;
                        if (this.particlePool.activeParticleCount <= 0) {
                            this.stop();
                        }
                    }
                }
                this.particlePool.retireParticles(this.totalTime);
                if (this.emission.enable && this.isEmitting) {
                    this._emitOverTime(deltaTime);
                    this._emitOverDistance();
                    this._emitBursts();
                }
            }
        }
        _getMaxCurveValue(curve) {
            let maxValue = Math.max(0, curve.constant, curve.constantMin, curve.constantMax);
            let gradients = [curve.curveMin, curve.curveMax];
            for (let gradient of gradients) {
                for (let i = 0; i < gradient.gradientCount; i++) {
                    maxValue = Math.max(maxValue, gradient.getValueByIndex(i));
                }
            }
            return Number.isFinite(maxValue) ? maxValue : 0;
        }
        _skipCompletedLoops(time) {
            let duration = this.main.duration;
            if (!this.main.looping || duration <= 0) {
                return time;
            }
            let maxLifetime = this._getMaxCurveValue(this.main.startLifetime);
            let maxStartDelay = this._getMaxCurveValue(this.main.startDelay);
            let simulationWindow = Math.max(duration * 2, duration + maxLifetime + maxStartDelay);
            let skippedLoopCount = Math.floor((time - simulationWindow) / duration);
            if (skippedLoopCount <= 0) {
                return time;
            }
            return time - skippedLoopCount * duration;
        }
        simulate(time, restart = true) {
            if (this.isPlaying && Number.isFinite(time)) {
                if (restart) {
                    this.stop();
                    this.play();
                }
                let remainingTime = Math.max(0, time);
                if (restart) {
                    remainingTime = this._skipCompletedLoops(remainingTime);
                }
                while (remainingTime > _simulateStep && this.isPlaying) {
                    this._updateParticles(_simulateStep);
                    remainingTime -= _simulateStep;
                }
                if (this.isPlaying) {
                    this._updateParticles(remainingTime);
                }
                this.pause();
            }
        }
        cloneTo(destObject) {
            var _a, _b, _c, _d, _e, _f;
            destObject.gradientKeyCount8 = this.gradientKeyCount8;
            this.main.cloneTo(destObject.main);
            this.emission.cloneTo(destObject.emission);
            destObject.shape = (_a = this.shape) === null || _a === void 0 ? void 0 : _a.clone();
            destObject.velocity2DOverLifetime = (_b = this.velocity2DOverLifetime) === null || _b === void 0 ? void 0 : _b.clone();
            destObject.colorOverLifetime = (_c = this.colorOverLifetime) === null || _c === void 0 ? void 0 : _c.clone();
            destObject.size2DOverLifetime = (_d = this.size2DOverLifetime) === null || _d === void 0 ? void 0 : _d.clone();
            destObject.rotation2DOverLifetime = (_e = this.rotation2DOverLifetime) === null || _e === void 0 ? void 0 : _e.clone();
            destObject.textureSheetAnimation = (_f = this.textureSheetAnimation) === null || _f === void 0 ? void 0 : _f.clone();
        }
        clone() {
            let dest = new ShurikenParticle2DSystem();
            this.cloneTo(dest);
            return dest;
        }
        destroy() {
            super.destroy();
            if (this.particlePool) {
                this.particlePool.destroy();
                this.particlePool = null;
            }
        }
    }
    function curveNeedRandom(mode) {
        switch (mode) {
            case Laya.ParticleMinMaxCurveMode.TwoConstants:
            case Laya.ParticleMinMaxCurveMode.TwoCurves:
                return true;
            default:
                return false;
        }
    }
    function gradientNeedRandom(mode) {
        switch (mode) {
            case Laya.ParticleMinMaxGradientMode.TwoColors:
            case Laya.ParticleMinMaxGradientMode.TwoGradients:
                return true;
            default:
                return false;
        }
    }

    new Laya.Vector3();
    new Laya.Vector3();
    const tempV4 = new Laya.Vector4();
    const fillGradientRGB = (gradient, buffer) => {
        let count = Math.min(gradient.colorRGBKeysCount, 8);
        if (count == 1) {
            gradient._rgbElements[0];
            let r = gradient._rgbElements[1];
            let g = gradient._rgbElements[2];
            let b = gradient._rgbElements[3];
            buffer[0] = 0;
            buffer[1] = r;
            buffer[2] = g;
            buffer[3] = b;
            buffer[4] = 1;
            buffer[5] = r;
            buffer[6] = g;
            buffer[7] = b;
        }
        else {
            let length = Math.min(gradient._rgbElements.length, 8 * 4);
            let data = new Float32Array(gradient._rgbElements.buffer, 0, length);
            buffer.set(data);
        }
        if (count <= 4) {
            return new Float32Array(buffer.buffer, 0, 4 * 4);
        }
        else {
            return buffer;
        }
    };
    const fillGradientAlpha = (gradient, buffer) => {
        let count = Math.min(gradient.colorAlphaKeysCount, 8);
        if (count == 1) {
            gradient._alphaElements[0];
            let a = gradient._alphaElements[1];
            buffer[0] = 0;
            buffer[1] = a;
            buffer[2] = 1;
            buffer[3] = a;
        }
        else {
            let length = Math.min(gradient._alphaElements.length, 8 * 2);
            let data = new Float32Array(gradient._alphaElements.buffer, 0, length);
            buffer.set(data);
        }
        if (count <= 4) {
            return new Float32Array(buffer.buffer, 0, 4 * 2);
        }
        else {
            return buffer;
        }
    };
    const fillGradientTimeRange = (gradient, range, maxCount) => {
        let colorMinTime = 0;
        let colorMaxTime = 1;
        let count = Math.min(gradient.colorRGBKeysCount, maxCount);
        if (count == 1) {
            colorMinTime = 0;
            colorMaxTime = 1;
        }
        else {
            colorMinTime = 1;
            colorMaxTime = 0;
            for (let i = 0; i < count; i++) {
                let time = gradient._rgbElements[i * 4];
                colorMinTime = Math.min(colorMinTime, time);
                colorMaxTime = Math.max(colorMaxTime, time);
            }
        }
        let alphaMinTime = 0;
        let alphaMaxTime = 1;
        count = Math.min(gradient.colorAlphaKeysCount, maxCount);
        if (count == 1) {
            alphaMinTime = 0;
            alphaMaxTime = 1;
        }
        else {
            alphaMinTime = 1;
            alphaMaxTime = 0;
            for (let i = 0; i < count; i++) {
                let time = gradient._alphaElements[i * 2];
                alphaMinTime = Math.min(alphaMinTime, time);
                alphaMaxTime = Math.max(alphaMaxTime, time);
            }
        }
        range.setValue(colorMinTime, colorMaxTime, alphaMinTime, alphaMaxTime);
    };
    const fillCurveMinMaxTimeRange = (curve0, curve1, range, maxCount) => {
        let curve0MinTime = 1;
        let curve0MaxTime = 0;
        let count = Math.min(curve0.gradientCount, maxCount);
        if (count == 1) {
            curve0MinTime = 0;
            curve0MaxTime = 1;
        }
        else {
            let lastTime = curve0.getKeyByIndex(0);
            curve0MinTime = Math.min(curve0MinTime, lastTime);
            curve0MaxTime = Math.max(curve0MaxTime, lastTime);
            for (let i = 1; i < count; i++) {
                let time = curve0.getKeyByIndex(i);
                if (time > lastTime) {
                    curve0MinTime = Math.min(curve0MinTime, time);
                    curve0MaxTime = Math.max(curve0MaxTime, time);
                    lastTime = time;
                }
            }
        }
        let curve1MinTime = 1;
        let curve1MaxTime = 0;
        count = Math.min(curve1.gradientCount, maxCount);
        if (count == 1) {
            curve1MinTime = 0;
            curve1MaxTime = 1;
        }
        else {
            let lastTime = curve1.getKeyByIndex(0);
            curve1MinTime = Math.min(curve1MinTime, lastTime);
            curve1MaxTime = Math.max(curve1MaxTime, lastTime);
            for (let i = 1; i < count; i++) {
                let time = curve1.getKeyByIndex(i);
                if (time > lastTime) {
                    curve1MinTime = Math.min(curve1MinTime, time);
                    curve1MaxTime = Math.max(curve1MaxTime, time);
                    lastTime = time;
                }
            }
        }
        range.setValue(curve0MinTime, curve0MaxTime, curve1MinTime, curve1MaxTime);
    };
    const fillParticleData = (particleIndex, particleStride, particleByteStride, particleDatas, meshVertexCount, particleVertexDatas) => {
        let particleDataOffset = particleIndex * particleByteStride;
        let particleData = new Float32Array(particleDatas.buffer, particleDataOffset, particleStride);
        for (let j = 0; j < meshVertexCount; j++) {
            let vertexOffset = (particleIndex * meshVertexCount + j) * particleStride;
            particleVertexDatas.set(particleData, vertexOffset);
        }
    };
    function gradientDataNumberConstant(gradient, value) {
        gradient._elements.fill(0);
        gradient._elements[0] = 0;
        gradient._elements[1] = value;
        gradient._elements[2] = 1;
        gradient._elements[3] = value;
    }
    class ShurikenParticle2DRenderer extends Laya.BaseRenderNode2D {
        get particleSystem() {
            return this._particleSystem;
        }
        _setOwner(node) {
            super._setOwner(node);
            this.particleSystem.owner = node;
        }
        get sharedMaterial() {
            return super.sharedMaterial;
        }
        set sharedMaterial(value) {
            super.sharedMaterial = value;
            this._createRenderElements();
        }
        constructor() {
            super();
            this._gradientRGBBuffer = new Float32Array(8 * 4);
            this._gradientAlphaBuffer = new Float32Array(8 * 2);
            this._gradientTimeRange = new Laya.Vector4();
            this._gradientMaxRGBBuffer = new Float32Array(8 * 4);
            this._gradientMaxAlphaBuffer = new Float32Array(8 * 2);
            this._gradientMaxTimeRange = new Laya.Vector4();
            this._updateMark = -1;
            this._renderElements = [];
            this._materials = [];
            this._particleSystem = new ShurikenParticle2DSystem();
        }
        _isMaterialVaild(value) {
            return value.checkType(Laya.ShaderFeatureType.Default);
        }
        _getcommonUniformMap() {
            return ["BaseRender2D", "_Particle2D"];
        }
        setParticleColorOverLifetime(shaderData) {
            let ps = this.particleSystem;
            if (ps.colorOverLifetime && ps.colorOverLifetime.enable) {
                shaderData.addDefine(Particle2DShader.ColorOverLifetimeDef);
                let color = ps.colorOverLifetime.color;
                let gradientMin = color.gradientMin;
                let gradientMax = color.gradientMax;
                let mode = color.mode;
                let rgbMinBuffer = fillGradientRGB(gradientMin, this._gradientRGBBuffer);
                let alphaMinBuffer = fillGradientAlpha(gradientMin, this._gradientAlphaBuffer);
                let colorKey8 = false;
                if (rgbMinBuffer.length == 32 || alphaMinBuffer.length == 16) {
                    colorKey8 = true;
                    fillGradientTimeRange(gradientMin, this._gradientTimeRange, 8);
                }
                else {
                    fillGradientTimeRange(gradientMin, this._gradientTimeRange, 4);
                }
                shaderData.setVector(Particle2DShader.GradientTimeRange, this._gradientTimeRange);
                let rgbMaxBuffer;
                let alphaMaxBuffer;
                switch (mode) {
                    case Laya.ParticleMinMaxGradientMode.Gradient:
                        shaderData.removeDefine(Particle2DShader.ColorOverLifetimeRandom);
                        break;
                    case Laya.ParticleMinMaxGradientMode.TwoGradients: {
                        shaderData.addDefine(Particle2DShader.ColorOverLifetimeRandom);
                        rgbMaxBuffer = fillGradientRGB(gradientMax, this._gradientMaxRGBBuffer);
                        alphaMaxBuffer = fillGradientAlpha(gradientMax, this._gradientMaxAlphaBuffer);
                        if (rgbMaxBuffer.length == 32 || alphaMaxBuffer.length == 16) {
                            colorKey8 = true;
                            shaderData.setBuffer(Particle2DShader.GradientMaxRGB, this._gradientMaxRGBBuffer);
                            shaderData.setBuffer(Particle2DShader.GradientMaxAlpha, this._gradientMaxAlphaBuffer);
                            fillGradientTimeRange(gradientMax, this._gradientMaxTimeRange, 8);
                        }
                        else {
                            shaderData.setBuffer(Particle2DShader.GradientMaxRGB, rgbMaxBuffer);
                            shaderData.setBuffer(Particle2DShader.GradientMaxAlpha, alphaMaxBuffer);
                            fillGradientTimeRange(gradientMax, this._gradientMaxTimeRange, 4);
                        }
                        shaderData.setVector(Particle2DShader.GradientMaxTimeRange, this._gradientMaxTimeRange);
                        break;
                    }
                }
                if (colorKey8) {
                    shaderData.addDefine(Particle2DShader.ColorOVerLifetimeColorKey_8);
                    shaderData.setBuffer(Particle2DShader.GradientRGB, this._gradientRGBBuffer);
                    shaderData.setBuffer(Particle2DShader.GradientAlpha, this._gradientAlphaBuffer);
                }
                else {
                    shaderData.setBuffer(Particle2DShader.GradientRGB, rgbMinBuffer);
                    shaderData.setBuffer(Particle2DShader.GradientAlpha, alphaMinBuffer);
                }
            }
            else {
                shaderData.removeDefine(Particle2DShader.ColorOverLifetimeDef);
                shaderData.removeDefine(Particle2DShader.ColorOverLifetimeRandom);
                shaderData.removeDefine(Particle2DShader.ColorOVerLifetimeColorKey_8);
            }
        }
        setParticleVelocityOverLifetime(shaderData) {
            let ps = this.particleSystem;
            if (ps.velocity2DOverLifetime && ps.velocity2DOverLifetime.enable) {
                shaderData.addDefine(Particle2DShader.VelocityOverLifetimeDef);
                let velocityX = ps.velocity2DOverLifetime.x;
                let velocityY = ps.velocity2DOverLifetime.y;
                let mode = velocityX.mode;
                switch (mode) {
                    case Laya.ParticleMinMaxCurveMode.Constant:
                        {
                            let valueX = velocityX.constant;
                            let valueY = velocityY.constant;
                            gradientDataNumberConstant(velocityX.curve, valueX);
                            gradientDataNumberConstant(velocityY.curve, valueY);
                            shaderData.setBuffer(Particle2DShader.VelocityCurveMinX, velocityX.curve._elements);
                            shaderData.setBuffer(Particle2DShader.VelocityCurveMinY, velocityY.curve._elements);
                            shaderData.setBuffer(Particle2DShader.VelocityCurveMaxX, velocityX.curve._elements);
                            shaderData.setBuffer(Particle2DShader.VelocityCurveMaxY, velocityY.curve._elements);
                            break;
                        }
                    case Laya.ParticleMinMaxCurveMode.TwoConstants:
                        {
                            let valueMinX = velocityX.constantMin;
                            let valueMinY = velocityY.constantMin;
                            let valueMaxX = velocityX.constantMax;
                            let valueMaxY = velocityY.constantMax;
                            gradientDataNumberConstant(velocityX.curveMin, valueMinX);
                            gradientDataNumberConstant(velocityY.curveMin, valueMinY);
                            gradientDataNumberConstant(velocityX.curveMax, valueMaxX);
                            gradientDataNumberConstant(velocityY.curveMax, valueMaxY);
                            shaderData.setBuffer(Particle2DShader.VelocityCurveMinX, velocityX.curveMin._elements);
                            shaderData.setBuffer(Particle2DShader.VelocityCurveMinY, velocityY.curveMin._elements);
                            shaderData.setBuffer(Particle2DShader.VelocityCurveMaxX, velocityX.curveMax._elements);
                            shaderData.setBuffer(Particle2DShader.VelocityCurveMaxY, velocityY.curveMax._elements);
                            break;
                        }
                    case Laya.ParticleMinMaxCurveMode.Curve:
                        {
                            velocityX.curve._formatData();
                            velocityY.curve._formatData();
                            shaderData.setBuffer(Particle2DShader.VelocityCurveMinX, velocityX.curve._elements);
                            shaderData.setBuffer(Particle2DShader.VelocityCurveMinY, velocityY.curve._elements);
                            shaderData.setBuffer(Particle2DShader.VelocityCurveMaxX, velocityX.curve._elements);
                            shaderData.setBuffer(Particle2DShader.VelocityCurveMaxY, velocityY.curve._elements);
                            break;
                        }
                    case Laya.ParticleMinMaxCurveMode.TwoCurves:
                        {
                            velocityX.curveMin._formatData();
                            velocityY.curveMin._formatData();
                            velocityX.curveMax._formatData();
                            velocityY.curveMax._formatData();
                            shaderData.setBuffer(Particle2DShader.VelocityCurveMinX, velocityX.curveMin._elements);
                            shaderData.setBuffer(Particle2DShader.VelocityCurveMinY, velocityY.curveMin._elements);
                            shaderData.setBuffer(Particle2DShader.VelocityCurveMaxX, velocityX.curveMax._elements);
                            shaderData.setBuffer(Particle2DShader.VelocityCurveMaxY, velocityY.curveMax._elements);
                            break;
                        }
                }
                let space = ps.velocity2DOverLifetime.space;
                switch (space) {
                    case exports.Velocity2DSimulateSpace.Local:
                        shaderData.setNumber(Particle2DShader.VelocityOverLifetimeSpace, 0);
                        break;
                    case exports.Velocity2DSimulateSpace.World:
                        shaderData.setNumber(Particle2DShader.VelocityOverLifetimeSpace, 1);
                        break;
                }
            }
            else {
                shaderData.removeDefine(Particle2DShader.VelocityOverLifetimeDef);
            }
        }
        setSize2DOverLifetime(shaderData) {
            let ps = this.particleSystem;
            if (ps.size2DOverLifetime && ps.size2DOverLifetime.enable) {
                let sizeX = ps.size2DOverLifetime.x;
                let sizeY = ps.size2DOverLifetime.y;
                let mode = sizeX.mode;
                switch (mode) {
                    case Laya.ParticleMinMaxCurveMode.Curve:
                        shaderData.addDefine(Particle2DShader.SizeOverLifetimeDef);
                        if (ps.size2DOverLifetime.separateAxes) {
                            sizeX.curve._formatData();
                            sizeY.curve._formatData();
                            shaderData.setBuffer(Particle2DShader.SizeCurveMinX, sizeX.curve._elements);
                            shaderData.setBuffer(Particle2DShader.SizeCurveMinY, sizeY.curve._elements);
                            shaderData.setBuffer(Particle2DShader.SizeCurveMaxX, sizeX.curve._elements);
                            shaderData.setBuffer(Particle2DShader.SizeCurveMaxY, sizeY.curve._elements);
                            let range = tempV4;
                            fillCurveMinMaxTimeRange(sizeX.curve, sizeY.curve, range, this.particleSystem.gradientKeyCount8 ? 8 : 4);
                            shaderData.setVector(Particle2DShader.SizeCurveMinTimeRange, range);
                            shaderData.setVector(Particle2DShader.SizeCurveMaxTimeRange, range);
                        }
                        else {
                            sizeX.curve._formatData();
                            shaderData.setBuffer(Particle2DShader.SizeCurveMinX, sizeX.curve._elements);
                            shaderData.setBuffer(Particle2DShader.SizeCurveMinY, sizeX.curve._elements);
                            shaderData.setBuffer(Particle2DShader.SizeCurveMaxX, sizeX.curve._elements);
                            shaderData.setBuffer(Particle2DShader.SizeCurveMaxY, sizeX.curve._elements);
                            let range = tempV4;
                            fillCurveMinMaxTimeRange(sizeX.curve, sizeX.curve, range, this.particleSystem.gradientKeyCount8 ? 8 : 4);
                            shaderData.setVector(Particle2DShader.SizeCurveMinTimeRange, range);
                            shaderData.setVector(Particle2DShader.SizeCurveMaxTimeRange, range);
                        }
                        break;
                    case Laya.ParticleMinMaxCurveMode.TwoCurves:
                        shaderData.addDefine(Particle2DShader.SizeOverLifetimeDef);
                        if (ps.size2DOverLifetime.separateAxes) {
                            sizeX.curveMin._formatData();
                            sizeX.curveMax._formatData();
                            sizeY.curveMin._formatData();
                            sizeX.curveMax._formatData();
                            shaderData.setBuffer(Particle2DShader.SizeCurveMinX, sizeX.curveMin._elements);
                            shaderData.setBuffer(Particle2DShader.SizeCurveMinY, sizeY.curveMin._elements);
                            shaderData.setBuffer(Particle2DShader.SizeCurveMaxX, sizeX.curveMax._elements);
                            shaderData.setBuffer(Particle2DShader.SizeCurveMaxY, sizeY.curveMax._elements);
                            let range = tempV4;
                            fillCurveMinMaxTimeRange(sizeX.curveMin, sizeY.curveMin, range, this.particleSystem.gradientKeyCount8 ? 8 : 4);
                            shaderData.setVector(Particle2DShader.SizeCurveMinTimeRange, range);
                            fillCurveMinMaxTimeRange(sizeX.curveMax, sizeY.curveMax, range, this.particleSystem.gradientKeyCount8 ? 8 : 4);
                            shaderData.setVector(Particle2DShader.SizeCurveMaxTimeRange, range);
                        }
                        else {
                            sizeX.curveMin._formatData();
                            sizeX.curveMax._formatData();
                            shaderData.setBuffer(Particle2DShader.SizeCurveMinX, sizeX.curveMin._elements);
                            shaderData.setBuffer(Particle2DShader.SizeCurveMinY, sizeX.curveMin._elements);
                            shaderData.setBuffer(Particle2DShader.SizeCurveMaxX, sizeX.curveMax._elements);
                            shaderData.setBuffer(Particle2DShader.SizeCurveMaxY, sizeX.curveMax._elements);
                            let range = tempV4;
                            fillCurveMinMaxTimeRange(sizeX.curveMin, sizeX.curveMin, range, this.particleSystem.gradientKeyCount8 ? 8 : 4);
                            shaderData.setVector(Particle2DShader.SizeCurveMinTimeRange, range);
                            fillCurveMinMaxTimeRange(sizeX.curveMax, sizeX.curveMax, range, this.particleSystem.gradientKeyCount8 ? 8 : 4);
                            shaderData.setVector(Particle2DShader.SizeCurveMaxTimeRange, range);
                        }
                        break;
                    case Laya.ParticleMinMaxCurveMode.Constant:
                    case Laya.ParticleMinMaxCurveMode.TwoConstants:
                    default:
                        shaderData.removeDefine(Particle2DShader.SizeOverLifetimeDef);
                        break;
                }
            }
            else {
                shaderData.removeDefine(Particle2DShader.SizeOverLifetimeDef);
            }
        }
        setRotationOverlifetime(shaderData) {
            let ps = this.particleSystem;
            if (ps.rotation2DOverLifetime && ps.rotation2DOverLifetime.enable) {
                shaderData.addDefine(Particle2DShader.RotationOverLifetimeDef);
                let angularVelocity = ps.rotation2DOverLifetime.angularVelocity;
                let mode = angularVelocity.mode;
                switch (mode) {
                    case Laya.ParticleMinMaxCurveMode.Constant:
                        {
                            let value = angularVelocity.constant;
                            gradientDataNumberConstant(angularVelocity.curve, value);
                            shaderData.setBuffer(Particle2DShader.RotationCurveMin, angularVelocity.curve._elements);
                            shaderData.setBuffer(Particle2DShader.RotationCurveMax, angularVelocity.curve._elements);
                            break;
                        }
                    case Laya.ParticleMinMaxCurveMode.Curve:
                        {
                            angularVelocity.curve._formatData();
                            shaderData.setBuffer(Particle2DShader.RotationCurveMin, angularVelocity.curve._elements);
                            shaderData.setBuffer(Particle2DShader.RotationCurveMax, angularVelocity.curve._elements);
                            break;
                        }
                    case Laya.ParticleMinMaxCurveMode.TwoConstants:
                        {
                            let valueMin = angularVelocity.constantMin;
                            let valueMax = angularVelocity.constantMax;
                            gradientDataNumberConstant(angularVelocity.curveMin, valueMin);
                            gradientDataNumberConstant(angularVelocity.curveMax, valueMax);
                            shaderData.setBuffer(Particle2DShader.RotationCurveMin, angularVelocity.curveMin._elements);
                            shaderData.setBuffer(Particle2DShader.RotationCurveMax, angularVelocity.curveMax._elements);
                            break;
                        }
                    case Laya.ParticleMinMaxCurveMode.TwoCurves:
                        {
                            angularVelocity.curveMin._formatData();
                            angularVelocity.curveMax._formatData();
                            shaderData.setBuffer(Particle2DShader.RotationCurveMin, angularVelocity.curveMin._elements);
                            shaderData.setBuffer(Particle2DShader.RotationCurveMax, angularVelocity.curveMax._elements);
                            break;
                        }
                }
            }
            else {
                shaderData.removeDefine(Particle2DShader.RotationOverLifetimeDef);
            }
        }
        setTextureSheetAnimation(shaderData) {
            let ps = this.particleSystem;
            if (ps.textureSheetAnimation && ps.textureSheetAnimation.enable) {
                shaderData.addDefine(Particle2DShader.TextureSheetAnimationDef);
                let tiles = ps.textureSheetAnimation.tiles;
                let cycles = ps.textureSheetAnimation.cycles;
                let animationSubUV = tempV4;
                animationSubUV.setValue(tiles.x, tiles.y, cycles, 0);
                shaderData.setVector(Particle2DShader.TextureSheetFrameData, animationSubUV);
                let frame = ps.textureSheetAnimation.frame;
                let mode = ps.textureSheetAnimation.frame.mode;
                switch (mode) {
                    case Laya.ParticleMinMaxCurveMode.Constant:
                        {
                            let value = frame.constant;
                            gradientDataNumberConstant(frame.curve, value);
                            shaderData.setBuffer(Particle2DShader.TextureSheetFrame, frame.curve._elements);
                            shaderData.setBuffer(Particle2DShader.TextureSheetFrameMax, frame.curve._elements);
                            let range = tempV4;
                            fillCurveMinMaxTimeRange(frame.curve, frame.curve, range, this.particleSystem.gradientKeyCount8 ? 8 : 4);
                            shaderData.setVector(Particle2DShader.TextureSheetFrameRange, range);
                            break;
                        }
                    case Laya.ParticleMinMaxCurveMode.Curve:
                        {
                            frame.curve._formatData();
                            shaderData.setBuffer(Particle2DShader.TextureSheetFrame, frame.curve._elements);
                            shaderData.setBuffer(Particle2DShader.TextureSheetFrameMax, frame.curve._elements);
                            let range = tempV4;
                            fillCurveMinMaxTimeRange(frame.curve, frame.curve, range, this.particleSystem.gradientKeyCount8 ? 8 : 4);
                            shaderData.setVector(Particle2DShader.TextureSheetFrameRange, range);
                            break;
                        }
                    case Laya.ParticleMinMaxCurveMode.TwoConstants:
                        {
                            let valueMin = frame.constantMin;
                            let valueMax = frame.constantMax;
                            gradientDataNumberConstant(frame.curveMin, valueMin);
                            gradientDataNumberConstant(frame.curveMax, valueMax);
                            shaderData.setBuffer(Particle2DShader.TextureSheetFrame, frame.curveMin._elements);
                            shaderData.setBuffer(Particle2DShader.TextureSheetFrameMax, frame.curveMax._elements);
                            let range = tempV4;
                            fillCurveMinMaxTimeRange(frame.curveMin, frame.curveMax, range, this.particleSystem.gradientKeyCount8 ? 8 : 4);
                            shaderData.setVector(Particle2DShader.TextureSheetFrameRange, range);
                            break;
                        }
                    case Laya.ParticleMinMaxCurveMode.TwoCurves:
                        {
                            frame.curveMin._formatData();
                            frame.curveMax._formatData();
                            shaderData.setBuffer(Particle2DShader.TextureSheetFrame, frame.curveMin._elements);
                            shaderData.setBuffer(Particle2DShader.TextureSheetFrameMax, frame.curveMax._elements);
                            let range = tempV4;
                            fillCurveMinMaxTimeRange(frame.curveMin, frame.curveMax, range, this.particleSystem.gradientKeyCount8 ? 8 : 4);
                            shaderData.setVector(Particle2DShader.TextureSheetFrameRange, range);
                            break;
                        }
                }
            }
            else {
                shaderData.removeDefine(Particle2DShader.TextureSheetAnimationDef);
            }
        }
        setParticleData(shaderData, worldMat) {
            var _a, _b, _c, _d, _e, _f;
            let ps = this.particleSystem;
            if (!this.particleGeometry || ps.main.maxParticles != this.particleGeometry.maxParitcleCount) {
                this._createRenderGeometry();
            }
            shaderData.setNumber(Particle2DShader.CurrentTime, ps.totalTime);
            shaderData.setNumber(Particle2DShader.UnitPixels, ps.main.unitPixels);
            let scaleX = worldMat.getScaleX();
            let scaleY = worldMat.getScaleY();
            let cosAngle = worldMat.a / scaleX;
            let sinAngle = worldMat.b / scaleX;
            let translateX = worldMat.tx;
            let translateY = worldMat.ty;
            let simulationSpace = 0;
            switch (ps.main.simulationSpace) {
                case exports.Particle2DSimulationSpace.Local:
                    simulationSpace = 0;
                    break;
                case exports.Particle2DSimulationSpace.World:
                    simulationSpace = 1;
                    break;
            }
            switch (ps.main.scaleMode) {
                case exports.Particle2DScalingMode.Hierarchy:
                    break;
                case exports.Particle2DScalingMode.Local:
                    scaleX = this.owner.scaleX;
                    scaleY = this.owner.scaleY;
                    if (this.owner.scene) {
                        scaleX *= this.owner.scene.globalScaleX;
                        scaleY *= this.owner.scene.globalScaleY;
                    }
                    else {
                        let stage = Laya.ILaya.stage;
                        if (stage) {
                            scaleX *= stage.scaleX;
                            scaleY *= stage.scaleY;
                        }
                    }
                    break;
            }
            ps.main._spriteRotAndScale.setValue(cosAngle, sinAngle, scaleX, scaleY);
            shaderData.setVector(Particle2DShader.SpriteRotAndScale, ps.main._spriteRotAndScale);
            ps.main._spriteTranslateAndSpace.setValue(translateX, translateY, simulationSpace);
            const configlayer = (_a = Laya.PlayerConfig.physics2D) === null || _a === void 0 ? void 0 : _a.defaultConfig;
            const Physics2DSettingPixelRatio = (_b = configlayer === null || configlayer === void 0 ? void 0 : configlayer.pixelRatio) !== null && _b !== void 0 ? _b : Laya.Physics2DOption.pixelRatio;
            const Physics2DSettingGravity = {
                x: (_d = (_c = configlayer === null || configlayer === void 0 ? void 0 : configlayer.gravity) === null || _c === void 0 ? void 0 : _c.x) !== null && _d !== void 0 ? _d : Laya.Physics2DOption.gravity.x,
                y: (_f = (_e = configlayer === null || configlayer === void 0 ? void 0 : configlayer.gravity) === null || _e === void 0 ? void 0 : _e.y) !== null && _f !== void 0 ? _f : Laya.Physics2DOption.gravity.y
            };
            let physicPixelRatio = ps.main.unitPixels / Physics2DSettingPixelRatio;
            let gravityX = Physics2DSettingGravity.x * physicPixelRatio;
            let gravityY = Physics2DSettingGravity.y * physicPixelRatio;
            let gravityModifier = ps.main.gravityModifier;
            ps.main._gravity.setValue(gravityX * gravityModifier.x, gravityY * gravityModifier.y);
            if (ps.emission.rateOverDistance >= 0) {
                let posX = translateX;
                let posY = translateY;
                let lastX = ps.emission._lastPosition.x;
                let lastY = ps.emission._lastPosition.y;
                let dx = (posX - lastX);
                let dy = (posY - lastY);
                let distance = dx * dx + dy * dy;
                distance = Math.sqrt(distance);
                ps._emitDistance += distance;
                ps.emission._lastPosition.set(posX, posY, 0);
            }
            if (ps._dirtyFlags & exports.Particle2DSystemDirtyFlagBits.GradientKeyCountBit) {
                if (ps.gradientKeyCount8)
                    shaderData.addDefine(Particle2DShader.GradientKeyCount8Def);
                else
                    shaderData.removeDefine(Particle2DShader.GradientKeyCount8Def);
                ps._dirtyFlags &= ~exports.Particle2DSystemDirtyFlagBits.GradientKeyCountBit;
            }
            if (ps._dirtyFlags & exports.Particle2DSystemDirtyFlagBits.ColorOverLifetimeBit) {
                this.setParticleColorOverLifetime(shaderData);
                ps._dirtyFlags &= ~exports.Particle2DSystemDirtyFlagBits.ColorOverLifetimeBit;
            }
            if (ps._dirtyFlags & exports.Particle2DSystemDirtyFlagBits.Velocity2DOverLifetimeBit) {
                this.setParticleVelocityOverLifetime(shaderData);
                ps._dirtyFlags &= ~exports.Particle2DSystemDirtyFlagBits.Velocity2DOverLifetimeBit;
            }
            if (ps._dirtyFlags & exports.Particle2DSystemDirtyFlagBits.Size2DOverLifetimeBit) {
                this.setSize2DOverLifetime(shaderData);
                ps._dirtyFlags &= ~exports.Particle2DSystemDirtyFlagBits.Size2DOverLifetimeBit;
            }
            if (ps._dirtyFlags & exports.Particle2DSystemDirtyFlagBits.Rotation2DOverLifetimeBit) {
                this.setRotationOverlifetime(shaderData);
                ps._dirtyFlags &= ~exports.Particle2DSystemDirtyFlagBits.Rotation2DOverLifetimeBit;
            }
            if (ps._dirtyFlags & exports.Particle2DSystemDirtyFlagBits.TextureSheetAnimationBit) {
                this.setTextureSheetAnimation(shaderData);
                ps._dirtyFlags &= ~exports.Particle2DSystemDirtyFlagBits.TextureSheetAnimationBit;
            }
        }
        addCMDCall(px, py) {
        }
        _createRenderGeometry() {
            if (this.particleGeometry) {
                this.particleGeometry.destroy();
                this.particleGeometry = null;
            }
            let maxParticles = this.particleSystem.main.maxParticles;
            let particleDeclaration = Particle2DVertexMesh.Particle2DDeclaration;
            let meshDeclaration = Particle2DVertexMesh.Particle2DMeshDeclaration;
            this.particleGeometry = new Particle2DGeomotry(maxParticles, particleDeclaration, meshDeclaration);
            this._createRenderElements();
        }
        _createRenderElements() {
            let mat = this._materials[0];
            this._renderElements.forEach(element => {
                Laya.BaseRenderNode2D._removeRenderElement2DMaterial(element, mat);
                element.destroy();
            });
            this._renderElements.length = 0;
            if (!this.sharedMaterial) {
                this._struct.renderElements = this._renderElements;
                return;
            }
            {
                let declaration = Particle2DVertexMesh.Particle2DDeclaration;
                let particleInfo = Particle2DVertexMesh.Particle2DInfo;
                let particleByteStride = declaration.vertexStride;
                this.particleSystem._initParticleData(particleByteStride, particleInfo);
            }
            const createRenderElement = (geometry) => {
                let element = Laya.LayaGL.render2DRenderPassFactory.createRenderElement2D();
                element.geometry = geometry;
                element.value2DShaderData = this._spriteShaderData;
                Laya.BaseRenderNode2D._setRenderElement2DMaterial(element, this.sharedMaterial);
                element.renderStateIsBySprite = false;
                element.nodeCommonMap = this._getcommonUniformMap();
                element.owner = this._struct;
                return element;
            };
            if (this.particleGeometry) {
                let geometry = this.particleGeometry.geometry;
                let element = createRenderElement(geometry);
                this._renderElements.push(element);
            }
            this._struct.renderElements = this._renderElements;
        }
        _updateParticleBuffer(startActive, endActive) {
            let ps = this.particleSystem;
            let meshVertexCount = 4;
            let maxParticles = ps.main.maxParticles;
            let particleDatas = ps.particlePool.particleDatas;
            let particleVertexDatas = this.particleGeometry.particleDatas;
            let particleBuffer = this.particleGeometry.particleBuffer;
            let particleStride = ps.particlePool.particleStride;
            let particleByteStride = ps.particlePool.particleByteStride;
            if (startActive <= endActive) {
                let particleCount = endActive - startActive;
                for (let i = startActive; i <= endActive; i++) {
                    fillParticleData(i, particleStride, particleByteStride, particleDatas, meshVertexCount, particleVertexDatas);
                }
                let start = startActive * meshVertexCount * particleByteStride;
                let length = particleCount * meshVertexCount * particleByteStride;
                particleBuffer.setData(particleVertexDatas.buffer, start, start, length);
            }
            else {
                {
                    for (let i = startActive; i <= maxParticles; i++) {
                        fillParticleData(i, particleStride, particleByteStride, particleDatas, meshVertexCount, particleVertexDatas);
                    }
                    let start = startActive * meshVertexCount * particleByteStride;
                    let length = (maxParticles + 1 - startActive) * meshVertexCount * particleByteStride;
                    particleBuffer.setData(particleVertexDatas.buffer, start, start, length);
                }
                {
                    for (let i = 0; i < endActive; i++) {
                        fillParticleData(i, particleStride, particleByteStride, particleDatas, meshVertexCount, particleVertexDatas);
                    }
                    let start = 0;
                    let length = endActive * meshVertexCount * particleByteStride;
                    particleBuffer.setData(particleVertexDatas.buffer, start, start, length);
                }
            }
        }
        renderUpdate(context) {
            let ps = this.particleSystem;
            this.setParticleData(this._spriteShaderData, this.owner._globalTrans.getMatrix());
            this._updateLight();
            if (this._renderElements.length <= 0) {
                return;
            }
            if (this._updateMark != Laya.Stat.loopCount) {
                this._updateMark = Laya.Stat.loopCount;
                let elapsedTime = this.owner.timer.delta / 1000;
                ps._update(elapsedTime);
                const startUpdate = ps.particlePool.updateStartIndex;
                const endUpdate = ps.particlePool.updateEndIndex;
                if (startUpdate != endUpdate) {
                    this._updateParticleBuffer(startUpdate, endUpdate);
                }
                const startActive = ps.particlePool.activeStartIndex;
                const endActive = ps.particlePool.activeEndIndex;
                let meshIndexCount = 6;
                let maxParticles = ps.main.maxParticles;
                if (startActive <= endActive) {
                    let particleCount = endActive - startActive;
                    this._renderElements.forEach(element => {
                        element.geometry.clearRenderParams();
                        let drawCount = particleCount * meshIndexCount;
                        if (drawCount > 0) {
                            element.geometry.setDrawElemenParams(drawCount, startActive * meshIndexCount * 2);
                        }
                    });
                }
                else {
                    this._renderElements.forEach(element => {
                        element.geometry.clearRenderParams();
                        let drawCount = (maxParticles + 1 - startActive) * meshIndexCount;
                        element.geometry.setDrawElemenParams(drawCount, startActive * meshIndexCount * 2);
                        drawCount = endActive * meshIndexCount;
                        if (drawCount > 0) {
                            element.geometry.setDrawElemenParams(drawCount, 0);
                        }
                    });
                }
            }
        }
        onEnable() {
            let ps = this.particleSystem;
            if (Laya.LayaEnv.isPlaying && ps.main.playOnAwake) {
                ps.play();
            }
        }
        onDisable() {
            let ps = this.particleSystem;
            ps.simulate(0, true);
        }
        onDestroy() {
            if (this.particleGeometry) {
                this.particleGeometry.destroy();
                this.particleGeometry = null;
            }
            this.particleSystem.destroy();
        }
        _cloneTo(dest) {
            super._cloneTo(dest);
            this.particleSystem.cloneTo(dest.particleSystem);
        }
    }
    Laya.addAfterInitCallback(() => {
        Particle2DVertexMesh.init();
        Particle2DShader.init();
    });

    Laya.ClassUtils.regClass("Base2DShape", Base2DShape);
    Laya.ClassUtils.regClass("Box2DShape", Box2DShape);
    Laya.ClassUtils.regClass("Circle2DShape", Circle2DShape);
    Laya.ClassUtils.regClass("FanShape", FanShape);
    Laya.ClassUtils.regClass("SemicircleShap", SemicircleShap);
    Laya.ClassUtils.regClass("Main2DModule", Main2DModule);
    Laya.ClassUtils.regClass("Rotation2DOverLifetimeModule", Rotation2DOverLifetimeModule);
    Laya.ClassUtils.regClass("Shape2DModule", Shape2DModule);
    Laya.ClassUtils.regClass("Size2DOverLifetimeModule", Size2DOverLifetimeModule);
    Laya.ClassUtils.regClass("Velocity2DOverLifetimeModule", Velocity2DOverLifetimeModule);
    Laya.ClassUtils.regClass("ShurikenParticle2DSystem", ShurikenParticle2DSystem);
    Laya.ClassUtils.regClass("ShurikenParticle2DRenderer", ShurikenParticle2DRenderer);

    exports.Base2DShape = Base2DShape;
    exports.Box2DShape = Box2DShape;
    exports.Circle2DShape = Circle2DShape;
    exports.FanShape = FanShape;
    exports.Main2DModule = Main2DModule;
    exports.Particle2DGeomotry = Particle2DGeomotry;
    exports.Particle2DShader = Particle2DShader;
    exports.Particle2DVertexMesh = Particle2DVertexMesh;
    exports.Rotation2DOverLifetimeModule = Rotation2DOverLifetimeModule;
    exports.SemicircleShap = SemicircleShap;
    exports.Shape2DModule = Shape2DModule;
    exports.ShurikenParticle2DRenderer = ShurikenParticle2DRenderer;
    exports.ShurikenParticle2DSystem = ShurikenParticle2DSystem;
    exports.Size2DOverLifetimeModule = Size2DOverLifetimeModule;
    exports.Velocity2DOverLifetimeModule = Velocity2DOverLifetimeModule;

})(window.Laya = window.Laya || {}, Laya);
//# sourceMappingURL=laya.particle.js.map
