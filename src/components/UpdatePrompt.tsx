import { useLanguage } from "../hooks/useLanguage";
import { useRegisterSW } from "virtual:pwa-register/react";

const CHECK_EVERY_MS = 60 * 60 * 1000;
/** Switching apps back and forth should not ask the server every time. */
const MIN_BETWEEN_CHECKS_MS = 60 * 1000;

/** Offers to reload when a new version is ready (never reloads by itself). */
export function UpdatePrompt() {
  const { t } = useLanguage();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // An installed app can stay open for days. Look for a new version every
    // hour, and whenever the app comes back to the front: iOS freezes timers
    // while it is in the background, so reopening it would not check at all.
    onRegisteredSW: (_url, registration) => {
      if (!registration) {
        return;
      }
      let checkedAt = Date.now();
      const check = () => {
        checkedAt = Date.now();
        // Fails offline; the next check tries again.
        registration.update().catch(() => {});
      };
      setInterval(check, CHECK_EVERY_MS);
      document.addEventListener("visibilitychange", () => {
        if (
          document.visibilityState === "visible" &&
          Date.now() - checkedAt > MIN_BETWEEN_CHECKS_MS
        ) {
          check();
        }
      });
    },
  });

  if (!needRefresh) {
    return null;
  }
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-sm items-center gap-3 rounded-2xl bg-neutral-900 p-3 text-sm text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
    >
      <span className="flex-1">{t("common.update.ready")}</span>
      <button
        className="min-h-11 px-2 text-neutral-400"
        onClick={() => setNeedRefresh(false)}
      >
        {t("common.update.later")}
      </button>
      <button
        className="min-h-11 rounded-xl bg-brick px-3 font-semibold text-white"
        onClick={() => updateServiceWorker(true)}
      >
        {t("common.update.reload")}
      </button>
    </div>
  );
}
