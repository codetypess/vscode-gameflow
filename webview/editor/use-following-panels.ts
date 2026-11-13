import { useLayoutEffect, useState, type RefObject } from "react";
import { placeCanvasPanels } from "../lib/canvas-panels";

export const PROTOTYPE_PANELS = { leftWidth: 280, rightWidth: 280, footer: 0, minFollowHeight: 400 };

export function useFollowingPanels(viewport: RefObject<HTMLDivElement>, active: boolean, content: { x: number; y: number; width: number } | null, showTree: boolean, showInspector: boolean) {
  const [leftElement, leftRef] = useState<HTMLElement | null>(null);
  const [rightElement, rightRef] = useState<HTMLElement | null>(null);
  const [measurement, setMeasurement] = useState({ width: 0, height: 0, left: 0, right: 0 });
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!active || !element) return;
    const controls = [...element.querySelectorAll<HTMLElement>(".canvas-toolbar, .canvas-zoom")];
    const measure = () => {
      const width = element.clientWidth, fullHeight = element.clientHeight;
      if (!width || !fullHeight) return;
      const originY = element.getBoundingClientRect().top;
      // Responsive styles can move zoom controls above the main toolbar.
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
  const positions = placeCanvasPanels(measurement, content ?? { x: 0, y: 0, width: 0 }, measurement, {
    ...PROTOTYPE_PANELS, leftWidth: showTree ? PROTOTYPE_PANELS.leftWidth : 0, rightWidth: showInspector ? PROTOTYPE_PANELS.rightWidth : 0
  });
  const visibility = measurement.width && content ? "visible" as const : "hidden" as const;
  return { leftRef, rightRef, leftStyle: { ...positions.left, right: "auto", visibility }, rightStyle: { ...positions.right, right: "auto", visibility } };
}
