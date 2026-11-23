(function (exports, Laya) {
    'use strict';

    class pxStatics {
        static createFloat32Array(length) {
            let ptr = pxStatics._physX._malloc(4 * length);
            const buffer = new Float32Array(pxStatics._physX.HEAPF32.buffer, ptr, length);
            return { ptr: ptr, buffer: buffer };
        }
        static createUint32Array(length) {
            let ptr = pxStatics._physX._malloc(4 * length);
            const buffer = new Uint32Array(pxStatics._physX.HEAPU32.buffer, ptr, length);
            return { ptr: ptr, buffer: buffer };
        }
        static createUint16Array(length) {
            let ptr = pxStatics._physX._malloc(2 * length);
            const buffer = new Uint16Array(pxStatics._physX.HEAPU16.buffer, ptr, length);
            return { ptr: ptr, buffer: buffer };
        }
        static createUint8Array(length) {
            let ptr = pxStatics._physX._malloc(length);
            const buffer = new Uint8Array(pxStatics._physX.HEAPU8.buffer, ptr, length);
            return { ptr: ptr, buffer: buffer };
        }
        static freeBuffer(data) {
            pxStatics._physX._free(data.ptr);
        }
    }
    pxStatics._physXPVD = false;
    pxStatics._PxPvdPort = 5425;
    exports.partFlag = void 0;
    (function (partFlag) {
        partFlag[partFlag["eSOLVE_CONTACT"] = 1] = "eSOLVE_CONTACT";
        partFlag[partFlag["eMODIFY_CONTACTS"] = 2] = "eMODIFY_CONTACTS";
        partFlag[partFlag["eNOTIFY_TOUCH_FOUND"] = 4] = "eNOTIFY_TOUCH_FOUND";
        partFlag[partFlag["eNOTIFY_TOUCH_PERSISTS"] = 8] = "eNOTIFY_TOUCH_PERSISTS";
        partFlag[partFlag["eNOTIFY_TOUCH_LOST"] = 16] = "eNOTIFY_TOUCH_LOST";
        partFlag[partFlag["eNOTIFY_TOUCH_CCD"] = 32] = "eNOTIFY_TOUCH_CCD";
        partFlag[partFlag["eNOTIFY_THRESHOLD_FORCE_FOUND"] = 64] = "eNOTIFY_THRESHOLD_FORCE_FOUND";
        partFlag[partFlag["eNOTIFY_THRESHOLD_FORCE_PERSISTS"] = 128] = "eNOTIFY_THRESHOLD_FORCE_PERSISTS";
        partFlag[partFlag["eNOTIFY_THRESHOLD_FORCE_LOST"] = 256] = "eNOTIFY_THRESHOLD_FORCE_LOST";
        partFlag[partFlag["eNOTIFY_CONTACT_POINTS"] = 512] = "eNOTIFY_CONTACT_POINTS";
        partFlag[partFlag["eDETECT_DISCRETE_CONTACT"] = 1024] = "eDETECT_DISCRETE_CONTACT";
        partFlag[partFlag["eDETECT_CCD_CONTACT"] = 2048] = "eDETECT_CCD_CONTACT";
        partFlag[partFlag["ePRE_SOLVER_VELOCITY"] = 4096] = "ePRE_SOLVER_VELOCITY";
        partFlag[partFlag["ePOST_SOLVER_VELOCITY"] = 8192] = "ePOST_SOLVER_VELOCITY";
        partFlag[partFlag["eCONTACT_EVENT_POSE"] = 16384] = "eCONTACT_EVENT_POSE";
        partFlag[partFlag["eNEXT_FREE"] = 32768] = "eNEXT_FREE";
        partFlag[partFlag["eCONTACT_DEFAULT"] = 1025] = "eCONTACT_DEFAULT";
        partFlag[partFlag["eTRIGGER_DEFAULT"] = 1044] = "eTRIGGER_DEFAULT";
    })(exports.partFlag || (exports.partFlag = {}));

    class pxPhysicsMaterial {
        constructor() {
            this._bounciness = 0.1;
            this._dynamicFriction = 0.1;
            this._staticFriction = 0.1;
            this._bounceCombine = Laya.PhysicsCombineMode.Average;
            this._frictionCombine = Laya.PhysicsCombineMode.Average;
            this._pxMaterial = pxStatics._physics.createMaterial(this._staticFriction, this._dynamicFriction, this._bounciness);
        }
        setBounciness(value) {
            this._pxMaterial.setRestitution(value);
        }
        setDynamicFriction(value) {
            this._pxMaterial.setDynamicFriction(value);
        }
        setStaticFriction(value) {
            this._pxMaterial.setStaticFriction(value);
        }
        setBounceCombine(value) {
            this._pxMaterial.setRestitutionCombineMode(value);
        }
        setFrictionCombine(value) {
            this._pxMaterial.setFrictionCombineMode(value);
        }
        destroy() {
            this._pxMaterial.release();
        }
    }

    exports.ShapeFlag = void 0;
    (function (ShapeFlag) {
        ShapeFlag[ShapeFlag["SIMULATION_SHAPE"] = 1] = "SIMULATION_SHAPE";
        ShapeFlag[ShapeFlag["SCENE_QUERY_SHAPE"] = 2] = "SCENE_QUERY_SHAPE";
        ShapeFlag[ShapeFlag["TRIGGER_SHAPE"] = 4] = "TRIGGER_SHAPE";
    })(exports.ShapeFlag || (exports.ShapeFlag = {}));
    class pxColliderShape {
        constructor() {
            this._offset = new Laya.Vector3(0, 0, 0);
            this._compoundLocalScale = new Laya.Vector3(1, 1, 1);
            this._compoundRotation = new Laya.Quaternion();
            this._scale = new Laya.Vector3(1, 1, 1);
            this._shapeFlags = exports.ShapeFlag.SCENE_QUERY_SHAPE;
            this._pxMaterials = new Array(1);
            this._destroyed = false;
            this.filterData = { word0: Laya.Physics3DUtils.PHYSXDEFAULTMASKVALUE, word1: Laya.Physics3DUtils.PHYSXDEFAULTMASKVALUE, word2: exports.partFlag.eCONTACT_DEFAULT | exports.partFlag.eTRIGGER_DEFAULT, word3: 0 };
        }
        _createShape() {
            this._id = pxColliderShape._pxShapeID++;
            this._pxMaterials[0] = new pxPhysicsMaterial();
            this._pxShape = pxStatics._physics.createShape(this._pxGeometry, this._pxMaterials[0]._pxMaterial, true, new pxStatics._physX.PxShapeFlags(this._shapeFlags));
            this._pxShape && this._pxShape.setUUID(this._id);
            pxColliderShape._shapePool.set(this._id, this);
        }
        _modifyFlag(flag, value) {
            this._shapeFlags = value ? this._shapeFlags | flag : this._shapeFlags & ~flag;
        }
        getPhysicsShape() {
            return this._pxShape;
        }
        addToActor(collider) {
            if (this._pxCollider != collider) {
                if (this._pxShape)
                    collider._pxActor.attachShape(this._pxShape);
                this._pxCollider = collider;
                this.setOffset(this._offset);
            }
        }
        removeFromActor(collider) {
            if (this._pxCollider == collider) {
                if (this._pxShape)
                    collider._pxActor.detachShape(this._pxShape, true);
                this._pxCollider = null;
            }
        }
        setOffset(position) {
            position.cloneTo(this._offset);
            this._setLocalPose();
        }
        getOffset() {
            return this._offset;
        }
        setCompoundTransform(position, rotation, scale) {
            rotation.cloneTo(this._compoundRotation);
            scale.cloneTo(this._compoundLocalScale);
            this.setOffset(position);
        }
        _setLocalPose() {
            if (!this._pxCollider || !this._pxShape)
                return;
            const transform = pxColliderShape.transform;
            const ownerScale = this._pxCollider.owner.transform.getWorldLossyScale();
            Laya.Vector3.multiply(ownerScale, this._compoundLocalScale, this._scale);
            Laya.Vector3.multiply(this._offset, ownerScale, transform.translation);
            this._compoundRotation.cloneTo(transform.rotation);
            this._pxShape.setLocalPose(transform);
        }
        setIsTrigger(value) {
            this._modifyFlag(exports.ShapeFlag.SIMULATION_SHAPE, !value);
            this._modifyFlag(exports.ShapeFlag.TRIGGER_SHAPE, value);
            this._setShapeFlags(this._shapeFlags);
        }
        _setShapeFlags(flags) {
            this._shapeFlags = flags;
            if (this._pxShape)
                this._pxShape.setFlags(new pxStatics._physX.PxShapeFlags(this._shapeFlags));
        }
        setSimulationFilterData(colliderGroup, colliderMask) {
            this.filterData.word0 = colliderGroup;
            this.filterData.word1 = colliderMask;
            if (this._pxShape) {
                this._pxShape.setSimulationFilterData(this.filterData);
                this._pxShape.setQueryFilterData(this.filterData);
            }
        }
        setEventFilterData(filterWorld2Number) {
            this.filterData.word2 = filterWorld2Number;
            if (this._pxShape) {
                this._pxShape.setSimulationFilterData(this.filterData);
                this._pxShape.setQueryFilterData(this.filterData);
            }
        }
        setBounciness(value) {
            var _a;
            (_a = this._pxMaterials[0]) === null || _a === void 0 ? void 0 : _a.setBounciness(value);
        }
        setDynamicFriction(value) {
            var _a;
            (_a = this._pxMaterials[0]) === null || _a === void 0 ? void 0 : _a.setDynamicFriction(value);
        }
        setStaticFriction(value) {
            var _a;
            (_a = this._pxMaterials[0]) === null || _a === void 0 ? void 0 : _a.setStaticFriction(value);
        }
        setFrictionCombine(value) {
            var _a;
            (_a = this._pxMaterials[0]) === null || _a === void 0 ? void 0 : _a.setFrictionCombine(value);
        }
        setBounceCombine(value) {
            var _a;
            (_a = this._pxMaterials[0]) === null || _a === void 0 ? void 0 : _a.setBounceCombine(value);
        }
        destroy() {
            if (this._pxShape) {
                if (this._pxCollider && this._pxCollider._physicsManager) {
                    this._pxCollider._physicsManager.removeCollider(this._pxCollider);
                }
                this._pxShape.release();
                this._pxShape = undefined;
            }
            pxColliderShape._shapePool.delete(this._id);
            this._pxMaterials.forEach(element => {
                element.destroy();
            });
            this._pxMaterials.length = 0;
            this._destroyed = true;
        }
    }
    pxColliderShape._shapePool = new Map();
    pxColliderShape._pxShapeID = 0;
    pxColliderShape.transform = {
        translation: new Laya.Vector3(),
        rotation: new Laya.Quaternion()
    };

    var ColliderShapeUpAxis;
    (function (ColliderShapeUpAxis) {
        ColliderShapeUpAxis[ColliderShapeUpAxis["X"] = 0] = "X";
        ColliderShapeUpAxis[ColliderShapeUpAxis["Y"] = 1] = "Y";
        ColliderShapeUpAxis[ColliderShapeUpAxis["Z"] = 2] = "Z";
    })(ColliderShapeUpAxis || (ColliderShapeUpAxis = {}));
    class pxCapsuleColliderShape extends pxColliderShape {
        constructor() {
            super();
            this._radius = 0.25;
            this._halfHeight = 0.5;
            this._rotation = new Laya.Quaternion(0, 0, 0.7071068, 0.7071068);
            this._upAxis = ColliderShapeUpAxis.Y;
            this._pxGeometry = new pxStatics._physX.PxCapsuleGeometry(this._radius, this._halfHeight);
            this._createShape();
        }
        _setCapsuleRotation() {
            Laya.Quaternion.multiply(this._compoundRotation, this._rotation, pxColliderShape.transform.rotation);
            this._pxShape.setLocalPose(pxColliderShape.transform);
        }
        _setLocalPose() {
            if (!this._pxCollider || !this._pxShape)
                return;
            super._setLocalPose();
            this._setCapsuleRotation();
        }
        addToActor(collider) {
            super.addToActor(collider);
            this._setCapsuleRotation();
        }
        setRadius(radius) {
            this._radius = radius;
            switch (this._upAxis) {
                case ColliderShapeUpAxis.X:
                    this._pxGeometry.radius = this._radius * Math.max(this._scale.y, this._scale.z);
                    break;
                case ColliderShapeUpAxis.Y:
                    this._pxGeometry.radius = this._radius * Math.max(this._scale.x, this._scale.z);
                    break;
                case ColliderShapeUpAxis.Z:
                    this._pxGeometry.radius = this._radius * Math.max(this._scale.x, this._scale.y);
                    break;
            }
            this._pxShape.setGeometry(this._pxGeometry);
        }
        setHeight(height) {
            this._halfHeight = (height - this._radius * 2) * 0.5;
            switch (this._upAxis) {
                case ColliderShapeUpAxis.X:
                    this._pxGeometry.halfHeight = this._halfHeight * this._scale.x;
                    break;
                case ColliderShapeUpAxis.Y:
                    this._pxGeometry.halfHeight = this._halfHeight * this._scale.y;
                    break;
                case ColliderShapeUpAxis.Z:
                    this._pxGeometry.halfHeight = this._halfHeight * this._scale.z;
                    break;
            }
            this._pxShape.setGeometry(this._pxGeometry);
        }
        setUpAxis(upAxis) {
            if (this._pxShape && this._upAxis == upAxis)
                return;
            this._upAxis = upAxis;
            switch (upAxis) {
                case ColliderShapeUpAxis.X:
                    this._rotation.setValue(0, 0, 0, 1);
                    break;
                case ColliderShapeUpAxis.Y:
                    this._rotation.setValue(0, 0, Math.SQRT1_2, Math.SQRT1_2);
                    break;
                case ColliderShapeUpAxis.Z:
                    this._rotation.setValue(0, -Math.SQRT1_2, 0, Math.SQRT1_2);
                    break;
            }
            this.setHeight((this._halfHeight + this._radius) * 2);
            this.setRadius(this._radius);
            this._setLocalPose();
        }
        setOffset(position) {
            super.setOffset(position);
            this.setHeight((this._halfHeight + this._radius) * 2);
            this.setRadius(this._radius);
        }
        destroy() {
            super.destroy();
            this._radius = null;
            this._halfHeight = null;
            this._upAxis = null;
        }
    }

    exports.pxColliderType = void 0;
    (function (pxColliderType) {
        pxColliderType[pxColliderType["RigidbodyCollider"] = 0] = "RigidbodyCollider";
        pxColliderType[pxColliderType["CharactorCollider"] = 1] = "CharactorCollider";
        pxColliderType[pxColliderType["StaticCollider"] = 2] = "StaticCollider";
    })(exports.pxColliderType || (exports.pxColliderType = {}));
    exports.pxActorFlag = void 0;
    (function (pxActorFlag) {
        pxActorFlag[pxActorFlag["eVISUALIZATION"] = 1] = "eVISUALIZATION";
        pxActorFlag[pxActorFlag["eDISABLE_GRAVITY"] = 2] = "eDISABLE_GRAVITY";
        pxActorFlag[pxActorFlag["eSEND_SLEEP_NOTIFIES"] = 4] = "eSEND_SLEEP_NOTIFIES";
        pxActorFlag[pxActorFlag["eDISABLE_SIMULATION"] = 8] = "eDISABLE_SIMULATION";
    })(exports.pxActorFlag || (exports.pxActorFlag = {}));
    class pxCollider {
        constructor(manager) {
            this._type = exports.pxColliderType.StaticCollider;
            this._isSimulate = false;
            this._destroyed = false;
            this.inPhysicUpdateListIndex = -1;
            this._enableProcessCollisions = false;
            this._transformFlag = 2147483647;
            this._bounciness = 0.1;
            this._dynamicFriction = 0.1;
            this._staticFriction = 0.1;
            this._bounceCombine = Laya.PhysicsCombineMode.Average;
            this._frictionCombine = Laya.PhysicsCombineMode.Average;
            this._collisionGroup = Laya.Physics3DUtils.PHYSXDEFAULTMASKVALUE;
            this._canCollisionWith = Laya.Physics3DUtils.PHYSXDEFAULTMASKVALUE;
            this._physicsManager = manager;
            this._id = pxCollider._pxActorID++;
        }
        setfriction(value) {
            throw new Laya.NotImplementedError();
        }
        setRollingFriction(value) {
            throw new Laya.NotImplementedError();
        }
        setActorFlag(flag, value) {
            this._pxActor.setCustomFlag(flag, value);
        }
        getCapable(value) {
            return null;
        }
        setColliderShape(shape) {
            if (shape == this._shape)
                return;
            var lastColliderShape = this._shape;
            this._shape = shape;
            if (shape) {
                if (this._pxActor) {
                    if (lastColliderShape)
                        lastColliderShape.removeFromActor(this);
                    this._shape.addToActor(this);
                    let simulate = this._isSimulate;
                    simulate && this._physicsManager.removeCollider(this);
                    this._initColliderShapeByCollider();
                    if ((simulate || !lastColliderShape || (lastColliderShape && lastColliderShape._destroyed)) && this.componentEnable) {
                        this._physicsManager.addCollider(this);
                    }
                }
                else {
                    this._shape = null;
                }
            }
            else {
                if (this._isSimulate) {
                    this._physicsManager.removeCollider(this);
                }
            }
            lastColliderShape && lastColliderShape.destroy();
        }
        _initColliderShapeByCollider() {
            this.setBounceCombine(this._bounceCombine);
            this.setFrictionCombine(this._frictionCombine);
            this.setStaticFriction(this._staticFriction);
            this.setBounciness(this._bounciness);
            this.setDynamicFriction(this._dynamicFriction);
            this.setCollisionGroup(this._collisionGroup);
            this.setCanCollideWith(this._canCollisionWith);
        }
        destroy() {
            var _a, _b;
            if (this._destroyed)
                return;
            this._destroyed = true;
            if (this._isSimulate)
                this._physicsManager.removeCollider(this);
            (_a = this._shape) === null || _a === void 0 ? void 0 : _a.removeFromActor(this);
            pxCollider._ActorPool.delete(this._id);
            (_b = this._pxActor) === null || _b === void 0 ? void 0 : _b.release();
            this._pxActor = null;
        }
        setCollisionGroup(value) {
            if (value == Laya.Physics3DUtils.COLLISIONFILTERGROUP_ALLFILTER) {
                value = Laya.Physics3DUtils.PHYSXDEFAULTMASKVALUE;
            }
            this._collisionGroup = value;
            this._shape.setSimulationFilterData(this._collisionGroup, this._canCollisionWith);
        }
        setCanCollideWith(value) {
            if (value == Laya.Physics3DUtils.COLLISIONFILTERGROUP_ALLFILTER) {
                value = Laya.Physics3DUtils.PHYSXDEFAULTMASKVALUE;
            }
            this._canCollisionWith = value;
            this._shape.setSimulationFilterData(this._collisionGroup, this._canCollisionWith);
        }
        setEventFilter(events) {
            if (!this._shape)
                return;
            let flag = exports.partFlag.eCONTACT_DEFAULT | exports.partFlag.eTRIGGER_DEFAULT;
            for (let i = 0, j = events.length; i < j; i++) {
                let value = events[i];
                if (value == Laya.Event.TRIGGER_ENTER) {
                    flag = flag | exports.partFlag.eTRIGGER_DEFAULT | exports.partFlag.eNOTIFY_TOUCH_FOUND;
                }
                if (value == Laya.Event.TRIGGER_STAY) ;
                if (value == Laya.Event.TRIGGER_EXIT) {
                    flag = flag | exports.partFlag.eTRIGGER_DEFAULT | exports.partFlag.eNOTIFY_TOUCH_LOST;
                }
                if (value == Laya.Event.COLLISION_ENTER) {
                    flag = flag | exports.partFlag.eNOTIFY_TOUCH_PERSISTS | exports.partFlag.eNOTIFY_CONTACT_POINTS;
                }
                if (value == Laya.Event.COLLISION_STAY) {
                    flag = flag | exports.partFlag.eNOTIFY_TOUCH_PERSISTS | exports.partFlag.eNOTIFY_CONTACT_POINTS;
                }
                if (value == Laya.Event.COLLISION_EXIT) {
                    flag = flag | exports.partFlag.eNOTIFY_TOUCH_PERSISTS | exports.partFlag.eNOTIFY_TOUCH_LOST;
                }
            }
            this._shape && this._shape.setEventFilterData(flag);
        }
        allowSleep(value) {
        }
        setOwner(node) {
            this.owner = node;
            this._transform = node.transform;
            this._initCollider();
            pxCollider._ActorPool.set(this._id, this);
            this._pxActor.setUUID(this._id);
            if (this._type === exports.pxColliderType.RigidbodyCollider)
                this.setActorFlag(exports.pxActorFlag.eSEND_SLEEP_NOTIFIES, true);
        }
        _initCollider() {
        }
        transformChanged(flag) {
            this._transformFlag |= flag;
            if (this.inPhysicUpdateListIndex == -1 && !this._enableProcessCollisions) {
                this._physicsManager._physicsUpdateList.add(this);
            }
        }
        setWorldTransform(focus) {
            if (this.owner) {
                if (focus || this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDPOSITION) || this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDQUATERNION)) {
                    this._pxActor.setGlobalPose(this._transformTo(this.owner.transform.position, this.owner.transform.rotation), true);
                    this._setTransformFlag(Laya.Transform3D.TRANSFORM_WORLDPOSITION, false);
                    this._setTransformFlag(Laya.Transform3D.TRANSFORM_WORLDQUATERNION, false);
                }
                if (focus || this._getTransformFlag(Laya.Transform3D.TRANSFORM_WORLDSCALE) && this._shape) {
                    this._shape && this._shape.setOffset(this._shape._offset);
                    this._setTransformFlag(Laya.Transform3D.TRANSFORM_WORLDSCALE, false);
                }
            }
        }
        setBounciness(value) {
            this._bounciness = value;
            this._shape && this._shape.setBounciness(value);
        }
        setDynamicFriction(value) {
            this._dynamicFriction = value;
            this._shape && this._shape.setDynamicFriction(value);
        }
        setStaticFriction(value) {
            this._staticFriction = value;
            this._shape && this._shape.setStaticFriction(value);
        }
        setFrictionCombine(value) {
            this._frictionCombine = value;
            this._shape && this._shape.setFrictionCombine(value);
        }
        setBounceCombine(value) {
            this._bounceCombine = value;
            this._shape && this._shape.setBounceCombine(value);
        }
        _getTransformFlag(type) {
            return (this._transformFlag & type) != 0;
        }
        _setTransformFlag(type, value) {
            if (value)
                this._transformFlag |= type;
            else
                this._transformFlag &= ~type;
        }
        _transformTo(pos, rot) {
            const transform = pxCollider._tempTransform;
            pos.cloneTo(transform.translation);
            rot.normalize(transform.rotation);
            return transform;
        }
    }
    pxCollider._ActorPool = new Map();
    pxCollider._pxActorID = 0;
    pxCollider._tempTransform = { translation: new Laya.Vector3(), rotation: new Laya.Quaternion() };

    exports.ControllerNonWalkableMode = void 0;
    (function (ControllerNonWalkableMode) {
        ControllerNonWalkableMode[ControllerNonWalkableMode["ePREVENT_CLIMBING"] = 0] = "ePREVENT_CLIMBING";
        ControllerNonWalkableMode[ControllerNonWalkableMode["ePREVENT_CLIMBING_AND_FORCE_SLIDING"] = 1] = "ePREVENT_CLIMBING_AND_FORCE_SLIDING";
    })(exports.ControllerNonWalkableMode || (exports.ControllerNonWalkableMode = {}));
    exports.ECharacterCollisionFlag = void 0;
    (function (ECharacterCollisionFlag) {
        ECharacterCollisionFlag[ECharacterCollisionFlag["eCOLLISION_SIDES"] = 1] = "eCOLLISION_SIDES";
        ECharacterCollisionFlag[ECharacterCollisionFlag["eCOLLISION_UP"] = 2] = "eCOLLISION_UP";
        ECharacterCollisionFlag[ECharacterCollisionFlag["eCOLLISION_DOWN"] = 4] = "eCOLLISION_DOWN";
    })(exports.ECharacterCollisionFlag || (exports.ECharacterCollisionFlag = {}));
    class pxCharactorCollider extends pxCollider {
        constructor(manager) {
            super(manager);
            this._radius = 0.5;
            this._height = 2;
            this._localOffset = new Laya.Vector3();
            this._upDirection = new Laya.Vector3(0, 1, 0);
            this._stepOffset = 0;
            this._slopeLimit = 0;
            this._contactOffset = 0;
            this._minDistance = 0;
            this._nonWalkableMode = exports.ControllerNonWalkableMode.ePREVENT_CLIMBING_AND_FORCE_SLIDING;
            this._jumpVelocity = new Laya.Vector3();
            this._gravityDisplacement = new Laya.Vector3();
            this._lastCollisionFlags = 0;
            this._gravity = new Laya.Vector3(0, -9.81, 0);
            this._characterCollisionFlags = 0;
            this._pushForce = 10;
            this._characterEvents = [];
            this._type = exports.pxColliderType.CharactorCollider;
            Laya.Physics3DStatInfo.addStatisticsInfo(Laya.EPhysicsStatisticsInfo.C_PhysicaCharacterController, 1);
        }
        setColliderShape(shape) {
            if (shape == this._shape)
                return;
            this._shape = shape;
            if (shape) {
                if (this._pxActor) {
                    if (this.componentEnable) {
                        this._physicsManager.addCollider(this);
                    }
                }
                else {
                    this._shape = null;
                }
            }
            else {
                if (this._isSimulate) {
                    this._physicsManager.removeCollider(this);
                }
            }
        }
        _getNodeScale() {
            return this.owner ? this.owner.transform.getWorldLossyScale() : Laya.Vector3.ONE;
        }
        _initCollider() {
            this._pxActor = pxStatics._physics.createRigidDynamic(this._transformTo(new Laya.Vector3(), new Laya.Quaternion()));
        }
        getCapable(value) {
            return pxCharactorCollider.getCharacterCapable(value);
        }
        static getCharacterCapable(value) {
            return pxCharactorCollider._characterCapableMap.get(value);
        }
        static initCapable() {
            this._characterCapableMap = new Map();
            this._characterCapableMap.set(Laya.ECharacterCapable.Charcater_Gravity, true);
            this._characterCapableMap.set(Laya.ECharacterCapable.Charcater_CollisionGroup, true);
            this._characterCapableMap.set(Laya.ECharacterCapable.Charcater_WorldPosition, true);
            this._characterCapableMap.set(Laya.ECharacterCapable.Charcater_Move, true);
            this._characterCapableMap.set(Laya.ECharacterCapable.Charcater_Jump, true);
            this._characterCapableMap.set(Laya.ECharacterCapable.Charcater_StepOffset, true);
            this._characterCapableMap.set(Laya.ECharacterCapable.Character_UpDirection, true);
            this._characterCapableMap.set(Laya.ECharacterCapable.Character_FallSpeed, true);
            this._characterCapableMap.set(Laya.ECharacterCapable.Character_SlopeLimit, true);
            this._characterCapableMap.set(Laya.ECharacterCapable.Character_PushForce, true);
            this._characterCapableMap.set(Laya.ECharacterCapable.Character_Radius, true);
            this._characterCapableMap.set(Laya.ECharacterCapable.Character_Height, true);
            this._characterCapableMap.set(Laya.ECharacterCapable.Character_offset, true);
            this._characterCapableMap.set(Laya.ECharacterCapable.Character_Skin, true);
            this._characterCapableMap.set(Laya.ECharacterCapable.Character_minDistance, true);
            this._characterCapableMap.set(Laya.ECharacterCapable.Character_EventFilter, true);
            this._characterCapableMap.set(Laya.ECharacterCapable.Character_SimulateGravity, true);
            this._characterCapableMap.set(Laya.ECharacterCapable.Character_IsOnGround, true);
        }
        _createController() {
            let desc;
            const pxPhysics = pxStatics._physX;
            desc = new pxPhysics.PxCapsuleControllerDesc();
            this._characterCollisionFlags = new pxPhysics.PxControllerCollisionFlags(exports.ECharacterCollisionFlag.eCOLLISION_DOWN);
            let scale = this._getNodeScale();
            desc.radius = this._radius * Math.max(scale.x, scale.z);
            desc.height = this._height * scale.y;
            desc.climbingMode = 1;
            desc.setreportCallBackBehavior();
            this._pxNullShape = this._pxNullShape ? this._pxNullShape : new pxCapsuleColliderShape();
            desc.setMaterial(this._pxNullShape._pxMaterials[0]._pxMaterial);
            this._pxNullShape._pxCollider = this;
            this._pxController = this._physicsManager._pxcontrollerManager.createController(desc);
            this._pxController.setShapeID(this._pxNullShape._id);
            this.setRadius(this._radius);
            this.setHeight(this._height * 2);
            this.setPosition(this.owner.transform.position);
            this.setStepOffset(this._stepOffset);
            this.setUpDirection(this._upDirection);
            this.setSlopeLimit(this._slopeLimit);
            this.setGravity(this._gravity);
            this.setPushForce(this._pushForce);
            this.setSkinWidth(this._contactOffset);
            this.setNonWalkableMode(this._nonWalkableMode);
            this.setEventFilter(this._characterEvents);
            this._setCharacterCollisonFlag(exports.ECharacterCollisionFlag.eCOLLISION_SIDES);
        }
        _setCharacterCollisonFlag(value) {
            this._pxController && this._pxController.isSetControllerCollisionFlag(this._characterCollisionFlags, value);
        }
        _releaseController() {
            if (this._pxController) {
                this._pxController.release();
                this._pxController = null;
            }
        }
        move(disp) {
            if (this._pxController)
                this._lastCollisionFlags = this._pxController.move(disp, this._minDistance, 1 / 60);
        }
        jump(velocity) {
            if (!this._pxController || !this.isGrounded())
                return;
            if (velocity)
                velocity.cloneTo(this._jumpVelocity);
            else
                Laya.Vector3.scale(this._upDirection, 5, this._jumpVelocity);
            this._lastCollisionFlags = 0;
        }
        simulateGravity(deltaTime) {
            if (!this._pxController || !(deltaTime > 0))
                return;
            const velocity = this._jumpVelocity;
            velocity.x += this._gravity.x * deltaTime;
            velocity.y += this._gravity.y * deltaTime;
            velocity.z += this._gravity.z * deltaTime;
            const displacement = this._gravityDisplacement;
            Laya.Vector3.scale(velocity, deltaTime, displacement);
            this._lastCollisionFlags = this._pxController.move(displacement, this._minDistance, deltaTime);
            const upSpeed = Laya.Vector3.dot(velocity, this._upDirection);
            if (((this._lastCollisionFlags & exports.ECharacterCollisionFlag.eCOLLISION_DOWN) && upSpeed < 0)
                || ((this._lastCollisionFlags & exports.ECharacterCollisionFlag.eCOLLISION_UP) && upSpeed > 0)) {
                velocity.x -= this._upDirection.x * upSpeed;
                velocity.y -= this._upDirection.y * upSpeed;
                velocity.z -= this._upDirection.z * upSpeed;
            }
        }
        getVerticalVel() {
            return Laya.Vector3.dot(this._jumpVelocity, this._upDirection);
        }
        isGrounded() {
            return (this._lastCollisionFlags & exports.ECharacterCollisionFlag.eCOLLISION_DOWN) != 0;
        }
        setStepOffset(offset) {
            this._stepOffset = offset;
            this._pxController && this._pxController.setStepOffset(this._stepOffset);
        }
        setUpDirection(up) {
            up.cloneTo(this._upDirection);
            this._pxController && this._pxController.setUpDirection(up);
        }
        setSlopeLimit(value) {
            this._slopeLimit = value;
            this._pxController && this._pxController.setSlopeLimit(Math.cos(this._slopeLimit));
        }
        setGravity(value) {
            value.cloneTo(this._gravity);
        }
        setPushForce(value) {
            this._pushForce = value;
            this._pxController && this._pxController.setPushForce(this._pushForce);
        }
        getWorldTransform() {
            const v3 = this._pxController.getPosition();
            _tempTranslation$1.set(v3.x + this._localOffset.x, v3.y - this._height + this._localOffset.y, v3.z + this._localOffset.z);
            this.owner.transform.position = _tempTranslation$1;
        }
        setSkinWidth(width) {
            this._contactOffset = width;
            this._pxController && this._pxController.setContactOffset(this._contactOffset);
        }
        destroy() {
            if (this._destroyed)
                return;
            this._releaseController();
            if (this._pxNullShape) {
                this._pxNullShape._pxCollider = null;
                this._pxNullShape.destroy();
                this._pxNullShape = null;
            }
            super.destroy();
            Laya.Physics3DStatInfo.addStatisticsInfo(Laya.EPhysicsStatisticsInfo.C_PhysicaCharacterController, -1);
        }
        setPosition(value) {
            this._pxController && this._pxController.setPosition(value);
        }
        getPosition() {
            const v3 = this._pxController.getPosition();
            pxCharactorCollider.tempV3.set(v3.x, v3.y, v3.z);
            return pxCharactorCollider.tempV3;
        }
        setShapelocalOffset(value) {
            this._localOffset = value;
        }
        setHeight(value) {
            this._height = value * 0.5;
            let scale = this._getNodeScale();
            this._pxController && this._pxController.resize(this._height * scale.y);
        }
        setRadius(value) {
            this._radius = value;
            let scale = this._getNodeScale();
            this._pxController && this._pxController.setRadius(this._radius * Math.max(scale.x, scale.z));
        }
        setminDistance(value) {
            this._minDistance = value;
        }
        setNonWalkableMode(value) {
            this._nonWalkableMode = value;
            this._pxController && this._pxController.setNonWalkableMode(this._nonWalkableMode);
        }
        setEventFilter(events) {
            this._characterEvents = events;
            if (!this._pxController)
                return;
            let flag = exports.partFlag.eCONTACT_DEFAULT;
            for (let i = 0, j = events.length; i < j; i++) {
                let value = events[i];
                if (value == Laya.Event.COLLISION_ENTER) {
                    flag = flag | exports.partFlag.eNOTIFY_TOUCH_PERSISTS | exports.partFlag.eNOTIFY_CONTACT_POINTS;
                }
                if (value == Laya.Event.COLLISION_STAY) {
                    flag = flag | exports.partFlag.eNOTIFY_TOUCH_PERSISTS;
                }
                if (value == Laya.Event.COLLISION_EXIT) {
                    flag = flag | exports.partFlag.eNOTIFY_TOUCH_PERSISTS | exports.partFlag.eNOTIFY_TOUCH_LOST;
                }
            }
            this._pxController && this._pxController.setEventFilter(flag);
        }
        release() {
            if (this._pxController) {
                this._pxController.release();
                this._pxController = null;
            }
        }
    }
    pxCharactorCollider.tempV3 = new Laya.Vector3();
    const _tempTranslation$1 = new Laya.Vector3();

    exports.CollisionDetectionMode = void 0;
    (function (CollisionDetectionMode) {
        CollisionDetectionMode[CollisionDetectionMode["Discrete"] = 0] = "Discrete";
        CollisionDetectionMode[CollisionDetectionMode["Continuous"] = 1] = "Continuous";
        CollisionDetectionMode[CollisionDetectionMode["ContinuousDynamic"] = 2] = "ContinuousDynamic";
        CollisionDetectionMode[CollisionDetectionMode["ContinuousSpeculative"] = 3] = "ContinuousSpeculative";
    })(exports.CollisionDetectionMode || (exports.CollisionDetectionMode = {}));
    exports.DynamicColliderConstraints = void 0;
    (function (DynamicColliderConstraints) {
        DynamicColliderConstraints[DynamicColliderConstraints["None"] = 0] = "None";
        DynamicColliderConstraints[DynamicColliderConstraints["FreezePositionX"] = 1] = "FreezePositionX";
        DynamicColliderConstraints[DynamicColliderConstraints["FreezePositionY"] = 2] = "FreezePositionY";
        DynamicColliderConstraints[DynamicColliderConstraints["FreezePositionZ"] = 4] = "FreezePositionZ";
        DynamicColliderConstraints[DynamicColliderConstraints["FreezeRotationX"] = 8] = "FreezeRotationX";
        DynamicColliderConstraints[DynamicColliderConstraints["FreezeRotationY"] = 16] = "FreezeRotationY";
        DynamicColliderConstraints[DynamicColliderConstraints["FreezeRotationZ"] = 32] = "FreezeRotationZ";
    })(exports.DynamicColliderConstraints || (exports.DynamicColliderConstraints = {}));
    class pxDynamicCollider extends pxCollider {
        static getStaticColliderCapable(value) {
            return pxDynamicCollider._dynamicCapableMap.get(value);
        }
        static initCapable() {
            this._dynamicCapableMap = new Map();
            this._dynamicCapableMap.set(Laya.EColliderCapable.Collider_AllowTrigger, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.Collider_CollisionGroup, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.Collider_Restitution, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.Collider_Friction, false);
            this._dynamicCapableMap.set(Laya.EColliderCapable.Collider_RollingFriction, false);
            this._dynamicCapableMap.set(Laya.EColliderCapable.Collider_DynamicFriction, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.Collider_StaticFriction, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.Collider_BounceCombine, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.Collider_FrictionCombine, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.Collider_EventFilter, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.Collider_CollisionDetectionMode, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.RigidBody_AllowSleep, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.RigidBody_Gravity, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.RigidBody_LinearDamp, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.RigidBody_AngularDamp, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.RigidBody_LinearVelocity, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.RigidBody_AngularVelocity, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.RigidBody_Mass, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.RigidBody_InertiaTensor, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.RigidBody_MassCenter, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.RigidBody_SleepThreshold, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.RigidBody_SleepAngularVelocity, false);
            this._dynamicCapableMap.set(Laya.EColliderCapable.RigidBody_SolverIterations, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.RigidBody_AllowDetectionMode, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.RigidBody_AllowKinematic, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.RigidBody_LinearFactor, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.RigidBody_AngularFactor, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.RigidBody_ApplyForce, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.RigidBody_ApplyTorque, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.RigidBody_ApplyImpulse, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.RigidBody_ApplyTorqueImpulse, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.RigidBody_WorldPosition, true);
            this._dynamicCapableMap.set(Laya.EColliderCapable.RigidBody_WorldOrientation, true);
        }
        constructor(manager) {
            super(manager);
            this.IsKinematic = false;
            this._allowSleep = true;
            this._gravity = null;
            this._mass = 1.0;
            this._linearDamping = 0.0;
            this._angularDamping = 0.0;
            this._linearVelocity = new Laya.Vector3();
            this._angularVelocity = new Laya.Vector3();
            this._centerOfMass = new Laya.Vector3(0, 0, 0);
            this._inertiaTensor = new Laya.Vector3(1, 1, 1);
            this._sleepThreshold = 5e-3;
            this._collisionDetectionMode = exports.CollisionDetectionMode.Discrete;
            this._solverIterations = 4.0;
            this._enableProcessCollisions = true;
            this._type = exports.pxColliderType.RigidbodyCollider;
            Laya.Physics3DStatInfo.addStatisticsInfo(Laya.EPhysicsStatisticsInfo.C_PhysicaDynamicRigidBody, 1);
        }
        getCapable(value) {
            return pxDynamicCollider.getStaticColliderCapable(value);
        }
        _initCollider() {
            this._pxActor = pxStatics._physics.createRigidDynamic(this._transformTo(new Laya.Vector3(), new Laya.Quaternion()));
        }
        _initColliderShapeByCollider() {
            super._initColliderShapeByCollider();
            this.setWorldTransform(true);
            this.setTrigger(this._isTrigger);
            this.setInertiaTensor(this._inertiaTensor);
            this.setMass(this._mass);
            this.setIsKinematic(this.IsKinematic);
            this.setAngularDamping(this._angularDamping);
            this.setAngularVelocity(this._angularVelocity);
            this.setLinearDamping(this._linearDamping);
            this.setLinearVelocity(this._linearVelocity);
            this.setCenterOfMass(this._centerOfMass);
            this.setCollisionDetectionMode(this._collisionDetectionMode);
            this.setSolverIterations(this._solverIterations);
            this.allowSleep(this._allowSleep);
            if (this._gravity)
                this.setGravity(this._gravity);
            this.setWorldPosition(this.owner.transform.position);
        }
        setWorldPosition(value) {
            const transform = this._pxActor.getGlobalPose();
            _tempTranslation.setValue(value.x, value.y, value.z);
            _tempRotation.setValue(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w);
            this._pxActor.setGlobalPose(this._transformTo(_tempTranslation, _tempRotation), true);
        }
        setWorldRotation(value) {
            const transform = this._pxActor.getGlobalPose();
            _tempTranslation.setValue(transform.translation.x, transform.translation.y, transform.translation.z);
            _tempRotation.setValue(value.x, value.y, value.z, value.w);
            this._pxActor.setGlobalPose(this._transformTo(_tempTranslation, _tempRotation), true);
        }
        getWorldTransform() {
            const transform = this._pxActor.getGlobalPose();
            _tempTranslation.set(transform.translation.x, transform.translation.y, transform.translation.z);
            _tempRotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w);
            this.owner.transform.position = _tempTranslation;
            this.owner.transform.rotation = _tempRotation;
        }
        setTrigger(value) {
            this._isTrigger = value;
            this._shape && this._shape.setIsTrigger(value);
        }
        setLinearDamping(value) {
            this._linearDamping = value;
            this._pxActor.setLinearDamping(value);
        }
        setAngularDamping(value) {
            this._angularDamping = value;
            this._pxActor.setAngularDamping(value);
        }
        setLinearVelocity(value) {
            this._linearVelocity = value;
            this._pxActor.setLinearVelocity(value, true);
        }
        getLinearVelocity() {
            let velocity = this._pxActor.getLinearVelocity();
            _tempTranslation.set(velocity.x, velocity.y, velocity.z);
            return _tempTranslation;
        }
        setAngularVelocity(value) {
            this._angularVelocity = value;
            this._pxActor.setAngularVelocity(value, true);
        }
        getAngularVelocity() {
            let angVelocity = this._pxActor.getAngularVelocity();
            _tempTranslation.set(angVelocity.x, angVelocity.y, angVelocity.z);
            this._angularVelocity.setValue(angVelocity.x, angVelocity.y, angVelocity.z);
            return _tempTranslation;
        }
        setMass(value) {
            value = Math.max(value, 1e-07);
            this._mass = value;
            this._pxActor.setMassAndUpdateInertia(value);
            this._pxActor.setCMassLocalPose(this._centerOfMass);
        }
        setCenterOfMass(value) {
            this._centerOfMass = value;
            this._pxActor.setCMassLocalPose(value);
        }
        _getLocalCenterOfMass(out) {
            out.x = this._centerOfMass.x;
            out.y = this._centerOfMass.y;
            out.z = this._centerOfMass.z;
        }
        setInertiaTensor(value) {
            this._pxActor.setMassSpaceInertiaTensor(value);
        }
        isSleeping() {
            return this._pxActor.isSleeping();
        }
        setSleepThreshold(value) {
            this._sleepThreshold = value;
            this._pxActor.setSleepThreshold(this._allowSleep ? value : 0);
        }
        setCollisionDetectionMode(value) {
            this._collisionDetectionMode = value;
            switch (value) {
                case exports.CollisionDetectionMode.Continuous:
                    this._pxActor.setRigidBodyFlag(pxStatics._physX.PxRigidBodyFlag.eENABLE_CCD, true);
                    break;
                case exports.CollisionDetectionMode.ContinuousDynamic:
                    this._pxActor.setRigidBodyFlag(pxStatics._physX.PxRigidBodyFlag.eENABLE_CCD_FRICTION, true);
                    break;
                case exports.CollisionDetectionMode.ContinuousSpeculative:
                    this._pxActor.setRigidBodyFlag(pxStatics._physX.PxRigidBodyFlag.eENABLE_SPECULATIVE_CCD, true);
                    break;
                case exports.CollisionDetectionMode.Discrete:
                    const physX = pxStatics._physX;
                    this._pxActor.setRigidBodyFlag(physX.PxRigidBodyFlag.eENABLE_CCD, false);
                    this._pxActor.setRigidBodyFlag(physX.PxRigidBodyFlag.eENABLE_CCD_FRICTION, false);
                    this._pxActor.setRigidBodyFlag(physX.PxRigidBodyFlag.eENABLE_SPECULATIVE_CCD, false);
                    break;
            }
        }
        setSolverIterations(value) {
            this._solverIterations = value;
            this._pxActor.setSolverIterationCounts(value, 1);
        }
        setIsKinematic(value) {
            this.IsKinematic = value;
            if (value) {
                this._enableProcessCollisions = false;
                if (this._isSimulate)
                    this._physicsManager._dynamicUpdateList.remove(this);
                this._pxActor.setRigidBodyFlag(pxStatics._physX.PxRigidBodyFlag.eKINEMATIC, true);
                Laya.Physics3DStatInfo.addStatisticsInfo(Laya.EPhysicsStatisticsInfo.C_PhysicaKinematicRigidBody, 1);
                Laya.Physics3DStatInfo.addStatisticsInfo(Laya.EPhysicsStatisticsInfo.C_PhysicaDynamicRigidBody, -1);
            }
            else {
                this._enableProcessCollisions = true;
                if (this._isSimulate && this.inPhysicUpdateListIndex == -1)
                    this._physicsManager._dynamicUpdateList.add(this);
                this._pxActor.setRigidBodyFlag(pxStatics._physX.PxRigidBodyFlag.eKINEMATIC, false);
                this.allowSleep(this._allowSleep);
            }
        }
        allowSleep(value) {
            this._allowSleep = value;
            if (this._pxActor && !this.IsKinematic) {
                this._pxActor.setSleepThreshold(value ? this._sleepThreshold : 0);
                this._pxActor.setWakeCounter(value ? 0.4 : 3.402823466e38);
            }
        }
        setGravity(value) {
            if (!this._gravity)
                this._gravity = new Laya.Vector3();
            value.cloneTo(this._gravity);
            if (this._pxActor) {
                this.setActorFlag(exports.pxActorFlag.eDISABLE_GRAVITY, true);
                if (!this.IsKinematic)
                    this.wakeUp();
            }
        }
        _applyGravity(deltaTime) {
            if (this._gravity && !this.IsKinematic && !this._pxActor.isSleeping()) {
                if (this._gravity.x || this._gravity.y || this._gravity.z) {
                    const velocity = this._pxActor.getLinearVelocity();
                    velocity.x += this._gravity.x * deltaTime;
                    velocity.y += this._gravity.y * deltaTime;
                    velocity.z += this._gravity.z * deltaTime;
                    this._pxActor.setLinearVelocity(velocity, false);
                }
            }
        }
        setConstraints(linearFactor, angularFactor) {
            let constrainFlag = exports.DynamicColliderConstraints.None;
            linearFactor.x == 0 && (constrainFlag |= exports.DynamicColliderConstraints.FreezePositionX);
            linearFactor.y == 0 && (constrainFlag |= exports.DynamicColliderConstraints.FreezePositionY);
            linearFactor.z == 0 && (constrainFlag |= exports.DynamicColliderConstraints.FreezePositionZ);
            angularFactor.x == 0 && (constrainFlag |= exports.DynamicColliderConstraints.FreezeRotationX);
            angularFactor.y == 0 && (constrainFlag |= exports.DynamicColliderConstraints.FreezeRotationY);
            angularFactor.z == 0 && (constrainFlag |= exports.DynamicColliderConstraints.FreezeRotationZ);
            this._pxActor.setRigidDynamicLockFlags(constrainFlag);
        }
        addForce(force, mode, localOffset) {
            const nativeMode = mode === Laya.PhysicsForceMode.Impulse
                ? pxStatics._physX.PxForceMode.eIMPULSE.value : pxStatics._physX.PxForceMode.eFORCE.value;
            if (localOffset)
                this._pxActor.addForceAtLocalPosWithMode(force, localOffset, nativeMode);
            else
                this._pxActor.addForceWithMode(force, nativeMode);
        }
        addTorque(torque, mode) {
            if (mode === Laya.PhysicsForceMode.Impulse)
                this._pxActor.addTorqueImpulse(torque);
            else
                this._pxActor.addTorque(torque);
        }
        sleep() {
            return this._pxActor.putToSleep();
        }
        wakeUp() {
            return this._pxActor.wakeUp();
        }
        move(positionOrRotation, rotation) {
            if (rotation) {
                this._pxActor.setKinematicTarget(positionOrRotation, rotation);
                return;
            }
            this.getWorldTransform();
            if (positionOrRotation instanceof Laya.Vector3) {
                this._pxActor.setKinematicTarget(positionOrRotation, _tempRotation);
            }
            else {
                this._pxActor.setKinematicTarget(_tempTranslation, positionOrRotation);
            }
        }
        destroy() {
            if (this._destroyed)
                return;
            if (this.IsKinematic) {
                Laya.Physics3DStatInfo.addStatisticsInfo(Laya.EPhysicsStatisticsInfo.C_PhysicaKinematicRigidBody, -1);
            }
            else {
                Laya.Physics3DStatInfo.addStatisticsInfo(Laya.EPhysicsStatisticsInfo.C_PhysicaDynamicRigidBody, -1);
            }
            super.destroy();
        }
    }
    const _tempRotation = new Laya.Quaternion();
    const _tempTranslation = new Laya.Vector3();

    class pxStaticCollider extends pxCollider {
        static getStaticColliderCapable(value) {
            return pxStaticCollider._staticCapableMap.get(value);
        }
        static initCapable() {
            this._staticCapableMap = new Map();
            this._staticCapableMap.set(Laya.EColliderCapable.Collider_AllowTrigger, true);
            this._staticCapableMap.set(Laya.EColliderCapable.Collider_CollisionGroup, true);
            this._staticCapableMap.set(Laya.EColliderCapable.Collider_Friction, false);
            this._staticCapableMap.set(Laya.EColliderCapable.Collider_Restitution, true);
            this._staticCapableMap.set(Laya.EColliderCapable.Collider_RollingFriction, false);
            this._staticCapableMap.set(Laya.EColliderCapable.Collider_DynamicFriction, true);
            this._staticCapableMap.set(Laya.EColliderCapable.Collider_StaticFriction, true);
            this._staticCapableMap.set(Laya.EColliderCapable.Collider_BounceCombine, true);
            this._staticCapableMap.set(Laya.EColliderCapable.Collider_FrictionCombine, true);
            this._staticCapableMap.set(Laya.EColliderCapable.Collider_EventFilter, true);
            this._staticCapableMap.set(Laya.EColliderCapable.Collider_CollisionDetectionMode, true);
            this._staticCapableMap.set(Laya.EColliderCapable.RigidBody_AllowSleep, true);
        }
        constructor(manager) {
            super(manager);
            Laya.Physics3DStatInfo.addStatisticsInfo(Laya.EPhysicsStatisticsInfo.C_PhysicaStaticRigidBody, 1);
        }
        getCapable(value) {
            return pxStaticCollider.getStaticColliderCapable(value);
        }
        _initCollider() {
            this._pxActor = pxStatics._physics.createRigidStatic(this._transformTo(new Laya.Vector3(), new Laya.Quaternion()));
        }
        setTrigger(value) {
            this._isTrigger = value;
            this._shape && this._shape.setIsTrigger(value);
        }
        _initColliderShapeByCollider() {
            super._initColliderShapeByCollider();
            this.setWorldTransform(true);
            this.setTrigger(this._isTrigger);
        }
        destroy() {
            if (this._destroyed)
                return;
            Laya.Physics3DStatInfo.addStatisticsInfo(Laya.EPhysicsStatisticsInfo.C_PhysicaStaticRigidBody, -1);
            super.destroy();
        }
    }

    exports.PxConstraintFlag = void 0;
    (function (PxConstraintFlag) {
        PxConstraintFlag[PxConstraintFlag["eBROKEN"] = 1] = "eBROKEN";
        PxConstraintFlag[PxConstraintFlag["ePROJECT_TO_ACTOR0"] = 2] = "ePROJECT_TO_ACTOR0";
        PxConstraintFlag[PxConstraintFlag["ePROJECT_TO_ACTOR1"] = 4] = "ePROJECT_TO_ACTOR1";
        PxConstraintFlag[PxConstraintFlag["ePROJECTION"] = 6] = "ePROJECTION";
        PxConstraintFlag[PxConstraintFlag["eCOLLISION_ENABLED"] = 8] = "eCOLLISION_ENABLED";
        PxConstraintFlag[PxConstraintFlag["eVISUALIZATION"] = 16] = "eVISUALIZATION";
        PxConstraintFlag[PxConstraintFlag["eDRIVE_LIMITS_ARE_FORCES"] = 32] = "eDRIVE_LIMITS_ARE_FORCES";
        PxConstraintFlag[PxConstraintFlag["eIMPROVED_SLERP"] = 128] = "eIMPROVED_SLERP";
        PxConstraintFlag[PxConstraintFlag["eDISABLE_PREPROCESSING"] = 256] = "eDISABLE_PREPROCESSING";
        PxConstraintFlag[PxConstraintFlag["eENABLE_EXTENDED_LIMITS"] = 512] = "eENABLE_EXTENDED_LIMITS";
        PxConstraintFlag[PxConstraintFlag["eGPU_COMPATIBLE"] = 1024] = "eGPU_COMPATIBLE";
        PxConstraintFlag[PxConstraintFlag["eALWAYS_UPDATE"] = 2048] = "eALWAYS_UPDATE";
        PxConstraintFlag[PxConstraintFlag["eDISABLE_CONSTRAINT"] = 4096] = "eDISABLE_CONSTRAINT";
    })(exports.PxConstraintFlag || (exports.PxConstraintFlag = {}));
    class pxJoint {
        constructor(manager) {
            this._breakForce = Number.MAX_VALUE;
            this._breakTorque = Number.MAX_VALUE;
            this._destroyed = false;
            this._physicsManager = manager;
            this._id = pxJoint._pxJointID++;
            this._localPos = new Laya.Vector3();
            this._connectlocalPos = new Laya.Vector3();
            this._linearForce = new Laya.Vector3();
            this._angularForce = new Laya.Vector3();
            Laya.Physics3DStatInfo.addStatisticsInfo(Laya.EPhysicsStatisticsInfo.C_PhysicsJoint, 1);
        }
        isEnable(value) {
            this._pxJoint && this._pxJoint.setConstraintFlag(exports.PxConstraintFlag.eDISABLE_CONSTRAINT, !value);
        }
        isCollision(value) {
            this._pxJoint && this._pxJoint.setConstraintFlag(exports.PxConstraintFlag.eCOLLISION_ENABLED, value);
        }
        isPreprocessiong(value) {
            this._pxJoint && this._pxJoint.setConstraintFlag(exports.PxConstraintFlag.eDISABLE_PREPROCESSING, value);
        }
        _createJoint() {
        }
        destroy() {
            if (this._destroyed)
                return;
            this._destroyed = true;
            const joint = this._pxJoint;
            this._pxJoint = null;
            if (joint)
                joint.release();
            pxJoint._ActorPool.delete(this._id);
            this._collider = this._connectCollider = null;
            Laya.Physics3DStatInfo.addStatisticsInfo(Laya.EPhysicsStatisticsInfo.C_PhysicsJoint, -1);
        }
        setOwner(value) {
            this.owner = value;
            pxJoint._ActorPool.set(this._id, this);
            this._collider && this._connectCollider && this._createJoint();
        }
        _setActor() {
            if (this._pxJoint) {
                this._pxJoint.setActors(this._collider._pxActor || null, this._connectCollider._pxActor || null);
            }
            else {
                this._collider && this._connectCollider && this._createJoint();
            }
        }
        setCollider(owner) {
            if (owner == this._collider)
                return;
            this._collider = owner;
            this._setActor();
        }
        setConnectedCollider(owner) {
            if (owner == this._connectCollider)
                return;
            this._connectCollider = owner;
            this._setActor();
        }
        _setLocalPose(actor, position) {
            this._pxJoint && this._pxJoint.setLocalPose(actor, position, Laya.Quaternion.DEFAULT);
        }
        setLocalPos(value) {
            value && value.cloneTo(this._localPos);
            this._pxJoint && this._setLocalPose(0, this._localPos);
        }
        setConnectLocalPos(value) {
            value && value.cloneTo(this._connectlocalPos);
            this._setLocalPose(1, this._connectlocalPos);
        }
        setConnectedMassScale(value) {
            this._pxJoint && this._pxJoint.setInvMassScale0(1 / value);
        }
        setConnectedInertiaScale(value) {
            this._pxJoint && this._pxJoint.setInvInertiaScale0(1 / value);
        }
        setMassScale(value) {
            this._pxJoint && this._pxJoint.setInvMassScale1(1 / value);
        }
        setInertiaScale(value) {
            this._pxJoint && this._pxJoint.setInvInertiaScale1(1 / value);
        }
        setBreakForce(value) {
            this._breakForce = value;
            this._pxJoint && this._pxJoint.setBreakForce(this._breakForce, this._breakTorque);
        }
        setBreakTorque(value) {
            this._breakTorque = value;
            this._pxJoint && this._pxJoint.setBreakForce(this._breakForce, this._breakTorque);
        }
        getlinearForce() {
            const v3 = this._pxJoint.getlinearForce();
            this._linearForce.set(v3.x, v3.y, v3.z);
            return this._linearForce;
        }
        getAngularForce() {
            const v3 = this._pxJoint.getAngularForce();
            this._linearForce.set(v3.x, v3.y, v3.z);
            return this._linearForce;
        }
        isValid() {
            return this._pxJoint.isValid();
        }
        release() {
            if (this._pxJoint) {
                this._pxJoint.release();
                this._pxJoint = null;
            }
        }
    }
    pxJoint._ActorPool = new Map();
    pxJoint._pxJointID = 0;
    pxJoint._tempTransform0 = { translation: new Laya.Vector3(), rotation: new Laya.Quaternion() };
    pxJoint._tempTransform1 = { translation: new Laya.Vector3(), rotation: new Laya.Quaternion() };

    class pxFixedJoint extends pxJoint {
        _createJoint() {
            const transform = pxJoint._tempTransform0;
            this._localPos.cloneTo(transform.translation);
            const transform1 = pxJoint._tempTransform1;
            this._connectlocalPos.cloneTo(transform1.translation);
            this._pxJoint = pxStatics._physics.createFixedJoint(this._collider._pxActor, transform.translation, transform.rotation, this._connectCollider._pxActor, transform1.translation, transform1.rotation);
            this._pxJoint.setUUID(this._id);
        }
        destroy() {
            super.destroy();
        }
    }

    exports.PxD6JointDriveFlag = void 0;
    (function (PxD6JointDriveFlag) {
        PxD6JointDriveFlag[PxD6JointDriveFlag["eACCELERATION"] = 1] = "eACCELERATION";
    })(exports.PxD6JointDriveFlag || (exports.PxD6JointDriveFlag = {}));
    class pxD6Joint extends pxJoint {
        constructor() {
            super(...arguments);
            this._axis = new Laya.Vector3(1, 0, 0);
            this._SecondaryAxis = new Laya.Vector3(0, 1, 0);
            this._axisRotationQuaternion = new Laya.Quaternion();
        }
        _createJoint() {
            const transform = pxJoint._tempTransform0;
            this._localPos.cloneTo(transform.translation);
            const transform1 = pxJoint._tempTransform1;
            this._connectlocalPos.cloneTo(transform1.translation);
            this._pxJoint = pxStatics._physics.createD6Joint(this._collider._pxActor, transform.translation, transform.rotation, this._connectCollider._pxActor, transform1.translation, transform1.rotation);
            this._initAllConstrainInfo();
            this._pxJoint.setUUID(this._id);
        }
        _initAllConstrainInfo() {
            this.setAxis(this._axis, this._SecondaryAxis);
            this.setMotion(Laya.D6Axis.eFREE, Laya.D6MotionType.eX);
            this.setMotion(Laya.D6Axis.eFREE, Laya.D6MotionType.eY);
            this.setMotion(Laya.D6Axis.eFREE, Laya.D6MotionType.eZ);
            this.setMotion(Laya.D6Axis.eFREE, Laya.D6MotionType.eTWIST);
            this.setMotion(Laya.D6Axis.eFREE, Laya.D6MotionType.eSWING1);
            this.setMotion(Laya.D6Axis.eFREE, Laya.D6MotionType.eSWING2);
        }
        _setLocalPose(actor, position) {
            this._pxJoint && this._pxJoint.setLocalPose(actor, position, this._axisRotationQuaternion);
        }
        setAxis(axis, secendary) {
            this._axis = axis;
            this._SecondaryAxis = secendary;
            const xAxis = pxD6Joint.tempV3;
            const axisRotationQuaternion = this._axisRotationQuaternion;
            xAxis.set(1, 0, 0);
            axis = axis.normalize();
            const angle = Math.acos(Laya.Vector3.dot(xAxis, axis));
            Laya.Vector3.cross(xAxis, axis, xAxis);
            Laya.Quaternion.rotationAxisAngle(xAxis, angle, axisRotationQuaternion);
            this._setLocalPose(0, this._localPos);
        }
        setMotion(axis, motionType) {
            this._pxJoint && this._pxJoint.setMotion(motionType, axis);
        }
        setDistanceLimit(limit, bounceness, bounceThreshold, spring, damp) {
            this._pxJoint && this._pxJoint.setDistanceLimit(limit, bounceness, bounceThreshold, spring, damp);
        }
        setLinearLimit(linearAxis, upper, lower, bounceness, bounceThreshold, spring, damping) {
            this._pxJoint && this._pxJoint.setLinearLimit(linearAxis, lower, upper, bounceness, bounceThreshold, spring, damping);
        }
        setTwistLimit(upper, lower, bounceness, bounceThreshold, spring, damping) {
            this._pxJoint && this._pxJoint.setTwistLimit(lower, upper, bounceness, bounceThreshold, spring, damping);
        }
        setSwingLimit(yAngle, zAngle, bounceness, bounceThreshold, spring, damping) {
            this._pxJoint && this._pxJoint.setSwingLimit(yAngle, zAngle, bounceness, bounceThreshold, spring, damping);
        }
        setDrive(index, stiffness, damping, forceLimit) {
            let acceleration = exports.PxD6JointDriveFlag.eACCELERATION;
            this._pxJoint && this._pxJoint.setDrive(index, stiffness, damping, forceLimit, acceleration);
        }
        setDriveTransform(position, rotate) {
            this._pxJoint && this._pxJoint.setDrivePosition(position, rotate);
        }
        setDriveVelocity(position, angular) {
            this._pxJoint && this._pxJoint.setDriveVelocity(position, angular);
        }
        getTwistAngle() {
            return this._pxJoint.getTwistAngle();
        }
        getSwingYAngle() {
            return this._pxJoint.getSwingYAngle();
        }
        getSwingZAngle() {
            return this._pxJoint.getSwingZAngle();
        }
        destroy() {
            super.destroy();
        }
    }
    pxD6Joint.tempV3 = new Laya.Vector3();

    class pxDistanceJoint extends pxJoint {
        _createJoint() {
            const transform = pxJoint._tempTransform0;
            this._localPos.cloneTo(transform.translation);
            const transform1 = pxJoint._tempTransform1;
            this._connectlocalPos.cloneTo(transform1.translation);
            this._pxJoint = pxStatics._physics.createDistanceJoint(this._collider._pxActor, transform.translation, transform.rotation, this._connectCollider._pxActor, transform1.translation, transform1.rotation);
            this._pxJoint.setUUID(this._id);
            this._pxJoint.setDistanceJointFlag(2, true);
            this._pxJoint.setDistanceJointFlag(4, true);
            this._pxJoint.setDistanceJointFlag(8, true);
        }
        setMinDistance(distance) {
            this._pxJoint && this._pxJoint.setMinDistance(distance);
        }
        setMaxDistance(distance) {
            this._pxJoint && this._pxJoint.setMaxDistance(distance);
        }
        setConnectDistance(distance) {
            this._pxJoint && this._pxJoint.setConnectDistance(distance);
        }
        setTolerance(tolerance) {
            this._pxJoint && this._pxJoint.setTolerance(tolerance);
        }
        setStiffness(stiffness) {
            this._pxJoint && this._pxJoint.setStiffness(stiffness);
        }
        setDamping(damping) {
            this._pxJoint && this._pxJoint.setDamping(damping);
        }
        destroy() {
            super.destroy();
        }
    }

    exports.PxRevoluteJointFlag = void 0;
    (function (PxRevoluteJointFlag) {
        PxRevoluteJointFlag[PxRevoluteJointFlag["eLIMIT_ENABLED"] = 1] = "eLIMIT_ENABLED";
        PxRevoluteJointFlag[PxRevoluteJointFlag["eDRIVE_ENABLED"] = 2] = "eDRIVE_ENABLED";
        PxRevoluteJointFlag[PxRevoluteJointFlag["eDRIVE_FREESPIN"] = 4] = "eDRIVE_FREESPIN";
    })(exports.PxRevoluteJointFlag || (exports.PxRevoluteJointFlag = {}));
    class pxRevoluteJoint extends pxJoint {
        constructor() {
            super(...arguments);
            this._axisRotationQuaternion = new Laya.Quaternion();
            this._velocity = new Laya.Vector3();
            this._lowerLimit = -Math.PI / 2;
            this._uperLimit = Math.PI / 2;
            this._bouncenciness = 0;
            this._bouncenMinVelocity = 0;
            this._contactDistance = 0;
            this._enableLimit = false;
        }
        _createJoint() {
            const transform = pxJoint._tempTransform0;
            this._localPos.cloneTo(transform.translation);
            const transform1 = pxJoint._tempTransform1;
            this._connectlocalPos.cloneTo(transform1.translation);
            this._pxJoint = pxStatics._physics.createRevoluteJoint(this._collider._pxActor, transform.translation, transform.rotation, this._connectCollider._pxActor, transform1.translation, transform1.rotation);
            this._pxJoint.setUUID(this._id);
        }
        _setLocalPose(actor, position) {
            this._pxJoint && this._pxJoint.setLocalPose(actor, position, this._axisRotationQuaternion);
        }
        _setRevoluteJointFlag(flag, value) {
            this._pxJoint && this._pxJoint.setRevoluteJointFlag(flag, value);
        }
        _setLimit() {
            this._enableLimit && this._pxJoint && this._pxJoint.setHardLimit(this._lowerLimit, this._uperLimit, this._contactDistance);
        }
        setLowerLimit(lowerLimit) {
            if (this._lowerLimit == lowerLimit)
                return;
            this._lowerLimit = lowerLimit;
            this._setLimit();
        }
        setUpLimit(value) {
            if (this._uperLimit == value)
                return;
            this._uperLimit = value;
            this._setLimit();
        }
        setBounceness(value) {
            if (this._bouncenciness == value)
                return;
            this._bouncenciness = value;
            this._setLimit();
        }
        setBouncenMinVelocity(value) {
            if (this._bouncenMinVelocity == value)
                return;
            this._bouncenMinVelocity = value;
            this._setLimit();
        }
        setContactDistance(value) {
            if (this._contactDistance == value)
                return;
            this._contactDistance = value;
            this._setLimit();
        }
        enableLimit(value) {
            this._enableLimit = value;
            this._setRevoluteJointFlag(exports.PxRevoluteJointFlag.eLIMIT_ENABLED, value);
            if (this._enableLimit)
                this._setLimit();
        }
        enableDrive(value) {
            this._setRevoluteJointFlag(exports.PxRevoluteJointFlag.eDRIVE_ENABLED, value);
        }
        enableFreeSpin(value) {
            this._setRevoluteJointFlag(exports.PxRevoluteJointFlag.eDRIVE_FREESPIN, value);
        }
        setAxis(value) {
            const length = value.length();
            if (!(length > 0) || !Number.isFinite(length))
                return;
            const x = value.x / length, y = value.y / length, z = value.z / length;
            const rotation = this._axisRotationQuaternion;
            if (x < -1 + 1e-12)
                rotation.setValue(0, 1, 0, 0);
            else {
                rotation.setValue(0, -z, y, 1 + x);
                rotation.normalize(rotation);
            }
            this._setLocalPose(0, this._localPos);
            this._setLocalPose(1, this._connectlocalPos);
        }
        getAngle() {
            return this._pxJoint.getAngle();
        }
        getVelocity() {
            const velocity = this._velocity;
            const getVel = this._pxJoint.getVelocity();
            velocity.set(getVel.x, getVel.y, getVel.z);
            return velocity;
        }
        setDriveVelocity(velocity) {
            this._pxJoint && this._pxJoint.setDriveVelocity(velocity, true);
        }
        setDriveForceLimit(limit) {
            this._pxJoint && this._pxJoint.setDriveForceLimit(limit);
        }
        destroy() {
            super.destroy();
        }
    }
    pxRevoluteJoint._xAxis = new Laya.Vector3(1, 0, 0);

    class pxSphereJoint extends pxJoint {
    }

    class pxBoxColliderShape extends pxColliderShape {
        constructor() {
            super();
            this._size = new Laya.Vector3(0.5, 0.5, 0.5);
            this._pxGeometry = new pxStatics._physX.PxBoxGeometry(this._size.x / 2, this._size.y / 2, this._size.z / 2);
            this._createShape();
        }
        setSize(size) {
            const tempExtents = pxBoxColliderShape._tempHalfExtents;
            size.cloneTo(this._size);
            tempExtents.setValue(this._size.x * 0.5 * this._scale.x, this._size.y * 0.5 * this._scale.y, this._size.z * 0.5 * this._scale.z);
            this._pxGeometry.halfExtents = tempExtents;
            this._pxShape && this._pxShape.setGeometry(this._pxGeometry);
        }
        setOffset(position) {
            super.setOffset(position);
            this.setSize(this._size);
        }
        destroy() {
            super.destroy();
            this._size = null;
        }
    }
    pxBoxColliderShape._tempHalfExtents = new Laya.Vector3();

    class pxCompoundColliderShape extends pxColliderShape {
        constructor() {
            super(...arguments);
            this._isTrigger = false;
            this._collisionGroup = Laya.Physics3DUtils.PHYSXDEFAULTMASKVALUE;
            this._collisionMask = Laya.Physics3DUtils.PHYSXDEFAULTMASKVALUE;
            this._eventFilterData = exports.partFlag.eCONTACT_DEFAULT;
            this._bounciness = 0.1;
            this._dynamicFriction = 0.1;
            this._staticFriction = 0.1;
            this._bounceCombine = Laya.PhysicsCombineMode.Average;
            this._frictionCombine = Laya.PhysicsCombineMode.Average;
            this._children = [];
        }
        addChildShape(shape) {
            this.addChildShapeWithTransform(shape, shape.getOffset(), Laya.Quaternion.DEFAULT, Laya.Vector3.ONE);
        }
        addChildShapeWithTransform(shape, localPosition, localRotation, localScale) {
            const child = {
                shape,
                position: localPosition.clone(),
                rotation: localRotation.clone(),
                scale: localScale.clone()
            };
            this._children.push(child);
            this._applyChildTransform(child);
            this._applyShapeData(shape);
            this._pxCollider && shape.addToActor(this._pxCollider);
        }
        removeChildShape(shape, index) {
            if (index < 0 || index >= this._children.length)
                return;
            const child = this._children[index];
            if (child.shape !== shape)
                return;
            this._children.splice(index, 1);
            this._pxCollider && child.shape.removeFromActor(this._pxCollider);
        }
        refreshMassProperties(mass) {
            var _a;
            if (((_a = this._pxCollider) === null || _a === void 0 ? void 0 : _a._shape) === this)
                this._pxCollider.setMass(mass);
        }
        addToActor(collider) {
            if (this._pxCollider === collider)
                return;
            if (this._pxCollider)
                this.removeFromActor(this._pxCollider);
            this._pxCollider = collider;
            this._children.forEach(child => {
                this._applyChildTransform(child);
                child.shape.addToActor(collider);
            });
        }
        removeFromActor(collider) {
            if (this._pxCollider !== collider)
                return;
            this._children.forEach(child => child.shape.removeFromActor(collider));
            this._pxCollider = null;
        }
        setOffset(position) {
            position.cloneTo(this._offset);
            this._children.forEach(child => this._applyChildTransform(child));
        }
        setIsTrigger(value) {
            this._isTrigger = value;
            this._children.forEach(child => child.shape.setIsTrigger(value));
        }
        setSimulationFilterData(colliderGroup, colliderMask) {
            this._collisionGroup = colliderGroup;
            this._collisionMask = colliderMask;
            this._children.forEach(child => {
                child.shape.setSimulationFilterData(colliderGroup, colliderMask);
                child.shape.setEventFilterData(this._eventFilterData);
            });
        }
        setEventFilterData(filterWorld2Number) {
            this._eventFilterData = filterWorld2Number;
            this._children.forEach(child => child.shape.setEventFilterData(filterWorld2Number));
        }
        setBounciness(value) {
            this._bounciness = value;
            this._children.forEach(child => child.shape.setBounciness(value));
        }
        setDynamicFriction(value) {
            this._dynamicFriction = value;
            this._children.forEach(child => child.shape.setDynamicFriction(value));
        }
        setStaticFriction(value) {
            this._staticFriction = value;
            this._children.forEach(child => child.shape.setStaticFriction(value));
        }
        setFrictionCombine(value) {
            this._frictionCombine = value;
            this._children.forEach(child => child.shape.setFrictionCombine(value));
        }
        setBounceCombine(value) {
            this._bounceCombine = value;
            this._children.forEach(child => child.shape.setBounceCombine(value));
        }
        destroy() {
            if (this._destroyed)
                return;
            if (this._pxCollider)
                this.removeFromActor(this._pxCollider);
            this._children.length = 0;
            this._destroyed = true;
        }
        _applyChildTransform(child) {
            const position = new Laya.Vector3();
            Laya.Vector3.add(this._offset, child.position, position);
            child.shape.setCompoundTransform(position, child.rotation, child.scale);
        }
        _applyShapeData(shape) {
            shape.setIsTrigger(this._isTrigger);
            shape.setSimulationFilterData(this._collisionGroup, this._collisionMask);
            shape.setEventFilterData(this._eventFilterData);
            shape.setBounciness(this._bounciness);
            shape.setDynamicFriction(this._dynamicFriction);
            shape.setStaticFriction(this._staticFriction);
            shape.setFrictionCombine(this._frictionCombine);
            shape.setBounceCombine(this._bounceCombine);
        }
    }

    exports.PxConvexFlag = void 0;
    (function (PxConvexFlag) {
        PxConvexFlag[PxConvexFlag["e16_BIT_INDICES"] = 1] = "e16_BIT_INDICES";
        PxConvexFlag[PxConvexFlag["eCOMPUTE_CONVEX"] = 2] = "eCOMPUTE_CONVEX";
        PxConvexFlag[PxConvexFlag["eCHECK_ZERO_AREA_TRIANGLES"] = 4] = "eCHECK_ZERO_AREA_TRIANGLES";
        PxConvexFlag[PxConvexFlag["eQUANTIZE_INPUT"] = 8] = "eQUANTIZE_INPUT";
        PxConvexFlag[PxConvexFlag["eDISABLE_MESH_VALIDATION"] = 16] = "eDISABLE_MESH_VALIDATION";
        PxConvexFlag[PxConvexFlag["ePLANE_SHIFTING"] = 32] = "ePLANE_SHIFTING";
        PxConvexFlag[PxConvexFlag["eFAST_INERTIA_COMPUTATION"] = 64] = "eFAST_INERTIA_COMPUTATION";
        PxConvexFlag[PxConvexFlag["eGPU_COMPATIBLE"] = 128] = "eGPU_COMPATIBLE";
        PxConvexFlag[PxConvexFlag["eSHIFT_VERTICES"] = 256] = "eSHIFT_VERTICES";
    })(exports.PxConvexFlag || (exports.PxConvexFlag = {}));
    exports.PxConvexMeshGeometryFlag = void 0;
    (function (PxConvexMeshGeometryFlag) {
        PxConvexMeshGeometryFlag[PxConvexMeshGeometryFlag["eTIGHT_BOUNDS"] = 1] = "eTIGHT_BOUNDS";
    })(exports.PxConvexMeshGeometryFlag || (exports.PxConvexMeshGeometryFlag = {}));
    exports.PxMeshGeometryFlag = void 0;
    (function (PxMeshGeometryFlag) {
        PxMeshGeometryFlag[PxMeshGeometryFlag["eTIGHT_BOUNDS"] = 1] = "eTIGHT_BOUNDS";
        PxMeshGeometryFlag[PxMeshGeometryFlag["eDOUBLE_SIDED"] = 2] = "eDOUBLE_SIDED";
    })(exports.PxMeshGeometryFlag || (exports.PxMeshGeometryFlag = {}));
    class pxMeshColliderShape extends pxColliderShape {
        constructor() {
            super();
            this._limitvertex = 255;
            this._appliedScale = new Laya.Vector3(-1, -1, -1);
            this._compoundLocalRotation = new Laya.Quaternion();
            this._convex = false;
            this._meshScale = new pxStatics._physX.PxMeshScale(Laya.Vector3.ONE, Laya.Quaternion.DEFAULT);
            this._id = pxColliderShape._pxShapeID++;
            this._pxMaterials[0] = new pxPhysicsMaterial();
        }
        _getMeshPosition() {
            let posArray = new Array();
            this._mesh.getPositions(posArray);
            if (this._convex && posArray.length > this._limitvertex) {
                console.warn("MeshColliderShape: The number of vertices exceeds the limit, please reduce the number of vertices.");
            }
            let vecpointer = new pxStatics._physX.PxVec3Vector();
            posArray.forEach((vec, index) => {
                vecpointer.push_back(vec);
            });
            return vecpointer;
        }
        _getIndices() {
            let indexCount = this._mesh.indexCount;
            let indices = this._mesh.getIndices();
            let traCount = indexCount / 3;
            let data = null;
            if (indices instanceof Uint32Array) {
                data = pxStatics.createUint32Array(indexCount);
            }
            else {
                data = pxStatics.createUint16Array(indexCount);
            }
            for (var i = 0; i < traCount; i++) {
                let index = i * 3;
                data.buffer[index] = indices[index];
                data.buffer[index + 1] = indices[index + 2];
                data.buffer[index + 2] = indices[index + 1];
            }
            return data;
        }
        _createConvexMeshGeometry() {
            if (!this._mesh)
                return;
            if (!this._mesh._convexMesh) {
                let vecpointer = this._getMeshPosition();
                this._mesh._convexMesh = pxStatics._physX.createConvexMeshFromBuffer(vecpointer, pxStatics._physics, this._limitvertex, pxStatics._tolerancesScale, exports.PxConvexFlag.eCOMPUTE_CONVEX);
                vecpointer.delete();
            }
            let flags = new pxStatics._physX.PxConvexMeshGeometryFlags(exports.PxConvexMeshGeometryFlag.eTIGHT_BOUNDS);
            this._pxGeometry = new pxStatics._physX.PxConvexMeshGeometry(this._mesh._convexMesh, this._meshScale, flags);
            if (this._pxShape && this._pxCollider)
                this._pxCollider._pxActor.detachShape(this._pxShape, true);
            else if (this._pxShape) {
                this._pxShape.release();
            }
            this._createShape();
        }
        _createTrianggleMeshGeometry() {
            if (!this._mesh)
                return;
            if (!this._mesh._triangleMesh) {
                let vecpointer = this._getMeshPosition();
                let indicesData = this._getIndices();
                this._mesh._triangleMesh = pxStatics._physX.createTriMesh(vecpointer, indicesData.ptr, this._mesh.indexCount, this._mesh.indexFormat == Laya.IndexFormat.UInt32 ? false : true, pxStatics._tolerancesScale, pxStatics._physics);
                vecpointer.delete();
                pxStatics.freeBuffer(indicesData);
            }
            let flags = new pxStatics._physX.PxMeshGeometryFlags(exports.PxMeshGeometryFlag.eTIGHT_BOUNDS);
            this._pxGeometry = new pxStatics._physX.PxTriangleMeshGeometry(this._mesh._triangleMesh, this._meshScale, flags);
            if (this._pxShape && this._pxCollider)
                this._pxCollider._pxActor.detachShape(this._pxShape, true);
            else if (this._pxShape) {
                this._pxShape.release();
            }
            this._createShape();
        }
        _createShape() {
            if (this._id == null) {
                this._id = pxColliderShape._pxShapeID++;
            }
            if (!this._pxMaterials[0]) {
                this._pxMaterials[0] = new pxPhysicsMaterial();
            }
            this._pxShape = pxStatics._physics.createShape(this._pxGeometry, this._pxMaterials[0]._pxMaterial, true, new pxStatics._physX.PxShapeFlags(this._shapeFlags));
            this._pxShape.setUUID(this._id);
            pxColliderShape._shapePool.set(this._id, this);
            this._reConfigShape();
        }
        _reConfigShape() {
            if (this._pxCollider) {
                const eventFilterData = this.filterData.word2;
                this.setSimulationFilterData(this._pxCollider._collisionGroup, this._pxCollider._canCollisionWith);
                this.setEventFilterData(eventFilterData);
                this.setOffset(this._offset);
                this._pxCollider._pxActor.attachShape(this._pxShape);
            }
        }
        _setScale(scale) {
            if (this._pxShape && scale.equal(this._appliedScale))
                return;
            scale.cloneTo(this._scale);
            scale.cloneTo(this._appliedScale);
            this._meshScale.scale = this._scale;
            if (this._convex)
                this._createConvexMeshGeometry();
            else
                this._createTrianggleMeshGeometry();
        }
        setCompoundTransform(position, rotation, scale) {
            rotation.cloneTo(this._compoundLocalRotation);
            super.setCompoundTransform(position, rotation, scale);
        }
        _setLocalPose() {
            if (!this._pxCollider || !this._pxShape)
                return;
            const transform = pxMeshColliderShape._compoundTransform;
            const ownerScale = this._pxCollider.owner.transform.getWorldLossyScale();
            Laya.Vector3.multiply(ownerScale, this._compoundLocalScale, this._scale);
            Laya.Vector3.multiply(this._offset, ownerScale, transform.translation);
            this._compoundLocalRotation.cloneTo(transform.rotation);
            this._pxShape.setLocalPose(transform);
        }
        setOffset(position) {
            super.setOffset(position);
            if (this._pxCollider)
                this._setScale(this._scale);
        }
        setPhysicsMeshFromMesh(value) {
            this._mesh = value;
            this._convex = false;
            this._createTrianggleMeshGeometry();
        }
        setConvexMesh(value) {
            this._mesh = value;
            this._convex = true;
            this._createConvexMeshGeometry();
        }
        setLimitVertex(limit) {
            this._limitvertex = limit;
            if (this._convex)
                this._createConvexMeshGeometry();
        }
    }
    pxMeshColliderShape._compoundTransform = {
        translation: new Laya.Vector3(),
        rotation: new Laya.Quaternion()
    };

    class pxHeightFieldShape extends pxColliderShape {
        constructor() {
            super();
            this._numRows = 2;
            this._numCols = 2;
            this._terrainYScale = 1;
            this._heightOffset = new Laya.Vector3();
        }
        getHeightData() {
            this._minHeight = Number.MAX_VALUE;
            this._maxHeight = -Number.MAX_VALUE;
            this._heightData.forEach((value) => {
                this._maxHeight = Math.max(value, this._maxHeight);
                this._minHeight = Math.min(value, this._minHeight);
            });
            let deltaHeight = this._maxHeight - this._minHeight;
            let data = pxStatics.createFloat32Array(this._heightData.length);
            this._heightData.forEach((value, index) => {
                data.buffer[index] = deltaHeight > 0 ? (value - this._minHeight) / deltaHeight : 0;
            });
            return data;
        }
        getFlagData() {
            let indexCount = this._numRows * this._numCols;
            let data = pxStatics.createUint8Array(indexCount);
            if (this._flag) {
                data.buffer.set(this._flag);
            }
            else {
                data.buffer.fill(0);
            }
            return data;
        }
        _createHeightField() {
            let heightdata = this.getHeightData();
            let flagdata = this.getFlagData();
            this._heightFiled = pxStatics._physX.createHeightField(this._numRows, this._numCols, heightdata.ptr, flagdata.ptr, pxStatics._allocator, pxStatics._tolerancesScale, pxStatics._physics);
            let heightScale = (this._scale.y * (this._maxHeight - this._minHeight || 1)) / 32767;
            let flags = new pxStatics._physX.PxMeshGeometryFlags(exports.PxMeshGeometryFlag.eTIGHT_BOUNDS);
            this._pxGeometry = new pxStatics._physX.PxHeightFieldGeometry(this._heightFiled, flags, heightScale, this._scale.x, this._scale.z);
            this._pxShape && this._pxCollider._pxActor.detachShape(this._pxShape, true);
            this._createShape();
            pxStatics.freeBuffer(heightdata);
            pxStatics.freeBuffer(flagdata);
        }
        _setLocalPose() {
            if (!this._pxCollider || !this._pxShape)
                return;
            const transform = pxColliderShape.transform;
            const ownerScale = this._pxCollider.owner.transform.getWorldLossyScale();
            Laya.Vector3.multiply(ownerScale, this._compoundLocalScale, this._scale);
            Laya.Vector3.multiply(this._offset, ownerScale, transform.translation);
            this._compoundRotation.cloneTo(transform.rotation);
            const offset = this._heightOffset;
            offset.setValue(0, this._minHeight * this._terrainYScale * this._compoundLocalScale.y, 0);
            Laya.Vector3.transformQuat(offset, this._compoundRotation, offset);
            Laya.Vector3.multiply(offset, ownerScale, offset);
            Laya.Vector3.add(transform.translation, offset, transform.translation);
            this._pxShape.setLocalPose(transform);
        }
        setHeightFieldData(numRows, numCols, heightData, flag, scale) {
            this._numRows = numRows;
            this._numCols = numCols;
            this._heightData = heightData;
            this._flag = flag;
            this._terrainYScale = scale.y;
            scale.cloneTo(this._scale);
            this._createHeightField();
        }
        getNbRows() {
            return this._heightFiled.getNbRows();
        }
        getNbColumns() {
            return this._heightFiled.getNbColumns();
        }
        getHeight(rows, cols) {
            return this._heightFiled.getHeight(rows, cols);
        }
    }

    class pxSphereColliderShape extends pxColliderShape {
        constructor() {
            super();
            this._radius = 0.5;
            this._pxGeometry = new pxStatics._physX.PxSphereGeometry(this._radius);
            this._createShape();
        }
        setRadius(radius) {
            this._radius = radius;
            var maxScale = Math.max(this._scale.x, Math.max(this._scale.y, this._scale.z));
            this._pxGeometry.radius = this._radius * maxScale;
            this._pxShape.setGeometry(this._pxGeometry);
        }
        setOffset(position) {
            super.setOffset(position);
            this.setRadius(this._radius);
        }
        destroy() {
            super.destroy();
            this._radius = null;
        }
    }

    class pxWheelCollider {
        constructor() {
            this._centerX = 0;
            this._centerY = 0;
            this._centerZ = 0;
            this._radius = 0.4;
            this._suspensionRestLength = 0.6;
            this._maxSuspensionTravel = 0.5;
            this._springStiffness = 20000;
            this._compressionDamping = 3500;
            this._reboundDamping = 4500;
            this._maxSuspensionForce = 10000;
            this._frictionStiffness = 1;
            this._motorForce = 0;
            this._brakeForce = 0;
            this._steerAngle = 0;
            this._isGrounded = false;
            this._otherCollider = null;
            this._contactPos = new Laya.Vector3();
            this._contactNormal = new Laya.Vector3(0, 1, 0);
            this._currentSuspensionLength = 0.6;
            this._suspensionForce = 0;
            this._skidInfo = 1;
            this._rotation = 0;
            this._angularSpeed = 0;
            this._worldPosition = new Laya.Vector3();
            this._worldRotation = new Laya.Quaternion(0, 0, 0, 1);
        }
        applyConfig(desc, _chassisMass) {
            this._centerX = desc.centerX;
            this._centerY = desc.centerY;
            this._centerZ = desc.centerZ;
            this._radius = desc.radius;
            this._suspensionRestLength = desc.suspensionRestLength;
            this._maxSuspensionTravel = desc.maxSuspensionTravel;
            this._springStiffness = desc.springStiffness;
            this._compressionDamping = desc.compressionDamping;
            this._reboundDamping = desc.reboundDamping;
            this._maxSuspensionForce = desc.maxSuspensionForce;
            this._frictionStiffness = desc.frictionStiffness;
            if (!this._isGrounded) {
                this._currentSuspensionLength = desc.suspensionRestLength;
            }
        }
        readState(outState, _fixedDeltaTime) {
            outState.isContact = this._isGrounded;
            outState.otherCollider = this._otherCollider;
            this._contactPos.cloneTo(outState.contactPos);
            this._contactNormal.cloneTo(outState.contactNormal);
            outState.currentSuspensionLength = this._currentSuspensionLength;
            outState.suspensionForce = this._suspensionForce;
            outState.skidInfo = this._skidInfo;
            outState.rotation = this._rotation;
            outState.angularSpeed = this._angularSpeed;
            outState.rpm = this._angularSpeed * 60.0 / (2.0 * Math.PI);
            this._worldPosition.cloneTo(outState.worldPosition);
            this._worldRotation.cloneTo(outState.worldRotation);
        }
        resetRuntimeState() {
            this._isGrounded = false;
            this._otherCollider = null;
            this._contactPos.setValue(0, 0, 0);
            this._contactNormal.setValue(0, 1, 0);
            this._currentSuspensionLength = this._suspensionRestLength;
            this._suspensionForce = 0;
            this._skidInfo = 1;
            this._rotation = 0;
            this._angularSpeed = 0;
        }
        destroy() {
            this._otherCollider = null;
        }
    }

    function rotateVec3(qx, qy, qz, qw, vx, vy, vz, out) {
        const tx = 2 * (qy * vz - qz * vy);
        const ty = 2 * (qz * vx - qx * vz);
        const tz = 2 * (qx * vy - qy * vx);
        out.x = vx + qw * tx + (qy * tz - qz * ty);
        out.y = vy + qw * ty + (qz * tx - qx * tz);
        out.z = vz + qw * tz + (qx * ty - qy * tx);
    }
    function quatMul(aw, ax, ay, az, bw, bx, by, bz, out) {
        out.w = aw * bw - ax * bx - ay * by - az * bz;
        out.x = aw * bx + ax * bw + ay * bz - az * by;
        out.y = aw * by - ax * bz + ay * bw + az * bx;
        out.z = aw * bz + ax * by - ay * bx + az * bw;
    }
    function quatFromAxisAngle(ax, ay, az, angle, out) {
        const half = angle * 0.5;
        const sine = Math.sin(half);
        out.w = Math.cos(half);
        out.x = ax * sine;
        out.y = ay * sine;
        out.z = az * sine;
    }
    const _qA = { w: 1, x: 0, y: 0, z: 0 };
    const _qB = { w: 1, x: 0, y: 0, z: 0 };
    const _qC = { w: 1, x: 0, y: 0, z: 0 };
    const _vA = { x: 0, y: 0, z: 0 };
    const _vB = { x: 0, y: 0, z: 0 };
    const MIN_SUSPENSION_CONTACT_DOT = 0.1;
    const DEFAULT_ROLL_INFLUENCE = 0.1;
    const IDLE_SPEED_SQUARED = 0.02 * 0.02;
    const IDLE_SLEEP_DELAY = 1;
    class pxVehicle {
        constructor(_physicsManager, desc) {
            this._physicsManager = _physicsManager;
            this._wheels = [];
            this._enabled = false;
            this._destroyed = false;
            this._wakeRequested = false;
            this._idleTime = 0;
            this._chassisActorID = -1;
            this._chassisMass = 1;
            this._fixedDeltaTime = 1 / 60;
            this._rayOrigin = { x: 0, y: 0, z: 0 };
            this._rayDirection = { x: 0, y: -1, z: 0 };
            this._force = { x: 0, y: 0, z: 0 };
            this._localPosition = { x: 0, y: 0, z: 0 };
            this._torque = { x: 0, y: 0, z: 0 };
            this._vehicleBody = desc.chassis;
            this._chassisActorID = this._vehicleBody._id;
            this._chassisMass = desc.chassisMass;
            for (let i = 0; i < desc.wheels.length; i++) {
                const wheel = new pxWheelCollider();
                wheel.applyConfig(desc.wheels[i], desc.chassisMass);
                this._wheels.push(wheel);
            }
        }
        setEnabled(value) {
            if (!this._destroyed) {
                this._enabled = value;
                if (!value)
                    this._idleTime = 0;
            }
        }
        applyConfig(desc, changes) {
            if (this._destroyed || desc.chassis !== this._vehicleBody)
                return Laya.VehicleApplyResult.Invalid;
            if (desc.wheels.length !== this._wheels.length)
                return Laya.VehicleApplyResult.RebuildRequired;
            if (!this._validateDesc(desc))
                return Laya.VehicleApplyResult.Invalid;
            this._chassisMass = desc.chassisMass;
            if ((changes.flags & Laya.VehicleChangeFlags.ChassisMass) !== 0) {
                for (let i = 0; i < this._wheels.length; i++)
                    this._wheels[i].applyConfig(desc.wheels[i], desc.chassisMass);
            }
            else {
                for (let i = 0; i < changes.changedWheelIndices.length; i++) {
                    const index = changes.changedWheelIndices[i];
                    this._wheels[index].applyConfig(desc.wheels[index], desc.chassisMass);
                }
            }
            return Laya.VehicleApplyResult.Applied;
        }
        _validateDesc(desc) {
            if (!(desc.chassisMass > 0) || !Number.isFinite(desc.chassisMass))
                return false;
            for (let i = 0; i < desc.wheels.length; i++) {
                const wheel = desc.wheels[i];
                if (!this._validateWheel(wheel))
                    return false;
            }
            return true;
        }
        _validateWheel(wheel) {
            return Number.isFinite(wheel.centerX) && Number.isFinite(wheel.centerY) && Number.isFinite(wheel.centerZ)
                && Number.isFinite(wheel.radius) && wheel.radius > 0
                && Number.isFinite(wheel.suspensionRestLength) && wheel.suspensionRestLength >= 0
                && Number.isFinite(wheel.maxSuspensionTravel) && wheel.maxSuspensionTravel >= 0
                && Number.isFinite(wheel.springStiffness) && wheel.springStiffness >= 0
                && Number.isFinite(wheel.compressionDamping) && wheel.compressionDamping >= 0
                && Number.isFinite(wheel.reboundDamping) && wheel.reboundDamping >= 0
                && Number.isFinite(wheel.maxSuspensionForce) && wheel.maxSuspensionForce >= 0
                && Number.isFinite(wheel.frictionStiffness) && wheel.frictionStiffness >= 0;
        }
        setInputs(inputs) {
            const count = Math.min(inputs.length, this._wheels.length);
            for (let i = 0; i < count; i++) {
                const input = inputs[i];
                const wheel = this._wheels[i];
                if (wheel._steerAngle !== input.steerAngle)
                    this._wakeRequested = true;
                wheel._motorForce = input.motorForce;
                wheel._brakeForce = input.brakeForce;
                wheel._steerAngle = input.steerAngle;
            }
        }
        beforePhysicsStep(fixedDeltaTime) {
            if (!this._enabled || this._destroyed || !this._vehicleBody)
                return;
            this._fixedDeltaTime = fixedDeltaTime;
            let shouldWake = this._wakeRequested;
            this._wakeRequested = false;
            for (let i = 0; i < this._wheels.length; i++) {
                const wheel = this._wheels[i];
                shouldWake || (shouldWake = wheel._motorForce !== 0 || wheel._brakeForce !== 0);
            }
            if (shouldWake) {
                this._idleTime = 0;
                this._vehicleBody.wakeUp();
            }
            else if (this._vehicleBody.isSleeping()) {
                if (this._hasStaticGroundSupport())
                    return;
                this._idleTime = 0;
                this._vehicleBody.wakeUp();
            }
            this._solve(fixedDeltaTime);
        }
        afterPhysicsStep(fixedDeltaTime) {
            if (!this._enabled || this._destroyed || !this._vehicleBody)
                return;
            this._fixedDeltaTime = fixedDeltaTime;
            this._updateWheelTransforms();
            this._sleepIfIdle(fixedDeltaTime);
        }
        _hasStaticGroundSupport() {
            if (this._wheels.length === 0)
                return false;
            for (let i = 0; i < this._wheels.length; i++) {
                const wheel = this._wheels[i];
                if (!wheel._isGrounded || !wheel._otherCollider
                    || wheel._otherCollider.getCapable(Laya.EColliderCapable.RigidBody_Mass))
                    return false;
            }
            return true;
        }
        _sleepIfIdle(dt) {
            if (this._vehicleBody.isSleeping()) {
                this._idleTime = 0;
                return;
            }
            const chassis = this._vehicleBody.component;
            if (!(chassis === null || chassis === void 0 ? void 0 : chassis.allowSleep) || chassis.sleepThreshold <= 0 || !this._hasStaticGroundSupport()) {
                this._idleTime = 0;
                return;
            }
            for (let i = 0; i < this._wheels.length; i++) {
                if (this._wheels[i]._motorForce !== 0 || this._wheels[i]._brakeForce !== 0) {
                    this._idleTime = 0;
                    return;
                }
            }
            const actor = this._vehicleBody._pxActor;
            const linear = actor.getLinearVelocity();
            const angular = actor.getAngularVelocity();
            const linearSpeedSquared = linear.x * linear.x + linear.y * linear.y + linear.z * linear.z;
            const angularSpeedSquared = angular.x * angular.x + angular.y * angular.y + angular.z * angular.z;
            if (linearSpeedSquared >= IDLE_SPEED_SQUARED || angularSpeedSquared >= IDLE_SPEED_SQUARED) {
                this._idleTime = 0;
                return;
            }
            this._idleTime += dt;
            if (this._idleTime >= IDLE_SLEEP_DELAY) {
                this._vehicleBody.sleep();
                this._idleTime = 0;
            }
        }
        _solve(dt) {
            const actor = this._vehicleBody._pxActor;
            const pose = actor.getGlobalPose();
            const cx = pose.translation.x, cy = pose.translation.y, cz = pose.translation.z;
            const qx = pose.rotation.x, qy = pose.rotation.y, qz = pose.rotation.z, qw = pose.rotation.w;
            const linearVelocity = actor.getLinearVelocity();
            const angularVelocity = actor.getAngularVelocity();
            const lvx = linearVelocity.x, lvy = linearVelocity.y, lvz = linearVelocity.z;
            const avx = angularVelocity.x, avy = angularVelocity.y, avz = angularVelocity.z;
            this._vehicleBody._getLocalCenterOfMass(_vA);
            rotateVec3(qx, qy, qz, qw, _vA.x, _vA.y, _vA.z, _vB);
            const massCenterX = cx + _vB.x;
            const massCenterY = cy + _vB.y;
            const massCenterZ = cz + _vB.z;
            rotateVec3(qx, qy, qz, qw, 0, 1, 0, _vA);
            const upX = _vA.x, upY = _vA.y, upZ = _vA.z;
            this._rayDirection.x = -upX;
            this._rayDirection.y = -upY;
            this._rayDirection.z = -upZ;
            const scene = this._physicsManager._pxScene;
            const queryGroup = this._vehicleBody._collisionGroup;
            const queryMask = this._vehicleBody._canCollisionWith;
            for (let wheelIndex = 0; wheelIndex < this._wheels.length; wheelIndex++) {
                const wheel = this._wheels[wheelIndex];
                rotateVec3(qx, qy, qz, qw, wheel._centerX, wheel._centerY, wheel._centerZ, _vB);
                const connectionX = cx + _vB.x;
                const connectionY = cy + _vB.y;
                const connectionZ = cz + _vB.z;
                this._rayOrigin.x = connectionX;
                this._rayOrigin.y = connectionY;
                this._rayOrigin.z = connectionZ;
                const maxDistance = wheel._suspensionRestLength + wheel._maxSuspensionTravel + wheel._radius;
                const results = scene.raycastAllHitsFiltered(this._rayOrigin, this._rayDirection, maxDistance, queryGroup, queryMask, this._chassisActorID, true);
                let hitDistance = -1;
                let hitX = 0, hitY = 0, hitZ = 0;
                let hitNormalX = upX, hitNormalY = upY, hitNormalZ = upZ;
                let hitActorID = -1;
                const hitCount = results && typeof results.size === "function" ? results.size() : 0;
                for (let i = 0; i < hitCount; i++) {
                    const result = results.get(i);
                    if (!result || !result.position)
                        continue;
                    let distance = result.distance;
                    if (!Number.isFinite(distance)) {
                        const dx = result.position.x - connectionX;
                        const dy = result.position.y - connectionY;
                        const dz = result.position.z - connectionZ;
                        distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    }
                    if (hitDistance < 0 || distance < hitDistance) {
                        hitDistance = distance;
                        hitX = result.position.x;
                        hitY = result.position.y;
                        hitZ = result.position.z;
                        hitNormalX = result.normal.x;
                        hitNormalY = result.normal.y;
                        hitNormalZ = result.normal.z;
                        hitActorID = result.ActorUUID;
                    }
                }
                if (results && typeof results.delete === "function")
                    results.delete();
                let normalLength = Math.sqrt(hitNormalX * hitNormalX + hitNormalY * hitNormalY + hitNormalZ * hitNormalZ);
                if (!Number.isFinite(normalLength) || normalLength < 0.000001) {
                    hitNormalX = upX;
                    hitNormalY = upY;
                    hitNormalZ = upZ;
                }
                else {
                    hitNormalX /= normalLength;
                    hitNormalY /= normalLength;
                    hitNormalZ /= normalLength;
                    if (hitNormalX * upX + hitNormalY * upY + hitNormalZ * upZ < 0) {
                        hitNormalX = -hitNormalX;
                        hitNormalY = -hitNormalY;
                        hitNormalZ = -hitNormalZ;
                    }
                }
                wheel._isGrounded = hitDistance >= 0;
                if (!wheel._isGrounded) {
                    wheel._otherCollider = null;
                    wheel._currentSuspensionLength = wheel._suspensionRestLength;
                    wheel._suspensionForce = 0;
                    wheel._skidInfo = 1;
                    wheel._angularSpeed *= Math.max(0, 1 - dt * 0.25);
                    wheel._rotation += wheel._angularSpeed * dt;
                    continue;
                }
                const rawLength = hitDistance - wheel._radius;
                const minimumLength = Math.max(0, wheel._suspensionRestLength - wheel._maxSuspensionTravel);
                const maximumLength = wheel._suspensionRestLength + wheel._maxSuspensionTravel;
                const currentLength = Math.max(minimumLength, Math.min(rawLength, maximumLength));
                const contactRX = hitX - massCenterX, contactRY = hitY - massCenterY, contactRZ = hitZ - massCenterZ;
                const contactVelocityX = lvx + (avy * contactRZ - avz * contactRY);
                const contactVelocityY = lvy + (avz * contactRX - avx * contactRZ);
                const contactVelocityZ = lvz + (avx * contactRY - avy * contactRX);
                const contactDotSuspension = hitNormalX * upX + hitNormalY * upY + hitNormalZ * upZ;
                const inverseContactDot = 1 / Math.max(MIN_SUSPENSION_CONTACT_DOT, contactDotSuspension);
                const relativeVelocity = contactDotSuspension > MIN_SUSPENSION_CONTACT_DOT
                    ? -(contactVelocityX * hitNormalX + contactVelocityY * hitNormalY + contactVelocityZ * hitNormalZ) * inverseContactDot
                    : 0;
                const compression = wheel._suspensionRestLength - currentLength;
                const damping = relativeVelocity > 0 ? wheel._compressionDamping : wheel._reboundDamping;
                const suspensionForce = Math.max(0, Math.min(wheel._maxSuspensionForce, wheel._springStiffness * compression * inverseContactDot + damping * relativeVelocity));
                wheel._otherCollider = pxCollider._ActorPool.get(hitActorID) || null;
                wheel._contactPos.setValue(hitX, hitY, hitZ);
                wheel._contactNormal.setValue(hitNormalX, hitNormalY, hitNormalZ);
                wheel._currentSuspensionLength = currentLength;
                wheel._suspensionForce = suspensionForce;
                rotateVec3(-qx, -qy, -qz, qw, hitX - cx, hitY - cy, hitZ - cz, _vB);
                const localContactX = _vB.x, localContactY = _vB.y, localContactZ = _vB.z;
                this._applyForceAtLocalPosition(actor, hitNormalX * suspensionForce, hitNormalY * suspensionForce, hitNormalZ * suspensionForce, localContactX, localContactY, localContactZ, contactRX, contactRY, contactRZ);
                const sine = Math.sin(wheel._steerAngle), cosine = Math.cos(wheel._steerAngle);
                rotateVec3(qx, qy, qz, qw, sine, 0, cosine, _vA);
                const forwardNormalDot = _vA.x * hitNormalX + _vA.y * hitNormalY + _vA.z * hitNormalZ;
                let forwardX = _vA.x - hitNormalX * forwardNormalDot;
                let forwardY = _vA.y - hitNormalY * forwardNormalDot;
                let forwardZ = _vA.z - hitNormalZ * forwardNormalDot;
                let forwardLength = Math.sqrt(forwardX * forwardX + forwardY * forwardY + forwardZ * forwardZ);
                if (forwardLength < 0.000001) {
                    rotateVec3(qx, qy, qz, qw, cosine, 0, -sine, _vB);
                    const rightNormalDot = _vB.x * hitNormalX + _vB.y * hitNormalY + _vB.z * hitNormalZ;
                    let fallbackRightX = _vB.x - hitNormalX * rightNormalDot;
                    let fallbackRightY = _vB.y - hitNormalY * rightNormalDot;
                    let fallbackRightZ = _vB.z - hitNormalZ * rightNormalDot;
                    const fallbackLength = Math.max(0.000001, Math.sqrt(fallbackRightX * fallbackRightX + fallbackRightY * fallbackRightY + fallbackRightZ * fallbackRightZ));
                    fallbackRightX /= fallbackLength;
                    fallbackRightY /= fallbackLength;
                    fallbackRightZ /= fallbackLength;
                    forwardX = fallbackRightY * hitNormalZ - fallbackRightZ * hitNormalY;
                    forwardY = fallbackRightZ * hitNormalX - fallbackRightX * hitNormalZ;
                    forwardZ = fallbackRightX * hitNormalY - fallbackRightY * hitNormalX;
                }
                else {
                    forwardX /= forwardLength;
                    forwardY /= forwardLength;
                    forwardZ /= forwardLength;
                }
                const rightX = hitNormalY * forwardZ - hitNormalZ * forwardY;
                const rightY = hitNormalZ * forwardX - hitNormalX * forwardZ;
                const rightZ = hitNormalX * forwardY - hitNormalY * forwardX;
                const forwardSpeed = contactVelocityX * forwardX + contactVelocityY * forwardY + contactVelocityZ * forwardZ;
                const lateralSpeed = contactVelocityX * rightX + contactVelocityY * rightY + contactVelocityZ * rightZ;
                const maximumFriction = suspensionForce * wheel._frictionStiffness;
                let requestedForwardForce = wheel._motorForce;
                const effectiveMass = this._chassisMass / Math.max(1, this._wheels.length);
                const gravity = this._physicsManager._gravity;
                const gravityForwardForce = effectiveMass * (gravity.x * forwardX + gravity.y * forwardY + gravity.z * forwardZ);
                if (wheel._brakeForce > 0) {
                    const stopForce = -forwardSpeed * effectiveMass / dt;
                    const brakeCorrection = stopForce - requestedForwardForce - gravityForwardForce;
                    requestedForwardForce += Math.max(-wheel._brakeForce, Math.min(wheel._brakeForce, brakeCorrection));
                }
                const gravityLateralForce = effectiveMass * (gravity.x * rightX + gravity.y * rightY + gravity.z * rightZ);
                const requestedLateralForce = -lateralSpeed * effectiveMass / dt - gravityLateralForce;
                const requestedMagnitude = Math.sqrt(requestedForwardForce * requestedForwardForce + requestedLateralForce * requestedLateralForce);
                const frictionScale = requestedMagnitude > maximumFriction && requestedMagnitude > 0
                    ? maximumFriction / requestedMagnitude : 1;
                const forwardForce = requestedForwardForce * frictionScale;
                const lateralForce = requestedLateralForce * frictionScale;
                wheel._skidInfo = frictionScale;
                this._applyForceAtLocalPosition(actor, forwardX * forwardForce, forwardY * forwardForce, forwardZ * forwardForce, localContactX, localContactY, localContactZ, contactRX, contactRY, contactRZ);
                const rollReduction = (contactRX * upX + contactRY * upY + contactRZ * upZ) * (1 - DEFAULT_ROLL_INFLUENCE);
                this._applyForceAtLocalPosition(actor, rightX * lateralForce, rightY * lateralForce, rightZ * lateralForce, localContactX, localContactY - rollReduction, localContactZ, contactRX - upX * rollReduction, contactRY - upY * rollReduction, contactRZ - upZ * rollReduction);
                wheel._angularSpeed = forwardSpeed / Math.max(wheel._radius, 0.001);
                wheel._rotation += wheel._angularSpeed * dt;
            }
        }
        _applyForceAtLocalPosition(actor, forceX, forceY, forceZ, localX, localY, localZ, worldRX, worldRY, worldRZ) {
            if (forceX === 0 && forceY === 0 && forceZ === 0)
                return;
            this._force.x = forceX;
            this._force.y = forceY;
            this._force.z = forceZ;
            this._localPosition.x = localX;
            this._localPosition.y = localY;
            this._localPosition.z = localZ;
            if (typeof actor.addForceAtLocalPosWithMode === "function") {
                actor.addForceAtLocalPosWithMode(this._force, this._localPosition, 0);
                return;
            }
            actor.addForce(this._force);
            this._torque.x = worldRY * forceZ - worldRZ * forceY;
            this._torque.y = worldRZ * forceX - worldRX * forceZ;
            this._torque.z = worldRX * forceY - worldRY * forceX;
            actor.addTorque(this._torque);
        }
        _updateWheelTransforms() {
            const pose = this._vehicleBody._pxActor.getGlobalPose();
            const cx = pose.translation.x, cy = pose.translation.y, cz = pose.translation.z;
            const qx = pose.rotation.x, qy = pose.rotation.y, qz = pose.rotation.z, qw = pose.rotation.w;
            rotateVec3(qx, qy, qz, qw, 0, 1, 0, _vA);
            const upX = _vA.x, upY = _vA.y, upZ = _vA.z;
            for (let i = 0; i < this._wheels.length; i++) {
                const wheel = this._wheels[i];
                rotateVec3(qx, qy, qz, qw, wheel._centerX, wheel._centerY, wheel._centerZ, _vB);
                wheel._worldPosition.setValue(cx + _vB.x - upX * wheel._currentSuspensionLength, cy + _vB.y - upY * wheel._currentSuspensionLength, cz + _vB.z - upZ * wheel._currentSuspensionLength);
                quatFromAxisAngle(0, 1, 0, wheel._steerAngle, _qA);
                quatMul(qw, qx, qy, qz, _qA.w, _qA.x, _qA.y, _qA.z, _qB);
                quatFromAxisAngle(1, 0, 0, wheel._rotation, _qA);
                quatMul(_qB.w, _qB.x, _qB.y, _qB.z, _qA.w, _qA.x, _qA.y, _qA.z, _qC);
                wheel._worldRotation.setValue(_qC.x, _qC.y, _qC.z, _qC.w);
            }
        }
        readStates(outStates) {
            const count = Math.min(outStates.length, this._wheels.length);
            for (let i = 0; i < count; i++)
                this._wheels[i].readState(outStates[i], this._fixedDeltaTime);
        }
        reset() {
            this._idleTime = 0;
            for (let i = 0; i < this._wheels.length; i++) {
                const wheel = this._wheels[i];
                wheel._motorForce = 0;
                wheel._brakeForce = 0;
                wheel._steerAngle = 0;
                wheel.resetRuntimeState();
            }
            if (this._vehicleBody)
                this._vehicleBody.wakeUp();
        }
        destroy() {
            if (this._destroyed)
                return;
            this._enabled = false;
            for (let i = 0; i < this._wheels.length; i++)
                this._wheels[i].destroy();
            this._wheels.length = 0;
            this._vehicleBody = null;
            this._physicsManager = null;
            this._destroyed = true;
        }
    }

    class pxCollisionTool {
        constructor() {
        }
        static getCollision(pxCollsionData, isTrigger, index = 0) {
            let collisionData = pxCollsionData.get(index);
            if (!collisionData)
                return null;
            let collsion = pxCollisionTool._collisionPool.length === 0 ? new Laya.Collision() : pxCollisionTool._collisionPool.pop();
            collsion._inPool = false;
            collsion.contacts.length = 0;
            collsion._isTrigger = isTrigger;
            if (isTrigger) {
                let otherShape = pxColliderShape._shapePool.get(collisionData.otherShape);
                let triggerShape = pxColliderShape._shapePool.get(collisionData.triggerShape);
                if (!otherShape || !triggerShape) {
                    pxCollisionTool.reCoverCollision(collsion);
                    return null;
                }
                collsion._colliderA = otherShape._pxCollider;
                collsion._colliderB = triggerShape._pxCollider;
                collsion._isTrigger = true;
            }
            else {
                let shape0 = pxColliderShape._shapePool.get(collisionData.pxShape0);
                let shape1 = pxColliderShape._shapePool.get(collisionData.pxShape1);
                if (!shape0 || !shape1) {
                    pxCollisionTool.reCoverCollision(collsion);
                    return null;
                }
                collsion._colliderA = shape0._pxCollider;
                collsion._colliderB = shape1._pxCollider;
                for (let i = 0, j = collisionData.contactCount; i < j; i++) {
                    let contactInfo = collisionData["contactPoint" + i];
                    if (!contactInfo)
                        continue;
                    let contact = pxCollisionTool._contactPool.pop() || new Laya.ContactPoint();
                    contact._colliderA = collsion._colliderA;
                    contact._colliderB = collsion._colliderB;
                    contact.normal.setValue(contactInfo.normal.x, contactInfo.normal.y, contactInfo.normal.z);
                    contact.positionOnA.setValue(contactInfo.position.x, contactInfo.position.y, contactInfo.position.z);
                    contact.positionOnA.cloneTo(contact.positionOnB);
                    contact.distance = contactInfo.separation;
                    collsion.contacts.push(contact);
                }
            }
            return collsion;
        }
        static getRayCastResult(out, quaryResult) {
            out.succeeded = false;
            out.collider = null;
            if (quaryResult.Quary) {
                out.succeeded = quaryResult.Quary;
                let normal = out.normal;
                normal.x = quaryResult.normal.x;
                normal.y = quaryResult.normal.y;
                normal.z = quaryResult.normal.z;
                let hitPos = out.point;
                hitPos.x = quaryResult.position.x;
                hitPos.y = quaryResult.position.y;
                hitPos.z = quaryResult.position.z;
                out.collider = pxCollider._ActorPool.get(quaryResult.ActorUUID);
            }
            return out;
        }
        static getRayCastResults(out, quaryResults) {
            out.length = 0;
            let quarySize = quaryResults.size();
            if (quarySize <= 0)
                return out;
            for (let i = 0; i < quarySize; i++) {
                let result = quaryResults.get(i);
                let outItem = pxCollisionTool._hitPool.length === 0 ? new Laya.HitResult() : pxCollisionTool._hitPool.pop();
                outItem._inPool = false;
                if (result) {
                    outItem.succeeded = result.Quary;
                    let normal = outItem.normal;
                    normal.x = result.normal.x;
                    normal.y = result.normal.y;
                    normal.z = result.normal.z;
                    let hitPos = outItem.point;
                    hitPos.x = result.position.x;
                    hitPos.y = result.position.y;
                    hitPos.z = result.position.z;
                    outItem.collider = pxCollider._ActorPool.get(result.ActorUUID);
                    out.push(outItem);
                }
            }
            return out;
        }
        static reCoverCollision(value) {
            if (!value._inPool) {
                value._inPool = true;
                for (const contact of value.contacts)
                    pxCollisionTool._contactPool.push(contact);
                value.contacts.length = 0;
                pxCollisionTool._collisionPool.push(value);
            }
        }
        static reCoverHitresults(value) {
            if (!value._inPool) {
                value._inPool = true;
                pxCollisionTool._hitPool.push(value);
            }
        }
    }
    pxCollisionTool._collisionPool = [];
    pxCollisionTool._hitPool = [];
    pxCollisionTool._tempV3 = new Laya.Vector3();
    pxCollisionTool._contactPoint = new Laya.ContactPoint();
    pxCollisionTool._contactPool = [];

    class pxPhysicsManager {
        constructor(physicsSettings) {
            this._physicsStepListeners = [];
            this._pendingPhysicsOperations = [];
            this._inPhysicsUpdate = false;
            this._destroyed = false;
            this._dispatchingEvents = false;
            this._deferredCollisionRecycles = new Set();
            this._simulationCallback = null;
            this._sceneDesc = null;
            this._physicsUpdateList = new Laya.PhysicsUpdateList();
            this._dynamicUpdateList = new Laya.PhysicsUpdateList();
            this.fixedTime = 1.0 / 60.0;
            this.maxSubSteps = 1;
            this.enableCCD = false;
            this._contactCollisionsBegin = new Map();
            this._contactCollisionsPersist = new Map();
            this._contactCollisionsEnd = new Map();
            this._triggerCollisionsBegin = new Map();
            this._triggerCollisionsPersist = new Map();
            this._triggerCollisionsEnd = new Map();
            this._triggerShapePairs = new Map();
            this._gravity = new Laya.Vector3(0, -9.81, 0);
            const triggerCallback = {
                onWake: (wakeActors) => {
                    let size = wakeActors.size();
                    for (let i = 0; i < size; i++) {
                        let uuid = wakeActors.get(i);
                        this.addDynamicElementByUUID(uuid);
                    }
                },
                onSleep: (sleepActors) => {
                    let size = sleepActors.size();
                    for (let i = 0; i < size; i++) {
                        let uuid = sleepActors.get(i);
                        this.removeDynamicElementByUUID(uuid);
                    }
                },
                onContactBegin: (startContacts) => {
                    this.setDataToMap(startContacts, "onContactBegin");
                },
                onContactEnd: (onContactEnd) => {
                    this.setDataToMap(onContactEnd, "onContactEnd");
                },
                onContactPersist: (onContactPersist) => {
                    this.setDataToMap(onContactPersist, "onContactPersist");
                },
                onTriggerBegin: (startTrigger) => {
                    this.setDataToMap(startTrigger, "onTriggerBegin", true);
                },
                onTriggerEnd: (lostTrigger) => {
                    this.setDataToMap(lostTrigger, "onTriggerEnd", true);
                }
            };
            this.enableCCD = physicsSettings.enableCCD;
            const pxPhysics = pxStatics._physics;
            this._simulationCallback = pxStatics._physX.PxSimulationEventCallback.implement(triggerCallback);
            this._sceneDesc = pxStatics._physX.getDefaultSceneDesc(pxPhysics.getTolerancesScale(), 0, this._simulationCallback);
            this._pxScene = pxPhysics.createScene(this._sceneDesc);
            this.setGravity(this._gravity);
            this._pxcontrollerManager = this._pxScene.createControllerManager();
            if (pxStatics._physXPVD) {
                this._pxScene.setPVDClient();
            }
            this.fixedTime = physicsSettings.fixedTimeStep;
            this.maxSubSteps = physicsSettings.maxSubSteps;
        }
        setActiveCollider(collider, value) {
            collider.active = value;
            if (value) {
                collider._physicsManager = this;
            }
            else {
                collider._physicsManager = null;
            }
        }
        enableDebugDrawer(value) {
            throw new Laya.NotImplementedError();
        }
        setDataToMap(dataCallBack, eventType, isTrigger = false) {
            for (let i = 0, n = dataCallBack.size(); i < n; i++) {
                let collision = pxCollisionTool.getCollision(dataCallBack, isTrigger, i);
                if (!collision)
                    continue;
                const a = collision._colliderA, b = collision._colliderB;
                if (!a || !b || a._destroyed || b._destroyed || !a._isSimulate || !b._isSimulate) {
                    pxCollisionTool.reCoverCollision(collision);
                    continue;
                }
                const key = a._id < b._id ? `${a._id}:${b._id}` : `${b._id}:${a._id}`;
                const data = isTrigger ? dataCallBack.get(i) : null;
                const shapeKey = isTrigger ? `${data.triggerShape}:${data.otherShape}` : null;
                let map;
                switch (eventType) {
                    case "onContactBegin":
                        map = this._contactCollisionsBegin;
                        break;
                    case "onContactPersist":
                        map = this._contactCollisionsPersist;
                        break;
                    case "onContactEnd":
                        map = this._contactCollisionsEnd;
                        break;
                    case "onTriggerBegin": {
                        let pairs = this._triggerShapePairs.get(key);
                        if (!pairs)
                            this._triggerShapePairs.set(key, pairs = new Set());
                        const alreadyOverlapping = pairs.size > 0;
                        pairs.add(shapeKey);
                        if (alreadyOverlapping) {
                            pxCollisionTool.reCoverCollision(collision);
                            continue;
                        }
                        this._triggerCollisionsPersist.set(key, collision);
                        map = this._triggerCollisionsBegin;
                        break;
                    }
                    case "onTriggerEnd": {
                        const pairs = this._triggerShapePairs.get(key);
                        if (!pairs || !pairs.delete(shapeKey) || pairs.size > 0) {
                            pxCollisionTool.reCoverCollision(collision);
                            continue;
                        }
                        this._triggerShapePairs.delete(key);
                        const persistent = this._triggerCollisionsPersist.get(key);
                        if (persistent) {
                            pxCollisionTool.reCoverCollision(collision);
                            collision = persistent;
                        }
                        this._triggerCollisionsPersist.delete(key);
                        map = this._triggerCollisionsEnd;
                        break;
                    }
                }
                if (map) {
                    const previous = map.get(key);
                    if (previous && previous !== collision)
                        pxCollisionTool.reCoverCollision(previous);
                    map.set(key, collision);
                }
            }
        }
        setGravity(gravity) {
            gravity.cloneTo(this._gravity);
            this._pxScene.setGravity(gravity);
        }
        _addCharactorCollider(charactorCollider) {
            charactorCollider._createController();
            this._dynamicUpdateList.add(charactorCollider);
        }
        _removeCharactorCollider(charactorCollider) {
            charactorCollider._releaseController();
            this._dynamicUpdateList.remove(charactorCollider);
        }
        addDynamicElementByUUID(uuid) {
            let collider = pxCollider._ActorPool.get(uuid);
            if (!collider || collider._destroyed || !collider._isSimulate || collider.IsKinematic || collider.inPhysicUpdateListIndex !== -1)
                return;
            this._dynamicUpdateList.add(collider);
        }
        removeDynamicElementByUUID(uuid) {
            let collider = pxCollider._ActorPool.get(uuid);
            if (!collider || collider.IsKinematic || collider.inPhysicUpdateListIndex === -1)
                return;
            this._dynamicUpdateList.remove(collider);
        }
        addCollider(collider) {
            if (!collider.active) {
                return;
            }
            let pxcollider = collider;
            switch (pxcollider._type) {
                case exports.pxColliderType.StaticCollider:
                    this._pxScene.addActor(pxcollider._pxActor, null);
                    Laya.LayaGL.statAgent.recordCountData(Laya.StatElement.C_PhysicaStaticRigidBody, 1);
                    break;
                case exports.pxColliderType.RigidbodyCollider:
                    pxcollider.setWorldTransform(true);
                    this._pxScene.addActor(pxcollider._pxActor, null);
                    if (!collider.IsKinematic) {
                        this._dynamicUpdateList.add(collider);
                        Laya.LayaGL.statAgent.recordCountData(Laya.StatElement.C_PhysicaDynamicRigidBody, 1);
                    }
                    else {
                        Laya.LayaGL.statAgent.recordCountData(Laya.StatElement.C_PhysicaKinematicRigidBody, 1);
                    }
                    break;
                case exports.pxColliderType.CharactorCollider:
                    this._addCharactorCollider(collider);
                    Laya.LayaGL.statAgent.recordCountData(Laya.StatElement.C_PhysicaCharacterController, 1);
                    break;
            }
            pxcollider._isSimulate = true;
        }
        removeCollider(collider) {
            let pxcollider = collider;
            switch (pxcollider._type) {
                case exports.pxColliderType.StaticCollider:
                    if (collider.inPhysicUpdateListIndex !== -1)
                        this._physicsUpdateList.remove(collider);
                    this._pxScene.removeActor(pxcollider._pxActor, true);
                    Laya.LayaGL.statAgent.recordCountData(Laya.StatElement.C_PhysicaStaticRigidBody, -1);
                    break;
                case exports.pxColliderType.RigidbodyCollider:
                    if (collider.inPhysicUpdateListIndex !== -1)
                        !collider.IsKinematic && this._dynamicUpdateList.remove(collider);
                    this._pxScene.removeActor(pxcollider._pxActor, true);
                    if (!collider.IsKinematic) {
                        Laya.LayaGL.statAgent.recordCountData(Laya.StatElement.C_PhysicaDynamicRigidBody, -1);
                    }
                    else {
                        Laya.LayaGL.statAgent.recordCountData(Laya.StatElement.C_PhysicaKinematicRigidBody, -1);
                    }
                    break;
                case exports.pxColliderType.CharactorCollider:
                    this._removeCharactorCollider(pxcollider);
                    Laya.LayaGL.statAgent.recordCountData(Laya.StatElement.C_PhysicaCharacterController, -1);
                    break;
            }
            pxcollider._isSimulate = false;
            this._clearColliderEvents(pxcollider);
        }
        _clearColliderEvents(collider) {
            const recycled = new Set();
            for (const map of [this._contactCollisionsBegin, this._contactCollisionsPersist, this._contactCollisionsEnd,
                this._triggerCollisionsBegin, this._triggerCollisionsPersist, this._triggerCollisionsEnd]) {
                map.forEach((collision, key) => {
                    if (collision._colliderA === collider || collision._colliderB === collider) {
                        map.delete(key);
                        this._triggerShapePairs.delete(key);
                        recycled.add(collision);
                    }
                });
            }
            recycled.forEach(collision => this._recoverCollision(collision));
        }
        _recoverCollision(collision) {
            if (this._dispatchingEvents)
                this._deferredCollisionRecycles.add(collision);
            else
                pxCollisionTool.reCoverCollision(collision);
        }
        _collision_event() {
            this._collision_EnterEvent();
            this._collision_StayEvent();
            this._collision_ExitEvent();
        }
        _collision_EnterEvent() {
            this._contactCollisionsBegin.forEach((value, key) => {
                if (!value)
                    return;
                Laya.Physics3DStatInfo.addStatisticsInfo(Laya.EPhysicsStatisticsInfo.C_PhysicsEventCount, 1);
                let ownerA = value._colliderA.owner;
                let ownerB = value._colliderB.owner;
                value.other = value._colliderB.component;
                ownerA.event(Laya.Event.COLLISION_ENTER, value);
                value.other = value._colliderA.component;
                ownerB.event(Laya.Event.COLLISION_ENTER, value);
                pxCollisionTool.reCoverCollision(value);
            });
        }
        _collision_StayEvent() {
            this._contactCollisionsPersist.forEach((value, key) => {
                if (!value)
                    return;
                Laya.Physics3DStatInfo.addStatisticsInfo(Laya.EPhysicsStatisticsInfo.C_PhysicsEventCount, 1);
                let ownerA = value._colliderA.owner;
                let ownerB = value._colliderB.owner;
                value.other = value._colliderB.component;
                ownerA.event(Laya.Event.COLLISION_STAY, value);
                value.other = value._colliderA.component;
                ownerB.event(Laya.Event.COLLISION_STAY, value);
                pxCollisionTool.reCoverCollision(value);
            });
        }
        _collision_ExitEvent() {
            this._contactCollisionsEnd.forEach((value, key) => {
                if (!value)
                    return;
                Laya.Physics3DStatInfo.addStatisticsInfo(Laya.EPhysicsStatisticsInfo.C_PhysicsEventCount, 1);
                let ownerA = value._colliderA.owner;
                let ownerB = value._colliderB.owner;
                value.other = value._colliderB.component;
                ownerA.event(Laya.Event.COLLISION_EXIT, value);
                value.other = value._colliderA.component;
                ownerB.event(Laya.Event.COLLISION_EXIT, value);
                pxCollisionTool.reCoverCollision(value);
            });
        }
        _trigger_Event() {
            this._trigger_EnterEvent();
            this._trigger_StayEvent();
            this._trigger_ExitEvent();
        }
        _trigger_EnterEvent() {
            this._triggerCollisionsBegin.forEach((value, key) => {
                if (!value)
                    return;
                Laya.Physics3DStatInfo.addStatisticsInfo(Laya.EPhysicsStatisticsInfo.C_PhysicsEventCount, 1);
                let ownerA = value._colliderA.owner;
                let ownerB = value._colliderB.owner;
                ownerA.event(Laya.Event.TRIGGER_ENTER, value._colliderB.component);
                ownerB.event(Laya.Event.TRIGGER_ENTER, value._colliderA.component);
            });
        }
        _trigger_StayEvent() {
            this._triggerCollisionsPersist.forEach((value, key) => {
                if (!value)
                    return;
                Laya.Physics3DStatInfo.addStatisticsInfo(Laya.EPhysicsStatisticsInfo.C_PhysicsEventCount, 1);
                let ownerA = value._colliderA.owner;
                let ownerB = value._colliderB.owner;
                ownerA.event(Laya.Event.TRIGGER_STAY, value._colliderB.component);
                ownerB.event(Laya.Event.TRIGGER_STAY, value._colliderA.component);
            });
        }
        _trigger_ExitEvent() {
            this._triggerCollisionsEnd.forEach((value, key) => {
                if (!value)
                    return;
                Laya.Physics3DStatInfo.addStatisticsInfo(Laya.EPhysicsStatisticsInfo.C_PhysicsEventCount, 1);
                let ownerA = value._colliderA.owner;
                let ownerB = value._colliderB.owner;
                ownerA.event(Laya.Event.TRIGGER_EXIT, value._colliderB.component);
                ownerB.event(Laya.Event.TRIGGER_EXIT, value._colliderA.component);
                pxCollisionTool.reCoverCollision(value);
            });
        }
        _updatePhysicsEvents() {
            this._dispatchingEvents = true;
            try {
                this._collision_event();
                this._trigger_Event();
                this._contactCollisionsBegin.clear();
                this._contactCollisionsPersist.clear();
                this._contactCollisionsEnd.clear();
                this._triggerCollisionsBegin.clear();
                this._triggerCollisionsEnd.clear();
            }
            finally {
                this._dispatchingEvents = false;
                this._deferredCollisionRecycles.forEach(collision => pxCollisionTool.reCoverCollision(collision));
                this._deferredCollisionRecycles.clear();
            }
        }
        _updatePhysicsTransformToRender() {
            var elements = this._dynamicUpdateList.elements;
            for (var i = 0, n = this._dynamicUpdateList.length; i < n; i++) {
                var physicCollider = elements[i];
                physicCollider.getWorldTransform();
            }
        }
        _updatePhysicsTransformFromRender() {
            var elements = this._physicsUpdateList.elements;
            for (var i = 0, n = this._physicsUpdateList.length; i < n; i++) {
                var physicCollider = elements[i];
                physicCollider.setWorldTransform(false);
                physicCollider.inPhysicUpdateListIndex = -1;
            }
            this._physicsUpdateList.length = 0;
        }
        update(elapsedTime) {
            if (this._destroyed || !this._pxScene)
                return;
            this._updatePhysicsTransformFromRender();
            const fixedDeltaTime = this.fixedTime > 0 ? this.fixedTime : elapsedTime;
            const requestedSteps = (fixedDeltaTime > 0 && elapsedTime > 0)
                ? Math.max(1, Math.round(elapsedTime / fixedDeltaTime)) : 0;
            const stepCount = Math.min(Math.max(1, this.maxSubSteps), requestedSteps);
            try {
                this._flushPendingPhysicsOperations();
                for (let step = 0; step < stepCount; step++) {
                    this._inPhysicsUpdate = true;
                    try {
                        const listeners = this._physicsStepListeners;
                        for (let i = 0, n = listeners.length; i < n; i++)
                            listeners[i].beforePhysicsStep(fixedDeltaTime);
                        for (let i = 0, n = this._dynamicUpdateList.length; i < n; i++) {
                            const collider = this._dynamicUpdateList.elements[i];
                            if (collider._type === exports.pxColliderType.RigidbodyCollider)
                                collider._applyGravity(fixedDeltaTime);
                        }
                        this._pxScene.simulate(fixedDeltaTime, true);
                        this._pxScene.fetchResults(true);
                        for (let i = 0, n = listeners.length; i < n; i++)
                            listeners[i].afterPhysicsStep(fixedDeltaTime);
                    }
                    finally {
                        this._inPhysicsUpdate = false;
                        this._flushPendingPhysicsOperations();
                    }
                }
            }
            finally {
                this._inPhysicsUpdate = false;
                this._flushPendingPhysicsOperations();
            }
            this._updatePhysicsTransformToRender();
            this._updatePhysicsEvents();
        }
        rayCast(ray, outHitResult, distance = 1000000, collisonGroup = -1, collisionMask = -1) {
            let result = this._pxScene.raycastCloset(ray.origin, ray.direction, distance, collisonGroup, collisionMask);
            pxCollisionTool.getRayCastResult(outHitResult, result);
            return outHitResult.succeeded;
        }
        rayCastAll(ray, out, distance = 1000000, collisonGroup = -1, collisionMask = -1) {
            let results = this._pxScene.raycastAllHits(ray.origin, ray.direction, distance, collisonGroup, collisionMask);
            pxCollisionTool.getRayCastResults(out, results);
            return (out.length >= 1 ? true : false);
        }
        shapeCast(shape, fromPosition, toPosition, out, fromRotation = new Laya.Quaternion(), toRotation = new Laya.Quaternion(), collisonGroup = -1, collisionMask = -1, allowedCcdPenetration = 0.0) {
            let transform = pxPhysicsManager._tempTransform;
            fromPosition.cloneTo(transform.translation);
            let distance = Laya.Vector3.distance(fromPosition, toPosition);
            Laya.Vector3.subtract(toPosition, fromPosition, pxPhysicsManager._tempVector30);
            Laya.Vector3.normalize(pxPhysicsManager._tempVector30, pxPhysicsManager._tempVector30);
            let dir = pxPhysicsManager._tempVector30;
            let result = this._pxScene.sweepSingle(shape._pxGeometry, transform, dir, distance, collisonGroup, collisionMask, allowedCcdPenetration);
            pxCollisionTool.getRayCastResult(out, result);
            return out.succeeded;
        }
        shapeCastAll(shape, fromPosition, toPosition, out, fromRotation = new Laya.Quaternion(), toRotation = new Laya.Quaternion(), collisonGroup = -1, collisionMask = -1, allowedCcdPenetration = 0.0) {
            let transform = pxPhysicsManager._tempTransform;
            fromPosition.cloneTo(transform.translation);
            let distance = Laya.Vector3.distance(fromPosition, toPosition);
            Laya.Vector3.subtract(toPosition, fromPosition, pxPhysicsManager._tempVector30);
            Laya.Vector3.normalize(pxPhysicsManager._tempVector30, pxPhysicsManager._tempVector30);
            let dir = pxPhysicsManager._tempVector30;
            let results = this._pxScene.sweepAny(shape._pxGeometry, transform, dir, distance, collisonGroup, collisionMask, allowedCcdPenetration);
            pxCollisionTool.getRayCastResults(out, results);
            return (out.length >= 1 ? true : false);
        }
        sphereQuery(pos, radius, result, collisionmask) {
        }
        addPhysicsStepListener(listener) {
            if (this._destroyed)
                return;
            this.deferPhysicsOperation(() => {
                if (this._physicsStepListeners.indexOf(listener) === -1)
                    this._physicsStepListeners.push(listener);
            });
        }
        removePhysicsStepListener(listener) {
            if (this._destroyed)
                return;
            this.deferPhysicsOperation(() => {
                const index = this._physicsStepListeners.indexOf(listener);
                if (index !== -1)
                    this._physicsStepListeners.splice(index, 1);
            });
        }
        deferPhysicsOperation(operation) {
            if (this._destroyed)
                return;
            if (this._inPhysicsUpdate)
                this._pendingPhysicsOperations.push(operation);
            else
                operation();
        }
        _flushPendingPhysicsOperations() {
            while (this._pendingPhysicsOperations.length > 0) {
                const operations = this._pendingPhysicsOperations.splice(0, this._pendingPhysicsOperations.length);
                for (let i = 0; i < operations.length; i++)
                    operations[i]();
            }
        }
        destroy() {
            if (this._destroyed)
                return;
            this._inPhysicsUpdate = false;
            this._flushPendingPhysicsOperations();
            for (const joint of pxJoint._ActorPool.values()) {
                if (joint._physicsManager === this)
                    joint.destroy();
            }
            this._destroyed = true;
            this._physicsStepListeners.length = 0;
            this._pendingPhysicsOperations.length = 0;
            this._releaseNative(this._pxcontrollerManager, "release", "PxControllerManager");
            this._pxcontrollerManager = null;
            this._releaseNative(this._pxScene, "release", "PxScene");
            this._pxScene = null;
            this._releaseNative(this._sceneDesc, "delete", "PxSceneDesc");
            this._sceneDesc = null;
            this._releaseNative(this._simulationCallback, "delete", "PxSimulationEventCallback");
            this._simulationCallback = null;
            this._physicsUpdateList.clear();
            this._dynamicUpdateList.clear();
            this._contactCollisionsBegin.clear();
            this._contactCollisionsPersist.clear();
            this._contactCollisionsEnd.clear();
            this._triggerCollisionsBegin.clear();
            this._triggerCollisionsPersist.forEach(collision => this._recoverCollision(collision));
            this._triggerCollisionsPersist.clear();
            this._triggerShapePairs.clear();
            this._triggerCollisionsEnd.clear();
        }
        _releaseNative(resource, method, name) {
            if (!resource || typeof resource[method] !== "function")
                return;
            try {
                resource[method]();
                if (method !== "delete" && typeof resource.delete === "function")
                    resource.delete();
            }
            catch (error) {
                console.error("[PhysX] Failed to release " + name + ".", error);
            }
        }
    }
    pxPhysicsManager._tempTransform = { translation: new Laya.Vector3(), rotation: new Laya.Quaternion() };
    pxPhysicsManager._tempVector30 = new Laya.Vector3();

    class pxPhysicsCreateUtil {
        initPhysicsCapable() {
            this._physicsEngineCapableMap = new Map();
            this._physicsEngineCapableMap.set(Laya.EPhysicsCapable.Physics_Gravity, true);
            this._physicsEngineCapableMap.set(Laya.EPhysicsCapable.Physics_StaticCollider, true);
            this._physicsEngineCapableMap.set(Laya.EPhysicsCapable.Physics_DynamicCollider, true);
            this._physicsEngineCapableMap.set(Laya.EPhysicsCapable.Physics_CharacterCollider, true);
            this._physicsEngineCapableMap.set(Laya.EPhysicsCapable.Physics_BoxColliderShape, true);
            this._physicsEngineCapableMap.set(Laya.EPhysicsCapable.Physics_SphereColliderShape, true);
            this._physicsEngineCapableMap.set(Laya.EPhysicsCapable.Physics_CapsuleColliderShape, true);
            this._physicsEngineCapableMap.set(Laya.EPhysicsCapable.Physics_CylinderColliderShape, false);
            this._physicsEngineCapableMap.set(Laya.EPhysicsCapable.Physics_ConeColliderShape, false);
            this._physicsEngineCapableMap.set(Laya.EPhysicsCapable.Physics_MeshColliderShape, true);
            this._physicsEngineCapableMap.set(Laya.EPhysicsCapable.physics_heightFieldColliderShape, true);
            this._physicsEngineCapableMap.set(Laya.EPhysicsCapable.Physics_CompoundColliderShape, true);
            this._physicsEngineCapableMap.set(Laya.EPhysicsCapable.Physics_Joint, true);
            this._physicsEngineCapableMap.set(Laya.EPhysicsCapable.Physics_FixedJoint, true);
            this._physicsEngineCapableMap.set(Laya.EPhysicsCapable.Physics_SpringJoint, true);
            this._physicsEngineCapableMap.set(Laya.EPhysicsCapable.Physics_HingeJoint, true);
            this._physicsEngineCapableMap.set(Laya.EPhysicsCapable.Physics_D6Joint, true);
            this._physicsEngineCapableMap.set(Laya.EPhysicsCapable.Physics_CreateCorveMesh, true);
            this._physicsEngineCapableMap.set(Laya.EPhysicsCapable.Physics_VehicleSystem, true);
        }
        getPhysicsCapable(value) {
            return this._physicsEngineCapableMap.get(value);
        }
        initialize() {
            const initialMemory = Math.max(16, Laya.Config3D.defaultPhysicsMemory) * 1024 * 1024;
            return window.PHYSX({ INITIAL_MEMORY: initialMemory }).then((PHYSX) => {
                this._init(PHYSX);
                console.log("PhysX loaded.");
                this.initPhysicsCapable();
                pxDynamicCollider.initCapable();
                pxStaticCollider.initCapable();
                pxCharactorCollider.initCapable();
                return Promise.resolve();
            });
        }
        _physxPVDSocketConnect(physX, pxFoundation) {
            var socket;
            var queue = [];
            const pvdTransport = physX.PxPvdTransport.implement({
                connect: function () {
                    let url = 'ws://127.0.0.1:' + pxStatics._PxPvdPort;
                    socket = new WebSocket(url, ['binary']);
                    socket.onopen = (e) => {
                        console.log('Connected to PhysX Debugger');
                        queue.forEach(data => socket.send(data));
                        queue = [];
                    };
                    socket.onclose = () => {
                    };
                    return true;
                },
                disconnect: function () {
                    console.log("Socket disconnect");
                },
                isConnected: function () {
                },
                write: function (inBytes, inLength) {
                    const data = physX.HEAPU8.slice(inBytes, inBytes + inLength);
                    if (socket.readyState === WebSocket.OPEN) {
                        if (queue.length) {
                            queue.forEach(data => socket.send(data));
                            queue.length = 0;
                        }
                        socket.send(data);
                    }
                    else {
                        queue.push(data);
                    }
                    return true;
                }
            });
            const gPvd = physX.PxCreatePvd(pxFoundation);
            physX.MyCreatepvdTransport(pvdTransport, gPvd);
            pxStatics._pvd = gPvd;
            pxStatics._PxPvdTransport = pvdTransport;
            return gPvd;
        }
        _init(physX) {
            const version = physX.PX_PHYSICS_VERSION;
            const defaultErrorCallback = new physX.PxDefaultErrorCallback();
            const allocator = new physX.PxDefaultAllocator();
            const pxFoundation = physX.PxCreateFoundation(version, allocator, defaultErrorCallback);
            pxStatics._tolerancesScale = new physX.PxTolerancesScale();
            let pxPhysics;
            if (pxStatics._physXPVD) {
                let gPvd = this._physxPVDSocketConnect(physX, pxFoundation);
                pxPhysics = physX.CreatePVDPhysics(pxFoundation, pxStatics._tolerancesScale, true, gPvd);
                physX.PxInitExtensions(pxPhysics, gPvd);
            }
            else {
                pxPhysics = physX.CreateDefaultPhysics(pxFoundation, pxStatics._tolerancesScale);
                physX.InitDefaultExtensions(pxPhysics);
            }
            pxStatics._physX = physX;
            pxStatics._foundation = pxFoundation;
            pxStatics._physics = pxPhysics;
            pxStatics._allocator = allocator;
        }
        createPhysicsManger(physicsSettings) {
            return new pxPhysicsManager(physicsSettings);
        }
        createDynamicCollider(manager) {
            return new pxDynamicCollider(manager);
        }
        createStaticCollider(manager) {
            return new pxStaticCollider(manager);
        }
        createCharacterController(manager) {
            return new pxCharactorCollider(manager);
        }
        createFixedJoint(manager) {
            return new pxFixedJoint(manager);
        }
        createHingeJoint(manager) {
            return new pxRevoluteJoint(manager);
        }
        createSpringJoint(manager) {
            return new pxDistanceJoint(manager);
        }
        createD6Joint(manager) {
            return new pxD6Joint(manager);
        }
        createBoxColliderShape() {
            return new pxBoxColliderShape();
        }
        createSphereColliderShape() {
            return new pxSphereColliderShape();
        }
        createPlaneColliderShape() {
            return null;
        }
        createCapsuleColliderShape() {
            return new pxCapsuleColliderShape();
        }
        createMeshColliderShape() {
            return new pxMeshColliderShape();
        }
        createCylinderColliderShape() {
            return null;
        }
        createConeColliderShape() {
            return null;
        }
        createHeightFieldShape() {
            return new pxHeightFieldShape();
        }
        createCompoundShape() {
            return new pxCompoundColliderShape();
        }
        createCorveMesh(mesh) {
            if (mesh._convexMesh == null) {
                return null;
            }
            if (mesh.__convexMesh == null) {
                let convexMesh = mesh._convexMesh;
                let vertices = convexMesh.getVertices();
                let vertexCount = vertices.size();
                var vertexDeclaration = Laya.VertexMesh.getVertexDeclaration("POSITION");
                var vertexFloatStride = vertexDeclaration.vertexStride / 4;
                var vertice = new Float32Array(vertexCount * vertexFloatStride);
                for (var i = 0; i < vertexCount; i++) {
                    let index = i * 3;
                    let data = vertices.get(i);
                    vertice[index] = data.x;
                    vertice[index + 1] = data.y;
                    vertice[index + 2] = data.z;
                }
                let indexs = convexMesh.getIndexBuffer();
                let polygons = convexMesh.getPolygons();
                let triangles = [];
                for (var i = 0, n = polygons.size(); i < n;) {
                    let nbTris = polygons.get(i) - 2;
                    let mIndexBase = polygons.get(i + 1);
                    let vref0 = indexs.get(mIndexBase);
                    for (var j = 0; j < nbTris; j++) {
                        let vref1 = indexs.get(mIndexBase + j + 1);
                        let vref2 = indexs.get(mIndexBase + j + 2);
                        triangles.push(vref0, vref1, vref2);
                    }
                    i += 2;
                }
                mesh.__convexMesh = Laya.PrimitiveMesh._createMesh(vertexDeclaration, vertice, new Uint16Array(triangles));
            }
            return mesh.__convexMesh;
        }
        createVehicle(manager, desc) {
            return new pxVehicle(manager, desc);
        }
    }
    Laya.Laya3D.PhysicsCreateUtil = new pxPhysicsCreateUtil();

    exports.pxBoxColliderShape = pxBoxColliderShape;
    exports.pxCapsuleColliderShape = pxCapsuleColliderShape;
    exports.pxCharactorCollider = pxCharactorCollider;
    exports.pxCollider = pxCollider;
    exports.pxColliderShape = pxColliderShape;
    exports.pxCollisionTool = pxCollisionTool;
    exports.pxCompoundColliderShape = pxCompoundColliderShape;
    exports.pxD6Joint = pxD6Joint;
    exports.pxDistanceJoint = pxDistanceJoint;
    exports.pxDynamicCollider = pxDynamicCollider;
    exports.pxFixedJoint = pxFixedJoint;
    exports.pxHeightFieldShape = pxHeightFieldShape;
    exports.pxJoint = pxJoint;
    exports.pxMeshColliderShape = pxMeshColliderShape;
    exports.pxPhysicsCreateUtil = pxPhysicsCreateUtil;
    exports.pxPhysicsManager = pxPhysicsManager;
    exports.pxPhysicsMaterial = pxPhysicsMaterial;
    exports.pxRevoluteJoint = pxRevoluteJoint;
    exports.pxSphereColliderShape = pxSphereColliderShape;
    exports.pxSphereJoint = pxSphereJoint;
    exports.pxStaticCollider = pxStaticCollider;
    exports.pxStatics = pxStatics;
    exports.pxVehicle = pxVehicle;
    exports.pxWheelCollider = pxWheelCollider;

})(window.Laya = window.Laya || {}, Laya);
//# sourceMappingURL=laya.physX.js.map

