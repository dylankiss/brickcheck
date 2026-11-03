import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { OnlineAvatars } from "../components/Avatar";
import { FilterBar } from "../components/FilterBar";
import { PartCard } from "../components/PartCard";
import { ErrorBanner, Header, ProgressBar } from "../components/ui";
import { useCheckContext } from "../hooks/useCheckContext";
import {
  filterParts,
  sortParts,
  partColors,
  totals,
  type SortMode,
  type Part,
  type PartFilter,
} from "../lib/parts";

// Cards keep their place while you tap; the grid re-sorts and re-filters this
// long after the last change, so a card never moves under your thumb. Steady
// activity (a busy collaborator) defers it at most MAX_DEFER_MS.
const SETTLE_MS = 1500;
const MAX_DEFER_MS = 5000;

export default function Check() {
  const { checkId, summary, parts, error, clearError, canEdit, tap, others } =
    useCheckContext();
  const [filter, setFilter] = useState<PartFilter>({
    query: "",
    colorId: null,
    hideFound: false,
  });
  const [sort, setSort] = useState<SortMode>("color");

  // The parts the current layout was computed from: refreshed after a quiet
  // period, and right away when the filter or sort changes.
  const [basis, setBasis] = useState<Part[]>(parts);
  const deferredSince = useRef<number | null>(null);
  useEffect(() => {
    const now = Date.now();
    deferredSince.current ??= now;
    const delay = Math.max(
      0,
      Math.min(SETTLE_MS, deferredSince.current + MAX_DEFER_MS - now),
    );
    const timer = setTimeout(() => {
      deferredSince.current = null;
      setBasis(parts);
    }, delay);
    return () => clearTimeout(timer);
  }, [parts]);
  const layoutBasis = basis.length === parts.length ? basis : parts;
  const changeFilter = (next: PartFilter) => {
    setFilter(next);
    setBasis(parts);
  };
  const changeSort = (next: SortMode) => {
    setSort(next);
    setBasis(parts);
  };
  const order = useMemo(
    () => sortParts(filterParts(layoutBasis, filter), sort).map((p) => p.key),
    [layoutBasis, filter, sort],
  );
  const byKey = useMemo(() => new Map(parts.map((p) => [p.key, p])), [parts]);
  const colors = useMemo(() => partColors(parts), [parts]);
  const { found, needed } = totals(parts);

  return (
    <>
      <Header title={summary!.title} back="/">
        <div className="flex items-center gap-3 pb-2">
          <Link
            to={`/checks/${checkId}/people`}
            aria-label="People"
            className="flex min-h-9 items-center"
          >
            {others.length ? (
              <OnlineAvatars people={others} />
            ) : (
              <span className="text-xl" aria-hidden>
                👥
              </span>
            )}
          </Link>
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
          <PartCard
            key={key}
            part={byKey.get(key)!}
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
