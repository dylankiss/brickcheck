import { useMemo, useState } from "react";
import { Link } from "react-router";
import { OnlineAvatars } from "../components/Avatar";
import { FilterBar } from "../components/FilterBar";
import { PartCard } from "../components/PartCard";
import { EnlargedPart } from "../components/EnlargedPicture";
import {
  ErrorBanner,
  Header,
  ProgressBar,
  SettingsIcon,
} from "../components/ui";
import { useLanguage } from "../hooks/useLanguage";
import { useSetContext } from "../hooks/useSetContext";
import {
  filterParts,
  sortParts,
  partColors,
  totals,
  type SortMode,
  type Part,
  type PartFilter,
} from "../lib/parts";

export default function SetPage() {
  const { setId, summary, parts, error, clearError, canEdit, tap, others } =
    useSetContext();
  const { t, number } = useLanguage();
  const [filter, setFilter] = useState<PartFilter>({
    query: "",
    colorId: null,
    hideFound: false,
  });
  const [sort, setSort] = useState<SortMode>("color");
  // The Part whose picture is enlarged, by key, so its counts stay live.
  const [enlarged, setEnlarged] = useState<string | null>(null);

  // The parts the current layout was computed from. Cards never move on their
  // own, so a tap lands where you aimed: the layout is refreshed only when the
  // filter or sort changes, when the parts themselves change (first load), or
  // when you press "Update order".
  const [basis, setBasis] = useState<Part[]>(parts);
  if (basis.length !== parts.length) {
    setBasis(parts);
  }
  const changeFilter = (next: PartFilter) => {
    setFilter(next);
    setBasis(parts);
  };
  const changeSort = (next: SortMode) => {
    setSort(next);
    setBasis(parts);
  };
  const order = useMemo(
    () => sortParts(filterParts(basis, filter), sort).map((p) => p.key),
    [basis, filter, sort],
  );
  // Whether a fresh layout would differ: a part was completed, undone or
  // changed by someone else since the cards were laid out.
  const stale = useMemo(() => {
    const fresh = sortParts(filterParts(parts, filter), sort);
    return (
      fresh.length !== order.length || fresh.some((p, i) => p.key !== order[i])
    );
  }, [parts, filter, sort, order]);
  const byKey = useMemo(() => new Map(parts.map((p) => [p.key, p])), [parts]);
  const colors = useMemo(() => partColors(parts), [parts]);
  const { found, needed } = totals(parts);

  return (
    <>
      <Header title={summary!.title} back="/sets">
        <div className="flex items-center gap-3 pb-2">
          <Link
            to={`/sets/${setId}/manage`}
            aria-label={t("set.manage")}
            className="flex min-h-9 items-center"
          >
            {others.length ? (
              <OnlineAvatars people={others} />
            ) : (
              <SettingsIcon className="size-6 text-neutral-500 dark:text-neutral-400" />
            )}
          </Link>
          <ProgressBar found={found} needed={needed} className="flex-1" />
          <span className="text-sm font-semibold tabular-nums">
            {number(found)}/{number(needed)}
          </span>
          <Link
            to={`/sets/${setId}/missing`}
            className="inline-flex min-h-9 items-center rounded-full px-3 text-sm font-semibold text-brick ring-1 ring-brick"
          >
            {t("set.missingButton", { count: needed - found })}
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
        <p className="px-4 pt-3 text-sm text-neutral-500 dark:text-neutral-400">
          {t("set.viewOnly")}
        </p>
      )}
      <main className="grid grid-cols-3 gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:grid-cols-4 sm:gap-3 sm:p-4 md:grid-cols-5 lg:grid-cols-6">
        {order.map((key) => (
          <PartCard
            key={key}
            part={byKey.get(key)!}
            canEdit={canEdit}
            onTap={tap}
            onEnlarge={setEnlarged}
          />
        ))}
        {order.length === 0 && (
          <p className="col-span-full py-12 text-center text-neutral-500 dark:text-neutral-400">
            {found === needed ? t("set.allFound") : t("set.noMatch")}
          </p>
        )}
      </main>
      {stale && (
        <button
          type="button"
          onClick={() => setBasis(parts)}
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-20 min-h-11 -translate-x-1/2 rounded-full bg-neutral-900 px-5 text-sm font-semibold text-white shadow-lg dark:bg-white dark:text-neutral-900"
        >
          {t("set.updateOrder")}
        </button>
      )}
      <EnlargedPart
        part={enlarged ? (byKey.get(enlarged) ?? null) : null}
        onClose={() => setEnlarged(null)}
      />
    </>
  );
}
