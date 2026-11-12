import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import { OnlineAvatars } from "../components/Avatar";
import { FilterBar } from "../components/FilterBar";
import { PartCard } from "../components/PartCard";
import { TICK_TOAST_CLEARANCE, TickToast } from "../components/TickToast";
import { LongPressHint } from "../components/LongPressHint";
import { PartSheet } from "../components/PartSheet";
import { EnlargedPart } from "../components/EnlargedPicture";
import {
  ErrorBanner,
  Header,
  ProgressBar,
  SettingsIcon,
} from "../components/ui";
import { useLanguage } from "../hooks/useLanguage";
import { useRecentTick } from "../hooks/useRecentTick";
import { useSetContext } from "../hooks/useSetContext";
import {
  filterParts,
  sortParts,
  partColors,
  totals,
  type SortMode,
  type Part,
  partNumber,
  type PartFilter,
} from "../lib/parts";

/** How many ticks the Undo bar can walk back. */
const UNDO_STEPS = 10;

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
  // The Part whose sheet is open, and the one whose picture is full screen
  // (opened from the sheet), by key, so their counts stay live.
  const [sheet, setSheet] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState<string | null>(null);

  // The last few ticks, newest last, for the Undo bar: Undo takes back the
  // newest and then offers the one before it, so a run of wrong ticks can be
  // walked back. The chain goes away after a few seconds without a tick or Undo.
  const [ticks, setTicks, hold] =
    useRecentTick<{ key: string; id: number; by: number }[]>();
  const tapPart = useCallback(
    (part: Part, delta: number) => {
      tap(part, delta);
      if (delta > 0 && part.found < part.needed) {
        const by = Math.min(delta, part.needed - part.found);
        setTicks((chain) =>
          [
            ...(chain ?? []),
            { key: part.key, id: (chain?.at(-1)?.id ?? 0) + 1, by },
          ].slice(-UNDO_STEPS),
        );
      } else if (delta < 0) {
        // Un-ticking a Part by hand takes its newest tick off the chain.
        setTicks((chain) => {
          const at = chain?.findLastIndex((t) => t.key === part.key) ?? -1;
          const rest = chain?.filter((_, i) => i !== at) ?? [];
          return rest.length ? rest : null;
        });
      }
    },
    [tap, setTicks],
  );

  // The parts the current layout was computed from. Cards never move on their
  // own, so a tap lands where you aimed: the layout is refreshed only when the
  // filter or sort changes, when the parts themselves change (first load), or
  // when you press "Refresh list".
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
  const newest = ticks?.at(-1);
  const tickedPart = newest ? byKey.get(newest.key) : undefined;
  const colors = useMemo(() => partColors(parts), [parts]);
  const { found, needed } = totals(parts);

  // The Undo bar sits at the bottom of the page, or just above the part panel
  // while that is open (the page behind a modal is out of reach).
  const undoBar = (inline: boolean) => (
    <TickToast
      inline={inline}
      hold={hold}
      tick={
        tickedPart
          ? {
              picture: tickedPart.img_url,
              label: t("set.tick.added", {
                number: partNumber(tickedPart),
                color: tickedPart.color_name,
                found: tickedPart.found,
                needed: tickedPart.needed,
              }),
              summary: (
                <span className="text-xl font-bold tabular-nums">
                  {number(tickedPart.found)}
                  <span className="text-sm font-normal opacity-70">
                    /{number(tickedPart.needed)}
                  </span>
                </span>
              ),
            }
          : null
      }
      onUndo={() => {
        if (tickedPart && tickedPart.found > 0) {
          tap(tickedPart, -newest!.by);
        }
        const rest = ticks?.slice(0, -1) ?? [];
        setTicks(rest.length ? rest : null);
      }}
    />
  );

  return (
    <>
      <Header title={summary!.title} back="/sets" hideOnScroll>
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
      <main
        className={`grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2 p-3 sm:gap-3 sm:p-4 ${TICK_TOAST_CLEARANCE}`}
      >
        {order.length > 0 && canEdit && <LongPressHint />}
        {order.map((key) => (
          <PartCard
            key={key}
            part={byKey.get(key)!}
            canEdit={canEdit}
            onTap={tapPart}
            onEnlarge={setSheet}
          />
        ))}
        {order.length === 0 && (
          <p className="col-span-full py-12 text-center text-neutral-500 dark:text-neutral-400">
            {found === needed ? t("set.allFound") : t("set.noMatch")}
          </p>
        )}
      </main>
      {!sheet && undoBar(false)}
      {stale && (
        <button
          type="button"
          onClick={() => setBasis(parts)}
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-20 min-h-11 -translate-x-1/2 rounded-full bg-neutral-900 px-5 text-sm font-semibold text-white shadow-lg dark:bg-white dark:text-neutral-900"
        >
          {t("set.refreshList")}
        </button>
      )}
      <PartSheet
        part={sheet ? (byKey.get(sheet) ?? null) : null}
        canEdit={canEdit}
        onTap={tapPart}
        onEnlarge={setEnlarged}
        onClose={() => setSheet(null)}
        toast={undoBar(true)}
      />
      <EnlargedPart
        part={enlarged ? (byKey.get(enlarged) ?? null) : null}
        onClose={() => setEnlarged(null)}
      />
    </>
  );
}
