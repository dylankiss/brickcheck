import type { CatalogSet } from "../lib/types";
import { PartImage } from "./ui";

interface Props {
  query: string;
  onQueryChange: (query: string) => void;
  results: CatalogSet[];
  error: string | null;
  noResults: boolean;
  onSelect: (catalogSet: CatalogSet) => void;
}

export function CatalogSearch({
  query,
  onQueryChange,
  results,
  error,
  noResults,
  onSelect,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        autoFocus
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Set number or name, e.g. 10305 or castle"
        className="min-h-12 rounded-xl bg-white px-4 text-lg ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {noResults && <p className="text-sm text-neutral-500">No sets found.</p>}
      <ul className="flex flex-col gap-2">
        {results.map((catalogSet) => (
          <li key={catalogSet.set_num}>
            <button
              type="button"
              onClick={() => onSelect(catalogSet)}
              className="flex w-full items-center gap-3 rounded-2xl bg-white p-2 text-left ring-1 ring-neutral-200 active:bg-neutral-100 dark:bg-neutral-900 dark:ring-neutral-800"
            >
              <PartImage
                src={catalogSet.img_url}
                alt=""
                className="size-16 shrink-0 rounded-lg bg-white"
              />
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {catalogSet.name}
                </span>
                <span className="text-sm text-neutral-500">
                  {catalogSet.set_num} · {catalogSet.year} ·{" "}
                  {catalogSet.num_parts} pieces
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
