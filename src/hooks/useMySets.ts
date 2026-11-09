import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { useOnVisible } from "./useOnVisible";
import { listMySets } from "../lib/api";
import type { SetSummary } from "../lib/types";

/**
 * The last list per user, kept for the life of the page. Coming back to My
 * sets shows it at once (the pictures are already in the browser's cache)
 * while the fresh list loads. Keyed by user, so nobody sees another's sets.
 */
const lastSets = new Map<string, SetSummary[]>();

/** The user's sets, refreshed whenever the page becomes visible again. */
export function useMySets() {
  const userId = useAuth().session?.user.id ?? "";
  const [sets, setSets] = useState<SetSummary[] | null>(
    () => lastSets.get(userId) ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      listMySets().then(
        (list) => {
          lastSets.set(userId, list);
          setSets(list);
          setError(null);
        },
        (e: Error) => setError(e.message),
      ),
    [userId],
  );

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- refresh only sets state after awaiting the fetch
    refresh();
  }, [refresh]);
  useOnVisible(() => void refresh());

  return { sets, error, refresh };
}
