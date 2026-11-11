import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  EnlargeableThumbnail,
  EnlargedPart,
} from "../components/EnlargedPicture";
import { ColorFilter } from "../components/ColorFilter";
import { ColorSwatch, ErrorBanner, Header, Spinner } from "../components/ui";
import { TICK_TOAST_CLEARANCE, TickToast } from "../components/TickToast";
import { useLanguage } from "../hooks/useLanguage";
import { useMissingAcrossSets } from "../hooks/useMissingAcrossSets";
import { useRecentTick } from "../hooks/useRecentTick";
import {
  partColors,
  partLabel,
  searchMissingAcross,
  type MissingAcross,
  type Part,
} from "../lib/parts";

/** Every Part still missing in your Sets: find a piece, see where it goes, tick it off there. */
export default function MissingAcrossSets() {
  const { t } = useLanguage();
  const { missing, error, clearError, isBusy, tickOff, untick } =
    useMissingAcrossSets();
  // The last piece added, for the Undo bar. It keeps the Part itself: ticking
  // off the last missing piece takes the Part off the list.
  const [ticked, setTicked, hold] = useRecentTick<{
    setId: string;
    label: string;
    part: Part;
  }>();
  const [query, setQuery] = useState("");
  const [colorId, setColorId] = useState<number | null>(null);
  const [enlarged, setEnlarged] = useState<string | null>(null);

  const all = useMemo(
    () => missing && searchMissingAcross(missing, { query: "", colorId: null }),
    [missing],
  );
  const colors = useMemo(
    () => partColors(missing?.map((m) => m.part) ?? []),
    [missing],
  );
  // Ticking off the last part of the chosen color removes it from the picker: stop filtering on it.
  const activeColor = colors.some((c) => c.id === colorId) ? colorId : null;
  const shown = useMemo(
    () =>
      missing
        ? searchMissingAcross(missing, { query, colorId: activeColor }).parts
        : [],
    [missing, query, activeColor],
  );

  return (
    <>
      <Header title={t("set.missingAll.title")} back="/">
        <div className="flex gap-2 pb-3">
          <input
            name="part-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("set.filter.search")}
            aria-label={t("set.filter.searchLabel")}
            className="min-h-11 min-w-0 flex-1 rounded-xl bg-white px-3 ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700"
          />
          {colors.length > 0 && (
            <ColorFilter
              colors={colors}
              colorId={activeColor}
              onColorChange={setColorId}
            />
          )}
        </div>
      </Header>
      {error && <ErrorBanner message={error} onClose={clearError} />}
      <main
        className={`mx-auto flex max-w-2xl flex-col gap-3 p-4 ${TICK_TOAST_CLEARANCE}`}
      >
        {!missing && !error && <Spinner />}
        {missing?.length === 0 && (
          <p className="py-12 text-center text-neutral-500 dark:text-neutral-400">
            {t("set.missingAll.none")}
          </p>
        )}
        {all && all.parts.length > 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("set.missingAll.summary", {
              pieces: t("set.count.pieces", { count: all.pieces }),
              parts: t("set.count.parts", { count: all.parts.length }),
              sets: t("set.count.sets", { count: all.sets }),
            })}
          </p>
        )}
        {missing && missing.length > 0 && shown.length === 0 && (
          <p className="py-8 text-center text-neutral-500 dark:text-neutral-400">
            {t("set.missingAll.noMatch")}
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {shown.map((entry) => (
            <MissingAcrossItem
              key={entry.part.key}
              entry={entry}
              isBusy={isBusy}
              onTickOff={async (setId, part) => {
                if (await tickOff(setId, part)) {
                  const label = entry.sets.find(
                    (c) => c.setId === setId,
                  )!.label;
                  setTicked({ setId, label, part });
                }
              }}
              onEnlarge={setEnlarged}
            />
          ))}
        </ul>
      </main>
      <TickToast
        hold={hold}
        tick={
          ticked && {
            picture: ticked.part.img_url,
            label: t("set.missingAll.foundOneLabel", {
              part: partLabel(ticked.part),
              set: ticked.label,
            }),
            summary: (
              <span className="line-clamp-2 text-sm font-medium wrap-break-word">
                {ticked.label}
              </span>
            ),
          }
        }
        onUndo={() => {
          if (ticked) {
            untick(ticked.setId, ticked.part);
          }
          setTicked(null);
        }}
      />
      <EnlargedPart
        part={missing?.find((m) => m.part.key === enlarged)?.part ?? null}
        onClose={() => setEnlarged(null)}
      />
    </>
  );
}

function MissingAcrossItem({
  entry,
  isBusy,
  onTickOff,
  onEnlarge,
}: {
  entry: MissingAcross;
  isBusy: (setId: string, part: Part) => boolean;
  onTickOff: (setId: string, part: Part) => void | Promise<void>;
  onEnlarge: (key: string) => void;
}) {
  const { t } = useLanguage();
  const { part } = entry;
  return (
    <li className="rounded-2xl bg-white p-2 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
      <div className="flex items-center gap-3">
        <EnlargeableThumbnail
          src={part.img_url}
          label={partLabel(part)}
          onEnlarge={() => onEnlarge(part.key)}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{part.part_name}</p>
          <p className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            <ColorSwatch
              rgb={part.color_rgb}
              trans={part.is_trans}
              className="size-3"
            />
            <span className="truncate">
              {part.color_name} · {part.part_num}
            </span>
          </p>
        </div>
        <span className="text-lg font-bold tabular-nums">
          × {entry.missing}
        </span>
      </div>
      <ul className="mt-2 flex flex-col divide-y divide-neutral-100 border-t border-neutral-100 dark:divide-neutral-800 dark:border-neutral-800">
        {entry.sets.map((c) => (
          <li key={c.setId} className="flex items-center gap-3 py-1 pl-1">
            {/* The set name gets the room (two lines); the count sits by the button. */}
            <Link
              to={`/sets/${c.setId}`}
              className="flex min-h-11 min-w-0 flex-1 items-center py-1"
            >
              <span className="line-clamp-2 text-sm font-medium wrap-break-word">
                {c.label}
              </span>
            </Link>
            <span className="shrink-0 text-sm text-neutral-500 tabular-nums dark:text-neutral-400">
              {t("set.missingAll.needs", { count: c.missing })}
            </span>
            {c.canTickOff && (
              <button
                type="button"
                onClick={() => onTickOff(c.setId, part)}
                disabled={isBusy(c.setId, part)}
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-brick ring-1 ring-brick disabled:opacity-50"
                aria-label={t("set.missingAll.foundOneLabel", {
                  part: partLabel(part),
                  set: c.label,
                })}
                title={t("set.missingAll.foundOne")}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  className="size-5"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            )}
          </li>
        ))}
      </ul>
    </li>
  );
}
