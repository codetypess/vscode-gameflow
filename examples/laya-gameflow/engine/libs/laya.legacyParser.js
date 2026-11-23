(function (exports, Laya) {
    'use strict';

    Laya.Animator && (function () {
        Laya.Animator.prototype._parse = function (data) {
            var play = data.playOnWake;
            var layersData = data.layers;
            for (var i = 0; i < layersData.length; i++) {
                var layerData = layersData[i];
                var animatorLayer = new Laya.AnimatorControllerLayer(layerData.name);
                if (i === 0)
                    animatorLayer.defaultWeight = 1.0;
                else
                    animatorLayer.defaultWeight = layerData.weight;
                var blendingModeData = layerData.blendingMode;
                (blendingModeData) && (animatorLayer.blendingMode = blendingModeData);
                this.addControllerLayer(animatorLayer);
                var states = layerData.states;
                for (var j = 0, m = states.length; j < m; j++) {
                    var state = states[j];
                    var clipPath = state.clipPath;
                    if (clipPath) {
                        var name = state.name;
                        var motion;
                        motion = Laya.Loader.getRes(clipPath);
                        if (motion) {
                            var animatorState = new Laya.AnimatorState();
                            animatorState.name = name;
                            animatorState.clip = motion;
                            state.speed && (animatorState.speed = state.speed);
                            animatorLayer.addState(animatorState);
                            (j === 0) && (this.getControllerLayer(i).defaultState = animatorState);
                        }
                    }
                }
                (play !== undefined) && (animatorLayer.playOnWake = play);
                let layerMaskData = layerData.avatarMask;
                if (layerMaskData) {
                    let avaMask = new Laya.AvatarMask();
                    animatorLayer.avatarMask = avaMask;
                    for (var bips in layerMaskData) {
                        avaMask.setTransformActive(bips, layerMaskData[bips]);
                    }
                }
            }
            var cullingModeData = data.cullingMode;
            (cullingModeData !== undefined) && (this.cullingMode = cullingModeData);
        };
    })();

    Laya.BaseCamera && (function () {
        let old_parse = Laya.BaseCamera.prototype._parse;
        Laya.BaseCamera.prototype._parse = function (data, spriteMap) {
            old_parse.call(this, data, spriteMap);
            this.orthographic = data.orthographic;
            (data.orthographicVerticalSize !== undefined) && (this.orthographicVerticalSize = data.orthographicVerticalSize);
            (data.fieldOfView !== undefined) && (this.fieldOfView = data.fieldOfView);
            this.nearPlane = data.nearPlane;
            this.farPlane = data.farPlane;
            var color = data.clearColor;
            this.clearColor = new Laya.Color(color[0], color[1], color[2], color[3]);
        };
    })();

    Laya.Camera && (function () {
        let old_parse = Laya.Camera.prototype._parse;
        Laya.Camera.prototype._parse = function (data, spriteMap) {
            old_parse.call(this, data, spriteMap);
            var clearFlagData = data.clearFlag;
            (clearFlagData !== undefined) && (this.clearFlag = clearFlagData);
            var viewport = data.viewport;
            this.normalizedViewport = new Laya.Viewport(viewport[0], viewport[1], viewport[2], viewport[3]);
            var enableHDR = data.enableHDR;
            (enableHDR !== undefined) && (this.enableHDR = enableHDR);
        };
    })();

    class HierarchyParserV2 {
        static _createSprite3DInstance(nodeData, spriteMap, outBatchSprites) {
            let node;
            let nodeToComp;
            switch (nodeData.type) {
                case "Scene3D":
                    node = new Laya.Scene3D();
                    break;
                case "Sprite3D":
                    node = new Laya.Sprite3D();
                    break;
                case "MeshSprite3D":
                    node = new Laya.MeshSprite3D();
                    (outBatchSprites && nodeData.props.isStatic) && (outBatchSprites.push(node));
                    break;
                case "SkinnedMeshSprite3D":
                    node = new Laya.SkinnedMeshSprite3D();
                    break;
                case "SimpleSkinnedMeshSprite3D":
                    node = new Laya.SimpleSkinnedMeshSprite3D();
                    break;
                case "ShuriKenParticle3D":
                    node = new Laya.ShuriKenParticle3D();
                    break;
                case "Camera":
                    node = new Laya.Camera();
                    break;
                case "ReflectionProbe":
                    node = new Laya.Sprite3D();
                    nodeToComp = node.addComponent(Laya.ReflectionProbe);
                    break;
                case "DirectionLight":
                    node = new Laya.Sprite3D();
                    nodeToComp = node.addComponent(Laya.DirectionLightCom);
                    break;
                case "PointLight":
                    node = new Laya.Sprite3D();
                    nodeToComp = node.addComponent(Laya.PointLightCom);
                    break;
                case "SpotLight":
                    node = new Laya.Sprite3D();
                    nodeToComp = node.addComponent(Laya.SpotLightCom);
                    break;
                case "TrailSprite3D":
                    node = new Laya.Sprite3D();
                    nodeToComp = node.addComponent(Laya.TrailRenderer);
                    break;
                default:
                    throw new Error(`unknown node type ${nodeData.type}`);
            }
            let childData = nodeData.child;
            if (childData) {
                for (let i = 0, n = childData.length; i < n; i++) {
                    let child = HierarchyParserV2._createSprite3DInstance(childData[i], spriteMap, outBatchSprites);
                    node.addChild(child);
                }
            }
            spriteMap[nodeData.instanceID] = nodeToComp || node;
            return node;
        }
        static _createComponentInstance(nodeData, spriteMap, interactMap) {
            let node = spriteMap[nodeData.instanceID];
            node._parse(nodeData.props, spriteMap);
            let childData = nodeData.child;
            if (childData) {
                for (let i = 0, n = childData.length; i < n; i++)
                    HierarchyParserV2._createComponentInstance(childData[i], spriteMap, interactMap);
            }
            let componentsData = nodeData.components;
            if (componentsData) {
                for (let j = 0, m = componentsData.length; j < m; j++) {
                    let data = componentsData[j];
                    let cls = Laya.ClassUtils.getClass(data.type);
                    if (cls) {
                        let component = ((node instanceof Laya.Component) ? node.owner : node).addComponent(cls);
                        component._parse(data, interactMap);
                    }
                    else {
                        console.warn(`unknown component type: ${data.type}.`);
                    }
                }
            }
        }
        static _createNodeByJson02(nodeData, outBatchSprites) {
            let spriteMap = {};
            let interactMap = { component: [], data: [] };
            let node = HierarchyParserV2._createSprite3DInstance(nodeData, spriteMap, outBatchSprites);
            HierarchyParserV2._createComponentInstance(nodeData, spriteMap, interactMap);
            HierarchyParserV2._createInteractInstance(interactMap, spriteMap);
            return node;
        }
        static _createInteractInstance(interatMap, spriteMap) {
            let components = interatMap.component;
            let data = interatMap.data;
            for (let i = 0, n = components.length; i < n; i++) {
                components[i]._parseInteractive(data[i], spriteMap);
            }
        }
        static parse(data) {
            let json = data.data;
            let outBatchSprits = [];
            let sprite;
            switch (data.version) {
                case "LAYAHIERARCHY:02":
                case "LAYASCENE3D:02":
                    sprite = HierarchyParserV2._createNodeByJson02(json, outBatchSprits);
                    break;
                default:
                    sprite = HierarchyParserV2._createNodeByJson(json, outBatchSprits);
            }
            return sprite;
        }
        static _createNodeByJson(nodeData, outBatchSprites) {
            let node;
            let nodeToComp;
            switch (nodeData.type) {
                case "Scene3D":
                    node = new Laya.Scene3D();
                    break;
                case "Sprite3D":
                    node = new Laya.Sprite3D();
                    break;
                case "MeshSprite3D":
                    node = new Laya.MeshSprite3D();
                    (outBatchSprites && nodeData.props.isStatic) && (outBatchSprites.push(node));
                    break;
                case "SkinnedMeshSprite3D":
                    node = new Laya.SkinnedMeshSprite3D();
                    break;
                case "ShuriKenParticle3D":
                    node = new Laya.ShuriKenParticle3D();
                    break;
                case "Camera":
                    node = new Laya.Camera();
                    break;
                case "DirectionLight":
                    node = new Laya.Sprite3D();
                    nodeToComp = node.addComponent(Laya.DirectionLightCom);
                    break;
                case "PointLight":
                    node = new Laya.Sprite3D();
                    nodeToComp = node.addComponent(Laya.PointLightCom);
                    break;
                case "SpotLight":
                    node = new Laya.Sprite3D();
                    nodeToComp = node.addComponent(Laya.SpotLightCom);
                    break;
                case "TrailSprite3D":
                    node = new Laya.Sprite3D();
                    nodeToComp = node.addComponent(Laya.TrailRenderer);
                    break;
                default:
                    throw new Error(`unknown node type ${nodeData.type}`);
            }
            let childData = nodeData.child;
            if (childData) {
                for (let i = 0, n = childData.length; i < n; i++) {
                    let child = HierarchyParserV2._createNodeByJson(childData[i], outBatchSprites);
                    node.addChild(child);
                }
            }
            let componentsData = nodeData.components;
            if (componentsData) {
                for (let j = 0, m = componentsData.length; j < m; j++) {
                    let data = componentsData[j];
                    let clas = Laya.ClassUtils.getClass(data.type);
                    if (clas) {
                        let component = node.addComponent(clas);
                        component._parse(data);
                    }
                    else {
                        console.warn(`unknown component type: ${data.type}.`);
                    }
                }
            }
            if (nodeToComp)
                nodeToComp._parse(nodeData.props);
            else
                node._parse(nodeData.props, null);
            return node;
        }
        static collectResourceLinks(data, basePath) {
            let test = {};
            let innerUrls = [];
            function addInnerUrl(url, type, constructParams, propertyParams) {
                let url2 = test[url];
                if (url2 === undefined) {
                    url2 = Laya.URL.join(basePath, url);
                    innerUrls.push({ url: url2, type: type, constructParams: constructParams, propertyParams: propertyParams });
                    test[url] = url2;
                }
                return url2;
            }
            function check(nodeData) {
                let props = nodeData.props;
                switch (nodeData.type) {
                    case "Scene3D":
                        let lightmaps = props.lightmaps;
                        if (lightmaps) {
                            for (let i = 0, n = lightmaps.length; i < n; i++) {
                                let lightMap = lightmaps[i];
                                if (lightMap.path) {
                                    lightMap.path = addInnerUrl(lightMap.path, Laya.Loader.TEXTURE2D, lightMap.constructParams, lightMap.propertyParams);
                                }
                                else {
                                    let lightmapColorData = lightMap.color;
                                    lightmapColorData.path = addInnerUrl(lightmapColorData.path, Laya.Loader.TEXTURE2D, lightmapColorData.constructParams, lightmapColorData.propertyParams);
                                    let lightmapDirectionData = lightMap.direction;
                                    if (lightmapDirectionData)
                                        lightmapDirectionData.path = addInnerUrl(lightmapDirectionData.path, Laya.Loader.TEXTURE2D, lightmapDirectionData.constructParams, lightmapDirectionData.propertyParams);
                                }
                            }
                        }
                        let reflectionTextureData = props.reflectionTexture;
                        (reflectionTextureData) && (props.reflection = addInnerUrl(reflectionTextureData, Laya.Loader.TEXTURECUBE));
                        let reflectionData = props.reflection;
                        (reflectionData) && (props.reflection = addInnerUrl(reflectionData, Laya.Loader.TEXTURECUBE));
                        if (props.sky) {
                            let skyboxMaterial = props.sky.material;
                            (skyboxMaterial) && (skyboxMaterial.path = addInnerUrl(skyboxMaterial.path, Laya.Loader.MATERIAL));
                        }
                        break;
                    case "Camera":
                        let skyboxMatData = props.skyboxMaterial;
                        (skyboxMatData) && (skyboxMatData.path = addInnerUrl(skyboxMatData.path, Laya.Loader.MATERIAL));
                        break;
                    case "TrailSprite3D":
                    case "MeshSprite3D":
                    case "SkinnedMeshSprite3D":
                    case "SimpleSkinnedMeshSprite3D":
                        let meshPath = props.meshPath;
                        (meshPath) && (props.meshPath = addInnerUrl(meshPath, Laya.Loader.MESH));
                        let materials = props.materials;
                        if (materials)
                            for (let i = 0, n = materials.length; i < n; i++)
                                materials[i].path = addInnerUrl(materials[i].path, Laya.Loader.MATERIAL);
                        if (nodeData.type == "SimpleSkinnedMeshSprite3D")
                            if (props.animatorTexture)
                                props.animatorTexture = addInnerUrl(props.animatorTexture, Laya.Loader.TEXTURE2D);
                        break;
                    case "ShuriKenParticle3D":
                        if (props.main) {
                            let resources = props.renderer.resources;
                            let mesh = resources.mesh;
                            let material = resources.material;
                            (mesh) && (resources.mesh = addInnerUrl(mesh, Laya.Loader.MESH));
                            (material) && (resources.material = addInnerUrl(material, Laya.Loader.MATERIAL));
                        }
                        else {
                            let parMeshPath = props.meshPath;
                            (parMeshPath) && (props.meshPath = addInnerUrl(parMeshPath, Laya.Loader.MESH));
                            props.material.path = addInnerUrl(props.material.path, Laya.Loader.MATERIAL);
                        }
                        break;
                    case "Terrain":
                        addInnerUrl(props.dataPath, Laya.Loader.TERRAINRES);
                        break;
                    case "ReflectionProbe":
                        let reflection = props.reflection;
                        (reflection) && (props.reflection = addInnerUrl(reflection, Laya.Loader.TEXTURECUBE));
                        break;
                }
                let components = nodeData.components;
                if (components) {
                    for (let k = 0, p = components.length; k < p; k++) {
                        let component = components[k];
                        switch (component.type) {
                            case "Animator":
                                let clipPaths = component.clipPaths;
                                if (!clipPaths) {
                                    let layersData = component.layers;
                                    for (let i = 0; i < layersData.length; i++) {
                                        let states = layersData[i].states;
                                        for (let j = 0, m = states.length; j < m; j++) {
                                            let clipPath = states[j].clipPath;
                                            (clipPath) && (states[j].clipPath = addInnerUrl(clipPath, Laya.Loader.ANIMATIONCLIP));
                                        }
                                    }
                                }
                                else {
                                    for (let i = 0, n = clipPaths.length; i < n; i++)
                                        clipPaths[i] = addInnerUrl(clipPaths[i], Laya.Loader.ANIMATIONCLIP);
                                }
                                break;
                            case "PhysicsCollider":
                            case "Rigidbody3D":
                            case "CharacterController":
                                let shapes = component.shapes;
                                for (let i = 0; i < shapes.length; i++) {
                                    let shape = shapes[i];
                                    if (shape.type === "MeshColliderShape") {
                                        let mesh = shape.mesh;
                                        (mesh) && (shape.mesh = addInnerUrl(mesh, Laya.Loader.MESH));
                                    }
                                }
                                break;
                        }
                    }
                }
                let children = nodeData.child;
                if (!children)
                    return;
                for (let i = 0, n = children.length; i < n; i++)
                    check(children[i]);
            }
            check(data.data);
            return innerUrls;
        }
    }
    Laya.PrefabImpl.v2 = HierarchyParserV2;

    var _listClass;
    var _viewClass;
    class LegacyUIParser {
        static parse(data, options) {
            let root = options === null || options === void 0 ? void 0 : options.root;
            if (!root) {
                let runtime = (Laya.LayaEnv.isPlaying && data.props.runtime) ? data.props.runtime : data.type;
                let clas = Laya.ClassUtils.getClass(runtime);
                if (data.props.renderType == "instance")
                    root = clas.instance || (clas.instance = new clas());
                else
                    root = new clas();
            }
            if (root && root._viewCreated)
                return root;
            return LegacyUIParser.createByData(root, data);
        }
        static getBindFun(value) {
            let map = LegacyUIParser._funMap;
            if (!map)
                map = LegacyUIParser._funMap = new Laya.WeakObject();
            var fun = LegacyUIParser._funMap.get(value);
            if (fun == null) {
                var temp = "\"" + value + "\"";
                temp = temp.replace(/^"\${|}"$/g, "").replace(/\${/g, "\"+").replace(/}/g, "+\"");
                var str = "(function(data){if(data==null)return;with(data){try{\nreturn " + temp + "\n}catch(e){}}})";
                fun = window.Laya._runScript(str);
                LegacyUIParser._funMap.set(value, fun);
            }
            return fun;
        }
        static createByData(root, uiView) {
            var tInitTool = InitTool.create();
            root = LegacyUIParser.createComp(uiView, root, root, null, tInitTool);
            if ("_idMap" in root) {
                root["_idMap"] = tInitTool._idMap;
            }
            if ((root instanceof Laya.Scene) && root._width > 0 && uiView.props.hitTestPrior == null && !root.mouseThrough)
                root.hitTestPrior = true;
            tInitTool.finish();
            if (root.parent && root.parent.activeInHierarchy && root.active)
                root._processActive(true);
            return root;
        }
        static createInitTool() {
            return InitTool.create();
        }
        static createComp(uiView, comp = null, view = null, dataMap = null, initTool = null) {
            comp = comp || LegacyUIParser.getCompInstance(uiView);
            if (!comp) {
                if (uiView.props && uiView.props.runtime)
                    console.warn("runtime not found:" + uiView.props.runtime);
                else
                    console.warn("can not create:" + uiView.type);
                return null;
            }
            var child = uiView.child;
            if (child) {
                var isList = comp instanceof (_listClass || (_listClass = Laya.ClassUtils.getClass("List")));
                for (var i = 0, n = child.length; i < n; i++) {
                    var node = child[i];
                    if ('itemRender' in comp && (node.props.name == "render" || node.props.renderType === "render")) {
                        comp["itemRender"] = node;
                    }
                    else if (node.type == "Graphic") {
                        this._addGraphicsToSprite(node, comp);
                    }
                    else if (this._isDrawType(node.type)) {
                        this._addGraphicToSprite(node, comp, true);
                    }
                    else {
                        if (isList) {
                            var arr = [];
                            var tChild = LegacyUIParser.createComp(node, null, view, arr, initTool);
                            if (arr.length)
                                tChild["_$bindData"] = arr;
                        }
                        else {
                            tChild = LegacyUIParser.createComp(node, null, view, dataMap, initTool);
                        }
                        if (node.type == "Script") {
                            if (tChild instanceof Laya.Component) {
                                comp.addComponentInstance(tChild);
                            }
                            else {
                                if ("owner" in tChild) {
                                    tChild["owner"] = comp;
                                }
                                else if ("target" in tChild) {
                                    tChild["target"] = comp;
                                }
                            }
                        }
                        else if (node.props.renderType == "mask" || node.props.name == "mask") {
                            comp.mask = tChild;
                        }
                        else {
                            tChild instanceof Laya.Node && comp.addChild(tChild);
                        }
                    }
                }
            }
            var props = uiView.props;
            for (var prop in props) {
                var value = props[prop];
                if (typeof (value) == 'string' && (value.indexOf("@node:") >= 0 || value.indexOf("@Prefab:") >= 0)) {
                    if (initTool) {
                        initTool.addNodeRef(comp, prop, value);
                    }
                }
                else
                    LegacyUIParser.setCompValue(comp, prop, value, view, dataMap);
            }
            if (comp._afterInited) {
                comp._afterInited();
            }
            if (uiView.compId && initTool && initTool._idMap) {
                initTool._idMap[uiView.compId] = comp;
            }
            return comp;
        }
        static setCompValue(comp, prop, value, view = null, dataMap = null) {
            if (typeof (value) == 'string' && value.indexOf("${") > -1) {
                LegacyUIParser._sheet || (LegacyUIParser._sheet = Laya.ClassUtils.getClass("laya.data.Table"));
                if (!LegacyUIParser._sheet) {
                    console.warn("Can not find class Sheet");
                    return;
                }
                if (dataMap) {
                    dataMap.push(comp, prop, value);
                }
                else if (view) {
                    if (value.indexOf("].") == -1) {
                        value = value.replace(".", "[0].");
                    }
                    var watcher = new DataWatcher(comp, prop, value);
                    watcher.exe(view);
                    var one, temp;
                    var str = value.replace(/\[.*?\]\./g, ".");
                    while ((one = LegacyUIParser._parseWatchData.exec(str)) != null) {
                        var key1 = one[1];
                        while ((temp = LegacyUIParser._parseKeyWord.exec(key1)) != null) {
                            var key2 = temp[0];
                            var arr = (view._watchMap[key2] || (view._watchMap[key2] = []));
                            arr.push(watcher);
                            LegacyUIParser._sheet.I.notifer.on(key2, view, view.changeData, [key2]);
                        }
                        arr = (view._watchMap[key1] || (view._watchMap[key1] = []));
                        arr.push(watcher);
                        LegacyUIParser._sheet.I.notifer.on(key1, view, view.changeData, [key1]);
                    }
                }
                return;
            }
            if (prop === "var" && view) {
                view[value] = comp;
            }
            else {
                if (prop === "texture" && comp instanceof Laya.Sprite)
                    comp.loadImage(value);
                else
                    comp[prop] = (value === "true" ? true : (value === "false" ? false : value));
            }
        }
        static getCompInstance(json) {
            if (json.type == "UIView") {
                if (json.props && json.props.pageData) {
                    return LegacyUIParser.createByData(null, json.props.pageData);
                }
            }
            var runtime = Laya.LayaEnv.isPlaying ? ((json.props && json.props.runtime) || json.type) : json.type;
            var compClass = Laya.ClassUtils.getClass(runtime);
            if (!compClass)
                throw "Can not find class " + runtime;
            if (json.type === "Script" && compClass.prototype._doAwake) {
                var comp = Laya.Pool.createByClass(compClass);
                comp._destroyed = false;
                return comp;
            }
            if (json.props && "renderType" in json.props && json.props["renderType"] == "instance") {
                if (!compClass["instance"])
                    compClass["instance"] = new compClass();
                return compClass["instance"];
            }
            let ret = new compClass();
            if (ret instanceof (_viewClass || (_viewClass = Laya.ClassUtils.getClass("View"))))
                ret._scene = ret;
            return ret;
        }
        static collectResourceLinks(uiView) {
            let test = new Set();
            let innerUrls = [];
            function addInnerUrl(url) {
                if (!test.has(url)) {
                    test.add(url);
                    innerUrls.push(url);
                }
            }
            function check(uiView) {
                let props = uiView.props;
                for (let prop in props) {
                    let value = props[prop];
                    if (typeof (value) == 'string' && value.indexOf("@Prefab:") >= 0) {
                        let url = value.replace("@Prefab:", "");
                        addInnerUrl(url);
                    }
                }
                let child = uiView.child;
                if (child) {
                    for (let i = 0, n = child.length; i < n; i++) {
                        let node = child[i];
                        check(node);
                    }
                }
            }
            if (uiView.loadList) {
                for (let url of uiView.loadList)
                    addInnerUrl(url);
            }
            if (uiView.loadList3D) {
                for (let url of uiView.loadList3D)
                    addInnerUrl(url);
            }
            check(uiView);
            return innerUrls;
        }
        static createByJson(json, node = null, root = null, customHandler = null, instanceHandler = null) {
            if (typeof (json) == 'string')
                json = JSON.parse(json);
            var props = json.props;
            if (!node) {
                if (instanceHandler)
                    node = instanceHandler.runWith(json);
                else {
                    let className = Laya.LayaEnv.isPlaying ? (props.runtime || json.type) : json.type;
                    let compClass = Laya.ClassUtils.getClass(className);
                    if (compClass)
                        node = new compClass();
                    else {
                        console.warn("[error] Undefined class:", className);
                        return null;
                    }
                }
                if (!node)
                    return null;
            }
            var child = json.child;
            if (child) {
                for (var i = 0, n = child.length; i < n; i++) {
                    var data = child[i];
                    if ((data.props.name === "render" || data.props.renderType === "render") && node["_$set_itemRender"])
                        node.itemRender = data;
                    else {
                        if (data.type == "Graphic") {
                            this._addGraphicsToSprite(data, node);
                        }
                        else if (this._isDrawType(data.type)) {
                            this._addGraphicToSprite(data, node, true);
                        }
                        else {
                            var tChild = this.createByJson(data, null, root, customHandler, instanceHandler);
                            if (data.type === "Script") {
                                if ("owner" in tChild) {
                                    tChild["owner"] = node;
                                }
                                else if ("target" in tChild) {
                                    tChild["target"] = node;
                                }
                            }
                            else if (data.props.renderType == "mask") {
                                node.mask = tChild;
                            }
                            else {
                                node.addChild(tChild);
                            }
                        }
                    }
                }
            }
            if (props) {
                for (var prop in props) {
                    var value = props[prop];
                    if (prop === "var" && root) {
                        root[value] = node;
                    }
                    else if (value instanceof Array && node[prop] instanceof Function) {
                        node[prop].apply(node, value);
                    }
                    else {
                        node[prop] = value;
                    }
                }
            }
            if (customHandler && json.customProps) {
                customHandler.runWith([node, json]);
            }
            if (node["created"])
                node.created();
            return node;
        }
        static _addGraphicsToSprite(graphicO, sprite) {
            var graphics = graphicO.child;
            if (!graphics || graphics.length < 1)
                return;
            var g = this._getGraphicsFromSprite(graphicO, sprite);
            var ox = 0;
            var oy = 0;
            if (graphicO.props) {
                ox = this._getObjVar(graphicO.props, "x", 0);
                oy = this._getObjVar(graphicO.props, "y", 0);
            }
            if (ox != 0 && oy != 0) {
                g.translate(ox, oy);
            }
            var i, len;
            len = graphics.length;
            for (i = 0; i < len; i++) {
                this._addGraphicToGraphics(graphics[i], g);
            }
            if (ox != 0 && oy != 0) {
                g.translate(-ox, -oy);
            }
        }
        static _addGraphicToSprite(graphicO, sprite, isChild = false) {
            var g = isChild ? this._getGraphicsFromSprite(graphicO, sprite) : sprite.graphics;
            this._addGraphicToGraphics(graphicO, g);
        }
        static _getGraphicsFromSprite(dataO, sprite) {
            if (!dataO || !dataO.props)
                return sprite.graphics;
            var propsName = dataO.props.renderType;
            if (propsName === "hit" || propsName === "unHit") {
                var hitArea = sprite._hitArea || (sprite.hitArea = new Laya.HitArea());
                if (!hitArea[propsName]) {
                    hitArea[propsName] = new Laya.Graphics();
                }
                var g = hitArea[propsName];
            }
            if (!g)
                g = sprite.graphics;
            return g;
        }
        static _getTransformData(propsO) {
            var m;
            if ("pivotX" in propsO || "pivotY" in propsO) {
                m = m || new Laya.Matrix();
                m.translate(-this._getObjVar(propsO, "pivotX", 0), -this._getObjVar(propsO, "pivotY", 0));
            }
            var sx = this._getObjVar(propsO, "scaleX", 1), sy = this._getObjVar(propsO, "scaleY", 1);
            var rotate = this._getObjVar(propsO, "rotation", 0);
            this._getObjVar(propsO, "skewX", 0);
            this._getObjVar(propsO, "skewY", 0);
            if (sx != 1 || sy != 1 || rotate != 0) {
                m = m || new Laya.Matrix();
                m.scale(sx, sy);
                m.rotate(rotate * 0.0174532922222222);
            }
            return m;
        }
        static _addGraphicToGraphics(graphicO, graphic) {
            var propsO;
            propsO = graphicO.props;
            if (!propsO)
                return;
            var drawConfig;
            drawConfig = this.DrawTypeDic[graphicO.type];
            if (!drawConfig)
                return;
            var g = graphic;
            var params = this._getParams(propsO, drawConfig[1], drawConfig[2], drawConfig[3]);
            var m = this._tM;
            if (m || this._alpha != 1) {
                g.save();
                if (m)
                    g.transform(m);
                if (this._alpha != 1)
                    g.alpha(this._alpha);
            }
            g[drawConfig[0]].apply(g, params);
            if (m || this._alpha != 1) {
                g.restore();
            }
        }
        static _adptLineData(params) {
            params[2] = parseFloat(params[0]) + parseFloat(params[2]);
            params[3] = parseFloat(params[1]) + parseFloat(params[3]);
            return params;
        }
        static _adptTextureData(params) {
            params[0] = Laya.ILaya.Loader.getRes(params[0]);
            return params;
        }
        static _adptLinesData(params) {
            params[2] = this._getPointListByStr(params[2]);
            return params;
        }
        static _isDrawType(type) {
            if (type === "Image")
                return false;
            return type in this.DrawTypeDic;
        }
        static _getParams(obj, params, xPos = 0, adptFun = null) {
            var rst = this._temParam;
            rst.length = params.length;
            var i, len;
            len = params.length;
            for (i = 0; i < len; i++) {
                rst[i] = this._getObjVar(obj, params[i][0], params[i][1]);
            }
            this._alpha = this._getObjVar(obj, "alpha", 1);
            var m;
            m = this._getTransformData(obj);
            if (m) {
                if (!xPos)
                    xPos = 0;
                m.translate(rst[xPos], rst[xPos + 1]);
                rst[xPos] = rst[xPos + 1] = 0;
                this._tM = m;
            }
            else {
                this._tM = null;
            }
            if (adptFun && this[adptFun]) {
                rst = this[adptFun](rst);
            }
            return rst;
        }
        static _getPointListByStr(str) {
            var pointArr = str.split(",");
            var i, len;
            len = pointArr.length;
            for (i = 0; i < len; i++) {
                pointArr[i] = parseFloat(pointArr[i]);
            }
            return pointArr;
        }
        static _getObjVar(obj, key, noValue) {
            if (key in obj) {
                return obj[key];
            }
            return noValue;
        }
    }
    LegacyUIParser._parseWatchData = /\${(.*?)}/g;
    LegacyUIParser._parseKeyWord = /[a-zA-Z_][a-zA-Z0-9_]*(?:(?:\.[a-zA-Z_][a-zA-Z0-9_]*)+)/g;
    LegacyUIParser.DrawTypeDic = { "Rect": ["drawRect", [["x", 0], ["y", 0], ["width", 0], ["height", 0], ["fillColor", null], ["lineColor", null], ["lineWidth", 1]]], "Circle": ["drawCircle", [["x", 0], ["y", 0], ["radius", 0], ["fillColor", null], ["lineColor", null], ["lineWidth", 1]]], "Pie": ["drawPie", [["x", 0], ["y", 0], ["radius", 0], ["startAngle", 0], ["endAngle", 0], ["fillColor", null], ["lineColor", null], ["lineWidth", 1]]], "Image": ["drawTexture", [["x", 0], ["y", 0], ["width", 0], ["height", 0]]], "Texture": ["drawTexture", [["skin", null], ["x", 0], ["y", 0], ["width", 0], ["height", 0]], 1, "_adptTextureData"], "FillTexture": ["fillTexture", [["skin", null], ["x", 0], ["y", 0], ["width", 0], ["height", 0], ["repeat", null]], 1, "_adptTextureData"], "FillText": ["fillText", [["text", ""], ["x", 0], ["y", 0], ["font", null], ["color", null], ["textAlign", null]], 1], "Line": ["drawLine", [["x", 0], ["y", 0], ["toX", 0], ["toY", 0], ["lineColor", null], ["lineWidth", 0]], 0, "_adptLineData"], "Lines": ["drawLines", [["x", 0], ["y", 0], ["points", ""], ["lineColor", null], ["lineWidth", 0]], 0, "_adptLinesData"], "Curves": ["drawCurves", [["x", 0], ["y", 0], ["points", ""], ["lineColor", null], ["lineWidth", 0]], 0, "_adptLinesData"], "Poly": ["drawPoly", [["x", 0], ["y", 0], ["points", ""], ["fillColor", null], ["lineColor", null], ["lineWidth", 1]], 0, "_adptLinesData"] };
    LegacyUIParser._temParam = [];
    class DataWatcher {
        constructor(comp, prop, value) {
            this.comp = comp;
            this.prop = prop;
            this.value = value;
        }
        exe(view) {
            var fun = LegacyUIParser.getBindFun(this.value);
            this.comp[this.prop] = fun.call(this, view);
        }
    }
    class InitTool {
        reset() {
            this._nodeRefList = null;
            this._initList = null;
            this._idMap = null;
        }
        recover() {
            this.reset();
            Laya.Pool.recover("InitTool", this);
        }
        static create() {
            var tool = Laya.Pool.getItemByClass("InitTool", InitTool);
            tool._idMap = {};
            return tool;
        }
        addNodeRef(node, prop, referStr) {
            if (!this._nodeRefList)
                this._nodeRefList = [];
            this._nodeRefList.push([node, prop, referStr]);
        }
        setNodeRef() {
            if (!this._nodeRefList)
                return;
            if (!this._idMap) {
                this._nodeRefList = null;
                return;
            }
            var i, len;
            len = this._nodeRefList.length;
            var tRefInfo;
            for (i = 0; i < len; i++) {
                tRefInfo = this._nodeRefList[i];
                tRefInfo[0][tRefInfo[1]] = this.getReferData(tRefInfo[2]);
            }
            this._nodeRefList = null;
        }
        getReferData(referStr) {
            if (referStr.indexOf("@Prefab:") >= 0) {
                return new Laya.PrefabImpl(LegacyUIParser, Laya.Loader.getRes(referStr.replace("@Prefab:", "")));
            }
            else if (referStr.indexOf("@arr:") >= 0) {
                referStr = referStr.replace("@arr:", "");
                var list;
                list = referStr.split(",");
                var i, len;
                var tStr;
                len = list.length;
                var list2 = [];
                for (i = 0; i < len; i++) {
                    tStr = list[i];
                    if (tStr) {
                        list2.push(this._idMap[tStr.replace("@node:", "")]);
                    }
                    else {
                        list2.push(null);
                    }
                }
                return list2;
            }
            else {
                return this._idMap[referStr.replace("@node:", "")];
            }
        }
        addInitItem(item) {
            if (!this._initList)
                this._initList = [];
            this._initList.push(item);
        }
        doInits() {
            if (!this._initList)
                return;
            this._initList = null;
        }
        finish() {
            this.setNodeRef();
            this.doInits();
            this.recover();
        }
    }
    Laya.PrefabImpl.legacySceneOrPrefab = LegacyUIParser;

    Laya.Light && (function () {
        let old_parse = Laya.Light.prototype._parse;
        Laya.Light.prototype._parse = function (data, spriteMap) {
            old_parse.call(this, data, spriteMap);
            var colorData = data.color;
            this.color.r = colorData[0];
            this.color.g = colorData[1];
            this.color.b = colorData[2];
            this.intensity = data.intensity;
            this.lightmapBakedType = data.lightmapBakedType;
        };
    })();

    Laya.LightSprite && (function () {
        let old_parse = Laya.LightSprite.prototype._parse;
        Laya.LightSprite.prototype._parse = function (data, spriteMap) {
            old_parse.call(this, data, spriteMap);
            var colorData = data.color;
            this.color.r = colorData[0];
            this.color.g = colorData[1];
            this.color.b = colorData[2];
            this.intensity = data.intensity;
            this.lightmapBakedType = data.lightmapBakedType;
        };
    })();

    Laya.MeshSprite3D && (function () {
        let old_parse = Laya.MeshSprite3D.prototype._parse;
        Laya.MeshSprite3D.prototype._parse = function (data, spriteMap) {
            old_parse.call(this, data, spriteMap);
            var render = this.meshRenderer;
            var lightmapIndex = data.lightmapIndex;
            (lightmapIndex != null) && (render.lightmapIndex = lightmapIndex);
            var lightmapScaleOffsetArray = data.lightmapScaleOffset;
            (lightmapScaleOffsetArray) && (render.lightmapScaleOffset = new Laya.Vector4(lightmapScaleOffsetArray[0], lightmapScaleOffsetArray[1], lightmapScaleOffsetArray[2], lightmapScaleOffsetArray[3]));
            (data.meshPath != undefined) && (this.meshFilter.sharedMesh = Laya.Loader.getRes(data.meshPath));
            (data.enableRender != undefined) && (render._enabled = data.enableRender);
            (data.receiveShadows != undefined) && (render.receiveShadow = data.receiveShadows);
            (data.castShadow != undefined) && (render.castShadow = data.castShadow);
            var materials = data.materials;
            if (materials) {
                var sharedMaterials = render.sharedMaterials;
                var materialCount = materials.length;
                sharedMaterials.length = materialCount;
                for (var i = 0; i < materialCount; i++) {
                    sharedMaterials[i] = Laya.Loader.getRes(materials[i].path);
                }
                render.sharedMaterials = sharedMaterials;
            }
        };
    })();

    Laya.PhysicsColliderComponent && (function () {
        Laya.PhysicsColliderComponent.prototype._parse = function (data, spriteMap) {
            (data.collisionGroup != null) && (this._collider.setCollisionGroup(data.collisionGroup));
            (data.canCollideWith != null) && (this._collider.setCanCollideWith(data.canCollideWith));
        };
        let PhysicsCollider_old_parse = Laya.PhysicsCollider.prototype._parse;
        Laya.PhysicsCollider.prototype._parse = function (data, spriteMap) {
            (data.friction != null) && (this.friction = data.friction);
            (data.rollingFriction != null) && (this.rollingFriction = data.rollingFriction);
            (data.restitution != null) && (this.restitution = data.restitution);
            (data.isTrigger != null) && (this.isTrigger = data.isTrigger);
            PhysicsCollider_old_parse.call(this, data, spriteMap);
            parseShape(this, data.shapes);
        };
        let Rigidbody3D_old_parse = Laya.Rigidbody3D.prototype._parse;
        Laya.Rigidbody3D.prototype._parse = function (data, spriteMap) {
            (data.friction != null) && (this.friction = data.friction);
            (data.rollingFriction != null) && (this.rollingFriction = data.rollingFriction);
            (data.restitution != null) && (this.restitution = data.restitution);
            (data.mass != null) && (this.mass = data.mass);
            (data.linearDamping != null) && (this.linearDamping = data.linearDamping);
            (data.angularDamping != null) && (this.angularDamping = data.angularDamping);
            if (data.linearFactor != null) {
                var linFac = this.linearFactor;
                linFac.fromArray(data.linearFactor);
                this.linearFactor = linFac;
            }
            if (data.angularFactor != null) {
                var angFac = this.angularFactor;
                angFac.fromArray(data.angularFactor);
                this.angularFactor = angFac;
            }
            if (data.gravity) {
                this.gravity.fromArray(data.gravity);
                this.gravity = this.gravity;
            }
            Rigidbody3D_old_parse.call(this, data, spriteMap);
            parseShape(this, data.shapes);
            (data.isKinematic != null) && (this.isKinematic = data.isKinematic);
        };
    })();
    function parseShape(comp, shapesData) {
        var shapeCount = shapesData.length;
        if (shapeCount === 1) {
            var shape = createShape(shapesData[0]);
            comp.colliderShape = shape;
        }
    }
    function createShape(shapeData) {
        var colliderShape;
        switch (shapeData.type) {
            case "BoxColliderShape":
                var sizeData = shapeData.size;
                colliderShape = sizeData ? new Laya.BoxColliderShape(sizeData[0], sizeData[1], sizeData[2]) : new Laya.BoxColliderShape();
                break;
            case "SphereColliderShape":
                colliderShape = new Laya.SphereColliderShape(shapeData.radius);
                break;
            case "CapsuleColliderShape":
                colliderShape = new Laya.CapsuleColliderShape(shapeData.radius, shapeData.height, shapeData.orientation);
                break;
            case "MeshColliderShape":
                colliderShape = new Laya.MeshColliderShape();
                break;
            case "ConeColliderShape":
                colliderShape = new Laya.ConeColliderShape(shapeData.radius, shapeData.height, shapeData.orientation);
                break;
            case "CylinderColliderShape":
                colliderShape = new Laya.CylinderColliderShape(shapeData.radius, shapeData.height, shapeData.orientation);
                break;
            default:
                console.error("unknown shape type.");
        }
        return colliderShape;
    }

    Laya.PointLightCom && (function () {
        let old_parse = Laya.PointLightCom.prototype._parse;
        Laya.PointLightCom.prototype._parse = function (data, spriteMap) {
            old_parse.call(this, data, spriteMap);
            this.range = data.range;
        };
    })();

    Laya.ShuriKenParticle3D && (function () {
        let old_parse = Laya.ShuriKenParticle3D.prototype._parse;
        Laya.ShuriKenParticle3D.prototype._parse = function (data, spriteMap) {
            old_parse.call(this, data, spriteMap);
            if (data.main) {
                var particleSystem = this.particleSystem;
                var particleRender = this.particleRenderer;
                _parseModule(particleRender, data.renderer);
                _parseModule(particleSystem, data.main);
                _parseModule(particleSystem.emission, data.emission);
                var shapeData = data.shape;
                if (shapeData) {
                    var shape;
                    switch (shapeData.shapeType) {
                        case 0:
                            shape = new Laya.SphereShape();
                            break;
                        case 1:
                            shape = new Laya.HemisphereShape();
                            break;
                        case 2:
                            shape = new Laya.ConeShape();
                            break;
                        case 3:
                            shape = new Laya.BoxShape();
                            break;
                        case 7:
                            shape = new Laya.CircleShape();
                            break;
                        default:
                            throw "ShuriKenParticle3D:unknown shape type.";
                    }
                    _parseModule(shape, shapeData);
                    particleSystem.shape = shape;
                }
                var velocityOverLifetimeData = data.velocityOverLifetime;
                if (velocityOverLifetimeData) {
                    var velocityData = velocityOverLifetimeData.velocity;
                    var velocity;
                    switch (velocityData.type) {
                        case 0:
                            var constantData = velocityData.constant;
                            velocity = Laya.GradientVelocity.createByConstant(constantData ? new Laya.Vector3(constantData[0], constantData[1], constantData[2]) : new Laya.Vector3(0, 0, 0));
                            break;
                        case 1:
                            velocity = Laya.GradientVelocity.createByGradient(_initParticleVelocity(velocityData.gradientX), _initParticleVelocity(velocityData.gradientY), _initParticleVelocity(velocityData.gradientZ));
                            break;
                        case 2:
                            var constantMinData = velocityData.constantMin;
                            var constantMaxData = velocityData.constantMax;
                            velocity = Laya.GradientVelocity.createByRandomTwoConstant(constantMinData ? new Laya.Vector3(constantMinData[0], constantMinData[1], constantMinData[2]) : new Laya.Vector3(0, 0, 0), constantMaxData ? new Laya.Vector3(constantMaxData[0], constantMaxData[1], constantMaxData[2]) : new Laya.Vector3(0, 0, 0));
                            break;
                        case 3:
                            velocity = Laya.GradientVelocity.createByRandomTwoGradient(_initParticleVelocity(velocityData.gradientXMin), _initParticleVelocity(velocityData.gradientXMax), _initParticleVelocity(velocityData.gradientYMin), _initParticleVelocity(velocityData.gradientYMax), _initParticleVelocity(velocityData.gradientZMin), _initParticleVelocity(velocityData.gradientZMax));
                            break;
                    }
                    var velocityOverLifetime = new Laya.VelocityOverLifetime(velocity);
                    _parseModule(velocityOverLifetime, velocityOverLifetimeData);
                    particleSystem.velocityOverLifetime = velocityOverLifetime;
                }
                var colorOverLifetimeData = data.colorOverLifetime;
                if (colorOverLifetimeData) {
                    var colorData = colorOverLifetimeData.color;
                    let maxKeyCount = colorData.maxKeyCount;
                    var color;
                    switch (colorData.type) {
                        case 0:
                            var constColorData = colorData.constant;
                            color = Laya.GradientColor.createByConstant(constColorData ? new Laya.Vector4(constColorData[0], constColorData[1], constColorData[2], constColorData[3]) : new Laya.Vector4(0, 0, 0, 0));
                            break;
                        case 1:
                            color = Laya.GradientColor.createByGradient(_initParticleColor(colorData.gradient, maxKeyCount));
                            break;
                        case 2:
                            var minConstColorData = colorData.constantMin;
                            var maxConstColorData = colorData.constantMax;
                            color = Laya.GradientColor.createByRandomTwoConstant(minConstColorData ? new Laya.Vector4(minConstColorData[0], minConstColorData[1], minConstColorData[2], minConstColorData[3]) : new Laya.Vector4(0, 0, 0, 0), minConstColorData ? new Laya.Vector4(maxConstColorData[0], maxConstColorData[1], maxConstColorData[2], maxConstColorData[3]) : new Laya.Vector4(0, 0, 0, 0));
                            break;
                        case 3:
                            color = Laya.GradientColor.createByRandomTwoGradient(_initParticleColor(colorData.gradientMin, maxKeyCount), _initParticleColor(colorData.gradientMax, maxKeyCount));
                            break;
                    }
                    var colorOverLifetime = new Laya.ColorOverLifetime(color);
                    _parseModule(colorOverLifetime, colorOverLifetimeData);
                    particleSystem.colorOverLifetime = colorOverLifetime;
                }
                var sizeOverLifetimeData = data.sizeOverLifetime;
                if (sizeOverLifetimeData) {
                    var sizeData = sizeOverLifetimeData.size;
                    var size;
                    switch (sizeData.type) {
                        case 0:
                            if (sizeData.separateAxes) {
                                size = Laya.GradientSize.createByGradientSeparate(_initParticleSize(sizeData.gradientX), _initParticleSize(sizeData.gradientY), _initParticleSize(sizeData.gradientZ));
                            }
                            else {
                                size = Laya.GradientSize.createByGradient(_initParticleSize(sizeData.gradient));
                            }
                            break;
                        case 1:
                            if (sizeData.separateAxes) {
                                var constantMinSeparateData = sizeData.constantMinSeparate;
                                var constantMaxSeparateData = sizeData.constantMaxSeparate;
                                size = Laya.GradientSize.createByRandomTwoConstantSeparate(constantMinSeparateData ? new Laya.Vector3(constantMinSeparateData[0], constantMinSeparateData[1], constantMinSeparateData[2]) : new Laya.Vector3(0, 0, 0), constantMaxSeparateData ? new Laya.Vector3(constantMaxSeparateData[0], constantMaxSeparateData[1], constantMaxSeparateData[2]) : new Laya.Vector3(0, 0, 0));
                            }
                            else {
                                size = Laya.GradientSize.createByRandomTwoConstant(sizeData.constantMin || 0, sizeData.constantMax || 0);
                            }
                            break;
                        case 2:
                            if (sizeData.separateAxes) {
                                size = Laya.GradientSize.createByRandomTwoGradientSeparate(_initParticleSize(sizeData.gradientXMin), _initParticleSize(sizeData.gradientYMin), _initParticleSize(sizeData.gradientZMin), _initParticleSize(sizeData.gradientXMax), _initParticleSize(sizeData.gradientYMax), _initParticleSize(sizeData.gradientZMax));
                            }
                            else {
                                size = Laya.GradientSize.createByRandomTwoGradient(_initParticleSize(sizeData.gradientMin), _initParticleSize(sizeData.gradientMax));
                            }
                            break;
                    }
                    var sizeOverLifetime = new Laya.SizeOverLifetime(size);
                    _parseModule(sizeOverLifetime, sizeOverLifetimeData);
                    particleSystem.sizeOverLifetime = sizeOverLifetime;
                }
                var rotationOverLifetimeData = data.rotationOverLifetime;
                if (rotationOverLifetimeData) {
                    var angularVelocityData = rotationOverLifetimeData.angularVelocity;
                    var angularVelocity;
                    switch (angularVelocityData.type) {
                        case 0:
                            if (angularVelocityData.separateAxes) {
                                var conSep = angularVelocityData.constantSeparate;
                                angularVelocity = Laya.GradientAngularVelocity.createByConstantSeparate(conSep ? new Laya.Vector3(conSep[0], conSep[1], conSep[2]) : new Laya.Vector3(0, 0, Math.PI / 4));
                            }
                            else {
                                angularVelocity = Laya.GradientAngularVelocity.createByConstant(angularVelocityData.constant || Math.PI / 4);
                            }
                            break;
                        case 1:
                            if (angularVelocityData.separateAxes) {
                                angularVelocity = Laya.GradientAngularVelocity.createByGradientSeparate(_initParticleRotation(angularVelocityData.gradientX), _initParticleRotation(angularVelocityData.gradientY), _initParticleRotation(angularVelocityData.gradientZ));
                            }
                            else {
                                angularVelocity = Laya.GradientAngularVelocity.createByGradient(_initParticleRotation(angularVelocityData.gradient));
                            }
                            break;
                        case 2:
                            if (angularVelocityData.separateAxes) {
                                var minSep = angularVelocityData.constantMinSeparate;
                                var maxSep = angularVelocityData.constantMaxSeparate;
                                angularVelocity = Laya.GradientAngularVelocity.createByRandomTwoConstantSeparate(minSep ? new Laya.Vector3(minSep[0], minSep[1], minSep[2]) : new Laya.Vector3(0, 0, 0), maxSep ? new Laya.Vector3(maxSep[0], maxSep[1], maxSep[2]) : new Laya.Vector3(0, 0, Math.PI / 4));
                            }
                            else {
                                angularVelocity = Laya.GradientAngularVelocity.createByRandomTwoConstant(angularVelocityData.constantMin || 0, angularVelocityData.constantMax || Math.PI / 4);
                            }
                            break;
                        case 3:
                            if (angularVelocityData.separateAxes) ;
                            else {
                                angularVelocity = Laya.GradientAngularVelocity.createByRandomTwoGradient(_initParticleRotation(angularVelocityData.gradientMin), _initParticleRotation(angularVelocityData.gradientMax));
                            }
                            break;
                    }
                    var rotationOverLifetime = new Laya.RotationOverLifetime(angularVelocity);
                    _parseModule(rotationOverLifetime, rotationOverLifetimeData);
                    particleSystem.rotationOverLifetime = rotationOverLifetime;
                }
                var textureSheetAnimationData = data.textureSheetAnimation;
                if (textureSheetAnimationData) {
                    var frameData = textureSheetAnimationData.frame;
                    var frameOverTime;
                    switch (frameData.type) {
                        case 0:
                            frameOverTime = Laya.FrameOverTime.createByConstant(frameData.constant);
                            break;
                        case 1:
                            frameOverTime = Laya.FrameOverTime.createByOverTime(_initParticleFrame(frameData.overTime));
                            break;
                        case 2:
                            frameOverTime = Laya.FrameOverTime.createByRandomTwoConstant(frameData.constantMin, frameData.constantMax);
                            break;
                        case 3:
                            frameOverTime = Laya.FrameOverTime.createByRandomTwoOverTime(_initParticleFrame(frameData.overTimeMin), _initParticleFrame(frameData.overTimeMax));
                            break;
                    }
                    var startFrameData = textureSheetAnimationData.startFrame;
                    var startFrame;
                    switch (startFrameData.type) {
                        case 0:
                            startFrame = Laya.StartFrame.createByConstant(startFrameData.constant);
                            break;
                        case 1:
                            startFrame = Laya.StartFrame.createByRandomTwoConstant(startFrameData.constantMin, startFrameData.constantMax);
                            break;
                    }
                    var textureSheetAnimation = new Laya.TextureSheetAnimation(frameOverTime, startFrame);
                    _parseModule(textureSheetAnimation, textureSheetAnimationData);
                    particleSystem.textureSheetAnimation = textureSheetAnimation;
                }
            }
            else {
                _parseOld.call(this, data);
            }
        };
    })();
    function _parseOld(data) {
        const anglelToRad = Math.PI / 180.0;
        var i, n;
        var particleRender = this.particleRenderer;
        var material;
        var materialData = data.material;
        (materialData) && (material = Laya.Loader.getRes(materialData.path));
        particleRender.sharedMaterial = material;
        var meshPath = data.meshPath;
        (meshPath) && (particleRender.mesh = Laya.Loader.getRes(meshPath));
        particleRender.renderMode = data.renderMode;
        particleRender.stretchedBillboardCameraSpeedScale = data.stretchedBillboardCameraSpeedScale;
        particleRender.stretchedBillboardSpeedScale = data.stretchedBillboardSpeedScale;
        particleRender.stretchedBillboardLengthScale = data.stretchedBillboardLengthScale;
        particleRender.sortingFudge = data.sortingFudge ? data.sortingFudge : 0.0;
        var particleSystem = this.particleSystem;
        particleSystem.isPerformanceMode = data.isPerformanceMode;
        particleSystem.duration = data.duration;
        particleSystem.looping = data.looping;
        particleSystem.prewarm = data.prewarm;
        particleSystem.startDelayType = data.startDelayType;
        particleSystem.startDelay = data.startDelay;
        particleSystem.startDelayMin = data.startDelayMin;
        particleSystem.startDelayMax = data.startDelayMax;
        particleSystem.startLifetimeType = data.startLifetimeType;
        particleSystem.startLifetimeConstant = data.startLifetimeConstant;
        particleSystem.startLifeTimeGradient = _initStartLife(data.startLifetimeGradient);
        particleSystem.startLifetimeConstantMin = data.startLifetimeConstantMin;
        particleSystem.startLifetimeConstantMax = data.startLifetimeConstantMax;
        particleSystem.startLifeTimeGradientMin = _initStartLife(data.startLifetimeGradientMin);
        particleSystem.startLifeTimeGradientMax = _initStartLife(data.startLifetimeGradientMax);
        particleSystem.startSpeedType = data.startSpeedType;
        particleSystem.startSpeedConstant = data.startSpeedConstant;
        particleSystem.startSpeedConstantMin = data.startSpeedConstantMin;
        particleSystem.startSpeedConstantMax = data.startSpeedConstantMax;
        particleSystem.threeDStartSize = data.threeDStartSize;
        particleSystem.startSizeType = data.startSizeType;
        particleSystem.startSizeConstant = data.startSizeConstant;
        var startSizeConstantSeparateArray = data.startSizeConstantSeparate;
        var startSizeConstantSeparateElement = particleSystem.startSizeConstantSeparate;
        startSizeConstantSeparateElement.x = startSizeConstantSeparateArray[0];
        startSizeConstantSeparateElement.y = startSizeConstantSeparateArray[1];
        startSizeConstantSeparateElement.z = startSizeConstantSeparateArray[2];
        particleSystem.startSizeConstantMin = data.startSizeConstantMin;
        particleSystem.startSizeConstantMax = data.startSizeConstantMax;
        var startSizeConstantMinSeparateArray = data.startSizeConstantMinSeparate;
        var startSizeConstantMinSeparateElement = particleSystem.startSizeConstantMinSeparate;
        startSizeConstantMinSeparateElement.x = startSizeConstantMinSeparateArray[0];
        startSizeConstantMinSeparateElement.y = startSizeConstantMinSeparateArray[1];
        startSizeConstantMinSeparateElement.z = startSizeConstantMinSeparateArray[2];
        var startSizeConstantMaxSeparateArray = data.startSizeConstantMaxSeparate;
        var startSizeConstantMaxSeparateElement = particleSystem.startSizeConstantMaxSeparate;
        startSizeConstantMaxSeparateElement.x = startSizeConstantMaxSeparateArray[0];
        startSizeConstantMaxSeparateElement.y = startSizeConstantMaxSeparateArray[1];
        startSizeConstantMaxSeparateElement.z = startSizeConstantMaxSeparateArray[2];
        particleSystem.threeDStartRotation = data.threeDStartRotation;
        particleSystem.startRotationType = data.startRotationType;
        particleSystem.startRotationConstant = data.startRotationConstant * anglelToRad;
        var startRotationConstantSeparateArray = data.startRotationConstantSeparate;
        var startRotationConstantSeparateElement = particleSystem.startRotationConstantSeparate;
        startRotationConstantSeparateElement.x = startRotationConstantSeparateArray[0] * anglelToRad;
        startRotationConstantSeparateElement.y = startRotationConstantSeparateArray[1] * anglelToRad;
        startRotationConstantSeparateElement.z = startRotationConstantSeparateArray[2] * anglelToRad;
        particleSystem.startRotationConstantMin = data.startRotationConstantMin * anglelToRad;
        particleSystem.startRotationConstantMax = data.startRotationConstantMax * anglelToRad;
        var startRotationConstantMinSeparateArray = data.startRotationConstantMinSeparate;
        var startRotationConstantMinSeparateElement = particleSystem.startRotationConstantMinSeparate;
        startRotationConstantMinSeparateElement.x = startRotationConstantMinSeparateArray[0] * anglelToRad;
        startRotationConstantMinSeparateElement.y = startRotationConstantMinSeparateArray[1] * anglelToRad;
        startRotationConstantMinSeparateElement.z = startRotationConstantMinSeparateArray[2] * anglelToRad;
        var startRotationConstantMaxSeparateArray = data.startRotationConstantMaxSeparate;
        var startRotationConstantMaxSeparateElement = particleSystem.startRotationConstantMaxSeparate;
        startRotationConstantMaxSeparateElement.x = startRotationConstantMaxSeparateArray[0] * anglelToRad;
        startRotationConstantMaxSeparateElement.y = startRotationConstantMaxSeparateArray[1] * anglelToRad;
        startRotationConstantMaxSeparateElement.z = startRotationConstantMaxSeparateArray[2] * anglelToRad;
        particleSystem.randomizeRotationDirection = data.randomizeRotationDirection;
        particleSystem.startColorType = data.startColorType;
        var startColorConstantArray = data.startColorConstant;
        var startColorConstantElement = particleSystem.startColorConstant;
        startColorConstantElement.x = startColorConstantArray[0];
        startColorConstantElement.y = startColorConstantArray[1];
        startColorConstantElement.z = startColorConstantArray[2];
        startColorConstantElement.w = startColorConstantArray[3];
        var startColorConstantMinArray = data.startColorConstantMin;
        var startColorConstantMinElement = particleSystem.startColorConstantMin;
        startColorConstantMinElement.x = startColorConstantMinArray[0];
        startColorConstantMinElement.y = startColorConstantMinArray[1];
        startColorConstantMinElement.z = startColorConstantMinArray[2];
        startColorConstantMinElement.w = startColorConstantMinArray[3];
        var startColorConstantMaxArray = data.startColorConstantMax;
        var startColorConstantMaxElement = particleSystem.startColorConstantMax;
        startColorConstantMaxElement.x = startColorConstantMaxArray[0];
        startColorConstantMaxElement.y = startColorConstantMaxArray[1];
        startColorConstantMaxElement.z = startColorConstantMaxArray[2];
        startColorConstantMaxElement.w = startColorConstantMaxArray[3];
        particleSystem.gravityModifier = data.gravityModifier;
        particleSystem.simulationSpace = data.simulationSpace;
        (data.simulationSpeed !== undefined) && (particleSystem.simulationSpeed = data.simulationSpeed);
        particleSystem.scaleMode = data.scaleMode;
        particleSystem.playOnAwake = data.playOnAwake;
        particleSystem.maxParticles = data.maxParticles;
        var autoRandomSeed = data.autoRandomSeed;
        (autoRandomSeed != null) && (particleSystem.autoRandomSeed = autoRandomSeed);
        var randomSeed = data.randomSeed;
        (randomSeed != null) && (particleSystem.randomSeed[0] = randomSeed);
        var emissionData = data.emission;
        var emission = particleSystem.emission;
        if (emissionData) {
            emission.emissionRate = emissionData.emissionRate;
            var burstsData = emissionData.bursts;
            if (burstsData)
                for (i = 0, n = burstsData.length; i < n; i++) {
                    var brust = burstsData[i];
                    emission.addBurst(new Laya.Burst(brust.time, brust.min, brust.max));
                }
            emission.enable = emissionData.enable;
        }
        else {
            emission.enable = false;
        }
        var shapeData = data.shape;
        if (shapeData) {
            var shape;
            switch (shapeData.shapeType) {
                case 0:
                    var sphereShape;
                    shape = sphereShape = new Laya.SphereShape();
                    sphereShape.radius = shapeData.sphereRadius;
                    sphereShape.emitFromShell = shapeData.sphereEmitFromShell;
                    sphereShape.randomDirection = shapeData.sphereRandomDirection;
                    break;
                case 1:
                    var hemiSphereShape;
                    shape = hemiSphereShape = new Laya.HemisphereShape();
                    hemiSphereShape.radius = shapeData.hemiSphereRadius;
                    hemiSphereShape.emitFromShell = shapeData.hemiSphereEmitFromShell;
                    hemiSphereShape.randomDirection = shapeData.hemiSphereRandomDirection;
                    break;
                case 2:
                    var coneShape;
                    shape = coneShape = new Laya.ConeShape();
                    coneShape.angle = shapeData.coneAngle * anglelToRad;
                    coneShape.radius = shapeData.coneRadius;
                    coneShape.length = shapeData.coneLength;
                    coneShape.emitType = shapeData.coneEmitType;
                    coneShape.randomDirection = shapeData.coneRandomDirection;
                    break;
                case 3:
                    var boxShape;
                    shape = boxShape = new Laya.BoxShape();
                    boxShape.x = shapeData.boxX;
                    boxShape.y = shapeData.boxY;
                    boxShape.z = shapeData.boxZ;
                    boxShape.randomDirection = shapeData.boxRandomDirection;
                    break;
                case 7:
                    var circleShape;
                    shape = circleShape = new Laya.CircleShape();
                    circleShape.radius = shapeData.circleRadius;
                    circleShape.arc = shapeData.circleArc * anglelToRad;
                    circleShape.emitFromEdge = shapeData.circleEmitFromEdge;
                    circleShape.randomDirection = shapeData.circleRandomDirection;
                    break;
                default:
                    var tempShape;
                    shape = tempShape = new Laya.CircleShape();
                    tempShape.radius = shapeData.circleRadius;
                    tempShape.arc = shapeData.circleArc * anglelToRad;
                    tempShape.emitFromEdge = shapeData.circleEmitFromEdge;
                    tempShape.randomDirection = shapeData.circleRandomDirection;
                    break;
            }
            shape.enable = shapeData.enable;
            particleSystem.shape = shape;
        }
        var velocityOverLifetimeData = data.velocityOverLifetime;
        if (velocityOverLifetimeData) {
            var velocityData = velocityOverLifetimeData.velocity;
            var velocity;
            switch (velocityData.type) {
                case 0:
                    var constantData = velocityData.constant;
                    velocity = Laya.GradientVelocity.createByConstant(new Laya.Vector3(constantData[0], constantData[1], constantData[2]));
                    break;
                case 1:
                    velocity = Laya.GradientVelocity.createByGradient(_initParticleVelocity(velocityData.gradientX), _initParticleVelocity(velocityData.gradientY), _initParticleVelocity(velocityData.gradientZ));
                    break;
                case 2:
                    var constantMinData = velocityData.constantMin;
                    var constantMaxData = velocityData.constantMax;
                    velocity = Laya.GradientVelocity.createByRandomTwoConstant(new Laya.Vector3(constantMinData[0], constantMinData[1], constantMinData[2]), new Laya.Vector3(constantMaxData[0], constantMaxData[1], constantMaxData[2]));
                    break;
                case 3:
                    velocity = Laya.GradientVelocity.createByRandomTwoGradient(_initParticleVelocity(velocityData.gradientXMin), _initParticleVelocity(velocityData.gradientXMax), _initParticleVelocity(velocityData.gradientYMin), _initParticleVelocity(velocityData.gradientYMax), _initParticleVelocity(velocityData.gradientZMin), _initParticleVelocity(velocityData.gradientZMax));
                    break;
            }
            var velocityOverLifetime = new Laya.VelocityOverLifetime(velocity);
            velocityOverLifetime.space = velocityOverLifetimeData.space;
            velocityOverLifetime.enable = velocityOverLifetimeData.enable;
            particleSystem.velocityOverLifetime = velocityOverLifetime;
        }
        var colorOverLifetimeData = data.colorOverLifetime;
        if (colorOverLifetimeData) {
            var colorData = colorOverLifetimeData.color;
            var color;
            switch (colorData.type) {
                case 0:
                    var constColorData = colorData.constant;
                    color = Laya.GradientColor.createByConstant(new Laya.Vector4(constColorData[0], constColorData[1], constColorData[2], constColorData[3]));
                    break;
                case 1:
                    color = Laya.GradientColor.createByGradient(_initParticleColor(colorData.gradient));
                    break;
                case 2:
                    var minConstColorData = colorData.constantMin;
                    var maxConstColorData = colorData.constantMax;
                    color = Laya.GradientColor.createByRandomTwoConstant(new Laya.Vector4(minConstColorData[0], minConstColorData[1], minConstColorData[2], minConstColorData[3]), new Laya.Vector4(maxConstColorData[0], maxConstColorData[1], maxConstColorData[2], maxConstColorData[3]));
                    break;
                case 3:
                    color = Laya.GradientColor.createByRandomTwoGradient(_initParticleColor(colorData.gradientMin), _initParticleColor(colorData.gradientMax));
                    break;
            }
            var colorOverLifetime = new Laya.ColorOverLifetime(color);
            colorOverLifetime.enable = colorOverLifetimeData.enable;
            particleSystem.colorOverLifetime = colorOverLifetime;
        }
        var sizeOverLifetimeData = data.sizeOverLifetime;
        if (sizeOverLifetimeData) {
            var sizeData = sizeOverLifetimeData.size;
            var size;
            switch (sizeData.type) {
                case 0:
                    if (sizeData.separateAxes) {
                        size = Laya.GradientSize.createByGradientSeparate(_initParticleSize(sizeData.gradientX), _initParticleSize(sizeData.gradientY), _initParticleSize(sizeData.gradientZ));
                    }
                    else {
                        size = Laya.GradientSize.createByGradient(_initParticleSize(sizeData.gradient));
                    }
                    break;
                case 1:
                    if (sizeData.separateAxes) {
                        var constantMinSeparateData = sizeData.constantMinSeparate;
                        var constantMaxSeparateData = sizeData.constantMaxSeparate;
                        size = Laya.GradientSize.createByRandomTwoConstantSeparate(new Laya.Vector3(constantMinSeparateData[0], constantMinSeparateData[1], constantMinSeparateData[2]), new Laya.Vector3(constantMaxSeparateData[0], constantMaxSeparateData[1], constantMaxSeparateData[2]));
                    }
                    else {
                        size = Laya.GradientSize.createByRandomTwoConstant(sizeData.constantMin, sizeData.constantMax);
                    }
                    break;
                case 2:
                    if (sizeData.separateAxes) {
                        size = Laya.GradientSize.createByRandomTwoGradientSeparate(_initParticleSize(sizeData.gradientXMin), _initParticleSize(sizeData.gradientYMin), _initParticleSize(sizeData.gradientZMin), _initParticleSize(sizeData.gradientXMax), _initParticleSize(sizeData.gradientYMax), _initParticleSize(sizeData.gradientZMax));
                    }
                    else {
                        size = Laya.GradientSize.createByRandomTwoGradient(_initParticleSize(sizeData.gradientMin), _initParticleSize(sizeData.gradientMax));
                    }
                    break;
            }
            var sizeOverLifetime = new Laya.SizeOverLifetime(size);
            sizeOverLifetime.enable = sizeOverLifetimeData.enable;
            particleSystem.sizeOverLifetime = sizeOverLifetime;
        }
        var rotationOverLifetimeData = data.rotationOverLifetime;
        if (rotationOverLifetimeData) {
            var angularVelocityData = rotationOverLifetimeData.angularVelocity;
            var angularVelocity;
            switch (angularVelocityData.type) {
                case 0:
                    if (angularVelocityData.separateAxes) {
                        var conSep = angularVelocityData.constantSeparate;
                        angularVelocity = Laya.GradientAngularVelocity.createByConstantSeparate(new Laya.Vector3(conSep[0] * anglelToRad, conSep[1] * anglelToRad, conSep[2] * anglelToRad));
                    }
                    else {
                        angularVelocity = Laya.GradientAngularVelocity.createByConstant(angularVelocityData.constant * anglelToRad);
                    }
                    break;
                case 1:
                    if (angularVelocityData.separateAxes) {
                        angularVelocity = Laya.GradientAngularVelocity.createByGradientSeparate(_initParticleRotation(angularVelocityData.gradientX), _initParticleRotation(angularVelocityData.gradientY), _initParticleRotation(angularVelocityData.gradientZ));
                    }
                    else {
                        angularVelocity = Laya.GradientAngularVelocity.createByGradient(_initParticleRotation(angularVelocityData.gradient));
                    }
                    break;
                case 2:
                    if (angularVelocityData.separateAxes) {
                        var minSep = angularVelocityData.constantMinSeparate;
                        var maxSep = angularVelocityData.constantMaxSeparate;
                        angularVelocity = Laya.GradientAngularVelocity.createByRandomTwoConstantSeparate(new Laya.Vector3(minSep[0] * anglelToRad, minSep[1] * anglelToRad, minSep[2] * anglelToRad), new Laya.Vector3(maxSep[0] * anglelToRad, maxSep[1] * anglelToRad, maxSep[2] * anglelToRad));
                    }
                    else {
                        angularVelocity = Laya.GradientAngularVelocity.createByRandomTwoConstant(angularVelocityData.constantMin * anglelToRad, angularVelocityData.constantMax * anglelToRad);
                    }
                    break;
                case 3:
                    if (angularVelocityData.separateAxes) ;
                    else {
                        angularVelocity = Laya.GradientAngularVelocity.createByRandomTwoGradient(_initParticleRotation(angularVelocityData.gradientMin), _initParticleRotation(angularVelocityData.gradientMax));
                    }
                    break;
            }
            var rotationOverLifetime = new Laya.RotationOverLifetime(angularVelocity);
            rotationOverLifetime.enable = rotationOverLifetimeData.enable;
            particleSystem.rotationOverLifetime = rotationOverLifetime;
        }
        var textureSheetAnimationData = data.textureSheetAnimation;
        if (textureSheetAnimationData) {
            var frameData = textureSheetAnimationData.frame;
            var frameOverTime;
            switch (frameData.type) {
                case 0:
                    frameOverTime = Laya.FrameOverTime.createByConstant(frameData.constant);
                    break;
                case 1:
                    frameOverTime = Laya.FrameOverTime.createByOverTime(_initParticleFrame(frameData.overTime));
                    break;
                case 2:
                    frameOverTime = Laya.FrameOverTime.createByRandomTwoConstant(frameData.constantMin, frameData.constantMax);
                    break;
                case 3:
                    frameOverTime = Laya.FrameOverTime.createByRandomTwoOverTime(_initParticleFrame(frameData.overTimeMin), _initParticleFrame(frameData.overTimeMax));
                    break;
            }
            var startFrameData = textureSheetAnimationData.startFrame;
            var startFrame;
            switch (startFrameData.type) {
                case 0:
                    startFrame = Laya.StartFrame.createByConstant(startFrameData.constant);
                    break;
                case 1:
                    startFrame = Laya.StartFrame.createByRandomTwoConstant(startFrameData.constantMin, startFrameData.constantMax);
                    break;
            }
            var textureSheetAnimation = new Laya.TextureSheetAnimation(frameOverTime, startFrame);
            textureSheetAnimation.enable = textureSheetAnimationData.enable;
            var tilesData = textureSheetAnimationData.tiles;
            textureSheetAnimation.tiles = new Laya.Vector2(tilesData[0], tilesData[1]);
            textureSheetAnimation.type = textureSheetAnimationData.type;
            textureSheetAnimation.randomRow = textureSheetAnimationData.randomRow;
            var rowIndex = textureSheetAnimationData.rowIndex;
            (rowIndex !== undefined) && (textureSheetAnimation.rowIndex = rowIndex);
            textureSheetAnimation.cycles = textureSheetAnimationData.cycles;
            particleSystem.textureSheetAnimation = textureSheetAnimation;
        }
    }
    function _initParticleColor(gradientColorData, maxkeyCount = 4) {
        var gradientColor = new Laya.Gradient();
        if (!gradientColorData) {
            gradientColor.addColorAlpha(0, 1);
            gradientColor.addColorAlpha(1, 1);
            gradientColor.addColorRGB(0, new Laya.Color(1.0, 1.0, 1.0, 1.0));
            gradientColor.addColorRGB(1, new Laya.Color(1.0, 1.0, 1.0, 1.0));
        }
        else {
            var alphasData = gradientColorData.alphas;
            var i, n;
            if (!alphasData) {
                gradientColor.addColorAlpha(0, 1);
                gradientColor.addColorAlpha(1, 1);
            }
            else {
                for (i = 0, n = alphasData.length; i < n; i++) {
                    if (i === maxkeyCount - 1 && n > maxkeyCount) {
                        i = n - 1;
                        console.warn(`GradientDataColor warning:alpha data length is large than ${maxkeyCount}, will ignore the middle data.`);
                    }
                    var alphaData = alphasData[i];
                    gradientColor.addColorAlpha(alphaData.key, alphaData.value);
                }
            }
            var rgbsData = gradientColorData.rgbs;
            if (!rgbsData) {
                gradientColor.addColorRGB(0, new Laya.Color(1.0, 1.0, 1.0, 1.0));
                gradientColor.addColorRGB(1, new Laya.Color(1.0, 1.0, 1.0, 1.0));
            }
            else {
                for (i = 0, n = rgbsData.length; i < n; i++) {
                    if (i === maxkeyCount - 1 && n > maxkeyCount) {
                        i = n - 1;
                        console.warn(`GradientDataColor warning:rgb data length is large than ${maxkeyCount}, will ignore the middle data.`);
                    }
                    var rgbData = rgbsData[i];
                    var rgbValue = rgbData.value;
                    gradientColor.addColorRGB(rgbData.key, new Laya.Color(rgbValue[0], rgbValue[1], rgbValue[2], 1.0));
                }
            }
        }
        return gradientColor;
    }
    function _initParticleFrame(overTimeFramesData) {
        var overTimeFrame = new Laya.GradientDataInt();
        if (overTimeFramesData) {
            var framesData = overTimeFramesData.frames;
            for (var i = 0, n = framesData.length; i < n; i++) {
                var frameData = framesData[i];
                overTimeFrame.add(frameData.key, frameData.value);
            }
        }
        else {
            overTimeFrame.add(0, 0);
            overTimeFrame.add(1, 1);
        }
        return overTimeFrame;
    }
    function _initStartLife(gradientData) {
        var gradient = new Laya.GradientDataNumber();
        var startLifetimesData = gradientData.startLifetimes;
        for (var i = 0, n = startLifetimesData.length; i < n; i++) {
            var valueData = startLifetimesData[i];
            gradient.add(valueData.key, valueData.value);
        }
        return gradient;
    }
    function _initParticleVelocity(gradientData) {
        var gradient = new Laya.GradientDataNumber();
        var velocitysData = gradientData.velocitys;
        for (var i = 0, n = velocitysData.length; i < n; i++) {
            var valueData = velocitysData[i];
            gradient.add(valueData.key, valueData.value);
        }
        return gradient;
    }
    function _initParticleSize(gradientSizeData) {
        var gradientSize = new Laya.GradientDataNumber();
        if (gradientSizeData) {
            var sizesData = gradientSizeData.sizes;
            for (var i = 0, n = sizesData.length; i < n; i++) {
                var valueData = sizesData[i];
                gradientSize.add(valueData.key, valueData.value);
            }
        }
        else {
            gradientSize.add(0, 0);
            gradientSize.add(1, 1);
        }
        return gradientSize;
    }
    function _initParticleRotation(gradientData) {
        var gradient = new Laya.GradientDataNumber();
        var angularVelocitysData = gradientData.angularVelocitys;
        for (var i = 0, n = angularVelocitysData.length; i < n; i++) {
            var valueData = angularVelocitysData[i];
            gradient.add(valueData.key, valueData.value / 180.0 * Math.PI);
        }
        return gradient;
    }
    function _parseModule(module, moduleData) {
        for (var t in moduleData) {
            switch (t) {
                case "bases":
                    var bases = moduleData.bases;
                    for (var k in bases)
                        module[k] = bases[k];
                    break;
                case "vector2s":
                    var vector2s = moduleData.vector2s;
                    for (var k in vector2s) {
                        var vec2 = module[k];
                        var vec2Data = vector2s[k];
                        vec2.setValue(vec2Data[0], vec2Data[1]);
                        module[k] = vec2;
                    }
                    break;
                case "vector3s":
                    var vector3s = moduleData.vector3s;
                    for (var k in vector3s) {
                        var vec3 = module[k];
                        var vec3Data = vector3s[k];
                        vec3.setValue(vec3Data[0], vec3Data[1], vec3Data[2]);
                        module[k] = vec3;
                    }
                    break;
                case "vector4s":
                    var vector4s = moduleData.vector4s;
                    for (var k in vector4s) {
                        var vec4 = module[k];
                        var vec4Data = vector4s[k];
                        vec4.setValue(vec4Data[0], vec4Data[1], vec4Data[2], vec4Data[3]);
                        module[k] = vec4;
                    }
                    break;
                case "gradientDataNumbers":
                    var gradientDataNumbers = moduleData.gradientDataNumbers;
                    for (var k in gradientDataNumbers) {
                        var gradientNumber = module[k];
                        var gradientNumberData = moduleData[k];
                        for (var i = 0, n = gradientNumberData.length; i < n; i++) {
                            var valueData = gradientNumberData[i];
                            gradientNumber.add(valueData.key, valueData.value);
                        }
                        module[k] = gradientNumber;
                    }
                    break;
                case "resources":
                    var resources = moduleData.resources;
                    for (var k in resources) {
                        let res = Laya.Loader.getRes(resources[k]);
                        if (res && (res instanceof Laya.Texture)) {
                            res = res.bitmap;
                        }
                        module[k] = res;
                    }
                    break;
                case "bursts":
                    var burstsData = moduleData.bursts;
                    for (var i = 0, n = burstsData.length; i < n; i++) {
                        var brust = burstsData[i];
                        module.addBurst(new Laya.Burst(brust.time, brust.min, brust.max));
                    }
                    break;
                case "randomSeed":
                    module.randomSeed[0] = moduleData.randomSeed;
                    break;
                case "shapeType":
                case "type":
                case "color":
                case "size":
                case "frame":
                case "startFrame":
                case "angularVelocity":
                case "velocity":
                    break;
                default:
                    throw "ShurikenParticle3D:unknown type.";
            }
        }
    }

    Laya.SimpleSkinnedMeshSprite3D && (function () {
        let old_parse = Laya.SimpleSkinnedMeshSprite3D.prototype._parse;
        Laya.SimpleSkinnedMeshSprite3D.prototype._parse = function (data, spriteMap) {
            old_parse.call(this, data, spriteMap);
            var render = this.simpleSkinnedMeshRenderer;
            var lightmapIndex = data.lightmapIndex;
            (lightmapIndex != null) && (render.lightmapIndex = lightmapIndex);
            var lightmapScaleOffsetArray = data.lightmapScaleOffset;
            (lightmapScaleOffsetArray) && (render.lightmapScaleOffset = new Laya.Vector4(lightmapScaleOffsetArray[0], lightmapScaleOffsetArray[1], lightmapScaleOffsetArray[2], lightmapScaleOffsetArray[3]));
            (data.enableRender != undefined) && (render.enabled = data.enableRender);
            (data.receiveShadows != undefined) && (render.receiveShadow = data.receiveShadows);
            (data.castShadow != undefined) && (render.castShadow = data.castShadow);
            let meshPath = data.meshPath;
            if (meshPath) {
                let mesh = Laya.Loader.getRes(meshPath);
                (mesh) && (this.meshFilter.sharedMesh = mesh);
            }
            var materials = data.materials;
            if (materials) {
                let sharedMaterials = render.sharedMaterials;
                let materialCount = materials.length;
                sharedMaterials.length = materialCount;
                for (let i = 0; i < materialCount; i++) {
                    sharedMaterials[i] = Laya.Loader.getRes(materials[i].path);
                }
                render.sharedMaterials = sharedMaterials;
            }
            var boundBox = data.boundBox;
            var min = boundBox.min;
            var max = boundBox.max;
            render.localBounds.setMin(new Laya.Vector3(min[0], min[1], min[2]));
            render.localBounds.setMax(new Laya.Vector3(max[0], max[1], max[2]));
            render.localBounds = render.localBounds;
            if (spriteMap) {
                let rootBoneData = data.rootBone;
                render.rootBone = spriteMap[rootBoneData];
                let bonesData = data.bones;
                for (let i = 0, n = bonesData.length; i < n; i++)
                    render.bones.push(spriteMap[bonesData[i]]);
                render.bones = render.bones;
                render._bonesNums = data.bonesNums ? data.bonesNums : render.bones.length;
            }
            var animatorTexture = data.animatorTexture;
            if (animatorTexture) {
                let animatortexture = Laya.Loader.getRes(animatorTexture, Laya.Loader.TEXTURE2D);
                render.simpleAnimatorTexture = animatortexture;
            }
        };
    })();

    Laya.SkinnedMeshSprite3D && (function () {
        let old_parse = Laya.SkinnedMeshSprite3D.prototype._parse;
        Laya.SkinnedMeshSprite3D.prototype._parse = function (data, spriteMap) {
            old_parse.call(this, data, spriteMap);
            var render = this.skinnedMeshRenderer;
            var lightmapIndex = data.lightmapIndex;
            (lightmapIndex != null) && (render.lightmapIndex = lightmapIndex);
            var lightmapScaleOffsetArray = data.lightmapScaleOffset;
            (lightmapScaleOffsetArray) && (render.lightmapScaleOffset = new Laya.Vector4(lightmapScaleOffsetArray[0], lightmapScaleOffsetArray[1], lightmapScaleOffsetArray[2], lightmapScaleOffsetArray[3]));
            (data.enableRender != undefined) && (render.enabled = data.enableRender);
            (data.receiveShadows != undefined) && (render.receiveShadow = data.receiveShadows);
            (data.castShadow != undefined) && (render.castShadow = data.castShadow);
            var meshPath;
            meshPath = data.meshPath;
            if (meshPath) {
                var mesh = Laya.Loader.getRes(meshPath);
                (mesh) && (this.meshFilter.sharedMesh = mesh);
            }
            var materials = data.materials;
            if (materials) {
                var sharedMaterials = render.sharedMaterials;
                var materialCount = materials.length;
                sharedMaterials.length = materialCount;
                for (var i = 0; i < materialCount; i++) {
                    sharedMaterials[i] = Laya.Loader.getRes(materials[i].path);
                }
                render.sharedMaterials = sharedMaterials;
            }
            var boundBox = data.boundBox;
            var min = boundBox.min;
            var max = boundBox.max;
            render.localBounds.setMin(new Laya.Vector3(min[0], min[1], min[2]));
            render.localBounds.setMax(new Laya.Vector3(max[0], max[1], max[2]));
            render.localBounds = render.localBounds;
            if (spriteMap) {
                var rootBoneData = data.rootBone;
                render.rootBone = spriteMap[rootBoneData];
                var bonesData = data.bones;
                var n;
                for (i = 0, n = bonesData.length; i < n; i++)
                    render.bones.push(spriteMap[bonesData[i]]);
                render.bones = render.bones;
            }
        };
    })();

    Laya.SpotLightCom && (function () {
        let old_parse = Laya.SpotLightCom.prototype._parse;
        Laya.SpotLightCom.prototype._parse = function (data, spriteMap) {
            old_parse.call(this, data, spriteMap);
            this.range = data.range;
            this.spotAngle = data.spotAngle;
        };
    })();

    Laya.Sprite3D && (function () {
        Laya.Sprite3D.prototype._parse = function (data, spriteMap) {
            (data.isStatic !== undefined) && (this.isStatic = data.isStatic);
            (data.active !== undefined) && (this.active = data.active);
            (data.name != undefined) && (this.name = data.name);
            (data.tag != undefined) && (this.tag = data.tag);
            if (data.position !== undefined) {
                var loccalPosition = this.transform.localPosition;
                loccalPosition.fromArray(data.position);
                this.transform.localPosition = loccalPosition;
            }
            if (data.rotationEuler !== undefined) {
                var localRotationEuler = this.transform.localRotationEuler;
                localRotationEuler.fromArray(data.rotationEuler);
                this.transform.localRotationEuler = localRotationEuler;
            }
            if (data.rotation !== undefined) {
                var localRotation = this.transform.localRotation;
                localRotation.fromArray(data.rotation);
                this.transform.localRotation = localRotation;
            }
            if (data.scale !== undefined) {
                var localScale = this.transform.localScale;
                localScale.fromArray(data.scale);
                this.transform.localScale = localScale;
            }
            (data.layer != undefined) && (this.layer = data.layer);
        };
    })();

    Laya.TrailRenderer && (function () {
        Laya.TrailRenderer.prototype._parse = function (data, spriteMap) {
            var filter = this._trailFilter;
            var i, j;
            var materials = data.materials;
            if (materials) {
                var sharedMaterials = this.sharedMaterials;
                var materialCount = materials.length;
                sharedMaterials.length = materialCount;
                for (i = 0; i < materialCount; i++)
                    sharedMaterials[i] = Laya.Loader.getRes(materials[i].path);
                this.sharedMaterials = sharedMaterials;
            }
            filter.time = data.time;
            filter.minVertexDistance = data.minVertexDistance;
            filter.widthMultiplier = data.widthMultiplier;
            filter.textureMode = data.textureMode;
            (data.alignment != null) && (filter.alignment = data.alignment);
            var widthCurve = [];
            var widthCurveData = data.widthCurve;
            for (i = 0, j = widthCurveData.length; i < j; i++) {
                var trailkeyframe = new Laya.FloatKeyframe();
                trailkeyframe.time = widthCurveData[i].time;
                trailkeyframe.inTangent = widthCurveData[i].inTangent;
                trailkeyframe.outTangent = widthCurveData[i].outTangent;
                trailkeyframe.value = widthCurveData[i].value;
                widthCurve.push(trailkeyframe);
            }
            filter.widthCurve = widthCurve;
            var colorGradientData = data.colorGradient;
            var colorKeys = colorGradientData.colorKeys;
            var alphaKeys = colorGradientData.alphaKeys;
            var colorGradient = new Laya.Gradient();
            colorGradient.mode = colorGradientData.mode;
            for (i = 0, j = colorKeys.length; i < j; i++) {
                var colorKey = colorKeys[i];
                colorGradient.addColorRGB(colorKey.time, new Laya.Color(colorKey.value[0], colorKey.value[1], colorKey.value[2], 1.0));
            }
            for (i = 0, j = alphaKeys.length; i < j; i++) {
                var alphaKey = alphaKeys[i];
                colorGradient.addColorAlpha(alphaKey.time, alphaKey.value);
            }
            filter.colorGradient = colorGradient;
        };
    })();

    exports.HierarchyParserV2 = HierarchyParserV2;
    exports.LegacyUIParser = LegacyUIParser;

})(window.Laya = window.Laya || {}, Laya);
//# sourceMappingURL=laya.legacyParser.js.map
