import { pinyin } from "pinyin-pro";

/** Chinese syllable initials, with ASCII words/numbers retained and separators collapsed. */
export function psdNameInitials(value: string): string {
  return pinyin(value.normalize("NFKC"), { pattern: "first", toneType: "none", type: "array", nonZh: "consecutive" })
    .join("").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
export const defaultAtlasName = (name: string) => psdNameInitials(name.replace(/\.psd$/i, ""));
export const normalizeAtlasName = (value?: string): string | undefined => value === undefined ? undefined : psdNameInitials(value) || undefined;

export const RESERVED_ATLAS_NAMES = ["builtin", "shared", "unclassified"] as const;
export function atlasNameError(value?: string): string | null {
  const canonical = normalizeAtlasName(value);
  return canonical && RESERVED_ATLAS_NAMES.some(name => name === canonical)
    ? "图集名不能使用保留目录名：builtin、shared、unclassified。" : null;
}
