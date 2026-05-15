import { type FormEvent } from "react";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  pageNumbers: Array<number | "...">;
  onPageChange: (page: number) => void;
  jumpToPageInput?: string;
  onJumpToPageInputChange?: (value: string) => void;
  onJumpToPageSubmit?: (e: FormEvent<HTMLFormElement>) => void;
};

/**
 * Computes the page number list to display in pagination, inserting an ellipsis
 * when there is a gap between the visible window and the last page.
 *
 * @param page - The current active page (1-based).
 * @param totalPageCount - The total number of pages.
 * @returns An ordered array of page numbers and "..." sentinel strings.
 */
export function getPageNumbers(page: number, totalPageCount: number): Array<number | "..."> {
  if (totalPageCount <= 5) {
    return Array.from({ length: totalPageCount }, (_, i) => i + 1);
  }
  const start = Math.max(1, page);
  const end = Math.min(totalPageCount, start + 2);
  const pages: Array<number | "..."> = [];

  for (let p = start; p <= end; p++) {
    pages.push(p);
  }
  if (end < totalPageCount - 1) {
    pages.push("...");
  }
  if (end < totalPageCount) {
    pages.push(totalPageCount);
  }

  return pages;
}

/**
 * Shared pagination control used across search results and investigator pages.
 *
 * Renders first/prev/page-number/next/last buttons and an optional jump-to-page
 * form. Jump-to-page is omitted when the three handler props are not provided.
 */
export default function Pagination({
  currentPage,
  totalPages,
  pageNumbers,
  onPageChange,
  jumpToPageInput,
  onJumpToPageInputChange,
  onJumpToPageSubmit,
}: PaginationProps) {
  const hasJumpToPage =
    jumpToPageInput !== undefined &&
    onJumpToPageInputChange !== undefined &&
    onJumpToPageSubmit !== undefined;

  return (
    <div className="pagination">
      <button
        type="button"
        className="btn-page"
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
        aria-label="Go to first page"
      >
        «
      </button>

      <button
        type="button"
        className="btn-page"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        aria-label="Go to previous page"
      >
        ←
      </button>

      {pageNumbers.map((item, index) =>
        item === "..." ? (
          <span key={`ellipsis-${index}`} className="page-ellipsis">…</span>
        ) : (
          <button
            key={item}
            type="button"
            className={`btn-page${item === currentPage ? " active" : ""}`}
            onClick={() => onPageChange(item as number)}
            disabled={item === currentPage}
            aria-label={`Go to page ${item}`}
            aria-current={item === currentPage ? "page" : undefined}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        className="btn-page"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage >= totalPages}
        aria-label="Go to next page"
      >
        →
      </button>

      <button
        type="button"
        className="btn-page"
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage >= totalPages}
        aria-label="Go to last page"
      >
        »
      </button>

      {hasJumpToPage && (
        <form className="page-jump-form" onSubmit={onJumpToPageSubmit}>
          <input
            className="page-jump-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={jumpToPageInput}
            onChange={(e) => onJumpToPageInputChange(e.target.value.replace(/\D/g, ""))}
            aria-label={`Jump to page between 1 and ${totalPages}`}
          />
          <button type="submit" className="btn-page btn-page-jump">
            Go
          </button>
        </form>
      )}
    </div>
  );
}
