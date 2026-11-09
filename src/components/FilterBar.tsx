import { useLanguage } from "../hooks/useLanguage";
import type { PartColor, SortMode, PartFilter } from "../lib/parts";
import { Chip, ColorChips } from "./ColorChips";
import { Select } from "./ui";

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
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-2 pb-3">
      <div className="flex gap-2">
        <input
          name="part-search"
          type="search"
          value={filter.query}
          onChange={(e) => onFilterChange({ ...filter, query: e.target.value })}
          placeholder={t("set.filter.search")}
          aria-label={t("set.filter.searchLabel")}
          className="min-h-11 min-w-0 flex-1 rounded-xl bg-white px-3 ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700"
        />
        <Select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortMode)}
          aria-label={t("set.filter.sortLabel")}
        >
          <option value="color">{t("set.filter.sortColor")}</option>
          <option value="part">{t("set.filter.sortPart")}</option>
          <option value="missing">{t("set.filter.sortMissing")}</option>
        </Select>
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
          {t("set.filter.hideFound")}
        </Chip>
      </ColorChips>
    </div>
  );
}
