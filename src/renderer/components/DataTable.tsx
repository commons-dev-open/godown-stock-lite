import { ReactNode, useMemo, useState } from "react";
import { Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import Tooltip from "./Tooltip";

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  /** When true the column header is clickable and cycles through asc / desc / unsorted. */
  sortable?: boolean;
}

type SortDir = "asc" | "desc" | null;

interface DataTableProps<T extends { id: number }> {
  columns: Column<T>[];
  data: T[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  /** When set, delete button is only shown when this returns true (e.g. to hide delete for system rows). */
  canDelete?: (row: T) => boolean;
  /** Optional extra action buttons (e.g. link to related page) */
  extraActions?: (row: T) => ReactNode;
  emptyMessage?: string;
  /** Optional class for the scroll wrapper (e.g. table-scroll-wrap--shorter) */
  scrollWrapClassName?: string;
}

export default function DataTable<T extends { id: number }>({
  columns,
  data,
  onEdit,
  onDelete,
  canDelete,
  extraActions,
  emptyMessage = "No data",
  scrollWrapClassName,
}: DataTableProps<T>) {
  // ── Sort state ──────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const handleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else if (sortDir === "desc") {
      setSortKey(null);
      setSortDir(null);
    } else {
      setSortDir("asc");
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir) return data;

    return [...data].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey];
      const bVal = (b as Record<string, unknown>)[sortKey];

      let cmp = 0;
      if (aVal == null && bVal == null) cmp = 0;
      else if (aVal == null) cmp = -1;
      else if (bVal == null) cmp = 1;
      else if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }

      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [data, sortKey, sortDir]);

  // ── Render ──────────────────────────────────────────────────────────
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--color-text-secondary)] bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)]">
        {emptyMessage}
      </div>
    );
  }
  return (
    <div
      className={
        "table-scroll-wrap overflow-x-auto" +
        (scrollWrapClassName ? ` ${scrollWrapClassName}` : "")
      }
    >
      <table className="min-w-full">
        <thead>
          <tr>
            {columns.map((col) => {
              const isSorted = sortKey === col.key && sortDir !== null;
              return (
                <th
                  key={col.key}
                  className={
                    "px-4 py-2.5 text-left text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide select-none" +
                    (col.sortable
                      ? " cursor-pointer hover:text-[var(--color-text-secondary)] transition-colors"
                      : "")
                  }
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  aria-sort={
                    isSorted
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      <span className="inline-flex">
                        {isSorted && sortDir === "asc" ? (
                          <ChevronUp size={14} className="text-[var(--color-text-primary)]" />
                        ) : isSorted && sortDir === "desc" ? (
                          <ChevronDown size={14} className="text-[var(--color-text-primary)]" />
                        ) : (
                          <ChevronsUpDown size={14} className="text-[var(--color-text-tertiary)]" />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
            {(onEdit || onDelete || extraActions) && (
              <th className="px-2 py-2.5 text-right text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide w-[1%]">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row) => (
            <tr
              key={row.id}
              className="group border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-accent-subtle)] transition-colors"
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-2.5 text-sm text-[var(--color-text-primary)]">
                  {col.render
                    ? col.render(row)
                    : String((row as Record<string, unknown>)[col.key] ?? "")}
                </td>
              ))}
              {(onEdit || onDelete || extraActions) && (
                <td className="px-2 py-2.5 text-right text-sm w-[1%]">
                  <span className="inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {extraActions?.(row)}
                    {onEdit && (
                      <Tooltip content="Edit">
                        <button
                          type="button"
                          onClick={() => onEdit(row)}
                          className="p-1.5 text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] rounded-lg transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
                          aria-label="Edit"
                        >
                          <Pencil size={18} />
                        </button>
                      </Tooltip>
                    )}
                    {onDelete &&
                      (canDelete === undefined || canDelete(row)) && (
                        <Tooltip content="Delete">
                          <button
                            type="button"
                            onClick={() => onDelete(row)}
                            className="p-1.5 text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] rounded-lg transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
                            aria-label="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </Tooltip>
                      )}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
