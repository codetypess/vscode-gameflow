import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Box, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { COMPONENT_TOOLS } from "./component-tools";

export function NodeIcon({ type }: { type: string }) {
  const Icon = COMPONENT_TOOLS.find(item => item.type === type)?.icon ?? Box;
  return <Icon size={14} />;
}

interface LayerRowProps extends ComponentPropsWithoutRef<"div"> {
  name: string;
  depth: number;
  selected: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}

export function LayerRow({ name, depth, selected, expanded, onToggle, className, children, ...props }: LayerRowProps) {
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return <div {...props} role="treeitem" aria-level={depth + 1} aria-selected={selected} aria-expanded={expanded}
    className={cn("layer-row", selected && "is-selected", className)} style={{ paddingLeft: 8 + depth * 10 }}>
    <button type="button" className="tree-chevron" aria-label={`${expanded ? "折叠" : "展开"}${name}`} aria-expanded={expanded} disabled={expanded === undefined} onClick={onToggle}>
      {expanded !== undefined && <Chevron size={12} />}
    </button>
    {children}
  </div>;
}

export function LayerRoot({ name, rootType, marker, className, ...props }: ComponentPropsWithoutRef<"button"> & { name: string; rootType: string; marker?: ReactNode }) {
  const expanded = props["aria-expanded"];
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return <button type="button" {...props} className={cn("tree-root", className)}>
    <Box size={15} /><strong>{name}</strong>{marker}<small>{rootType}</small>
    {expanded !== undefined && <Chevron size={12} />}
  </button>;
}
