import type Database from "better-sqlite3";

export interface ItemStockMovementInsert {
  item_id: number;
  delta_qty: number;
  reason: string;
  ref_kind: string | null;
  ref_id: number | null;
  occurred_at: string;
  note: string | null;
}

export function insertItemStockMovement(
  db: Database.Database,
  row: ItemStockMovementInsert
): void {
  db.prepare(
    `INSERT INTO item_stock_movements (item_id, delta_qty, reason, ref_kind, ref_id, occurred_at, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.item_id,
    row.delta_qty,
    row.reason,
    row.ref_kind,
    row.ref_id,
    row.occurred_at,
    row.note
  );
}

export function deleteItemStockMovementsByRef(
  db: Database.Database,
  refKind: string,
  refId: number
): void {
  db.prepare(
    "DELETE FROM item_stock_movements WHERE ref_kind = ? AND ref_id = ?"
  ).run(refKind, refId);
}

export function deleteItemStockMovementsForInvoice(
  db: Database.Database,
  invoiceId: number
): void {
  db.prepare(
    `DELETE FROM item_stock_movements
     WHERE ref_kind = 'invoice_line'
       AND ref_id IN (SELECT id FROM invoice_lines WHERE invoice_id = ?)`
  ).run(invoiceId);
}
