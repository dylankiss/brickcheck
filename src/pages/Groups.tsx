import { useState, type FormEvent } from "react";
import { Avatar } from "../components/Avatar";
import { Button, ErrorBanner, Header, Spinner } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useGroups } from "../hooks/useGroups";
import { listGroupMembers } from "../lib/api";
import type { Group, GroupMember } from "../lib/types";

const roleLabel = {
  owner: "Owner",
  helper: "Helper",
  viewer: "Viewer",
} as const;

export default function Groups() {
  const { session } = useAuth();
  const { groups, error, clearError, create, rename } = useGroups(
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
            <GroupCard key={group.id} group={group} rename={rename} />
          ))}
        </ul>
      </main>
    </>
  );
}

function GroupCard({
  group,
  rename,
}: {
  group: Group;
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
      {members && (
        <ul className="flex flex-col gap-2">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3">
              <Avatar name={m.display_name} url={m.avatar_url} />
              <span className="min-w-0 flex-1 truncate">
                {m.display_name || "Unnamed builder"}
              </span>
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                {roleLabel[m.role]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
