import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adjustPart, getLinesOfChecks, listChecks } from "../lib/api";
import {
  applyCheckProgress,
  isComplete,
  missingAcrossChecks,
  type MissingAcross,
  type Part,
} from "../lib/parts";
import type { CheckSummary, InventoryLine } from "../lib/types";

const busyKey = (checkId: string, part: Part) => `${checkId}|${part.key}`;

/**
 * Every Part still missing in the user's incomplete Checks, and a way to tick
 * one off in a given Check. Loaded on open and when the page becomes visible
 * again; not live like a Check's own page.
 */
export function useMissingAcrossChecks() {
  const [data, setData] = useState<{
    checks: CheckSummary[];
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
      const checks = (await listChecks()).filter((c) => !isComplete(c));
      const lines = await getLinesOfChecks(checks.map((c) => c.id));
      if (version.current !== started) return;
      setData({ checks, lines });
      setError(null);
    } catch (e) {
      if (version.current === started) setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- load only sets state after awaiting the fetch
    load();
    const onVisibility = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [load]);

  const tickOff = useCallback(
    async (checkId: string, part: Part) => {
      const id = busyKey(checkId, part);
      version.current++;
      setBusy((prev) => new Set(prev).add(id));
      try {
        const progress = await adjustPart(
          checkId,
          part.part_num,
          part.color_id,
          1,
        );
        setData(
          (prev) =>
            prev && {
              ...prev,
              lines: applyCheckProgress(prev.lines, checkId, progress),
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
    (checkId: string, part: Part) => busy.has(busyKey(checkId, part)),
    [busy],
  );
  const missing = useMemo<MissingAcross[] | null>(
    () => data && missingAcrossChecks(data.checks, data.lines),
    [data],
  );
  return { missing, error, clearError: () => setError(null), isBusy, tickOff };
}
