import { useState } from "react";
import { useNavigate } from "react-router";
import { Avatar } from "../components/Avatar";
import { Button, ErrorBanner, Header, Spinner } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useSetContext } from "../hooks/useSetContext";
import { useMembers } from "../hooks/useMembers";
import { inviteUrl } from "../lib/api";
import type { Invite } from "../lib/types";

const roleLabel = {
  owner: "Owner",
  helper: "Helper",
  viewer: "Viewer",
} as const;

async function shareLink(
  url: string,
  title: string,
): Promise<"shared" | "copied"> {
  if (navigator.share) {
    try {
      await navigator.share({
        title,
        text: `Help me check "${title}" in BrickCheck`,
        url,
      });
      return "shared";
    } catch {
      // Cancelled or unavailable: fall back to copying.
    }
  }
  await navigator.clipboard.writeText(url);
  return "copied";
}

export default function Share() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { setId, summary, version, online, members, reloadMembers } =
    useSetContext();
  const set = summary!;
  const isOwner = set.my_role === "owner";
  const me = session!.user.id;
  const {
    invites,
    error,
    clearError,
    invite,
    revokeInvite,
    setRole,
    remove,
    leave,
    deleteSet,
  } = useMembers(setId, me, isOwner, version, reloadMembers);
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
      if ((await shareLink(inviteUrl(token), set.title)) === "copied") {
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

  return (
    <>
      <Header title={`People · ${set.title}`} back={`/sets/${setId}`} />
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
            <p className="text-sm text-neutral-500">
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
                      className="min-h-11 px-2 text-neutral-500"
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
                      <span className="text-neutral-500"> (you)</span>
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
                        className="min-h-11 px-2 text-sm text-neutral-500"
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
                    <span className="text-sm text-neutral-500">
                      {roleLabel[m.role]}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <Button
          variant="secondary"
          onClick={leaveOrDelete}
          className="text-red-700 dark:text-red-400"
        >
          {isOwner ? "Delete set" : "Leave set"}
        </Button>
      </main>
    </>
  );
}
