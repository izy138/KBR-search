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
  FY?: number;
  TOTAL_COST?: number;
  DIRECT_COST_AMT?: number;
  INDIRECT_COST_AMT?: number;
  PI_NAMEs?: string;
  STUDY_SECTION_NAME?: string;
  PROJECT_START?: string;
  PROJECT_END?: string;
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
