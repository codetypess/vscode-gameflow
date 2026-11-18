import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { fitRegionDialog, resizeRegionDialog, type RegionDialogFrame } from "./region-geometry";

const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });
type WindowGesture = { pointerId: number; x: number; y: number; frame: RegionDialogFrame; target: HTMLElement; resize: boolean };

/** Window layout is temporary UI state, separate from the authored export region. */
export function useRegionDialog(dialog: RefObject<HTMLDialogElement>) {
  const [frame, setFrame] = useState<RegionDialogFrame | null>(null);
  const [active, setActive] = useState(false);
  const gesture = useRef<WindowGesture | null>(null);
  const measure = () => {
    const rect = dialog.current!.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  };
  const release = (g: WindowGesture) => {
    gesture.current = null; setActive(false);
    if (g.target.hasPointerCapture(g.pointerId)) g.target.releasePointerCapture(g.pointerId);
  };
  useEffect(() => {
    setFrame(fitRegionDialog(measure(), viewport()));
    const cancel = () => {
      const g = gesture.current; if (!g) return;
      setFrame(fitRegionDialog(g.frame, viewport())); release(g);
    };
    const resize = () => { cancel(); setFrame(old => old && fitRegionDialog(old, viewport())); };
    window.addEventListener("blur", cancel); window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("blur", cancel); window.removeEventListener("resize", resize);
      const g = gesture.current; gesture.current = null;
      if (g?.target.hasPointerCapture(g.pointerId)) g.target.releasePointerCapture(g.pointerId);
    };
  }, []);
  const begin = (event: PointerEvent<HTMLElement>, resize = false) => {
    if (event.button !== 0 || gesture.current || (!resize && (event.target as HTMLElement).closest("button"))) return;
    event.preventDefault();
    if (resize) event.currentTarget.focus();
    gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, frame: measure(), target: event.currentTarget, resize };
    event.currentTarget.setPointerCapture(event.pointerId); setActive(true);
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    const g = gesture.current; if (!g || g.pointerId !== event.pointerId) return;
    const delta = { x: event.clientX - g.x, y: event.clientY - g.y };
    setFrame(g.resize ? resizeRegionDialog(g.frame, delta, viewport()) : fitRegionDialog({ ...g.frame, x: g.frame.x + delta.x, y: g.frame.y + delta.y }, viewport()));
  };
  const finish = (event: PointerEvent<HTMLElement>, cancel = false) => {
    const g = gesture.current; if (!g || g.pointerId !== event.pointerId) return;
    if (cancel) setFrame(fitRegionDialog(g.frame, viewport())); else move(event);
    release(g);
  };
  const resizeKeydown = (event: KeyboardEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (event.ctrlKey || event.metaKey || event.altKey || gesture.current) return;
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!delta) return;
    event.preventDefault(); const step = event.shiftKey ? 50 : 10;
    setFrame(resizeRegionDialog(measure(), { x: delta[0] * step, y: delta[1] * step }, viewport()));
  };
  return {
    style: frame ? { left: frame.x, top: frame.y, width: frame.width, height: frame.height, margin: 0, right: "auto", bottom: "auto" } : undefined,
    active, resizeKeydown,
    titleEvents: { onPointerDown: (event: PointerEvent<HTMLElement>) => begin(event), onPointerMove: move, onPointerUp: (event: PointerEvent<HTMLElement>) => finish(event), onPointerCancel: (event: PointerEvent<HTMLElement>) => finish(event, true), onLostPointerCapture: (event: PointerEvent<HTMLElement>) => finish(event, true) },
    resizeEvents: { onPointerDown: (event: PointerEvent<HTMLElement>) => begin(event, true), onPointerMove: move, onPointerUp: (event: PointerEvent<HTMLElement>) => finish(event), onPointerCancel: (event: PointerEvent<HTMLElement>) => finish(event, true), onLostPointerCapture: (event: PointerEvent<HTMLElement>) => finish(event, true) }
  };
}
