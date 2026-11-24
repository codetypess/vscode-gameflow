import { createContext } from "react";
import type { GameFlowPage } from "../../shared/model";
import type { CellReference } from "../../shared/list-cell";

export const ListCells = createContext<{
  resolve(ref: CellReference): GameFlowPage;
  choose?(id: string, binding?: CellReference): void;
}>({ resolve() { throw new Error("列表项模板未载入。"); } });
