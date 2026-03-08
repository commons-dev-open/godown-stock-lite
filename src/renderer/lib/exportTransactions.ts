import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDecimal } from "../../shared/numbers";
import {
  formatDateForFile,
  downloadCsv,
  downloadPdf,
  csvPrefixRowsForFilters,
  type AppliedFilter,
} from "./exportUtils";
import { DEFAULT_APP_NAME, MAX_DISPLAY_NAME_LEN } from "./displayName";

export type TransactionExportRow = {
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
};

const COLUMNS = [
  "Type",
  "Date",
  "Lender",
  "Product",
  "Qty",
  "Unit",
  "Amount (₹)",
  "Notes",
  "Payment",
];

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
  appliedFilters?: AppliedFilter[]
): void {
  const header = [...COLUMNS];
  const dataRows = rows.map(rowToCells);
  const prefixRows = appliedFilters?.length ? csvPrefixRowsForFilters(appliedFilters) : undefined;
  downloadCsv(
    header,
    dataRows,
    `transactions-${formatDateForFile(new Date())}.csv`,
    prefixRows
  );
}

function resolveAppName(appDisplayName?: string): string {
  const raw = appDisplayName?.trim().slice(0, MAX_DISPLAY_NAME_LEN);
  return raw || DEFAULT_APP_NAME;
}

export function exportTransactionsToPdf(
  rows: TransactionExportRow[],
  appliedFilters?: AppliedFilter[],
  appDisplayName?: string
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const now = new Date();
  const appName = resolveAppName(appDisplayName);
  let y = 10;
  doc.setFontSize(11);
  doc.text(appName, 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.text("Transactions", 14, y);
  y += 5;
  doc.setFontSize(8);
  doc.text(
    `Generated: ${now.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`,
    14,
    y
  );
  y += 8;

  const filtersToShow = appliedFilters?.filter((f) => f.value !== "" && f.value != null) ?? [];
  if (filtersToShow.length > 0) {
    doc.setFontSize(8);
    doc.text("Applied filters", 14, y);
    y += 5;
    filtersToShow.forEach((f) => {
      doc.text(`${f.label}: ${f.value}`, 14, y);
      y += 5;
    });
    y += 5;
  }

  autoTable(doc, {
    startY: y,
    head: [COLUMNS.slice()],
    body: rows.map(rowToCells),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [66, 139, 202] },
  });
  downloadPdf(doc, `transactions-${formatDateForFile(new Date())}.pdf`);
}

export function getPrintTableBody(
  rows: TransactionExportRow[],
  appliedFilters?: AppliedFilter[]
): {
  columns: string[];
  rows: string[][];
  filterDetails?: AppliedFilter[];
} {
  const filterDetails =
    appliedFilters?.filter((f) => f.value !== "" && f.value != null);
  return {
    columns: COLUMNS.slice(),
    rows: rows.map(rowToCells),
    filterDetails: filterDetails?.length ? filterDetails : undefined,
  };
}
