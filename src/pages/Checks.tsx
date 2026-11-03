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
import { useChecks } from "../hooks/useChecks";

export default function Checks() {
  const { checks, error } = useChecks();
  const { signOut } = useAuth();

  return (
    <>
      <Header title="My checks">
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
        {!checks && !error && <Spinner />}
        {checks?.length === 0 && (
          <p className="py-12 text-center text-neutral-500">
            No checks yet. Pick a set and start checking.
          </p>
        )}
        {checks?.map((check) => (
          <Link
            key={check.id}
            to={`/checks/${check.id}`}
            className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-neutral-200 active:bg-neutral-100 dark:bg-neutral-900 dark:ring-neutral-800"
          >
            <PartImage
              src={check.set_img_url}
              alt=""
              className="size-16 shrink-0 rounded-lg bg-white"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{check.title}</p>
              <p className="truncate text-sm text-neutral-500">
                {check.title === check.set_name
                  ? check.set_num
                  : `${check.set_num} · ${check.set_name}`}
                {check.my_role !== "owner" && " · shared with you"}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <ProgressBar
                  found={check.found}
                  needed={check.needed}
                  className="flex-1"
                />
                <span className="text-xs text-neutral-500 tabular-nums">
                  {check.found}/{check.needed}
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
        + New check
      </Link>
    </>
  );
}
