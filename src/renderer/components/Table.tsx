import { ReactNode } from "react";

export interface TableColumn<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  render?: (row: T) => ReactNode;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  getRowKey: (row: T) => string | number;
  /** Optional class for the scroll wrapper */
  scrollWrapClassName?: string;
  /** Optional class for the table element */
  tableClassName?: string;
}

export default function Table<T>({
  columns,
  data,
  getRowKey,
  scrollWrapClassName,
  tableClassName = "min-w-full text-sm",
}: Readonly<TableProps<T>>) {
  return (
    <div
      className={
        "table-scroll-wrap overflow-x-auto" +
        (scrollWrapClassName ? ` ${scrollWrapClassName}` : "")
      }
    >
      <table className={tableClassName}>
        <thead>
          <tr className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-2 px-2 text-[var(--color-text-secondary)] ${col.align === "right" ? "text-right" : "text-left"}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={getRowKey(row)} className="border-b border-[var(--color-border-default)] hover:bg-[var(--color-bg-surface-raised)] transition-colors">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`py-2 px-2 ${col.align === "right" ? "text-right" : "text-left"}`}
                >
                  {col.render
                    ? col.render(row)
                    : String((row as Record<string, unknown>)[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
