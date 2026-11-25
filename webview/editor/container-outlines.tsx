import { useId } from "react";
import type { GameFlowNode, GameFlowPage } from "../../shared/model";
import { inheritedFlag } from "../../shared/editor-ops";
import type { LayoutResult } from "../../shared/ui-layout";
import type { Point } from "../../shared/ui-transform";

const points = (polygon: Point[]) => polygon.map(point => `${point.x},${point.y}`).join(" ");

/** Draw above node content while sharing its transformed geometry and ancestor clips. */
export function ContainerOutlines({ page, nodes, geometry }: { page: GameFlowPage; nodes: GameFlowNode[]; geometry: LayoutResult }) {
  const id = useId();
  return <svg className="container-outlines" aria-hidden="true" focusable="false">
    {nodes.map((node, index) => {
      const resolved = geometry.nodes.get(node.id);
      if (inheritedFlag(page, node, "hidden") || !resolved?.inverse) return null;
      const clipId = `${id}-${index}`;
      return <g key={node.id}>
        {resolved.clipPolygon ? <defs><clipPath id={clipId}><polygon points={points(resolved.clipPolygon)} /></clipPath></defs> : null}
        <polygon points={points(resolved.corners)} clipPath={resolved.clipPolygon ? `url(#${clipId})` : undefined} fill="none" stroke="currentColor" strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
      </g>;
    })}
  </svg>;
}
