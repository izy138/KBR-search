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
    <form
      onSubmit={handleSubmit}
      className="flex w-full items-center gap-2 rounded-md border border-border bg-bg px-2 py-[0.3rem] transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(26,86,219,0.1)]"
    >
      <svg
        className="h-4 w-4 shrink-0 text-text-muted"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <circle cx="7" cy="7" r="4.5" />
        <path d="M10.5 10.5L13.5 13.5" strokeLinecap="round" />
      </svg>
      <input
        type="text"
        className="min-w-0 flex-1 border-none bg-transparent py-[0.52rem] font-sans text-[13px] text-text-primary outline-none placeholder:text-text-muted"
        placeholder="Search NIH projects by title, PI, keywords…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query ? (
        <button
          type="button"
          onClick={handleClear}
          className="cursor-pointer border-none bg-transparent px-0.5 text-[19px] leading-none text-text-muted"
          aria-label="Clear search"
        >
          ×
        </button>
      ) : null}
      <button
        type="submit"
        className="cursor-pointer whitespace-nowrap rounded-sm border-none bg-accent px-[0.9rem] py-[0.38rem] font-sans text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover"
      >
        Search
      </button>
    </form>
  );
};

export default SearchBar;
