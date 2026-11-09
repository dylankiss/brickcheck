import { useCallback, useEffect, useState } from "react";
import {
  createGroupInvite,
  deleteGroupInvite,
  groupInviteUrl,
  listGroupInvites,
} from "../lib/api";
import { useLanguage } from "../hooks/useLanguage";
import { shareLink } from "../lib/share";
import type { Invite } from "../lib/types";
import { Button } from "./ui";

const roleLabel = { helper: "Helper", viewer: "Viewer" } as const;

/** Create, share and revoke the Group invites of a Group. Owners only. */
export function GroupInvites({
  groupId,
  groupName,
}: {
  groupId: string;
  groupName: string;
}) {
  const { date } = useLanguage();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      listGroupInvites(groupId).then(
        (list) => setInvites(list),
        (e: Error) => setError(e.message),
      ),
    [groupId],
  );

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- refresh only sets state after awaiting the fetch
    refresh();
  }, [refresh]);

  async function send(token: string) {
    try {
      const how = await shareLink(
        groupInviteUrl(token),
        groupName,
        `Join "${groupName}" in BrickCheck`,
      );
      if (how === "copied") {
        setCopied(token);
        setTimeout(() => setCopied(null), 2000);
      }
    } catch {
      setError("Could not copy the link");
    }
  }

  async function create(role: Invite["role"]) {
    try {
      const created = await createGroupInvite(groupId, role);
      setError(null);
      await refresh();
      await send(created.token);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function revoke(token: string) {
    try {
      await deleteGroupInvite(token);
      setError(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section
      aria-label={`Invite people to ${groupName}`}
      className="flex flex-col gap-2"
    >
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Send a link. Anyone who opens it and logs in joins this group, with
        access to all its sets. Links expire after 7 days.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => create("helper")}>Invite helpers</Button>
        <Button variant="secondary" onClick={() => create("viewer")}>
          Invite viewers
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {invites.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm">
          {invites.map((i) => (
            <li
              key={i.token}
              className="flex items-center gap-2 rounded-xl bg-neutral-50 p-2 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700"
            >
              <span className="flex-1">
                {roleLabel[i.role]} link · expires {date(i.expires_at)}
              </span>
              <button
                className="min-h-11 px-2 font-semibold text-brick"
                onClick={() => send(i.token)}
              >
                {copied === i.token ? "Copied!" : "Share"}
              </button>
              <button
                className="min-h-11 px-2 text-neutral-500 dark:text-neutral-400"
                onClick={() => revoke(i.token)}
                aria-label={`Revoke ${roleLabel[i.role]} link`}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
