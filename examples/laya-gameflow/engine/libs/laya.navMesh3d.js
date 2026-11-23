(function (exports, Laya) {
    'use strict';

    exports.NavObstaclesMeshType = void 0;
    (function (NavObstaclesMeshType) {
        NavObstaclesMeshType[NavObstaclesMeshType["BOX"] = 0] = "BOX";
        NavObstaclesMeshType[NavObstaclesMeshType["CYLINDER"] = 1] = "CYLINDER";
        NavObstaclesMeshType[NavObstaclesMeshType["CUSTOMER"] = 2] = "CUSTOMER";
    })(exports.NavObstaclesMeshType || (exports.NavObstaclesMeshType = {}));
    let createObstacleData = function (slices, radiusOff = 0, radius = 1) {
        let vertexs = new Float32Array(slices * 6);
        const triCount = (slices - 1) * 4;
        let flags = new Uint8Array(triCount);
        flags.fill(1);
        let ibs = [];
        for (var i = 0; i < slices; i++) {
            if (i >= 1) {
                let index = 2 * i;
                ibs.push(index - 2, index + 1, index);
                ibs.push(index - 1, index + 1, index - 2);
                if (i >= 2) {
                    ibs.push(0, index - 2, index);
                    ibs.push(index - 1, 1, index + 1);
                }
            }
        }
        let endIndex = slices * 2;
        ibs.push(endIndex - 2, 1, 0);
        ibs.push(endIndex - 1, 1, endIndex - 2);
        var sliceAngle = (Math.PI * 2.0) / slices;
        for (var i = 0; i < slices; i++) {
            let triIndex = i * 6;
            vertexs[triIndex] = vertexs[triIndex + 3] = radius * Math.cos(sliceAngle * i + radiusOff);
            vertexs[triIndex + 2] = vertexs[triIndex + 5] = radius * Math.sin(sliceAngle * i + radiusOff);
            vertexs[triIndex + 1] = radius;
            vertexs[triIndex + 4] = -radius;
        }
        let tileData = new Laya.NavTileCache();
        tileData.triVertex = vertexs;
        tileData.triIndex = new Uint32Array(ibs);
        tileData.triFlag = flags;
        tileData.boundMin.setValue(-radius, -radius, -radius);
        tileData.boundMax.setValue(radius, radius, radius);
        return tileData;
    };
    class NavigationManager extends Laya.BaseNavigationManager {
        static _getNavManager(comp) {
            return comp.owner.scene.getComponentElementManager(NavigationManager._managerName);
        }
        static _initialize() {
            return Laya.BaseNavigationManager._initialize(() => {
                NavigationManager.__init__();
            });
        }
        static __init__() {
            NavigationManager._obstacleMap.set(exports.NavObstaclesMeshType.BOX, createObstacleData(4));
            NavigationManager._obstacleMap.set(exports.NavObstaclesMeshType.CYLINDER, createObstacleData(20));
        }
        static _getObstacleData(type) {
            return this._obstacleMap.get(type);
        }
        constructor() {
            super(NavigationManager._managerName);
        }
    }
    NavigationManager._managerName = "navMesh";
    NavigationManager._obstacleMap = new Map();
    Laya.Scene3D.regManager(NavigationManager._managerName, NavigationManager);
    Laya.Laya.addInitCallback(NavigationManager._initialize);

    class BaseNav3DModifle extends Laya.Component {
        set agentType(value) {
            this._modifierData.agentType = value;
        }
        get agentType() {
            return this._modifierData.agentType;
        }
        set areaFlag(value) {
            this._modifierData.areaFlag = value;
        }
        get areaFlag() {
            return this._modifierData.areaFlag;
        }
        constructor() {
            super();
            this.runInEditor = true;
        }
        _onEnable() {
            super._onEnable();
            this._manager = NavigationManager._getNavManager(this);
            this._onWorldMatNeedChange();
            this.owner.transform.on(Laya.Event.TRANSFORM_CHANGED, this, this._onWorldMatNeedChange);
        }
        _onDisable() {
            this.owner.transform.off(Laya.Event.TRANSFORM_CHANGED, this, this._onWorldMatNeedChange);
            const data = this._modifierData;
            if (data instanceof Laya.NavMeshLinkData)
                data.destroy();
            else if (data instanceof Laya.NavModifleData)
                data._destory();
            super._onDisable();
        }
        _onDestroy() {
            if (this._modifierData instanceof Laya.NavModifleData)
                this._modifierData._destory();
            super._onDestroy();
        }
        _cloneTo(dest) {
            const modifier = dest;
            modifier.agentType = this.agentType;
            modifier.areaFlag = this.areaFlag;
            super._cloneTo(dest);
        }
        _onWorldMatNeedChange() {
            this._refeashTranfrom(this.owner.transform.worldMatrix, this._modifierData._min, this._modifierData._max);
            this._modifierData._refeahTransfrom();
            this._modifierData._refeahBound();
        }
        _refeashTranfrom(mat, min, max) {
        }
    }

    const tempVector3$1 = new Laya.Vector3();
    class Navgiation3DUtils {
        static __init__() {
        }
        static _resetMesh(mesh, vertexDeclaration, vertices, indices) {
            var vertexBuffer = Laya.Laya3DRender.renderOBJCreate.createVertexBuffer3D(vertices.length * 4, Laya.BufferUsage.Static, true);
            vertexBuffer.vertexDeclaration = vertexDeclaration;
            vertexBuffer.setData(vertices.buffer);
            mesh._vertexBuffer = vertexBuffer;
            mesh._vertexCount = vertexBuffer._byteLength / vertexDeclaration.vertexStride;
            var indexBuffer = Laya.Laya3DRender.renderOBJCreate.createIndexBuffer3D(Laya.IndexFormat.UInt16, indices.length, Laya.BufferUsage.Static, true);
            indexBuffer.setData(indices);
            mesh._indexBuffer = indexBuffer;
            mesh._setBuffer(vertexBuffer, indexBuffer);
            let subMesh = mesh.getSubMesh(0);
            subMesh._vertexBuffer = vertexBuffer;
            subMesh._indexBuffer = indexBuffer;
            subMesh._setIndexRange(0, indexBuffer.indexCount);
            var subIndexBufferStart = subMesh._subIndexBufferStart;
            var subIndexBufferCount = subMesh._subIndexBufferCount;
            var boneIndicesList = subMesh._boneIndicesList;
            subIndexBufferStart.length = 1;
            subIndexBufferCount.length = 1;
            boneIndicesList.length = 1;
            subIndexBufferStart[0] = 0;
            subIndexBufferCount[0] = indexBuffer.indexCount;
            var memorySize = vertexBuffer._byteLength + indexBuffer._byteLength;
            mesh._setCPUMemory(memorySize);
            mesh._setGPUMemory(memorySize);
        }
        static _getTitleData(title, vbDatas, center, ibs) {
            let header = title.getheader();
            if (!header)
                return null;
            const vboff = vbDatas.length / 6;
            let tvertCount = header.vertCount;
            let tailTris = title.getdetailTris();
            for (var i = 0; i < header.polyCount; i++) {
                let p = title.getPolys(i);
                let vertCount = p.vertCount;
                let pverts = p.getVerts();
                let pd = title.getPolyDetail(i);
                let triCount = pd.triCount;
                for (var j = 0; j < triCount; j++) {
                    let index = (pd.triBase + j) * 4;
                    for (var k = 0; k < 3; k++) {
                        const kvalue = tailTris[index + Laya.NavigationUtils._TitleMeshIbOff[k]];
                        if (kvalue < vertCount) {
                            ibs.push(pverts[kvalue] + vboff);
                        }
                        else {
                            ibs.push(pd.vertBase + kvalue - vertCount + vboff + tvertCount);
                        }
                    }
                }
            }
            let verts = title.getVerts();
            for (var i = 0, n = verts.length; i < n; i += 3) {
                vbDatas.push(verts[i] - center.x);
                vbDatas.push(verts[i + 1] - center.y);
                vbDatas.push(verts[i + 2] - center.z);
                vbDatas.push(0, 0, 0);
            }
            verts = title.getdetailVerts();
            for (var i = 0, n = verts.length; i < n; i += 3) {
                vbDatas.push(verts[i] - center.x);
                vbDatas.push(verts[i + 1] - center.y);
                vbDatas.push(verts[i + 2] - center.z);
                vbDatas.push(0, 0, 0);
            }
        }
        static _createDebugMesh(navMesh, mesh) {
            let m_navMesh = navMesh.navMesh;
            let tileCount = m_navMesh.getMaxTiles();
            let min = navMesh.navTileGrid.min;
            let max = navMesh.navTileGrid.max;
            let orig = tempVector3$1;
            Laya.Vector3.lerp(min, max, 0.5, orig);
            let poses = [];
            let indexs = [];
            for (var i = 0; i < tileCount; i++) {
                Navgiation3DUtils._getTitleData(m_navMesh.getTile(i), poses, orig, indexs);
            }
            let vertexDeclaration = Laya.VertexMesh.getVertexDeclaration("POSITION,NORMAL");
            let vb = new Float32Array(poses);
            let ib = new Uint16Array(indexs);
            if (mesh == null) {
                mesh = Laya.PrimitiveMesh._createMesh(vertexDeclaration, vb, ib);
            }
            else {
                this._resetMesh(mesh, vertexDeclaration, vb, ib);
            }
            Laya.Vector3.subtract(max, orig, mesh.bounds.max);
            Laya.Vector3.subtract(min, orig, mesh.bounds.min);
            return mesh;
        }
    }

    class NavMesh extends Laya.BaseNavMesh {
        constructor(config, min, max, surface) {
            super(config, min, max, surface, true);
            this._titileConfig._setMaxEdgeLen(12 / config.cellSize);
            this._titileConfig.maxSimplificationError = 0.9;
        }
        _addTile(cache, binds, partitionType, maxSimplificationError) {
            super._addTile(cache, binds, partitionType, maxSimplificationError);
            if (this._debugMesh) {
                Navgiation3DUtils._createDebugMesh(this, this._debugMesh);
            }
        }
        buildDebugMesh() {
            this._debugMesh = Navgiation3DUtils._createDebugMesh(this, null);
            return this._debugMesh;
        }
    }

    class NavMeshSurface extends Laya.BaseNavMeshSurface {
        get navMesh() {
            return this._navMesh;
        }
        constructor() {
            super();
        }
        _getManager() {
            return NavigationManager._getNavManager(this);
        }
        _crateNavMesh(config, min, max) {
            return new NavMesh(config, min, max, this);
        }
    }

    class NavMeshModifileSurface extends BaseNav3DModifle {
        constructor() {
            super();
            this._modifierData = new Laya.NavModifleData();
        }
        set datas(value) {
            if (this._oriTiles) {
                this._oriTiles.destroy();
                this._oriTiles = null;
            }
            if (value != null) {
                this._oriTiles = new Laya.NavTileData(value);
            }
            this._changeData();
            this._onWorldMatNeedChange();
        }
        get datas() {
            if (this._oriTiles)
                return this._oriTiles._res;
            return null;
        }
        _onEnable() {
            this._changeData();
            super._onEnable();
            let min = this._modifierData._min;
            let max = this._modifierData._max;
            let surface = this._manager.getNavMeshSurfacesByBound(min, max, this._modifierData.agentType);
            this._modifierData._initSurface(surface);
        }
        _refeashTranfrom(mat, min, max) {
            mat.cloneTo(this._modifierData._transfrom);
            let data = this._modifierData;
            if (data.datas == null)
                return;
            let boundmin = data.datas._boundMin;
            let boundmax = data.datas._boundMax;
            Laya.NavigationUtils._transfromBoundBox(boundmin, boundmax, this._modifierData._transfrom, min, max);
            this._modifierData._refeahTransfrom();
        }
        _changeData() {
            if (!this._enabled)
                return;
            let modiferData = this._modifierData;
            if (this._oriTiles) {
                modiferData.datas = this._oriTiles.getNavData(0);
            }
            else {
                modiferData.datas = null;
            }
        }
        _onDestroy() {
            var _a;
            (_a = this._oriTiles) === null || _a === void 0 ? void 0 : _a.destroy();
            this._oriTiles = null;
            super._onDestroy();
        }
        _cloneTo(dest) {
            dest.datas = this.datas;
            super._cloneTo(dest);
        }
    }

    const tempVec3 = new Laya.Vector3();
    const tempVec31 = new Laya.Vector3();
    class NavMeshLink extends BaseNav3DModifle {
        set width(value) {
            this._data._updateWidth(value);
        }
        get width() {
            return this._data._width;
        }
        set bidirectional(value) {
            this._data._updateBidirectional(value);
        }
        get bidirectional() {
            return this._data._bidirectional;
        }
        set start(value) {
            this._data._updateStartPoint(value);
        }
        get start() {
            return this._data._startPoint;
        }
        set end(value) {
            this._data._updateEndPoint(value);
        }
        get end() {
            return this._data._endPoint;
        }
        constructor() {
            super();
            this._modifierData = new Laya.NavMeshLinkData();
        }
        get _data() {
            return this._modifierData;
        }
        _onEnable() {
            super._onEnable();
            this._onWorldMatNeedChange();
            Laya.Vector3.min(this._data.globalStart, this._data.globalEnd, tempVec3);
            Laya.Vector3.max(this._data.globalStart, this._data.globalEnd, tempVec31);
            let surface = this._manager.getNavMeshSurfacesByBound(tempVec3, tempVec31, this._modifierData.agentType);
            this._data._initSurface(surface);
        }
        _refeashTranfrom(mat, min, max) {
            var data = this._data;
            mat.cloneTo(data._transfrom);
            this._modifierData._refeahTransfrom();
            Laya.Vector3.transformCoordinate(data._startPoint, mat, data.globalStart);
            Laya.Vector3.transformCoordinate(data._endPoint, mat, data.globalEnd);
        }
        _cloneTo(dest) {
            dest.start = this.start;
            dest.end = this.end;
            dest.agentType = this.agentType;
            dest.areaFlag = this.areaFlag;
            dest.width = this.width;
            dest.bidirectional = this.bidirectional;
            super._cloneTo(dest);
        }
    }

    class NavMeshModifierVolume extends Laya.Component {
        set agentType(value) {
            this._volumeData.agentType = value;
        }
        get agentType() {
            return this._volumeData.agentType;
        }
        set areaFlag(value) {
            this._volumeData.areaFlag = value;
        }
        get areaFlag() {
            return this._volumeData.areaFlag;
        }
        get center() {
            return this._center;
        }
        set center(value) {
            value.cloneTo(this._center);
            this._onWorldMatNeedChange();
        }
        get size() {
            return this._size;
        }
        set size(value) {
            value.cloneTo(this._size);
            this._onWorldMatNeedChange();
        }
        constructor() {
            super();
            this._center = new Laya.Vector3();
            this._size = new Laya.Vector3(1, 1, 1);
            this._volumeData = new Laya.ModifierVolumeData();
        }
        _onEnable() {
            let surface = new Array();
            Laya.BaseNavigationManager.findNavMeshSurface(surface, this.owner, [this.agentType]);
            this._volumeData._initSurface(surface);
            this._onWorldMatNeedChange();
            this.owner.transform.on(Laya.Event.TRANSFORM_CHANGED, this, this._onWorldMatNeedChange);
        }
        _onDisable() {
            this.owner.transform.off(Laya.Event.TRANSFORM_CHANGED, this, this._onWorldMatNeedChange);
            this._volumeData._destory();
        }
        _onWorldMatNeedChange() {
            let transform = this._volumeData._transfrom;
            Laya.Matrix4x4.createAffineTransformation(this._center, Laya.Quaternion.DEFAULT, this._size, transform);
            Laya.Matrix4x4.multiply(this.owner.transform.worldMatrix, transform, transform);
            this._volumeData._refeahTransfrom();
        }
        _cloneTo(dest) {
            dest.size = this.size;
            dest.center = this.center;
            dest.agentType = this.agentType;
            dest.areaFlag = this.areaFlag;
            super._cloneTo(dest);
        }
    }

    class NavMeshObstacles extends BaseNav3DModifle {
        set meshType(value) {
            if (this._meshType == value)
                return;
            this._meshType = value;
            this._changeData();
            this._onWorldMatNeedChange();
        }
        get meshType() {
            return this._meshType;
        }
        set center(value) {
            value.cloneTo(this._center);
            this._onWorldMatNeedChange();
        }
        get center() {
            return this._center;
        }
        set size(value) {
            value.cloneTo(this.size);
            if (this._meshType == exports.NavObstaclesMeshType.BOX) {
                this._onWorldMatNeedChange();
            }
        }
        get size() {
            return this._size;
        }
        set height(value) {
            this._height = value;
            if (this._meshType == exports.NavObstaclesMeshType.CYLINDER) {
                this._onWorldMatNeedChange();
            }
        }
        get height() {
            return this._height;
        }
        set radius(value) {
            this._radius = value;
            if (this._meshType == exports.NavObstaclesMeshType.CYLINDER) {
                this._onWorldMatNeedChange();
            }
        }
        get radius() {
            return this._radius;
        }
        set datas(value) {
            if (this._oriTiles) {
                this._oriTiles.destroy();
                this._oriTiles = null;
            }
            if (value != null) {
                this._oriTiles = new Laya.NavTileData(value);
            }
            this._changeData();
            this._onWorldMatNeedChange();
        }
        get datas() {
            if (this._oriTiles)
                return this._oriTiles._res;
            return null;
        }
        constructor() {
            super();
            this._meshType = exports.NavObstaclesMeshType.BOX;
            this._center = new Laya.Vector3(0, 0, 0);
            this._size = new Laya.Vector3(1, 1, 1);
            this._height = 1;
            this._radius = 0.5;
            this._localMat = new Laya.Matrix4x4();
            this._modifierData = new Laya.NavModifleData();
        }
        _onEnable() {
            this._changeData();
            super._onEnable();
            let min = this._modifierData._min;
            let max = this._modifierData._max;
            let surface = this._manager.getNavMeshSurfacesByBound(min, max, this._modifierData.agentType);
            this._modifierData._initSurface(surface);
        }
        _refeashTranfrom(mat, min, max) {
            if (this._meshType == exports.NavObstaclesMeshType.BOX) {
                Laya.Matrix4x4.createAffineTransformation(this._center, Laya.Quaternion.DEFAULT, this._size, this._localMat);
            }
            else {
                Laya.Vector3.TEMP.setValue(this.radius, this.height, this.radius);
                Laya.Matrix4x4.createAffineTransformation(this._center, Laya.Quaternion.DEFAULT, Laya.Vector3.TEMP, this._localMat);
            }
            Laya.Matrix4x4.multiply(mat, this._localMat, this._modifierData._transfrom);
            let data = this._modifierData;
            if (data.datas == null)
                return;
            let boundmin = data.datas._boundMin;
            let boundmax = data.datas._boundMax;
            Laya.NavigationUtils._transfromBoundBox(boundmin, boundmax, this._modifierData._transfrom, min, max);
            this._modifierData._refeahTransfrom();
        }
        _changeData() {
            if (!this._enabled)
                return;
            let modiferData = this._modifierData;
            switch (this._meshType) {
                case exports.NavObstaclesMeshType.BOX:
                    modiferData.datas = NavigationManager._getObstacleData(exports.NavObstaclesMeshType.BOX);
                    break;
                case exports.NavObstaclesMeshType.CYLINDER:
                    modiferData.datas = NavigationManager._getObstacleData(exports.NavObstaclesMeshType.CYLINDER);
                    break;
                case exports.NavObstaclesMeshType.CUSTOMER:
                    if (this._oriTiles) {
                        modiferData.datas = this._oriTiles.getNavData(0);
                    }
                    else {
                        modiferData.datas = null;
                    }
                    break;
                default:
                    console.error("NavMesh2DObstacles:meshType error");
                    break;
            }
        }
        _onDestroy() {
            if (this._oriTiles)
                this._oriTiles.destroy();
            this._oriTiles = null;
            super._onDestroy();
        }
        _cloneTo(dest) {
            let obstacles = dest;
            this._center.cloneTo(obstacles.center);
            obstacles._meshType = this._meshType;
            this.size.cloneTo(obstacles.size);
            obstacles.radius = this.radius;
            obstacles.height = this.height;
            obstacles.datas = this.datas;
            super._cloneTo(dest);
        }
    }
    NavMeshObstacles._boundMin = new Laya.Vector3(-0.5, -0.5, -0.5);
    NavMeshObstacles._boundMax = new Laya.Vector3(0.5, 0.5, 0.5);

    const TempQuaternion = new Laya.Quaternion();
    const tempVector3 = new Laya.Vector3();
    class NavAgent extends Laya.BaseNavAgent {
        constructor() {
            super(...arguments);
            this._destination = new Laya.Vector3();
        }
        set baseOffset(value) {
            this._baseOffset = value;
        }
        get baseOffset() {
            return this._baseOffset;
        }
        set destination(value) {
            value.cloneTo(this._destination);
            this._setTarget(this._destination);
        }
        get destination() {
            return this._destination;
        }
        _getManager() {
            return NavigationManager._getNavManager(this);
        }
        _getpos(vec) {
            let transform = this.owner.transform;
            transform.position.cloneTo(vec);
            vec.y -= this._baseOffset;
        }
        _getheight() {
            let scale = this.owner.transform.getWorldLossyScale();
            return this._height * scale.y;
        }
        _getradius() {
            let scale = this.owner.transform.getWorldLossyScale();
            return this._radius * Math.max(Math.abs(scale.x), Math.abs(scale.z));
        }
        _updatePosition(pos, dir) {
            let transform = this.owner.transform;
            pos.y += this._baseOffset;
            transform.position = pos;
            if (Laya.MathUtils3D.isZero(dir.length()))
                return;
            let up = tempVector3;
            transform.getUp(up);
            Laya.Vector3.normalize(dir, dir);
            dir.z = -dir.z;
            Laya.Quaternion.rotationLookAt(dir, up, TempQuaternion);
            transform.rotation = TempQuaternion;
        }
    }

    let c = Laya.ClassUtils.regClass;
    c("BaseNav3DModifle", BaseNav3DModifle);
    c("NavAgent", NavAgent);
    c("NavMeshSurface", NavMeshSurface);
    c("NavigationManager", NavigationManager);
    c("NavMesh", NavMesh);
    c("NavMeshModifileSurface", NavMeshModifileSurface);
    c("NavMeshLink", NavMeshLink);
    c("NavMeshObstacles", NavMeshObstacles);
    c("NavMeshModifierVolume", NavMeshModifierVolume);

    exports.BaseNav3DModifle = BaseNav3DModifle;
    exports.NavAgent = NavAgent;
    exports.NavMesh = NavMesh;
    exports.NavMeshLink = NavMeshLink;
    exports.NavMeshModifierVolume = NavMeshModifierVolume;
    exports.NavMeshModifileSurface = NavMeshModifileSurface;
    exports.NavMeshObstacles = NavMeshObstacles;
    exports.NavMeshSurface = NavMeshSurface;
    exports.Navgiation3DUtils = Navgiation3DUtils;
    exports.NavigationManager = NavigationManager;

})(window.Laya = window.Laya || {}, Laya);
//# sourceMappingURL=laya.navMesh3d.js.map
