import { useLanguage } from "../hooks/useLanguage";
import { useTheme } from "../hooks/useTheme";
import type { MessageKey } from "../lib/i18n";
import type { Theme } from "../lib/theme";

const NEXT: Record<Theme, Theme> = {
  system: "light",
  light: "dark",
  dark: "system",
};
const LABEL: Record<Theme, MessageKey> = {
  system: "common.theme.system",
  light: "common.theme.light",
  dark: "common.theme.dark",
};

/** Cycles the theme: system → light → dark. */
export function ThemeButton() {
  const { t } = useLanguage();
  const [theme, setTheme] = useTheme();
  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT[theme])}
      className="flex size-11 items-center justify-center rounded-full text-neutral-500 dark:text-neutral-400"
      aria-label={t("common.theme.label", {
        current: t(LABEL[theme]),
        next: t(LABEL[NEXT[theme]]),
      })}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="size-5"
        aria-hidden
      >
        {theme === "light" && (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        )}
        {theme === "dark" && (
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
        )}
        {theme === "system" && (
          <>
            <circle cx="12" cy="12" r="8" />
            <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
          </>
        )}
      </svg>
    </button>
  );
}
