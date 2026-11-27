import { useLayoutEffect, useState, type RefObject } from "react";
import { placeCanvasPanels, type PanelPreferences } from "../lib/canvas-panels";

import { panelMinimum } from "../../shared/panel-width";

export const PROTOTYPE_PANELS = { leftWidth: panelMinimum.prototype, rightWidth: panelMinimum.prototype, footer: 0, minFollowHeight: 400 };

export function useFollowingPanels(viewport: RefObject<HTMLDivElement>, active: boolean, content: { x: number; y: number; width: number } | null, showTree: boolean, showInspector: boolean, preferences: PanelPreferences, topInset = 0) {
  const [leftElement, leftRef] = useState<HTMLElement | null>(null);
  const [rightElement, rightRef] = useState<HTMLElement | null>(null);
  const [measurement, setMeasurement] = useState({ width: 0, height: 0, left: 0, right: 0 });
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!active || !element) return;
    const controls = [...element.querySelectorAll<HTMLElement>(".canvas-toolbar")];
    const measure = () => {
      const width = element.clientWidth, fullHeight = element.clientHeight;
      if (!width || !fullHeight) return;
      const originY = element.getBoundingClientRect().top;
      // Only the bottom toolbar limits panel height; top controls use topInset.
      const height = Math.max(0, Math.min(fullHeight, ...controls.filter(control => control.offsetHeight > 0).map(control => control.getBoundingClientRect().top - originY)));
      const left = leftElement?.getBoundingClientRect().height ?? 0, right = rightElement?.getBoundingClientRect().height ?? 0;
      setMeasurement(old => old.width === width && old.height === height && old.left === left && old.right === right ? old : { width, height, left, right });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    controls.forEach(control => observer.observe(control));
    if (leftElement) observer.observe(leftElement);
    if (rightElement) observer.observe(rightElement);
    return () => observer.disconnect();
  }, [active, viewport, leftElement, rightElement]);
  const available = { ...measurement, height: Math.max(0, measurement.height - topInset) };
  const positions = placeCanvasPanels(available, content ? { ...content, y: content.y - topInset } : { x: 0, y: 0, width: 0 }, measurement, {
    ...PROTOTYPE_PANELS, ...preferences, leftWidth: showTree ? PROTOTYPE_PANELS.leftWidth : 0, rightWidth: showInspector ? PROTOTYPE_PANELS.rightWidth : 0
  });
  const visibility = measurement.width && content ? "visible" as const : "hidden" as const;
  return { positions, leftRef, rightRef, leftStyle: { ...positions.left, top: positions.left.top + topInset, right: "auto", visibility }, rightStyle: { ...positions.right, top: positions.right.top + topInset, right: "auto", visibility } };
}
