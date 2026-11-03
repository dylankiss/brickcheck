import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  adjustPart,
  getCheck,
  getCheckLines,
  getCheckProgress,
  subscribeToCheck,
} from "../lib/api";
import {
  applyProgress,
  buildTiles,
  tileKey,
  toLineMap,
  type LineMap,
  type Tile,
} from "../lib/tiles";
import type { CheckSummary, LineProgress } from "../lib/types";

export type CheckStatus = "loading" | "ready" | "not-found" | "error";

/**
 * Live state of one check. Call it once per check (CheckLayout) and share it
 * through CheckContext, so there is a single realtime channel per check.
 *
 * - The inventory is loaded once; reconnects and visibility changes refetch
 *   only the progress numbers.
 * - Taps on a tile are sent one request at a time; taps made while a request
 *   is in flight are summed into the next one, so they apply in order.
 * - While a tile has a request in flight, server values for it (broadcasts,
 *   refetches) are held back and applied together with the request's result,
 *   so the optimistic delta is never counted twice.
 */
export function useCheck(checkId: string) {
  const [summary, setSummary] = useState<CheckSummary | null>(null);
  const [lines, setLines] = useState<LineMap>(() => new Map());
  const [pending, setPending] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );
  const [status, setStatus] = useState<CheckStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  // Tap bookkeeping; refs because it is read and written outside render.
  const tileOfLine = useRef(new Map<number, string>());
  const queued = useRef(new Map<string, number>());
  const inFlight = useRef(new Set<string>());
  const heldBack = useRef(new Map<string, LineProgress[]>());
  const loaded = useRef<Promise<void> | null>(null);
  const refreshing = useRef<Promise<void> | null>(null);

  /** Applies server values, holding back those for tiles with a request in flight. */
  const receive = useCallback((updates: LineProgress[]) => {
    const now: LineProgress[] = [];
    for (const update of updates) {
      const key = tileOfLine.current.get(update.set_part_id);
      if (key && inFlight.current.has(key)) {
        heldBack.current.set(key, [
          ...(heldBack.current.get(key) ?? []),
          update,
        ]);
      } else {
        now.push(update);
      }
    }
    if (now.length) setLines((held) => applyProgress(held, now));
  }, []);

  const refreshProgress = useCallback(() => {
    refreshing.current ??= (async () => {
      try {
        await loaded.current;
        const [check, progress] = await Promise.all([
          getCheck(checkId),
          getCheckProgress(checkId),
        ]);
        if (!check) {
          setStatus("not-found");
          return;
        }
        setSummary(check);
        receive(progress);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        refreshing.current = null;
      }
    })();
    return refreshing.current;
  }, [checkId, receive]);

  useEffect(() => {
    loaded.current = (async () => {
      try {
        const [check, fetched] = await Promise.all([
          getCheck(checkId),
          getCheckLines(checkId),
        ]);
        if (!check) {
          setStatus("not-found");
          return;
        }
        tileOfLine.current = new Map(
          fetched.map((l) => [l.set_part_id, tileKey(l.part_num, l.color_id)]),
        );
        setSummary(check);
        setLines(toLineMap(fetched));
        setStatus("ready");
      } catch (e) {
        setError((e as Error).message);
        setStatus("error");
      }
    })();

    const unsubscribe = subscribeToCheck(checkId, {
      onProgress: (progress) => receive([progress]),
      // Catches up on anything missed between loading and (re)subscribing.
      onSubscribed: () => void refreshProgress(),
    });
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshProgress();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [checkId, receive, refreshProgress]);

  const tiles = useMemo(() => buildTiles(lines, pending), [lines, pending]);

  const canEdit = summary?.my_role === "owner" || summary?.my_role === "helper";

  const settle = useCallback((key: string, delta: number) => {
    setPending((map) => {
      const next = new Map(map);
      const remaining = (next.get(key) ?? 0) - delta;
      if (remaining) next.set(key, remaining);
      else next.delete(key);
      return next;
    });
  }, []);

  /** Sends the tile's queued taps, unless a request for it is already in flight. */
  const flush = useCallback(
    function flushTile(key: string, partNum: string, colorId: number) {
      if (inFlight.current.has(key)) return;
      const delta = queued.current.get(key) ?? 0;
      queued.current.delete(key);
      if (delta === 0) return;

      inFlight.current.add(key);
      const release = () => {
        inFlight.current.delete(key);
        const held = heldBack.current.get(key) ?? [];
        heldBack.current.delete(key);
        return held;
      };
      adjustPart(checkId, partNum, colorId, delta).then(
        (progress) => {
          const held = release();
          // Same tick, so React renders the server value and the settled delta together.
          setLines((lines) => applyProgress(lines, [...progress, ...held]));
          settle(key, delta);
          flushTile(key, partNum, colorId);
        },
        (e: Error) => {
          const held = release();
          setLines((lines) => applyProgress(lines, held));
          settle(key, delta);
          setError(e.message);
          refreshProgress();
          flushTile(key, partNum, colorId);
        },
      );
    },
    [checkId, settle, refreshProgress],
  );

  const tap = useCallback(
    (tile: Tile, delta: 1 | -1) => {
      if (!canEdit) return;
      if (delta > 0 ? tile.found >= tile.needed : tile.found <= 0) return;
      navigator.vibrate?.(10);
      queued.current.set(tile.key, (queued.current.get(tile.key) ?? 0) + delta);
      setPending((map) =>
        new Map(map).set(tile.key, (map.get(tile.key) ?? 0) + delta),
      );
      flush(tile.key, tile.part_num, tile.color_id);
    },
    [canEdit, flush],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    checkId,
    summary,
    tiles,
    status,
    error,
    clearError,
    canEdit,
    tap,
    refreshProgress,
  };
}

export type CheckState = ReturnType<typeof useCheck>;
