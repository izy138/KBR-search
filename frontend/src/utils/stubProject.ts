import type { SearchResultRecord } from "../api";

/** Minimal record so the project layout can render while the full document loads. */
export function stubProjectFromId(projectId: string): SearchResultRecord {
  return { _id: projectId, id: projectId };
}
