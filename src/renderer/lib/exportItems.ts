import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDecimal } from "../../shared/numbers";
import { formatDateForFile, downloadCsv } from "./exportUtils";
import type { Item } from "../../shared/types";

const COLUMNS = [
  "Id",
  "Name",
  "Code",
  "Unit",
  "Current Stock",
  "Reorder Level",
  "Created At",
  "Updated At",
] as const;

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

export function exportItemsToCsv(items: Item[]): void {
  const header = [...COLUMNS];
  const rows = items.map((item) => rowToCells(item));
  downloadCsv(header, rows, `products-stock-${formatDateForFile(new Date())}.csv`);
}

const APP_NAME = "Godown Stock Lite";

function formatDateForPdf(d: Date): string {
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function exportItemsToPdf(items: Item[]): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const now = new Date();
  let y = 10;
  doc.setFontSize(11);
  doc.text(APP_NAME, 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.text("Products & Stock", 14, y);
  y += 5;
  doc.setFontSize(8);
  doc.text(`Generated: ${formatDateForPdf(now)}`, 14, y);
  y += 8;
  autoTable(doc, {
    startY: y,
    head: [COLUMNS.slice()],
    body: items.map((item) => rowToCells(item)),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [66, 139, 202] },
  });
  doc.save(`products-stock-${formatDateForFile(new Date())}.pdf`);
}

export function getPrintTableBody(items: Item[]): { columns: string[]; rows: string[][] } {
  return {
    columns: COLUMNS.slice(),
    rows: items.map(rowToCells),
  };
}
