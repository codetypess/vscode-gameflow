export type ExportDirectoryKind = "resources" | "prefabs";
export interface WorkbenchSettings { resourceDirectory?: string; prefabDirectory?: string }
export interface StoredExportSettings { version: 1; resources?: string; prefabs?: string }
export const EXPORT_SETTINGS_KEY = "gameflow.workbenchExportSettings";
export const LEGACY_RESOURCE_DIRECTORY_KEY = "gameflow.psdExportDirectory";

export function readExportSettings(value: unknown, legacy?: string): StoredExportSettings {
  if (value === undefined) return { version: 1, ...(legacy ? { resources: legacy } : {}) };
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("工作台导出目录设置无效。");
  const settings = value as Record<string, unknown>;
  if (settings.version !== 1 || Object.keys(settings).some(key => !["version", "resources", "prefabs"].includes(key)) || [settings.resources, settings.prefabs].some(path => path !== undefined && (typeof path !== "string" || !path || path.length > 8192))) throw new Error("工作台导出目录设置无效。");
  return { ...settings } as unknown as StoredExportSettings;
}
export type WorkbenchSettingsRequest = { type: "workbenchSettings"; requestId: string } & (
  | { action: "read" }
  | { action: "choose" | "clear" | "reveal"; directory: ExportDirectoryKind }
);
export interface WorkbenchSettingsResult {
  type: "workbenchSettingsResult"; requestId?: string; settings: WorkbenchSettings; cancelled?: boolean; error?: string;
}
export function isWorkbenchSettingsRequest(raw: unknown): raw is WorkbenchSettingsRequest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const message = raw as Record<string, unknown>;
  return message.type === "workbenchSettings" && typeof message.requestId === "string" && message.requestId.length > 0 && message.requestId.length <= 80 && !Object.keys(message).some(key => !["type", "requestId", "action", "directory"].includes(key)) &&
    (message.action === "read" ? message.directory === undefined : (message.action === "choose" || message.action === "clear" || message.action === "reveal") && (message.directory === "resources" || message.directory === "prefabs"));
}
