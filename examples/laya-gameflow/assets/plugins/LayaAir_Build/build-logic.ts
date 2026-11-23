export const DEFAULT_ARCHIVE_EXCLUDES = ["*.png", "*.jpg", "*.jpeg"] as const;

const PLATFORM_ALIASES: Readonly<Record<string, string>> = {
    ttgame: "bytedancegame",
    mygame: "alipaygame",
    androidgame: "web",
    iosgame: "web",
};

const UNUSED_NODE_NAMES = new Set(["~mark~head", "~mark~bounding_box"]);

export interface SceneNode {
    name: string;
    _$child?: SceneNode[];
}

export interface MakeZipConfig {
    includes: string[];
    excludes: string[];
}

export function normalizeBuildPlatform(platform: unknown): string {
    if (typeof platform !== "string" || platform.length === 0 || platform.trim() !== platform) {
        throw new Error("构建平台必须是非空且不含首尾空白的字符串");
    }

    return PLATFORM_ALIASES[platform] ?? platform;
}

export function pruneUnusedNodes(node: SceneNode): number {
    if (node._$child === undefined) {
        return 0;
    }
    if (!Array.isArray(node._$child)) {
        throw new Error(`场景节点 ${node.name} 的 _$child 不是数组`);
    }

    let removed = 0;
    const children: SceneNode[] = [];
    for (const child of node._$child) {
        if (typeof child !== "object" || child === null || typeof child.name !== "string") {
            throw new Error(`场景节点 ${node.name} 包含非法子节点`);
        }
        if (UNUSED_NODE_NAMES.has(child.name)) {
            removed += 1;
            continue;
        }
        removed += pruneUnusedNodes(child);
        children.push(child);
    }

    if (children.length !== node._$child.length) {
        node._$child = children;
    }
    return removed;
}

export function parseMakeZipConfig(value: unknown, source: string): MakeZipConfig {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`${source} 必须是 JSON 对象`);
    }

    const data = value as Record<string, unknown>;
    const unknownKeys = Object.keys(data).filter((key) => key !== "includes" && key !== "excludes");
    if (unknownKeys.length > 0) {
        throw new Error(`${source} 包含未知字段: ${unknownKeys.sort().join(", ")}`);
    }
    const includes = parseRules(data.includes, `${source}.includes`, true, false);
    const excludes = parseRules(data.excludes, `${source}.excludes`, false, true);
    return { includes, excludes };
}

export function selectArchiveDirectories(
    directoryNames: readonly string[],
    includes: readonly string[],
    source: string
): string[] {
    const selected = new Set<string>();
    for (const rule of includes) {
        const matches = directoryNames.filter((name) => matchesGlob(name, rule));
        if (matches.length === 0) {
            throw new Error(`${source} 的 includes 规则未命中目录: ${rule}`);
        }
        for (const match of matches) {
            selected.add(match);
        }
    }
    return [...selected].sort((a, b) => a.localeCompare(b));
}

export function isArchivePathExcluded(relativePath: string, excludes: readonly string[]): boolean {
    const normalizedPath = normalizeRelativePath(relativePath);
    const pathWithoutTrailingSlash = normalizedPath.replace(/\/$/, "");
    const baseName = pathWithoutTrailingSlash.substring(
        pathWithoutTrailingSlash.lastIndexOf("/") + 1
    );

    return [...DEFAULT_ARCHIVE_EXCLUDES, ...excludes].some((rule) => {
        const candidate = rule.includes("/") ? normalizedPath : baseName;
        return matchesGlob(candidate, rule);
    });
}

function parseRules(
    value: unknown,
    source: string,
    required: boolean,
    allowPath: boolean
): string[] {
    if (value === undefined && !required) {
        return [];
    }
    if (!Array.isArray(value) || (required && value.length === 0)) {
        throw new Error(`${source} 必须是${required ? "非空" : ""}字符串数组`);
    }

    const rules = value.map((rule, index) => {
        if (typeof rule !== "string" || rule.length === 0 || rule.trim() !== rule) {
            throw new Error(`${source}[${index}] 必须是非空且不含首尾空白的字符串`);
        }
        const normalized = normalizeRelativePath(rule);
        const pathParts = normalized.split("/");
        if (
            normalized.length === 0 ||
            normalized.startsWith("/") ||
            pathParts.includes("..") ||
            /^[A-Za-z]:\//.test(normalized)
        ) {
            throw new Error(`${source}[${index}] 不得越出配置目录: ${rule}`);
        }
        if (!allowPath && normalized.includes("/")) {
            throw new Error(`${source}[${index}] 只能匹配直接子目录: ${rule}`);
        }
        return normalized;
    });

    if (new Set(rules).size !== rules.length) {
        throw new Error(`${source} 不得包含重复规则`);
    }
    return rules;
}

function matchesGlob(value: string, rule: string): boolean {
    let expression = "^";
    for (const char of rule) {
        expression += char === "*" ? ".*" : escapeRegExpCharacter(char);
    }
    expression += "$";
    return new RegExp(expression).test(value);
}

function escapeRegExpCharacter(char: string): string {
    return /[\\^$.*+?()[\]{}|]/.test(char) ? `\\${char}` : char;
}

function normalizeRelativePath(value: string): string {
    return value.replace(/\\/g, "/").replace(/^\.\//, "");
}
