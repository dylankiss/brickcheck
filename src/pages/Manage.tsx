import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Avatar } from "../components/Avatar";
import { Button, ErrorBanner, Header, Spinner } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useSetContext } from "../hooks/useSetContext";
import { useGroups } from "../hooks/useGroups";
import { useMembers } from "../hooks/useMembers";
import { inviteUrl } from "../lib/api";
import { shareLink } from "../lib/share";
import type { Invite } from "../lib/types";

const roleLabel = {
  owner: "Owner",
  helper: "Helper",
  viewer: "Viewer",
} as const;

export default function Manage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { setId, summary, version, online, members, reloadMembers } =
    useSetContext();
  const set = summary!;
  const isOwner = set.my_role === "owner";
  const me = session!.user.id;
  const {
    invites,
    groupMembers,
    error,
    clearError,
    invite,
    revokeInvite,
    setRole,
    remove,
    leave,
    moveToGroup,
    resetCounts,
    deleteSet,
  } = useMembers(setId, me, isOwner, set.group_id, version, reloadMembers);
  // Only an Owner of a Set that is in no Group can move it into one.
  const { groups } = useGroups(me, isOwner && !set.group_id);
  // Groups the Set could go into: where I am an Owner or Helper.
  const targets = (groups ?? []).filter((g) => g.my_role !== "viewer");
  // A per-Set row exists only for people added to this Set, not for Group-only access.
  const hasOwnRow = (members ?? []).some((m) => m.user_id === me);
  const [target, setTarget] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const onlineIds = new Set(online.map((o) => o.user_id));

  async function createAndShare(role: Invite["role"]) {
    const created = await invite(role);
    if (created) {
      send(created.token);
    }
  }

  async function send(token: string) {
    try {
      if (
        (await shareLink(
          inviteUrl(token),
          set.title,
          `Help me check "${set.title}" in BrickCheck`,
        )) === "copied"
      ) {
        setCopied(token);
        setTimeout(() => setCopied(null), 2000);
      }
    } catch {
      setActionError("Could not copy the link");
    }
  }

  async function leaveOrDelete() {
    const question = isOwner
      ? `Delete "${set.title}" for everyone? Progress is lost.`
      : `Leave "${set.title}"? You can rejoin with an invite link.`;
    if (!window.confirm(question)) {
      return;
    }
    if (await (isOwner ? deleteSet() : leave())) {
      navigate("/", { replace: true });
    }
  }

  async function moveOut() {
    const question = `Move "${set.title}" out of ${set.group_name ? `"${set.group_name}"` : "its group"}? People who have access only through the group lose it. Members added to this set keep their roles.`;
    if (window.confirm(question)) {
      await moveToGroup(null);
    }
  }

  async function moveIn() {
    if (target && (await moveToGroup(target))) {
      setTarget("");
    }
  }

  async function confirmReset() {
    const question = `Reset all counts in "${set.title}" to zero for everyone? This can't be undone.`;
    if (window.confirm(question) && (await resetCounts())) {
      navigate(`/sets/${setId}`);
    }
  }

  return (
    <>
      <Header title={`Manage · ${set.title}`} back={`/sets/${setId}`} />
      {(error || actionError) && (
        <ErrorBanner
          message={(error || actionError)!}
          onClose={() => {
            clearError();
            setActionError(null);
          }}
        />
      )}
      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
        {isOwner && (
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold">Invite people</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Send a link. Anyone who opens it and logs in joins this set. Links
              expire after 7 days.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => createAndShare("helper")}>
                Invite helpers
              </Button>
              <Button
                variant="secondary"
                onClick={() => createAndShare("viewer")}
              >
                Invite viewers
              </Button>
            </div>
            {invites.length > 0 && (
              <ul className="flex flex-col gap-2 text-sm">
                {invites.map((i) => (
                  <li
                    key={i.token}
                    className="flex items-center gap-2 rounded-xl bg-white p-2 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800"
                  >
                    <span className="flex-1">
                      {roleLabel[i.role]} link · expires{" "}
                      {new Date(i.expires_at).toLocaleDateString()}
                    </span>
                    <button
                      className="min-h-11 px-2 font-semibold text-brick"
                      onClick={() => send(i.token)}
                    >
                      {copied === i.token ? "Copied!" : "Share"}
                    </button>
                    <button
                      className="min-h-11 px-2 text-neutral-500 dark:text-neutral-400"
                      onClick={() => revokeInvite(i.token)}
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {isOwner && (set.group_id || targets.length > 0) && (
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold">Group</h2>
            {set.group_id ? (
              <>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  This set is in{" "}
                  {set.group_name ? `"${set.group_name}"` : "a group"}. Everyone
                  in the group has access to it.
                </p>
                <Button variant="secondary" onClick={moveOut}>
                  Move out of group
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Put this set in a group to share it with everyone in it.
                </p>
                <div className="flex gap-2">
                  <select
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    aria-label="Group to move this set into"
                    className="min-h-11 min-w-0 flex-1 rounded-xl bg-white px-3 ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700"
                  >
                    <option value="">Choose a group</option>
                    {targets.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <Button onClick={moveIn} disabled={!target}>
                    Move in
                  </Button>
                </div>
              </>
            )}
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Members</h2>
          {!members ? (
            <Spinner />
          ) : (
            <ul className="flex flex-col gap-2">
              {members.map((m) => (
                <li
                  key={m.user_id}
                  className="flex items-center gap-3 rounded-xl bg-white p-2 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800"
                >
                  <Avatar
                    name={m.display_name}
                    url={m.avatar_url}
                    online={onlineIds.has(m.user_id)}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {m.display_name || "Unnamed builder"}
                    {m.user_id === me && (
                      <span className="text-neutral-500 dark:text-neutral-400">
                        {" "}
                        (you)
                      </span>
                    )}
                  </span>
                  {isOwner && m.role !== "owner" ? (
                    <>
                      <select
                        value={m.role}
                        onChange={(e) =>
                          setRole(m.user_id, e.target.value as Invite["role"])
                        }
                        className="min-h-11 rounded-lg bg-transparent px-1 text-sm"
                        aria-label={`Role of ${m.display_name ?? "member"}`}
                      >
                        <option value="helper">{roleLabel.helper}</option>
                        <option value="viewer">{roleLabel.viewer}</option>
                      </select>
                      <button
                        className="min-h-11 px-2 text-sm text-neutral-500 dark:text-neutral-400"
                        onClick={() =>
                          window.confirm(
                            `Remove ${m.display_name || "this member"}? Links you sent before won't let them back in.`,
                          ) && remove(m.user_id)
                        }
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">
                      {roleLabel[m.role]}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {set.group_id && groupMembers.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold">
              Through the group{set.group_name ? ` "${set.group_name}"` : ""}
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              These people have access to this set because they are in the
              group, with their role in it. Manage them on the Groups page.
            </p>
            <ul className="flex flex-col gap-2">
              {groupMembers.map((m) => (
                <li
                  key={m.user_id}
                  className="flex items-center gap-3 rounded-xl bg-white p-2 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800"
                >
                  <Avatar name={m.display_name} url={m.avatar_url} />
                  <span className="min-w-0 flex-1 truncate">
                    {m.display_name || "Unnamed builder"}
                    {m.user_id === me && (
                      <span className="text-neutral-500 dark:text-neutral-400">
                        {" "}
                        (you)
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    {roleLabel[m.role]} · group
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {isOwner && (
          <Button
            variant="secondary"
            onClick={confirmReset}
            className="text-red-700 dark:text-red-400"
          >
            Reset counts
          </Button>
        )}
        {isOwner || hasOwnRow ? (
          <Button
            variant="secondary"
            onClick={leaveOrDelete}
            className="text-red-700 dark:text-red-400"
          >
            {isOwner ? "Delete set" : "Leave set"}
          </Button>
        ) : (
          members && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              You have access to this set through its group. To lose it, leave
              the group on the{" "}
              <Link to="/groups" className="font-semibold text-brick underline">
                Groups page
              </Link>
              .
            </p>
          )
        )}
      </main>
    </>
  );
}
