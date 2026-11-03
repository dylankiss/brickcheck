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
        className={`relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition [contain-intrinsic-size:auto_14rem] [content-visibility:auto] dark:bg-neutral-900 ${
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
          <PartImage
            src={part.img_url}
            alt=""
            className="aspect-square w-full rounded-xl bg-white p-1"
          />
          <div className="mt-1 flex items-center gap-1.5">
            <ColorSwatch rgb={part.color_rgb} trans={part.is_trans} />
            <span className="truncate text-xs text-neutral-500">
              {part.color_name}
            </span>
          </div>
          <span className="truncate text-xs font-medium" title={part.part_name}>
            {part.part_name}
          </span>
          <span className="mt-1 text-xl font-bold tabular-nums">
            {allFound ? "✓ " : ""}
            {part.found}
            <span className="text-sm font-normal text-neutral-500">
              {" "}
              / {part.needed}
            </span>
          </span>
        </button>
        {canEdit && part.found > 0 && (
          <button
            type="button"
            onClick={() => onTap(part, -1)}
            className="absolute top-1 right-1 flex size-11 items-center justify-center rounded-full bg-neutral-100/90 text-xl font-bold opacity-100 dark:bg-neutral-800/90"
            aria-label={`Remove one ${part.part_name}`}
          >
            −
          </button>
        )}
        {(part.has_minifig_lines || part.has_spare_lines) && (
          <div className="absolute top-2 left-2 flex gap-1 text-[10px] font-semibold uppercase">
            {part.has_minifig_lines && (
              <span className="rounded bg-yellow-300 px-1 text-yellow-950">
                minifig
              </span>
            )}
            {part.has_spare_lines && (
              <span className="rounded bg-sky-200 px-1 text-sky-950">
                spare
              </span>
            )}
          </div>
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
