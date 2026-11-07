import { useCallback, useState, type ReactNode } from "react";
import { Turnstile } from "../components/Turnstile";
import { turnstileSiteKey } from "../lib/captcha";

/**
 * CAPTCHA for requests Supabase may protect (ARCHITECTURE.md, "Login").
 *
 * Render `widget` inside the form and disable the submit buttons while
 * `pending`. Wrap each protected request in `use`: it hands the request the
 * current token and always asks for a fresh one afterwards, because a token
 * works once, whether the request succeeded or failed. `error` is set when the
 * check itself could not run (for example the script was blocked).
 *
 * Without a site key (local development, the e2e test) there is no widget, it
 * is never pending, and requests get no token.
 */
export function useCaptcha() {
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const widget: ReactNode = (
    <Turnstile
      resetKey={resetKey}
      onToken={(newToken, captchaError) => {
        setToken(newToken);
        setError(captchaError ?? null);
      }}
    />
  );

  const use = useCallback(
    async function use<T>(request: (token?: string) => Promise<T>): Promise<T> {
      try {
        return await request(token ?? undefined);
      } finally {
        setToken(null);
        setResetKey((n) => n + 1);
      }
    },
    [token],
  );

  return {
    widget,
    pending: Boolean(turnstileSiteKey) && !token,
    error,
    use,
  };
}
