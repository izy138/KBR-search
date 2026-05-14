const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export interface SearchResultRecord {
  _id?: string;
  id?: string;
  // Core CSV fields
  APPLICATION_ID?: number;
  PROJECT_TITLE?: string;
  ACTIVITY?: string;
  IC_NAME?: string;
  ORG_NAME?: string;
  ORG_STATE?: string;
  ORG_CITY?: string;
  ORG_ZIPCODE?: string;
  ORG_COUNTRY?: string;
  FY?: number;
  TOTAL_COST?: number;
  DIRECT_COST_AMT?: number;
  INDIRECT_COST_AMT?: number;
  PI_NAMEs?: string;
  STUDY_SECTION_NAME?: string;
  PROJECT_START?: string;
  PROJECT_END?: string;
  PROJECT_TERMS?: string;
  ABSTRACT_TEXT?: string;
  PROJECT_ABSTRACT?: string;
  // Lowercase aliases accessed by display logic in App.tsx
  title?: string;
  project_title?: string;
  abstract?: string;
  category?: string;
  [key: string]: unknown;
}

export interface SearchResponse {
  query: string;
  project_terms?: string[];
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

export interface AnalyticsCategory {
  label: string;
  value: number;
}

export interface AnalyticsSummary {
  total_documents: number;
  by_category: AnalyticsCategory[];
  time_series: unknown[];
}

export interface HealthStatus {
  status: string;
  opensearch: string;
}

export type SearchProjectsOptions = {
  limit?: number;
  page?: number;
  category?: string;
  pi?: string;
  ic?: string;
  activity?: string;
  state?: string;
  fyMin?: string;
  fyMax?: string;
  projectTerms?: string[];
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
    activity = "",
    state = "",
    fyMin = "",
    fyMax = "",
    projectTerms = [],
  } = options;
  const url = new URL(`${API_BASE_URL}/search/`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("page", String(page));
  if (category) {
    url.searchParams.set("category", category);
  }
  if (pi) url.searchParams.set("pi", pi);
  if (ic) url.searchParams.set("ic", ic);
  if (activity) url.searchParams.set("activity", activity);
  if (state) url.searchParams.set("state", state);
  if (fyMin) url.searchParams.set("fy_min", fyMin);
  if (fyMax) url.searchParams.set("fy_max", fyMax);
  for (const term of projectTerms) {
    const trimmed = term.trim();
    if (trimmed) url.searchParams.append("project_terms", trimmed);
  }
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Search request failed: ${response.status}`);
  }
  return response.json() as Promise<SearchResponse>;
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const response = await fetch(`${API_BASE_URL}/analytics/summary`);
  if (!response.ok) {
    throw new Error(`Analytics request failed: ${response.status}`);
  }
  return response.json() as Promise<AnalyticsSummary>;
}

export async function getHealth(): Promise<HealthStatus> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }
  return response.json() as Promise<HealthStatus>;
}

export async function getProjectById(projectId: string): Promise<SearchResultRecord> {
  const response = await fetch(`${API_BASE_URL}/search/project/${encodeURIComponent(projectId)}`);
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
  options: { limit?: number; page?: number } = {},
): Promise<InvestigatorProjectsResponse> {
  const { limit = 25, page = 1 } = options;
  const url = new URL(`${API_BASE_URL}/search/investigator/${encodeURIComponent(investigatorName)}`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("page", String(page));
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Investigator request failed: ${response.status}`);
  }
  return response.json() as Promise<InvestigatorProjectsResponse>;
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
  time_series: unknown[];
}

// ─── Analytics fetch helpers ──────────────────────────────────────────────────

async function fetchAnalytics<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Analytics request failed (${path}): ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getStateData(): Promise<StateDataPoint[]> {
  return fetchAnalytics<StateDataPoint[]>("/analytics/by-state");
}

export function getIcData(fy?: number): Promise<IcDataPoint[]> {
  const path =
    fy != null
      ? `/analytics/by-ic?fy=${encodeURIComponent(String(fy))}`
      : "/analytics/by-ic";
  return fetchAnalytics<IcDataPoint[]>(path);
}

export function getActivityData(limit = 50): Promise<ActivityDataPoint[]> {
  const q = new URLSearchParams({ limit: String(limit) });
  return fetchAnalytics<ActivityDataPoint[]>(`/analytics/by-activity?${q.toString()}`);
}

export function getActivityFundingPie(options?: {
  limit?: number;
  pieSlices?: number;
  mergeOther?: boolean;
}): Promise<ActivityFundingPieResponse> {
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
  const qs = params.toString();
  const path = qs ? `/analytics/by-activity-funding-pie?${qs}` : "/analytics/by-activity-funding-pie";
  return fetchAnalytics<ActivityFundingPieResponse>(path);
}

export function getProjectTermThemeCloud(): Promise<ProjectTermThemeCloudResponse> {
  return fetchAnalytics<ProjectTermThemeCloudResponse>("/analytics/project-term-theme-cloud");
}

export function getYearData(): Promise<YearDataPoint[]> {
  return fetchAnalytics<YearDataPoint[]>("/analytics/by-year");
}

export function getTopOrgs(): Promise<OrgDataPoint[]> {
  return fetchAnalytics<OrgDataPoint[]>("/analytics/top-orgs");
}

export function getAvgGrantByIc(): Promise<AvgGrantDataPoint[]> {
  return fetchAnalytics<AvgGrantDataPoint[]>("/analytics/avg-grant-by-ic");
}

export function getDashboardSummary(): Promise<DashboardSummary> {
  return fetchAnalytics<DashboardSummary>("/analytics/summary");
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

export async function searchSimilarByText(query: string, k = 10): Promise<SimilarSearchResponse> {
  const url = new URL(`${API_BASE_URL}/search/similar`);
  url.searchParams.set("q", query);
  url.searchParams.set("k", String(k));
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(await readErrorDetail(response));
  }
  return response.json() as Promise<SimilarSearchResponse>;
}

export async function searchSimilarToProjectId(
  projectId: string,
  k = 10,
): Promise<SimilarToProjectResponse> {
  const url = new URL(`${API_BASE_URL}/search/similar/${encodeURIComponent(projectId)}`);
  url.searchParams.set("k", String(k));
  const response = await fetch(url.toString());
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
