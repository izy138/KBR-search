import { useEffect, useState } from "react";
import { getActivityData, getIcData, getStateData, getYearData } from "../api";

/** Shape of the filter option lists shared across Search and Dashboard views. */
export interface FilterCatalog {
  icNames: string[];
  activityCodes: string[];
  states: string[];
  fiscalYearOptions: number[];
}

/**
 * Module-level promise cache so that parallel hook invocations from different
 * components share a single in-flight request and a single resolved value.
 * Set back to null on failure so the next mount can retry.
 */
let cachedPromise: Promise<FilterCatalog> | null = null;

function fetchFilterCatalog(): Promise<FilterCatalog> {
  if (!cachedPromise) {
    cachedPromise = Promise.all([
      getIcData(),
      getActivityData(80),
      getStateData(),
      getYearData(),
    ])
      .then(([icData, activityData, stateData, yearData]) => ({
        icNames: icData.map((p) => p.label),
        activityCodes: activityData.map((p) => p.label),
        states: stateData.map((p) => p.state),
        fiscalYearOptions: yearData.map((d) => d.year),
      }))
      .catch((err: unknown) => {
        // Allow a retry on the next mount cycle.
        cachedPromise = null;
        throw err;
      });
  }
  return cachedPromise;
}

/**
 * Returns the shared filter catalog (IC names, activity codes, states, fiscal
 * years) fetched once per application session via a module-level promise cache.
 *
 * Returns `null` while loading or when an unrecoverable fetch error occurred.
 */
export function useFilterCatalog(): FilterCatalog | null {
  const [catalog, setCatalog] = useState<FilterCatalog | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchFilterCatalog()
      .then((result) => {
        if (!cancelled) setCatalog(result);
      })
      .catch(() => {
        if (!cancelled) setCatalog(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return catalog;
}
