import type { AdvancedSearchQuery } from "./types/advancedSearch";
import { normalizeAdvancedSearchQuery } from "./utils/advancedSearch";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export interface SearchResultRecord {
  _id?: string;
  id?: string;
  // Search scoring / ranking metadata
  _score?: number;
  _rank_keyword?: number;
  _rank_vector?: number;
  _fused_score?: number;
  // Core CSV fields — identifiers
  APPLICATION_ID?: number;
  APPLICATION_TYPE?: number;
  CORE_PROJECT_NUM?: string;
  FULL_PROJECT_NUM?: string;
  SERIAL_NUMBER?: string;
  SUFFIX?: string;
  SUBPROJECT_ID?: string;
  SUPPORT_YEAR?: number;
  // Project metadata
  PROJECT_TITLE?: string;
  ACTIVITY?: string;
  IC_NAME?: string;
  ADMINISTERING_IC?: string;
  FUNDING_ICs?: string;
  FUNDING_MECHANISM?: string;
  NIH_SPENDING_CATS?: string;
  ASSISTANCE_LISTING_NUMBER?: string;
  OPPORTUNITY_NUMBER?: string;
  ARRA_FUNDED?: string;
  // Dates and financials
  FY?: number;
  PROJECT_START?: string;
  PROJECT_END?: string;
  BUDGET_START?: string;
  BUDGET_END?: string;
  AWARD_NOTICE_DATE?: string;
  TOTAL_COST?: number;
  TOTAL_COST_SUB_PROJECT?: number;
  DIRECT_COST_AMT?: number;
  INDIRECT_COST_AMT?: number;
  // Organization fields
  ORG_NAME?: string;
  ORG_STATE?: string;
  ORG_CITY?: string;
  ORG_ZIPCODE?: string;
  ORG_COUNTRY?: string;
  ORG_DEPT?: string;
  ORG_DISTRICT?: string;
  ORG_DUNS?: string;
  ORG_FIPS?: string;
  ORG_IPF_CODE?: string;
  ED_INST_TYPE?: string;
  // Personnel
  PI_NAMEs?: string;
  PI_IDS?: string;
  PROGRAM_OFFICER_NAME?: string;
  // Study section / review
  STUDY_SECTION?: string;
  STUDY_SECTION_NAME?: string;
  // Text / abstract fields
  PROJECT_TERMS?: string;
  ABSTRACT_TEXT?: string;
  PROJECT_ABSTRACT?: string;
  PHR?: string;
  // Fiscal year variants embedded in search results
  year_variants?: ProjectYearVariant[];
  // Lowercase aliases accessed by display logic in App.tsx
  title?: string;
  project_title?: string;
  abstract?: string;
  category?: string;
}

export interface SearchResponse {
  query: string;
  advanced_q?: Array<{ text: string; negated: boolean }> | null;
  advanced_operators?: string[] | null;
  project_terms?: string[];
  exclude_project_terms?: string[];
  limit: number;
  total: number;
  visible_total?: number;
  results: SearchResultRecord[];
}

export interface ProjectResponse {
  project: SearchResultRecord;
}

export interface ProjectFiscalYear {
  project_id: string;
  application_id?: number;
  fy?: number;
  is_current?: boolean;
}

/** @deprecated Use ProjectFiscalYear */
export type ProjectOtherYear = ProjectFiscalYear;

export interface ProjectYearVariant {
  project_id: string;
  application_id?: number;
  fy?: number;
}

export interface ProjectOtherYearsResponse {
  project_id: string;
  project_title?: string;
  core_project_num?: string;
  years: ProjectFiscalYear[];
  other_years: ProjectFiscalYear[];
}

export interface InvestigatorProjectsResponse {
  investigator_name: string;
  limit: number;
  total: number;
  visible_total?: number;
  results: SearchResultRecord[];
}

export interface OrganizationProjectsResponse {
  organization_name: string;
  limit: number;
  total: number;
  visible_total?: number;
  results: SearchResultRecord[];
}

export interface InstitutionProjectsResponse {
  institution_name: string;
  limit: number;
  total: number;
  visible_total?: number;
  results: SearchResultRecord[];
}

