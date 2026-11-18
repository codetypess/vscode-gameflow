import type { GameFlowNode } from "../../shared/model";
import { isSliceResourcePath, type SliceResourceRef } from "../../shared/slice-resources";
import { Button } from "../components/ui/button";
import { Field } from "../editor/fields";
import { useOverrideAttributes } from "../editor/override-properties";
import { useSliceResources } from "./resource-context";

export function SliceBindingField({ node, disabled, onChange, onPsd }: { node: GameFlowNode; disabled: boolean; onChange(ref?: SliceResourceRef): void; onPsd(): void }) {
  const resources = useSliceResources(), attributes = useOverrideAttributes("切图资源"), current = node.sliceResource ? resources.resolve(node.sliceResource) : null;
  const choices = [...resources.entries].filter(([path]) => isSliceResourcePath(path));
  return <section className="slice-binding" {...attributes}>
    <div className="property-section-title">切图资源</div>
    <label className="property-field"><span>选择切图</span><select aria-label="选择切图资源" disabled={disabled} value={node.sliceResource?.path ?? ""} onChange={event => {
      const path = event.target.value, description = resources.entries.get(path)?.description;
      onChange(path ? { path, ...(description ? { source: { documentId: description.source.documentId, layerId: description.layerId } } : {}) } : undefined);
    }}><option value="">未绑定</option>{node.sliceResource && !choices.some(([path]) => path === node.sliceResource!.path) ? <option value={node.sliceResource.path}>{node.sliceResource.path}</option> : null}
      {choices.map(([path, entry]) => <option key={path} value={path}>{entry.description?.layerName ?? path} · {path}{entry.status === "error" ? "（异常）" : ""}</option>)}
    </select></label>
    <Field label="资源路径" value={node.sliceResource?.path ?? ""} disabled={disabled} validate={value => !value.trim() || isSliceResourcePath(value.trim())} onCommit={value => onChange(value.trim() ? { path: value.trim() } : undefined)} />
    {current ? <p className={`property-hint${current.status === "error" ? " slice-resource-error" : ""}`} role="status">{current.status === "ready" ? `${current.description.width} × ${current.description.height} · ${current.description.nineGrid ? "九宫格 · " : ""}${current.description.source.psdName} / ${current.description.layerName}` : current.status === "loading" ? "正在生成或装载资源…" : current.error}</p> : <p className="property-hint">打开 PSD 并标记切图后选择，或填写已导出资源的相对路径。</p>}
    <div className="slice-binding-actions"><Button size="sm" variant="outline" onClick={onPsd}>打开切图工作区</Button>{node.sliceResource ? <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onChange(undefined)}>解除绑定</Button> : null}</div>
  </section>;
}
