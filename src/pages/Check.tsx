import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { FilterBar } from "../components/FilterBar";
import { PartTile } from "../components/PartTile";
import { ErrorBanner, Header, ProgressBar, Spinner } from "../components/ui";
import { useCheck } from "../hooks/useCheck";
import {
  filterTiles,
  sortTiles,
  tileColors,
  totals,
  type SortMode,
  type TileFilter,
} from "../lib/tiles";

export default function CheckRoute() {
  const { checkId = "" } = useParams();
  return <Check key={checkId} checkId={checkId} />;
}

function Check({ checkId }: { checkId: string }) {
  const { summary, tiles, status, error, clearError, canEdit, tap } =
    useCheck(checkId);
  const [filter, setFilter] = useState<TileFilter>({
    query: "",
    colorId: null,
    hideComplete: false,
  });
  const [sort, setSort] = useState<SortMode>("color");

  const visible = useMemo(
    () => sortTiles(filterTiles(tiles, filter), sort),
    [tiles, filter, sort],
  );
  const colors = useMemo(() => tileColors(tiles), [tiles]);
  const { found, needed } = totals(tiles);

  if (status === "loading") return <Spinner label="Loading parts…" />;
  if (status === "not-found") {
    return (
      <>
        <Header title="Check not found" back="/" />
        <p className="p-8 text-center text-neutral-500">
          This check doesn't exist or isn't shared with you.
        </p>
      </>
    );
  }
  if (status === "error" || !summary) {
    return (
      <>
        <Header title="BrickCheck" back="/" />
        <ErrorBanner message={error ?? "Could not load this check"} />
      </>
    );
  }

  return (
    <>
      <Header title={summary.title} back="/">
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
          onFilterChange={setFilter}
          onSortChange={setSort}
        />
      </Header>
      {error && <ErrorBanner message={error} onClose={clearError} />}
      {!canEdit && (
        <p className="px-4 pt-3 text-sm text-neutral-500">
          You can view this check but not change it.
        </p>
      )}
      <main className="grid grid-cols-2 gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {visible.map((tile) => (
          <PartTile key={tile.key} tile={tile} canEdit={canEdit} onTap={tap} />
        ))}
        {visible.length === 0 && (
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
