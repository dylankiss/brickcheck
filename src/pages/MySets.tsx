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
        {sets?.some((c) => !isComplete(c)) && (
          <Link
            to="/missing"
            className="flex min-h-11 items-center justify-between rounded-2xl px-3 text-sm font-semibold text-brick ring-1 ring-brick"
          >
            Found a piece? See where it goes
            <span aria-hidden>›</span>
          </Link>
        )}
        {sets?.map((set) => (
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
                  {set.my_role !== "owner" && " · shared with you"}
                </p>
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
