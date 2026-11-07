import { useOnline } from "../hooks/useOnline";

/** Tells people why taps and sign-in fail while the device is offline. */
export function OfflineBanner() {
  if (useOnline()) {
    return null;
  }
  return (
    <p
      role="status"
      className="mt-1 rounded-xl bg-amber-100 px-3 py-1.5 text-center text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      You're offline. Changes can't be saved right now.
    </p>
  );
}
