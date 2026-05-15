import { useEffect, useState } from "react";
import { getTermTree, type TermNode } from "../api";

/** Maximum number of leaf terms a user may select at once. */
const MAX_SELECTION = 20;

type TermCloudProps = {
  onSearch: (terms: string[]) => void;
};

/**
 * Recursively counts how many of a node's descendants (including itself if it
 * is a leaf) are present in `selected`.
 */
function countSelectedDescendants(node: TermNode, selected: Set<string>): number {
  if (!node.children) return selected.has(node.label) ? 1 : 0;
  return node.children.reduce(
    (sum, child) => sum + countSelectedDescendants(child, selected),
    0,
  );
}

/**
 * Immutably toggles a string value in a Set-based state slice, producing a new
 * Set instance so React detects the change.
 */
function toggleInSet(
  setState: React.Dispatch<React.SetStateAction<Set<string>>>,
  value: string,
): void {
  setState((prev) => {
    const next = new Set(prev);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    return next;
  });
}

/**
 * TermCloud — collapsible hierarchical browser for NIH project terms.
 *
 * Three-level hierarchy: Category → Subcategory → Leaf term.
 * Selected leaf labels are passed to `onSearch` as `project_terms` filter values.
 */
export default function TermCloud({ onSearch }: TermCloudProps): React.ReactElement {
  const [tree, setTree] = useState<TermNode[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [collapsed, setCollapsed] = useState<boolean>(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSubcats, setExpandedSubcats] = useState<Set<string>>(new Set());
  const [selectedTerms, setSelectedTerms] = useState<Set<string>>(new Set());
  const [showMaxWarning, setShowMaxWarning] = useState<boolean>(false);

  useEffect(() => {
    setLoading(true);
    getTermTree()
      .then((data) => {
        setTree(data);
        setError("");
      })
      .catch(() => {
        setError("Could not load research terms.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleToggleLeaf = (label: string): void => {
    if (!selectedTerms.has(label) && selectedTerms.size >= MAX_SELECTION) {
      setShowMaxWarning(true);
      return;
    }
    setShowMaxWarning(false);
    toggleInSet(setSelectedTerms, label);
  };

  const handleSearch = (): void => {
    onSearch([...selectedTerms]);
    setSelectedTerms(new Set());
    setShowMaxWarning(false);
  };

  const handleClearAll = (): void => {
    setSelectedTerms(new Set());
    setShowMaxWarning(false);
  };

  const selectedCount = selectedTerms.size;

  return (
    <div className="term-cloud">
      <button
        type="button"
        className="term-cloud__header"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-expanded={!collapsed}
      >
        <span className="term-cloud__chevron">{collapsed ? "▸" : "▾"}</span>
        Browse research terms
        {collapsed && selectedCount > 0 && (
          <span className="term-cloud__header-count">({selectedCount} selected)</span>
        )}
      </button>

      {!collapsed && loading && (
        <p style={{ padding: "0.5rem", color: "var(--text-muted)" }}>Loading terms…</p>
      )}

      {!collapsed && error && (
        <p style={{ padding: "0.5rem", color: "var(--text-muted)" }}>{error}</p>
      )}

      {!collapsed && !loading && !error && (
        <>
          {/* Top-level category pills */}
          <div className="term-cloud__categories">
            {tree.map((cat) => {
              const descendantCount = countSelectedDescendants(cat, selectedTerms);
              const isExpanded = expandedCategories.has(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`term-cloud__cat-pill${isExpanded ? " term-cloud__cat-pill--expanded" : ""}`}
                  onClick={() => toggleInSet(setExpandedCategories, cat.id)}
                  aria-expanded={isExpanded}
                >
                  {cat.label}
                  {descendantCount > 0 && (
                    <span className="term-cloud__badge">{descendantCount}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Subcategory and leaf rows, rendered per expanded category */}
          {tree.map((cat) => {
            if (!expandedCategories.has(cat.id) || !cat.children) return null;
            return (
              <div key={cat.id}>
                <div className="term-cloud__subcats">
                  {cat.children.map((sub) => {
                    const isSubExpanded = expandedSubcats.has(sub.id);
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        className={`term-cloud__subcat-pill${isSubExpanded ? " term-cloud__subcat-pill--expanded" : ""}`}
                        onClick={() => toggleInSet(setExpandedSubcats, sub.id)}
                        aria-expanded={isSubExpanded}
                      >
                        {sub.label}
                      </button>
                    );
                  })}
                </div>

                {/* Leaf chips per expanded subcategory, nested inside this category block */}
                {cat.children.map((sub) => {
                  if (!expandedSubcats.has(sub.id) || !sub.children) return null;
                  return (
                    <div key={sub.id} className="term-cloud__leaves">
                      {sub.children.map((leaf) => {
                        const isSelected = selectedTerms.has(leaf.label);
                        return (
                          <button
                            key={leaf.id}
                            type="button"
                            className={`term-cloud__leaf${isSelected ? " term-cloud__leaf--selected" : ""}`}
                            onClick={() => handleToggleLeaf(leaf.label)}
                            aria-pressed={isSelected}
                          >
                            {isSelected && "✓ "}
                            {leaf.label}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {showMaxWarning && (
            <p className="term-cloud__warning">Maximum {MAX_SELECTION} terms</p>
          )}

          {selectedCount > 0 && (
            <div className="term-cloud__actions">
              <button
                type="button"
                className="btn-search term-cloud__search-btn"
                onClick={handleSearch}
              >
                Search {selectedCount} term{selectedCount > 1 ? "s" : ""}
              </button>
              <button
                type="button"
                className="term-cloud__clear"
                onClick={handleClearAll}
              >
                Clear all
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
