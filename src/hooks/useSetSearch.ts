import { useEffect, useState } from "react";
import { searchSets } from "../lib/api";
import type { LegoSet } from "../lib/types";
import { useDebounced } from "./useDebounced";

interface SearchResult {
  query: string;
  sets: LegoSet[];
  error: string | null;
}

/** Debounced catalog search. */
export function useSetSearch() {
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 300);
  const [result, setResult] = useState<SearchResult>({
    query: "",
    sets: [],
    error: null,
  });

  useEffect(() => {
    let current = true;
    searchSets(debounced).then(
      (sets) => current && setResult({ query: debounced, sets, error: null }),
      (e: Error) =>
        current && setResult({ query: debounced, sets: [], error: e.message }),
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
    result.sets.length === 0;
  return {
    query,
    setQuery,
    results: result.sets,
    error: result.error,
    noResults,
  };
}
