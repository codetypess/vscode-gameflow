import * as fs from "fs";
import * as path from "path";
import JSZip from "jszip";
import {
    isArchivePathExcluded,
    MakeZipConfig,
    parseMakeZipConfig,
    pruneUnusedNodes,
    SceneNode,
    selectArchiveDirectories,
} from "./build-logic";

const ARCHIVE_CONFIG_FILE = "makezip.json";
const ARCHIVE_MANIFEST = path.join("resources", "data", "res-zip.json");
const MAX_ARCHIVE_BYTES = 3 * 1024 * 1024;
const ZIP_ENTRY_DATE = new Date("2025-01-01T00:00:00.000Z");

export interface ZipInfo {
    path: string;
    version: string;
    entries: string[];
}

interface PendingArchive extends ZipInfo {
    absolutePath: string;
}

interface SafeUrlApi {
    safeFileExtConversionMap?: Record<string, string | undefined>;
}

export class BuildPlugin implements IEditorEnv.IBuildPlugin {
    private readonly archives: PendingArchive[] = [];
    private readonly originalExportPaths = new Map<string, string>();
    private archivesEnabled = false;
    private archivesMoved = false;

    protected useSafeFileExtensions(): boolean {
        return false;
    }

    onStart(task: IEditorEnv.IBuildTask): void {
        this.archives.length = 0;
        this.originalExportPaths.clear();
        this.archivesMoved = false;
        this.archivesEnabled = fs.existsSync(
            path.join(EditorEnv.projectPath, "release", "SUPPORT_ZIP")
        );

        if (this.useSafeFileExtensions()) {
            this.getSafeFileExtensionMap();
        }
        task.logger.log(`资源 ZIP: ${this.archivesEnabled ? "启用" : "未启用"}`);
    }

    onBeforeExportAssets(
        task: IEditorEnv.IBuildTask,
        exportInfoMap: Map<IEditorEnv.IAssetInfo, IEditorEnv.IAssetExportInfo>
    ): void {
        if (!this.useSafeFileExtensions()) {
            return;
        }

        const extensionMap = this.getSafeFileExtensionMap();
        exportInfoMap.forEach((exportInfo) => {
            const oldExtension = Laya.Utils.getFileExtension(exportInfo.outPath);
            const newExtension = extensionMap[oldExtension];
            if (newExtension === undefined) {
                return;
            }

            const safeUrl = Laya.Utils.replaceFileExtension(exportInfo.outPath, newExtension);
            if (safeUrl === exportInfo.outPath) {
                return;
            }

            const safePath = resolveRelativePath(task.resourcePath, safeUrl, "安全后缀导出路径");
            const originalPath = resolveRelativePath(
                task.resourcePath,
                exportInfo.outPath,
                "原始导出路径"
            );
            this.originalExportPaths.set(normalizeAbsolutePath(safePath), originalPath);
        });
    }

    async onAfterExportAssets(task: IEditorEnv.IBuildTask): Promise<void> {
        if (!this.archivesEnabled) {
            return;
        }

        const removedNodeCount = this.removeUnusedNodes(task.destPath);
        await this.createArchives(task.destPath, task.destPath);
        if (this.archives.length === 0) {
            throw new Error(
                `已启用资源 ZIP，但 ${EditorEnv.assetsPath} 中没有命中任何 ${ARCHIVE_CONFIG_FILE}`
            );
        }
        this.writeArchiveManifest(task.resourcePath, task.destPath);
        this.minifyJsonDirectory(path.join(task.resourcePath, "resources", "data"));
        task.logger.log(
            `资源 ZIP 已生成: ${this.archives.length} 个，移除标记节点 ${removedNodeCount} 个`
        );
    }

    protected moveArchives(sourceRoot: string, targetRoot: string): void {
        if (!this.archivesEnabled) {
            return;
        }
        if (this.archivesMoved) {
            throw new Error("资源 ZIP 已移动，不能重复执行平台收尾");
        }

        for (const archive of this.archives) {
            const source = resolveRelativePath(sourceRoot, archive.path, "ZIP 源路径");
            if (normalizeAbsolutePath(source) !== normalizeAbsolutePath(archive.absolutePath)) {
                throw new Error(`ZIP 源路径与记录不一致: ${archive.path}`);
            }

            const versionedPath = appendVersion(archive.path, archive.version);
            const target = resolveRelativePath(targetRoot, versionedPath, "ZIP 目标路径");
            if (fs.existsSync(target)) {
                throw new Error(`ZIP 目标已存在: ${target}`);
            }
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.renameSync(source, target);
        }
        this.archivesMoved = true;
    }

