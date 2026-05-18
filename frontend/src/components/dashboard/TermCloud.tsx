import { useEffect, useState } from "react";
import { getTermTree, type TermNode } from "../../api";
import { cn } from "../../utils/cn";

const MAX_SELECTION = 20;

type TermCloudProps = {
  onSearch: (terms: string[]) => void;
};

const catPillBase =
  "inline-flex items-center gap-[0.35rem] px-[0.85rem] py-[0.45rem] rounded-full bg-tag-bg text-tag-text border border-border text-sm font-semibold cursor-pointer transition-[background,border-color,color] duration-150 hover:border-border-strong";

const subcatPillBase =
  "inline-flex items-center px-[0.65rem] py-[0.3rem] rounded-full bg-surface text-text-secondary border border-border text-[0.825rem] cursor-pointer transition-[background,border-color,color] duration-150 hover:border-border-strong";

const leafBase =
  "inline-flex items-center px-[0.55rem] py-1 rounded-sm bg-tag-bg text-tag-text border border-border text-[0.8rem] cursor-pointer transition-[background,border-color,color] duration-150 hover:border-border-strong";

function countSelectedDescendants(node: TermNode, selected: Set<string>): number {
  if (!node.children) return selected.has(node.label) ? 1 : 0;
  return node.children.reduce(
    (sum, child) => sum + countSelectedDescendants(child, selected),
    0,
  );
}

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
    <div className="mx-0 mt-3 px-3 pb-1">
      <button
        type="button"
        className="flex items-center gap-2 w-full py-2 bg-transparent border-none text-text-secondary text-sm font-semibold cursor-pointer tracking-[0.02em] hover:text-text-primary"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-expanded={!collapsed}
      >
        <span className="text-[0.7rem] transition-transform duration-150">{collapsed ? "▸" : "▾"}</span>
        Browse research terms
        {collapsed && selectedCount > 0 && (
          <span className="font-normal text-[0.8rem] text-accent-text">({selectedCount} selected)</span>
        )}
      </button>

      {!collapsed && loading && (
        <p className="p-2 text-text-muted">Loading terms…</p>
      )}

      {!collapsed && error && (
        <p className="p-2 text-text-muted">{error}</p>
      )}

      {!collapsed && !loading && !error && (
        <>
          <div className="flex flex-wrap gap-2 py-[0.4rem]">
            {tree.map((cat) => {
              const descendantCount = countSelectedDescendants(cat, selectedTerms);
              const isExpanded = expandedCategories.has(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={cn(
                    catPillBase,
                    isExpanded && "bg-accent-light border-accent text-accent-text",
                  )}
                  onClick={() => toggleInSet(setExpandedCategories, cat.id)}
                  aria-expanded={isExpanded}
                >
                  {cat.label}
                  {descendantCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[1.2rem] h-[1.2rem] rounded-full bg-accent text-white text-[0.7rem] font-semibold px-[0.3rem]">
                      {descendantCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {tree.map((cat) => {
            if (!expandedCategories.has(cat.id) || !cat.children) return null;
            return (
              <div key={cat.id}>
                <div className="flex flex-wrap gap-[0.4rem] py-[0.35rem] pl-4">
                  {cat.children.map((sub) => {
                    const isSubExpanded = expandedSubcats.has(sub.id);
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        className={cn(
                          subcatPillBase,
                          isSubExpanded && "bg-accent-light border-accent text-accent-text",
                        )}
                        onClick={() => toggleInSet(setExpandedSubcats, sub.id)}
                        aria-expanded={isSubExpanded}
                      >
                        {sub.label}
                      </button>
                    );
                  })}
                </div>

                {cat.children.map((sub) => {
                  if (!expandedSubcats.has(sub.id) || !sub.children) return null;
                  return (
                    <div key={sub.id} className="flex flex-wrap gap-[0.35rem] py-1 pl-8">
                      {sub.children.map((leaf) => {
                        const isSelected = selectedTerms.has(leaf.label);
                        return (
                          <button
                            key={leaf.id}
                            type="button"
                            className={cn(
                              leafBase,
                              isSelected && "bg-accent text-white border-accent",
                            )}
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
            <p className="text-[0.78rem] text-text-muted py-1">Maximum {MAX_SELECTION} terms</p>
          )}

          {selectedCount > 0 && (
            <div className="flex items-center gap-3 py-[0.6rem] mt-2 border-t border-border">
              <button
                type="button"
                className="bg-accent text-white border-none rounded-sm px-[0.9rem] py-[0.38rem] font-sans text-[14px] font-medium cursor-pointer whitespace-nowrap transition-[background] duration-150 hover:bg-accent-hover"
                onClick={handleSearch}
              >
                Search {selectedCount} term{selectedCount > 1 ? "s" : ""}
              </button>
              <button
                type="button"
                className="bg-transparent border-none text-accent-text cursor-pointer text-[0.825rem] underline py-[0.3rem] px-0 hover:text-text-primary"
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