export interface AnalyticsCategory {
  label: string;
  value: number;
}

export interface HealthStatus {
  status: string;
  opensearch: string;
}

export type SearchSortField =
  | "PI_NAMEs"
  | "ORG_NAME"
  | "IC_NAME"
  | "ORG_STATE"
  | "ACTIVITY"
  | "PROJECT_TITLE"
  | "FY"
  | "TOTAL_COST";

export type SearchSortDirection = "asc" | "desc";

export type SearchProjectsOptions = {
  limit?: number;
  page?: number;
  category?: string;
  pi?: string;
  ic?: string;
  org?: string;
  activity?: string;
  state?: string;
  fyMin?: string;
  fyMax?: string;
  projectTerms?: string[];
  excludeProjectTerms?: string[];
  advancedSearch?: AdvancedSearchQuery | null;
  sortBy?: SearchSortField | "";
  sortOrder?: SearchSortDirection;
  signal?: AbortSignal;
};

export async function searchProjects(
  query: string,
  options: SearchProjectsOptions = {},
): Promise<SearchResponse> {
  const {
    limit = 25,
    page = 1,
    category = "",
    pi = "",
    ic = "",
    org = "",
    activity = "",
    state = "",
    fyMin = "",
    fyMax = "",
    projectTerms = [],
    excludeProjectTerms = [],
    advancedSearch = null,
    sortBy = "",
    sortOrder = "asc",
    signal,
  } = options;
  const url = new URL(`${API_BASE_URL}/search/`);
  const trimmedQ = query.trim();
  if (trimmedQ) {
    url.searchParams.set("q", trimmedQ);
  }
  if (advancedSearch && advancedSearch.clauses.some((clause) => clause.text.trim())) {
    url.searchParams.set(
      "advanced_q",
      JSON.stringify(normalizeAdvancedSearchQuery(advancedSearch)),
    );
  }
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("page", String(page));
  if (category) {
    url.searchParams.set("category", category);
  }
  if (pi) url.searchParams.set("pi", pi);
  if (ic) url.searchParams.set("ic", ic);
  if (org) url.searchParams.set("org", org);
  if (activity) url.searchParams.set("activity", activity);
  if (state) url.searchParams.set("state", state);
  if (fyMin) url.searchParams.set("fy_min", fyMin);
  if (fyMax) url.searchParams.set("fy_max", fyMax);
  for (const term of projectTerms) {
    const trimmed = term.trim();
    if (trimmed) url.searchParams.append("project_terms", trimmed);
  }
  for (const term of excludeProjectTerms) {
    const trimmed = term.trim();
    if (trimmed) url.searchParams.append("exclude_project_terms", trimmed);
  }
  if (sortBy) {
    url.searchParams.set("sort_by", sortBy);
    url.searchParams.set("sort_order", sortOrder);
  }
  const response = await fetch(url.toString(), signal ? { signal } : undefined);
  if (!response.ok) {
    throw new Error(`Search request failed: ${response.status}`);
  }
  return response.json() as Promise<SearchResponse>;
}

function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const match = /filename="?([^";\n]+)"?/i.exec(header);
  return match?.[1]?.trim() ?? null;
}

