import { type ReactNode } from "react";
import { X } from "lucide-react";

interface SearchFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onClearFilters?: () => void;
  /** When true, Clear button shows even if search is empty (e.g. when only other filters like date are set) */
  hasActiveFilters?: boolean;
  placeholder?: string;
  /** Optional content on the right (e.g. toggles, extra controls) */
  rightContent?: ReactNode;
}

export default function SearchFilterBar({
  searchValue,
  onSearchChange,
  onClearFilters,
  hasActiveFilters,
  placeholder = "Search...",
  rightContent,
}: SearchFilterBarProps) {
  const showClear = onClearFilters && (searchValue || hasActiveFilters);
  return (
    <div className="flex flex-nowrap items-center gap-3 p-3 bg-[var(--color-bg-surface-raised)] rounded-lg border border-[var(--color-border-default)] overflow-hidden">
      <input
        type="search"
        placeholder={placeholder}
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        className="border border-[var(--color-border-strong)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-bg-surface)] shrink-0 min-w-0 w-64 max-w-full"
        aria-label="Search"
      />

      {rightContent != null ? (
        <div className="flex items-center gap-2 shrink-0">{rightContent}</div>
      ) : null}
      {showClear && (
        <button
          type="button"
          onClick={onClearFilters}
          className="inline-flex items-center gap-1 shrink-0 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <X size={16} aria-hidden="true" />
          Clear filters
        </button>
      )}
    </div>
  );
}
