import { ReactNode } from "react";
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T extends { id: number }> {
  columns: Column<T>[];
  data: T[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  /** When set, delete button is only shown when this returns true (e.g. to hide delete for system rows). */
  canDelete?: (row: T) => boolean;
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
  emptyMessage = "No data",
  scrollWrapClassName,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 bg-white rounded-lg border">
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
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase"
              >
                {col.label}
              </th>
            ))}
            {(onEdit || onDelete) && (
              <th className="px-2 py-2 text-right text-xs font-medium text-gray-700 uppercase w-[1%]">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-2 text-sm text-gray-900">
                  {col.render
                    ? col.render(row)
                    : String((row as Record<string, unknown>)[col.key] ?? "")}
                </td>
              ))}
              {(onEdit || onDelete) && (
                <td className="px-2 py-2 text-right text-sm w-[1%]">
                  <span className="inline-flex items-center gap-0.5">
                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(row)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                        aria-label="Edit"
                      >
                        <PencilSquareIcon className="w-5 h-5" />
                      </button>
                    )}
                    {onDelete &&
                      (canDelete === undefined || canDelete(row)) && (
                        <button
                          type="button"
                          onClick={() => onDelete(row)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                          aria-label="Delete"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
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
