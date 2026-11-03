import { createContext, useContext } from "react";
import type { CheckState } from "./useCheck";

export const CheckContext = createContext<CheckState | null>(null);

/** The current check's live state, provided by CheckLayout. */
export function useCheckContext(): CheckState {
  const check = useContext(CheckContext);
  if (!check)
    throw new Error("useCheckContext must be used inside CheckLayout");
  return check;
}
