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
    const term = clause.negated ? `NOT (${clause.text})` : `(${clause.text})`;
    if (index === 0) {
      parts.push(term);
      return;
    }
    const operator = (normalized.operators[index - 1] ?? "and").toUpperCase();
    parts.push(`${operator} ${term}`);
  });
  return parts.join(" ");
}

export type ParsedUnifiedSearch = {
  advanced: AdvancedSearchQuery | null;
  plainQ: string;
};

export function parseUnifiedSearch(input: string): ParsedUnifiedSearch {
  let remaining = input.trim();
  const clauses: AdvancedSearchClause[] = [];
  const operators: AdvancedSearchOperator[] = [];

  while (remaining.length > 0) {
    let negated = false;
    if (/^NOT\s+/i.test(remaining)) {
      negated = true;
      remaining = remaining.replace(/^NOT\s+/i, "").trim();
    }

    const parenMatch = remaining.match(/^\(([^)]*)\)/);
    if (!parenMatch) {
      break;
    }

    const text = parenMatch[1].trim();
    if (text) {
      clauses.push({ text, negated });
    }
    remaining = remaining.slice(parenMatch[0].length).trim();

    if (remaining.length === 0) {
      break;
    }

    const opMatch = remaining.match(/^(AND|OR)\s+/i);
    if (opMatch) {
      operators.push(opMatch[1].toLowerCase() as AdvancedSearchOperator);
      remaining = remaining.slice(opMatch[0].length).trim();
    } else {
      break;
    }
  }

  const plainQ = remaining.trim();
  if (clauses.length === 0) {
    return { advanced: null, plainQ };
  }

  const advanced = normalizeAdvancedSearchQuery({ clauses, operators });
  return {
    advanced: hasAdvancedSearchContent(advanced) ? advanced : null,
    plainQ,
  };
}

export function composeUnifiedSearch(
  advanced: AdvancedSearchQuery | null,
  plainQ: string,
): string {
  const parts: string[] = [];
  if (advanced && hasAdvancedSearchContent(advanced)) {
    parts.push(formatAdvancedSearchQuery(advanced));
  }
  const plain = plainQ.trim();
  if (plain) {
    parts.push(plain);
  }
  return parts.join(" ");
}

export function normalizeUnifiedSearch(input: string): string {
  const { advanced, plainQ } = parseUnifiedSearch(input);
  return composeUnifiedSearch(advanced, plainQ);
}

export function hasUnifiedAdvancedContent(input: string): boolean {
  return parseUnifiedSearch(input).advanced != null;
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
