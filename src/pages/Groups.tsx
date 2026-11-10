import { useState, type SubmitEvent } from "react";
import { Avatar } from "../components/Avatar";
import { GroupInvites } from "../components/GroupInvites";
import { Button, ErrorBanner, Header, Spinner } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useGroups } from "../hooks/useGroups";
import { useLanguage } from "../hooks/useLanguage";
import {
  deleteGroup,
  leaveGroup,
  listGroupMembers,
  listMySetsInGroup,
  moveSetToGroup,
  removeGroupMember,
  setGroupMemberRole,
} from "../lib/api";
import type { Group, GroupMember } from "../lib/types";

const roleKey = {
  owner: "groups.role.owner",
  helper: "groups.role.helper",
  viewer: "groups.role.viewer",
} as const;

export default function Groups() {
  const { t } = useLanguage();
  const { session } = useAuth();
  const { groups, error, clearError, create, rename, reload } = useGroups(
    session!.user.id,
  );
  const [name, setName] = useState("");

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (name.trim() && (await create(name))) {
      setName("");
    }
  }

  return (
    <>
      <Header title={t("groups.title")} back="/" />
      {error && <ErrorBanner message={error} onClose={clearError} />}
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder={t("groups.newName")}
            aria-label={t("groups.newName")}
            className="min-h-11 min-w-0 flex-1 rounded-xl bg-white px-3 ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700"
          />
          <Button type="submit" disabled={!name.trim()}>
            {t("groups.create")}
          </Button>
        </form>
        {!groups && !error && <Spinner />}
        {groups?.length === 0 && (
          <p className="py-8 text-center text-neutral-500 dark:text-neutral-400">
            {t("groups.none")}
          </p>
        )}
        <ul className="flex flex-col gap-3">
          {groups?.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              me={session!.user.id}
              rename={rename}
              reload={reload}
            />
          ))}
        </ul>
      </main>
    </>
  );
}

