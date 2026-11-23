import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

interface DialogSize {
  width: number;
  height: number;
}

interface Options {
  storageKey: string;
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
  viewportMargin?: number;
}

interface ResizeGesture extends DialogSize {
  pointerId: number;
  x: number;
  y: number;
  edge: SyncDialogResizeEdge;
}

export const syncDialogResizeEdges = ["n", "e", "s", "w", "ne", "se", "sw", "nw"] as const;
export type SyncDialogResizeEdge = typeof syncDialogResizeEdges[number];

function readSize({ storageKey, defaultWidth, defaultHeight }: Options): DialogSize {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    const width = Number(saved?.width ?? saved?.w);
    const height = Number(saved?.height ?? saved?.h);
    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) return { width, height };
  } catch { /* Use the default size when Webview storage is unavailable. */ }
  return { width: defaultWidth, height: defaultHeight };
}

export function useSyncDialogSize(options: Options) {
  const preferred = useRef<DialogSize | null>(null);
  if (!preferred.current) preferred.current = readSize(options);
  const [size, setSize] = useState<DialogSize>(() => {
    const margin = options.viewportMargin ?? 16;
    return {
      width: Math.min(preferred.current!.width, Math.max(1, innerWidth - margin)),
      height: Math.min(preferred.current!.height, Math.max(1, innerHeight - margin)),
    };
  });
  const latest = useRef(preferred.current);
  const gesture = useRef<ResizeGesture | null>(null);

  const save = () => {
    try { localStorage.setItem(options.storageKey, JSON.stringify(latest.current)); }
    catch { /* Keep the size for this session when Webview storage is unavailable. */ }
  };
  const resize = (event: ReactPointerEvent<HTMLElement>) => {
    const start = gesture.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const margin = options.viewportMargin ?? 16;
    const maxWidth = Math.max(1, innerWidth - margin);
    const maxHeight = Math.max(1, innerHeight - margin);
    const deltaX = 2 * (event.clientX - start.x);
    const deltaY = 2 * (event.clientY - start.y);
    const width = start.edge.includes("e") ? start.width + deltaX : start.edge.includes("w") ? start.width - deltaX : start.width;
    const height = start.edge.includes("s") ? start.height + deltaY : start.edge.includes("n") ? start.height - deltaY : start.height;
    const next = {
      width: Math.min(maxWidth, Math.max(Math.min(options.minWidth, maxWidth), width)),
      height: Math.min(maxHeight, Math.max(Math.min(options.minHeight, maxHeight), height)),
    };
    latest.current = next;
    setSize(next);
  };
  const finish = (event: ReactPointerEvent<HTMLElement>, applyFinalPosition: boolean) => {
    if (!gesture.current || gesture.current.pointerId !== event.pointerId) return;
    if (applyFinalPosition) resize(event);
    gesture.current = null;
    save();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  useEffect(() => save, []);

  return {
    size,
    resizeEdgeProps: (edge: SyncDialogResizeEdge) => ({
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        event.preventDefault();
        const bounds = event.currentTarget.closest("dialog")?.getBoundingClientRect();
        gesture.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          edge,
          width: bounds?.width ?? latest.current.width,
          height: bounds?.height ?? latest.current.height,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: resize,
      onPointerUp: (event: ReactPointerEvent<HTMLElement>) => finish(event, true),
      onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => finish(event, false),
      onLostPointerCapture: (event: ReactPointerEvent<HTMLElement>) => finish(event, false),
    }),
  };
}
