import { useId, type ReactNode } from "react";
import { hasSyncedValue, type Change, type Comparison, type Decision, type Side, type SyncNode } from "../../shared/page-sync";
import { COMPONENTS } from "../../shared/ui-components";

function syncPath(tree: SyncNode[], id: string, pageName: string) {
  const path = [];
  const visited = new Set<string>();
  for (let node = tree.find(item => item.id === id); node && !visited.has(node.id); node = tree.find(item => item.id === node?.parent)) {
    visited.add(node.id);
    path.unshift(node.name);
  }
  return [pageName, ...path].join(" / ");
}

export function changeValue(tree: SyncNode[], change: Change, pageName?: string): string {
  const node = tree.find(item => item.id === change.id);
  if (!node) return "不存在";
  if (change.replacement && change.field === "exist") {
    if (change.representation === "psd-list-cells") return node.layer ? "空列表组" : "引用的列表项模板";
    if (change.representation === "psd-default-image") return node.layer ? "旧版默认图片" : "左上角山景图标";
    if (change.representation === "psd-smart-object") return node.layer ? "普通图层组" : "组件实例";
    if (change.representation === "psd-component-layers") return node.layer ? "缺少这些图层" : change.addedLayers!.join("、");
    if (change.representation === "component-root") return change.members.filter(id => tree.some(item => item.id === id)).length < change.members.length ? "单一组件根" : "额外 UIBox 包装层";
    const count = change.members.filter(id => tree.some(item => item.id === id)).length;
    return count < change.members.length ? "Prefab 引用" : "展开节点（" + count + " 个）";
  }
  const { field, property } = change;
  if (field === "exist") {
    if (!pageName) return node.name;
    return syncPath(tree, node.id, pageName) + " (" + COMPONENTS[node.type].laya + ")";
  }
  if (field === "parent") {
    if (pageName) return syncPath(tree, node.parent, pageName);
    return tree.find(item => item.id === node.parent)?.name ?? "页面";
  }
  if (field === "order") return "第 " + (tree.filter(item => !item.root && item.parent === node.parent).indexOf(node) + 1) + " 位";
  const value = field === "property" ? node.properties?.[property ?? ""] : node[field];
  if (value == null) return "未设置";
  if (value === "") return "空文本";
  if (typeof value === "boolean") {
    if (property === "widget.wordWrap") return value ? "开启" : "关闭";
    return value ? "是" : "否";
  }
  if (property === "style.fontSize" || property === "widget.leading") return value + " px";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function describeDecision(comparison: Comparison, change: Change, decision?: Decision, targetLabel = "预制体", pageName?: string) {
  if (!decision) return "待决定";
  if (decision === "skip") return "本轮跳过";
  if (change.prefabImage) return change.prefabImage.planned ? "更新预制体图片" : "清空预制体图片";
  if (change.componentSource) return decision === "proto" ? "更新智能对象" : "保留当前内嵌内容";
  if (change.replacement && change.field === "exist") {
    if (decision !== change.replacement) return "本轮跳过";
    if (change.representation === "psd-list-cells") return "按引用原型补齐列表项";
    if (change.representation === "psd-default-image") return "更新默认图片";
    if (change.representation === "psd-smart-object") return "转换为智能对象";
    if (change.representation === "psd-component-layers") return "补入智能对象";
    return change.representation === "component-root" ? "移除预制体的额外 UIBox 包装层" : "把预制体替换为 Prefab 引用";
  }
  const target = decision === "proto" ? targetLabel : "原型";
  const source = comparison[decision];
  if (change.field === "exist") {
    const node = source.find(node => node.id === change.id);
    if (node && pageName) return "补到" + target + "的「" + syncPath(source, node.parent, pageName) + "」";
    return node ? "补到" + target : "从" + target + "删除";
  }
  return "把" + target + "改为「" + changeValue(source, change, pageName) + "」";
}

export function SyncChange({ comparison, change, title, decision, disabled, onChoose, children, targetLabel, pageName, fixedSource }: {
  comparison: Comparison;
  title: string;
  targetLabel: string;
  pageName?: string;
  fixedSource?: Side;
  change: Change;
  decision?: Decision;
  disabled: boolean;
  onChoose: (decision: Decision) => void;
  children?: ReactNode;
}) {
  const sides = { proto: "原型", psd: targetLabel };
  const showBoth = pageName !== undefined;
  const baselineHelp = showBoth ? "此项最近一次同步一致时的值。" : "此属性最近一次同步一致时的值，保存在当前画布页面的 prefabSync 记录中。";
  const groupName = useId();
  const old = comparison.base?.nodes.find(node => node.id === change.id);
  const recorded = !change.prefabImage && !change.componentSource && !change.representation?.startsWith("psd-") && hasSyncedValue(old, change.field, change.property);
  const previous = recorded ? changeValue(comparison.base!.nodes, change, pageName) : "未记录";
  const changedSide = change.suggested === "skip" ? undefined : change.suggested;
  const structure = change.field === "exist";
  const valueFrom = (side: Side) => changeValue(comparison[side], change, pageName);
  const decisions: Decision[] = change.prefabImage ? ["proto", "skip"] : change.replacement ? [change.replacement, "skip"] : ["proto", "psd", "skip"];
  let status = recorded ? "双方已改" : "来源待定";
  if (change.prefabImage) status = "图片引用不同";
  else if (change.componentSource) status = change.componentSource.firstLink ? "首次关联" : change.componentSource.conflict ? "源和内嵌内容均有修改" : "组件源已更新";
  else if (change.representation === "psd-component-layers") status = "原型新增图层";
  else if (change.replacement && structure) status = "生成方式已变更";
  else if (structure) {
    const onPrototype = comparison.proto.some(node => node.id === change.id);
    const present = sides[onPrototype ? "proto" : "psd"];
    if (change.kind === "delete") status = sides[onPrototype ? "psd" : "proto"] + "已删除";
    else status = comparison.base ? present + "新增" : "仅" + present + "存在";
  } else if (changedSide) {
    status = sides[changedSide] + "已改";
  }
  return <fieldset className="prefab-change" disabled={disabled}>
    <legend><span>{title}</span><span className="prefab-change-source">{status}</span></legend>
    {change.prefabImage ? <dl className="prefab-change-values">
      <dt>导出图片</dt><dd>{change.prefabImage.planned || "无图片"}</dd>
      <dt>{targetLabel}</dt><dd>{change.prefabImage.current || "无图片"}</dd>
    </dl> : change.componentSource ? <dl className="prefab-change-values">
      <dt>组件源 PSD</dt><dd>{change.componentSource.name}</dd>
      <dt>页面 PSD</dt><dd>{change.componentSource.conflict ? "当前内嵌内容与来源不同" : "内嵌智能对象"}</dd>
    </dl> : <dl className="prefab-change-values">
      {changedSide && !structure && !showBoth ? <>
        <dt>{sides[changedSide]}</dt>
        <dd><span className="prefab-previous" title={baselineHelp}><span className="sr-only">上次同步值 </span>{previous}</span>
          <span className="prefab-change-arrow"> → </span>{valueFrom(changedSide)}</dd>
      </> : <>
        {!showBoth && (!structure || recorded) && <><dt title={baselineHelp}>上次同步值</dt><dd>{previous}</dd></>}
        <dt>原型</dt><dd>{valueFrom("proto")}</dd>
        <dt>{targetLabel}</dt><dd>{valueFrom("psd")}</dd>
      </>}
    </dl>}
    {showBoth && !change.componentSource && <details className="sync-change-baseline">
      <summary title={baselineHelp}>上次同步值</summary>
      <div>{previous}</div>
    </details>}
    {children}
    {fixedSource ? <p>{describeDecision(comparison, change, fixedSource, targetLabel, pageName)}</p> : <div className="prefab-change-choice">
      <span>本轮</span>
      <div role="radiogroup" aria-label={title + "的同步方向"}>
        {decisions.filter(side => showBoth || change.kind !== "add" || side === "skip" || comparison[side].some(node => node.id === change.id))
          .map(side => <label key={side}>
            <input type="radio" name={groupName} value={side} checked={decision === side} onChange={() => onChoose(side)} />
            <span>{describeDecision(comparison, change, side, targetLabel, pageName)}{change.suggested === side && <small>推荐</small>}</span>
          </label>)}
      </div>
    </div>}
  </fieldset>;
}
