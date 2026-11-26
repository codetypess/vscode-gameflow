import { createLucideIcon, type IconNode } from "lucide-react";

const syncArrows: IconNode = [
  ["path", { key: "left", d: "M8.2 3.5a9.1 9.1 0 0 0-.9 15.8M2.5 19.3h4.8v-4.8" }],
  ["path", { key: "top", d: "M18.1 8.5a9.1 9.1 0 0 0-5.6-5.7m0 4.8V2.8h4.8" }],
];

export const PsdSyncIcon = createLucideIcon("PsdSync", [
  ...syncArrows,
  ["path", { key: "top-layer", strokeWidth: "1.7", d: "m16.8 11.4 5.5 3.1-5.5 3.1-5.5-3.1Z" }],
  ["path", { key: "bottom-layer", strokeWidth: "1.7", d: "m11.3 18.4 5.5 3.1 5.5-3.1" }],
]);

export const PrefabSyncIcon = createLucideIcon("PrefabSync", [
  ...syncArrows,
  ["path", { key: "outline", strokeWidth: "1.7", d: "m16.7 11 5.2 2.8v5.3l-5.2 2.8-5.2-2.8v-5.3Z" }],
  ["path", { key: "edges", strokeWidth: "1.7", d: "m11.5 13.8 5.2 2.8 5.2-2.8m-5.2 2.8v5.3" }],
]);
