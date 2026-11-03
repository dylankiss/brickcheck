import { useRegisterSW } from "virtual:pwa-register/react";

/** Offers to reload when a new version is ready (never reloads by itself). */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-sm items-center gap-3 rounded-2xl bg-neutral-900 p-3 text-sm text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
    >
      <span className="flex-1">A new version of BrickCheck is ready.</span>
      <button
        className="min-h-11 px-2 text-neutral-400"
        onClick={() => setNeedRefresh(false)}
      >
        Later
      </button>
      <button
        className="min-h-11 rounded-xl bg-brick px-3 font-semibold text-white"
        onClick={() => updateServiceWorker(true)}
      >
        Reload
      </button>
    </div>
  );
}
