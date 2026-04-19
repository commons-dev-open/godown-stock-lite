import type Database from "better-sqlite3";
import { roundDecimal } from "../../shared/numbers";
import {
  convertToPrimaryQuantity,
  type ConversionRow,
  type ItemConversionRow,
} from "../../shared/unitConversion";
import { upsertCustomer } from "./customers";
import { upsertDailySalesForInvoice } from "./dailySales";
import { insertItemStockMovement } from "./itemStockMovements";
import {
  getItemUnitConversions,
  getUnitConversionsRows,
} from "./unitConversionQueries";

export interface CreateInvoiceLineInput {
  product_id: number;
  product_name: string;
  quantity: number;
  unit: string;
  price: number;
  amount: number;
  price_entered_as: "per_unit" | "total";
  price_unit?: string | null;
  gst_rate?: number;
  gst_inclusive?: boolean;
  taxable_amount?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  hsn_code?: string | null;
  line_discount_percent?: number;
  line_discount_flat?: number;
  bogo_buy_qty?: number | null;
  bogo_get_qty?: number | null;
  bogo_discount_percent?: number;
}

export interface CreateInvoicePayload {
  customer_name?: string | null;
  customer_address?: string | null;
  customer_phone?: string | null;
  customer_gstin?: string | null;
  invoice_date: string;
  notes?: string | null;
  order_discount_amount?: number;
  round_to_whole?: boolean | number;
  coupon_code?: string | null;
  created_by?: number | null;
  lines: CreateInvoiceLineInput[];
}

export interface CreateInvoiceResult {
  invoiceId: number;
  invoiceNumber: string;
}

/**
 * Creates invoice + lines, stock movements, item stock updates, daily_sales row.
 * Caller must wrap in db.transaction() if needed.
 */
