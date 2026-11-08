import { useCallback, useEffect, useState } from "react";
import { useOnVisible } from "./useOnVisible";
import { createGroup, listGroups, renameGroup } from "../lib/api";
import type { Group } from "../lib/types";

/** The user's Groups, refreshed whenever the page becomes visible again. */
export function useGroups(me: string) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      listGroups(me).then(
        (list) => {
          setGroups(list);
          setError(null);
        },
        (e: Error) => setError(e.message),
      ),
    [me],
  );

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- refresh only sets state after awaiting the fetch
    refresh();
  }, [refresh]);
  useOnVisible(() => void refresh());

  /** Runs a change, then reloads the list; returns whether it worked. */
  async function change(action: () => Promise<unknown>): Promise<boolean> {
    try {
      await action();
      await refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }

  return {
    groups,
    error,
    clearError: () => setError(null),
    reload: refresh,
    create: (name: string) => change(() => createGroup(name)),
    rename: (groupId: string, name: string) =>
      change(() => renameGroup(groupId, name)),
  };
}
