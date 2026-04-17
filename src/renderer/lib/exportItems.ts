import { formatDecimal } from "../../shared/numbers";
import { formatDateForFile, downloadCsv } from "./exportUtils";
import type { Item } from "../../shared/types";

function rowToCells(item: Item): string[] {
  return [
    String(item.id),
    item.name,
    item.code ?? "",
    item.unit,
    formatDecimal(item.current_stock),
    item.reorder_level != null ? formatDecimal(item.reorder_level) : "",
    item.created_at,
    item.updated_at,
  ];
}

export function exportItemsToCsv(
  items: Item[],
  columnLabels: string[]
): void {
  const header = [...columnLabels];
  const rows = items.map((item) => rowToCells(item));
  downloadCsv(header, rows, `products-stock-${formatDateForFile(new Date())}.csv`);
}

export function getPrintTableBody(
  items: Item[],
  columnLabels: string[]
): {
  columns: string[];
  rows: string[][];
} {
  return {
    columns: columnLabels.slice(),
    rows: items.map(rowToCells),
  };
}
