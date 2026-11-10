import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

/** How long the Undo bar stays after a tick. */
export const TICKED_BAR_MS = 8000;

/**
 * The tick the Undo bar is about: set it on a tick (a new value replaces the
 * old and restarts the clock), and it clears itself after a few seconds. The
 * clock stops while a pointer or focus is on the bar (`hold`, for TickToast),
 * so it does not vanish as you reach for Undo, and restarts when you let go.
 */
export function useRecentTick<T>() {
  const [recent, setRecent] = useState<T | null>(null);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (recent === null || held) {
      return;
    }
    const timer = setTimeout(() => setRecent(null), TICKED_BAR_MS);
    return () => clearTimeout(timer);
  }, [recent, held]);

  // A new tick or a dismissal also lets go: the bar may be gone before it
  // reports that the pointer left.
  const set: Dispatch<SetStateAction<T | null>> = useCallback((next) => {
    setHeld(false);
    setRecent(next);
  }, []);
  const hold = {
    onPointerEnter: () => setHeld(true),
    onPointerLeave: () => setHeld(false),
    onFocus: () => setHeld(true),
    onBlur: () => setHeld(false),
  };
  return [recent, set, hold] as const;
}
