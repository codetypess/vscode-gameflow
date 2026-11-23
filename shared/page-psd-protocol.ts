import type { PagePsdBinding } from "./model";
import type { PsdDraft } from "./psd-draft";
export type PagePsdRequest = { type: "pagePsd"; requestId: string; pageId: string; action: "choose" | "load" | "slice" | "review" | "generate" | "syncCopy"; reviewStamp?: string; sourceHash?: string; expected?: PagePsdBinding; name?: string; base64?: string };
export type PagePsdResult = { type: "pagePsdResult"; requestId: string; source?: string; name?: string; base64?: string; draft?: PsdDraft; cancelled?: boolean; error?: string };
