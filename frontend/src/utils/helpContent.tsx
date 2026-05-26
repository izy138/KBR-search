import type { ReactNode } from "react";

export type HelpTooltipContent = {
  label: string;
  body: ReactNode;
};

export const HELP_DASHBOARD: HelpTooltipContent = {
  label: "Dashboard overview",
  body: (
    <p>
      The dashboard will update dynamically with filters and clicks to charts. Use <strong className="font-semibold text-text-primary">Update Dashboard</strong> to apply typed filters, or <strong className="font-semibold text-text-primary">Search</strong> for the full project list.
    </p>
  ),
};

export const HELP_DASHBOARD_FILTER_PI: HelpTooltipContent = {
  label: "Principal Investigator",
  body: (
    <p>
      Filters grants led by this researcher; type their name as it appears in the data or in <strong className="font-semibold text-text-primary"> FirstName LastName</strong> format. Press <strong className="font-semibold text-text-primary"> Enter</strong> or leave the field to apply.
    </p>
  ),
};

export const HELP_DASHBOARD_FILTER_IC: HelpTooltipContent = {
  label: "NIH Institute / Center",
  body: (
    <p>
      Filters projects overseen by the institute or center selected.
    </p>
  ),
};

export const HELP_DASHBOARD_FILTER_ORG: HelpTooltipContent = {
  label: "Organization filter",
  body: (
    <>
      <p className="mb-2">
        Filters dashboard charts and PIs to projects at the selected funded organization.
      </p>
    </>
  ),
};

export const HELP_DASHBOARD_FILTER_ACTIVITY: HelpTooltipContent = {
  label: "Activity code",
  body: (
    <p>
      Filters only one award type, such as <strong className="font-semibold text-text-primary">R01</strong> (research grant) or <strong className="font-semibold text-text-primary">F32</strong> (fellowship). Click a pie slice to set this value as well.
    </p>
  ),
};

export const HELP_DASHBOARD_FILTER_STATE: HelpTooltipContent = {
  label: "State",
  body: (
    <p>
      Filters projects at organizations in that specific U.S. state. Click a state on the map to set this value as well.
    </p>
  ),
};

export const HELP_DASHBOARD_FILTER_FY: HelpTooltipContent = {
  label: "Fiscal year",
  body: (
    <p>
      Filters charts to awards in a range of federal budget years. Drag the slider handles and release to apply. You can stack the handles to show one single fiscal year.
    </p>
  ),
};

export const HELP_DASHBOARD_TERM_THEMES: HelpTooltipContent = {
  label: "Project Term Themes",
  body: (
    <>
      <p className="mb-2">
        Select a theme from the list, then choose a subcategory to browse terms.
      </p>
      <p className="mb-2">
        Browse grouped NIH <strong className="font-semibold text-text-primary">PROJECT_TERMS</strong> themes. Click a category to open sub-themes, then select individual term pills (up to 20).
      </p>
      <p>
        Use <strong className="font-semibold text-text-primary">Search N terms</strong> to open the Search page filtered to those keywords.
      </p>
    </>
  ),
};

export const HELP_SEARCH: HelpTooltipContent = {
  label: "How search works",
  body: (
    <p>
      Type words and click <strong className="font-semibold text-text-primary">Search</strong>, or use filters to narrow by Principal Investigator, institute, award type, state, and/or year. <strong className="font-semibold text-text-primary">Download CSV</strong> exports up to 10,000 matching rows.
    </p>
  ),
};

export const HELP_SEARCH_ADVANCED: HelpTooltipContent = {
  label: "Advanced search",
  body: (
    <p>
      Pick fields and combine conditions with <strong className="font-semibold text-text-primary">AND</strong> or <strong className="font-semibold text-text-primary">OR</strong> for precise matching. Click <strong className="font-semibold text-text-primary">Advanced</strong>, apply your rules, and click again to return to simple search.
    </p>
  ),
};

export const HELP_SEARCH_SEMANTIC: HelpTooltipContent = {
  label: "Semantic search",
  body: (
    <p>
      Describe the research in plain language; results match by meaning, not exact words. Click <strong className="font-semibold text-text-primary">Semantic</strong>, search, then click again for keyword or Advanced search.
    </p>
  ),
};

export const HELP_SEARCH_FILTER_PI: HelpTooltipContent = {
  label: "Principal Investigator",
  body: (
    <p>
      Filters grants led by this researcher; type their name as it appears in the data or in <strong className="font-semibold text-text-primary"> FirstName LastName</strong> format. Press <strong className="font-semibold text-text-primary"> Enter</strong> or leave the field to apply.
    </p>
  ),
};

export const HELP_SEARCH_FILTER_IC: HelpTooltipContent = {
  label: "NIH Institute / Center",
  body: (
    <p>
      Filters projects overseen by the institute or center selected.
    </p>
  ),
};

export const HELP_SEARCH_FILTER_ORG: HelpTooltipContent = {
  label: "Organization filter",
  body: (
    <>
      <p className="mb-2">
        Filters results to projects at the selected funded organization.
      </p>
    </>
  ),
};

export const HELP_SEARCH_FILTER_ACTIVITY: HelpTooltipContent = {
  label: "Activity code",
  body: (
    <p>
      Shows projects by one specified Activity Code. Applies as soon as you pick from the list.
    </p>
  ),
};

export const HELP_SEARCH_FILTER_STATE: HelpTooltipContent = {
  label: "State",
  body: (
    <p>
      Filters projects where the organization is in that U.S. state (for example <strong className="font-semibold text-text-primary">TX</strong> or <strong className="font-semibold text-text-primary">MA</strong>). Applies as soon as you pick a value.
    </p>
  ),
};

export const HELP_SEARCH_FILTER_FY: HelpTooltipContent = {
  label: "Fiscal year",
  body: (
    <p>
      Drag the handles to show a range of years. You can <strong className="font-semibold text-text-primary"> Stack the handles on top of each other</strong> to select a single year of data, then press  <strong className="font-semibold text-text-primary"> Search </strong> to activate the filter.
    </p>
  ),
};

export const HELP_PROJECT_SIMILAR: HelpTooltipContent = {
  label: "Similar projects",
  body: (
    <p>
      These grants are related by topic and wording in addition to shared keyword tags. Open a project page for details or use <strong className="font-semibold text-text-primary">See more similar projects</strong> for a longer list.
    </p>
  ),
};

export const HELP_PROJECT_KEYWORDS: HelpTooltipContent = {
  label: "Keywords on this project",
  body: (
    <p>
      Click a tag to include it, again to exclude it, and a third time to clear. Click <strong className="font-semibold text-text-primary">Search Projects</strong> to run a Search with your tag choices.
    </p>
  ),
};
