import { memo, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { useLongPress } from "../hooks/useLongPress";
import {
  isAllFound,
  partLabel,
  partNumber,
  partSize,
  type Part,
} from "../lib/parts";
import { ColorSwatch, PartImage } from "./ui";

interface Props {
  part: Part;
  canEdit: boolean;
  onTap: (part: Part, delta: number) => void;
  /** Opens the part's sheet: a long press, or the button keyboard users can focus. */
  onEnlarge: (key: string) => void;
}

/** Tap the card to count one found piece; the "−" button undoes one, a long press opens the part's sheet. */
export const PartCard = memo(
  function PartCard({ part, canEdit, onTap, onEnlarge }: Props) {
    const { t, number } = useLanguage();
    const allFound = isAllFound(part);
    const press = useLongPress(() => onEnlarge(part.key));
    const size = partSize(part);
    // The count pops when it goes up, whoever ticked: a new key restarts the animation.
    const [shownFound, setShownFound] = useState(part.found);
    const [pops, setPops] = useState(0);
    if (part.found !== shownFound) {
      setShownFound(part.found);
      if (part.found > shownFound) {
        setPops(pops + 1);
      }
    }
    return (
      <div
        // The whole card, so a right-click on "−" or the corner of the picture does not show the browser's menu either.
        onContextMenu={press.onContextMenu}
        className={`relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition [contain-intrinsic-size:auto_10rem] [content-visibility:auto] dark:bg-neutral-900 ${
          allFound ? "ring-green-600" : "ring-neutral-200 dark:ring-neutral-800"
        }`}
      >
        <button
          type="button"
          // Not `disabled`: a disabled button swallows the pointer events a long press needs.
          aria-disabled={!canEdit || allFound}
          onClick={() => {
            if (!press.swallowClick() && canEdit && !allFound) {
              onTap(part, 1);
            }
          }}
          onPointerDown={press.onPointerDown}
          onPointerMove={press.onPointerMove}
          onPointerUp={press.onPointerUp}
          onPointerCancel={press.onPointerCancel}
          onPointerLeave={press.onPointerLeave}
          // A fully found part dims its content only: "−" still works and looks it.
          className={`flex flex-1 flex-col items-stretch p-1.5 text-left transition active:scale-[0.97] aria-disabled:active:scale-100 sm:p-2 ${press.className} ${allFound ? "opacity-50" : ""}`}
          aria-label={[
            t("set.part.tapLabel", {
              label: partLabel(part),
              found: part.found,
              needed: part.needed,
            }),
            // The marks on the picture are icons: their words go here.
            part.has_minifig_lines && t("set.part.minifig"),
            part.has_spare_lines && t("set.part.spare"),
          ]
            .filter(Boolean)
            .join(". ")}
        >
          {/* Pictures come with a white background, so their frame is white in both themes. */}
          <span className="relative">
            <PartImage
              src={part.img_url}
              alt=""
              // The picture ignores touch, so iOS has no image to lift out when you hold the card.
              className="pointer-events-none aspect-square w-full rounded-xl bg-white p-1"
            />
            {/* Minifig and spare marks sit on the top-left corner, so they take no row of their own. Their words are in the button's label. */}
            {(part.has_minifig_lines || part.has_spare_lines) && (
              <span className="absolute top-1 left-1 flex flex-col items-start gap-1">
                {part.has_minifig_lines && (
                  <span
                    title={t("set.part.minifig")}
                    className="flex size-5 items-center justify-center rounded-full bg-yellow-300 text-yellow-950 ring-1 ring-black/10"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="size-3.5"
                      aria-hidden
                    >
                      <circle cx="12" cy="7" r="4" />
                      <path d="M4 21c0-5 3.5-8 8-8s8 3 8 8z" />
                    </svg>
                  </span>
                )}
                {part.has_spare_lines && (
                  <span
                    title={t("set.part.spare")}
                    className="flex size-5 items-center justify-center rounded-full bg-sky-200 text-sky-950 ring-1 ring-black/10"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      className="size-3"
                      aria-hidden
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                )}
              </span>
            )}
            {/* The count sits on the picture's corner, so the card needs no row of its own. */}
            <span
              key={pops}
              className={`absolute bottom-1 left-1 origin-bottom-left rounded-lg bg-neutral-900/85 px-1.5 py-0.5 text-sm leading-tight font-bold text-white tabular-nums ${pops > 0 ? "animate-count-pop motion-reduce:animate-none" : ""}`}
            >
              {allFound ? "✓ " : ""}
              {number(part.found)}
              <span className="text-[11px] font-normal text-neutral-300">
                /{number(part.needed)}
              </span>
            </span>
          </span>
          <span className="mt-1 flex items-baseline justify-between gap-1 text-xs font-medium tabular-nums sm:text-sm">
            <span className="truncate">{partNumber(part)}</span>
            {size && <span className="shrink-0 font-bold">{size}</span>}
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
        {/* Keyboard and screen-reader users have no long press: this button, hidden until focused, opens the same sheet. */}
        <button
          type="button"
          onClick={() => onEnlarge(part.key)}
          className="sr-only absolute top-1 right-1 z-10 min-h-11 rounded-full bg-neutral-900 px-3 text-sm font-semibold text-white focus:not-sr-only dark:bg-white dark:text-neutral-900"
        >
          {t("set.part.details", { label: partLabel(part) })}
        </button>
        {/* Same box as the picture, so "−" sits on its bottom-right corner. */}
        <div className="pointer-events-none absolute inset-x-1.5 top-1.5 aspect-square sm:inset-x-2 sm:top-2">
          {canEdit && part.found > 0 && (
            <button
              type="button"
              onClick={() => onTap(part, -1)}
              className="pointer-events-auto absolute right-0 bottom-0 flex size-11 items-center justify-center"
              aria-label={t("set.part.removeOne", { name: part.part_name })}
            >
              {/* A 28px mark inside a 44px touch target. */}
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
