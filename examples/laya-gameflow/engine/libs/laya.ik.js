(function (exports, Laya) {
    'use strict';

    let xUnitVec3;
    let yUnitVec3;
    let tmpVec3;
    function quaternionFromTo(from, to, out) {
        if (!xUnitVec3) {
            xUnitVec3 = new Laya.Vector3(1, 0, 0);
            yUnitVec3 = new Laya.Vector3(0, 1, 0);
            tmpVec3 = new Laya.Vector3();
        }
        var dot = Laya.Vector3.dot(from, to);
        if (dot < -0.99999999) {
            Laya.Vector3.cross(xUnitVec3, from, tmpVec3);
            if (Laya.Vector3.scalarLength(tmpVec3) < 0.000001)
                Laya.Vector3.cross(yUnitVec3, from, tmpVec3);
            Laya.Vector3.normalize(tmpVec3, tmpVec3);
            Laya.Quaternion.createFromAxisAngle(tmpVec3, Math.PI, out);
            return true;
        }
        else if (dot > 0.99999999) {
            out.x = 0;
            out.y = 0;
            out.z = 0;
            out.w = 1;
            return false;
        }
        else {
            Laya.Vector3.cross(from, to, tmpVec3);
            out.x = tmpVec3.x;
            out.y = tmpVec3.y;
            out.z = tmpVec3.z;
            out.w = 1 + dot;
            out.normalize(out);
            return true;
        }
    }
    function delay(time) {
        return new Promise(function (resolve) {
            setTimeout(resolve, time);
        });
    }
    let dv1 = new Laya.Vector3();
    let dv2 = new Laya.Vector3();
    function isCollinear(p1, p2, p3, epsilon = 1e-6) {
        const v1 = p2.vsub(p1, dv1).normalize();
        const v2 = p3.vsub(p1, dv2).normalize();
        const dot = Math.abs(v1.dot(v2));
        return Math.abs(dot - 1) < epsilon;
    }
    function solveLambdaForNormEquality(v1, v2, v3) {
        const EPS = 1e-8;
        const a = Laya.Vector3.dot(v2, v2);
        const b = 2 * Laya.Vector3.dot(v1, v2);
        const c = Laya.Vector3.dot(v1, v1) - Laya.Vector3.dot(v3, v3);
        if (Math.abs(a) < EPS) {
            if (Math.abs(b) < EPS) {
                return Math.abs(c) < EPS ? 0 : NaN;
            }
            const x = -c / b;
            return x >= -EPS ? (x < 0 ? 0 : x) : NaN;
        }
        const delta = b * b - 4 * a * c;
        if (delta < -EPS) {
            return NaN;
        }
        if (Math.abs(delta) <= EPS) {
            const x = -b / (2 * a);
            return x >= -EPS ? (x < 0 ? 0 : x) : NaN;
        }
        const sqrtDelta = Math.sqrt(delta);
        const r1 = (-b + sqrtDelta) / (2 * a);
        const r2 = (-b - sqrtDelta) / (2 * a);
        let has1 = false, has2 = false;
        let c1 = 0, c2 = 0;
        if (r1 >= -EPS) {
            has1 = true;
            c1 = r1 < 0 ? 0 : r1;
        }
        if (r2 >= -EPS) {
            has2 = true;
            c2 = r2 < 0 ? 0 : r2;
        }
        if (!has1 && !has2)
            return NaN;
        if (has1 && !has2)
            return c1;
        if (!has1 && has2)
            return c2;
        return Math.abs(c1) <= Math.abs(c2) ? c1 : c2;
    }
    function solveLookat(target, endPose, deltaQ) {
        let ele = endPose.elements;
        let endPos = new Laya.Vector3(ele[12], ele[13], ele[14]);
        let endDir = new Laya.Vector3(ele[8], ele[9], ele[10]);
        endDir.normalize();
        let k = solveLambdaForNormEquality(endPos, endDir, target);
        if (isNaN(k)) {
            return false;
        }
        let v1 = new Laya.Vector3();
        Laya.Vector3.scale(endDir, k, v1);
        Laya.Vector3.add(endPos, v1, v1);
        v1.normalize();
        let t = target.clone().normalize();
        quaternionFromTo(v1, t, deltaQ);
        return true;
    }
    function ripMatScale(mat) {
        let e = mat.elements;
        let d = Math.sqrt(e[0] ** 2 + e[1] ** 2 + e[2] ** 2);
        e[0] /= d;
        e[1] /= d;
        e[2] /= d;
        d = Math.sqrt(e[4] ** 2 + e[5] ** 2 + e[6] ** 2);
        e[4] /= d;
        e[5] /= d;
        e[6] /= d;
        d = Math.sqrt(e[8] ** 2 + e[9] ** 2 + e[10] ** 2);
        e[8] /= d;
        e[9] /= d;
        e[10] /= d;
        return mat;
    }
    function VecAngle(v1, v2) {
        let v1l = v1.length();
        let v2l = v2.length();
        let dot = v1.dot(v2);
        let v = dot / v1l / v2l;
        if (v > 1)
            v = 1;
        return Math.acos(v);
    }
    function getVecAngInPlane(axisPos, axis, zero, vec) {
        let v1 = new Laya.Vector3();
        vec.vsub(axisPos, v1);
        let dot = Laya.Vector3.dot(v1, axis);
        let projVec = new Laya.Vector3(v1.x - dot * axis.x, v1.y - dot * axis.y, v1.z - dot * axis.z);
        let dot1 = Laya.Vector3.dot(zero, axis);
        let projZero = new Laya.Vector3(zero.x - dot1 * axis.x, zero.y - dot1 * axis.y, zero.z - dot1 * axis.z);
        let angle = VecAngle(projZero, projVec);
        let cross = new Laya.Vector3();
        Laya.Vector3.cross(projZero, projVec, cross);
        if (Laya.Vector3.dot(cross, axis) < 0) {
            angle = -angle;
        }
        return angle;
    }
    class NumberSmooth {
        constructor(k = 0.5) {
            this.k = k;
            this.lastv = 0;
        }
        in(v) {
            let k = this.k;
            let k1 = 1 - k;
            this.lastv = v * k + this.lastv * k1;
            return this.lastv;
        }
    }
    class Vec3Smooth {
        constructor(k = 0.5) {
            this.k = k;
            this.lastV = null;
        }
        in(v) {
            let k = this.k;
            let k1 = 1 - k;
            if (!this.lastV)
                this.lastV = v.clone();
            let v0 = this.lastV;
            let v1 = v;
            this.lastV.setValue(v1.x * k + v0.x * k1, v1.y * k + v0.y * k1, v1.z * k + v0.z * k1);
            return this.lastV;
        }
    }

    new Laya.Vector3();
    new Laya.Quaternion();
    new Laya.Vector3();
    new Laya.Vector3();
    new Laya.Vector3();
    new Laya.Vector3();
    new Laya.Vector3();
    new Laya.Vector3();
    new Laya.Quaternion();
    new Laya.Quaternion();
    new Laya.Quaternion();
    class IK_CCDSolver {
        constructor(maxIterations = 1) {
            this.dampingFactor = 0.1;
            this.poleTarget = null;
            this._targetPos = new Laya.Vector3();
            this._currentEndPos = new Laya.Vector3();
            this._jointToEndVec = new Laya.Vector3();
            this._jointToTargetVec = new Laya.Vector3();
            this._pivotPos = new Laya.Vector3();
            this._rotationDelta = new Laya.Quaternion();
            this._calcVecA = new Laya.Vector3();
            this._calcVecB = new Laya.Vector3();
            this._calcVecC = new Laya.Vector3();
            this._calcQuat = new Laya.Quaternion();
            this.maxIterations = maxIterations;
        }
        solve(comp, chain, target, endOffline) {
            const joints = chain.joints;
            if (joints.length < 2)
                return false;
            const endId = endOffline ? joints.length - 2 : joints.length - 1;
            const endEffector = joints[endId];
            const basePos = joints[0].position;
            target.cloneTo(this._targetPos);
            const totalLength = this.calculateTotalLength(joints, endId);
            const distBaseToTarget = Laya.Vector3.distance(basePos, this._targetPos);
            if (distBaseToTarget > totalLength) {
                const dirBaseToTarget = this._calcVecA;
                this._targetPos.vsub(basePos, dirBaseToTarget);
                dirBaseToTarget.normalize();
                const clampedDist = totalLength * 0.9999;
                dirBaseToTarget.scale(clampedDist, dirBaseToTarget);
                Laya.Vector3.add(basePos, dirBaseToTarget, this._targetPos);
            }
            if (this.poleTarget && joints.length > 2) {
                this.preRotateToPole(joints, endId, basePos);
            }
            let iteration = 0;
            let touched = false;
            const epsilonSq = chain.maxError * chain.maxError;
            endEffector.position.cloneTo(this._currentEndPos);
            while (iteration < this.maxIterations) {
                touched = this.solveOneIteration(joints, endId, this._targetPos, epsilonSq);
                if (touched)
                    break;
                iteration++;
                if (iteration < this.maxIterations) {
                    this.updateAllJointPositions(joints, endId);
                    endEffector.position.cloneTo(this._currentEndPos);
                }
            }
            this.updateAllJointPositions(joints, endId);
            if (this.poleTarget && joints.length > 2) {
                this.solvePoleVector(comp, chain, joints, endId, basePos);
            }
            comp.current_iteration = iteration;
            comp.current_error = Math.sqrt(Laya.Vector3.distanceSquared(endEffector.position, this._targetPos));
            return touched;
        }
        preRotateToPole(joints, endId, basePos) {
            const polePos = this.poleTarget.pos;
            const midJoint = joints[1];
            const endJoint = joints[endId];
            const axis = this._calcVecA;
            endJoint.position.vsub(basePos, axis);
            if (axis.lengthSquared() < 1e-6)
                return;
            axis.normalize();
            const baseToMid = this._calcVecB;
            midJoint.position.vsub(basePos, baseToMid);
            const projMid = this._jointToEndVec;
            const dotMid = Laya.Vector3.dot(baseToMid, axis);
            const tmp = this._calcVecC;
            axis.scale(dotMid, tmp);
            baseToMid.vsub(tmp, projMid);
            const baseToPole = this._jointToTargetVec;
            polePos.vsub(basePos, baseToPole);
            const projPole = this._pivotPos;
            const dotPole = Laya.Vector3.dot(baseToPole, axis);
            axis.scale(dotPole, tmp);
            baseToPole.vsub(tmp, projPole);
            if (projMid.lengthSquared() > 1e-4 && projPole.lengthSquared() > 1e-4) {
                projMid.normalize();
                projPole.normalize();
                const rot = this._calcQuat;
                quaternionFromTo(projMid, projPole, rot);
                const root = joints[0];
                Laya.Quaternion.multiply(rot, root.rotationQuat, root.rotationQuat);
                this.updateAllJointPositions(joints, endId);
            }
        }
        solveOneIteration(joints, endId, targetPos, epsilonSq) {
            const currentEndPos = this._currentEndPos;
            const jointToEnd = this._jointToEndVec;
            const jointToTarget = this._jointToTargetVec;
            const rotation = this._rotationDelta;
            const pivot = this._pivotPos;
            for (let i = endId - 1; i >= 0; i--) {
                const joint = joints[i];
                if (joint.fixed)
                    continue;
                joint.position.cloneTo(pivot);
                if (Laya.Vector3.distanceSquared(currentEndPos, targetPos) < epsilonSq) {
                    return true;
                }
                currentEndPos.vsub(pivot, jointToEnd);
                targetPos.vsub(pivot, jointToTarget);
                if (jointToEnd.lengthSquared() < 1e-6 || jointToTarget.lengthSquared() < 1e-6) {
                    continue;
                }
                jointToEnd.normalize();
                jointToTarget.normalize();
                quaternionFromTo(jointToEnd, jointToTarget, rotation);
                if (this.dampingFactor < 1.0 && this.dampingFactor > 0) {
                    Laya.Quaternion.slerp(Laya.Quaternion.DEFAULT, rotation, this.dampingFactor, rotation);
                }
                const curQ = joint.rotationQuat;
                Laya.Quaternion.multiply(rotation, curQ, curQ);
                curQ.normalize(curQ);
                joint.rotationQuat = curQ;
                if (joint.constraint && joint.constraint.enable) {
                    joint.constraint.doConsraint(joint);
                }
                currentEndPos.vsub(pivot, jointToEnd);
                Laya.Vector3.transformQuat(jointToEnd, rotation, jointToEnd);
                Laya.Vector3.add(pivot, jointToEnd, currentEndPos);
            }
            return false;
        }
        updateAllJointPositions(joints, endId) {
            for (let i = 0; i < endId; i++) {
                const parent = joints[i];
                const child = joints[i + 1];
                if (child) {
                    const offset = this._calcVecA;
                    Laya.Vector3.transformQuat(child.relPos, parent.rotationQuat, offset);
                    const newPos = child.position;
                    newPos.x = parent.position.x + offset.x;
                    newPos.y = parent.position.y + offset.y;
                    newPos.z = parent.position.z + offset.z;
                    child.position = newPos;
                }
            }
        }
        calculateTotalLength(joints, endId) {
            let len = 0;
            for (let i = 0; i < endId; i++) {
                len += joints[i].length;
            }
            return len;
        }
        solvePoleVector(comp, chain, joints, endId, basePos) {
            const axis = this._calcVecA;
            const baseToPole = this._calcVecB;
            const baseToMid = this._calcVecC;
            const projMid = this._jointToEndVec;
            const projPole = this._jointToTargetVec;
            const tmpCross = this._pivotPos;
            const endPos = joints[endId].position;
            const polePos = this.poleTarget.pos;
            const midPos = chain.joints[1].position;
            endPos.vsub(basePos, axis);
            polePos.vsub(basePos, baseToPole);
            midPos.vsub(basePos, baseToMid);
            const axisLenSq = axis.lengthSquared();
            if (axisLenSq < 1e-6)
                return;
            const axisLen = Math.sqrt(axisLenSq);
            axis.scale(1 / axisLen, axis);
            const dotMid = Laya.Vector3.dot(baseToMid, axis);
            const tmpAxisScaled = projMid;
            axis.scale(dotMid, tmpAxisScaled);
            baseToMid.vsub(tmpAxisScaled, projMid);
            const dotPole = Laya.Vector3.dot(baseToPole, axis);
            const tmpAxisScaled2 = projPole;
            axis.scale(dotPole, tmpAxisScaled2);
            baseToPole.vsub(tmpAxisScaled2, projPole);
            const lenMid = projMid.length();
            const lenPole = projPole.length();
            if (lenMid > 1e-3 && lenPole > 1e-3) {
                projMid.scale(1 / lenMid, projMid);
                projPole.scale(1 / lenPole, projPole);
                const cosTheta = Math.max(-1, Math.min(1, Laya.Vector3.dot(projMid, projPole)));
                Laya.Vector3.cross(projMid, projPole, tmpCross);
                const sinTheta = Laya.Vector3.dot(tmpCross, axis);
                let angle = Math.atan2(sinTheta, cosTheta);
                if (Math.abs(angle) > 1e-4) {
                    comp.pole_rot = angle;
                    const rot = this._rotationDelta;
                    Laya.Quaternion.createFromAxisAngle(axis, angle, rot);
                    chain.rotateJoint(0, rot);
                }
            }
        }
    }

    var endPos$1 = new Laya.Vector3();
    class IK_AnimLayer {
        constructor(n = 0) {
            this.roations = [];
            this.positions = [];
            this.length = n;
        }
        set length(n) {
            if (this.roations.length == n)
                return;
            this.roations.length = n;
            this.positions.length = n;
            for (let i = 0; i < n; i++) {
                this.roations[i] = new Laya.Quaternion();
                this.positions[i] = new Laya.Vector3();
            }
        }
        get length() {
            return this.roations.length;
        }
        captureBonePose(joints) {
            let n = joints.length;
            this.roations.length = n;
            for (let i = 0; i < n; i++) {
                let boneTrans = joints[i].bone.transform;
                let cRot = this.roations[i] || new Laya.Quaternion();
                let cPos = this.positions[i] || new Laya.Vector3();
                this.roations[i] = cRot;
                this.positions[i] = cPos;
                boneTrans.rotation.cloneTo(cRot);
                boneTrans.position.cloneTo(cPos);
            }
            return this;
        }
        captureIKResult(joints) {
            let n = joints.length;
            this.roations.length = n;
            for (let i = 0; i < n; i++) {
                let joint = joints[i];
                let cRot = this.roations[i] || new Laya.Quaternion();
                joint.rotationQuat.cloneTo(cRot);
                this.roations[i] = cRot;
                let cPos = this.positions[i] || new Laya.Vector3();
                joint.position.cloneTo(cPos);
                this.positions[i] = cPos;
            }
            return this;
        }
        copy(layer) {
            this.length = layer.length;
            for (let i = 0, n = layer.length; i < n; i++) {
                this.roations[i] || (this.roations[i] = new Laya.Quaternion());
                this.positions[i] || (this.positions[i] = new Laya.Vector3());
                layer.roations[i].cloneTo(this.roations[i]);
                layer.positions[i].cloneTo(this.positions[i]);
            }
        }
        blend(b, weight, joints, out = null) {
            let n = this.roations.length;
            if (!out)
                out = new IK_AnimLayer(n);
            out.length = n;
            if (!b || b.roations.length == 0) {
                out.copy(this);
                return;
            }
            if (this.roations.length == 0) {
                out.copy(b);
                return;
            }
            if (weight < 0)
                weight = 0;
            if (weight > 1)
                weight = 1;
            let outRots = out.roations;
            let outPos = out.positions;
            let curPos = new Laya.Vector3();
            this.positions[0].scale(1 - weight, curPos);
            let tmp = new Laya.Vector3();
            b.positions[0].scale(weight, tmp);
            curPos.vadd(tmp, curPos);
            curPos.cloneTo(outPos[0]);
            for (let i = 0; i < n; i++) {
                let orot = outRots[i];
                let srot = this.roations[i];
                let brot = b.roations[i];
                if (!brot) {
                    srot.cloneTo(orot);
                }
                else {
                    Laya.Quaternion.slerp(srot, brot, weight, orot);
                }
                if (i < n - 1) {
                    const next = joints[i + 1];
                    Laya.Vector3.transformQuat(next.relPos, orot, endPos$1);
                    outPos[i].vadd(endPos$1, next.position);
                }
            }
        }
        applyToBone(joints) {
            let n = joints.length;
            for (let i = 0; i < n - 1; i++) {
                let curJoint = joints[i];
                if (!curJoint.bone)
                    continue;
                if (curJoint.fixed)
                    continue;
                if (!this.roations[i])
                    return;
                let boneTrans = curJoint.bone.transform;
                let curQuat = this.roations[i];
                let curPos = curJoint.position;
                const next = joints[i + 1];
                Laya.Vector3.transformQuat(next.relPos, curQuat, endPos$1);
                curPos.vadd(endPos$1, next.position);
                next.position = next.position;
                boneTrans.position = curPos;
                boneTrans.rotation = curQuat;
            }
        }
    }
    class IK_LayerMgr {
        constructor() {
            this.finalLayer = new IK_AnimLayer();
            this.lastSet = new IK_AnimLayer();
            this.fadeSrc = null;
            this.fadeTarget = null;
            this.fadeStart = 0;
            this.fadeTm = 0;
        }
        getCurrent() {
            return this.finalLayer;
        }
        set(layer) {
            if (!layer)
                return;
            this.finalLayer.copy(layer);
            this.lastSet.copy(layer);
        }
        fadeTo(layer, tm) {
            this.fadeStart = Date.now();
            this.fadeTm = tm;
            this.fadeSrc = new IK_AnimLayer();
            this.fadeSrc.copy(this.finalLayer);
            this.fadeTarget = new IK_AnimLayer();
            this.fadeTarget.copy(layer);
        }
        stopFade() {
            this.fadeStart = 0;
        }
        isFading() {
            return this.fadeStart !== 0;
        }
        apply(joints) {
            if (this.fadeStart > 0) {
                let dt = Date.now() - this.fadeStart;
                if (dt > this.fadeTm) {
                    this.fadeStart = 0;
                }
                else {
                    let k = dt / this.fadeTm;
                    k = Math.pow(k, 0.5);
                    this.fadeSrc.blend(this.fadeTarget, k, joints, this.finalLayer);
                }
            }
            this.finalLayer.applyToBone(joints);
        }
    }

    var allMap = new Map();
    function getJointMgr(sp) {
        let ret = allMap.get(sp);
        if (!ret) {
            ret = new IK_JointManager();
        }
        allMap.set(sp, ret);
        return ret;
    }
    class IK_JointManager {
        constructor() {
            this._mapBoneJoint = {};
        }
        getJoint(name) {
            return this._mapBoneJoint[name];
        }
        addJoint(name, joint) {
            this._mapBoneJoint[name] = joint;
        }
    }

    let invQ = new Laya.Quaternion();
    let endPos = new Laya.Vector3();
    let lastQuat = new Laya.Quaternion();
    class IK_ChainBase {
        constructor(mgr) {
            this.name = '';
            this._target = null;
            this.layerMgr = new IK_LayerMgr();
            this.staticLayer = new IK_AnimLayer();
            this.animLayer = new IK_AnimLayer();
            this.ik_result = new IK_AnimLayer();
            this._isRunning = false;
            this.enable = true;
            this._jointMgr = null;
            this.totalLength = 0;
            this.blendWeight = 1.0;
            this.maxError = 0.01;
            this._weightSmooth = 1;
            this._jointMgr = getJointMgr(mgr.owner);
            if (this._weightSmooth) {
                this.wSmoother = new NumberSmooth(0.1);
            }
        }
        get weightSmooth() {
            return this._weightSmooth;
        }
        set weightSmooth(v) {
            this._weightSmooth = v;
            if (v < 1 && v > 0) {
                this.wSmoother = new NumberSmooth(v);
            }
            else {
                this.wSmoother = null;
            }
        }
        set isRunning(v) {
            if (this._isRunning != v) {
                if (v) {
                    this.layerMgr.stopFade();
                }
                else {
                    this.fadeToAnim();
                }
            }
            this._isRunning = v;
        }
        get isRunning() {
            return this._isRunning;
        }
        set target(tar) {
            this._target = tar;
        }
        get target() {
            return this._target;
        }
        set endFixed(v) {
            let n = this.joints.length;
            if (n > 2) {
                this.joints[n - 2].fixed = v;
            }
        }
        get endFixed() {
            let n = this.joints.length;
            if (n > 2) {
                return this.joints[n - 2].fixed;
            }
            return false;
        }
        visualize(line) { }
        get end_effector() {
            return this._end_effector;
        }
        addJoint(joint) {
            if (this.end_effector) {
                throw '已经结束了';
            }
            let bone = joint.bone;
            if (!bone) {
                console.log('没有对应的Sprite3D对象就没有ik的必要');
                return;
            }
            if (this._jointMgr) {
                if (this._jointMgr.getJoint(joint.name)) ;
                else {
                    this._jointMgr.addJoint(joint.name, joint);
                }
            }
            let joints = this.joints;
            let lastJoint = joints[joints.length - 1];
            joints.push(joint);
            let parentNode;
            if (!lastJoint) {
                parentNode = (bone.parent instanceof Laya.Sprite3D) ? bone.parent : null;
                if (bone.parent && this._jointMgr) {
                    joint.parent = this._jointMgr.getJoint(bone.parent.name);
                }
            }
            else {
                joint.parent = lastJoint;
                parentNode = lastJoint.bone;
                if (!parentNode) {
                    throw 'no parentnode';
                }
                let parentRot = parentNode.transform.rotation;
                let parentPos = parentNode.transform.position;
                let myPos = bone.transform.position.clone();
                myPos.vsub(parentPos, myPos);
                lastJoint.length = myPos.length();
                this.totalLength += lastJoint.length;
                Laya.Quaternion.invert(parentRot, invQ);
                Laya.Vector3.transformQuat(myPos, invQ, joint.relPos);
            }
        }
        getJoint(name) {
            return this.joints.find((v) => v.name == name);
        }
        rotateJoint(jointId, deltaQuat) {
            let joints = this.joints;
            for (let i = jointId; i < joints.length; i++) {
                const curJoint = joints[i];
                let curQuat = curJoint.rotationQuat;
                if (i == jointId && curJoint.constraint) {
                    curQuat.cloneTo(lastQuat);
                }
                Laya.Quaternion.multiply(deltaQuat, curQuat, curQuat);
                curQuat.normalize(curQuat);
                curJoint.rotationQuat = curQuat;
                if (i == jointId && curJoint.constraint) {
                    if (curJoint.constraint.enable) {
                        curJoint.constraint.doConsraint(curJoint);
                        let invLast = invQ;
                        lastQuat.invert(invLast);
                        Laya.Quaternion.multiply(curJoint.rotationQuat, invLast, deltaQuat);
                        deltaQuat.normalize(deltaQuat);
                    }
                }
                const next = joints[i + 1];
                if (next) {
                    Laya.Vector3.transformQuat(next.relPos, curQuat, endPos);
                    next.position.setValue(curJoint.position.x + endPos.x, curJoint.position.y + endPos.y, curJoint.position.z + endPos.z);
                }
            }
        }
        copyCurPoseAsInitPose() {
            let joints = this.joints;
            for (let joint of joints) {
                joint.copyTransform();
            }
        }
        copyInitPose() {
            let joints = this.joints;
            let startPose = this.animLayer;
            for (let i = 0, n = joints.length; i < n; i++) {
                let curJoint = joints[i];
                let curTrans = startPose;
                curTrans.roations[i].cloneTo(curJoint.transform.rotation);
                curTrans.positions[i].cloneTo(curJoint.transform.position);
                curJoint.transform.position = curJoint.transform.position;
                curJoint.transform.rotation = curJoint.transform.rotation;
            }
        }
        captureStaticPose() {
            this.staticLayer.captureBonePose(this.joints);
        }
        resetStaticPose() {
            if (this.staticLayer.roations.length != this.joints.length)
                return;
            for (let i = 0, n = this.joints.length; i < n; i++) {
                let joint = this.joints[i];
                let trans = joint.bone.transform;
                trans.position = this.staticLayer.positions[i];
                trans.rotation = this.staticLayer.roations[i];
            }
        }
        captureAnimPose() {
            this.animLayer.captureBonePose(this.joints);
        }
        fadeToAnim() {
            if (!this.layerMgr.isFading()) {
                this.layerMgr.fadeTo(this.animLayer, 200);
            }
        }
        isFading() {
            return this.layerMgr.isFading();
        }
        applyResult() {
            this.layerMgr.apply(this.joints);
        }
        solve(comp) { }
        applyIKResult(comp) {
            if (!this.enable)
                return;
            let bw = this.wSmoother ? this.wSmoother.in(this.blendWeight) : this.blendWeight;
            comp.blendW = bw;
            for (let i = 0, n = this.joints.length; i < n; i++) {
                let joint = this.joints[i];
                if (joint.fixed)
                    continue;
                if (bw > 0)
                    joint.applyTransform(bw);
            }
        }
        onLinkEnd() {
            let joints = this.joints;
            this._end_effector = joints[joints.length - 1];
            let quat = new Laya.Quaternion();
            for (let i = 0, n = joints.length - 1; i < n; i++) {
                let joint = joints[i];
                let next = joints[i + 1];
                let dir = new Laya.Vector3();
                next.bone.transform.localPosition.cloneTo(dir);
                dir.normalize();
                let zdir = new Laya.Vector3(0, 0, 1);
                quaternionFromTo(zdir, dir, quat);
                let mat = new Laya.Matrix4x4();
                Laya.Matrix4x4.createFromQuaternion(quat, mat);
                joint.childDirOff = mat;
            }
            this.captureStaticPose();
        }
    }

    new Laya.Vector3(0, 0, 1);
    new Laya.Vector3();
    new Laya.Quaternion();
    let v1$2 = new Laya.Vector3();
    new Laya.Quaternion();
    var tmpMat = new Laya.Matrix4x4();
    function cloneVector3(v) {
        const out = new Laya.Vector3();
        v.cloneTo(out);
        return out;
    }
    function cloneQuaternion(q) {
        const out = new Laya.Quaternion();
        q.cloneTo(out);
        return out;
    }
    class IK_Chain extends IK_ChainBase {
        constructor(name, mgr) {
            super(mgr);
            this._showDbg = false;
            this.solver = null;
            this.poleTarget = null;
            this._endAlign = 'no';
            this._isEndAlign = false;
            this._parentInEnd = null;
            this.lastBoneDir = [];
            this.lastQuat = [];
            this._firstGetParentInEnd = true;
            this.name = name;
            this.joints = [];
        }
        isCollinear(target, epsilon = 1e-3) {
            let joints = this.joints;
            if (joints.length < 2) {
                return false;
            }
            const start = joints[0].position;
            const end = joints[joints.length - 1].position;
            let d1 = new Laya.Vector3();
            target.vsub(start, d1);
            if (this.totalLength < d1.length())
                return false;
            let n = joints.length - 1;
            if (this._endAlign && this._endAlign !== 'no') {
                n -= 1;
            }
            for (let i = 1; i < n; i++) {
                if (!isCollinear(start, joints[i].position, end, epsilon)) {
                    return false;
                }
            }
            return isCollinear(start, end, target, epsilon);
        }
        visualize(line) {
            if (this.target) {
                let pos = this.target.pos;
                this.target.getPose(tmpMat);
                ripMatScale(tmpMat);
                let e = tmpMat.elements;
                let len = 0.1;
                let end1 = new Laya.Vector3(pos.x + e[0] * len, pos.y + e[1] * len, pos.z + e[2] * len);
                let end2 = new Laya.Vector3(pos.x - e[0] * len, pos.y - e[1] * len, pos.z - e[2] * len);
                let end3 = new Laya.Vector3(pos.x + e[4] * len, pos.y + e[5] * len, pos.z + e[6] * len);
                let end4 = new Laya.Vector3(pos.x - e[4] * len, pos.y - e[5] * len, pos.z - e[6] * len);
                let end5 = new Laya.Vector3(pos.x + e[8] * len, pos.y + e[9] * len, pos.z + e[10] * len);
                let end6 = new Laya.Vector3(pos.x - e[8] * len, pos.y - e[9] * len, pos.z - e[10] * len);
                line.addLine(pos, end1, Laya.Color.RED, Laya.Color.RED);
                line.addLine(pos, end2, Laya.Color.RED, Laya.Color.RED);
                line.addLine(pos, end3, Laya.Color.GREEN, Laya.Color.GREEN);
                line.addLine(pos, end4, Laya.Color.GREEN, Laya.Color.GREEN);
                line.addLine(pos, end5, Laya.Color.BLUE, Laya.Color.BLUE);
                line.addLine(pos, end6, Laya.Color.BLUE, Laya.Color.BLUE);
            }
            if (this.endAlign != 'no') ;
            let joints = this.joints;
            for (let i = 0, n = joints.length; i < n; i++) {
                let joint = joints[i];
                joint.visualize(line);
                let next = joints[i + 1];
                if (next) {
                    line.addLine(joint.position, next.position, new Laya.Color(1, 0, 0, 1), new Laya.Color(0, 1, 0, 1));
                }
            }
        }
        set showDbg(b) {
            this._showDbg = b;
        }
        get showDbg() {
            return this._showDbg;
        }
        set endAlign(v) {
            this._endAlign = v;
            if (v && v != 'no') {
                this._isEndAlign = true;
            }
            else {
                this._isEndAlign = false;
                this._parentInEnd = null;
            }
        }
        get endAlign() {
            return this._endAlign;
        }
        solve(comp) {
            if (!this._target) {
                return;
            }
            let solver = this.solver;
            solver.poleTarget = this.poleTarget;
            let joints = this.joints;
            let targetPos = this.target.pos.clone();
            let alignQ = null;
            if (this._isEndAlign) {
                joints[joints.length - 1].fixed = true;
                {
                    this._firstGetParentInEnd = false;
                    let end = this.joints[this.joints.length - 1];
                    let matEnd = end.bone.transform.worldMatrix.clone();
                    let matParent = end.parent.bone.transform.worldMatrix.clone();
                    ripMatScale(matEnd);
                    ripMatScale(matParent);
                    let invMatEnd = new Laya.Matrix4x4();
                    matEnd.invert(invMatEnd);
                    let parentInEnd = this._parentInEnd = new Laya.Matrix4x4();
                    Laya.Matrix4x4.multiply(invMatEnd, matParent, parentInEnd);
                }
                let target = this.target;
                alignQ = new Laya.Quaternion();
                let parentInEnd = this._parentInEnd;
                switch (this._endAlign) {
                    case 'y':
                        {
                            let dir = new Laya.Vector3();
                            if (target.targetSprite) {
                                let tarMat = target.targetSprite.transform.worldMatrix.elements;
                                dir.setValue(tarMat[4], tarMat[5], tarMat[6]);
                            }
                            else {
                                target.dir.cloneTo(dir);
                            }
                            dir.normalize();
                            let endMat = joints[joints.length - 1].transform.worldMatrix;
                            ripMatScale(endMat);
                            let endY = new Laya.Vector3(endMat.elements[4], endMat.elements[5], endMat.elements[6]);
                            let dq = new Laya.Quaternion();
                            quaternionFromTo(endY, dir, dq);
                            let dmat = new Laya.Matrix4x4();
                            Laya.Matrix4x4.createFromQuaternion(dq, dmat);
                            let endTarget = new Laya.Matrix4x4();
                            Laya.Matrix4x4.multiply(dmat, endMat, endTarget);
                            endTarget.elements[12] = targetPos.x;
                            endTarget.elements[13] = targetPos.y;
                            endTarget.elements[14] = targetPos.z;
                            let parentTarget = dmat;
                            Laya.Matrix4x4.multiply(endTarget, parentInEnd, parentTarget);
                            let e = parentTarget.elements;
                            targetPos.setValue(e[12], e[13], e[14]);
                            Laya.Quaternion.createFromMatrix4x4(parentTarget, alignQ);
                        }
                        break;
                    case 'all': {
                        let targetMat = new Laya.Matrix4x4();
                        target.getPose(targetMat);
                        ripMatScale(targetMat);
                        let parentTarget = new Laya.Matrix4x4();
                        Laya.Matrix4x4.multiply(targetMat, parentInEnd, parentTarget);
                        let e = parentTarget.elements;
                        targetPos.setValue(e[12], e[13], e[14]);
                        ripMatScale(parentTarget);
                        Laya.Quaternion.createFromMatrix4x4(parentTarget, alignQ);
                        break;
                    }
                }
            }
            for (let i = 0, n = joints.length; i < n - 1; i++) {
                let cjoint = joints[i];
                if (cjoint.fixed)
                    continue;
                let njoint = joints[i + 1];
                let boneDir;
                if (this.lastBoneDir[i])
                    boneDir = this.lastBoneDir[i];
                else {
                    boneDir = this.lastBoneDir[i] = new Laya.Vector3();
                }
                njoint.position.vsub(cjoint.position, boneDir);
                boneDir.normalize();
                this.lastQuat[i] = joints[i].rotationQuat.clone();
            }
            solver.solve(comp, this, targetPos, this._isEndAlign);
            for (let i = 0, n = joints.length; i < n - 1; i++) {
                let cjoint = joints[i];
                if (cjoint.fixed)
                    continue;
                let njoint = joints[i + 1];
                let boneDir = new Laya.Vector3();
                njoint.position.vsub(cjoint.position, boneDir);
                boneDir.normalize();
                let lastDir = this.lastBoneDir[i];
                let q = cjoint.rotationQuat;
                let dq = new Laya.Quaternion();
                quaternionFromTo(lastDir, boneDir, dq);
                Laya.Quaternion.multiply(dq, this.lastQuat[i], q);
                cjoint.rotationQuat = q;
            }
            if (this._isEndAlign && alignQ) {
                let curParentQ = joints[joints.length - 2].rotationQuat;
                let invParQ = new Laya.Quaternion();
                curParentQ.invert(invParQ);
                let dq = new Laya.Quaternion();
                Laya.Quaternion.multiply(alignQ, invParQ, dq);
                this.rotateJoint(joints.length - 2, dq);
            }
        }
        updateRotations() {
            const joints = this.joints;
            const jointCount = joints.length;
            if (jointCount < 2)
                return;
            const rotation = new Laya.Quaternion();
            const relDir = new Laya.Vector3();
            const dirWorld = v1$2;
            for (let i = 0; i < jointCount - 1; i++) {
                const cur = joints[i];
                const nxt = joints[i + 1];
                nxt.position.vsub(cur.position, dirWorld).normalize();
                cur === joints[jointCount - 1] ? relDir.setValue(0, 0, 1) : nxt.relPos.cloneTo(relDir);
                const len = relDir.length();
                if (len < 1e-6) {
                    continue;
                }
                relDir.scale(1 / len, relDir);
                quaternionFromTo(relDir, dirWorld, rotation);
                rotation.cloneTo(cur.rotationQuat);
            }
            joints[jointCount - 2].rotationQuat.cloneTo(joints[jointCount - 1].rotationQuat);
        }
        getDebugSnapshot() {
            const joints = this.joints.map((joint) => ({
                name: joint.name,
                pos: cloneVector3(joint.position),
                rot: cloneQuaternion(joint.rotationQuat),
            }));
            const snapshot = {
                chainName: this.name,
                joints,
            };
            if (this.target) {
                snapshot.targetPos = cloneVector3(this.target.pos);
            }
            if (this.poleTarget && snapshot.poleTargetPos) {
                this.poleTarget.pos = snapshot.poleTargetPos;
            }
            if (this.poleTarget && snapshot.poleTargetDir) {
                this.poleTarget.dir = snapshot.poleTargetDir;
            }
            return snapshot;
        }
        applyDebugSnapshot(snapshot) {
            if (!snapshot) {
                return;
            }
            const count = Math.min(snapshot.joints.length, this.joints.length);
            for (let i = 0; i < count; i++) {
                const joint = this.joints[i];
                const state = snapshot.joints[i];
                state.pos.cloneTo(joint.transform.position);
                state.rot.cloneTo(joint.rotationQuat);
                joint.applyTransform(1);
            }
            if (snapshot.targetPos && this.target) {
                this.target.pos = snapshot.targetPos;
            }
            if (this.poleTarget && snapshot.poleTargetPos) {
                this.poleTarget.pos = snapshot.poleTargetPos;
            }
            if (this.poleTarget && snapshot.poleTargetDir) {
                this.poleTarget.dir = snapshot.poleTargetDir;
            }
        }
    }

    class IK_Joint {
        constructor(bone) {
            this.transform = new Laya.Transform3D(null);
            this.length = 1;
            this._parent = null;
            this.name = '';
            this.childDirOff = null;
            this.relPos = new Laya.Vector3();
            this.fixed = false;
            if (bone) {
                this.name = bone.name;
                this.bone = bone;
                this.copyTransform();
            }
        }
        copyTransform() {
            let sp = this.bone;
            if (!sp)
                return;
            this.transform.position = sp.transform.position;
            this.transform.rotation = sp.transform.rotation;
        }
        applyTransform(weight) {
            if (!this.bone)
                return;
            if (weight < 0)
                weight = 0;
            if (weight == 0)
                return;
            if (weight > 1)
                weight = 1;
            let boneTrans = this.bone.transform;
            boneTrans.position;
            let p1 = this.transform.position;
            let r0 = boneTrans.rotation;
            let r1 = this.transform.rotation;
            if (weight == 1) {
                boneTrans.position = p1;
                boneTrans.rotation = r1;
            }
            else {
                Laya.Quaternion.slerp(r0, r1, weight, r0);
                boneTrans.rotation = r0;
            }
        }
        set rotationQuat(q) {
            q.normalize(q);
            this.transform.rotation = q;
        }
        get rotationQuat() {
            return this.transform.rotation;
        }
        set position(p) {
            this.transform.position = p;
        }
        get position() {
            return this.transform.position;
        }
        get worldMatrix() {
            return this.transform.worldMatrix;
        }
        set parent(p) {
            var _a, _b;
            this._parent = p;
            if (p) {
                this.transform._parent = p.transform;
            }
            else {
                if (((_a = this.bone) === null || _a === void 0 ? void 0 : _a.parent) instanceof Laya.Sprite3D) {
                    this.transform._parent = (_b = this.bone.parent) === null || _b === void 0 ? void 0 : _b.transform;
                }
                else {
                    this.transform._parent = null;
                }
            }
        }
        get parent() {
            return this._parent;
        }
        visualize(line) {
            if (this.constraint && this.constraint.enable) {
                this.constraint.visualize(this, line);
            }
        }
        random(axis, baseVec, childVec) {
            let cur = 178;
            let quat = new Laya.Quaternion();
            Laya.Quaternion.createFromAxisAngle(axis, cur * Math.PI / 180, quat);
            Laya.Vector3.transformQuat(baseVec, quat, childVec);
            return childVec;
        }
        perturbJoint() {
            let parJoint = this.parent;
            if (!parJoint)
                return false;
            let parDir = new Laya.Vector3();
            this.position.vsub(this.parent.position, parDir);
            parDir.normalize();
            if (this.type === 'revolute') {
                let randomAxis = new Laya.Vector3();
                Laya.Vector3.cross(parDir, new Laya.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1), randomAxis);
                randomAxis.normalize();
                const angle = (Math.random() * 10 - 5) * Math.PI / 180;
                let rotQuat = new Laya.Quaternion();
                Laya.Quaternion.createFromAxisAngle(randomAxis, angle, rotQuat);
                let newRot = new Laya.Quaternion();
                Laya.Quaternion.multiply(this.transform.rotation, rotQuat, newRot);
                this.transform.rotation = newRot;
                return true;
            }
            else if (this.type === 'prismatic') {
                return false;
            }
            else {
                let randomAxis = new Laya.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
                randomAxis.normalize();
                const angle = (Math.random() * 10 - 5) * Math.PI / 180;
                let rotQuat = new Laya.Quaternion();
                Laya.Quaternion.createFromAxisAngle(randomAxis, angle, rotQuat);
                let rot = this.transform.rotation;
                Laya.Quaternion.multiply(rot, rotQuat, rot);
                this.transform.rotation = rot;
                return true;
            }
        }
    }

    let IQ$1 = new Laya.Quaternion();
    new Laya.Matrix4x4();
    class IK_Lookat extends IK_ChainBase {
        constructor(joints, mgr) {
            super(mgr);
            this._chainLength = 0;
            this._end = null;
            this._hasOff = false;
            this.alignWithTarget = false;
            this._chainLength = joints.length;
            let root2end = true;
            if (joints.length > 1) {
                if (joints[0].bone.parent == joints[1].bone) {
                    root2end = false;
                }
                else if (joints[1].bone.parent == joints[0].bone) {
                    root2end = true;
                }
                else {
                    console.warn('无法确定lookat的ik链的顺序');
                }
            }
            this.joints = new Array(0);
            if (root2end) {
                for (let i = 0, n = joints.length; i < n; i++) {
                    this.addJoint(joints[i]);
                }
            }
            else {
                for (let i = joints.length - 1; i >= 0; i--) {
                    this.addJoint(joints[i]);
                }
            }
            this._end = this.joints[this.joints.length - 1];
            if (!this._end.bone._isRenderNode) {
                this._hasOff = true;
                this._end.fixed = true;
            }
            this.onLinkEnd();
        }
        visualize(line) {
            for (let j of this.joints) {
                if (j.constraint) {
                    j.constraint.visualize(j, line);
                }
            }
            if (this._target) {
                let end = this._end;
                let wmat = end.bone.transform.worldMatrix.elements;
                let st = new Laya.Vector3(wmat[12], wmat[13], wmat[14]);
                let dir = new Laya.Vector3(wmat[8], wmat[9], wmat[10]);
                dir.normalize();
                let ed = new Laya.Vector3();
                this._target.pos.vsub(st, ed);
                let len = ed.length();
                ed.setValue(st.x + len * dir.x, st.y + len * dir.y, st.z + len * dir.z);
                line.addLine(st, ed, Laya.Color.RED, Laya.Color.RED);
            }
        }
        solve() {
            if (!this.enable)
                return;
            if (!this._chainLength || !this._target)
                return;
            let deltaQ = new Laya.Quaternion();
            let invw = new Laya.Matrix4x4();
            let target = this._target.pos.clone();
            let localTarget = new Laya.Vector3();
            let end = this._end;
            if (this.alignWithTarget) ;
            if (this._chainLength == 1) {
                let oriw = end.worldMatrix;
                let todir = new Laya.Vector3(target.x - oriw.elements[12], target.y - oriw.elements[13], target.z - oriw.elements[14]);
                todir.normalize();
                let zdir = new Laya.Vector3(oriw.elements[8], oriw.elements[9], oriw.elements[10]);
                zdir.normalize();
                quaternionFromTo(zdir, todir, deltaQ);
                let curR = end.rotationQuat;
                let resultQ = new Laya.Quaternion();
                Laya.Quaternion.multiply(deltaQ, curR, resultQ);
                end.rotationQuat = resultQ;
                let joint = this.joints[0];
                if (joint.constraint && joint.constraint.enable) {
                    joint.constraint.doConsraint(joint);
                }
            }
            else {
                let adjJoint = this._chainLength;
                if (this._hasOff)
                    adjJoint -= 1;
                let k = 1 / adjJoint;
                let it = IK_Lookat.dirIt;
                let succ = false;
                while (it-- && !succ) {
                    for (let i = adjJoint - 1; i >= 0; i--) {
                        let joint = this.joints[i];
                        joint.worldMatrix.invert(invw);
                        Laya.Vector3.transformCoordinate(target, invw, localTarget);
                        let endPose = end.worldMatrix;
                        {
                            let ele = endPose.elements;
                            let endPos = new Laya.Vector3(ele[12], ele[13], ele[14]);
                            let endDir = new Laya.Vector3(ele[8], ele[9], ele[10]);
                            let end2tar = new Laya.Vector3();
                            target.vsub(endPos, end2tar);
                            end2tar.normalize();
                            endDir.normalize();
                            endDir.dot(end2tar);
                        }
                        let endPoseLocal = new Laya.Matrix4x4();
                        Laya.Matrix4x4.multiply(invw, endPose, endPoseLocal);
                        if (!solveLookat(localTarget, endPoseLocal, deltaQ)) {
                            console.log('无法解决lookat问题');
                            return;
                        }
                        Laya.Quaternion.slerp(IQ$1, deltaQ, k, deltaQ);
                        let resultQ = new Laya.Quaternion();
                        let curR = joint.rotationQuat;
                        Laya.Quaternion.multiply(curR, deltaQ, resultQ);
                        let invCur = new Laya.Quaternion();
                        curR.invert(invCur);
                        Laya.Quaternion.multiply(resultQ, invCur, deltaQ);
                        this.rotateJoint(i, deltaQ);
                    }
                }
            }
        }
    }
    IK_Lookat.dirIt = 1;

    class IK_DebugRecorder {
        constructor() {
            this.maxFrames = 120;
            this.enabled = false;
            this._frames = [];
            this._replayIndex = -1;
        }
        canRecordFrame() {
            return this.enabled && !this.isReplaying();
        }
        recordFrame(chainStates) {
            if (!this.enabled || this.isReplaying() || !(chainStates === null || chainStates === void 0 ? void 0 : chainStates.length)) {
                return;
            }
            const frame = {
                frameId: Laya.timer ? Laya.timer.currFrame : 0,
                timestamp: Date.now(),
                chainStates,
            };
            this._frames.push(frame);
            if (this._frames.length > this.maxFrames) {
                this._frames.shift();
            }
        }
        clear() {
            this._frames.length = 0;
            this._replayIndex = -1;
        }
        isReplaying() {
            return this._replayIndex >= 0 && this._replayIndex < this._frames.length;
        }
        startReplay(offset = 0) {
            if (!this._frames.length) {
                return false;
            }
            const idx = this._frames.length - 1 - offset;
            this._replayIndex = Math.max(0, Math.min(idx, this._frames.length - 1));
            return true;
        }
        stopReplay() {
            this._replayIndex = -1;
        }
        step(delta) {
            if (!this.isReplaying()) {
                return;
            }
            this._replayIndex = Math.max(0, Math.min(this._replayIndex + delta, this._frames.length - 1));
        }
        getReplayFrame() {
            var _a;
            if (!this.isReplaying()) {
                return null;
            }
            return (_a = this._frames[this._replayIndex]) !== null && _a !== void 0 ? _a : null;
        }
        get replayInfo() {
            var _a, _b;
            if (!this.isReplaying()) {
                return null;
            }
            const frame = this._frames[this._replayIndex];
            return {
                index: this._replayIndex,
                total: this._frames.length,
                frameId: (_a = frame === null || frame === void 0 ? void 0 : frame.frameId) !== null && _a !== void 0 ? _a : 0,
                timestamp: (_b = frame === null || frame === void 0 ? void 0 : frame.timestamp) !== null && _b !== void 0 ? _b : 0,
            };
        }
    }

    class SHOW_DBG {
        static none() {
            SHOW_DBG.showdbg = 0;
            return SHOW_DBG;
        }
        static all() {
            SHOW_DBG.showdbg = SHOW_DBG.ALL;
            return SHOW_DBG;
        }
        static add(flag) {
            SHOW_DBG.showdbg |= flag;
            return SHOW_DBG;
        }
        static sub(flag) {
            SHOW_DBG.showdbg &= (~flag);
            return SHOW_DBG;
        }
        static has(flag) {
            return (SHOW_DBG.showdbg & flag) !== 0;
        }
    }
    SHOW_DBG.CONSTRAINT = 1;
    SHOW_DBG.CONSTRAINT_AXIS = 1 << 2;
    SHOW_DBG.BONE = 1 << 3;
    SHOW_DBG.BONE_AXIS = 1 << 4;
    SHOW_DBG.ALL = 0xff;
    SHOW_DBG.showdbg = SHOW_DBG.ALL;
    class IK_System {
        constructor(comp) {
            this.chains = [];
            this.lookats = [];
            this.rootSprite = null;
            this._showDbg = false;
            this.enableSolver = true;
            this.ikcomp = null;
            this.useAnimLayer = false;
            this._debugRecorder = new IK_DebugRecorder();
            this.ikcomp = comp;
            this.solver = new IK_CCDSolver();
        }
        setRoot(r) {
            this.rootSprite = r;
        }
        setMaxIterations(v) {
            this.solver.maxIterations = v;
        }
        setDampingFactor(v) {
            this.solver.dampingFactor = v;
        }
        getDampingFactor() {
            return this.solver.dampingFactor;
        }
        set showDbg(b) {
            this._showDbg = b;
            for (let chain of this.chains) {
                chain.showDbg = b;
            }
        }
        get showDbg() {
            return this._showDbg;
        }
        visualize(liner) {
            if (this._showDbg) {
                for (let chain of this.chains) {
                    chain.visualize(liner);
                }
                for (let lookat of this.lookats) {
                    lookat.visualize(liner);
                }
            }
        }
        addChain(chain) {
            this.chains.push(chain);
            chain.solver = this.solver;
        }
        clear() {
            this.chains.length = 0;
            this.lookats.length = 0;
            this._debugRecorder.clear();
        }
        _getChildByName(sp, name) {
            if (sp.name === name) {
                return sp;
            }
            const childCount = sp.numChildren;
            for (let i = 0; i < childCount; i++) {
                const child = sp.getChildAt(i);
                const result = this._getChildByName(child, name);
                if (result !== null) {
                    return result;
                }
            }
            return null;
        }
        getBoneChain(name, length) {
            let end = this._getChildByName(this.rootSprite, name);
            return this.getBoneChainBySprite(end, length);
        }
        getBoneChainBySprite(end, length) {
            if (!end)
                return null;
            let ret = [end];
            let cur = end;
            for (let i = 0; i < length - 1; i++) {
                cur = cur.parent;
                if (!cur) {
                    break;
                }
                if (!(cur instanceof Laya.Sprite3D))
                    break;
                ret.push(cur);
            }
            return ret;
        }
        chreateChainByBoneName(nameOrSp3d, length) {
            let comp = this.ikcomp;
            let bones;
            let endName;
            if (typeof nameOrSp3d == 'string') {
                endName = nameOrSp3d;
                bones = this.getBoneChain(nameOrSp3d, length);
            }
            else if (nameOrSp3d instanceof Laya.Sprite3D) {
                endName = nameOrSp3d.name;
                bones = this.getBoneChainBySprite(nameOrSp3d, length);
            }
            if (!bones || bones.length != length) {
                console.error(`没有找到骨骼:${endName}或者长度不足${length}`);
                return null;
            }
            let chain = new IK_Chain('', comp);
            for (let i = length - 1; i >= 0; i--) {
                const curnode = bones[i];
                const joint = new IK_Joint(curnode);
                if (this.constraintsMap) {
                    let constraint = this.constraintsMap.get(curnode);
                    joint.constraint = constraint;
                }
                chain.addJoint(joint);
            }
            chain.onLinkEnd();
            return chain;
        }
        chreateLookatByEndSprite(end, length) {
            let comp = this.ikcomp;
            let bones;
            let name = end.name;
            bones = this.getBoneChainBySprite(end, length);
            if (!bones || bones.length != length) {
                console.error(`没有找到骨骼:${name}或者长度不足${length}`);
                return null;
            }
            let joints = [];
            for (let b of bones) {
                let joint = new IK_Joint(b);
                if (this.constraintsMap) {
                    joint.constraint = this.constraintsMap.get(b);
                }
                joints.push(joint);
            }
            let lookat = new IK_Lookat(joints, comp);
            return lookat;
        }
        _findChainByName(name) {
            for (let chain of this.chains) {
                if (chain.name == name) {
                    return chain;
                }
            }
            return null;
        }
        setTarget(endEffectorName, target) {
            let chain = null;
            if (endEffectorName instanceof IK_Chain) {
                chain = endEffectorName;
            }
            else {
                chain = this._findChainByName(endEffectorName);
            }
            if (!chain)
                return;
            chain.target = target;
        }
        resetPose() {
            for (let chain of this.chains) {
                chain.captureStaticPose();
            }
            for (let lookat of this.lookats) {
                lookat.captureStaticPose();
            }
        }
        async onUpdate() {
            this._debugRecorder.isReplaying();
            const replayFrame = this._debugRecorder.getReplayFrame();
            const frameSnapshots = this._debugRecorder.canRecordFrame()
                ? []
                : null;
            for (let chain of this.chains) {
                let isRunning = this.enableSolver && chain.enable;
                chain.isRunning = isRunning;
                const replaySnapshot = replayFrame === null || replayFrame === void 0 ? void 0 : replayFrame.chainStates.find((s) => s.chainName === chain.name);
                if (this.useAnimLayer) {
                    if (isRunning) {
                        chain.captureAnimPose();
                        chain.copyInitPose();
                        chain.solve(this.ikcomp);
                        chain.ik_result.captureIKResult(chain.joints);
                        chain.layerMgr.set(chain.ik_result);
                        chain.applyResult();
                    }
                    if (chain.isFading()) {
                        chain.applyResult();
                    }
                }
                else {
                    if (isRunning) {
                        if (replaySnapshot) {
                            chain.applyDebugSnapshot(replaySnapshot);
                        }
                        else {
                            chain.copyCurPoseAsInitPose();
                        }
                        if (frameSnapshots && !replaySnapshot) {
                            frameSnapshots.push(chain.getDebugSnapshot());
                        }
                        chain.solve(this.ikcomp);
                        chain.applyIKResult(this.ikcomp);
                    }
                }
            }
            for (let lookat of this.lookats) {
                let isRunning = this.enableSolver && lookat.enable;
                lookat.isRunning = isRunning;
                if (this.useAnimLayer) {
                    if (isRunning) {
                        lookat.captureAnimPose();
                        lookat.copyInitPose();
                        lookat.solve();
                        lookat.ik_result.captureIKResult(lookat.joints);
                        lookat.layerMgr.set(lookat.ik_result);
                        lookat.applyResult();
                    }
                    if (lookat.isFading()) {
                        lookat.applyResult();
                    }
                }
                else {
                    if (isRunning) {
                        lookat.captureAnimPose();
                        lookat.copyInitPose();
                        lookat.solve();
                        lookat.applyIKResult(this.ikcomp);
                    }
                }
            }
            if (frameSnapshots === null || frameSnapshots === void 0 ? void 0 : frameSnapshots.length) {
                this._debugRecorder.recordFrame(frameSnapshots);
            }
        }
        setFrameRecorderEnabled(enabled) {
            this._debugRecorder.enabled = enabled;
            if (!enabled) {
                this._debugRecorder.stopReplay();
            }
        }
        setFrameRecorderDepth(count) {
            this._debugRecorder.maxFrames = Math.max(1, Math.floor(count));
        }
        startFrameDebugReplay(offset = 0) {
            this._debugRecorder.startReplay(offset);
        }
        stopFrameDebugReplay() {
            this._debugRecorder.stopReplay();
        }
        stepFrameDebugReplay(delta) {
            this._debugRecorder.step(delta);
        }
        getFrameReplayInfo() {
            return this._debugRecorder.replayInfo;
        }
    }
    IK_System.version = "0.1.0";

    var vx = new Laya.Vector3();
    var vy = new Laya.Vector3();
    var vz = new Laya.Vector3();
    var v1$1 = new Laya.Vector3();
    var ori = new Laya.Vector3();
    new Laya.Vector3();
    new Laya.Vector3();
    new Laya.Vector3();
    var v2$1 = new Laya.Vector3();
    var v3 = new Laya.Vector3();
    var vback = new Laya.Vector3();
    var vrad = new Laya.Vector3();
    var p0 = new Laya.Vector3();
    var p1 = new Laya.Vector3();
    var p2 = new Laya.Vector3();
    var p3 = new Laya.Vector3();
    function drawAxis(lines, mat, length, color = [Laya.Color.RED, Laya.Color.GREEN, Laya.Color.BLUE]) {
        let e = mat.elements;
        ori.set(e[12], e[13], e[14]);
        vx.set(e[0], e[1], e[2]).normalize();
        vy.set(e[4], e[5], e[6]).normalize();
        vz.set(e[8], e[9], e[10]).normalize();
        let arrowLen = Math.min(0.1, length / 2);
        let arrowR = arrowLen / 4;
        let xcolor = color[0];
        let ycolor = color[1];
        let zcolor = color[2];
        vx.scale(length, v1$1);
        ori.vadd(v1$1, v1$1);
        lines.addLine(ori, v1$1, xcolor, xcolor);
        vrad.set(arrowR, arrowR, arrowR);
        vback.set(arrowLen, arrowLen, arrowLen);
        v3.set(v1$1.x - vback.x * vx.x + vy.x * vrad.x, v1$1.y - vback.y * vx.y + vy.y * vrad.y, v1$1.z - vback.z * vx.z + vy.z * vrad.z).cloneTo(p0);
        lines.addLine(v1$1, v3, xcolor, xcolor);
        v3.set(v1$1.x - vback.x * vx.x - vy.x * vrad.x, v1$1.y - vback.y * vx.y - vy.y * vrad.y, v1$1.z - vback.z * vx.z - vy.z * vrad.z).cloneTo(p1);
        lines.addLine(v1$1, v3, xcolor, xcolor);
        v3.set(v1$1.x - vback.x * vx.x + vz.x * vrad.x, v1$1.y - vback.y * vx.y + vz.y * vrad.y, v1$1.z - vback.z * vx.z + vz.z * vrad.z).cloneTo(p2);
        lines.addLine(v1$1, v3, xcolor, xcolor);
        v3.set(v1$1.x - vback.x * vx.x - vz.x * vrad.x, v1$1.y - vback.y * vx.y - vz.y * vrad.y, v1$1.z - vback.z * vx.z - vz.z * vrad.z).cloneTo(p3);
        lines.addLine(v1$1, v3, xcolor, xcolor);
        lines.addLine(p0, p2, xcolor, xcolor);
        lines.addLine(p2, p1, xcolor, xcolor);
        lines.addLine(p1, p3, xcolor, xcolor);
        lines.addLine(p3, p0, xcolor, xcolor);
        vy.scale(length, v1$1);
        ori.vadd(v1$1, v1$1);
        lines.addLine(ori, v1$1, ycolor, ycolor);
        v3.set(v1$1.x - vback.x * vy.x + vx.x * vrad.x, v1$1.y - vback.y * vy.y + vx.y * vrad.y, v1$1.z - vback.z * vy.z + vx.z * vrad.z).cloneTo(p0);
        lines.addLine(v1$1, v3, ycolor, ycolor);
        v3.set(v1$1.x - vback.x * vy.x - vx.x * vrad.x, v1$1.y - vback.y * vy.y - vx.y * vrad.y, v1$1.z - vback.z * vy.z - vx.z * vrad.z).cloneTo(p1);
        lines.addLine(v1$1, v3, ycolor, ycolor);
        v3.set(v1$1.x - vback.x * vy.x + vz.x * vrad.x, v1$1.y - vback.y * vy.y + vz.y * vrad.y, v1$1.z - vback.z * vy.z + vz.z * vrad.z).cloneTo(p2);
        lines.addLine(v1$1, v3, ycolor, ycolor);
        v3.set(v1$1.x - vback.x * vy.x - vz.x * vrad.x, v1$1.y - vback.y * vy.y - vz.y * vrad.y, v1$1.z - vback.z * vy.z - vz.z * vrad.z).cloneTo(p3);
        lines.addLine(v1$1, v3, ycolor, ycolor);
        lines.addLine(v1$1, v3, ycolor, ycolor);
        lines.addLine(p0, p2, ycolor, ycolor);
        lines.addLine(p2, p1, ycolor, ycolor);
        lines.addLine(p1, p3, ycolor, ycolor);
        lines.addLine(p3, p0, ycolor, ycolor);
        vz.scale(length, v1$1);
        ori.vadd(v1$1, v1$1);
        lines.addLine(ori, v1$1, zcolor, zcolor);
        v3.set(v1$1.x - vback.x * vz.x + vy.x * vrad.x, v1$1.y - vback.y * vz.y + vy.y * vrad.y, v1$1.z - vback.z * vz.z + vy.z * vrad.z).cloneTo(p0);
        lines.addLine(v1$1, v3, zcolor, zcolor);
        v3.set(v1$1.x - vback.x * vz.x - vy.x * vrad.x, v1$1.y - vback.y * vz.y - vy.y * vrad.y, v1$1.z - vback.z * vz.z - vy.z * vrad.z).cloneTo(p1);
        lines.addLine(v1$1, v3, zcolor, zcolor);
        v3.set(v1$1.x - vback.x * vz.x + vx.x * vrad.x, v1$1.y - vback.y * vz.y + vx.y * vrad.y, v1$1.z - vback.z * vz.z + vx.z * vrad.z).cloneTo(p2);
        lines.addLine(v1$1, v3, zcolor, zcolor);
        v3.set(v1$1.x - vback.x * vz.x - vx.x * vrad.x, v1$1.y - vback.y * vz.y - vx.y * vrad.y, v1$1.z - vback.z * vz.z - vx.z * vrad.z).cloneTo(p3);
        lines.addLine(v1$1, v3, zcolor, zcolor);
        lines.addLine(v1$1, v3, zcolor, zcolor);
        lines.addLine(v1$1, v3, zcolor, zcolor);
        lines.addLine(p0, p2, zcolor, zcolor);
        lines.addLine(p2, p1, zcolor, zcolor);
        lines.addLine(p1, p3, zcolor, zcolor);
        lines.addLine(p3, p0, zcolor, zcolor);
    }
    var xrangeColor = new Laya.Color(0.9, 0.5, 0.5);
    var yrangeColor = new Laya.Color(0.5, 0.9, 0.5);
    var zrangeColor = new Laya.Color(0.5, 0.5, 0.9);
    let quatMark = new Laya.Quaternion();
    let lastPoint = new Laya.Vector3();
    function draw1Range(liner, pos, startVec, rotAx, min, max, color) {
        let end = new Laya.Vector3();
        startVec = startVec.clone();
        const segments = 20;
        const radius = 0.4;
        startVec.scale(radius, startVec);
        let dAng = (max - min) / segments;
        Laya.Quaternion.createFromAxisAngle(rotAx, min, quatMark);
        Laya.Vector3.transformQuat(startVec, quatMark, end);
        liner.addLine(pos, pos.vadd(end, end), color, color);
        end.cloneTo(lastPoint);
        for (let i = min; i < max; i += dAng) {
            Laya.Quaternion.createFromAxisAngle(rotAx, i, quatMark);
            Laya.Vector3.transformQuat(startVec, quatMark, end);
            pos.vadd(end, end);
            liner.addLine(lastPoint, end, color, color);
            end.cloneTo(lastPoint);
        }
        Laya.Quaternion.createFromAxisAngle(rotAx, max, quatMark);
        Laya.Vector3.transformQuat(startVec, quatMark, end);
        liner.addLine(pos, pos.vadd(end, end), color, color);
        liner.addLine(lastPoint, end, color, color);
    }
    function drawEulerRange1(liner, mat, xmin, xmax, ymin, ymax, zmin, zmax) {
        let w_mat_ele = mat.elements;
        let ori = new Laya.Vector3(w_mat_ele[12], w_mat_ele[13], w_mat_ele[14]);
        let AxX = new Laya.Vector3(w_mat_ele[0], w_mat_ele[1], w_mat_ele[2]);
        let AxY = new Laya.Vector3(w_mat_ele[4], w_mat_ele[5], w_mat_ele[6]);
        let AxZ = new Laya.Vector3(w_mat_ele[8], w_mat_ele[9], w_mat_ele[10]);
        AxX.normalize();
        AxY.normalize();
        AxZ.normalize();
        draw1Range(liner, ori, AxY, AxX, xmin, xmax, xrangeColor);
        draw1Range(liner, ori, AxX, AxY, ymin, ymax, yrangeColor);
        draw1Range(liner, ori, AxX, AxZ, zmin, zmax, zrangeColor);
    }
    let e1 = new Laya.Vector3();
    let e2 = new Laya.Vector3();
    let e3 = new Laya.Vector3();
    let e4 = new Laya.Vector3();
    function drawEulerRange(liner, mat, xmin, xmax, ymin, ymax, zmin, zmax) {
        let w_mat_ele = mat.elements;
        let ori = new Laya.Vector3(w_mat_ele[12], w_mat_ele[13], w_mat_ele[14]);
        let AxX = new Laya.Vector3(w_mat_ele[0], w_mat_ele[1], w_mat_ele[2]);
        let AxY = new Laya.Vector3(w_mat_ele[4], w_mat_ele[5], w_mat_ele[6]);
        let AxZ = new Laya.Vector3(w_mat_ele[8], w_mat_ele[9], w_mat_ele[10]);
        AxX.normalize();
        AxY.normalize();
        AxZ.normalize();
        let rmat = new Laya.Matrix4x4(AxX.x, AxX.y, AxX.z, 0, AxY.x, AxY.y, AxY.z, 0, AxZ.x, AxZ.y, AxZ.z, 0, 0, 0, 0, 1);
        let len = 0.3;
        let stz = new Laya.Vector3(0, 0, 1);
        let end1 = new Laya.Vector3();
        let end2 = new Laya.Vector3();
        let end3 = new Laya.Vector3();
        let end4 = new Laya.Vector3();
        let stx = new Laya.Vector3(1, 0, 0);
        let x1 = new Laya.Vector3();
        let z1 = new Laya.Vector3();
        let q = new Laya.Quaternion(0, Math.sin(ymin / 2), 0, Math.cos(ymin / 2));
        Laya.Vector3.transformQuat(stz, q, z1);
        Laya.Vector3.transformQuat(stx, q, x1);
        let q1 = new Laya.Quaternion();
        Laya.Quaternion.createFromAxisAngle(x1, xmin, q1);
        Laya.Vector3.transformQuat(z1, q1, end1);
        Laya.Quaternion.createFromAxisAngle(x1, xmax, q1);
        Laya.Vector3.transformQuat(z1, q1, end2);
        q.setValue(0, Math.sin(ymax / 2), 0, Math.cos(ymax / 2));
        Laya.Vector3.transformQuat(stz, q, z1);
        Laya.Vector3.transformQuat(stx, q, x1);
        Laya.Quaternion.createFromAxisAngle(x1, xmin, q1);
        Laya.Vector3.transformQuat(z1, q1, end3);
        Laya.Quaternion.createFromAxisAngle(x1, xmax, q1);
        Laya.Vector3.transformQuat(z1, q1, end4);
        const gridSize = 8;
        let gridPoints = [];
        for (let i = 0; i <= gridSize; i++) {
            let row = [];
            let yAngle = ymin + (ymax - ymin) * (i / gridSize);
            for (let j = 0; j <= gridSize; j++) {
                let xAngle = xmin + (xmax - xmin) * (j / gridSize);
                let qY = new Laya.Quaternion(0, Math.sin(yAngle / 2), 0, Math.cos(yAngle / 2));
                let rotatedZ = new Laya.Vector3();
                Laya.Vector3.transformQuat(stz, qY, rotatedZ);
                let rotatedX = new Laya.Vector3();
                Laya.Vector3.transformQuat(stx, qY, rotatedX);
                let qX = new Laya.Quaternion();
                Laya.Quaternion.createFromAxisAngle(rotatedX, xAngle, qX);
                let gridPoint = new Laya.Vector3();
                Laya.Vector3.transformQuat(rotatedZ, qX, gridPoint);
                Laya.Vector3.TransformNormal(gridPoint, rmat, gridPoint);
                gridPoint.scale(len, gridPoint);
                row.push(gridPoint);
            }
            gridPoints.push(row);
        }
        for (let i = 0; i <= gridSize; i++) {
            for (let j = 0; j <= gridSize; j++) {
                let worldPoint = new Laya.Vector3();
                ori.vadd(gridPoints[i][j], worldPoint);
                if (j > 0) {
                    let prevWorldPoint = new Laya.Vector3();
                    ori.vadd(gridPoints[i][j - 1], prevWorldPoint);
                    liner.addLine(prevWorldPoint, worldPoint, Laya.Color.RED, Laya.Color.RED);
                }
                if (i > 0) {
                    let prevWorldPoint = new Laya.Vector3();
                    ori.vadd(gridPoints[i - 1][j], prevWorldPoint);
                    liner.addLine(prevWorldPoint, worldPoint, Laya.Color.RED, Laya.Color.RED);
                }
            }
        }
    }
    function drawCircle(liner, pos, dir, radius, color) {
        if (radius <= 0)
            return;
        if (dir.x === 0 && dir.y === 0 && dir.z === 0)
            return;
        e1.set(dir.x, dir.y, dir.z);
        e1.normalize();
        if (Math.abs(e1.y) < 0.999) {
            e2.set(0, 1, 0);
        }
        else {
            e2.set(1, 0, 0);
        }
        Laya.Vector3.cross(e2, e1, e3);
        e3.normalize();
        Laya.Vector3.cross(e1, e3, e4);
        e4.normalize();
        const segments = 48;
        const step = Math.PI * 2 / segments;
        for (let i = 0; i < segments; i++) {
            const a0 = i * step;
            const a1 = (i + 1) * step;
            let c = Math.cos(a0);
            let s = Math.sin(a0);
            v2$1.set(radius * (e3.x * c + e4.x * s), radius * (e3.y * c + e4.y * s), radius * (e3.z * c + e4.z * s));
            pos.vadd(v2$1, p1);
            c = Math.cos(a1);
            s = Math.sin(a1);
            v2$1.set(radius * (e3.x * c + e4.x * s), radius * (e3.y * c + e4.y * s), radius * (e3.z * c + e4.z * s));
            pos.vadd(v2$1, p2);
            liner.addLine(p1, p2, color, color);
        }
    }
    function drawEllipse(liner, pos, dir, radiusA, radiusB, color, axisHint) {
        if (radiusA <= 0 || radiusB <= 0)
            return;
        if (dir.x === 0 && dir.y === 0 && dir.z === 0)
            return;
        e1.set(dir.x, dir.y, dir.z);
        e1.normalize();
        if (axisHint && (axisHint.x !== 0 || axisHint.y !== 0 || axisHint.z !== 0)) {
            const d = axisHint.x * e1.x + axisHint.y * e1.y + axisHint.z * e1.z;
            e3.set(axisHint.x - d * e1.x, axisHint.y - d * e1.y, axisHint.z - d * e1.z);
            if (e3.x === 0 && e3.y === 0 && e3.z === 0) {
                if (Math.abs(e1.y) < 0.999) {
                    e2.set(0, 1, 0);
                }
                else {
                    e2.set(1, 0, 0);
                }
                Laya.Vector3.cross(e2, e1, e3);
            }
        }
        else {
            if (Math.abs(e1.y) < 0.999) {
                e2.set(0, 1, 0);
            }
            else {
                e2.set(1, 0, 0);
            }
            Laya.Vector3.cross(e2, e1, e3);
        }
        e3.normalize();
        Laya.Vector3.cross(e1, e3, e4);
        e4.normalize();
        const segments = 48;
        const step = Math.PI * 2 / segments;
        for (let i = 0; i < segments; i++) {
            const a0 = i * step;
            const a1 = (i + 1) * step;
            let c = Math.cos(a0);
            let s = Math.sin(a0);
            v2$1.set(radiusA * e3.x * c + radiusB * e4.x * s, radiusA * e3.y * c + radiusB * e4.y * s, radiusA * e3.z * c + radiusB * e4.z * s);
            pos.vadd(v2$1, p1);
            c = Math.cos(a1);
            s = Math.sin(a1);
            v2$1.set(radiusA * e3.x * c + radiusB * e4.x * s, radiusA * e3.y * c + radiusB * e4.y * s, radiusA * e3.z * c + radiusB * e4.z * s);
            pos.vadd(v2$1, p2);
            liner.addLine(p1, p2, color, color);
        }
    }

    var constraintMatW = new Laya.Matrix4x4();
    var constrainMatInv = new Laya.Matrix4x4();
    var constraintMatLocal = new Laya.Matrix4x4();
    let matJointW = new Laya.Matrix4x4();
    let matQ = new Laya.Matrix4x4();
    let ypr$1 = new Laya.Vector3();
    let constrainedQ = new Laya.Quaternion();
    class IK_ConstraintInstance {
        constructor(constraint, matInParent, constraintBone) {
            this.constraint = constraint;
            this.constraintBone = constraintBone;
            this.inParent = new Laya.Matrix4x4();
            this.inChild = null;
            this.enable = true;
            this.data = null;
            matInParent.cloneTo(this.inParent);
        }
        doConsraint(joint) {
            if (!this.enable)
                return;
            if (joint.parent) {
                Laya.Matrix4x4.multiply(joint.parent.transform.worldMatrix, this.inParent, constraintMatW);
            }
            else if (joint.bone.parent && joint.bone.parent instanceof Laya.Sprite3D) {
                Laya.Matrix4x4.multiply(joint.bone.parent.transform.worldMatrix, this.inParent, constraintMatW);
            }
            else {
                this.inParent.cloneTo(constraintMatW);
            }
            constraintMatW.invert(constrainMatInv);
            let childMat = joint.worldMatrix;
            if (this.constraintBone && joint.childDirOff) {
                childMat = childMat.clone();
                Laya.Matrix4x4.multiply(childMat, joint.childDirOff, childMat);
            }
            Laya.Matrix4x4.multiply(constrainMatInv, childMat, constraintMatLocal);
            let q = this.constraint.constraintMat(ripMatScale(constraintMatLocal), constrainedQ);
            Laya.Matrix4x4.createFromQuaternion(q, matQ);
            if (this.constraintBone && joint.childDirOff) {
                let dirInv = joint.childDirOff.clone();
                dirInv.transpose();
                Laya.Matrix4x4.multiply(matQ, dirInv, matQ);
            }
            Laya.Matrix4x4.multiply(constraintMatW, matQ, matJointW);
            ripMatScale(matJointW).decomposeYawPitchRoll(ypr$1);
            Laya.Quaternion.createFromYawPitchRoll(ypr$1.x, ypr$1.y, ypr$1.z, joint.rotationQuat);
            joint.rotationQuat = joint.rotationQuat;
        }
        visualize(joint, line) {
            if (!SHOW_DBG.has(SHOW_DBG.CONSTRAINT))
                return;
            if (!this.enable)
                return;
            let parentMat;
            if (joint.bone.parent && joint.bone.parent instanceof Laya.Sprite3D) {
                parentMat = joint.bone.parent.transform.worldMatrix;
            }
            let cspace_ws = new Laya.Matrix4x4();
            if (parentMat) {
                Laya.Matrix4x4.multiply(parentMat, this.inParent, cspace_ws);
            }
            let length = 0.6;
            if (SHOW_DBG.has(SHOW_DBG.CONSTRAINT_AXIS)) {
                drawAxis(line, cspace_ws, length, [new Laya.Color(1, 0.3, 0.3), new Laya.Color(0.3, 1, 0.3), new Laya.Color(0.3, 0.3, 1)]);
            }
            this.constraint.visualize(line, cspace_ws);
            let jointc_ele = joint.bone.transform.worldMatrix.elements;
            let jointPos = new Laya.Vector3(jointc_ele[12], jointc_ele[13], jointc_ele[14]);
            let jointZ = new Laya.Vector3(jointc_ele[8], jointc_ele[9], jointc_ele[10]);
            jointZ.normalize();
            jointZ.scale(length + 0.1, jointZ).vadd(jointPos, jointZ);
            line.addLine(jointPos, jointZ, Laya.Color.RED, Laya.Color.RED);
        }
    }

    new Laya.Vector3(0, 0, 1);
    let ypr = new Laya.Vector3();
    class IK_Constraint_Euler {
        constructor(xmin = -Math.PI / 2, xmax = Math.PI / 2, ymin = -Math.PI, ymax = Math.PI, zmin = -Math.PI, zmax = Math.PI) {
            this.xmin = xmin;
            this.xmax = xmax;
            this.ymin = ymin;
            this.ymax = ymax;
            this.zmin = zmin;
            this.zmax = zmax;
            this.rotation = new Laya.Quaternion();
            this.cur = 0;
        }
        constraintMat(mat, outQ) {
            mat.decomposeYawPitchRoll(ypr);
            let yaw = ypr.x;
            let pitch = ypr.y;
            let roll = ypr.z;
            if (pitch > this.xmax) {
                pitch = this.xmax;
            }
            if (pitch < this.xmin) {
                pitch = this.xmin;
            }
            if (yaw > this.ymax) {
                yaw = this.ymax;
            }
            if (yaw < this.ymin) {
                yaw = this.ymin;
            }
            if (roll < this.zmin) {
                roll = this.zmin;
            }
            if (roll > this.zmax) {
                roll = this.zmax;
            }
            let q = outQ || new Laya.Quaternion();
            Laya.Quaternion.createFromYawPitchRoll(yaw, pitch, roll, q);
            return q;
        }
        constraintQ(q) {
            return null;
        }
        visualize(liner, mat) {
            drawEulerRange(liner, mat, this.xmin, this.xmax, this.ymin, this.ymax, this.zmin, this.zmax);
        }
    }

    var z = new Laya.Vector3(0, 0, 1);
    let totalRotation = new Laya.Quaternion();
    let curz = new Laya.Vector3();
    let qSwingOrig = new Laya.Quaternion();
    let qSwingClamped = new Laya.Quaternion();
    let axis = new Laya.Vector3;
    let qSwingInv = new Laya.Quaternion();
    let qTwistClamped = new Laya.Quaternion();
    let qTwistOrig = new Laya.Quaternion();
    class IK_Constraint_SwingTwist {
        constructor(xmax = Math.PI / 4, ymax = Math.PI / 4, zmin = -Math.PI, zmax = Math.PI) {
            this.xmax = xmax;
            this.ymax = ymax;
            this.zmin = zmin;
            this.zmax = zmax;
            this.rotation = new Laya.Quaternion();
            this.cur = 0;
            this.visual_height = 0.5;
            this.visual_zheight = 0.5;
        }
        constraintMat(mat, outQ) {
            ripMatScale(mat);
            let mate = mat.elements;
            const EPS = 1e-6;
            Laya.Quaternion.createFromMatrix4x4(mat, totalRotation);
            totalRotation.normalize(totalRotation);
            curz.setValue(mate[8], mate[9], mate[10]);
            curz.normalize();
            quaternionFromTo(z, curz, qSwingOrig);
            const sinHalf = Math.sqrt(qSwingOrig.x * qSwingOrig.x + qSwingOrig.y * qSwingOrig.y + qSwingOrig.z * qSwingOrig.z);
            const cosHalf = qSwingOrig.w;
            let theta = 2 * Math.atan2(sinHalf, cosHalf);
            const invSinHalf = 1 / Math.max(sinHalf, EPS);
            const ux = sinHalf < EPS ? 1 : (qSwingOrig.x * invSinHalf);
            const uy = sinHalf < EPS ? 0 : (qSwingOrig.y * invSinHalf);
            const clampAng = (a) => Math.min(Math.max(a, EPS), Math.PI / 2 - 1e-3);
            const ax = Math.max(Math.tan(clampAng(this.xmax)), EPS);
            const ay = Math.max(Math.tan(clampAng(this.ymax)), EPS);
            const phi = Math.atan2(uy, ux);
            const c = Math.cos(phi), s = Math.sin(phi);
            const denom = Math.sqrt((c / ax) * (c / ax) + (s / ay) * (s / ay));
            const thetaMax = denom < EPS ? (Math.PI / 2 - 1e-3) : Math.atan(1 / denom);
            const thetaClamped = Math.min(theta, thetaMax);
            if (thetaClamped < EPS) {
                qSwingClamped.x = 0;
                qSwingClamped.y = 0;
                qSwingClamped.z = 0;
                qSwingClamped.w = 1;
            }
            else {
                axis.setValue(ux, uy, 0);
                axis.normalize();
                Laya.Quaternion.createFromAxisAngle(axis, thetaClamped, qSwingClamped);
            }
            qSwingOrig.invert(qSwingInv);
            Laya.Quaternion.multiply(qSwingInv, totalRotation, qTwistOrig);
            qTwistOrig.normalize(qTwistOrig);
            let angle = 2 * Math.atan2(qTwistOrig.z, qTwistOrig.w);
            while (angle > Math.PI)
                angle -= 2 * Math.PI;
            while (angle < -Math.PI)
                angle += 2 * Math.PI;
            angle = Math.max(this.zmin, Math.min(this.zmax, angle));
            Laya.Quaternion.createFromAxisAngle(z, angle, qTwistClamped);
            let constrainedRotation = outQ || new Laya.Quaternion();
            Laya.Quaternion.multiply(qSwingClamped, qTwistClamped, constrainedRotation);
            return constrainedRotation;
        }
        constraintQ(q) {
            return null;
        }
        visualize(liner, mat) {
            let max = 80 * Math.PI / 180;
            if (this.xmax > max || this.ymax > max)
                return;
            let height = this.visual_height;
            let r1 = Math.tan(this.xmax) * height;
            let r2 = Math.tan(this.ymax) * height;
            this.visual_zheight;
            let mate = mat.elements;
            let pos = new Laya.Vector3(mate[12], mate[13], mate[14]);
            let z = new Laya.Vector3(mate[8], mate[9], mate[10]);
            let y = new Laya.Vector3(mate[4], mate[5], mate[6]);
            y.normalize();
            z.normalize();
            let pos1 = new Laya.Vector3(pos.x + z.x * height, pos.y + z.y * height, pos.z + z.z * height);
            drawEllipse(liner, pos1, z, r1, r2, Laya.Color.CYAN, y);
        }
    }

    class IK_Target {
        constructor(pos, dir) {
            this.targetSprite = null;
            this._pos = new Laya.Vector3();
            this._dir = new Laya.Vector3(0, 1, 0);
            if (pos instanceof Laya.Sprite3D) {
                this.targetSprite = pos;
            }
            else {
                if (pos)
                    pos.cloneTo(this._pos);
                if (dir)
                    dir.cloneTo(this._dir);
            }
        }
        getPose(mat) {
            if (this.targetSprite) {
                this.targetSprite.transform.worldMatrix.cloneTo(mat);
                return mat;
            }
            return null;
        }
        get pos() {
            if (this.targetSprite) {
                return this.targetSprite.transform.position;
            }
            return this._pos;
        }
        set pos(p) {
            if (this.targetSprite) {
                this.targetSprite = null;
            }
            p.cloneTo(this._pos);
        }
        get dir() {
            if (this.targetSprite) {
                let e = this.targetSprite.transform.worldMatrix.elements;
                this._dir.setValue(e[4], e[5], e[6]);
                this._dir.normalize();
            }
            return this._dir;
        }
        set dir(v) {
            if (this.targetSprite) {
                this.targetSprite = null;
            }
            v.cloneTo(this._dir);
        }
    }

    class IK_Comp extends Laya.Script {
        set chainDatas(v) {
            this._chainDatas = v;
            this._needRebuild = true;
        }
        get chainDatas() {
            return this._chainDatas;
        }
        set solverIteration(v) {
            this._solverIteration = v;
            this._ik_sys.setMaxIterations(v);
        }
        get solverIteration() {
            return this._solverIteration;
        }
        set dirSolverIteration(v) {
            this._dirsolverIteration = v;
            IK_Lookat.dirIt = v;
        }
        get dirSolverIteration() {
            return this._dirsolverIteration;
        }
        set dampingFactor(v) {
            this._ik_sys.setDampingFactor(v);
        }
        get dampingFactor() {
            return this._ik_sys.getDampingFactor();
        }
        set constraints(cs) {
            this._constraintDatas = cs;
            this._needRebuild = true;
        }
        get constraints() {
            return this._constraintDatas;
        }
        onConstraintDataChange(idx) {
            let constraintComp = this.owner.getComponent(BoneConstraints);
            this.constraints = constraintComp.constraints;
        }
        set showGizmos(v) {
            this._showDbg = v;
            if (this._ik_sys) {
                this._ik_sys.showDbg = v;
            }
        }
        get showGizmos() {
            return this._showDbg;
        }
        set 显示约束(v) {
            if (v)
                SHOW_DBG.add(SHOW_DBG.CONSTRAINT);
            else
                SHOW_DBG.sub(SHOW_DBG.CONSTRAINT);
        }
        get 显示约束() {
            return SHOW_DBG.has(SHOW_DBG.CONSTRAINT);
        }
        set 显约束轴(v) {
            if (v)
                SHOW_DBG.add(SHOW_DBG.CONSTRAINT_AXIS);
            else
                SHOW_DBG.sub(SHOW_DBG.CONSTRAINT_AXIS);
        }
        get 显约束轴() {
            return SHOW_DBG.has(SHOW_DBG.CONSTRAINT_AXIS);
        }
        get RunInEditor() {
            return this._runInEditor;
        }
        set RunInEditor(b) {
            this._runInEditor = b;
        }
        set useAnimLayer(b) {
            this._ik_sys.useAnimLayer = b;
        }
        get useAnimLayer() {
            return this._ik_sys.useAnimLayer;
        }
        constructor() {
            super();
            this._needRebuild = true;
            this._constraintsMap = new Map();
            this._showDbg = false;
            this._visualSp = null;
            this._visualInPlay = true;
            this._chainDatas = [];
            this.current_iteration = 0;
            this.current_error = 0.0;
            this.pole_rot = 0;
            this.targetChange = 0;
            this.blendW = 0;
            this._recordIkFrames = false;
            this._frameRecordDepth = 60;
            this._frameReplayOffset = 0;
            this._solverIteration = 10;
            this._dirsolverIteration = 10;
            this._runInEditor = true;
        }
        _onAdded() {
            let ik = this._ik_sys = new IK_System(this);
            ik.setRoot(this.owner);
            ik.showDbg = this._showDbg;
            ik.setFrameRecorderEnabled(this._recordIkFrames);
            ik.setFrameRecorderDepth(this._frameRecordDepth);
        }
        onAfterDeserialize() {
            this._needRebuild = true;
        }
        onChainDataChange(data, key, value, oldvalue) {
            this._needRebuild = true;
        }
        setTarget(name, target) {
            this._ik_sys.setTarget(name, target);
        }
        get chains() {
            return this._ik_sys.chains;
        }
        getChain(name) {
            for (let c of this.chains) {
                if (c.name == name)
                    return c;
            }
            return null;
        }
        beforeOwnerAnim() {
            if (!this._runInEditor && window.EditorEnv)
                return;
            for (let chain of this._ik_sys.chains) {
                chain.resetStaticPose();
            }
            for (let lookat of this._ik_sys.lookats) {
                lookat.resetStaticPose();
            }
        }
        onAwake() {
            super.onAwake();
            let constraintComp = this.owner.getComponent(BoneConstraints);
            if (constraintComp) {
                this.constraints = constraintComp.constraints;
                this.owner.on(BoneConstraints.DATACHANGE, this, this.onConstraintDataChange);
            }
        }
        onDestroy() {
            this.showGizmos = false;
            this._ik_sys.showDbg = false;
            super.onDestroy();
            this.owner.off(BoneConstraints.DATACHANGE, this, this.onConstraintDataChange);
        }
        onUpdate() {
            if (window.EditorEnv && !this._runInEditor)
                return;
            if (this._needRebuild) {
                let _fixedBone = new Set();
                this._constraintsMap.clear();
                if (this._constraintDatas) {
                    this._constraintDatas.forEach(cdata => {
                        if (!cdata.bone)
                            return;
                        if (this._constraintsMap.get(cdata.bone)) {
                            console.error('一个骨骼只能设置一个约束:', cdata.bone, name, cdata.bone);
                        }
                        let constraint = null;
                        let d2r = Math.PI / 180;
                        switch (cdata.type) {
                            case 'hinge':
                                cdata.ymin = 0;
                                cdata.ymax = 0;
                                cdata.zmin = 0;
                                cdata.zmax = 0;
                            case 'euler':
                                {
                                    let c = new IK_Constraint_Euler(cdata.xmin * d2r, cdata.xmax * d2r, cdata.ymin * d2r, cdata.ymax * d2r, cdata.zmin * d2r, cdata.zmax * d2r);
                                    constraint = this._createConstraintInstanceFromData(cdata, c);
                                }
                                break;
                            case 'swingtwist':
                                {
                                    let c = new IK_Constraint_SwingTwist(cdata.xmax * d2r, cdata.ymax * d2r, cdata.zmin * d2r, cdata.zmax * d2r);
                                    c.visual_height = cdata.visualHeight;
                                    c.visual_zheight = c.visual_height + 0.1;
                                    constraint = this._createConstraintInstanceFromData(cdata, c);
                                }
                                break;
                            case 'fixed':
                                _fixedBone.add(cdata.bone);
                                break;
                        }
                        if (constraint) {
                            this._constraintsMap.set(cdata.bone, constraint);
                        }
                    });
                    this._ik_sys.constraintsMap = this._constraintsMap;
                }
                this._ik_sys.clear();
                this.chainDatas.forEach(data => {
                    var _a;
                    let cnt = ((_a = data.bones) === null || _a === void 0 ? void 0 : _a.length) || data.jointCount;
                    if (!cnt || !data.end || !data.enable)
                        return;
                    let name = data.name;
                    if (!name) {
                        name = data.end.name;
                    }
                    let chain_joints = null;
                    if (data.type == 'position') {
                        let c = this._ik_sys.chreateChainByBoneName(data.end, cnt);
                        c.name = name;
                        c.enable = data.enable;
                        c.blendWeight = data.blendWeight;
                        c.poleTarget = data.PoleTarget ? new IK_Target(data.PoleTarget) : null;
                        if (data.smoothBlendWeight) {
                            c.weightSmooth = data.smoothBlendWeight;
                        }
                        if (data.maxError)
                            c.maxError = data.maxError;
                        if (!data.enablePoleTarget) {
                            c.poleTarget = null;
                        }
                        this._ik_sys.addChain(c);
                        if (data.target)
                            this._ik_sys.setTarget(c, new IK_Target(data.target));
                        if (data.fixedEnd) {
                            c.endFixed = true;
                        }
                        if (data.alignTarget && data.alignTarget != 'no') {
                            c.endAlign = data.alignTarget;
                        }
                        chain_joints = c.joints;
                    }
                    else if (data.type == 'lookat') {
                        let lookat = this._ik_sys.chreateLookatByEndSprite(data.end, cnt);
                        if (lookat) {
                            lookat.name = name;
                            lookat.enable = data.enable;
                            this._ik_sys.lookats.push(lookat);
                            if (data.target) {
                                lookat.target = new IK_Target(data.target);
                            }
                            chain_joints = lookat.joints;
                        }
                    }
                    if (data.bones) {
                        let joints = chain_joints;
                        data.bones.forEach(b => {
                            if (b.disabled) {
                                for (let i = 0, n = cnt; i < n; i++) {
                                    if (joints[i].bone == b.data) {
                                        joints[i].fixed = true;
                                        break;
                                    }
                                }
                            }
                        });
                    }
                    if (_fixedBone.size) {
                        chain_joints.forEach(j => {
                            if (_fixedBone.has(j.bone)) {
                                j.fixed = true;
                            }
                        });
                    }
                });
                this._needRebuild = false;
            }
            else {
                this._updateConstraintSpace();
            }
            this._ik_sys.onUpdate();
            if (Laya.LayaEnv.isPlaying && this._visualInPlay) {
                if (!this._visualSp) {
                    let sp = this._visualSp = new Laya.PixelLineSprite3D();
                    sp.name = 'ik visual';
                    sp.maxLineCount = 1000;
                    let mtl = sp._render.material;
                    mtl.renderQueue = 4001;
                    mtl.depthTest = Laya.RenderState.DEPTHTEST_ALWAYS;
                    this.owner._scene.addChild(sp);
                }
                this._visualSp.clear();
                this.visualize(this._visualSp);
            }
        }
        _createConstraintInstanceFromData(cdata, c) {
            if (!cdata || !cdata.bone)
                return null;
            let inParent = new Laya.Matrix4x4();
            let parentMatW;
            if (cdata.bone.parent) {
                parentMatW = cdata.bone.parent.transform.worldMatrix;
            }
            if (cdata.space) {
                if (cdata.space.parent == cdata.bone) {
                    alert(`约束调整对象${cdata.space.name}不要放到当前关节下，建议放到当前关节的父下，否则初始化的时候会与当前关节的姿态有关`);
                }
                let constraintMat = cdata.space.transform.worldMatrix;
                let invMat = new Laya.Matrix4x4();
                if (parentMatW) {
                    parentMatW.invert(invMat);
                    Laya.Matrix4x4.multiply(invMat, constraintMat, inParent);
                }
                else {
                    constraintMat.cloneTo(inParent);
                }
                if (Laya.LayaEnv.isPlaying && cdata.space.name.startsWith('_ik')) ;
            }
            else {
                let pos = cdata.bone.transform.localPosition;
                inParent.elements[12] = pos.x;
                inParent.elements[13] = pos.y;
                inParent.elements[14] = pos.z;
            }
            let constraint = new IK_ConstraintInstance(c, inParent, cdata.constraintBone);
            constraint.data = cdata;
            constraint.enable = cdata.enable;
            return constraint;
        }
        _updateConstraintSpace() {
            for (let [bone, constraint] of this._constraintsMap) {
                let inParent = constraint.inParent;
                let data = constraint.data;
                if (data.space && !data.space.destroyed) {
                    let parentMatW;
                    if (data.bone.parent) {
                        parentMatW = data.bone.parent.transform.worldMatrix;
                    }
                    let constraintMat = data.space.transform.worldMatrix;
                    let invMat = new Laya.Matrix4x4();
                    if (parentMatW) {
                        parentMatW.invert(invMat);
                        Laya.Matrix4x4.multiply(invMat, constraintMat, inParent);
                    }
                    else {
                        constraintMat.cloneTo(inParent);
                    }
                }
            }
        }
        visualize(v) {
            this._ik_sys.visualize(v);
        }
    }

    class BoneConstraints extends Laya.Script {
        set constraints(cs) {
            this._constraintDatas = cs;
        }
        get constraints() {
            return this._constraintDatas;
        }
        onConstraintDataChange(idx) {
            this.owner.event(BoneConstraints.DATACHANGE, idx);
        }
        onAwake() {
            let ikcomp = this.owner.getComponent(IK_Comp);
            if (!ikcomp)
                return;
            ikcomp.constraints = this.constraints;
        }
        onDestroy() {
            let ikcomp = this.owner.getComponent(IK_Comp);
            if (!ikcomp)
                return;
            ikcomp.constraints = null;
        }
    }
    BoneConstraints.DATACHANGE = 'constraint_data_change';

    let dPos = new Laya.Vector3();
    let v1 = new Laya.Vector3();
    let v2 = new Laya.Vector3();
    new Laya.Vector3(0, 0, 1);
    class IK_FABRIK_Solver {
        constructor(maxIterations = 10, tolerance = 0.01) {
            this.debugProc = false;
            this.poleTarget = null;
            this.maxIterations = maxIterations;
            this.tolerance = tolerance;
        }
        solve(comp, chain, targetPos, endOffline) {
            const joints = chain.joints;
            const totalLength = chain.totalLength;
            const basePos = joints[0].position.clone();
            targetPos.vsub(basePos, dPos);
            if (dPos.length() > totalLength) {
                this.stretchToTarget(chain, targetPos);
                return false;
            }
            for (let iteration = 0; iteration < this.maxIterations; iteration++) {
                if (chain.isCollinear(targetPos)) {
                    let id = 1;
                    let randomAxis = new Laya.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
                    randomAxis.normalize();
                    const angle = (Math.random() * 10 - 5) * Math.PI / 180;
                    let rotQuat = new Laya.Quaternion();
                    Laya.Quaternion.createFromAxisAngle(randomAxis, angle, rotQuat);
                    chain.rotateJoint(id, rotQuat);
                }
                targetPos.cloneTo(joints[joints.length - 1].position);
                for (let i = joints.length - 2; i >= 0; i--) {
                    this.forwardStep(joints[i], joints[i + 1]);
                }
                basePos.cloneTo(joints[0].position);
                for (let i = 1; i < joints.length; i++) {
                    this.backwardStep(joints[i - 1], joints[i]);
                }
                chain.updateRotations();
                this.applyConstraints(chain);
                if (joints[joints.length - 1].position.vsub(targetPos, v1).length() < this.tolerance) {
                    break;
                }
            }
            if (this.poleTarget && joints.length > 2) {
                let axis = dPos;
                targetPos.vsub(basePos, axis);
                let polePos = this.poleTarget.pos;
                let baseToPole = new Laya.Vector3();
                polePos.vsub(basePos, baseToPole);
                let baseToMid = new Laya.Vector3();
                let middPos = chain.joints[1].position;
                middPos.vsub(basePos, baseToMid);
                const EPS = 1e-6;
                if (axis.length() > EPS && baseToPole.length() > EPS && baseToMid.length() > EPS) {
                    axis.normalize();
                    const projMid = new Laya.Vector3();
                    const projPole = new Laya.Vector3();
                    const tmp = new Laya.Vector3();
                    axis.scale(Laya.Vector3.dot(baseToMid, axis), tmp);
                    baseToMid.vsub(tmp, projMid);
                    axis.scale(Laya.Vector3.dot(baseToPole, axis), tmp);
                    baseToPole.vsub(tmp, projPole);
                    const lenMid = projMid.length();
                    const lenPole = projPole.length();
                    const EPSL = 0.1;
                    if (lenMid > EPSL && lenPole > EPSL) {
                        projMid.scale(1 / lenMid, projMid);
                        projPole.scale(1 / lenPole, projPole);
                        const cosTheta = Math.max(-1, Math.min(1, Laya.Vector3.dot(projMid, projPole)));
                        const cross = new Laya.Vector3();
                        Laya.Vector3.cross(projMid, projPole, cross);
                        const sinTheta = Laya.Vector3.dot(cross, axis);
                        let angle = Math.atan2(sinTheta, cosTheta);
                        if (isFinite(angle)) {
                            const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
                            const maxStep = 0.5;
                            const damp = this.dampingFactor > 0 ? clamp(this.dampingFactor, 0.05, 0.5) : 0.1;
                            angle = clamp(angle, -maxStep, maxStep) * damp;
                            if (Math.abs(angle) > 1e-5) {
                                const rot = new Laya.Quaternion();
                                Laya.Quaternion.createFromAxisAngle(axis, angle, rot);
                                chain.rotateJoint(0, rot);
                            }
                        }
                    }
                }
            }
            chain.updateRotations();
            return true;
        }
        applyConstraints(chain) {
            const joints = chain.joints;
            if (joints.length < 2)
                return;
            const iq = new Laya.Quaternion();
            for (let i = 0; i < joints.length - 1; i++) {
                chain.rotateJoint(i, iq);
            }
        }
        stretchToTarget(chain, targetPos) {
            const joints = chain.joints;
            const direction = targetPos.vsub(joints[0].position, v1).normalize();
            for (let i = 1; i < joints.length; i++) {
                const joint = joints[i];
                const prevJoint = joints[i - 1];
                prevJoint.position.vadd(direction.scale(prevJoint.length, v2), joint.position);
            }
            chain.updateRotations();
            this.applyConstraints(chain);
        }
        forwardStep(currentJoint, nextJoint) {
            const direction = nextJoint.position.vsub(currentJoint.position, v1).normalize();
            nextJoint.position.vsub(direction.scale(currentJoint.length, v2), currentJoint.position);
        }
        backwardStep(prevJoint, currentJoint) {
            const direction = currentJoint.position.vsub(prevJoint.position, v1).normalize();
            prevJoint.position.vadd(direction.scale(prevJoint.length, v2), currentJoint.position);
        }
    }

    class BoneData {
    }
    class IK_ChainData {
        constructor() {
            this.type = "position";
            this.end = null;
            this.root = null;
            this.fixedEnd = false;
            this.alignTarget = 'no';
            this.target = null;
            this.enablePoleTarget = false;
            this.PoleTarget = null;
            this.jointCount = 2;
            this.blendWeight = 1;
            this.smoothBlendWeight = 1;
            this.enable = true;
            this.maxError = 0.001;
        }
    }

    class IK_ConstraintData {
        constructor() {
            this._xmin = -45;
            this._xmax = 45;
            this._ymin = -45;
            this._ymax = 45;
            this._zmin = 0;
            this._zmax = 0;
            this.enable = true;
            this.type = 'hinge';
            this.space = null;
            this.constraintBone = false;
            this.visualHeight = 0.5;
        }
        set xmin(v) {
            this._xmin = v;
            if (this._xmax < v) {
                this.xmax = v;
            }
        }
        get xmin() {
            return this._xmin;
        }
        set xmax(v) {
            this._xmax = v;
            if (this._xmin > v) {
                this.xmin = v;
            }
        }
        get xmax() {
            return this._xmax;
        }
        set ymin(v) {
            this._ymin = v;
            if (this._ymax < v) {
                this.ymax = v;
            }
        }
        get ymin() {
            return this._ymin;
        }
        set ymax(v) {
            this._ymax = v;
            if (this._ymin > v) {
                this.ymin = v;
            }
        }
        get ymax() {
            return this._ymax;
        }
        set zmin(v) {
            this._zmin = v;
            if (this._zmax < v) {
                this.zmax = v;
            }
        }
        get zmin() {
            return this._zmin;
        }
        set zmax(v) {
            this._zmax = v;
            if (this._zmin > v) {
                this.zmin = v;
            }
        }
        get zmax() {
            return this._zmax;
        }
    }

    let IQ = new Laya.Quaternion();
    class IK_Lookat1 extends IK_ChainBase {
        constructor(joints, mgr) {
            super(mgr);
            this._chainLength = 0;
            this._end = null;
            this._hasOff = false;
            this.alignWithTarget = false;
            this._chainLength = joints.length;
            let root2end = true;
            if (joints.length > 1) {
                if (joints[0].bone.parent == joints[1].bone) {
                    root2end = false;
                }
                else if (joints[1].bone.parent == joints[0].bone) {
                    root2end = true;
                }
                else {
                    console.warn('无法确定lookat的ik链的顺序');
                }
            }
            if (root2end) {
                for (let i = 0, n = joints.length; i < n; i++) {
                    this.addJoint(joints[i]);
                }
            }
            else {
                this.joints = new Array(0);
                for (let i = joints.length - 1; i >= 0; i--) {
                    this.addJoint(joints[i]);
                }
            }
            this._end = this.joints[this.joints.length - 1];
            if (!this._end.bone._isRenderNode) {
                this._hasOff = true;
                this._end.fixed = true;
            }
            this.onLinkEnd();
        }
        visualize(line) {
            for (let j of this.joints) {
                if (j.constraint) {
                    j.constraint.visualize(j, line);
                }
            }
            if (this._target) {
                let end = this._end;
                let wmat = end.bone.transform.worldMatrix.elements;
                let st = new Laya.Vector3(wmat[12], wmat[13], wmat[14]);
                let dir = new Laya.Vector3(wmat[8], wmat[9], wmat[10]);
                dir.normalize();
                let ed = new Laya.Vector3();
                this._target.pos.vsub(st, ed);
                let len = ed.length();
                ed.setValue(st.x + len * dir.x, st.y + len * dir.y, st.z + len * dir.z);
                line.addLine(st, ed, Laya.Color.RED, Laya.Color.RED);
            }
        }
        solve() {
            if (!this.enable)
                return;
            if (!this._chainLength || !this._target)
                return;
            let deltaQ = new Laya.Quaternion();
            let target = this._target.pos.clone();
            let end = this._end;
            if (this._chainLength == 1) {
                let oriw = end.worldMatrix;
                let todir = new Laya.Vector3(target.x - oriw.elements[12], target.y - oriw.elements[13], target.z - oriw.elements[14]);
                todir.normalize();
                let zdir = new Laya.Vector3(oriw.elements[8], oriw.elements[9], oriw.elements[10]);
                zdir.normalize();
                quaternionFromTo(zdir, todir, deltaQ);
                let curR = end.rotationQuat;
                let resultQ = new Laya.Quaternion();
                Laya.Quaternion.multiply(deltaQ, curR, resultQ);
                end.rotationQuat = resultQ;
                let joint = this.joints[0];
                if (joint.constraint && joint.constraint.enable) {
                    joint.constraint.doConsraint(joint);
                }
            }
            else {
                let adjJoint = this._chainLength;
                if (this._hasOff)
                    adjJoint -= 1;
                let k = 1 / adjJoint;
                let it = IK_Lookat1.dirIt;
                let succ = false;
                while (it-- && !succ) {
                    for (let i = adjJoint - 1; i >= 0; i--) {
                        let joint = this.joints[i];
                        let endPose = end.worldMatrix;
                        let ele = endPose.elements;
                        let endPosW = new Laya.Vector3(ele[12], ele[13], ele[14]);
                        let endDirW = new Laya.Vector3(ele[8], ele[9], ele[10]);
                        endDirW.normalize();
                        let toTar = new Laya.Vector3(target.x - endPosW.x, target.y - endPosW.y, target.z - endPosW.z);
                        let dproj = Laya.Vector3.dot(toTar, endDirW);
                        let probeW = new Laya.Vector3(endPosW.x + endDirW.x * dproj, endPosW.y + endDirW.y * dproj, endPosW.z + endDirW.z * dproj);
                        let je = joint.worldMatrix.elements;
                        let jPosW = new Laya.Vector3(je[12], je[13], je[14]);
                        let vCur = new Laya.Vector3(probeW.x - jPosW.x, probeW.y - jPosW.y, probeW.z - jPosW.z);
                        let vTgt = new Laya.Vector3(target.x - jPosW.x, target.y - jPosW.y, target.z - jPosW.z);
                        vCur.normalize();
                        vTgt.normalize();
                        quaternionFromTo(vCur, vTgt, deltaQ);
                        Laya.Quaternion.slerp(IQ, deltaQ, k, deltaQ);
                        this.rotateJoint(i, deltaQ);
                    }
                    let ee = end.worldMatrix.elements;
                    let epos = new Laya.Vector3(ee[12], ee[13], ee[14]);
                    let edir = new Laya.Vector3(ee[8], ee[9], ee[10]);
                    edir.normalize();
                    let e2t = new Laya.Vector3(target.x - epos.x, target.y - epos.y, target.z - epos.z);
                    let proj = Laya.Vector3.dot(e2t, edir);
                    let perp = new Laya.Vector3(e2t.x - proj * edir.x, e2t.y - proj * edir.y, e2t.z - proj * edir.z);
                    if (perp.length() < 1e-3) {
                        succ = true;
                    }
                }
            }
        }
    }
    IK_Lookat1.dirIt = 1;

    class IK_TwoBoneChain {
        constructor() {
            this.root = null;
            this.kee = null;
            this.end = null;
        }
        solve(target, poleTarget) {
            this.root.bone.transform.worldMatrix;
            this.kee.bone.transform.worldMatrix;
            this.kee.bone.transform.worldMatrix;
        }
    }

    let c = Laya.ClassUtils.regClass;
    c('IK_Comp', IK_Comp);
    c('IK_ChainData', IK_ChainData);
    c('IK_ConstraintData', IK_ConstraintData);
    c('BoneConstraints', BoneConstraints);
    c('BoneData', BoneData);

    var dv = new Laya.Vector3();
    class Bone3D {
        constructor(name, parent, child) {
            this.name = name;
            this.parent = parent;
            this.child = child;
            this.boneLength = 0;
            this.pickDist = 0;
            parent.transform.position.vsub(child.transform.position, dv);
            this.boneLength = dv.length();
        }
    }

    new Laya.Vector3();
    new Laya.Vector3();
    class Skeleton3D {
        constructor() {
            this.showBone = true;
            this._bones = [];
            this._bounds = new Laya.BoundBox(new Laya.Vector3(), new Laya.Vector3());
            this._editorCamera = null;
            this.enablePick = false;
            this._curPickedBone = null;
            this._lastMouseX = 0;
            this._lastMouseY = 0;
            this._useGizmo = true;
            this.showAxis = false;
            this.axisLength = 0.3;
        }
        get pickedParent() {
            var _a;
            return (_a = this._curPickedBone) === null || _a === void 0 ? void 0 : _a.parent;
        }
        get pickedChild() {
            var _a;
            return (_a = this._curPickedBone) === null || _a === void 0 ? void 0 : _a.child;
        }
        get pickdName() {
            var _a;
            return (_a = this._curPickedBone) === null || _a === void 0 ? void 0 : _a.name;
        }
        onAwake(owner) {
            this.owner = owner;
            this._bones.length = 0;
            this.traverseChildren(owner, (parent, child) => {
                if (parent && child)
                    this._bones.push(new Bone3D(parent.name + '->' + child.name, parent, child));
            });
        }
        visualize(liner) {
            if (this.showBone) {
                this._visualSp = liner;
                let root = this.owner;
                this.traverseChildren(root, this._addLine.bind(this));
            }
        }
        _addLine(parent, child) {
            if (!child)
                return;
            let pcolor = Laya.Color.RED;
            let ccolor = Laya.Color.GREEN;
            let liner = this._visualSp;
            if (this._curPickedBone) {
                if (this._curPickedBone.parent == parent && this._curPickedBone.child == child) {
                    pcolor = Laya.Color.WHITE;
                    ccolor = Laya.Color.WHITE;
                    if (this.showAxis) {
                        drawAxis(liner, parent.transform.worldMatrix, this.axisLength);
                    }
                }
            }
            liner.addLine(parent.transform.position, child.transform.position, pcolor, ccolor);
        }
        traverseChildren(parent, f) {
            if (parent.name == 'joints')
                return;
            if (!parent.children || parent.children.length == 0) {
                f(parent, null);
            }
            parent.children.forEach(child => {
                if (child instanceof Laya.Sprite3D) {
                    let childsp = child;
                    f(parent, childsp);
                    this.traverseChildren(childsp, f);
                }
            });
        }
    }

    exports.Bone3D = Bone3D;
    exports.BoneConstraints = BoneConstraints;
    exports.BoneData = BoneData;
    exports.IK_AnimLayer = IK_AnimLayer;
    exports.IK_CCDSolver = IK_CCDSolver;
    exports.IK_Chain = IK_Chain;
    exports.IK_ChainBase = IK_ChainBase;
    exports.IK_ChainData = IK_ChainData;
    exports.IK_Comp = IK_Comp;
    exports.IK_ConstraintData = IK_ConstraintData;
    exports.IK_ConstraintInstance = IK_ConstraintInstance;
    exports.IK_Constraint_Euler = IK_Constraint_Euler;
    exports.IK_Constraint_SwingTwist = IK_Constraint_SwingTwist;
    exports.IK_DebugRecorder = IK_DebugRecorder;
    exports.IK_FABRIK_Solver = IK_FABRIK_Solver;
    exports.IK_Joint = IK_Joint;
    exports.IK_JointManager = IK_JointManager;
    exports.IK_LayerMgr = IK_LayerMgr;
    exports.IK_Lookat = IK_Lookat;
    exports.IK_Lookat1 = IK_Lookat1;
    exports.IK_System = IK_System;
    exports.IK_Target = IK_Target;
    exports.IK_TwoBoneChain = IK_TwoBoneChain;
    exports.NumberSmooth = NumberSmooth;
    exports.SHOW_DBG = SHOW_DBG;
    exports.Skeleton3D = Skeleton3D;
    exports.Vec3Smooth = Vec3Smooth;
    exports.delay = delay;
    exports.drawAxis = drawAxis;
    exports.drawCircle = drawCircle;
    exports.drawEllipse = drawEllipse;
    exports.drawEulerRange = drawEulerRange;
    exports.drawEulerRange1 = drawEulerRange1;
    exports.getJointMgr = getJointMgr;
    exports.getVecAngInPlane = getVecAngInPlane;
    exports.isCollinear = isCollinear;
    exports.quaternionFromTo = quaternionFromTo;
    exports.ripMatScale = ripMatScale;
    exports.solveLambdaForNormEquality = solveLambdaForNormEquality;
    exports.solveLookat = solveLookat;

})(window.Laya = window.Laya || {}, Laya);
//# sourceMappingURL=laya.ik.js.map
