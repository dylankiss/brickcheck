import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { Link } from "react-router";

export function ProgressBar({
  found,
  needed,
  className = "",
}: {
  found: number;
  needed: number;
  className?: string;
}) {
  const percent = needed ? Math.round((found / needed) * 100) : 0;
  return (
    <div
      className={`h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800 ${className}`}
      role="progressbar"
      aria-label="Progress"
      aria-valuemin={0}
      aria-valuemax={needed}
      aria-valuenow={found}
      aria-valuetext={`${found} of ${needed} found`}
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
  children,
}: {
  title: ReactNode;
  back?: string;
  children?: ReactNode;
}) {
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
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
      <div className="flex min-h-14 items-center gap-2">
        {back && (
          <Link
            to={back}
            className="-ml-2 flex size-11 items-center justify-center rounded-full text-2xl"
            aria-label="Back"
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
  );
}

export function ErrorBanner({
  message,
  onClose,
}: {
  message: string;
  onClose?: () => void;
}) {
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
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
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
        <span className="sr-only">Loading</span>
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
      className={`inline-block shrink-0 rounded-full ring-1 ring-black/20 ${trans ? "opacity-60" : ""} ${className}`}
      style={{ backgroundColor: rgb ? `#${rgb}` : "transparent" }}
    />
  );
}

export function PartImage({
  src,
  alt,
  className = "",
  onError,
}: {
  src: string | null;
  alt: string;
  className?: string;
  /** Called when the picture fails to load and the placeholder takes its place. */
  onError?: () => void;
}) {
  // Rebrickable has no render for some parts; show the placeholder instead of a broken image.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return src && src !== failedSrc ? (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => {
        setFailedSrc(src);
        onError?.();
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
export function PeopleIcon({ className = "size-6" }: { className?: string }) {
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
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
      <path d="M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
    </svg>
  );
}
