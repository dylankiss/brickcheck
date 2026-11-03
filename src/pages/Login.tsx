import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router";
import { Button, ErrorBanner } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { signInWithEmail, signInWithGoogle } from "../lib/api";

export default function Login() {
  const { session } = useAuth();
  const location = useLocation();
  // Where to return after login, e.g. an invite link (ARCHITECTURE.md, "Invites").
  // Only same-origin paths: "//evil.com" would be read as another host.
  const requested = (location.state as { from?: string } | null)?.from;
  const from =
    requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  const redirectTo = window.location.origin + from;

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Navigate to={from} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInWithEmail(email.trim(), redirectTo);
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    try {
      await signInWithGoogle(redirectTo);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div className="text-center">
        <div
          className="mx-auto mb-3 grid size-16 grid-cols-2 gap-1 rounded-2xl bg-brick p-3"
          aria-hidden
        >
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="rounded-full bg-white/30" />
          ))}
        </div>
        <h1 className="text-3xl font-bold">BrickCheck</h1>
        <p className="mt-1 text-neutral-500">
          Sort your sets piece by piece, together.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {sent ? (
        <p className="rounded-2xl bg-green-100 p-4 text-center text-green-900 dark:bg-green-950 dark:text-green-100">
          Check your inbox: we sent a login link to <strong>{email}</strong>.
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="min-h-12 rounded-xl bg-white px-4 ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700"
          />
          <Button type="submit" disabled={busy}>
            {busy ? "Sending…" : "Email me a login link"}
          </Button>
        </form>
      )}

      <div className="flex items-center gap-3 text-sm text-neutral-500">
        <span className="h-px flex-1 bg-neutral-300 dark:bg-neutral-700" />
        or
        <span className="h-px flex-1 bg-neutral-300 dark:bg-neutral-700" />
      </div>
      <Button variant="secondary" onClick={google}>
        Continue with Google
      </Button>
    </main>
  );
}
