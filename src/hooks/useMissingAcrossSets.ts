import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adjustPart, getLinesOfSets, listMySets } from "../lib/api";
import {
  applySetProgress,
  isComplete,
  missingAcrossSets,
  type MissingAcross,
  type Part,
} from "../lib/parts";
import type { SetSummary, InventoryLine } from "../lib/types";

const busyKey = (setId: string, part: Part) => `${setId}|${part.key}`;

/**
 * Every Part still missing in the user's incomplete Sets, and a way to tick
 * one off in a given Set. Loaded on open and when the page becomes visible
 * again; not live like a Set's own page.
 */
export function useMissingAcrossSets() {
  const [data, setData] = useState<{
    sets: SetSummary[];
    lines: InventoryLine[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  // Bumped by every load and tick-off: a load only applies if nothing happened
  // since it started, so it never undoes a tick-off or a newer load.
  const version = useRef(0);

  const load = useCallback(async () => {
    const started = ++version.current;
    try {
      const sets = (await listMySets()).filter((c) => !isComplete(c));
      const lines = await getLinesOfSets(sets.map((c) => c.id));
      if (version.current !== started) {
        return;
      }
      setData({ sets, lines });
      setError(null);
    } catch (e) {
      if (version.current === started) {
        setError((e as Error).message);
      }
    }
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- load only sets state after awaiting the fetch
    load();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        load();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [load]);

  const tickOff = useCallback(
    async (setId: string, part: Part) => {
      const id = busyKey(setId, part);
      version.current++;
      setBusy((prev) => new Set(prev).add(id));
      try {
        const progress = await adjustPart(
          setId,
          part.part_num,
          part.color_id,
          1,
        );
        setData(
          (prev) =>
            prev && {
              ...prev,
              lines: applySetProgress(prev.lines, setId, progress),
            },
        );
      } catch (e) {
        // The tap may or may not have been saved: show the error and reload the truth.
        setError((e as Error).message);
        load();
      } finally {
        setBusy((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [load],
  );

  const isBusy = useCallback(
    (setId: string, part: Part) => busy.has(busyKey(setId, part)),
    [busy],
  );
  const missing = useMemo<MissingAcross[] | null>(
    () => data && missingAcrossSets(data.sets, data.lines),
    [data],
  );
  return { missing, error, clearError: () => setError(null), isBusy, tickOff };
}
