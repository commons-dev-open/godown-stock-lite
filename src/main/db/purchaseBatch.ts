import type Database from "better-sqlite3";
import { roundDecimal } from "../../shared/numbers";
import { insertItemStockMovement } from "./itemStockMovements";

export interface CreditPurchaseLineInput {
  product_id: number;
  product_name?: string;
  quantity: number;
  amount: number;
  gst_rate?: number;
  gst_inclusive?: boolean;
  taxable_amount?: number;
  cgst_amount?: number;
  sgst_amount?: number;
}

export interface CreateCreditPurchaseBatchPayload {
  lender_id: number;
  transaction_date: string;
  notes?: string | null;
  lender_invoice_number?: string | null;
  invoice_file_path?: string | null;
  lines: CreditPurchaseLineInput[];
  pay_now?: {
    amount: number;
    payment_method?: string;
    reference_number?: string;
    notes?: string;
  };
}

/**
 * Inserts credit supplier_purchase + lines, stock IN, optional lender settlement.
 * Caller wraps in transaction if needed.
 */
export function createCreditPurchaseBatch(
  database: Database.Database,
  payload: CreateCreditPurchaseBatchPayload
): number[] {
  if (!payload.lines?.length) {
    throw new Error("At least one product line is required.");
  }
  const totalAmount = roundDecimal(
    payload.lines.reduce((s, ln) => s + roundDecimal(ln.amount), 0)
  );
  const payNowRaw =
    payload.pay_now != null
      ? roundDecimal(Number(payload.pay_now.amount) || 0)
      : 0;
  if (payNowRaw > totalAmount) {
    throw new Error("Pay now amount cannot exceed the credit purchase total.");
  }
  const payNowAmount = payNowRaw > 0 ? payNowRaw : 0;

  const pur = database
    .prepare(
      `INSERT INTO supplier_purchases (kind, lender_id, document_date, notes, lender_invoice_number, invoice_file_path, total_amount)
       VALUES ('credit', ?, ?, ?, ?, ?, ?)`
    )
    .run(
      payload.lender_id,
      payload.transaction_date,
      payload.notes ?? null,
      payload.lender_invoice_number ?? null,
      payload.invoice_file_path ?? null,
      totalAmount
    );
  const purchaseId = Number(pur.lastInsertRowid);
  const lineStmt = database.prepare(
    `INSERT INTO supplier_purchase_lines (purchase_id, product_id, quantity, unit, amount, gst_rate, gst_inclusive, taxable_amount, cgst_amount, sgst_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const unitStmt = database.prepare("SELECT unit FROM items WHERE id = ?");
  for (const line of payload.lines) {
    const qty = roundDecimal(line.quantity);
    if (qty <= 0) {
      throw new Error("Quantity must be positive.");
    }
    const itemRow = unitStmt.get(line.product_id) as
      | { unit: string }
      | undefined;
    if (!itemRow) {
      throw new Error(`Item not found: ${line.product_id}`);
    }
    const amount = roundDecimal(line.amount);
    const lr = lineStmt.run(
      purchaseId,
      line.product_id,
      qty,
      itemRow.unit,
      amount,
      line.gst_rate ?? 0,
      line.gst_inclusive ? 1 : 0,
      line.taxable_amount ?? amount,
      line.cgst_amount ?? 0,
      line.sgst_amount ?? 0
    );
    const lineId = Number(lr.lastInsertRowid);
    database
      .prepare(
        "UPDATE items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?"
      )
      .run(qty, line.product_id);
    insertItemStockMovement(database, {
      item_id: line.product_id,
      delta_qty: qty,
      reason: "purchase",
      ref_kind: "supplier_purchase_line",
      ref_id: lineId,
      occurred_at: payload.transaction_date,
      note: null,
    });
  }
  if (payNowAmount > 0) {
    const movementRes = database
      .prepare(
        `INSERT INTO lender_movements (lender_id, direction, amount, movement_date, notes, payment_method, reference_number)
         VALUES (?, 'out', ?, ?, ?, ?, ?)`
      )
      .run(
        payload.lender_id,
        payNowAmount,
        payload.transaction_date,
        payload.pay_now?.notes ?? null,
        payload.pay_now?.payment_method ?? null,
        payload.pay_now?.reference_number ?? null
      );
    const movementId = Number(movementRes.lastInsertRowid);
    database
      .prepare(
        "INSERT INTO lender_movement_allocations (movement_id, purchase_id, amount) VALUES (?, ?, ?)"
      )
      .run(movementId, purchaseId, payNowAmount);
  }
  return [purchaseId];
}

export interface CashPurchaseLineInput {
  product_id: number;
  quantity: number;
  amount: number;
}

export interface CreateCashPurchaseBatchPayload {
  transaction_date: string;
  notes?: string | null;
  lines: CashPurchaseLineInput[];
}

export function createCashPurchaseBatch(
  database: Database.Database,
  payload: CreateCashPurchaseBatchPayload
): number[] {
  if (!payload.lines?.length) {
    throw new Error("At least one product line is required.");
  }
  const totalAmount = roundDecimal(
    payload.lines.reduce((s, ln) => s + roundDecimal(ln.amount), 0)
  );
  const pur = database
    .prepare(
      `INSERT INTO supplier_purchases (kind, lender_id, document_date, notes, total_amount)
       VALUES ('cash', NULL, ?, ?, ?)`
    )
    .run(payload.transaction_date, payload.notes ?? null, totalAmount);
  const purchaseId = Number(pur.lastInsertRowid);
  const lineStmt = database.prepare(
    `INSERT INTO supplier_purchase_lines (purchase_id, product_id, quantity, unit, amount, gst_rate, gst_inclusive, taxable_amount, cgst_amount, sgst_amount)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?, 0, 0)`
  );
  const unitStmt = database.prepare("SELECT unit FROM items WHERE id = ?");
  for (const line of payload.lines) {
    const qty = roundDecimal(line.quantity);
    if (qty < 0) {
      throw new Error("Quantity is required and must be non-negative.");
    }
    if (line.amount < 0) {
      throw new Error("Amount must be non-negative.");
    }
    const itemRow = unitStmt.get(line.product_id) as
      | { unit: string }
      | undefined;
    if (!itemRow) {
      throw new Error(`Item not found: ${line.product_id}`);
    }
    const lamt = roundDecimal(line.amount);
    const lr = lineStmt.run(
      purchaseId,
      line.product_id,
      qty,
      itemRow.unit,
      lamt,
      lamt
    );
    const lineId = Number(lr.lastInsertRowid);
    database
      .prepare(
        "UPDATE items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?"
      )
      .run(qty, line.product_id);
    insertItemStockMovement(database, {
      item_id: line.product_id,
      delta_qty: qty,
      reason: "purchase",
      ref_kind: "supplier_purchase_line",
      ref_id: lineId,
      occurred_at: payload.transaction_date,
      note: null,
    });
  }
  return [purchaseId];
}