function GroupCard({
  group,
  me,
  rename,
  reload,
}: {
  group: Group;
  me: string;
  reload: () => Promise<unknown>;
  rename: (groupId: string, name: string) => Promise<boolean>;
}) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);
  // Set while the leave warning is open: the Sets I added to this Group.
  const [leaving, setLeaving] = useState<
    { id: string; title: string }[] | null
  >(null);
  const isOwner = group.my_role === "owner";

  async function startLeaving() {
    try {
      setLeaving(await listMySetsInGroup(group.id, me));
      setMembersError(null);
    } catch (e) {
      setMembersError((e as Error).message);
    }
  }

  async function moveOut(setId: string) {
    try {
      await moveSetToGroup(setId, null);
      setLeaving(await listMySetsInGroup(group.id, me));
      setMembersError(null);
    } catch (e) {
      setMembersError((e as Error).message);
    }
  }

  async function leave() {
    try {
      await leaveGroup(group.id, me);
      setLeaving(null);
      setMembersError(null);
      await reload();
    } catch (e) {
      setMembersError((e as Error).message);
    }
  }

  async function removeGroup() {
    if (!window.confirm(t("groups.deleteConfirm", { name: group.name }))) {
      return;
    }
    try {
      await deleteGroup(group.id);
      setMembersError(null);
      await reload();
    } catch (e) {
      setMembersError((e as Error).message);
    }
  }

  async function toggleMembers() {
    if (members) {
      setMembers(null);
      return;
    }
    try {
      setMembers(await listGroupMembers(group.id));
      setMembersError(null);
    } catch (e) {
      setMembersError((e as Error).message);
    }
  }

  /** Changes a member, then reloads the list (and my own role, in case it moved). */
  async function changeMember(action: () => Promise<void>) {
    try {
      await action();
      setMembers(await listGroupMembers(group.id));
      setMembersError(null);
    } catch (e) {
      setMembersError((e as Error).message);
    }
    await reload();
  }

  function remove(m: GroupMember) {
    const name = m.display_name || t("groups.member.thisMember");
    const question =
      m.user_id === me
        ? t("groups.member.removeSelfConfirm", { group: group.name })
        : t("groups.member.removeConfirm", { name, group: group.name });
    if (window.confirm(question)) {
      void changeMember(() => removeGroupMember(group.id, m.user_id));
    }
  }

  async function save(e: SubmitEvent) {
    e.preventDefault();
    if (name.trim() && (await rename(group.id, name))) {
      setEditing(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-white p-3 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
      {editing ? (
        <form onSubmit={save} className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            aria-label={t("groups.newNameFor", { name: group.name })}
            className="min-h-11 min-w-0 flex-1 rounded-xl bg-transparent px-3 ring-1 ring-neutral-300 dark:ring-neutral-700"
          />
          <Button type="submit" disabled={!name.trim()}>
            {t("groups.save")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setName(group.name);
              setEditing(false);
            }}
          >
            {t("groups.cancel")}
          </Button>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{group.name}</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t("groups.yourRole", { role: t(roleKey[group.my_role]) })}
            </p>
          </div>
          {isOwner && (
            <button
              className="min-h-11 px-2 font-semibold text-brick"
              onClick={() => setEditing(true)}
              aria-label={t("groups.renameLabel", { name: group.name })}
            >
              {t("groups.rename")}
            </button>
          )}
          <button
            className="min-h-11 px-2 text-neutral-500 dark:text-neutral-400"
            onClick={toggleMembers}
            aria-expanded={members !== null}
          >
            {t("groups.members")}
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          className="min-h-11 px-2 text-sm text-neutral-500 dark:text-neutral-400"
          onClick={() => void startLeaving()}
          aria-expanded={leaving !== null}
          aria-label={t("groups.leaveLabel", { name: group.name })}
        >
          {t("groups.leave")}
        </button>
        {isOwner && (
          <button
            className="min-h-11 px-2 text-sm text-red-700 dark:text-red-300"
            onClick={() => void removeGroup()}
            aria-label={t("groups.deleteLabel", { name: group.name })}
          >
            {t("groups.delete")}
          </button>
        )}
      </div>
      {leaving && (
        <section
          aria-label={t("groups.leaveLabel", { name: group.name })}
          className="flex flex-col gap-2 rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800"
        >
          <p>
            {t("groups.leave.question", { name: group.name })}
            {isOwner && ` ${t("groups.leave.lastOwner")}`}
          </p>
          {leaving.length > 0 ? (
            <>
              <p>{t("groups.leave.added", { count: leaving.length })}</p>
              <ul className="flex flex-col gap-1">
                {leaving.map((set) => (
                  <li key={set.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">{set.title}</span>
                    <button
                      className="min-h-11 px-2 text-sm font-semibold text-brick"
                      onClick={() => void moveOut(set.id)}
                      aria-label={t("groups.leave.moveOutLabel", {
                        title: set.title,
                        name: group.name,
                      })}
                    >
                      {t("groups.leave.moveOut")}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t("groups.leave.addedNone")}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" onClick={() => void leave()}>
              {leaving.length > 0
                ? t("groups.leave.anyway")
                : t("groups.leave.group")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setLeaving(null)}
            >
              {t("groups.cancel")}
            </Button>
          </div>
        </section>
      )}
      {membersError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {membersError}
        </p>
      )}
      {isOwner && <GroupInvites groupId={group.id} groupName={group.name} />}
      {members && (
        <ul className="flex flex-col gap-2">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3">
              <Avatar
                name={m.display_name}
                url={m.avatar_url}
                avatar={m.avatar}
              />
              <span className="min-w-0 flex-1 truncate">
                {m.display_name || t("groups.member.unnamed")}
                {m.user_id === me && (
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {" "}
                    {t("groups.member.you")}
                  </span>
                )}
              </span>
              {isOwner ? (
                <>
                  <select
                    value={m.role}
                    onChange={(e) =>
                      void changeMember(() =>
                        setGroupMemberRole(
                          group.id,
                          m.user_id,
                          e.target.value as GroupMember["role"],
                        ),
                      )
                    }
                    className="min-h-11 rounded-lg bg-transparent px-1 text-sm"
                    aria-label={t("groups.member.roleOf", {
                      name: m.display_name || t("groups.member.member"),
                    })}
                  >
                    <option value="owner">{t(roleKey.owner)}</option>
                    <option value="helper">{t(roleKey.helper)}</option>
                    <option value="viewer">{t(roleKey.viewer)}</option>
                  </select>
                  <button
                    className="min-h-11 px-2 text-sm text-neutral-500 dark:text-neutral-400"
                    onClick={() => remove(m)}
                    aria-label={t("groups.member.removeLabel", {
                      name: m.display_name || t("groups.member.member"),
                    })}
                  >
                    {t("groups.member.remove")}
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
    </li>
  );
}
