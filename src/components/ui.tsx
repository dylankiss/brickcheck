import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { Link } from "react-router";
import { useHideOnScroll } from "../hooks/useHideOnScroll";
import { useLanguage } from "../hooks/useLanguage";
import { OfflineBanner } from "./OfflineBanner";

export function ProgressBar({
  found,
  needed,
  className = "",
}: {
  found: number;
  needed: number;
  className?: string;
}) {
  const { t } = useLanguage();
  const percent = needed ? Math.round((found / needed) * 100) : 0;
  return (
    <div
      className={`h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800 ${className}`}
      role="progressbar"
      aria-label={t("common.progress")}
      aria-valuemin={0}
      aria-valuemax={needed}
      aria-valuenow={found}
      aria-valuetext={t("common.progressValue", { found, needed })}
    >
      <div
        className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${percent === 100 ? "bg-green-600" : "bg-brick"}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const styles =
    variant === "primary"
      ? "bg-brick text-white hover:bg-brick-dark disabled:opacity-50"
      : "bg-white text-neutral-900 ring-1 ring-neutral-300 hover:bg-neutral-100 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-neutral-700 dark:hover:bg-neutral-800";
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-semibold transition-colors ${styles} ${className}`}
      {...props}
    />
  );
}

export function Header({
  title,
  back,
  hideOnScroll = false,
  children,
}: {
  title: ReactNode;
  back?: string;
  /** Slide the header out of view while scrolling down. A button brings it back; so does the top of the page. */
  hideOnScroll?: boolean;
  children?: ReactNode;
}) {
  const { t } = useLanguage();
  const { hidden, show } = useHideOnScroll(hideOnScroll);
  // A new page moves focus to its heading, so screen readers announce it and
  // keyboard users start at the top. A field that took focus itself (the
  // catalog search) keeps it.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      active.matches("input, textarea, select")
    ) {
      return;
    }
    heading.current?.focus({ preventScroll: true });
  }, []);

  return (
    <>
      <header
        // Out of view means out of reach too: no tabbing into a hidden header.
        inert={hidden}
        className={`sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 ${
          hideOnScroll ? "transition-transform duration-200" : ""
        } ${hidden ? "-translate-y-full" : ""}`}
      >
        <OfflineBanner />
        <div className="flex min-h-14 items-center gap-2">
          {back && (
            <Link
              to={back}
              className="-ml-2 flex size-11 items-center justify-center rounded-full text-2xl"
              aria-label={t("common.back")}
            >
              ‹
            </Link>
          )}
          <h1
            ref={heading}
            tabIndex={-1}
            className="min-w-0 flex-1 truncate text-lg font-bold outline-none"
          >
            {title}
          </h1>
        </div>
        {children}
      </header>
      {hidden && (
        <button
          type="button"
          onClick={show}
          className="fixed right-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex size-12 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg dark:bg-white dark:text-neutral-900"
          aria-label={t("common.showFilters")}
        >
          <SearchIcon />
        </button>
      )}
    </>
  );
}

export function ErrorBanner({
  message,
  onClose,
}: {
  message: string;
  onClose?: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div
      className="mx-4 my-2 flex items-center gap-2 rounded-xl bg-red-100 px-4 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-100"
      role="alert"
    >
      <span className="flex-1">{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="size-8 shrink-0"
          aria-label={t("common.dismiss")}
        >
          ✕
        </button>
      )}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  const { t } = useLanguage();
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 p-8 text-neutral-500 dark:text-neutral-400"
    >
      {/* Slower, not stopped, for people who prefer reduced motion: it still shows that work is going on. */}
      <div
        aria-hidden="true"
        className="size-8 animate-spin rounded-full border-4 border-neutral-300 border-t-brick motion-reduce:animate-[spin_3s_linear_infinite]"
      />
      {label ? (
        <p className="text-sm">{label}</p>
      ) : (
        <span className="sr-only">{t("common.loading")}</span>
      )}
    </div>
  );
}

export function ColorSwatch({
  rgb,
  trans,
  className = "size-4",
}: {
  rgb: string | null;
  trans?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full ring-1 ring-black/20 dark:ring-white/40 ${trans ? "opacity-60" : ""} ${className}`}
      style={{ backgroundColor: rgb ? `#${rgb}` : "transparent" }}
    />
  );
}

export function PartImage({
  src,
  fallbackSrc = null,
  alt,
  className = "",
  onError,
}: {
  src: string | null;
  /** Tried when `src` fails to load, such as the original of a resized copy. */
  fallbackSrc?: string | null;
  alt: string;
  className?: string;
  /** Called when no picture loads and the placeholder takes its place. */
  onError?: () => void;
}) {
  // Rebrickable has no render for some parts; show the placeholder instead of a broken image.
  const [failed, setFailed] = useState<readonly string[]>([]);
  const shown = [src, fallbackSrc].find((s) => s && !failed.includes(s));
  return shown ? (
    <img
      src={shown}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => {
        setFailed((prev) => [...prev, shown]);
        if (shown === (fallbackSrc ?? src)) {
          onError?.();
        }
      }}
      className={`object-contain ${className}`}
    />
  ) : (
    <div
      className={`flex items-center justify-center text-neutral-400 ${className}`}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
    >
      <BrickIcon className="w-2/5" />
    </div>
  );
}

/** Outline of a 2-stud brick, the placeholder for parts and sets without a picture. */
function BrickIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 36"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="10" y="3" width="10" height="7" rx="1.5" />
      <rect x="28" y="3" width="10" height="7" rx="1.5" />
      <rect x="3" y="10" width="42" height="23" rx="3" />
    </svg>
  );
}

/** Two people: the link to who is on a Set, shown while nobody else is online. */
/** Sliders: the entry to a set's management page (members, invites, reset, delete). */
const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export function SortIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg {...iconProps} className={className}>
      <path d="M7 20V4M7 20l-3-3M7 20l3-3M17 4v16M17 4l-3 3M17 4l3 3" />
    </svg>
  );
}

export function PaletteIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg {...iconProps} className={className}>
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3a3.7 3.7 0 0 0 3.7-3.7C21 6.4 17 3 12 3z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="10" cy="7" r="1" />
      <circle cx="15" cy="7" r="1" />
    </svg>
  );
}

export function EyeOffIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg {...iconProps} className={className}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

export function SearchIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </svg>
  );
}

export function SettingsIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 6h8M16 6h4M4 12h2M10 12h10M4 18h10M18 18h2" />
      <circle cx="14" cy="6" r="2" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="16" cy="18" r="2" />
    </svg>
  );
}

/**
 * A native select with a fixed 44px (or 48px) height. iOS Safari ignores
 * `min-height` on a styled select and draws it short, so it is sized with
 * `height`, and the system arrow is replaced by one of ours.
 */
export function Select({
  tall = false,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { tall?: boolean }) {
  return (
    <span className={`relative inline-flex ${className}`}>
      <select
        {...props}
        className={`w-full appearance-none rounded-xl bg-white pr-9 pl-3 ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700 ${tall ? "h-12 pl-4" : "h-11"}`}
      >
        {children}
      </select>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-neutral-500 dark:text-neutral-400"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}
