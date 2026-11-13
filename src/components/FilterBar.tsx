import { useLanguage } from "../hooks/useLanguage";
import type { PartColor, SortMode, PartFilter } from "../lib/parts";
import { ColorFilter } from "./ColorFilter";
import { filterButtonClass } from "./filterButton";
import { EyeOffIcon, SortIcon } from "./ui";

interface Props {
  filter: PartFilter;
  sort: SortMode;
  colors: PartColor[];
  onFilterChange: (filter: PartFilter) => void;
  onSortChange: (sort: SortMode) => void;
}

/** Search, then three icon-only controls: sort, color and hide found. */
export function FilterBar({
  filter,
  sort,
  colors,
  onFilterChange,
  onSortChange,
}: Props) {
  const { t } = useLanguage();
  return (
    <div className="flex gap-2 pb-3">
      <input
        name="part-search"
        type="search"
        value={filter.query}
        onChange={(e) => onFilterChange({ ...filter, query: e.target.value })}
        placeholder={t("set.filter.search")}
        aria-label={t("set.filter.searchLabel")}
        className="min-h-11 min-w-0 flex-1 rounded-xl bg-white px-3 ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700"
      />
      {/* A native select over the icon: the system picker opens, the icon is all you see. */}
      <span className={filterButtonClass()}>
        <SortIcon />
        <select
          name="part-sort"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortMode)}
          aria-label={t("set.filter.sortLabel")}
          className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
        >
          <option value="color">{t("set.filter.sortColor")}</option>
          <option value="part">{t("set.filter.sortPart")}</option>
          <option value="missing">{t("set.filter.sortMissing")}</option>
        </select>
      </span>
      <ColorFilter
        colors={colors}
        colorId={filter.colorId}
        onColorChange={(colorId) => onFilterChange({ ...filter, colorId })}
      />
      <button
        type="button"
        onClick={() =>
          onFilterChange({ ...filter, hideFound: !filter.hideFound })
        }
        className={filterButtonClass(filter.hideFound ? "on" : "off")}
        aria-pressed={filter.hideFound}
        aria-label={t("set.filter.hideFound")}
      >
        <EyeOffIcon />
      </button>
    </div>
  );
}
