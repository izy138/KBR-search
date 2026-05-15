import { type FC, useEffect, useState } from "react";

type SearchBarProps = {
  onSearch: (query: string) => void;
  initialQuery?: string;
  /** When false, × only clears the input (no onSearch). Default true. */
  submitOnClear?: boolean;
};

const SearchBar: FC<SearchBarProps> = ({
  onSearch,
  initialQuery = "",
  submitOnClear = true,
}) => {
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(query.trim());
  };

  const handleClear = () => {
    setQuery("");
    if (submitOnClear) {
      onSearch("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="header-search header-search--results">
      <svg className="search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="7" cy="7" r="4.5" />
        <path d="M10.5 10.5L13.5 13.5" strokeLinecap="round" />
      </svg>
      <input
        type="text"
        placeholder="Search NIH projects by title, PI, keywords…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query && (
        <button
          type="button"
          onClick={handleClear}
          className="search-clear-btn"
          aria-label="Clear search"
        >
          ×
        </button>
      )}
      <button type="submit" className="btn-search">Search</button>
    </form>
  );
};

export default SearchBar;
