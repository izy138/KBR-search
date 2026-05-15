import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useState,
} from "react";
import { getPageNumbers } from "../components/shared/Pagination";

type UsePaginationParams = {
  visibleTotal: number;
};

type UsePaginationReturn = {
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  resultsPerPage: number;
  totalPages: number;
  pageNumbers: Array<number | "...">;
  jumpToPageInput: string;
  setJumpToPageInput: React.Dispatch<React.SetStateAction<string>>;
  handlePerPageChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  handleJumpToPageSubmit: (e: FormEvent<HTMLFormElement>) => void;
};

/**
 * Encapsulates all pagination state and derived values for a search results list.
 *
 * @param visibleTotal - The number of results currently visible (after filters),
 *   used to derive `totalPages`.
 */
export function usePagination({ visibleTotal }: UsePaginationParams): UsePaginationReturn {
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(25);
  const [jumpToPageInput, setJumpToPageInput] = useState("1");

  const totalPages = Math.max(1, Math.ceil(visibleTotal / resultsPerPage));
  const pageNumbers = getPageNumbers(currentPage, totalPages);

  // Keep the jump-to-page text field in sync whenever the page changes externally
  // (e.g. a filter reset or programmatic setCurrentPage call).
  useEffect(() => {
    setJumpToPageInput(String(currentPage));
  }, [currentPage]);

  /** Changes the page size and resets to page 1 so results stay coherent. */
  const handlePerPageChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    setResultsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  /**
   * Validates and applies a jump-to-page submission.
   * Clamps the parsed value to [1, totalPages]; resets the input to the
   * current page if the value is non-numeric.
   */
  const handleJumpToPageSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const parsed = Number.parseInt(jumpToPageInput, 10);
    if (!Number.isFinite(parsed)) {
      setJumpToPageInput(String(currentPage));
      return;
    }
    const boundedPage = Math.min(totalPages, Math.max(1, parsed));
    setCurrentPage(boundedPage);
    setJumpToPageInput(String(boundedPage));
  };

  return {
    currentPage,
    setCurrentPage,
    resultsPerPage,
    totalPages,
    pageNumbers,
    jumpToPageInput,
    setJumpToPageInput,
    handlePerPageChange,
    handleJumpToPageSubmit,
  };
}
