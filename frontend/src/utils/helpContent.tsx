import type { ReactNode } from "react";

export type HelpTooltipContent = {
  label: string;
  body: ReactNode;
};

export const HELP_DASHBOARD: HelpTooltipContent = {
  label: "Dashboard overview",
  body: (
    <p>
      Filters and clicks on the map or charts narrow every number and chart on this page. Use <strong className="font-medium text-text-primary">Update Dashboard</strong> for keyword scoping, or <strong className="font-medium text-text-primary">Search</strong> for the full project list.
    </p>
  ),
};

export const HELP_DASHBOARD_FILTER_PI: HelpTooltipContent = {
  label: "Principal Investigator",
  body: (
    <p>
      Show only grants led by this researcher; type their name as it appears in the data. Press <strong className="font-medium text-text-primary">Enter</strong> or leave the field to apply.
    </p>
  ),
};

export const HELP_DASHBOARD_FILTER_IC: HelpTooltipContent = {
  label: "NIH Institute / Center",
  body: (
    <p>
      Show only projects funded by the NIH office you pick (for example NCI or NIAID). Charts update right away, or click a bar in <strong className="font-medium text-text-primary">Projects by Institute (IC)</strong>.
    </p>
  ),
};

export const HELP_DASHBOARD_FILTER_ORG: HelpTooltipContent = {
  label: "Organization filter",
  body: (
    <>
      <p className="mb-2">
        Limits dashboard charts and KPIs to awards at the selected funded organization (<strong className="font-medium text-text-primary">ORG_NAME</strong>).
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
      Show only one award type, such as <strong className="font-medium text-text-primary">R01</strong> (research grant) or <strong className="font-medium text-text-primary">F32</strong> (fellowship). Click a pie slice to set this without the dropdown.
    </p>
  ),
};

export const HELP_DASHBOARD_FILTER_STATE: HelpTooltipContent = {
  label: "State",
  body: (
    <p>
      Show only projects at organizations in that U.S. state (two-letter code like <strong className="font-medium text-text-primary">CA</strong> or <strong className="font-medium text-text-primary">NY</strong>). Click a state on the map to set this filter.
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
  label: "Project term themes",
  body: (
    <p>
      Browse topic groups, select term pills (up to 20), then click <strong className="font-medium text-text-primary">Search N terms</strong> to open Search with those topics.
    </p>
  ),
};

export const HELP_SEARCH: HelpTooltipContent = {
  label: "How search works",
  body: (
    <p>
      Type words and click <strong className="font-medium text-text-primary">Search</strong>, or use filters to narrow by person, institute, award type, state, or year. <strong className="font-medium text-text-primary">Download CSV</strong> exports up to 10,000 matching rows.
    </p>
  ),
};

export const HELP_SEARCH_ADVANCED: HelpTooltipContent = {
  label: "Advanced search",
  body: (
    <p>
      Pick fields and combine conditions with <strong className="font-medium text-text-primary">AND</strong> or <strong className="font-medium text-text-primary">OR</strong> for precise matching. Check <strong className="font-medium text-text-primary">Advanced</strong>, apply your rules, and uncheck it to return to simple search.
    </p>
  ),
};

export const HELP_SEARCH_SEMANTIC: HelpTooltipContent = {
  label: "Semantic search",
  body: (
    <p>
      Describe the research in plain language; results match by meaning, not exact words. Turn on <strong className="font-medium text-text-primary">Semantic</strong>, search, then turn it off for keyword or Advanced search.
    </p>
  ),
};

export const HELP_SEARCH_FILTER_PI: HelpTooltipContent = {
  label: "Principal Investigator",
  body: (
    <p>
      Only show grants where this person is a lead researcher. Press <strong className="font-medium text-text-primary">Enter</strong> or leave the field, then <strong className="font-medium text-text-primary">Search</strong> if you also typed keywords.
    </p>
  ),
};

export const HELP_SEARCH_FILTER_IC: HelpTooltipContent = {
  label: "NIH Institute / Center",
  body: (
    <p>
      Only show projects overseen by the institute or center you select. Applies as soon as you pick a value.
    </p>
  ),
};

export const HELP_SEARCH_FILTER_ORG: HelpTooltipContent = {
  label: "Organization filter",
  body: (
    <>
      <p className="mb-2">
        Limits results to grants at the selected funded organization (<strong className="font-medium text-text-primary">ORG_NAME</strong>). The <strong className="font-medium text-text-primary">University</strong> column shows each project&apos;s organization.
      </p>
      <p>
        Applies as soon as you pick a value. Works together with your search query and other filters.
      </p>
    </>
  ),
};

export const HELP_SEARCH_FILTER_ACTIVITY: HelpTooltipContent = {
  label: "Activity code",
  body: (
    <p>
      Only show one award type; the code appears in the <strong className="font-medium text-text-primary">Code</strong> column. Applies as soon as you pick from the list.
    </p>
  ),
};

export const HELP_SEARCH_FILTER_STATE: HelpTooltipContent = {
  label: "State",
  body: (
    <p>
      Only show projects where the organization is in that U.S. state (for example <strong className="font-medium text-text-primary">TX</strong> or <strong className="font-medium text-text-primary">MA</strong>). Applies as soon as you pick a value.
    </p>
  ),
};

export const HELP_SEARCH_FILTER_FY: HelpTooltipContent = {
  label: "Fiscal year",
  body: (
    <p>
      Only show awards inside the fiscal year range on the slider. Drag the handles, release to apply, then <strong className="font-medium text-text-primary">Search</strong> if needed.
    </p>
  ),
};

export const HELP_PROJECT_SIMILAR: HelpTooltipContent = {
  label: "Similar projects",
  body: (
    <p>
      These grants are related by topic and wording, not just shared keyword tags. Open a row for details or use <strong className="font-medium text-text-primary">See more similar projects</strong> for a longer list.
    </p>
  ),
};

export const HELP_PROJECT_KEYWORDS: HelpTooltipContent = {
  label: "Keywords on this project",
  body: (
    <p>
      Click a tag to include it, again to exclude it, and a third time to clear. Click <strong className="font-medium text-text-primary">Search Projects</strong> to run Search with your tag choices.
    </p>
  ),
};
