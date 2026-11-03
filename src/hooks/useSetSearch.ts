import { useEffect, useState } from "react";
import { searchSets } from "../lib/api";
import type { LegoSet } from "../lib/types";
import { useDebounced } from "./useDebounced";

/** Debounced catalog search. */
export function useSetSearch() {
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 300);
  const [results, setResults] = useState<LegoSet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let current = true;
    setSearching(true);
    searchSets(debounced)
      .then((sets) => {
        if (!current) return;
        setResults(sets);
        setError(null);
      })
      .catch((e: Error) => current && setError(e.message))
      .finally(() => current && setSearching(false));
    return () => {
      current = false;
    };
  }, [debounced]);

  const noResults =
    !searching &&
    !error &&
    debounced.trim().length >= 2 &&
    results.length === 0;
  return { query, setQuery, results, error, noResults };
}
