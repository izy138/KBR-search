import { type FC, useEffect, useState } from "react";
import type {
  AdvancedSearchOperator,
  AdvancedSearchQuery,
} from "../../types/advancedSearch";
import {
  ADVANCED_SEARCH_MAX_CLAUSES,
  addAdvancedSearchRow,
  hasAdvancedSearchContent,
  normalizeAdvancedSearchQuery,
  removeAdvancedSearchRow,
} from "../../utils/advancedSearch";
import { cn } from "../../utils/cn";

type AdvancedSearchModalProps = {
  open: boolean;
  initialQuery: AdvancedSearchQuery;
  onClose: () => void;
  onSubmit: (query: AdvancedSearchQuery) => void;
};

const OPERATOR_OPTIONS: { value: AdvancedSearchOperator; label: string }[] = [
  { value: "and", label: "AND" },
  { value: "or", label: "OR" },
];

const AdvancedSearchModal: FC<AdvancedSearchModalProps> = ({
  open,
  initialQuery,
  onClose,
  onSubmit,
}) => {
  const [draft, setDraft] = useState<AdvancedSearchQuery>(initialQuery);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft(initialQuery);
    setError("");
  }, [open, initialQuery]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasAdvancedSearchContent(draft)) {
      setError("Enter at least one search term.");
      return;
    }
    onSubmit(normalizeAdvancedSearchQuery(draft));
    onClose();
  };

  const updateClauseText = (index: number, text: string) => {
    setDraft((current) => ({
      ...current,
      clauses: current.clauses.map((clause, clauseIndex) =>
        clauseIndex === index ? { ...clause, text } : clause,
      ),
    }));
    setError("");
  };

  const updateClauseNegated = (index: number, negated: boolean) => {
    setDraft((current) => ({
      ...current,
      clauses: current.clauses.map((clause, clauseIndex) =>
        clauseIndex === index ? { ...clause, negated } : clause,
      ),
    }));
  };

  const updateOperator = (index: number, operator: AdvancedSearchOperator) => {
    setDraft((current) => ({
      ...current,
      operators: current.operators.map((value, operatorIndex) =>
        operatorIndex === index ? operator : value,
      ),
    }));
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-8"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="advanced-search-title"
          className="w-full max-w-[640px] rounded-lg border border-border bg-surface p-4 shadow-md"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 id="advanced-search-title" className="font-sans text-[17px] font-semibold text-text-primary">
                Advanced search
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                Combine multiple terms with AND, OR, and NOT. Terms match title, PI, keywords, and organization fields.
              </p>
            </div>
            <button
              type="button"
              className="cursor-pointer rounded-sm border-none bg-transparent px-1 text-[22px] leading-none text-text-muted hover:text-text-primary"
              aria-label="Close advanced search"
              onClick={onClose}
            >
              ×
            </button>
          </div>

          <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              {draft.clauses.map((clause, index) => {
                const operatorsMuted = clause.negated && index > 0;
                return (
                <div key={`advanced-clause-${index}`} className="flex items-center gap-2.5">
                  <div className="flex w-[96px] shrink-0 justify-end">
                    {index > 0 ? (
                      <div
                        className={cn(
                          "inline-flex w-[96px] overflow-hidden rounded-sm border border-border transition-opacity duration-150",
                          operatorsMuted && "opacity-50",
                        )}
                      >
                        {OPERATOR_OPTIONS.map((option) => (
                          <button
                            key={`${index}-${option.value}`}
                            type="button"
                            disabled={operatorsMuted}
                            className={cn(
                              "flex min-h-[2.5rem] flex-1 items-center justify-center border-none px-0 py-2 font-sans text-sm font-semibold leading-none transition-colors duration-150",
                              operatorsMuted
                                ? "cursor-not-allowed bg-surface text-text-muted"
                                : cn(
                                    "cursor-pointer",
                                    (draft.operators[index - 1] ?? "and") === option.value
                                      ? "bg-accent text-white"
                                      : "bg-bg text-text-secondary hover:bg-surface-hover hover:text-text-primary",
                                  ),
                            )}
                            onClick={() => updateOperator(index - 1, option.value)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="sr-only">First search term</span>
                    )}
                  </div>
                  <label className="flex min-h-[2.5rem] w-[68px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-sm border border-border bg-bg px-2.5 py-2 font-sans text-sm font-medium text-text-secondary transition-colors duration-150 hover:border-border-strong hover:bg-surface-hover">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-accent"
                      checked={clause.negated}
                      onChange={(event) => updateClauseNegated(index, event.target.checked)}
                    />
                    NOT
                  </label>
                  <input
                    type="text"
                    className="min-w-0 flex-1 rounded-sm border border-border bg-bg px-3 py-2 font-sans text-sm text-text-primary outline-none transition-[border-color] duration-150 placeholder:text-text-muted focus:border-accent"
                    placeholder={`Search term ${index + 1}`}
                    value={clause.text}
                    onChange={(event) => updateClauseText(index, event.target.value)}
                  />
                  {draft.clauses.length > 1 ? (
                    <button
                      type="button"
                      className="shrink-0 cursor-pointer rounded-sm border border-border bg-bg px-2 py-1 font-sans text-xs text-text-secondary transition-colors duration-150 hover:border-border-strong hover:text-text-primary"
                      onClick={() => setDraft((current) => removeAdvancedSearchRow(current, index))}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                );
              })}
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                className="cursor-pointer rounded-sm border border-border bg-bg px-3 py-1.5 font-sans text-sm text-text-secondary transition-colors duration-150 hover:border-border-strong hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                disabled={draft.clauses.length >= ADVANCED_SEARCH_MAX_CLAUSES}
                onClick={() => setDraft((current) => addAdvancedSearchRow(current))}
              >
                Add search term
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="cursor-pointer rounded-sm border border-border bg-bg px-3 py-1.5 font-sans text-sm text-text-secondary transition-colors duration-150 hover:border-border-strong hover:text-text-primary"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cursor-pointer rounded-sm border-none bg-accent px-4 py-1.5 font-sans text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover"
                >
                  Search
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
  );
};

export default AdvancedSearchModal;
