export type AdvancedSearchOperator = "and" | "or";

export type AdvancedSearchClause = {
  text: string;
  negated: boolean;
};

export type AdvancedSearchQuery = {
  clauses: AdvancedSearchClause[];
  operators: AdvancedSearchOperator[];
};
