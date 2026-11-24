import { useId, type ReactNode } from "react";
import { fieldNames, hasSyncedValue, type Change, type Decision, type Side, type SyncNode } from "../../shared/page-sync";
import { prefabChangeName, type PrefabReview } from "../../shared/prefab-sync";

const sides = { proto: "原型", psd: "预制体" };
const baselineHelp = "此属性最近一次同步一致时的值，保存在当前画布页面的 prefabSync 记录中。";

export function changeTitle(change: Change) {
  return prefabChangeName(change) ?? fieldNames[change.field];
}

export function changeValue(tree: SyncNode[], change: Change): string {
  const node = tree.find(item => item.id === change.id);
  if (!node) return "不存在";
  const { field, property } = change;
  if (field === "exist") return node.name;
  if (field === "parent") return tree.find(item => item.id === node.parent)?.name ?? "页面";
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

export function describeDecision(review: PrefabReview, change: Change, decision?: Decision) {
  if (!decision) return "待决定";
  if (decision === "skip") return "本轮跳过";
  const target = decision === "proto" ? "预制体" : "原型";
  const source = review.comparison[decision];
  if (change.field === "exist") {
    return source.some(node => node.id === change.id) ? "补到" + target : "从" + target + "删除";
  }
  return "把" + target + "改为「" + changeValue(source, change) + "」";
}

export function PrefabSyncChange({ review, change, decision, disabled, onChoose, children }: {
  review: PrefabReview;
  change: Change;
  decision?: Decision;
  disabled: boolean;
  onChoose: (decision: Decision) => void;
  children?: ReactNode;
}) {
  const { comparison } = review;
  const groupName = useId();
  const old = comparison.base?.nodes.find(node => node.id === change.id);
  const recorded = hasSyncedValue(old, change.field, change.property);
  const previous = recorded ? changeValue(comparison.base!.nodes, change) : "未记录";
  const title = changeTitle(change);
  const changedSide = change.suggested === "skip" ? undefined : change.suggested;
  const structure = change.field === "exist";
  const valueFrom = (side: Side) => changeValue(comparison[side], change);
  const decisions: Decision[] = ["proto", "psd", "skip"];
  let status = recorded ? "双方已改" : "来源待定";
  if (structure) {
    const onPrototype = comparison.proto.some(node => node.id === change.id);
    const present = sides[onPrototype ? "proto" : "psd"];
    if (change.kind === "delete") status = sides[onPrototype ? "psd" : "proto"] + "已删除";
    else status = comparison.base ? present + "新增" : "仅" + present + "存在";
  } else if (changedSide) {
    status = sides[changedSide] + "已改";
  }
  return <fieldset className="prefab-change" disabled={disabled}>
    <legend><span>{title}</span><span className="prefab-change-source">{status}</span></legend>
    <dl className="prefab-change-values">
      {changedSide && !structure ? <>
        <dt>{sides[changedSide]}</dt>
        <dd><span className="prefab-previous" title={baselineHelp}><span className="sr-only">上次同步值 </span>{previous}</span>
          <span className="prefab-change-arrow"> → </span>{valueFrom(changedSide)}</dd>
      </> : <>
        {(!structure || recorded) && <><dt title={baselineHelp}>上次同步值</dt><dd>{previous}</dd></>}
        <dt>原型</dt><dd>{valueFrom("proto")}</dd>
        <dt>预制体</dt><dd>{valueFrom("psd")}</dd>
      </>}
    </dl>
    {children}
    <div className="prefab-change-choice">
      <span>本轮</span>
      <div role="radiogroup" aria-label={title + "的同步方向"}>
        {decisions.filter(side => change.kind !== "add" || side === "skip" || comparison[side].some(node => node.id === change.id))
          .map(side => <label key={side}>
            <input type="radio" name={groupName} value={side} checked={decision === side} onChange={() => onChoose(side)} />
            <span>{describeDecision(review, change, side)}{change.suggested === side && <small>推荐</small>}</span>
          </label>)}
      </div>
    </div>
  </fieldset>;
}
