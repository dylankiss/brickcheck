import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { FilterBar } from "../components/FilterBar";
import { PartTile } from "../components/PartTile";
import { ErrorBanner, Header, ProgressBar } from "../components/ui";
import { useCheckContext } from "../hooks/useCheckContext";
import {
  filterTiles,
  sortTiles,
  tileColors,
  totals,
  type SortMode,
  type Tile,
  type TileFilter,
} from "../lib/tiles";

// Tiles keep their place while you tap; the grid re-sorts and re-filters this
// long after the last change, so a tile never moves under your thumb.
const SETTLE_MS = 1500;

export default function Check() {
  const { checkId, summary, tiles, error, clearError, canEdit, tap } =
    useCheckContext();
  const [filter, setFilter] = useState<TileFilter>({
    query: "",
    colorId: null,
    hideComplete: false,
  });
  const [sort, setSort] = useState<SortMode>("color");

  // The tiles the current layout was computed from: refreshed after a quiet
  // period, and right away when the filter or sort changes.
  const [basis, setBasis] = useState<Tile[]>(tiles);
  useEffect(() => {
    const timer = setTimeout(() => setBasis(tiles), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [tiles]);
  const layoutBasis = basis.length === tiles.length ? basis : tiles;
  const changeFilter = (next: TileFilter) => {
    setFilter(next);
    setBasis(tiles);
  };
  const changeSort = (next: SortMode) => {
    setSort(next);
    setBasis(tiles);
  };
  const order = useMemo(
    () => sortTiles(filterTiles(layoutBasis, filter), sort).map((t) => t.key),
    [layoutBasis, filter, sort],
  );
  const byKey = useMemo(() => new Map(tiles.map((t) => [t.key, t])), [tiles]);
  const colors = useMemo(() => tileColors(tiles), [tiles]);
  const { found, needed } = totals(tiles);

  return (
    <>
      <Header title={summary!.title} back="/">
        <div className="flex items-center gap-3 pb-2">
          <ProgressBar found={found} needed={needed} className="flex-1" />
          <span className="text-sm font-semibold tabular-nums">
            {found}/{needed}
          </span>
          <Link
            to={`/checks/${checkId}/missing`}
            className="min-h-9 rounded-full px-3 py-1.5 text-sm font-semibold text-brick ring-1 ring-brick"
          >
            Missing {needed - found}
          </Link>
        </div>
        <FilterBar
          filter={filter}
          sort={sort}
          colors={colors}
          onFilterChange={changeFilter}
          onSortChange={changeSort}
        />
      </Header>
      {error && <ErrorBanner message={error} onClose={clearError} />}
      {!canEdit && (
        <p className="px-4 pt-3 text-sm text-neutral-500">
          You can view this check but not change it.
        </p>
      )}
      <main className="grid grid-cols-2 gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {order.map((key) => (
          <PartTile
            key={key}
            tile={byKey.get(key)!}
            canEdit={canEdit}
            onTap={tap}
          />
        ))}
        {order.length === 0 && (
          <p className="col-span-full py-12 text-center text-neutral-500">
            {found === needed
              ? "All pieces found! 🎉"
              : "No parts match the filter."}
          </p>
        )}
      </main>
    </>
  );
}
