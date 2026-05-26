import { useEffect, useState } from "react";
import { getProjectsByInvestigator, type SearchResultRecord } from "../api";

/** Number of entity list results fetched per page (PI, university, institution). */
export const ENTITY_LIST_PER_PAGE = 25;

/** @deprecated Use ENTITY_LIST_PER_PAGE */
export const INVESTIGATOR_PER_PAGE = ENTITY_LIST_PER_PAGE;

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
    const controller = new AbortController();

    if (!name) {
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    void getProjectsByInvestigator(name, { limit: ENTITY_LIST_PER_PAGE, page, signal: controller.signal })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setResults(payload.results ?? []);
        setTotal(payload.total ?? 0);
        setVisibleTotal(payload.visible_total ?? payload.total ?? 0);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setResults([]);
        setTotal(0);
        setVisibleTotal(0);
        setError("Unable to load investigator projects right now.");
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [name, page]);

  return { results, loading, error, total, visibleTotal, perPage: ENTITY_LIST_PER_PAGE };
}
