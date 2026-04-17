import { formatDecimal } from "../../shared/numbers";
import {
  formatDateForFile,
  downloadCsv,
  csvPrefixRowsForFilters,
  type AppliedFilter,
} from "./exportUtils";

export interface TransactionExportRow {
  type: string;
  transaction_date: string;
  mahajan_name: string | null;
  product_name: string | null;
  quantity: number | null;
  unit: string;
  amount: number;
  notes: string | null;
  payment_method?: string | null;
  reference_number?: string | null;
}

function formatPayment(row: TransactionExportRow): string {
  const parts: string[] = [];
  if (row.payment_method) parts.push(row.payment_method);
  if (row.reference_number) parts.push(row.reference_number);
  return parts.join(" · ") || "";
}

function rowToCells(row: TransactionExportRow): string[] {
  return [
    row.type,
    row.transaction_date,
    row.mahajan_name ?? "",
    row.product_name ?? "",
    row.quantity != null ? formatDecimal(row.quantity) : "",
    row.unit ?? "",
    formatDecimal(row.amount),
    row.notes ?? "",
    formatPayment(row),
  ];
}

export function exportTransactionsToCsv(
  rows: TransactionExportRow[],
  appliedFilters: AppliedFilter[] | undefined,
  columnLabels: string[],
  filterSectionTitle?: string
): void {
  const header = [...columnLabels];
  const dataRows = rows.map(rowToCells);
  const prefixRows = appliedFilters?.length
    ? csvPrefixRowsForFilters(
        appliedFilters,
        filterSectionTitle ?? "Applied filters"
      )
    : undefined;
  downloadCsv(
    header,
    dataRows,
    `transactions-${formatDateForFile(new Date())}.csv`,
    prefixRows
  );
}

export function getPrintTableBody(
  rows: TransactionExportRow[],
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
    rows: rows.map(rowToCells),
    filterDetails: filterDetails?.length ? filterDetails : undefined,
  };
}
