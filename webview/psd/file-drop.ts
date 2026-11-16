import { useEffect, useRef, useState, type DragEvent } from "react";
import { droppedPsd, hasFileDrag } from "./file-drop-input";

export function usePsdFileDrop({ disabled, onFile, onError }: {
  disabled: boolean; onFile: (file: File) => void; onError: (message: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const reset = () => { depth.current = 0; setDragging(false); };
  useEffect(() => { if (disabled) reset(); }, [disabled]);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => { if (event.key === "Escape") reset(); };
    window.addEventListener("dragend", reset);
    window.addEventListener("drop", reset, true);
    window.addEventListener("blur", reset);
    window.addEventListener("keydown", cancel);
    return () => {
      window.removeEventListener("dragend", reset);
      window.removeEventListener("drop", reset, true);
      window.removeEventListener("blur", reset);
      window.removeEventListener("keydown", cancel);
    };
  }, []);
  const capture = (event: DragEvent<HTMLElement>) => {
    if (!hasFileDrag(event.dataTransfer)) return false;
    event.preventDefault(); event.stopPropagation();
    event.dataTransfer.dropEffect = disabled ? "none" : "copy";
    return true;
  };
  return {
    dragging: dragging && !disabled,
    handlers: {
      onDragEnter: (event: DragEvent<HTMLElement>) => {
        if (capture(event) && !disabled) { depth.current++; setDragging(true); }
      },
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (capture(event) && !disabled) setDragging(true);
      },
      onDragLeave: () => {
        depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) setDragging(false);
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        if (!capture(event)) return;
        reset();
        if (disabled) return;
        try { onFile(droppedPsd(event.dataTransfer.files)); }
        catch (error) { onError(error instanceof Error ? error.message : String(error)); }
      }
    }
  };
}
