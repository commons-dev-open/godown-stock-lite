import { formatDecimal } from "../../shared/numbers";
import {
  formatDateForFile,
  sanitizeForFilename,
  downloadCsv,
  csvPrefixRowsForFilters,
  type AppliedFilter,
} from "./exportUtils";
import type { LedgerRow } from "../../shared/types";

export interface MahajanBalanceForExport {
  totalLends: number;
  totalDeposits: number;
  balance: number;
}

function rowToCells(
  row: LedgerRow,
  translateType?: (type: string) => string
): string[] {
  const typeDisplay = translateType ? translateType(row.type) : row.type;
  return [
    row.transaction_date,
    typeDisplay,
    row.description ?? "",
    formatDecimal(row.amount),
  ];
}

export function exportMahajanLedgerToCsv(
  rows: LedgerRow[],
  mahajanName: string,
  appliedFilters: AppliedFilter[] | undefined,
  options: {
    columnLabels: string[];
    filterSectionTitle: string;
    translateType?: (type: string) => string;
  }
): void {
  const header = [...options.columnLabels];
  const dataRows = rows.map((r) => rowToCells(r, options.translateType));
  const safeName = sanitizeForFilename(mahajanName);
  const date = formatDateForFile(new Date());
  const prefixRows = appliedFilters?.length
    ? csvPrefixRowsForFilters(appliedFilters, options.filterSectionTitle)
    : undefined;
  downloadCsv(header, dataRows, `lender-ledger-${safeName}-${date}.csv`, prefixRows);
}

export function getPrintTableBody(
  rows: LedgerRow[],
  appliedFilters: AppliedFilter[] | undefined,
  columnLabels: string[],
  translateType?: (type: string) => string
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
    rows: rows.map((r) => rowToCells(r, translateType)),
    filterDetails: filterDetails?.length ? filterDetails : undefined,
  };
}
