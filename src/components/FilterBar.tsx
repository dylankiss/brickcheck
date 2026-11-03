import type { PartColor, SortMode, PartFilter } from "../lib/parts";
import { Chip, ColorChips } from "./ColorChips";

interface Props {
  filter: PartFilter;
  sort: SortMode;
  colors: PartColor[];
  onFilterChange: (filter: PartFilter) => void;
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
          placeholder="Search parts"
          aria-label="Search parts by name, number or color"
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
          <option value="missing">Most missing</option>
        </select>
      </div>
      <ColorChips
        colors={colors}
        colorId={filter.colorId}
        onColorChange={(colorId) => onFilterChange({ ...filter, colorId })}
      >
        <Chip
          active={filter.hideFound}
          onClick={() =>
            onFilterChange({ ...filter, hideFound: !filter.hideFound })
          }
        >
          Hide found
        </Chip>
      </ColorChips>
    </div>
  );
}
