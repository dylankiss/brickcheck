import { useCallback, useEffect, useState } from "react";
import { listChecks } from "../lib/api";
import type { CheckSummary } from "../lib/types";

/** The user's checks, refreshed whenever the page becomes visible again. */
export function useChecks() {
  const [checks, setChecks] = useState<CheckSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      listChecks().then(
        (list) => {
          setChecks(list);
          setError(null);
        },
        (e: Error) => setError(e.message),
      ),
    [],
  );

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- refresh only sets state after awaiting the fetch
    refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refresh]);

  return { checks, error, refresh };
}
