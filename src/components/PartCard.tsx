import { memo } from "react";
import { isAllFound, type Part } from "../lib/parts";
import { ColorSwatch, PartImage } from "./ui";

interface Props {
  part: Part;
  canEdit: boolean;
  onTap: (part: Part, delta: 1 | -1) => void;
}

/** Tap the card to count one found piece; the "−" button undoes one. */
export const PartCard = memo(
  function PartCard({ part, canEdit, onTap }: Props) {
    const allFound = isAllFound(part);
    return (
      <div
        className={`relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition [contain-intrinsic-size:auto_16rem] [content-visibility:auto] dark:bg-neutral-900 ${
          allFound
            ? "opacity-50 ring-green-600"
            : "ring-neutral-200 dark:ring-neutral-800"
        }`}
      >
        <button
          type="button"
          disabled={!canEdit || allFound}
          onClick={() => onTap(part, 1)}
          className="flex flex-1 flex-col items-stretch p-2 text-left active:scale-[0.97] disabled:active:scale-100"
          aria-label={`${part.part_name}, ${part.color_name}: ${part.found} of ${part.needed} found. Tap to add one.`}
        >
          {/* Renders are drawn for a light background; dark mode only dims it. */}
          <PartImage
            src={part.img_url}
            alt=""
            className="aspect-square w-full rounded-xl bg-white p-1 dark:bg-neutral-200"
          />
          <span
            className="mt-2 truncate text-sm font-medium"
            title={part.part_name}
          >
            {part.part_name}
          </span>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-neutral-500">
            <ColorSwatch
              rgb={part.color_rgb}
              trans={part.is_trans}
              className="size-3"
            />
            <span className="truncate">{part.color_name}</span>
            {part.has_minifig_lines && (
              <span className="shrink-0 rounded bg-yellow-300 px-1 text-[10px] font-semibold text-yellow-950 uppercase">
                minifig
              </span>
            )}
            {part.has_spare_lines && (
              <span className="shrink-0 rounded bg-sky-200 px-1 text-[10px] font-semibold text-sky-950 uppercase">
                spare
              </span>
            )}
          </div>
          {/* As tall as the "−" button, which sits at its right end, so nothing above is covered. */}
          <span className="mt-1 flex min-h-11 items-center pr-12">
            <span className="text-xl font-bold tabular-nums">
              {allFound ? "✓ " : ""}
              {part.found}
              <span className="text-sm font-normal text-neutral-500">
                {" "}
                / {part.needed}
              </span>
            </span>
          </span>
        </button>
        {canEdit && part.found > 0 && (
          <button
            type="button"
            onClick={() => onTap(part, -1)}
            className="absolute right-2 bottom-2 flex size-11 items-center justify-center rounded-full bg-neutral-100 text-xl font-bold ring-1 ring-neutral-300 active:bg-neutral-200 dark:bg-neutral-800 dark:ring-neutral-600 dark:active:bg-neutral-700"
            aria-label={`Remove one ${part.part_name}`}
          >
            −
          </button>
        )}
      </div>
    );
  },
  // Parts are rebuilt on every change; re-render only when what they show changed.
  (a, b) =>
    a.part.key === b.part.key &&
    a.part.found === b.part.found &&
    a.part.needed === b.part.needed &&
    a.canEdit === b.canEdit &&
    a.onTap === b.onTap,
);
