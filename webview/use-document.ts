import { useEffect, useRef, useState } from "react";
import type { HostToWebviewMessage } from "../shared/protocol";
import { DocumentSession } from "./document-session";
import { postHostMessage } from "./vscode-api";

export function useDocument() {
  const session = useRef<DocumentSession>();
  const [state, setState] = useState(() => ({ document: null, resourceName: "", dirty: false, pending: false, error: null }) as DocumentSession["state"]);
  if (!session.current) session.current = new DocumentSession(postHostMessage, setState);
  const controller = session.current;
  useEffect(() => {
    const listener = (event: MessageEvent<HostToWebviewMessage>) => {
      if (event.data && typeof event.data === "object") controller.receive(event.data);
    };
    window.addEventListener("message", listener); postHostMessage({ type: "ready" });
    return () => window.removeEventListener("message", listener);
  }, [controller]);
  return { ...state, edit: controller.edit.bind(controller), read: () => controller.state.document,
    history: (action: "undo" | "redo") => controller.command(action), save: () => controller.command("save") };
}
