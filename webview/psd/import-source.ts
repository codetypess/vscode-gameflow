import type { PsdAsset } from "../../shared/psd-meta";
import type { HostToWebviewMessage } from "../../shared/protocol";
import { postHostMessage } from "../vscode-api";
import { psdTask } from "./io";

export async function readImportSource(pageId: string) {
  const requestId = crypto.randomUUID();
  const reply = await new Promise<Extract<HostToWebviewMessage, { type: "psdImportSourceResult" }> | undefined>(resolve => {
    const finish = (data?: Extract<HostToWebviewMessage, { type: "psdImportSourceResult" }>) => {
      clearTimeout(timer); window.removeEventListener("message", receive); resolve(data);
    };
    const receive = ({ data }: MessageEvent<HostToWebviewMessage>) => {
      if (data?.type === "psdImportSourceResult" && data.requestId === requestId) finish(data);
    };
    const timer = setTimeout(finish, 15000);
    window.addEventListener("message", receive);
    postHostMessage({ type: "psdImportSource", requestId, pageId });
  });
  if (!reply?.base64 || !reply.name) return;
  const bytes = Uint8Array.from(atob(reply.base64), c => c.charCodeAt(0));
  return psdTask<PsdAsset>("readPage", bytes.buffer, reply.name);
}
