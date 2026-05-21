import { useEffect, useRef, useState } from "react";
import { getActivityData, getIcData, getOrgData, getStateData } from "../api";
import type { FilterValues } from "../types/filters";
import { toFacetAvailabilityFilterOptions } from "../utils/analyticsFilters";

export type CascadingFacetKey = "ic" | "org" | "activity" | "state";

export type CascadingAvailability = Record<CascadingFacetKey, Set<string>>;

const ACTIVITY_CATALOG_LIMIT = 80;
const ORG_CATALOG_LIMIT = 100;
const CASCADE_DEBOUNCE_MS = 200;

export function normalizeStateFacetKey(state: string): string {
  return state.trim().toUpperCase();
}

function hasCascadingFacetSelection(filters: FilterValues): boolean {
  return Boolean(
    filters.pi.trim()
      || filters.ic
      || filters.org
      || filters.activity
      || filters.state,
  );
}

function omitFacet(
  filters: FilterValues,
  omit: CascadingFacetKey,
): ReturnType<typeof toFacetAvailabilityFilterOptions> {
  const base = toFacetAvailabilityFilterOptions(filters);
  if (omit === "ic") {
    return { ...base, ic: undefined };
  }
  if (omit === "org") {
    return { ...base, org: undefined };
  }
  if (omit === "activity") {
    return { ...base, activity: undefined };
  }
  return { ...base, state: undefined };
}

function labelsToSet(labels: string[]): Set<string> {
  return new Set(labels);
}

function statesToSet(states: { state: string }[]): Set<string> {
  const keys = states
    .map((row) => normalizeStateFacetKey(row.state))
    .filter((key) => key.length > 0);
  return new Set(keys);
}

/**
 * Loads which IC / org / activity / state values exist for the current facet selection.
 * Returns null while loading or when no facet is selected (all catalog options stay enabled).
 */
export function useCascadingFilterAvailability(draft: FilterValues): CascadingAvailability | null {
  const [availability, setAvailability] = useState<CascadingAvailability | null>(null);
  const requestGenRef = useRef(0);

  useEffect(() => {
    if (!hasCascadingFacetSelection(draft)) {
      requestGenRef.current += 1;
      setAvailability(null);
      return;
    }

    const generation = requestGenRef.current + 1;
    requestGenRef.current = generation;
    setAvailability(null);

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void Promise.all([
        getIcData(undefined, omitFacet(draft, "ic")),
        getOrgData({
          limit: ORG_CATALOG_LIMIT,
          minProjects: 1,
          filters: omitFacet(draft, "org"),
        }),
        getActivityData(ACTIVITY_CATALOG_LIMIT, omitFacet(draft, "activity")),
        getStateData(omitFacet(draft, "state")),
      ])
        .then(([icData, orgData, activityData, stateData]) => {
          if (cancelled || generation !== requestGenRef.current) {
            return;
          }
          setAvailability({
            ic: labelsToSet(icData.map((row) => row.label)),
            org: labelsToSet(orgData.map((row) => row.label)),
            activity: labelsToSet(activityData.map((row) => row.label)),
            state: statesToSet(stateData),
          });
        })
        .catch(() => {
          if (cancelled || generation !== requestGenRef.current) {
            return;
          }
          setAvailability(null);
        });
    }, CASCADE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    draft.pi,
    draft.ic,
    draft.org,
    draft.state,
    draft.activity,
    draft.fyMin,
    draft.fyMax,
  ]);

  if (!hasCascadingFacetSelection(draft)) {
    return null;
  }

  return availability;
}