    private getSafeFileExtensionMap(): Record<string, string | undefined> {
        const urlApi = Laya.URL as unknown as SafeUrlApi;
        if (
            typeof urlApi.safeFileExtConversionMap !== "object" ||
            urlApi.safeFileExtConversionMap === null
        ) {
            throw new Error("当前 LayaAir 未提供安全文件后缀映射");
        }
        return urlApi.safeFileExtConversionMap;
    }

    private removeUnusedNodes(root: string): number {
        let removed = 0;
        for (const file of listFiles(root)) {
            if (path.extname(file).toLowerCase() !== ".lh") {
                continue;
            }
            const data = readJson(file);
            if (typeof data !== "object" || data === null || Array.isArray(data)) {
                throw new Error(`场景文件根节点必须是对象: ${file}`);
            }

            const count = pruneUnusedNodes(data as SceneNode);
            if (count > 0) {
                IEditorEnv.utils.writeJson(file, data, 0);
                removed += count;
            }
        }
        return removed;
    }

    private async createArchives(directory: string, buildRoot: string): Promise<void> {
        const relativeDirectory = relativePathWithin(buildRoot, directory, "ZIP 扫描目录");
        const configPath = path.join(
            EditorEnv.assetsPath,
            ...splitRelativePath(relativeDirectory),
            ARCHIVE_CONFIG_FILE
        );
        const directoryEntries = listDirectoryEntries(directory);
        const childDirectories = directoryEntries
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name);

        if (fs.existsSync(configPath)) {
            const config = parseMakeZipConfig(readJson(configPath), configPath);
            const selectableDirectories = childDirectories.filter(
                (name) => !isArchivePathExcluded(`${name}/`, config.excludes)
            );
            const selectedDirectories = selectArchiveDirectories(
                selectableDirectories,
                config.includes,
                configPath
            );
            const selectedSet = new Set(selectedDirectories);

            for (const name of selectedDirectories) {
                await this.createArchive(path.join(directory, name), buildRoot, config);
            }
            for (const name of childDirectories) {
                if (!selectedSet.has(name)) {
                    await this.createArchives(path.join(directory, name), buildRoot);
                }
            }
            return;
        }

        for (const name of childDirectories) {
            await this.createArchives(path.join(directory, name), buildRoot);
        }
    }

    private async createArchive(
        sourceDirectory: string,
        buildRoot: string,
        config: MakeZipConfig
    ): Promise<void> {
        const entries = collectArchiveEntries(sourceDirectory, config.excludes);
        if (entries.length === 0) {
            throw new Error(`ZIP 源目录没有可打包内容: ${sourceDirectory}`);
        }

        const zip = new JSZip();
        const manifestEntries: string[] = [];
        const archiveEntryNames = new Set<string>();
        for (const entry of entries) {
            const physicalRelativePath = relativePathWithin(
                sourceDirectory,
                entry.absolutePath,
                "ZIP 条目"
            );
            if (entry.isDirectory) {
                const directoryName = `${physicalRelativePath}/`;
                zip.file(directoryName, null, { dir: true, date: ZIP_ENTRY_DATE });
                manifestEntries.push(directoryName);
                continue;
            }

            const originalPath =
                this.originalExportPaths.get(normalizeAbsolutePath(entry.absolutePath)) ??
                entry.absolutePath;
            const archivePath = relativePathWithin(
                sourceDirectory,
                originalPath,
                "ZIP 安全后缀还原路径"
            );
            if (archiveEntryNames.has(archivePath)) {
                throw new Error(`ZIP 内存在重复路径: ${archivePath}`);
            }
            archiveEntryNames.add(archivePath);
            zip.file(archivePath, fs.readFileSync(entry.absolutePath), {
                date: ZIP_ENTRY_DATE,
            });
            manifestEntries.push(archivePath);
        }

        manifestEntries.sort((a, b) => a.localeCompare(b));
        const archivePath = `${sourceDirectory}.zip`;
        const content = await zip.generateAsync({
            type: "nodebuffer",
            compression: "DEFLATE",
            compressionOptions: { level: 9 },
        });
        fs.writeFileSync(archivePath, content);

        const archiveSize = fs.statSync(archivePath).size;
        if (archiveSize > MAX_ARCHIVE_BYTES) {
            fs.rmSync(archivePath, { force: true });
            throw new Error(`ZIP 超过 3 MiB: ${archivePath} (${archiveSize} bytes)`);
        }

        const hash = await IEditorEnv.utils.createFileHash(archivePath);
        if (typeof hash !== "string" || hash.length < 5) {
            throw new Error(`ZIP 哈希无效: ${archivePath}`);
        }
        this.archives.push({
            absolutePath: archivePath,
            path: relativePathWithin(buildRoot, archivePath, "ZIP 清单路径"),
            version: hash.substring(0, 5),
            entries: manifestEntries,
        });
    }

    private writeArchiveManifest(resourceRoot: string, buildRoot: string): void {
        relativePathWithin(buildRoot, resourceRoot, "资源输出目录");
        const manifestPath = resolveRelativePath(
            resourceRoot,
            toPosixPath(ARCHIVE_MANIFEST),
            "ZIP 清单"
        );
        const manifest = this.archives
            .map(({ path: archivePath, version, entries }) => ({
                path: archivePath,
                version,
                entries,
            }))
            .sort((a, b) => a.path.localeCompare(b.path));

        fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
        IEditorEnv.utils.writeJson(manifestPath, manifest, 0);
    }

    private minifyJsonDirectory(directory: string): void {
        for (const entry of listDirectoryEntries(directory)) {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                this.minifyJsonDirectory(entryPath);
            } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".json") {
                IEditorEnv.utils.writeJson(entryPath, readJson(entryPath), 0);
            } else if (!entry.isFile()) {
                throw new Error(`不支持的资源目录条目: ${entryPath}`);
            }
        }
    }
}

