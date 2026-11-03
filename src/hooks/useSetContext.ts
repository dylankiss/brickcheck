import { createContext, useContext } from "react";
import type { LiveSetState } from "./useSet";

export const SetContext = createContext<LiveSetState | null>(null);

/** The current set's live state, provided by SetLayout. */
export function useSetContext(): LiveSetState {
  const set = useContext(SetContext);
  if (!set) throw new Error("useSetContext must be used inside SetLayout");
  return set;
}
