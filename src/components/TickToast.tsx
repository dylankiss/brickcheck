import type { HTMLAttributes, ReactNode } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { PartImage } from "./ui";

/** What the Undo bar shows for one tick. */
export interface Tick {
  /** The part's picture, so you recognise it at a glance. */
  picture: string | null;
  /** The full sentence for screen readers. */
  label: string;
  /** What the bar shows next to the picture: the new count, or where the piece went. */
  summary: ReactNode;
}

/**
 * Bottom padding for a page with a TickToast, so its last row can scroll above
 * the bar (the bar sits 4rem above the edge and is about 3.75rem tall). It
 * repeats at `sm:` so a page's own `sm:p-*` does not override it.
 */
export const TICK_TOAST_CLEARANCE =
  "pb-[calc(max(1rem,env(safe-area-inset-bottom))+8rem)] sm:pb-[calc(max(1rem,env(safe-area-inset-bottom))+8rem)]";

/**
 * What you just ticked off: the part's picture and a short summary, with Undo.
 * It sits at the bottom of the screen, where a finger resting on a card does not
 * cover it. The live region stays in the page, and `tick.label` is the full
 * sentence for screen readers, so the bar itself can stay small.
 */
export function TickToast({
  tick,
  onUndo,
  hold,
  inline = false,
}: {
  tick: Tick | null;
  onUndo: () => void;
  /** Pointer and focus handlers that pause the bar's countdown (`useRecentTick`). */
  hold?: HTMLAttributes<HTMLDivElement>;
  /** Not fixed to the bottom of the page: placed where it is rendered (above a panel). */
  inline?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div
      role="status"
      className={`pointer-events-none flex justify-center ${
        inline
          ? "px-3"
          : "fixed inset-x-3 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4rem)] z-20"
      }`}
    >
      {tick && (
        <div
          {...hold}
          className={`pointer-events-auto flex max-w-full items-center gap-3 rounded-2xl bg-neutral-900 p-1 text-white shadow-lg ring-1 ring-white/20 dark:bg-white dark:text-neutral-900 dark:ring-black/10 ${inline ? "mb-2" : ""}`}
        >
          <span className="sr-only">{tick.label}</span>
          {/* Pictures come with a white background, so their frame is white in both themes. */}
          <PartImage
            src={tick.picture}
            alt=""
            className="size-11 shrink-0 rounded-xl bg-white p-0.5"
          />
          <span className="min-w-0" aria-hidden>
            {tick.summary}
          </span>
          <button
            type="button"
            onClick={onUndo}
            className="min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold underline"
          >
            {t("set.tick.undo")}
          </button>
        </div>
      )}
    </div>
  );
}
