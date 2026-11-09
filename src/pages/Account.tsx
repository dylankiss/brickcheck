import { useState, type FormEvent } from "react";
import { Avatar } from "../components/Avatar";
import { Button, ErrorBanner, Header, Select } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../hooks/useLanguage";
import { usePasskeys } from "../hooks/usePasskeys";
import { passkeysSupported } from "../lib/api";
import { LANGUAGES, type Language } from "../lib/i18n";
import type { Passkey } from "../lib/types";

/** Log in with Face ID, Touch ID or a password manager instead of an emailed code. */
function Passkeys() {
  const { t, date } = useLanguage();
  const { passkeys, error, busy, add, remove } = usePasskeys();
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("account.passkeys.title")}</h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {t("account.passkeys.hint")}
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
                {p.friendly_name || t("account.passkeys.default")}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {p.last_used_at
                  ? t("account.passkeys.addedLastUsed", {
                      date: date(p.created_at),
                      lastUsed: date(p.last_used_at),
                    })
                  : t("account.passkeys.added", { date: date(p.created_at) })}
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm(t("account.passkeys.removeConfirm"))) {
                  remove(p.id);
                }
              }}
              className="min-h-11 px-2 text-sm text-red-600 disabled:opacity-50"
            >
              {t("account.passkeys.remove")}
            </button>
          </li>
        ))}
      </ul>
      <Button variant="secondary" disabled={busy} onClick={add}>
        {busy ? t("account.passkeys.waiting") : t("account.passkeys.add")}
      </Button>
    </section>
  );
}

/** Your own details: the name other people see, your login email, and signing out. */
export default function Account() {
  const { t, language, setLanguage } = useLanguage();
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
      <Header title={t("account.title")} back="/" />
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
              {profile?.display_name ?? t("account.noName")}
            </p>
            <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
              {session?.user.email}
            </p>
          </div>
        </div>

        <form onSubmit={save} className="flex flex-col gap-2">
          <label htmlFor="display-name" className="font-semibold">
            {t("account.name.label")}
          </label>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("account.name.hint")}
          </p>
          <div className="flex gap-2">
            <input
              id="display-name"
              name="display-name"
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
              {busy ? t("account.saving") : t("account.save")}
            </Button>
          </div>
          <p
            className="min-h-5 text-sm text-green-700 dark:text-green-400"
            role="status"
          >
            {saved ? t("account.saved") : ""}
          </p>
        </form>

        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">{t("account.email.title")}</h2>
          <p className="text-neutral-600 dark:text-neutral-300">
            {session?.user.email ?? t("account.email.unknown")}
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("account.email.hint")}
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <label htmlFor="language" className="font-semibold">
            {t("account.language.label")}
          </label>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("account.language.hint")}
          </p>
          <Select
            id="language"
            name="language"
            value={language}
            className="w-full"
            onChange={(e) => setLanguage(e.target.value as Language)}
          >
            {Object.entries(LANGUAGES).map(([code, name]) => (
              <option key={code} value={code} lang={code}>
                {name}
              </option>
            ))}
          </Select>
        </section>

        {passkeysSupported() && <Passkeys />}

        <Button variant="secondary" onClick={() => signOut()}>
          {t("account.signOut")}
        </Button>
      </main>
    </>
  );
}
