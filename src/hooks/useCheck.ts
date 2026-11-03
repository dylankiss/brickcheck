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
import type { CheckSummary, LineProgress, OnlineMember } from "../lib/types";

export type CheckStatus = "loading" | "ready" | "not-found" | "error";

/**
 * Live state of one check. Call it once per check (CheckLayout) and share it
 * through CheckContext, so there is a single realtime channel per check.
 *
 * - The inventory is loaded once; reconnects and visibility changes refetch
 *   only the progress numbers (or redo the full load if it had failed).
 * - Taps on a tile are sent one request at a time; taps made while a request
 *   is in flight are summed into the next one, so they apply in order.
 * - While a tile has a request in flight, server values for it (broadcasts,
 *   refetches) are held back and applied together with the request's result,
 *   so the optimistic delta is never counted twice.
 */
export function useCheck(checkId: string, me: OnlineMember) {
  const [summary, setSummary] = useState<CheckSummary | null>(null);
  const [lines, setLines] = useState<LineMap>(() => new Map());
  const [pending, setPending] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );
  const [status, setStatus] = useState<CheckStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState<OnlineMember[]>([]);
  // Bumped when the check or its members change, so dependent views refetch.
  const [version, setVersion] = useState(0);

  // Bookkeeping read and written outside render.
  const tileOfLine = useRef(new Map<number, string>());
  const queued = useRef(new Map<string, number>());
  const inFlight = useRef(new Set<string>());
  const heldBack = useRef(new Map<string, LineProgress[]>());
  const loaded = useRef<Promise<boolean> | null>(null);
  const refreshing = useRef<Promise<void> | null>(null);
  const refreshAgain = useRef(false);
  // Bumped on every (un)mount; async work only applies results of its own generation.
  const generation = useRef(0);

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

  /** Loads summary and inventory; resolves to whether it succeeded. */
  const load = useCallback(async () => {
    const gen = generation.current;
    try {
      const [check, fetched] = await Promise.all([
        getCheck(checkId),
        getCheckLines(checkId),
      ]);
      if (gen !== generation.current) return false;
      if (!check) {
        setStatus("not-found");
        return false;
      }
      tileOfLine.current = new Map(
        fetched.map((l) => [l.set_part_id, tileKey(l.part_num, l.color_id)]),
      );
      setSummary(check);
      setLines(toLineMap(fetched));
      setStatus("ready");
      setError(null);
      return true;
    } catch (e) {
      if (gen === generation.current) {
        setError((e as Error).message);
        setStatus("error");
      }
      return false;
    }
  }, [checkId]);

  /**
   * Catches up with the server. Requests made while one runs schedule exactly
   * one more run afterwards, so nothing committed in between is missed.
   * Errors are not shown: this runs in the background, often before the
   * network is back after unlocking the phone.
   */
  const refresh = useCallback(() => {
    if (refreshing.current) {
      refreshAgain.current = true;
      return refreshing.current;
    }
    const gen = generation.current;
    refreshing.current = (async () => {
      do {
        refreshAgain.current = false;
        try {
          if (!(await loaded.current)) {
            // The first load failed (e.g. offline): redo it in full.
            loaded.current = load();
            await loaded.current;
            continue;
          }
          const [check, progress] = await Promise.all([
            getCheck(checkId),
            getCheckProgress(checkId),
          ]);
          if (gen !== generation.current) return;
          if (!check) {
            setStatus("not-found");
            return;
          }
          setSummary(check);
          receive(progress);
        } catch (e) {
          console.warn("Background refresh failed", e);
        }
      } while (refreshAgain.current && gen === generation.current);
    })().finally(() => {
      refreshing.current = null;
    });
    return refreshing.current;
  }, [checkId, load, receive]);

  useEffect(() => {
    generation.current++;
    loaded.current = load();

    const unsubscribe = subscribeToCheck(checkId, me, {
      onProgress: (progress) => receive([progress]),
      onChanged: () => {
        setVersion((v) => v + 1);
        refresh();
      },
      // Catches up on anything missed between loading and (re)subscribing.
      onSubscribed: () => void refresh(),
      onPresence: setOnline,
    });
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      // A counter, not a DOM ref: invalidating in-flight work is the point.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // `me` is announced once per subscription; a renamed user shows up on the next visit.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [checkId, load, receive, refresh]);

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
          refresh();
          flushTile(key, partNum, colorId);
        },
      );
    },
    [checkId, settle, refresh],
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

  const others = useMemo(
    () => online.filter((o) => o.user_id !== me.user_id),
    [online, me.user_id],
  );

  return {
    checkId,
    summary,
    tiles,
    status,
    error,
    clearError,
    canEdit,
    tap,
    online,
    others,
    version,
  };
}

export type CheckState = ReturnType<typeof useCheck>;