interface ArchiveEntry {
    absolutePath: string;
    isDirectory: boolean;
}

function collectArchiveEntries(
    sourceDirectory: string,
    excludes: readonly string[],
    directory: string = sourceDirectory
): ArchiveEntry[] {
    const entries: ArchiveEntry[] = [];
    for (const entry of listDirectoryEntries(directory)) {
        const entryPath = path.join(directory, entry.name);
        const relativeEntryPath = relativePathWithin(sourceDirectory, entryPath, "ZIP 输入路径");
        if (entry.isDirectory()) {
            if (isArchivePathExcluded(`${relativeEntryPath}/`, excludes)) {
                continue;
            }
            entries.push({ absolutePath: entryPath, isDirectory: true });
            entries.push(...collectArchiveEntries(sourceDirectory, excludes, entryPath));
        } else if (entry.isFile()) {
            if (!isArchivePathExcluded(relativeEntryPath, excludes)) {
                entries.push({ absolutePath: entryPath, isDirectory: false });
            }
        } else {
            throw new Error(`ZIP 不支持符号链接或特殊文件: ${entryPath}`);
        }
    }
    return entries;
}

function listFiles(directory: string): string[] {
    const files: string[] = [];
    for (const entry of listDirectoryEntries(directory)) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...listFiles(entryPath));
        } else if (entry.isFile()) {
            files.push(entryPath);
        } else {
            throw new Error(`不支持的目录条目: ${entryPath}`);
        }
    }
    return files;
}

function listDirectoryEntries(directory: string): fs.Dirent[] {
    return fs
        .readdirSync(directory, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name));
}

function readJson(file: string): unknown {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`JSON 读取失败: ${file}: ${message}`);
    }
}

function resolveRelativePath(root: string, relativePath: string, label: string): string {
    if (path.isAbsolute(relativePath)) {
        throw new Error(`${label} 必须是相对路径: ${relativePath}`);
    }
    const candidate = path.resolve(root, ...splitRelativePath(relativePath));
    relativePathWithin(root, candidate, label);
    return candidate;
}

function relativePathWithin(root: string, candidate: string, label: string): string {
    const resolvedRoot = path.resolve(root);
    const resolvedCandidate = path.resolve(candidate);
    const relativePath = path.relative(resolvedRoot, resolvedCandidate);
    if (
        relativePath === ".." ||
        relativePath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativePath)
    ) {
        throw new Error(`${label} 越出根目录: ${candidate}`);
    }
    return toPosixPath(relativePath);
}

function splitRelativePath(relativePath: string): string[] {
    return toPosixPath(relativePath)
        .split("/")
        .filter((part) => part.length > 0);
}

function normalizeAbsolutePath(file: string): string {
    return toPosixPath(path.resolve(file));
}

function toPosixPath(file: string): string {
    return file.replace(/\\/g, "/");
}

function appendVersion(archivePath: string, version: string): string {
    if (!archivePath.endsWith(".zip")) {
        throw new Error(`不是 ZIP 路径: ${archivePath}`);
    }
    return `${archivePath.substring(0, archivePath.length - 4)}-${version}.zip`;
}
