import { useLanguage } from "../hooks/useLanguage";
import type { Part } from "../lib/parts";
import { PartImage } from "./ui";

/**
 * What you just ticked off: the part's picture and its new count, with Undo.
 * It sits at the bottom of the screen, where a finger resting on a card does not
 * cover it. The live region stays in the page, and `message` is the full
 * sentence for screen readers, so the bar itself can be just a picture and a
 * number.
 */
export function TickToast({
  part,
  message,
  onUndo,
}: {
  part: Part | null;
  message: string;
  onUndo: () => void;
}) {
  const { t, number } = useLanguage();
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-3 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4rem)] z-20 flex justify-center"
    >
      {part && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-neutral-900 p-1 text-white shadow-lg dark:bg-white dark:text-neutral-900">
          <span className="sr-only">{message}</span>
          {/* Pictures come with a white background, so their frame is white in both themes. */}
          <PartImage
            src={part.img_url}
            alt=""
            className="size-11 shrink-0 rounded-xl bg-white p-0.5"
          />
          <span className="text-xl font-bold tabular-nums" aria-hidden>
            {number(part.found)}
            <span className="text-sm font-normal opacity-70">
              /{number(part.needed)}
            </span>
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
