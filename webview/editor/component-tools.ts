import { Box, Columns3, Rows3, Grid2X2, PanelTop, Type, ImageIcon, MousePointerClick, TextCursorInput, List, SquareCheck, CircleDot, Gauge, SlidersHorizontal, ListFilter } from "lucide-react";
import type { NodeType } from "../../shared/model";

export const COMPONENT_TOOLS = [
  { type: "container", icon: Box, key: "F" },
  { type: "text", icon: Type, key: "T" }, { type: "button", icon: MousePointerClick, key: "B" }, { type: "image", icon: ImageIcon, key: "I" },
  { type: "hbox", icon: Columns3, key: "" }, { type: "vbox", icon: Rows3, key: "" }, { type: "grid", icon: Grid2X2, key: "" }, { type: "panel", icon: PanelTop, key: "R" },
  { type: "input", icon: TextCursorInput, key: "" }, { type: "list", icon: List, key: "" }, { type: "checkbox", icon: SquareCheck, key: "" },
  { type: "radio", icon: CircleDot, key: "" }, { type: "progress", icon: Gauge, key: "" }, { type: "slider", icon: SlidersHorizontal, key: "" }, { type: "combo", icon: ListFilter, key: "" }
] satisfies { type: NodeType; icon: typeof Box; key: string }[];
