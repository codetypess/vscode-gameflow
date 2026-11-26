/** Call during document bubbling, before VS Code's window listener forwards the key. */
export function consumeHistoryShortcut(event: KeyboardEvent): "undo" | "redo" | undefined {
  if (event.altKey || !(event.ctrlKey || event.metaKey)) return;
  const key = event.key.toLowerCase();
  if (key !== "z" && key !== "y") return;
  event.preventDefault();
  event.stopPropagation();
  return key === "y" || event.shiftKey ? "redo" : "undo";
}
