import { useState, type FormEvent } from "react";
import { Avatar } from "../components/Avatar";
import { Button, ErrorBanner, Header } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { usePasskeys } from "../hooks/usePasskeys";
import { passkeysSupported } from "../lib/api";
import type { Passkey } from "../lib/types";

const date = (iso: string) => new Date(iso).toLocaleDateString();

/** Log in with Face ID, Touch ID or a password manager instead of an emailed code. */
function Passkeys() {
  const { passkeys, error, busy, add, remove } = usePasskeys();
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">Passkeys</h2>
      <p className="text-sm text-neutral-500">
        Log in with Face ID, Touch ID or your password manager, without waiting
        for an email.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="flex flex-col gap-2">
        {passkeys?.map((p: Passkey) => (
          <li
            key={p.id}
            className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {p.friendly_name || "Passkey"}
              </p>
              <p className="text-sm text-neutral-500">
                Added {date(p.created_at)}
                {p.last_used_at && `, last used ${date(p.last_used_at)}`}
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Remove this passkey?")) {
                  remove(p.id);
                }
              }}
              className="min-h-11 px-2 text-sm text-red-600 disabled:opacity-50"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <Button variant="secondary" disabled={busy} onClick={add}>
        {busy ? "Waiting…" : "Add a passkey"}
      </Button>
    </section>
  );
}

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

        {passkeysSupported() && <Passkeys />}

        <Button variant="secondary" onClick={() => signOut()}>
          Sign out
        </Button>
      </main>
    </>
  );
}
