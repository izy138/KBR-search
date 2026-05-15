import { useEffect, useState } from "react";
import { getProjectById, type SearchResultRecord } from "../api";

/**
 * Manages fetch and state for a single project detail view.
 *
 * Resolution order:
 *   1. If `projectId` is null, clears all state immediately.
 *   2. If the project already exists in the `results` list, uses it without
 *      a network round-trip.
 *   3. Otherwise fetches from `GET /projects/:id`.
 *
 * The effect is cancellable — state setters are no-ops after the calling
 * component unmounts or `projectId` changes mid-flight.
 */
export function useProjectDetails(
  projectId: string | null,
  results: SearchResultRecord[],
): {
  selectedProject: SearchResultRecord | null;
  projectLoading: boolean;
  projectError: string;
} {
  const [selectedProject, setSelectedProject] = useState<SearchResultRecord | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState<string>("");

  useEffect(() => {
    let isCancelled = false;

    if (!projectId) {
      setSelectedProject(null);
      setProjectLoading(false);
      setProjectError("");
      return;
    }

    const projectFromResults = results.find(
      (item) => (item._id ?? item.id) === projectId,
    );
    if (projectFromResults) {
      setSelectedProject(projectFromResults);
      setProjectLoading(false);
      setProjectError("");
      return;
    }

    setProjectLoading(true);
    setProjectError("");
    void getProjectById(projectId)
      .then((project) => {
        if (isCancelled) return;
        setSelectedProject(project);
      })
      .catch(() => {
        if (isCancelled) return;
        setSelectedProject(null);
        setProjectError("Unable to load this project right now.");
      })
      .finally(() => {
        if (isCancelled) return;
        setProjectLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [projectId, results]);

  return { selectedProject, projectLoading, projectError };
}
