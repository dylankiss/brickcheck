import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";

const KEY = "brickcheck.hint.longPress";

const dismissed = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/** A one-time tip about the long press, remembered on this device once dismissed. */
export function LongPressHint() {
  const { t } = useLanguage();
  const [hidden, setHidden] = useState(dismissed);
  if (hidden) {
    return null;
  }
  return (
    <div className="col-span-full flex items-center gap-3 rounded-2xl bg-neutral-100 px-4 py-2 text-sm dark:bg-neutral-900">
      <p className="flex-1">{t("set.hint.longPress")}</p>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(KEY, "1");
          } catch {
            // Private mode: the tip just comes back next time.
          }
          setHidden(true);
        }}
        className="min-h-11 shrink-0 rounded-xl px-3 font-semibold underline"
      >
        {t("set.hint.dismiss")}
      </button>
    </div>
  );
}