// Prefer the PhysX implementation embedded by the Conch/native runtime.
// This thenable preserves the asynchronous PHYSX factory contract used by
// the web build without loading or instantiating the WebAssembly module.
if (typeof window !== "undefined" && window.conch && window.physx) {
    window.PHYSX = function () {
        return {
            then: function (complete) {
                return complete(window.physx);
            }
        };
    };
} else {
var PHYSX=(()=>{var _scriptName=typeof document!=="undefined"&&document.currentScript?document.currentScript.src:undefined;return async function(moduleArg={}){var moduleRtn;var _globalThis$process,_globalThis$process2;function _defineProperty(e,r,t){return(r=_toPropertyKey(r))in e?Object.defineProperty(e,r,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[r]=t,e}function _toPropertyKey(t){var i=_toPrimitive(t,"string");return"symbol"==typeof i?i:i+""}function _toPrimitive(t,r){if("object"!=typeof t||!t)return t;var e=t[Symbol.toPrimitive];if(void 0!==e){var i=e.call(t,r||"default");if("object"!=typeof i)return i;throw new TypeError("@@toPrimitive must return a primitive value.")}return("string"===r?String:Number)(t)}var Module=moduleArg;var ENVIRONMENT_IS_WEB=!!globalThis.window;var ENVIRONMENT_IS_WORKER=!!globalThis.WorkerGlobalScope;var ENVIRONMENT_IS_NODE=((_globalThis$process=globalThis.process)===null||_globalThis$process===void 0||(_globalThis$process=_globalThis$process.versions)===null||_globalThis$process===void 0?void 0:_globalThis$process.node)&&((_globalThis$process2=globalThis.process)===null||_globalThis$process2===void 0?void 0:_globalThis$process2.type)!="renderer";var arguments_=[];var thisProgram="./this.program";var quit_=(status,toThrow)=>{throw toThrow};if(typeof __filename!="undefined"){_scriptName=__filename}else if(ENVIRONMENT_IS_WORKER){_scriptName=self.location.href}var scriptDirectory="";function locateFile(path){if(Module["locateFile"]){return Module["locateFile"](path,scriptDirectory)}return scriptDirectory+path}var readAsync,readBinary;if(ENVIRONMENT_IS_NODE){var fs=require("fs");scriptDirectory=__dirname+"/";readBinary=filename=>{filename=isFileURI(filename)?new URL(filename):filename;var ret=fs.readFileSync(filename);return ret};readAsync=async function(filename){let binary=arguments.length>1&&arguments[1]!==undefined?arguments[1]:true;filename=isFileURI(filename)?new URL(filename):filename;var ret=fs.readFileSync(filename,binary?undefined:"utf8");return ret};if(process.argv.length>1){thisProgram=process.argv[1].replace(/\\/g,"/")}arguments_=process.argv.slice(2);quit_=(status,toThrow)=>{process.exitCode=status;throw toThrow}}else if(ENVIRONMENT_IS_WEB||ENVIRONMENT_IS_WORKER){try{scriptDirectory=new URL(".",_scriptName).href}catch{}{if(ENVIRONMENT_IS_WORKER){readBinary=url=>{var xhr=new XMLHttpRequest;xhr.open("GET",url,false);xhr.responseType="arraybuffer";xhr.send(null);return new Uint8Array(xhr.response)}}readAsync=async url=>{if(isFileURI(url)){return new Promise((resolve,reject)=>{var xhr=new XMLHttpRequest;xhr.open("GET",url,true);xhr.responseType="arraybuffer";xhr.onload=()=>{if(xhr.status==200||xhr.status==0&&xhr.response){resolve(xhr.response);return}reject(xhr.status)};xhr.onerror=reject;xhr.send(null)})}var response=await fetch(url,{credentials:"same-origin"});if(response.ok){return response.arrayBuffer()}throw new Error(response.status+" : "+response.url)}}}else{}var out=console.log.bind(console);var err=console.error.bind(console);var wasmBinary;var ABORT=false;var EXITSTATUS;var isFileURI=filename=>filename.startsWith("file://");var readyPromiseResolve,readyPromiseReject;var HEAP8,HEAPU8,HEAP16,HEAPU16,HEAP32,HEAPU32,HEAPF32,HEAPF64;var runtimeInitialized=false;function updateMemoryViews(){var b=wasmMemory.buffer;HEAP8=new Int8Array(b);HEAP16=new Int16Array(b);Module["HEAPU8"]=HEAPU8=new Uint8Array(b);Module["HEAPU16"]=HEAPU16=new Uint16Array(b);HEAP32=new Int32Array(b);Module["HEAPU32"]=HEAPU32=new Uint32Array(b);Module["HEAPF32"]=HEAPF32=new Float32Array(b);HEAPF64=new Float64Array(b)}if(ENVIRONMENT_IS_NODE){var _global,_global$performance;(_global$performance=(_global=global).performance)!==null&&_global$performance!==void 0?_global$performance:_global.performance=require("perf_hooks").performance}function initMemory(){if(Module["wasmMemory"]){wasmMemory=Module["wasmMemory"]}else{var INITIAL_MEMORY=Module["INITIAL_MEMORY"]||16777216;wasmMemory=new WebAssembly.Memory({initial:INITIAL_MEMORY/65536,maximum:32768})}updateMemoryViews()}function preRun(){if(Module["preRun"]){if(typeof Module["preRun"]=="function")Module["preRun"]=[Module["preRun"]];while(Module["preRun"].length){addOnPreRun(Module["preRun"].shift())}}callRuntimeCallbacks(onPreRuns)}function initRuntime(){runtimeInitialized=true;wasmExports["J"]()}function postRun(){if(Module["postRun"]){if(typeof Module["postRun"]=="function")Module["postRun"]=[Module["postRun"]];while(Module["postRun"].length){addOnPostRun(Module["postRun"].shift())}}callRuntimeCallbacks(onPostRuns)}function abort(what){var _Module$onAbort,_readyPromiseReject;(_Module$onAbort=Module["onAbort"])===null||_Module$onAbort===void 0||_Module$onAbort.call(Module,what);what="Aborted("+what+")";err(what);ABORT=true;what+=". Build with -sASSERTIONS for more info.";var e=new WebAssembly.RuntimeError(what);(_readyPromiseReject=readyPromiseReject)===null||_readyPromiseReject===void 0||_readyPromiseReject(e);throw e}var wasmBinaryFile;function findWasmBinary(){return locateFile("physx.release.wasm")}function getBinarySync(file){if(file==wasmBinaryFile&&wasmBinary){return new Uint8Array(wasmBinary)}if(readBinary){return readBinary(file)}throw"both async and sync fetching of the wasm failed"}async function getWasmBinary(binaryFile){if(!wasmBinary){try{var response=await readAsync(binaryFile);return new Uint8Array(response)}catch{}}return getBinarySync(binaryFile)}async function instantiateArrayBuffer(binaryFile,imports){try{var binary=await getWasmBinary(binaryFile);var instance=await WebAssembly.instantiate(binary,imports);return instance}catch(reason){err("failed to asynchronously prepare wasm: ".concat(reason));abort(reason)}}async function instantiateAsync(binary,binaryFile,imports){if(!binary&&WebAssembly.instantiateStreaming&&!isFileURI(binaryFile)&&!ENVIRONMENT_IS_NODE){try{var response=fetch(binaryFile,{credentials:"same-origin"});var instantiationResult=await WebAssembly.instantiateStreaming(response,imports);return instantiationResult}catch(reason){err("wasm streaming compile failed: ".concat(reason));err("falling back to ArrayBuffer instantiation")}}return instantiateArrayBuffer(binaryFile,imports)}function getWasmImports(){var imports={a:wasmImports};return imports}async function createWasm(){function receiveInstance(instance,module){wasmExports=instance.exports;assignWasmExports(wasmExports);return wasmExports}function receiveInstantiationResult(result){return receiveInstance(result["instance"])}var info=getWasmImports();if(Module["instantiateWasm"]){return new Promise((resolve,reject)=>{Module["instantiateWasm"](info,(inst,mod)=>{resolve(receiveInstance(inst,mod))})})}wasmBinaryFile!==null&&wasmBinaryFile!==void 0?wasmBinaryFile:wasmBinaryFile=findWasmBinary();var result=await instantiateAsync(wasmBinary,wasmBinaryFile,info);var exports=receiveInstantiationResult(result);return exports}class ExitStatus{constructor(status){_defineProperty(this,"name","ExitStatus");this.message="Program terminated with exit(".concat(status,")");this.status=status}}var callRuntimeCallbacks=callbacks=>{while(callbacks.length>0){callbacks.shift()(Module)}};var onPostRuns=[];var addOnPostRun=cb=>onPostRuns.push(cb);var onPreRuns=[];var addOnPreRun=cb=>onPreRuns.push(cb);var noExitRuntime=true;var wasmMemory;var __abort_js=()=>abort("");var createNamedFunction=(name,func)=>Object.defineProperty(func,"name",{value:name});var emval_freelist=[];var emval_handles=[0,1,,1,null,1,true,1,false,1];var BindingError=class BindingError extends Error{constructor(message){super(message);this.name="BindingError"}};var throwBindingError=message=>{throw new BindingError(message)};var Emval={toValue:handle=>{if(!handle){throwBindingError("Cannot use deleted val. handle = ".concat(handle))}return emval_handles[handle]},toHandle:value=>{switch(value){case undefined:return 2;case null:return 4;case true:return 6;case false:return 8;default:{const handle=emval_freelist.pop()||emval_handles.length;emval_handles[handle]=value;emval_handles[handle+1]=1;return handle}}}};class PureVirtualError extends Error{}var AsciiToString=ptr=>{var str="";while(1){var ch=HEAPU8[ptr++];if(!ch)return str;str+=String.fromCharCode(ch)}};var registeredInstances={};var getBasestPointer=(class_,ptr)=>{if(ptr===undefined){throwBindingError("ptr should not be undefined")}while(class_.baseClass){ptr=class_.upcast(ptr);class_=class_.baseClass}return ptr};var registerInheritedInstance=(class_,ptr,instance)=>{ptr=getBasestPointer(class_,ptr);if(registeredInstances.hasOwnProperty(ptr)){throwBindingError("Tried to register registered instance: ".concat(ptr))}else{registeredInstances[ptr]=instance}};var registeredTypes={};var getTypeName=type=>{var ptr=___getTypeName(type);var rv=AsciiToString(ptr);_free(ptr);return rv};var requireRegisteredType=(rawType,humanName)=>{var impl=registeredTypes[rawType];if(undefined===impl){throwBindingError("".concat(humanName," has unknown type ").concat(getTypeName(rawType)))}return impl};var unregisterInheritedInstance=(class_,ptr)=>{ptr=getBasestPointer(class_,ptr);if(registeredInstances.hasOwnProperty(ptr)){delete registeredInstances[ptr]}else{throwBindingError("Tried to unregister unregistered instance: ".concat(ptr))}};var detachFinalizer=handle=>{};var finalizationRegistry=false;var runDestructor=$$=>{if($$.smartPtr){$$.smartPtrType.rawDestructor($$.smartPtr)}else{$$.ptrType.registeredClass.rawDestructor($$.ptr)}};var releaseClassHandle=$$=>{$$.count.value-=1;var toDelete=0===$$.count.value;if(toDelete){runDestructor($$)}};var attachFinalizer=handle=>{if(!globalThis.FinalizationRegistry){attachFinalizer=handle=>handle;return handle}finalizationRegistry=new FinalizationRegistry(info=>{releaseClassHandle(info.$$)});attachFinalizer=handle=>{var $$=handle.$$;var hasSmartPtr=!!$$.smartPtr;if(hasSmartPtr){var info={$$};finalizationRegistry.register(handle,info,handle)}return handle};detachFinalizer=handle=>finalizationRegistry.unregister(handle);return attachFinalizer(handle)};var __embind_create_inheriting_constructor=(constructorName,wrapperType,properties)=>{constructorName=AsciiToString(constructorName);wrapperType=requireRegisteredType(wrapperType,"wrapper");properties=Emval.toValue(properties);var registeredClass=wrapperType.registeredClass;var wrapperPrototype=registeredClass.instancePrototype;var baseClass=registeredClass.baseClass;var baseClassPrototype=baseClass.instancePrototype;var baseConstructor=registeredClass.baseClass.constructor;var ctor=createNamedFunction(constructorName,function(){for(var name of registeredClass.baseClass.pureVirtualFunctions){if(this[name]===baseClassPrototype[name]){throw new PureVirtualError("Pure virtual function ".concat(name," must be implemented in JavaScript"))}}Object.defineProperty(this,"__parent",{value:wrapperPrototype});this["__construct"](...arguments)});wrapperPrototype["__construct"]=function __construct(){if(this===wrapperPrototype){throwBindingError("Pass correct 'this' to __construct")}for(var _len=arguments.length,args=new Array(_len),_key=0;_key<_len;_key++){args[_key]=arguments[_key]}var inner=baseConstructor["implement"](this,...args);detachFinalizer(inner);var $$=inner.$$;inner["notifyOnDestruction"]();$$.preservePointerOnDelete=true;Object.defineProperties(this,{$$:{value:$$}});attachFinalizer(this);registerInheritedInstance(registeredClass,$$.ptr,this)};wrapperPrototype["__destruct"]=function __destruct(){if(this===wrapperPrototype){throwBindingError("Pass correct 'this' to __destruct")}detachFinalizer(this);unregisterInheritedInstance(registeredClass,this.$$.ptr)};ctor.prototype=Object.create(wrapperPrototype);Object.assign(ctor.prototype,properties);return Emval.toHandle(ctor)};var structRegistrations={};var runDestructors=destructors=>{while(destructors.length){var ptr=destructors.pop();var del=destructors.pop();del(ptr)}};function readPointer(pointer){return this.fromWireType(HEAPU32[pointer>>2])}var awaitingDependencies={};var typeDependencies={};var InternalError=class InternalError extends Error{constructor(message){super(message);this.name="InternalError"}};var throwInternalError=message=>{throw new InternalError(message)};var whenDependentTypesAreResolved=(myTypes,dependentTypes,getTypeConverters)=>{myTypes.forEach(type=>typeDependencies[type]=dependentTypes);function onComplete(typeConverters){var myTypeConverters=getTypeConverters(typeConverters);if(myTypeConverters.length!==myTypes.length){throwInternalError("Mismatched type converter count")}for(var i=0;i<myTypes.length;++i){registerType(myTypes[i],myTypeConverters[i])}}var typeConverters=new Array(dependentTypes.length);var unregisteredTypes=[];var registered=0;for(let[i,dt]of dependentTypes.entries()){if(registeredTypes.hasOwnProperty(dt)){typeConverters[i]=registeredTypes[dt]}else{unregisteredTypes.push(dt);if(!awaitingDependencies.hasOwnProperty(dt)){awaitingDependencies[dt]=[]}awaitingDependencies[dt].push(()=>{typeConverters[i]=registeredTypes[dt];++registered;if(registered===unregisteredTypes.length){onComplete(typeConverters)}})}}if(0===unregisteredTypes.length){onComplete(typeConverters)}};var __embind_finalize_value_object=structType=>{var reg=structRegistrations[structType];delete structRegistrations[structType];var rawConstructor=reg.rawConstructor;var rawDestructor=reg.rawDestructor;var fieldRecords=reg.fields;var fieldTypes=fieldRecords.map(field=>field.getterReturnType).concat(fieldRecords.map(field=>field.setterArgumentType));whenDependentTypesAreResolved([structType],fieldTypes,fieldTypes=>{var fields={};for(var[i,field]of fieldRecords.entries()){const getterReturnType=fieldTypes[i];const getter=field.getter;const getterContext=field.getterContext;const setterArgumentType=fieldTypes[i+fieldRecords.length];const setter=field.setter;const setterContext=field.setterContext;fields[field.fieldName]={read:ptr=>getterReturnType.fromWireType(getter(getterContext,ptr)),write:(ptr,o)=>{var destructors=[];setter(setterContext,ptr,setterArgumentType.toWireType(destructors,o));runDestructors(destructors)},optional:getterReturnType.optional}}return[{name:reg.name,fromWireType:ptr=>{var rv={};for(var i in fields){rv[i]=fields[i].read(ptr)}rawDestructor(ptr);return rv},toWireType:(destructors,o)=>{for(var fieldName in fields){if(!(fieldName in o)&&!fields[fieldName].optional){throw new TypeError('Missing field: "'.concat(fieldName,'"'))}}var ptr=rawConstructor();for(fieldName in fields){fields[fieldName].write(ptr,o[fieldName])}if(destructors!==null){destructors.push(rawDestructor,ptr)}return ptr},readValueFromPointer:readPointer,destructorFunction:rawDestructor}]})};var __embind_register_bigint=(primitiveType,name,size,minRange,maxRange)=>{};function sharedRegisterType(rawType,registeredInstance){let options=arguments.length>2&&arguments[2]!==undefined?arguments[2]:{};var name=registeredInstance.name;if(!rawType){throwBindingError('type "'.concat(name,'" must have a positive integer typeid pointer'))}if(registeredTypes.hasOwnProperty(rawType)){if(options.ignoreDuplicateRegistrations){return}else{throwBindingError("Cannot register type '".concat(name,"' twice"))}}registeredTypes[rawType]=registeredInstance;delete typeDependencies[rawType];if(awaitingDependencies.hasOwnProperty(rawType)){var callbacks=awaitingDependencies[rawType];delete awaitingDependencies[rawType];callbacks.forEach(cb=>cb())}}function registerType(rawType,registeredInstance){let options=arguments.length>2&&arguments[2]!==undefined?arguments[2]:{};return sharedRegisterType(rawType,registeredInstance,options)}var __embind_register_bool=(rawType,name,trueValue,falseValue)=>{name=AsciiToString(name);registerType(rawType,{name,fromWireType:function(wt){return!!wt},toWireType:function(destructors,o){return o?trueValue:falseValue},readValueFromPointer:function(pointer){return this.fromWireType(HEAPU8[pointer])},destructorFunction:null})};var shallowCopyInternalPointer=o=>({count:o.count,deleteScheduled:o.deleteScheduled,preservePointerOnDelete:o.preservePointerOnDelete,ptr:o.ptr,ptrType:o.ptrType,smartPtr:o.smartPtr,smartPtrType:o.smartPtrType});var throwInstanceAlreadyDeleted=obj=>{function getInstanceTypeName(handle){return handle.$$.ptrType.registeredClass.name}throwBindingError(getInstanceTypeName(obj)+" instance already deleted")};var deletionQueue=[];var flushPendingDeletes=()=>{while(deletionQueue.length){var obj=deletionQueue.pop();obj.$$.deleteScheduled=false;obj["delete"]()}};var delayFunction;var init_ClassHandle=()=>{let proto=ClassHandle.prototype;Object.assign(proto,{isAliasOf(other){if(!(this instanceof ClassHandle)){return false}if(!(other instanceof ClassHandle)){return false}var leftClass=this.$$.ptrType.registeredClass;var left=this.$$.ptr;other.$$=other.$$;var rightClass=other.$$.ptrType.registeredClass;var right=other.$$.ptr;while(leftClass.baseClass){left=leftClass.upcast(left);leftClass=leftClass.baseClass}while(rightClass.baseClass){right=rightClass.upcast(right);rightClass=rightClass.baseClass}return leftClass===rightClass&&left===right},clone(){if(!this.$$.ptr){throwInstanceAlreadyDeleted(this)}if(this.$$.preservePointerOnDelete){this.$$.count.value+=1;return this}else{var clone=attachFinalizer(Object.create(Object.getPrototypeOf(this),{$$:{value:shallowCopyInternalPointer(this.$$)}}));clone.$$.count.value+=1;clone.$$.deleteScheduled=false;return clone}},delete(){if(!this.$$.ptr){throwInstanceAlreadyDeleted(this)}if(this.$$.deleteScheduled&&!this.$$.preservePointerOnDelete){throwBindingError("Object already scheduled for deletion")}detachFinalizer(this);releaseClassHandle(this.$$);if(!this.$$.preservePointerOnDelete){this.$$.smartPtr=undefined;this.$$.ptr=undefined}},isDeleted(){return!this.$$.ptr},deleteLater(){if(!this.$$.ptr){throwInstanceAlreadyDeleted(this)}if(this.$$.deleteScheduled&&!this.$$.preservePointerOnDelete){throwBindingError("Object already scheduled for deletion")}deletionQueue.push(this);if(deletionQueue.length===1&&delayFunction){delayFunction(flushPendingDeletes)}this.$$.deleteScheduled=true;return this}});const symbolDispose=Symbol.dispose;if(symbolDispose){proto[symbolDispose]=proto["delete"]}};function ClassHandle(){}var registeredPointers={};var ensureOverloadTable=(proto,methodName,humanName)=>{if(undefined===proto[methodName].overloadTable){var prevFunc=proto[methodName];proto[methodName]=function(){for(var _len2=arguments.length,args=new Array(_len2),_key2=0;_key2<_len2;_key2++){args[_key2]=arguments[_key2]}if(!proto[methodName].overloadTable.hasOwnProperty(args.length)){throwBindingError("Function '".concat(humanName,"' called with an invalid number of arguments (").concat(args.length,") - expects one of (").concat(proto[methodName].overloadTable,")!"))}return proto[methodName].overloadTable[args.length].apply(this,args)};proto[methodName].overloadTable=[];proto[methodName].overloadTable[prevFunc.argCount]=prevFunc}};var exposePublicSymbol=(name,value,numArguments)=>{if(Module.hasOwnProperty(name)){if(undefined===numArguments||undefined!==Module[name].overloadTable&&undefined!==Module[name].overloadTable[numArguments]){throwBindingError("Cannot register public name '".concat(name,"' twice"))}ensureOverloadTable(Module,name,name);if(Module[name].overloadTable.hasOwnProperty(numArguments)){throwBindingError("Cannot register multiple overloads of a function with the same number of arguments (".concat(numArguments,")!"))}Module[name].overloadTable[numArguments]=value}else{Module[name]=value;Module[name].argCount=numArguments}};var char_0=48;var char_9=57;var makeLegalFunctionName=name=>{name=name.replace(/[^a-zA-Z0-9_]/g,"$");var f=name.charCodeAt(0);if(f>=char_0&&f<=char_9){return"_".concat(name)}return name};function RegisteredClass(name,constructor,instancePrototype,rawDestructor,baseClass,getActualType,upcast,downcast){this.name=name;this.constructor=constructor;this.instancePrototype=instancePrototype;this.rawDestructor=rawDestructor;this.baseClass=baseClass;this.getActualType=getActualType;this.upcast=upcast;this.downcast=downcast;this.pureVirtualFunctions=[]}var upcastPointer=(ptr,ptrClass,desiredClass)=>{while(ptrClass!==desiredClass){if(!ptrClass.upcast){throwBindingError("Expected null or instance of ".concat(desiredClass.name,", got an instance of ").concat(ptrClass.name))}ptr=ptrClass.upcast(ptr);ptrClass=ptrClass.baseClass}return ptr};var embindRepr=v=>{if(v===null){return"null"}var t=typeof v;if(t==="object"||t==="array"||t==="function"){return v.toString()}else{return""+v}};function constNoSmartPtrRawPointerToWireType(destructors,handle){if(handle===null){if(this.isReference){throwBindingError("null is not a valid ".concat(this.name))}return 0}if(!handle.$$){throwBindingError('Cannot pass "'.concat(embindRepr(handle),'" as a ').concat(this.name))}if(!handle.$$.ptr){throwBindingError("Cannot pass deleted object as a pointer of type ".concat(this.name))}var handleClass=handle.$$.ptrType.registeredClass;var ptr=upcastPointer(handle.$$.ptr,handleClass,this.registeredClass);return ptr}function genericPointerToWireType(destructors,handle){var ptr;if(handle===null){if(this.isReference){throwBindingError("null is not a valid ".concat(this.name))}if(this.isSmartPointer){ptr=this.rawConstructor();if(destructors!==null){destructors.push(this.rawDestructor,ptr)}return ptr}else{return 0}}if(!handle||!handle.$$){throwBindingError('Cannot pass "'.concat(embindRepr(handle),'" as a ').concat(this.name))}if(!handle.$$.ptr){throwBindingError("Cannot pass deleted object as a pointer of type ".concat(this.name))}if(!this.isConst&&handle.$$.ptrType.isConst){throwBindingError("Cannot convert argument of type ".concat(handle.$$.smartPtrType?handle.$$.smartPtrType.name:handle.$$.ptrType.name," to parameter type ").concat(this.name))}var handleClass=handle.$$.ptrType.registeredClass;ptr=upcastPointer(handle.$$.ptr,handleClass,this.registeredClass);if(this.isSmartPointer){if(undefined===handle.$$.smartPtr){throwBindingError("Passing raw pointer to smart pointer is illegal")}switch(this.sharingPolicy){case 0:if(handle.$$.smartPtrType===this){ptr=handle.$$.smartPtr}else{throwBindingError("Cannot convert argument of type ".concat(handle.$$.smartPtrType?handle.$$.smartPtrType.name:handle.$$.ptrType.name," to parameter type ").concat(this.name))}break;case 1:ptr=handle.$$.smartPtr;break;case 2:if(handle.$$.smartPtrType===this){ptr=handle.$$.smartPtr}else{var clonedHandle=handle["clone"]();ptr=this.rawShare(ptr,Emval.toHandle(()=>clonedHandle["delete"]()));if(destructors!==null){destructors.push(this.rawDestructor,ptr)}}break;default:throwBindingError("Unsupported sharing policy")}}return ptr}function nonConstNoSmartPtrRawPointerToWireType(destructors,handle){if(handle===null){if(this.isReference){throwBindingError("null is not a valid ".concat(this.name))}return 0}if(!handle.$$){throwBindingError('Cannot pass "'.concat(embindRepr(handle),'" as a ').concat(this.name))}if(!handle.$$.ptr){throwBindingError("Cannot pass deleted object as a pointer of type ".concat(this.name))}if(handle.$$.ptrType.isConst){throwBindingError("Cannot convert argument of type ".concat(handle.$$.ptrType.name," to parameter type ").concat(this.name))}var handleClass=handle.$$.ptrType.registeredClass;var ptr=upcastPointer(handle.$$.ptr,handleClass,this.registeredClass);return ptr}var downcastPointer=(ptr,ptrClass,desiredClass)=>{if(ptrClass===desiredClass){return ptr}if(undefined===desiredClass.baseClass){return null}var rv=downcastPointer(ptr,ptrClass,desiredClass.baseClass);if(rv===null){return null}return desiredClass.downcast(rv)};var getInheritedInstance=(class_,ptr)=>{ptr=getBasestPointer(class_,ptr);return registeredInstances[ptr]};var makeClassHandle=(prototype,record)=>{if(!record.ptrType||!record.ptr){throwInternalError("makeClassHandle requires ptr and ptrType")}var hasSmartPtrType=!!record.smartPtrType;var hasSmartPtr=!!record.smartPtr;if(hasSmartPtrType!==hasSmartPtr){throwInternalError("Both smartPtrType and smartPtr must be specified")}record.count={value:1};return attachFinalizer(Object.create(prototype,{$$:{value:record,writable:true}}))};function RegisteredPointer_fromWireType(ptr){var rawPointer=this.getPointee(ptr);if(!rawPointer){this.destructor(ptr);return null}var registeredInstance=getInheritedInstance(this.registeredClass,rawPointer);if(undefined!==registeredInstance){if(0===registeredInstance.$$.count.value){registeredInstance.$$.ptr=rawPointer;registeredInstance.$$.smartPtr=ptr;return registeredInstance["clone"]()}else{var rv=registeredInstance["clone"]();this.destructor(ptr);return rv}}function makeDefaultHandle(){if(this.isSmartPointer){return makeClassHandle(this.registeredClass.instancePrototype,{ptrType:this.pointeeType,ptr:rawPointer,smartPtrType:this,smartPtr:ptr})}else{return makeClassHandle(this.registeredClass.instancePrototype,{ptrType:this,ptr})}}var actualType=this.registeredClass.getActualType(rawPointer);var registeredPointerRecord=registeredPointers[actualType];if(!registeredPointerRecord){return makeDefaultHandle.call(this)}var toType;if(this.isConst){toType=registeredPointerRecord.constPointerType}else{toType=registeredPointerRecord.pointerType}var dp=downcastPointer(rawPointer,this.registeredClass,toType.registeredClass);if(dp===null){return makeDefaultHandle.call(this)}if(this.isSmartPointer){return makeClassHandle(toType.registeredClass.instancePrototype,{ptrType:toType,ptr:dp,smartPtrType:this,smartPtr:ptr})}else{return makeClassHandle(toType.registeredClass.instancePrototype,{ptrType:toType,ptr:dp})}}var init_RegisteredPointer=()=>{Object.assign(RegisteredPointer.prototype,{getPointee(ptr){if(this.rawGetPointee){ptr=this.rawGetPointee(ptr)}return ptr},destructor(ptr){var _this$rawDestructor;(_this$rawDestructor=this.rawDestructor)===null||_this$rawDestructor===void 0||_this$rawDestructor.call(this,ptr)},readValueFromPointer:readPointer,fromWireType:RegisteredPointer_fromWireType})};function RegisteredPointer(name,registeredClass,isReference,isConst,isSmartPointer,pointeeType,sharingPolicy,rawGetPointee,rawConstructor,rawShare,rawDestructor){this.name=name;this.registeredClass=registeredClass;this.isReference=isReference;this.isConst=isConst;this.isSmartPointer=isSmartPointer;this.pointeeType=pointeeType;this.sharingPolicy=sharingPolicy;this.rawGetPointee=rawGetPointee;this.rawConstructor=rawConstructor;this.rawShare=rawShare;this.rawDestructor=rawDestructor;if(!isSmartPointer&&registeredClass.baseClass===undefined){if(isConst){this.toWireType=constNoSmartPtrRawPointerToWireType;this.destructorFunction=null}else{this.toWireType=nonConstNoSmartPtrRawPointerToWireType;this.destructorFunction=null}}else{this.toWireType=genericPointerToWireType}}var replacePublicSymbol=(name,value,numArguments)=>{if(!Module.hasOwnProperty(name)){throwInternalError("Replacing nonexistent public symbol")}if(undefined!==Module[name].overloadTable&&undefined!==numArguments){Module[name].overloadTable[numArguments]=value}else{Module[name]=value;Module[name].argCount=numArguments}};var dynCalls={};var dynCallLegacy=(sig,ptr,args)=>{sig=sig.replace(/p/g,"i");var f=dynCalls[sig];return f(ptr,...args)};var wasmTableMirror=[];var getWasmTableEntry=funcPtr=>{var func=wasmTableMirror[funcPtr];if(!func){wasmTableMirror[funcPtr]=func=wasmTable.get(funcPtr)}return func};var dynCall=function(sig,ptr){let args=arguments.length>2&&arguments[2]!==undefined?arguments[2]:[];let promising=arguments.length>3&&arguments[3]!==undefined?arguments[3]:false;if(sig.includes("j")){return dynCallLegacy(sig,ptr,args)}var func=getWasmTableEntry(ptr);var rtn=func(...args);function convert(rtn){return rtn}return convert(rtn)};var getDynCaller=function(sig,ptr){let promising=arguments.length>2&&arguments[2]!==undefined?arguments[2]:false;return function(){for(var _len3=arguments.length,args=new Array(_len3),_key3=0;_key3<_len3;_key3++){args[_key3]=arguments[_key3]}return dynCall(sig,ptr,args,promising)}};var embind__requireFunction=function(signature,rawFunction){let isAsync=arguments.length>2&&arguments[2]!==undefined?arguments[2]:false;signature=AsciiToString(signature);function makeDynCaller(){if(signature.includes("j")){return getDynCaller(signature,rawFunction)}var rtn=getWasmTableEntry(rawFunction);return rtn}var fp=makeDynCaller();if(typeof fp!="function"){throwBindingError("unknown function pointer with signature ".concat(signature,": ").concat(rawFunction))}return fp};class UnboundTypeError extends Error{}var throwUnboundTypeError=(message,types)=>{var unboundTypes=[];var seen={};function visit(type){if(seen[type]){return}if(registeredTypes[type]){return}if(typeDependencies[type]){typeDependencies[type].forEach(visit);return}unboundTypes.push(type);seen[type]=true}types.forEach(visit);throw new UnboundTypeError("".concat(message,": ")+unboundTypes.map(getTypeName).join([", "]))};var __embind_register_class=(rawType,rawPointerType,rawConstPointerType,baseClassRawType,getActualTypeSignature,getActualType,upcastSignature,upcast,downcastSignature,downcast,name,destructorSignature,rawDestructor)=>{name=AsciiToString(name);getActualType=embind__requireFunction(getActualTypeSignature,getActualType);upcast&&(upcast=embind__requireFunction(upcastSignature,upcast));downcast&&(downcast=embind__requireFunction(downcastSignature,downcast));rawDestructor=embind__requireFunction(destructorSignature,rawDestructor);var legalFunctionName=makeLegalFunctionName(name);exposePublicSymbol(legalFunctionName,function(){throwUnboundTypeError("Cannot construct ".concat(name," due to unbound types"),[baseClassRawType])});whenDependentTypesAreResolved([rawType,rawPointerType,rawConstPointerType],baseClassRawType?[baseClassRawType]:[],base=>{base=base[0];var baseClass;var basePrototype;if(baseClassRawType){baseClass=base.registeredClass;basePrototype=baseClass.instancePrototype}else{basePrototype=ClassHandle.prototype}var constructor=createNamedFunction(name,function(){if(Object.getPrototypeOf(this)!==instancePrototype){throw new BindingError("Use 'new' to construct ".concat(name))}if(undefined===registeredClass.constructor_body){throw new BindingError("".concat(name," has no accessible constructor"))}for(var _len4=arguments.length,args=new Array(_len4),_key4=0;_key4<_len4;_key4++){args[_key4]=arguments[_key4]}var body=registeredClass.constructor_body[args.length];if(undefined===body){throw new BindingError("Tried to invoke ctor of ".concat(name," with invalid number of parameters (").concat(args.length,") - expected (").concat(Object.keys(registeredClass.constructor_body).toString(),") parameters instead!"))}return body.apply(this,args)});var instancePrototype=Object.create(basePrototype,{constructor:{value:constructor}});constructor.prototype=instancePrototype;var registeredClass=new RegisteredClass(name,constructor,instancePrototype,rawDestructor,baseClass,getActualType,upcast,downcast);if(registeredClass.baseClass){var _registeredClass$base,_registeredClass$base2;(_registeredClass$base2=(_registeredClass$base=registeredClass.baseClass).__derivedClasses)!==null&&_registeredClass$base2!==void 0?_registeredClass$base2:_registeredClass$base.__derivedClasses=[];registeredClass.baseClass.__derivedClasses.push(registeredClass)}var referenceConverter=new RegisteredPointer(name,registeredClass,true,false,false);var pointerConverter=new RegisteredPointer(name+"*",registeredClass,false,false,false);var constPointerConverter=new RegisteredPointer(name+" const*",registeredClass,false,true,false);registeredPointers[rawType]={pointerType:pointerConverter,constPointerType:constPointerConverter};replacePublicSymbol(legalFunctionName,constructor);return[referenceConverter,pointerConverter,constPointerConverter]})};function usesDestructorStack(argTypes){for(var i=1;i<argTypes.length;++i){if(argTypes[i]!==null&&argTypes[i].destructorFunction===undefined){return true}}return false}function craftInvokerFunction(humanName,argTypes,classType,cppInvokerFunc,cppTargetFunc,isAsync){var argCount=argTypes.length;if(argCount<2){throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!")}var isClassMethodFunc=argTypes[1]!==null&&classType!==null;var needsDestructorStack=usesDestructorStack(argTypes);var returns=!argTypes[0].isVoid;var expectedArgCount=argCount-2;var argsWired=new Array(expectedArgCount);var invokerFuncArgs=[];var destructors=[];var invokerFn=function(){destructors.length=0;var thisWired;invokerFuncArgs.length=isClassMethodFunc?2:1;invokerFuncArgs[0]=cppTargetFunc;if(isClassMethodFunc){thisWired=argTypes[1].toWireType(destructors,this);invokerFuncArgs[1]=thisWired}for(var i=0;i<expectedArgCount;++i){argsWired[i]=argTypes[i+2].toWireType(destructors,i<0||arguments.length<=i?undefined:arguments[i]);invokerFuncArgs.push(argsWired[i])}var rv=cppInvokerFunc(...invokerFuncArgs);function onDone(rv){if(needsDestructorStack){runDestructors(destructors)}else{for(var i=isClassMethodFunc?1:2;i<argTypes.length;i++){var param=i===1?thisWired:argsWired[i-2];if(argTypes[i].destructorFunction!==null){argTypes[i].destructorFunction(param)}}}if(returns){return argTypes[0].fromWireType(rv)}}return onDone(rv)};return createNamedFunction(humanName,invokerFn)}var heap32VectorToArray=(count,firstElement)=>{var array=[];for(var i=0;i<count;i++){array.push(HEAPU32[firstElement+i*4>>2])}return array};var getFunctionName=signature=>{signature=signature.trim();const argsIndex=signature.indexOf("(");if(argsIndex===-1)return signature;return signature.slice(0,argsIndex)};var __embind_register_class_class_function=(rawClassType,methodName,argCount,rawArgTypesAddr,invokerSignature,rawInvoker,fn,isAsync,isNonnullReturn)=>{var rawArgTypes=heap32VectorToArray(argCount,rawArgTypesAddr);methodName=AsciiToString(methodName);methodName=getFunctionName(methodName);rawInvoker=embind__requireFunction(invokerSignature,rawInvoker,isAsync);whenDependentTypesAreResolved([],[rawClassType],classType=>{classType=classType[0];var humanName="".concat(classType.name,".").concat(methodName);function unboundTypesHandler(){throwUnboundTypeError("Cannot call ".concat(humanName," due to unbound types"),rawArgTypes)}if(methodName.startsWith("@@")){methodName=Symbol[methodName.substring(2)]}var proto=classType.registeredClass.constructor;if(undefined===proto[methodName]){unboundTypesHandler.argCount=argCount-1;proto[methodName]=unboundTypesHandler}else{ensureOverloadTable(proto,methodName,humanName);proto[methodName].overloadTable[argCount-1]=unboundTypesHandler}whenDependentTypesAreResolved([],rawArgTypes,argTypes=>{var invokerArgsArray=[argTypes[0],null].concat(argTypes.slice(1));var func=craftInvokerFunction(humanName,invokerArgsArray,null,rawInvoker,fn,isAsync);if(undefined===proto[methodName].overloadTable){func.argCount=argCount-1;proto[methodName]=func}else{proto[methodName].overloadTable[argCount-1]=func}if(classType.registeredClass.__derivedClasses){for(const derivedClass of classType.registeredClass.__derivedClasses){if(!derivedClass.constructor.hasOwnProperty(methodName)){derivedClass.constructor[methodName]=func}}}return[]});return[]})};var __embind_register_class_constructor=(rawClassType,argCount,rawArgTypesAddr,invokerSignature,invoker,rawConstructor)=>{var rawArgTypes=heap32VectorToArray(argCount,rawArgTypesAddr);invoker=embind__requireFunction(invokerSignature,invoker);whenDependentTypesAreResolved([],[rawClassType],classType=>{classType=classType[0];var humanName="constructor ".concat(classType.name);if(undefined===classType.registeredClass.constructor_body){classType.registeredClass.constructor_body=[]}if(undefined!==classType.registeredClass.constructor_body[argCount-1]){throw new BindingError("Cannot register multiple constructors with identical number of parameters (".concat(argCount-1,") for class '").concat(classType.name,"'! Overload resolution is currently only performed using the parameter count, not actual type info!"))}classType.registeredClass.constructor_body[argCount-1]=()=>{throwUnboundTypeError("Cannot construct ".concat(classType.name," due to unbound types"),rawArgTypes)};whenDependentTypesAreResolved([],rawArgTypes,argTypes=>{argTypes.splice(1,0,null);classType.registeredClass.constructor_body[argCount-1]=craftInvokerFunction(humanName,argTypes,null,invoker,rawConstructor);return[]});return[]})};var __embind_register_class_function=(rawClassType,methodName,argCount,rawArgTypesAddr,invokerSignature,rawInvoker,context,isPureVirtual,isAsync,isNonnullReturn)=>{var rawArgTypes=heap32VectorToArray(argCount,rawArgTypesAddr);methodName=AsciiToString(methodName);methodName=getFunctionName(methodName);rawInvoker=embind__requireFunction(invokerSignature,rawInvoker,isAsync);whenDependentTypesAreResolved([],[rawClassType],classType=>{classType=classType[0];var humanName="".concat(classType.name,".").concat(methodName);if(methodName.startsWith("@@")){methodName=Symbol[methodName.substring(2)]}if(isPureVirtual){classType.registeredClass.pureVirtualFunctions.push(methodName)}function unboundTypesHandler(){throwUnboundTypeError("Cannot call ".concat(humanName," due to unbound types"),rawArgTypes)}var proto=classType.registeredClass.instancePrototype;var method=proto[methodName];if(undefined===method||undefined===method.overloadTable&&method.className!==classType.name&&method.argCount===argCount-2){unboundTypesHandler.argCount=argCount-2;unboundTypesHandler.className=classType.name;proto[methodName]=unboundTypesHandler}else{ensureOverloadTable(proto,methodName,humanName);proto[methodName].overloadTable[argCount-2]=unboundTypesHandler}whenDependentTypesAreResolved([],rawArgTypes,argTypes=>{var memberFunction=craftInvokerFunction(humanName,argTypes,classType,rawInvoker,context,isAsync);if(undefined===proto[methodName].overloadTable){memberFunction.argCount=argCount-2;proto[methodName]=memberFunction}else{proto[methodName].overloadTable[argCount-2]=memberFunction}return[]});return[]})};var validateThis=(this_,classType,humanName)=>{if(!(this_ instanceof Object)){throwBindingError("".concat(humanName,' with invalid "this": ').concat(this_))}if(!(this_ instanceof classType.registeredClass.constructor)){throwBindingError("".concat(humanName,' incompatible with "this" of type ').concat(this_.constructor.name))}if(!this_.$$.ptr){throwBindingError("cannot call emscripten binding method ".concat(humanName," on deleted object"))}return upcastPointer(this_.$$.ptr,this_.$$.ptrType.registeredClass,classType.registeredClass)};var __embind_register_class_property=(classType,fieldName,getterReturnType,getterSignature,getter,getterContext,setterArgumentType,setterSignature,setter,setterContext)=>{fieldName=AsciiToString(fieldName);getter=embind__requireFunction(getterSignature,getter);whenDependentTypesAreResolved([],[classType],classType=>{classType=classType[0];var humanName="".concat(classType.name,".").concat(fieldName);var desc={get(){throwUnboundTypeError("Cannot access ".concat(humanName," due to unbound types"),[getterReturnType,setterArgumentType])},enumerable:true,configurable:true};if(setter){desc.set=()=>throwUnboundTypeError("Cannot access ".concat(humanName," due to unbound types"),[getterReturnType,setterArgumentType])}else{desc.set=v=>throwBindingError(humanName+" is a read-only property")}Object.defineProperty(classType.registeredClass.instancePrototype,fieldName,desc);whenDependentTypesAreResolved([],setter?[getterReturnType,setterArgumentType]:[getterReturnType],types=>{var getterReturnType=types[0];var desc={get(){var ptr=validateThis(this,classType,humanName+" getter");return getterReturnType.fromWireType(getter(getterContext,ptr))},enumerable:true};if(setter){setter=embind__requireFunction(setterSignature,setter);var setterArgumentType=types[1];desc.set=function(v){var ptr=validateThis(this,classType,humanName+" setter");var destructors=[];setter(setterContext,ptr,setterArgumentType.toWireType(destructors,v));runDestructors(destructors)}}Object.defineProperty(classType.registeredClass.instancePrototype,fieldName,desc);return[]});return[]})};var __embind_register_constant=(name,type,value)=>{name=AsciiToString(name);whenDependentTypesAreResolved([],[type],type=>{type=type[0];Module[name]=type.fromWireType(value);return[]})};var __emval_decref=handle=>{if(handle>9&&0===--emval_handles[handle+1]){emval_handles[handle]=undefined;emval_freelist.push(handle)}};var EmValType={name:"emscripten::val",fromWireType:handle=>{var rv=Emval.toValue(handle);__emval_decref(handle);return rv},toWireType:(destructors,value)=>Emval.toHandle(value),readValueFromPointer:readPointer,destructorFunction:null};var __embind_register_emval=rawType=>registerType(rawType,EmValType);var enumReadValueFromPointer=(name,width,signed)=>{switch(width){case 1:return signed?function(pointer){return this.fromWireType(HEAP8[pointer])}:function(pointer){return this.fromWireType(HEAPU8[pointer])};case 2:return signed?function(pointer){return this.fromWireType(HEAP16[pointer>>1])}:function(pointer){return this.fromWireType(HEAPU16[pointer>>1])};case 4:return signed?function(pointer){return this.fromWireType(HEAP32[pointer>>2])}:function(pointer){return this.fromWireType(HEAPU32[pointer>>2])};default:throw new TypeError("invalid integer width (".concat(width,"): ").concat(name))}};function getEnumValueType(rawValueType){return rawValueType===0?"object":rawValueType===1?"number":"string"}var __embind_register_enum=(rawType,name,size,isSigned,rawValueType)=>{name=AsciiToString(name);const valueType=getEnumValueType(rawValueType);switch(valueType){case"object":{function ctor(){}ctor.values={};registerType(rawType,{name,constructor:ctor,valueType,fromWireType:function(c){return this.constructor.values[c]},toWireType:(destructors,c)=>c.value,readValueFromPointer:enumReadValueFromPointer(name,size,isSigned),destructorFunction:null});exposePublicSymbol(name,ctor);break}case"number":{var keysMap={};registerType(rawType,{name,keysMap,valueType,fromWireType:c=>c,toWireType:(destructors,c)=>c,readValueFromPointer:enumReadValueFromPointer(name,size,isSigned),destructorFunction:null});exposePublicSymbol(name,keysMap);delete Module[name].argCount;break}case"string":{var valuesMap={};var reverseMap={};var keysMap={};registerType(rawType,{name,valuesMap,reverseMap,keysMap,valueType,fromWireType:function(c){return this.reverseMap[c]},toWireType:function(destructors,c){return this.valuesMap[c]},readValueFromPointer:enumReadValueFromPointer(name,size,isSigned),destructorFunction:null});exposePublicSymbol(name,keysMap);delete Module[name].argCount;break}}};var __embind_register_enum_value=(rawEnumType,name,enumValue)=>{var enumType=requireRegisteredType(rawEnumType,"enum");name=AsciiToString(name);switch(enumType.valueType){case"object":{var Enum=enumType.constructor;var Value=Object.create(enumType.constructor.prototype,{value:{value:enumValue},constructor:{value:createNamedFunction("".concat(enumType.name,"_").concat(name),function(){})}});Enum.values[enumValue]=Value;Enum[name]=Value;break}case"number":{enumType.keysMap[name]=enumValue;break}case"string":{enumType.valuesMap[name]=enumValue;enumType.reverseMap[enumValue]=name;enumType.keysMap[name]=name;break}}};var floatReadValueFromPointer=(name,width)=>{switch(width){case 4:return function(pointer){return this.fromWireType(HEAPF32[pointer>>2])};case 8:return function(pointer){return this.fromWireType(HEAPF64[pointer>>3])};default:throw new TypeError("invalid float width (".concat(width,"): ").concat(name))}};var __embind_register_float=(rawType,name,size)=>{name=AsciiToString(name);registerType(rawType,{name,fromWireType:value=>value,toWireType:(destructors,value)=>value,readValueFromPointer:floatReadValueFromPointer(name,size),destructorFunction:null})};var __embind_register_function=(name,argCount,rawArgTypesAddr,signature,rawInvoker,fn,isAsync,isNonnullReturn)=>{var argTypes=heap32VectorToArray(argCount,rawArgTypesAddr);name=AsciiToString(name);name=getFunctionName(name);rawInvoker=embind__requireFunction(signature,rawInvoker,isAsync);exposePublicSymbol(name,function(){throwUnboundTypeError("Cannot call ".concat(name," due to unbound types"),argTypes)},argCount-1);whenDependentTypesAreResolved([],argTypes,argTypes=>{var invokerArgsArray=[argTypes[0],null].concat(argTypes.slice(1));replacePublicSymbol(name,craftInvokerFunction(name,invokerArgsArray,null,rawInvoker,fn,isAsync),argCount-1);return[]})};var integerReadValueFromPointer=(name,width,signed)=>{switch(width){case 1:return signed?pointer=>HEAP8[pointer]:pointer=>HEAPU8[pointer];case 2:return signed?pointer=>HEAP16[pointer>>1]:pointer=>HEAPU16[pointer>>1];case 4:return signed?pointer=>HEAP32[pointer>>2]:pointer=>HEAPU32[pointer>>2];default:throw new TypeError("invalid integer width (".concat(width,"): ").concat(name))}};var __embind_register_integer=(primitiveType,name,size,minRange,maxRange)=>{name=AsciiToString(name);const isUnsignedType=minRange===0;let fromWireType=value=>value;if(isUnsignedType){var bitshift=32-8*size;fromWireType=value=>value<<bitshift>>>bitshift;maxRange=fromWireType(maxRange)}registerType(primitiveType,{name,fromWireType,toWireType:(destructors,value)=>value,readValueFromPointer:integerReadValueFromPointer(name,size,minRange!==0),destructorFunction:null})};var installIndexedIterator=(proto,sizeMethodName,getMethodName)=>{const makeIterator=(size,getValue)=>{let index=0;return{next(){if(index>=size){return{done:true}}const current=index;index++;const value=getValue(current);return{value,done:false}},[Symbol.iterator](){return this}}};if(!proto[Symbol.iterator]){proto[Symbol.iterator]=function(){const size=this[sizeMethodName]();return makeIterator(size,i=>this[getMethodName](i))}}};var __embind_register_iterable=(rawClassType,rawElementType,sizeMethodName,getMethodName)=>{sizeMethodName=AsciiToString(sizeMethodName);getMethodName=AsciiToString(getMethodName);whenDependentTypesAreResolved([],[rawClassType,rawElementType],types=>{const classType=types[0];installIndexedIterator(classType.registeredClass.instancePrototype,sizeMethodName,getMethodName);return[]})};var __embind_register_memory_view=(rawType,dataTypeIndex,name)=>{var typeMapping=[Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array];var TA=typeMapping[dataTypeIndex];function decodeMemoryView(handle){var size=HEAPU32[handle>>2];var data=HEAPU32[handle+4>>2];return new TA(HEAP8.buffer,data,size)}name=AsciiToString(name);registerType(rawType,{name,fromWireType:decodeMemoryView,readValueFromPointer:decodeMemoryView},{ignoreDuplicateRegistrations:true})};var EmValOptionalType=Object.assign({optional:true},EmValType);var __embind_register_optional=(rawOptionalType,rawType)=>{registerType(rawOptionalType,EmValOptionalType)};var stringToUTF8Array=(str,heap,outIdx,maxBytesToWrite)=>{if(!(maxBytesToWrite>0))return 0;var startIdx=outIdx;var endIdx=outIdx+maxBytesToWrite-1;for(var i=0;i<str.length;++i){var u=str.codePointAt(i);if(u<=127){if(outIdx>=endIdx)break;heap[outIdx++]=u}else if(u<=2047){if(outIdx+1>=endIdx)break;heap[outIdx++]=192|u>>6;heap[outIdx++]=128|u&63}else if(u<=65535){if(outIdx+2>=endIdx)break;heap[outIdx++]=224|u>>12;heap[outIdx++]=128|u>>6&63;heap[outIdx++]=128|u&63}else{if(outIdx+3>=endIdx)break;heap[outIdx++]=240|u>>18;heap[outIdx++]=128|u>>12&63;heap[outIdx++]=128|u>>6&63;heap[outIdx++]=128|u&63;i++}}heap[outIdx]=0;return outIdx-startIdx};var stringToUTF8=(str,outPtr,maxBytesToWrite)=>stringToUTF8Array(str,HEAPU8,outPtr,maxBytesToWrite);var lengthBytesUTF8=str=>{var len=0;for(var i=0;i<str.length;++i){var c=str.charCodeAt(i);if(c<=127){len++}else if(c<=2047){len+=2}else if(c>=55296&&c<=57343){len+=4;++i}else{len+=3}}return len};var UTF8Decoder=globalThis.TextDecoder&&new TextDecoder;var findStringEnd=(heapOrArray,idx,maxBytesToRead,ignoreNul)=>{var maxIdx=idx+maxBytesToRead;if(ignoreNul)return maxIdx;while(heapOrArray[idx]&&!(idx>=maxIdx))++idx;return idx};var UTF8ArrayToString=function(heapOrArray){let idx=arguments.length>1&&arguments[1]!==undefined?arguments[1]:0;let maxBytesToRead=arguments.length>2?arguments[2]:undefined;let ignoreNul=arguments.length>3?arguments[3]:undefined;var endPtr=findStringEnd(heapOrArray,idx,maxBytesToRead,ignoreNul);if(endPtr-idx>16&&heapOrArray.buffer&&UTF8Decoder){return UTF8Decoder.decode(heapOrArray.subarray(idx,endPtr))}var str="";while(idx<endPtr){var u0=heapOrArray[idx++];if(!(u0&128)){str+=String.fromCharCode(u0);continue}var u1=heapOrArray[idx++]&63;if((u0&224)==192){str+=String.fromCharCode((u0&31)<<6|u1);continue}var u2=heapOrArray[idx++]&63;if((u0&240)==224){u0=(u0&15)<<12|u1<<6|u2}else{u0=(u0&7)<<18|u1<<12|u2<<6|heapOrArray[idx++]&63}if(u0<65536){str+=String.fromCharCode(u0)}else{var ch=u0-65536;str+=String.fromCharCode(55296|ch>>10,56320|ch&1023)}}return str};var UTF8ToString=(ptr,maxBytesToRead,ignoreNul)=>ptr?UTF8ArrayToString(HEAPU8,ptr,maxBytesToRead,ignoreNul):"";var __embind_register_std_string=(rawType,name)=>{name=AsciiToString(name);var stdStringIsUTF8=true;registerType(rawType,{name,fromWireType(value){var length=HEAPU32[value>>2];var payload=value+4;var str;if(stdStringIsUTF8){str=UTF8ToString(payload,length,true)}else{str="";for(var i=0;i<length;++i){str+=String.fromCharCode(HEAPU8[payload+i])}}_free(value);return str},toWireType(destructors,value){if(value instanceof ArrayBuffer){value=new Uint8Array(value)}var length;var valueIsOfTypeString=typeof value=="string";if(!(valueIsOfTypeString||ArrayBuffer.isView(value)&&value.BYTES_PER_ELEMENT==1)){throwBindingError("Cannot pass non-string to std::string")}if(stdStringIsUTF8&&valueIsOfTypeString){length=lengthBytesUTF8(value)}else{length=value.length}var base=_malloc(4+length+1);var ptr=base+4;HEAPU32[base>>2]=length;if(valueIsOfTypeString){if(stdStringIsUTF8){stringToUTF8(value,ptr,length+1)}else{for(var i=0;i<length;++i){var charCode=value.charCodeAt(i);if(charCode>255){_free(base);throwBindingError("String has UTF-16 code units that do not fit in 8 bits")}HEAPU8[ptr+i]=charCode}}}else{HEAPU8.set(value,ptr)}if(destructors!==null){destructors.push(_free,base)}return base},readValueFromPointer:readPointer,destructorFunction(ptr){_free(ptr)}})};var UTF16Decoder=globalThis.TextDecoder?new TextDecoder("utf-16le"):undefined;var UTF16ToString=(ptr,maxBytesToRead,ignoreNul)=>{var idx=ptr>>1;var endIdx=findStringEnd(HEAPU16,idx,maxBytesToRead/2,ignoreNul);if(endIdx-idx>16&&UTF16Decoder)return UTF16Decoder.decode(HEAPU16.subarray(idx,endIdx));var str="";for(var i=idx;i<endIdx;++i){var codeUnit=HEAPU16[i];str+=String.fromCharCode(codeUnit)}return str};var stringToUTF16=(str,outPtr,maxBytesToWrite)=>{maxBytesToWrite!==null&&maxBytesToWrite!==void 0?maxBytesToWrite:maxBytesToWrite=2147483647;if(maxBytesToWrite<2)return 0;maxBytesToWrite-=2;var startPtr=outPtr;var numCharsToWrite=maxBytesToWrite<str.length*2?maxBytesToWrite/2:str.length;for(var i=0;i<numCharsToWrite;++i){var codeUnit=str.charCodeAt(i);HEAP16[outPtr>>1]=codeUnit;outPtr+=2}HEAP16[outPtr>>1]=0;return outPtr-startPtr};var lengthBytesUTF16=str=>str.length*2;var UTF32ToString=(ptr,maxBytesToRead,ignoreNul)=>{var str="";var startIdx=ptr>>2;for(var i=0;!(i>=maxBytesToRead/4);i++){var utf32=HEAPU32[startIdx+i];if(!utf32&&!ignoreNul)break;str+=String.fromCodePoint(utf32)}return str};var stringToUTF32=(str,outPtr,maxBytesToWrite)=>{maxBytesToWrite!==null&&maxBytesToWrite!==void 0?maxBytesToWrite:maxBytesToWrite=2147483647;if(maxBytesToWrite<4)return 0;var startPtr=outPtr;var endPtr=startPtr+maxBytesToWrite-4;for(var i=0;i<str.length;++i){var codePoint=str.codePointAt(i);if(codePoint>65535){i++}HEAP32[outPtr>>2]=codePoint;outPtr+=4;if(outPtr+4>endPtr)break}HEAP32[outPtr>>2]=0;return outPtr-startPtr};var lengthBytesUTF32=str=>{var len=0;for(var i=0;i<str.length;++i){var codePoint=str.codePointAt(i);if(codePoint>65535){i++}len+=4}return len};var __embind_register_std_wstring=(rawType,charSize,name)=>{name=AsciiToString(name);var decodeString,encodeString,lengthBytesUTF;if(charSize===2){decodeString=UTF16ToString;encodeString=stringToUTF16;lengthBytesUTF=lengthBytesUTF16}else{decodeString=UTF32ToString;encodeString=stringToUTF32;lengthBytesUTF=lengthBytesUTF32}registerType(rawType,{name,fromWireType:value=>{var length=HEAPU32[value>>2];var str=decodeString(value+4,length*charSize,true);_free(value);return str},toWireType:(destructors,value)=>{if(!(typeof value=="string")){throwBindingError("Cannot pass non-string to C++ string type ".concat(name))}var length=lengthBytesUTF(value);var ptr=_malloc(4+length+charSize);HEAPU32[ptr>>2]=length/charSize;encodeString(value,ptr+4,length+charSize);if(destructors!==null){destructors.push(_free,ptr)}return ptr},readValueFromPointer:readPointer,destructorFunction(ptr){_free(ptr)}})};var __embind_register_value_object=(rawType,name,constructorSignature,rawConstructor,destructorSignature,rawDestructor)=>{structRegistrations[rawType]={name:AsciiToString(name),rawConstructor:embind__requireFunction(constructorSignature,rawConstructor),rawDestructor:embind__requireFunction(destructorSignature,rawDestructor),fields:[]}};var __embind_register_value_object_field=(structType,fieldName,getterReturnType,getterSignature,getter,getterContext,setterArgumentType,setterSignature,setter,setterContext)=>{structRegistrations[structType].fields.push({fieldName:AsciiToString(fieldName),getterReturnType,getter:embind__requireFunction(getterSignature,getter),getterContext,setterArgumentType,setter:embind__requireFunction(setterSignature,setter),setterContext})};var __embind_register_void=(rawType,name)=>{name=AsciiToString(name);registerType(rawType,{isVoid:true,name,fromWireType:()=>undefined,toWireType:(destructors,o)=>undefined})};var emval_methodCallers=[];var emval_addMethodCaller=caller=>{var id=emval_methodCallers.length;emval_methodCallers.push(caller);return id};var emval_lookupTypes=(argCount,argTypes)=>{var a=new Array(argCount);for(var i=0;i<argCount;++i){a[i]=requireRegisteredType(HEAPU32[argTypes+i*4>>2],"parameter ".concat(i))}return a};var emval_returnValue=(toReturnWire,destructorsRef,handle)=>{var destructors=[];var result=toReturnWire(destructors,handle);if(destructors.length){HEAPU32[destructorsRef>>2]=Emval.toHandle(destructors)}return result};var emval_symbols={};var getStringOrSymbol=address=>{var symbol=emval_symbols[address];if(symbol===undefined){return AsciiToString(address)}return symbol};var __emval_create_invoker=(argCount,argTypesPtr,kind)=>{var GenericWireTypeSize=8;var[retType,...argTypes]=emval_lookupTypes(argCount,argTypesPtr);var toReturnWire=retType.toWireType.bind(retType);var argFromPtr=argTypes.map(type=>type.readValueFromPointer.bind(type));argCount--;var argN=new Array(argCount);var invokerFunction=(handle,methodName,destructorsRef,args)=>{var offset=0;for(var i=0;i<argCount;++i){argN[i]=argFromPtr[i](args+offset);offset+=GenericWireTypeSize}var rv;switch(kind){case 0:rv=Emval.toValue(handle).apply(null,argN);break;case 2:rv=Reflect.construct(Emval.toValue(handle),argN);break;case 3:rv=argN[0];break;case 1:rv=Emval.toValue(handle)[getStringOrSymbol(methodName)](...argN);break}return emval_returnValue(toReturnWire,destructorsRef,rv)};var functionName="methodCaller<(".concat(argTypes.map(t=>t.name),") => ").concat(retType.name,">");return emval_addMethodCaller(createNamedFunction(functionName,invokerFunction))};var __emval_invoke=(caller,handle,methodName,destructorsRef,args)=>emval_methodCallers[caller](handle,methodName,destructorsRef,args);var __emval_run_destructors=handle=>{var destructors=Emval.toValue(handle);runDestructors(destructors);__emval_decref(handle)};var _emscripten_get_now=()=>performance.now();var _emscripten_date_now=()=>Date.now();var getHeapMax=()=>2147483648;var alignMemory=(size,alignment)=>Math.ceil(size/alignment)*alignment;var growMemory=size=>{var oldHeapSize=wasmMemory.buffer.byteLength;var pages=(size-oldHeapSize+65535)/65536|0;try{wasmMemory.grow(pages);updateMemoryViews();return 1}catch(e){}};var _emscripten_resize_heap=requestedSize=>{var oldSize=HEAPU8.length;requestedSize>>>=0;var maxHeapSize=getHeapMax();if(requestedSize>maxHeapSize){return false}for(var cutDown=1;cutDown<=4;cutDown*=2){var overGrownHeapSize=oldSize*(1+.2/cutDown);overGrownHeapSize=Math.min(overGrownHeapSize,requestedSize+100663296);var newSize=Math.min(maxHeapSize,alignMemory(Math.max(requestedSize,overGrownHeapSize),65536));var replacement=growMemory(newSize);if(replacement){return true}}return false};var runtimeKeepaliveCounter=0;var keepRuntimeAlive=()=>noExitRuntime||runtimeKeepaliveCounter>0;var _proc_exit=code=>{EXITSTATUS=code;if(!keepRuntimeAlive()){var _Module$onExit;(_Module$onExit=Module["onExit"])===null||_Module$onExit===void 0||_Module$onExit.call(Module,code);ABORT=true}quit_(code,new ExitStatus(code))};var exitJS=(status,implicit)=>{EXITSTATUS=status;_proc_exit(status)};var _exit=exitJS;var printCharBuffers=[null,[],[]];var printChar=(stream,curr)=>{var buffer=printCharBuffers[stream];if(curr===0||curr===10){(stream===1?out:err)(UTF8ArrayToString(buffer));buffer.length=0}else{buffer.push(curr)}};var _fd_write=(fd,iov,iovcnt,pnum)=>{var num=0;for(var i=0;i<iovcnt;i++){var ptr=HEAPU32[iov>>2];var len=HEAPU32[iov+4>>2];iov+=8;for(var j=0;j<len;j++){printChar(fd,HEAPU8[ptr+j])}num+=len}HEAPU32[pnum>>2]=num;return 0};init_ClassHandle();init_RegisteredPointer();{initMemory();if(Module["noExitRuntime"])noExitRuntime=Module["noExitRuntime"];if(Module["print"])out=Module["print"];if(Module["printErr"])err=Module["printErr"];if(Module["wasmBinary"])wasmBinary=Module["wasmBinary"];if(Module["arguments"])arguments_=Module["arguments"];if(Module["thisProgram"])thisProgram=Module["thisProgram"];if(Module["preInit"]){if(typeof Module["preInit"]=="function")Module["preInit"]=[Module["preInit"]];while(Module["preInit"].length>0){Module["preInit"].shift()()}}}var ___getTypeName,_free,_malloc,dynCall_vifijiif,dynCall_iijii,dynCall_ji,dynCall_jiji,__indirect_function_table,wasmTable;function assignWasmExports(wasmExports){___getTypeName=wasmExports["K"];_free=Module["_free"]=wasmExports["M"];_malloc=Module["_malloc"]=wasmExports["N"];dynCall_vifijiif=dynCalls["vifijiif"]=wasmExports["O"];dynCall_iijii=dynCalls["iijii"]=wasmExports["P"];dynCall_ji=dynCalls["ji"]=wasmExports["Q"];dynCall_jiji=dynCalls["jiji"]=wasmExports["R"];__indirect_function_table=wasmTable=wasmExports["L"]}var wasmImports={C:__abort_js,I:__embind_create_inheriting_constructor,o:__embind_finalize_value_object,y:__embind_register_bigint,F:__embind_register_bool,c:__embind_register_class,x:__embind_register_class_class_function,g:__embind_register_class_constructor,b:__embind_register_class_function,h:__embind_register_class_property,H:__embind_register_constant,D:__embind_register_emval,j:__embind_register_enum,d:__embind_register_enum_value,w:__embind_register_float,k:__embind_register_function,q:__embind_register_integer,r:__embind_register_iterable,i:__embind_register_memory_view,s:__embind_register_optional,E:__embind_register_std_string,u:__embind_register_std_wstring,p:__embind_register_value_object,f:__embind_register_value_object_field,G:__embind_register_void,n:__emval_create_invoker,t:__emval_decref,m:__emval_invoke,l:__emval_run_destructors,B:_emscripten_date_now,e:_emscripten_get_now,z:_emscripten_resize_heap,A:_exit,v:_fd_write,a:wasmMemory};function run(){preRun();function doRun(){var _readyPromiseResolve,_Module$onRuntimeInit;Module["calledRun"]=true;if(ABORT)return;initRuntime();(_readyPromiseResolve=readyPromiseResolve)===null||_readyPromiseResolve===void 0||_readyPromiseResolve(Module);(_Module$onRuntimeInit=Module["onRuntimeInitialized"])===null||_Module$onRuntimeInit===void 0||_Module$onRuntimeInit.call(Module);postRun()}if(Module["setStatus"]){Module["setStatus"]("Running...");setTimeout(()=>{setTimeout(()=>Module["setStatus"](""),1);doRun()},1)}else{doRun()}}var wasmExports;wasmExports=await (createWasm());run();if(runtimeInitialized){moduleRtn=Module}else{moduleRtn=new Promise((resolve,reject)=>{readyPromiseResolve=resolve;readyPromiseReject=reject})}
;return moduleRtn}})();if(typeof exports==="object"&&typeof module==="object"){module.exports=PHYSX;module.exports.default=PHYSX}else if(typeof define==="function"&&define["amd"])define([],()=>PHYSX);
// Keep the PhysX factory options while resolving the external wasm through
// Laya's adapter (IDE bin:// paths and platform-specific wasm loading).
if (typeof window !== "undefined") {
    var _PHYSX_Module = PHYSX;
    var _PHYSX_ModuleOptions;
    var _PHYSX_ScriptDirectory;

    // In Electron document.currentScript may already be null when the loader runs.
    // Recover the PhysX script URL from the loaded script tags so the wasm stays
    // relative to laya.physX.wasm.js instead of falling back to the IDE bin root.
    if (typeof document !== "undefined") {
        var _PHYSX_IsScript = function (script) {
            if (!script || !script.src)
                return false;
            var src = script.src.replace(/[?#].*/, "").toLowerCase();
            return src.endsWith("/physx.wasm.js") || src.endsWith("/laya.physx.wasm.js");
        };
        var _PHYSX_Script = document.currentScript;
        if (!_PHYSX_IsScript(_PHYSX_Script)) {
            var _PHYSX_Scripts = document.getElementsByTagName("script");
            for (var i = _PHYSX_Scripts.length - 1; i >= 0; i--) {
                if (_PHYSX_IsScript(_PHYSX_Scripts[i])) {
                    _PHYSX_Script = _PHYSX_Scripts[i];
                    break;
                }
            }
        }
        if (_PHYSX_IsScript(_PHYSX_Script)) {
            var _PHYSX_ScriptSrc = _PHYSX_Script.src.replace(/[?#].*/, "");
            _PHYSX_ScriptDirectory = _PHYSX_ScriptSrc.substring(0, _PHYSX_ScriptSrc.lastIndexOf("/") + 1);
        }
    }

    var _PHYSX_Loader = Laya.WasmAdapter.create(function (adapterOptions) {
        var moduleOptions = _PHYSX_ModuleOptions;
        _PHYSX_ModuleOptions = null;
        var options = Object.assign(adapterOptions, moduleOptions || {});

        // Electron loads the library through file://. If the adapter cannot get
        // webDir, explicitly keep the wasm beside the PhysX JavaScript library.
        // Other environments continue to use WasmAdapter's platform resolution.
        if ((!moduleOptions || !moduleOptions.locateFile)
            && _PHYSX_ScriptDirectory
            && _PHYSX_ScriptDirectory.startsWith("file:")) {
            var adapterLocateFile = options.locateFile;
            options.locateFile = function (path, scriptDirectory) {
                if (path === "physx.release.wasm")
                    return _PHYSX_ScriptDirectory + path;
                return adapterLocateFile ? adapterLocateFile(path, scriptDirectory) : scriptDirectory + path;
            };
        }
        return _PHYSX_Module(options);
    }, "physx.release.wasm");

    window.PHYSX = function (moduleOptions) {
        _PHYSX_ModuleOptions = moduleOptions;
        return _PHYSX_Loader();
    };
} else if (typeof exports === "object" && typeof module !== "object") {
    exports["PHYSX"] = PHYSX;
}
}
