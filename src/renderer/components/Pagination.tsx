import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { PAGE_SIZE } from "../../shared/constants";

interface PaginationProps {
  page: number;
  total: number;
  limit?: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  page,
  total,
  limit = PAGE_SIZE,
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  if (totalPages <= 1 && total <= limit) return null;

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50 text-sm">
      <span className="text-gray-600">
        Showing {start}-{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-300 bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          aria-label="Previous page"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Previous
        </button>
        <span className="px-2 py-1 text-gray-700">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-300 bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          aria-label="Next page"
        >
          Next
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export { PAGE_SIZE };
