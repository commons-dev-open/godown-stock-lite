import { CSSProperties, ReactNode, useEffect, useMemo, useState } from "react";
import {
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react";
import Tooltip from "./Tooltip";
import Pagination, { PAGE_SIZE } from "./Pagination";
import {
  useTableScrollMaxHeight,
  type TableScrollHeightPreset,
} from "../hooks/useTableScrollMaxHeight";

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  /** When true the column header is clickable and cycles through asc / desc / unsorted. */
  sortable?: boolean;
  /** Horizontal alignment applied to both header and cells. Defaults to "left". */
  align?: "left" | "right" | "center";
}

const ALIGN_TEXT_CLASS = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

const ALIGN_FLEX_CLASS = {
  left: "justify-start",
  right: "justify-end",
  center: "justify-center",
} as const;

type SortDir = "asc" | "desc" | null;

export interface DataTableClientPagination {
  type: "client";
  pageSize?: number;
  /**
   * When both are set, client page is controlled by the parent (e.g. separate
   * page index per tab while the same DataTable component type is reconciled in place).
   */
  page?: number;
  onPageChange?: (page: number) => void;
}

export interface DataTableControlledPagination {
  type: "controlled";
  page: number;
  total: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
}

export type DataTablePagination =
  | false
  | DataTableClientPagination
  | DataTableControlledPagination;

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
  /** When set, overrides responsive preset height on the scroll wrapper. */
  scrollMaxHeight?: CSSProperties["maxHeight"];
  /**
   * Responsive max-height when `scrollMaxHeight` is omitted (matches former CSS presets).
   * @default "default"
   */
  scrollHeightPreset?: TableScrollHeightPreset;
  /** Stable row key for lists where `id` alone is not unique (e.g. ledger type+id). */
  getRowKey?: (row: T) => string | number;
  tableClassName?: string;
  rowClassName?: string;
  /** When true, action / extraActions column stays visible without row hover. */
  alwaysShowRowActions?: boolean;
  /** Optional labels for the default row edit/delete column (e.g. i18n). */
  rowActionsLabels?: {
    columnHeader: string;
    edit: string;
    delete: string;
  };
  /** Client-side paging (slice after sort) or controlled (parent passes paged rows + totals). */
  pagination?: DataTablePagination;
  /**
   * When pagination is enabled, wraps the scroll area and footer in the standard card
   * (rounded border + surface bg). Default true. Use false inside modals to avoid nested cards.
   */
  tableFrame?: boolean;
}

