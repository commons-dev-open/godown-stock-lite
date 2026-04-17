import { formatDecimal } from "../../shared/numbers";
import {
  formatDateForFile,
  downloadCsv,
  csvPrefixRowsForFilters,
  type AppliedFilter,
} from "./exportUtils";
import type { DailySale } from "../../shared/types";

function rowToCells(sale: DailySale): string[] {
  return [
    sale.sale_date,
    formatDecimal(sale.sale_amount),
    formatDecimal(sale.invoice_sales ?? 0),
    formatDecimal(sale.misc_sales ?? 0),
    formatDecimal(sale.cash_in_hand),
    formatDecimal(sale.expenditure_amount ?? 0),
    sale.notes ?? "",
  ];
}

export function exportDailySalesToCsv(
  sales: DailySale[],
  appliedFilters: AppliedFilter[] | undefined,
  columnLabels: string[],
  filterSectionTitle?: string
): void {
  const header = [...columnLabels];
  const rows = sales.map(rowToCells);
  const prefixRows = appliedFilters?.length
    ? csvPrefixRowsForFilters(
        appliedFilters,
        filterSectionTitle ?? "Applied filters"
      )
    : undefined;
  downloadCsv(
    header,
    rows,
    `daily-sales-${formatDateForFile(new Date())}.csv`,
    prefixRows
  );
}

export function getPrintTableBody(
  sales: DailySale[],
  appliedFilters: AppliedFilter[] | undefined,
  columnLabels: string[]
): {
  columns: string[];
  rows: string[][];
  filterDetails?: AppliedFilter[];
} {
  const filterDetails = appliedFilters?.filter(
    (f) => f.value !== "" && f.value != null
  );
  return {
    columns: columnLabels.slice(),
    rows: sales.map(rowToCells),
    filterDetails: filterDetails?.length ? filterDetails : undefined,
  };
}