export function createInvoiceWithLines(
  database: Database.Database,
  payload: CreateInvoicePayload
): CreateInvoiceResult {
  if (!payload.lines?.length) {
    throw new Error("At least one line is required.");
  }
  for (const line of payload.lines) {
    if (line.quantity <= 0) {
      throw new Error(
        `Quantity must be positive for ${line.product_name ?? "item"}.`
      );
    }
    if (line.price < 0) {
      throw new Error(
        `Price cannot be negative for ${line.product_name ?? "item"}.`
      );
    }
  }

  const year = payload.invoice_date.slice(0, 4);
  const prefix = `INV-${year}-`;
  const prefixLen = prefix.length;
  const maxSeq = database
    .prepare(
      "SELECT COALESCE(MAX(CAST(SUBSTR(invoice_number, ?) AS INTEGER)), 0) AS n FROM invoices WHERE invoice_number LIKE ?"
    )
    .get(prefixLen + 1, prefix + "%") as { n: number } | undefined;
  const nextSeq = (maxSeq?.n ?? 0) + 1;
  const invoiceNumber = `${prefix}${String(nextSeq).padStart(4, "0")}`;
  const conversions: ConversionRow[] = getUnitConversionsRows(database);
  const itemInfoStmt = database.prepare(
    "SELECT id, name, unit, reference_unit, quantity_per_primary, current_stock FROM items WHERE id = ?"
  );
  const stockDeltaByItem = new Map<
    number,
    { name: string; delta: number }
  >();

  let customerId: number | null = null;
  const customerPhone =
    typeof payload.customer_phone === "string" &&
    payload.customer_phone.trim()
      ? payload.customer_phone.trim()
      : null;
  if (customerPhone) {
    customerId = upsertCustomer(
      database,
      customerPhone,
      payload.customer_name ?? null,
      payload.customer_address ?? null,
      payload.customer_gstin ?? null
    );
  }

  const r = database
    .prepare(
      "INSERT INTO invoices (invoice_number, customer_name, customer_address, customer_phone, customer_id, invoice_date, notes, order_discount_amount, round_to_whole, coupon_code, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      invoiceNumber,
      payload.customer_name ?? null,
      payload.customer_address ?? null,
      customerPhone,
      customerId,
      payload.invoice_date,
      payload.notes ?? null,
      roundDecimal(payload.order_discount_amount ?? 0),
      payload.round_to_whole ? 1 : 0,
      payload.coupon_code ?? null,
      payload.created_by ?? null
    );
  const invoiceId = r.lastInsertRowid as number;
  const getUnitId = database.prepare("SELECT id FROM units WHERE name = ?");
  const stmt = database.prepare(
    "INSERT INTO invoice_lines (invoice_id, product_id, product_name, quantity, unit, unit_id, price, price_unit, amount, price_entered_as, gst_rate, gst_inclusive, taxable_amount, cgst_amount, sgst_amount, hsn_code, line_discount_percent, line_discount_flat, bogo_buy_qty, bogo_get_qty, bogo_discount_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  for (const line of payload.lines) {
    const unitId =
      (getUnitId.get(line.unit ?? "") as { id: number } | undefined)?.id ??
      null;
    const gstRate = line.gst_rate ?? 0;
    const gstInclusive = line.gst_inclusive ?? false;
    const taxableAmount = line.taxable_amount ?? 0;
    const cgstAmount = line.cgst_amount ?? 0;
    const sgstAmount = line.sgst_amount ?? 0;
    const lineDiscPct = line.line_discount_percent ?? 0;
    const lineDiscFlat = line.line_discount_flat ?? 0;
    const bogoBuy = line.bogo_buy_qty ?? null;
    const bogoGet = line.bogo_get_qty ?? null;
    const bogoPct = line.bogo_discount_percent ?? 100;
    const lineRun = stmt.run(
      invoiceId,
      line.product_id,
      line.product_name ?? null,
      roundDecimal(line.quantity, 6),
      line.unit ?? "",
      unitId,
      roundDecimal(line.price),
      line.price_unit ?? null,
      roundDecimal(line.amount),
      line.price_entered_as ?? "per_unit",
      gstRate,
      gstInclusive ? 1 : 0,
      roundDecimal(taxableAmount),
      roundDecimal(cgstAmount),
      roundDecimal(sgstAmount),
      line.hsn_code ?? null,
      lineDiscPct,
      lineDiscFlat,
      bogoBuy,
      bogoGet,
      bogoPct
    );
    const invoiceLineId = Number(lineRun.lastInsertRowid);

    if (line.product_id > 0) {
      const itemRow = itemInfoStmt.get(line.product_id) as
        | {
            id: number;
            name: string;
            unit: string;
            reference_unit: string | null;
            quantity_per_primary: number | null;
            current_stock: number;
          }
        | undefined;
      if (!itemRow) {
        throw new Error("Product not found for invoice line.");
      }
      const itemConvs: ItemConversionRow[] = getItemUnitConversions(
        database,
        itemRow.id
      );
      const conv = convertToPrimaryQuantity(
        conversions,
        {
          unit: itemRow.unit,
          reference_unit: itemRow.reference_unit,
          quantity_per_primary: itemRow.quantity_per_primary,
          item_conversions: itemConvs.length > 0 ? itemConvs : undefined,
        },
        line.quantity,
        line.unit
      );
      if ("error" in conv) {
        throw new Error(
          `Cannot deduct stock for ${itemRow.name}: ${conv.error}`
        );
      }
      const prev = stockDeltaByItem.get(itemRow.id)?.delta ?? 0;
      stockDeltaByItem.set(itemRow.id, {
        name: itemRow.name,
        delta: prev - conv.primaryQuantity,
      });
      insertItemStockMovement(database, {
        item_id: line.product_id,
        delta_qty: -conv.primaryQuantity,
        reason: "invoice_sale",
        ref_kind: "invoice_line",
        ref_id: invoiceLineId,
        occurred_at: payload.invoice_date,
        note: null,
      });
    }
  }

  if (stockDeltaByItem.size > 0) {
    const stockStmt = database.prepare(
      "SELECT current_stock FROM items WHERE id = ?"
    );
    const updateStmt = database.prepare(
      "UPDATE items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?"
    );
    for (const [itemId, info] of stockDeltaByItem) {
      const row = stockStmt.get(itemId) as
        | { current_stock: number }
        | undefined;
      if (!row) {
        continue;
      }
      const newStock = row.current_stock + info.delta;
      if (newStock < -0.005) {
        throw new Error(
          `Insufficient stock for ${info.name}. Current: ${row.current_stock}, required: ${-info.delta}.`
        );
      }
      if (info.delta !== 0) {
        updateStmt.run(info.delta, itemId);
      }
    }
  }

  const subtotal = payload.lines.reduce(
    (s, l) => s + roundDecimal(l.amount),
    0
  );
  const orderDisc = roundDecimal(payload.order_discount_amount ?? 0);
  let invoiceTotal = subtotal - orderDisc;
  if (payload.round_to_whole) {
    invoiceTotal = Math.round(invoiceTotal);
  } else {
    invoiceTotal = roundDecimal(invoiceTotal);
  }
  upsertDailySalesForInvoice(database, payload.invoice_date, invoiceTotal);

  return { invoiceId, invoiceNumber };
}
