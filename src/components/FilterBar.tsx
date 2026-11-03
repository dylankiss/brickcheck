import type { SortMode, TileFilter } from "../lib/tiles";
import { ColorSwatch } from "./ui";

interface Props {
  filter: TileFilter;
  sort: SortMode;
  colors: { id: number; name: string; rgb: string | null }[];
  onFilterChange: (filter: TileFilter) => void;
  onSortChange: (sort: SortMode) => void;
}

export function FilterBar({
  filter,
  sort,
  colors,
  onFilterChange,
  onSortChange,
}: Props) {
  return (
    <div className="flex flex-col gap-2 pb-3">
      <div className="flex gap-2">
        <input
          type="search"
          value={filter.query}
          onChange={(e) => onFilterChange({ ...filter, query: e.target.value })}
          placeholder="Search part, number or color"
          className="min-h-11 min-w-0 flex-1 rounded-xl bg-white px-3 ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700"
        />
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortMode)}
          className="min-h-11 rounded-xl bg-white px-2 ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700"
          aria-label="Sort by"
        >
          <option value="color">Color</option>
          <option value="part">Part</option>
          <option value="remaining">Most missing</option>
        </select>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 text-sm">
        <button
          type="button"
          onClick={() =>
            onFilterChange({ ...filter, hideComplete: !filter.hideComplete })
          }
          className={`min-h-9 shrink-0 rounded-full px-3 ring-1 ${
            filter.hideComplete
              ? "bg-neutral-900 text-white ring-neutral-900 dark:bg-white dark:text-neutral-900"
              : "ring-neutral-300 dark:ring-neutral-700"
          }`}
          aria-pressed={filter.hideComplete}
        >
          Hide found
        </button>
        {colors.map((color) => {
          const active = filter.colorId === color.id;
          return (
            <button
              key={color.id}
              type="button"
              onClick={() =>
                onFilterChange({ ...filter, colorId: active ? null : color.id })
              }
              className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 ring-1 ${
                active
                  ? "bg-neutral-900 text-white ring-neutral-900 dark:bg-white dark:text-neutral-900"
                  : "ring-neutral-300 dark:ring-neutral-700"
              }`}
              aria-pressed={active}
            >
              <ColorSwatch rgb={color.rgb} className="size-3.5" />
              {color.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
