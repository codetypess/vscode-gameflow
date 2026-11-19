/** All native resource writers share the same root locks. */
export const exportRootsInProgress = new Set<string>();
