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
import type { DailySale } from "../../shared/types";

const COLUMNS = ["Date", "Sale Amount", "Cash in Hand", "Expenditure", "Notes"];

function rowToCells(sale: DailySale): string[] {
  return [
    sale.sale_date,
    formatDecimal(sale.sale_amount),
    formatDecimal(sale.cash_in_hand),
    formatDecimal(sale.expenditure_amount ?? 0),
    sale.notes ?? "",
  ];
}

export function exportDailySalesToCsv(
  sales: DailySale[],
  appliedFilters?: AppliedFilter[]
): void {
  const header = [...COLUMNS];
  const rows = sales.map(rowToCells);
  const prefixRows = appliedFilters?.length ? csvPrefixRowsForFilters(appliedFilters) : undefined;
  downloadCsv(
    header,
    rows,
    `daily-sales-${formatDateForFile(new Date())}.csv`,
    prefixRows
  );
}

const APP_NAME = "Godown Stock Lite";

export function exportDailySalesToPdf(
  sales: DailySale[],
  appliedFilters?: AppliedFilter[]
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const now = new Date();
  let y = 10;
  doc.setFontSize(11);
  doc.text(APP_NAME, 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.text("Daily Sales", 14, y);
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
    body: sales.map(rowToCells),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [66, 139, 202] },
  });
  downloadPdf(doc, `daily-sales-${formatDateForFile(new Date())}.pdf`);
}

export function getPrintTableBody(
  sales: DailySale[],
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
    rows: sales.map(rowToCells),
    filterDetails: filterDetails?.length ? filterDetails : undefined,
  };
}
