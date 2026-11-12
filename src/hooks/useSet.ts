import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOnVisible } from "./useOnVisible";
import {
  adjustPart,
  getSet,
  getSetLines,
  getSetProgress,
  listMembers,
  subscribeToSet,
} from "../lib/api";
import {
  applyProgress,
  canTickOff,
  groupParts,
  partKey,
  toLineMap,
  type LineMap,
  type Part,
} from "../lib/parts";
import type { SetSummary, LineProgress, Member } from "../lib/types";

export type SetStatus = "loading" | "ready" | "not-found" | "error";

/**
 * Live state of one set. Call it once per set (SetLayout) and share it
 * through SetContext, so there is a single realtime channel per set.
 *
 * - The inventory is loaded once; reconnects and visibility changes refetch
 *   only the progress numbers (or redo the full load if it had failed).
 * - Taps on a part are sent one request at a time; taps made while a request
 *   is in flight are summed into the next one, so they apply in order.
 * - While a part has a request in flight, server values for it (broadcasts,
 *   refetches) are held back and applied together with the request's result,
 *   so the optimistic delta is never counted twice.
 */
export function useSet(setId: string, myUserId: string) {
  const [summary, setSummary] = useState<SetSummary | null>(null);
  const [lines, setLines] = useState<LineMap>(() => new Map());
  const [pending, setPending] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );
  const [status, setStatus] = useState<SetStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  // Bumped when the set or its members change, so dependent views refetch.
  const [version, setVersion] = useState(0);

  // Bookkeeping read and written outside render.
  const partOfLine = useRef(new Map<number, string>());
  const queued = useRef(new Map<string, number>());
  const inFlight = useRef(new Set<string>());
  const heldBack = useRef(new Map<string, LineProgress[]>());
  const loaded = useRef<Promise<boolean> | null>(null);
  const refreshing = useRef<Promise<void> | null>(null);
  const refreshAgain = useRef(false);
  // Bumped on every (un)mount; async work only applies results of its own generation.
  const generation = useRef(0);
  const stopChannel = useRef<(() => void) | null>(null);
  const membersRequest = useRef(0);

  /** The set is gone or we were removed: stop listening (the channel would only be refused). */
  const lostAccess = useCallback(() => {
    setStatus("not-found");
    stopChannel.current?.();
    stopChannel.current = null;
  }, []);

  /** Loads the member list; responses older than the latest request are dropped. */
  const loadMembers = useCallback(async () => {
    const request = ++membersRequest.current;
    try {
      const list = await listMembers(setId);
      if (request === membersRequest.current) {
        setMembers(list);
      }
    } catch (e) {
      console.warn("Loading members failed", e);
    }
  }, [setId]);

  /** Applies server values, holding back those for parts with a request in flight. */
  const receive = useCallback((updates: LineProgress[]) => {
    const now: LineProgress[] = [];
    for (const update of updates) {
      const key = partOfLine.current.get(update.line_id);
      if (key && inFlight.current.has(key)) {
        heldBack.current.set(key, [
          ...(heldBack.current.get(key) ?? []),
          update,
        ]);
      } else {
        now.push(update);
      }
    }
    if (now.length) {
      setLines((held) => applyProgress(held, now));
    }
  }, []);

  /** Loads summary and inventory; resolves to whether it succeeded. */
  const load = useCallback(async () => {
    const gen = generation.current;
    try {
      const [set, fetched] = await Promise.all([
        getSet(setId),
        getSetLines(setId),
      ]);
      if (gen !== generation.current) {
        return false;
      }
      if (!set) {
        lostAccess();
        return false;
      }
      partOfLine.current = new Map(
        fetched.map((l) => [l.line_id, partKey(l.part_num, l.color_id)]),
      );
      setSummary(set);
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
  }, [setId, lostAccess]);

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
          const [set, progress] = await Promise.all([
            getSet(setId),
            getSetProgress(setId),
          ]);
          if (gen !== generation.current) {
            return;
          }
          if (!set) {
            lostAccess();
            return;
          }
          setSummary(set);
          receive(progress);
        } catch (e) {
          console.warn("Background refresh failed", e);
        }
      } while (refreshAgain.current && gen === generation.current);
    })().finally(() => {
      refreshing.current = null;
    });
    return refreshing.current;
  }, [setId, load, receive, lostAccess]);

  useEffect(() => {
    generation.current++;
    loaded.current = load();
    loadMembers();

    stopChannel.current = subscribeToSet(setId, myUserId, {
      onProgress: (progress) => receive([progress]),
      onChanged: () => {
        setVersion((v) => v + 1);
        loadMembers();
        refresh();
      },
      // Catches up on anything missed between loading and (re)subscribing.
      onSubscribed: () => void refresh(),
      onPresence: setOnlineIds,
    });
    return () => {
      // A counter, not a DOM ref: invalidating in-flight work is the point.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      stopChannel.current?.();
      stopChannel.current = null;
    };
  }, [setId, myUserId, load, loadMembers, receive, refresh]);
  // Catches up on anything missed while the page was in the background.
  useOnVisible(() => void refresh());

  const parts = useMemo(() => groupParts(lines, pending), [lines, pending]);

  const canEdit = canTickOff(summary?.my_role ?? null);

  const settle = useCallback((key: string, delta: number) => {
    setPending((map) => {
      const next = new Map(map);
      const remaining = (next.get(key) ?? 0) - delta;
      if (remaining) {
        next.set(key, remaining);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  /** Sends the part's queued taps, unless a request for it is already in flight. */
  const flush = useCallback(
    function flushPart(key: string, partNum: string, colorId: number) {
      if (inFlight.current.has(key)) {
        return;
      }
      const delta = queued.current.get(key) ?? 0;
      queued.current.delete(key);
      if (delta === 0) {
        return;
      }

      inFlight.current.add(key);
      const release = () => {
        inFlight.current.delete(key);
        const held = heldBack.current.get(key) ?? [];
        heldBack.current.delete(key);
        return held;
      };
      adjustPart(setId, partNum, colorId, delta).then(
        (progress) => {
          const held = release();
          // Same tick, so React renders the server value and the settled delta together.
          setLines((lines) => applyProgress(lines, [...progress, ...held]));
          settle(key, delta);
          flushPart(key, partNum, colorId);
        },
        (e: Error) => {
          const held = release();
          setLines((lines) => applyProgress(lines, held));
          settle(key, delta);
          setError(e.message);
          refresh();
          flushPart(key, partNum, colorId);
        },
      );
    },
    [setId, settle, refresh],
  );

  const tap = useCallback(
    (part: Part, wanted: number) => {
      if (!canEdit) {
        return;
      }
      // Never past 0 or the needed count, so a bulk tick on a part that
      // someone else just completed adds nothing.
      const delta =
        wanted > 0
          ? Math.min(wanted, part.needed - part.found)
          : Math.max(wanted, -part.found);
      if (delta === 0) {
        return;
      }
      navigator.vibrate?.(10);
      queued.current.set(part.key, (queued.current.get(part.key) ?? 0) + delta);
      setPending((map) =>
        new Map(map).set(part.key, (map.get(part.key) ?? 0) + delta),
      );
      flush(part.key, part.part_num, part.color_id);
    },
    [canEdit, flush],
  );

  const clearError = useCallback(() => setError(null), []);

  // Only members count as online: presence keys are chosen by clients.
  const online = useMemo(() => {
    const ids = new Set(onlineIds);
    return (members ?? []).filter((m) => ids.has(m.user_id));
  }, [members, onlineIds]);
  const others = useMemo(
    () => online.filter((m) => m.user_id !== myUserId),
    [online, myUserId],
  );

  return {
    setId,
    summary,
    parts,
    status,
    error,
    clearError,
    canEdit,
    tap,
    members,
    reloadMembers: loadMembers,
    online,
    others,
    version,
  };
}

export type LiveSetState = ReturnType<typeof useSet>;
