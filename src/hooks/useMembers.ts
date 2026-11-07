import { useCallback, useEffect, useRef, useState } from "react";
import {
  createInvite,
  deleteSet,
  resetSetProgress,
  deleteInvite,
  listInvites,
  removeMember,
  setMemberRole,
} from "../lib/api";
import type { Invite } from "../lib/types";

/**
 * Invites and membership actions for a set. The member list itself lives in
 * useSet (it also names the people online). `version` comes from useSet
 * and changes whenever the set's channel reports a change.
 */
export function useMembers(
  setId: string,
  myUserId: string,
  isOwner: boolean,
  version: number,
  reloadMembers: () => Promise<void>,
) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  const refreshInvites = useCallback(async () => {
    if (!isOwner) {
      return;
    }
    const current = ++request.current;
    try {
      const list = await listInvites(setId);
      if (current === request.current) {
        setInvites(list);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [setId, isOwner]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- refreshInvites only sets state after awaiting the fetch
    refreshInvites();
  }, [refreshInvites, version]);

  /** Runs an action; resolves to whether it succeeded. */
  const run = useCallback(async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }, []);

  return {
    invites,
    error,
    clearError: () => setError(null),
    invite: async (role: Invite["role"]) => {
      let created: Invite | null = null;
      await run(async () => {
        created = await createInvite(setId, role);
        await refreshInvites();
      });
      return created as Invite | null;
    },
    revokeInvite: (token: string) =>
      run(() => deleteInvite(token).then(refreshInvites)),
    setRole: (userId: string, role: Invite["role"]) =>
      run(() => setMemberRole(setId, userId, role).then(reloadMembers)),
    remove: (userId: string) =>
      run(() => removeMember(setId, userId).then(reloadMembers)),
    leave: () => run(() => removeMember(setId, myUserId)),
    resetCounts: () => run(() => resetSetProgress(setId)),
    deleteSet: () => run(() => deleteSet(setId)),
  };
}
