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
  limit: number;
  total: number;
  visible_total?: number;
  results: SearchResultRecord[];
}

export interface ProjectResponse {
  project: SearchResultRecord;
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
  ic?: string;
  activity?: string;
  state?: string;
  fyMin?: string;
  fyMax?: string;
  costMin?: string;
  costMax?: string;
};

export async function searchProjects(
  query: string,
  options: SearchProjectsOptions = {},
): Promise<SearchResponse> {
  const {
    limit = 25,
    page = 1,
    category = "",
    ic = "",
    activity = "",
    state = "",
    fyMin = "",
    fyMax = "",
    costMin = "",
    costMax = "",
  } = options;
  const url = new URL(`${API_BASE_URL}/search/`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("page", String(page));
  if (category) {
    url.searchParams.set("category", category);
  }
  if (ic) url.searchParams.set("ic", ic);
  if (activity) url.searchParams.set("activity", activity);
  if (state) url.searchParams.set("state", state);
  if (fyMin) url.searchParams.set("fy_min", fyMin);
  if (fyMax) url.searchParams.set("fy_max", fyMax);
  if (costMin) url.searchParams.set("cost_min", costMin);
  if (costMax) url.searchParams.set("cost_max", costMax);
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

export function getIcData(): Promise<IcDataPoint[]> {
  return fetchAnalytics<IcDataPoint[]>("/analytics/by-ic");
}

export function getActivityData(): Promise<ActivityDataPoint[]> {
  return fetchAnalytics<ActivityDataPoint[]>("/analytics/by-activity");
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
