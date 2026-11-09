import { memo, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { isAllFound, partLabel, partNumber, type Part } from "../lib/parts";
import { EnlargeButton } from "./EnlargedPicture";
import { ColorSwatch, PartImage } from "./ui";

interface Props {
  part: Part;
  canEdit: boolean;
  onTap: (part: Part, delta: 1 | -1) => void;
  onEnlarge: (key: string) => void;
}

/** Tap the card to count one found piece; the "−" button undoes one, the magnifier enlarges the picture. */
export const PartCard = memo(
  function PartCard({ part, canEdit, onTap, onEnlarge }: Props) {
    const { t, number } = useLanguage();
    const allFound = isAllFound(part);
    const [noPicture, setNoPicture] = useState(!part.img_url);
    return (
      <div
        className={`relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition [contain-intrinsic-size:auto_10rem] [content-visibility:auto] dark:bg-neutral-900 ${
          allFound ? "ring-green-600" : "ring-neutral-200 dark:ring-neutral-800"
        }`}
      >
        <button
          type="button"
          disabled={!canEdit || allFound}
          onClick={() => onTap(part, 1)}
          // A fully found part dims its content only: "−" and the magnifier still work and look it.
          className={`flex flex-1 flex-col items-stretch p-1.5 text-left transition active:scale-[0.97] disabled:active:scale-100 sm:p-2 ${allFound ? "opacity-50" : ""}`}
          aria-label={t("set.part.tapLabel", {
            label: partLabel(part),
            found: part.found,
            needed: part.needed,
          })}
        >
          {/* Pictures come with a white background, so their frame is white in both themes. */}
          <span className="relative">
            <PartImage
              src={part.img_url}
              alt=""
              onError={() => setNoPicture(true)}
              className="aspect-square w-full rounded-xl bg-white p-1"
            />
            {/* Minifig and spare labels sit on the top-left corner, so they take no row of their own. */}
            {(part.has_minifig_lines || part.has_spare_lines) && (
              <span className="absolute top-1 left-1 flex flex-col items-start gap-0.5">
                {part.has_minifig_lines && (
                  <span className="rounded bg-yellow-300 px-1 text-[10px] leading-tight font-semibold text-yellow-950 uppercase">
                    {t("set.part.minifig")}
                  </span>
                )}
                {part.has_spare_lines && (
                  <span className="rounded bg-sky-200 px-1 text-[10px] leading-tight font-semibold text-sky-950 uppercase">
                    {t("set.part.spare")}
                  </span>
                )}
              </span>
            )}
            {/* The count sits on the picture's corner, so the card needs no row of its own. */}
            <span className="absolute bottom-1 left-1 rounded-lg bg-neutral-900/85 px-1.5 py-0.5 text-sm leading-tight font-bold text-white tabular-nums">
              {allFound ? "✓ " : ""}
              {number(part.found)}
              <span className="text-[11px] font-normal text-neutral-300">
                /{number(part.needed)}
              </span>
            </span>
          </span>
          <span className="mt-1 truncate text-xs font-medium tabular-nums sm:text-sm">
            {partNumber(part)}
          </span>
          <div className="mt-0.5 flex min-w-0 items-center text-[11px] text-neutral-500 sm:text-xs dark:text-neutral-400">
            {/* Swatch and name stay together, the name cut short, so a long one never drops below its swatch. */}
            <span className="flex min-w-0 items-center gap-1.5">
              <ColorSwatch
                rgb={part.color_rgb}
                trans={part.is_trans}
                className="size-3"
              />
              <span className="truncate" title={part.color_name}>
                {part.color_name}
              </span>
            </span>
          </div>
        </button>
        {!noPicture && (
          <EnlargeButton
            label={partLabel(part)}
            onEnlarge={() => onEnlarge(part.key)}
            className="absolute top-1 right-1"
          />
        )}
        {/* Same box as the picture, so "−" sits on its bottom-right corner. */}
        <div className="pointer-events-none absolute inset-x-1.5 top-1.5 aspect-square sm:inset-x-2 sm:top-2">
          {canEdit && part.found > 0 && (
            <button
              type="button"
              onClick={() => onTap(part, -1)}
              className="pointer-events-auto absolute right-0 bottom-0 flex size-11 items-center justify-center"
              aria-label={t("set.part.removeOne", { name: part.part_name })}
            >
              {/* The same 28px mark as the magnifier, inside a 44px touch target. */}
              <span className="flex size-7 items-center justify-center rounded-full bg-white/85 text-neutral-600 shadow-sm ring-1 ring-black/10">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  className="size-4"
                  aria-hidden
                >
                  <path d="M6 12h12" />
                </svg>
              </span>
            </button>
          )}
        </div>
      </div>
    );
  },
  // Parts are rebuilt on every change; re-render only when what they show changed.
  (a, b) =>
    a.part.key === b.part.key &&
    a.part.found === b.part.found &&
    a.part.needed === b.part.needed &&
    a.canEdit === b.canEdit &&
    a.onTap === b.onTap &&
    a.onEnlarge === b.onEnlarge,
);
