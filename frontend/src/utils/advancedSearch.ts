import type {
  AdvancedSearchClause,
  AdvancedSearchOperator,
  AdvancedSearchQuery,
} from "../types/advancedSearch";

export const ADVANCED_SEARCH_MAX_CLAUSES = 8;
export const ADVANCED_SEARCH_DEFAULT_ROW_COUNT = 2;

export function createDefaultAdvancedSearchQuery(
  seedText = "",
): AdvancedSearchQuery {
  const clauses: AdvancedSearchClause[] = Array.from(
    { length: ADVANCED_SEARCH_DEFAULT_ROW_COUNT },
    (_, index) => ({
      text: index === 0 ? seedText : "",
      negated: false,
    }),
  );
  return {
    clauses,
    operators: Array.from(
      { length: clauses.length - 1 },
      () => "and" as AdvancedSearchOperator,
    ),
  };
}

export function normalizeAdvancedSearchQuery(
  query: AdvancedSearchQuery,
): AdvancedSearchQuery {
  const clauses = query.clauses
    .map((clause) => ({
      text: clause.text.trim(),
      negated: clause.negated,
    }))
    .filter((clause) => clause.text.length > 0);
  if (clauses.length === 0) {
    return createDefaultAdvancedSearchQuery();
  }
  const operators = query.operators
    .slice(0, Math.max(0, clauses.length - 1))
    .map((op) => (op === "or" ? "or" : "and"));
  while (operators.length < clauses.length - 1) {
    operators.push("and");
  }
  return { clauses, operators };
}

export function hasAdvancedSearchContent(query: AdvancedSearchQuery): boolean {
  return query.clauses.some((clause) => clause.text.trim().length > 0);
}

export function formatAdvancedSearchQuery(query: AdvancedSearchQuery): string {
  const normalized = normalizeAdvancedSearchQuery(query);
  const parts: string[] = [];
  normalized.clauses.forEach((clause, index) => {
    const term = clause.negated ? `NOT ${clause.text}` : clause.text;
    if (index === 0) {
      parts.push(term);
      return;
    }
    const operator = (normalized.operators[index - 1] ?? "and").toUpperCase();
    parts.push(`${operator} ${term}`);
  });
  return parts.join(" ");
}

export function addAdvancedSearchRow(query: AdvancedSearchQuery): AdvancedSearchQuery {
  if (query.clauses.length >= ADVANCED_SEARCH_MAX_CLAUSES) {
    return query;
  }
  return {
    clauses: [...query.clauses, { text: "", negated: false }],
    operators: [...query.operators, "and"],
  };
}

export function removeAdvancedSearchRow(
  query: AdvancedSearchQuery,
  index: number,
): AdvancedSearchQuery {
  if (query.clauses.length <= 1) {
    return query;
  }
  const clauses = query.clauses.filter((_, rowIndex) => rowIndex !== index);
  const operators = query.operators.filter((_, opIndex) => {
    if (opIndex === index - 1 || opIndex === index) {
      return false;
    }
    return true;
  });
  while (operators.length < clauses.length - 1) {
    operators.push("and");
  }
  return { clauses, operators };
}
