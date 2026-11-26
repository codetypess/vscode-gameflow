import { Fragment, createContext, useContext, useId, type CSSProperties, type ReactNode } from "react";
import type { GameFlowNode } from "../../shared/model";
import type { PsdPaint, PsdPaintEffect } from "../../shared/psd-paint";

export const ImportedPaint = createContext<ReadonlyMap<string, PsdPaint>>(new Map());
export const ImportedImageCorrections = createContext<ReadonlyMap<string, string>>(new Map());

export function EffectFilter({ id, effects }: { id: string; effects: PsdPaintEffect[] }) {
  return <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute", pointerEvents: "none" }}><defs>
    <filter id={id} x="-100%" y="-100%" width="300%" height="300%" colorInterpolationFilters="sRGB">
      {effects.map((e,i) => {
        const previous = i ? "paint" + (i-1) : "SourceGraphic";
        const result = "paint" + i;
        if (e.kind === "shadow") return <Fragment key={i}>
          <feGaussianBlur in="SourceAlpha" stdDeviation={e.radius} /><feOffset dx={e.x} dy={e.y} result="shadow"/>
          <feFlood floodColor={e.color} floodOpacity={e.opacity}/><feComposite in2="shadow" operator="in" result="ink"/>
          <feComposite in={previous} in2="ink" operator="over" result={result}/>
        </Fragment>;
        const r = e.kind === "center" ? e.radius / 2 : e.radius;
        return <Fragment key={i}>
          {e.kind === "innerShadow" ? <>
            <feGaussianBlur in="SourceAlpha" stdDeviation={e.radius}/><feOffset dx={e.x} dy={e.y} result="offset"/>
            <feComposite in="SourceAlpha" in2="offset" operator="out" result="edge"/>
          </> : <>
            <feMorphology in="SourceAlpha" operator="dilate" radius={r} result="outer"/>
            <feMorphology in="SourceAlpha" operator="erode" radius={r} result="inner"/>
            <feComposite in={e.kind === "inside" ? "SourceAlpha" : "outer"} in2={e.kind === "outside" ? "SourceAlpha" : "inner"} operator="out" result="edge"/>
          </>}
          <feFlood floodColor={e.color} floodOpacity={e.opacity}/><feComposite in2="edge" operator="in"/>
          <feComposite in2={previous} operator="over" result={result}/>
        </Fragment>;
      })}
    </filter></defs></svg>;
}

function PaintGroup({ paint, children }: { paint: PsdPaint; children: ReactNode }) {
  const id = "psd-fx-" + useId().replace(/[^a-z0-9_-]/gi, "");
  const effects = paint.effects;
  return <>{effects?.length ? <EffectFilter id={id} effects={effects}/> : null}
    <div className="psd-paint-group" style={{ filter: effects?.length ? `url(#${id})` : undefined,
      mixBlendMode: paint.blend as CSSProperties["mixBlendMode"] }}>{children}</div></>;
}

/** Nodes keep their resolved page-space transforms inside effect groups. */
export function PaintedNodes({ nodes, draw, usesArt }: { nodes: GameFlowNode[]; draw: (node: GameFlowNode) => ReactNode; usesArt: boolean }) {
  const parts = useContext(ImportedPaint);
  if (!parts.size) return <>{nodes.map(draw)}</>;
  const children = new Map<string | undefined, GameFlowNode[]>(), ids = new Set(nodes.map(n => n.id));
  const byKey = new Map<number, GameFlowNode>();
  for (const node of nodes) {
    const parent = node.parentId && ids.has(node.parentId) ? node.parentId : undefined;
    const siblings = children.get(parent) ?? [];
    siblings.push(node); children.set(parent, siblings);
    const part = parts.get(node.id);
    if (part) byKey.set(part.key, node);
  }
  const branch = (node: GameFlowNode): ReactNode => {
    if (node.hidden) return null;
    const part = parts.get(node.id);
    if (part?.clipBase !== undefined && byKey.get(part.clipBase)?.hidden) return null;
    const content = <>{draw(node)}{children.get(node.id)?.map(branch)}</>;
    if (node.type === "container" && part && (part.effects?.length || part.blend) && !(usesArt && (node.image?.art || node.sliceResource))) {
      return <PaintGroup key={node.id} paint={part}>{content}</PaintGroup>;
    }
    return <Fragment key={node.id}>{content}</Fragment>;
  };
  return <>{children.get(undefined)?.map(branch)}</>;
}
