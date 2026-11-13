import type { GameFlowNode, GameFlowPage, NodeType, PageRootType } from "./model";

export const PAGE_ROOTS = {
  UIStack: { label: "堆叠界面" },
  UITop: { label: "顶层界面" },
  UIScene: { label: "场景界面" },
  UIBox: { label: "自由容器" }
} as const satisfies Record<PageRootType, { label: string }>;
export const PAGE_ROOT_TYPES = Object.keys(PAGE_ROOTS) as PageRootType[];
export function pageRootType(page: Pick<GameFlowPage, "rootType">): PageRootType { return page.rootType ?? "UIStack"; }

export const COMPONENTS = {
  container: { label: "自由容器", laya: "UIBox", children: true },
  hbox: { label: "横排容器", laya: "UIHBox", children: true },
  vbox: { label: "竖排容器", laya: "UIVBox", children: true },
  grid: { label: "网格容器", laya: "UIGrid", children: true },
  panel: { label: "面板容器", laya: "UIPanel", children: true },
  rectangle: { label: "矩形", laya: "UIPanel", children: true },
  text: { label: "文字", laya: "UILabel", children: false },
  image: { label: "图片", laya: "UIImage", children: false },
  button: { label: "按钮", laya: "UIButton", children: true },
  input: { label: "输入框", laya: "UITextInput", children: false },
  list: { label: "列表", laya: "UIList", children: true },
  checkbox: { label: "复选框", laya: "UICheckBox", children: true },
  radio: { label: "单选框", laya: "UIRadio", children: true },
  progress: { label: "进度条", laya: "UIProgressBar", children: true },
  slider: { label: "滑块", laya: "UISlider", children: true },
  combo: { label: "下拉框", laya: "UIComboBox", children: true }
} as const;
export const COMPONENT_TYPES = Object.keys(COMPONENTS) as NodeType[];
export function canHaveChildren(node: Pick<GameFlowNode, "type">): boolean { return COMPONENTS[node.type].children; }
export function flowType(node?: Pick<GameFlowNode, "type">): "free" | "hbox" | "vbox" | "grid" {
  return node?.type === "list" ? "grid" : node && ["hbox", "vbox", "grid"].includes(node.type) ? node.type as "hbox" | "vbox" | "grid" : "free";
}
