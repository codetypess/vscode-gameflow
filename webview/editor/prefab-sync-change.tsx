import type { ComponentProps } from "react";
import { fieldNames, type Change, type Decision } from "../../shared/page-sync";
import { prefabChangeName, type PrefabReview } from "../../shared/prefab-sync";
import { describeDecision as describeSyncDecision, SyncChange } from "./sync-change";

export { changeValue } from "./sync-change";

export function changeTitle(change: Change) {
  if (change.representation === "component-root") return "组件根结构";
  if (change.representation === "prefab-reference") return "Prefab 引用结构";
  return prefabChangeName(change) ?? fieldNames[change.field];
}

export function describeDecision(review: PrefabReview, change: Change, decision?: Decision) {
  return describeSyncDecision(review.comparison, change, decision);
}

export function PrefabSyncChange({ review, ...props }: Omit<ComponentProps<typeof SyncChange>, "comparison" | "targetLabel" | "title"> & { review: PrefabReview }) {
  return <SyncChange {...props} comparison={review.comparison} targetLabel="预制体" title={changeTitle(props.change)} />;
}
