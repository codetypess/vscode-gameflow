import type { ReactNode } from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "../../lib/utils";

export function ScrollArea({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return <ScrollAreaPrimitive.Root type="scroll" scrollHideDelay={800} className={cn("ui-scroll-area", className)}>
    <ScrollAreaPrimitive.Viewport className="ui-scroll-area-viewport" role="region" aria-label={label} tabIndex={0}
      onKeyDown={event => {
        // Let the native viewport scroll without nudging the selected canvas node.
        if (event.target === event.currentTarget && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) event.stopPropagation();
      }}>
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollAreaPrimitive.Scrollbar orientation="vertical" className="ui-scroll-area-bar">
      <ScrollAreaPrimitive.Thumb className="ui-scroll-area-thumb" />
    </ScrollAreaPrimitive.Scrollbar>
  </ScrollAreaPrimitive.Root>;
}
