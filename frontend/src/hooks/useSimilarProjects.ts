import { useEffect, useState } from "react";
import { searchSimilarToProjectId, type SearchResultRecord } from "../api";

export const SIMILAR_PANEL_K = 10;

const SIMILAR_CACHE_TTL_MS = 5 * 60 * 1000;
const similarCache = new Map<
  string,
  { neighbors: SearchResultRecord[]; fetchedAt: number }
>();

function readSimilarCache(projectId: string): SearchResultRecord[] | null {
  const entry = similarCache.get(projectId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > SIMILAR_CACHE_TTL_MS) {
    similarCache.delete(projectId);
    return null;
  }
  return entry.neighbors;
}

function writeSimilarCache(projectId: string, neighbors: SearchResultRecord[]): void {
  similarCache.set(projectId, { neighbors, fetchedAt: Date.now() });
}

/**
 * Prefetches similar grants for the project details sidebar.
 *
 * Intended to run alongside `useProjectDetails` in App so the k-NN request
 * starts as soon as the route has a project id, not when ProjectDetailsPage
 * mounts after the lazy chunk loads.
 */
export function useSimilarProjects(projectId: string | null): {
  similarNeighbors: SearchResultRecord[];
  similarLoading: boolean;
  similarError: string;
} {
  const [similarNeighbors, setSimilarNeighbors] = useState<SearchResultRecord[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarError, setSimilarError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    if (!projectId) {
      setSimilarNeighbors([]);
      setSimilarError("");
      setSimilarLoading(false);
      return;
    }

    const cached = readSimilarCache(projectId);
    if (cached) {
      setSimilarNeighbors(cached);
      setSimilarError("");
      setSimilarLoading(false);
      return;
    }

    setSimilarLoading(true);
    setSimilarError("");
    setSimilarNeighbors([]);

    void (async () => {
      try {
        const payload = await searchSimilarToProjectId(projectId, SIMILAR_PANEL_K, controller.signal);
        if (!controller.signal.aborted) {
          const neighbors = payload.results ?? [];
          writeSimilarCache(projectId, neighbors);
          setSimilarNeighbors(neighbors);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          const msg = err instanceof Error ? err.message : "Similarity search failed.";
          setSimilarError(msg);
          setSimilarNeighbors([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSimilarLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [projectId]);

  return { similarNeighbors, similarLoading, similarError };
}
