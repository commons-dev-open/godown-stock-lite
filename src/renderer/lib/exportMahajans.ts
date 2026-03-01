import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDecimal } from "../../shared/numbers";
import { formatDateForFile, downloadCsv } from "./exportUtils";
import type { Mahajan } from "../../shared/types";

export interface MahajanSummaryForExport {
  totalLend: number;
  totalDeposit: number;
  balance: number;
}

const COLUMNS = ["Id", "Name", "Address", "Phone", "GSTIN", "Created At", "Updated At", "Balance"];

function formatBalanceCell(balance: number): string {
  if (balance === 0) return "Rs. 0.00";
  const hint = balance > 0 ? " (payable)" : " (receivable)";
  return `Rs. ${formatDecimal(Math.abs(balance))}${hint}`;
}

function rowToCells(
  m: Mahajan,
  balance: number | undefined
): string[] {
  const balanceStr =
    balance === undefined ? "" : formatBalanceCell(balance);
  return [
    String(m.id),
    m.name,
    m.address ?? "",
    m.phone ?? "",
    m.gstin ?? "",
    m.created_at,
    m.updated_at,
    balanceStr,
  ];
}

export function exportMahajansToCsv(
  mahajans: Mahajan[],
  summary: MahajanSummaryForExport | null,
  balances: Record<number, number>
): void {
  const header = [...COLUMNS];
  const rows = mahajans.map((m) => rowToCells(m, balances[m.id]));
  if (summary != null) {
    let balanceSuffix = "";
    if (summary.balance > 0) balanceSuffix = " (payable)";
    else if (summary.balance < 0) balanceSuffix = " (receivable)";
    const emptyRow: string[] = ["", "", "", "", "", "", "", ""];
    rows.push(
      emptyRow,
      ["", "Total Lends", "", "", "", "", "", `Rs. ${formatDecimal(summary.totalLend)}`],
      ["", "Total Deposits", "", "", "", "", "", `Rs. ${formatDecimal(summary.totalDeposit)}`],
      [
        "",
        "Balance (Lend − Deposit)",
        "",
        "",
        "",
        "",
        "",
        `Rs. ${formatDecimal(Math.abs(summary.balance))}${balanceSuffix}`,
      ]
    );
  }
  downloadCsv(header, rows, `mahajans-${formatDateForFile(new Date())}.csv`);
}

const APP_NAME = "Godown Stock Lite";
// jsPDF default font does not support ₹ (U+20B9); use "Rs." so PDF renders correctly
const PDF_RUPEE = "Rs. ";

export function exportMahajansToPdf(
  mahajans: Mahajan[],
  summary: MahajanSummaryForExport | null,
  balances: Record<number, number>
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const now = new Date();
  let y = 10;
  doc.setFontSize(11);
  doc.text(APP_NAME, 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.text("Mahajans", 14, y);
  y += 5;
  doc.setFontSize(8);
  doc.text(
    `Generated: ${now.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`,
    14,
    y
  );
  y += 8;

  if (summary != null) {
    doc.setFontSize(9);
    const valueX = 75;
    doc.text("Total Lends", 14, y);
    doc.text(`${PDF_RUPEE}${formatDecimal(summary.totalLend)}`, valueX, y);
    y += 6;
    doc.text("Total Deposits", 14, y);
    doc.text(`${PDF_RUPEE}${formatDecimal(summary.totalDeposit)}`, valueX, y);
    y += 6;
    let balanceHint = "";
    if (summary.balance > 0) balanceHint = "(payable)";
    else if (summary.balance < 0) balanceHint = "(receivable)";
    doc.text("Balance (Lend − Deposit)", 14, y);
    doc.text(
      `${PDF_RUPEE}${formatDecimal(Math.abs(summary.balance))} ${balanceHint}`.trim(),
      valueX,
      y
    );
    y += 10;
  }

  autoTable(doc, {
    startY: y,
    head: [COLUMNS.slice()],
    body: mahajans.map((m) => rowToCells(m, balances[m.id])),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [66, 139, 202] },
  });
  doc.save(`mahajans-${formatDateForFile(new Date())}.pdf`);
}

export function getPrintTableBody(
  mahajans: Mahajan[],
  summary: MahajanSummaryForExport | null,
  balances: Record<number, number>
): { columns: string[]; rows: string[][]; summary: MahajanSummaryForExport | null } {
  return {
    columns: COLUMNS.slice(),
    rows: mahajans.map((m) => rowToCells(m, balances[m.id])),
    summary,
  };
}
