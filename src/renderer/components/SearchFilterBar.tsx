import { type ReactNode } from "react";

interface SearchFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onClearFilters?: () => void;
  placeholder?: string;
  /** Optional content on the right (e.g. checkboxes, extra controls) */
  rightContent?: ReactNode;
}

export default function SearchFilterBar({
  searchValue,
  onSearchChange,
  onClearFilters,
  placeholder = "Search…",
  rightContent,
}: SearchFilterBarProps) {
  return (
    <div className="flex flex-nowrap items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
      <input
        type="search"
        placeholder={placeholder}
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white shrink-0 min-w-0 w-64 max-w-full"
        aria-label="Search"
      />
      {searchValue && onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="shrink-0 text-sm text-gray-600 hover:text-gray-900 underline"
        >
          Clear filters
        </button>
      )}
      {rightContent != null ? (
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {rightContent}
        </div>
      ) : null}
    </div>
  );
}
