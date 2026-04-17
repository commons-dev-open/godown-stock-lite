import { formatDecimal } from "../../shared/numbers";
import { formatDateForFile, downloadCsv } from "./exportUtils";
import type { Mahajan } from "../../shared/types";

export interface MahajanSummaryForExport {
  totalLend: number;
  totalDeposit: number;
  balance: number;
}

export interface MahajansExportText {
  columns: string[];
  balanceHints: { payable: string; receivable: string };
  csvSummaryLabels: {
    totalCreditPurchase: string;
    totalSettlements: string;
    balance: string;
  };
}

function formatBalanceCell(
  balance: number,
  payableHint: string,
  receivableHint: string
): string {
  if (balance === 0) return "Rs. 0.00";
  const hint = balance > 0 ? ` ${payableHint}` : ` ${receivableHint}`;
  return `Rs. ${formatDecimal(Math.abs(balance))}${hint}`;
}

function rowToCells(
  m: Mahajan,
  balance: number | undefined,
  payableHint: string,
  receivableHint: string
): string[] {
  const balanceStr =
    balance === undefined
      ? ""
      : formatBalanceCell(balance, payableHint, receivableHint);
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
  balances: Record<number, number>,
  texts: MahajansExportText
): void {
  const header = [...texts.columns];
  const rows = mahajans.map((m) =>
    rowToCells(m, balances[m.id], texts.balanceHints.payable, texts.balanceHints.receivable)
  );
  if (summary != null) {
    let balanceSuffix = "";
    if (summary.balance > 0) balanceSuffix = ` ${texts.balanceHints.payable}`;
    else if (summary.balance < 0) balanceSuffix = ` ${texts.balanceHints.receivable}`;
    const emptyRow: string[] = ["", "", "", "", "", "", "", ""];
    rows.push(
      emptyRow,
      [
        "",
        texts.csvSummaryLabels.totalCreditPurchase,
        "",
        "",
        "",
        "",
        "",
        `Rs. ${formatDecimal(summary.totalLend)}`,
      ],
      [
        "",
        texts.csvSummaryLabels.totalSettlements,
        "",
        "",
        "",
        "",
        "",
        `Rs. ${formatDecimal(summary.totalDeposit)}`,
      ],
      [
        "",
        texts.csvSummaryLabels.balance,
        "",
        "",
        "",
        "",
        "",
        `Rs. ${formatDecimal(Math.abs(summary.balance))}${balanceSuffix}`,
      ]
    );
  }
  downloadCsv(header, rows, `lenders-${formatDateForFile(new Date())}.csv`);
}

export function getPrintTableBody(
  mahajans: Mahajan[],
  summary: MahajanSummaryForExport | null,
  balances: Record<number, number>,
  texts: MahajansExportText
): { columns: string[]; rows: string[][]; summary: MahajanSummaryForExport | null } {
  return {
    columns: texts.columns.slice(),
    rows: mahajans.map((m) =>
      rowToCells(m, balances[m.id], texts.balanceHints.payable, texts.balanceHints.receivable)
    ),
    summary,
  };
}
