import { useCallback, useSyncExternalStore } from "react";
import {
  getPreference,
  setPreference,
  subscribePreferences,
  type Preferences,
} from "../lib/preferences";

/** A per-device display preference: its value, and a setter that keeps it. */
export function usePreference<K extends keyof Preferences>(key: K) {
  const value = useSyncExternalStore(subscribePreferences, () =>
    getPreference(key),
  );
  const set = useCallback(
    (next: Preferences[K]) => setPreference(key, next),
    [key],
  );
  return [value, set] as const;
}
