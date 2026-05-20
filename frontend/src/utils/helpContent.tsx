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

export const HELP_DASHBOARD_FILTER_PI: HelpTooltipContent = {
  label: "Principal Investigator filter",
  body: (
    <>
      <p className="mb-2">
        Limits dashboard charts and KPIs to grants where this person appears in <strong className="font-medium text-text-primary">PI_NAMEs</strong>. Use &quot;Last, First&quot; or &quot;First Last&quot; style names.
      </p>
      <p>
        Applies when you press <strong className="font-medium text-text-primary">Enter</strong> or leave the field. Clear with <strong className="font-medium text-text-primary">Clear All</strong>.
      </p>
    </>
  ),
};

export const HELP_DASHBOARD_FILTER_IC: HelpTooltipContent = {
  label: "NIH Institute / Center filter",
  body: (
    <>
      <p className="mb-2">
        Filters to projects administered by the selected NIH institute or center (<strong className="font-medium text-text-primary">IC_NAME</strong>).
      </p>
      <p>
        Updates all dashboard visuals immediately. You can also click a bar in <strong className="font-medium text-text-primary">Projects by Institute (IC)</strong> to set this filter.
      </p>
    </>
  ),
};

export const HELP_DASHBOARD_FILTER_ACTIVITY: HelpTooltipContent = {
  label: "Activity Code filter",
  body: (
    <>
      <p className="mb-2">
        Limits results to one NIH activity code (for example R01, F32, or P01). Activity describes the type of award mechanism.
      </p>
      <p>
        The funding pie chart and several panels respond to this filter. Click a pie slice to apply an activity code without using the dropdown.
      </p>
    </>
  ),
};

export const HELP_DASHBOARD_FILTER_FY: HelpTooltipContent = {
  label: "Fiscal Year filter",
  body: (
    <>
      <p className="mb-2">
        Sets the fiscal year range included in dashboard totals and charts (<strong className="font-medium text-text-primary">FY</strong> on each award).
      </p>
      <p>
        Drag the slider handles, then release to apply. All other filters stay in effect.
      </p>
    </>
  ),
};

export const HELP_DASHBOARD_TERM_THEMES: HelpTooltipContent = {
  label: "Project term themes",
  body: (
    <>
      <p className="mb-2">
        Browse grouped NIH <strong className="font-medium text-text-primary">PROJECT_TERMS</strong> themes. Click a category to open sub-themes, then select individual term pills (up to 20).
      </p>
      <p>
        Use <strong className="font-medium text-text-primary">Search N terms</strong> to open the Search page filtered to those keywords.
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

export const HELP_SEARCH_FILTER_PI: HelpTooltipContent = {
  label: "Principal Investigator filter",
  body: (
    <>
      <p className="mb-2">
        Narrows results to grants where this person appears in <strong className="font-medium text-text-primary">PI_NAMEs</strong>. Use &quot;Last, First&quot; or &quot;First Last&quot; style names.
      </p>
      <p>
        Applies when you press <strong className="font-medium text-text-primary">Enter</strong> or leave the field. Combine with keywords and other filters, then click <strong className="font-medium text-text-primary">Search</strong>.
      </p>
    </>
  ),
};

export const HELP_SEARCH_FILTER_IC: HelpTooltipContent = {
  label: "NIH Institute / Center filter",
  body: (
    <>
      <p className="mb-2">
        Limits results to projects administered by the selected NIH institute or center (<strong className="font-medium text-text-primary">IC_NAME</strong>).
      </p>
      <p>
        Applies as soon as you pick a value. Works together with your search query and other filters.
      </p>
    </>
  ),
};

export const HELP_SEARCH_FILTER_ACTIVITY: HelpTooltipContent = {
  label: "Activity Code filter",
  body: (
    <>
      <p className="mb-2">
        Limits results to one NIH activity code (for example R01, F32, or P01)—the award mechanism type.
      </p>
      <p>
        Applies immediately when selected. The <strong className="font-medium text-text-primary">Code</strong> column in the results table shows each project&apos;s activity code.
      </p>
    </>
  ),
};

export const HELP_SEARCH_FILTER_FY: HelpTooltipContent = {
  label: "Fiscal Year filter",
  body: (
    <>
      <p className="mb-2">
        Restricts results to awards within the selected fiscal year range (<strong className="font-medium text-text-primary">FY</strong>).
      </p>
      <p>
        Drag the slider handles, then release to apply. Re-run <strong className="font-medium text-text-primary">Search</strong> if you change filters after typing new keywords.
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
