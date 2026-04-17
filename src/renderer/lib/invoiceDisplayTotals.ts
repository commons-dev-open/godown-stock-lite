import type { Invoice, InvoiceLine } from "../../shared/types";
import { formatDecimal } from "../../shared/numbers";

export function invoiceLinesSubtotal(lines: InvoiceLine[]): number {
  return lines.reduce(
    (sum, line) => sum + (line.amount ?? line.quantity * line.price),
    0
  );
}

export function invoiceNetTotal(
  invoice: Pick<Invoice, "order_discount_amount" | "round_to_whole">,
  lines: InvoiceLine[]
): number {
  const subtotal = invoiceLinesSubtotal(lines);
  const orderDisc = invoice.order_discount_amount ?? 0;
  let total = subtotal - orderDisc;
  if (invoice.round_to_whole) {
    total = Math.round(total);
  } else {
    total = Math.round(total * 100) / 100;
  }
  return total;
}

/** Short human-readable note for persisted line-level discounts (view / print / PDF). */
export function formatInvoiceLineDiscountNote(line: InvoiceLine): string | null {
  const parts: string[] = [];
  if ((line.line_discount_percent ?? 0) > 0) {
    parts.push(`${formatDecimal(line.line_discount_percent ?? 0)}% off`);
  }
  if ((line.line_discount_flat ?? 0) > 0) {
    parts.push(`Flat ₹${formatDecimal(line.line_discount_flat ?? 0)}`);
  }
  const buyQty = line.bogo_buy_qty ?? 0;
  const getQty = line.bogo_get_qty ?? 0;
  if (buyQty > 0 && getQty > 0) {
    parts.push(
      `BOGO ${formatDecimal(buyQty)}+${formatDecimal(getQty)} @ ${formatDecimal(line.bogo_discount_percent ?? 100)}%`
    );
  }
  if (parts.length === 0) {
    return null;
  }
  return parts.join(", ");
}

export function invoiceProductLabelWithDiscount(line: InvoiceLine): string {
  const name = line.product_name ?? "";
  const note = formatInvoiceLineDiscountNote(line);
  if (!note) {
    return name;
  }
  const base = name.trim() || "Item";
  return `${base}\n(${note})`;
}
