import { useEffect, useState } from "react";
import { getProjectsByInvestigator, type SearchResultRecord } from "../api";

/** Number of investigator results fetched per page. */
export const INVESTIGATOR_PER_PAGE = 25;

/**
 * Manages paginated fetch and state for an investigator's project list.
 *
 * - Clears all state when `name` is null.
 * - Re-fetches whenever `name` or `page` changes.
 * - The effect is cancellable to prevent stale state on rapid navigation.
 */
export function useInvestigatorProjects(
  name: string | null,
  page: number,
): {
  results: SearchResultRecord[];
  loading: boolean;
  error: string;
  total: number;
  visibleTotal: number;
  perPage: number;
} {
  const [results, setResults] = useState<SearchResultRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [total, setTotal] = useState(0);
  const [visibleTotal, setVisibleTotal] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    if (!name) {
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    void getProjectsByInvestigator(name, { limit: INVESTIGATOR_PER_PAGE, page })
      .then((payload) => {
        if (isCancelled) return;
        setResults(payload.results ?? []);
        setTotal(payload.total ?? 0);
        setVisibleTotal(payload.visible_total ?? payload.total ?? 0);
      })
      .catch(() => {
        if (isCancelled) return;
        setResults([]);
        setTotal(0);
        setVisibleTotal(0);
        setError("Unable to load investigator projects right now.");
      })
      .finally(() => {
        if (isCancelled) return;
        setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [name, page]);

  return { results, loading, error, total, visibleTotal, perPage: INVESTIGATOR_PER_PAGE };
}
