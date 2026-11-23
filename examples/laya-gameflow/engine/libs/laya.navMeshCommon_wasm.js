(function (exports, Laya) {
    'use strict';

    class AreaMask {
        get excludeflag() {
            return this._excludeflag;
        }
        get flag() {
            return this._flags;
        }
        set flag(value) {
            this._flags = value;
            this._calculFlagVale();
        }
        constructor() {
            this._flags = 7;
        }
        _setAreaMap(areaFlagMap) {
            this._areaFlagMap = areaFlagMap;
            this._calculFlagVale();
        }
        _calculFlagVale() {
            if (!this._areaFlagMap)
                return;
            let flag = 0;
            let excludeflag = 0;
            this._areaFlagMap.forEach((value, key) => {
                if (this._flags & value.flag) {
                    flag = flag | value.flag;
                }
                else {
                    excludeflag = excludeflag | value.flag;
                }
            });
            this._flags = flag;
            this._excludeflag = excludeflag;
        }
    }

    class NavMeshGrid {
        get tileWidth() {
            return this._config.tileSize * this._config.cellSize;
        }
        get max() {
            return this._max;
        }
        get min() {
            return this._min;
        }
        get config() {
            return this._config;
        }
        get maxtiles() {
            return this.maxXTileCount * this.maxZTileCount;
        }
        get maxXTileCount() {
            return this._tileSize.x;
        }
        get maxZTileCount() {
            return this._tileSize.y;
        }
        constructor(config, min, max) {
            this._bordWidth = 0;
            this._config = config;
            this._min = min;
            this._max = max;
            this._tileSize = new Laya.Vector2();
            this._cellSize = new Laya.Vector2();
            this._updateBound();
        }
        _refeashBound(tile) {
            tile._boundMin.cloneTo(this._min);
            tile._boundMax.cloneTo(this._max);
            this._updateBound();
        }
        getBoundTileIndex(min, max, isbord = false) {
            let pMinx = min.x;
            let pMinz = min.z;
            let pMaxx = max.x;
            let pMaxz = max.z;
            if (isbord) {
                pMinx -= this._bordWidth;
                pMinz -= this._bordWidth;
                pMaxx += this._bordWidth;
                pMaxz += this._bordWidth;
            }
            let lists = [];
            let minIx = Math.max(0, this._getTileXIndex(pMinx));
            let maxIx = Math.min(this._tileSize.x - 1, this._getTileXIndex(pMaxx));
            let minIz = Math.max(0, this._getTileZIndex(pMinz));
            let maxIz = Math.min(this._tileSize.y - 1, this._getTileZIndex(pMaxz));
            for (var z = minIz; z <= maxIz; z++) {
                for (var x = minIx; x <= maxIx; x++) {
                    lists.push(z * this._tileSize.x + x);
                }
            }
            return lists;
        }
        getTileIndexByPos(x, z) {
            return this.getTileIndex(this._getTileXIndex(x), this._getTileZIndex(z));
        }
        getTileIndex(xIndex, zIndex) {
            if (zIndex < 0 || zIndex >= this._tileSize.y) {
                return -1;
            }
            if (xIndex < 0 || xIndex >= this._tileSize.x) {
                return -1;
            }
            return zIndex * this._tileSize.x + xIndex;
        }
        _getTileXIndex(value) {
            return this._getLeftValue(value - this._min.x);
        }
        _getTileZIndex(value) {
            return this._getLeftValue(value - this._min.z);
        }
        _getLeftValue(value) {
            return Math.floor(value / this.tileWidth);
        }
        _updateBound() {
            this._bordWidth = this._config.cellSize * 3;
            const max = this._max;
            const min = this._min;
            const tileWidth = this._config.cellSize * this._config.tileSize;
            this._tileSize.x = Math.ceil((max.x - min.x) / tileWidth);
            this._tileSize.y = Math.ceil((max.z - min.z) / tileWidth);
            const cellSize = this._config.cellSize;
            this._cellSize.x = Math.ceil((max.x - min.x) / cellSize);
            this._cellSize.x = Math.ceil((max.z - min.z) / cellSize);
        }
    }

    class NavigationPathData {
        get pos() {
            return this._pos;
        }
        get flag() {
            return this._flag;
        }
        constructor() {
            this._flag = 0;
            this._pos = new Laya.Vector3();
        }
    }

    const tempVec3$2 = new Laya.Vector3();
    const tempVec31 = new Laya.Vector3();
    const tempVec32 = new Laya.Vector3();
    const tempVec33 = new Laya.Vector3();
    class NavigationUtils {
        static _boundContentPoint(min, max, point) {
            if (point.x > max.x || point.x < min.x)
                return false;
            if (point.y > max.y || point.y < min.y)
                return false;
            if (point.z > max.z || point.z < min.z)
                return false;
            return true;
        }
        static _boundInterection(min1, max1, min2, max2) {
            var tempV0 = tempVec3$2;
            var tempV1 = tempVec31;
            var thisExtends = tempVec32;
            Laya.Vector3.subtract(max1, min1, thisExtends);
            Laya.Vector3.scale(thisExtends, 0.5, thisExtends);
            var boundExtends = tempVec33;
            Laya.Vector3.subtract(max2, min2, boundExtends);
            Laya.Vector3.scale(boundExtends, 0.5, boundExtends);
            tempV0.setValue(Math.max(max1.x, max2.x) - Math.min(min1.x, min2.x), Math.max(max1.y, max2.y) - Math.min(min1.y, min2.y), Math.max(max1.z, max2.z) - Math.min(min1.z, min2.z));
            tempV1.setValue((thisExtends.x + boundExtends.x) * 2.0, (thisExtends.y + boundExtends.y) * 2.0, (thisExtends.z + boundExtends.z) * 2.0);
            if ((tempV0.x) > (tempV1.x))
                return -1;
            if ((tempV0.y) > (tempV1.y))
                return -1;
            if ((tempV0.z) > (tempV1.z))
                return -1;
            return (tempV1.x - tempV0.x) * (tempV1.y - tempV0.y) * (tempV1.z - tempV0.z);
        }
        static _setDatastoArray(fllowPath, index, data, flag) {
            let navData = fllowPath[index] ? fllowPath[index] : new NavigationPathData();
            navData.pos.fromArray(data);
            navData._flag = flag;
            fllowPath[index] = navData;
        }
        static _inRange(v1, v2, radius, height, offIndex) {
            const dx = v2[0] - v1[offIndex];
            const dy = v2[1] - v1[offIndex + 1];
            const dz = v2[2] - v1[offIndex + 2];
            return (dx * dx + dz * dz) < radius * radius && Math.abs(dy) < height;
        }
        static _transfromBoundBox(min, max, transfrom, outMin, outMax) {
            const center = tempVec3$2;
            Laya.Vector3.lerp(min, max, 0.5, center);
            const extent = tempVec31;
            Laya.Vector3.subtract(max, min, extent);
            Laya.Vector3.scale(extent, 0.5, extent);
            Laya.Vector3.transformCoordinate(center, transfrom, center);
            Laya.Vector3.TransformNormal(extent, transfrom, extent);
            Laya.Vector3.subtract(center, extent, outMin);
            Laya.Vector3.add(center, extent, outMax);
        }
        static _isFlags(data, flag) {
            return data & flag.value;
        }
        static _addVector3ToArray(vec1, vec2, scale) {
            let dest = [];
            dest[0] = vec1.x + vec2.x * scale;
            dest[1] = vec1.y + vec2.y * scale;
            dest[2] = vec1.z + vec2.z * scale;
            return dest;
        }
        static _getSteerTarget(navMesh, startRef, endRef, minTargetDist, paths, pathSize, out) {
            const navQuery = navMesh.navQuery;
            let data = navQuery.findStraightPath(startRef, endRef, paths, pathSize, 3);
            let steerPath = data.steerPath;
            let steerPathFlags = data.steerPathFlags;
            let steerPathPolys = data.steerPathPolys;
            let nsteerPath = data.nsteerPath;
            if (!nsteerPath) {
                return null;
            }
            let ns = 0;
            while (ns < nsteerPath) {
                if (this._isFlags(steerPathFlags[ns], this._recast.dtStraightPathFlags.DT_STRAIGHTPATH_OFFMESH_CONNECTION) ||
                    !this._inRange(steerPath, startRef, minTargetDist, 1000, ns * 3))
                    break;
                ns++;
            }
            if (ns >= nsteerPath)
                return null;
            out.fromArray(steerPath, ns * 3);
            return {
                steerPosFlag: steerPathFlags[ns],
                steerPosRef: steerPathPolys[ns]
            };
        }
        static _dtMergeCorridorStartMoved(path, npath, maxPath, visited, nvisited) {
            let furthestPath = -1;
            let furthestVisited = -1;
            for (var i = npath - 1; i >= 0; i--) {
                let found = false;
                for (let j = nvisited - 1; j >= 0; --j) {
                    if (path[i] == visited[j]) {
                        furthestPath = i;
                        furthestVisited = j;
                        found = true;
                    }
                }
                if (found)
                    break;
            }
            if (furthestPath == -1 || furthestVisited == -1)
                return npath;
            const req = nvisited - furthestVisited;
            const orig = Math.min(furthestPath + 1, npath);
            let size = Math.max(0, npath - orig);
            if (req + size > maxPath)
                size = maxPath - req;
            for (let i = 0; i < req; ++i)
                path[i] = visited[(nvisited - 1) - i];
            return req + size;
        }
        static _findFllowPath(navMesh, filter, startPos, endPos, steplength, minTarget, fllowPath) {
            const navQuery = navMesh.navQuery;
            const namesh = navMesh.navMesh;
            const startRef = navQuery.findNearestPoly(startPos.toArray(), navMesh.extents, filter);
            const endRef = navQuery.findNearestPoly(endPos.toArray(), navMesh.extents, filter);
            let pathdata = navQuery.findPath(startRef, endRef, filter, NavigationUtils._MAX_POLYS);
            let polys = pathdata.polys;
            let m_npolys = polys.length;
            let m_nsmoothPath = 0;
            let steerPos = new Laya.Vector3();
            let help1 = new Laya.Vector3();
            let help2 = new Laya.Vector3();
            if (polys.length > 0) {
                let npolys = m_npolys;
                let iterPos = navQuery.closestPointOnPolyByRefPointData(startRef);
                let targetPos = navQuery.closestPointOnPoly(polys[npolys - 1], endRef.data);
                this._setDatastoArray(fllowPath, m_nsmoothPath, iterPos, this._recast.dtStraightPathFlags.DT_STRAIGHTPATH_START.value);
                m_nsmoothPath++;
                while (npolys && m_nsmoothPath < NavigationUtils._MAX_SMOOTH) {
                    let steerData = this._getSteerTarget(navMesh, iterPos, targetPos, minTarget, polys, npolys, steerPos);
                    if (steerData == null) {
                        break;
                    }
                    help1.fromArray(iterPos);
                    let steerPosFlag = steerData.steerPosFlag;
                    let steerPosRef = steerData.steerPosRef;
                    let endOfPath = this._isFlags(steerPosFlag, this._recast.dtStraightPathFlags.DT_STRAIGHTPATH_END) ? true : false;
                    let offMeshConnection = this._isFlags(steerPosFlag, this._recast.dtStraightPathFlags.DT_STRAIGHTPATH_OFFMESH_CONNECTION) ? true : false;
                    Laya.Vector3.subtract(steerPos, help1, help2);
                    let len = help2.length();
                    if ((endOfPath || offMeshConnection) && len < steplength)
                        len = 1;
                    else
                        len = steplength / len;
                    let moveTgt = this._addVector3ToArray(help1, help2, len);
                    let surfacedata = navQuery.moveAlongSurface(polys[0], iterPos, moveTgt, filter, 16);
                    let result = surfacedata.resultPos;
                    let visited = surfacedata.visited;
                    polys = this._recast.mergeCorridorStartMoved(polys, NavigationUtils._MAX_POLYS, Array.from(visited));
                    polys = this._recast.fixupShortcuts(polys, navQuery);
                    npolys = polys.length;
                    let heightData = navQuery.getPolyHeight(polys[0], result);
                    result[1] = heightData.height;
                    iterPos = result;
                    let isRange = this._inRange(iterPos, steerPos.toArray(), minTarget, 1.0, 0);
                    if (endOfPath && isRange) {
                        iterPos = targetPos;
                        if (m_nsmoothPath < NavigationUtils._MAX_SMOOTH) {
                            this._setDatastoArray(fllowPath, m_nsmoothPath, iterPos, this._recast.dtStraightPathFlags.DT_STRAIGHTPATH_END.value);
                            m_nsmoothPath++;
                        }
                        break;
                    }
                    else if (offMeshConnection && isRange) {
                        let startPos = [0, 0, 0];
                        let endPos = [0, 0, 0];
                        let prevRef = 0, polyRef = polys[0];
                        let npos = 0;
                        while (npos < npolys && polyRef != steerPosRef) {
                            prevRef = polyRef;
                            polyRef = polys[npos];
                            npos++;
                        }
                        for (let i = npos; i < npolys; ++i) {
                            polys[i - npos] = polys[i];
                        }
                        npolys -= npos;
                        let status = namesh.getOffMeshConnectionPolyEndPoints(prevRef, polyRef, startPos, endPos);
                        if (this._statusSucceed(status)) {
                            if (m_nsmoothPath < NavigationUtils._MAX_SMOOTH) {
                                this._setDatastoArray(fllowPath, m_nsmoothPath, startPos, steerPosFlag);
                                m_nsmoothPath++;
                                if (m_nsmoothPath & 1) {
                                    this._setDatastoArray(fllowPath, m_nsmoothPath, startPos, steerPosFlag);
                                    m_nsmoothPath++;
                                }
                            }
                            iterPos = endPos;
                            heightData = navQuery.getPolyHeight(polys[0], iterPos);
                            iterPos[1] = heightData.height;
                        }
                    }
                    if (m_nsmoothPath < NavigationUtils._MAX_SMOOTH) {
                        this._setDatastoArray(fllowPath, m_nsmoothPath, iterPos, steerPosFlag);
                        m_nsmoothPath++;
                    }
                }
            }
            fllowPath.length = m_nsmoothPath;
        }
        static _initialize(Recast) {
            NavigationUtils._recast = Recast;
            NavigationUtils._dtCrowdAgentParams = new Recast.dtCrowdAgentParams();
            NavigationUtils._TemprefPoint = {};
            NavigationUtils._TemprefPoint1 = {};
        }
        static _getRecast() {
            return NavigationUtils._recast;
        }
        static _createNavMesh() {
            return new this._recast.dtNavMesh();
        }
        static _createNavMeshQuery() {
            return new this._recast.dtNavMeshQuery();
        }
        static _createRefPointData() {
            return new this._recast.dtRefPointData();
        }
        static _createMeshOffLink() {
            return new this._recast.dtOffMeshConnection();
        }
        static _createConvexVolume() {
            return new this._recast.dtConvexVolume();
        }
        static _createQueryFilter() {
            return new this._recast.dtQueryFilter();
        }
        static _createCrowd() {
            return new this._recast.dtCrowd();
        }
        static _createdtNavTileData() {
            return new this._recast.dtNavTileData();
        }
        static _createdtNavTileCache() {
            return new this._recast.dtNavTileCache();
        }
        static _getCrowdAgentParams() {
            return this._dtCrowdAgentParams;
        }
        static _freeNavMeshQuery(data) {
            this._recast.dtFreeNavMeshQuery(data);
        }
        static _freeNavMesh(data) {
            this._recast.dtFreeNavMesh(data);
        }
        static _freeCrowd(data) {
            this._recast.dtFreeCrowd(data);
        }
        static _free(data) {
            data.delete();
        }
        static _freeLayaData(data) {
            data.delete();
        }
        static _statusSucceed(data) {
            return this._recast.dtStatusSucceed(data);
        }
        static _updateCrowd(crowd, dt) {
            return this._recast.updateCrowd(crowd, dt);
        }
    }
    NavigationUtils._MAX_SMOOTH = 2048;
    NavigationUtils._MAX_POLYS = 256;
    NavigationUtils._TitleMeshIbOff = [0, 2, 1];

    class TitleConfig {
        constructor() {
            this.tx = 0;
            this.ty = 0;
            this.maxSimplificationError = 0.9;
            this.bmin = [0, 0, 0];
            this.bmax = [0, 0, 0];
        }
        _setOff(tx, ty) {
            this.tx = tx;
            this.ty = ty;
        }
        _setMin(value) {
            this.bmin[0] = value.x;
            this.bmin[1] = value.y;
            this.bmin[2] = value.z;
        }
        _setMax(value) {
            this.bmax[0] = value.x;
            this.bmax[1] = value.y;
            this.bmax[2] = value.z;
        }
        _setAgent(height, radius, maxClimb) {
            this.agentHeight = height;
            this.agentRadius = radius;
            this.agentMaxClimb = maxClimb;
        }
        _setMaxEdgeLen(value) {
            this.maxEdgeLen = Math.ceil(value);
        }
    }

    const CROW_MAX_FILTER = 16;
    const tempVec3$1 = new Laya.Vector3();
    class BaseNavMesh {
        get extents() {
            return this._extents;
        }
        get navMesh() {
            return this._navMesh;
        }
        get navQuery() {
            return this._navQuery;
        }
        get crowd() {
            return this._crowd;
        }
        get navTileGrid() {
            return this._grid;
        }
        get is3D() {
            return this._is3D;
        }
        constructor(config, min, max, surface, is3D = true) {
            this._extents = [2, 4, 2];
            this._maxAgents = 128;
            this._is3D = true;
            this._grid = new NavMeshGrid(config, min, max);
            this._surface = surface;
            this._is3D = is3D;
            this._titileConfig = new TitleConfig();
            this._navcreateedTileMaps = new Set();
            this._delayCreates = new Map();
            this._allAgents = new Map();
            this._fiterMap = new Map();
            this._creatNavMesh();
        }
        _getFilter(areaMask) {
            var _a;
            let excludeflag = areaMask.excludeflag;
            if (this._fiterMap.has(excludeflag)) {
                return this._fiterMap.get(excludeflag);
            }
            const used = new Set([(_a = this._defatfilter) === null || _a === void 0 ? void 0 : _a.queryFilterType]);
            this._allAgents.forEach(agent => used.add(agent._filter.queryFilterType));
            let size = 0;
            while (size < CROW_MAX_FILTER && used.has(size))
                size++;
            if (size >= CROW_MAX_FILTER)
                return null;
            this._fiterMap.forEach((filter, key) => {
                if (filter.queryFilterType === size)
                    this._fiterMap.delete(key);
            });
            let fiter = this._crowd.getFilter(size);
            fiter.setIncludeFlags(areaMask.flag >>> 1);
            fiter.setExcludeFlags(excludeflag >>> 1);
            fiter.queryFilterType = size;
            this._fiterMap.set(excludeflag, fiter);
            return fiter;
        }
        _createAgents(agent) {
            agent._filter = this._getFilter(agent._areaMask);
            if (!agent._filter)
                return;
            let params = NavigationUtils._getCrowdAgentParams();
            params.radius = agent._getradius();
            params.collisionQueryRange = agent._getcollisionQueryRange();
            params.pathOptimizationRange = agent._getpathOptimizationRange();
            params.height = agent._getheight();
            params.maxAcceleration = agent.maxAcceleration;
            params.maxSpeed = agent.speed;
            params.obstacleAvoidanceType = agent.quality;
            params.separationWeight = agent.priority;
            params.queryFilterType = agent._filter.queryFilterType;
            params.updateFlags = agent._getUpdateFlags();
            agent._getpos(tempVec3$1);
            let refPoint = this._navQuery.findNearestPoly(tempVec3$1.toArray(), this._extents, agent._filter);
            if (!refPoint.polyRef)
                return;
            const id = this._crowd.addAgent(refPoint.data, params);
            if (id < 0)
                return;
            agent._agentId = id;
            agent._crowAgent = this._crowd.getAgent(agent._agentId);
            this._allAgents.set(agent._agentId, agent);
        }
        _addAgent(agent) {
            if (agent._crowAgent)
                return;
            agent._getpos(tempVec3$1);
            let tileIndex = this._grid.getTileIndexByPos(tempVec3$1.x, tempVec3$1.z);
            if (this._navcreateedTileMaps.has(tileIndex)) {
                this._createAgents(agent);
            }
            else {
                if (!this._delayCreates.has(tileIndex)) {
                    this._delayCreates.set(tileIndex, []);
                }
                const pending = this._delayCreates.get(tileIndex);
                if (!pending.includes(agent))
                    pending.push(agent);
            }
        }
        _removeAgent(agent) {
            if (agent._agentId == null) {
                agent._getpos(tempVec3$1);
                let tileIndex = this._grid.getTileIndexByPos(tempVec3$1.x, tempVec3$1.z);
                if (this._delayCreates.has(tileIndex)) {
                    let lists = this._delayCreates.get(tileIndex);
                    let index = lists.indexOf(agent);
                    if (index >= 0) {
                        lists.splice(index, 1);
                    }
                }
            }
            else {
                this._crowd.removeAgent(agent._agentId);
                this._allAgents.delete(agent._agentId);
                agent._agentId = null;
                agent._crowAgent = null;
            }
        }
        _getPolyFlags(pos, fiter = null) {
            const polyRef = this._findNearestPoly(pos, fiter, tempVec3$1);
            return this._navMesh.getPolyFlags(polyRef);
        }
        _getPolyArea(pos, fiter = null) {
            const polyRef = this._findNearestPoly(pos, fiter, tempVec3$1);
            return this._navMesh.getPolyArea(polyRef);
        }
        _findNearestPoly(pos, fiter = null, out) {
            if (!fiter)
                fiter = this._defatfilter;
            let poly = this._navQuery.findNearestPoly(pos.toArray(), this.extents, fiter);
            out.fromArray(poly.data);
            return poly.polyRef;
        }
        _findFllowPath(fllowPaths, startPos, endPos, speed, filter = null) {
            if (!filter)
                filter = this._defatfilter;
            let tileIndex = this._grid.getTileIndexByPos(startPos.x, startPos.z);
            if (this._navcreateedTileMaps.has(tileIndex)) {
                const step = speed > 0 ? speed * 0.1 : this._grid.config.cellSize;
                NavigationUtils._findFllowPath(this, filter, startPos, endPos, step, 0.01, fllowPaths);
                return fllowPaths.length > 0;
            }
            else {
                fllowPaths.length = 0;
                return false;
            }
        }
        _findDistanceToWall(pos, filter = null) {
            if (!filter)
                filter = this._defatfilter;
            let posref = this._navQuery.findNearestPoly(pos.toArray(), this.extents, filter);
            let data = this._navQuery.findDistanceToWall(posref, filter, 100);
            if (NavigationUtils._statusSucceed(data.Status))
                return data;
            else
                return null;
        }
        _requestMoveTarget(agent, destination) {
            if (agent._agentId == null || !agent._crowAgent)
                return false;
            agent._getpos(tempVec3$1);
            let tileIndex = this._grid.getTileIndexByPos(tempVec3$1.x, tempVec3$1.z);
            if (this._navcreateedTileMaps.has(tileIndex)) {
                let refPoint = this._navQuery.findNearestPoly(destination.toArray(), this._extents, agent._filter);
                if (!refPoint.polyRef)
                    return false;
                this.crowd.requestMoveTarget(agent._agentId, refPoint);
                return true;
            }
            else {
                return false;
            }
        }
        _creatNavMesh() {
            this._navMesh = NavigationUtils._createNavMesh();
            this._navQuery = NavigationUtils._createNavMeshQuery();
            this._crowd = NavigationUtils._createCrowd();
            this._navMeshLink = NavigationUtils._createMeshOffLink();
            this._navConvexVolume = NavigationUtils._createConvexVolume();
            let surface = this._surface;
            let manager = surface._manager;
            for (var i = 0; i < CROW_MAX_FILTER; i++) {
                manager.setFilterCost(this._crowd.getFilter(i));
            }
            this._defatfilter = this._getFilter(manager._deflatAllMask);
            this._navConvexVolume.setIs3D(this._is3D);
        }
        _navMeshInit() {
            let config = this._grid.config;
            let min = this._grid.min;
            let max = this._grid.max;
            this._navMesh.init(min.toArray(), max.toArray(), config.cellSize, config.tileSize);
            this._navQuery.init(this._navMesh, 2048);
            this._crowd.init(this._maxAgents, config.agentRadius, this.navMesh);
        }
        _updateNavMesh(dt) {
            for (const agent of Array.from(this._allAgents.values()))
                agent._updateBraking(dt);
            let datas = NavigationUtils._updateCrowd(this._crowd, dt);
            this._allAgents.forEach((agent, index) => {
                let off = agent._agentId * 6;
                let pos = [datas[off], datas[off + 1], datas[off + 2]];
                let vel = [datas[off + 3], datas[off + 4], datas[off + 5]];
                agent._updateNavMesh(pos, vel);
            });
        }
        _addNavMeshLink(index, start, end, width, bidirectional, areaFlag) {
            this._navMeshLink.addOffMeshConnection(index, start.toArray(), end.toArray(), width, bidirectional ? 1 : 0, areaFlag);
        }
        _removeNavMeshLink(index) {
            this._navMeshLink.deleteOffMeshConnection(index);
        }
        _updateConvexVolume(index, buffer, miny, maxy, areaType) {
            this._navConvexVolume.addCovexVoume(index, buffer, miny, maxy, areaType);
            return true;
        }
        _deleteConvexVoume(index) {
            if (index < 0)
                return false;
            this._navConvexVolume.deleteCovexVoume(index);
            return true;
        }
        _addTile(cache, binds, partitionType, maxSimplificationError) {
            if (binds.length <= 0)
                return;
            const config = this._grid.config;
            this._titileConfig.partitionType = partitionType;
            this._titileConfig._setAgent(config.agentHeight, config.agentRadius, config.agentMaxClimb);
            this._titileConfig._setOff(cache.x, cache.y);
            this._titileConfig._setMin(cache.boundMin);
            this._titileConfig._setMax(cache.boundMax);
            this._titileConfig.maxSimplificationError = maxSimplificationError;
            this._removeTile(cache.x, cache.y);
            const ptrs = binds.map(value => value.$$.ptr);
            this._navMesh.addTile(config, this._titileConfig, ptrs, this._navMeshLink, this._navConvexVolume);
            const tileIndex = this._grid.getTileIndex(cache.x, cache.y);
            this._navcreateedTileMaps.add(tileIndex);
            if (this._delayCreates.has(tileIndex)) {
                const delaylists = this._delayCreates.get(tileIndex);
                delaylists.forEach((nav) => {
                    this._createAgents(nav);
                });
                this._delayCreates.delete(tileIndex);
            }
        }
        _removeTile(tileX, tileY) {
            this._navMesh.removeTile(tileX, tileY);
            this._navcreateedTileMaps.delete(this._grid.getTileIndex(tileX, tileY));
        }
        _clearn() {
            this._allAgents.forEach((agent) => {
                agent._removeAgent();
            });
            this._allAgents.clear();
            this._delayCreates.forEach(agents => [...agents].forEach(agent => agent._removeAgent()));
            this._delayCreates.clear();
        }
        _destroy() {
            this._clearn();
            if (this._navMesh) {
                NavigationUtils._freeNavMesh(this._navMesh);
                this._navMesh = null;
            }
            if (this._navQuery) {
                NavigationUtils._freeNavMeshQuery(this._navQuery);
                this._navQuery = null;
            }
            if (this._navMeshLink) {
                NavigationUtils._free(this._navMeshLink);
                this._navMeshLink = null;
            }
            if (this._navConvexVolume) {
                NavigationUtils._free(this._navConvexVolume);
                this._navConvexVolume = null;
            }
            if (this._crowd) {
                NavigationUtils._freeCrowd(this._crowd);
                this._crowd = null;
            }
        }
    }

    class RecastConfig {
        set cellSize(value) {
            this._cellSize = value;
            this._dirtyFlag++;
        }
        get cellSize() {
            return this._cellSize;
        }
        constructor() {
            this._dirtyFlag = 0;
            this._cellSize = 0.2;
            this.cellHeight = 0.3;
            this.agentMaxSlope = 45;
            this.agentHeight = 2;
            this.agentMaxClimb = 0.3;
            this.agentRadius = 0.2;
            this.tileSize = 32;
        }
        clone() {
            let data = new RecastConfig();
            this.cloneTo(data);
            return data;
        }
        cloneTo(destObject) {
            destObject.agentName = this.agentName;
            destObject.cellSize = this.cellSize;
            destObject.cellHeight = this.cellHeight;
            destObject.agentMaxSlope = this.agentMaxSlope;
            destObject.agentHeight = this.agentHeight;
            destObject.agentMaxClimb = this.agentMaxClimb;
            destObject.agentRadius = this.agentRadius;
            destObject.tileSize = this.tileSize;
        }
    }

    exports.PartitionType = void 0;
    (function (PartitionType) {
        PartitionType[PartitionType["PARTITION_WATERSHED"] = 0] = "PARTITION_WATERSHED";
        PartitionType[PartitionType["PARTITION_MONOTONE"] = 1] = "PARTITION_MONOTONE";
        PartitionType[PartitionType["PARTITION_LAYERS"] = 2] = "PARTITION_LAYERS";
    })(exports.PartitionType || (exports.PartitionType = {}));
    exports.UpdateFlags = void 0;
    (function (UpdateFlags) {
        UpdateFlags[UpdateFlags["DT_CROWD_ANTICIPATE_TURNS"] = 1] = "DT_CROWD_ANTICIPATE_TURNS";
        UpdateFlags[UpdateFlags["DT_CROWD_OBSTACLE_AVOIDANCE"] = 2] = "DT_CROWD_OBSTACLE_AVOIDANCE";
        UpdateFlags[UpdateFlags["DT_CROWD_SEPARATION"] = 4] = "DT_CROWD_SEPARATION";
        UpdateFlags[UpdateFlags["DT_CROWD_OPTIMIZE_VIS"] = 8] = "DT_CROWD_OPTIMIZE_VIS";
        UpdateFlags[UpdateFlags["DT_CROWD_OPTIMIZE_TOPO"] = 16] = "DT_CROWD_OPTIMIZE_TOPO";
    })(exports.UpdateFlags || (exports.UpdateFlags = {}));
    exports.CrowdAgentState = void 0;
    (function (CrowdAgentState) {
        CrowdAgentState[CrowdAgentState["DT_CROWDAGENT_STATE_INVALID"] = 0] = "DT_CROWDAGENT_STATE_INVALID";
        CrowdAgentState[CrowdAgentState["DT_CROWDAGENT_STATE_WALKING"] = 1] = "DT_CROWDAGENT_STATE_WALKING";
        CrowdAgentState[CrowdAgentState["DT_CROWDAGENT_STATE_OFFMESH"] = 2] = "DT_CROWDAGENT_STATE_OFFMESH";
    })(exports.CrowdAgentState || (exports.CrowdAgentState = {}));
    exports.ObstacleAvoidanceType = void 0;
    (function (ObstacleAvoidanceType) {
        ObstacleAvoidanceType[ObstacleAvoidanceType["NoObstacle"] = 0] = "NoObstacle";
        ObstacleAvoidanceType[ObstacleAvoidanceType["LowQuality"] = 1] = "LowQuality";
        ObstacleAvoidanceType[ObstacleAvoidanceType["MedQuality"] = 2] = "MedQuality";
        ObstacleAvoidanceType[ObstacleAvoidanceType["GoodQuality"] = 3] = "GoodQuality";
        ObstacleAvoidanceType[ObstacleAvoidanceType["HighQuality"] = 4] = "HighQuality";
    })(exports.ObstacleAvoidanceType || (exports.ObstacleAvoidanceType = {}));
    exports.NavigationConfig = void 0;
    (function (NavigationConfig) {
        NavigationConfig["defaltAgentName"] = "humanoid";
        NavigationConfig["defaltUnWalk"] = "unwalk";
        NavigationConfig["defaltWalk"] = "walk";
        NavigationConfig["defaltJump"] = "jump";
    })(exports.NavigationConfig || (exports.NavigationConfig = {}));
    class NavAreaFlag {
        get flag() {
            return 1 << this.index;
        }
    }

    const readNavTileCache = function (byte, navData) {
        navData._dirtyFlag = byte.readFloat32();
        const min = navData._boundMin;
        min.x = byte.readFloat32();
        min.y = byte.readFloat32();
        min.z = byte.readFloat32();
        const max = navData._boundMax;
        max.x = byte.readFloat32();
        max.y = byte.readFloat32();
        max.z = byte.readFloat32();
        let navCount = byte.readUint16();
        for (var i = 0; i < navCount; i++) {
            let nav = navData._oriTiles[i] = new NavTileCache();
            const min = nav._boundMin;
            min.x = byte.readFloat32();
            min.y = byte.readFloat32();
            min.z = byte.readFloat32();
            const max = nav._boundMax;
            max.x = byte.readFloat32();
            max.y = byte.readFloat32();
            max.z = byte.readFloat32();
            nav.x = byte.readUint16();
            nav.y = byte.readUint16();
            let vertStart = byte.readUint32();
            let vertCount = byte.readUint32();
            let indexStart = byte.readUint32();
            let indexCount = byte.readUint32();
            let flagStart = byte.readUint32();
            let flagCount = byte.readUint32();
            byte.pos = vertStart;
            nav.triVertex = new Float32Array(byte.readArrayBuffer(vertCount));
            byte.pos = indexStart;
            nav.triIndex = new Uint32Array(byte.readArrayBuffer(indexCount));
            byte.pos = flagStart;
            nav.triFlag = new Uint8Array(byte.readArrayBuffer(flagCount));
        }
    };
    class NavTileCache {
        constructor() {
            this._bindData = NavigationUtils._createdtNavTileData();
            this._boundMax = new Laya.Vector3();
            this._boundMin = new Laya.Vector3();
            this.x = this.y = 0;
        }
        set triVertex(data) {
            this._triVertex = data;
            this._bindData.setTriVertex(data);
        }
        get triVertex() {
            return this._triVertex;
        }
        set triIndex(data) {
            this._triIndex = data;
            this._bindData.setTriIndex(data);
        }
        get triIndex() {
            return this._triIndex;
        }
        set triFlag(data) {
            this._triFlag = data;
            this._bindData.setTriFlag(data);
        }
        get triFlag() {
            return this._triFlag;
        }
        get boundMin() {
            return this._boundMin;
        }
        get boundMax() {
            return this._boundMax;
        }
        get bindData() {
            return this._bindData;
        }
        destroy() {
            if (this._bindData) {
                NavigationUtils._free(this._bindData);
                this._bindData = null;
            }
        }
    }
    class NavTileData {
        constructor(res) {
            this._dirtyFlag = 0;
            this._boundMax = new Laya.Vector3();
            this._boundMin = new Laya.Vector3();
            this._res = res;
            this._oriTiles = [];
            this._parse();
        }
        _parse() {
            var readData = new Laya.Byte(this._res.data);
            readData.pos = 0;
            var version = readData.readUTFString();
            switch (version) {
                case "LAYANAV:0101":
                    readNavTileCache(readData, this);
                    break;
            }
        }
        get dirtyFlag() {
            return this._dirtyFlag;
        }
        getNavData(index) {
            return this._oriTiles[index];
        }
        get length() {
            return this._oriTiles.length;
        }
        destroy() {
            this._oriTiles.forEach(element => {
                element.destroy();
            });
            this._oriTiles = null;
            this._res = null;
        }
    }

    const helpTempSet = new Set();
    class CacheData {
        constructor(surface) {
            this._cacheflag = 0;
            this._transfrom = new Laya.Matrix4x4();
            this._min = new Laya.Vector3();
            this._max = new Laya.Vector3();
            this._surface = surface;
            this._titleIndex = new Set();
        }
        _setUpdateDataHander(handler) {
            this._flagChangeHander = handler;
        }
        _setTileHander(handler) {
            this._tileHander = handler;
        }
        _updateTransfrom(mat) {
            if (mat.equalsOtherMatrix(this._transfrom))
                return;
            mat.cloneTo(this._transfrom);
            this._setCacheFlag(CacheData.TransfromFlag);
        }
        _updateAreaFlag(flag) {
            if (this._areaFlag == flag)
                return;
            this._areaFlag = flag;
            this._setCacheFlag(CacheData.AreaFlag);
        }
        get areaFlag() {
            return this._areaFlag;
        }
        _cacheBound(min, max) {
            if (!Laya.Vector3.equals(this._min, min)) {
                min.cloneTo(this._min);
                this._setCacheFlag(CacheData.MinFlag);
            }
            if (!Laya.Vector3.equals(this._max, max)) {
                max.cloneTo(this._max);
                this._setCacheFlag(CacheData.MaxFlag);
            }
        }
        set _cacheData(data) {
            if (this._data == data)
                return;
            this._data = data;
            this._setCacheFlag(CacheData.DataFlag);
        }
        get _cacheData() {
            return this._data;
        }
        _destroy() {
            this._setCacheFlag(CacheData.DeleteFlag);
        }
        _setCacheFlag(type) {
            this._cacheflag |= type;
            this._surface._delayCacheMap.add(this);
        }
        _getCacheFlag(type) {
            return (this._cacheflag & type) != 0;
        }
        _updateCache() {
            if (this._cacheflag == 0)
                return;
            this._titleIndex.forEach((index) => {
                this._surface._buildTileList.add(index);
            });
            if (this._getCacheFlag(CacheData.DeleteFlag)) {
                this._cacheflag = 0;
                return;
            }
            let flags = this._surface._manager.getArea(this._areaFlag);
            if (this._flagChangeHander)
                this._flagChangeHander.runWith([this, flags.index]);
            helpTempSet.clear();
            let index = this._surface._navMesh.navTileGrid.getBoundTileIndex(this._min, this._max, false);
            index.forEach((index) => {
                helpTempSet.add(index);
                this._surface._buildTileList.add(index);
            });
            if (this._tileHander)
                this._tileHander.runWith([this, this._titleIndex, helpTempSet]);
            this._titleIndex.clear();
            helpTempSet.forEach((index) => {
                this._titleIndex.add(index);
            });
            this._cacheflag = 0;
        }
        _resetData() {
            this._titleIndex.clear();
            this._setCacheFlag(CacheData.ResetDataFlag);
        }
    }
    CacheData.TransfromFlag = 1;
    CacheData.AreaFlag = 2;
    CacheData.MinFlag = 4;
    CacheData.MaxFlag = 8;
    CacheData.DataFlag = 16;
    CacheData.DeleteFlag = 32;
    CacheData.OtherDataFlag = 64;
    CacheData.ResetDataFlag = 128;

    class ItemMapId {
        constructor(maxCount) {
            this._idMap = new Map();
            this._idArray = new Array();
            for (var i = 0; i < maxCount; i++) {
                this._idArray.push(i);
            }
        }
        haveId() {
            return this._idArray.length > 0;
        }
        getId(value) {
            if (this._idMap.has(value)) {
                return this._idMap.get(value);
            }
            if (this._idArray.length > 0) {
                let id = this._idArray.shift();
                this._idMap.set(value, id);
                return id;
            }
            return -1;
        }
        removeItem(value) {
            if (this._idMap.has(value)) {
                let id = this._idMap.get(value);
                this._idArray.push(id);
                this._idMap.delete(value);
                this._idArray.sort((a, b) => { return a - b; });
                return id;
            }
            else {
                return -1;
            }
        }
    }

    class BaseNavMeshSurface extends Laya.Component {
        set agentType(value) {
            if (this._agentType == value)
                return;
            if (this._navMesh) {
                this._manager.removeNavMeshSurface(this);
                this._navMesh._destroy();
                this._navMesh = null;
            }
            this._agentType = value;
            if (!this._navMesh && this._manager && this.enabled)
                this._onEnable();
            if (this._oriTiles == null)
                return;
            let tileCount = this._oriTiles.length;
            for (var i = 0; i < tileCount; i++) {
                this._buildTileList.add(i);
            }
        }
        get agentType() {
            return this._agentType;
        }
        set areaFlag(value) {
            this._cachedata._updateAreaFlag(value);
        }
        get areaFlag() {
            return this._cachedata.areaFlag;
        }
        set asyn(value) {
            this._needAsyn = value;
        }
        get asyn() {
            return this._needAsyn;
        }
        set partitionType(value) {
            this._partitionType = value;
        }
        get partitionType() {
            return this._partitionType;
        }
        get min() {
            return this._boundMin;
        }
        get max() {
            return this._boundMax;
        }
        set datas(value) {
            this._datas = value;
            this._updateNavData();
        }
        get datas() {
            return this._datas;
        }
        set maxSimplificationError(value) {
            if (this._maxSimplificationError == value)
                return;
            this._maxSimplificationError = value;
            this._cachedata._setCacheFlag(CacheData.OtherDataFlag);
        }
        get maxSimplificationError() {
            return this._maxSimplificationError;
        }
        constructor() {
            super();
            this._maxSimplificationError = 0.9;
            this._agentType = exports.NavigationConfig.defaltAgentName;
            this._boundMin = new Laya.Vector3();
            this._boundMax = new Laya.Vector3();
            this._needAsyn = false;
            this.runInEditor = true;
            this._singleton = false;
            this._delayCacheMap = new Set();
            this._buildTileList = new Set();
            this._featureCache = new Map();
            this._partitionType = exports.PartitionType.PARTITION_WATERSHED;
            this._cachedata = this._createCacheData();
            this._cachedata._setUpdateDataHander(new Laya.Handler(this, this._updateOrigTileCache, undefined, false));
            this._cachedata._cacheData = [];
            this._cacheDataMap = new Map();
            this._meshlinkOffMaps = new ItemMapId(256);
            this._meshVolumeMaps = new ItemMapId(256);
        }
        cleanAllTile() {
            if (!this._oriTiles || !this._navMesh)
                return;
            for (var i = 0, n = this._oriTiles.length; i < n; i++) {
                let tile = this._oriTiles.getNavData(i);
                this._navMesh._removeTile(tile.x, tile.y);
            }
        }
        rebuildTile(pos) {
            let index = this._navMesh.navTileGrid.getTileIndexByPos(pos.x, pos.z);
            this._buildTileList.add(index);
        }
        getPolyFlags(pos, fiter = null) {
            if (this._navMesh == null)
                return -1;
            return this._navMesh._getPolyFlags(pos, fiter);
        }
        findNearestPoly(pos, fiter = null, out) {
            if (this._navMesh == null)
                return null;
            return this._navMesh._findNearestPoly(pos, fiter, out);
        }
        findFllowPath(outPaths, startPos, endPos, speed, filter = null) {
            if (this._navMesh == null)
                return false;
            return this._navMesh._findFllowPath(outPaths, startPos, endPos, speed, filter);
        }
        findDistanceToWall(pos, filter) {
            if (this._navMesh == null)
                return null;
            return this._navMesh._findDistanceToWall(pos, filter);
        }
        _updateOrigTileCache(cache, areaflags) {
            if (!cache._getCacheFlag(CacheData.DataFlag | CacheData.AreaFlag))
                return;
            let datas = cache._cacheData;
            let tileCount = datas.length;
            for (var i = 0; i < tileCount; i++) {
                datas[i].setFlag(areaflags);
            }
        }
        _createCacheData() {
            return new CacheData(this);
        }
        _getCahceData(data) {
            let cacheData = this._cacheDataMap.get(data);
            if (cacheData == null) {
                cacheData = this._createCacheData();
                this._cacheDataMap.set(data, cacheData);
            }
            return cacheData;
        }
        _removeCacheData(data) {
            let cacheData = this._cacheDataMap.get(data);
            if (cacheData == null)
                return null;
            this._cacheDataMap.delete(data);
            cacheData._destroy();
            return cacheData;
        }
        _crateNavMesh(config, min, max) {
            throw new Error("BaseNavMeshSurface: must override this function");
        }
        _updateNavData() {
            var _a;
            this._featureCache.clear();
            this._cleanBindData();
            (_a = this._oriTiles) === null || _a === void 0 ? void 0 : _a.destroy();
            if (this._navMesh)
                this._navMesh._clearn();
            if (this._datas) {
                this._oriTiles = new NavTileData(this._datas);
                if (this._navMesh) {
                    this._navMesh.navTileGrid._refeashBound(this._oriTiles);
                    this._navMesh._navMeshInit();
                }
                let bindDatas = [];
                for (var i = 0, n = this._oriTiles.length; i < n; i++) {
                    let bindData = NavigationUtils._createdtNavTileCache();
                    bindData.init(this._oriTiles.getNavData(i).bindData);
                    this._featureCache.set(i, new Set([bindData]));
                    bindDatas.push(bindData);
                }
                this._cachedata._cacheBound(this._oriTiles._boundMin, this._oriTiles._boundMax);
                this._cachedata._cacheData = bindDatas;
                this._cacheDataMap.forEach((value) => { value._resetData(); });
            }
            else {
                this._oriTiles = null;
                this._buildTileList.clear();
            }
        }
        _getManager() {
            throw new Error("BaseNavMeshSurface: must override this function");
        }
        _onEnable() {
            this._manager = this._getManager();
            if (!this._navMesh) {
                const config = this._manager.getNavConfig(this._agentType);
                if (!config) {
                    console.warn(`[Navigation] Unknown agent type "${this._agentType}" on "${this.owner.name}". Navigation surface initialization was skipped; select an existing agent type.`);
                    return;
                }
                this._navMesh = this._crateNavMesh(config, this._boundMin, this._boundMax);
                if (this._oriTiles) {
                    this._navMesh.navTileGrid._refeashBound(this._oriTiles);
                    this._navMesh._navMeshInit();
                }
            }
            this._manager.regNavMeshSurface(this);
            if (this._oriTiles) {
                for (let i = 0; i < this._oriTiles.length; i++)
                    this._buildTileList.add(i);
                this._cacheDataMap.forEach(cache => cache._resetData());
            }
        }
        _update(dt) {
            if (this._oriTiles == null || !this._navMesh)
                return;
            this._delayCacheMap.forEach((value) => { value._updateCache(); });
            this._delayCacheMap.clear();
            if (this._needAsyn) {
                this._buildOneTileMesh();
            }
            else {
                this._buildAllTileMesh();
            }
            if (dt > 0)
                this._navMesh._updateNavMesh(dt);
        }
        _buildOneTileMesh() {
            if (this._buildTileList.size == 0)
                return;
            const setIter = this._buildTileList.keys();
            let tileIndex = setIter.next().value;
            let oritile = this._oriTiles.getNavData(tileIndex);
            var featureCache = this._featureCache.get(tileIndex);
            this._navMesh._addTile(oritile, [...featureCache], this._partitionType, this._maxSimplificationError);
            this._buildTileList.delete(tileIndex);
        }
        _buildAllTileMesh() {
            while (this._buildTileList.size > 0) {
                this._buildOneTileMesh();
            }
        }
        _onDisable() {
            var _a, _b;
            (_a = this._navMesh) === null || _a === void 0 ? void 0 : _a._clearn();
            this.cleanAllTile();
            (_b = this._manager) === null || _b === void 0 ? void 0 : _b.removeNavMeshSurface(this);
        }
        _onDestroy() {
            var _a, _b;
            (_a = this._navMesh) === null || _a === void 0 ? void 0 : _a._destroy();
            this._navMesh = null;
            this._cleanBindData();
            (_b = this._oriTiles) === null || _b === void 0 ? void 0 : _b.destroy();
            this._oriTiles = null;
            this._cacheDataMap.clear();
            this._featureCache.clear();
            this._delayCacheMap.clear();
            this._buildTileList.clear();
        }
        _cloneTo(dest) {
            let surface = dest;
            surface._agentType = this._agentType;
            surface.areaFlag = this.areaFlag;
            surface._partitionType = this._partitionType;
            surface.asyn = this.asyn;
            surface.maxSimplificationError = this.maxSimplificationError;
            surface.datas = this.datas;
            super._cloneTo(dest);
        }
        _cleanBindData() {
            let bindDatas = this._cachedata._cacheData;
            bindDatas.forEach((value) => {
                NavigationUtils._freeLayaData(value);
            });
            this._cachedata._titleIndex.clear();
            this._cachedata._cacheData = [];
        }
        _addModifileNavMesh(navModifile) {
            return this._getCahceData(navModifile);
        }
        _removeModifileNavMesh(navModifile) {
            this._removeCacheData(navModifile);
        }
        _addModifileLink(link) {
            let cache = this._getCahceData(link);
            let linkId = this._meshlinkOffMaps.getId(link);
            if (linkId == -1) {
                return null;
            }
            cache.id = linkId;
            return cache;
        }
        _removeModifileLink(link) {
            var _a;
            const cache = this._cacheDataMap.get(link);
            if (!cache)
                return;
            (_a = this._navMesh) === null || _a === void 0 ? void 0 : _a._removeNavMeshLink(cache.id);
            this._meshlinkOffMaps.removeItem(link);
            this._removeCacheData(link);
        }
        _addConvexVoume(volume) {
            let cache = this._getCahceData(volume);
            let volumeId = this._meshVolumeMaps.getId(cache);
            if (volumeId == -1) {
                return null;
            }
            cache.id = volumeId;
            return cache;
        }
        _deleteCovexVoume(volume) {
            var _a;
            const cache = this._cacheDataMap.get(volume);
            if (cache) {
                (_a = this._navMesh) === null || _a === void 0 ? void 0 : _a._deleteConvexVoume(cache.id);
                this._meshVolumeMaps.removeItem(cache);
            }
            this._removeCacheData(volume);
        }
    }

    class BaseNavigationManager {
        static _initialize(callback) {
            if (NavigationUtils._getRecast() != null) {
                return Promise.resolve().then(callback);
            }
            const Recast = window.Recast;
            if (!Recast) {
                return Promise.resolve();
            }
            if (BaseNavigationManager._initializePromise == null) {
                BaseNavigationManager._initializePromise = Recast()
                    .then((recast) => {
                    NavigationUtils._initialize(recast);
                })
                    .catch((error) => {
                    BaseNavigationManager._initializePromise = null;
                    throw error;
                });
            }
            return BaseNavigationManager._initializePromise.then(callback);
        }
        static findNavMeshSurface(surfaces, sprite, agentFlags) {
            let array = sprite.getComponents(BaseNavMeshSurface);
            if (array && array.length > 0) {
                array.forEach(element => {
                    (agentFlags.indexOf(element.agentType) >= 0) && surfaces.push(element);
                });
            }
            let parat = sprite.parent;
            if (parat && (parat instanceof Laya.Node)) {
                BaseNavigationManager.findNavMeshSurface(surfaces, parat, agentFlags);
            }
        }
        constructor(name) {
            this._navConfigMap = new Map();
            this._areaFlagMap = new Map();
            this._naveMeshMaps = new Map();
            this._naveMeshLinkMaps = new Map();
            this.name = name;
            this._deflatAllMask = new AreaMask();
            this._init();
        }
        destroy() {
        }
        _init() {
            let config = new RecastConfig();
            config.agentName = exports.NavigationConfig.defaltAgentName;
            this.regNavConfig(config);
            let area = new NavAreaFlag();
            area.name = exports.NavigationConfig.defaltUnWalk;
            area.cost = 1;
            area.index = 0;
            this.regArea(area);
            area = new NavAreaFlag();
            area.name = exports.NavigationConfig.defaltWalk;
            area.cost = 1;
            area.index = 1;
            this.regArea(area);
            area = new NavAreaFlag();
            area.name = exports.NavigationConfig.defaltJump;
            area.cost = 1;
            area.index = 2;
            this.regArea(area);
            this._deflatAllMask._setAreaMap(this._areaFlagMap);
            this._deflatAllMask.flag = 3;
        }
        _getLinkIdByNavMeshSurfaces(a, b) {
            if (a.id < b.id) {
                return a.id + "_" + b.id;
            }
            else {
                return b.id + "_" + a.id;
            }
        }
        Init(data) {
            if (!data)
                return;
            const agents = data.agents;
            if (agents) {
                for (var i = 0, n = agents.length; i < n; i++) {
                    let agent = agents[i];
                    let config = this.getNavConfig(agent.agentName);
                    if (!config) {
                        config = new RecastConfig();
                        config.agentName = agent.agentName;
                        this.regNavConfig(config);
                    }
                    config.cellSize = agent.cellSize;
                    config.cellHeight = agent.cellHeight;
                    config.agentMaxSlope = agent.agentMaxSlope;
                    config.agentHeight = agent.agentHeight;
                    config.agentRadius = agent.agentRadius;
                    config.agentMaxClimb = agent.agentMaxClimb;
                    config.tileSize = agent.tileSize;
                }
            }
            const areas = data.areas;
            if (areas) {
                for (var i = 0, n = areas.length; i < n; i++) {
                    let area = this.getArea(areas[i].name);
                    if (!area) {
                        area = new NavAreaFlag();
                        area.name = areas[i].name;
                        this.regArea(area);
                    }
                    area.index = areas[i].index;
                    area.cost = areas[i].cost;
                }
                let flag = 0;
                this._areaFlagMap.forEach((value, key) => {
                    flag = flag | value.flag;
                });
                this._deflatAllMask.flag = flag;
            }
        }
        setFilterCost(filer) {
            this._areaFlagMap.forEach((value) => {
                filer.setAreaCost(value.index, value.cost);
            });
        }
        update(dt) {
            let delta = Math.min(dt, 0.3);
            this._naveMeshMaps.forEach((lists) => {
                for (var i = 0, n = lists.length; i < n; i++) {
                    lists.elements[i]._update(delta);
                }
            });
        }
        regNavConfig(config) {
            this._navConfigMap.set(config.agentName, config);
        }
        getNavConfig(type) {
            return this._navConfigMap.get(type);
        }
        regArea(area) {
            this._areaFlagMap.set(area.name, area);
        }
        getArea(type) {
            return this._areaFlagMap.get(type);
        }
        getAreaFlagMap() {
            return this._areaFlagMap;
        }
        regNavMeshLink(start, end, link) {
            if (start == end)
                return;
            if (start.agentType != end.agentType)
                return;
            let key = this._getLinkIdByNavMeshSurfaces(start, end);
            if (!this._naveMeshLinkMaps.has(key)) {
                this._naveMeshLinkMaps.set(key, Array());
            }
            const links = this._naveMeshLinkMaps.get(key);
            if (!links.includes(link))
                links.push(link);
        }
        removeMeshLink(start, end, link) {
            if (start == end)
                return;
            let key = this._getLinkIdByNavMeshSurfaces(start, end);
            if (!this._naveMeshLinkMaps.has(key)) {
                return;
            }
            let links = this._naveMeshLinkMaps.get(key);
            let index = links.indexOf(link);
            if (index >= 0) {
                links.splice(index, 1);
            }
        }
        getNavMeshLink(from, to) {
            let key = this._getLinkIdByNavMeshSurfaces(from, to);
            if (!this._naveMeshLinkMaps.has(key)) {
                return null;
            }
            return this._naveMeshLinkMaps.get(key);
        }
        regNavMeshSurface(nav) {
            if (!nav) {
                console.error("cannot regist empyt NavMeshSurface.");
                return;
            }
            const agentType = nav.agentType;
            let surfaces = this._naveMeshMaps.get(agentType);
            if (surfaces == null) {
                surfaces = new Laya.SingletonList();
                this._naveMeshMaps.set(agentType, surfaces);
            }
            surfaces.add(nav);
        }
        removeNavMeshSurface(nav) {
            if (!nav) {
                console.error("cannot remove empyt NavMeshSurface.");
                return;
            }
            const agentType = nav.agentType;
            let surfaces = this._naveMeshMaps.get(agentType);
            if (surfaces == null) {
                return;
            }
            surfaces.remove(nav);
        }
        getNavMeshSurface(pos, agentType) {
            if (!this._naveMeshMaps.has(agentType))
                return null;
            let surfaces = this._naveMeshMaps.get(agentType);
            for (var i = 0, n = surfaces.length; i < n; i++) {
                let nav = surfaces.elements[i];
                if (NavigationUtils._boundContentPoint(nav.min, nav.max, pos)) {
                    return nav;
                }
                const mesh = nav._navMesh;
                if ((mesh === null || mesh === void 0 ? void 0 : mesh.is3D) && pos.x >= nav.min.x && pos.x <= nav.max.x && pos.z >= nav.min.z && pos.z <= nav.max.z) {
                    const nearest = new Laya.Vector3();
                    if (mesh._findNearestPoly(pos, null, nearest) && Math.abs(nearest.y - pos.y) <= mesh.navTileGrid.config.cellHeight * 2)
                        return nav;
                }
            }
            return null;
        }
        getNavMeshSurfaces(pos) {
            var surfaces = [];
            this._naveMeshMaps.forEach((datas) => {
                for (var i = 0, n = datas.length; i < n; i++) {
                    let nav = datas.elements[i];
                    if (NavigationUtils._boundContentPoint(nav.min, nav.max, pos)) {
                        surfaces.push(datas.elements[i]);
                    }
                }
            });
            return surfaces;
        }
        getNavMeshSurfacesByBound(min, max, type) {
            var surfaces = [];
            this._naveMeshMaps.forEach((datas) => {
                for (var i = 0, n = datas.length; i < n; i++) {
                    let nav = datas.elements[i];
                    if (nav.agentType != type)
                        continue;
                    if (NavigationUtils._boundInterection(nav.min, nav.max, min, max) >= 0) {
                        surfaces.push(datas.elements[i]);
                    }
                }
            });
            return surfaces;
        }
    }
    BaseNavigationManager._initializePromise = null;

    let c = Laya.ClassUtils.regClass;
    c("NavMeshGrid", NavMeshGrid);
    c("RecastConfig", RecastConfig);
    c("NavigationUtils", NavigationUtils);
    c("AreaMask", AreaMask);

    class NavAgentLinkAnim {
        constructor() {
            this._startPos = new Laya.Vector3();
            this._endPos = new Laya.Vector3();
            this._initPos = new Laya.Vector3();
            this._active = false;
        }
        _clearn() {
            this._active = false;
            this._isStart = false;
            this._runTime = 0;
        }
        _setStartPos(value) {
            value.cloneTo(this._startPos);
        }
        _getSartPos() {
            return this._startPos;
        }
        _setEndPos(value) {
            value.cloneTo(this._endPos);
        }
        _getEndPos() {
            return this._endPos;
        }
        _nearerStartPos(value) {
            return Laya.Vector3.distance(this._startPos, value) < 0.2;
        }
        _nearerEndPos(value) {
            return Laya.Vector3.distance(this._endPos, value) < 0.1;
        }
        _start(maxSpeed, postions) {
            this._isStart = true;
            this._runTime = 0;
            this._totalTime = Laya.Vector3.distance(this._startPos, this._endPos) / maxSpeed;
            postions.cloneTo(this._initPos);
        }
        _update(position, dir) {
            if (!this._isStart)
                return;
            this._runTime += Laya.Laya.timer.delta * 0.001;
            const ta = this._totalTime * 0.05;
            if (this._runTime < ta) {
                const t = this._tween(this._runTime, 0, ta);
                Laya.Vector3.lerp(this._initPos, this._startPos, t, position);
            }
            else {
                const t = this._tween(this._runTime, ta, this._totalTime);
                Laya.Vector3.lerp(this._startPos, this._endPos, t, position);
            }
            Laya.Vector3.subtract(this._endPos, this._startPos, dir);
            dir.y = 0;
            Laya.Vector3.normalize(dir, dir);
        }
        _tween(t, t0, t1) {
            let value = (t - t0) / (t1 - t0);
            return Math.max(Math.min(1, value), 0);
        }
    }

    const tempVector3 = new Laya.Vector3();
    const tempVector31 = new Laya.Vector3();
    class BaseNavAgent extends Laya.Component {
        set radius(value) {
            this._radius = value;
            if (this._crowAgent) {
                let params = this._crowAgent.getparams();
                const radius = this._getradius();
                params.radius = radius;
                params.collisionQueryRange = this._getcollisionQueryRange();
                params.pathOptimizationRange = this._getpathOptimizationRange();
            }
        }
        get radius() {
            return this._radius;
        }
        set height(value) {
            this._height = value;
            if (this._crowAgent) {
                this._crowAgent.getparams().height = this._getheight();
            }
        }
        get height() {
            return this._height;
        }
        set speed(value) {
            this._speed = value;
            if (this._crowAgent) {
                this._crowAgent.getparams().maxSpeed = this._speed;
            }
        }
        get speed() {
            return this._speed;
        }
        set maxAcceleration(value) {
            this._maxAcceleration = value;
            if (this._crowAgent) {
                this._crowAgent.getparams().maxAcceleration = this._maxAcceleration;
            }
        }
        get maxAcceleration() {
            return this._maxAcceleration;
        }
        get autoBraking() {
            return this._autoBraking;
        }
        set autoBraking(value) {
            this._autoBraking = value === true;
            if (this._crowAgent)
                this._crowAgent.getparams().maxSpeed = this._arrivalStopped ? 0 : this._speed;
        }
        get stopDistance() {
            return this._stopDistance;
        }
        set stopDistance(value) {
            this._stopDistance = Number.isFinite(value) ? Math.max(0, value) : 0;
            if (this._arrivalStopped) {
                this._arrivalStopped = false;
                if (this._hasTarget)
                    this._setTarget(this._targetPos);
            }
        }
        set angularSpeed(value) {
            this._angularSpeed = value;
        }
        get angularSpeed() {
            return this._angularSpeed;
        }
        set quality(value) {
            if (this._quality == value)
                return;
            this._quality = value;
            if (this._crowAgent) {
                let params = this._crowAgent.getparams();
                params.updateFlags = this._getUpdateFlags();
                params.obstacleAvoidanceType = this._quality;
            }
        }
        get quality() {
            return this._quality;
        }
        set priority(value) {
            if (this._priority == value)
                return;
            this._priority = value;
            if (this._crowAgent) {
                let params = this._crowAgent.getparams();
                params.updateFlags = this._getUpdateFlags();
                params.separationWeight = this._priority;
            }
        }
        get priority() {
            return this._priority;
        }
        get isOnNavMesh() {
            return this._crowAgent != null;
        }
        get isOnOffMeshLink() {
            if (!this.isOnNavMesh)
                return this._navAgentLinkAnim._active;
            return this._crowAgent.state == exports.CrowdAgentState.DT_CROWDAGENT_STATE_OFFMESH;
        }
        set agentType(value) {
            if (value == this._agentType)
                return;
            this._agentType = value;
            if (this._navManager) {
                this._removeAgent();
                this._addAgent();
            }
        }
        get agentType() {
            return this._agentType;
        }
        set areaMask(value) {
            if (this._areaMask.flag === value)
                return;
            this._areaMask.flag = value;
            if (this._currentNaveSurface) {
                this._removeAgent();
                if (this.enabled) {
                    this._addAgent();
                    if (this._crowAgent && this._hasTarget)
                        this._setTarget(this._targetPos);
                }
            }
        }
        get areaMask() {
            return this._areaMask.flag;
        }
        constructor() {
            super();
            this._targetPos = new Laya.Vector3();
            this._agentType = null;
            this._speed = 3.5;
            this._maxAcceleration = 10;
            this._angularSpeed = 120;
            this._stopDistance = 0;
            this._autoBraking = true;
            this._radius = 0.5;
            this._height = 2;
            this._quality = exports.ObstacleAvoidanceType.MedQuality;
            this._priority = 0;
            this._baseOffset = 1;
            this._navMeshSurfaceReady = false;
            this._hasTarget = false;
            this._arrivalStopped = false;
            this._navAgentLinkAnim = new NavAgentLinkAnim();
            this._areaMask = new AreaMask();
            this._curentSpeed = new Laya.Vector3();
        }
        onUpdate() {
            if (this._crowAgent != null) {
                if (!this._navMeshSurfaceReady) {
                    this._navMeshSurfaceReady = true;
                    if (this._hasTarget && !this._arrivalStopped && !this._navAgentLinkAnim._active)
                        this._setTarget(this._targetPos);
                }
                return;
            }
            if (!this._navMeshSurfaceReady && !this._navAgentLinkAnim._active)
                this._addAgent();
            if (!this._navAgentLinkAnim._active)
                return;
            let position = tempVector3;
            let dir = tempVector31;
            this._navAgentLinkAnim._update(position, dir);
            if (this._navAgentLinkAnim._nearerEndPos(position)) {
                this._updatePosition(position, dir);
                this._navAgentLinkAnim._clearn();
                this._addAgent();
                this._setTarget(this._targetPos);
            }
            this._updatePosition(position, dir);
        }
        isStop() {
            return Laya.MathUtils3D.isZero(this._curentSpeed.length());
        }
        getCurrentPath() {
            if (!this._currentNaveSurface) {
                this._fllowPath.length = 0;
            }
            else {
                this._getpos(tempVector3);
                this._currentNaveSurface.findFllowPath(this._fllowPath, tempVector3, this._targetPos, this._speed, this._filter);
            }
            return this._fllowPath;
        }
        findDistanceToWall() {
            if (this._crowAgent) {
                this._getpos(tempVector3);
                return this._currentNaveSurface.findDistanceToWall(tempVector3, this._filter);
            }
            else {
                return null;
            }
        }
        _setTarget(value) {
            this._hasTarget = true;
            value.cloneTo(this._targetPos);
            if (this._arrivalStopped && this._brakingTarget && Laya.Vector3.equals(value, this._brakingTarget))
                return;
            if (!this._navManager)
                return;
            if (this._currentNaveSurface == null || !this._currentNaveSurface.enabled)
                return;
            let targetSurface = this._navManager.getNavMeshSurface(value, this._agentType);
            if (targetSurface == null)
                return;
            if (targetSurface == this._currentNaveSurface) {
                if (this._currentNaveSurface._navMesh._requestMoveTarget(this, this._targetPos)) {
                    if (!this._brakingTarget)
                        this._brakingTarget = new Laya.Vector3();
                    value.cloneTo(this._brakingTarget);
                    this._arrivalStopped = false;
                    this._crowAgent.getparams().maxSpeed = this._speed;
                }
                return;
            }
            let linkes = this._navManager.getNavMeshLink(this._currentNaveSurface, targetSurface);
            if (linkes == null)
                return;
            let link = null;
            let distance = Number.MAX_VALUE;
            let isstart;
            linkes.forEach((value) => {
                if (value._startNavSurfaces.indexOf(this._currentNaveSurface) >= 0) {
                    let dis = value.getDistance();
                    if (dis < distance) {
                        distance = dis;
                        link = value;
                        isstart = true;
                    }
                }
                else if (value._endNavSurfaces.indexOf(this._currentNaveSurface) >= 0 && value._bidirectional) {
                    let dis = value.getDistance();
                    if (dis < distance) {
                        distance = dis;
                        link = value;
                        isstart = false;
                    }
                }
            });
            if (link == null) {
                return;
            }
            this._navAgentLinkAnim.targetSurface = targetSurface;
            this._navAgentLinkAnim._active = true;
            if (isstart) {
                this._navAgentLinkAnim._setStartPos(link.globalStart);
                this._navAgentLinkAnim._setEndPos(link.globalEnd);
            }
            else {
                this._navAgentLinkAnim._setStartPos(link.globalEnd);
                this._navAgentLinkAnim._setEndPos(link.globalStart);
            }
            let startPos = this._navAgentLinkAnim._getSartPos();
            let refPoint = this._currentNaveSurface._navMesh._findNearestPoly(startPos, this._filter, startPos);
            if (refPoint >= 0) {
                this._currentNaveSurface._navMesh._requestMoveTarget(this, startPos);
            }
        }
        _getpos(vec) {
            throw new Laya.NotImplementedError();
        }
        _getcollisionQueryRange() {
            return this.radius * 12;
        }
        _getpathOptimizationRange() {
            return this.radius * 30;
        }
        _getManager() {
            throw new Error("BaseNavMeshSurface: must override this function");
        }
        _onEnable() {
            super._onEnable();
            this._fllowPath = [];
            let manager = this._navManager = this._getManager();
            this._areaMask._setAreaMap(manager.getAreaFlagMap());
            if (!manager.getNavConfig(this._agentType)) {
                console.warn(`[Navigation] Unknown agent type "${this._agentType}" on "${this.owner.name}". Navigation agent initialization was skipped; select an existing agent type.`);
                return;
            }
            this._addAgent();
        }
        _onDisable() {
            super._onDisable();
            this._removeAgent();
        }
        _addAgent() {
            if (this._navManager == null)
                return;
            this._getpos(tempVector3);
            let surface = this._navManager.getNavMeshSurface(tempVector3, this._agentType);
            if (surface == null) {
                return;
            }
            this._currentNaveSurface = surface;
            this._currentNaveSurface._navMesh._addAgent(this);
        }
        _removeAgent() {
            var _a;
            if (this._currentNaveSurface == null)
                return;
            (_a = this._currentNaveSurface._navMesh) === null || _a === void 0 ? void 0 : _a._removeAgent(this);
            this._agentId = null;
            this._crowAgent = null;
            this._currentNaveSurface = null;
            this._navMeshSurfaceReady = false;
        }
        _getheight() {
            throw new Laya.NotImplementedError();
        }
        _getradius() {
            throw new Laya.NotImplementedError();
        }
        _getUpdateFlags() {
            let updateFlags = exports.UpdateFlags.DT_CROWD_ANTICIPATE_TURNS | exports.UpdateFlags.DT_CROWD_OPTIMIZE_VIS | exports.UpdateFlags.DT_CROWD_OPTIMIZE_TOPO;
            if (this._quality > 0) {
                updateFlags |= exports.UpdateFlags.DT_CROWD_OBSTACLE_AVOIDANCE;
            }
            if (this._priority > 0) {
                updateFlags |= exports.UpdateFlags.DT_CROWD_SEPARATION;
            }
            return updateFlags;
        }
        _onDestroy() {
            super._onDestroy();
            this._removeAgent();
        }
        _updateBraking(dt) {
            if (!this._crowAgent)
                return;
            const params = this._crowAgent.getparams();
            if (this._arrivalStopped) {
                params.maxSpeed = 0;
                return;
            }
            if (!this._autoBraking && this._stopDistance === 0)
                return;
            params.maxSpeed = this._speed;
            if (!this._brakingTarget || this._navAgentLinkAnim._active || this.isOnOffMeshLink)
                return;
            const mesh = this._currentNaveSurface._navMesh;
            this._getpos(tempVector3);
            const brakeRange = this._stopDistance + this._speed * this._speed / Math.max(this._maxAcceleration, 0.0001);
            if (Laya.Vector3.distanceSquared(tempVector3, this._brakingTarget) > brakeRange * brakeRange)
                return;
            const query = mesh.navQuery;
            const start = query.findNearestPoly(tempVector3.toArray(), mesh.extents, this._filter);
            const end = query.findNearestPoly(this._brakingTarget.toArray(), mesh.extents, this._filter);
            if (!start.polyRef || !end.polyRef)
                return;
            const polys = query.findPath(start, end, this._filter, 256).polys;
            if (!polys.length)
                return;
            const startPos = query.closestPointOnPolyByRefPointData(start);
            const endPos = query.closestPointOnPoly(polys[polys.length - 1], end.data);
            const path = query.findStraightPath(startPos, endPos, polys, polys.length, 256);
            const count = path.nsteerPath;
            if (!count || !(path.steerPathFlags[count - 1] & 2))
                return;
            const points = path.steerPath;
            let remaining = 0;
            for (let i = 1; i < count; i++) {
                const off = i * 3;
                remaining += Math.hypot(points[off] - points[off - 3], points[off + 1] - points[off - 2], points[off + 2] - points[off - 1]);
                if ((path.steerPathFlags[i] & 4) && Math.hypot(points[off] - startPos[0], points[off + 2] - startPos[2]) <= this._getradius() * 2.25)
                    return;
            }
            const complete = polys[polys.length - 1] === end.polyRef;
            const tolerance = Math.max(0.001, mesh.navTileGrid.config.cellSize * 0.01);
            if (complete && remaining <= this._stopDistance + tolerance) {
                this._arrivalStopped = true;
                this._removeAgent();
                this._addAgent();
                if (this._crowAgent)
                    this._crowAgent.getparams().maxSpeed = 0;
                this._curentSpeed.setValue(0, 0, 0);
                return;
            }
            if (!this._autoBraking || this._speed <= 0 || this._maxAcceleration <= 0 || dt <= 0)
                return;
            const distance = Math.max(0, remaining - (complete ? this._stopDistance : 0));
            const frameDelta = this._maxAcceleration * dt;
            let limit = 0.8 * (Math.sqrt(frameDelta * frameDelta + 2 * this._maxAcceleration * distance) - frameDelta);
            if (count <= 2) {
                const nativeScale = Math.min(1, Math.hypot(endPos[0] - startPos[0], endPos[2] - startPos[2]) / Math.max(this._getradius() * 2, 0.0001));
                if (nativeScale > 0)
                    limit /= nativeScale;
            }
            params.maxSpeed = Math.max(0, Math.min(this._speed, limit));
        }
        _updateNavMesh(pos, dir) {
            if (this._crowAgent == null)
                return;
            let position = tempVector3;
            let direction = tempVector31;
            position.fromArray(pos);
            direction.fromArray(dir);
            let isNearerStart = false;
            if (this._navAgentLinkAnim._active) {
                isNearerStart = this._navAgentLinkAnim._nearerStartPos(position);
            }
            if (isNearerStart) {
                this._removeAgent();
                this._navAgentLinkAnim._start(this._speed, position);
            }
            direction.cloneTo(this._curentSpeed);
            this._updatePosition(position, direction);
        }
        _updatePosition(pos, dir) {
            throw new Laya.NotImplementedError();
        }
        _cloneTo(dest) {
            let agent = dest;
            agent.agentType = this.agentType;
            agent.speed = this._speed;
            agent.angularSpeed = this.angularSpeed;
            agent.radius = this.radius;
            agent.height = this.height;
            agent.areaMask = this.areaMask;
            agent.quality = this.quality;
            agent.priority = this.priority;
            agent.maxAcceleration = this.maxAcceleration;
            agent.autoBraking = this.autoBraking;
            agent.stopDistance = this.stopDistance;
            agent._baseOffset = this._baseOffset;
            super._cloneTo(dest);
        }
    }

    class BaseData {
        constructor() {
            this._transfrom = new Laya.Matrix4x4();
            this._min = new Laya.Vector3();
            this._max = new Laya.Vector3();
            this._agentType = exports.NavigationConfig.defaltAgentName;
            this._areaFlags = exports.NavigationConfig.defaltUnWalk;
            this._cacheDatas = [];
        }
        set agentType(value) {
            this._agentType = value;
        }
        get agentType() {
            return this._agentType;
        }
        set areaFlag(value) {
            this._areaFlags = value;
            this._cacheDatas.forEach(element => {
                element._updateAreaFlag(value);
            });
        }
        get areaFlag() {
            return this._areaFlags;
        }
        _refeashData() {
            this._cacheDatas.forEach(element => {
                element._setCacheFlag(CacheData.DataFlag);
            });
        }
        _refeahTransfrom() {
            this._cacheDatas.forEach(element => {
                element._updateTransfrom(this._transfrom);
            });
        }
        _refeahBound() {
            this._cacheDatas.forEach(element => {
                element._cacheBound(this._min, this._max);
            });
        }
    }

    const tempVec3 = new Laya.Vector3();
    const tempMat = new Laya.Matrix4x4();
    class ModifierVolumeData extends BaseData {
        constructor(yOff = 0.1) {
            super();
            this._datas = [];
            this._yOffset = 0.1;
            this._yOffset = yOff;
        }
        _updateBuffer(cache, flag) {
            let mesh = cache._surface._navMesh;
            if (cache._getCacheFlag(CacheData.TransfromFlag) || cache._getCacheFlag(CacheData.DataFlag)) {
                if (mesh.is3D) {
                    if (this._buffer == null) {
                        this._buffer = new Float32Array(22);
                    }
                    this._max.setValue(1, 1, 1);
                    this._min.setValue(-1, -1, -1);
                    NavigationUtils._transfromBoundBox(this._min, this._max, this._transfrom, this._min, this._max);
                    this._buffer[0] = this._min.x;
                    this._buffer[1] = this._min.y;
                    this._buffer[2] = this._min.z;
                    this._buffer[3] = this._max.x;
                    this._buffer[4] = this._max.y;
                    this._buffer[5] = this._max.z;
                    this._transfrom.invert(tempMat);
                    this._buffer.set(tempMat.elements, 6);
                    cache._cacheBound(this._min, this._max);
                }
                else {
                    if (this._buffer == null || this._buffer.length != this._datas.length) {
                        this._buffer = new Float32Array(this._datas.length);
                    }
                    let count = this._datas.length / 3;
                    this._max.setValue(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
                    this._min.setValue(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
                    for (var i = 0; i < count; i++) {
                        tempVec3.setValue(this._datas[i * 3], this._datas[i * 3 + 1], this._datas[i * 3 + 2]);
                        Laya.Vector3.transformCoordinate(tempVec3, this._transfrom, tempVec3);
                        this._buffer[i * 3] = tempVec3.x;
                        this._buffer[i * 3 + 1] = tempVec3.y;
                        this._buffer[i * 3 + 2] = tempVec3.z;
                        this._max.x = Math.max(this._max.x, tempVec3.x);
                        this._max.y = Math.max(this._max.y, tempVec3.y);
                        this._max.z = Math.max(this._max.z, tempVec3.z);
                        this._min.x = Math.min(this._min.x, tempVec3.x);
                        this._min.y = Math.min(this._min.y, tempVec3.y);
                        this._min.z = Math.min(this._min.z, tempVec3.z);
                    }
                    this._min.x -= this._yOffset;
                    this._max.y += this._yOffset;
                    cache._cacheBound(this._min, this._max);
                }
            }
            mesh._updateConvexVolume(cache.id, this._buffer, this._min.y, this._max.y, flag);
        }
        _initSurface(surface) {
            this._destory();
            surface.forEach(element => {
                let cache = element._addConvexVoume(this);
                cache._setUpdateDataHander(Laya.Handler.create(this, this._updateBuffer, undefined, false));
                this._cacheDatas.push(cache);
                cache._updateAreaFlag(this._areaFlags);
                cache._updateTransfrom(this._transfrom);
                cache._setCacheFlag(CacheData.DataFlag);
            });
        }
        _destory() {
            this._cacheDatas.forEach(element => {
                element._surface._deleteCovexVoume(this);
            });
            this._cacheDatas = [];
        }
    }

    class NavMeshLinkData extends BaseData {
        constructor() {
            super();
            this._startPoint = new Laya.Vector3();
            this._endPoint = new Laya.Vector3();
            this._width = 1;
            this._bidirectional = true;
            this.globalStart = new Laya.Vector3();
            this.globalEnd = new Laya.Vector3();
            this._startNavSurfaces = [];
            this._endNavSurfaces = [];
            this._regisgMaps = [];
        }
        _updateWidth(value) {
            if (this._width == value)
                return;
            this._width = value;
            this._updateData(CacheData.OtherDataFlag);
        }
        _updateBidirectional(value) {
            if (this._bidirectional == value)
                return;
            this._bidirectional = value;
            this._updateData(CacheData.OtherDataFlag);
        }
        _updateStartPoint(value) {
            if (value !== this._startPoint && Laya.Vector3.equals(this._startPoint, value))
                return;
            value.cloneTo(this._startPoint);
            this._updateData(CacheData.DataFlag);
        }
        _updateEndPoint(value) {
            if (value !== this._endPoint && Laya.Vector3.equals(this._endPoint, value))
                return;
            value.cloneTo(this._endPoint);
            this._updateData(CacheData.DataFlag);
        }
        _updateData(flag) {
            this._cacheDatas.forEach(element => {
                element._setCacheFlag(flag);
            });
        }
        _initSurface(surface) {
            this.destroy();
            surface.forEach(element => {
                let cache = element._addModifileLink(this);
                cache._setUpdateDataHander(Laya.Handler.create(this, this._updateBuffer, undefined, false));
                this._cacheDatas.push(cache);
                cache._updateAreaFlag(this._areaFlags);
                cache._updateTransfrom(this._transfrom);
                cache._setCacheFlag(CacheData.DataFlag);
            });
        }
        _updateBuffer(cache, areaFlag) {
            if (cache._getCacheFlag(CacheData.DataFlag | CacheData.TransfromFlag)) {
                Laya.Vector3.transformCoordinate(this._startPoint, this._transfrom, this.globalStart);
                Laya.Vector3.transformCoordinate(this._endPoint, this._transfrom, this.globalEnd);
            }
            Laya.Vector3.min(this.globalStart, this.globalEnd, this._min);
            Laya.Vector3.max(this.globalStart, this.globalEnd, this._max);
            this._min.x -= this._width;
            this._min.z -= this._width;
            this._max.x += this._width;
            this._max.z += this._width;
            cache._cacheBound(this._min, this._max);
            const surface = cache._surface;
            surface._navMesh._addNavMeshLink(cache.id, this.globalStart, this.globalEnd, this._width, this._bidirectional, areaFlag);
            this._clearRegistrations();
            const manager = surface._manager;
            const starts = manager.getNavMeshSurfaces(this.globalStart).filter(s => s.agentType === this.agentType);
            const ends = manager.getNavMeshSurfaces(this.globalEnd).filter(s => s.agentType === this.agentType);
            this._startNavSurfaces = starts;
            this._endNavSurfaces = ends;
            for (const start of starts)
                for (const end of ends) {
                    if (start === end)
                        continue;
                    manager.regNavMeshLink(start, end, this);
                    this._regisgMaps.push([start, end]);
                }
        }
        _clearRegistrations() {
            for (const [start, end] of this._regisgMaps)
                start._manager.removeMeshLink(start, end, this);
            this._regisgMaps.length = 0;
            this._startNavSurfaces.length = 0;
            this._endNavSurfaces.length = 0;
        }
        getDistance() {
            return Laya.Vector3.distance(this._startPoint, this._endPoint);
        }
        destroy() {
            this._clearRegistrations();
            this._cacheDatas.forEach(element => element._surface._removeModifileLink(this));
            this._cacheDatas.length = 0;
        }
    }

    class NavModifleData extends BaseData {
        set datas(value) {
            if (this._datas == value)
                return;
            this._datas = value;
            this._refeashData();
        }
        get datas() {
            return this._datas;
        }
        constructor() {
            super();
        }
        _updateBuffer(cache, flag) {
            if (this._datas == null)
                return;
            if (cache._getCacheFlag(CacheData.DataFlag)) {
                this._bindData.init(this._datas.bindData);
            }
            if (cache._getCacheFlag(CacheData.DataFlag | CacheData.AreaFlag)) {
                this._bindData.setFlag(flag);
            }
            if (cache._getCacheFlag(CacheData.DataFlag | CacheData.TransfromFlag)) {
                this._bindData.transfromData(this._transfrom.elements);
                NavigationUtils._transfromBoundBox(this._datas._boundMin, this._datas._boundMax, this._transfrom, this._min, this._max);
                cache._cacheBound(this._min, this._max);
            }
        }
        _updateTileIndexs(cache, oldTileIndex, newTileIndexs) {
            let surface = cache._surface;
            oldTileIndex.forEach((index) => {
                var _a;
                (_a = surface._featureCache.get(index)) === null || _a === void 0 ? void 0 : _a.delete(this._bindData);
            });
            if (this._datas == null)
                return;
            newTileIndexs.forEach((index) => {
                surface._featureCache.get(index).add(this._bindData);
            });
        }
        _initSurface(surface) {
            this._destory();
            if (surface.length > 0)
                this._bindData = NavigationUtils._createdtNavTileCache();
            surface.forEach(element => {
                let cache = element._addModifileNavMesh(this);
                cache._setUpdateDataHander(Laya.Handler.create(this, this._updateBuffer, undefined, false));
                cache._setTileHander(Laya.Handler.create(this, this._updateTileIndexs, undefined, false));
                this._cacheDatas.push(cache);
                cache._updateAreaFlag(this._areaFlags);
                cache._updateTransfrom(this._transfrom);
                cache._setCacheFlag(CacheData.DataFlag);
            });
        }
        _destory() {
            this._cacheDatas.forEach(element => {
                let surface = element._surface;
                let oldTileIndex = element._titleIndex;
                oldTileIndex.forEach((index) => {
                    var _a;
                    (_a = surface._featureCache.get(index)) === null || _a === void 0 ? void 0 : _a.delete(this._bindData);
                });
                surface._removeModifileNavMesh(this);
            });
            this._cacheDatas = [];
            if (this._bindData) {
                NavigationUtils._freeLayaData(this._bindData);
                this._bindData = null;
            }
        }
    }

    exports.AreaMask = AreaMask;
    exports.BaseData = BaseData;
    exports.BaseNavAgent = BaseNavAgent;
    exports.BaseNavMesh = BaseNavMesh;
    exports.BaseNavMeshSurface = BaseNavMeshSurface;
    exports.BaseNavigationManager = BaseNavigationManager;
    exports.CacheData = CacheData;
    exports.ItemMapId = ItemMapId;
    exports.ModifierVolumeData = ModifierVolumeData;
    exports.NavAgentLinkAnim = NavAgentLinkAnim;
    exports.NavAreaFlag = NavAreaFlag;
    exports.NavMeshGrid = NavMeshGrid;
    exports.NavMeshLinkData = NavMeshLinkData;
    exports.NavModifleData = NavModifleData;
    exports.NavTileCache = NavTileCache;
    exports.NavTileData = NavTileData;
    exports.NavigationPathData = NavigationPathData;
    exports.NavigationUtils = NavigationUtils;
    exports.RecastConfig = RecastConfig;
    exports.TitleConfig = TitleConfig;

})(window.Laya = window.Laya || {}, Laya);
//# sourceMappingURL=laya.navMeshCommon.js.map

var Recast=(()=>{var Sr;var Wr=typeof document!="undefined"?(Sr=document.currentScript)==null?void 0:Sr.src:void 0;return(function(be={}){var Dr,l=be,Or,rr,Pe=new Promise((e,r)=>{Or=e,rr=r}),we=!0,jr=!1,kr=Object.assign({},l),Ce=[],Te="./this.program",Ae=(e,r)=>{throw r},F="";function Re(e){return l.locateFile?l.locateFile(e,F):F+e}var Ir,Ur;(we||jr)&&(jr?F=self.location.href:typeof document!="undefined"&&document.currentScript&&(F=document.currentScript.src),Wr&&(F=Wr),F.startsWith("blob:")?F="":F=F.substr(0,F.replace(/[?#].*/,"").lastIndexOf("/")+1),Ir=e=>fetch(e,{credentials:"same-origin"}).then(r=>r.ok?r.arrayBuffer():Promise.reject(new Error(r.status+" : "+r.url))));var Rn=l.print||console.log.bind(console),z=l.printErr||console.error.bind(console);Object.assign(l,kr),kr=null,l.arguments&&(Ce=l.arguments),l.thisProgram&&(Te=l.thisProgram),l.quit&&(Ae=l.quit);var q;l.wasmBinary&&(q=l.wasmBinary);var er,Vr=!1,Fe,k,T,V,G,H,g,Hr,xr;function Mr(){var e=er.buffer;l.HEAP8=k=new Int8Array(e),l.HEAP16=V=new Int16Array(e),l.HEAPU8=T=new Uint8Array(e),l.HEAPU16=G=new Uint16Array(e),l.HEAP32=H=new Int32Array(e),l.HEAPU32=g=new Uint32Array(e),l.HEAPF32=Hr=new Float32Array(e),l.HEAPF64=xr=new Float64Array(e)}var Lr=[],Br=[],zr=[],Ee=!1;function We(){if(l.preRun)for(typeof l.preRun=="function"&&(l.preRun=[l.preRun]);l.preRun.length;)Oe(l.preRun.shift());gr(Lr)}function Se(){Ee=!0,gr(Br)}function De(){if(l.postRun)for(typeof l.postRun=="function"&&(l.postRun=[l.postRun]);l.postRun.length;)ke(l.postRun.shift());gr(zr)}function Oe(e){Lr.unshift(e)}function je(e){Br.unshift(e)}function ke(e){zr.unshift(e)}var I=0,hr=null,K=null;function Ie(e){var r;I++,(r=l.monitorRunDependencies)==null||r.call(l,I)}function Ue(e){var t;if(I--,(t=l.monitorRunDependencies)==null||t.call(l,I),I==0&&(hr!==null&&(clearInterval(hr),hr=null),K)){var r=K;K=null,r()}}function qr(e){var t;(t=l.onAbort)==null||t.call(l,e),e="Aborted("+e+")",z(e),Vr=!0,Fe=1,e+=". Build with -sASSERTIONS for more info.";var r=new WebAssembly.RuntimeError(e);throw rr(r),r}var Ve="data:application/octet-stream;base64,",Gr=e=>e.startsWith(Ve);function He(){var e="recast-navigation-wasm.wasm";return Gr(e)?e:Re(e)}var tr;function Kr(e){if(e==tr&&q)return new Uint8Array(q);if(Ur)return Ur(e);throw"both async and sync fetching of the wasm failed"}function xe(e){return q?Promise.resolve().then(()=>Kr(e)):Ir(e).then(r=>new Uint8Array(r),()=>Kr(e))}function Qr(e,r,t){return xe(e).then(n=>WebAssembly.instantiate(n,r)).then(t,n=>{z(`failed to asynchronously prepare wasm: ${n}`),qr(n)})}function Me(e,r,t,n){return!e&&typeof WebAssembly.instantiateStreaming=="function"&&!Gr(r)&&typeof fetch=="function"?fetch(r,{credentials:"same-origin"}).then(a=>{var s=WebAssembly.instantiateStreaming(a,t);return s.then(n,function(o){return z(`wasm streaming compile failed: ${o}`),z("falling back to ArrayBuffer instantiation"),Qr(r,t,n)})}):Qr(r,t,n)}function Le(){return{a:Tn}}function Be(){var e=Le();function r(n,a){return S=n.exports,er=S.O,Mr(),ae=S.Q,je(S.P),Ue("wasm-instantiate"),S}Ie("wasm-instantiate");function t(n){r(n.instance)}if(l.instantiateWasm)try{return l.instantiateWasm(e,r)}catch(n){z(`Module.instantiateWasm callback failed with error: ${n}`),rr(n)}return tr||(tr=He()),Me(q,tr,e,t).catch(rr),{}}var gr=e=>{for(;e.length>0;)e.shift()(l)},Fn=l.noExitRuntime||!0;class ze{constructor(r){this.excPtr=r,this.ptr=r-24}set_type(r){g[this.ptr+4>>2]=r}get_type(){return g[this.ptr+4>>2]}set_destructor(r){g[this.ptr+8>>2]=r}get_destructor(){return g[this.ptr+8>>2]}set_caught(r){r=r?1:0,k[this.ptr+12]=r}get_caught(){return k[this.ptr+12]!=0}set_rethrown(r){r=r?1:0,k[this.ptr+13]=r}get_rethrown(){return k[this.ptr+13]!=0}init(r,t){this.set_adjusted_ptr(0),this.set_type(r),this.set_destructor(t)}set_adjusted_ptr(r){g[this.ptr+16>>2]=r}get_adjusted_ptr(){return g[this.ptr+16>>2]}get_exception_ptr(){var r=ge(this.get_type());if(r)return g[this.excPtr>>2];var t=this.get_adjusted_ptr();return t!==0?t:this.excPtr}}var Jr=0,qe=0,Ge=(e,r,t)=>{var n=new ze(e);throw n.init(r,t),Jr=e,qe++,Jr},Ke=()=>{qr("")},nr={},Q=e=>{for(;e.length;){var r=e.pop(),t=e.pop();t(r)}};function x(e){return this.fromWireType(g[e>>2])}var M={},U={},ar={},Xr,ir=e=>{throw new Xr(e)},E=(e,r,t)=>{e.forEach(function(i){ar[i]=r});function n(i){var u=t(i);u.length!==e.length&&ir("Mismatched type converter count");for(var f=0;f<e.length;++f)W(e[f],u[f])}var a=new Array(r.length),s=[],o=0;r.forEach((i,u)=>{U.hasOwnProperty(i)?a[u]=U[i]:(s.push(i),M.hasOwnProperty(i)||(M[i]=[]),M[i].push(()=>{a[u]=U[i],++o,o===s.length&&n(a)}))}),s.length===0&&n(a)},Qe=e=>{var r=nr[e];delete nr[e];var t=r.elements,n=t.length,a=t.map(i=>i.getterReturnType).concat(t.map(i=>i.setterArgumentType)),s=r.rawConstructor,o=r.rawDestructor;E([e],a,i=>(t.forEach((u,f)=>{var c=i[f],v=u.getter,p=u.getterContext,h=i[f+n],_=u.setter,C=u.setterContext;u.read=b=>c.fromWireType(v(p,b)),u.write=(b,y)=>{var A=[];_(C,b,h.toWireType(A,y)),Q(A)}}),[{name:r.name,fromWireType:u=>{for(var f=new Array(n),c=0;c<n;++c)f[c]=t[c].read(u);return o(u),f},toWireType:(u,f)=>{if(n!==f.length)throw new TypeError(`Incorrect number of tuple elements for ${r.name}: expected=${n}, actual=${f.length}`);for(var c=s(),v=0;v<n;++v)t[v].write(c,f[v]);return u!==null&&u.push(o,c),c},argPackAdvance:R,readValueFromPointer:x,destructorFunction:o}]))},sr={},Je=e=>{var r=sr[e];delete sr[e];var t=r.rawConstructor,n=r.rawDestructor,a=r.fields,s=a.map(o=>o.getterReturnType).concat(a.map(o=>o.setterArgumentType));E([e],s,o=>{var i={};return a.forEach((u,f)=>{var c=u.fieldName,v=o[f],p=u.getter,h=u.getterContext,_=o[f+a.length],C=u.setter,b=u.setterContext;i[c]={read:y=>v.fromWireType(p(h,y)),write:(y,A)=>{var P=[];C(b,y,_.toWireType(P,A)),Q(P)}}}),[{name:r.name,fromWireType:u=>{var f={};for(var c in i)f[c]=i[c].read(u);return n(u),f},toWireType:(u,f)=>{for(var c in i)if(!(c in f))throw new TypeError(`Missing field: "${c}"`);var v=t();for(c in i)i[c].write(v,f[c]);return u!==null&&u.push(n,v),v},argPackAdvance:R,readValueFromPointer:x,destructorFunction:n}]})},Xe=(e,r,t,n,a)=>{},Ze=()=>{for(var e=new Array(256),r=0;r<256;++r)e[r]=String.fromCharCode(r);Zr=e},Zr,m=e=>{for(var r="",t=e;T[t];)r+=Zr[T[t++]];return r},L,d=e=>{throw new L(e)};function Ye(e,r,t={}){var n=r.name;if(e||d(`type "${n}" must have a positive integer typeid pointer`),U.hasOwnProperty(e)){if(t.ignoreDuplicateRegistrations)return;d(`Cannot register type '${n}' twice`)}if(U[e]=r,delete ar[e],M.hasOwnProperty(e)){var a=M[e];delete M[e],a.forEach(s=>s())}}function W(e,r,t={}){if(!("argPackAdvance"in r))throw new TypeError("registerType registeredInstance requires argPackAdvance");return Ye(e,r,t)}var R=8,Ne=(e,r,t,n)=>{r=m(r),W(e,{name:r,fromWireType:function(a){return!!a},toWireType:function(a,s){return s?t:n},argPackAdvance:R,readValueFromPointer:function(a){return this.fromWireType(T[a])},destructorFunction:null})},rt=e=>({count:e.count,deleteScheduled:e.deleteScheduled,preservePointerOnDelete:e.preservePointerOnDelete,ptr:e.ptr,ptrType:e.ptrType,smartPtr:e.smartPtr,smartPtrType:e.smartPtrType}),_r=e=>{function r(t){return t.$$.ptrType.registeredClass.name}d(r(e)+" instance already deleted")},yr=!1,Yr=e=>{},et=e=>{e.smartPtr?e.smartPtrType.rawDestructor(e.smartPtr):e.ptrType.registeredClass.rawDestructor(e.ptr)},Nr=e=>{e.count.value-=1;var r=e.count.value===0;r&&et(e)},re=(e,r,t)=>{if(r===t)return e;if(t.baseClass===void 0)return null;var n=re(e,r,t.baseClass);return n===null?null:t.downcast(n)},ee={},tt=()=>Object.keys(Z).length,nt=()=>{var e=[];for(var r in Z)Z.hasOwnProperty(r)&&e.push(Z[r]);return e},J=[],mr=()=>{for(;J.length;){var e=J.pop();e.$$.deleteScheduled=!1,e.delete()}},X,at=e=>{X=e,J.length&&X&&X(mr)},it=()=>{l.getInheritedInstanceCount=tt,l.getLiveInheritedInstances=nt,l.flushPendingDeletes=mr,l.setDelayFunction=at},Z={},st=(e,r)=>{for(r===void 0&&d("ptr should not be undefined");e.baseClass;)r=e.upcast(r),e=e.baseClass;return r},ot=(e,r)=>(r=st(e,r),Z[r]),or=(e,r)=>{(!r.ptrType||!r.ptr)&&ir("makeClassHandle requires ptr and ptrType");var t=!!r.smartPtrType,n=!!r.smartPtr;return t!==n&&ir("Both smartPtrType and smartPtr must be specified"),r.count={value:1},Y(Object.create(e,{$$:{value:r,writable:!0}}))};function ut(e){var r=this.getPointee(e);if(!r)return this.destructor(e),null;var t=ot(this.registeredClass,r);if(t!==void 0){if(t.$$.count.value===0)return t.$$.ptr=r,t.$$.smartPtr=e,t.clone();var n=t.clone();return this.destructor(e),n}function a(){return this.isSmartPointer?or(this.registeredClass.instancePrototype,{ptrType:this.pointeeType,ptr:r,smartPtrType:this,smartPtr:e}):or(this.registeredClass.instancePrototype,{ptrType:this,ptr:e})}var s=this.registeredClass.getActualType(r),o=ee[s];if(!o)return a.call(this);var i;this.isConst?i=o.constPointerType:i=o.pointerType;var u=re(r,this.registeredClass,i.registeredClass);return u===null?a.call(this):this.isSmartPointer?or(i.registeredClass.instancePrototype,{ptrType:i,ptr:u,smartPtrType:this,smartPtr:e}):or(i.registeredClass.instancePrototype,{ptrType:i,ptr:u})}var Y=e=>typeof FinalizationRegistry=="undefined"?(Y=r=>r,e):(yr=new FinalizationRegistry(r=>{Nr(r.$$)}),Y=r=>{var t=r.$$,n=!!t.smartPtr;if(n){var a={$$:t};yr.register(r,a,r)}return r},Yr=r=>yr.unregister(r),Y(e)),lt=()=>{Object.assign(ur.prototype,{isAliasOf(e){if(!(this instanceof ur)||!(e instanceof ur))return!1;var r=this.$$.ptrType.registeredClass,t=this.$$.ptr;e.$$=e.$$;for(var n=e.$$.ptrType.registeredClass,a=e.$$.ptr;r.baseClass;)t=r.upcast(t),r=r.baseClass;for(;n.baseClass;)a=n.upcast(a),n=n.baseClass;return r===n&&t===a},clone(){if(this.$$.ptr||_r(this),this.$$.preservePointerOnDelete)return this.$$.count.value+=1,this;var e=Y(Object.create(Object.getPrototypeOf(this),{$$:{value:rt(this.$$)}}));return e.$$.count.value+=1,e.$$.deleteScheduled=!1,e},delete(){this.$$.ptr||_r(this),this.$$.deleteScheduled&&!this.$$.preservePointerOnDelete&&d("Object already scheduled for deletion"),Yr(this),Nr(this.$$),this.$$.preservePointerOnDelete||(this.$$.smartPtr=void 0,this.$$.ptr=void 0)},isDeleted(){return!this.$$.ptr},deleteLater(){return this.$$.ptr||_r(this),this.$$.deleteScheduled&&!this.$$.preservePointerOnDelete&&d("Object already scheduled for deletion"),J.push(this),J.length===1&&X&&X(mr),this.$$.deleteScheduled=!0,this}})};function ur(){}var N=(e,r)=>Object.defineProperty(r,"name",{value:e}),te=(e,r,t)=>{if(e[r].overloadTable===void 0){var n=e[r];e[r]=function(...a){return e[r].overloadTable.hasOwnProperty(a.length)||d(`Function '${t}' called with an invalid number of arguments (${a.length}) - expects one of (${e[r].overloadTable})!`),e[r].overloadTable[a.length].apply(this,a)},e[r].overloadTable=[],e[r].overloadTable[n.argCount]=n}},$r=(e,r,t)=>{l.hasOwnProperty(e)?((t===void 0||l[e].overloadTable!==void 0&&l[e].overloadTable[t]!==void 0)&&d(`Cannot register public name '${e}' twice`),te(l,e,e),l.hasOwnProperty(t)&&d(`Cannot register multiple overloads of a function with the same number of arguments (${t})!`),l[e].overloadTable[t]=r):(l[e]=r,t!==void 0&&(l[e].numArguments=t))},ft=48,ct=57,vt=e=>{if(e===void 0)return"_unknown";e=e.replace(/[^a-zA-Z0-9_]/g,"$");var r=e.charCodeAt(0);return r>=ft&&r<=ct?`_${e}`:e};function dt(e,r,t,n,a,s,o,i){this.name=e,this.constructor=r,this.instancePrototype=t,this.rawDestructor=n,this.baseClass=a,this.getActualType=s,this.upcast=o,this.downcast=i,this.pureVirtualFunctions=[]}var lr=(e,r,t)=>{for(;r!==t;)r.upcast||d(`Expected null or instance of ${t.name}, got an instance of ${r.name}`),e=r.upcast(e),r=r.baseClass;return e};function pt(e,r){if(r===null)return this.isReference&&d(`null is not a valid ${this.name}`),0;r.$$||d(`Cannot pass "${Tr(r)}" as a ${this.name}`),r.$$.ptr||d(`Cannot pass deleted object as a pointer of type ${this.name}`);var t=r.$$.ptrType.registeredClass,n=lr(r.$$.ptr,t,this.registeredClass);return n}function ht(e,r){var t;if(r===null)return this.isReference&&d(`null is not a valid ${this.name}`),this.isSmartPointer?(t=this.rawConstructor(),e!==null&&e.push(this.rawDestructor,t),t):0;(!r||!r.$$)&&d(`Cannot pass "${Tr(r)}" as a ${this.name}`),r.$$.ptr||d(`Cannot pass deleted object as a pointer of type ${this.name}`),!this.isConst&&r.$$.ptrType.isConst&&d(`Cannot convert argument of type ${r.$$.smartPtrType?r.$$.smartPtrType.name:r.$$.ptrType.name} to parameter type ${this.name}`);var n=r.$$.ptrType.registeredClass;if(t=lr(r.$$.ptr,n,this.registeredClass),this.isSmartPointer)switch(r.$$.smartPtr===void 0&&d("Passing raw pointer to smart pointer is illegal"),this.sharingPolicy){case 0:r.$$.smartPtrType===this?t=r.$$.smartPtr:d(`Cannot convert argument of type ${r.$$.smartPtrType?r.$$.smartPtrType.name:r.$$.ptrType.name} to parameter type ${this.name}`);break;case 1:t=r.$$.smartPtr;break;case 2:if(r.$$.smartPtrType===this)t=r.$$.smartPtr;else{var a=r.clone();t=this.rawShare(t,$.toHandle(()=>a.delete())),e!==null&&e.push(this.rawDestructor,t)}break;default:d("Unsupporting sharing policy")}return t}function gt(e,r){if(r===null)return this.isReference&&d(`null is not a valid ${this.name}`),0;r.$$||d(`Cannot pass "${Tr(r)}" as a ${this.name}`),r.$$.ptr||d(`Cannot pass deleted object as a pointer of type ${this.name}`),r.$$.ptrType.isConst&&d(`Cannot convert argument of type ${r.$$.ptrType.name} to parameter type ${this.name}`);var t=r.$$.ptrType.registeredClass,n=lr(r.$$.ptr,t,this.registeredClass);return n}var _t=()=>{Object.assign(fr.prototype,{getPointee(e){return this.rawGetPointee&&(e=this.rawGetPointee(e)),e},destructor(e){var r;(r=this.rawDestructor)==null||r.call(this,e)},argPackAdvance:R,readValueFromPointer:x,fromWireType:ut})};function fr(e,r,t,n,a,s,o,i,u,f,c){this.name=e,this.registeredClass=r,this.isReference=t,this.isConst=n,this.isSmartPointer=a,this.pointeeType=s,this.sharingPolicy=o,this.rawGetPointee=i,this.rawConstructor=u,this.rawShare=f,this.rawDestructor=c,!a&&r.baseClass===void 0?n?(this.toWireType=pt,this.destructorFunction=null):(this.toWireType=gt,this.destructorFunction=null):this.toWireType=ht}var ne=(e,r,t)=>{l.hasOwnProperty(e)||ir("Replacing nonexistent public symbol"),l[e].overloadTable!==void 0&&t!==void 0?l[e].overloadTable[t]=r:(l[e]=r,l[e].argCount=t)},yt=(e,r,t)=>{e=e.replace(/p/g,"i");var n=l["dynCall_"+e];return n(r,...t)},cr=[],ae,ie=e=>{var r=cr[e];return r||(e>=cr.length&&(cr.length=e+1),cr[e]=r=ae.get(e)),r},mt=(e,r,t=[])=>{if(e.includes("j"))return yt(e,r,t);var n=ie(r)(...t);return n},$t=(e,r)=>(...t)=>mt(e,r,t),w=(e,r)=>{e=m(e);function t(){return e.includes("j")?$t(e,r):ie(r)}var n=t();return typeof n!="function"&&d(`unknown function pointer with signature ${e}: ${r}`),n},bt=(e,r)=>{var t=N(r,function(n){this.name=r,this.message=n;var a=new Error(n).stack;a!==void 0&&(this.stack=this.toString()+`
`+a.replace(/^Error(:[^\n]*)?\n/,""))});return t.prototype=Object.create(e.prototype),t.prototype.constructor=t,t.prototype.toString=function(){return this.message===void 0?this.name:`${this.name}: ${this.message}`},t},se,oe=e=>{var r=he(e),t=m(r);return O(r),t},B=(e,r)=>{var t=[],n={};function a(s){if(!n[s]&&!U[s]){if(ar[s]){ar[s].forEach(a);return}t.push(s),n[s]=!0}}throw r.forEach(a),new se(`${e}: `+t.map(oe).join([", "]))},Pt=(e,r,t,n,a,s,o,i,u,f,c,v,p)=>{c=m(c),s=w(a,s),i&&(i=w(o,i)),f&&(f=w(u,f)),p=w(v,p);var h=vt(c);$r(h,function(){B(`Cannot construct ${c} due to unbound types`,[n])}),E([e,r,t],n?[n]:[],_=>{var ye,me;_=_[0];var C,b;n?(C=_.registeredClass,b=C.instancePrototype):b=ur.prototype;var y=N(c,function(...Er){if(Object.getPrototypeOf(this)!==A)throw new L("Use 'new' to construct "+c);if(P.constructor_body===void 0)throw new L(c+" has no accessible constructor");var $e=P.constructor_body[Er.length];if($e===void 0)throw new L(`Tried to invoke ctor of ${c} with invalid number of parameters (${Er.length}) - expected (${Object.keys(P.constructor_body).toString()}) parameters instead!`);return $e.apply(this,Er)}),A=Object.create(b,{constructor:{value:y}});y.prototype=A;var P=new dt(c,y,A,p,C,s,i,f);P.baseClass&&((me=(ye=P.baseClass).__derivedClasses)!=null||(ye.__derivedClasses=[]),P.baseClass.__derivedClasses.push(P));var Fr=new fr(c,P,!0,!1,!1),j=new fr(c+"*",P,!1,!1,!1),pr=new fr(c+" const*",P,!1,!0,!1);return ee[e]={pointerType:j,constPointerType:pr},ne(h,y),[Fr,j,pr]})},br=(e,r)=>{for(var t=[],n=0;n<e;n++)t.push(g[r+n*4>>2]);return t};function wt(e){for(var r=1;r<e.length;++r)if(e[r]!==null&&e[r].destructorFunction===void 0)return!0;return!1}function Pr(e,r,t,n,a,s){var o=r.length;o<2&&d("argTypes array size mismatch! Must at least get return value and 'this' types!");var i=r[1]!==null&&t!==null,u=wt(r),f=r[0].name!=="void",c=o-2,v=new Array(c),p=[],h=[],_=function(...C){C.length!==c&&d(`function ${e} called with ${C.length} arguments, expected ${c}`),h.length=0;var b;p.length=i?2:1,p[0]=a,i&&(b=r[1].toWireType(h,this),p[1]=b);for(var y=0;y<c;++y)v[y]=r[y+2].toWireType(h,C[y]),p.push(v[y]);var A=n(...p);function P(Fr){if(u)Q(h);else for(var j=i?1:2;j<r.length;j++){var pr=j===1?b:v[j-2];r[j].destructorFunction!==null&&r[j].destructorFunction(pr)}if(f)return r[0].fromWireType(Fr)}return P(A)};return N(e,_)}var Ct=(e,r,t,n,a,s)=>{var o=br(r,t);a=w(n,a),E([],[e],i=>{i=i[0];var u=`constructor ${i.name}`;if(i.registeredClass.constructor_body===void 0&&(i.registeredClass.constructor_body=[]),i.registeredClass.constructor_body[r-1]!==void 0)throw new L(`Cannot register multiple constructors with identical number of parameters (${r-1}) for class '${i.name}'! Overload resolution is currently only performed using the parameter count, not actual type info!`);return i.registeredClass.constructor_body[r-1]=()=>{B(`Cannot construct ${i.name} due to unbound types`,o)},E([],o,f=>(f.splice(1,0,null),i.registeredClass.constructor_body[r-1]=Pr(u,f,null,a,s),[])),[]})},ue=e=>{e=e.trim();const r=e.indexOf("(");return r!==-1?e.substr(0,r):e},Tt=(e,r,t,n,a,s,o,i,u)=>{var f=br(t,n);r=m(r),r=ue(r),s=w(a,s),E([],[e],c=>{c=c[0];var v=`${c.name}.${r}`;r.startsWith("@@")&&(r=Symbol[r.substring(2)]),i&&c.registeredClass.pureVirtualFunctions.push(r);function p(){B(`Cannot call ${v} due to unbound types`,f)}var h=c.registeredClass.instancePrototype,_=h[r];return _===void 0||_.overloadTable===void 0&&_.className!==c.name&&_.argCount===t-2?(p.argCount=t-2,p.className=c.name,h[r]=p):(te(h,r,v),h[r].overloadTable[t-2]=p),E([],f,C=>{var b=Pr(v,C,c,s,o,u);return h[r].overloadTable===void 0?(b.argCount=t-2,h[r]=b):h[r].overloadTable[t-2]=b,[]}),[]})},le=(e,r,t)=>(e instanceof Object||d(`${t} with invalid "this": ${e}`),e instanceof r.registeredClass.constructor||d(`${t} incompatible with "this" of type ${e.constructor.name}`),e.$$.ptr||d(`cannot call emscripten binding method ${t} on deleted object`),lr(e.$$.ptr,e.$$.ptrType.registeredClass,r.registeredClass)),At=(e,r,t,n,a,s,o,i,u,f)=>{r=m(r),a=w(n,a),E([],[e],c=>{c=c[0];var v=`${c.name}.${r}`,p={get(){B(`Cannot access ${v} due to unbound types`,[t,o])},enumerable:!0,configurable:!0};return u?p.set=()=>B(`Cannot access ${v} due to unbound types`,[t,o]):p.set=h=>d(v+" is a read-only property"),Object.defineProperty(c.registeredClass.instancePrototype,r,p),E([],u?[t,o]:[t],h=>{var _=h[0],C={get(){var y=le(this,c,v+" getter");return _.fromWireType(a(s,y))},enumerable:!0};if(u){u=w(i,u);var b=h[1];C.set=function(y){var A=le(this,c,v+" setter"),P=[];u(f,A,b.toWireType(P,y)),Q(P)}}return Object.defineProperty(c.registeredClass.instancePrototype,r,C),[]}),[]})},wr=[],D=[],Cr=e=>{e>9&&--D[e+1]===0&&(D[e]=void 0,wr.push(e))},Rt=()=>D.length/2-5-wr.length,Ft=()=>{D.push(0,1,void 0,1,null,1,!0,1,!1,1),l.count_emval_handles=Rt},$={toValue:e=>(e||d("Cannot use deleted val. handle = "+e),D[e]),toHandle:e=>{switch(e){case void 0:return 2;case null:return 4;case!0:return 6;case!1:return 8;default:{const r=wr.pop()||D.length;return D[r]=e,D[r+1]=1,r}}}},Et={name:"emscripten::val",fromWireType:e=>{var r=$.toValue(e);return Cr(e),r},toWireType:(e,r)=>$.toHandle(r),argPackAdvance:R,readValueFromPointer:x,destructorFunction:null},fe=e=>W(e,Et),Wt=(e,r,t)=>{switch(r){case 1:return t?function(n){return this.fromWireType(k[n])}:function(n){return this.fromWireType(T[n])};case 2:return t?function(n){return this.fromWireType(V[n>>1])}:function(n){return this.fromWireType(G[n>>1])};case 4:return t?function(n){return this.fromWireType(H[n>>2])}:function(n){return this.fromWireType(g[n>>2])};default:throw new TypeError(`invalid integer width (${r}): ${e}`)}},St=(e,r,t,n)=>{r=m(r);function a(){}a.values={},W(e,{name:r,constructor:a,fromWireType:function(s){return this.constructor.values[s]},toWireType:(s,o)=>o.value,argPackAdvance:R,readValueFromPointer:Wt(r,t,n),destructorFunction:null}),$r(r,a)},vr=(e,r)=>{var t=U[e];return t===void 0&&d(`${r} has unknown type ${oe(e)}`),t},Dt=(e,r,t)=>{var n=vr(e,"enum");r=m(r);var a=n.constructor,s=Object.create(n.constructor.prototype,{value:{value:t},constructor:{value:N(`${n.name}_${r}`,function(){})}});a.values[t]=s,a[r]=s},Tr=e=>{if(e===null)return"null";var r=typeof e;return r==="object"||r==="array"||r==="function"?e.toString():""+e},Ot=(e,r)=>{switch(r){case 4:return function(t){return this.fromWireType(Hr[t>>2])};case 8:return function(t){return this.fromWireType(xr[t>>3])};default:throw new TypeError(`invalid float width (${r}): ${e}`)}},jt=(e,r,t)=>{r=m(r),W(e,{name:r,fromWireType:n=>n,toWireType:(n,a)=>a,argPackAdvance:R,readValueFromPointer:Ot(r,t),destructorFunction:null})},kt=(e,r,t,n,a,s,o)=>{var i=br(r,t);e=m(e),e=ue(e),a=w(n,a),$r(e,function(){B(`Cannot call ${e} due to unbound types`,i)},r-1),E([],i,u=>{var f=[u[0],null].concat(u.slice(1));return ne(e,Pr(e,f,null,a,s,o),r-1),[]})},It=(e,r,t)=>{switch(r){case 1:return t?n=>k[n]:n=>T[n];case 2:return t?n=>V[n>>1]:n=>G[n>>1];case 4:return t?n=>H[n>>2]:n=>g[n>>2];default:throw new TypeError(`invalid integer width (${r}): ${e}`)}},Ut=(e,r,t,n,a)=>{r=m(r),a===-1&&(a=4294967295);var s=c=>c;if(n===0){var o=32-8*t;s=c=>c<<o>>>o}var i=r.includes("unsigned"),u=(c,v)=>{},f;i?f=function(c,v){return u(v,this.name),v>>>0}:f=function(c,v){return u(v,this.name),v},W(e,{name:r,fromWireType:s,toWireType:f,argPackAdvance:R,readValueFromPointer:It(r,t,n!==0),destructorFunction:null})},Vt=(e,r,t)=>{var n=[Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array],a=n[r];function s(o){var i=g[o>>2],u=g[o+4>>2];return new a(k.buffer,u,i)}t=m(t),W(e,{name:t,fromWireType:s,argPackAdvance:R,readValueFromPointer:s},{ignoreDuplicateRegistrations:!0})},Ht=(e,r)=>{fe(e)},xt=(e,r,t,n)=>{if(!(n>0))return 0;for(var a=t,s=t+n-1,o=0;o<e.length;++o){var i=e.charCodeAt(o);if(i>=55296&&i<=57343){var u=e.charCodeAt(++o);i=65536+((i&1023)<<10)|u&1023}if(i<=127){if(t>=s)break;r[t++]=i}else if(i<=2047){if(t+1>=s)break;r[t++]=192|i>>6,r[t++]=128|i&63}else if(i<=65535){if(t+2>=s)break;r[t++]=224|i>>12,r[t++]=128|i>>6&63,r[t++]=128|i&63}else{if(t+3>=s)break;r[t++]=240|i>>18,r[t++]=128|i>>12&63,r[t++]=128|i>>6&63,r[t++]=128|i&63}}return r[t]=0,t-a},Mt=(e,r,t)=>xt(e,T,r,t),Lt=e=>{for(var r=0,t=0;t<e.length;++t){var n=e.charCodeAt(t);n<=127?r++:n<=2047?r+=2:n>=55296&&n<=57343?(r+=4,++t):r+=3}return r},ce=typeof TextDecoder!="undefined"?new TextDecoder:void 0,Bt=(e,r,t)=>{for(var n=r+t,a=r;e[a]&&!(a>=n);)++a;if(a-r>16&&e.buffer&&ce)return ce.decode(e.subarray(r,a));for(var s="";r<a;){var o=e[r++];if(!(o&128)){s+=String.fromCharCode(o);continue}var i=e[r++]&63;if((o&224)==192){s+=String.fromCharCode((o&31)<<6|i);continue}var u=e[r++]&63;if((o&240)==224?o=(o&15)<<12|i<<6|u:o=(o&7)<<18|i<<12|u<<6|e[r++]&63,o<65536)s+=String.fromCharCode(o);else{var f=o-65536;s+=String.fromCharCode(55296|f>>10,56320|f&1023)}}return s},zt=(e,r)=>e?Bt(T,e,r):"",qt=(e,r)=>{r=m(r);var t=r==="std::string";W(e,{name:r,fromWireType(n){var a=g[n>>2],s=n+4,o;if(t)for(var i=s,u=0;u<=a;++u){var f=s+u;if(u==a||T[f]==0){var c=f-i,v=zt(i,c);o===void 0?o=v:(o+="\0",o+=v),i=f+1}}else{for(var p=new Array(a),u=0;u<a;++u)p[u]=String.fromCharCode(T[s+u]);o=p.join("")}return O(n),o},toWireType(n,a){a instanceof ArrayBuffer&&(a=new Uint8Array(a));var s,o=typeof a=="string";o||a instanceof Uint8Array||a instanceof Uint8ClampedArray||a instanceof Int8Array||d("Cannot pass non-string to std::string"),t&&o?s=Lt(a):s=a.length;var i=Rr(4+s+1),u=i+4;if(g[i>>2]=s,t&&o)Mt(a,u,s+1);else if(o)for(var f=0;f<s;++f){var c=a.charCodeAt(f);c>255&&(O(u),d("String has UTF-16 code units that do not fit in 8 bits")),T[u+f]=c}else for(var f=0;f<s;++f)T[u+f]=a[f];return n!==null&&n.push(O,i),i},argPackAdvance:R,readValueFromPointer:x,destructorFunction(n){O(n)}})},ve=typeof TextDecoder!="undefined"?new TextDecoder("utf-16le"):void 0,Gt=(e,r)=>{for(var t=e,n=t>>1,a=n+r/2;!(n>=a)&&G[n];)++n;if(t=n<<1,t-e>32&&ve)return ve.decode(T.subarray(e,t));for(var s="",o=0;!(o>=r/2);++o){var i=V[e+o*2>>1];if(i==0)break;s+=String.fromCharCode(i)}return s},Kt=(e,r,t)=>{if(t!=null||(t=2147483647),t<2)return 0;t-=2;for(var n=r,a=t<e.length*2?t/2:e.length,s=0;s<a;++s){var o=e.charCodeAt(s);V[r>>1]=o,r+=2}return V[r>>1]=0,r-n},Qt=e=>e.length*2,Jt=(e,r)=>{for(var t=0,n="";!(t>=r/4);){var a=H[e+t*4>>2];if(a==0)break;if(++t,a>=65536){var s=a-65536;n+=String.fromCharCode(55296|s>>10,56320|s&1023)}else n+=String.fromCharCode(a)}return n},Xt=(e,r,t)=>{if(t!=null||(t=2147483647),t<4)return 0;for(var n=r,a=n+t-4,s=0;s<e.length;++s){var o=e.charCodeAt(s);if(o>=55296&&o<=57343){var i=e.charCodeAt(++s);o=65536+((o&1023)<<10)|i&1023}if(H[r>>2]=o,r+=4,r+4>a)break}return H[r>>2]=0,r-n},Zt=e=>{for(var r=0,t=0;t<e.length;++t){var n=e.charCodeAt(t);n>=55296&&n<=57343&&++t,r+=4}return r},Yt=(e,r,t)=>{t=m(t);var n,a,s,o;r===2?(n=Gt,a=Kt,o=Qt,s=i=>G[i>>1]):r===4&&(n=Jt,a=Xt,o=Zt,s=i=>g[i>>2]),W(e,{name:t,fromWireType:i=>{for(var u=g[i>>2],f,c=i+4,v=0;v<=u;++v){var p=i+4+v*r;if(v==u||s(p)==0){var h=p-c,_=n(c,h);f===void 0?f=_:(f+="\0",f+=_),c=p+r}}return O(i),f},toWireType:(i,u)=>{typeof u!="string"&&d(`Cannot pass non-string to C++ string type ${t}`);var f=o(u),c=Rr(4+f+r);return g[c>>2]=f/r,a(u,c+4,f+r),i!==null&&i.push(O,c),c},argPackAdvance:R,readValueFromPointer:x,destructorFunction(i){O(i)}})},Nt=(e,r,t,n,a,s)=>{nr[e]={name:m(r),rawConstructor:w(t,n),rawDestructor:w(a,s),elements:[]}},rn=(e,r,t,n,a,s,o,i,u)=>{nr[e].elements.push({getterReturnType:r,getter:w(t,n),getterContext:a,setterArgumentType:s,setter:w(o,i),setterContext:u})},en=(e,r,t,n,a,s)=>{sr[e]={name:m(r),rawConstructor:w(t,n),rawDestructor:w(a,s),fields:[]}},tn=(e,r,t,n,a,s,o,i,u,f)=>{sr[e].fields.push({fieldName:m(r),getterReturnType:t,getter:w(n,a),getterContext:s,setterArgumentType:o,setter:w(i,u),setterContext:f})},nn=(e,r)=>{r=m(r),W(e,{isVoid:!0,name:r,argPackAdvance:0,fromWireType:()=>{},toWireType:(t,n)=>{}})},an=(e,r,t)=>T.copyWithin(e,r,r+t),de=(e,r,t)=>{var n=[],a=e.toWireType(n,t);return n.length&&(g[r>>2]=$.toHandle(n)),a},sn=(e,r,t)=>(e=$.toValue(e),r=vr(r,"emval::as"),de(r,t,e)),on={},pe=e=>{var r=on[e];return r===void 0?m(e):r},Ar=[],un=(e,r,t,n,a)=>(e=Ar[e],r=$.toValue(r),t=pe(t),e(r,r[t],n,a)),ln=e=>{var r=Ar.length;return Ar.push(e),r},fn=(e,r)=>{for(var t=new Array(e),n=0;n<e;++n)t[n]=vr(g[r+n*4>>2],"parameter "+n);return t},cn=Reflect.construct,vn=(e,r,t)=>{var n=fn(e,r),a=n.shift();e--;var s=new Array(e),o=(u,f,c,v)=>{for(var p=0,h=0;h<e;++h)s[h]=n[h].readValueFromPointer(v+p),p+=n[h].argPackAdvance;var _=t===1?cn(f,s):f.apply(u,s);return de(a,c,_)},i=`methodCaller<(${n.map(u=>u.name).join(", ")}) => ${a.name}>`;return ln(N(i,o))},dn=(e,r)=>(e=$.toValue(e),r=$.toValue(r),$.toHandle(e[r])),pn=e=>{e>9&&(D[e+1]+=1)},hn=()=>$.toHandle([]),gn=e=>{e=$.toValue(e);for(var r=new Array(e.length),t=0;t<e.length;t++)r[t]=e[t];return $.toHandle(r)},_n=e=>$.toHandle(pe(e)),yn=()=>$.toHandle({}),mn=e=>{var r=$.toValue(e);Q(r),Cr(e)},$n=(e,r,t)=>{e=$.toValue(e),r=$.toValue(r),t=$.toValue(t),e[r]=t},bn=(e,r)=>{e=vr(e,"_emval_take_value");var t=e.readValueFromPointer(r);return $.toHandle(t)},Pn=()=>2147483648,wn=e=>{var r=er.buffer,t=(e-r.byteLength+65535)/65536;try{return er.grow(t),Mr(),1}catch(n){}},Cn=e=>{var r=T.length;e>>>=0;var t=Pn();if(e>t)return!1;for(var n=(u,f)=>u+(f-u%f)%f,a=1;a<=4;a*=2){var s=r*(1+.2/a);s=Math.min(s,e+100663296);var o=Math.min(t,n(Math.max(e,s),65536)),i=wn(o);if(i)return!0}return!1};Xr=l.InternalError=class extends Error{constructor(r){super(r),this.name="InternalError"}},Ze(),L=l.BindingError=class extends Error{constructor(r){super(r),this.name="BindingError"}},lt(),it(),_t(),se=l.UnboundTypeError=bt(Error,"UnboundTypeError"),Ft();var Tn={y:Ge,D:Ke,N:Qe,L:Je,C:Xe,H:Ne,l:Pt,m:Ct,b:Tt,f:At,G:fe,K:St,v:Dt,x:jt,o:kt,n:Ut,k:Vt,z:Ht,w:qt,u:Yt,B:Nt,t:rn,M:en,A:tn,I:nn,F:an,j:sn,r:un,a:Cr,s:vn,h:dn,d:pn,J:hn,p:gn,e:_n,q:yn,i:mn,g:$n,c:bn,E:Cn},S=Be(),An=()=>(An=S.P)(),Rr=l._malloc=e=>(Rr=l._malloc=S.R)(e),O=l._free=e=>(O=l._free=S.S)(e),he=e=>(he=S.T)(e),ge=e=>(ge=S.U)(e),dr;K=function e(){dr||_e(),dr||(K=e)};function _e(){if(I>0||(We(),I>0))return;function e(){var r;dr||(dr=!0,l.calledRun=!0,!Vr&&(Se(),Or(l),(r=l.onRuntimeInitialized)==null||r.call(l),De()))}l.setStatus?(l.setStatus("Running..."),setTimeout(function(){setTimeout(function(){l.setStatus("")},1),e()},1)):e()}if(l.preInit)for(typeof l.preInit=="function"&&(l.preInit=[l.preInit]);l.preInit.length>0;)l.preInit.pop()();return _e(),Dr=Pe,Dr})})();typeof exports=="object"&&typeof module=="object"?module.exports=Recast:typeof define=="function"&&define.amd&&define([],()=>Recast);

window.Recast = Laya.WasmAdapter.create(Recast, "recast-navigation-wasm.wasm");
