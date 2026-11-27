import { useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { panelMinimum, panelWidthKey, type PanelMode, type PanelSide, type PanelWidths } from "../../shared/panel-width";
import type { PanelPreferences, placeCanvasPanels } from "../lib/canvas-panels";
import { isBrowserPreview, postHostMessage } from "../vscode-api";

type Layout = ReturnType<typeof placeCanvasPanels>;
export function usePanelWidths(mode: PanelMode, saved?: PanelWidths) {
  const minimum = panelMinimum[mode];
  function read(side: PanelSide) {
    if (!isBrowserPreview) return saved?.[side] ?? minimum;
    try {
      const value = Number(localStorage.getItem(panelWidthKey(mode, side)));
      if (Number.isSafeInteger(value) && value >= minimum) return value;
    } catch { /* Use the default when local storage is unavailable. */ }
    return minimum;
  }
  const [widths, setWidths] = useState<PanelWidths>(() => ({
    left: read("left"), right: read("right")
  }));
  const [preview, setPreview] = useState<PanelPreferences>();
  useLayoutEffect(() => {
    if (saved) setWidths(saved);
  }, [saved?.left, saved?.right]);

  function handles(layout: Layout, side: PanelSide) {
    const otherWidth = layout[side === "left" ? "right" : "left"].width;
    const panel = layout[side];
    const outerRoom = side === "left" ? panel.left - layout.margin : layout.edges.viewportWidth - layout.margin - panel.left - panel.width;
    const innerRoom = layout.edges.viewportWidth - 2 * layout.margin - otherWidth - layout.separation - panel.width - outerRoom;
    return (["left", "right"] as const).map(edge => <PanelResizeEdge key={edge} edge={edge} side={side} width={panel.width}
      minimum={Math.min(minimum, panel.width)} maximum={Math.floor(panel.width + (edge === side ? outerRoom : innerRoom))}
      onWidth={(width, save) => {
        if (!save) {
          const edges = { ...layout.edges };
          if (edge === side) edges[side] += (side === "left" ? -1 : 1) * (width - panel.width);
          setPreview({ preferredWidths: { ...widths, [side]: width }, resizeAnchor: { edges, side, otherWidth } });
          return;
        }
        setPreview(undefined);
        if (width === panel.width) return;
        setWidths(previous => ({ ...previous, [side]: width }));
        if (!isBrowserPreview) { postHostMessage({ type: "panelWidth", mode, side, width }); return; }
        try { localStorage.setItem(panelWidthKey(mode, side), String(width)); }
        catch { /* Keep the width for the current session. */ }
      }} />);
  }
  return { preferences: preview ?? { preferredWidths: widths }, handles };
}

interface EdgeProps {
  side: PanelSide; edge: PanelSide; width: number; minimum: number; maximum: number;
  onWidth: (width: number, save: boolean) => void;
}

function PanelResizeEdge(props: EdgeProps) {
  const { side, edge, width, minimum, maximum } = props;
  const gesture = useRef<{ id: number; x: number; start: EdgeProps; last: number } | null>(null);
  const direction = edge === "left" ? -1 : 1;
  const label = `调整${side === "left" ? "图层" : "属性"}面板宽度（${edge === "left" ? "左" : "右"}边缘）`;
  function move(event: PointerEvent<HTMLDivElement>, finish = false) {
    const drag = gesture.current;
    if (!drag || drag.id !== event.pointerId) return;
    event.stopPropagation();
    const { start } = drag;
    const delta = direction * (event.clientX - drag.x);
    const next = delta === 0 ? start.width : Math.max(start.minimum, Math.min(start.maximum, Math.round(start.width + delta)));
    if (finish || next !== drag.last) start.onWidth(next, finish);
    drag.last = next;
    if (finish) gesture.current = null;
  }
  function cancel(event: PointerEvent<HTMLDivElement>) {
    const drag = gesture.current;
    if (drag?.id !== event.pointerId) return;
    event.stopPropagation();
    gesture.current = null;
    drag.start.onWidth(drag.last, true);
  }
  return <div className="panel-resize-edge" data-edge={edge} role="separator" aria-orientation="vertical"
    aria-label={label} title={label} tabIndex={0} aria-valuenow={Math.round(width)} aria-valuemin={Math.round(minimum)} aria-valuemax={Math.max(Math.round(width), maximum)}
    onPointerDown={event => {
      if (event.button !== 0 || !event.isPrimary || gesture.current) return;
      event.preventDefault(); event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = { id: event.pointerId, x: event.clientX, start: props, last: width };
    }}
    onPointerMove={event => move(event)} onPointerUp={event => move(event, true)} onPointerCancel={cancel} onLostPointerCapture={cancel}
    onKeyDown={event => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault(); event.stopPropagation();
      const next = Math.max(minimum, Math.min(maximum, Math.round(width) + (event.key === "ArrowLeft" ? -8 : 8) * direction));
      if (next !== width) props.onWidth(next, true);
    }} />;
}
