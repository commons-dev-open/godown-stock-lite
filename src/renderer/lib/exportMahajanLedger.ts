import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDecimal } from "../../shared/numbers";
import {
  formatDateForFile,
  sanitizeForFilename,
  downloadCsv,
  downloadPdf,
  csvPrefixRowsForFilters,
  type AppliedFilter,
} from "./exportUtils";
import type { LedgerRow } from "../../shared/types";

export interface MahajanBalanceForExport {
  totalLends: number;
  totalDeposits: number;
  balance: number;
}

const COLUMNS = ["Date", "Type", "Description", "Amount"];

function rowToCells(row: LedgerRow): string[] {
  return [
    row.transaction_date,
    row.type,
    row.description ?? "",
    formatDecimal(row.amount),
  ];
}

export function exportMahajanLedgerToCsv(
  rows: LedgerRow[],
  mahajanName: string,
  appliedFilters?: AppliedFilter[]
): void {
  const header = [...COLUMNS];
  const dataRows = rows.map(rowToCells);
  const safeName = sanitizeForFilename(mahajanName);
  const date = formatDateForFile(new Date());
  const prefixRows = appliedFilters?.length ? csvPrefixRowsForFilters(appliedFilters) : undefined;
  downloadCsv(header, dataRows, `mahajan-ledger-${safeName}-${date}.csv`, prefixRows);
}

const APP_NAME = "Godown Stock Lite";
// jsPDF default font does not support ₹ (U+20B9); use "Rs." so PDF renders correctly
const PDF_RUPEE = "Rs. ";

export function exportMahajanLedgerToPdf(
  rows: LedgerRow[],
  mahajanName: string,
  balance: MahajanBalanceForExport | null,
  appliedFilters?: AppliedFilter[]
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const now = new Date();
  let y = 10;
  doc.setFontSize(11);
  doc.text(APP_NAME, 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.text("Mahajan Ledger", 14, y);
  y += 5;
  doc.setFontSize(9);
  doc.text(`Mahajan: ${mahajanName}`, 14, y);
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

  if (balance != null) {
    doc.setFontSize(9);
    // Value column at 75mm so long label "Balance (Lend - Deposit)" does not overlap
    const valueX = 75;
    doc.text("Total Lends", 14, y);
    doc.text(`${PDF_RUPEE}${formatDecimal(balance.totalLends)}`, valueX, y);
    y += 6;
    doc.text("Total Deposits", 14, y);
    doc.text(`${PDF_RUPEE}${formatDecimal(balance.totalDeposits)}`, valueX, y);
    y += 6;
    let balanceHint = "";
    if (balance.balance > 0) balanceHint = "(payable)";
    else if (balance.balance < 0) balanceHint = "(receivable)";
    doc.text("Balance (Lend - Deposit)", 14, y);
    doc.text(
      `${PDF_RUPEE}${formatDecimal(Math.abs(balance.balance))} ${balanceHint}`.trim(),
      valueX,
      y
    );
    y += 10;
  }

  autoTable(doc, {
    startY: y,
    head: [COLUMNS.slice()],
    body: rows.map(rowToCells),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [66, 139, 202] },
  });
  const safeName = sanitizeForFilename(mahajanName);
  downloadPdf(
    doc,
    `mahajan-ledger-${safeName}-${formatDateForFile(new Date())}.pdf`
  );
}

export function getPrintTableBody(
  rows: LedgerRow[],
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
