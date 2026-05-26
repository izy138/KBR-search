import type { SearchSortDirection, SearchSortField } from "../api";
import type { AdvancedSearchQuery } from "../types/advancedSearch";
import {
  composeUnifiedSearch,
  hasAdvancedSearchContent,
  normalizeAdvancedSearchQuery,
  parseUnifiedSearch,
} from "./advancedSearch";
import type { SortState as ResultsSortState } from "../components/search/ResultsList";

export type SortOption = "relevant" | "alphaAsc" | "alphaDesc";

export type ParsedSearchUrl = {
  q: string;
  advancedSearch: AdvancedSearchQuery | null;
  page: number;
  limit: number;
  pi: string;
  ic: string;
  org: string;
  activity: string;
  state: string;
  fyMin: string;
  fyMax: string;
  projectTerms: string[];
  sortBy: SearchSortField | "";
  sortOrder: SearchSortDirection;
  sortOption: SortOption;
  columnSort: ResultsSortState;
  semantic: boolean;
};

const DEFAULT_LIMIT = 25;
const VALID_SORT_FIELDS = new Set<SearchSortField>([
  "PI_NAMEs",
  "ORG_NAME",
  "IC_NAME",
  "ORG_STATE",
  "ACTIVITY",
  "PROJECT_TITLE",
  "FY",
  "TOTAL_COST",
]);

const COLUMN_SORT_FIELDS = new Set<SearchSortField>([
  "PI_NAMEs",
  "ORG_NAME",
  "IC_NAME",
  "ORG_STATE",
  "ACTIVITY",
  "FY",
  "TOTAL_COST",
]);

export function isSearchPath(pathname: string): boolean {
  return pathname === "/search" || pathname === "/search/";
}

export function isDashboardPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/dashboard" || pathname === "/dashboard/";
}

