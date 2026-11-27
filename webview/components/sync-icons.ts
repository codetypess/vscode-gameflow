import { createLucideIcon, type IconNode } from "lucide-react";

const syncArrows: IconNode = [
  ["path", { key: "upper-arrow", strokeWidth: "1.6", d: "M22 16a4 4 0 0 0-6.7-1.6l-.8.9m0-2.6v2.6h2.6" }],
  ["path", { key: "lower-arrow", strokeWidth: "1.6", d: "M14.5 18.7a4 4 0 0 0 6.7 1.6l.8-.9m0 2.6v-2.6h-2.6" }],
];

export const PsdSyncIcon = createLucideIcon("PsdSync", [
  ["path", { key: "top-layer", strokeWidth: "1.9", d: "m11.3 2.3 9.3 4.8-9.3 4.8L2 7.1Z" }],
  ["path", { key: "lower-layers", strokeWidth: "1.9", d: "m2 11.8 9.3 4.8M2 16.5l9.3 4.8" }],
  ...syncArrows,
]);

export const PrefabSyncIcon = createLucideIcon("PrefabSync", [
  ["path", { key: "top-face", strokeWidth: "1.9", d: "m11 2 9 4.8-9 4.8-9-4.8Z" }],
  ["path", { key: "edges", strokeWidth: "1.9", d: "M2 6.8v9.6l9 4.8v-9.6m9-4.8v3.7" }],
  ...syncArrows,
]);
