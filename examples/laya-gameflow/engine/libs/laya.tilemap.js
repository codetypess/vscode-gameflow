(function (exports, Laya) {
    'use strict';

    class TileSetCustomDataLayer {
    }

    class TileMapNavigationLayer {
        constructor() {
        }
    }

    class TileSetOcclusionLayer {
        constructor() {
            this.layerMask = 1;
        }
    }

    class TileSetPhysicsLayer {
        constructor() {
            this._density = 10;
            this._friction = 0.2;
            this._restitution = 0;
            this.group = 0;
            this.category = 1;
            this.mask = -1;
        }
        get density() {
            return this._density;
        }
        set density(value) {
            if (this._density == value)
                return;
            this._density = value;
        }
        get friction() {
            return this._friction;
        }
        set friction(value) {
            if (this._friction == value)
                return;
            this._friction = value;
        }
        get restitution() {
            return this._restitution;
        }
        set restitution(value) {
            if (this._restitution == value)
                return;
            this._restitution = value;
        }
    }

    exports.TileMapCellNeighbor = void 0;
    (function (TileMapCellNeighbor) {
        TileMapCellNeighbor[TileMapCellNeighbor["RIGHT_SIDE"] = 0] = "RIGHT_SIDE";
        TileMapCellNeighbor[TileMapCellNeighbor["RIGHT_CORNER"] = 1] = "RIGHT_CORNER";
        TileMapCellNeighbor[TileMapCellNeighbor["BOTTOM_RIGHT_SIDE"] = 2] = "BOTTOM_RIGHT_SIDE";
        TileMapCellNeighbor[TileMapCellNeighbor["BOTTOM_RIGHT_CORNER"] = 3] = "BOTTOM_RIGHT_CORNER";
        TileMapCellNeighbor[TileMapCellNeighbor["BOTTOM_SIDE"] = 4] = "BOTTOM_SIDE";
        TileMapCellNeighbor[TileMapCellNeighbor["BOTTOM_CORNER"] = 5] = "BOTTOM_CORNER";
        TileMapCellNeighbor[TileMapCellNeighbor["BOTTOM_LEFT_SIDE"] = 6] = "BOTTOM_LEFT_SIDE";
        TileMapCellNeighbor[TileMapCellNeighbor["BOTTOM_LEFT_CORNER"] = 7] = "BOTTOM_LEFT_CORNER";
        TileMapCellNeighbor[TileMapCellNeighbor["LEFT_SIDE"] = 8] = "LEFT_SIDE";
        TileMapCellNeighbor[TileMapCellNeighbor["LEFT_CORNER"] = 9] = "LEFT_CORNER";
        TileMapCellNeighbor[TileMapCellNeighbor["TOP_LEFT_SIDE"] = 10] = "TOP_LEFT_SIDE";
        TileMapCellNeighbor[TileMapCellNeighbor["TOP_LEFT_CORNER"] = 11] = "TOP_LEFT_CORNER";
        TileMapCellNeighbor[TileMapCellNeighbor["TOP_SIDE"] = 12] = "TOP_SIDE";
        TileMapCellNeighbor[TileMapCellNeighbor["TOP_CORNER"] = 13] = "TOP_CORNER";
        TileMapCellNeighbor[TileMapCellNeighbor["TOP_RIGHT_SIDE"] = 14] = "TOP_RIGHT_SIDE";
        TileMapCellNeighbor[TileMapCellNeighbor["TOP_RIGHT_CORNER"] = 15] = "TOP_RIGHT_CORNER";
        TileMapCellNeighbor[TileMapCellNeighbor["MAX"] = 16] = "MAX";
    })(exports.TileMapCellNeighbor || (exports.TileMapCellNeighbor = {}));
    exports.TileMapTerrainMode = void 0;
    (function (TileMapTerrainMode) {
        TileMapTerrainMode[TileMapTerrainMode["MATCH_CORNERS_AND_SIDES"] = 0] = "MATCH_CORNERS_AND_SIDES";
        TileMapTerrainMode[TileMapTerrainMode["MATCH_CORNERS"] = 1] = "MATCH_CORNERS";
        TileMapTerrainMode[TileMapTerrainMode["MATCH_SIDES"] = 2] = "MATCH_SIDES";
    })(exports.TileMapTerrainMode || (exports.TileMapTerrainMode = {}));
    exports.TileShape = void 0;
    (function (TileShape) {
        TileShape[TileShape["TILE_SHAPE_SQUARE"] = 0] = "TILE_SHAPE_SQUARE";
        TileShape[TileShape["TILE_SHAPE_ISOMETRIC"] = 1] = "TILE_SHAPE_ISOMETRIC";
        TileShape[TileShape["TILE_SHAPE_HALF_OFFSET_SQUARE"] = 2] = "TILE_SHAPE_HALF_OFFSET_SQUARE";
        TileShape[TileShape["TILE_SHAPE_HEXAGON"] = 3] = "TILE_SHAPE_HEXAGON";
    })(exports.TileShape || (exports.TileShape = {}));
    exports.TileLayerSortMode = void 0;
    (function (TileLayerSortMode) {
        TileLayerSortMode[TileLayerSortMode["YSort"] = 0] = "YSort";
        TileLayerSortMode[TileLayerSortMode["ZINDEXSORT"] = 1] = "ZINDEXSORT";
        TileLayerSortMode[TileLayerSortMode["XSort"] = 2] = "XSort";
    })(exports.TileLayerSortMode || (exports.TileLayerSortMode = {}));
    exports.TileMapDirtyFlag = void 0;
    (function (TileMapDirtyFlag) {
        TileMapDirtyFlag[TileMapDirtyFlag["CELL_CHANGE"] = 1] = "CELL_CHANGE";
        TileMapDirtyFlag[TileMapDirtyFlag["CELL_COLOR"] = 2] = "CELL_COLOR";
        TileMapDirtyFlag[TileMapDirtyFlag["CELL_QUAD"] = 4] = "CELL_QUAD";
        TileMapDirtyFlag[TileMapDirtyFlag["CELL_QUADUV"] = 8] = "CELL_QUADUV";
        TileMapDirtyFlag[TileMapDirtyFlag["CELL_UVTRAN"] = 16] = "CELL_UVTRAN";
        TileMapDirtyFlag[TileMapDirtyFlag["CELL_PHYSICS"] = 32] = "CELL_PHYSICS";
        TileMapDirtyFlag[TileMapDirtyFlag["CELL_TERRAIN"] = 64] = "CELL_TERRAIN";
        TileMapDirtyFlag[TileMapDirtyFlag["CELL_LIGHTSHADOW"] = 128] = "CELL_LIGHTSHADOW";
        TileMapDirtyFlag[TileMapDirtyFlag["CELL_NAVIGATION"] = 256] = "CELL_NAVIGATION";
        TileMapDirtyFlag[TileMapDirtyFlag["CELL_SORTCHANGE"] = 512] = "CELL_SORTCHANGE";
        TileMapDirtyFlag[TileMapDirtyFlag["TILESET_SAZE"] = 1024] = "TILESET_SAZE";
        TileMapDirtyFlag[TileMapDirtyFlag["LAYER_COLOR"] = 2048] = "LAYER_COLOR";
        TileMapDirtyFlag[TileMapDirtyFlag["LAYER_PHYSICS"] = 4096] = "LAYER_PHYSICS";
    })(exports.TileMapDirtyFlag || (exports.TileMapDirtyFlag = {}));
    exports.DirtyFlagType = void 0;
    (function (DirtyFlagType) {
        DirtyFlagType[DirtyFlagType["ALL"] = -1] = "ALL";
        DirtyFlagType[DirtyFlagType["RENDER"] = 0] = "RENDER";
        DirtyFlagType[DirtyFlagType["PHYSICS"] = 1] = "PHYSICS";
        DirtyFlagType[DirtyFlagType["OCCLUSION"] = 2] = "OCCLUSION";
    })(exports.DirtyFlagType || (exports.DirtyFlagType = {}));
    const DIRTY_TYPES = 3;

    class TileMapTerrainUtil {
        static initSquare() {
            let neighbors = new Map;
            let arr = [
                exports.TileMapCellNeighbor.RIGHT_SIDE,
                exports.TileMapCellNeighbor.BOTTOM_RIGHT_CORNER,
                exports.TileMapCellNeighbor.BOTTOM_SIDE,
                exports.TileMapCellNeighbor.BOTTOM_LEFT_CORNER,
                exports.TileMapCellNeighbor.LEFT_SIDE,
                exports.TileMapCellNeighbor.TOP_LEFT_CORNER,
                exports.TileMapCellNeighbor.TOP_SIDE,
                exports.TileMapCellNeighbor.TOP_RIGHT_CORNER,
            ];
            let links = arr;
            neighbors.set(exports.TileMapTerrainMode.MATCH_CORNERS_AND_SIDES, arr);
            arr = [
                exports.TileMapCellNeighbor.RIGHT_SIDE,
                exports.TileMapCellNeighbor.BOTTOM_SIDE,
                exports.TileMapCellNeighbor.LEFT_SIDE,
                exports.TileMapCellNeighbor.TOP_SIDE,
            ];
            neighbors.set(exports.TileMapTerrainMode.MATCH_SIDES, arr);
            arr = [
                exports.TileMapCellNeighbor.BOTTOM_RIGHT_CORNER,
                exports.TileMapCellNeighbor.BOTTOM_LEFT_CORNER,
                exports.TileMapCellNeighbor.TOP_LEFT_CORNER,
                exports.TileMapCellNeighbor.TOP_RIGHT_CORNER,
            ];
            neighbors.set(exports.TileMapTerrainMode.MATCH_CORNERS, arr);
            this.shape_mode_map.set(exports.TileShape.TILE_SHAPE_SQUARE, {
                neighbors,
                getOverlap: TileMapTerrainUtil.getOverlap_Square,
                getNeighborGird: TileMapTerrainUtil.getNeighborGird_Square,
                getRuleInfo: TileMapTerrainUtil.getRuleInfo_Square,
                links
            });
        }
        static initIsometric() {
            let neighbors = new Map;
            let arr = [
                exports.TileMapCellNeighbor.RIGHT_CORNER,
                exports.TileMapCellNeighbor.BOTTOM_RIGHT_SIDE,
                exports.TileMapCellNeighbor.BOTTOM_CORNER,
                exports.TileMapCellNeighbor.BOTTOM_LEFT_SIDE,
                exports.TileMapCellNeighbor.LEFT_CORNER,
                exports.TileMapCellNeighbor.TOP_LEFT_SIDE,
                exports.TileMapCellNeighbor.TOP_CORNER,
                exports.TileMapCellNeighbor.TOP_RIGHT_SIDE,
            ];
            let links = arr;
            neighbors.set(exports.TileMapTerrainMode.MATCH_CORNERS_AND_SIDES, arr);
            arr = [
                exports.TileMapCellNeighbor.BOTTOM_RIGHT_SIDE,
                exports.TileMapCellNeighbor.BOTTOM_LEFT_SIDE,
                exports.TileMapCellNeighbor.TOP_LEFT_SIDE,
                exports.TileMapCellNeighbor.TOP_RIGHT_SIDE,
            ];
            neighbors.set(exports.TileMapTerrainMode.MATCH_SIDES, arr);
            arr = [
                exports.TileMapCellNeighbor.RIGHT_CORNER,
                exports.TileMapCellNeighbor.BOTTOM_CORNER,
                exports.TileMapCellNeighbor.LEFT_CORNER,
                exports.TileMapCellNeighbor.TOP_CORNER,
            ];
            neighbors.set(exports.TileMapTerrainMode.MATCH_CORNERS, arr);
            this.shape_mode_map.set(exports.TileShape.TILE_SHAPE_ISOMETRIC, {
                neighbors,
                getNeighborGird: TileMapTerrainUtil.getNeighborGird_Isometric,
                getRuleInfo: TileMapTerrainUtil.getRuleInfo_Isometric,
                getOverlap: TileMapTerrainUtil.getOverlap_Isometric,
                links
            });
        }
        static initHalfOffset() {
            let neighbors = new Map;
            let arr = [
                exports.TileMapCellNeighbor.RIGHT_SIDE,
                exports.TileMapCellNeighbor.BOTTOM_RIGHT_SIDE,
                exports.TileMapCellNeighbor.BOTTOM_RIGHT_CORNER,
                exports.TileMapCellNeighbor.BOTTOM_CORNER,
                exports.TileMapCellNeighbor.BOTTOM_LEFT_SIDE,
                exports.TileMapCellNeighbor.BOTTOM_LEFT_CORNER,
                exports.TileMapCellNeighbor.LEFT_SIDE,
                exports.TileMapCellNeighbor.TOP_LEFT_SIDE,
                exports.TileMapCellNeighbor.TOP_LEFT_CORNER,
                exports.TileMapCellNeighbor.TOP_CORNER,
                exports.TileMapCellNeighbor.TOP_RIGHT_SIDE,
                exports.TileMapCellNeighbor.TOP_RIGHT_CORNER,
            ];
            neighbors.set(exports.TileMapTerrainMode.MATCH_CORNERS_AND_SIDES, arr);
            arr = [
                exports.TileMapCellNeighbor.RIGHT_SIDE,
                exports.TileMapCellNeighbor.BOTTOM_RIGHT_SIDE,
                exports.TileMapCellNeighbor.BOTTOM_LEFT_SIDE,
                exports.TileMapCellNeighbor.LEFT_SIDE,
                exports.TileMapCellNeighbor.TOP_LEFT_SIDE,
                exports.TileMapCellNeighbor.TOP_RIGHT_SIDE,
            ];
            neighbors.set(exports.TileMapTerrainMode.MATCH_SIDES, arr);
            let links = arr;
            arr = [
                exports.TileMapCellNeighbor.BOTTOM_RIGHT_CORNER,
                exports.TileMapCellNeighbor.BOTTOM_CORNER,
                exports.TileMapCellNeighbor.BOTTOM_LEFT_CORNER,
                exports.TileMapCellNeighbor.TOP_LEFT_CORNER,
                exports.TileMapCellNeighbor.TOP_CORNER,
                exports.TileMapCellNeighbor.TOP_RIGHT_CORNER,
            ];
            neighbors.set(exports.TileMapTerrainMode.MATCH_CORNERS, arr);
            this.shape_mode_map.set(exports.TileShape.TILE_SHAPE_HALF_OFFSET_SQUARE, {
                neighbors,
                getNeighborGird: TileMapTerrainUtil.getNeighborGird_HalfOffset,
                getRuleInfo: TileMapTerrainUtil.getRuleInfo_HalfOffset,
                getOverlap: TileMapTerrainUtil.getOverlap_HalfOffset,
                links
            });
            this.shape_mode_map.set(exports.TileShape.TILE_SHAPE_HEXAGON, {
                getNeighborGird: TileMapTerrainUtil.getNeighborGird_HalfOffset,
                getRuleInfo: TileMapTerrainUtil.getRuleInfo_HalfOffset,
                getOverlap: TileMapTerrainUtil.getOverlap_HalfOffset,
                neighbors,
                links
            });
        }
        static __init__() {
            this.initSquare();
            this.initIsometric();
            this.initHalfOffset();
        }
        static getNeighborObject(shape) {
            return TileMapTerrainUtil.shape_mode_map.get(shape);
        }
        static getNeighborGird_Isometric(x, y, neighbor, out) {
            let isOffset = !!(y & 1);
            if (neighbor == exports.TileMapCellNeighbor.TOP_CORNER) {
                out.x = x;
                out.y = y - 2;
            }
            else if (neighbor == exports.TileMapCellNeighbor.TOP_RIGHT_SIDE) {
                out.x = x + (isOffset ? 1 : 0);
                out.y = y - 1;
            }
            else if (neighbor == exports.TileMapCellNeighbor.RIGHT_CORNER) {
                out.x = x + 1;
                out.y = y;
            }
            else if (neighbor == exports.TileMapCellNeighbor.BOTTOM_RIGHT_SIDE) {
                out.x = x + (isOffset ? 1 : 0);
                out.y = y + 1;
            }
            else if (neighbor == exports.TileMapCellNeighbor.BOTTOM_CORNER) {
                out.x = x;
                out.y = y + 2;
            }
            else if (neighbor == exports.TileMapCellNeighbor.BOTTOM_LEFT_SIDE) {
                out.x = x - (isOffset ? 0 : 1);
                out.y = y + 1;
            }
            else if (neighbor == exports.TileMapCellNeighbor.LEFT_CORNER) {
                out.x = x - 1;
                out.y = y;
            }
            else if (neighbor == exports.TileMapCellNeighbor.TOP_LEFT_SIDE) {
                out.x = x - (isOffset ? 0 : 1);
                out.y = y - 1;
            }
        }
        static getNeighborGird_Square(x, y, neighbor, out) {
            if (neighbor == exports.TileMapCellNeighbor.TOP_SIDE) {
                out.x = x;
                out.y = y - 1;
            }
            else if (neighbor == exports.TileMapCellNeighbor.TOP_RIGHT_CORNER) {
                out.x = x + 1;
                out.y = y - 1;
            }
            else if (neighbor == exports.TileMapCellNeighbor.RIGHT_SIDE) {
                out.x = x + 1;
                out.y = y;
            }
            else if (neighbor == exports.TileMapCellNeighbor.BOTTOM_RIGHT_CORNER) {
                out.x = x + 1;
                out.y = y + 1;
            }
            else if (neighbor == exports.TileMapCellNeighbor.BOTTOM_SIDE) {
                out.x = x;
                out.y = y + 1;
            }
            else if (neighbor == exports.TileMapCellNeighbor.BOTTOM_LEFT_CORNER) {
                out.x = x - 1;
                out.y = y + 1;
            }
            else if (neighbor == exports.TileMapCellNeighbor.LEFT_SIDE) {
                out.x = x - 1;
                out.y = y;
            }
            else if (neighbor == exports.TileMapCellNeighbor.TOP_LEFT_CORNER) {
                out.x = x - 1;
                out.y = y - 1;
            }
        }
        static getNeighborGird_HalfOffset(x, y, neighbor, out) {
            let isOffset = !!(y & 1);
            if (neighbor == exports.TileMapCellNeighbor.RIGHT_SIDE) {
                out.x = x + 1;
                out.y = y;
            }
            else if (neighbor == exports.TileMapCellNeighbor.LEFT_SIDE) {
                out.x = x - 1;
                out.y = y;
            }
            else if (neighbor == exports.TileMapCellNeighbor.TOP_RIGHT_SIDE) {
                out.x = x + (isOffset ? 1 : 0);
                out.y = y - 1;
            }
            else if (neighbor == exports.TileMapCellNeighbor.BOTTOM_RIGHT_SIDE) {
                out.x = x + (isOffset ? 1 : 0);
                out.y = y + 1;
            }
            else if (neighbor == exports.TileMapCellNeighbor.BOTTOM_LEFT_SIDE) {
                out.x = x - (isOffset ? 0 : 1);
                out.y = y + 1;
            }
            else if (neighbor == exports.TileMapCellNeighbor.TOP_LEFT_SIDE) {
                out.x = x - (isOffset ? 0 : 1);
                out.y = y - 1;
            }
        }
        static getRuleInfo_Square(rule, neighbor) {
            if (neighbor == exports.TileMapCellNeighbor.TOP_SIDE) {
                rule.data = 3;
                TileMapTerrainUtil.getNeighborGird_Square(rule.x, rule.y, neighbor, rule);
            }
            else if (neighbor == exports.TileMapCellNeighbor.TOP_RIGHT_CORNER) {
                rule.data = 2;
                TileMapTerrainUtil.getNeighborGird_Square(rule.x, rule.y, exports.TileMapCellNeighbor.TOP_SIDE, rule);
            }
            else if (neighbor == exports.TileMapCellNeighbor.RIGHT_SIDE) {
                rule.data = 1;
            }
            else if (neighbor == exports.TileMapCellNeighbor.BOTTOM_RIGHT_CORNER) {
                rule.data = 2;
            }
            else if (neighbor == exports.TileMapCellNeighbor.BOTTOM_SIDE) {
                rule.data = 3;
            }
            else if (neighbor == exports.TileMapCellNeighbor.BOTTOM_LEFT_CORNER) {
                rule.data = 2;
                TileMapTerrainUtil.getNeighborGird_Square(rule.x, rule.y, exports.TileMapCellNeighbor.LEFT_SIDE, rule);
            }
            else if (neighbor == exports.TileMapCellNeighbor.LEFT_SIDE) {
                rule.data = 1;
                TileMapTerrainUtil.getNeighborGird_Square(rule.x, rule.y, neighbor, rule);
            }
            else if (neighbor == exports.TileMapCellNeighbor.TOP_LEFT_CORNER) {
                rule.data = 2;
                TileMapTerrainUtil.getNeighborGird_Square(rule.x, rule.y, exports.TileMapCellNeighbor.TOP_LEFT_CORNER, rule);
            }
        }
        static getRuleInfo_Isometric(rule, neighbor) {
            if (neighbor == exports.TileMapCellNeighbor.TOP_CORNER) {
                rule.data = 2;
                TileMapTerrainUtil.getNeighborGird_Isometric(rule.x, rule.y, neighbor, rule);
            }
            else if (neighbor == exports.TileMapCellNeighbor.TOP_RIGHT_SIDE) {
                rule.data = 3;
                TileMapTerrainUtil.getNeighborGird_Isometric(rule.x, rule.y, neighbor, rule);
            }
            else if (neighbor == exports.TileMapCellNeighbor.RIGHT_CORNER) {
                rule.data = 2;
                TileMapTerrainUtil.getNeighborGird_Isometric(rule.x, rule.y, exports.TileMapCellNeighbor.TOP_RIGHT_SIDE, rule);
            }
            else if (neighbor == exports.TileMapCellNeighbor.BOTTOM_RIGHT_SIDE) {
                rule.data = 1;
            }
            else if (neighbor == exports.TileMapCellNeighbor.BOTTOM_CORNER) {
                rule.data = 2;
            }
            else if (neighbor == exports.TileMapCellNeighbor.BOTTOM_LEFT_SIDE) {
                rule.data = 3;
            }
            else if (neighbor == exports.TileMapCellNeighbor.LEFT_CORNER) {
                rule.data = 2;
                TileMapTerrainUtil.getNeighborGird_Isometric(rule.x, rule.y, exports.TileMapCellNeighbor.TOP_LEFT_SIDE, rule);
            }
            else if (neighbor == exports.TileMapCellNeighbor.TOP_LEFT_SIDE) {
                rule.data = 1;
                TileMapTerrainUtil.getNeighborGird_Isometric(rule.x, rule.y, neighbor, rule);
            }
        }
        static getRuleInfo_HalfOffset(rule, neighbor) {
            if (neighbor == exports.TileMapCellNeighbor.RIGHT_SIDE) {
                rule.data = 1;
            }
            else if (neighbor == exports.TileMapCellNeighbor.BOTTOM_RIGHT_CORNER) {
                rule.data = 2;
            }
            else if (neighbor == exports.TileMapCellNeighbor.BOTTOM_RIGHT_SIDE) {
                rule.data = 3;
            }
            else if (neighbor == exports.TileMapCellNeighbor.BOTTOM_CORNER) {
                rule.data = 4;
            }
            else if (neighbor == exports.TileMapCellNeighbor.BOTTOM_LEFT_SIDE) {
                rule.data = 5;
            }
            else if (neighbor == exports.TileMapCellNeighbor.BOTTOM_LEFT_CORNER) {
                rule.data = 2;
                TileMapTerrainUtil.getNeighborGird_HalfOffset(rule.x, rule.y, exports.TileMapCellNeighbor.LEFT_SIDE, rule);
            }
            else if (neighbor == exports.TileMapCellNeighbor.LEFT_SIDE) {
                rule.data = 1;
                TileMapTerrainUtil.getNeighborGird_HalfOffset(rule.x, rule.y, neighbor, rule);
            }
            else if (neighbor == exports.TileMapCellNeighbor.TOP_LEFT_CORNER) {
                rule.data = 4;
                TileMapTerrainUtil.getNeighborGird_HalfOffset(rule.x, rule.y, exports.TileMapCellNeighbor.TOP_LEFT_SIDE, rule);
            }
            else if (neighbor == exports.TileMapCellNeighbor.TOP_LEFT_SIDE) {
                rule.data = 3;
                TileMapTerrainUtil.getNeighborGird_HalfOffset(rule.x, rule.y, neighbor, rule);
            }
            else if (neighbor == exports.TileMapCellNeighbor.TOP_CORNER) {
                rule.data = 2;
                TileMapTerrainUtil.getNeighborGird_HalfOffset(rule.x, rule.y, exports.TileMapCellNeighbor.TOP_LEFT_SIDE, rule);
            }
            else if (neighbor == exports.TileMapCellNeighbor.TOP_RIGHT_SIDE) {
                rule.data = 5;
                TileMapTerrainUtil.getNeighborGird_HalfOffset(rule.x, rule.y, neighbor, rule);
            }
            else if (neighbor == exports.TileMapCellNeighbor.TOP_RIGHT_CORNER) {
                rule.data = 4;
                TileMapTerrainUtil.getNeighborGird_HalfOffset(rule.x, rule.y, exports.TileMapCellNeighbor.TOP_RIGHT_SIDE, rule);
            }
        }
        static getOverlap_Square(x, y, data, vec2Map, outs) {
            let temp_vec2 = TileMapTerrainUtil.temp_vec2;
            if (data == 1) {
                outs.set(vec2Map.get(x, y, true), exports.TileMapCellNeighbor.RIGHT_SIDE);
                TileMapTerrainUtil.getNeighborGird_Square(x, y, exports.TileMapCellNeighbor.RIGHT_SIDE, temp_vec2);
                outs.set(vec2Map.get(temp_vec2.x, temp_vec2.y, true), exports.TileMapCellNeighbor.LEFT_SIDE);
            }
            else if (data == 2) {
                outs.set(vec2Map.get(x, y, true), exports.TileMapCellNeighbor.BOTTOM_RIGHT_CORNER);
                TileMapTerrainUtil.getNeighborGird_Square(x, y, exports.TileMapCellNeighbor.RIGHT_SIDE, temp_vec2);
                outs.set(vec2Map.get(temp_vec2.x, temp_vec2.y, true), exports.TileMapCellNeighbor.BOTTOM_LEFT_CORNER);
                TileMapTerrainUtil.getNeighborGird_Square(x, y, exports.TileMapCellNeighbor.BOTTOM_RIGHT_CORNER, temp_vec2);
                outs.set(vec2Map.get(temp_vec2.x, temp_vec2.y, true), exports.TileMapCellNeighbor.TOP_LEFT_CORNER);
                TileMapTerrainUtil.getNeighborGird_Square(x, y, exports.TileMapCellNeighbor.BOTTOM_SIDE, temp_vec2);
                outs.set(vec2Map.get(temp_vec2.x, temp_vec2.y, true), exports.TileMapCellNeighbor.TOP_RIGHT_CORNER);
            }
            else {
                outs.set(vec2Map.get(x, y, true), exports.TileMapCellNeighbor.BOTTOM_SIDE);
                TileMapTerrainUtil.getNeighborGird_Square(x, y, exports.TileMapCellNeighbor.BOTTOM_SIDE, temp_vec2);
                outs.set(vec2Map.get(temp_vec2.x, temp_vec2.y, true), exports.TileMapCellNeighbor.TOP_SIDE);
            }
        }
        static getOverlap_Isometric(x, y, data, vec2Map, outs) {
            let temp_vec2 = TileMapTerrainUtil.temp_vec2;
            if (data == 1) {
                outs.set(vec2Map.get(x, y, true), exports.TileMapCellNeighbor.BOTTOM_RIGHT_SIDE);
                TileMapTerrainUtil.getNeighborGird_Isometric(x, y, exports.TileMapCellNeighbor.BOTTOM_RIGHT_SIDE, temp_vec2);
                outs.set(vec2Map.get(temp_vec2.x, temp_vec2.y, true), exports.TileMapCellNeighbor.TOP_LEFT_SIDE);
            }
            else if (data == 2) {
                outs.set(vec2Map.get(x, y, true), exports.TileMapCellNeighbor.BOTTOM_CORNER);
                TileMapTerrainUtil.getNeighborGird_Isometric(x, y, exports.TileMapCellNeighbor.BOTTOM_RIGHT_SIDE, temp_vec2);
                outs.set(vec2Map.get(temp_vec2.x, temp_vec2.y, true), exports.TileMapCellNeighbor.LEFT_CORNER);
                TileMapTerrainUtil.getNeighborGird_Isometric(x, y, exports.TileMapCellNeighbor.BOTTOM_CORNER, temp_vec2);
                outs.set(vec2Map.get(temp_vec2.x, temp_vec2.y, true), exports.TileMapCellNeighbor.TOP_CORNER);
                TileMapTerrainUtil.getNeighborGird_Isometric(x, y, exports.TileMapCellNeighbor.BOTTOM_LEFT_SIDE, temp_vec2);
                outs.set(vec2Map.get(temp_vec2.x, temp_vec2.y, true), exports.TileMapCellNeighbor.RIGHT_CORNER);
            }
            else {
                outs.set(vec2Map.get(x, y, true), exports.TileMapCellNeighbor.BOTTOM_LEFT_SIDE);
                TileMapTerrainUtil.getNeighborGird_Isometric(x, y, exports.TileMapCellNeighbor.BOTTOM_LEFT_SIDE, temp_vec2);
                outs.set(vec2Map.get(temp_vec2.x, temp_vec2.y, true), exports.TileMapCellNeighbor.TOP_RIGHT_SIDE);
            }
        }
        static getOverlap_HalfOffset(x, y, data, vec2Map, outs) {
            let temp_vec2 = TileMapTerrainUtil.temp_vec2;
            if (data == 1) {
                outs.set(vec2Map.get(x, y, true), exports.TileMapCellNeighbor.RIGHT_SIDE);
                TileMapTerrainUtil.getNeighborGird_HalfOffset(x, y, exports.TileMapCellNeighbor.RIGHT_SIDE, temp_vec2);
                outs.set(vec2Map.get(temp_vec2.x, temp_vec2.y, true), exports.TileMapCellNeighbor.LEFT_SIDE);
            }
            else if (data == 2) {
                outs.set(vec2Map.get(x, y, true), exports.TileMapCellNeighbor.BOTTOM_RIGHT_CORNER);
                TileMapTerrainUtil.getNeighborGird_HalfOffset(x, y, exports.TileMapCellNeighbor.RIGHT_SIDE, temp_vec2);
                outs.set(vec2Map.get(temp_vec2.x, temp_vec2.y, true), exports.TileMapCellNeighbor.BOTTOM_LEFT_CORNER);
                TileMapTerrainUtil.getNeighborGird_HalfOffset(x, y, exports.TileMapCellNeighbor.BOTTOM_RIGHT_SIDE, temp_vec2);
                outs.set(vec2Map.get(temp_vec2.x, temp_vec2.y, true), exports.TileMapCellNeighbor.TOP_CORNER);
            }
            else if (data == 3) {
                outs.set(vec2Map.get(x, y, true), exports.TileMapCellNeighbor.BOTTOM_RIGHT_SIDE);
                TileMapTerrainUtil.getNeighborGird_HalfOffset(x, y, exports.TileMapCellNeighbor.BOTTOM_RIGHT_SIDE, temp_vec2);
                outs.set(vec2Map.get(temp_vec2.x, temp_vec2.y, true), exports.TileMapCellNeighbor.TOP_LEFT_SIDE);
            }
            else if (data == 4) {
                outs.set(vec2Map.get(x, y, true), exports.TileMapCellNeighbor.BOTTOM_CORNER);
                TileMapTerrainUtil.getNeighborGird_HalfOffset(x, y, exports.TileMapCellNeighbor.BOTTOM_RIGHT_SIDE, temp_vec2);
                outs.set(vec2Map.get(temp_vec2.x, temp_vec2.y, true), exports.TileMapCellNeighbor.TOP_LEFT_CORNER);
                TileMapTerrainUtil.getNeighborGird_HalfOffset(x, y, exports.TileMapCellNeighbor.BOTTOM_LEFT_SIDE, temp_vec2);
                outs.set(vec2Map.get(temp_vec2.x, temp_vec2.y, true), exports.TileMapCellNeighbor.TOP_RIGHT_CORNER);
            }
            else {
                outs.set(vec2Map.get(x, y, true), exports.TileMapCellNeighbor.BOTTOM_LEFT_SIDE);
                TileMapTerrainUtil.getNeighborGird_HalfOffset(x, y, exports.TileMapCellNeighbor.BOTTOM_LEFT_SIDE, temp_vec2);
                outs.set(vec2Map.get(temp_vec2.x, temp_vec2.y, true), exports.TileMapCellNeighbor.TOP_RIGHT_SIDE);
            }
        }
        static getChunkCellInfo(layer, vec2) {
            if (vec2.index == -1) {
                layer._chunk._getChunkPosByCell(vec2.x, vec2.y, TileMapTerrainUtil.temp_vec3);
                vec2.chunkX = TileMapTerrainUtil.temp_vec3.x;
                vec2.chunkY = TileMapTerrainUtil.temp_vec3.y;
                vec2.index = TileMapTerrainUtil.temp_vec3.z;
            }
            let datas = layer.chunkDatas[vec2.chunkY];
            if (datas) {
                let data = datas[vec2.chunkX];
                if (data) {
                    return data.getCell(vec2.index);
                }
            }
            return null;
        }
    }
    TileMapTerrainUtil.shape_mode_map = new Map;
    TileMapTerrainUtil.temp_vec2 = new Laya.Vector2();
    TileMapTerrainUtil.temp_vec3 = new Laya.Vector3();
    class TileMapTerrainRule {
        constructor(x, y, terrain, neighborObject) {
            this.data = -1;
            this.x = 0;
            this.y = 0;
            this.terrain = -1;
            this.priority = 1;
            this.x = x;
            this.y = y;
            this.terrain = terrain;
            this.neighborObject = neighborObject;
        }
        setCellNeighbor(cellNeighbor) {
            this.neighborObject.getRuleInfo(this, cellNeighbor);
        }
        clone() {
            let rule = new TileMapTerrainRule(this.x, this.y, this.terrain, this.neighborObject);
            rule.data = this.data;
            rule.priority = this.priority;
            return rule;
        }
    }
    class Vector2LikeSet {
        constructor() {
            this.list = [];
        }
    }
    class TerrainRuleSet extends Vector2LikeSet {
        constructor() {
            super(...arguments);
            this.map = [];
        }
        add(ele) {
            let one = this.map[ele.y];
            if (!one) {
                one = this.map[ele.y] = [];
            }
            let two = one[ele.x];
            if (!two) {
                two = one[ele.x] = [];
            }
            if (two[ele.data]) {
                return two[ele.data];
            }
            two[ele.data] = ele;
            this.list.push(ele);
            return ele;
        }
        get(x, y, data) {
            return this.map[y] ? (this.map[y][x] ? this.map[y][x][data] : null) : null;
        }
        delete(x, y, data) {
            let result = this.map[y] ? (this.map[y][x] ? this.map[y][x][data] : null) : null;
            if (result) {
                delete this.map[y][x][data];
                this.list.splice(this.list.indexOf(result), 1);
            }
            return result;
        }
    }
    class TerrainVector2Set extends Vector2LikeSet {
        constructor() {
            super(...arguments);
            this.map = [];
            this.list = [];
        }
        add(ele) {
            let one = this.map[ele.y];
            if (!one) {
                one = this.map[ele.y] = [];
            }
            let two = one[ele.x];
            if (two) {
                return two;
            }
            one[ele.x] = ele;
            this.list.push(ele);
            return ele;
        }
        get(x, y, create = false) {
            let result = this.map[y] ? this.map[y][x] : null;
            if (!result && create) {
                result = { x, y, index: -1 };
                this.add(result);
            }
            return result;
        }
        delete(x, y) {
            let result = this.map[y] ? this.map[y][x] : null;
            if (result) {
                delete this.map[y][x];
                this.list.splice(this.list.indexOf(result), 1);
            }
            return result;
        }
    }

    class TileSetTerrainSet {
        constructor() {
            this._terrainBatchMode = exports.TileMapTerrainMode.MATCH_CORNERS_AND_SIDES;
        }
        set terrainPatchMode(value) {
            this._terrainBatchMode = value;
        }
        get terrainPatchMode() {
            return this._terrainBatchMode;
        }
        updateShape(shape) {
            let obj = TileMapTerrainUtil.getNeighborObject(shape);
            this._neighbors = obj.neighbors.get(this._terrainBatchMode);
        }
        getTerrain(id) {
            for (let i = 0, len = this._terrains.length; i < len; i++) {
                if (id == this._terrains[i].id) {
                    return this._terrains[i];
                }
            }
            return null;
        }
        get terrains() {
            return this._terrains;
        }
        set terrains(value) {
            this._terrains = value;
        }
    }
    class TileSetTerrain {
    }

    const BYTE_POS_CELL = 24;
    const BYTE_POS_GROUP = 16;
    const BYTE_MASK_CELL = 0xff << BYTE_POS_CELL;
    const BYTE_MASK_GROUP = 0xff << BYTE_POS_GROUP;
    const BYTE_MASK_NATIVE = 0xffff;
    const BYTE_MASK_ROTATECOUNT = 0x07;
    const BYTE_MASK_FLIP_H = 0x08;
    const BYTE_MASK_FLIP_V = 0x10;
    const BYTE_MASK_TRANSPOSE = 0x20;
    class TileMapUtils {
        static getRotateCount(transFlag) { return transFlag & BYTE_MASK_ROTATECOUNT; }
        static getFlipH(transFlag) { return (transFlag & BYTE_MASK_FLIP_H) != 0; }
        static getFlipV(transFlag) { return (transFlag & BYTE_MASK_FLIP_V) != 0; }
        static getTranspose(transFlag) { return (transFlag & BYTE_MASK_TRANSPOSE) != 0; }
        static parseCellIndex(gid) { return (gid & BYTE_MASK_CELL) >> 24; }
        static parseGroupId(gid) { return (gid & BYTE_MASK_GROUP) >> 16; }
        static parseNativeIndex(gid) { return gid & BYTE_MASK_NATIVE; }
        static getNativeId(groupId, index) { return (groupId << BYTE_POS_GROUP) + index; }
        static getGid(cellindex, nativeId) {
            return (cellindex << BYTE_POS_CELL) + nativeId;
        }
        static quickFoundIndex(array, value) {
            let mid = 0;
            let startindex = 0;
            let endindex = array.length - 1;
            if (value < array[startindex] || value >= array[endindex]) {
                return -1;
            }
            while (startindex + 1 < endindex) {
                mid = Math.floor((startindex + endindex) / 2);
                if (array[mid] == value) {
                    return mid;
                }
                else if (array[mid] > value) {
                    endindex = mid;
                }
                else {
                    startindex = mid;
                }
            }
            return startindex;
        }
        static getRotateAngle(rotateCount, tileShape) {
            let maxCount = tileShape == exports.TileShape.TILE_SHAPE_HEXAGON ? 6 : 4;
            rotateCount = Math.floor(rotateCount) % maxCount;
            if (rotateCount < 0) {
                rotateCount += maxCount;
            }
            return Math.PI * 2 * rotateCount / maxCount;
        }
        static getTransFlag(rotateCount, flip_h, flip_v, transpose) {
            return rotateCount << 0 | (flip_h ? 1 : 0) << 3 | (flip_v ? 1 : 0) << 4 | (transpose ? 1 : 0) << 5;
        }
        static parseTransFlag(tileshape, transFlag, cellData) {
            let cellFlag = cellData.transFlag;
            let key = transFlag + "_" + cellFlag + "_" + tileshape;
            let cache = this.CACHE_UVs.get(key);
            if (cache) {
                return cache;
            }
            let transFlagHigh = transFlag & ~BYTE_MASK_ROTATECOUNT;
            let cellFlagsHigh = cellFlag & ~BYTE_MASK_ROTATECOUNT;
            let realFlagHigh = transFlagHigh ^ cellFlagsHigh;
            let rotateCount = (this.getRotateCount(transFlag) + cellData.rotateCount) % 4;
            let flip_h = this.getFlipH(realFlagHigh);
            let flip_v = this.getFlipV(realFlagHigh);
            let transpose = this.getTranspose(realFlagHigh);
            cache = new Laya.Vector4();
            this.getUvRotate(tileshape, flip_h, flip_v, transpose, rotateCount, cache);
            this.CACHE_UVs.set(key, cache);
            return cache;
        }
        static getUvRotate(tileshape, flip_h = false, flip_v = false, transpose = false, rountCount = 0, out = Laya.Vector4.TEMP) {
            let vx = 1;
            let vy = transpose ? -1 : 1;
            const dx = (vx + vy) * 0.5;
            const dy = (vx - vy) * 0.5;
            vx = flip_h ? -1 : 1;
            vy = flip_v ? -1 : 1;
            let rotate = -this.getRotateAngle(rountCount, tileshape);
            const cos = Math.cos(rotate);
            const sin = Math.sin(rotate);
            out.x = cos * vx * dx - sin * vx * dy;
            out.y = cos * vy * dy - sin * vy * dx;
            out.z = sin * vx * dx + cos * vx * dy;
            out.w = sin * vy * dy + cos * vy * dx;
            return out;
        }
        static transfromPointByValue(matrix, x, y, point) {
            point.x = matrix.a * x + matrix.c * y + matrix.tx;
            point.y = matrix.b * x + matrix.d * y + matrix.ty;
        }
        static transfromPointNByValue(matrix, x, y, point) {
            point.x = matrix.a * x + matrix.c * y;
            point.y = matrix.b * x + matrix.d * y;
        }
        static getCellDataIndex(nativeData) {
            let keys = Object.keys(nativeData._tileDatas).map(Number);
            keys.sort((a, b) => a - b);
            for (let i = 0; i < keys.length; i++) {
                if (keys[i] !== i) {
                    return i;
                }
            }
            return keys.length > 0 ? keys[keys.length - 1] + 1 : 0;
        }
        static tiledTLayer(tiledX, tiledY, out = new Laya.Vector2()) {
            const tileMapY = tiledX + tiledY;
            const parity = tileMapY & 1;
            const tileMapX = (tiledX - tiledY - parity) >> 1;
            out.x = tileMapX;
            out.y = tileMapY;
            return out;
        }
        static layerToTiled(tileMapX, tileMapY, out = new Laya.Vector2()) {
            tileMapX = Math.floor(tileMapX);
            tileMapY = Math.floor(tileMapY);
            const parity = tileMapY & 1;
            const tiledX = tileMapX + ((tileMapY + parity) >> 1);
            const tiledY = tileMapY - tiledX;
            out.x = tiledX;
            out.y = tiledY;
            return out;
        }
        static compareYSort(a, b) {
            if (a.sortY !== b.sortY)
                return a.sortY - b.sortY;
            if (a.zOrderValue !== b.zOrderValue)
                return a.zOrderValue - b.zOrderValue;
            if (a.cellx !== b.cellx)
                return a.cellx - b.cellx;
            return a.chuckLocalindex - b.chuckLocalindex;
        }
        static compareZSort(a, b) {
            if (a.zOrderValue !== b.zOrderValue)
                return a.zOrderValue - b.zOrderValue;
            if (a.sortY !== b.sortY)
                return a.sortY - b.sortY;
            if (a.cellx !== b.cellx)
                return a.cellx - b.cellx;
            return a.chuckLocalindex - b.chuckLocalindex;
        }
        static compareXSort(a, b) {
            if (a.cellx !== b.cellx)
                return a.cellx - b.cellx;
            if (a.sortY !== b.sortY)
                return a.sortY - b.sortY;
            if (a.zOrderValue !== b.zOrderValue)
                return a.zOrderValue - b.zOrderValue;
            return a.chuckLocalindex - b.chuckLocalindex;
        }
    }
    TileMapUtils.CACHE_UVs = new Map();

    class TileMapTerrain {
        static fillConnect(tileMapLayer, list, terrainSetId, terrainId, ignoreEmpty = false) {
            let tileset = tileMapLayer.tileSet;
            let terrainSet = tileset.getTerrainSet(terrainSetId);
            if (!terrainSet)
                return null;
            let terrain = terrainSet.getTerrain(terrainId);
            if (!terrain)
                return null;
            let neighborObject = TileMapTerrainUtil.getNeighborObject(tileset.tileShape);
            let links = neighborObject.links;
            let linksLen = links.length;
            let temp_vec2 = TileMapTerrainUtil.temp_vec2;
            let vec2Map = new TerrainVector2Set();
            let allSet = new TerrainVector2Set();
            let r2fSet = new TerrainVector2Set();
            let listLength = list.length;
            for (let i = listLength - 1; i > -1; i--) {
                let x = list[i].x, y = list[i].y;
                let iv2 = vec2Map.get(x, y, true);
                if (!allSet.get(x, y)) {
                    allSet.add(iv2);
                }
                r2fSet.add(iv2);
            }
            for (let i = 0; i < listLength; i++) {
                let x = list[i].x, y = list[i].y;
                for (let k = 0; k < linksLen; k++) {
                    let neighbor = links[k];
                    neighborObject.getNeighborGird(x, y, neighbor, temp_vec2);
                    let nx = temp_vec2.x, ny = temp_vec2.y;
                    if (!allSet.get(nx, ny)) {
                        allSet.add(vec2Map.get(nx, ny, true));
                    }
                }
            }
            let checkSet = new TerrainVector2Set();
            allSet.list.forEach(item => {
                let x = item.x, y = item.y;
                let real = r2fSet.get(x, y);
                if (real) {
                    checkSet.add(vec2Map.get(x, y, true));
                }
                else {
                    let chunkCellInfo = TileMapTerrainUtil.getChunkCellInfo(tileMapLayer, item);
                    if (chunkCellInfo) {
                        let celldata = chunkCellInfo.cell;
                        if (celldata.terrainSet == terrainSetId && celldata.terrain == terrainId) {
                            checkSet.add(vec2Map.get(x, y, true));
                        }
                    }
                }
            });
            let ruleSet = new TerrainRuleSet();
            let neighbors = terrainSet._neighbors;
            let nlen = neighbors.length;
            for (let i = 0; i < listLength; i++) {
                let x = list[i].x, y = list[i].y;
                let rulebase = new TileMapTerrainRule(x, y, terrainId, neighborObject);
                rulebase.priority = 10;
                ruleSet.add(rulebase);
                for (let k = 0; k < nlen; k++) {
                    let neighbor = neighbors[k];
                    let ruleNeighbor = rulebase.clone();
                    ruleNeighbor.setCellNeighbor(neighbor);
                    if (neighbor % 2 == 0) {
                        neighborObject.getNeighborGird(x, y, neighbor, temp_vec2);
                        if (checkSet.get(temp_vec2.x, temp_vec2.y)) {
                            ruleSet.add(ruleNeighbor);
                        }
                    }
                    else {
                        let outs = new Map;
                        neighborObject.getOverlap(ruleNeighbor.x, ruleNeighbor.y, ruleNeighbor.data, vec2Map, outs);
                        let need = true;
                        outs.forEach((neighbor, vec2) => {
                            if (!checkSet.get(vec2.x, vec2.y)) {
                                need = false;
                            }
                        });
                        if (need) {
                            ruleSet.add(ruleNeighbor);
                        }
                    }
                }
            }
            let fillRule = this.getReady2FillRule(tileMapLayer, neighborObject, terrainSetId, neighbors, r2fSet, vec2Map, ignoreEmpty);
            fillRule.list.forEach(rule => {
                ruleSet.add(rule);
            });
            let out = this._fillRules(tileMapLayer, terrainSetId, neighborObject, allSet, ruleSet);
            return out;
        }
        static getReady2FillRule(tileMapLayer, neighborObject, terrainSetId, neighbors, r2fSet, vec2Map, ignoreEmpty = true) {
            let nlen = neighbors.length;
            let vRuleSet = new TerrainRuleSet;
            r2fSet.list.forEach(vec2 => {
                for (let i = 0; i < nlen; i++) {
                    let rule = new TileMapTerrainRule(vec2.x, vec2.y, -1, neighborObject);
                    rule.setCellNeighbor(neighbors[i]);
                    vRuleSet.add(rule);
                }
            });
            let outSet = new TerrainRuleSet;
            vRuleSet.list.forEach(rule => {
                let mark = [];
                let outs = new Map;
                neighborObject.getOverlap(rule.x, rule.y, rule.data, vec2Map, outs);
                outs.forEach((neighbor, vec2) => {
                    let nCell = null;
                    let chunkCellInfo = TileMapTerrainUtil.getChunkCellInfo(tileMapLayer, vec2);
                    if (chunkCellInfo) {
                        let cellData = chunkCellInfo.cell;
                        if (cellData.terrainSet == terrainSetId) {
                            nCell = cellData;
                        }
                    }
                    let nTerrain = nCell ? nCell.terrain : -1;
                    if (!ignoreEmpty || nTerrain > -1) {
                        if (!mark[nTerrain]) {
                            mark[nTerrain] = 0;
                        }
                        mark[nTerrain]++;
                    }
                });
                let maxCount = 0;
                let maxCountTerrian = -1;
                for (let i = -1, len = mark.length; i < len; i++) {
                    if (mark[i] > maxCount) {
                        maxCount = mark[i];
                        maxCountTerrian = i;
                    }
                }
                if (maxCount > 0) {
                    rule.terrain = maxCountTerrian;
                    outSet.add(rule);
                }
            });
            r2fSet.list.forEach(vec2 => {
                let chunkCellInfo = TileMapTerrainUtil.getChunkCellInfo(tileMapLayer, vec2);
                if (!ignoreEmpty) {
                    let rule = new TileMapTerrainRule(vec2.x, vec2.y, -1, neighborObject);
                    outSet.add(rule);
                }
                else if (chunkCellInfo) {
                    let cellData = chunkCellInfo.cell;
                    if (cellData.terrainSet == terrainSetId && cellData.terrain > -1) {
                        let rule = new TileMapTerrainRule(vec2.x, vec2.y, cellData.terrain, neighborObject);
                        outSet.add(rule);
                    }
                }
            });
            return outSet;
        }
        static _fillRules(tileMapLayer, terrainSetId, neighborObject, allSet, ruleSet) {
            let out = new Map();
            allSet.list.forEach(vec2 => {
                let params = this._getBestTerrainParams(tileMapLayer, vec2, terrainSetId, neighborObject, ruleSet);
                out.set(vec2, params);
            });
            out.forEach((params, vec2) => {
                let nRuleSet = this._getRulesByParams(tileMapLayer, params, vec2, terrainSetId, neighborObject);
                for (let i = 0, len = nRuleSet.list.length; i < len; i++) {
                    let nRule = nRuleSet.list[i];
                    ruleSet.delete(nRule.x, nRule.y, nRule.data);
                    nRule.priority = 5;
                    ruleSet.add(nRule);
                }
            });
            return out;
        }
        static _getBestTerrainParams(tileMapLayer, pos, terrainSetId, terrainObject, ruleSet) {
            let terrainSet = tileMapLayer.tileSet.getTerrainSet(terrainSetId);
            if (!terrainSet)
                return null;
            let chunkCellInfo = TileMapTerrainUtil.getChunkCellInfo(tileMapLayer, pos);
            let currentParams;
            if (chunkCellInfo && chunkCellInfo.cell && chunkCellInfo.cell.terrainSet == terrainSetId) {
                currentParams = chunkCellInfo.cell.getTerrainsParams();
            }
            else {
                currentParams = new TerrainsParams();
                currentParams.terrainSet = terrainSetId;
            }
            let neighbors = terrainSet._neighbors;
            let nLen = neighbors.length;
            let paramsList = tileMapLayer.tileSet._getParamsList(terrainSetId);
            let sorceMap = new Map();
            let paramsLength = paramsList.length;
            for (let i = -1; i < paramsLength; i++) {
                let list = paramsList[i];
                if (!list)
                    continue;
                let plen = list.length;
                for (let index = 0; index < plen; index++) {
                    let score = 0;
                    let params = list[index];
                    let tempRule = new TileMapTerrainRule(pos.x, pos.y, params.terrain, terrainObject);
                    let rule = ruleSet.get(pos.x, pos.y, tempRule.data);
                    if (rule) {
                        if (rule.terrain != params.terrain) {
                            score += rule.priority;
                        }
                    }
                    else if (params.terrain != currentParams.terrain) {
                        continue;
                    }
                    let check = false;
                    for (let j = 0; j < nLen; j++) {
                        let neighbor = neighbors[j];
                        let neighborTerrain = params.terrain_peering_bits[neighbor];
                        let tempNeighborRule = new TileMapTerrainRule(pos.x, pos.y, neighborTerrain, terrainObject);
                        tempNeighborRule.setCellNeighbor(neighbor);
                        let neighborRule = ruleSet.get(tempNeighborRule.x, tempNeighborRule.y, tempNeighborRule.data);
                        if (neighborRule) {
                            if (neighborRule.terrain != neighborTerrain) {
                                score += neighborRule.priority;
                            }
                        }
                        else if (neighborTerrain != currentParams.terrain_peering_bits[neighbor]) {
                            check = true;
                            break;
                        }
                    }
                    if (check)
                        continue;
                    sorceMap.set(params, score);
                }
            }
            let minScore = Number.MAX_VALUE;
            let minParams;
            sorceMap.forEach((value, key) => {
                if (value < minScore) {
                    minScore = value;
                    minParams = key;
                }
            });
            if (!minParams) {
                minParams = paramsList[-1][0];
            }
            return minParams;
        }
        static _getRulesByParams(tileMapLayer, params, pos, terrainSetId, neighborObject) {
            let outSet = new TerrainRuleSet();
            let baseRule = new TileMapTerrainRule(pos.x, pos.y, params.terrain, neighborObject);
            outSet.add(baseRule);
            let terrainSet = tileMapLayer.tileSet.getTerrainSet(terrainSetId);
            let len = terrainSet._neighbors.length;
            for (let i = 0; i < len; i++) {
                let rule = baseRule.clone();
                rule.terrain = params.terrain_peering_bits[terrainSet._neighbors[i]];
                rule.setCellNeighbor(terrainSet._neighbors[i]);
                outSet.add(rule);
            }
            return outSet;
        }
    }
    class TerrainsParams {
        constructor() {
            this.terrain = -1;
            this.terrain_peering_bits = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1];
            this.links = new Set;
            this._modified = false;
        }
        link(cellData) {
            this.links.add(cellData);
            this._modified = true;
        }
        get arr() {
            if (this._modified) {
                this._arr = Array.from(this.links);
            }
            return this._arr;
        }
        _getDebugs() {
            this._debugs = [];
            for (let i = 0, len = this.terrain_peering_bits.length; i < len; i++) {
                if (this.terrain_peering_bits[i] > -1) {
                    this._debugs.push(exports.TileMapCellNeighbor[i]);
                }
            }
        }
        clearLinks() {
            this.links.clear();
        }
    }

    class TileSetCellOcclusionInfo {
    }
    class TileSetCellPhysicsInfo {
    }
    class TileSetCellNavigationInfo {
    }
    class TileSetCellData {
        get index() {
            return this._index;
        }
        get transFlag() {
            if (this._transChange) {
                this._transFlag = TileMapUtils.getTransFlag(this.rotateCount, this._flip_h, this._flip_v, this._transpose);
                this._transChange = false;
            }
            return this._transFlag;
        }
        get cellowner() {
            return this._cellowner;
        }
        set cellowner(value) {
            this._cellowner = value;
        }
        get flip_h() {
            return this._flip_h;
        }
        set flip_h(value) {
            this._flip_h = value;
            this._transChange = true;
            this._notifyDataChange(exports.TileMapDirtyFlag.CELL_UVTRAN, exports.DirtyFlagType.RENDER);
        }
        get flip_v() {
            return this._flip_v;
        }
        set flip_v(value) {
            this._flip_v = value;
            this._transChange = true;
            this._notifyDataChange(exports.TileMapDirtyFlag.CELL_UVTRAN, exports.DirtyFlagType.RENDER);
        }
        get transpose() {
            return this._transpose;
        }
        set transpose(value) {
            this._transpose = value;
            this._transChange = true;
            this._notifyDataChange(exports.TileMapDirtyFlag.CELL_UVTRAN, exports.DirtyFlagType.RENDER);
        }
        get rotateCount() {
            return this._rotateCount;
        }
        set rotateCount(value) {
            this._rotateCount = value;
            this._transChange = true;
            this._notifyDataChange(exports.TileMapDirtyFlag.CELL_UVTRAN, exports.DirtyFlagType.RENDER);
        }
        get texture_origin() {
            return this._texture_origin;
        }
        set texture_origin(value) {
            value.cloneTo(this._texture_origin);
            this._notifyDataChange(exports.TileMapDirtyFlag.CELL_QUAD, exports.DirtyFlagType.RENDER);
        }
        get material() {
            return this._material;
        }
        set material(value) {
            this._material = value;
            this._notifyDataChange(exports.TileMapDirtyFlag.CELL_CHANGE, exports.DirtyFlagType.RENDER);
        }
        get colorModulate() {
            return this._colorModulate;
        }
        set colorModulate(value) {
            this._colorModulate = value;
            this._notifyDataChange(exports.TileMapDirtyFlag.CELL_COLOR, exports.DirtyFlagType.RENDER);
        }
        get probability() {
            return this._probability;
        }
        set probability(value) {
            this._probability = value;
        }
        get z_index() {
            return this._z_index;
        }
        set z_index(value) {
            if (this._z_index == value)
                return;
            this._z_index = value;
            this._refreshCellSort();
        }
        get y_sort_origin() {
            return this._y_sort_origin;
        }
        set y_sort_origin(value) {
            if (this._y_sort_origin == value)
                return;
            this._y_sort_origin = value;
            this._refreshCellSort();
        }
        get terrainSet() {
            return this._terrainSet;
        }
        set terrainSet(value) {
            this._terrainSet = value;
        }
        get terrain() {
            return this._terrain;
        }
        set terrain(value) {
            this._terrain = value;
        }
        get physicsDatas() {
            return this._physicsDatas;
        }
        set physicsDatas(value) {
            this._physicsDatas = value;
            this._notifyDataChange(exports.TileMapDirtyFlag.CELL_PHYSICS, exports.DirtyFlagType.PHYSICS);
        }
        get lightOccluderDatas() {
            return this._lightOccluderDatas;
        }
        set lightOccluderDatas(value) {
            this._lightOccluderDatas = value;
        }
        get customDatas() {
            return this._customDatas;
        }
        set customDatas(value) {
            this._customDatas = value;
        }
        get navigationDatas() {
            return this._navigationDatas;
        }
        set navigationDatas(value) {
            this._navigationDatas = value;
        }
        constructor() {
            this._index = 0;
            this._flip_h = false;
            this._flip_v = false;
            this._transpose = false;
            this._rotateCount = 0;
            this._transChange = false;
            this._transFlag = 0;
            this._terrainSet = -1;
            this._terrain = -1;
            this._terrain_peering_bits = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1];
            this._probability = 1;
            this._destroyed = false;
            this.gid = -1;
            this._notiveRenderTile = [];
            this._flip_h = false;
            this._flip_v = false;
            this._transpose = false;
            this._rotateCount = 0;
            this._texture_origin = new Laya.Vector2(0, 0);
            this._colorModulate = new Laya.Color(1, 1, 1, 1);
            this._z_index = 0;
            this._y_sort_origin = 0;
        }
        __init(owner, index) {
            this._index = index;
            this._cellowner = owner;
            this.gid = TileMapUtils.getGid(this._index, this._cellowner.nativeId);
        }
        _notifyDataChange(data, type) {
            if (!this.cellowner)
                return;
            this._notiveRenderTile.forEach(element => {
                element._setDirtyFlag(this.gid, data, type);
            });
        }
        _noticeRenderChange() {
            if (!this.cellowner)
                return;
            this._notiveRenderTile.forEach(element => {
                element._modifyData();
            });
        }
        _refreshCellSort() {
            if (!this.cellowner)
                return;
            this._notiveRenderTile.forEach(element => {
                element._refreshCellSort(this);
            });
        }
        _removeNoticeRenderTile(layerRenderTile) {
            let index = this._notiveRenderTile.indexOf(layerRenderTile);
            if (index != -1)
                this._notiveRenderTile.splice(index, 1);
        }
        _addNoticeRenderTile(layerRenderTile) {
            if (this._notiveRenderTile.indexOf(layerRenderTile) == -1) {
                this._notiveRenderTile.push(layerRenderTile);
            }
        }
        set_lightOccluder(layerIndex, data) {
            this._lightOccluderDatas[layerIndex] = data;
        }
        get_lightOccluder(layerIndex) {
            return this._lightOccluderDatas[layerIndex];
        }
        set_terrainPeeringBit(index, terrainIndex) {
            this._terrain_peering_bits[index] = terrainIndex;
            this._cellowner.owner._owner._terrainsDirty = true;
        }
        get_terrainPeeringBit(index) {
            return this._terrain_peering_bits[index];
        }
        set_physicsData(layerIndex, data) {
            this._physicsDatas[layerIndex] = data;
        }
        get_physicsData(layerIndex) {
            return this._physicsDatas[layerIndex];
        }
        getTerrainsParams() {
            let params = new TerrainsParams;
            params.terrainSet = this.terrainSet;
            params.terrain = this.terrain;
            params.terrain_peering_bits = this._terrain_peering_bits.slice(0, 16);
            return params;
        }
        _getTerrainPeeringBits() {
            return this._terrain_peering_bits;
        }
        set_navigationData(layerIndex, data) {
            this._navigationDatas[layerIndex] = data;
        }
        get_navigationData(layerIndex) {
            return this._navigationDatas[layerIndex];
        }
        set_customData(name, value) {
            let layer = this._cellowner._owner._owner.getCustomDataLayer(name);
            if (!layer)
                return;
            this._customDatas[layer.id] = value;
        }
        get_customData(name) {
            let layer = this._cellowner._owner._owner.getCustomDataLayer(name);
            if (!layer)
                return null;
            return this._customDatas[layer.id];
        }
        set_customDataById(id, value) {
            this._customDatas[id] = value;
        }
        get_customDataById(id) {
            return this._customDatas[id];
        }
        cloneTo(dst) {
            dst._material = this._material;
            dst._cellowner = this._cellowner;
            dst._z_index = this._z_index;
            dst._y_sort_origin = this._y_sort_origin;
        }
        destroy() {
            this._notiveRenderTile.slice().forEach(element => {
                element._clearOneCell(this);
            });
            this._destroyed = true;
        }
    }
    TileSetCellData._EMPTY = new TileSetCellData();

    exports.TileAnimationMode = void 0;
    (function (TileAnimationMode) {
        TileAnimationMode[TileAnimationMode["DEFAULT"] = 0] = "DEFAULT";
        TileAnimationMode[TileAnimationMode["RANDOM_START_TIMES"] = 1] = "RANDOM_START_TIMES";
    })(exports.TileAnimationMode || (exports.TileAnimationMode = {}));
    class TileAlternativesData {
        get localPos() {
            return this._localPos;
        }
        set localPos(value) {
            this._localPos = value;
        }
        get sizeByAtlas() {
            return this._sizeByAtlas;
        }
        set sizeByAtlas(value) {
            this._sizeByAtlas.setValue(value.x, value.y);
            this._init();
        }
        get owner() {
            return this._owner;
        }
        set owner(value) {
            if (value === this._owner)
                return;
            this._owner = value;
            this._init();
        }
        get tileDatas() {
            return this._tileDatas;
        }
        set tileDatas(value) {
            if (this._owner && value) {
                for (let k in value) {
                    value[k].__init(this, parseInt(k));
                }
            }
            this._tileDatas = value;
        }
        get animation_columns() {
            return this._animation_columns;
        }
        set animation_columns(value) {
            this._animation_columns = value;
        }
        get animation_separation() {
            return this._animation_separation;
        }
        set animation_separation(value) {
            this._animation_separation = value;
        }
        get animation_speed() {
            return this._animation_speed;
        }
        set animation_speed(value) {
            this._animation_speed = value;
        }
        get animationMode() {
            return this._animationNode;
        }
        set animationMode(value) {
            this._animationNode = value;
        }
        set animationFrams(frams) {
            if (!frams)
                frams = [];
            let oldLength = this._animationFrams.length;
            let newLength = frams.length;
            this._animationFrams = frams;
            this._animationFramsTime = [];
            this._animationFramsTime.length = frams.length;
            this._totalAnimatorTime = 0;
            for (var i = 0; i < frams.length; i++) {
                this._animationFramsTime[i] = this._totalAnimatorTime;
                this._totalAnimatorTime += frams[i];
            }
            if (oldLength != newLength && (oldLength > 1 || newLength > 1)) {
                for (let k in this._tileDatas) {
                    this._tileDatas[k]._noticeRenderChange();
                }
            }
        }
        get animationFrams() {
            return this._animationFrams;
        }
        constructor() {
            this._animation_columns = 0;
            this._animation_separation = new Laya.Vector2();
            this._animation_speed = 1.0;
            this._animationFrams = [];
            this._frameIndex = 0;
            this._animatorUpdateMask = 0;
            this._localPos = new Laya.Vector2();
            this._sizeByAtlas = new Laya.Vector2();
            this._uvOri = new Laya.Vector2();
            this._uvExtends = new Laya.Vector2();
            this._regionSize = new Laya.Vector2();
            this._tileDatas = {};
            this._sizeByAtlas.setValue(1, 1);
        }
        _initialIndexFIrstCellData() {
            const celldata = new TileSetCellData();
            celldata.__init(this, 0);
            this._tileDatas[0] = celldata;
        }
        _hasAni() {
            return this._animationFrams.length > 1;
        }
        _init() {
            if (!this._owner) {
                return;
            }
            this._owner._getTileUVExtends(this._sizeByAtlas, this._regionSize);
            let atlasSize = this._owner.atlasSize;
            this._uvExtends.x = Math.max(this._regionSize.x - 1, 0) / atlasSize.x;
            this._uvExtends.y = Math.max(this._regionSize.y - 1, 0) / atlasSize.y;
            this._updateOriginUV(0, 0, exports.TileMapDirtyFlag.CELL_QUAD | exports.TileMapDirtyFlag.CELL_QUADUV);
            this.nativeId = this._owner._getGlobalAlternativesId(this._localPos.x, this._localPos.y);
            if (this._tileDatas) {
                for (let k in this._tileDatas) {
                    this._tileDatas[k].__init(this, parseInt(k));
                }
            }
        }
        _updateOriginUV(x, y, data) {
            this._uvOri.setValue(this._localPos.x + x, this._localPos.y + y);
            this._owner._getTilePixelOrgin(this._uvOri, this._uvOri);
            let atlasSize = this._owner.atlasSize;
            this._uvOri.x = (this._uvOri.x + this._regionSize.x * 0.5) / atlasSize.x;
            this._uvOri.y = (this._uvOri.y + this._regionSize.y * 0.5) / atlasSize.y;
            for (let k in this._tileDatas) {
                this._tileDatas[k]._notifyDataChange(data, exports.DirtyFlagType.RENDER);
            }
        }
        _getTextureUVOri() {
            return this._uvOri;
        }
        _getTextureUVExtends() {
            return this._uvExtends;
        }
        _getRegionSize() {
            return this._regionSize;
        }
        _updateAnimator() {
            if (this._animationFrams.length <= 1 || Laya.Laya.timer.currFrame == this._animatorUpdateMask) {
                return;
            }
            this._animatorUpdateMask = Laya.Laya.timer.currFrame;
            let oldFrameIndex = this._frameIndex;
            let cur = (Laya.Laya.timer.totalTime / 1000) * this._animation_speed % this._totalAnimatorTime;
            if (cur < this._animationFramsTime[this._frameIndex]) {
                this._frameIndex = 0;
            }
            let j = 0;
            for (var i = this._frameIndex, n = this._animationFrams.length; i < n; i++) {
                if (cur >= this._animationFramsTime[i]) {
                    this._frameIndex = i;
                }
            }
            this._frameIndex += j;
            if (oldFrameIndex == this._frameIndex) {
                return;
            }
            let x;
            let y;
            if (this._animation_columns != 0) {
                x = this._frameIndex % this._animation_columns;
                y = Math.floor(this._frameIndex / this._animation_columns);
            }
            else {
                x = this._frameIndex;
                y = 0;
            }
            this._updateOriginUV(x * (this._sizeByAtlas.x + this._animation_separation.x), y * (this._sizeByAtlas.y + this._animation_separation.y), exports.TileMapDirtyFlag.CELL_QUADUV);
        }
        getCelldata(index) {
            return this._tileDatas[index];
        }
        removeCellData(index) {
            let celldata = this._tileDatas[index];
            if (celldata) {
                celldata.destroy();
                delete this._tileDatas[index];
            }
        }
        addCellData(index) {
            let celldata = this._tileDatas[index];
            if (celldata) {
                return celldata;
            }
            celldata = new TileSetCellData();
            celldata.__init(this, index);
            this._tileDatas[index] = celldata;
            return celldata;
        }
        destroy() {
        }
    }

    var TileMapVS = "#define SHADER_NAME TileMap2DVS\n#include \"TileMapVertex.glsl\"\nvoid main(){vertexInfo info;getVertexInfoTileMap(info);vec4 wordpos=getPosition(info.pos);setVertexInfo(info);\n#ifdef LIGHT2D_ENABLE\nlightAndShadow(info);\n#endif\ngl_Position=wordpos;}";

    var TileMapFS = "#define SHADER_NAME TileMap2DFS\n#include \"TileMapFragment.glsl\"\nvoid main(){clip();vec4 textureColor=getTextureColor(v_texcoord);textureColor=transspaceColor(textureColor);vec4 transV=v_color;\n#ifndef GAMMASPACE\ntransV=gammaToLinear(v_color);\n#endif\nvec4 finalColor=textureColor*transV;\n#ifdef LIGHT2D_ENABLE\nlightAndShadow(finalColor);\n#endif\ngl_FragColor=finalColor;}";

    var TileMapCommonGLSL = "varying vec2 v_pos;";

    var TileMapVertexGLSL = "\n#include \"Sprite2DVertex.glsl\";\n#include \"TileMapCommon.glsl\";\nvec2 getVertexPos(){float x=a_cellPosScale.x+a_position.x*a_cellPosScale.z;float y=a_cellPosScale.y+a_position.y*a_cellPosScale.w;return vec2(x,y);}vec2 getVertexUv(){float u=a_cellUVOriScale.z*dot(a_texcoord,a_celluvTrans.xy)+a_cellUVOriScale.x;float v=a_cellUVOriScale.w*dot(a_texcoord,a_celluvTrans.zw)+a_cellUVOriScale.y;return vec2(u,v);}vec4 getVertexColor(){return a_color*a_cellColor;}void getVertexInfoTileMap(inout vertexInfo info){info.pos=getVertexPos();info.color=getVertexColor();info.uv=getVertexUv();\n#ifdef LIGHT2D_ENABLE\nvec2 global;getGlobalPos(info.pos,global);info.lightUV.x=(global.x-u_LightAndShadow2DParam.x)/u_LightAndShadow2DParam.z;info.lightUV.y=1.0-(global.y-u_LightAndShadow2DParam.y)/u_LightAndShadow2DParam.w;\n#endif\n}void setVertexInfo(in vertexInfo info){v_texcoord=info.uv;v_color=info.color;v_pos=info.pos;}";

    var TileMapFragmentGLSL = "#include \"TileMapCommon.glsl\"\n#include \"Sprite2DFrag.glsl\";\nvec4 getTextureColor(in vec2 uv){return texture2D(u_render2DTexture,uv);}";

    class TileMapShaderInit {
        static __init__() {
            let attributeMap = {
                'a_position': [0, Laya.ShaderDataType.Vector2],
                'a_texcoord': [1, Laya.ShaderDataType.Vector2],
                'a_color': [2, Laya.ShaderDataType.Vector4],
                'a_cellColor': [3, Laya.ShaderDataType.Vector4],
                'a_cellPosScale': [4, Laya.ShaderDataType.Vector4],
                'a_cellUVOriScale': [5, Laya.ShaderDataType.Vector4],
                'a_celluvTrans': [6, Laya.ShaderDataType.Vector4],
            };
            Laya.Shader3D.addInclude("TileMapCommon.glsl", TileMapCommonGLSL);
            Laya.Shader3D.addInclude("TileMapVertex.glsl", TileMapVertexGLSL);
            Laya.Shader3D.addInclude("TileMapFragment.glsl", TileMapFragmentGLSL);
            let uniformMap = {
                'u_render2DTexture': Laya.ShaderDataType.Texture2D,
                'u_TileSize': Laya.ShaderDataType.Vector2,
            };
            let shader = Laya.Shader3D.add("TileMapLayer", false, false);
            shader.shaderType = Laya.ShaderFeatureType.D2_BaseRenderNode2D;
            let subShader = new Laya.SubShader(attributeMap, uniformMap, {});
            shader.addSubShader(subShader);
            subShader.addShaderPass(TileMapVS, TileMapFS);
            TileMapShaderInit._tileMapPositionUVColorDec = new Laya.VertexDeclaration(32, [
                new Laya.VertexElement(0, Laya.VertexElementFormat.Vector2, 0),
                new Laya.VertexElement(8, Laya.VertexElementFormat.Vector2, 1),
                new Laya.VertexElement(16, Laya.VertexElementFormat.Vector4, 2),
            ]);
            TileMapShaderInit._tileMapCellColorInstanceDec = new Laya.VertexDeclaration(16, [
                new Laya.VertexElement(0, Laya.VertexElementFormat.Vector4, 3),
            ]);
            TileMapShaderInit._tileMapCellPosScaleDec = new Laya.VertexDeclaration(16, [
                new Laya.VertexElement(0, Laya.VertexElementFormat.Vector4, 4),
            ]);
            TileMapShaderInit._tileMapCellUVOriScaleDec = new Laya.VertexDeclaration(16, [
                new Laya.VertexElement(0, Laya.VertexElementFormat.Vector4, 5),
            ]);
            TileMapShaderInit._tileMapCellUVTrans = new Laya.VertexDeclaration(16, [
                new Laya.VertexElement(0, Laya.VertexElementFormat.Vector4, 6),
            ]);
        }
    }

    class ChunkCellInfo {
        constructor() {
            this._transFlag = 0;
            this.updateTransFlag = true;
        }
    }
    class TileMapChunkData {
        constructor() {
            this._reCreateRenderData = true;
            this._refGids = [];
            this._dirtyFlags = [];
            this._transFlags = {};
            this._cellDataMap = {};
            this._chuckCellList = [];
            this._animatorAlterArray = new Map();
            this._needUpdateRange = true;
            this._cellDataRefMap = [];
            this._tileSize = new Laya.Vector2();
            this._oriCellIndex = new Laya.Vector2(0, 0);
            this._renderElementArray = [];
            this._sortMode = exports.TileLayerSortMode.ZINDEXSORT;
            for (let i = 0; i < DIRTY_TYPES; i++)
                this._dirtyFlags[i] = new Map;
        }
        get cellDataRefMap() {
            return this._cellDataRefMap;
        }
        set cellDataRefMap(data) {
            if (!data || !Object.keys(data).length)
                return;
            for (let i = 0, len = data.length; i < len; i++) {
                if (data[i]) {
                    this._refGids.push(i);
                }
                else {
                    delete data[i];
                }
            }
            this._cellDataRefMap = data;
            this._modifyData();
        }
        get compressData() {
            let out = {};
            this._refGids.forEach(gid => {
                if (this._cellDataRefMap[gid])
                    out[gid] = this._cellDataRefMap[gid];
            });
            return out;
        }
        set compressData(value) {
            if (!value || !Object.keys(value).length)
                return;
            let nDdata = [];
            for (const key in value) {
                let gid = parseInt(key);
                nDdata[gid] = value[key];
                this._refGids.push(gid);
            }
            this._cellDataRefMap = nDdata;
            this._modifyData();
        }
        get transFlags() {
            this._transFlags = {};
            this._chuckCellList.forEach(cell => {
                this._transFlags[cell.chuckLocalindex] = cell._transFlag;
            });
            return this._transFlags;
        }
        set transFlags(value) {
            if (!value)
                this._transFlags = {};
            else
                this._transFlags = value;
        }
        _parseCellDataRefMap() {
            if (this._chuckCellList.length)
                return;
            let layer = this._tileLayer;
            let tileSet = layer.tileSet;
            if (!tileSet)
                return;
            let chunk = this._tileLayer._chunk;
            let localPos = Laya.Vector2.TEMP;
            for (let i = this._refGids.length - 1; i > -1; i--) {
                let gid = this._refGids[i];
                let localIndexs = this._cellDataRefMap[gid];
                if (localIndexs) {
                    let cellData = tileSet.getCellDataByGid(gid);
                    if (cellData) {
                        cellData._addNoticeRenderTile(this);
                        for (let i = 0, len = localIndexs.length; i < len; i++) {
                            let index = localIndexs[i];
                            chunk._getCellPosByChunkPosAndIndex(0, 0, index, localPos);
                            let chuckCellInfo = new ChunkCellInfo();
                            chuckCellInfo.chuckLocalindex = index;
                            chuckCellInfo.zOrderValue = cellData.z_index;
                            chuckCellInfo.cellx = localPos.x;
                            chuckCellInfo.celly = localPos.y;
                            chuckCellInfo.cell = cellData;
                            chuckCellInfo._transFlag = this._transFlags[index] || 0;
                            chuckCellInfo.sortY = localPos.y + cellData.y_sort_origin;
                            this._cellDataMap[index] = chuckCellInfo;
                            this._chuckCellList.push(chuckCellInfo);
                        }
                        this._setDirtyFlag(gid, exports.TileMapDirtyFlag.CELL_CHANGE);
                    }
                    else {
                        delete this._cellDataRefMap[gid];
                        this._refGids.splice(i, 1);
                    }
                }
            }
            this._modifyData();
        }
        _mergeBuffer(datas, minRange, maxRange) {
            const tempVec2 = Laya.Vector2.TEMP;
            let infos = this._chuckCellList;
            for (let i = 0, len = infos.length; i < len; i++) {
                let info = infos[i];
                this._tileLayer._chunk._getCellPosByChunkPosAndIndex(0, 0, info.chuckLocalindex, tempVec2);
                let cellX = tempVec2.x + this._oriCellIndex.x;
                let cellY = tempVec2.y + this._oriCellIndex.y;
                minRange.x = Math.min(minRange.x, cellX);
                minRange.y = Math.min(minRange.y, cellY);
                maxRange.x = Math.max(maxRange.x, cellX);
                maxRange.y = Math.max(maxRange.y, cellY);
                let row = datas.get(cellY);
                if (!row) {
                    row = new Map();
                    datas.set(cellY, row);
                }
                row.set(cellX, { cell: info.cell, transFlag: info._transFlag });
            }
        }
        _setBuffer(datas, minRange, maxRange, tileSize) {
            this._clearCell();
            const chunk = this._tileLayer._chunk;
            let ocix = this._oriCellIndex.x;
            let ociy = this._oriCellIndex.y;
            let starx = Math.max(minRange.x, ocix);
            let stary = Math.max(minRange.y, ociy);
            let endx = Math.min(maxRange.x, ocix + tileSize - 1);
            let endy = Math.min(maxRange.y, ociy + tileSize - 1);
            let mark = 0;
            for (var j = stary; j <= endy; j++) {
                let row = datas.get(j);
                if (!row)
                    continue;
                for (var i = starx; i <= endx; i++) {
                    let data = row.get(i);
                    if (data) {
                        const index = chunk._getChunkIndexByCellPos(i - ocix, j - ociy);
                        this._setCell(index, data.cell, data.transFlag);
                        mark++;
                    }
                }
            }
            this._modifyData();
            return mark;
        }
        _updateChunkData(chunkX, chunkY) {
            this.chunkX = chunkX;
            this.chunkY = chunkY;
            this._tileLayer._chunk._getCellPosByChunkPosAndIndex(chunkX, chunkY, 0, this._oriCellIndex);
            let tileSet = this._tileLayer.tileSet;
            if (tileSet) {
                tileSet.tileSize.cloneTo(this._tileSize);
                this._gridShape = tileSet.tileShape;
            }
        }
        _upeateGridData() {
            if (this._animatorAlterArray.size > 0) {
                this._animatorAlterArray.forEach((value, key) => {
                    value._updateAnimator();
                });
            }
            if (this._sortMode != this._tileLayer.sortMode) {
                this._sortMode = this._tileLayer.sortMode;
                this._modifyData();
            }
            let tileSet = this._tileLayer.tileSet;
            let tileShape = tileSet.tileShape;
            if (this._gridShape != tileShape) {
                this._gridShape = tileShape;
                this._refGids.forEach(gid => {
                    this._setDirtyFlag(gid, exports.TileMapDirtyFlag.CELL_QUAD, exports.DirtyFlagType.RENDER);
                });
                this._modifyData();
            }
            if (!Laya.Vector2.equals(this._tileSize, tileSet.tileSize)) {
                tileSet.tileSize.cloneTo(this._tileSize);
                this._refGids.forEach(gid => {
                    this._setDirtyFlag(gid, exports.TileMapDirtyFlag.CELL_QUAD | exports.TileMapDirtyFlag.CELL_QUADUV, exports.DirtyFlagType.RENDER);
                });
            }
        }
        _updateRenderData() {
            if (this._reCreateRenderData) {
                this._reCreateRenderData = false;
                this._clearRenderElement();
                if (this._chuckCellList.length == 0)
                    return;
                let compareFunc;
                switch (this._sortMode) {
                    case exports.TileLayerSortMode.YSort:
                        compareFunc = TileMapUtils.compareYSort;
                        break;
                    case exports.TileLayerSortMode.ZINDEXSORT:
                        compareFunc = TileMapUtils.compareZSort;
                        break;
                    case exports.TileLayerSortMode.XSort:
                        compareFunc = TileMapUtils.compareXSort;
                        break;
                    default:
                        compareFunc = TileMapUtils.compareZSort;
                        break;
                }
                this._chuckCellList.sort(compareFunc);
                let lastCell;
                let tempCellIndexArray = [];
                this._animatorAlterArray.clear();
                for (var i = 0; i < this._chuckCellList.length; i++) {
                    let chuckCellInfoData = this._chuckCellList[i];
                    let cellData = chuckCellInfoData.cell;
                    if (!cellData)
                        continue;
                    if (cellData.cellowner._hasAni())
                        this._animatorAlterArray.set(cellData.cellowner.nativeId, cellData.cellowner);
                    if (!lastCell) {
                        lastCell = cellData;
                        tempCellIndexArray.push(chuckCellInfoData);
                        continue;
                    }
                    if (this._breakBatch(lastCell, cellData)) {
                        lastCell = cellData;
                        this._createRenderElement(tempCellIndexArray);
                    }
                    tempCellIndexArray.push(chuckCellInfoData);
                }
                this._createRenderElement(tempCellIndexArray);
            }
            else {
                let dirtyFlag = this._dirtyFlags[exports.DirtyFlagType.RENDER];
                if (dirtyFlag.size > 0) {
                    let pos = Laya.Vector2.TEMP;
                    dirtyFlag.forEach((value, key) => {
                        let cellDataUseArray = this._cellDataRefMap[key];
                        if (cellDataUseArray) {
                            cellDataUseArray.forEach(element => {
                                let chuckCellinfo = this._cellDataMap[element];
                                let cellData = chuckCellinfo.cell;
                                let nativesData = cellData.cellowner;
                                let tilemapRenderElementInfo = this._renderElementArray[chuckCellinfo._renderElementIndex];
                                if (value & exports.TileMapDirtyFlag.CELL_CHANGE || (value & exports.TileMapDirtyFlag.CELL_QUAD)) {
                                    let data = tilemapRenderElementInfo.cacheData[TileMapChunkData.instanceposScalBufferIndex];
                                    tilemapRenderElementInfo.updateFlag[TileMapChunkData.instanceposScalBufferIndex] = true;
                                    this._getCellPos(chuckCellinfo, pos);
                                    let posOffset = cellData.texture_origin;
                                    let dataoffset = chuckCellinfo._cellPosInRenderData * 4;
                                    data[dataoffset] = pos.x + posOffset.x;
                                    data[dataoffset + 1] = pos.y + posOffset.y;
                                    let uvSize = nativesData._getRegionSize();
                                    data[dataoffset + 2] = uvSize.x;
                                    data[dataoffset + 3] = uvSize.y;
                                }
                                if ((value & exports.TileMapDirtyFlag.CELL_CHANGE) || (value & exports.TileMapDirtyFlag.CELL_QUADUV)) {
                                    let data = tilemapRenderElementInfo.cacheData[TileMapChunkData.instanceuvOriScalBufferIndex];
                                    tilemapRenderElementInfo.updateFlag[TileMapChunkData.instanceuvOriScalBufferIndex] = true;
                                    let dataoffset = chuckCellinfo._cellPosInRenderData * 4;
                                    let uvOri = nativesData._getTextureUVOri();
                                    let uvextend = nativesData._getTextureUVExtends();
                                    data[dataoffset] = uvOri.x;
                                    data[dataoffset + 1] = uvOri.y;
                                    data[dataoffset + 2] = uvextend.x;
                                    data[dataoffset + 3] = uvextend.y;
                                }
                                if ((value & exports.TileMapDirtyFlag.CELL_CHANGE) || (value & exports.TileMapDirtyFlag.CELL_COLOR)) {
                                    let data = tilemapRenderElementInfo.cacheData[TileMapChunkData.instanceColorBufferIndex];
                                    tilemapRenderElementInfo.updateFlag[TileMapChunkData.instanceColorBufferIndex] = true;
                                    let dataoffset = chuckCellinfo._cellPosInRenderData * 4;
                                    let color = cellData.colorModulate;
                                    data[dataoffset] = color.r;
                                    data[dataoffset + 1] = color.g;
                                    data[dataoffset + 2] = color.b;
                                    data[dataoffset + 3] = color.a;
                                }
                                if (chuckCellinfo.updateTransFlag || (value & exports.TileMapDirtyFlag.CELL_UVTRAN) || (value & exports.TileMapDirtyFlag.CELL_CHANGE)) {
                                    chuckCellinfo.updateTransFlag = false;
                                    let data = tilemapRenderElementInfo.cacheData[TileMapChunkData.instanceuvTransBufferIndex];
                                    tilemapRenderElementInfo.updateFlag[TileMapChunkData.instanceuvTransBufferIndex] = true;
                                    let dataoffset = chuckCellinfo._cellPosInRenderData * 4;
                                    let transData = TileMapUtils.parseTransFlag(this._gridShape, chuckCellinfo._transFlag, cellData);
                                    data[dataoffset] = transData.x;
                                    data[dataoffset + 1] = transData.y;
                                    data[dataoffset + 2] = transData.z;
                                    data[dataoffset + 3] = transData.w;
                                }
                            });
                        }
                    });
                    this._renderElementArray.forEach(element => {
                        for (var updateindex = 0, updatelength = 4; updateindex < updatelength; updateindex++) {
                            if (element.updateFlag[updateindex]) {
                                let data = element.cacheData[updateindex];
                                let verBuffer = element.renderElement.geometry.bufferState._vertexBuffers[updateindex + 1];
                                verBuffer.setData(data.buffer, 0, 0, data.byteLength);
                                element.updateFlag[updateindex] = false;
                            }
                        }
                    });
                    dirtyFlag.clear();
                }
            }
        }
        _updatePhysicsData() {
            if (!this._tileLayer.tileMapPhysics.enable || !this._tileLayer.owner.scene || !this._dirtyFlags[exports.DirtyFlagType.PHYSICS].size)
                return;
            let physicsLayers = this._tileLayer.tileSet.physicsLayers;
            if (!physicsLayers || !physicsLayers.length)
                return;
            let physics = this._tileLayer.tileMapPhysics;
            let dirtyFlag = this._dirtyFlags[exports.DirtyFlagType.PHYSICS];
            let rigidBody = this._rigidBody;
            if (!rigidBody) {
                rigidBody = physics.createRigidBody();
            }
            let layerCount = physicsLayers.length;
            let chunk = this._tileLayer._chunk;
            let pos = Laya.Vector2.TEMP;
            let scaleX = this._tileLayer.owner.scaleX;
            let scaleY = this._tileLayer.owner.scaleY;
            dirtyFlag.forEach((value, key) => {
                let cellDataUseArray = this._cellDataRefMap[key];
                if (cellDataUseArray) {
                    cellDataUseArray.forEach(element => {
                        let chunkCellInfo = this._cellDataMap[element];
                        let cellData = chunkCellInfo.cell;
                        let cellDatas = cellData.physicsDatas;
                        if (cellDatas && (value & exports.TileMapDirtyFlag.CELL_CHANGE) || (value & exports.TileMapDirtyFlag.CELL_PHYSICS)) {
                            chunk._getPixelByChunkPosAndIndex(this.chunkX, this.chunkY, chunkCellInfo.chuckLocalindex, pos);
                            let ofx = pos.x;
                            let ofy = pos.y;
                            let datas = chunkCellInfo._physicsDatas;
                            if (!datas) {
                                datas = [];
                                chunkCellInfo._physicsDatas = datas;
                            }
                            for (let i = 0; i < layerCount; i++) {
                                let physicslayer = physicsLayers[i];
                                let pIndex = physicslayer.id;
                                if (!cellDatas[pIndex])
                                    continue;
                                let data = datas[pIndex];
                                if (data) {
                                    physics.destroyFixture(rigidBody, data);
                                }
                                let shape = cellDatas[pIndex].shape;
                                if (!shape)
                                    continue;
                                let shapeLength = shape.length;
                                let nShape = new Array(shapeLength);
                                for (let j = 0; j < shapeLength; j += 2) {
                                    nShape[j] = (shape[j] + ofx) * scaleX;
                                    nShape[j + 1] = (shape[j + 1] + ofy) * scaleY;
                                }
                                data = physics.createFixture(rigidBody, physicslayer, nShape);
                            }
                        }
                    });
                }
            });
            dirtyFlag.clear();
        }
        _updateLightShadowData() {
            if (!this._tileLayer.tileMapOccluder.enable || !this._dirtyFlags[exports.DirtyFlagType.OCCLUSION].size)
                return;
            let lightInfoLayers = this._tileLayer.tileSet.lightInfoLayers;
            if (!lightInfoLayers || !lightInfoLayers.length)
                return;
            let agent = this._tileLayer.tileMapOccluder;
            let dirtyFlag = this._dirtyFlags[exports.DirtyFlagType.OCCLUSION];
            let layerCount = lightInfoLayers.length;
            let chunk = this._tileLayer._chunk;
            let pos = Laya.Vector2.TEMP;
            dirtyFlag.forEach((value, key) => {
                let cellDataUseArray = this._cellDataRefMap[key];
                if (cellDataUseArray) {
                    cellDataUseArray.forEach(element => {
                        let chunkCellInfo = this._cellDataMap[element];
                        let cellData = chunkCellInfo.cell;
                        let cellDatas = cellData.lightOccluderDatas;
                        if (cellDatas && (value & exports.TileMapDirtyFlag.CELL_CHANGE) || (value & exports.TileMapDirtyFlag.CELL_LIGHTSHADOW)) {
                            chunk._getPixelByChunkPosAndIndex(this.chunkX, this.chunkY, chunkCellInfo.chuckLocalindex, pos);
                            let ofx = pos.x;
                            let ofy = pos.y;
                            let datas = chunkCellInfo._occluderDatas;
                            if (!datas) {
                                datas = [];
                                chunkCellInfo._occluderDatas = datas;
                            }
                            for (let i = 0; i < layerCount; i++) {
                                let layer = lightInfoLayers[i];
                                let pIndex = layer.id;
                                if (!cellDatas[pIndex])
                                    continue;
                                let shape = cellDatas[pIndex].shape;
                                if (!shape)
                                    continue;
                                let shapeLength = shape.length;
                                let point = new Laya.PolygonPoint2D;
                                let data = datas[pIndex];
                                if (!data) {
                                    data = agent.addOccluder(point, layer.layerMask);
                                    datas[pIndex] = data;
                                }
                                for (let j = 0; j < shapeLength; j += 2)
                                    point.addPoint(shape[j] + ofx, shape[j + 1] + ofy);
                                data.polygonPoint = point;
                            }
                        }
                    });
                }
            });
            dirtyFlag.clear();
        }
        _updateNavigationData() {
        }
        _breakBatch(lastCell, curCell) {
            if (lastCell == null && curCell == null)
                return true;
            if (lastCell.cellowner.owner.id != curCell.cellowner.owner.id)
                return true;
            if (lastCell.material == null && curCell.material == null)
                return false;
            return lastCell.material != curCell.material;
        }
        _createRenderElement(chuckCellList) {
            if (chuckCellList.length == 0)
                return;
            let cellNum = chuckCellList.length;
            let cellData = chuckCellList[0].cell;
            let mat = cellData.material;
            let nativesData = cellData.cellowner;
            let texture = nativesData.owner.atlas;
            if (!mat) {
                mat = this._material;
            }
            if (mat == null) {
                mat = this._tileLayer.getDefalutMaterial(texture);
            }
            let element = TileChunkPool._getTileRenderElement(cellNum);
            let renderElement = element.renderElement;
            renderElement.owner = this._tileLayer.owner._struct;
            let cachDatas = element.cacheData;
            let instanceColor = cachDatas[TileMapChunkData.instanceColorBufferIndex];
            let instanceposScal = cachDatas[TileMapChunkData.instanceposScalBufferIndex];
            let instanceuvOriScal = cachDatas[TileMapChunkData.instanceuvOriScalBufferIndex];
            let instanceuvTrans = cachDatas[TileMapChunkData.instanceuvTransBufferIndex];
            let pos = Laya.Vector2.TEMP;
            let renderElementLength = this._renderElementArray.length;
            for (var i = 0; i < cellNum; i++) {
                let chuckcellInfo = chuckCellList[i];
                let curCell = chuckcellInfo.cell;
                let curNative = curCell.cellowner;
                chuckcellInfo._cellPosInRenderData = i;
                chuckcellInfo._renderElementIndex = renderElementLength;
                this._getCellPos(chuckcellInfo, pos);
                let color = curCell.colorModulate;
                let dataOffset = i * 4;
                instanceColor[dataOffset] = color.r;
                instanceColor[dataOffset + 1] = color.g;
                instanceColor[dataOffset + 2] = color.b;
                instanceColor[dataOffset + 3] = color.a;
                let posOffset = curCell.texture_origin;
                instanceposScal[dataOffset] = pos.x + posOffset.x;
                instanceposScal[dataOffset + 1] = pos.y + posOffset.y;
                let uvSize = curNative._getRegionSize();
                instanceposScal[dataOffset + 2] = uvSize.x;
                instanceposScal[dataOffset + 3] = uvSize.y;
                let uvOri = curNative._getTextureUVOri();
                let uvextend = curNative._getTextureUVExtends();
                instanceuvOriScal[dataOffset] = uvOri.x;
                instanceuvOriScal[dataOffset + 1] = uvOri.y;
                instanceuvOriScal[dataOffset + 2] = uvextend.x;
                instanceuvOriScal[dataOffset + 3] = uvextend.y;
                const transData = TileMapUtils.parseTransFlag(this._gridShape, chuckcellInfo._transFlag, cellData);
                instanceuvTrans[dataOffset] = transData.x;
                instanceuvTrans[dataOffset + 1] = transData.y;
                instanceuvTrans[dataOffset + 2] = transData.z;
                instanceuvTrans[dataOffset + 3] = transData.w;
                chuckcellInfo.updateTransFlag = false;
            }
            let instanceColorBuffer = TileChunkPool._getVertexBuffer(TileMapShaderInit._tileMapCellColorInstanceDec, instanceColor);
            let instanceposScalBuffer = TileChunkPool._getVertexBuffer(TileMapShaderInit._tileMapCellPosScaleDec, instanceposScal);
            let instanceuvOriScalBuffer = TileChunkPool._getVertexBuffer(TileMapShaderInit._tileMapCellUVOriScaleDec, instanceuvOriScal);
            let instanceuvTransBuffer = TileChunkPool._getVertexBuffer(TileMapShaderInit._tileMapCellUVTrans, instanceuvTrans);
            let geometry = renderElement.geometry;
            geometry.setDrawElemenParams(this._tileLayer._grid._getBaseIndexCount(), 0);
            renderElement.materialShaderData = mat.shaderData;
            renderElement.subShader = mat.shader.getSubShaderAt(0);
            renderElement.value2DShaderData = this._tileLayer._spriteShaderData;
            let binVertexBuffers = [this._tileLayer._grid._getBaseVertexBuffer(), instanceColorBuffer, instanceposScalBuffer, instanceuvOriScalBuffer, instanceuvTransBuffer];
            let indexBuffer = this._tileLayer._grid._getBaseIndexBuffer();
            geometry.bufferState.applyState(binVertexBuffers, indexBuffer);
            geometry.instanceCount = cellNum;
            chuckCellList.length = 0;
            this._renderElementArray.push(element);
        }
        _clearRenderElement() {
            for (var i = 0, n = this._renderElementArray.length; i < n; i++) {
                TileChunkPool._recoverTileRenderElement(this._renderElementArray[i]);
            }
            this._renderElementArray.length = 0;
        }
        _setRenderData(datas) {
            let maxCount = this._tileLayer._chunk.maxCell;
            if (datas.length > maxCount) {
                console.error("setRenderData error");
                return;
            }
            this._updateChunkData(datas.x, datas.y);
            let tileSet = this._tileLayer.tileSet;
            let tiles = datas.tiles;
            let temp = {};
            for (let i = 0, len = tiles.length; i < len; i += 3) {
                let gid = tiles[i + 1];
                let transFlag = tiles[i + 2];
                let celldata = temp[gid];
                if (!celldata) {
                    celldata = tileSet.getCellDataByGid(gid);
                    temp[gid] = celldata;
                }
                this._setCell(tiles[i], celldata, transFlag);
            }
        }
        _clearnRefTileCellData() {
            let tileSet = this._tileLayer.tileSet;
            this._cellDataRefMap.forEach((value, key) => {
                let cellData = tileSet.getCellDataByGid(key);
                cellData._removeNoticeRenderTile(this);
            });
            this._cellDataRefMap = [];
            this._refGids.length = 0;
        }
        _clearAllChunkCellInfo() {
            for (let i = 0, len = this._chuckCellList.length; i < len; i++)
                this._clearChunkCellInfo(this._chuckCellList[i]);
            this._chuckCellList = [];
            this._cellDataMap = [];
        }
        _update() {
            this._upeateGridData();
            this._updateRenderData();
            this._updatePhysicsData();
            this._updateLightShadowData();
            this._updateNavigationData();
        }
        _getCellPos(sheetCell, out) {
            out.x = this._oriCellIndex.x + sheetCell.cellx;
            out.y = this._oriCellIndex.y + sheetCell.celly;
            this._tileLayer._grid._gridToPixel(out.x, out.y, out);
        }
        _mergeToElement(renderElements) {
            this._renderElementArray.forEach(element => {
                renderElements.push(element.renderElement);
            });
        }
        _setCell(index, cellData, transFlag) {
            let gid = cellData.gid;
            if (gid < 0)
                return;
            if (!this._cellDataRefMap[gid]) {
                this._cellDataRefMap[gid] = [];
                this._refGids.push(gid);
                cellData._addNoticeRenderTile(this);
            }
            let chunkCellInfo = this._cellDataMap[index];
            if (chunkCellInfo == null) {
                let chunk = this._tileLayer._chunk;
                let localPos = Laya.Vector2.TEMP;
                chunk._getCellPosByChunkPosAndIndex(0, 0, index, localPos);
                let chuckCellInfo = new ChunkCellInfo();
                chuckCellInfo.chuckLocalindex = index;
                chuckCellInfo.zOrderValue = cellData.z_index;
                chuckCellInfo.cellx = localPos.x;
                chuckCellInfo.celly = localPos.y;
                chuckCellInfo.cell = cellData;
                chuckCellInfo._transFlag = transFlag;
                chuckCellInfo.sortY = localPos.y + cellData.y_sort_origin;
                this._cellDataRefMap[gid].push(index);
                this._cellDataMap[index] = chuckCellInfo;
                this._chuckCellList.push(chuckCellInfo);
                this._modifyData();
            }
            else if (chunkCellInfo.cell != cellData) {
                let oldcell = chunkCellInfo.cell;
                let oldGid = oldcell.gid;
                let localIndexArray = this._cellDataRefMap[oldGid];
                localIndexArray.splice(localIndexArray.indexOf(chunkCellInfo.chuckLocalindex), 1);
                if (localIndexArray.length == 0) {
                    delete this._cellDataRefMap[oldGid];
                    this._refGids.splice(this._refGids.indexOf(oldGid), 1);
                    oldcell._removeNoticeRenderTile(this);
                }
                chunkCellInfo.cell = cellData;
                chunkCellInfo.zOrderValue = cellData.z_index;
                chunkCellInfo.sortY = chunkCellInfo.celly + cellData.y_sort_origin;
                localIndexArray = this._cellDataRefMap[gid];
                localIndexArray.push(chunkCellInfo.chuckLocalindex);
                chunkCellInfo._transFlag = transFlag;
                chunkCellInfo.updateTransFlag = true;
                if (this._breakBatch(oldcell, cellData)) {
                    this._modifyData();
                }
            }
            else if (chunkCellInfo._transFlag != transFlag) {
                chunkCellInfo._transFlag = transFlag;
                chunkCellInfo.updateTransFlag = true;
            }
            this._setDirtyFlag(gid, exports.TileMapDirtyFlag.CELL_CHANGE);
        }
        _clearChunkCellInfo(cellInfo) {
            let physicsDatas = cellInfo._physicsDatas;
            if (physicsDatas) {
                let physics = this._tileLayer.tileMapPhysics;
                for (let i = 0, len = physicsDatas.length; i < len; i++)
                    physics.destroyFixture(this._rigidBody, physicsDatas[i]);
            }
            let occluders = cellInfo._occluderDatas;
            if (occluders) {
                let occluder = this._tileLayer.tileMapOccluder;
                for (let i = 0, len = occluders.length; i < len; i++)
                    occluder.removeOccluder(occluders[i]);
            }
        }
        _removeCell(index) {
            let chunkCellInfo = this._cellDataMap[index];
            if (!chunkCellInfo)
                return;
            this._clearChunkCellInfo(chunkCellInfo);
            let sotIndex = this._chuckCellList.indexOf(chunkCellInfo);
            this._chuckCellList.splice(sotIndex, 1);
            delete this._cellDataMap[chunkCellInfo.chuckLocalindex];
            let gid = chunkCellInfo.cell.gid;
            let localIndexArray = this._cellDataRefMap[gid];
            localIndexArray.splice(localIndexArray.indexOf(index), 1);
            if (localIndexArray.length == 0) {
                delete this._cellDataRefMap[gid];
                this._refGids.splice(this._refGids.indexOf(gid), 1);
                chunkCellInfo.cell._removeNoticeRenderTile(this);
            }
            this._modifyData();
        }
        _modifyData() {
            this._needUpdateRange = true;
            this._reCreateRenderData = true;
        }
        getRange() {
            if (this._needUpdateRange) {
                this._range || (this._range = new Laya.Rectangle());
                this._needUpdateRange = false;
                this._calculateRange();
            }
            return this._range;
        }
        _calculateRange() {
            if (!this._chuckCellList.length || !this._tileSize || this._tileSize.x <= 0 || this._tileSize.y <= 0) {
                this._range.setTo(0, 0, 0, 0);
                return;
            }
            let chunkMinX = Number.MAX_VALUE, chunkMinY = Number.MAX_VALUE;
            let chunkMaxX = -Number.MAX_VALUE, chunkMaxY = -Number.MAX_VALUE;
            let chunkWidth = 0, chunkHeight = 0;
            if (this._chuckCellList.length > 0) {
                for (let cellInfo of this._chuckCellList) {
                    let atlasSize = cellInfo.cell.cellowner.sizeByAtlas;
                    let halfWidth = atlasSize.x * 0.5;
                    let halfHeight = atlasSize.y * 0.5;
                    let minx = cellInfo.cellx - halfWidth;
                    let miny = cellInfo.celly - halfHeight;
                    let maxx = cellInfo.cellx + halfWidth;
                    let maxy = cellInfo.celly + halfHeight;
                    chunkMinX = Math.min(chunkMinX, minx);
                    chunkMinY = Math.min(chunkMinY, miny);
                    chunkMaxX = Math.max(chunkMaxX, maxx);
                    chunkMaxY = Math.max(chunkMaxY, maxy);
                }
                chunkWidth = chunkMaxX - chunkMinX;
                chunkHeight = chunkMaxY - chunkMinY;
            }
            let width = 0, height = 0;
            switch (this._gridShape) {
                case exports.TileShape.TILE_SHAPE_SQUARE:
                    width = chunkWidth * this._tileSize.x;
                    height = chunkHeight * this._tileSize.y;
                    break;
                case exports.TileShape.TILE_SHAPE_ISOMETRIC:
                    width = chunkWidth * this._tileSize.x;
                    if (chunkHeight > 1 && chunkHeight % 2 === 1) {
                        width += 0.5 * this._tileSize.x;
                    }
                    height = chunkHeight * this._tileSize.y;
                    break;
                case exports.TileShape.TILE_SHAPE_HALF_OFFSET_SQUARE:
                    width = chunkWidth * this._tileSize.x;
                    if (chunkHeight > 1 && chunkHeight % 2 === 1) {
                        width += 0.5 * this._tileSize.x;
                    }
                    height = chunkHeight * this._tileSize.y;
                    break;
                case exports.TileShape.TILE_SHAPE_HEXAGON:
                    width = chunkWidth * this._tileSize.x;
                    if (chunkHeight > 1 && chunkHeight % 2 === 1) {
                        width += 0.5 * this._tileSize.x;
                    }
                    height = chunkHeight * this._tileSize.y;
                    break;
                default:
                    width = chunkWidth * this._tileSize.x;
                    height = chunkHeight * this._tileSize.y;
                    break;
            }
            let x = (this._oriCellIndex.x + chunkMinX + 0.5) * this._tileSize.x;
            let y = (this._oriCellIndex.y + chunkMinY + 0.5) * this._tileSize.y;
            this._range.setTo(x, y, width, height);
        }
        getCell(index) {
            return this._cellDataMap[index];
        }
        _refreshCellSort(cellData) {
            if (!cellData)
                return;
            let gid = cellData.gid;
            if (gid < 0)
                return;
            let indexList = this._cellDataRefMap[gid];
            if (!indexList || !indexList.length)
                return;
            for (let i = 0, len = indexList.length; i < len; i++) {
                const cellIndex = indexList[i];
                const info = this._cellDataMap[cellIndex];
                if (!info)
                    continue;
                info.sortY = info.celly + cellData.y_sort_origin;
                info.zOrderValue = cellData.z_index;
            }
            this._modifyData();
        }
        _clearOneCell(cell) {
            let gid = cell.gid;
            let listArray = this._cellDataRefMap[gid];
            if (listArray) {
                for (const index of listArray.slice())
                    this._removeCell(index);
            }
            this._modifyData();
            this._dirtyFlags.forEach(flags => flags.delete(gid));
        }
        _setDirtyFlag(gid, flag, type = exports.DirtyFlagType.ALL) {
            if (type == exports.DirtyFlagType.ALL) {
                for (let i = 0, len = DIRTY_TYPES; i < len; i++) {
                    let flags = this._dirtyFlags[i];
                    flags.set(gid, flags.get(gid) | flag);
                }
            }
            else {
                let flags = this._dirtyFlags[type];
                flags.set(gid, flags.get(gid) | flag);
            }
        }
        _forceUpdateDrity(flags) {
            this._cellDataRefMap.forEach((value, gid) => {
                for (let i = 0, len = DIRTY_TYPES; i < len; i++) {
                    flags[i] && this._dirtyFlags[i].set(gid, exports.TileMapDirtyFlag.CELL_CHANGE);
                }
            });
        }
        _clearCell() {
            this._clearAllChunkCellInfo();
            this._clearnRefTileCellData();
            this._dirtyFlags.forEach(flags => flags.clear());
            this._modifyData();
        }
        _destroy() {
            if (this._rigidBody) {
                this._tileLayer.tileMapPhysics.destroyRigidBody(this._rigidBody);
                this._rigidBody = null;
            }
            this._clearCell();
            this._clearRenderElement();
            this._cellDataRefMap = null;
            this._dirtyFlags = null;
            this._tileLayer = null;
        }
        _debugDrawLines(sprite, points) {
            let lastx = points[0];
            let lasty = points[1];
            for (let i = 2, len = points.length; i < len; i += 2) {
                let curx = points[i];
                let cury = points[i + 1];
                sprite.graphics.drawLine(lastx, lasty, curx, cury, "#ff0000");
                lastx = curx;
                lasty = cury;
            }
        }
    }
    TileMapChunkData.instanceColorBufferIndex = 0;
    TileMapChunkData.instanceposScalBufferIndex = 1;
    TileMapChunkData.instanceuvOriScalBufferIndex = 2;
    TileMapChunkData.instanceuvTransBufferIndex = 3;
    class TileChunkPool {
        static _getVertexBuffer(dec, vertices) {
            let buffer = TileChunkPool._instanceBufferPool.pop();
            if (!buffer) {
                buffer = Laya.LayaGL.renderDeviceFactory.createVertexBuffer(Laya.BufferUsage.Dynamic);
                buffer.instanceBuffer = true;
            }
            buffer.setDataLength(vertices.byteLength);
            buffer.setData(vertices.buffer, 0, 0, vertices.byteLength);
            buffer.vertexDeclaration = dec;
            return buffer;
        }
        static _recoverVertexBuffer(buffer) {
            this._instanceBufferPool.push(buffer);
        }
        static _getTileRenderElement(cellNum) {
            let element = TileChunkPool._renderElementPool.pop();
            if (!element) {
                let geometry = Laya.LayaGL.renderDeviceFactory.createRenderGeometryElement(Laya.MeshTopology.Triangles, Laya.DrawType.DrawElementInstance);
                let renderElement = Laya.LayaGL.render2DRenderPassFactory.createRenderElement2D();
                renderElement.geometry = geometry;
                geometry.bufferState = Laya.LayaGL.renderDeviceFactory.createBufferState();
                geometry.indexFormat = Laya.IndexFormat.UInt16;
                renderElement.renderStateIsBySprite = false;
                renderElement.nodeCommonMap = ["BaseRender2D"];
                element = {
                    renderElement,
                    cacheData: null,
                    updateFlag: [false, false, false, false],
                    maxCell: 0
                };
            }
            element.cacheData = [new Float32Array(cellNum * 4), new Float32Array(cellNum * 4), new Float32Array(cellNum * 4), new Float32Array(cellNum * 4)];
            return element;
        }
        static _recoverTileRenderElement(element) {
            element.cacheData = null;
            let renderElement = element.renderElement;
            renderElement.materialShaderData = null;
            renderElement.value2DShaderData = null;
            renderElement.subShader = null;
            let geometry = renderElement.geometry;
            for (let j = 2, jn = geometry.bufferState._vertexBuffers.length; j < jn; j++)
                TileChunkPool._recoverVertexBuffer(geometry.bufferState._vertexBuffers[j]);
            let updateFlag = element.updateFlag;
            for (let i = 0; i < 4; i++)
                updateFlag[i] = false;
            TileChunkPool._renderElementPool.push(element);
        }
    }
    TileChunkPool._instanceBufferPool = [];
    TileChunkPool._renderElementPool = [];

    class BaseSheet {
        constructor() {
            this._width = 0;
            this._height = 0;
            this._vbData = [];
            this._ibData = [];
            this._outline = [];
            this._matrix = new Laya.Matrix();
            this._origMatix = new Laya.Matrix();
            this._reverseMatrix = new Laya.Matrix();
            this._initData();
            this.setTileSize(1, 1);
        }
        getMatrix() { return this._matrix; }
        getInverseMatrix() { return this._reverseMatrix; }
        getTileWidth() { return this._width; }
        getTileHeight() { return this._height; }
        getTileBaseOutline() { return this._outline; }
        _initData() {
        }
        setTileSize(width, height) {
            if (width < 1 || height < 1)
                console.error(" value must bigger than 1.");
            if (this._width == width && this._height == height)
                return;
            this._width = width;
            this._height = height;
            this._matrix.setTo(this._width, 0, 0, this._height, 0, 0);
            Laya.Matrix.mul(this._origMatix, this._matrix, this._matrix);
            this._matrix.copyTo(this._reverseMatrix);
            this._reverseMatrix.invert();
        }
        getvbs() { return this._vbData; }
        getibs() { return this._ibData; }
        pixelToGrid(pixelx, pixely, out) {
            TileMapUtils.transfromPointByValue(this._reverseMatrix, pixelx, pixely, out);
        }
        gridToPixel(row, col, out) {
            TileMapUtils.transfromPointByValue(this._matrix, row, col, out);
        }
        _getChunkSize(rowCount, colCount, out) { }
        _getChunkLeftTop(row, col, rowCount, colCount, out) { }
    }

    class HalfOffSquareSheet extends BaseSheet {
        constructor(_offset = -1) {
            super();
            this._offset = 0;
            this._offset = _offset;
        }
        _initData() {
            this._origMatix.setTo(1, 0, 0, 1, 0.5, 0.5);
            this._ibData = [0, 1, 2, 0, 2, 3];
            this._vbData = [1, 1, 0, 1, 0, 0, 1, 0];
            this._outline = [0, 0, 1, 0, 1, 1, 0, 1];
        }
        pixelToGrid(pixelX, pixelY, out) {
            super.pixelToGrid(pixelX, pixelY, out);
            let col = out.y = Math.round(out.y);
            out.x = Math.round(out.x + this._offset * (Math.abs(col) & 1) * 0.5);
        }
        gridToPixel(row, col, out) {
            row = row - this._offset * (Math.abs(col) & 1) * 0.5;
            super.gridToPixel(row, col, out);
        }
        _getChunkSize(rowCount, colCount, out) {
            rowCount = Math.max(rowCount - 1, 0);
            colCount = Math.max(colCount - 1, 0);
            this.gridToPixel(rowCount, colCount, out);
            let endX = this._width;
            if (colCount % 2 == 1) {
                endX += 0.5 * this._width;
            }
            out.x += endX;
            out.y += this._height;
        }
        _getChunkLeftTop(row, col, rowCount, colCount, out) {
            this.gridToPixel(row, col, out);
            if ((colCount == 1) || (col % 2 == 0)) {
                out.x -= 0.5 * this._width;
            }
            else {
                out.x -= this._width;
            }
            out.y -= this._height * 0.5;
        }
    }

    class HeixSheet extends BaseSheet {
        constructor(_offset = -1) {
            super();
            this._offset = 0;
            this._offset = _offset;
        }
        _initData() {
            this._origMatix.setTo(1, 0, 0.5, 0.75, 0.5, 0.5);
            this._ibData = [0, 1, 2, 0, 2, 3];
            this._vbData = [1, 1, 0, 1, 0, 0, 1, 0];
            this._outline = [0.5, 0, 1, 0.25, 1, 0.75, 0.5, 1, 0, 0.75, 0, 0.25];
        }
        prixToGrid(out, offset) {
            const q = out.x;
            const r = out.y;
            const s = -q - r;
            var qi = Math.round(q);
            var ri = Math.round(r);
            var si = Math.round(s);
            var q_diff = Math.abs(qi - q);
            var r_diff = Math.abs(ri - r);
            var s_diff = Math.abs(si - s);
            if (q_diff > r_diff && q_diff > s_diff) {
                qi = -ri - si;
            }
            else if (r_diff > s_diff) {
                ri = -qi - si;
            }
            out.x = qi + (ri + offset * (ri & 1)) / 2;
            out.y = ri;
        }
        pixelToGrid(pixelX, pixelY, out) {
            super.pixelToGrid(pixelX, pixelY, out);
            this.prixToGrid(out, this._offset);
        }
        gridToPixel(row, col, out) {
            row = row - (col + this._offset * (col & 1)) / 2;
            super.gridToPixel(row, col, out);
        }
        _getChunkSize(rowCount, colCount, out) {
            rowCount = Math.max(rowCount - 1, 0);
            colCount = Math.max(colCount - 1, 0);
            this.gridToPixel(rowCount, colCount, out);
            let endX = this._width;
            if (colCount % 2 == 1) {
                endX += 0.5 * this._width;
            }
            out.x += endX;
            out.y += this._height;
        }
        _getChunkLeftTop(row, col, rowCount, colCount, out) {
            this.gridToPixel(row, col, out);
            if ((colCount == 1) || (col % 2 == 0)) {
                out.x -= 0.5 * this._width;
            }
            else {
                out.x -= this._width;
            }
            out.y -= this._height * 0.5;
        }
    }

    class IsometricSheet extends BaseSheet {
        constructor(_offset = 1) {
            super();
            this._offset = 0;
            this._offset = _offset;
        }
        _initData() {
            this._origMatix.setTo(1, 0, 0, 1, 0.5, 0.5);
            this._ibData = [0, 1, 2, 0, 2, 3];
            this._vbData = [1, 1, 0, 1, 0, 0, 1, 0];
            this._outline = [0, 0.5, 0.5, 0, 1, 0.5, 0.5, 1];
        }
        pixelToGrid(pixelX, pixelY, out) {
            super.pixelToGrid(pixelX, pixelY, out);
            let row = Math.round(out.x);
            let col = Math.round(out.y);
            let offx = 0, offy = 0;
            if ((Math.abs(out.x - row) + Math.abs(out.y - col)) > 0.5) {
                out.x < row ? offx = -1 : offx = 0;
                out.y < col ? offy = -1 : offy = 1;
                if (this._offset == -1) {
                    offx += 1;
                }
            }
            out.x = row + offx;
            out.y = col * 2 + offy;
        }
        gridToPixel(row, col, out) {
            row = Math.floor(row);
            col = Math.floor(col);
            if (col & 1) {
                row = row + 0.5 * this._offset;
            }
            super.gridToPixel(row, col * 0.5, out);
        }
        _getChunkSize(rowCount, colCount, out) {
            rowCount = Math.max(rowCount - 1, 0);
            colCount = Math.max(colCount - 1, 0);
            this.gridToPixel(rowCount, colCount, out);
            let endX = this._width;
            if (colCount % 2 == 1) {
                endX += 0.5 * this._width;
            }
            out.x += endX;
            out.y += this._height;
        }
        _getChunkLeftTop(row, col, rowCount, colCount, out) {
            this.gridToPixel(row, col, out);
            if ((colCount == 1) || (col % 2 == 0)) {
                out.x -= 0.5 * this._width;
            }
            else {
                out.x -= this._width;
            }
            out.y -= this._height * 0.5;
        }
    }

    class RectSheet extends BaseSheet {
        constructor() {
            super();
        }
        _initData() {
            this._origMatix.setTo(1, 0, 0, 1, 0.5, 0.5);
            this._ibData = [0, 1, 2, 0, 2, 3];
            this._vbData = [1, 1, 0, 1, 0, 0, 1, 0];
            this._outline = [0, 0, 1, 0, 1, 1, 0, 1];
        }
        gridToPixel(row, col, out) {
            super.gridToPixel(row, col, out);
            out.x = Math.round(out.x);
            out.y = Math.round(out.y);
        }
        _getChunkSize(rowCount, colCount, out) {
            rowCount = Math.max(rowCount - 1, 0);
            colCount = Math.max(colCount - 1, 0);
            this.gridToPixel(rowCount, colCount, out);
            out.x += this._width;
            out.y += this._height;
        }
        _getChunkLeftTop(row, col, rowCount, colCount, out) {
            this.gridToPixel(row, col, out);
            out.x -= this._width * 0.5;
            out.y -= this._height * 0.5;
        }
    }

    class Grid {
        constructor() {
            this._offset = new Laya.Vector2();
            this._color = new Laya.Color(0, 0, 0, 0);
            this._vbLength = 0;
            let vertex = this._vbs = Laya.LayaGL.renderDeviceFactory.createVertexBuffer(Laya.BufferUsage.Dynamic);
            vertex.vertexDeclaration = TileMapShaderInit._tileMapPositionUVColorDec;
            vertex.instanceBuffer = false;
            this._ibs = Laya.LayaGL.renderDeviceFactory.createIndexBuffer(Laya.BufferUsage.Dynamic);
        }
        _updateTileShape(tileShape, size) {
            if (this._tileShape == tileShape)
                return false;
            this._tileShape = tileShape;
            switch (this._tileShape) {
                case exports.TileShape.TILE_SHAPE_SQUARE:
                    this._sheet = new RectSheet();
                    this._offset.setValue(0, 0);
                    break;
                case exports.TileShape.TILE_SHAPE_HALF_OFFSET_SQUARE:
                    this._sheet = new HalfOffSquareSheet();
                    this._offset.setValue(0, -1);
                    break;
                case exports.TileShape.TILE_SHAPE_HEXAGON:
                    this._sheet = new HeixSheet();
                    this._offset.setValue(1, -1);
                    break;
                case exports.TileShape.TILE_SHAPE_ISOMETRIC:
                    this._sheet = new IsometricSheet();
                    this._offset.setValue(0, 0);
                    break;
                default:
                    throw Error("unknow the type .");
            }
            this._setTileSize(size.x, size.y);
            return true;
        }
        _updateColor(color) {
            if (color.equal(this._color))
                return false;
            color.cloneTo(this._color);
            return true;
        }
        _updateBufferData() {
            let vbs = this._sheet.getvbs();
            let step = 8;
            let vbCount = vbs.length / 2;
            var buffer = new Float32Array(vbCount * step);
            for (var i = 0; i < vbCount; i++) {
                let index = i * step;
                var vbIndex = i * 2;
                let x = vbs[vbIndex];
                let y = vbs[vbIndex + 1];
                buffer[index] = buffer[index + 2] = x - 0.5;
                buffer[index + 1] = buffer[index + 3] = y - 0.5;
                buffer[index + 4] = this._color.r;
                buffer[index + 5] = this._color.g;
                buffer[index + 6] = this._color.b;
                buffer[index + 7] = this._color.a;
            }
            this._vbs.setDataLength(buffer.byteLength);
            this._vbs.setData(buffer.buffer, 0, 0, buffer.buffer.byteLength);
            let ib = new Uint16Array(this._sheet.getibs());
            let indexBuffer = this._ibs;
            indexBuffer._setIndexDataLength(ib.buffer.byteLength);
            indexBuffer._setIndexData(ib, 0);
            this._vbLength = ib.length;
        }
        _setTileSize(x, y) {
            this._sheet.setTileSize(x, y);
        }
        _pixelToGrid(pixelX, pixelY, out) {
            this._sheet.pixelToGrid(pixelX, pixelY, out);
        }
        _gridToPixel(row, col, out) {
            this._sheet.gridToPixel(row, col, out);
        }
        _getBaseVertexBuffer() { return this._vbs; }
        _getBaseIndexBuffer() { return this._ibs; }
        _getBaseIndexCount() { return this._vbLength; }
    }

    const tempPoint = new Laya.Vector2();
    class TileMapChunk {
        constructor(grid) {
            this._grid = grid;
            this._maxCell = 0;
            this._setChunkSize(1, 1);
        }
        get maxCell() {
            return this._maxCell;
        }
        _setChunkSize(width, height) {
            this._chunkWidth = width;
            this._chunkHeight = height;
            this._maxCell = width * height;
        }
        _getChunkPosByPixel(pixelx, pixely, out) {
            this._grid._pixelToGrid(pixelx, pixely, tempPoint);
            this._getChunkPosByCell(Math.round(tempPoint.x), Math.round(tempPoint.y), out);
        }
        _getChunkPosByCell(cellRow, cellCol, out) {
            out.x = Math.floor(cellRow / this._chunkWidth);
            out.y = Math.floor(cellCol / this._chunkHeight);
            out.z = this._getChunkIndexByCellPos(cellRow, cellCol);
        }
        _getChunkIndexByCellPos(cellRow, cellCol) {
            let chunkX = cellRow % this._chunkWidth;
            if (chunkX < 0) {
                chunkX += this._chunkWidth;
            }
            let chunkY = cellCol % this._chunkHeight;
            if (chunkY < 0) {
                chunkY += this._chunkHeight;
            }
            return chunkX + chunkY * this._chunkWidth;
        }
        _getCellPosByChunkPosAndIndex(chunkx, chunky, chunklocalindex, out) {
            chunkx = Math.floor(chunkx);
            chunky = Math.floor(chunky);
            chunklocalindex = chunklocalindex % this._maxCell;
            out.x = chunkx * this._chunkWidth + chunklocalindex % this._chunkWidth;
            out.y = chunky * this._chunkHeight + Math.floor(chunklocalindex / this._chunkWidth);
        }
        _getPixelByChunkPosAndIndex(chunkx, chunky, chunklocalindex, out) {
            chunkx = Math.floor(chunkx);
            chunky = Math.floor(chunky);
            chunklocalindex = chunklocalindex % this._maxCell;
            let gridx = chunkx * this._chunkWidth + chunklocalindex % this._chunkWidth;
            let gridy = chunky * this._chunkHeight + Math.floor(chunklocalindex / this._chunkWidth);
            this._grid._gridToPixel(gridx, gridy, out);
        }
        _getChunkSize(out) {
            let basesheet = this._grid._sheet;
            basesheet._getChunkSize(this._chunkWidth, this._chunkHeight, out);
        }
        _getChunkLeftTop(chunkx, chunky, out) {
            let basesheet = this._grid._sheet;
            basesheet._getChunkLeftTop(chunkx * this._chunkWidth, chunky * this._chunkHeight, this._chunkWidth, this._chunkHeight, out);
        }
    }

    class TileMapPhysics {
        static __init__() {
            TileMapPhysics._tempDef = new Laya.Box2DShapeDef();
        }
        constructor(layer) {
            this.enable = false;
            this._rigidBodys = [];
            this._layer = layer;
        }
        updateState(bool) {
            let result = !!Laya.Laya.physics2D && bool;
            if (result != this.enable) {
                if (result)
                    this.enableRigidBodys();
                else
                    this.disableRigidBodys();
                this.enable = result;
            }
        }
        createRigidBody() {
            let factory = Laya.Laya.physics2D;
            let mgr = this._layer.owner.scene.getComponentElementManager(Laya.Physics2DWorldManager.__managerName);
            var info = new Laya.RigidBody2DInfo();
            info.angle = 0;
            info.allowSleep = false;
            info.angularDamping = 0;
            info.bullet = false;
            info.fixedRotation = false;
            info.gravityScale = 0;
            info.linearDamping = 0;
            info.angularVelocity = 0;
            info.linearVelocity.setValue(0, 0);
            let def = factory.createBodyDef(mgr, info);
            let rigidBody = factory.createBody(mgr.box2DWorld, def);
            let trans = this._layer.owner.globalTrans;
            let x = trans.x;
            let y = trans.y;
            let angle = Laya.Utils.toRadian(trans.rotation);
            Laya.Laya.physics2D.set_RigibBody_Transform(rigidBody, x, y, angle);
            this._rigidBodys.push(rigidBody);
            return rigidBody;
        }
        enableRigidBodys() {
            for (let i = 0, len = this._rigidBodys.length; i < len; i++)
                this._enableRigidBody(this._rigidBodys[i]);
        }
        disableRigidBodys() {
            for (let i = 0, len = this._rigidBodys.length; i < len; i++)
                this._disableRigidBody(this._rigidBodys[i]);
        }
        _enableRigidBody(rigidBody) {
            Laya.Laya.physics2D.set_RigibBody_Enable(rigidBody, true);
        }
        _disableRigidBody(rigidBody) {
            Laya.Laya.physics2D.set_RigibBody_Enable(rigidBody, false);
        }
        destroyRigidBody(rigidBody) {
            let index = this._rigidBodys.indexOf(rigidBody);
            if (index !== -1) {
                this._rigidBodys.splice(index, 1);
            }
            let world = this._layer.owner.scene.getComponentElementManager(Laya.Physics2DWorldManager.__managerName);
            Laya.Laya.physics2D.removeBody(world, rigidBody);
        }
        createFixture(rigidBody, layer, data) {
            let factory = Laya.Laya.physics2D;
            let mgr = this._layer.owner.scene.getComponentElementManager(Laya.Physics2DWorldManager.__managerName);
            var def = TileMapPhysics._tempDef;
            def.density = layer.density;
            def.friction = layer.friction;
            def.isSensor = false;
            def.restitution = layer.restitution;
            def.shapeType = Laya.EPhysics2DShape.PolygonShape;
            let filter = factory.createFilter();
            let fixtureDef = factory.createShapeDef(mgr.box2DWorld, def, filter);
            factory.set_PolygonShape_data(fixtureDef._shape, 0, 0, data, 1, 1);
            let fixture = factory.createShape(mgr, rigidBody, Laya.EPhysics2DShape.PolygonShape, fixtureDef);
            factory.set_shapeDef_GroupIndex(fixture, layer.group);
            factory.set_shapeDef_CategoryBits(fixture, layer.category);
            factory.set_shapeDef_maskBits(fixture, layer.mask);
            factory.set_shape_collider(fixture, this);
            return fixture;
        }
        _updateTransfrom() {
            let len = this._rigidBodys.length;
            if (!len)
                return;
            let trans = this._layer.owner.globalTrans;
            let x = trans.x;
            let y = trans.y;
            let angle = Laya.Utils.toRadian(trans.rotation);
            for (let i = 0; i < len; i++) {
                Laya.Laya.physics2D.set_RigibBody_Transform(this._rigidBodys[i], x, y, angle);
            }
        }
        destroyFixture(rigidBody, fixture) {
            Laya.Laya.physics2D.rigidBody_DestroyShape(rigidBody, fixture);
        }
        destroy() {
            this._rigidBodys = [];
        }
    }

    class AlexData {
        constructor() {
            this._x = 0;
            this._y = 0;
            this._rectValueMin = 0;
            this._rectValueMax = 0;
        }
        _dotValue(x, y) {
            return this._x * x + this._y * y;
        }
        _getDotMinMax(datas, out) {
            out.x = Number.MAX_VALUE;
            out.y = -Number.MAX_VALUE;
            for (var i = 0; i < datas.length; i += 2) {
                let value = this._dotValue(datas[i], datas[i + 1]);
                out.x = Math.min(out.x, value);
                out.y = Math.max(out.y, value);
            }
        }
        setAlex(x, y) {
            let ds = Math.hypot(x, y);
            this._x = -y / ds;
            this._y = x / ds;
        }
        updateVerter(rectDatas, ploygons) {
            let temp = Laya.Vector2.TEMP;
            this._getDotMinMax(rectDatas, temp);
            this._rectValueMin = temp.x;
            this._rectValueMax = temp.y;
            this._getDotMinMax(ploygons, temp);
            let d = (temp.y - temp.x) * 0.5;
            this._rectValueMin -= d;
            this._rectValueMax += d;
        }
        testCollider(x, y) {
            let value = this._dotValue(x, y);
            return value < this._rectValueMin || value > this._rectValueMax;
        }
    }
    class RectClipper {
        constructor() {
            this._clipperRect = new Laya.Rectangle();
            this._polygonSize = new Laya.Vector2();
            this._polygonTransform = new Laya.Matrix();
            this._ploygRect = new Laya.Vector4();
            this._matrix = new Laya.Matrix();
            this._axis = [];
            this._axis.push(new AlexData());
            this._axis.push(new AlexData());
            this._axis.push(new AlexData());
            this._axis.push(new AlexData());
            this._axis[0].setAlex(1, 0);
            this._axis[1].setAlex(0, 1);
        }
        _mrgePoint(x, y, out) {
            let point = Laya.Point.TEMP;
            point.setTo(x, y);
            this._matrix.invertTransformPoint(point);
            out.x = Math.min(out.x, point.x);
            out.y = Math.min(out.y, point.y);
            out.z = Math.max(out.z, point.x);
            out.w = Math.max(out.w, point.y);
        }
        _updateCliperInPolygonRect() {
            this._ploygRect.setValue(Number.MAX_VALUE, Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
            let halfw = this._clipperRect.width * 0.5;
            let halfh = this._clipperRect.height * 0.5;
            this._mrgePoint(-halfw, -halfh, this._ploygRect);
            this._mrgePoint(halfw, -halfh, this._ploygRect);
            this._mrgePoint(halfw, halfh, this._ploygRect);
            this._mrgePoint(-halfw, halfh, this._ploygRect);
        }
        _updateAxiDatas() {
            if (this._rectDatas == null)
                return;
            let halfw = this._polygonW;
            let halfh = this._polygonH;
            this._polygons = [];
            const p = Laya.Vector2.TEMP;
            TileMapUtils.transfromPointNByValue(this._matrix, -halfw, -halfh, p);
            this._polygons.push(p.x, p.y);
            TileMapUtils.transfromPointNByValue(this._matrix, halfw, -halfh, p);
            this._polygons.push(p.x, p.y);
            TileMapUtils.transfromPointNByValue(this._matrix, halfw, halfh, p);
            this._polygons.push(p.x, p.y);
            TileMapUtils.transfromPointNByValue(this._matrix, -halfw, halfh, p);
            this._polygons.push(p.x, p.y);
            let dx = this._polygons[2] - this._polygons[0];
            let dy = this._polygons[3] - this._polygons[1];
            this._axis[2].setAlex(dx, dy);
            dx = this._polygons[4] - this._polygons[2];
            dy = this._polygons[5] - this._polygons[3];
            this._axis[3].setAlex(dx, dy);
            this._axis[0].updateVerter(this._rectDatas, this._polygons);
            this._axis[1].updateVerter(this._rectDatas, this._polygons);
            this._axis[2].updateVerter(this._rectDatas, this._polygons);
            this._axis[3].updateVerter(this._rectDatas, this._polygons);
        }
        _updateClipRect(cliper) {
            if (cliper.equals(this._clipperRect))
                return false;
            cliper.cloneTo(this._clipperRect);
            let halfw = cliper.width * 0.5;
            let halfh = cliper.height * 0.5;
            this._rectDatas = [-halfw, -halfh, halfw, -halfh, halfw, halfh, -halfw, halfh];
            return true;
        }
        _updatePolygonSize(size) {
            if (Laya.Vector2.equals(size, this._polygonSize))
                return false;
            size.cloneTo(this._polygonSize);
            return true;
        }
        _updatePolygonTransform(matrix) {
            if (matrix.a == this._polygonTransform.a && matrix.b == this._polygonTransform.b && matrix.c == this._polygonTransform.c && matrix.d == this._polygonTransform.d && matrix.tx == this._polygonTransform.tx && matrix.ty == this._polygonTransform.ty)
                return false;
            matrix.copyTo(this._polygonTransform);
            return true;
        }
        getploygRect() { return this._ploygRect; }
        setClipper(clipperRect, size, matrix, ofx = 0, ofy = 0, clipperRot = 0) {
            let isDiffClipper = this._updateClipRect(clipperRect);
            let isDiffSize = this._updatePolygonSize(size);
            let isDiffMatrix = this._updatePolygonTransform(matrix);
            if (isDiffClipper || isDiffMatrix) {
                if (ofx || ofy || clipperRot) {
                    this._matrix.setMatrix(ofx, ofy, 1, 1, clipperRot, 0, 0, 0, 0);
                    this._matrix.invert();
                }
                else {
                    this._matrix.identity();
                }
                Laya.Matrix.mul(matrix, this._matrix, this._matrix);
                this._updateCliperInPolygonRect();
            }
            if (isDiffClipper || isDiffSize || isDiffMatrix) {
                this._updateAxiDatas();
            }
            return this._ploygRect;
        }
        isClipper(x, y) {
            const p = Laya.Vector2.TEMP;
            TileMapUtils.transfromPointByValue(this._matrix, x, y, p);
            if (this._axis[0].testCollider(p.x, p.y))
                return true;
            if (this._axis[1].testCollider(p.x, p.y))
                return true;
            if (this._axis[2].testCollider(p.x, p.y))
                return true;
            if (this._axis[3].testCollider(p.x, p.y))
                return true;
            return false;
        }
    }

    class TileSet extends Laya.Resource {
        constructor() {
            super();
            this._defalutMaterials = {};
            this._ownerList = [];
            this._terrainsDirty = true;
            this._paramsLists = [];
            this._tileSize = new Laya.Vector2(16, 16);
            this._tileShape = exports.TileShape.TILE_SHAPE_SQUARE;
            this._groups = [];
            this._groupIds = [];
        }
        get tileShape() {
            return this._tileShape;
        }
        set tileShape(value) {
            if (this._tileShape === value)
                return;
            this._tileShape = value;
            this._ownerList.forEach(element => {
                element._grid._updateTileShape(this._tileShape, this._tileSize);
                element._grid._updateBufferData();
            });
        }
        get tileSize() {
            return this._tileSize;
        }
        set tileSize(value) {
            if (Laya.Vector2.equals(value, this._tileSize))
                return;
            value.cloneTo(this._tileSize);
            this._ownerList.forEach(element => {
                element._grid._setTileSize(this._tileSize.x, this._tileSize.y);
            });
        }
        _disposeResource() {
            for (const key in this._defalutMaterials) {
                this._defalutMaterials[key] && this._defalutMaterials[key].destroy();
            }
        }
        getCellDataByGid(gid) {
            if (gid < 0) {
                return null;
            }
            const groupId = TileMapUtils.parseGroupId(gid);
            const group = this._groups.find(group => group.id == groupId);
            if (group) {
                const cellIndex = TileMapUtils.parseCellIndex(gid);
                const nativeIndex = TileMapUtils.parseNativeIndex(gid);
                return group.getCellDataByIndex(nativeIndex, cellIndex);
            }
            else {
                return null;
            }
        }
        _addOwner(tilemapLayer) {
            if (this._ownerList.indexOf(tilemapLayer) == -1)
                this._ownerList.push(tilemapLayer);
        }
        _removeOwner(tilemapLayer) {
            let index = this._ownerList.indexOf(tilemapLayer);
            if (index != -1)
                this._ownerList.splice(index, 1);
        }
        _notifyTileSetCellGroupsChange() {
            this._groupIds.length = 0;
            for (let i = 0, len = this._groups.length; i < len; i++) {
                const value = this._groups[i];
                value._recaculateUVOriProperty(false);
                this._groupIds.push(value.id);
            }
        }
        _notifyCustomDataLayerChange() {
        }
        _notifyRenderLayerChange() {
        }
        _notifyTerrainSetChange() {
        }
        _notifyNavigationLayerChange() {
        }
        _notifyPhysicsLayerChange() {
            this._terrainsDirty = true;
        }
        addTileSetCellGroup(resource) {
            if (resource) {
                resource._owner = this;
                this._groups.push(resource);
                this._notifyTileSetCellGroupsChange();
            }
        }
        getTileSetCellGroup(id) {
            let index = this._groupIds.indexOf(id);
            return this._groups[index];
        }
        removeTileSetCellGroup(id) {
            let index = this._groupIds.indexOf(id);
            this._groups.splice(index, 1);
            this._notifyTileSetCellGroupsChange();
        }
        get customLayers() {
            return this._customDataLayers;
        }
        set customLayers(value) {
            this._customDataLayers = value;
        }
        addCustomDataLayer(layer) {
            if (!this._customDataLayers)
                this._customDataLayers = [];
            let result = this._addLayer(this._customDataLayers, "name", layer);
            result && this._notifyCustomDataLayerChange();
            return result;
        }
        getCustomDataLayer(name) {
            let result = this._getLayer(this._customDataLayers, "name", name);
            return result;
        }
        removeCustomDataLayer(name) {
            let result = this._removeLayer(this._customDataLayers, "name", name);
            if (result)
                this._notifyCustomDataLayerChange();
            return result;
        }
        get navigationLayers() {
            return this._navigationLayers;
        }
        set navigationLayers(value) {
            this._navigationLayers = value;
        }
        addNavigationLayers(layer) {
        }
        getNavigationLayers(id) {
            return null;
        }
        removeNavigationLayers(id) {
            return;
        }
        get lightInfoLayers() {
            return this._lightOcclusion;
        }
        set lightInfoLayers(value) {
            this._lightOcclusion = value;
        }
        addLightInfoLayer(layer) {
            if (!this._lightOcclusion)
                this._lightOcclusion = [];
            let result = this._addLayer(this._lightOcclusion, "id", layer);
            result && this._notifyRenderLayerChange();
            return result;
        }
        getLightInfoLayer(id) {
            let result = this._getLayer(this._lightOcclusion, "id", id);
            return result;
        }
        removeLightInfoLayer(id) {
            let result = this._removeLayer(this._lightOcclusion, "id", id);
            result && this._notifyRenderLayerChange();
            return result;
        }
        get physicsLayers() {
            return this._physicsLayers;
        }
        set physicsLayers(value) {
            this._physicsLayers = value;
        }
        addPhysicsLayer(layer) {
            if (!this._physicsLayers)
                this._physicsLayers = [];
            let result = this._addLayer(this._physicsLayers, "id", layer);
            result && this._notifyPhysicsLayerChange();
            return result;
        }
        getPhysicsLayer(id) {
            let result = this._getLayer(this._physicsLayers, "id", id);
            return result;
        }
        removePhysicsLayer(id) {
            let result = this._removeLayer(this._physicsLayers, "id", id);
            result && this._notifyPhysicsLayerChange();
            return result;
        }
        _addLayer(layers, key, layer) {
            for (let i = 0, len = layers.length; i < len; i++) {
                if (layer[key] == layers[i][key]) {
                    return false;
                }
            }
            layers.push(layer);
            return true;
        }
        _getLayer(layers, key, value) {
            if (!layers || !layers.length)
                return null;
            for (let i = 0, len = layers.length; i < len; i++) {
                if (value == layers[i][key]) {
                    return layers[i];
                }
            }
            return null;
        }
        _removeLayer(layers, key, value) {
            if (!layers || !layers.length)
                return null;
            for (let i = 0, len = layers.length; i < len; i++) {
                if (value == layers[i][key]) {
                    return layers.splice(i, 1)[0];
                }
            }
            return null;
        }
        get terrainSets() {
            return this._terrainSets;
        }
        set terrainSets(value) {
            if (value) {
                for (let i = 0, len = value.length; i < len; i++) {
                    value[i] && value[i].updateShape(this._tileShape);
                }
            }
            this._terrainSets = value;
        }
        addTerrainSet(set) {
            if (!this._physicsLayers)
                this._terrainSets = [];
            let result = this._addLayer(this._terrainSets, "id", set);
            set.updateShape(this._tileShape);
            result && this._notifyPhysicsLayerChange();
        }
        getTerrainSet(id) {
            let result = this._getLayer(this._terrainSets, "id", id);
            result && this._notifyTerrainSetChange();
            return result;
        }
        removeTerrainSet(id) {
            let result = this._removeLayer(this._terrainSets, "id", id);
            result && this._notifyPhysicsLayerChange();
            return result;
        }
        updateTerrains() {
            if (this._terrainsDirty) {
                this._clearTerrainParams();
                this._terrainsDirty = false;
                this._groups.forEach(group => {
                    let tiles = group.tiles;
                    for (let y in tiles) {
                        let yTiles = tiles[y];
                        for (let x in yTiles) {
                            let nativeData = yTiles[x];
                            for (let n in nativeData._tileDatas) {
                                let celldata = nativeData._tileDatas[n];
                                let terrainSetId = celldata.terrainSet;
                                if (terrainSetId > -1) {
                                    let terrainSet = this.getTerrainSet(terrainSetId);
                                    if (celldata.terrain > -1) {
                                        this.addTerrainParams(celldata);
                                    }
                                    let neighbors = terrainSet._neighbors;
                                    for (let i = 0, len = neighbors.length; i < len; i++) {
                                        let neighbor = neighbors[i];
                                        if (celldata.get_terrainPeeringBit(neighbor) > -1) {
                                            this.addTerrainParams(celldata);
                                        }
                                    }
                                }
                            }
                        }
                    }
                });
                for (let i = 0, len = this._terrainSets.length; i < len; i++) {
                    this._addEmptyParams(this._terrainSets[i]);
                }
            }
        }
        _getParamsList(terrainSet) {
            this.updateTerrains();
            return this._paramsLists[terrainSet];
        }
        _clearTerrainParams() {
            let paramsLists = this._paramsLists;
            for (let i = 0, ilen = paramsLists.length; i < ilen; i++) {
                let paramsList = paramsLists[i];
                if (!paramsList)
                    continue;
                for (let j = 0, jlen = paramsList.length; j < jlen; j++) {
                    let params = paramsList[j];
                    if (!params)
                        continue;
                    for (let k = 0, klen = params.length; k < klen; k++)
                        params[k] && params[k].clearLinks();
                }
            }
        }
        addTerrainParams(cellData) {
            let params;
            let list = this._paramsLists[cellData.terrainSet] ? (this._paramsLists[cellData.terrainSet][cellData.terrain] ? this._paramsLists[cellData.terrainSet][cellData.terrain] : null) : null;
            if (list) {
                let bits = cellData._getTerrainPeeringBits();
                let terrainSet = this.getTerrainSet(cellData.terrainSet);
                let neighbors = terrainSet._neighbors;
                let nLen = neighbors.length;
                for (let i = 0, ilen = list.length; i < ilen; i++) {
                    let oParams = list[i];
                    let same = true;
                    for (let j = 0; j < nLen; j++) {
                        let neighbor = neighbors[j];
                        if (oParams.terrain_peering_bits[neighbor] != bits[neighbor]) {
                            same = false;
                            break;
                        }
                    }
                    if (same) {
                        params = oParams;
                        break;
                    }
                }
            }
            else {
                params = this._addTerrainParams(cellData);
            }
            if (!params) {
                params = cellData.getTerrainsParams();
                list.push(params);
            }
            params.link(cellData);
            return params;
        }
        _addTerrainParams(cellData) {
            let tlists = this._paramsLists[cellData.terrainSet];
            if (!tlists) {
                tlists = this._paramsLists[cellData.terrainSet] = [];
            }
            let list = tlists[cellData.terrain];
            if (!list) {
                list = tlists[cellData.terrain] = [];
            }
            let params = cellData.getTerrainsParams();
            list.push(params);
            return params;
        }
        _addEmptyParams(terrainSet) {
            let list = this._paramsLists[terrainSet.id] ? (this._paramsLists[terrainSet.id][-1] ? this._paramsLists[terrainSet.id][-1] : null) : null;
            let params;
            if (list) {
                let neighbors = terrainSet._neighbors;
                let nLen = neighbors.length;
                for (let i = 0, ilen = list.length; i < ilen; i++) {
                    let oParams = list[i];
                    let same = true;
                    for (let j = 0; j < nLen; j++) {
                        let neighbor = neighbors[j];
                        if (oParams.terrain_peering_bits[neighbor] != -1) {
                            same = false;
                            break;
                        }
                    }
                    if (same) {
                        params = oParams;
                        break;
                    }
                }
            }
            else {
                let tlists = this._paramsLists[terrainSet.id] = this._paramsLists[terrainSet.id] || [];
                list = tlists[-1] = tlists[-1] || [];
            }
            if (!params) {
                params = new TerrainsParams;
                params.terrainSet = terrainSet.id;
                list.push(params);
            }
            params.link(TileSetCellData._EMPTY);
            return params;
        }
        getDefalutMaterial(texture) {
            let url = texture.url;
            let dMat = this._defalutMaterials[url];
            if (!dMat) {
                dMat = new Laya.Material();
                dMat.setShaderName("TileMapLayer");
                dMat.setColor("u_Color", new Laya.Color(1, 1, 1, 1));
                dMat.setBoolByIndex(Laya.Shader3D.DEPTH_WRITE, false);
                dMat.setIntByIndex(Laya.Shader3D.DEPTH_TEST, Laya.RenderState.DEPTHTEST_OFF);
                dMat.setIntByIndex(Laya.Shader3D.BLEND, Laya.RenderState.BLEND_ENABLE_ALL);
                dMat.setIntByIndex(Laya.Shader3D.BLEND_EQUATION, Laya.RenderState.BLENDEQUATION_ADD);
                dMat.setIntByIndex(Laya.Shader3D.BLEND_SRC, Laya.RenderState.BLENDPARAM_ONE);
                dMat.setIntByIndex(Laya.Shader3D.BLEND_DST, Laya.RenderState.BLENDPARAM_ONE_MINUS_SRC_ALPHA);
                dMat.setFloatByIndex(Laya.ShaderDefines2D.UNIFORM_VERTALPHA, 1.0);
                dMat.setIntByIndex(Laya.Shader3D.CULL, Laya.RenderState.CULL_NONE);
                dMat.setTexture("u_render2DTexture", texture);
                if (texture.gammaCorrection != 1) {
                    dMat.addDefine(Laya.ShaderDefines2D.GAMMATEXTURE);
                }
                else {
                    dMat.removeDefine(Laya.ShaderDefines2D.GAMMATEXTURE);
                }
                dMat.lock = true;
                this._defalutMaterials[url] = dMat;
            }
            return dMat;
        }
    }

    class TileSetCellGroup {
        get tiles() {
            return this._tiles;
        }
        set tiles(value) {
            if (value) {
                for (let y in value) {
                    for (let x in value[y]) {
                        value[y][x].owner = this;
                    }
                }
            }
            this._tiles = value;
        }
        get atlas() {
            return this._atlas;
        }
        set atlas(value) {
            if (this._atlas === value)
                return;
            value._addReference();
            this._atlas = value;
            this._atlasSize.setValue(value.width, value.height);
            this._recaculateUVOriProperty(true);
        }
        get atlasSize() {
            return this._atlasSize;
        }
        set atlasSize(value) {
            value.cloneTo(this._atlasSize);
            this._recaculateUVOriProperty(true);
        }
        get margin() {
            return this._margin;
        }
        set margin(value) {
            value.cloneTo(this._margin);
            this._recaculateUVOriProperty(true);
        }
        get separation() {
            return this._separation;
        }
        set separation(value) {
            value.cloneTo(this._separation);
            this._recaculateUVOriProperty(true);
        }
        get textureRegionSize() {
            return this._textureRegionSize;
        }
        set textureRegionSize(value) {
            value.cloneTo(this._textureRegionSize);
            this._recaculateUVOriProperty(true);
        }
        constructor() {
            this._maxAlternativesCount = 0;
            this._maxCellCount = new Laya.Vector2();
            this._tileMatrix = new Laya.Matrix();
            this._tiles = {};
            this._separation = new Laya.Vector2();
            this._margin = new Laya.Vector2();
            this._textureRegionSize = new Laya.Vector2();
            this._atlasSize = new Laya.Vector2();
        }
        get owner() {
            return this._owner;
        }
        set owner(value) {
            if (this._owner != null)
                console.error("owner is not null");
            this._owner = value;
            this._owner.addTileSetCellGroup(this);
        }
        _recaculateUVOriProperty(needNotiveCell) {
            this._tileMatrix.identity();
            this._tileMatrix.scale(this._textureRegionSize.x + this._separation.x, this._textureRegionSize.y + this._separation.y);
            this._tileMatrix.translate(this._margin.x, this._margin.y);
            this._tileMatrix.invert();
            let maxX = Math.floor((this._atlasSize.x - this._margin.x) / (this._textureRegionSize.x + this._separation.x));
            let maxY = Math.floor((this._atlasSize.y - this._margin.y) / (this._textureRegionSize.y + this._separation.y));
            this._maxAlternativesCount = maxX * maxY;
            this._maxCellCount.setValue(maxX, maxY);
            for (var i in this._tiles) {
                let rowTile = this._tiles[i];
                for (var j in rowTile) {
                    rowTile[j]._init();
                }
            }
            if (needNotiveCell) {
                this._owner && this._owner._notifyTileSetCellGroupsChange();
            }
        }
        onAtlasSizeChange() {
            this._owner && this._owner._notifyTileSetCellGroupsChange();
        }
        _getGlobalAlternativesId(x, y) {
            return TileMapUtils.getNativeId(this.id, y * this._maxCellCount.x + x);
        }
        _getCellPosByAlternativesId(nativeIndex, out) {
            out.x = nativeIndex % this._maxCellCount.x;
            out.y = Math.floor(nativeIndex / this._maxCellCount.x);
        }
        _getTilePixelOrgin(localPos, out) {
            let uvX = localPos.x * (this._textureRegionSize.x + this._separation.x) + this._margin.x;
            let uvY = localPos.y * (this._textureRegionSize.y + this._separation.y) + this._margin.y;
            out.setValue(uvX, uvY);
            return out;
        }
        _getTileUVExtends(size, out) {
            out.x = (size.x - 1) * this._separation.x + this._textureRegionSize.x * size.x;
            out.y = (size.y - 1) * this._separation.y + this._textureRegionSize.y * size.y;
            return out;
        }
        getAlternative(x, y) {
            if (!this._tiles[y]) {
                return null;
            }
            return this._tiles[y][x];
        }
        addAlternaltive(x, y, sizeInAtlas) {
            let data = this.getAlternative(x, y);
            if (data) {
                return data;
            }
            let tempv2 = Laya.Vector2.TEMP;
            this._getTileUVExtends(sizeInAtlas, tempv2);
            if ((tempv2.x + x > this._atlasSize.x) || (tempv2.y + y > this._atlasSize.y))
                return null;
            let alterData = new TileAlternativesData();
            {
                alterData.localPos = new Laya.Vector2(x, y);
                alterData.sizeByAtlas = sizeInAtlas;
                alterData.owner = this;
                alterData._initialIndexFIrstCellData();
            }
            for (var j = 0, sizey = sizeInAtlas.y; j < sizey; j++) {
                let ymap = this._tiles[j + y];
                if (!ymap)
                    ymap = this._tiles[j + y] = {};
                for (var i = 0, sizex = sizeInAtlas.x; i < sizex; i++) {
                    ymap[i + x] = alterData;
                }
            }
            return alterData;
        }
        removeAlternaltive(localPos) {
            if (!this._tiles[localPos.y]) {
                return;
            }
            let rowMap = this._tiles[localPos.y];
            if (!rowMap[localPos.x]) {
                return;
            }
            delete rowMap[localPos.x];
        }
        getCellData(localPos, index) {
            let tile = this.getAlternative(localPos.x, localPos.y);
            if (tile == null) {
                return null;
            }
            return tile.getCelldata(index);
        }
        getCellDataByIndex(nativeIndex, cellIndex) {
            const temp = Laya.Vector2.TEMP;
            this._getCellPosByAlternativesId(nativeIndex, temp);
            let data = this.getAlternative(temp.x, temp.y);
            if (data == null) {
                return null;
            }
            return data.getCelldata(cellIndex);
        }
        removeCellData(localPos, index) {
            let tile = this.getAlternative(localPos.x, localPos.y);
            if (tile == null) {
                return null;
            }
            return tile.removeCellData(index);
        }
        release() {
        }
    }

    class TileSetLoader {
        load(task) {
            return task.loader.fetch(task.url, "json", task.progress.createCallback(0.2), task.options).then(data => {
                if (!data)
                    return null;
                if (!data.groups)
                    data.groups = [];
                const groups = data.groups;
                let urls = [];
                for (let i = 0, len = groups.length; i < len; i++) {
                    let url = groups[i].atlas._$uuid;
                    if (Laya.Utils.isUUID(url)) {
                        url = "res://" + url;
                    }
                    urls.push({ url: url, type: Laya.Loader.TEXTURE2D });
                }
                return this.load2(task, data, urls);
            });
        }
        load2(task, data, urls) {
            let options = Object.assign({}, task.options);
            options.initiator = task;
            delete options.cache;
            delete options.ignoreCache;
            return task.loader.load(urls, options, task.progress.createCallback()).then(() => {
                let tileSet = new TileSet();
                tileSet.tileShape = data.tileShape ? data.tileShape : 0;
                for (let i = 0, len = data.groups.length; i < len; i++) {
                    this.createGroup(tileSet, data.groups[i]);
                }
                if (data.tileSize) {
                    tileSet.tileSize = Laya.ObjDecoder.decodeObj(data.tileSize);
                }
                tileSet.physicsLayers = Laya.ObjDecoder.decodeObj(data.physicsLayers);
                tileSet.lightInfoLayers = Laya.ObjDecoder.decodeObj(data.lightInfoLayers);
                tileSet.customLayers = Laya.ObjDecoder.decodeObj(data.customLayers);
                tileSet.navigationLayers = Laya.ObjDecoder.decodeObj(data.navigationLayers);
                tileSet.terrainSets = Laya.ObjDecoder.decodeObj(data.terrainSets);
                tileSet._notifyTileSetCellGroupsChange();
                return tileSet;
            });
        }
        createGroup(tileSet, data) {
            let group = new TileSetCellGroup();
            group.id = data.id;
            group.name = data.name;
            tileSet.addTileSetCellGroup(group);
            Laya.ObjDecoder.decodeObj(data, group);
            if (data.atlas.path) {
                group.atlas = Laya.Loader.getBaseTexture(data.atlas.path);
            }
        }
    }
    class TileMapDatasParse {
        static read(buffer) {
            let byte = new Laya.Byte(buffer);
            byte.pos = 0;
            let version = byte.readUTFString();
            if (!version.startsWith("TILEMAPLAYER_DATA"))
                return null;
            let chunkNum = byte.readUint32();
            let chunks = [];
            for (let i = 0; i < chunkNum; i++) {
                let x = byte.readFloat32();
                let y = byte.readFloat32();
                let length = byte.readUint32();
                let tiles = [];
                for (let j = 0; j < length; j++) {
                    let localId = byte.readUint32();
                    let gid = byte.readUint32();
                    let transFlag = byte.readUint32();
                    tiles.push(localId, gid, transFlag);
                }
                let chunkInfos = { x, y, length, tiles };
                chunks.push(chunkInfos);
            }
            return chunks;
        }
    }
    Laya.Loader.registerLoader(["tres"], TileSetLoader, "tres");

    class TileMapOccluder {
        get layerMask() {
            return this._core.layerMask;
        }
        set layerMask(value) {
            this._core.layerMask = value;
        }
        set manager(value) {
            this._core.manager = value;
        }
        get canInLight() {
            return this._core.canInLight;
        }
        set canInLight(value) {
            this._core.canInLight = value;
        }
        get polygonPoint() {
            return this._core.polygonPoint;
        }
        set polygonPoint(value) {
            this._core.polygonPoint = value;
        }
        get outside() {
            return this._core.outside;
        }
        set outside(value) {
            this._core.outside = value;
        }
        constructor() {
            this._core = new Laya.LightOccluder2DCore();
        }
        _onEnable() {
            this._core.owner = this.owner;
            this.owner.on(Laya.Event.TRANSFORM_CHANGED, this._core, this._core._transformChange);
            this._core._onEnable();
        }
        _onDisable() {
            this.owner.off(Laya.Event.TRANSFORM_CHANGED, this._core, this._core._transformChange);
            this._core._onDisable();
        }
        destroy() {
            this._onDisable();
            this._core.destroy();
            this._core = null;
        }
    }

    class TileMapOccluderAgent {
        constructor(layer) {
            this.enable = false;
            this._occluders = [];
            this._layer = layer;
        }
        _updateManager() {
            var _a, _b;
            let manager = (_b = (_a = this._layer.owner) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b._light2DManager;
            this._manager = manager;
        }
        updateState(bool) {
            if (bool != this.enable) {
                this.enable = bool;
                if (bool)
                    this.enableAllOccluders();
                else
                    this.disableAllOccluders();
            }
        }
        enableAllOccluders() {
            if (!this._manager || !this._occluders.length)
                return;
            for (let i = 0, len = this._occluders.length; i < len; i++) {
                this._occluders[i].manager = this._manager;
                this._occluders[i]._onEnable();
            }
        }
        disableAllOccluders() {
            if (!this._manager || !this._occluders.length)
                return;
            for (let i = 0, len = this._occluders.length; i < len; i++)
                this._occluders[i]._onDisable();
        }
        _removeAllOccluders() {
            if (!this._manager)
                return;
            for (let i = this._occluders.length - 1; i > -1; i--)
                this.removeOccluder(this._occluders[i]);
        }
        addOccluder(poly, layerMask) {
            let occluder = new TileMapOccluder();
            occluder.owner = this._layer.owner;
            occluder.manager = this._manager;
            occluder.polygonPoint = poly;
            occluder.layerMask = layerMask;
            occluder._onEnable();
            this._occluders.push(occluder);
            return occluder;
        }
        removeOccluder(occluder) {
            if (!occluder)
                return false;
            let index = this._occluders.indexOf(occluder);
            this._occluders.splice(index, 1);
            occluder.destroy();
            return true;
        }
        destroy() {
            this._removeAllOccluders();
        }
    }

    exports.TILEMAPLAYERDIRTYFLAG = void 0;
    (function (TILEMAPLAYERDIRTYFLAG) {
        TILEMAPLAYERDIRTYFLAG[TILEMAPLAYERDIRTYFLAG["CELL_CHANGE"] = 1] = "CELL_CHANGE";
        TILEMAPLAYERDIRTYFLAG[TILEMAPLAYERDIRTYFLAG["CELL_COLOR"] = 2] = "CELL_COLOR";
        TILEMAPLAYERDIRTYFLAG[TILEMAPLAYERDIRTYFLAG["CELL_QUAD"] = 4] = "CELL_QUAD";
        TILEMAPLAYERDIRTYFLAG[TILEMAPLAYERDIRTYFLAG["CELL_QUADUV"] = 8] = "CELL_QUADUV";
        TILEMAPLAYERDIRTYFLAG[TILEMAPLAYERDIRTYFLAG["CELL_UVTRAN"] = 16] = "CELL_UVTRAN";
        TILEMAPLAYERDIRTYFLAG[TILEMAPLAYERDIRTYFLAG["CELL_PHYSICS"] = 32] = "CELL_PHYSICS";
        TILEMAPLAYERDIRTYFLAG[TILEMAPLAYERDIRTYFLAG["CELL_TERRAIN"] = 64] = "CELL_TERRAIN";
        TILEMAPLAYERDIRTYFLAG[TILEMAPLAYERDIRTYFLAG["CELL_LIGHTSHADOW"] = 128] = "CELL_LIGHTSHADOW";
        TILEMAPLAYERDIRTYFLAG[TILEMAPLAYERDIRTYFLAG["CELL_NAVIGATION"] = 256] = "CELL_NAVIGATION";
        TILEMAPLAYERDIRTYFLAG[TILEMAPLAYERDIRTYFLAG["CELL_SORTCHANGE"] = 512] = "CELL_SORTCHANGE";
        TILEMAPLAYERDIRTYFLAG[TILEMAPLAYERDIRTYFLAG["TILESET_SAZE"] = 1024] = "TILESET_SAZE";
        TILEMAPLAYERDIRTYFLAG[TILEMAPLAYERDIRTYFLAG["LAYER_COLOR"] = 2048] = "LAYER_COLOR";
        TILEMAPLAYERDIRTYFLAG[TILEMAPLAYERDIRTYFLAG["LAYER_PHYSICS"] = 4096] = "LAYER_PHYSICS";
    })(exports.TILEMAPLAYERDIRTYFLAG || (exports.TILEMAPLAYERDIRTYFLAG = {}));
    const TempRectange = new Laya.Rectangle();
    const TempMatrix = new Laya.Matrix();
    const TempVector2_1 = new Laya.Vector2();
    const TempVector2_2 = new Laya.Vector2();
    class TileMapLayer extends Laya.BaseRenderNode2D {
        static __init__() {
            if (TileMapLayer._inited)
                return;
            this._inited = true;
            TileMapShaderInit.__init__();
            TileMapPhysics.__init__();
            TileMapTerrainUtil.__init__();
        }
        get chunkDatas() {
            return this._chunkDatas;
        }
        set chunkDatas(datas) {
            this._chunkDatas = datas;
            if (datas) {
                for (const col in datas) {
                    let chunkDatas = datas[col];
                    for (const row in chunkDatas) {
                        let chunkData = chunkDatas[row];
                        chunkData._tileLayer = this;
                        chunkData._updateChunkData(chunkData.chunkX, chunkData.chunkY);
                        chunkData._parseCellDataRefMap();
                    }
                }
            }
            this._boundsChange = true;
        }
        get layerColor() {
            return this._layerColor;
        }
        set layerColor(value) {
            value.cloneTo(this._layerColor);
            if (this._grid._updateColor(value) && this._tileSet) {
                this._grid._updateBufferData();
            }
        }
        get sortMode() {
            return this._sortMode;
        }
        set sortMode(value) {
            this._sortMode = value;
        }
        get navigationEnable() {
            return this._navigationEnable;
        }
        set navigationEnable(value) {
            this._navigationEnable = value;
        }
        get physicsEnable() {
            return this._physicsEnable;
        }
        set physicsEnable(value) {
            this._tileMapPhysics.updateState(value);
            this._physicsEnable = value;
        }
        get lightOccluderEnable() {
            return this._lightOccluderEnable;
        }
        set lightOccluderEnable(value) {
            this._tileMapOccluder.updateState(value);
            this._lightOccluderEnable = value;
        }
        get tileSet() {
            return this._tileSet;
        }
        set tileSet(value) {
            if (this._tileSet == value) {
                return;
            }
            if (this._tileSet) {
                this._tileSet._removeOwner(this);
                this._tileSet._removeReference();
            }
            this._tileSet = value;
            if (value) {
                this._tileSet._addOwner(this);
                this._tileSet._addReference();
                this._initialTileSet();
            }
        }
        get renderTileSize() {
            return this._renderTileSize;
        }
        set renderTileSize(value) {
            if (this._renderTileSize === value)
                return;
            this._renderTileSize = value;
            this._updateChunkData();
        }
        get tileMapDatas() {
            return this._tileMapDatas;
        }
        set tileMapDatas(value) {
            this._tileMapDatas = value;
        }
        get tileMapPhysics() {
            return this._tileMapPhysics;
        }
        get tileMapOccluder() {
            return this._tileMapOccluder;
        }
        constructor() {
            super();
            this._layerColor = new Laya.Color();
            this._renderTileSize = 32;
            this._needUpdateDirtys = [];
            this._layerColor = new Laya.Color(1, 1, 1, 1);
            this._chunkDatas = [];
            this._grid = new Grid();
            this._chunk = new TileMapChunk(this._grid);
            this._chunk._setChunkSize(this._renderTileSize, this._renderTileSize);
            this._tileMapPhysics = new TileMapPhysics(this);
            this._tileMapOccluder = new TileMapOccluderAgent(this);
            this._cliper = new RectClipper();
            this._renderElements = [];
            this._materials = [];
            this.sortMode = exports.TileLayerSortMode.ZINDEXSORT;
        }
        _isMaterialVaild(value) {
            return value.checkType(Laya.ShaderFeatureType.Effect);
        }
        _initialTileSet() {
            this._grid._updateTileShape(this._tileSet.tileShape, this._tileSet.tileSize);
            this._grid._updateColor(this._layerColor);
            this._grid._updateBufferData();
        }
        _updateChunkData() {
            var _a;
            const minVec = TempVector2_1;
            minVec.setValue(Number.MAX_VALUE, Number.MAX_VALUE);
            const maxVec = TempVector2_2;
            maxVec.setValue(-Number.MIN_VALUE, -Number.MIN_VALUE);
            let mergeDatas = new Map();
            let allDatas = [];
            for (const col in this._chunkDatas) {
                let chunkDatas = this._chunkDatas[col];
                for (const row in chunkDatas) {
                    let chunkData = chunkDatas[row];
                    chunkData._mergeBuffer(mergeDatas, minVec, maxVec);
                    allDatas.push(chunkData);
                }
            }
            let tileSize = this._renderTileSize;
            this._chunk._setChunkSize(tileSize, tileSize);
            if (minVec.x > maxVec.x || minVec.y > maxVec.y) {
                return;
            }
            this._chunkDatas = [];
            const tempVec3 = Laya.Vector3.TEMP;
            this._chunk._getChunkPosByCell(minVec.x, minVec.y, tempVec3);
            let startRow = tempVec3.x;
            let startCol = tempVec3.y;
            this._chunk._getChunkPosByCell(maxVec.x, maxVec.y, tempVec3);
            let endRow = tempVec3.x;
            let endCol = tempVec3.y;
            for (var j = startCol; j <= endCol; j++) {
                for (var i = startRow; i <= endRow; i++) {
                    let chunkData = allDatas.pop() || new TileMapChunkData();
                    chunkData._tileLayer = this;
                    chunkData._updateChunkData(i, j);
                    let mark = chunkData._setBuffer(mergeDatas, minVec, maxVec, tileSize);
                    if (mark) {
                        this._setLayerDataByPos(chunkData);
                    }
                    else {
                        allDatas.push(chunkData);
                    }
                }
            }
            allDatas.forEach(data => data._destroy());
            this._boundsChange = true;
            (_a = this.owner) === null || _a === void 0 ? void 0 : _a.repaint();
        }
        _updateMapDatas() {
            var _a;
            if (this._tileMapDatas == null || !this._tileMapDatas.length) {
                return;
            }
            let chunks = TileMapDatasParse.read(this._tileMapDatas.buffer);
            for (var i = 0, len = chunks.length; i < len; i++) {
                let data = new TileMapChunkData();
                data._tileLayer = this;
                data._setRenderData(chunks[i]);
                this._setLayerDataByPos(data);
            }
            (_a = this.owner) === null || _a === void 0 ? void 0 : _a.repaint();
        }
        _setLayerDataByPos(tile) {
            const chunkX = tile.chunkX;
            const chunkY = tile.chunkY;
            let rowData = this._chunkDatas[chunkY];
            if (!rowData) {
                rowData = [];
                this._chunkDatas[chunkY] = rowData;
            }
            rowData[chunkX] = tile;
            this._boundsChange = true;
        }
        _getLayerDataTileByPos(chunkX, chunkY) {
            let rowData = this._chunkDatas[chunkY];
            if (!rowData) {
                rowData = [];
                this._chunkDatas[chunkY] = rowData;
            }
            let data = rowData[chunkX];
            if (!data) {
                data = new TileMapChunkData();
                data._tileLayer = this;
                data._updateChunkData(chunkX, chunkY);
                rowData[chunkX] = data;
                this._boundsChange = true;
            }
            return data;
        }
        onAwake() {
            super.onAwake();
            this._updateMapDatas();
        }
        onEnable() {
            super.onEnable();
            this.owner.globalTrans.cache = true;
            this._tileMapOccluder._updateManager();
            this._tileMapPhysics.enable && this._tileMapPhysics.enableRigidBodys();
            this._tileMapOccluder.enable && this._tileMapOccluder.enableAllOccluders();
            this.owner.on(Laya.Event.TRANSFORM_CHANGED, this, this._globalChangeHandler);
        }
        onDisable() {
            super.onDisable();
            this._tileMapPhysics.enable && this._tileMapPhysics.disableRigidBodys();
            this._tileMapOccluder.enable && this._tileMapOccluder._removeAllOccluders();
            this.owner.off(Laya.Event.TRANSFORM_CHANGED, this, this._globalChangeHandler);
        }
        onDestroy() {
            super.onDestroy();
            this._tileMapPhysics.destroy();
            this._tileMapOccluder.destroy();
            this.tileSet = null;
        }
        _globalChangeHandler() {
            this._needUpdateDirtys[exports.DirtyFlagType.PHYSICS] = true;
        }
        _globalTransfrom() {
            return this.owner.globalTrans.getMatrix();
        }
        addCMDCall(px, py) {
        }
        get rect() {
            if (this._boundsChange) {
                this._calculateLayerRect();
                this._boundsChange = false;
            }
            return this._rect;
        }
        _calculateLayerRect() {
            if (!this._chunkDatas || Object.keys(this._chunkDatas).length === 0) {
                this._rect.setValue(0, 0, 0, 0);
                return;
            }
            let minX = Number.MAX_VALUE, minY = Number.MAX_VALUE;
            let maxX = Number.MIN_VALUE, maxY = Number.MIN_VALUE;
            let hasValidChunk = false;
            for (const col in this._chunkDatas) {
                let rowData = this._chunkDatas[col];
                if (!rowData)
                    continue;
                for (const row in rowData) {
                    let chunkData = rowData[row];
                    if (!chunkData)
                        continue;
                    let chunkRect = chunkData.getRange();
                    if (chunkRect && chunkRect.width > 0 && chunkRect.height > 0) {
                        hasValidChunk = true;
                        minX = Math.min(minX, chunkRect.x);
                        minY = Math.min(minY, chunkRect.y);
                        maxX = Math.max(maxX, chunkRect.x + chunkRect.width);
                        maxY = Math.max(maxY, chunkRect.y + chunkRect.height);
                    }
                }
            }
            if (hasValidChunk) {
                this._rect.setValue(minX, minY, maxX, maxY);
            }
            else {
                this._rect.setValue(0, 0, 0, 0);
            }
        }
        renderUpdate(context) {
            let tileSet = this._tileSet;
            if (tileSet == null)
                return;
            const clipChuckMat = TempMatrix;
            const renderRect = TempRectange;
            let mat = this._globalTransfrom();
            let scene = this.owner._ownerArea;
            let camera = scene === null || scene === void 0 ? void 0 : scene.mainCamera;
            let ofx = 0, ofy = 0;
            if (camera == null) {
                renderRect.setTo(0, 0, Laya.RenderState2D.width, Laya.RenderState2D.height);
                mat.copyTo(clipChuckMat);
                ofx = renderRect.width / 2;
                ofy = renderRect.height / 2;
            }
            else {
                let rect = camera._rect;
                renderRect.setTo(rect.x, rect.z, rect.y - rect.x, rect.w - rect.z);
                let cameraMat = camera._getCameraTransform();
                var e = cameraMat.elements;
                clipChuckMat.a = e[0];
                clipChuckMat.b = e[1];
                clipChuckMat.c = e[3];
                clipChuckMat.d = e[4];
                clipChuckMat.tx = e[6];
                clipChuckMat.ty = e[7];
                Laya.Matrix.mul(mat, clipChuckMat, clipChuckMat);
            }
            let oneChuckSize = Laya.Vector2.TEMP;
            this._chunk._getChunkSize(oneChuckSize);
            let chuckLocalRect = this._cliper.setClipper(renderRect, oneChuckSize, clipChuckMat, ofx, ofy, 0);
            this._renderElements.length = 0;
            let tileSize = this.tileSet.tileSize;
            let checkPoint = Laya.Vector2.TEMP;
            let tempVec3 = Laya.Vector3.TEMP;
            this._chunk._getChunkPosByPixel(chuckLocalRect.x - tileSize.x, chuckLocalRect.y - tileSize.y, tempVec3);
            let chuckstartRow = tempVec3.x;
            let chuckstartCol = tempVec3.y;
            this._chunk._getChunkPosByPixel(chuckLocalRect.z + tileSize.x, chuckLocalRect.w + tileSize.y, tempVec3);
            let chuckendRow = tempVec3.x;
            let chuckendCol = tempVec3.y;
            let _needUpdateBounds = false;
            for (let j = chuckstartCol; j <= chuckendCol; j++) {
                if (!this._chunkDatas[j]) {
                    continue;
                }
                let rowData = this._chunkDatas[j];
                for (let i = chuckstartRow; i <= chuckendRow; i++) {
                    let chunkData = rowData[i];
                    if (!chunkData) {
                        continue;
                    }
                    this._chunk._getChunkLeftTop(i, j, checkPoint);
                    if (!this._cliper.isClipper(checkPoint.x, checkPoint.y)) {
                        _needUpdateBounds = _needUpdateBounds || chunkData._needUpdateRange;
                        chunkData._update();
                        chunkData._mergeToElement(this._renderElements);
                    }
                }
            }
            this._boundsChange = _needUpdateBounds;
            let needUpdatePhysics = this._tileMapPhysics.enable && this._needUpdateDirtys[exports.DirtyFlagType.PHYSICS];
            if (needUpdatePhysics) {
                this._tileMapPhysics._updateTransfrom();
                this._needUpdateDirtys[exports.DirtyFlagType.PHYSICS] = false;
            }
            this.owner._struct.renderElements = this._renderElements;
            this._updateLight();
        }
        setCellData(x, y, cellData, isPixel = true, rotateCount = 0, flipH = false, flipV = false, transpose = false) {
            this._setCellData(x, y, cellData, TileMapUtils.getTransFlag(rotateCount, flipH, flipV, transpose), isPixel);
        }
        _setCellData(x, y, cellData, transFlag = 0, isPixel = true) {
            var _a;
            if (cellData == null)
                return;
            let tempVec3 = Laya.Vector3.TEMP;
            if (isPixel) {
                this._chunk._getChunkPosByPixel(x, y, tempVec3);
            }
            else {
                this._chunk._getChunkPosByCell(x, y, tempVec3);
            }
            let chunkData = this._getLayerDataTileByPos(tempVec3.x, tempVec3.y);
            chunkData._setCell(tempVec3.z, cellData, transFlag);
            (_a = this.owner) === null || _a === void 0 ? void 0 : _a.repaint();
        }
        getCellData(x, y, isPixel = true) {
            let tempVec3 = Laya.Vector3.TEMP;
            if (isPixel) {
                this._chunk._getChunkPosByPixel(x, y, tempVec3);
            }
            else {
                this._chunk._getChunkPosByCell(x, y, tempVec3);
            }
            let rowData = this._chunkDatas[tempVec3.y];
            if (!rowData)
                return null;
            let data = rowData[tempVec3.x];
            if (!data)
                return null;
            return data.getCell(tempVec3.z);
        }
        removeCell(x, y, isPixel = true) {
            var _a;
            let tempVec3 = Laya.Vector3.TEMP;
            if (isPixel) {
                this._chunk._getChunkPosByPixel(x, y, tempVec3);
            }
            else {
                this._chunk._getChunkPosByCell(x, y, tempVec3);
            }
            let chunkData = this._getLayerDataTileByPos(tempVec3.x, tempVec3.y);
            chunkData._removeCell(tempVec3.z);
            (_a = this.owner) === null || _a === void 0 ? void 0 : _a.repaint();
        }
        pixelToGrid(pixelX, pixelY, out) {
            this._grid._pixelToGrid(pixelX, pixelY, out);
        }
        gridToPixel(cellRow, cellCol, out) {
            this._grid._gridToPixel(cellRow, cellCol, out);
        }
        getDefalutMaterial(texture) {
            return this.tileSet.getDefalutMaterial(texture);
        }
    }
    TileMapLayer._inited = false;
    Laya.Laya.addInitCallback(() => TileMapLayer.__init__());

    let c = Laya.ClassUtils.regClass;
    c("TileSet", TileSet);
    c("TileSetCellGroup", TileSetCellGroup);
    c("TileAlternativesData", TileAlternativesData);
    c("TileSetCellData", TileSetCellData);
    c("TileMapLayer", TileMapLayer);
    c("TileMapChunkData", TileMapChunkData);
    c("TileMapPhysics", TileMapPhysics);
    c("TileSetPhysicsLayer", TileSetPhysicsLayer);
    c("TileSetOcclusionLayer", TileSetOcclusionLayer);
    c("TileSetTerrainSet", TileSetTerrainSet);
    c("TileSetTerrain", TileSetTerrain);
    c("TileMapNavigationLayer", TileMapNavigationLayer);
    c("TileSetCustomDataLayer", TileSetCustomDataLayer);
    c("TileSetCellPhysicsInfo", TileSetCellPhysicsInfo);
    c("TileSetCellNavigationInfo", TileSetCellNavigationInfo);
    c("TileSetCellOcclusionInfo", TileSetCellOcclusionInfo);

    exports.BaseSheet = BaseSheet;
    exports.ChunkCellInfo = ChunkCellInfo;
    exports.DIRTY_TYPES = DIRTY_TYPES;
    exports.Grid = Grid;
    exports.HalfOffSquareSheet = HalfOffSquareSheet;
    exports.HeixSheet = HeixSheet;
    exports.IsometricSheet = IsometricSheet;
    exports.RectClipper = RectClipper;
    exports.RectSheet = RectSheet;
    exports.TerrainRuleSet = TerrainRuleSet;
    exports.TerrainVector2Set = TerrainVector2Set;
    exports.TerrainsParams = TerrainsParams;
    exports.TileAlternativesData = TileAlternativesData;
    exports.TileMapChunk = TileMapChunk;
    exports.TileMapChunkData = TileMapChunkData;
    exports.TileMapDatasParse = TileMapDatasParse;
    exports.TileMapLayer = TileMapLayer;
    exports.TileMapNavigationLayer = TileMapNavigationLayer;
    exports.TileMapOccluder = TileMapOccluder;
    exports.TileMapOccluderAgent = TileMapOccluderAgent;
    exports.TileMapPhysics = TileMapPhysics;
    exports.TileMapShaderInit = TileMapShaderInit;
    exports.TileMapTerrain = TileMapTerrain;
    exports.TileMapTerrainRule = TileMapTerrainRule;
    exports.TileMapTerrainUtil = TileMapTerrainUtil;
    exports.TileMapUtils = TileMapUtils;
    exports.TileSet = TileSet;
    exports.TileSetCellData = TileSetCellData;
    exports.TileSetCellGroup = TileSetCellGroup;
    exports.TileSetCellNavigationInfo = TileSetCellNavigationInfo;
    exports.TileSetCellOcclusionInfo = TileSetCellOcclusionInfo;
    exports.TileSetCellPhysicsInfo = TileSetCellPhysicsInfo;
    exports.TileSetCustomDataLayer = TileSetCustomDataLayer;
    exports.TileSetOcclusionLayer = TileSetOcclusionLayer;
    exports.TileSetPhysicsLayer = TileSetPhysicsLayer;
    exports.TileSetTerrain = TileSetTerrain;
    exports.TileSetTerrainSet = TileSetTerrainSet;
    exports.Vector2LikeSet = Vector2LikeSet;

})(window.Laya = window.Laya || {}, Laya);
//# sourceMappingURL=laya.tilemap.js.map