function parseAdvancedSearch(raw: string | null): AdvancedSearchQuery | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as AdvancedSearchQuery;
    if (!parsed || !Array.isArray(parsed.clauses)) return null;
    const normalized = normalizeAdvancedSearchQuery(parsed);
    return hasAdvancedSearchContent(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sortUiFromApi(
  sortBy: SearchSortField | "",
  sortOrder: SearchSortDirection,
): Pick<ParsedSearchUrl, "sortOption" | "columnSort"> {
  if (!sortBy) {
    return { sortOption: "relevant", columnSort: { column: null, direction: "none" } };
  }
  if (sortBy === "PROJECT_TITLE" && sortOrder === "asc") {
    return { sortOption: "alphaAsc", columnSort: { column: null, direction: "none" } };
  }
  if (sortBy === "PROJECT_TITLE" && sortOrder === "desc") {
    return { sortOption: "alphaDesc", columnSort: { column: null, direction: "none" } };
  }
  if (COLUMN_SORT_FIELDS.has(sortBy)) {
    return {
      sortOption: "relevant",
      columnSort: {
        column: sortBy as ResultsSortState["column"],
        direction: sortOrder === "desc" ? "desc" : "asc",
      },
    };
  }
  return { sortOption: "relevant", columnSort: { column: null, direction: "none" } };
}

export function parseSearchUrlParams(params: URLSearchParams): ParsedSearchUrl {
  const sortByRaw = params.get("sort_by") ?? "";
  const sortBy = VALID_SORT_FIELDS.has(sortByRaw as SearchSortField)
    ? (sortByRaw as SearchSortField)
    : "";
  const sortOrder: SearchSortDirection = params.get("sort_order") === "desc" ? "desc" : "asc";
  const { sortOption, columnSort } = sortUiFromApi(sortBy, sortOrder);

  return {
    q: params.get("q") ?? "",
    advancedSearch: parseAdvancedSearch(params.get("advanced_q")),
    page: parsePositiveInt(params.get("page"), 1),
    limit: parsePositiveInt(params.get("limit"), DEFAULT_LIMIT),
    pi: params.get("pi") ?? "",
    ic: params.get("ic") ?? "",
    org: params.get("org") ?? "",
    activity: params.get("activity") ?? "",
    state: params.get("state") ?? "",
    fyMin: params.get("fy_min") ?? "",
    fyMax: params.get("fy_max") ?? "",
    projectTerms: params
      .getAll("project_terms")
      .map((term) => term.trim())
      .filter((term) => term.length > 0),
    sortBy,
    sortOrder,
    sortOption,
    columnSort,
    semantic: params.get("semantic") === "1",
  };
}

export type SearchUrlWriteInput = {
  /** Unified search bar text (parenthesized advanced terms + plain keywords). */
  q: string;
  page: number;
  limit: number;
  pi: string;
  ic: string;
  org: string;
  activity: string;
  state: string;
  fyMin: string;
  fyMax: string;
  projectTerms: string[];
  sortBy: SearchSortField | "";
  sortOrder: SearchSortDirection;
  semantic: boolean;
};

export type DashboardUrlWriteInput = {
  q: string;
  pi: string;
  ic: string;
  org: string;
  activity: string;
  state: string;
  fyMin: string;
  fyMax: string;
  semantic: boolean;
};

export function buildDashboardUrlParams(input: DashboardUrlWriteInput): URLSearchParams {
  const params = new URLSearchParams();
  const { plainQ, advanced } = parseUnifiedSearch(input.q);

  if (advanced && hasAdvancedSearchContent(advanced)) {
    params.set("advanced_q", JSON.stringify(normalizeAdvancedSearchQuery(advanced)));
  }
  const trimmedPlain = plainQ.trim();
  if (trimmedPlain) {
    params.set("q", trimmedPlain);
  }

  if (input.pi) params.set("pi", input.pi);
  if (input.ic) params.set("ic", input.ic);
  if (input.org) params.set("org", input.org);
  if (input.activity) params.set("activity", input.activity);
  if (input.state) params.set("state", input.state);
  if (input.fyMin) params.set("fy_min", input.fyMin);
  if (input.fyMax) params.set("fy_max", input.fyMax);

  if (input.semantic) params.set("semantic", "1");

  return params;
}

export function buildSearchUrlParams(input: SearchUrlWriteInput): URLSearchParams {
  const params = new URLSearchParams();
  const { plainQ, advanced } = parseUnifiedSearch(input.q);

  if (advanced && hasAdvancedSearchContent(advanced)) {
    params.set("advanced_q", JSON.stringify(normalizeAdvancedSearchQuery(advanced)));
  }
  const trimmedPlain = plainQ.trim();
  if (trimmedPlain) {
    params.set("q", trimmedPlain);
  }

  if (input.page > 1) params.set("page", String(input.page));
  if (input.limit !== DEFAULT_LIMIT) params.set("limit", String(input.limit));

  if (input.pi) params.set("pi", input.pi);
  if (input.ic) params.set("ic", input.ic);
  if (input.org) params.set("org", input.org);
  if (input.activity) params.set("activity", input.activity);
  if (input.state) params.set("state", input.state);
  if (input.fyMin) params.set("fy_min", input.fyMin);
  if (input.fyMax) params.set("fy_max", input.fyMax);

  for (const term of input.projectTerms) {
    const trimmed = term.trim();
    if (trimmed) params.append("project_terms", trimmed);
  }

  if (input.sortBy) {
    params.set("sort_by", input.sortBy);
    params.set("sort_order", input.sortOrder);
  }

  if (input.semantic) params.set("semantic", "1");

  return params;
}

export function searchParamsToString(params: URLSearchParams): string {
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export function unifiedSearchFromParsed(parsed: Pick<ParsedSearchUrl, "q" | "advancedSearch">): string {
  return composeUnifiedSearch(parsed.advancedSearch, parsed.q);
}

export function searchLocationsEqual(a: string, b: string): boolean {
  const normalize = (search: string) => {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    return params.toString();
  };
  return normalize(a) === normalize(b);
}
