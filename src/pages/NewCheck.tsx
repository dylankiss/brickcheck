import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { SetSearch } from "../components/SetSearch";
import {
  Button,
  ErrorBanner,
  Header,
  PartImage,
  Spinner,
} from "../components/ui";
import { useSetSearch } from "../hooks/useSetSearch";
import { createCheck, fetchSet } from "../lib/api";
import type { LegoSet } from "../lib/types";

export default function NewCheck() {
  const navigate = useNavigate();
  const search = useSetSearch();
  const [set, setSet] = useState<LegoSet | null>(null);
  const [title, setTitle] = useState("");
  const [includeSpares, setIncludeSpares] = useState(false);
  const [includeMinifigs, setIncludeMinifigs] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function choose(chosen: LegoSet) {
    setSet(chosen);
    setTitle(chosen.name);
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!set) return;
    setBusy(true);
    setError(null);
    try {
      // The first check of a set imports its inventory from Rebrickable (a few seconds).
      await fetchSet(set.set_num);
      const id = await createCheck({
        set_num: set.set_num,
        title: title.trim() || set.name,
        include_spares: includeSpares,
        include_minifigs: includeMinifigs,
      });
      navigate(`/checks/${id}`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <Header title="New check" back="/" />
      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}
      <main className="mx-auto max-w-2xl p-4">
        {!set ? (
          <SetSearch
            query={search.query}
            onQueryChange={search.setQuery}
            results={search.results}
            error={search.error}
            noResults={search.noResults}
            onSelect={choose}
          />
        ) : busy ? (
          <Spinner
            label={
              set.parts_fetched_at
                ? "Creating check…"
                : "Loading the parts list from Rebrickable…"
            }
          />
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
              <PartImage
                src={set.img_url}
                alt=""
                className="size-20 shrink-0 rounded-lg bg-white"
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{set.name}</p>
                <p className="text-sm text-neutral-500">
                  {set.set_num} · {set.year} · {set.num_parts} pieces
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSet(null)}
                className="min-h-11 px-2 text-sm text-brick"
              >
                Change
              </button>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Name</span>
              <input
                value={title}
                maxLength={200}
                onChange={(e) => setTitle(e.target.value)}
                className="min-h-12 rounded-xl bg-white px-4 ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700"
              />
              <span className="text-xs text-neutral-500">
                Handy if you own several copies, e.g. "Castle – blue box".
              </span>
            </label>

            <label className="flex min-h-11 items-center justify-between gap-3">
              <span>
                Include minifigure parts
                <span className="block text-xs text-neutral-500">
                  Heads, torsos, legs and accessories
                </span>
              </span>
              <input
                type="checkbox"
                checked={includeMinifigs}
                onChange={(e) => setIncludeMinifigs(e.target.checked)}
                className="size-6 accent-brick"
              />
            </label>
            <label className="flex min-h-11 items-center justify-between gap-3">
              <span>
                Include spare parts
                <span className="block text-xs text-neutral-500">
                  Pieces LEGO adds on top of what the set needs
                </span>
              </span>
              <input
                type="checkbox"
                checked={includeSpares}
                onChange={(e) => setIncludeSpares(e.target.checked)}
                className="size-6 accent-brick"
              />
            </label>
            <p className="text-xs text-neutral-500">
              These two options can't be changed later.
            </p>

            <Button type="submit">Start checking</Button>
          </form>
        )}
      </main>
    </>
  );
}
