import type { CSSProperties } from "react";
import { ImageIcon } from "lucide-react";
import type { Frame, GameFlowNode, GameFlowPage } from "../../shared/model";
import { absoluteFrame, defaultStyle, inheritedFlag } from "../../shared/editor-ops";

export { orderedNodes } from "../../shared/editor-ops";

export function NodeView({ page, node, frame }: { page: GameFlowPage; node: GameFlowNode; frame?: Frame }) {
  if (inheritedFlag(page, node, "hidden")) return null;
  const appearance = { ...defaultStyle(node.type), ...node.style };
  const bounds = frame ?? absoluteFrame(page, node);
  let opacity = appearance.opacity;
  let parentId = node.parentId;
  while (parentId) {
    const parent = page.nodes.find((item) => item.id === parentId);
    if (!parent) break;
    opacity *= parent.style?.opacity ?? 1;
    parentId = parent.parentId;
  }
  const style: CSSProperties = {
    left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height,
    backgroundColor: appearance.fill, color: appearance.color,
    border: `${appearance.borderWidth}px solid ${appearance.borderColor}`,
    borderRadius: appearance.radius, fontSize: appearance.fontSize, fontWeight: appearance.fontWeight,
    textAlign: appearance.textAlign, justifyContent: appearance.textAlign === "left" ? "flex-start" : appearance.textAlign === "right" ? "flex-end" : "center",
    opacity
  };
  return <div className={`node-body node-${node.type}`} data-node-id={node.id} data-locked={inheritedFlag(page, node, "locked")} style={style}>
    {node.type === "image" ? node.imageData
      ? <img src={node.imageData} alt={node.name} draggable={false} />
      : <span className="image-placeholder"><ImageIcon size={24} /><small>图片</small></span>
      : node.type === "list" ? <div className="list-placeholder">{Array.from({ length: 8 }, (_, i) => <span key={i} />)}</div>
      : node.type === "container" || node.type === "rectangle" ? null
      : <span className="node-content">{node.text ?? node.name}</span>}
  </div>;
}
