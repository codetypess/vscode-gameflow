(function (exports, Laya) {
    'use strict';

    exports.PhysicsCombineMode = void 0;
    (function (PhysicsCombineMode) {
        PhysicsCombineMode[PhysicsCombineMode["Average"] = 0] = "Average";
        PhysicsCombineMode[PhysicsCombineMode["Minimum"] = 1] = "Minimum";
        PhysicsCombineMode[PhysicsCombineMode["Multiply"] = 2] = "Multiply";
        PhysicsCombineMode[PhysicsCombineMode["Maximum"] = 3] = "Maximum";
    })(exports.PhysicsCombineMode || (exports.PhysicsCombineMode = {}));
    exports.PhysicsForceMode = void 0;
    (function (PhysicsForceMode) {
        PhysicsForceMode[PhysicsForceMode["Force"] = 0] = "Force";
        PhysicsForceMode[PhysicsForceMode["Impulse"] = 1] = "Impulse";
    })(exports.PhysicsForceMode || (exports.PhysicsForceMode = {}));
    class PhysicsColliderComponent extends Laya.Component {
        get collider() {
            return this._collider;
        }
        get restitution() {
            return this._restitution;
        }
        set restitution(value) {
            this._restitution = value;
            if (this._collider && this._collider.getCapable(Laya.EColliderCapable.Collider_Restitution)) {
                this._collider.setBounciness(value);
            }
        }
        get friction() {
            return this._friction;
        }
        set friction(value) {
            this._friction = value;
            if (this._collider && this._collider.getCapable(Laya.EColliderCapable.Collider_Friction)) {
                this._collider.setfriction(value);
            }
            if (this._collider && this._collider.getCapable(Laya.EColliderCapable.Collider_StaticFriction)) {
                this._collider.setStaticFriction(this.staticFriction);
            }
            if (this._collider && this._collider.getCapable(Laya.EColliderCapable.Collider_DynamicFriction)) {
                this._collider.setDynamicFriction(this.dynamicFriction);
            }
        }
        get rollingFriction() {
            return this._rollingFriction;
        }
        set rollingFriction(value) {
            this._rollingFriction = value;
            if (this._collider && this._collider.getCapable(Laya.EColliderCapable.Collider_RollingFriction)) {
                this._collider.setRollingFriction(value);
            }
        }
        get dynamicFriction() {
            return this._hasDynamicFriction ? this._dynamicFriction : this._friction;
        }
        set dynamicFriction(value) {
            this._dynamicFriction = value;
            this._hasDynamicFriction = true;
            if (this._collider && this._collider.getCapable(Laya.EColliderCapable.Collider_DynamicFriction)) {
                this._collider.setDynamicFriction(value);
            }
        }
        get staticFriction() {
            return this._hasStaticFriction ? this._staticFriction : this._friction;
        }
        set staticFriction(value) {
            this._staticFriction = value;
            this._hasStaticFriction = true;
            if (this._collider && this._collider.getCapable(Laya.EColliderCapable.Collider_StaticFriction)) {
                this._collider.setStaticFriction(value);
            }
        }
        get frictionCombine() {
            return this._frictionCombine;
        }
        set frictionCombine(value) {
            this._frictionCombine = value;
            if (this._collider && this._collider.getCapable(Laya.EColliderCapable.Collider_FrictionCombine)) {
                this._collider.setFrictionCombine(value);
            }
        }
        get restitutionCombine() {
            return this._restitutionCombine;
        }
        set restitutionCombine(value) {
            this._restitutionCombine = value;
            if (this._collider && this._collider.getCapable(Laya.EColliderCapable.Collider_BounceCombine)) {
                this._collider.setBounceCombine(value);
            }
        }
        get colliderShape() {
            return this._colliderShape;
        }
        set colliderShape(value) {
            if (value == this._colliderShape) {
                return;
            }
            this._colliderShape && this._colliderShape.destroy();
            this._colliderShape = value;
            if (value)
                value.physicsComponent = this;
            if (this._collider && value) {
                this._collider.setColliderShape(value._shape);
            }
        }
        get collisionGroup() {
            return this._collisionGroup;
        }
        set collisionGroup(value) {
            if (this._collisionGroup !== value) {
                this._collisionGroup = value;
            }
            if (this._collider && this._collider.getCapable(Laya.EColliderCapable.Collider_CollisionGroup)) {
                if (this._colliderShape && this._enabled) {
                    this._collider.setCollisionGroup(value);
                }
            }
        }
        get canCollideWith() {
            return this._canCollideWith;
        }
        set canCollideWith(value) {
            if (this._canCollideWith !== value) {
                this._canCollideWith = value;
            }
            if (this._collider && this._collider.getCapable(Laya.EColliderCapable.Collider_CollisionGroup)) {
                if (this._colliderShape && this._enabled) {
                    this._collider.setCanCollideWith(value);
                }
            }
        }
        constructor() {
            super();
            this._restitution = 0.0;
            this._friction = 0.5;
            this._rollingFriction = 0.0;
            this._dynamicFriction = 0.0;
            this._staticFriction = 0.0;
            this._hasDynamicFriction = false;
            this._hasStaticFriction = false;
            this._frictionCombine = 0.0;
            this._restitutionCombine = 0.0;
            this._collisionGroup = 0x1;
            this._canCollideWith = -1;
            this._colliderShape = null;
            this._transformFlag = 2147483647;
            this._controlBySimulation = false;
            this._isColliderInit = false;
        }
        initCollider() {
            this._initCollider();
            this._collider.setOwner(this.owner);
            this._physicsManager.setActiveCollider(this.collider, this.enabled);
            if (this._colliderShape)
                this._collider.setColliderShape(this._colliderShape._shape);
            this.collisionGroup = this._collisionGroup;
            this.canCollideWith = this._canCollideWith;
        }
        _initCollider() {
        }
        _setEventFilter() {
        }
        _onAdded() {
        }
        _onEnable() {
            if (!this._isColliderInit) {
                this.initCollider();
                this._isColliderInit = true;
            }
            this.owner.transform.on(Laya.Event.TRANSFORM_CHANGED, this, this._onTransformChanged);
            this._physicsManager = this.owner._scene._physicsManager;
            this._collider && (this._collider.componentEnable = true);
            if (this._colliderShape) {
                this._physicsManager.setActiveCollider(this.collider, true);
                this._physicsManager.addCollider(this._collider);
            }
            this.owner.on(Laya.Event.UPDATE_PHY_EVENT_FILTER, this, this._setEventFilter);
            this._setEventFilter();
        }
        _onDisable() {
            this.owner.transform.off(Laya.Event.TRANSFORM_CHANGED, this, this._onTransformChanged);
            this._collider && (this._collider.componentEnable = false);
            if (this._colliderShape) {
                this._physicsManager.removeCollider(this._collider);
                this._physicsManager.setActiveCollider(this.collider, false);
            }
            this._physicsManager = null;
            this.owner.off(Laya.Event.UPDATE_PHY_EVENT_FILTER, this, this._setEventFilter);
        }
        _onDestroy() {
            this._collider && this._collider.destroy();
            this._colliderShape && this._colliderShape.destroy();
            this._collider = null;
            this._isColliderInit = false;
            this._colliderShape = null;
            this._physicsManager = null;
        }
        _onTransformChanged(flag) {
            if (!this._controlBySimulation) {
                flag &= Laya.Transform3D.TRANSFORM_WORLDPOSITION | Laya.Transform3D.TRANSFORM_WORLDQUATERNION | Laya.Transform3D.TRANSFORM_WORLDSCALE;
                if (flag && this._colliderShape && this._enabled) {
                    this._transformFlag |= flag;
                    this._collider.transformChanged(flag);
                }
            }
        }
        _cloneTo(dest) {
            dest.restitution = this._restitution;
            dest._hasDynamicFriction = this._hasDynamicFriction;
            dest._hasStaticFriction = this._hasStaticFriction;
            dest._dynamicFriction = this._dynamicFriction;
            dest._staticFriction = this._staticFriction;
            dest.friction = this._friction;
            dest.rollingFriction = this._rollingFriction;
            dest.frictionCombine = this.frictionCombine;
            dest.restitutionCombine = this.restitutionCombine;
            dest.collisionGroup = this._collisionGroup;
            dest.canCollideWith = this._canCollideWith;
            (this._colliderShape) && (dest.colliderShape = this._colliderShape.clone());
        }
    }

    class Physics3DColliderShape {
        get shape() {
            return this._shape;
        }
        get localOffset() {
            return this._localOffset;
        }
        set localOffset(value) {
            this._localOffset = value;
            this._shape.setOffset(value);
        }
        get physicsComponent() {
            return this._physicsComponent;
        }
        set physicsComponent(value) {
            this._physicsComponent = value;
        }
        constructor() {
            this._localOffset = new Laya.Vector3(0, 0, 0);
            this._createShape();
        }
        _createShape() {
            throw "override it";
        }
        cloneTo(destObject) {
            this._localOffset.cloneTo(destObject.localOffset);
            destObject.localOffset = destObject.localOffset;
        }
        clone() {
            return null;
        }
        destroy() {
            if (this._shape) {
                this._shape.destroy();
                this._shape = null;
            }
        }
    }
    Physics3DColliderShape.SHAPEORIENTATION_UPX = 0;
    Physics3DColliderShape.SHAPEORIENTATION_UPY = 1;
    Physics3DColliderShape.SHAPEORIENTATION_UPZ = 2;

    class CapsuleColliderShape extends Physics3DColliderShape {
        get radius() {
            return this._radius;
        }
        set radius(value) {
            this._radius = value;
            if (Laya.LayaEnv.isPlaying) {
                this._shape.setRadius(value);
            }
        }
        get length() {
            return this._length;
        }
        set length(value) {
            this._length = value;
            if (Laya.LayaEnv.isPlaying) {
                this._shape.setHeight(value);
            }
        }
        get orientation() {
            return this._orientation;
        }
        set orientation(value) {
            this._orientation = value;
            if (Laya.LayaEnv.isPlaying) {
                this._shape.setUpAxis(value);
            }
        }
        constructor(radius = 0.5, length = 2, orientation = Physics3DColliderShape.SHAPEORIENTATION_UPY) {
            super();
            this.radius = radius;
            this.length = length;
            this.orientation = orientation;
        }
        _createShape() {
            if (Laya.Laya3D.PhysicsCreateUtil.getPhysicsCapable(Laya.EPhysicsCapable.Physics_CapsuleColliderShape))
                this._shape = Laya.Laya3D.PhysicsCreateUtil.createCapsuleColliderShape();
            else {
                console.error("CapsuleColliderShape: cant enable CapsuleColliderShape");
            }
        }
        clone() {
            var dest = new CapsuleColliderShape(this._radius, this._length, this._orientation);
            this.cloneTo(dest);
            return dest;
        }
        cloneTo(destObject) {
            super.cloneTo(destObject);
            destObject.radius = this.radius;
            destObject.length = this.length;
            destObject.orientation = this.orientation;
        }
    }

    class CharacterController extends PhysicsColliderComponent {
        _initCollider() {
            this._physicsManager = this.owner.scene.physicsSimulation;
            if (Laya.Laya3D.enablePhysics && this._physicsManager && Laya.Laya3D.PhysicsCreateUtil.getPhysicsCapable(Laya.EPhysicsCapable.Physics_CharacterCollider)) {
                this._physicsManager = this.owner._scene._physicsManager;
                this._collider = Laya.Laya3D.PhysicsCreateUtil.createCharacterController(this._physicsManager);
                if (this.colliderShape) {
                    this.colliderShape.destroy();
                }
                this.colliderShape = new CapsuleColliderShape(this.radius, this.height);
                this.colliderShape.localOffset = this._offset;
                this._collider.component = this;
            }
            else {
                console.error("CharacterController: cant enable CharacterController");
            }
        }
        _onEnable() {
            super._onEnable();
            this.radius = this._radius;
            this.height = this._height;
            this.gravity = this._gravity;
            this.minDistance = this._minDistance;
            this.pushForce = this._pushForce;
            this.centerOffset = this._offset;
            this.skinWidth = this._contactOffset;
            this.maxSlope = this._maxSlope;
            this.stepHeight = this._stepHeight;
            this.upAxis = this._upAxis;
        }
        onUpdate() {
            if (this._collider && this._collider.getCapable(Laya.ECharacterCapable.Character_SimulateGravity)) {
                if (this._collider.simulateGravity) {
                    this._collider.simulateGravity(Laya.ILaya.timer.delta / 1000);
                }
                else {
                    this._simGravity.setValue(this._gravity.x / 60.0, this._gravity.y / 60.0, this._gravity.z / 60.0);
                    this.move(this._simGravity);
                }
            }
        }
        get radius() {
            return this._radius;
        }
        set radius(value) {
            this._radius = value;
            this._colliderShape && (this._colliderShape.radius = value);
            if (this._collider && this.collider.getCapable(Laya.ECharacterCapable.Character_Radius)) {
                this._collider.setRadius(this._radius);
            }
        }
        get height() {
            return this._height;
        }
        set height(value) {
            this._height = value;
            this._colliderShape && (this._colliderShape.length = value);
            if (this._collider && this.collider.getCapable(Laya.ECharacterCapable.Character_Height)) {
                this._collider.setHeight(this._height);
            }
        }
        get minDistance() {
            return this._minDistance;
        }
        set minDistance(value) {
            this._minDistance = value;
            if (this._collider && this.collider.getCapable(Laya.ECharacterCapable.Character_minDistance)) {
                this._collider.setminDistance(this._minDistance);
            }
        }
        get centerOffset() {
            return this._offset;
        }
        set centerOffset(value) {
            this._offset = value;
            this._colliderShape && (this._colliderShape.localOffset = value);
            if (this._collider && this.collider.getCapable(Laya.ECharacterCapable.Character_offset)) {
                this._collider.setShapelocalOffset(this._offset);
            }
        }
        get gravity() {
            return this._gravity;
        }
        set gravity(value) {
            this._gravity = value;
            if (this._collider && this.collider.getCapable(Laya.ECharacterCapable.Charcater_Gravity)) {
                this._collider.setGravity(value);
            }
        }
        get skinWidth() {
            return this._contactOffset;
        }
        set skinWidth(value) {
            this._contactOffset = value;
            if (this._collider && this.collider.getCapable(Laya.ECharacterCapable.Character_Skin)) {
                this._collider.setSkinWidth(value);
            }
        }
        get maxSlope() {
            return this._maxSlope;
        }
        set maxSlope(value) {
            this._maxSlope = value;
            if (this._collider && this.collider.getCapable(Laya.ECharacterCapable.Character_SlopeLimit)) {
                this._collider.setSlopeLimit(value);
            }
        }
        get stepHeight() {
            return this._stepHeight;
        }
        set stepHeight(value) {
            this._stepHeight = value;
            if (this._collider && this.collider.getCapable(Laya.ECharacterCapable.Charcater_StepOffset)) {
                this._collider.setStepOffset(value);
            }
        }
        get upAxis() {
            return this._upAxis;
        }
        set upAxis(value) {
            this._upAxis = value;
            if (this._collider && this.collider.getCapable(Laya.ECharacterCapable.Character_UpDirection)) {
                this._collider.setUpDirection(value);
            }
        }
        get position() {
            if (this._collider && this.collider.getCapable(Laya.ECharacterCapable.Charcater_WorldPosition)) {
                return this._collider.getPosition();
            }
            else {
                return null;
            }
        }
        set position(v) {
            if (this._collider && this.collider.getCapable(Laya.ECharacterCapable.Charcater_WorldPosition)) {
                this._collider.setPosition(v);
            }
        }
        get pushForce() {
            return this._pushForce;
        }
        set pushForce(value) {
            this._pushForce = value;
            if (this._collider && this.collider.getCapable(Laya.ECharacterCapable.Character_PushForce)) {
                this._collider.setPushForce(value);
            }
        }
        get jumpSpeed() {
            return this._jumpSpeed;
        }
        set jumpSpeed(value) {
            this._jumpSpeed = value;
            if (this._collider && this.collider.getCapable(Laya.ECharacterCapable.Charcater_Jump)) {
                this._collider.setJumpSpeed(value);
            }
        }
        constructor() {
            super();
            this._stepHeight = 0.1;
            this._upAxis = new Laya.Vector3(0, 1, 0);
            this._maxSlope = 90.0;
            this._gravity = new Laya.Vector3(0, -9.8, 0);
            this._radius = 0.5;
            this._height = 2;
            this._offset = new Laya.Vector3();
            this._contactOffset = 0.0;
            this._minDistance = 0;
            this._simGravity = new Laya.Vector3(0, -9.8 / 60, 0);
            this._pushForce = 1;
            this._jumpSpeed = 10.0;
            this.colliderShape = new CapsuleColliderShape(this.radius, this.height);
        }
        getVerticalVel() {
            return this._collider ? this._collider.getVerticalVel() : 0;
        }
        move(movement) {
            if (this._collider && this.collider.getCapable(Laya.ECharacterCapable.Charcater_Move)) {
                this._collider.move(movement);
            }
        }
        jump(velocity = null) {
            if (this._collider && this.collider.getCapable(Laya.ECharacterCapable.Charcater_Jump)) {
                if (velocity) {
                    this._collider.jump(velocity);
                }
                else {
                    this._collider.jump(velocity);
                }
            }
        }
        isOnGround() {
            return this._collider ? this._collider.isGrounded() : false;
        }
        _cloneTo(dest) {
            super._cloneTo(dest);
            dest.stepHeight = this._stepHeight;
            dest.upAxis = this._upAxis;
            dest.maxSlope = this._maxSlope;
            dest.gravity = this._gravity;
        }
        _setEventFilter() {
            if (this._collider && this._collider.getCapable(Laya.ECharacterCapable.Character_EventFilter)) {
                this._eventsArray = [];
                if (this.owner.hasListener(Laya.Event.COLLISION_ENTER)) {
                    this._eventsArray.push(Laya.Event.COLLISION_ENTER);
                }
                if (this.owner.hasListener(Laya.Event.COLLISION_STAY)) {
                    this._eventsArray.push(Laya.Event.COLLISION_STAY);
                }
                if (this.owner.hasListener(Laya.Event.COLLISION_EXIT)) {
                    this._eventsArray.push(Laya.Event.COLLISION_EXIT);
                }
                this._collider.setEventFilter(this._eventsArray);
            }
        }
    }

    class ConstraintComponent extends Laya.Component {
        initJoint() {
            this._initJoint();
            if (!this._joint)
                return;
            this._joint.setOwner(this.owner);
            this._joint.setLocalPos(this._ownColliderLocalPos);
            this._joint.setConnectLocalPos(this._connectColliderLocalPos);
            this._joint.setBreakForce(this.breakForce);
            this._joint.setBreakTorque(this._breakTorque);
            this._joint.isCollision(this._enableCollison);
            this._syncJointBodies();
        }
        _initJoint() {
        }
        get connectedBody() {
            return this._connectCollider;
        }
        set connectedBody(value) {
            if (!value || this._connectCollider == value)
                return;
            this._connectCollider = value;
            this._syncJointBodies();
        }
        get ownBody() {
            return this._ownCollider;
        }
        set ownBody(value) {
            if (!value || this._ownCollider == value)
                return;
            this._ownCollider = value;
            this._syncJointBodies();
        }
        get currentForce() {
            if (this._joint)
                return this._joint.getlinearForce();
            else {
                console.error("joint is illegal");
                return null;
            }
        }
        get currentTorque() {
            if (this._joint)
                return this._joint.getAngularForce();
            else {
                console.error("joint is illegal");
                return null;
            }
        }
        get breakForce() {
            return this._breakForce;
        }
        set breakForce(value) {
            this._breakForce = value;
            this._joint && this._joint.setBreakForce(value);
        }
        get breakTorque() {
            return this._breakTorque;
        }
        set breakTorque(value) {
            this._breakTorque = value;
            this._joint && this._joint.setBreakTorque(value);
        }
        get anchor() {
            return this._ownColliderLocalPos;
        }
        set anchor(value) {
            value.cloneTo(this._ownColliderLocalPos);
            this._joint && this._joint.setLocalPos(value);
        }
        get connectAnchor() {
            return this._connectColliderLocalPos;
        }
        set connectAnchor(value) {
            value.cloneTo(this._connectColliderLocalPos);
            this._joint && this._joint.setConnectLocalPos(this._connectColliderLocalPos);
        }
        get enableCollison() {
            return this._enableCollison;
        }
        set enableCollison(value) {
            var _a;
            this._enableCollison = value;
            (_a = this._joint) === null || _a === void 0 ? void 0 : _a.isCollision(value);
            if (this._jointReady)
                this._onJointReady();
        }
        constructor() {
            super();
            this._enableCollison = false;
            this._breakForce = Number.MAX_VALUE;
            this._breakTorque = Number.MAX_VALUE;
            this._ownColliderLocalPos = new Laya.Vector3();
            this._connectColliderLocalPos = new Laya.Vector3();
            this._isJointInit = false;
            this._jointReady = false;
            this._singleton = false;
        }
        _onAdded() {
        }
        setOverrideNumSolverIterations(overideNumIterations) {
        }
        setConstraintEnabled(enable) {
        }
        _syncJointBodies() {
            var _a, _b;
            const own = (_a = this._ownCollider) === null || _a === void 0 ? void 0 : _a.collider;
            const connected = (_b = this._connectCollider) === null || _b === void 0 ? void 0 : _b.collider;
            if (!this._joint || !own || !connected)
                return;
            if (own === this._boundOwnCollider && connected === this._boundConnectCollider)
                return;
            this._jointReady = false;
            this._joint.setCollider(own);
            this._joint.setConnectedCollider(connected);
            this._boundOwnCollider = own;
            this._boundConnectCollider = connected;
            this._jointReady = true;
            this._joint.setBreakForce(this._breakForce);
            this._joint.setBreakTorque(this._breakTorque);
            this._onJointReady();
            this._joint.isEnable(this.enabled);
        }
        _onJointReady() {
        }
        onStart() {
            this._syncJointBodies();
        }
        _onEnable() {
            if (!this._isJointInit) {
                this.initJoint();
                this._isJointInit = !!this._joint;
            }
            this._syncJointBodies();
        }
        _onDestroy() {
            this._joint && this._joint.destroy();
            this._joint = null;
            this._ownCollider = null;
            this._connectCollider = null;
            this._physicsManager = null;
            this._isJointInit = false;
            this._jointReady = false;
            this._boundOwnCollider = this._boundConnectCollider = null;
        }
        isBreakConstrained() {
            return this._joint.isValid();
        }
    }

    class ConfigurableConstraint extends ConstraintComponent {
        constructor() {
            super();
            this._axis = new Laya.Vector3(1, 0, 0);
            this._secondaryAxis = new Laya.Vector3(0, 1, 0);
            this._xMotion = Laya.D6Axis.eFREE;
            this._yMotion = Laya.D6Axis.eFREE;
            this._zMotion = Laya.D6Axis.eFREE;
            this._angularXMotion = Laya.D6Axis.eFREE;
            this._angularYMotion = Laya.D6Axis.eFREE;
            this._angularZMotion = Laya.D6Axis.eFREE;
            this._distanceLimit = 0;
            this._distanceBounciness = 0;
            this._distanceBounceThreshold = 0;
            this._distanceSpring = 0;
            this._distanceDamper = 0;
            this._twistUper = 0;
            this._twistLower = 0;
            this._twistBounceness = 0;
            this._twistBounceThreshold = 0;
            this._twistStiffness = 0;
            this._twistDamping = 0;
            this._ySwingAngleLimit = 0;
            this._zSwingAngleLimit = 0;
            this._Swingrestitution = 0;
            this._SwingbounceThreshold = 0;
            this._SwingStiffness = 0;
            this._SwingDamping = 0;
            this._targetPosition = new Laya.Vector3();
            this._targetRotation = new Laya.Vector3();
            this._targetVelocity = new Laya.Vector3();
            this._targetAngularVelocity = new Laya.Vector3();
            this._linearDriveforceLimit = new Laya.Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
            this._linearDriveForce = new Laya.Vector3();
            this._linearDriveDamping = new Laya.Vector3();
            this._angularXDriveForceLimit = Number.MAX_VALUE;
            this._angularXDriveForce = 0;
            this._angularXDriveDamp = 0;
            this._angularYZDriveForceLimit = Number.MAX_VALUE;
            this._angularYZDriveForce = 0;
            this._angularYZDriveDamp = 0;
            this._angularSlerpDriveForceLimit = Number.MAX_VALUE;
            this._angularSlerpDriveForce = 0;
            this._angularSlerpDriveDamp = 0;
        }
        _setDriveLinearX() {
            this._jointReady && this._joint.setDrive(Laya.D6Drive.eX, this._linearDriveForce.x, this._linearDriveDamping.x, this._linearDriveforceLimit.x);
        }
        _setDriveLinearY() {
            this._jointReady && this._joint.setDrive(Laya.D6Drive.eY, this._linearDriveForce.y, this._linearDriveDamping.y, this._linearDriveforceLimit.y);
        }
        _setDriveLinearZ() {
            this._jointReady && this._joint.setDrive(Laya.D6Drive.eZ, this._linearDriveForce.z, this._linearDriveDamping.z, this._linearDriveforceLimit.z);
        }
        _setAngularXDrive() {
            this._jointReady && this._joint.setDrive(Laya.D6Drive.eSWING, this._angularXDriveForce, this._angularXDriveDamp, this._angularXDriveForceLimit);
        }
        _setAngularYZDrive() {
            this._jointReady && this._joint.setDrive(Laya.D6Drive.eTWIST, this._angularYZDriveForce, this._angularYZDriveDamp, this._angularYZDriveForceLimit);
        }
        _setAngularSlerpDrive() {
            this._jointReady && this._joint.setDrive(Laya.D6Drive.eSLERP, this._angularSlerpDriveForce, this._angularSlerpDriveDamp, this._angularSlerpDriveForceLimit);
        }
        _setDistanceLimit() {
            this._jointReady && this._joint.setDistanceLimit(this._distanceLimit, this._distanceBounciness, this._distanceBounceThreshold, this._distanceSpring, this._distanceDamper);
        }
        _setAngularXLimit() {
            this._jointReady && this._joint.setTwistLimit(this._twistUper / 180 * Math.PI, this._twistLower / 180 * Math.PI, this._twistBounceness, this._twistBounceThreshold, this._twistStiffness, this._twistDamping);
        }
        _setSwingLimit() {
            this._jointReady && this._joint.setSwingLimit(this._ySwingAngleLimit / 180 * Math.PI, this._zSwingAngleLimit / 180 * Math.PI, this._Swingrestitution, this._SwingbounceThreshold, this._SwingStiffness, this._SwingDamping);
        }
        _setTargetTransform() {
            let rotate = Laya.Quaternion.TEMP;
            Laya.Quaternion.createFromYawPitchRoll(this._targetRotation.y / Laya.Transform3D._angleToRandin, this._targetRotation.x / Laya.Transform3D._angleToRandin, this._targetRotation.z / Laya.Transform3D._angleToRandin, rotate);
            this._jointReady && this._joint.setDriveTransform(this._targetPosition, rotate);
        }
        _setAxis() {
            this._jointReady && this._joint.setAxis(this._axis, this._secondaryAxis);
        }
        _setTargetVelocirty() {
            this._jointReady && this._joint.setDriveVelocity(this._targetVelocity, this._targetAngularVelocity);
        }
        get axis() {
            return this._axis;
        }
        set axis(value) {
            if (!value)
                return;
            value.cloneTo(this._axis);
            this._setAxis();
        }
        get secondaryAxis() {
            return this._secondaryAxis;
        }
        set secondaryAxis(value) {
            if (!value)
                return;
            value.cloneTo(this._secondaryAxis);
            this._setAxis();
        }
        get XMotion() {
            return this._xMotion;
        }
        set XMotion(value) {
            this._xMotion = value;
            this._jointReady && this._joint.setMotion(value, Laya.D6MotionType.eX);
        }
        get YMotion() {
            return this._yMotion;
        }
        set YMotion(value) {
            this._yMotion = value;
            this._jointReady && this._joint.setMotion(value, Laya.D6MotionType.eY);
        }
        get ZMotion() {
            return this._zMotion;
        }
        set ZMotion(value) {
            this._zMotion = value;
            this._jointReady && this._joint.setMotion(value, Laya.D6MotionType.eZ);
        }
        get angularXMotion() {
            return this._angularXMotion;
        }
        set angularXMotion(value) {
            this._angularXMotion = value;
            this._jointReady && this._joint.setMotion(value, Laya.D6MotionType.eTWIST);
        }
        get angularYMotion() {
            return this._angularYMotion;
        }
        set angularYMotion(value) {
            this._angularYMotion = value;
            this._jointReady && this._joint.setMotion(value, Laya.D6MotionType.eSWING1);
        }
        get angularZMotion() {
            return this._angularZMotion;
        }
        set angularZMotion(value) {
            this._angularZMotion = value;
            this._jointReady && this._joint.setMotion(value, Laya.D6MotionType.eSWING2);
        }
        get distanceLimit() {
            return this._distanceLimit;
        }
        set distanceLimit(value) {
            if (value < 0)
                return;
            this._distanceLimit = value;
            this._setDistanceLimit();
        }
        get distanceBounciness() {
            return this._distanceBounciness;
        }
        set distanceBounciness(value) {
            if (value < 0)
                return;
            this._distanceBounciness = value;
            this._setDistanceLimit();
        }
        get distanceBounceThreshold() {
            return this._distanceBounceThreshold;
        }
        set distanceBounceThreshold(value) {
            if (value < 0)
                return;
            this._distanceBounceThreshold = value;
            this._setDistanceLimit();
        }
        get distanceSpring() {
            return this._distanceSpring;
        }
        set distanceSpring(value) {
            if (value < 0)
                return;
            this._distanceSpring = value;
            this._setDistanceLimit();
        }
        get distanceDamper() {
            return this._distanceDamper;
        }
        set distanceDamper(value) {
            if (value < 0)
                return;
            this._distanceDamper = value;
            this._setDistanceLimit();
        }
        get angularXMaxLimit() {
            return this._twistUper;
        }
        set angularXMaxLimit(value) {
            value = Math.min(180, Math.max(value, this._twistLower));
            this._twistUper = value;
            this._setAngularXLimit();
        }
        get angularXMinLimit() {
            return this._twistLower;
        }
        set angularXMinLimit(value) {
            value = Math.max(-180, Math.min(value, this._twistUper));
            this._twistLower = value;
            this._setAngularXLimit();
        }
        get AngleXLimitBounceness() {
            return this._twistBounceness;
        }
        set AngleXLimitBounceness(value) {
            value = Math.max(0, value);
            this._twistBounceness = value;
            this._setAngularXLimit();
        }
        get AngleXLimitBounceThreshold() {
            return this._twistBounceThreshold;
        }
        set AngleXLimitBounceThreshold(value) {
            value = Math.max(0, value);
            this._twistBounceThreshold = value;
            this._setAngularXLimit();
        }
        get AngleXLimitSpring() {
            return this._twistStiffness;
        }
        set AngleXLimitSpring(value) {
            value = Math.max(0, value);
            this._twistStiffness = value;
            this._setAngularXLimit();
        }
        get AngleXLimitDamp() {
            return this._twistDamping;
        }
        set AngleXLimitDamp(value) {
            value = Math.max(0, value);
            this._twistDamping = value;
            this._setAngularXLimit();
        }
        get AngleYLimit() {
            return this._ySwingAngleLimit;
        }
        set AngleYLimit(value) {
            value = Math.min(180, Math.max(0, value));
            this._ySwingAngleLimit = value;
            this._setSwingLimit();
        }
        get AngleZLimit() {
            return this._zSwingAngleLimit;
        }
        set AngleZLimit(value) {
            value = Math.min(180, Math.max(0, value));
            this._zSwingAngleLimit = value;
            this._setSwingLimit();
        }
        get AngleYZLimitBounciness() {
            return this._Swingrestitution;
        }
        set AngleYZLimitBounciness(value) {
            value = Math.max(0, value);
            this._Swingrestitution = value;
            this._setSwingLimit();
        }
        get AngleYZLimitBounceThreshold() {
            return this._SwingbounceThreshold;
        }
        set AngleYZLimitBounceThreshold(value) {
            value = Math.max(0, value);
            this._SwingbounceThreshold = value;
            this._setSwingLimit();
        }
        get AngleYZLimitSpring() {
            return this._SwingStiffness;
        }
        set AngleYZLimitSpring(value) {
            value = Math.max(0, value);
            this._SwingStiffness = value;
            this._setSwingLimit();
        }
        get AngleYZLimitDamping() {
            return this._SwingDamping;
        }
        set AngleYZLimitDamping(value) {
            value = Math.max(0, value);
            this._SwingDamping = value;
            this._setSwingLimit();
        }
        get targetPosition() {
            return this._targetPosition;
        }
        set targetPosition(value) {
            value.cloneTo(this._targetPosition);
            this._setTargetTransform();
        }
        get targetRotation() {
            return this._targetRotation;
        }
        set targetRotation(value) {
            value.cloneTo(this._targetRotation);
            this._setTargetTransform();
        }
        get targetPositionVelocity() {
            return this._targetVelocity;
        }
        set targetPositionVelocity(value) {
            value.cloneTo(this._targetVelocity);
            this._setTargetVelocirty();
        }
        get targetAngularVelocity() {
            return this._targetAngularVelocity;
        }
        set targetAngularVelocity(value) {
            value.cloneTo(this._targetAngularVelocity);
            this._setTargetVelocirty();
        }
        get XDriveSpring() {
            return this._linearDriveForce.x;
        }
        set XDriveSpring(value) {
            value = Math.max(value, 0);
            this._linearDriveForce.x = value;
            this._setDriveLinearX();
        }
        get YDriveSpring() {
            return this._linearDriveForce.y;
        }
        set YDriveSpring(value) {
            value = Math.max(value, 0);
            this._linearDriveForce.y = value;
            this._setDriveLinearY();
        }
        get ZDriveSpring() {
            return this._linearDriveForce.z;
        }
        set ZDriveSpring(value) {
            value = Math.max(value, 0);
            this._linearDriveForce.z = value;
            this._setDriveLinearZ();
        }
        get XDriveDamp() {
            return this._linearDriveDamping.x;
        }
        set XDriveDamp(value) {
            value = Math.max(value, 0);
            this._linearDriveDamping.x = value;
            this._setDriveLinearX();
        }
        get YDriveDamp() {
            return this._linearDriveDamping.y;
        }
        set YDriveDamp(value) {
            value = Math.max(value, 0);
            this._linearDriveDamping.y = value;
            this._setDriveLinearY();
        }
        get ZDriveDamp() {
            return this._linearDriveDamping.z;
        }
        set ZDriveDamp(value) {
            value = Math.max(value, 0);
            this._linearDriveDamping.z = value;
            this._setDriveLinearZ();
        }
        get XDriveForceLimit() {
            return this._linearDriveforceLimit.x;
        }
        set XDriveForceLimit(value) {
            value = Math.max(value, 0);
            this._linearDriveforceLimit.x = value;
            this._setDriveLinearX();
        }
        get YDriveForceLimit() {
            return this._linearDriveforceLimit.y;
        }
        set YDriveForceLimit(value) {
            value = Math.max(value, 0);
            this._linearDriveforceLimit.y = value;
            this._setDriveLinearY();
        }
        get ZDriveForceLimit() {
            return this._linearDriveforceLimit.z;
        }
        set ZDriveForceLimit(value) {
            value = Math.max(value, 0);
            this._linearDriveforceLimit.z = value;
            this._setDriveLinearZ();
        }
        get angularXDriveForceLimit() {
            return this._angularXDriveForceLimit;
        }
        set angularXDriveForceLimit(value) {
            value = Math.max(value, 0);
            this._angularXDriveForceLimit = value;
            this._setAngularXDrive();
        }
        get angularXDriveForce() {
            return this._angularXDriveForce;
        }
        set angularXDriveForce(value) {
            value = Math.max(value, 0);
            this._angularXDriveForce = value;
            this._setAngularXDrive();
        }
        get angularXDriveDamp() {
            return this._angularXDriveDamp;
        }
        set angularXDriveDamp(value) {
            value = Math.max(value, 0);
            this._angularXDriveDamp = value;
            this._setAngularXDrive();
        }
        get angularYZDriveForceLimit() {
            return this._angularYZDriveForceLimit;
        }
        set angularYZDriveForceLimit(value) {
            value = Math.max(value, 0);
            this._angularYZDriveForceLimit = value;
            this._setAngularYZDrive();
        }
        get angularYZDriveForce() {
            return this._angularYZDriveForce;
        }
        set angularYZDriveForce(value) {
            value = Math.max(value, 0);
            this._angularYZDriveForce = value;
            this._setAngularYZDrive();
        }
        get angularYZDriveDamp() {
            return this._angularYZDriveDamp;
        }
        set angularYZDriveDamp(value) {
            value = Math.max(value, 0);
            this._angularYZDriveDamp = value;
            this._setAngularYZDrive();
        }
        get angularSlerpDriveForceLimit() {
            return this._angularSlerpDriveForceLimit;
        }
        set angularSlerpDriveForceLimit(value) {
            value = Math.max(value, 0);
            this._angularSlerpDriveForceLimit = value;
            this._setAngularSlerpDrive();
        }
        get angularSlerpDriveForce() {
            return this._angularSlerpDriveForce;
        }
        set angularSlerpDriveForce(value) {
            value = Math.max(value, 0);
            this._angularSlerpDriveForce = value;
            this._setAngularSlerpDrive();
        }
        get angularSlerpDriveDamp() {
            return this._angularSlerpDriveDamp;
        }
        set angularSlerpDriveDamp(value) {
            value = Math.max(value, 0);
            this._angularSlerpDriveDamp = value;
            this._setAngularSlerpDrive();
        }
        _onJointReady() {
            this._initAllConstraintInfo();
        }
        _initAllConstraintInfo() {
            if (!this._jointReady)
                return;
            this._joint.setMotion(this._xMotion, Laya.D6MotionType.eX);
            this._joint.setMotion(this._yMotion, Laya.D6MotionType.eY);
            this._joint.setMotion(this._zMotion, Laya.D6MotionType.eZ);
            this._joint.setMotion(this._angularXMotion, Laya.D6MotionType.eTWIST);
            this._joint.setMotion(this._angularYMotion, Laya.D6MotionType.eSWING1);
            this._joint.setMotion(this._angularZMotion, Laya.D6MotionType.eSWING2);
            this._setDriveLinearX();
            this._setDriveLinearY();
            this._setDriveLinearZ();
            this._setAngularXDrive();
            this._setAngularYZDrive();
            this._setAngularSlerpDrive();
            this._setDistanceLimit();
            this._setAngularXLimit();
            this._setSwingLimit();
            this._setTargetTransform();
            this._setAxis();
            this._setTargetVelocirty();
        }
        _onEnable() {
            super._onEnable();
            if (this._joint)
                this._jointReady && this._joint.isEnable(true);
        }
        _onDisable() {
            if (this._joint)
                this._jointReady && this._joint.isEnable(false);
        }
        _initJoint() {
            this._physicsManager = this.owner._scene._physicsManager;
            if (Laya.Laya3D.enablePhysics && Laya.Laya3D.PhysicsCreateUtil.getPhysicsCapable(Laya.EPhysicsCapable.Physics_D6Joint)) {
                this._joint = Laya.Laya3D.PhysicsCreateUtil.createD6Joint(this._physicsManager);
            }
            else {
                console.error("Rigidbody3D: cant enable Rigidbody3D");
            }
        }
    }

    class FixedConstraint extends ConstraintComponent {
        constructor() {
            super();
        }
        _initJoint() {
            this._physicsManager = this.owner._scene._physicsManager;
            if (Laya.Laya3D.enablePhysics && Laya.Laya3D.PhysicsCreateUtil.getPhysicsCapable(Laya.EPhysicsCapable.Physics_FixedJoint)) {
                this._joint = Laya.Laya3D.PhysicsCreateUtil.createFixedJoint(this._physicsManager);
            }
            else {
                console.error("Rigidbody3D: cant enable Rigidbody3D");
            }
        }
        _onEnable() {
            super._onEnable();
            if (this._joint)
                this._joint.isEnable(true);
        }
        _onDisable() {
            if (this._joint)
                this._joint.isEnable(false);
        }
    }

    class HingeConstraint extends ConstraintComponent {
        constructor() {
            super();
            this._axis = new Laya.Vector3(1, 0, 0);
            this._motor = false;
            this._targetVelocity = 0;
            this._freeSpin = false;
            this._limit = false;
            this._lowerLimit = -Math.PI / 2;
            this._uperLimit = Math.PI / 2;
            this._bounciness = 0;
            this._bounceMinVelocity = 0;
            this._contactDistance = 0;
        }
        _initJoint() {
            this._physicsManager = this.owner._scene._physicsManager;
            if (Laya.Laya3D.enablePhysics && Laya.Laya3D.PhysicsCreateUtil.getPhysicsCapable(Laya.EPhysicsCapable.Physics_HingeJoint)) {
                this._joint = Laya.Laya3D.PhysicsCreateUtil.createHingeJoint(this._physicsManager);
            }
            else {
                console.error("HingeConstraint: cant enable HingeConstraint");
            }
        }
        _onJointReady() {
            this._joint.setAxis(this._axis);
            this.lowerLimit = this._lowerLimit;
            this.uperLimit = this._uperLimit;
            this._joint.enableLimit(this._limit);
            this._joint.setBounceness(this._bounciness);
            this._joint.setBouncenMinVelocity(this._bounceMinVelocity);
            if (this._contactDistance !== 0 && this._joint.supportsContactDistance !== false)
                this._joint.setContactDistance(this._contactDistance);
            this._joint.enableFreeSpin(this._freeSpin);
            this._joint.setDriveVelocity(this._targetVelocity);
            this._joint.enableDrive(this._motor);
        }
        _onEnable() {
            super._onEnable();
            if (this._joint)
                this._joint.isEnable(true);
        }
        _onDisable() {
            if (this._joint)
                this._joint.isEnable(false);
        }
        get Axis() {
            return this._axis;
        }
        set Axis(value) {
            if (!value || this._axis.equal(value)) {
                return;
            }
            value = value.normalize();
            value.cloneTo(this._axis);
            this._jointReady && this._joint.setAxis(value);
        }
        get lowerLimit() {
            return this._lowerLimit;
        }
        set lowerLimit(value) {
            this._lowerLimit = value;
            let lowerValue = value < this._lowerLimit ? this._lowerLimit : (value < (-Math.PI / 2) ? (-Math.PI) : value);
            this._jointReady && this._joint.setLowerLimit(lowerValue);
        }
        get uperLimit() {
            return this._uperLimit;
        }
        set uperLimit(value) {
            this._uperLimit = value;
            let uperValue = value > this._uperLimit ? this._uperLimit : (value > (Math.PI / 2) ? (Math.PI) : value);
            this._jointReady && this._joint.setUpLimit(uperValue);
        }
        get bounceness() {
            return this._bounciness;
        }
        set bounceness(value) {
            value = value < 0 ? 0 : (value > 1 ? 1 : value);
            this._bounciness = value;
            this._jointReady && this._joint.setBounceness(value);
        }
        get bouncenMinVelocity() {
            return this._bounceMinVelocity;
        }
        set bouncenMinVelocity(value) {
            this._bounceMinVelocity = value;
            this._jointReady && this._joint.setBouncenMinVelocity(value);
        }
        get contactDistance() {
            return this._contactDistance;
        }
        set contactDistance(value) {
            this._contactDistance = value;
            this._jointReady && this._joint.setContactDistance(value);
        }
        get limit() {
            return this._limit;
        }
        set limit(value) {
            this._limit = value;
            this._jointReady && this._joint.enableLimit(value);
        }
        get motor() {
            return this._motor;
        }
        set motor(value) {
            this._motor = value;
            this._jointReady && this._joint.enableDrive(value);
        }
        get freeSpin() {
            return this._freeSpin;
        }
        set freeSpin(value) {
            this._freeSpin = value;
            this._jointReady && this._joint.enableFreeSpin(value);
        }
        get targetVelocity() {
            return this._targetVelocity;
        }
        set targetVelocity(velocity) {
            this._targetVelocity = velocity;
            this._jointReady && this._joint.setDriveVelocity(velocity);
        }
        getAngle() {
            return this._joint ? this._joint.getAngle() : 0;
        }
        getVelocity() {
            return this._joint ? this._joint.getVelocity() : Laya.Vector3.TEMP.set(0, 0, 0);
        }
    }

    class SpringConstraint extends ConstraintComponent {
        constructor() {
            super(...arguments);
            this._minDistance = 0;
            this._damping = 0.2;
            this._maxDistance = Number.MAX_VALUE;
            this._tolerance = 0.025;
            this._stiffness = 10;
        }
        _initJoint() {
            this._physicsManager = this.owner._scene._physicsManager;
            if (Laya.Laya3D.enablePhysics && Laya.Laya3D.PhysicsCreateUtil.getPhysicsCapable(Laya.EPhysicsCapable.Physics_SpringJoint)) {
                this._joint = Laya.Laya3D.PhysicsCreateUtil.createSpringJoint(this._physicsManager);
            }
            else {
                console.error("SpringConstraint: cant enable SpringConstraint");
            }
        }
        _onAdded() {
            super._onAdded();
        }
        _onEnable() {
            super._onEnable();
            if (this._joint)
                this._joint.isEnable(true);
        }
        _onDisable() {
            super._onDisable();
            if (this._joint)
                this._joint.isEnable(false);
        }
        get minDistance() {
            return this._minDistance;
        }
        set minDistance(value) {
            this._minDistance = value;
            this._joint && this._joint.setMinDistance(value);
        }
        get maxDistance() {
            return this._maxDistance;
        }
        set maxDistance(value) {
            this._maxDistance = value;
            this._joint && this._joint.setMaxDistance(value);
        }
        get tolerance() {
            return this._tolerance;
        }
        set tolerance(value) {
            this._tolerance = value;
            this._joint && this._joint.setTolerance(value);
        }
        get spring() {
            return this._stiffness;
        }
        set spring(value) {
            this._stiffness = value;
            this._joint && this._joint.setStiffness(value);
        }
        get damping() {
            return this._damping;
        }
        set damping(value) {
            this._damping = value;
            this._joint && this._joint.setDamping(value);
        }
    }

    class PhysicsCollider extends PhysicsColliderComponent {
        _initCollider() {
            this._physicsManager = this.owner._scene._physicsManager;
            if (Laya.Laya3D.enablePhysics && this._physicsManager && Laya.Laya3D.PhysicsCreateUtil.getPhysicsCapable(Laya.EPhysicsCapable.Physics_StaticCollider)) {
                this._collider = Laya.Laya3D.PhysicsCreateUtil.createStaticCollider(this._physicsManager);
                this._collider.component = this;
            }
            else {
                console.error("PhysicsCollider:cant enable PhysicsCollider");
            }
        }
        constructor() {
            super();
            this._isTrigger = false;
            this._allowSleep = true;
        }
        _onEnable() {
            super._onEnable();
            this.restitution = this._restitution;
            this.friction = this._friction;
            this.rollingFriction = this._rollingFriction;
            this.isTrigger = this._isTrigger;
            this.allowSleep = this._allowSleep;
        }
        get isTrigger() {
            return this._isTrigger;
        }
        set isTrigger(value) {
            this._isTrigger = value;
            if (this._collider && this._collider.getCapable(Laya.EColliderCapable.Collider_AllowTrigger)) {
                this._collider.setTrigger(value);
                this._setEventFilter();
            }
        }
        get allowSleep() {
            return this._allowSleep;
        }
        set allowSleep(value) {
            this._allowSleep = value;
            if (this._collider && this._collider.getCapable(Laya.EColliderCapable.RigidBody_AllowSleep)) {
                this._collider.allowSleep(value);
            }
        }
        _setEventFilter(pendingType) {
            if (this._collider && this._collider.getCapable(Laya.EColliderCapable.Collider_EventFilter)) {
                this._eventsArray = [];
                if (this.isTrigger && (this.owner.hasListener(Laya.Event.TRIGGER_ENTER) || pendingType === Laya.Event.TRIGGER_ENTER)) {
                    this._eventsArray.push(Laya.Event.TRIGGER_ENTER);
                }
                if (this.isTrigger && (this.owner.hasListener(Laya.Event.TRIGGER_STAY) || pendingType === Laya.Event.TRIGGER_STAY)) {
                    this._eventsArray.push(Laya.Event.TRIGGER_STAY);
                }
                if (this.isTrigger && (this.owner.hasListener(Laya.Event.TRIGGER_EXIT) || pendingType === Laya.Event.TRIGGER_EXIT)) {
                    this._eventsArray.push(Laya.Event.TRIGGER_EXIT);
                }
                if ((this.owner.hasListener(Laya.Event.COLLISION_ENTER) || pendingType === Laya.Event.COLLISION_ENTER)) {
                    this._eventsArray.push(Laya.Event.COLLISION_ENTER);
                }
                if ((this.owner.hasListener(Laya.Event.COLLISION_STAY) || pendingType === Laya.Event.COLLISION_STAY)) {
                    this._eventsArray.push(Laya.Event.COLLISION_STAY);
                }
                if ((this.owner.hasListener(Laya.Event.COLLISION_EXIT) || pendingType === Laya.Event.COLLISION_EXIT)) {
                    this._eventsArray.push(Laya.Event.COLLISION_EXIT);
                }
                this._collider.setEventFilter(this._eventsArray);
            }
        }
    }

    class PhysicsUpdateList extends Laya.SingletonList {
        constructor() {
            super();
        }
        add(element) {
            var index = element.inPhysicUpdateListIndex;
            if (index !== -1)
                console.error("PhysicsUpdateList:element has  in  PhysicsUpdateList.");
            if (this.length === this.elements.length)
                this.elements.push(element);
            else
                this.elements[this.length] = element;
            element.inPhysicUpdateListIndex = this.length++;
        }
        remove(element) {
            var index = element.inPhysicUpdateListIndex;
            if (index != -1 && index < this.length) {
                this.length--;
                var end = this.elements[this.length];
                this.elements[index] = end;
                end.inPhysicUpdateListIndex = index;
            }
            element.inPhysicUpdateListIndex = -1;
        }
    }

    class Rigidbody3D extends PhysicsColliderComponent {
        _initCollider() {
            this._physicsManager = this.owner._scene._physicsManager;
            if (Laya.Laya3D.enablePhysics && this._physicsManager && Laya.Laya3D.PhysicsCreateUtil.getPhysicsCapable(Laya.EPhysicsCapable.Physics_DynamicCollider)) {
                this._collider = Laya.Laya3D.PhysicsCreateUtil.createDynamicCollider(this._physicsManager);
                this._collider.component = this;
            }
            else {
                console.error("Rigidbody3D: cant enable Rigidbody3D");
            }
        }
        get mass() {
            return this._mass;
        }
        set mass(value) {
            this._mass = value;
            if (this._collider && this.collider.getCapable(Laya.EColliderCapable.RigidBody_Mass)) {
                this._collider.setMass(value);
            }
        }
        get isKinematic() {
            return this._isKinematic;
        }
        set isKinematic(value) {
            this._isKinematic = value;
            if (this._collider && this.collider.getCapable(Laya.EColliderCapable.RigidBody_AllowKinematic)) {
                this._collider.setIsKinematic(value);
            }
        }
        get linearDamping() {
            return this._linearDamping;
        }
        set linearDamping(value) {
            this._linearDamping = value;
            if (this._collider && this.collider.getCapable(Laya.EColliderCapable.RigidBody_LinearDamp)) {
                this._collider.setLinearDamping(value);
            }
        }
        get angularDamping() {
            return this._angularDamping;
        }
        set angularDamping(value) {
            this._angularDamping = value;
            if (this._collider && this.collider.getCapable(Laya.EColliderCapable.RigidBody_AngularDamp)) {
                this._collider.setAngularDamping(value);
            }
        }
        get gravity() {
            return this._gravity;
        }
        set gravity(value) {
            this._gravity = value;
            if (this._collider && this.collider.getCapable(Laya.EColliderCapable.RigidBody_Gravity)) {
                if (this._collider.setGravity)
                    this._collider.setGravity(value);
                else
                    this._collider.setInertiaTensor(value);
            }
        }
        get linearFactor() {
            return this._linearFactor;
        }
        set linearFactor(value) {
            this._linearFactor = value;
            if (this._collider && this.collider.getCapable(Laya.EColliderCapable.RigidBody_LinearFactor)) {
                this._collider.setConstraints(this._linearFactor, this.angularFactor);
            }
        }
        get linearVelocity() {
            if (this._collider && this.collider.getCapable(Laya.EColliderCapable.RigidBody_LinearVelocity)) {
                return this._collider.getLinearVelocity();
            }
            else {
                return this._linearVelocity;
            }
        }
        set linearVelocity(value) {
            this._linearVelocity = value;
            if (this._collider && this.collider.getCapable(Laya.EColliderCapable.RigidBody_LinearVelocity)) {
                this._collider.setLinearVelocity(value);
            }
        }
        get angularFactor() {
            return this._angularFactor;
        }
        set angularFactor(value) {
            this._angularFactor = value;
            if (this._collider && this.collider.getCapable(Laya.EColliderCapable.RigidBody_AngularFactor)) {
                this._collider.setConstraints(this._linearFactor, this.angularFactor);
            }
        }
        get angularVelocity() {
            if (this._collider && this.collider.getCapable(Laya.EColliderCapable.RigidBody_AngularVelocity)) {
                return this._collider.getAngularVelocity();
            }
            else {
                return this._angularVelocity;
            }
        }
        set angularVelocity(value) {
            this._angularVelocity = value;
            if (this._collider && this.collider.getCapable(Laya.EColliderCapable.RigidBody_AngularVelocity)) {
                this._collider.setAngularVelocity(value);
            }
        }
        set allowSleep(value) {
            this._allowSleep = value;
            if (this._collider && this.collider.getCapable(Laya.EColliderCapable.RigidBody_AllowSleep)) {
                this._collider.allowSleep(value);
            }
        }
        get allowSleep() {
            return this._allowSleep;
        }
        get isSleeping() {
            return this._collider.isSleeping();
        }
        get sleepThreshold() {
            return this._sleepThreshold;
        }
        set sleepThreshold(value) {
            this._sleepThreshold = value;
            if (this._collider && this.collider.getCapable(Laya.EColliderCapable.RigidBody_SleepThreshold)) {
                this._collider.setSleepThreshold(value);
            }
        }
        get sleepAngularThreshold() {
            return this._sleepAngularThreshold;
        }
        set sleepAngularThreshold(value) {
            this._sleepAngularThreshold = value;
            if (this._collider && this.collider.getCapable(Laya.EColliderCapable.RigidBody_SleepAngularVelocity)) {
                this._collider.setSleepAngularThreshold(value);
            }
        }
        set position(pos) {
            if (this._collider && this.collider.getCapable(Laya.EColliderCapable.RigidBody_WorldPosition)) {
                this._collider.setWorldPosition(pos);
            }
        }
        set orientation(q) {
            if (this._collider && this.collider.getCapable(Laya.EColliderCapable.RigidBody_WorldOrientation)) {
                this._collider.setWorldRotation(q);
            }
        }
        get trigger() {
            return this._trigger;
        }
        set trigger(value) {
            this._trigger = value;
            if (this._collider && this.collider.getCapable(Laya.EColliderCapable.Collider_AllowTrigger)) {
                this._collider.setTrigger(value);
            }
        }
        get collisionDetectionMode() {
            return this._collisionDetectionMode;
        }
        set collisionDetectionMode(value) {
            this._collisionDetectionMode = value;
            if (this._collider && this._collider.getCapable(Laya.EColliderCapable.Collider_CollisionDetectionMode)) {
                this._collider.setCollisionDetectionMode(value);
            }
        }
        constructor() {
            super();
            this._isKinematic = false;
            this._mass = 1.0;
            this._gravity = new Laya.Vector3(0, -10, 0);
            this._angularDamping = 0.0;
            this._linearDamping = 0.0;
            this._linearVelocity = new Laya.Vector3();
            this._angularVelocity = new Laya.Vector3();
            this._linearFactor = new Laya.Vector3(1, 1, 1);
            this._angularFactor = new Laya.Vector3(1, 1, 1);
            this._sleepThreshold = 0.8;
            this._sleepAngularThreshold = 1.0;
            this._trigger = false;
            this._collisionDetectionMode = 0;
            this._allowSleep = true;
        }
        _onEnable() {
            super._onEnable();
            this.restitution = this._restitution;
            this.friction = this._friction;
            this.rollingFriction = this._rollingFriction;
            this.gravity = this._gravity;
            this.trigger = this._trigger;
            this.isKinematic = this._isKinematic;
            this.mass = this._mass;
            this.linearFactor = this._linearFactor;
            this.angularFactor = this._angularFactor;
            this.linearDamping = this._linearDamping;
            this.linearVelocity = this._linearVelocity;
            this.angularDamping = this._angularDamping;
            this.allowSleep = this._allowSleep;
        }
        _onDestroy() {
            super._onDestroy();
            this._gravity = null;
            this._linearVelocity = null;
            this._angularVelocity = null;
            this._linearFactor = null;
            this._angularFactor = null;
        }
        _cloneTo(dest) {
            super._cloneTo(dest);
            dest.isKinematic = this._isKinematic;
            dest.mass = this._mass;
            dest.gravity = this._gravity;
            dest.angularDamping = this._angularDamping;
            dest.linearDamping = this._linearDamping;
            dest.linearVelocity = this._linearVelocity;
            dest.angularVelocity = this._angularVelocity;
            dest.linearFactor = this._linearFactor;
            dest.angularFactor = this._angularFactor;
        }
        applyForce(force, localOffset = null) {
            if (this._collider && this.collider.getCapable(Laya.EColliderCapable.RigidBody_ApplyForce)) {
                this._collider.addForce(force, exports.PhysicsForceMode.Force, localOffset);
            }
        }
        applyTorque(torque) {
            if (this._collider && this.collider.getCapable(Laya.EColliderCapable.RigidBody_ApplyTorque)) {
                this._collider.addTorque(torque, exports.PhysicsForceMode.Force);
            }
        }
        applyImpulse(impulse, localOffset = null) {
            if (this._collider && this.collider.getCapable(Laya.EColliderCapable.RigidBody_ApplyImpulse)) {
                this._collider.addForce(impulse, exports.PhysicsForceMode.Impulse, localOffset);
            }
        }
        applyTorqueImpulse(torqueImpulse) {
            if (this._collider && this.collider.getCapable(Laya.EColliderCapable.RigidBody_ApplyTorqueImpulse)) {
                this._collider.addTorque(torqueImpulse, exports.PhysicsForceMode.Impulse);
            }
        }
        wakeUp() {
            if (this._collider && this.collider.getCapable(Laya.EColliderCapable.RigidBody_AllowSleep)) {
                this._collider.wakeUp();
            }
        }
        get sleepLinearVelocity() {
            return this.sleepThreshold;
        }
        set sleepLinearVelocity(value) {
            this.sleepThreshold = value;
            this.sleepAngularThreshold = value;
        }
        get sleepAngularVelocity() {
            return this.sleepThreshold;
        }
        set sleepAngularVelocity(value) {
            this.sleepThreshold = value;
            this.sleepAngularThreshold = value;
        }
        applyForceXYZ(fx, fy, fz, localOffset = null) {
            _tempV0.set(fx, fy, fz);
            this.applyForce(_tempV0, localOffset);
        }
        _setEventFilter(pendingType) {
            if (this._collider && this._collider.getCapable(Laya.EColliderCapable.Collider_EventFilter)) {
                this._eventsArray = [];
                if (this.trigger && (this.owner.hasListener(Laya.Event.TRIGGER_ENTER) || pendingType === Laya.Event.TRIGGER_ENTER)) {
                    this._eventsArray.push(Laya.Event.TRIGGER_ENTER);
                }
                if (this.trigger && (this.owner.hasListener(Laya.Event.TRIGGER_EXIT) || pendingType === Laya.Event.TRIGGER_EXIT)) {
                    this._eventsArray.push(Laya.Event.TRIGGER_EXIT);
                }
                if (this.trigger && (this.owner.hasListener(Laya.Event.TRIGGER_STAY) || pendingType === Laya.Event.TRIGGER_STAY)) {
                    this._eventsArray.push(Laya.Event.TRIGGER_STAY);
                }
                if ((this.owner.hasListener(Laya.Event.COLLISION_ENTER) || pendingType === Laya.Event.COLLISION_ENTER)) {
                    this._eventsArray.push(Laya.Event.COLLISION_ENTER);
                }
                if ((this.owner.hasListener(Laya.Event.COLLISION_STAY) || pendingType === Laya.Event.COLLISION_STAY)) {
                    this._eventsArray.push(Laya.Event.COLLISION_STAY);
                }
                if ((this.owner.hasListener(Laya.Event.COLLISION_EXIT) || pendingType === Laya.Event.COLLISION_EXIT)) {
                    this._eventsArray.push(Laya.Event.COLLISION_EXIT);
                }
                this._collider.setEventFilter(this._eventsArray);
            }
        }
    }
    const _tempV0 = new Laya.Vector3();

    class BoxColliderShape extends Physics3DColliderShape {
        constructor(sizeX = 1.0, sizeY = 1.0, sizeZ = 1.0) {
            super();
            this._size = new Laya.Vector3(sizeX, sizeY, sizeZ);
            this._shape.setSize(this._size);
        }
        _createShape() {
            if (Laya.Laya3D.PhysicsCreateUtil.getPhysicsCapable(Laya.EPhysicsCapable.Physics_BoxColliderShape))
                this._shape = Laya.Laya3D.PhysicsCreateUtil.createBoxColliderShape();
            else {
                console.error("BoxColliderShape: cant enable BoxColliderShape");
            }
        }
        get size() {
            return this._size;
        }
        set size(value) {
            this._size = value;
            if (Laya.LayaEnv.isPlaying) {
                this._shape.setSize(this._size);
            }
        }
        clone() {
            var dest = new BoxColliderShape(this._size.x, this._size.y, this._size.z);
            this.cloneTo(dest);
            return dest;
        }
        cloneTo(destObject) {
            super.cloneTo(destObject);
            destObject.size = this.size;
        }
        get sizeX() {
            return this.size.x;
        }
        set sizeX(value) {
            this._size.x = value;
            if (Laya.LayaEnv.isPlaying) {
                this._shape.setSize(this._size);
            }
        }
        get sizeY() {
            return this.size.y;
        }
        set sizeY(value) {
            this._size.y = value;
            if (Laya.LayaEnv.isPlaying) {
                this._shape.setSize(this._size);
            }
        }
        get sizeZ() {
            return this.size.z;
        }
        set sizeZ(value) {
            this._size.z = value;
            if (Laya.LayaEnv.isPlaying) {
                this._shape.setSize(this._size);
            }
        }
    }

    class MeshColliderShape extends Physics3DColliderShape {
        get mesh() {
            return this._mesh;
        }
        set mesh(value) {
            if (!value)
                return;
            if (this._mesh == value && this._shape && this._shape.getPhysicsShape())
                return;
            this._mesh = value;
            this._changeShape();
        }
        _changeShape() {
            if (!this.mesh)
                return;
            if (this._convex)
                this._shape.setConvexMesh(this.mesh);
            else
                this._shape.setPhysicsMeshFromMesh(this.mesh);
        }
        get convexVertexMax() {
            return this._convexVertexMax;
        }
        set convexVertexMax(value) {
            this._convexVertexMax = value;
            this._shape.setLimitVertex(value);
        }
        get convex() {
            return this._convex;
        }
        set convex(value) {
            if (value == this._convex) {
                return;
            }
            this._convex = value;
            this._changeShape();
        }
        constructor() {
            super();
            this._mesh = null;
            this._convex = false;
            this._convexVertexMax = 255;
        }
        _createShape() {
            if (Laya.Laya3D.PhysicsCreateUtil.getPhysicsCapable(Laya.EPhysicsCapable.Physics_MeshColliderShape))
                this._shape = Laya.Laya3D.PhysicsCreateUtil.createMeshColliderShape();
            else {
                console.error("MeshColliderShape: cant enable MeshColliderShape");
            }
        }
        cloneTo(destObject) {
            destObject.convex = this._convex;
            destObject._convexVertexMax = this._convexVertexMax;
            destObject.mesh = this._mesh;
            super.cloneTo(destObject);
        }
        clone() {
            var dest = new MeshColliderShape();
            this.cloneTo(dest);
            return dest;
        }
    }

    class CompoundColliderShape extends Physics3DColliderShape {
        get autoDetectChildShapes() {
            return this._autoDetectChildShapes;
        }
        set autoDetectChildShapes(value) {
            if (this._autoDetectChildShapes === value)
                return;
            this._autoDetectChildShapes = value;
            if (value && this.physicsComponent)
                this.rebuildAutoDetectedChildShapes();
            else if (!value) {
                this._clearAutoDetectedChildShapes();
                this._refreshMassProperties();
            }
        }
        get physicsComponent() {
            return super.physicsComponent;
        }
        set physicsComponent(value) {
            if (super.physicsComponent === value)
                return;
            super.physicsComponent = value;
            if (value && this._autoDetectChildShapes)
                this.rebuildAutoDetectedChildShapes();
        }
        constructor() {
            super();
            this._childColliderShapes = [];
            this._autoChildColliderShapes = new Set();
            this._autoDetectChildShapes = false;
        }
        _createShape() {
            if (Laya.Laya3D.PhysicsCreateUtil.getPhysicsCapable(Laya.EPhysicsCapable.Physics_CompoundColliderShape))
                this._shape = Laya.Laya3D.PhysicsCreateUtil.createCompoundShape();
            else
                console.error("CompoundColliderShape: cannot enable CompoundColliderShape");
        }
        set shapes(value) {
            this.clearChildShape();
            for (let i = 0, n = value.length; i < n; i++)
                this._addChildShape(value[i]);
            if (!this._autoDetectChildShapes || !this.physicsComponent || !this.rebuildAutoDetectedChildShapes())
                this._refreshMassProperties();
        }
        get shapes() {
            return this._childColliderShapes;
        }
        addChildShape(shape) {
            this._addChildShape(shape);
            this._refreshMassProperties();
        }
        _addChildShape(shape) {
            var _a, _b, _c;
            if (shape instanceof CompoundColliderShape) {
                console.warn("CompoundColliderShape: cannot add a CompoundColliderShape as a child shape.");
                return;
            }
            (_b = (_a = this._shape) === null || _a === void 0 ? void 0 : _a.setShapeData) === null || _b === void 0 ? void 0 : _b.call(_a, this.physicsComponent);
            (_c = this._shape) === null || _c === void 0 ? void 0 : _c.addChildShape(shape.shape);
            this._childColliderShapes.push(shape);
        }
        removeChildShape(shape) {
            const index = this._childColliderShapes.indexOf(shape);
            if (index !== -1) {
                this._removeChildShapeAt(index);
                this._refreshMassProperties();
            }
        }
        clearChildShape() {
            while (this._childColliderShapes.length > 0)
                this._removeChildShapeAt(0);
        }
        _refreshMassProperties() {
            var _a, _b;
            const component = this.physicsComponent;
            if (this._childColliderShapes.length > 0 && component instanceof Rigidbody3D && component.colliderShape === this)
                (_b = (_a = this._shape) === null || _a === void 0 ? void 0 : _a.refreshMassProperties) === null || _b === void 0 ? void 0 : _b.call(_a, component.mass);
        }
        _removeChildShapeAt(index) {
            var _a;
            const shape = this._childColliderShapes[index];
            (_a = this._shape) === null || _a === void 0 ? void 0 : _a.removeChildShape(shape.shape, index);
            this._childColliderShapes.splice(index, 1);
            if (this._autoChildColliderShapes.delete(shape))
                shape.destroy();
        }
        getChildShapeCount() {
            return this._childColliderShapes.length;
        }
        rebuildAutoDetectedChildShapes() {
            var _a;
            const root = (_a = this.physicsComponent) === null || _a === void 0 ? void 0 : _a.owner;
            if (!this._shape || !root) {
                console.warn("CompoundColliderShape: automatic detection requires a valid shape and owner node.");
                return false;
            }
            if (!Laya.Laya3D.PhysicsCreateUtil.getPhysicsCapable(Laya.EPhysicsCapable.Physics_MeshColliderShape)) {
                console.warn("CompoundColliderShape: MeshColliderShape is not supported by the current physics backend.");
                return false;
            }
            if (!this._shape.addChildShapeWithTransform) {
                console.warn("CompoundColliderShape: automatic detection is not supported by the current physics backend.");
                return false;
            }
            const sources = [];
            this._collectAutoColliderSources(root, sources, true);
            if (sources.length === 0) {
                this._clearAutoDetectedChildShapes();
                this._refreshMassProperties();
                console.warn("CompoundColliderShape: the owner hierarchy contains no valid child MeshFilter.");
                return false;
            }
            const rootInverse = new Laya.Matrix4x4();
            root.transform.worldMatrix.invert(rootInverse);
            const children = [];
            try {
                for (let i = 0, n = sources.length; i < n; i++)
                    children.push(this._createAutoColliderChild(sources[i], rootInverse));
            }
            catch (error) {
                children.forEach(child => child.shape.destroy());
                console.error("CompoundColliderShape: failed to create automatically detected child shapes.", error);
                return false;
            }
            this._clearAutoDetectedChildShapes();
            children.forEach(child => this._addAutoDetectedChildShape(child));
            this._refreshMassProperties();
            return true;
        }
        _addAutoDetectedChildShape(child) {
            this._shape.addChildShapeWithTransform(child.shape.shape, child.position, child.rotation, child.scale);
            this._childColliderShapes.push(child.shape);
            this._autoChildColliderShapes.add(child.shape);
        }
        _clearAutoDetectedChildShapes() {
            for (let i = this._childColliderShapes.length - 1; i >= 0; i--) {
                if (this._autoChildColliderShapes.has(this._childColliderShapes[i]))
                    this._removeChildShapeAt(i);
            }
        }
        _collectAutoColliderSources(node, output, isRoot) {
            var _a;
            if (!isRoot) {
                if (!node.active || node.getComponent(PhysicsColliderComponent))
                    return;
                const mesh = (_a = node.getComponent(Laya.MeshFilter)) === null || _a === void 0 ? void 0 : _a.sharedMesh;
                if (mesh)
                    output.push({ node, mesh });
            }
            for (let i = 0, n = node.numChildren; i < n; i++) {
                const child = node.getChildAt(i);
                if (child instanceof Laya.Sprite3D)
                    this._collectAutoColliderSources(child, output, false);
            }
        }
        _createAutoColliderChild(source, rootInverse) {
            var _a;
            const relativeMatrix = new Laya.Matrix4x4();
            Laya.Matrix4x4.multiply(rootInverse, source.node.transform.worldMatrix, relativeMatrix);
            const position = new Laya.Vector3();
            const rotation = new Laya.Quaternion();
            const scale = new Laya.Vector3();
            if (!relativeMatrix.decomposeTransRotScale(position, rotation, scale))
                throw new Error(`${this._getNodePath(source.node)}: relative transform cannot be decomposed.`);
            if (scale.x <= 0 || scale.y <= 0 || scale.z <= 0)
                throw new Error(`${this._getNodePath(source.node)}: zero or negative scale is not supported.`);
            const shape = new MeshColliderShape();
            shape.convex = this.physicsComponent instanceof Rigidbody3D;
            shape.mesh = source.mesh;
            if (!((_a = shape.shape) === null || _a === void 0 ? void 0 : _a.getPhysicsShape())) {
                shape.destroy();
                throw new Error(`${this._getNodePath(source.node)}: failed to create a mesh collider shape.`);
            }
            return { shape, position, rotation, scale };
        }
        _getNodePath(node) {
            var _a;
            const names = [];
            const root = (_a = this.physicsComponent) === null || _a === void 0 ? void 0 : _a.owner;
            let current = node;
            while (current) {
                names.push(current.name || "<unnamed>");
                if (current === root)
                    break;
                current = current.parent instanceof Laya.Sprite3D ? current.parent : null;
            }
            return names.reverse().join("/");
        }
        cloneTo(destObject) {
            destObject.clearChildShape();
            for (let i = 0, n = this._childColliderShapes.length; i < n; i++) {
                const child = this._childColliderShapes[i];
                if (!this._autoChildColliderShapes.has(child))
                    destObject.addChildShape(child.clone());
            }
            destObject._autoDetectChildShapes = this._autoDetectChildShapes;
            super.cloneTo(destObject);
        }
        clone() {
            const dest = new CompoundColliderShape();
            this.cloneTo(dest);
            return dest;
        }
        destroy() {
            super.destroy();
            this._childColliderShapes.forEach(shape => shape.destroy());
            this._childColliderShapes.length = 0;
            this._autoChildColliderShapes.clear();
        }
    }

    class ConeColliderShape extends Physics3DColliderShape {
        get radius() {
            return this._radius;
        }
        set radius(value) {
            this._radius = value;
            if (Laya.LayaEnv.isPlaying)
                this._shape.setRadius(value);
        }
        get height() {
            return this._height;
        }
        set height(value) {
            this._height = value;
            if (Laya.LayaEnv.isPlaying)
                this._shape.setHeight(value);
        }
        get orientation() {
            return this._orientation;
        }
        set orientation(value) {
            this._orientation = value;
            if (Laya.LayaEnv.isPlaying)
                this._shape.setUpAxis(value);
        }
        constructor(radius = 0.5, height = 1.0, orientation = Physics3DColliderShape.SHAPEORIENTATION_UPY) {
            super();
            this._radius = 1;
            this._height = 0.5;
            this.radius = radius;
            this.height = height;
            this.orientation = orientation;
        }
        _createShape() {
            if (Laya.Laya3D.PhysicsCreateUtil.getPhysicsCapable(Laya.EPhysicsCapable.Physics_ConeColliderShape)) {
                this._shape = Laya.Laya3D.PhysicsCreateUtil.createConeColliderShape();
            }
            else {
                console.error("ConeColliderShape: cant enable ConeColliderShape");
            }
        }
        clone() {
            var dest = new ConeColliderShape(this._radius, this._height, this._orientation);
            this.cloneTo(dest);
            return dest;
        }
        cloneTo(destObject) {
            super.cloneTo(destObject);
            destObject.radius = this.radius;
            destObject.height = this.height;
            destObject.orientation = this.orientation;
        }
    }

    class CylinderColliderShape extends Physics3DColliderShape {
        get radius() {
            return this._radius;
        }
        set radius(value) {
            this._radius = value;
            if (Laya.LayaEnv.isPlaying)
                this._shape.setRadius(value);
        }
        get height() {
            return this._height;
        }
        set height(value) {
            this._height = value;
            if (Laya.LayaEnv.isPlaying)
                this._shape.setHeight(value);
        }
        get orientation() {
            return this._orientation;
        }
        set orientation(value) {
            this._orientation = value;
            if (Laya.LayaEnv.isPlaying)
                this._shape.setUpAxis(value);
        }
        constructor(radius = 0.5, height = 1.0, orientation = Physics3DColliderShape.SHAPEORIENTATION_UPY) {
            super();
            this._radius = 1;
            this._height = 0.5;
            this.radius = radius;
            this.height = height;
            this.orientation = orientation;
        }
        _createShape() {
            if (Laya.Laya3D.PhysicsCreateUtil.getPhysicsCapable(Laya.EPhysicsCapable.Physics_CylinderColliderShape)) {
                this._shape = Laya.Laya3D.PhysicsCreateUtil.createCylinderColliderShape();
            }
            else {
                console.error("CylinderColliderShape: cant enable CylinderColliderShape");
            }
        }
        clone() {
            var dest = new CylinderColliderShape(this._radius, this._height, this._orientation);
            this.cloneTo(dest);
            return dest;
        }
        cloneTo(destObject) {
            super.cloneTo(destObject);
            destObject.radius = this.radius;
            destObject.height = this.height;
            destObject.orientation = this.orientation;
        }
    }

    class SphereColliderShape extends Physics3DColliderShape {
        get radius() {
            return this._radius;
        }
        set radius(value) {
            this._radius = value;
            if (Laya.LayaEnv.isPlaying)
                this._shape.setRadius(value);
        }
        constructor(radius = 0.5) {
            super();
            this.radius = radius;
        }
        _createShape() {
            if (Laya.Laya3D.PhysicsCreateUtil.getPhysicsCapable(Laya.EPhysicsCapable.Physics_SphereColliderShape))
                this._shape = Laya.Laya3D.PhysicsCreateUtil.createSphereColliderShape();
            else
                console.error("SphereColliderShape: cant enable SphereColliderShape");
        }
        clone() {
            var dest = new SphereColliderShape(this._radius);
            this.cloneTo(dest);
            return dest;
        }
        cloneTo(destObject) {
            super.cloneTo(destObject);
            destObject.radius = this.radius;
        }
    }

    exports.WheelCenterMode = void 0;
    (function (WheelCenterMode) {
        WheelCenterMode[WheelCenterMode["OwnerLocalPosition"] = 0] = "OwnerLocalPosition";
        WheelCenterMode[WheelCenterMode["Explicit"] = 1] = "Explicit";
    })(exports.WheelCenterMode || (exports.WheelCenterMode = {}));
    class WheelCollider extends Laya.Component {
        constructor() {
            super(...arguments);
            this._vehicleComponent = null;
            this._runtimeState = new Laya.VehicleWheelState();
            this._centerMode = exports.WheelCenterMode.OwnerLocalPosition;
            this._center = new Laya.Vector3();
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
        }
        get centerMode() { return this._centerMode; }
        set centerMode(value) {
            if (this._centerMode === value)
                return;
            this._centerMode = value;
        }
        get center() { return this._center; }
        set center(value) {
            if (!value)
                return;
            value.cloneTo(this._center);
        }
        get radius() { return this._radius; }
        set radius(value) {
            if (this._radius === value)
                return;
            this._radius = value;
        }
        get suspensionRestLength() { return this._suspensionRestLength; }
        set suspensionRestLength(value) {
            if (this._suspensionRestLength === value)
                return;
            this._suspensionRestLength = value;
        }
        get maxSuspensionTravel() { return this._maxSuspensionTravel; }
        set maxSuspensionTravel(value) {
            if (this._maxSuspensionTravel === value)
                return;
            this._maxSuspensionTravel = value;
        }
        get springStiffness() { return this._springStiffness; }
        set springStiffness(value) {
            if (this._springStiffness === value)
                return;
            this._springStiffness = value;
        }
        get compressionDamping() { return this._compressionDamping; }
        set compressionDamping(value) {
            if (this._compressionDamping === value)
                return;
            this._compressionDamping = value;
        }
        get reboundDamping() { return this._reboundDamping; }
        set reboundDamping(value) {
            if (this._reboundDamping === value)
                return;
            this._reboundDamping = value;
        }
        get maxSuspensionForce() { return this._maxSuspensionForce; }
        set maxSuspensionForce(value) {
            if (this._maxSuspensionForce === value)
                return;
            this._maxSuspensionForce = value;
        }
        get frictionStiffness() { return this._frictionStiffness; }
        set frictionStiffness(value) {
            if (this._frictionStiffness === value)
                return;
            this._frictionStiffness = value;
        }
        get motorForce() { return this._motorForce; }
        set motorForce(value) { this._motorForce = Number.isFinite(value) ? value : 0; }
        get brakeForce() { return this._brakeForce; }
        set brakeForce(value) { this._brakeForce = Number.isFinite(value) ? Math.max(0, value) : 0; }
        get steerAngle() { return this._steerAngle; }
        set steerAngle(value) { this._steerAngle = Number.isFinite(value) ? value : 0; }
        get isGrounded() { return this._runtimeState.isContact; }
        get angularSpeed() { return this._runtimeState.angularSpeed; }
        get rpm() { return this._runtimeState.rpm; }
        get suspensionForce() { return this._runtimeState.suspensionForce; }
        get skidInfo() { return this._runtimeState.skidInfo; }
        getGroundHit() {
            return this._runtimeState;
        }
        getWorldTransform(outPosition, outRotation) {
            this._runtimeState.worldPosition.cloneTo(outPosition);
            this._runtimeState.worldRotation.cloneTo(outRotation);
        }
        _setRuntimeState(value) {
            this._runtimeState = value || new Laya.VehicleWheelState();
        }
        _onDestroy() {
            const vehicle = this._vehicleComponent;
            this._vehicleComponent = null;
            if (vehicle)
                vehicle._onWheelDestroyed(this);
        }
        _cloneTo(dest) {
            dest.centerMode = this._centerMode;
            dest.center = this._center;
            dest.radius = this._radius;
            dest.suspensionRestLength = this._suspensionRestLength;
            dest.maxSuspensionTravel = this._maxSuspensionTravel;
            dest.springStiffness = this._springStiffness;
            dest.compressionDamping = this._compressionDamping;
            dest.reboundDamping = this._reboundDamping;
            dest.maxSuspensionForce = this._maxSuspensionForce;
            dest.frictionStiffness = this._frictionStiffness;
            dest.motorForce = 0;
            dest.brakeForce = 0;
            dest.steerAngle = 0;
            dest.enabled = this.enabled;
        }
    }

    class VehicleConfigResolver {
        static captureWheelDesc(chassis, wheel, uniformScale, out, tempCenter) {
            let center;
            if (wheel.centerMode === exports.WheelCenterMode.OwnerLocalPosition) {
                chassis.transform.globalToLocal(wheel.owner.transform.position, tempCenter);
                center = tempCenter;
            }
            else {
                center = wheel.center;
            }
            out.wheel = wheel;
            out.centerX = center.x * uniformScale;
            out.centerY = center.y * uniformScale;
            out.centerZ = center.z * uniformScale;
            out.radius = wheel.radius * uniformScale;
            out.suspensionRestLength = wheel.suspensionRestLength * uniformScale;
            out.maxSuspensionTravel = wheel.maxSuspensionTravel * uniformScale;
            out.springStiffness = wheel.springStiffness;
            out.compressionDamping = wheel.compressionDamping;
            out.reboundDamping = wheel.reboundDamping;
            out.maxSuspensionForce = wheel.maxSuspensionForce;
            out.frictionStiffness = wheel.frictionStiffness;
        }
    }

    exports.VehicleLifecycleState = void 0;
    (function (VehicleLifecycleState) {
        VehicleLifecycleState[VehicleLifecycleState["Uninitialized"] = 0] = "Uninitialized";
        VehicleLifecycleState[VehicleLifecycleState["WaitingForDependencies"] = 1] = "WaitingForDependencies";
        VehicleLifecycleState[VehicleLifecycleState["Active"] = 2] = "Active";
        VehicleLifecycleState[VehicleLifecycleState["Disabled"] = 3] = "Disabled";
        VehicleLifecycleState[VehicleLifecycleState["Rebuilding"] = 4] = "Rebuilding";
        VehicleLifecycleState[VehicleLifecycleState["Error"] = 5] = "Error";
        VehicleLifecycleState[VehicleLifecycleState["Destroyed"] = 6] = "Destroyed";
    })(exports.VehicleLifecycleState || (exports.VehicleLifecycleState = {}));
    var VehicleConfigFailureKind;
    (function (VehicleConfigFailureKind) {
        VehicleConfigFailureKind[VehicleConfigFailureKind["None"] = 0] = "None";
        VehicleConfigFailureKind[VehicleConfigFailureKind["InvalidConfig"] = 1] = "InvalidConfig";
        VehicleConfigFailureKind[VehicleConfigFailureKind["InvalidStructure"] = 2] = "InvalidStructure";
    })(VehicleConfigFailureKind || (VehicleConfigFailureKind = {}));
    class PhysicsVehicleComponent extends Laya.Component {
        constructor() {
            super(...arguments);
            this._vehicle = null;
            this._vehicleBody = null;
            this._wheels = [];
            this._physicsManager = null;
            this._requestedEnabled = false;
            this._listenerRegistered = false;
            this._autoDiscoverAttempted = false;
            this._forceReinitialize = false;
            this._resetPending = false;
            this._lastReportedError = null;
            this._state = exports.VehicleLifecycleState.Uninitialized;
            this._initializationError = null;
            this._captureFailureKind = VehicleConfigFailureKind.None;
            this._tempWheelCenter = new Laya.Vector3();
            this._desiredDesc = { chassis: null, chassisMass: 0, wheels: [] };
            this._appliedDesc = { chassis: null, chassisMass: 0, wheels: [] };
            this._changes = { flags: Laya.VehicleChangeFlags.None, changedWheelIndices: [] };
            this._inputs = [];
            this._states = [];
            this._stepListener = {
                beforePhysicsStep: (fixedDeltaTime) => this._beforePhysicsStep(fixedDeltaTime),
                afterPhysicsStep: (fixedDeltaTime) => this._afterPhysicsStep(fixedDeltaTime)
            };
        }
        get vehicleBody() { return this._vehicleBody; }
        set vehicleBody(value) {
            if (this._vehicleBody === value)
                return;
            this._vehicleBody = value;
        }
        get wheels() { return this._wheels; }
        set wheels(value) {
            this._wheels = value ? value.slice() : [];
            this._autoDiscoverAttempted = this._wheels.length > 0;
        }
        get isInitialized() { return this._vehicle !== null; }
        get lifecycleState() { return this._state; }
        get initializationError() { return this._initializationError; }
        addWheel(wheel) {
            if (!wheel || this._wheels.indexOf(wheel) !== -1)
                return false;
            this._wheels.push(wheel);
            this._autoDiscoverAttempted = true;
            return true;
        }
        removeWheel(wheel) {
            const index = this._wheels.indexOf(wheel);
            if (index === -1)
                return false;
            this._wheels.splice(index, 1);
            return true;
        }
        initVehicle() {
            if (!Laya.LayaEnv.isPlaying)
                return;
            this._forceReinitialize = true;
            this._autoDiscoverAttempted = false;
            if (!this._bindPhysicsManager())
                return;
            this._registerStepListener();
        }
        reset() {
            this._resetPending = true;
            for (let i = 0; i < this._wheels.length; i++) {
                this._wheels[i].motorForce = 0;
                this._wheels[i].brakeForce = 0;
                this._wheels[i].steerAngle = 0;
            }
        }
        _onWheelDestroyed(wheel) {
            const index = this._wheels.indexOf(wheel);
            if (index !== -1) {
                this._stopCurrentVehicle();
                this._wheels.splice(index, 1);
            }
        }
        _onEnable() {
            if (!Laya.LayaEnv.isPlaying) {
                this._requestedEnabled = false;
                this._state = exports.VehicleLifecycleState.Uninitialized;
                return;
            }
            this._requestedEnabled = true;
            if (!this._bindPhysicsManager())
                return;
            this._registerStepListener();
        }
        _onDisable() {
            this._requestedEnabled = false;
            this._state = this._vehicle ? exports.VehicleLifecycleState.Disabled : exports.VehicleLifecycleState.Uninitialized;
            const manager = this._physicsManager;
            const vehicle = this._vehicle;
            if (manager) {
                manager.deferPhysicsOperation(() => {
                    if (vehicle)
                        vehicle.setEnabled(false);
                    manager.removePhysicsStepListener(this._stepListener);
                });
            }
            this._listenerRegistered = false;
        }
        _onDestroy() {
            this._requestedEnabled = false;
            this._state = exports.VehicleLifecycleState.Destroyed;
            const manager = this._physicsManager;
            const vehicle = this._vehicle;
            if (manager) {
                manager.deferPhysicsOperation(() => {
                    manager.removePhysicsStepListener(this._stepListener);
                    if (vehicle) {
                        vehicle.setEnabled(false);
                        vehicle.destroy();
                    }
                });
            }
            else {
                this._deferDestroyVehicle(vehicle);
            }
            this._unbindAppliedWheels();
            this._vehicle = null;
            this._vehicleBody = null;
            this._physicsManager = null;
            this._wheels.length = 0;
            this._inputs.length = 0;
            this._states.length = 0;
        }
        _bindPhysicsManager() {
            const scene = this.owner && this.owner._scene;
            const manager = scene && scene._physicsManager;
            if (!manager) {
                this._setError("Vehicle is waiting for a Scene3D physics manager.", exports.VehicleLifecycleState.WaitingForDependencies);
                return false;
            }
            if (this._physicsManager && this._physicsManager !== manager) {
                const oldManager = this._physicsManager;
                const oldVehicle = this._vehicle;
                if (oldVehicle)
                    oldVehicle.setEnabled(false);
                oldManager.deferPhysicsOperation(() => {
                    oldManager.removePhysicsStepListener(this._stepListener);
                    if (oldVehicle)
                        oldVehicle.destroy();
                });
                this._listenerRegistered = false;
                this._unbindAppliedWheels();
                this._vehicle = null;
                this._clearDesc(this._appliedDesc);
                this._forceReinitialize = true;
            }
            this._physicsManager = manager;
            return true;
        }
        _registerStepListener() {
            if (this._listenerRegistered || !this._physicsManager)
                return;
            this._physicsManager.addPhysicsStepListener(this._stepListener);
            this._listenerRegistered = true;
        }
        _beforePhysicsStep(fixedDeltaTime) {
            if (!this._requestedEnabled || this.destroyed)
                return;
            this._synchronizeConfig();
            if (!this._vehicle)
                return;
            this._captureInputs();
            this._vehicle.setInputs(this._inputs);
            if (this._resetPending) {
                this._vehicle.reset();
                this._resetPending = false;
            }
            this._vehicle.beforePhysicsStep(fixedDeltaTime);
        }
        _afterPhysicsStep(fixedDeltaTime) {
            if (!this._requestedEnabled || !this._vehicle || this.destroyed)
                return;
            this._vehicle.afterPhysicsStep(fixedDeltaTime);
            this._ensureRuntimeArrays(this._appliedDesc.wheels.length);
            this._vehicle.readStates(this._states);
            for (let i = 0; i < this._appliedDesc.wheels.length; i++) {
                const wheel = this._appliedDesc.wheels[i].wheel;
                if (wheel && !wheel.destroyed)
                    wheel._setRuntimeState(this._states[i]);
            }
        }
        _synchronizeConfig() {
            const error = this._captureDesiredDesc();
            if (error) {
                if (this._captureFailureKind === VehicleConfigFailureKind.InvalidStructure) {
                    this._stopCurrentVehicle();
                    this._setError(error, exports.VehicleLifecycleState.WaitingForDependencies);
                }
                else {
                    this._setError(error, this._vehicle ? exports.VehicleLifecycleState.Active : exports.VehicleLifecycleState.Uninitialized);
                }
                return;
            }
            if (this._vehicle && this._appliedDesc.chassis !== this._desiredDesc.chassis) {
                if (!this._forceReinitialize) {
                    this._vehicle.setEnabled(false);
                    this._setError("vehicleBody changed at runtime; call initVehicle() to explicitly reinitialize.", exports.VehicleLifecycleState.Error);
                    return;
                }
                this._rebuildVehicle();
                return;
            }
            const topologyChanged = this._hasTopologyChanged();
            if (!this._vehicle || topologyChanged || this._forceReinitialize) {
                this._rebuildVehicle();
                return;
            }
            this._collectChanges();
            if (this._changes.flags !== Laya.VehicleChangeFlags.None) {
                const result = this._vehicle.applyConfig(this._desiredDesc, this._changes);
                if (result === Laya.VehicleApplyResult.RebuildRequired) {
                    this._rebuildVehicle();
                    return;
                }
                if (result !== Laya.VehicleApplyResult.Applied) {
                    this._setError("Backend rejected an atomic vehicle configuration update: " + Laya.VehicleApplyResult[result], exports.VehicleLifecycleState.Error);
                    return;
                }
                this._copyDesc(this._desiredDesc, this._appliedDesc);
            }
            this._vehicle.setEnabled(true);
            this._state = exports.VehicleLifecycleState.Active;
            this._forceReinitialize = false;
            this._clearError();
        }
        _rebuildVehicle() {
            const createUtil = Laya.Laya3D.PhysicsCreateUtil;
            if (!createUtil || !createUtil.createVehicle || !createUtil.getPhysicsCapable(Laya.EPhysicsCapable.Physics_VehicleSystem)) {
                this._setError("The selected physics backend does not support vehicles.", exports.VehicleLifecycleState.Error);
                return;
            }
            this._state = exports.VehicleLifecycleState.Rebuilding;
            const oldVehicle = this._vehicle;
            let replacement = null;
            try {
                replacement = createUtil.createVehicle(this._physicsManager, this._desiredDesc);
                if (!replacement)
                    throw new Error("Backend returned no vehicle instance.");
                this._ensureRuntimeArrays(this._desiredDesc.wheels.length);
                this._captureInputsFromDesc(this._desiredDesc);
                replacement.setInputs(this._inputs);
                if (oldVehicle) {
                    oldVehicle.setEnabled(false);
                    this._deferDestroyVehicle(oldVehicle);
                }
                replacement.setEnabled(true);
                this._vehicle = replacement;
                this._unbindAppliedWheels();
                this._copyDesc(this._desiredDesc, this._appliedDesc);
                this._bindAppliedWheels();
                this._state = exports.VehicleLifecycleState.Active;
                this._forceReinitialize = false;
                this._clearError();
            }
            catch (error) {
                if (replacement) {
                    replacement.setEnabled(false);
                    this._deferDestroyVehicle(replacement);
                }
                this._vehicle = oldVehicle;
                if (oldVehicle)
                    oldVehicle.setEnabled(true);
                const message = error instanceof Error ? error.message : String(error);
                this._setError("Vehicle rebuild failed: " + message, exports.VehicleLifecycleState.Error);
            }
        }
        _deferDestroyVehicle(vehicle) {
            if (!vehicle)
                return;
            if (this._physicsManager)
                this._physicsManager.deferPhysicsOperation(() => vehicle.destroy());
            else
                vehicle.destroy();
        }
        _captureDesiredDesc() {
            var _a;
            this._captureFailureKind = VehicleConfigFailureKind.None;
            if (!this._vehicleBody || this._vehicleBody.destroyed) {
                const ownerBody = this.owner.getComponent(Rigidbody3D);
                if (ownerBody)
                    this._vehicleBody = ownerBody;
            }
            if (!this._vehicleBody)
                return this._structureError("Vehicle requires a Rigidbody3D chassis on its owner or vehicleBody.");
            if (this._vehicleBody.owner !== this.owner)
                return this._structureError("vehicleBody must be the Rigidbody3D attached to the vehicle owner.");
            if (this._vehicleBody.destroyed || !this._vehicleBody.collider || !this._vehicleBody.colliderShape)
                return this._structureError("Vehicle chassis collider or collider shape has not been created or was destroyed.");
            if (!this._vehicleBody.enabled || !this._vehicleBody.owner.activeInHierarchy)
                return this._structureError("Vehicle chassis Rigidbody3D must be enabled and active in the Scene3D.");
            if (this._vehicleBody.isKinematic)
                return this._structureError("Vehicle chassis must be a dynamic, non-kinematic Rigidbody3D.");
            if (this._vehicleBody.owner._scene !== this.owner._scene)
                return this._structureError("Vehicle chassis and vehicle component must belong to the same Scene3D.");
            const scale = this.owner.transform.getWorldLossyScale();
            if (!Number.isFinite(scale.x) || !Number.isFinite(scale.y) || !Number.isFinite(scale.z)
                || scale.x <= 0 || scale.y <= 0 || scale.z <= 0)
                return this._structureError("Vehicle chassis world scale must contain finite values greater than zero.");
            const uniformScale = scale.x;
            const scaleTolerance = 0.0001 * Math.max(1, uniformScale);
            if (Math.abs(scale.x - scale.y) > scaleTolerance || Math.abs(scale.x - scale.z) > scaleTolerance)
                return this._structureError("Vehicle chassis does not support non-uniform world scale.");
            if (this._wheels.length === 0 && !this._autoDiscoverAttempted) {
                this._autoDiscoverAttempted = true;
                this._collectWheelColliders(this.owner);
            }
            if (this._wheels.length === 0)
                return this._configError("Vehicle requires at least one WheelCollider.");
            this._desiredDesc.chassis = this._vehicleBody.collider;
            this._desiredDesc.chassisMass = this._vehicleBody.mass;
            const scene = this.owner._scene;
            for (let i = 0; i < this._wheels.length; i++) {
                const wheel = this._wheels[i];
                if (wheel && (wheel.destroyed || ((_a = wheel.owner) === null || _a === void 0 ? void 0 : _a.destroyed))) {
                    this._onWheelDestroyed(wheel);
                    i--;
                    continue;
                }
                if (!wheel || !wheel.owner)
                    return this._structureError("Vehicle wheel " + i + " is null or destroyed.");
                for (let previous = 0; previous < i; previous++) {
                    if (this._wheels[previous] === wheel)
                        return this._configError("Vehicle contains the same WheelCollider more than once.");
                }
                if (wheel._vehicleComponent && wheel._vehicleComponent !== this)
                    return this._structureError("WheelCollider " + wheel.owner.name + " is already owned by another vehicle.");
                if (wheel.owner._scene !== scene)
                    return this._structureError("All vehicle wheels must belong to the chassis Scene3D.");
                if (wheel.owner === this.owner || !this.owner.contains(wheel.owner))
                    return this._structureError("Every WheelCollider must be attached to a descendant of the vehicle chassis.");
                if (!wheel.enabled || !wheel.owner.activeInHierarchy)
                    return this._structureError("Every WheelCollider must be enabled and active in the Scene3D.");
                let target = this._desiredDesc.wheels[i];
                if (!target) {
                    target = this._createEmptyWheelDesc();
                    this._desiredDesc.wheels[i] = target;
                }
                VehicleConfigResolver.captureWheelDesc(this.owner, wheel, uniformScale, target, this._tempWheelCenter);
                const wheelError = this._validateWheelDesc(target, i);
                if (wheelError)
                    return this._configError(wheelError);
            }
            this._desiredDesc.wheels.length = this._wheels.length;
            if (!Number.isFinite(this._desiredDesc.chassisMass) || this._desiredDesc.chassisMass <= 0)
                return this._configError("Vehicle chassis mass must be finite and greater than zero.");
            return null;
        }
        _structureError(message) {
            this._captureFailureKind = VehicleConfigFailureKind.InvalidStructure;
            return message;
        }
        _configError(message) {
            this._captureFailureKind = VehicleConfigFailureKind.InvalidConfig;
            return message;
        }
        _stopCurrentVehicle() {
            const vehicle = this._vehicle;
            if (!vehicle)
                return;
            vehicle.setEnabled(false);
            this._vehicle = null;
            this._unbindAppliedWheels();
            this._clearDesc(this._appliedDesc);
            this._deferDestroyVehicle(vehicle);
        }
        _validateWheelDesc(wheel, index) {
            const prefix = "Wheel " + index + ": ";
            if (!Number.isFinite(wheel.centerX) || !Number.isFinite(wheel.centerY) || !Number.isFinite(wheel.centerZ))
                return prefix + "center must contain finite values.";
            if (!Number.isFinite(wheel.radius) || wheel.radius <= 0)
                return prefix + "radius must be greater than zero.";
            if (!Number.isFinite(wheel.suspensionRestLength) || wheel.suspensionRestLength < 0)
                return prefix + "suspensionRestLength must be non-negative.";
            if (!Number.isFinite(wheel.maxSuspensionTravel) || wheel.maxSuspensionTravel < 0)
                return prefix + "maxSuspensionTravel must be non-negative.";
            if (!Number.isFinite(wheel.springStiffness) || wheel.springStiffness < 0)
                return prefix + "springStiffness must be non-negative.";
            if (!Number.isFinite(wheel.compressionDamping) || wheel.compressionDamping < 0
                || !Number.isFinite(wheel.reboundDamping) || wheel.reboundDamping < 0)
                return prefix + "suspension damping must be non-negative.";
            if (!Number.isFinite(wheel.maxSuspensionForce) || wheel.maxSuspensionForce < 0)
                return prefix + "maxSuspensionForce must be non-negative.";
            if (!Number.isFinite(wheel.frictionStiffness) || wheel.frictionStiffness < 0)
                return prefix + "frictionStiffness must be non-negative.";
            return null;
        }
        _hasTopologyChanged() {
            if (!this._vehicle || this._desiredDesc.wheels.length !== this._appliedDesc.wheels.length)
                return true;
            for (let i = 0; i < this._desiredDesc.wheels.length; i++) {
                if (this._desiredDesc.wheels[i].wheel !== this._appliedDesc.wheels[i].wheel)
                    return true;
            }
            return false;
        }
        _collectChanges() {
            this._changes.flags = Laya.VehicleChangeFlags.None;
            this._changes.changedWheelIndices.length = 0;
            if (!this._nearlyEqual(this._desiredDesc.chassisMass, this._appliedDesc.chassisMass))
                this._changes.flags |= Laya.VehicleChangeFlags.ChassisMass;
            for (let i = 0; i < this._desiredDesc.wheels.length; i++) {
                if (!this._wheelDescEquals(this._desiredDesc.wheels[i], this._appliedDesc.wheels[i])) {
                    this._changes.flags |= Laya.VehicleChangeFlags.WheelConfig;
                    this._changes.changedWheelIndices.push(i);
                }
            }
        }
        _wheelDescEquals(a, b) {
            return a.wheel === b.wheel
                && this._nearlyEqual(a.centerX, b.centerX)
                && this._nearlyEqual(a.centerY, b.centerY)
                && this._nearlyEqual(a.centerZ, b.centerZ)
                && this._nearlyEqual(a.radius, b.radius)
                && this._nearlyEqual(a.suspensionRestLength, b.suspensionRestLength)
                && this._nearlyEqual(a.maxSuspensionTravel, b.maxSuspensionTravel)
                && this._nearlyEqual(a.springStiffness, b.springStiffness)
                && this._nearlyEqual(a.compressionDamping, b.compressionDamping)
                && this._nearlyEqual(a.reboundDamping, b.reboundDamping)
                && this._nearlyEqual(a.maxSuspensionForce, b.maxSuspensionForce)
                && this._nearlyEqual(a.frictionStiffness, b.frictionStiffness);
        }
        _nearlyEqual(a, b) {
            return Math.abs(a - b) <= 0.000001 * Math.max(1, Math.abs(a), Math.abs(b));
        }
        _copyDesc(source, target) {
            target.chassis = source.chassis;
            target.chassisMass = source.chassisMass;
            for (let i = 0; i < source.wheels.length; i++) {
                let destination = target.wheels[i];
                if (!destination) {
                    destination = this._createEmptyWheelDesc();
                    target.wheels[i] = destination;
                }
                const wheel = source.wheels[i];
                destination.wheel = wheel.wheel;
                destination.centerX = wheel.centerX;
                destination.centerY = wheel.centerY;
                destination.centerZ = wheel.centerZ;
                destination.radius = wheel.radius;
                destination.suspensionRestLength = wheel.suspensionRestLength;
                destination.maxSuspensionTravel = wheel.maxSuspensionTravel;
                destination.springStiffness = wheel.springStiffness;
                destination.compressionDamping = wheel.compressionDamping;
                destination.reboundDamping = wheel.reboundDamping;
                destination.maxSuspensionForce = wheel.maxSuspensionForce;
                destination.frictionStiffness = wheel.frictionStiffness;
            }
            target.wheels.length = source.wheels.length;
        }
        _clearDesc(desc) {
            desc.chassis = null;
            desc.chassisMass = 0;
            desc.wheels.length = 0;
        }
        _createEmptyWheelDesc() {
            return {
                wheel: null, centerX: 0, centerY: 0, centerZ: 0, radius: 0,
                suspensionRestLength: 0, maxSuspensionTravel: 0, springStiffness: 0,
                compressionDamping: 0, reboundDamping: 0, maxSuspensionForce: 0,
                frictionStiffness: 0
            };
        }
        _captureInputs() {
            this._captureInputsFromDesc(this._appliedDesc);
        }
        _captureInputsFromDesc(desc) {
            this._ensureRuntimeArrays(desc.wheels.length);
            for (let i = 0; i < desc.wheels.length; i++) {
                const wheel = desc.wheels[i].wheel;
                const input = this._inputs[i];
                input.motorForce = wheel && !wheel.destroyed ? wheel.motorForce : 0;
                input.brakeForce = wheel && !wheel.destroyed ? wheel.brakeForce : 0;
                input.steerAngle = wheel && !wheel.destroyed ? wheel.steerAngle * Math.PI / 180.0 : 0;
            }
        }
        _ensureRuntimeArrays(count) {
            while (this._inputs.length < count)
                this._inputs.push({ motorForce: 0, brakeForce: 0, steerAngle: 0 });
            while (this._states.length < count)
                this._states.push(new Laya.VehicleWheelState());
            this._inputs.length = count;
            this._states.length = count;
        }
        _bindAppliedWheels() {
            for (let i = 0; i < this._appliedDesc.wheels.length; i++) {
                const wheel = this._appliedDesc.wheels[i].wheel;
                wheel._vehicleComponent = this;
                wheel._setRuntimeState(this._states[i]);
            }
        }
        _unbindAppliedWheels() {
            for (let i = 0; i < this._appliedDesc.wheels.length; i++) {
                const wheel = this._appliedDesc.wheels[i].wheel;
                if (wheel && wheel._vehicleComponent === this) {
                    wheel._vehicleComponent = null;
                    wheel._setRuntimeState(null);
                }
            }
        }
        _collectWheelColliders(node) {
            for (let i = 0; i < node.numChildren; i++) {
                const child = node.getChildAt(i);
                const wheel = child.getComponent(WheelCollider);
                if (wheel && this._wheels.indexOf(wheel) === -1)
                    this._wheels.push(wheel);
                if (child.numChildren > 0)
                    this._collectWheelColliders(child);
            }
        }
        _cloneTo(dest) {
            dest._vehicleBody = null;
            dest._wheels.length = 0;
            for (let i = 0; i < this._wheels.length; i++) {
                const clonedWheel = this._findClonedWheel(this._wheels[i], dest.owner);
                if (clonedWheel)
                    dest._wheels.push(clonedWheel);
            }
            dest._autoDiscoverAttempted = dest._wheels.length > 0;
            dest.enabled = this.enabled;
        }
        _findClonedWheel(sourceWheel, destinationRoot) {
            if (!sourceWheel || !sourceWheel.owner || !this.owner.contains(sourceWheel.owner))
                return null;
            const path = [];
            let node = sourceWheel.owner;
            while (node && node !== this.owner) {
                const parent = node.parent;
                if (!parent)
                    return null;
                path.push(parent.getChildIndex(node));
                node = parent;
            }
            let destination = destinationRoot;
            for (let i = path.length - 1; i >= 0; i--) {
                const index = path[i];
                if (index < 0 || index >= destination.numChildren)
                    return null;
                destination = destination.getChildAt(index);
            }
            return destination.getComponent(WheelCollider);
        }
        _setError(message, state) {
            this._state = state;
            this._initializationError = message;
            if (message !== this._lastReportedError) {
                this._lastReportedError = message;
                if (state === exports.VehicleLifecycleState.Active)
                    console.warn("[PhysicsVehicle] " + message);
                else
                    console.error("[PhysicsVehicle] " + message);
            }
        }
        _clearError() {
            this._initializationError = null;
            this._lastReportedError = null;
        }
    }

    let c = Laya.ClassUtils.regClass;
    c("ConfigurableConstraint", ConfigurableConstraint);
    c("FixedConstraint", FixedConstraint);
    c("ConstraintComponent", ConstraintComponent);
    c("HingeConstraint", HingeConstraint);
    c("SpringConstraint", SpringConstraint);
    c("Physics3DColliderShape", Physics3DColliderShape);
    c("BoxColliderShape", BoxColliderShape);
    c("CapsuleColliderShape", CapsuleColliderShape);
    c("CompoundColliderShape", CompoundColliderShape);
    c("ConeColliderShape", ConeColliderShape);
    c("CylinderColliderShape", CylinderColliderShape);
    c("MeshColliderShape", MeshColliderShape);
    c("SphereColliderShape", SphereColliderShape);
    c("CharacterController", CharacterController);
    c("Rigidbody3D", Rigidbody3D);
    c("PhysicsColliderComponent", PhysicsColliderComponent);
    c("PhysicsCollider", PhysicsCollider);
    c("PhysicsUpdateList", PhysicsUpdateList);
    c("Physics3DStatInfo", Laya.Physics3DStatInfo);
    c("PhysicsVehicleComponent", PhysicsVehicleComponent);
    c("WheelCollider", WheelCollider);

    class HeightFieldColliderShape extends Physics3DColliderShape {
        constructor(heightFieldData) {
            super();
            this._terrainData = heightFieldData;
            this._shape.setHeightFieldData(this._terrainData.numRows, this._terrainData.numCols, this._terrainData.heightData, this._terrainData.flag, this._terrainData.scale);
        }
        _createShape() {
            if (Laya.Laya3D.PhysicsCreateUtil.getPhysicsCapable(Laya.EPhysicsCapable.physics_heightFieldColliderShape))
                this._shape = Laya.Laya3D.PhysicsCreateUtil.createHeightFieldShape();
            else {
                console.error("HeightFieldColliderShape: cant enable HeightFieldColliderShape");
            }
        }
    }

    exports.BoxColliderShape = BoxColliderShape;
    exports.CapsuleColliderShape = CapsuleColliderShape;
    exports.CharacterController = CharacterController;
    exports.CompoundColliderShape = CompoundColliderShape;
    exports.ConeColliderShape = ConeColliderShape;
    exports.ConfigurableConstraint = ConfigurableConstraint;
    exports.ConstraintComponent = ConstraintComponent;
    exports.CylinderColliderShape = CylinderColliderShape;
    exports.FixedConstraint = FixedConstraint;
    exports.HeightFieldColliderShape = HeightFieldColliderShape;
    exports.HingeConstraint = HingeConstraint;
    exports.MeshColliderShape = MeshColliderShape;
    exports.Physics3DColliderShape = Physics3DColliderShape;
    exports.PhysicsCollider = PhysicsCollider;
    exports.PhysicsColliderComponent = PhysicsColliderComponent;
    exports.PhysicsUpdateList = PhysicsUpdateList;
    exports.PhysicsVehicleComponent = PhysicsVehicleComponent;
    exports.Rigidbody3D = Rigidbody3D;
    exports.SphereColliderShape = SphereColliderShape;
    exports.SpringConstraint = SpringConstraint;
    exports.VehicleConfigResolver = VehicleConfigResolver;
    exports.WheelCollider = WheelCollider;

})(window.Laya = window.Laya || {}, Laya);
//# sourceMappingURL=laya.physics3D.js.map
