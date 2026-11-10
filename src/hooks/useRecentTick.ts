import { useEffect, useState } from "react";

/** How long the Undo bar stays after a tick. */
export const TICKED_BAR_MS = 4000;

/**
 * The tick the Undo bar is about: set it on a tick (a new value replaces the
 * old and restarts the clock), and it clears itself after a few seconds.
 */
export function useRecentTick<T>() {
  const [recent, setRecent] = useState<T | null>(null);
  useEffect(() => {
    if (recent === null) {
      return;
    }
    const timer = setTimeout(() => setRecent(null), TICKED_BAR_MS);
    return () => clearTimeout(timer);
  }, [recent]);
  return [recent, setRecent] as const;
}
