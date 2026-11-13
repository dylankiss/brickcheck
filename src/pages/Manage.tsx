import { useState, type SubmitEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Avatar } from "../components/Avatar";
import { Button, ErrorBanner, Header, Select, Spinner } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useSetContext } from "../hooks/useSetContext";
import { useGroups } from "../hooks/useGroups";
import { useLanguage } from "../hooks/useLanguage";
import { useMembers } from "../hooks/useMembers";
import { inviteUrl, updateSet } from "../lib/api";
import { shareLink } from "../lib/share";
import type { Invite } from "../lib/types";

const roleKey = {
  owner: "set.role.owner",
  helper: "set.role.helper",
  viewer: "set.role.viewer",
} as const;
const inviteLinkKey = {
  helper: "set.invite.linkHelper",
  viewer: "set.invite.linkViewer",
} as const;

export default function Manage() {
  const navigate = useNavigate();
  const { t, date } = useLanguage();
  const { session } = useAuth();
  const { setId, summary, version, online, members, reloadMembers } =
    useSetContext();
  const set = summary!;
  const isOwner = set.my_role === "owner";
  // Owners and Helpers can rename; Viewers cannot (the database refuses too).
  const canRename = set.my_role === "owner" || set.my_role === "helper";
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
  const [title, setTitle] = useState(set.title);
  const [renaming, setRenaming] = useState(false);
  const [renamed, setRenamed] = useState(false);
  const trimmedTitle = title.trim();
  const titleChanged = trimmedTitle !== set.title && trimmedTitle !== "";
  const onlineIds = new Set(online.map((o) => o.user_id));

  async function rename(e: SubmitEvent) {
    e.preventDefault();
    setRenaming(true);
    setActionError(null);
    try {
      await updateSet(setId, { title: trimmedTitle });
      setTitle(trimmedTitle);
      setRenamed(true);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setRenaming(false);
    }
  }

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
          t("set.manage.shareText", { title: set.title }),
        )) === "copied"
      ) {
        setCopied(token);
        setTimeout(() => setCopied(null), 2000);
      }
    } catch {
      setActionError(t("set.manage.copyError"));
    }
  }

  async function leaveOrDelete() {
    const question = isOwner
      ? t("set.manage.deleteConfirm", { title: set.title })
      : t("set.manage.leaveConfirm", { title: set.title });
    if (!window.confirm(question)) {
      return;
    }
    if (await (isOwner ? deleteSet() : leave())) {
      navigate("/sets", { replace: true });
    }
  }

  async function moveOut() {
    const question = t("set.group.moveOutConfirm", {
      title: set.title,
      group: set.group_name ? `"${set.group_name}"` : t("set.group.itsGroup"),
    });
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
    const question = t("set.manage.resetConfirm", { title: set.title });
    if (window.confirm(question) && (await resetCounts())) {
      navigate(`/sets/${setId}`);
    }
  }

  return (
    <>
      <Header
        title={t("set.manage.title", { title: set.title })}
        back={`/sets/${setId}`}
      />
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
        {canRename && (
          <form onSubmit={rename} className="flex flex-col gap-2">
            <label htmlFor="set-title" className="font-semibold">
              {t("set.rename.label")}
            </label>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t("set.rename.hint")}
            </p>
            <div className="flex gap-2">
              <input
                id="set-title"
                name="set-title"
                required
                maxLength={200}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setRenamed(false);
                }}
                className="min-h-11 min-w-0 flex-1 rounded-xl bg-white px-3 ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700"
              />
              <Button type="submit" disabled={renaming || !titleChanged}>
                {renaming ? t("set.rename.saving") : t("set.rename.save")}
              </Button>
            </div>
            <p
              className="min-h-5 text-sm text-green-700 dark:text-green-400"
              role="status"
            >
              {renamed ? t("set.rename.saved") : ""}
            </p>
          </form>
        )}
        {isOwner && (
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold">{t("set.invite.title")}</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t("set.invite.hint")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => createAndShare("helper")}>
                {t("set.invite.helpers")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => createAndShare("viewer")}
              >
                {t("set.invite.viewers")}
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
                      {t(inviteLinkKey[i.role], { date: date(i.expires_at) })}
                    </span>
                    <button
                      className="min-h-11 px-2 font-semibold text-brick"
                      onClick={() => send(i.token)}
                    >
                      {copied === i.token
                        ? t("set.invite.copied")
                        : t("set.invite.share")}
                    </button>
                    <button
                      className="min-h-11 px-2 text-neutral-500 dark:text-neutral-400"
                      onClick={() => revokeInvite(i.token)}
                    >
                      {t("set.invite.revoke")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {isOwner && (set.group_id || targets.length > 0) && (
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold">{t("set.group.title")}</h2>
            {set.group_id ? (
              <>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {set.group_name
                    ? t("set.group.inNamed", { name: set.group_name })
                    : t("set.group.inUnnamed")}
                </p>
                <Button variant="secondary" onClick={moveOut}>
                  {t("set.group.moveOut")}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {t("set.group.moveInHint")}
                </p>
                <div className="flex gap-2">
                  <Select
                    name="group"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    aria-label={t("set.group.pickLabel")}
                    className="min-w-0 flex-1"
                  >
                    <option value="">{t("set.group.pick")}</option>
                    {targets.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </Select>
                  <Button onClick={moveIn} disabled={!target}>
                    {t("set.group.moveIn")}
                  </Button>
                </div>
              </>
            )}
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">{t("set.members.title")}</h2>
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
                    avatar={m.avatar}
                    online={onlineIds.has(m.user_id)}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {m.display_name || t("set.members.unnamed")}
                    {m.user_id === me && (
                      <span className="text-neutral-500 dark:text-neutral-400">
                        {" "}
                        {t("set.members.you")}
                      </span>
                    )}
                  </span>
                  {isOwner && m.role !== "owner" ? (
                    <>
                      <select
                        name="member-role"
                        value={m.role}
                        onChange={(e) =>
                          setRole(m.user_id, e.target.value as Invite["role"])
                        }
                        className="min-h-11 rounded-lg bg-transparent px-1 text-sm"
                        aria-label={t("set.members.roleOf", {
                          name: m.display_name ?? t("set.members.member"),
                        })}
                      >
                        <option value="helper">{t(roleKey.helper)}</option>
                        <option value="viewer">{t(roleKey.viewer)}</option>
                      </select>
                      <button
                        className="min-h-11 px-2 text-sm text-neutral-500 dark:text-neutral-400"
                        onClick={() =>
                          window.confirm(
                            t("set.members.removeConfirm", {
                              name:
                                m.display_name || t("set.members.thisMember"),
                            }),
                          ) && remove(m.user_id)
                        }
                      >
                        {t("set.members.remove")}
                      </button>
                    </>
                  ) : (
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">
                      {t(roleKey[m.role])}
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
              {set.group_name
                ? t("set.group.viaTitleNamed", { name: set.group_name })
                : t("set.group.viaTitle")}
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t("set.group.viaHint")}
            </p>
            <ul className="flex flex-col gap-2">
              {groupMembers.map((m) => (
                <li
                  key={m.user_id}
                  className="flex items-center gap-3 rounded-xl bg-white p-2 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800"
                >
                  <Avatar
                    name={m.display_name}
                    url={m.avatar_url}
                    avatar={m.avatar}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {m.display_name || t("set.members.unnamed")}
                    {m.user_id === me && (
                      <span className="text-neutral-500 dark:text-neutral-400">
                        {" "}
                        {t("set.members.you")}
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    {t("set.role.viaGroup", { role: t(roleKey[m.role]) })}
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
            {t("set.manage.reset")}
          </Button>
        )}
        {isOwner || hasOwnRow ? (
          <Button
            variant="secondary"
            onClick={leaveOrDelete}
            className="text-red-700 dark:text-red-400"
          >
            {isOwner ? t("set.manage.delete") : t("set.manage.leave")}
          </Button>
        ) : (
          members && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t("set.manage.viaGroupOnly")}
              <Link to="/groups" className="font-semibold text-brick underline">
                {t("set.manage.groupsPage")}
              </Link>
              .
            </p>
          )
        )}
      </main>
    </>
  );
}
