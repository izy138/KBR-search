import { useEffect, useState } from "react";
import { getProjectsByOrganization, type SearchResultRecord } from "../api";
import { ENTITY_LIST_PER_PAGE } from "./useInvestigatorProjects";

export function useOrganizationProjects(
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
    void getProjectsByOrganization(name, { limit: ENTITY_LIST_PER_PAGE, page, signal: controller.signal })
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
        setError("Unable to load university projects right now.");
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