export default function DataTable<T extends { id: number }>({
  columns,
  data,
  onEdit,
  onDelete,
  canDelete,
  extraActions,
  emptyMessage = "No data",
  scrollMaxHeight,
  scrollHeightPreset = "default",
  getRowKey,
  tableClassName = "min-w-full",
  rowClassName = "group border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-accent-subtle)] transition-colors",
  alwaysShowRowActions = true,
  rowActionsLabels,
  pagination,
  tableFrame,
}: DataTableProps<T>) {
  const presetMaxHeight = useTableScrollMaxHeight(
    scrollMaxHeight != null ? null : scrollHeightPreset
  );
  const wrapStyle: CSSProperties | undefined =
    scrollMaxHeight != null
      ? { maxHeight: scrollMaxHeight }
      : presetMaxHeight != null
        ? { maxHeight: presetMaxHeight }
        : undefined;

  const rowKeyFn = getRowKey ?? ((row: T) => row.id);

  const paginationEnabled = pagination !== undefined && pagination !== false;

  const isClient =
    paginationEnabled && pagination && pagination.type === "client";

  const isControlledClient =
    isClient &&
    pagination.type === "client" &&
    typeof pagination.page === "number" &&
    pagination.onPageChange !== undefined;

  const pageSize =
    paginationEnabled && pagination && pagination.type !== undefined
      ? (pagination.pageSize ?? PAGE_SIZE)
      : PAGE_SIZE;

  const [internalClientPage, setInternalClientPage] = useState(1);

  const clientPage = isControlledClient ? pagination.page! : internalClientPage;

  const setClientPage = isControlledClient
    ? pagination.onPageChange!
    : setInternalClientPage;

  useEffect(() => {
    if (!isClient) {
      return;
    }
    const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
    if (clientPage > totalPages) {
      setClientPage(totalPages);
    }
  }, [isClient, data.length, pageSize, clientPage]);

  const useTableCardFrame = paginationEnabled && tableFrame !== false;

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

  useEffect(() => {
    if (!isClient) {
      return;
    }
    setClientPage(1);
  }, [sortKey, sortDir, isClient]);

  const displayRows = useMemo(() => {
    if (!isClient) {
      return sortedData;
    }
    const start = (clientPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [isClient, sortedData, clientPage, pageSize]);

  const paginationNode =
    paginationEnabled && pagination && pagination.type === "client" ? (
      <Pagination
        page={clientPage}
        total={sortedData.length}
        limit={pageSize}
        onPageChange={setClientPage}
      />
    ) : paginationEnabled && pagination && pagination.type === "controlled" ? (
      <Pagination
        page={pagination.page}
        total={pagination.total}
        limit={pagination.pageSize ?? PAGE_SIZE}
        onPageChange={pagination.onPageChange}
      />
    ) : null;

  const tableBlock = (
    <div className="table-scroll-wrap overflow-x-auto" style={wrapStyle}>
      <table className={tableClassName}>
        <thead>
          <tr>
            {columns.map((col) => {
              const isSorted = sortKey === col.key && sortDir !== null;
              const align = col.align ?? "left";
              return (
                <th
                  key={col.key}
                  className={
                    "px-4 py-2.5 " +
                    ALIGN_TEXT_CLASS[align] +
                    " text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide select-none" +
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
                  <span
                    className={
                      "inline-flex items-center gap-1 " +
                      ALIGN_FLEX_CLASS[align]
                    }
                  >
                    {col.label}
                    {col.sortable && (
                      <span className="inline-flex">
                        {isSorted && sortDir === "asc" ? (
                          <ChevronUp
                            size={14}
                            className="text-[var(--color-text-primary)]"
                          />
                        ) : isSorted && sortDir === "desc" ? (
                          <ChevronDown
                            size={14}
                            className="text-[var(--color-text-primary)]"
                          />
                        ) : (
                          <ChevronsUpDown
                            size={14}
                            className="text-[var(--color-text-tertiary)]"
                          />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
            {(onEdit || onDelete || extraActions) && (
              <th className="px-2 py-2.5 text-right text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide w-[1%]">
                {rowActionsLabels?.columnHeader ?? "Actions"}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row) => (
            <tr key={String(rowKeyFn(row))} className={rowClassName}>
              {columns.map((col) => {
                const align = col.align ?? "left";
                return (
                  <td
                    key={col.key}
                    className={
                      "px-4 py-2.5 " +
                      ALIGN_TEXT_CLASS[align] +
                      " text-sm text-[var(--color-text-primary)]"
                    }
                  >
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? "")}
                  </td>
                );
              })}
              {(onEdit || onDelete || extraActions) && (
                <td className="px-2 py-2.5 text-right text-sm w-[1%]">
                  <span
                    className={
                      "inline-flex items-center gap-0.5 transition-opacity" +
                      (alwaysShowRowActions
                        ? " opacity-100"
                        : " opacity-0 group-hover:opacity-100")
                    }
                  >
                    {extraActions?.(row)}
                    {onEdit && (
                      <Tooltip
                        content={rowActionsLabels?.edit ?? "Edit"}
                      >
                        <button
                          type="button"
                          onClick={() => onEdit(row)}
                          className="p-1.5 text-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)] rounded-lg transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
                          aria-label={rowActionsLabels?.edit ?? "Edit"}
                        >
                          <Pencil size={18} />
                        </button>
                      </Tooltip>
                    )}
                    {onDelete &&
                      (canDelete === undefined || canDelete(row)) && (
                        <Tooltip
                          content={rowActionsLabels?.delete ?? "Delete"}
                        >
                          <button
                            type="button"
                            onClick={() => onDelete(row)}
                            className="p-1.5 text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)] rounded-lg transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
                            aria-label={rowActionsLabels?.delete ?? "Delete"}
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

  // ── Render ──────────────────────────────────────────────────────────
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--color-text-secondary)] bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)]">
        {emptyMessage}
      </div>
    );
  }

  if (paginationEnabled && paginationNode && useTableCardFrame) {
    return (
      <div className="overflow-hidden rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)]">
        {tableBlock}
        {paginationNode}
      </div>
    );
  }

  if (paginationEnabled && paginationNode) {
    return (
      <>
        {tableBlock}
        {paginationNode}
      </>
    );
  }

  return tableBlock;
}
