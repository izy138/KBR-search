import type { ReactNode } from "react";

export type HelpTooltipContent = {
  label: string;
  body: ReactNode;
};

export const HELP_DASHBOARD: HelpTooltipContent = {
  label: "Dashboard overview",
  body: (
    <p>
      The dashboard will update dynamically with filters and clicks to charts you see. Use <strong className="font-semibold text-text-primary">Update Dashboard</strong> to apply typed filters, or <strong className="font-semibold text-text-primary">Search</strong> for the full project list.
    </p>
  ),
};

export const HELP_DASHBOARD_FILTER_PI: HelpTooltipContent = {
  label: "Principal Investigator",
  body: (
    <p>
      Show grants led by this researcher; type their name as it appears in the data or in [FirstName LastName] format. Press <strong className="font-semibold text-text-primary"> Enter</strong> or leave the field to apply.
    </p>
  ),
};

export const HELP_DASHBOARD_FILTER_IC: HelpTooltipContent = {
  label: "NIH Institute / Center",
  body: (
    <p>
      Show projects funded by the NIH office you pick (for example NCI or NIAID). Charts update right away, or click a bar in <strong className="font-semibold text-text-primary">Projects by Institute</strong>.
    </p>
  ),
};

export const HELP_DASHBOARD_FILTER_ORG: HelpTooltipContent = {
  label: "Organization filter",
  body: (
    <>
      <p className="mb-2">
        Limits dashboard charts and KPIs to awards at the selected funded organization (<strong className="font-semibold text-text-primary">ORG_NAME</strong>).
      </p>
      <p>
        Applies as soon as you pick a value. Combine with institute, activity, state, and other filters.
      </p>
    </>
  ),
};

export const HELP_DASHBOARD_FILTER_ACTIVITY: HelpTooltipContent = {
  label: "Activity code",
  body: (
    <p>
      Show one award type, such as <strong className="font-semibold text-text-primary">R01</strong> (research grant) or <strong className="font-semibold text-text-primary">F32</strong> (fellowship). Click a pie slice to set this without the dropdown.
    </p>
  ),
};

export const HELP_DASHBOARD_FILTER_STATE: HelpTooltipContent = {
  label: "State",
  body: (
    <p>
      Show only projects at organizations in that U.S. state (two-letter code like <strong className="font-semibold text-text-primary">CA</strong> or <strong className="font-semibold text-text-primary">NY</strong>). Click a state on the map to set this filter.
    </p>
  ),
};

export const HELP_DASHBOARD_FILTER_FY: HelpTooltipContent = {
  label: "Fiscal year",
  body: (
    <p>
      Limit charts to awards in a range of federal budget years. Drag the slider handles and release to apply.
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
      Type words and click <strong className="font-semibold text-text-primary">Search</strong>, or use filters to narrow by person, institute, award type, state, or year. <strong className="font-semibold text-text-primary">Download CSV</strong> exports up to 10,000 matching rows.
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
      Shows grants where this person is a lead researcher. Press <strong className="font-semibold text-text-primary">Enter</strong> or leave the field, then <strong className="font-semibold text-text-primary">Search</strong> if you also typed keywords.
    </p>
  ),
};

export const HELP_SEARCH_FILTER_IC: HelpTooltipContent = {
  label: "NIH Institute / Center",
  body: (
    <p>
      Show projects overseen by the institute or center you select. Applies as soon as you pick a value.
    </p>
  ),
};

export const HELP_SEARCH_FILTER_ORG: HelpTooltipContent = {
  label: "Organization filter",
  body: (
    <>
      <p className="mb-2">
        Limits results to projects at the selected funded organization. Applies as soon as you pick a value.
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
