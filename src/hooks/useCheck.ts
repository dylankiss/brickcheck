import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adjustPart,
  getCheck,
  getCheckLines,
  subscribeToCheck,
} from "../lib/api";
import {
  applyProgress,
  buildTiles,
  mergeFetchedLines,
  type LineMap,
  type Tile,
} from "../lib/tiles";
import type { CheckSummary } from "../lib/types";

export type CheckStatus = "loading" | "ready" | "not-found" | "error";

/**
 * Live state of one check: lines from the server, optimistic taps, realtime
 * updates, and a refetch whenever the channel (re)connects or the page becomes
 * visible again (phones drop sockets when the screen locks).
 * Mount the caller with `key={checkId}` so state starts fresh for each check.
 */
export function useCheck(checkId: string) {
  const [summary, setSummary] = useState<CheckSummary | null>(null);
  const [lines, setLines] = useState<LineMap>(() => new Map());
  const [pending, setPending] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );
  const [status, setStatus] = useState<CheckStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [check, fetched] = await Promise.all([
        getCheck(checkId),
        getCheckLines(checkId),
      ]);
      if (!check) {
        setStatus("not-found");
        return;
      }
      setSummary(check);
      setLines((held) => mergeFetchedLines(held, fetched));
      setStatus("ready");
    } catch (e) {
      setError((e as Error).message);
      setStatus((current) => (current === "loading" ? "error" : current));
    }
  }, [checkId]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- refresh only sets state after awaiting the fetch
    refresh();

    const unsubscribe = subscribeToCheck(checkId, {
      onProgress: (progress) =>
        setLines((held) => applyProgress(held, [progress])),
      onSubscribed: () => void refresh(),
    });
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [checkId, refresh]);

  const tiles = useMemo(() => buildTiles(lines, pending), [lines, pending]);

  const canEdit = summary?.my_role === "owner" || summary?.my_role === "helper";

  const tap = useCallback(
    (tile: Tile, delta: 1 | -1) => {
      if (!canEdit) return;
      if (delta > 0 ? tile.found >= tile.needed : tile.found <= 0) return;
      navigator.vibrate?.(10);

      const settle = (map: ReadonlyMap<string, number>) => {
        const next = new Map(map);
        const remaining = (next.get(tile.key) ?? 0) - delta;
        if (remaining) next.set(tile.key, remaining);
        else next.delete(tile.key);
        return next;
      };

      setPending((map) =>
        new Map(map).set(tile.key, (map.get(tile.key) ?? 0) + delta),
      );
      adjustPart(checkId, tile.part_num, tile.color_id, delta).then(
        (progress) => {
          // Same tick, so React renders the server value and the settled delta together.
          setLines((held) => applyProgress(held, progress));
          setPending(settle);
        },
        (e: Error) => {
          setError(e.message);
          setPending(settle);
        },
      );
    },
    [checkId, canEdit],
  );

  return {
    summary,
    tiles,
    status,
    error,
    clearError: () => setError(null),
    canEdit,
    tap,
    refresh,
  };
}
