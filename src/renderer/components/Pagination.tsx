import { ChevronLeft, ChevronRight } from "lucide-react";
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
    <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] text-sm">
      <span className="text-[var(--color-text-secondary)]">
        Showing {start}-{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-bg-surface-raised)]"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
          Previous
        </button>
        <span className="px-2 py-1 text-[var(--color-text-secondary)]">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-bg-surface-raised)]"
          aria-label="Next page"
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export { PAGE_SIZE };
