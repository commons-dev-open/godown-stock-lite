import type Database from "better-sqlite3";
import { roundDecimal } from "../../shared/numbers";

/**
 * Update daily_sales when invoice totals change.
 * delta: positive to add, negative to subtract.
 * Creates a row for sale_date if none exists.
 */
export function upsertDailySalesForInvoice(
  database: Database.Database,
  saleDate: string,
  delta: number
): void {
  const row = database
    .prepare(
      "SELECT id, invoice_sales, misc_sales FROM daily_sales WHERE sale_date = ? LIMIT 1"
    )
    .get(saleDate) as
    | { id: number; invoice_sales: number; misc_sales: number }
    | undefined;
  if (row) {
    const newInv = roundDecimal(
      Math.max(0, (row.invoice_sales ?? 0) + delta)
    );
    const misc = row.misc_sales ?? 0;
    const saleAmount = roundDecimal(newInv + misc);
    database
      .prepare(
        "UPDATE daily_sales SET invoice_sales = ?, sale_amount = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .run(newInv, saleAmount, row.id);
  } else {
    const invoiceSales = Math.max(0, roundDecimal(delta));
    const prevDay = database
      .prepare(
        "SELECT cash_in_hand FROM daily_sales WHERE sale_date < ? ORDER BY sale_date DESC LIMIT 1"
      )
      .get(saleDate) as { cash_in_hand: number } | undefined;
    const openingCash = prevDay?.cash_in_hand ?? 0;
    database
      .prepare(
        "INSERT INTO daily_sales (sale_date, sale_amount, cash_in_hand, invoice_sales, misc_sales) VALUES (?, ?, ?, ?, 0)"
      )
      .run(saleDate, invoiceSales, openingCash, invoiceSales);
  }
}
