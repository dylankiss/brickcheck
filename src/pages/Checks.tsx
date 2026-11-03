import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import {
  Button,
  ErrorBanner,
  Header,
  PartImage,
  ProgressBar,
  Spinner,
} from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useChecks } from "../hooks/useChecks";
import { signOut, updateMyName } from "../lib/api";

/** Asks email users (who have no name yet) what others should see. */
function NamePrompt() {
  const { session, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await updateMyName(session!.user.id, name.trim());
      await refreshProfile();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form
      onSubmit={save}
      className="flex flex-col gap-2 rounded-2xl bg-yellow-50 p-3 ring-1 ring-yellow-300 dark:bg-yellow-950 dark:ring-yellow-800"
    >
      <label htmlFor="display-name" className="text-sm font-medium">
        What name should people you check with see?
      </label>
      <div className="flex gap-2">
        <input
          id="display-name"
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="min-h-11 min-w-0 flex-1 rounded-xl bg-white px-3 ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700"
        />
        <Button type="submit" disabled={!name.trim()}>
          Save
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

export default function Checks() {
  const { checks, error } = useChecks();
  const { profile } = useAuth();

  return (
    <>
      <Header title="My checks">
        <button
          onClick={() => signOut()}
          className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-4 text-sm text-neutral-500"
        >
          Sign out
        </button>
      </Header>
      {error && <ErrorBanner message={error} />}
      <main className="mx-auto flex max-w-2xl flex-col gap-3 p-4 pb-28">
        {profile && !profile.display_name && <NamePrompt />}
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
                {check.set_num} · {check.set_name}
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
