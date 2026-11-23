(function (exports, Laya) {
    'use strict';

    let tempVector3$2 = new Laya.Vector3();
    let mat = new Laya.Matrix();
    let point = new Laya.Point();
    const transfromPoint = function (x, y) {
        point.setTo(x, y);
        return mat.transformPoint(point);
    };
    class Navgiation2DUtils {
        static __init__() {
            const areaColor = ['#800000', '#FFA500', '#FF0000', '#FFD700', '#F0E68C', '#808000', '#FFFF00', '#7CFC00', '#008000', '#98FB98', '#8FBC8F', '#00FFFF', '#E0FFFF', '#00BFFF', '#191970', '#0000FF'];
            for (var i = 0; i < 16; i++) {
                let color = new Laya.Color();
                let data = areaColor[i];
                color.r = parseInt("0x" + data.substring(1, 3), 16) / 255;
                color.g = parseInt("0x" + data.substring(3, 5), 16) / 255;
                color.b = parseInt("0x" + data.substring(5, 7), 16) / 255;
                color.a = 0.4;
                this._colorMap.set(i, color);
            }
        }
        static _setValue3(x, y, out) {
            out.setValue(x, 0, y);
        }
        static _getSpriteGlobalPos(sprite, out) {
            this._setValue3(sprite.globalTrans.x, sprite.globalTrans.y, out);
        }
        static _transfromVec2ToVec3(vec2, mat, out) {
            out.x = mat.a * vec2.x + mat.c * vec2.y + mat.tx;
            out.y = 0;
            out.z = mat.b * vec2.x + mat.d * vec2.y + mat.ty;
        }
        static _getSpriteMatrix4x4(sprite, out) {
            let mat = sprite.globalTrans.getMatrix();
            out.elements[0] = mat.a;
            out.elements[1] = 0;
            out.elements[2] = mat.b;
            out.elements[3] = 0;
            out.elements[4] = 0;
            out.elements[5] = 1;
            out.elements[6] = 0;
            out.elements[7] = 0;
            out.elements[8] = mat.c;
            out.elements[9] = 0;
            out.elements[10] = mat.d;
            out.elements[11] = 0;
            out.elements[12] = mat.tx;
            out.elements[13] = 0;
            out.elements[14] = mat.ty;
            out.elements[15] = 1;
        }
        static _getTransfromMatrix4x4(pos, rot, scale, out) {
            out.identity();
            let rate = Laya.Utils.toRadian(rot);
            let sin = Math.sin(rate);
            let cos = Math.cos(rate);
            out.elements[0] = cos * scale.x;
            out.elements[2] = sin * scale.x;
            out.elements[8] = -sin * scale.y;
            out.elements[10] = cos * scale.y;
            out.elements[12] = pos.x;
            out.elements[14] = pos.y;
        }
        static _getTitleData(title, vbDatas, size, ibs) {
            let header = title.getheader();
            if (!header)
                return null;
            let tvertCount = header.vertCount;
            let tailTris = title.getdetailTris();
            let indexMaps = new Map();
            for (var i = 0; i < header.polyCount; i++) {
                let p = title.getPolys(i);
                let flags = p.flags;
                if (!indexMaps.has(flags))
                    indexMaps.set(flags, []);
                let indexs = indexMaps.get(flags);
                let vertCount = p.vertCount;
                let pverts = p.getVerts();
                let pd = title.getPolyDetail(i);
                let triCount = pd.triCount;
                for (var j = 0; j < triCount; j++) {
                    let index = (pd.triBase + j) * 4;
                    for (var k = 0; k < 3; k++) {
                        const kvalue = tailTris[index + Laya.NavigationUtils._TitleMeshIbOff[k]];
                        if (kvalue < vertCount) {
                            indexs.push(pverts[kvalue]);
                        }
                        else {
                            indexs.push(pd.vertBase + kvalue - vertCount + tvertCount);
                        }
                    }
                }
            }
            let pointdatas = [];
            let verts = title.getVerts();
            for (var i = 0, n = verts.length; i < n; i += 3) {
                let p = transfromPoint(verts[i], verts[i + 2]);
                pointdatas.push(p.x, p.y);
                pointdatas.push(verts[i] / size.x);
                pointdatas.push(verts[i + 2] / size.z);
            }
            verts = title.getdetailVerts();
            for (var i = 0, n = verts.length; i < n; i += 3) {
                let p = transfromPoint(verts[i], verts[i + 2]);
                pointdatas.push(p.x, p.y);
                pointdatas.push(verts[i] / size.x);
                pointdatas.push(verts[i + 2] / size.z);
            }
            indexMaps.forEach((values, key) => {
                let color = this._colorMap.get(Math.log2(key) + 1);
                let set = new Set(values);
                let newIb = Array.from(set.values());
                newIb.sort((a, b) => a - b);
                const ibOffset = vbDatas.length / 9;
                for (var i = 0, n = newIb.length; i < n; i++) {
                    let index = newIb[i] * 4;
                    vbDatas.push(pointdatas[index], pointdatas[index + 1], 0, color.r, color.g, color.b, color.a, pointdatas[index + 2], pointdatas[index + 3]);
                }
                values.forEach((ib, index) => {
                    ibs.push(newIb.indexOf(ib) + ibOffset);
                });
            });
        }
        static _updateMesh2DData(mesh2d, vbdata, ib, ibFormat, canRead = false) {
            let vbArray = [];
            {
                let vertex = Laya.LayaGL.renderDeviceFactory.createVertexBuffer(Laya.BufferUsage.Dynamic);
                vertex.vertexDeclaration = Laya.VertexMesh2D.getVertexDeclaration(["POSITION,COLOR,UV"], false)[0];
                vertex.setDataLength(vbdata.buffer.byteLength);
                vertex.setData(vbdata.buffer, 0, 0, vbdata.buffer.byteLength);
                vbArray.push(vertex);
            }
            let indexBuffer = Laya.LayaGL.renderDeviceFactory.createIndexBuffer(Laya.BufferUsage.Dynamic);
            indexBuffer._setIndexDataLength(ib.buffer.byteLength);
            indexBuffer._setIndexData(ib, 0);
            mesh2d._setBuffers(vbArray, indexBuffer);
            let geometryArray = [];
            let geometry = Laya.LayaGL.renderDeviceFactory.createRenderGeometryElement(Laya.MeshTopology.Triangles, Laya.DrawType.DrawElement);
            geometry.bufferState = mesh2d._bufferState;
            geometry.setDrawElemenParams(ib.length, 0);
            geometry.indexFormat = ibFormat;
            geometryArray.push(geometry);
            mesh2d._setSubMeshes(geometryArray);
            mesh2d._vertices = [vbdata.buffer];
            mesh2d._indices = ib;
            mesh2d._vertexCount = vbdata.length / 9;
            if (canRead) {
                mesh2d._vertices = [vbdata.buffer];
                mesh2d._indices = ib;
            }
            return mesh2d;
        }
        static _createDebugMesh(navMesh, mesh = null, isGlobal = false) {
            let m_navMesh = navMesh.navMesh;
            let tileCount = m_navMesh.getMaxTiles();
            let poses = [];
            let indexs = [];
            if (isGlobal) {
                mat.identity();
            }
            else {
                let sprite = navMesh._surface.owner;
                sprite.globalTrans.getMatrix().copyTo(mat);
                mat.invert();
            }
            Laya.Vector3.subtract(navMesh.navTileGrid.max, navMesh.navTileGrid.min, tempVector3$2);
            for (var i = 0; i < tileCount; i++) {
                this._getTitleData(m_navMesh.getTile(i), poses, tempVector3$2, indexs);
            }
            let vb = new Float32Array(poses);
            let ib = new Uint16Array(indexs);
            if (mesh == null) {
                mesh = new Laya.Mesh2D();
                mesh.canRead = true;
            }
            this._updateMesh2DData(mesh, vb, ib, Laya.IndexFormat.UInt16);
            return mesh;
        }
    }
    Navgiation2DUtils._colorMap = new Map();
    Navgiation2DUtils._vec2ToVec3 = function (value, out) {
        out.setValue(value.x, 0, value.y);
    };

    let create2DObstacleData = function (slices, radiusOff = 0, radius = 1) {
        let vertexs = new Float32Array(slices * 3);
        const triCount = slices - 2;
        let flags = new Uint8Array(triCount);
        flags.fill(1);
        let ibs = [];
        for (var i = 2; i < slices; i++) {
            ibs.push(0, i, i - 1);
        }
        var sliceAngle = (Math.PI * 2.0) / slices;
        for (var i = 0; i < slices; i++) {
            let triIndex = i * 3;
            vertexs[triIndex] = radius * Math.cos(sliceAngle * i + radiusOff);
            vertexs[triIndex + 2] = radius * Math.sin(sliceAngle * i + radiusOff);
            vertexs[triIndex + 1] = 0;
        }
        let tileData = new Laya.NavTileCache();
        tileData.triVertex = vertexs;
        tileData.triIndex = new Uint32Array(ibs);
        tileData.triFlag = flags;
        tileData.boundMin.setValue(-radius, 0, -radius);
        tileData.boundMax.setValue(radius, 0, radius);
        return tileData;
    };
    exports.NavObstacles2DType = void 0;
    (function (NavObstacles2DType) {
        NavObstacles2DType[NavObstacles2DType["RECT"] = 0] = "RECT";
        NavObstacles2DType[NavObstacles2DType["CIRCLE"] = 1] = "CIRCLE";
        NavObstacles2DType[NavObstacles2DType["CUSTOMER"] = 2] = "CUSTOMER";
    })(exports.NavObstacles2DType || (exports.NavObstacles2DType = {}));
    class Navigation2DManage extends Laya.BaseNavigationManager {
        static _getNavManager(comp) {
            let scene = comp.owner.scene;
            if (scene) {
                return scene.getComponentElementManager(Navigation2DManage._managerName);
            }
            else {
                return null;
            }
        }
        static __initialize() {
            return Laya.BaseNavigationManager._initialize(() => {
                Navigation2DManage.__init__();
                Navgiation2DUtils.__init__();
            });
        }
        static __init__() {
            this._obstacleMap.set(exports.NavObstacles2DType.RECT, create2DObstacleData(4, Math.PI / 4, 1 / Math.sqrt(2)));
            this._obstacleMap.set(exports.NavObstacles2DType.CIRCLE, create2DObstacleData(60, 0));
        }
        static _getObstacleData(type) {
            return this._obstacleMap.get(type);
        }
        constructor() {
            super(Navigation2DManage._managerName);
        }
        _init() {
            super._init();
            let config = this.getNavConfig(Laya.NavigationConfig.defaltAgentName);
            config.cellSize = 2;
            config.tileSize = 256;
        }
    }
    Navigation2DManage._managerName = "navMesh2D";
    Navigation2DManage._obstacleMap = new Map();
    Laya.Scene.regManager(Navigation2DManage._managerName, Navigation2DManage);
    Laya.Laya.addInitCallback(Navigation2DManage.__initialize);

    const tempVector3$1 = new Laya.Vector3();
    class Nav2DAgent extends Laya.BaseNavAgent {
        get destination() {
            return this._destination;
        }
        set destination(value) {
            value.cloneTo(this._destination);
            Navgiation2DUtils._vec2ToVec3(this._destination, tempVector3$1);
            this._setTarget(tempVector3$1);
        }
        constructor() {
            super();
            this._destination = new Laya.Vector2();
            this._baseOffset = 0;
            this._radius = 10;
            this._speed = 100;
        }
        onAwake() {
            super.onAwake();
            this.owner.globalTrans.cache = true;
        }
        _getcollisionQueryRange() {
            return this._getradius() * 12;
        }
        _getpathOptimizationRange() {
            return this._getradius() * 300;
        }
        _getradius() {
            return this._radius * Math.max(this.owner.globalTrans.scaleX, this.owner.globalTrans.scaleY);
        }
        _getheight() {
            return 0.01;
        }
        _getpos(pos) {
            Navgiation2DUtils._getSpriteGlobalPos(this.owner, pos);
        }
        _getManager() {
            return Navigation2DManage._getNavManager(this);
        }
        _updatePosition(pos, dir) {
            this.owner.globalTrans.setPos(pos.x, pos.z);
        }
    }

    class NavMesh2D extends Laya.BaseNavMesh {
        constructor(config, min, max, surface) {
            super(config, min, max, surface, false);
            this._titileConfig._setMaxEdgeLen(1000);
        }
        _addTile(cache, binds, partitionType, maxSimplificationError) {
            const config = this._grid.config;
            config.cellHeight = 0.1;
            config.agentHeight = 0.3;
            config.agentMaxSlope = 45;
            config.agentMaxClimb = 0.3;
            super._addTile(cache, binds, partitionType, maxSimplificationError);
            if (this._debugMesh) {
                Navgiation2DUtils._createDebugMesh(this, this._debugMesh, true);
            }
        }
        buildDebugMesh() {
            if (this._debugMesh == null) {
                this._debugMesh = Navgiation2DUtils._createDebugMesh(this, this._debugMesh, true);
            }
            return this._debugMesh;
        }
    }

    class NavMesh2DSurface extends Laya.BaseNavMeshSurface {
        get areas() {
            return this._navMeshAreas;
        }
        set areas(value) {
            if (this._navMeshAreas.length > 0) {
                this._navMeshAreas.forEach((area) => {
                    area._destroy();
                });
            }
            this._navMeshAreas = value;
            if (this._navMesh) {
                this._navMeshAreas.forEach((area) => {
                    area._bindSurface(this);
                });
            }
        }
        get obstacles() {
            return this._navMeshObstacles;
        }
        set obstacles(value) {
            if (this._navMeshObstacles.length > 0) {
                this._navMeshObstacles.forEach((obstacle) => {
                    obstacle._destroy();
                });
            }
            this._navMeshObstacles = value;
            if (this._navMesh) {
                value.forEach((obstacle) => {
                    obstacle._bindSurface(this);
                });
            }
        }
        get navMeshLink() {
            return this._navMeshLink;
        }
        set navMeshLink(value) {
            if (this._navMeshLink.length > 0) {
                this._navMeshLink.forEach((link) => {
                    link.destroy();
                });
            }
            this._navMeshLink = value;
            if (this._navMesh) {
                value.forEach((link) => {
                    link._bindSurface(this);
                });
            }
        }
        constructor() {
            super();
            this._navMeshAreas = [];
            this._navMeshObstacles = [];
            this._navMeshLink = [];
            this._transfrom = new Laya.Matrix4x4();
        }
        onAwake() {
            super.onAwake();
            this.owner.globalTrans.cache = true;
            this._navMeshAreas.forEach((area) => {
                area._bindSurface(this);
            });
            this._navMeshObstacles.forEach((obstacle) => {
                obstacle._bindSurface(this);
            });
            this._navMeshLink.forEach((link) => {
                link._bindSurface(this);
            });
        }
        _onDestroy() {
            this._navMeshAreas.forEach(area => area._destroy());
            this._navMeshObstacles.forEach(obstacle => obstacle._destroy());
            this._navMeshLink.forEach(link => link.destroy());
            super._onDestroy();
        }
        _getManager() {
            return Navigation2DManage._getNavManager(this);
        }
        _crateNavMesh(config, min, max) {
            return new NavMesh2D(config, min, max, this);
        }
    }

    const tempVec2 = new Laya.Vector2();
    class NavMesh2DObstacles {
        get agentType() {
            return this._modifierData.agentType;
        }
        set agentType(value) {
            this._modifierData.agentType = value;
        }
        get areaFlag() {
            return this._modifierData.areaFlag;
        }
        set areaFlag(value) {
            this._modifierData.areaFlag = value;
        }
        get position() {
            return this._position;
        }
        set position(value) {
            value.cloneTo(this._position);
            this._transfromChange();
        }
        get rotation() {
            return this._rotation;
        }
        set rotation(value) {
            if (value == this._rotation)
                return;
            this._rotation = value;
            this._transfromChange();
        }
        get scale() {
            return this._scale;
        }
        set scale(value) {
            value.cloneTo(this._scale);
            this._transfromChange();
        }
        get datas() {
            if (this._oriTiles)
                return this._oriTiles._res;
            return null;
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
            this._transfromChange();
        }
        get meshType() {
            return this._meshType;
        }
        set meshType(value) {
            if (this._meshType == value)
                return;
            this._meshType = value;
            this._changeData();
        }
        get size() {
            return this._size;
        }
        set size(value) {
            value.cloneTo(this._size);
            this._transfromChange();
        }
        get radius() {
            return this._radius;
        }
        set radius(value) {
            this._radius = value;
            this._transfromChange();
        }
        constructor() {
            this._position = new Laya.Vector2();
            this._rotation = 0;
            this._scale = new Laya.Vector2(1, 1);
            this._size = new Laya.Vector2();
            this._radius = 50;
            this._meshType = exports.NavObstacles2DType.RECT;
            this._modifierData = new Laya.NavModifleData();
            this._changeData();
            this._transfromChange();
        }
        _bindSurface(surface) {
            this._modifierData._initSurface([surface]);
        }
        _destroy() {
            this._modifierData._destory();
        }
        _changeData() {
            switch (this._meshType) {
                case exports.NavObstacles2DType.RECT:
                    this._modifierData.datas = Navigation2DManage._getObstacleData(exports.NavObstacles2DType.RECT);
                    break;
                case exports.NavObstacles2DType.CIRCLE:
                    this._modifierData.datas = Navigation2DManage._getObstacleData(exports.NavObstacles2DType.CIRCLE);
                    break;
                case exports.NavObstacles2DType.CUSTOMER:
                    if (this._oriTiles) {
                        this._modifierData.datas = this._oriTiles.getNavData(0);
                    }
                    else {
                        this._modifierData.datas = null;
                    }
                    break;
                default:
                    console.error("NavMesh2DObstacles:meshType error");
                    break;
            }
        }
        _transfromChange() {
            this.scale.cloneTo(tempVec2);
            if (this._meshType == exports.NavObstacles2DType.RECT) {
                tempVec2.x *= this._size.x;
                tempVec2.y *= this._size.y;
            }
            else if (this._meshType == exports.NavObstacles2DType.CIRCLE) {
                tempVec2.x *= this._radius;
                tempVec2.y *= this._radius;
            }
            Navgiation2DUtils._getTransfromMatrix4x4(this._position, this._rotation, tempVec2, this._modifierData._transfrom);
            this._modifierData._transfrom.elements[5] = 0;
            this._modifierData._refeahTransfrom();
        }
    }

    const tempVec3 = new Laya.Vector3();
    class NavMesh2DLink {
        get agentType() {
            return this._agentType;
        }
        set agentType(value) {
            this._agentType = value;
        }
        get areaFlag() {
            return this._data.areaFlag;
        }
        set areaFlag(value) {
            this._data.areaFlag = value;
        }
        get width() {
            return this._data._width;
        }
        set width(value) {
            this._data._updateWidth(value);
        }
        get bidirectional() {
            return this._data._bidirectional;
        }
        set bidirectional(value) {
            this._data._updateBidirectional(value);
        }
        get start() {
            return this._start;
        }
        set start(value) {
            value.cloneTo(this._start);
            Navgiation2DUtils._vec2ToVec3(this._start, tempVec3);
            this._data._updateStartPoint(tempVec3);
        }
        get end() {
            return this._end;
        }
        set end(value) {
            value.cloneTo(this._end);
            Navgiation2DUtils._vec2ToVec3(this._end, tempVec3);
            this._data._updateEndPoint(tempVec3);
        }
        constructor() {
            this._start = new Laya.Vector2();
            this._end = new Laya.Vector2();
            this._data = new Laya.NavMeshLinkData();
            this.width = 10;
        }
        _bindSurface(surface) {
            this._data._initSurface([surface]);
        }
        destroy() {
            this._data.destroy();
        }
    }

    const tempVector3 = new Laya.Vector3();
    class NavMesh2DModifierArea {
        get agentType() {
            return this._areaData.agentType;
        }
        set agentType(value) {
            this._areaData.agentType = value;
        }
        get areaFlag() {
            return this._areaData.areaFlag;
        }
        set areaFlag(value) {
            this._areaData.areaFlag = value;
        }
        get datas() {
            return this._pointDatas;
        }
        set datas(value) {
            this._pointDatas = value;
            this._vector2dTo3d();
        }
        get position() {
            return this._position;
        }
        set position(value) {
            value.cloneTo(this._position);
            this._transfromChange();
        }
        get rotation() {
            return this._rotation;
        }
        set rotation(value) {
            if (value == this._rotation)
                return;
            this._rotation = value;
            this._transfromChange();
        }
        get scale() {
            return this._scale;
        }
        set scale(value) {
            value.cloneTo(this._scale);
            this._transfromChange();
        }
        constructor() {
            this._position = new Laya.Vector2();
            this._rotation = 0;
            this._scale = new Laya.Vector2(1, 1);
            this._pointDatas = [];
            this._areaData = new Laya.ModifierVolumeData();
        }
        _bindSurface(surface) {
            this._areaData._initSurface([surface]);
        }
        _destroy() {
            this._areaData._destory();
        }
        _vector2dTo3d() {
            let pointCount = this._pointDatas.length >> 1;
            let index = 0;
            let datas = this._areaData._datas;
            datas.length = pointCount * 3;
            for (var i = 0; i < pointCount; i++) {
                index = i * 2;
                Navgiation2DUtils._setValue3(this._pointDatas[index], this._pointDatas[index + 1], tempVector3);
                index = i * 3;
                datas[index] = tempVector3.x;
                datas[index + 1] = tempVector3.y;
                datas[index + 2] = tempVector3.z;
            }
            this._areaData._refeashData();
        }
        _transfromChange() {
            Navgiation2DUtils._getTransfromMatrix4x4(this._position, this._rotation, this._scale, this._areaData._transfrom);
            this._areaData._refeahTransfrom();
        }
    }

    let c = Laya.ClassUtils.regClass;
    c("Navgiation2DUtils", Navgiation2DUtils);
    c("NavigationManager", Navigation2DManage);
    c("Nav2DAgent", Nav2DAgent);
    c("NavMesh2D", NavMesh2D);
    c("NavMesh2DSurface", NavMesh2DSurface);
    c("NavMesh2DLink", NavMesh2DLink);
    c("NavMesh2DModifierArea", NavMesh2DModifierArea);
    c("NavMesh2DObstacles", NavMesh2DObstacles);

    exports.Nav2DAgent = Nav2DAgent;
    exports.NavMesh2D = NavMesh2D;
    exports.NavMesh2DLink = NavMesh2DLink;
    exports.NavMesh2DModifierArea = NavMesh2DModifierArea;
    exports.NavMesh2DObstacles = NavMesh2DObstacles;
    exports.NavMesh2DSurface = NavMesh2DSurface;
    exports.Navgiation2DUtils = Navgiation2DUtils;
    exports.Navigation2DManage = Navigation2DManage;

})(window.Laya = window.Laya || {}, Laya);
//# sourceMappingURL=laya.navMesh2d.js.map
