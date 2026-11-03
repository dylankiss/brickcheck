import { useSyncExternalStore } from "react";
import {
  currentTheme,
  setTheme,
  subscribeTheme,
  type Theme,
} from "../lib/theme";

export function useTheme(): [Theme, (theme: Theme) => void] {
  return [useSyncExternalStore(subscribeTheme, currentTheme), setTheme];
}
