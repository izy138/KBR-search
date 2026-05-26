import { useCallback, useEffect, useState } from "react";
import type { FilterValues } from "../types/filters";
import { emptyFilterValues } from "../types/filters";

export function useFilterDraft(applied: FilterValues) {
  const [draft, setDraft] = useState<FilterValues>(applied);

  useEffect(() => {
    setDraft(applied);
  }, [applied]);

  const patch = useCallback((partial: Partial<FilterValues>) => {
    setDraft((current) => ({ ...current, ...partial }));
  }, []);

  const resetDraft = useCallback(() => {
    setDraft(emptyFilterValues());
  }, []);

  return { draft, patch, resetDraft, setDraft };
}
