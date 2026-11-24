import { useState } from "react";

export function useToolbarChoice<T extends string | boolean>(name: string, choices: readonly [T, ...T[]]) {
  const key = "gameflow.toolbar." + name;
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return choices.find(choice => String(choice) === saved) ?? choices[0];
    } catch {
      return choices[0];
    }
  });

  function select(next: T) {
    setValue(next);
    try { localStorage.setItem(key, String(next)); }
    catch { /* Keep the choice for this session if storage is unavailable. */ }
  }
  return [value, select] as const;
}
