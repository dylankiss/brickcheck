import { useLanguage } from "../hooks/useLanguage";
import { useOnline } from "../hooks/useOnline";

/** Tells people why taps and sign-in fail while the device is offline. */
export function OfflineBanner() {
  const { t } = useLanguage();
  if (useOnline()) {
    return null;
  }
  return (
    <p
      role="status"
      className="mt-1 rounded-xl bg-amber-100 px-3 py-1.5 text-center text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      {t("common.offline")}
    </p>
  );
}