export async function downloadSearchResultsCsv(
  query: string,
  options: SearchProjectsOptions = {},
): Promise<void> {
  const {
    category = "",
    pi = "",
    ic = "",
    org = "",
    activity = "",
    state = "",
    fyMin = "",
    fyMax = "",
    projectTerms = [],
    excludeProjectTerms = [],
    advancedSearch = null,
  } = options;
  const url = new URL(`${API_BASE_URL}/search/export`);
  const trimmedQ = query.trim();
  if (trimmedQ) {
    url.searchParams.set("q", trimmedQ);
  }
  if (advancedSearch && advancedSearch.clauses.some((clause) => clause.text.trim())) {
    url.searchParams.set("advanced_q", JSON.stringify(normalizeAdvancedSearchQuery(advancedSearch)));
  }
  if (category) url.searchParams.set("category", category);
  if (pi) url.searchParams.set("pi", pi);
  if (ic) url.searchParams.set("ic", ic);
  if (org) url.searchParams.set("org", org);
  if (activity) url.searchParams.set("activity", activity);
  if (state) url.searchParams.set("state", state);
  if (fyMin) url.searchParams.set("fy_min", fyMin);
  if (fyMax) url.searchParams.set("fy_max", fyMax);
  for (const term of projectTerms) {
    const trimmed = term.trim();
    if (trimmed) url.searchParams.append("project_terms", trimmed);
  }
  for (const term of excludeProjectTerms) {
    const trimmed = term.trim();
    if (trimmed) url.searchParams.append("exclude_project_terms", trimmed);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    let detail = `Export failed: ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(detail);
  }

  const blob = await response.blob();
  const filename =
    parseContentDispositionFilename(response.headers.get("Content-Disposition"))
    ?? "search-results.csv";
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function getHealth(): Promise<HealthStatus> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  return response.json() as Promise<HealthStatus>;
}

export async function getProjectById(
  projectId: string,
  signal?: AbortSignal,
): Promise<SearchResultRecord> {
  const response = await fetch(
    `${API_BASE_URL}/search/project/${encodeURIComponent(projectId)}`,
    signal ? { signal } : undefined,
  );
  if (!response.ok) {
    throw new Error(`Project request failed: ${response.status}`);
  }
  const payload = (await response.json()) as ProjectResponse;
  return payload.project;
}

export async function getProjectOtherYears(projectId: string): Promise<ProjectOtherYearsResponse> {
  const response = await fetch(
    `${API_BASE_URL}/search/project/${encodeURIComponent(projectId)}/other-years`,
  );
  if (!response.ok) {
    throw new Error(`Other years request failed: ${response.status}`);
  }
  return response.json() as Promise<ProjectOtherYearsResponse>;
}

export async function getProjectsByInvestigator(
  investigatorName: string,
  options: { limit?: number; page?: number; signal?: AbortSignal } = {},
): Promise<InvestigatorProjectsResponse> {
  const { limit = 25, page = 1, signal } = options;
  const url = new URL(`${API_BASE_URL}/search/investigator/${encodeURIComponent(investigatorName)}`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("page", String(page));
  const response = await fetch(url.toString(), signal ? { signal } : undefined);
  if (!response.ok) {
    throw new Error(`Investigator request failed: ${response.status}`);
  }
  return response.json() as Promise<InvestigatorProjectsResponse>;
}

export async function getProjectsByOrganization(
  organizationName: string,
  options: { limit?: number; page?: number; signal?: AbortSignal } = {},
): Promise<OrganizationProjectsResponse> {
  const { limit = 25, page = 1, signal } = options;
  const url = new URL(`${API_BASE_URL}/search/organization/${encodeURIComponent(organizationName)}`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("page", String(page));
  const response = await fetch(url.toString(), signal ? { signal } : undefined);
  if (!response.ok) {
    throw new Error(`Organization request failed: ${response.status}`);
  }
  return response.json() as Promise<OrganizationProjectsResponse>;
}

export async function getProjectsByInstitution(
  institutionName: string,
  options: { limit?: number; page?: number; signal?: AbortSignal } = {},
): Promise<InstitutionProjectsResponse> {
  const { limit = 25, page = 1, signal } = options;
  const url = new URL(`${API_BASE_URL}/search/institution/${encodeURIComponent(institutionName)}`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("page", String(page));
  const response = await fetch(url.toString(), signal ? { signal } : undefined);
  if (!response.ok) {
    throw new Error(`Institution request failed: ${response.status}`);
  }
  return response.json() as Promise<InstitutionProjectsResponse>;
}

// ─── Analytics dashboard interfaces ─────────────────────────────────────────

export interface StateDataPoint {
  state: string;
  count: number;
  total_funding: number;
}

export interface IcDataPoint {
  label: string;
  value: number;
}

export interface OrgCatalogDataPoint {
  label: string;
  value: number;
}

export interface ActivityDataPoint {
  label: string;
  total_funding: number;
  count: number;
}

/** One slice of activity-code funding (pie API or merged "Other"). */
export interface ActivityPieSlice {
  label: string;
  total_funding: number;
  count: number;
  percent_of_funding: number;
}

/** Funding in activity buckets not drawn as pie slices (when merge_other is false). */
export interface ActivityPieRemainder {
  codes_in_tail: number;
  total_funding: number;
  project_count: number;
  percent_of_all_indexed: number;
}

/** JSON payload for the activity funding pie chart (`GET /analytics/by-activity-funding-pie`). */
export interface ActivityFundingPieResponse {
  total_funding_indexed: number;
  activity_buckets_fetched: number;
  pie_slices_cap: number;
  merge_other: boolean;
  denominator: string;
  slices: ActivityPieSlice[];
  /** Activity codes below `pie_slices` (when merge_other is false). */
  tail_slices: ActivityPieSlice[];
  other: ActivityPieSlice | null;
  remainder: ActivityPieRemainder | null;
  sum_other_doc_count: number;
  more_activities_than_buckets: boolean;
}

/** One bucket for the PROJECT_TERMS theme word cloud (precomputed JSON). */
export interface ThemeBucket {
  label: string;
  weight: number;
}

/** `GET /analytics/project-term-theme-cloud` — from notebook `project_term_theme_counts.json`. */
export interface ProjectTermThemeCloudResponse {
  generated_at: string | null;
  method: string | null;
  low_confidence_cosine?: number | null;
  buckets: ThemeBucket[];
  /** 3-level hierarchy from ``THEME_TAXONOMY``: category → subcategory → terms. */
  tree?: TermNode[];
  source_path?: string;
  message?: string;
}

export interface YearDataPoint {
  year: number;
  count: number;
  total_funding: number;
}

export interface OrgDataPoint {
  label: string;
  total_funding: number;
}

export interface TopFundedProject {
  project_id: string;
  title: string;
  pi_names: string;
  total_funding: number;
  fy?: number;
  fy_has_duplicates?: boolean;
  other_fiscal_years?: number[];
  duplicate_fy_count?: number;
  activity?: string;
  state?: string;
  institute?: string;
  organization?: string;
}

export interface AvgGrantDataPoint {
  label: string;
  avg_grant: number;
}

export interface ActivityTermDataPoint {
  label: string;
  count: number;
  total_funding: number;
}

export interface ActivityTermsResponse {
  activity_id: string;
  limit: number;
  data: ActivityTermDataPoint[];
}

export interface ActivityProjectCompareDataPoint {
  project_id?: string;
  label: string;
  total_funding: number;
  is_selected: boolean;
}

export interface ActivityProjectCompareResponse {
  project_id: string;
  activity_id: string;
  data: ActivityProjectCompareDataPoint[];
}

export interface DashboardSummary {
  total_documents: number;
  total_funding: number;
  unique_ics: number;
  unique_activities: number;
  by_category: AnalyticsCategory[];
  time_series?: unknown[];
}

// ─── Analytics fetch helpers ──────────────────────────────────────────────────

export type AnalyticsFilterOptions = {
  q?: string;
  advancedSearch?: AdvancedSearchQuery | null;
  pi?: string;
  ic?: string;
  org?: string;
  activity?: string;
  state?: string;
  fyMin?: string;
  fyMax?: string;
};

function appendAnalyticsFilters(params: URLSearchParams, filters?: AnalyticsFilterOptions): void {
  if (!filters) return;
  if (filters.q) params.set("q", filters.q);
  if (
    filters.advancedSearch
    && filters.advancedSearch.clauses.some((clause) => clause.text.trim())
  ) {
    params.set("advanced_q", JSON.stringify(filters.advancedSearch));
  }
  if (filters.pi) params.set("pi", filters.pi);
  if (filters.ic) params.set("ic", filters.ic);
  if (filters.org) params.set("org", filters.org);
  if (filters.activity) params.set("activity", filters.activity);
  if (filters.state) params.set("state", filters.state);
  if (filters.fyMin) params.set("fy_min", filters.fyMin);
  if (filters.fyMax) params.set("fy_max", filters.fyMax);
}

async function fetchAnalytics<T>(
  path: string,
  filters?: AnalyticsFilterOptions,
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`);
  appendAnalyticsFilters(url.searchParams, filters);
  const response = await fetch(url.toString(), signal ? { signal } : undefined);
  if (!response.ok) {
    throw new Error(`Analytics request failed (${path}): ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getStateData(
  filters?: AnalyticsFilterOptions,
  signal?: AbortSignal,
): Promise<StateDataPoint[]> {
  return fetchAnalytics<StateDataPoint[]>("/analytics/by-state", filters, signal);
}

export function getOrgData(options?: {
  limit?: number;
  /** Indexed awards per org; default 500 for the filter dropdown (~180 orgs). */
  minProjects?: number;
  filters?: AnalyticsFilterOptions;
  signal?: AbortSignal;
}): Promise<OrgCatalogDataPoint[]> {
  const params = new URLSearchParams();
  params.set("limit", String(options?.limit ?? 200));
  params.set("min_projects", String(options?.minProjects ?? 500));
  appendAnalyticsFilters(params, options?.filters);
  const qs = params.toString();
  const path = qs ? `/analytics/by-org?${qs}` : "/analytics/by-org";
  return fetchAnalytics<OrgCatalogDataPoint[]>(path, undefined, options?.signal);
}

export function getIcData(
  fy?: number,
  filters?: AnalyticsFilterOptions,
  signal?: AbortSignal,
): Promise<IcDataPoint[]> {
  const params = new URLSearchParams();
  if (fy != null) {
    params.set("fy", String(fy));
  }
  appendAnalyticsFilters(params, filters);
  const qs = params.toString();
  const path = qs ? `/analytics/by-ic?${qs}` : "/analytics/by-ic";
  return fetchAnalytics<IcDataPoint[]>(path, undefined, signal);
}

export function getActivityData(
  limit = 50,
  filters?: AnalyticsFilterOptions,
  signal?: AbortSignal,
): Promise<ActivityDataPoint[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  appendAnalyticsFilters(params, filters);
  return fetchAnalytics<ActivityDataPoint[]>(`/analytics/by-activity?${params.toString()}`, undefined, signal);
}

export function getActivityFundingPie(
  options?: {
    limit?: number;
    pieSlices?: number;
    mergeOther?: boolean;
  },
  filters?: AnalyticsFilterOptions,
  signal?: AbortSignal,
): Promise<ActivityFundingPieResponse> {
  const params = new URLSearchParams();
  if (options?.limit != null) {
    params.set("limit", String(options.limit));
  }
  if (options?.pieSlices != null) {
    params.set("pie_slices", String(options.pieSlices));
  }
  if (options?.mergeOther != null) {
    params.set("merge_other", options.mergeOther ? "true" : "false");
  }
  appendAnalyticsFilters(params, filters);
  const qs = params.toString();
  const path = qs ? `/analytics/by-activity-funding-pie?${qs}` : "/analytics/by-activity-funding-pie";
  return fetchAnalytics<ActivityFundingPieResponse>(path, undefined, signal);
}

export function getProjectTermThemeCloud(signal?: AbortSignal): Promise<ProjectTermThemeCloudResponse> {
  return fetchAnalytics<ProjectTermThemeCloudResponse>("/analytics/project-term-theme-cloud", undefined, signal);
}

export interface TermNode {
  id: string;
  label: string;
  weight?: number;
  children?: TermNode[];
}

export function getYearData(
  filters?: AnalyticsFilterOptions,
  signal?: AbortSignal,
): Promise<YearDataPoint[]> {
  return fetchAnalytics<YearDataPoint[]>("/analytics/by-year", filters, signal);
}

export function getTopOrgs(
  limit = 15,
  filters?: AnalyticsFilterOptions,
  signal?: AbortSignal,
): Promise<OrgDataPoint[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  appendAnalyticsFilters(params, filters);
  return fetchAnalytics<OrgDataPoint[]>(`/analytics/top-orgs?${params.toString()}`, undefined, signal);
}

export function getTopFundedProjects(
  filters?: AnalyticsFilterOptions,
  signal?: AbortSignal,
): Promise<TopFundedProject[]> {
  return fetchAnalytics<TopFundedProject[]>("/analytics/top-funded-projects", filters, signal);
}

export function getAvgGrantByIc(
  filters?: AnalyticsFilterOptions,
  signal?: AbortSignal,
): Promise<AvgGrantDataPoint[]> {
  return fetchAnalytics<AvgGrantDataPoint[]>("/analytics/avg-grant-by-ic", filters, signal);
}

export function getDashboardSummary(
  filters?: AnalyticsFilterOptions,
  signal?: AbortSignal,
): Promise<DashboardSummary> {
  return fetchAnalytics<DashboardSummary>("/analytics/summary", filters, signal);
}

export function getActivityTermsData(
  activityId: string,
  limit = 15,
): Promise<ActivityTermsResponse> {
  const encodedId = encodeURIComponent(activityId);
  return fetchAnalytics<ActivityTermsResponse>(
    `/analytics/by-activity-terms?activity_id=${encodedId}&limit=${limit}`,
  );
}

export function getActivityProjectCompareData(
  projectId: string,
  activityId: string,
  limit = 20,
): Promise<ActivityProjectCompareResponse> {
  const encodedProjectId = encodeURIComponent(projectId);
  const encodedActivityId = encodeURIComponent(activityId);
  return fetchAnalytics<ActivityProjectCompareResponse>(
    `/analytics/by-activity-project-compare?project_id=${encodedProjectId}&activity_id=${encodedActivityId}&limit=${limit}`,
  );
}

// ─── Vector / semantic search (k-NN + hybrid) ─────────────────────────────────

export interface SimilarSearchResponse {
  query: string;
  k: number;
  results: SearchResultRecord[];
}

export interface SimilarToProjectResponse {
  project_id: string;
  k: number;
  results: SearchResultRecord[];
}

export interface HybridSearchResponse {
  query: string;
  k: number;
  keyword_total: number;
  keyword_returned: number;
  vector_returned: number;
  fetch_size_per_side: number;
  results: SearchResultRecord[];
}

export type HybridSearchOptions = {
  k?: number;
  category?: string;
  pi?: string;
  ic?: string;
  org?: string;
  activity?: string;
  state?: string;
  fyMin?: string;
  fyMax?: string;
};

async function readErrorDetail(response: Response): Promise<string> {
  let detail = `Request failed (${response.status})`;
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") {
      detail = body.detail;
    }
  } catch {
    /* ignore */
  }
  return detail;
}

export async function searchSimilarByText(
  query: string,
  k = 10,
  signal?: AbortSignal,
): Promise<SimilarSearchResponse> {
  const url = new URL(`${API_BASE_URL}/search/similar`);
  url.searchParams.set("q", query);
  url.searchParams.set("k", String(k));
  const response = await fetch(url.toString(), signal ? { signal } : undefined);
  if (!response.ok) {
    throw new Error(await readErrorDetail(response));
  }
  return response.json() as Promise<SimilarSearchResponse>;
}

export async function searchSimilarToProjectId(
  projectId: string,
  k = 10,
  signal?: AbortSignal,
): Promise<SimilarToProjectResponse> {
  const url = new URL(`${API_BASE_URL}/search/similar/${encodeURIComponent(projectId)}`);
  url.searchParams.set("k", String(k));
  const response = await fetch(url.toString(), signal ? { signal } : undefined);
  if (!response.ok) {
    throw new Error(await readErrorDetail(response));
  }
  return response.json() as Promise<SimilarToProjectResponse>;
}

export async function searchHybrid(
  query: string,
  options: HybridSearchOptions = {},
): Promise<HybridSearchResponse> {
  const {
    k = 10,
    category = "",
    pi = "",
    ic = "",
    org = "",
    activity = "",
    state = "",
    fyMin = "",
    fyMax = "",
  } = options;
  const url = new URL(`${API_BASE_URL}/search/hybrid`);
  url.searchParams.set("q", query);
  url.searchParams.set("k", String(k));
  if (category) url.searchParams.set("category", category);
  if (pi) url.searchParams.set("pi", pi);
  if (ic) url.searchParams.set("ic", ic);
  if (org) url.searchParams.set("org", org);
  if (activity) url.searchParams.set("activity", activity);
  if (state) url.searchParams.set("state", state);
  if (fyMin) url.searchParams.set("fy_min", fyMin);
  if (fyMax) url.searchParams.set("fy_max", fyMax);
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(await readErrorDetail(response));
  }
  return response.json() as Promise<HybridSearchResponse>;
}
