import { useEffect, useRef } from "react";
import { turnstileSiteKey } from "../lib/captcha";

// Cloudflare Turnstile CAPTCHA (ARCHITECTURE.md, "Login"). Without a site key
// (local development, the e2e test) it renders nothing and sends no token.

interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      appearance: "interaction-only";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load the CAPTCHA"));
    };
    document.head.append(script);
  });
  return scriptPromise;
}

/**
 * Renders the widget in "interaction-only" mode: it stays invisible unless
 * Cloudflare wants the person to do something. `onToken` gets a token to send
 * with the request, or null when there is none (expired, failed or blocked).
 * A token works once, so change `resetKey` after using it to get a new one.
 */
export function Turnstile({
  onToken,
  resetKey = 0,
}: {
  onToken: (token: string | null, error?: string) => void;
  resetKey?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  });

  useEffect(() => {
    const element = container.current;
    const sitekey = turnstileSiteKey;
    if (!sitekey || !element) {
      return;
    }
    let widgetId: string | undefined;
    const unmounted = new AbortController();
    loadScript().then(
      () => {
        if (unmounted.signal.aborted || !window.turnstile) {
          return;
        }
        widgetId = window.turnstile.render(element, {
          sitekey,
          appearance: "interaction-only",
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () =>
            onTokenRef.current(
              null,
              "The security check failed. Reload the page and try again.",
            ),
        });
      },
      (err: Error) => {
        if (!unmounted.signal.aborted) {
          onTokenRef.current(null, err.message);
        }
      },
    );
    return () => {
      unmounted.abort();
      if (widgetId) {
        window.turnstile?.remove(widgetId);
      }
    };
  }, [resetKey]);

  if (!turnstileSiteKey) {
    return null;
  }
  return <div ref={container} className="flex justify-center" />;
}
