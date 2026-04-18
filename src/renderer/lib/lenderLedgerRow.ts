import type {
  LedgerRow,
  MahajanDeposit,
  MahajanLend,
  Purchase,
} from "../../shared/types";

/** Row shape returned by `getMahajanLedgerPage` / lender ledger SQL. */
export interface LenderLedgerPageRow {
  type: string;
  id: number;
  lender_id: number | null;
  lender_name: string | null;
  mahajan_id?: number | null;
  mahajan_name?: string | null;
  product_id: number | null;
  transaction_date: string;
  product_name: string | null;
  quantity: number | null;
  amount: number;
  notes: string | null;
  lender_invoice_number?: string | null;
  invoice_file_path?: string | null;
  payment_method?: string | null;
  reference_number?: string | null;
  /** Supplier purchase header id when row is a purchase line or has a linked allocation. */
  purchase_id?: number | null;
}

export type PurchaseTableRow = Purchase & { product_name?: string };

export interface LedgerDescriptionLabels {
  settlement: string;
  cashPurchase: string;
  creditPurchase: string;
  lenderRefund?: string;
}

export function ledgerDescriptionFromPageRow(
  row: LenderLedgerPageRow,
  labels?: LedgerDescriptionLabels
): string {
  if (row.type === "settlement") {
    return labels?.settlement ?? "Settlement";
  }
  if (row.type === "lender_refund") {
    return labels?.lenderRefund ?? "Refund from supplier";
  }
  if (row.type === "cash_purchase") {
    return row.product_name?.trim() || labels?.cashPurchase || "Cash purchase";
  }
  return row.product_name?.trim() || labels?.creditPurchase || "Credit purchase";
}

/** Minimal `LedgerRow` for CSV/PDF/print helpers that expect `description`. */
export function pageRowToLedgerRow(
  row: LenderLedgerPageRow,
  labels?: LedgerDescriptionLabels
): LedgerRow {
  return {
    id: row.id,
    type: row.type as LedgerRow["type"],
    transaction_date: row.transaction_date,
    amount: row.amount,
    description: ledgerDescriptionFromPageRow(row, labels),
  };
}

export function toLendRecord(row: LenderLedgerPageRow): MahajanLend {
  return {
    id: row.id,
    lender_id: row.lender_id ?? row.mahajan_id ?? 0,
    product_id: row.product_id,
    product_name: row.product_name,
    quantity: row.quantity ?? 0,
    transaction_date: row.transaction_date,
    amount: row.amount,
    notes: row.notes,
    lender_invoice_number: row.lender_invoice_number,
    invoice_file_path: row.invoice_file_path,
    created_at: "",
    updated_at: "",
  };
}

export function toDepositRecord(row: LenderLedgerPageRow): MahajanDeposit {
  return {
    id: row.id,
    lender_id: row.lender_id ?? row.mahajan_id ?? 0,
    transaction_date: row.transaction_date,
    amount: row.amount,
    notes: row.notes,
    payment_method: row.payment_method ?? null,
    reference_number: row.reference_number ?? null,
    created_at: "",
    updated_at: "",
  };
}

export function toPurchaseRecord(row: LenderLedgerPageRow): PurchaseTableRow {
  return {
    id: row.id,
    product_id: row.product_id ?? 0,
    product_name: row.product_name ?? undefined,
    transaction_date: row.transaction_date,
    quantity: row.quantity ?? 0,
    amount: row.amount,
    notes: row.notes,
    created_at: "",
    updated_at: "",
  };
}
