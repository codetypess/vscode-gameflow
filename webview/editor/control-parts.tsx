import { useOverrideAttributes } from "./override-properties";
import type { GameFlowNode, GameFlowPage } from "../../shared/model";
import { Trash2 } from "lucide-react";
import { controlSelected, hasNodeSkin, radioGroupFor, setControlSelection, setRadioOptions, skinOwner, sliderOwner, supportsNodeSkin } from "../../shared/ui-parts";
import { inheritedFlag } from "../../shared/editor-ops";
import { Button } from "../components/ui/button";
import { NodeReferenceField } from "./node-reference-field";

export function ControlPartsProperties({ page, node, locked, onNode, onPage, onCreateParts }: {
  page: GameFlowPage; node: GameFlowNode; locked: boolean;
  onNode: (id: string, patch: Partial<GameFlowNode>) => void;
  onPage: (transform: (page: GameFlowPage) => GameFlowPage) => void;
  onCreateParts: () => void;
}) {
  const skinOverride=useOverrideAttributes("控件部件",["widget.skinNodeId"]), selectedOverride=useOverrideAttributes("选中状态"), optionsOverride=useOverrideAttributes("单选组成员",["widget.optionNodeIds","widget.selectedIndex"]), indexOverride=useOverrideAttributes("当前选项");
  const owner = skinOwner(page, node), group = radioGroupFor(page, node.id);
  const skinLabel = node.type === "slider" ? "滑块节点" : "选中标记";
  const options = node.widget?.optionNodeIds ?? [];
  const changeOptions = (next: (string | null)[]) => onPage(p => setRadioOptions(p, node.id, next));
  return <>
    {owner ? <p className="property-hint">{sliderOwner(page, node) ? `位置由「${owner.name}」的滑块值控制。` : `显示状态由「${owner.name}」的选中状态控制。`}删除或移出控件会解除皮肤引用。</p> : null}
    {node.type === "button" ? <p className="property-hint">按钮可独立使用。需要文案时，在图层树右键添加文字子节点。</p> : null}
    {supportsNodeSkin(node) ? <details className="property-details" open><summary>控件部件</summary>
      <div {...skinOverride} className="property-field"><span>{skinLabel}</span><NodeReferenceField page={page} owner={node} kind="skin" label={skinLabel} disabled={locked} value={node.widget?.skinNodeId ?? null} onChange={skinNodeId => onNode(node.id, { widget: { ...node.widget, skinNodeId } })} /></div>
      <p className="property-hint">{node.type === "slider" ? "选择直接子节点；滑块根不能设置相对约束。" : "选择直接子节点作为选中时显示的标记。"}</p>
      {!hasNodeSkin(node) ? <Button variant="outline" size="sm" disabled={locked} onClick={onCreateParts}>建立默认部件</Button> : null}
      {node.type === "checkbox" || node.type === "radio" ? <label {...selectedOverride} className="property-toggle"><input type="checkbox" aria-label="选中状态" disabled={locked || !!(group && inheritedFlag(page, group, "locked"))} checked={controlSelected(page, node)} onChange={event => onPage(p => setControlSelection(p, node.id, event.target.checked))} /><span>选中状态</span></label> : null}
      {group ? <p className="property-hint">由「{group.name}」管理互斥选择，切换选中状态会更新该组。</p> : null}
    </details> : null}
    {node.type === "radioGroup" ? <details {...optionsOverride} className="property-details" open><summary>单选组</summary>
      <label {...indexOverride} className="property-field"><span>当前选项</span><select aria-label="单选组当前选项" disabled={locked} value={node.widget?.selectedIndex ?? -1} onChange={event => onNode(node.id, { widget: { ...node.widget, selectedIndex: Number(event.target.value) } })}>
        <option value={-1}>未选中</option>
        {options.map((id, index) => id ? <option key={index} value={index}>{index}. {page.nodes.find(item => item.id === id)?.name}</option> : null)}
      </select></label>
      {options.map((id, index) => <div key={index} className="radio-option-row">
        <Button variant="ghost" size="icon" className="radio-option-remove" aria-label={`移除成员 ${index}`} title={`移除成员 ${index}`} disabled={locked} onClick={() => changeOptions(options.filter((_, i) => i !== index))}><Trash2 size={14} aria-hidden="true" /></Button>
        <span className="radio-option-number">{index}</span>
        <NodeReferenceField page={page} owner={node} kind="radioOption" label={`单选组成员 ${index}`} disabled={locked} value={id} onChange={nextId => changeOptions(options.map((value, i) => i === index ? nextId : value))} />
      </div>)}
      <div className="radio-option-row"><Button className="radio-option-add" variant="outline" size="sm" disabled={locked || options.length >= 1000} onClick={() => changeOptions([...options, null])}>添加选项</Button></div>
      <p className="property-hint">成员索引从 0 开始；图层移动不改变分组。移除成员保留其当前选中状态。</p>
    </details> : null}
  </>;
}
