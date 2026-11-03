import { useMemo, useState } from "react";
import { Link } from "react-router";
import { EnlargeableThumbnail, EnlargedPart } from "../components/EnlargedPart";
import { ColorChips } from "../components/ColorChips";
import { ColorSwatch, ErrorBanner, Header, Spinner } from "../components/ui";
import { useMissingAcrossSets } from "../hooks/useMissingAcrossSets";
import {
  partColors,
  partLabel,
  searchMissingAcross,
  type MissingAcross,
  type Part,
} from "../lib/parts";

/** Every Part still missing in your Sets: find a piece, see where it goes, tick it off there. */
export default function MissingAcrossSets() {
  const { missing, error, clearError, isBusy, tickOff } =
    useMissingAcrossSets();
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
  // Ticking off the last part of the chosen color removes its chip: stop filtering on it.
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
      <Header title="Missing in all sets" back="/">
        <div className="flex flex-col gap-2 pb-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search parts"
            aria-label="Search parts by name, number or color"
            className="min-h-11 w-full rounded-xl bg-white px-3 ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700"
          />
          {colors.length > 0 && (
            <ColorChips
              colors={colors}
              colorId={activeColor}
              onColorChange={setColorId}
            />
          )}
        </div>
      </Header>
      {error && <ErrorBanner message={error} onClose={clearError} />}
      <main className="mx-auto flex max-w-2xl flex-col gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {!missing && !error && <Spinner />}
        {missing?.length === 0 && (
          <p className="py-12 text-center text-neutral-500">
            Nothing is missing in any of your sets. 🎉
          </p>
        )}
        {all && all.parts.length > 0 && (
          <p className="text-sm text-neutral-500">
            {all.pieces} {all.pieces === 1 ? "piece" : "pieces"} in{" "}
            {all.parts.length} {all.parts.length === 1 ? "part" : "parts"} still
            to find, across {all.sets} {all.sets === 1 ? "set" : "sets"}.
          </p>
        )}
        {missing && missing.length > 0 && shown.length === 0 && (
          <p className="py-8 text-center text-neutral-500">
            No missing parts match.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {shown.map((entry) => (
            <MissingAcrossItem
              key={entry.part.key}
              entry={entry}
              isBusy={isBusy}
              onTickOff={tickOff}
              onEnlarge={setEnlarged}
            />
          ))}
        </ul>
      </main>
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
  onTickOff: (setId: string, part: Part) => void;
  onEnlarge: (key: string) => void;
}) {
  const { part } = entry;
  return (
    <li className="rounded-2xl bg-white p-2 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
      <div className="flex items-center gap-3">
        <EnlargeableThumbnail part={part} onEnlarge={onEnlarge} />
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
        <span className="text-lg font-bold tabular-nums">×{entry.missing}</span>
      </div>
      <ul className="mt-2 flex flex-col divide-y divide-neutral-100 border-t border-neutral-100 dark:divide-neutral-800 dark:border-neutral-800">
        {entry.sets.map((c) => (
          <li key={c.setId} className="flex items-center gap-2 pt-1 pl-1">
            <Link
              to={`/sets/${c.setId}`}
              className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-sm"
            >
              <span className="truncate">{c.label}</span>
              <span className="shrink-0 text-neutral-500 tabular-nums dark:text-neutral-400">
                needs {c.missing}
              </span>
            </Link>
            {c.canTickOff && (
              <button
                type="button"
                onClick={() => onTickOff(c.setId, part)}
                disabled={isBusy(c.setId, part)}
                className="min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold text-brick ring-1 ring-brick disabled:opacity-50"
                aria-label={`Found one ${partLabel(part)} for ${c.label}`}
              >
                Found one
              </button>
            )}
          </li>
        ))}
      </ul>
    </li>
  );
}
