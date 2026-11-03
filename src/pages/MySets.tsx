import { Link } from "react-router";
import { ThemeButton } from "../components/ThemeButton";
import {
  ErrorBanner,
  Header,
  PartImage,
  ProgressBar,
  Spinner,
} from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useMySets } from "../hooks/useMySets";
import { isComplete } from "../lib/parts";

export default function MySets() {
  const { sets, error } = useMySets();
  const { signOut } = useAuth();

  return (
    <>
      <Header title="My sets">
        <div className="absolute top-[calc(env(safe-area-inset-top)+0.375rem)] right-2 flex items-center">
          <ThemeButton />
          <button
            onClick={() => signOut()}
            className="min-h-11 px-2 text-sm text-neutral-500 dark:text-neutral-400"
          >
            Sign out
          </button>
        </div>
      </Header>
      {error && <ErrorBanner message={error} />}
      <main className="mx-auto flex max-w-2xl flex-col gap-3 p-4 pb-28">
        {!sets && !error && <Spinner />}
        {sets?.length === 0 && (
          <p className="py-12 text-center text-neutral-500">
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
          <Link
            key={set.id}
            to={`/sets/${set.id}`}
            className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-neutral-200 active:bg-neutral-100 dark:bg-neutral-900 dark:ring-neutral-800"
          >
            <PartImage
              src={set.catalog_img_url}
              alt=""
              className="size-16 shrink-0 rounded-lg bg-white"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{set.title}</p>
              <p className="truncate text-sm text-neutral-500">
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
                <span className="text-xs text-neutral-500 tabular-nums">
                  {set.found}/{set.needed}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </main>
      <Link
        to="/new"
        className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] flex min-h-14 items-center rounded-full bg-brick px-6 font-semibold text-white shadow-lg"
      >
        + Add a set
      </Link>
    </>
  );
}
