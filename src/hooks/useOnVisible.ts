import { useEffect, useRef } from "react";

/**
 * Calls `callback` whenever the page becomes visible again (the tab or the
 * installed app comes back to the front). The listener is added once; it always
 * calls the latest `callback`.
 */
export function useOnVisible(callback: () => void) {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        latest.current();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
}
