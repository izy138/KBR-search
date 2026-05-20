import type { ReactNode } from "react";

export type HelpTooltipContent = {
  label: string;
  body: ReactNode;
};

export const HELP_DASHBOARD: HelpTooltipContent = {
  label: "How the dashboard works",
  body: (
    <>
      <p className="mb-2">
        Filter choices (PI, institute, activity, state, fiscal year) apply automatically and refresh every chart and KPI.
      </p>
      <p className="mb-2">
        You can also click the map, bar charts, or activity pie to add filters from the visuals.
      </p>
      <p>
        Enter keywords in the search bar and click <strong className="font-medium text-text-primary">Update Dashboard</strong> to scope analytics to that text. Use <strong className="font-medium text-text-primary">Search</strong> to open the full results page with the same query.
      </p>
    </>
  ),
};

export const HELP_SEARCH: HelpTooltipContent = {
  label: "How search works",
  body: (
    <>
      <p className="mb-2">
        <strong className="font-medium text-text-primary">Advanced</strong> opens field-level keyword search with AND/OR operators for more precise matching on titles, PIs, organizations, and other fields.
      </p>
      <p>
        <strong className="font-medium text-text-primary">Semantic</strong> finds projects by meaning: describe the research in a sentence instead of exact keywords, then run Search. Results are ranked by similarity, not keyword overlap.
      </p>
    </>
  ),
};

export const HELP_PROJECT_SIMILAR: HelpTooltipContent = {
  label: "About similar projects",
  body: (
    <>
      <p className="mb-2">
        Similar grants are found with vector search over title, keywords, and abstract text—not just shared keywords.
      </p>
      <p>
        Compare total award amounts in the chart, open a grant from the list, or use <strong className="font-medium text-text-primary">See more similar projects</strong> for the full similarity view.
      </p>
    </>
  ),
};

export const HELP_PROJECT_KEYWORDS: HelpTooltipContent = {
  label: "How keyword search works",
  body: (
    <>
      <p className="mb-2">
        Click a tag to include it in search, click again to exclude it (NOT), and once more to clear. Included tags must match; excluded tags must not appear in project keywords.
      </p>
      <p>
        Optionally add extra words, then click <strong className="font-medium text-text-primary">Search Projects</strong> to open Search with your tag filters and text query applied.
      </p>
    </>
  ),
};
