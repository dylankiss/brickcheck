import { useState } from "react";
import { Link } from "react-router";
import { Avatar } from "../components/Avatar";
import { ThemeButton } from "../components/ThemeButton";
import {
  EnlargeableThumbnail,
  EnlargedPicture,
} from "../components/EnlargedPicture";
import { setPicture, type Picture } from "../components/pictures";
import { ErrorBanner, Header, ProgressBar, Spinner } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useMySets } from "../hooks/useMySets";
import { isComplete } from "../lib/parts";

export default function MySets() {
  const { sets, error } = useMySets();
  const { profile } = useAuth();
  const [enlarged, setEnlarged] = useState<Picture | null>(null);
  // "all", "none" (Sets in no Group) or a Group id.
  const [filter, setFilter] = useState("all");
  const groupOptions = [
    ...new Map(
      (sets ?? [])
        .filter((c) => c.group_id && c.group_name)
        .map((c) => [c.group_id!, c.group_name!]),
    ),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  // A chosen Group that dropped out of the options (left, or its last Set moved out) counts as All.
  const activeFilter =
    filter === "all" ||
    filter === "none" ||
    groupOptions.some(([id]) => id === filter)
      ? filter
      : "all";
  const shown = (sets ?? []).filter(
    (c) =>
      activeFilter === "all" ||
      (activeFilter === "none" ? !c.group_id : c.group_id === activeFilter),
  );

  return (
    <>
      <Header title="My sets">
        <div className="absolute top-[calc(env(safe-area-inset-top)+0.375rem)] right-2 flex items-center">
          <ThemeButton />
          <Link
            to="/account"
            className="flex min-h-11 min-w-11 items-center justify-center"
            aria-label="Account"
          >
            <Avatar
              name={profile?.display_name ?? null}
              url={profile?.avatar_url}
              size="size-8"
            />
          </Link>
        </div>
      </Header>
      {error && <ErrorBanner message={error} />}
      <main className="mx-auto flex max-w-2xl flex-col gap-3 p-4 pb-28">
        {!sets && !error && <Spinner />}
        {sets?.length === 0 && (
          <p className="py-12 text-center text-neutral-500 dark:text-neutral-400">
            No sets yet. Add one and start checking.
          </p>
        )}
        <Link
          to="/groups"
          className="flex min-h-11 items-center justify-between rounded-2xl px-3 text-sm font-semibold text-brick ring-1 ring-brick"
        >
          Groups
          <span aria-hidden>›</span>
        </Link>
        {sets?.some((c) => !isComplete(c)) && (
          <Link
            to="/missing"
            className="flex min-h-11 items-center justify-between rounded-2xl px-3 text-sm font-semibold text-brick ring-1 ring-brick"
          >
            Found a piece? See where it goes
            <span aria-hidden>›</span>
          </Link>
        )}
        {groupOptions.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium">Group</span>
            <select
              value={activeFilter}
              onChange={(e) => setFilter(e.target.value)}
              className="min-h-11 min-w-0 flex-1 rounded-xl bg-white px-3 ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700"
            >
              <option value="all">All sets</option>
              <option value="none">Not in a group</option>
              {groupOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
        {sets && sets.length > 0 && shown.length === 0 && (
          <p
            role="status"
            className="py-8 text-center text-neutral-500 dark:text-neutral-400"
          >
            No sets in this group.
          </p>
        )}
        {shown.map((set) => (
          // The whole card opens the set; the picture on top of it (a sibling, not nested) enlarges.
          <div key={set.id} className="relative">
            <Link
              to={`/sets/${set.id}`}
              className="flex min-h-22 items-center rounded-2xl bg-white p-3 pl-22 ring-1 ring-neutral-200 active:bg-neutral-100 dark:bg-neutral-900 dark:ring-neutral-800 dark:active:bg-neutral-800"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{set.title}</p>
                <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
                  {set.title === set.catalog_name
                    ? set.set_num
                    : `${set.set_num} · ${set.catalog_name}`}
                  {!set.group_name &&
                    set.my_role !== "owner" &&
                    " · shared with you"}
                </p>
                {set.group_name && (
                  <p className="mt-1">
                    <span className="inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                      Group: {set.group_name}
                    </span>
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <ProgressBar
                    found={set.found}
                    needed={set.needed}
                    className="flex-1"
                  />
                  <span className="text-xs text-neutral-500 tabular-nums dark:text-neutral-400">
                    {set.found}/{set.needed}
                  </span>
                </div>
              </div>
            </Link>
            <div className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
              <EnlargeableThumbnail
                src={set.catalog_img_url}
                label={set.title}
                onEnlarge={() => setEnlarged(setPicture(set))}
                className="size-16 rounded-lg bg-white"
              />
            </div>
          </div>
        ))}
      </main>
      <Link
        to="/new"
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] flex min-h-14 items-center rounded-full bg-brick px-6 font-semibold text-white shadow-lg"
      >
        + Add a set
      </Link>
      <EnlargedPicture picture={enlarged} onClose={() => setEnlarged(null)} />
    </>
  );
}
