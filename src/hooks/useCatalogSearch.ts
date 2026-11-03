import { useEffect, useState } from "react";
import { searchCatalog } from "../lib/api";
import type { CatalogSet } from "../lib/types";
import { useDebounced } from "./useDebounced";

interface SearchResult {
  query: string;
  catalogSets: CatalogSet[];
  error: string | null;
}

/** Debounced catalog search. */
export function useCatalogSearch() {
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 300);
  const [result, setResult] = useState<SearchResult>({
    query: "",
    catalogSets: [],
    error: null,
  });

  useEffect(() => {
    let current = true;
    searchCatalog(debounced).then(
      (catalogSets) =>
        current && setResult({ query: debounced, catalogSets, error: null }),
      (e: Error) =>
        current &&
        setResult({ query: debounced, catalogSets: [], error: e.message }),
    );
    return () => {
      current = false;
    };
  }, [debounced]);

  const settled = result.query === debounced && debounced === query;
  const noResults =
    settled &&
    !result.error &&
    debounced.trim().length >= 2 &&
    result.catalogSets.length === 0;
  return {
    query,
    setQuery,
    results: result.catalogSets,
    error: result.error,
    noResults,
  };
}
