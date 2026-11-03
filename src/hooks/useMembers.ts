import { useCallback, useEffect, useState } from "react";
import {
  createInvite,
  deleteInvite,
  listInvites,
  listMembers,
  removeMember,
  setMemberRole,
} from "../lib/api";
import type { Invite, Member } from "../lib/types";

/**
 * Members (and, for owners, open invites) of a check. `version` comes from
 * useCheck and changes whenever the check's channel reports a change.
 */
export function useMembers(checkId: string, isOwner: boolean, version: number) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [m, i] = await Promise.all([
        listMembers(checkId),
        isOwner ? listInvites(checkId) : Promise.resolve([]),
      ]);
      setMembers(m);
      setInvites(i);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [checkId, isOwner]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- refresh only sets state after awaiting the fetch
    refresh();
  }, [refresh, version]);

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setError(null);
      try {
        await action();
        await refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [refresh],
  );

  return {
    members,
    invites,
    error,
    clearError: () => setError(null),
    invite: async (role: Invite["role"]) => {
      setError(null);
      try {
        const invite = await createInvite(checkId, role);
        setInvites((list) => [...list, invite]);
        return invite;
      } catch (e) {
        setError((e as Error).message);
        return null;
      }
    },
    revokeInvite: (token: string) => run(() => deleteInvite(token)),
    setRole: (userId: string, role: Invite["role"]) =>
      run(() => setMemberRole(checkId, userId, role)),
    remove: (userId: string) => run(() => removeMember(checkId, userId)),
  };
}
