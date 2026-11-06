import { useCallback, useEffect, useState } from "react";
import { listMySets } from "../lib/api";
import type { SetSummary } from "../lib/types";

/** The user's sets, refreshed whenever the page becomes visible again. */
export function useMySets() {
  const [sets, setSets] = useState<SetSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      listMySets().then(
        (list) => {
          setSets(list);
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
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refresh]);

  return { sets, error, refresh };
}
