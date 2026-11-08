import { useState, type FormEvent } from "react";
import { Avatar } from "../components/Avatar";
import { GroupInvites } from "../components/GroupInvites";
import { Button, ErrorBanner, Header, Spinner } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useGroups } from "../hooks/useGroups";
import {
  listGroupMembers,
  removeGroupMember,
  setGroupMemberRole,
} from "../lib/api";
import type { Group, GroupMember } from "../lib/types";

const roleLabel = {
  owner: "Owner",
  helper: "Helper",
  viewer: "Viewer",
} as const;

export default function Groups() {
  const { session } = useAuth();
  const { groups, error, clearError, create, rename, reload } = useGroups(
    session!.user.id,
  );
  const [name, setName] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim() && (await create(name))) {
      setName("");
    }
  }

  return (
    <>
      <Header title="Groups" back="/" />
      {error && <ErrorBanner message={error} onClose={clearError} />}
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="New group name"
            aria-label="New group name"
            className="min-h-11 min-w-0 flex-1 rounded-xl bg-white px-3 ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700"
          />
          <Button type="submit" disabled={!name.trim()}>
            Create
          </Button>
        </form>
        {!groups && !error && <Spinner />}
        {groups?.length === 0 && (
          <p className="py-8 text-center text-neutral-500 dark:text-neutral-400">
            No groups yet. Create one to share many sets with the same people.
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
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);
  const isOwner = group.my_role === "owner";

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
    const name = m.display_name || "this member";
    const question =
      m.user_id === me
        ? `Remove yourself from "${group.name}"? You will lose access to its sets, including ones you added; they stay in the group.`
        : `Remove ${name} from "${group.name}"? They lose access to its sets, including ones they added; the sets stay in the group. Links you sent before won't let them back in.`;
    if (window.confirm(question)) {
      void changeMember(() => removeGroupMember(group.id, m.user_id));
    }
  }

  async function save(e: FormEvent) {
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
            aria-label={`New name for ${group.name}`}
            className="min-h-11 min-w-0 flex-1 rounded-xl bg-transparent px-3 ring-1 ring-neutral-300 dark:ring-neutral-700"
          />
          <Button type="submit" disabled={!name.trim()}>
            Save
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setName(group.name);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{group.name}</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Your role: {roleLabel[group.my_role]}
            </p>
          </div>
          {isOwner && (
            <button
              className="min-h-11 px-2 font-semibold text-brick"
              onClick={() => setEditing(true)}
              aria-label={`Rename ${group.name}`}
            >
              Rename
            </button>
          )}
          <button
            className="min-h-11 px-2 text-neutral-500 dark:text-neutral-400"
            onClick={toggleMembers}
            aria-expanded={members !== null}
          >
            Members
          </button>
        </div>
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
                    aria-label={`Role of ${m.display_name || "member"}`}
                  >
                    <option value="owner">{roleLabel.owner}</option>
                    <option value="helper">{roleLabel.helper}</option>
                    <option value="viewer">{roleLabel.viewer}</option>
                  </select>
                  <button
                    className="min-h-11 px-2 text-sm text-neutral-500 dark:text-neutral-400"
                    onClick={() => remove(m)}
                    aria-label={`Remove ${m.display_name || "member"}`}
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
    </li>
  );
}
