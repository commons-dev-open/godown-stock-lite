import type { Invoice, InvoiceLine } from "../../shared/types";
import { formatDecimal } from "../../shared/numbers";
import i18n, { type SupportedLocale } from "../i18n";

export interface InvoiceLineNotesLocaleOpts {
  /** When set, line discount notes use this locale (PDF / browser printout). */
  lineNotesLocale?: SupportedLocale;
}

function invT(
  key: string,
  options: Record<string, string | number | boolean | null | undefined> | undefined,
  lineNotesLocale: InvoiceLineNotesLocaleOpts["lineNotesLocale"]
): string {
  if (lineNotesLocale === "en" || lineNotesLocale === "hi" || lineNotesLocale === "bn") {
    const te = i18n.getFixedT(lineNotesLocale, "invoices") as (
      k: string,
      o?: Record<string, unknown>
    ) => string;
    return options ? te(key, options) : te(key);
  }
  const translate = i18n.t as (
    k: string,
    o?: Record<string, unknown>
  ) => string;
  return options
    ? translate(key, { ns: "invoices", ...options })
    : translate(key, { ns: "invoices" });
}

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
export function formatInvoiceLineDiscountNote(
  line: InvoiceLine,
  opts?: InvoiceLineNotesLocaleOpts
): string | null {
  const loc = opts?.lineNotesLocale;
  const parts: string[] = [];
  if ((line.line_discount_percent ?? 0) > 0) {
    parts.push(
      invT(
        "lineNotes.percentOff",
        {
          pct: formatDecimal(line.line_discount_percent ?? 0),
        },
        loc
      )
    );
  }
  if ((line.line_discount_flat ?? 0) > 0) {
    parts.push(
      invT(
        "lineNotes.flatOff",
        {
          amount: formatDecimal(line.line_discount_flat ?? 0),
        },
        loc
      )
    );
  }
  const buyQty = line.bogo_buy_qty ?? 0;
  const getQty = line.bogo_get_qty ?? 0;
  if (buyQty > 0 && getQty > 0) {
    parts.push(
      invT(
        "lineNotes.bogo",
        {
          buy: formatDecimal(buyQty),
          get: formatDecimal(getQty),
          pct: formatDecimal(line.bogo_discount_percent ?? 100),
        },
        loc
      )
    );
  }
  if (parts.length === 0) {
    return null;
  }
  return parts.join(invT("lineNotes.listJoin", undefined, loc));
}

export function invoiceProductLabelWithDiscount(
  line: InvoiceLine,
  opts?: InvoiceLineNotesLocaleOpts
): string {
  const name = line.product_name ?? "";
  const note = formatInvoiceLineDiscountNote(line, opts);
  if (!note) {
    return name;
  }
  const base =
    name.trim() || invT("lineNotes.defaultItemName", undefined, opts?.lineNotesLocale);
  return `${base}\n(${note})`;
}
