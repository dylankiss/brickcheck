import type { CatalogSet } from "../lib/types";
import { EnlargeableThumbnail } from "./EnlargedPicture";

interface Props {
  query: string;
  onQueryChange: (query: string) => void;
  results: CatalogSet[];
  error: string | null;
  noResults: boolean;
  onSelect: (catalogSet: CatalogSet) => void;
  onEnlarge: (catalogSet: CatalogSet) => void;
}

export function CatalogSearch({
  query,
  onQueryChange,
  results,
  error,
  noResults,
  onSelect,
  onEnlarge,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <input
        name="catalog-search"
        type="search"
        aria-label="Search sets by number or name"
        // This page exists to search, so the field takes focus on arrival.
        // oxlint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Set number or name, e.g. 10305 or castle"
        className="min-h-12 rounded-xl bg-white px-4 text-lg ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {noResults && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No sets found.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {results.map((catalogSet) => (
          // The whole row selects the set; the picture on top of it (a sibling, not nested) enlarges.
          <li key={catalogSet.set_num} className="relative">
            {/* The button's name is the set text nested inside it, deeper than the rule looks. */}
            {/* oxlint-disable-next-line jsx-a11y/control-has-associated-label */}
            <button
              type="button"
              onClick={() => onSelect(catalogSet)}
              className="flex min-h-20 w-full items-center rounded-2xl bg-white p-2 pl-[5.25rem] text-left ring-1 ring-neutral-200 active:bg-neutral-100 dark:bg-neutral-900 dark:ring-neutral-800 dark:active:bg-neutral-800"
            >
              <span className="block min-w-0">
                <span className="block truncate font-semibold">
                  {catalogSet.name}
                </span>
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  {catalogSet.set_num} · {catalogSet.year} ·{" "}
                  {catalogSet.num_parts} pieces
                </span>
              </span>
            </button>
            <div className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2">
              <EnlargeableThumbnail
                src={catalogSet.img_url}
                label={catalogSet.name}
                onEnlarge={() => onEnlarge(catalogSet)}
                className="size-16 rounded-lg bg-white"
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
