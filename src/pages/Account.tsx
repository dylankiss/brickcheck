import { useState, type FormEvent } from "react";
import { Avatar } from "../components/Avatar";
import { Button, ErrorBanner, Header } from "../components/ui";
import { useAuth } from "../hooks/useAuth";

/** Your own details: the name other people see, your login email, and signing out. */
export default function Account() {
  const { session, profile, updateName, signOut } = useAuth();
  const current = profile?.display_name ?? "";
  const [name, setName] = useState(current);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const changed = trimmed !== current && trimmed !== "";

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateName(trimmed);
      setName(trimmed);
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header title="Account" back="/" />
      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}
      <main className="mx-auto flex max-w-2xl flex-col gap-8 p-4">
        <div className="flex items-center gap-4">
          <Avatar
            name={profile?.display_name ?? null}
            url={profile?.avatar_url}
            size="size-16"
          />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">
              {profile?.display_name ?? "No name yet"}
            </p>
            <p className="truncate text-sm text-neutral-500">
              {session?.user.email}
            </p>
          </div>
        </div>

        <form onSubmit={save} className="flex flex-col gap-2">
          <label htmlFor="display-name" className="font-semibold">
            Name
          </label>
          <p className="text-sm text-neutral-500">
            People you share sets with see this name.
          </p>
          <div className="flex gap-2">
            <input
              id="display-name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              className="min-h-11 min-w-0 flex-1 rounded-xl bg-white px-3 ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700"
            />
            <Button type="submit" disabled={busy || !changed}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
          <p
            className="min-h-5 text-sm text-green-700 dark:text-green-400"
            aria-live="polite"
          >
            {saved ? "Saved" : ""}
          </p>
        </form>

        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Email</h2>
          <p className="text-neutral-600 dark:text-neutral-300">
            {session?.user.email ?? "Unknown"}
          </p>
          <p className="text-sm text-neutral-500">
            This is the address you log in with. It can't be changed here.
          </p>
        </section>

        <Button variant="secondary" onClick={() => signOut()}>
          Sign out
        </Button>
      </main>
    </>
  );
}
