import { useLanguage } from "../hooks/useLanguage";
import type { Part } from "../lib/parts";

const buttonClass =
  "flex size-11 items-center justify-center rounded-full bg-neutral-100 text-xl font-bold disabled:opacity-40 dark:bg-neutral-800";

/**
 * A part's count for its sheet: one less, the count, one more, and "Found all"
 * to tick off everything still missing at once. The caller makes the bulk tick
 * one entry of the Undo bar.
 */
export function PartCountControls({
  part,
  onTap,
}: {
  part: Part;
  onTap: (part: Part, delta: number) => void;
}) {
  const { t, number } = useLanguage();
  const missing = part.needed - part.found;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          className={buttonClass}
          disabled={part.found <= 0}
          onClick={() => onTap(part, -1)}
          aria-label={t("set.part.removeOne", { name: part.part_name })}
        >
          −
        </button>
        <p
          role="status"
          className="min-w-16 text-center text-2xl font-bold tabular-nums"
        >
          {number(part.found)}
          <span className="text-base font-normal text-neutral-500 dark:text-neutral-400">
            /{number(part.needed)}
          </span>
        </p>
        <button
          type="button"
          className={buttonClass}
          disabled={missing <= 0}
          onClick={() => onTap(part, 1)}
          aria-label={t("set.part.addOne", { name: part.part_name })}
        >
          +
        </button>
      </div>
      {missing > 1 && (
        <button
          type="button"
          onClick={() => onTap(part, missing)}
          className="min-h-11 w-full rounded-full bg-brick px-4 text-sm font-semibold text-white"
        >
          {t("set.part.foundAll", { count: part.needed })}
        </button>
      )}
    </div>
  );
}
