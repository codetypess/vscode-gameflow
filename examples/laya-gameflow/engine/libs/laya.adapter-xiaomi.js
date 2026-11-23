(function (exports, Laya) {
    'use strict';

    function ImageDataPolyfill() {
        let width, height, data;
        if (arguments.length == 3) {
            if (arguments[0] instanceof Uint8ClampedArray) {
                if (arguments[0].length % 4 !== 0) {
                    throw new Error("Failed to construct 'ImageData': The input data length is not a multiple of 4.");
                }
                if (arguments[0].length !== arguments[1] * arguments[2] * 4) {
                    throw new Error("Failed to construct 'ImageData': The input data length is not equal to (4 * width * height).");
                }
                else {
                    data = arguments[0];
                    width = arguments[1];
                    height = arguments[2];
                }
            }
            else {
                throw new Error("Failed to construct 'ImageData': parameter 1 is not of type 'Uint8ClampedArray'.");
            }
        }
        else if (arguments.length == 2) {
            width = arguments[0];
            height = arguments[1];
            data = new Uint8ClampedArray(arguments[0] * arguments[1] * 4);
        }
        else if (arguments.length < 2) {
            throw new Error("Failed to construct 'ImageData': 2 arguments required, but only " + arguments.length + " present.");
        }
        let imgdata = Laya.Browser.canvas.context.getImageData(0, 0, width, height);
        let arr = imgdata.data;
        for (let i = 0, n = data.length; i < n; i++)
            arr[i] = data[i];
        return imgdata;
    }
    if (!window.ImageData) {
        window.ImageData = ImageDataPolyfill;
    }

    const GROUP_COUNT = 5;
    class MgCacheManager {
        constructor(cacheRoot) {
            this.totalFileSize = 0;
            this.running = false;
            this.lastGroup = -1;
            this.lastGroupUsed = 0;
            this.toClear = 0;
            this.cacheRoot = cacheRoot;
            this.fileCache = new Map();
            this.cacheGroups = new Array(GROUP_COUNT);
            this.cacheGroups.fill(0);
            this.cacheRequest = [];
            this.toSaveManifestFlags = new Array(GROUP_COUNT);
        }
        start() {
            this.checkAndDeleteOldCacheDir();
            return this.createCacheDirs().then(() => this.loadAllManifests()).then(() => {
                Laya.ILaya.systemTimer.loop(MgCacheManager.processInterval, this, this.process);
            });
        }
        getFile(url) {
            let info = this.fileCache.get(url);
            if (!info)
                return Promise.resolve(null);
            info.accessTime = this.toSaveManifestRequest = performance.now();
            this.toSaveManifestFlags[info.group] = true;
            let cacheFilePath = `${this.cacheRoot}/${info.group}/${info.fileName}`;
            return Laya.PAL.fs.exists(cacheFilePath).then(exists => exists ? cacheFilePath : null);
        }
        addFile(url, tempFilePath) {
            Laya.PAL.fs.getFileSize(tempFilePath).then(size => this.cacheRequest.push({ url, tempFilePath, size }))
                .catch(err => {
                console.warn("[Cache]get file size error", Laya.getErrorMsg(err));
            });
        }
        clearAllCache() {
            this.toClear = 2;
        }
        process() {
            if (this.running)
                return;
            if (this.toClear != 0) {
                this.running = true;
                let clearFlag = this.toClear;
                this.toClear = 0;
                if ((clearFlag & 2) !== 0)
                    this.doClearAllCache().then(() => this.running = false);
                else
                    this.clearSpace(0).then(() => this.saveDirtyManifests()).then(() => this.running = false);
                return;
            }
            if (this.cacheRequest.length === 0) {
                if (this.toSaveManifestRequest != null && performance.now() - this.toSaveManifestRequest > MgCacheManager.saveAccessTimeInterval) {
                    this.toSaveManifestRequest = null;
                    this.running = true;
                    this.saveDirtyManifests().then(() => this.running = false);
                }
                return;
            }
            this.running = true;
            let files = this.cacheRequest.concat();
            this.cacheRequest.length = 0;
            let group = this.selectGroup(files.length);
            let needSpace = 0;
            for (let info of files)
                needSpace += info.size;
            let toClearSpace = this.totalFileSize + needSpace - MgCacheManager.spaceLimit;
            this.clearSpace(toClearSpace)
                .then(() => this.addFilesToCache(files, group))
                .then(() => this.saveDirtyManifests())
                .then(() => this.running = false);
        }
        selectGroup(fileCount) {
            if (this.lastGroup >= 0 && this.lastGroupUsed < 50) {
                this.lastGroupUsed += fileCount;
                return this.lastGroup;
            }
            let min = Number.MAX_VALUE;
            let j;
            for (let i = 0; i < GROUP_COUNT; i++) {
                if (this.cacheGroups[i] < min - 50) {
                    min = this.cacheGroups[i];
                    j = i;
                }
            }
            this.lastGroup = j;
            this.lastGroupUsed = fileCount;
            return j;
        }
        addFilesToCache(files, group) {
            for (let { url, tempFilePath, size } of files) {
                let info = this.fileCache.get(url);
                if (info) {
                    this.cacheGroups[info.group]--;
                    this.totalFileSize -= info.size;
                    this.fileCache.delete(url);
                    info.accessTime = performance.now();
                    info.size = size;
                }
                else {
                    info = {
                        group,
                        url,
                        size,
                        fileName: Laya.Utils.getBaseName(tempFilePath),
                        accessTime: performance.now()
                    };
                }
                this.fileCache.set(url, info);
                this.cacheGroups[info.group]++;
                this.totalFileSize += size;
            }
            return this.saveManifest(group).then(success => {
                if (!success)
                    return;
                return Laya.Utils.runTasks(files, 5, ({ url, tempFilePath }) => {
                    let info = this.fileCache.get(url);
                    let saveFilePath = `${this.cacheRoot}/${group}/${info.fileName}`;
                    return Laya.PAL.fs.copyFile(tempFilePath, saveFilePath)
                        .catch(err => {
                        let msg = Laya.getErrorMsg(err);
                        console.warn("[Cache]create cache file", msg);
                        if (msg.indexOf("the maximum size of the file storage") !== -1) {
                            this.toClear |= 1;
                        }
                    });
                });
            });
        }
        clearSpace(sizeToClear) {
            if (sizeToClear < 0)
                return Promise.resolve();
            sizeToClear += MgCacheManager.minClearSpace;
            let allFiles = Array.from(this.fileCache.values());
            allFiles.sort((a, b) => a.accessTime - b.accessTime);
            let t = performance.now();
            let info = [0, 0];
            return this.doClearSpace(allFiles, sizeToClear, 0, info).then(() => {
                console.log(`[Cache]cleared ${info[0]} files/${info[1]} bytes in ${performance.now() - t}ms`);
            });
        }
        doClearSpace(allFiles, sizeToClear, round, outInfo) {
            let sizeCleared = 0;
            let i = 0;
            let n = allFiles.length;
            for (; i < n; i++) {
                let info = allFiles[i];
                sizeCleared += info.size;
                if (sizeCleared >= sizeToClear)
                    break;
            }
            let arr = allFiles.splice(0, i + 1);
            sizeCleared = 0;
            return Laya.Utils.runTasks(arr, 20, (info) => {
                this.fileCache.delete(info.url);
                this.totalFileSize -= info.size;
                this.cacheGroups[info.group]--;
                this.toSaveManifestFlags[info.group] = true;
                let fielName = `${this.cacheRoot}/${info.group}/${info.fileName}`;
                return Laya.PAL.fs.unlink(fielName).then(() => {
                    sizeCleared += info.size;
                }).catch(err => {
                    let msg = Laya.getErrorMsg(err);
                    if (msg.indexOf("no such file") === -1)
                        console.error("[Cache]delete cache file", msg);
                });
            }).then(() => {
                outInfo[0] += arr.length;
                outInfo[1] += sizeCleared;
                if (sizeCleared < sizeToClear && allFiles.length > 0 && round < 10)
                    return this.doClearSpace(allFiles, sizeToClear - sizeCleared, ++round, outInfo);
                else
                    return null;
            });
        }
        doClearAllCache() {
            return Laya.PAL.fs.rmdir(this.cacheRoot, { recursive: true }).catch(err => {
                console.warn("[Cache]failed to delete cache folder", Laya.getErrorMsg(err));
            }).then(() => this.createCacheDirs()).then(() => {
                this.fileCache.clear();
                this.cacheGroups.fill(0);
                this.totalFileSize = 0;
                this.toSaveManifestFlags.fill(false);
            });
        }
        loadAllManifests() {
            return Laya.PAL.fs.readdir(this.cacheRoot).then(files => {
                return Promise.all(files.map(fileName => {
                    if (fileName.startsWith("manifest-")) {
                        let group = parseInt(fileName.substring(9, fileName.length - 4));
                        if (!isNaN(group) && group >= 0 && group < GROUP_COUNT) {
                            return this.loadManifest(group);
                        }
                    }
                    return Promise.resolve();
                }));
            });
        }
        loadManifest(group) {
            return Laya.PAL.fs.readFile(`${this.cacheRoot}/manifest-${group}.bin`).then((data) => {
                let bytes = new Laya.Byte(data);
                bytes.readInt16();
                let url;
                let fileName;
                let accessTime;
                let size;
                let fileCnt = 0;
                let bytesTotal = 0;
                while (bytes.bytesAvailable > 0) {
                    let pos = bytes.pos;
                    let len = bytes.readUint32();
                    url = bytes.readUTFString();
                    fileName = bytes.readUTFString();
                    accessTime = bytes.readUint32();
                    size = bytes.readUint32();
                    bytes.pos = pos + len;
                    let info = {
                        group,
                        url,
                        fileName,
                        accessTime,
                        size
                    };
                    this.fileCache.set(url, info);
                    bytesTotal += size;
                    fileCnt++;
                }
                this.cacheGroups[group] = fileCnt;
                this.totalFileSize += bytesTotal;
                console.log(`[Cache]load manifest-${group} ${fileCnt}(files)/${bytesTotal}(bytes)`);
            }).catch(err => {
                console.error(`[Cache]load manifest-${group}`, Laya.getErrorMsg(err));
            });
        }
        saveDirtyManifests() {
            const tasks = [];
            this.toSaveManifestFlags.forEach((needSave, group) => {
                if (needSave)
                    tasks.push(this.saveManifest(group));
            });
            return Promise.all(tasks);
        }
        saveManifest(group) {
            let bytes = new Laya.Byte();
            bytes.writeInt16(1);
            let fileCnt = 0;
            let bytesTotal = 0;
            for (let info of this.fileCache.values()) {
                if (info.group === group) {
                    let pos = bytes.pos;
                    bytes.writeUint32(0);
                    bytes.writeUTFString(info.url);
                    bytes.writeUTFString(info.fileName);
                    bytes.writeUint32(info.accessTime);
                    bytes.writeUint32(info.size);
                    let writePos = pos;
                    pos = bytes.pos;
                    bytes.pos = writePos;
                    bytes.writeUint32(pos - writePos);
                    bytes.pos = pos;
                    fileCnt++;
                    bytesTotal += info.size;
                }
            }
            return Laya.PAL.fs.writeFile(`${this.cacheRoot}/manifest-${group}.bin`, bytes.buffer).then(() => {
                this.toSaveManifestFlags[group] = false;
                console.log(`[Cache]save manifest-${group} ${fileCnt}(files)/${bytesTotal}(bytes)`);
                return true;
            }).catch(err => {
                let msg = Laya.getErrorMsg(err);
                console.error(`[Cache]save manifest-${group}`, msg);
                if (msg.indexOf("the maximum size of the file storage") !== -1) {
                    this.toClear |= 1;
                }
                return false;
            });
        }
        createCacheDirs() {
            return Promise.all(this.cacheGroups.map((_, index) => {
                let path = `${this.cacheRoot}/${index}`;
                return Laya.PAL.fs.exists(path).then(exists => {
                    if (!exists)
                        return Laya.PAL.fs.mkdir(path, { recursive: true }).catch(err => {
                            console.error("[Cache]failed to create cache dir", Laya.getErrorMsg(err));
                        });
                    else
                        return Promise.resolve();
                });
            }));
        }
        checkAndDeleteOldCacheDir() {
            let oldCacheDir = this.cacheRoot.substring(0, this.cacheRoot.lastIndexOf("/")) + "/layaairGame";
            return Laya.PAL.fs.exists(oldCacheDir).then(oldExists => {
                if (oldExists) {
                    console.log("[Cache]delete old cache folder");
                    return Laya.PAL.fs.rmdir(oldCacheDir, { recursive: true }).catch(err => {
                        console.warn("[Cache]failed to delete old cache folder", Laya.getErrorMsg(err));
                    });
                }
                else
                    return Promise.resolve();
            });
        }
    }
    MgCacheManager.minClearSpace = (5 * 1024 * 1024);
    MgCacheManager.spaceLimit = (200 * 1024 * 1024);
    MgCacheManager.processInterval = 2000;
    MgCacheManager.saveAccessTimeInterval = 15000;

    class MgDownloader extends Laya.Downloader {
        constructor(enableCache = true) {
            super();
            this.escapeZhCharsInURL = true;
            this.supportSubPackageMultiLevelFolders = true;
            let old = Laya.URL.postFormatURL;
            Laya.URL.postFormatURL = url => {
                url = this.checkSubpackagePrefix(url);
                return old.call(this, url);
            };
            if (Laya.Browser.onVVMiniGame || Laya.Browser.onQGMiniGame || Laya.Browser.onTBMiniGame)
                this.supportSubPackageMultiLevelFolders = false;
            if (Laya.Browser.onWXMiniGame || Laya.Browser.onHWMiniGame || Laya.Browser.onTTMiniGame)
                this.escapeZhCharsInURL = false;
            if (enableCache) {
                let cacheRoot;
                if (Laya.Browser.onVVMiniGame)
                    cacheRoot = "internal://files/layaCache";
                else
                    cacheRoot = Laya.PAL.g.env.USER_DATA_PATH + "/layaCache";
                this.cacheManager = new MgCacheManager(cacheRoot);
            }
        }
        common(owner, url, originalUrl, contentType, onProgress, onComplete) {
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                if (contentType === "filePath")
                    onComplete(url);
                else
                    this.readFile(url, contentType, onComplete);
                return;
            }
            Promise.resolve().then(() => {
                if (this.cacheManager)
                    return this.cacheManager.getFile(url);
                else
                    return Promise.resolve(null);
            }).then(cacheFilePath => {
                if (cacheFilePath) {
                    if (contentType === "filePath")
                        onComplete(cacheFilePath);
                    else
                        this.readFile(cacheFilePath, contentType, onComplete);
                }
                else {
                    this.downloadFile(url, onProgress, (filePath, error) => {
                        if (filePath) {
                            if (contentType === "filePath")
                                onComplete(filePath);
                            else
                                this.readFile(filePath, contentType, onComplete);
                        }
                        else
                            onComplete(null, error);
                    });
                }
            });
        }
        image(owner, url, originalUrl, onProgress, onComplete) {
            let skipCache = false;
            if (Laya.Browser.onTBMiniGame) {
                if (window.__NOT_TBMINIGAME__ !== undefined) {
                    skipCache = window.__NOT_TBMINIGAME__;
                }
            }
            if (skipCache) {
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    super.image(owner, url, originalUrl, onProgress, onComplete);
                }
                else {
                    super.image(owner, this.escapeURL(url), originalUrl, onProgress, onComplete);
                }
                return;
            }
            if (!url.startsWith("http://") && !url.startsWith("https://") || !this.cacheManager) {
                super.image(owner, this.escapeURL(url), originalUrl, onProgress, onComplete);
                return;
            }
            this.cacheManager.getFile(url).then(cacheFilePath => {
                if (cacheFilePath)
                    super.image(owner, this.encodeLocalPath(cacheFilePath), originalUrl, onProgress, onComplete);
                else {
                    this.downloadFile(url, onProgress, (filePath, error) => {
                        if (filePath)
                            super.image(owner, this.encodeLocalPath(filePath), originalUrl, onProgress, onComplete);
                        else
                            onComplete(null, error);
                    });
                }
            });
        }
        encodeLocalPath(path) {
            return path;
        }
        package(path, onProgress, onComplete) {
            let packageName = path;
            if (!this.supportSubPackageMultiLevelFolders) {
                packageName = path.replace(/\//g, ".");
                if (!Laya.Browser.onVVMiniGame && packageName !== path) {
                    if (!this.subPackages)
                        this.subPackages = {};
                    this.subPackages[path] = packageName;
                }
            }
            let loadSubpackageParams = {
                success: () => {
                    onComplete({ loadScript: false });
                },
                fail: (err) => {
                    onComplete({ loadScript: false }, Laya.getErrorMsg(err));
                },
                complete: null
            };
            if (Laya.Browser.onHWMiniGame) {
                loadSubpackageParams.subpackage = packageName;
            }
            else {
                loadSubpackageParams.name = packageName;
            }
            let loadTask = Laya.PAL.g.loadSubpackage(loadSubpackageParams);
            onProgress && loadTask.onProgressUpdate && loadTask.onProgressUpdate(res => onProgress(res.progress));
        }
        downloadFile(url, onProgress, onComplete) {
            let task = Laya.PAL.g.downloadFile({
                url: this.escapeURL(url),
                success: (res) => {
                    if (res.statusCode == null || res.statusCode === 200) {
                        let filePath = res.tempFilePath || res.apFilePath;
                        if (this.cacheManager && url.indexOf("?v=") === -1)
                            this.cacheManager.addFile(url, filePath);
                        onComplete(filePath);
                    }
                    else {
                        onComplete(null, Laya.getErrorMsg(res));
                    }
                },
                fail: (err) => onComplete(null, Laya.getErrorMsg(err))
            });
            if (onProgress && task && task.onProgressUpdate) {
                task.onProgressUpdate((res) => {
                    onProgress(res.progress);
                });
            }
        }
        readFile(url, contentType, onComplete) {
            let filePath = this.urlToFilePath(url);
            Laya.PAL.fs.readFile(filePath, contentType === "arraybuffer" ? null : "utf8").then(data => {
                switch (contentType) {
                    case "json":
                        onComplete(JSON.parse(data));
                        break;
                    case "xml":
                        onComplete(new Laya.XML(data));
                        break;
                    default:
                        onComplete(data);
                        break;
                }
            }).catch(err => onComplete(null, Laya.getErrorMsg(err)));
        }
        urlToFilePath(url) {
            let i = url.lastIndexOf("?");
            if (i != -1)
                return url.substring(0, i);
            else
                return url;
        }
        checkSubpackagePrefix(url) {
            if (!this.supportSubPackageMultiLevelFolders && this.subPackages) {
                for (let k in this.subPackages) {
                    if (url.startsWith(k)) {
                        url = this.subPackages[k] + url.substring(k.length);
                        break;
                    }
                }
            }
            return url;
        }
        escapeURL(url) {
            if (!this.escapeZhCharsInURL)
                return url;
            let str = "";
            let len = url.length;
            for (let i = 0; i < len; i++) {
                let word = url[i];
                if (IGNORE.test(word)) {
                    str += word;
                }
                else {
                    try {
                        str += encodeURI(word);
                    }
                    catch (e) {
                        console.warn("errorInfo", ">>>" + word);
                    }
                }
            }
            return str;
        }
    }
    const IGNORE = new RegExp("[-_.!~*'();/?:@&=+$,#%]|[0-9|A-Z|a-z]");

    class MgWebSocket {
        open(url, options) {
            let failed = false;
            this.ws = Laya.PAL.g.connectSocket(Object.assign({
                url,
                multiple: true,
                fail: (err) => {
                    failed = true;
                    this.onError(err);
                }
            }, options));
            if (this.ws == null || failed) {
                this.ws = null;
                return;
            }
            this.ws.onOpen(res => this.onOpen(res));
            this.ws.onClose((res) => this.onClose(res === null || res === void 0 ? void 0 : res.code, res === null || res === void 0 ? void 0 : res.reason));
            this.ws.onError(err => this.onError(err));
            this.ws.onMessage(msg => {
                if (msg.data) {
                    var data = msg.data;
                    if (data.isBuffer) {
                        data = this.base64ToArrayBuffer(data.data);
                    }
                    this.onMessage(data);
                }
            });
        }
        base64ToArrayBuffer(base64) {
            const binary = atob(base64);
            const len = binary.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return bytes.buffer;
        }
        close() {
            if (this.ws)
                this.ws.close({});
        }
        send(data) {
            if (this.ws == null)
                return Promise.reject("WebSocket is not open");
            return new Promise((resolve, reject) => {
                this.ws.send({
                    data,
                    success: () => resolve(),
                    fail: (e) => reject(e)
                });
            });
        }
    }

    class MgBrowserAdapter extends Laya.BrowserAdapter {
        constructor() {
            super(...arguments);
            this._visible = true;
            this._orientation = "portrait-primary";
        }
        registerWheelEvent(handler) {
            if (!Laya.Browser.onTTMiniGame && !Laya.Browser.onWXMiniGame)
                return false;
            const win = Laya.Browser.window;
            const candidates = [win.tt, win.wx, Laya.PAL.g];
            let source = null;
            for (const candidate of candidates) {
                if (candidate && Laya.PAL.hasAPI(candidate, "onWheel") && typeof candidate.onWheel === "function") {
                    source = candidate;
                    break;
                }
            }
            if (!source) {
                Laya.PAL.warnIncompatibility("onWheel");
                return false;
            }
            try {
                source.onWheel((result) => {
                    try {
                        handler(toWheelEvent(result));
                    }
                    catch (error) {
                        console.error("Invalid mini-game wheel event", error);
                    }
                });
                return true;
            }
            catch (error) {
                console.error("Failed to register mini-game wheel input", error);
                return false;
            }
        }
        registerKeyEvent(handler) {
            if (!Laya.Browser.onTTMiniGame && !Laya.Browser.onWXMiniGame)
                return false;
            const win = Laya.Browser.window;
            const candidates = [win.tt, win.wx, Laya.PAL.g];
            let source = null;
            for (const candidate of candidates) {
                if (candidate
                    && typeof candidate.onKeyDown === "function"
                    && typeof candidate.onKeyUp === "function") {
                    source = candidate;
                    break;
                }
            }
            if (!source) {
                Laya.PAL.warnIncompatibility("onKeyDown/onKeyUp");
                return false;
            }
            const pressedModifiers = new Set();
            const clearModifiers = () => pressedModifiers.clear();
            if (typeof win.addEventListener === "function")
                win.addEventListener("blur", clearModifiers);
            if (Laya.PAL.g && typeof Laya.PAL.g.onHide === "function")
                Laya.PAL.g.onHide(clearModifiers);
            try {
                source.onKeyDown((result) => {
                    try {
                        handler(toKeyEvent("keydown", result, pressedModifiers));
                    }
                    catch (error) {
                        console.error("Invalid mini-game keydown event", error);
                    }
                });
                source.onKeyUp((result) => {
                    try {
                        handler(toKeyEvent("keyup", result, pressedModifiers));
                    }
                    catch (error) {
                        console.error("Invalid mini-game keyup event", error);
                    }
                });
                return true;
            }
            catch (error) {
                console.error("Failed to register mini-game keyboard input", error);
                return false;
            }
        }
        init() {
            var _a;
            if (!console.time) {
                console.time = function (name) {
                };
                console.timeEnd = function (name) {
                    console.log(name);
                };
            }
            Laya.Browser.isDomSupported = false;
            (_a = MgBrowserAdapter.beforeInit) === null || _a === void 0 ? void 0 : _a.call(MgBrowserAdapter);
            this._supportSetCursor = Laya.PAL.hasAPI("setCursor");
            this._supportCreateArrayBufferURL = Laya.PAL.hasAPI("createBufferURL");
            if (Laya.PAL.hasAPI("connectSocket"))
                this.webSocketClass = MgWebSocket;
            else
                this.webSocketClass = null;
            let platform = "";
            let systemName = "";
            let systemInfo = Laya.PAL.hasAPI("getSystemInfoSync") ? Laya.PAL.g.getSystemInfoSync() : null;
            if (systemInfo) {
                this._pixelRatio = systemInfo.pixelRatio;
                this._orientation = systemInfo.deviceOrientation === "landscape" ? "landscape-primary" : "portrait-primary";
                platform = systemInfo.platform || "";
                systemName = systemInfo.system || "";
            }
            else if (Laya.PAL.hasAPI("getWindowInfo")) {
                let windowInfo = Laya.PAL.g.getWindowInfo();
                this._pixelRatio = windowInfo.pixelRatio;
                if (Laya.PAL.g.getDeviceInfo) {
                    let deviceInfo = Laya.PAL.g.getDeviceInfo();
                    platform = deviceInfo.platform || "";
                    systemName = deviceInfo.system || "";
                }
            }
            if (Laya.Browser.onVVMiniGame || Laya.Browser.onQGMiniGame) {
                this._pixelRatio = window.devicePixelRatio;
            }
            this.setPlatform("", this.normalizePlatform(platform, systemName));
            systemInfo = systemInfo || {};
            const { SDKVersion } = (Laya.PAL.hasAPI("getAppBaseInfo") ? Laya.PAL.g.getAppBaseInfo() : null) || systemInfo;
            Laya.Browser.SDKVersion = SDKVersion || "";
            const { system } = (Laya.PAL.hasAPI("getDeviceInfo") ? Laya.PAL.g.getDeviceInfo() : null) || systemInfo;
            const systemVersionArr = system ? system.split(' ') : [];
            Laya.Browser.systemVersion = systemVersionArr.length ? systemVersionArr[systemVersionArr.length - 1] : '';
            if (Laya.Browser.onHWMiniGame) {
                this._pixelRatio = 1;
            }
            else {
                if (this._pixelRatio === 1 && Laya.Browser.onPC && !Laya.Browser.onDevTools)
                    this._pixelRatio = 2;
            }
            Laya.PAL.g.onShow && Laya.PAL.g.onShow(() => {
                this._visible = true;
                this.event(Laya.Event.VISIBILITY_CHANGE, true);
                this.event(Laya.Event.FOCUS);
            });
            Laya.PAL.g.onHide && Laya.PAL.g.onHide(() => {
                this._visible = false;
                this.event(Laya.Event.VISIBILITY_CHANGE, false);
                this.event(Laya.Event.BLUR);
            });
            if (Laya.PAL.hasAPI("onWindowResize")) {
                Laya.PAL.g.onWindowResize(result => {
                    let info = Laya.PAL.hasAPI("getWindowInfo") ? Laya.PAL.g.getWindowInfo()
                        : (Laya.PAL.hasAPI("getSystemInfoSync") ? Laya.PAL.g.getSystemInfoSync() : null);
                    let w = result ? result.windowWidth : 0;
                    let h = result ? result.windowHeight : 0;
                    if ((!w || !h) && info) {
                        w = info.windowWidth;
                        h = info.windowHeight;
                    }
                    if (w && h) {
                        window.innerWidth = w;
                        window.innerHeight = h;
                    }
                    this.event(Laya.Event.RESIZE);
                });
            }
        }
        start() {
            var _a;
            let downloader = Laya.Loader.downloader = new MgBrowserAdapter.downloaderClass(Laya.PAL.hasAPI("getFileSystemManager") && Laya.PAL.hasAPI(Laya.PAL.g.getFileSystemManager(), "writeFile") && Laya.PAL.hasAPI(Laya.PAL.g.getFileSystemManager(), "readdir"));
            this.setupWasmSupport();
            (_a = MgBrowserAdapter.afterInit) === null || _a === void 0 ? void 0 : _a.call(MgBrowserAdapter);
            if (downloader.cacheManager)
                return downloader.cacheManager.start();
            else
                return Promise.resolve();
        }
        onInitRender() {
            if (Laya.Browser.onTBMiniGame && !Laya.Browser.isIOSHighPerformanceMode) {
                Laya.LayaGL.renderEngine._supportCapatable.turnOffSRGB();
            }
            if (Laya.Browser.onAlipayMiniGame) {
                Laya.LayaGL.renderEngine._supportCapatable.turnOffSRGB();
                Laya.LayaGL.renderEngine._supportCapatable.turnOffCapableAndExtension(Laya.RenderCapable.MSAA, null);
            }
            if (Laya.Browser.onTBMiniGame) {
                if (!Laya.PAL.g.isIDE) {
                    let gl = Laya.LayaGL.renderEngine._context;
                    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
                }
            }
            if (Laya.Browser.onHWMiniGame) {
                Laya.LayaGL.textureContext.needBitmap = false;
            }
        }
        setupWasmSupport() {
            let wasmGlobal;
            if (Laya.Browser.onWXMiniGame)
                wasmGlobal = window.WXWebAssembly;
            else if (Laya.Browser.onAlipayMiniGame)
                wasmGlobal = window.MYWebAssembly;
            else if (Laya.Browser.onTTMiniGame)
                wasmGlobal = window.TTWebAssembly;
            else if (Laya.Browser.onHWMiniGame)
                wasmGlobal = window.qg;
            if (wasmGlobal) {
                if (!window.WebAssembly) {
                    try {
                        window.WebAssembly = { Memory: wasmGlobal.Memory };
                    }
                    catch (e) {
                    }
                }
                Laya.WasmAdapter.Memory = wasmGlobal.Memory;
                Laya.WasmAdapter.instantiateWasm = (wasmFile, imports) => {
                    wasmFile = Laya.WasmAdapter.locateFileDefault(wasmFile);
                    return wasmGlobal.instantiate(wasmFile, imports);
                };
            }
            else if (window.WebAssembly) {
                let shouldInit = Laya.PAL.g.setWasmTaskCompile != null;
                Laya.WasmAdapter.instantiateWasm = (wasmFile, imports) => {
                    wasmFile = Laya.WasmAdapter.locateFileDefault(wasmFile);
                    return Laya.Laya.loader.fetch(wasmFile, "arraybuffer").then(data => {
                        if (data) {
                            if (shouldInit) {
                                shouldInit = false;
                                Laya.PAL.g.setWasmTaskCompile(true);
                            }
                            return window.WebAssembly.instantiate(data, imports);
                        }
                        else {
                            console.error("WASM file not found: " + wasmFile);
                            return null;
                        }
                    });
                };
            }
        }
        getVisibility() {
            return this._visible;
        }
        getScreenOrientation() {
            return this._orientation;
        }
        createMainCanvas() {
            let canvas;
            if (Laya.Browser.onTBMiniGame) {
                canvas = window.screencanvas
                    || window.canvas.getRealCanvas();
            }
            else {
                canvas = window.canvas || window.__canvas;
            }
            canvas.id = "layaCanvas";
            return canvas;
        }
        createElement(tagName) {
            var _a;
            let ele;
            if (tagName === "canvas" && typeof (Laya.PAL.g.createCanvas) === "function") {
                if (Laya.Browser.onTBMiniGame && window.__NOT_TBMINIGAME__) {
                    ele = window.canvas.getRealCanvas();
                }
                else {
                    ele = Laya.PAL.g.createCanvas();
                }
            }
            else {
                ele = super.createElement(tagName);
            }
            if (!ele.style)
                ele.style = {};
            else if (ele.style === ((_a = window.canvas) === null || _a === void 0 ? void 0 : _a.style))
                ele.style = {};
            return ele;
        }
        getElementById(id) {
            if (window.document.getElementById) {
                return window.document.getElementById(id);
            }
            else {
                Laya.PAL.warnIncompatibility("getElementById");
                return null;
            }
        }
        removeElement(ele) {
            if (ele.remove) {
                ele.remove();
            }
            else if (ele.dispose) {
                ele.dispose();
            }
            else {
                ele = null;
            }
        }
        setCursor(cursor) {
            if (!this._supportSetCursor)
                return;
            let arr = cursor.split(" ");
            let x = arr[1] ? parseInt(arr[1].trim()) : 0;
            let y = arr[2] ? parseInt(arr[2].trim()) : 0;
            let i = arr[0].indexOf("url(");
            if (i != -1) {
                let j = arr[0].indexOf(")");
                if (j != -1)
                    arr[0] = arr[0].substring(i + 4, j);
            }
            if (isNaN(x) || isNaN(y))
                x = y = undefined;
            Laya.PAL.g.setCursor(arr[0], x, y);
        }
        get supportArrayBufferURL() {
            return this._supportCreateArrayBufferURL;
        }
        createBufferURL(data) {
            if (!this.supportArrayBufferURL)
                return null;
            return Laya.PAL.g.createBufferURL(data);
        }
        revokeBufferURL(url) {
            return Laya.PAL.g.revokeBufferURL(url);
        }
        getOpenDataContextCanvas() {
            return window.sharedCanvas;
        }
        postMessageToOpenDataContext(msg) {
            if (Laya.PAL.g.getOpenDataContext)
                Laya.PAL.g.getOpenDataContext().postMessage(msg);
        }
        onCaptureGlobalError(enabled, func) {
            if (enabled) {
                if (Laya.PAL.hasAPI("onError"))
                    Laya.PAL.g.onError(func);
                if (Laya.PAL.g.onUnhandledRejection)
                    Laya.PAL.g.onUnhandledRejection(func);
            }
            else {
                if (Laya.PAL.hasAPI("offError"))
                    Laya.PAL.g.offError(func);
                if (Laya.PAL.g.offUnhandledRejection)
                    Laya.PAL.g.offUnhandledRejection(func);
            }
        }
        normalizePlatform(platform, system) {
            let p = (platform || "").toLowerCase();
            if (p.indexOf("openharmony") !== -1 || p.indexOf("harmonyos") !== -1)
                return "ohos";
            if (p.indexOf("iphone") !== -1 || p.indexOf("ipad") !== -1)
                return "ios";
            if (p.indexOf("ios") !== -1 || p.indexOf("android") !== -1 || p.indexOf("ohos") !== -1
                || p.indexOf("mac") !== -1 || p.indexOf("win") !== -1 || p === "devtools")
                return platform;
            let s = (system || "").toLowerCase();
            if (s.indexOf("android") !== -1 || s.indexOf("adr") !== -1)
                return "android";
            if (s.indexOf("ios") !== -1 || s.indexOf("iphone") !== -1 || s.indexOf("ipad") !== -1)
                return "ios";
            if (s.indexOf("ohos") !== -1 || s.indexOf("openharmony") !== -1 || s.indexOf("harmonyos") !== -1)
                return "ohos";
            return platform;
        }
        alert(msg) {
            if (typeof (window.alert) === "function") {
                window.alert.call(null, msg);
            }
            else {
                console.warn("alert is not a function");
            }
        }
    }
    MgBrowserAdapter.downloaderClass = MgDownloader;
    Laya.PAL.register("browser", MgBrowserAdapter);
    function toWheelEvent(result) {
        if (!result
            || !Number.isFinite(result.x)
            || !Number.isFinite(result.y)
            || !Number.isFinite(result.deltaX)
            || !Number.isFinite(result.deltaY)
            || !Number.isFinite(result.deltaZ)
            || (result.timeStamp != null && !Number.isFinite(result.timeStamp)))
            throw new TypeError("Mini-game wheel event must contain finite coordinates and deltas");
        return {
            clientX: result.x,
            clientY: result.y,
            pageX: result.x,
            pageY: result.y,
            deltaX: result.deltaX,
            deltaY: result.deltaY,
            deltaZ: result.deltaZ,
            timeStamp: result.timeStamp,
        };
    }
    function toKeyEvent(type, value, pressedModifiers) {
        const result = value;
        if (!result
            || typeof result.key !== "string"
            || result.key.length === 0
            || typeof result.code !== "string"
            || result.code.length === 0
            || typeof result.timeStamp !== "number"
            || !Number.isFinite(result.timeStamp))
            throw new TypeError("Mini-game keyboard event must contain non-empty key/code and finite timeStamp");
        for (const name of ["altKey", "ctrlKey", "shiftKey", "metaKey"]) {
            if (name in result && result[name] !== undefined && typeof result[name] !== "boolean")
                throw new TypeError(`Mini-game keyboard event ${name} must be boolean when provided`);
        }
        if (type === "keydown")
            pressedModifiers.add(result.code);
        else
            pressedModifiers.delete(result.code);
        const hasModifier = (...codes) => codes.some(code => pressedModifiers.has(code));
        return {
            type,
            key: result.key,
            code: result.code,
            altKey: hasModifier("AltLeft", "AltRight"),
            ctrlKey: hasModifier("ControlLeft", "ControlRight"),
            shiftKey: hasModifier("ShiftLeft", "ShiftRight"),
            metaKey: hasModifier("MetaLeft", "MetaRight"),
            timeStamp: result.timeStamp,
        };
    }

    class MgDeviceAdapter extends Laya.DeviceAdapter {
        constructor() {
            super();
            this._watchId = 1;
            this._watchDic = new Map();
            this._accInfo = { x: 0, y: 0, z: 0 };
            this._rotInfo = { alpha: 0, beta: 0, gamma: 0, absolute: false, compassAccuracy: 0 };
        }
        get supportedLocation() {
            return !!(Laya.PAL.g.getFuzzyLocation || Laya.PAL.g.getLocation);
        }
        getCurrentPosition(successCallback, errorCallback, options) {
            if (Laya.PAL.g.getFuzzyLocation)
                Laya.PAL.g.getFuzzyLocation({
                    type: 'gcj02',
                    success: (res) => {
                        successCallback({
                            latitude: res.latitude,
                            longitude: res.longitude,
                            timestamp: performance.now()
                        });
                    },
                    fail: (err) => {
                        errorCallback === null || errorCallback === void 0 ? void 0 : errorCallback({ code: 1, message: err.errMsg });
                    }
                });
            else {
                Laya.PAL.g.getLocation({
                    type: 'gcj02',
                    success: (res) => {
                        successCallback({
                            latitude: res.latitude,
                            longitude: res.longitude,
                            speed: res.speed,
                            altitude: res.altitude,
                            accuracy: res.accuracy,
                            timestamp: performance.now()
                        });
                    },
                    fail: (err) => {
                        errorCallback === null || errorCallback === void 0 ? void 0 : errorCallback({ code: 1, message: err.errMsg });
                    }
                });
            }
        }
        watchPosition(successCallback, errorCallback, options) {
            if (this._watchDic.size === 0) {
                Laya.ILaya.systemTimer.loop(1000, this, this.onUpdate);
                this._watchOptions = options;
            }
            this._watchId++;
            this._watchDic.set(this._watchId, { successCallback, errorCallback });
            return this._watchId;
        }
        clearWatchPosition(id) {
            this._watchDic.delete(id);
            if (this._watchDic.size === 0) {
                Laya.ILaya.systemTimer.clear(this, this.onUpdate);
                this._watchOptions = null;
            }
        }
        onUpdate() {
            let callbacks = Array.from(this._watchDic.values());
            this.getCurrentPosition(info => callbacks.forEach(callback => callback.successCallback(info)), err => callbacks.forEach(callback => { var _a; return (_a = callback.errorCallback) === null || _a === void 0 ? void 0 : _a.call(callback, err); }), this._watchOptions);
        }
        startListeningDeviceMotion() {
            Laya.PAL.g.startAccelerometer({ interval: "game" });
            Laya.PAL.g.onAccelerometerChange(res => {
                Object.assign(this._accInfo, res);
                this.event("devicemotion", [this._accInfo, this._accInfo, {}, 0]);
            });
        }
        startListeningDeviceOrientation() {
            Laya.PAL.g.startGyroscope({ interval: "game" });
            Laya.PAL.g.onGyroscopeChange(res => {
                this._rotInfo.alpha = res.z;
                this._rotInfo.beta = res.x;
                this._rotInfo.gamma = res.y;
                this.event("deviceorientation", [true, this._rotInfo]);
            });
        }
    }
    Laya.PAL.register("device", MgDeviceAdapter);

    class MgFileSystemAdapter extends Laya.FileSystemAdapter {
        constructor() {
            super();
            this.hasAccess = false;
            this.fs = Laya.PAL.g.getFileSystemManager();
            this.hasAccess = Laya.PAL.hasAPI(this.fs, "access");
        }
        readFile(path, encoding) {
            return new Promise((resolve, reject) => {
                var _a;
                this.fs.readFile({
                    filePath: path,
                    encoding: (_a = encoding) !== null && _a !== void 0 ? _a : undefined,
                    success: (res) => resolve(res.data),
                    fail: (err) => reject(err)
                });
            });
        }
        writeFile(path, data, encoding) {
            return new Promise((resolve, reject) => {
                var _a;
                this.fs.writeFile({
                    filePath: path,
                    data: data,
                    encoding: (_a = encoding) !== null && _a !== void 0 ? _a : undefined,
                    success: () => resolve(),
                    fail: (err) => reject(err)
                });
            });
        }
        unlink(path) {
            return new Promise((resolve, reject) => {
                this.fs.unlink({
                    filePath: path,
                    success: () => resolve(),
                    fail: (err) => reject(err)
                });
            });
        }
        copyFile(srcPath, destPath) {
            return new Promise((resolve, reject) => {
                this.fs.copyFile({
                    srcPath,
                    destPath,
                    success: () => resolve(),
                    fail: (err) => reject(err)
                });
            });
        }
        exists(path) {
            return new Promise(resolve => {
                if (this.hasAccess) {
                    this.fs.access({
                        path,
                        success: () => resolve(true),
                        fail: (err) => resolve(false)
                    });
                }
                else {
                    this.fs.getFileInfo({
                        filePath: path,
                        success: (res) => resolve(true),
                        fail: (err) => resolve(false)
                    });
                }
            });
        }
        getFileSize(path) {
            return new Promise((resolve, reject) => {
                this.fs.getFileInfo({
                    filePath: path,
                    success: (res) => resolve(res.size),
                    fail: (err) => reject(err)
                });
            });
        }
        mkdir(path, options) {
            return new Promise((resolve, reject) => {
                this.fs.mkdir({
                    dirPath: path,
                    recursive: options === null || options === void 0 ? void 0 : options.recursive,
                    success: () => resolve(),
                    fail: (err) => reject(err)
                });
            });
        }
        rmdir(path, options) {
            try {
                this.fs.rmdirSync(path, options === null || options === void 0 ? void 0 : options.recursive);
                return Promise.resolve();
            }
            catch (e) {
                return Promise.reject(e);
            }
        }
        readdir(path) {
            return new Promise((resolve, reject) => {
                this.fs.readdir({
                    dirPath: path,
                    success: (res) => resolve(res.files),
                    fail: (err) => reject(err)
                });
            });
        }
        unzip(zipFilePath, targetPath) {
            return new Promise((resolve, reject) => {
                this.fs.unzip({
                    zipFilePath,
                    targetPath,
                    success: () => resolve(),
                    fail: (err) => reject(err)
                });
            });
        }
    }
    Laya.PAL.register("fs", MgFileSystemAdapter);

    class MgFontAdapter extends Laya.FontAdapter {
        loadFont(task) {
            if (!Laya.PAL.g.loadFont) {
                Laya.PAL.warnIncompatibility("TTFont");
                return Promise.resolve(null);
            }
            return task.loader.fetch(task.url, "filePath", task.progress.createCallback(), task.options).then((filePath) => {
                if (filePath) {
                    let fontFamily = Laya.PAL.g.loadFont(filePath);
                    return fontFamily ? { family: fontFamily } : null;
                }
                else
                    return null;
            });
        }
    }
    Laya.PAL.register("font", MgFontAdapter);

    class MgInnerAudioChannel extends Laya.SoundChannel {
        get position() {
            if (this._ctx)
                return this._ctx.currentTime;
            else
                return 0;
        }
        get duration() {
            if (this._ctx)
                return this._ctx.duration;
            else
                return 0;
        }
        onPlay(url) {
            Laya.Laya.loader.fetch(url, "filePath").then((filePath) => this.onLoaded(filePath));
        }
        onLoaded(filePath) {
            if (!this._started || filePath == null)
                return;
            this._loaded = true;
            let ctx = this._ctx = this.createContext();
            ctx.onError(err => {
                console.error("MgInnerAudioChannel: " + Laya.getErrorMsg(err));
                this.stop();
            });
            ctx.onEnded(() => this.onPlayEnd());
            let playSound = () => {
                if (this._ctx && !this._paused) {
                    if (this.startTime != 0)
                        ctx.seek(this.startTime);
                    ctx.play();
                }
                ctx.offCanplay(playSound);
            };
            ctx.onCanplay(playSound);
            ctx.src = filePath;
            ctx.playbackRate = this.playbackRate;
            ctx.loop = this.loops === 0;
            ctx.volume = this._muted ? 0 : this._volume;
        }
        onPlayAgain() {
            if (this.startTime != 0)
                this._ctx.seek(this.startTime);
            this._ctx.play();
        }
        onStop() {
            this.releaseContext();
        }
        onPause() {
            this._ctx.pause();
        }
        onResume() {
            this._ctx.play();
        }
        onVolumeChanged() {
            this._ctx.volume = this._muted ? 0 : this._volume;
        }
        onMuted() {
            if (this._muted)
                this._ctx.pause();
            else
                this._ctx.play();
        }
        onPlaybackRateChanged() {
            if (this._ctx)
                this._ctx.playbackRate = this.playbackRate;
        }
        createContext() {
            return Laya.PAL.g.createInnerAudioContext();
        }
        releaseContext() {
            var _a;
            (_a = this._ctx) === null || _a === void 0 ? void 0 : _a.destroy();
            this._ctx = null;
        }
    }

    class MgVideoPlayer extends Laya.VideoPlayerBackend {
        constructor() {
            super(...arguments);
            this._loop = false;
            this._ended = false;
            this._muted = false;
            this._playbackRate = 1;
        }
        get loop() {
            return this._loop;
        }
        set loop(value) {
            this._loop = value;
            if (this.video)
                this.video.loop = value;
        }
        get ended() {
            return this._ended;
        }
        get currentTime() {
            return this._currentTime;
        }
        set currentTime(value) {
            if (this.video)
                this.video.seek(value * 1000);
        }
        get muted() {
            return this._muted;
        }
        set muted(value) {
            this._muted = value;
            if (this.video)
                this.video.muted = value;
        }
        get playbackRate() {
            return this._playbackRate;
        }
        set playbackRate(value) {
            this._playbackRate = value;
            if (this.video)
                this.video.playbackRate = value;
        }
        onLoad(url) {
            this._ended = false;
            if (this._loaded)
                this.video.destroy();
            this.video = Laya.PAL.g.createVideo(Object.assign({}, this.options, this.getNodeTransform(), {
                src: Laya.URL.postFormatURL(Laya.URL.formatURL(url)),
                autoplay: this._playing,
                loop: this._loop,
                muted: this._muted,
                playbackRate: this._playbackRate,
            }));
            this.video.onEnded(() => this._ended = true);
            this.video.onError((err) => {
                console.error("MgVideoPlayer: " + Laya.getErrorMsg(err));
            });
            this.setLoaded();
        }
        onPlay() {
            this.video.play();
        }
        onPause() {
            this.video.pause();
        }
        onTransformChanged() {
            if (!this.video)
                return;
            let { x, y, width, height } = this.getNodeTransform();
            if (this.video.paintTo) {
                this.video.paintTo(Laya.Browser.mainCanvas.source, x, y, 0, 0, width, height);
            }
            else {
                this.video.x = x;
                this.video.y = y;
                this.video.width = width;
                this.video.height = height;
            }
        }
        onDestroy() {
            this.video.destroy();
        }
    }

    class MgWebAudioChannel extends MgInnerAudioChannel {
        constructor(url) {
            super(url);
        }
        createContext() {
            return Laya.PAL.g.createInnerAudioContext({ useWebAudioImplement: true });
        }
    }

    class MgMediaAdapter extends Laya.MediaAdapter {
        init() {
            if (Laya.PAL.g.createWebAudioContext)
                this.audioCtx = Laya.PAL.g.createWebAudioContext();
            else if (Laya.PAL.g.getAudioContext)
                this.audioCtx = Laya.PAL.g.getAudioContext();
            this.longAudioClass = MgInnerAudioChannel;
            this.shortAudioClass = MgWebAudioChannel;
            this.videoPlayerClass = Laya.PAL.hasAPI("createVideo") ? MgVideoPlayer : null;
            this.videoTextureClass = null;
        }
    }
    Laya.PAL.register("media", MgMediaAdapter);

    class MgStorageAdapter extends Laya.StorageAdapter {
        checkSupport() {
            return Laya.PAL.hasAPI("getStorageInfoSync");
        }
    }
    Laya.PAL.register("storage", MgStorageAdapter);

    class MgTextInputAdapter extends Laya.TextInputAdapter {
        get capabilities() {
            return { presentation: "platform-keyboard", selection: false, inputTypes: ["text"] };
        }
        constructor() {
            super();
            this._editInline = false;
            MgTextInputAdapter.enabled = Laya.PAL.hasAPI("onKeyboardInput");
        }
        setText(value) {
            if (!MgTextInputAdapter.enabled)
                return;
            Laya.PAL.g.updateKeyboard({ value });
        }
        onBegin() {
            const required = ["onKeyboardInput", "onKeyboardConfirm", "onKeyboardComplete", "offKeyboardInput", "offKeyboardConfirm", "offKeyboardComplete", "showKeyboard", "hideKeyboard", "updateKeyboard"];
            if (required.some(name => !Laya.PAL.hasAPI(name)))
                return Promise.reject(new Error("Incomplete platform keyboard API"));
            const session = this.sessionId;
            const active = () => session === this.sessionId && !!this.target;
            this._inputHandler = ev => { if (active())
                this.onKeyboardInput(ev); };
            this._confirmHandler = ev => { if (active())
                this.onKeyboardConfirm(ev); };
            this._completeHandler = ev => { if (active())
                this.onKeyboardComplete(ev); };
            Laya.PAL.g.onKeyboardInput(this._inputHandler);
            Laya.PAL.g.onKeyboardConfirm(this._confirmHandler);
            Laya.PAL.g.onKeyboardComplete(this._completeHandler);
            return Promise.resolve();
        }
        onCanShowKeyboard() {
            let target = this.target;
            if (!target.editable || !MgTextInputAdapter.enabled)
                return Promise.resolve();
            return new Promise((resolve, reject) => {
                Laya.PAL.g.showKeyboard({
                    defaultValue: target.text,
                    maxLength: target.maxChars <= 0 ? 1E5 : target.maxChars,
                    multiple: target.multiline,
                    confirmHold: true,
                    confirmType: target.confirmType,
                    keyboardType: 'text',
                    success: resolve,
                    fail: reject
                });
            });
        }
        onEnd(target, complete, switching) {
            if (this._inputHandler)
                Laya.PAL.g.offKeyboardInput(this._inputHandler);
            if (this._confirmHandler)
                Laya.PAL.g.offKeyboardConfirm(this._confirmHandler);
            if (this._completeHandler)
                Laya.PAL.g.offKeyboardComplete(this._completeHandler);
            this._inputHandler = this._confirmHandler = this._completeHandler = null;
            if (complete || !MgTextInputAdapter.enabled)
                return Promise.resolve();
            return new Promise((resolve, reject) => {
                Laya.PAL.g.hideKeyboard({ success: resolve, fail: reject });
            });
        }
        onKeyboardInput(ev) {
            if (!this.target)
                return;
            const target = this.target;
            try {
                let str = this.validateText(ev.value);
                if (this.updateTargetText(str) && this.target === target)
                    target.event(Laya.Event.INPUT);
            }
            catch (error) {
                this.fail(error);
            }
        }
        onKeyboardConfirm(ev) {
            const target = this.target;
            if (!target)
                return;
            this.onKeyboardInput(ev);
            if (this.target !== target)
                return;
            target.event(Laya.Event.ENTER);
            if (this.target === target)
                this.end().catch(error => console.error(error));
        }
        onKeyboardComplete(ev) {
            const target = this.target;
            this.onKeyboardInput(ev);
            if (target && this.target === target)
                this.end(true).catch(error => console.error(error));
        }
    }
    MgTextInputAdapter.enabled = true;
    Laya.PAL.register("textInput", MgTextInputAdapter);

    MgBrowserAdapter.beforeInit = function () {
        Laya.Config.useWebGL2 = false;
        Laya.Browser.onKGMiniGame = true;
        Laya.PAL.g = window.qg;
    };
    MgBrowserAdapter.afterInit = function () {
        Laya.PAL.browser.webSocketClass = Laya._WebSocket;
    };

    exports.MgBrowserAdapter = MgBrowserAdapter;
    exports.MgCacheManager = MgCacheManager;
    exports.MgDeviceAdapter = MgDeviceAdapter;
    exports.MgDownloader = MgDownloader;
    exports.MgFileSystemAdapter = MgFileSystemAdapter;
    exports.MgFontAdapter = MgFontAdapter;
    exports.MgInnerAudioChannel = MgInnerAudioChannel;
    exports.MgMediaAdapter = MgMediaAdapter;
    exports.MgStorageAdapter = MgStorageAdapter;
    exports.MgTextInputAdapter = MgTextInputAdapter;
    exports.MgVideoPlayer = MgVideoPlayer;
    exports.MgWebAudioChannel = MgWebAudioChannel;
    exports.MgWebSocket = MgWebSocket;

})(window.Laya = window.Laya || {}, Laya);
