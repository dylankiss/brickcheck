import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { CatalogSearch } from "../components/CatalogSearch";
import {
  EnlargeableThumbnail,
  EnlargedPicture,
} from "../components/EnlargedPicture";
import { catalogSetPicture, type Picture } from "../components/pictures";
import { Button, ErrorBanner, Header, Select, Spinner } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useCatalogSearch } from "../hooks/useCatalogSearch";
import { useGroups } from "../hooks/useGroups";
import { useLanguage } from "../hooks/useLanguage";
import { createSet, fetchCatalogSet } from "../lib/api";
import type { CatalogSet } from "../lib/types";

export default function AddSet() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const search = useCatalogSearch();
  const { session } = useAuth();
  const { groups } = useGroups(session!.user.id);
  // Only Groups where I am an Owner or Helper can take a new Set.
  const targets = (groups ?? []).filter((g) => g.my_role !== "viewer");
  const [chosenGroupId, setGroupId] = useState("");
  // A chosen Group I can no longer add to (demoted, or left) is dropped.
  const groupId = targets.some((g) => g.id === chosenGroupId)
    ? chosenGroupId
    : "";
  const [catalogSet, setCatalogSet] = useState<CatalogSet | null>(null);
  const [title, setTitle] = useState("");
  const [includeSpares, setIncludeSpares] = useState(false);
  const [includeMinifigs, setIncludeMinifigs] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState<Picture | null>(null);

  function choose(chosen: CatalogSet) {
    setCatalogSet(chosen);
    setTitle(chosen.name);
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!catalogSet) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Adding the first Set of a Catalog set imports its inventory from Rebrickable (a few seconds).
      await fetchCatalogSet(catalogSet.set_num);
      const id = await createSet({
        set_num: catalogSet.set_num,
        title: title.trim() || catalogSet.name,
        include_spares: includeSpares,
        include_minifigs: includeMinifigs,
        group_id: groupId || undefined,
      });
      navigate(`/sets/${id}`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <Header title={t("sets.add.title")} back="/sets" />
      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}
      <main className="mx-auto max-w-2xl p-4">
        {!catalogSet ? (
          <CatalogSearch
            query={search.query}
            onQueryChange={search.setQuery}
            results={search.results}
            error={search.error}
            noResults={search.noResults}
            onSelect={choose}
            onEnlarge={(c) => setEnlarged(catalogSetPicture(c))}
          />
        ) : busy ? (
          <Spinner
            label={
              catalogSet.parts_fetched_at
                ? t("sets.add.adding")
                : t("sets.add.loadingParts")
            }
          />
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800">
              <EnlargeableThumbnail
                src={catalogSet.img_url}
                label={catalogSet.name}
                onEnlarge={() => setEnlarged(catalogSetPicture(catalogSet))}
                className="size-20 rounded-lg bg-white"
                resizeTo={80}
              />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{catalogSet.name}</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {catalogSet.set_num} · {catalogSet.year} ·{" "}
                  {t("sets.pieces", { count: catalogSet.num_parts })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCatalogSet(null)}
                className="min-h-11 px-2 text-sm text-brick"
              >
                {t("sets.add.change")}
              </button>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{t("sets.add.name")}</span>
              <input
                name="title"
                value={title}
                maxLength={200}
                onChange={(e) => setTitle(e.target.value)}
                className="min-h-12 rounded-xl bg-white px-4 ring-1 ring-neutral-300 dark:bg-neutral-900 dark:ring-neutral-700"
              />
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {t("sets.add.nameHint")}
              </span>
            </label>

            {targets.length > 0 && (
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  {t("sets.add.group")}
                </span>
                <Select
                  name="group"
                  tall
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="w-full"
                >
                  <option value="">{t("sets.add.noGroup")}</option>
                  {targets.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </Select>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t("sets.add.groupHint")}
                </span>
              </label>
            )}

            <label className="flex min-h-11 items-center justify-between gap-3">
              <span>
                {t("sets.add.minifigs")}
                <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                  {t("sets.add.minifigsHint")}
                </span>
              </span>
              <input
                name="include-minifigs"
                type="checkbox"
                checked={includeMinifigs}
                onChange={(e) => setIncludeMinifigs(e.target.checked)}
                className="size-6 accent-brick"
              />
            </label>
            <label className="flex min-h-11 items-center justify-between gap-3">
              <span>
                {t("sets.add.spares")}
                <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                  {t("sets.add.sparesHint")}
                </span>
              </span>
              <input
                name="include-spares"
                type="checkbox"
                checked={includeSpares}
                onChange={(e) => setIncludeSpares(e.target.checked)}
                className="size-6 accent-brick"
              />
            </label>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t("sets.add.fixedOptions")}
            </p>

            <Button type="submit">{t("sets.add.start")}</Button>
          </form>
        )}
      </main>
      <EnlargedPicture picture={enlarged} onClose={() => setEnlarged(null)} />
    </>
  );
}
