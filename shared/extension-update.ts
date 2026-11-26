export type ExtensionUpdateState =
  | { status: "current" }
  | { status: "available" | "installing" | "pending"; version: string; error?: string };

export type ExtensionUpdateRequest = { type: "extensionUpdateReady" | "installExtensionUpdate" };
export type ExtensionUpdateMessage = { type: "extensionUpdateState"; state: ExtensionUpdateState };

export function isExtensionUpdateRequest(value: unknown): value is ExtensionUpdateRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 1 && (record.type === "extensionUpdateReady" || record.type === "installExtensionUpdate");
}

export function isExtensionUpdateState(value: unknown): value is ExtensionUpdateState {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  return state.status === "current" ||
    (state.status === "available" || state.status === "installing" || state.status === "pending") &&
    typeof state.version === "string" && /^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(state.version) && state.version.length <= 100 &&
    (state.error === undefined || typeof state.error === "string");
}
