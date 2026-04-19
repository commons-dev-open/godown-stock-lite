import type Database from "better-sqlite3";
import { roundDecimal } from "../../shared/numbers";
import { formatDateToIsoLocal } from "./dateIso";
import { createInvoiceWithLines } from "./invoiceCreate";
import { insertItemStockMovement } from "./itemStockMovements";
import { createPinHash } from "./pinHash";
import {
  createCashPurchaseBatch,
  createCreditPurchaseBatch,
} from "./purchaseBatch";
import { seedIfEmpty } from "./seed";

export interface TemplateEnrichCounts {
  products?: number;
  lenders?: number;
  purchases?: number;
  invoices?: number;
  users?: number;
}

export interface TemplateEnrichOptions {
  referenceDate: Date;
  /** Default 2; synthetic business dates fall in [today − N years, today]. */
  historyYears?: 1 | 2;
  counts?: TemplateEnrichCounts;
  dryRun?: boolean;
  /** When set, only inserts missing settings keys (never overwrites). */
  companyNameIfMissing?: string;
  ownerNameIfMissing?: string;
}

export interface TemplateEnrichReport {
  dryRun: boolean;
  insertedProducts: number;
  insertedLenders: number;
  insertedPurchases: number;
  insertedInvoices: number;
  insertedUsers: number;
  runToken: string;
  /** Starter rows inserted when the DB had no products yet (non–dry-run only). */
  bootstrapItemsAdded: number;
  /** Starter rows inserted when the DB had no lenders yet (non–dry-run only). */
  bootstrapLendersAdded: number;
}

const DEFAULT_COUNTS = {
  products: 200,
  lenders: 50,
  purchases: 20,
  invoices: 100,
  users: 30,
} as const;

function padNum(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

export function formatRunToken(referenceDate: Date): string {
  const y = referenceDate.getFullYear();
  const m = padNum(referenceDate.getMonth() + 1, 2);
  const d = padNum(referenceDate.getDate(), 2);
  return `D${y}${m}${d}`;
}

function gstinLike(stateCode: string, i: number): string {
  const digits = padNum(i % 10000, 4);
  return `${stateCode}AAAAA${digits}A1Z5`;
}

function mulberry32(seed: number): () => number {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(s: string): number {
  let h = 1779033703;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function randomIsoInWindow(
  referenceDate: Date,
  historyYears: 1 | 2,
  rng: () => number
): string {
  const end = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
    0,
    0,
    0
  );
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - historyYears);
  const spanDays =
    Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  const off = Math.floor(rng() * spanDays);
  const d = new Date(start);
  d.setDate(d.getDate() + off);
  return formatDateToIsoLocal(d);
}

function getSetting(
  database: Database.Database,
  key: string
): string | null {
  const row = database
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string | null } | undefined;
  return row?.value ?? null;
}

function setSettingIfMissing(
  database: Database.Database,
  key: string,
  value: string | undefined
): void {
  if (value === undefined || value.trim() === "") {
    return;
  }
  const existing = getSetting(database, key);
  if (existing != null && existing !== "") {
    return;
  }
  database
    .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
    .run(key, value.trim());
}

function resolveSuperadmin(database: Database.Database): number {
  const admin = database
    .prepare(
      "SELECT id FROM users WHERE role = 'superadmin' AND is_active = 1 LIMIT 1"
    )
    .get() as { id: number } | undefined;
  if (!admin) {
    throw new Error(
      "Template enricher needs an active superadmin user (complete onboarding first)."
    );
  }
  return admin.id;
}

function unitIdByName(
  database: Database.Database,
  unitName: string
): number | null {
  const row = database
    .prepare("SELECT id FROM units WHERE name = ?")
    .get(unitName) as { id: number } | undefined;
  return row?.id ?? null;
}

/**
 * If there are no products or no lenders yet (fresh company), insert a small
 * realistic starter set so template cloning has something to sample.
 */
function ensureBootstrapCatalog(
  database: Database.Database,
  superadminId: number
): { itemsAdded: number; lendersAdded: number } {
  seedIfEmpty(database);
  let itemsAdded = 0;
  let lendersAdded = 0;

  const itemCount = (
    database.prepare("SELECT COUNT(*) AS c FROM items").get() as { c: number }
  ).c;
  if (itemCount === 0) {
    const ins = database.prepare(
      `INSERT INTO items (
        name, code, unit, unit_id, reference_unit, quantity_per_primary, retail_primary_unit,
        selling_price, selling_price_unit, selling_price_unit_id, gst_rate, hsn_code,
        current_stock, reorder_level, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const bootstrapItems: {
      name: string;
      code: string;
      unit: string;
      reference_unit: string | null;
      quantity_per_primary: number | null;
      retail_primary_unit: string | null;
      selling_price: number;
      gst_rate: number;
      hsn_code: string;
      current_stock: number;
      reorder_level: number;
    }[] = [
      {
        name: "Basmati Rice 25kg Bag",
        code: "BOOT-RICE25",
        unit: "bags",
        reference_unit: "kilogram",
        quantity_per_primary: 25,
        retail_primary_unit: "kilogram",
        selling_price: 2200,
        gst_rate: 5,
        hsn_code: "10063090",
        current_stock: 40,
        reorder_level: 10,
      },
      {
        name: "Wheat Flour 50kg Bag",
        code: "BOOT-ATTA50",
        unit: "bags",
        reference_unit: "kilogram",
        quantity_per_primary: 50,
        retail_primary_unit: "kilogram",
        selling_price: 2100,
        gst_rate: 5,
        hsn_code: "11010000",
        current_stock: 35,
        reorder_level: 8,
      },
      {
        name: "Refined Oil 15L Jar",
        code: "BOOT-OIL15",
        unit: "jars",
        reference_unit: "liter",
        quantity_per_primary: 15,
        retail_primary_unit: "liter",
        selling_price: 3200,
        gst_rate: 5,
        hsn_code: "15121990",
        current_stock: 28,
        reorder_level: 6,
      },
      {
        name: "Crystal Sugar 50kg",
        code: "BOOT-SUG50",
        unit: "bags",
        reference_unit: "kilogram",
        quantity_per_primary: 50,
        retail_primary_unit: "kilogram",
        selling_price: 3000,
        gst_rate: 5,
        hsn_code: "17019900",
        current_stock: 22,
        reorder_level: 5,
      },
      {
        name: "Dust Tea 250g",
        code: "BOOT-TEA250",
        unit: "packets",
        reference_unit: null,
        quantity_per_primary: null,
        retail_primary_unit: null,
        selling_price: 120,
        gst_rate: 5,
        hsn_code: "09023020",
        current_stock: 200,
        reorder_level: 40,
      },
      {
        name: "Iodized Salt 1kg",
        code: "BOOT-SALT1",
        unit: "packets",
        reference_unit: null,
        quantity_per_primary: null,
        retail_primary_unit: null,
        selling_price: 22,
        gst_rate: 5,
        hsn_code: "25010010",
        current_stock: 300,
        reorder_level: 60,
      },
      {
        name: "Detergent Powder 500g",
        code: "BOOT-DET500",
        unit: "packets",
        reference_unit: null,
        quantity_per_primary: null,
        retail_primary_unit: null,
        selling_price: 95,
        gst_rate: 18,
        hsn_code: "34025011",
        current_stock: 150,
        reorder_level: 30,
      },
      {
        name: "Toor Dal 50kg",
        code: "BOOT-DAL50",
        unit: "bags",
        reference_unit: "kilogram",
        quantity_per_primary: 50,
        retail_primary_unit: "kilogram",
        selling_price: 6200,
        gst_rate: 5,
        hsn_code: "07136000",
        current_stock: 18,
        reorder_level: 4,
      },
      {
        name: "Glucose Biscuits Pack",
        code: "BOOT-BISC",
        unit: "packets",
        reference_unit: null,
        quantity_per_primary: null,
        retail_primary_unit: null,
        selling_price: 38,
        gst_rate: 5,
        hsn_code: "19053100",
        current_stock: 120,
        reorder_level: 24,
      },
      {
        name: "Chana Dal 50kg",
        code: "BOOT-CHANA50",
        unit: "bags",
        reference_unit: "kilogram",
        quantity_per_primary: 50,
        retail_primary_unit: "kilogram",
        selling_price: 5800,
        gst_rate: 5,
        hsn_code: "07132000",
        current_stock: 16,
        reorder_level: 4,
      },
    ];
    for (const row of bootstrapItems) {
      const uid = unitIdByName(database, row.unit);
      ins.run(
        row.name,
        row.code,
        row.unit,
        uid,
        row.reference_unit,
        row.quantity_per_primary,
        row.retail_primary_unit,
        roundDecimal(row.selling_price),
        null,
        null,
        row.gst_rate,
        row.hsn_code,
        row.current_stock,
        row.reorder_level,
        superadminId,
        superadminId
      );
      itemsAdded += 1;
    }
  }

  const lenderCount = (
    database.prepare("SELECT COUNT(*) AS c FROM lenders").get() as {
      c: number;
    }
  ).c;
  if (lenderCount === 0) {
    const ins = database.prepare(
      `INSERT INTO lenders (name, address, phone, gstin, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const bootstrapLenders: {
      name: string;
      address: string;
      phone: string;
      gstin: string;
    }[] = [
      {
        name: "Sharma Traders",
        address: "Burrabazar, Kolkata",
        phone: "9876543210",
        gstin: "19ABCDE1234F1Z5",
      },
      {
        name: "Gupta Wholesalers",
        address: "Howrah Market, Howrah",
        phone: "9876501234",
        gstin: "19FGHIJ5678K2Z6",
      },
      {
        name: "Roy & Sons",
        address: "Barasat Main Road, Barasat",
        phone: "9831000001",
        gstin: "19LMNOP9012Q3Z7",
      },
      {
        name: "Mukherjee Distributors",
        address: "Salt Lake, Sector 2, Kolkata",
        phone: "9831000002",
        gstin: "19RSTUV3456W4Z8",
      },
      {
        name: "Jain Agencies",
        address: "Burrabazar, Kolkata",
        phone: "9831000003",
        gstin: "19XYZAB7890C5Z9",
      },
    ];
    for (const row of bootstrapLenders) {
      ins.run(
        row.name,
        row.address,
        row.phone,
        row.gstin,
        superadminId,
        superadminId
      );
      lendersAdded += 1;
    }
  }

  return { itemsAdded, lendersAdded };
}

interface ItemTemplate {
  id: number;
  name: string;
  code: string | null;
  unit: string;
  unit_id: number | null;
  reference_unit: string | null;
  quantity_per_primary: number | null;
  retail_primary_unit: string | null;
  selling_price: number | null;
  selling_price_unit: string | null;
  selling_price_unit_id: number | null;
  gst_rate: number;
  hsn_code: string | null;
  reorder_level: number | null;
}

interface LenderTemplate {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  gstin: string | null;
}

interface InvoiceHeaderTemplate {
  customer_name: string | null;
  customer_address: string | null;
  customer_phone: string | null;
  notes: string | null;
}

export function enrichFromTemplates(
  database: Database.Database,
  options: TemplateEnrichOptions
): TemplateEnrichReport {
  const historyYears: 1 | 2 =
    options.historyYears === 1 ? 1 : options.historyYears === 2 ? 2 : 2;
  const counts = { ...DEFAULT_COUNTS, ...options.counts };
  const runToken = formatRunToken(options.referenceDate);
  const rng = mulberry32(seedFromString(runToken + String(counts.products)));

  const superadminId = resolveSuperadmin(database);

  if (options.dryRun) {
    return {
      dryRun: true,
      insertedProducts: counts.products ?? DEFAULT_COUNTS.products,
      insertedLenders: counts.lenders ?? DEFAULT_COUNTS.lenders,
      insertedPurchases: counts.purchases ?? DEFAULT_COUNTS.purchases,
      insertedInvoices: counts.invoices ?? DEFAULT_COUNTS.invoices,
      insertedUsers: counts.users ?? DEFAULT_COUNTS.users,
      runToken,
      bootstrapItemsAdded: 0,
      bootstrapLendersAdded: 0,
    };
  }

  if (options.companyNameIfMissing) {
    setSettingIfMissing(database, "company_name", options.companyNameIfMissing);
  }
  if (options.ownerNameIfMissing) {
    setSettingIfMissing(database, "owner_name", options.ownerNameIfMissing);
  }

  const bootstrap = ensureBootstrapCatalog(database, superadminId);

  const itemTemplates = database
    .prepare(
      "SELECT id, name, code, unit, unit_id, reference_unit, quantity_per_primary, retail_primary_unit, selling_price, selling_price_unit, selling_price_unit_id, gst_rate, hsn_code, reorder_level FROM items ORDER BY RANDOM() LIMIT 60"
    )
    .all() as ItemTemplate[];
  const lenderTemplates = database
    .prepare(
      "SELECT id, name, address, phone, gstin FROM lenders ORDER BY RANDOM() LIMIT 30"
    )
    .all() as LenderTemplate[];
  const invoiceTemplates = database
    .prepare(
      "SELECT customer_name, customer_address, customer_phone, notes FROM invoices ORDER BY RANDOM() LIMIT 40"
    )
    .all() as InvoiceHeaderTemplate[];
  const defaultInvoiceHdr: InvoiceHeaderTemplate = {
    customer_name: "Walk-in customer",
    customer_address: "Local market area",
    customer_phone: null,
    notes: null,
  };

  const insertItem = database.prepare(
    `INSERT INTO items (
      name, code, unit, unit_id, reference_unit, quantity_per_primary, retail_primary_unit,
      selling_price, selling_price_unit, selling_price_unit_id, gst_rate, hsn_code,
      current_stock, reorder_level, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const copyOtherUnits = database.prepare(
    `INSERT INTO item_other_units (item_id, unit, unit_id, sort_order)
     SELECT ?, unit, unit_id, sort_order FROM item_other_units WHERE item_id = ?`
  );
  const copyItemConvs = database.prepare(
    `INSERT INTO item_unit_conversions (item_id, to_unit, to_unit_id, factor)
     SELECT ?, to_unit, to_unit_id, factor FROM item_unit_conversions WHERE item_id = ?`
  );

  const insertLender = database.prepare(
    `INSERT INTO lenders (name, address, phone, gstin, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const insertUser = database.prepare(
    `INSERT INTO users (name, pin_hash, role, pin_is_temporary, is_active, created_by)
     VALUES (?, ?, 'user', 1, 1, ?)`
  );

  const nProducts = counts.products ?? DEFAULT_COUNTS.products;
  const nLenders = counts.lenders ?? DEFAULT_COUNTS.lenders;
  const nPurchases = counts.purchases ?? DEFAULT_COUNTS.purchases;
  const nInvoices = counts.invoices ?? DEFAULT_COUNTS.invoices;
  const nUsers = counts.users ?? DEFAULT_COUNTS.users;

  const newItemIds: number[] = [];
  const newLenderIds: number[] = [];

  const run = database.transaction(() => {
    for (let i = 0; i < nProducts; i++) {
      const tpl = itemTemplates[i % itemTemplates.length];
      if (!tpl) {
        throw new Error("No item templates");
      }
      const omitCode = rng() < 0.22;
      const omitHsn = rng() < 0.18;
      const omitReorder = rng() < 0.25;
      const omitSellingPrice = rng() < 0.12;
      const baseStock = 400 + Math.floor(rng() * 600) + (i % 200);
      const code =
        omitCode || !tpl.code
          ? null
          : `${String(tpl.code).slice(0, 12)}-${runToken}-${padNum(i, 4)}`;
      const hsn = omitHsn ? null : tpl.hsn_code;
      const reorder = omitReorder ? null : tpl.reorder_level;
      const sellPrice = omitSellingPrice ? null : tpl.selling_price;
      const name = `${tpl.name} [${runToken}-${padNum(i, 4)}]`;
      const res = insertItem.run(
        name,
        code,
        tpl.unit,
        tpl.unit_id,
        tpl.reference_unit,
        tpl.quantity_per_primary,
        tpl.retail_primary_unit,
        sellPrice != null ? roundDecimal(sellPrice) : null,
        tpl.selling_price_unit,
        tpl.selling_price_unit_id,
        tpl.gst_rate ?? 0,
        hsn,
        baseStock,
        reorder != null ? roundDecimal(reorder) : null,
        superadminId,
        superadminId
      );
      const newId = Number(res.lastInsertRowid);
      newItemIds.push(newId);
      copyOtherUnits.run(newId, tpl.id);
      copyItemConvs.run(newId, tpl.id);
      insertItemStockMovement(database, {
        item_id: newId,
        delta_qty: baseStock,
        reason: "adjustment",
        ref_kind: "item_create",
        ref_id: newId,
        occurred_at: formatDateToIsoLocal(options.referenceDate),
        note: "template enricher",
      });
    }

    const phoneSeqBase =
      700_000_000 +
      (options.referenceDate.getFullYear() % 100) * 1_000_000 +
      (seedFromString(runToken) % 900_000);
    for (let i = 0; i < nLenders; i++) {
      const tpl = lenderTemplates[i % lenderTemplates.length];
      if (!tpl) {
        throw new Error("No lender templates");
      }
      const phone = `98${padNum(phoneSeqBase + i, 8)}`;
      const name = `${tpl.name} (${runToken} L${padNum(i, 3)})`;
      const address =
        tpl.address != null && tpl.address.length > 0
          ? `${tpl.address} — Block ${(i % 40) + 1}`
          : `Godown row ${(i % 20) + 1}, WB`;
      const gstin = tpl.gstin ?? gstinLike("19", i + phoneSeqBase);
      const lr = insertLender.run(
        name,
        address,
        phone,
        gstin,
        superadminId,
        superadminId
      );
      newLenderIds.push(Number(lr.lastInsertRowid));
    }

    for (let p = 0; p < nPurchases; p++) {
      const docDate = randomIsoInWindow(
        options.referenceDate,
        historyYears,
        rng
      );
      const isCredit = p % 3 !== 0;
      const lineCount = p % 5 === 0 ? 1 : p % 5 === 1 ? 2 : p % 5 === 2 ? 3 : 2;
      if (isCredit) {
        const lenderId = newLenderIds[p % newLenderIds.length] ?? newLenderIds[0];
        const lines = [];
        for (let ln = 0; ln < lineCount; ln++) {
          const pid = newItemIds[(p * 3 + ln + 7) % newItemIds.length] ?? newItemIds[0];
          const qty = roundDecimal(4 + rng() * 40 + (ln % 5));
          const unitPrice = 25 + Math.floor(rng() * 180) + (p % 11);
          const amount = roundDecimal(qty * unitPrice);
          const gstRate = 5;
          const taxable = roundDecimal(amount / (1 + gstRate / 100));
          const half = roundDecimal((amount - taxable) / 2);
          lines.push({
            product_id: pid,
            quantity: qty,
            amount,
            gst_rate: gstRate,
            gst_inclusive: true,
            taxable_amount: taxable,
            cgst_amount: half,
            sgst_amount: half,
          });
        }
        const lineTotal = roundDecimal(
          lines.reduce((s, l) => s + l.amount, 0)
        );
        const payNow =
          p % 7 === 0
            ? {
                amount: roundDecimal(Math.min(lineTotal * 0.25, lineTotal)),
                payment_method: "UPI",
                reference_number: `ENR-${runToken}-${p}`,
                notes: "Part payment at gate",
              }
            : undefined;
        createCreditPurchaseBatch(database, {
          lender_id: lenderId,
          transaction_date: docDate,
          notes: `Synthetic credit purchase ${runToken}-${p}`,
          lender_invoice_number: `SUP-${runToken}-${padNum(p, 4)}`,
          invoice_file_path: null,
          lines,
          pay_now: payNow,
        });
      } else {
        const lines = [];
        for (let ln = 0; ln < lineCount; ln++) {
          const pid = newItemIds[(p * 2 + ln) % newItemIds.length] ?? newItemIds[0];
          const qty = roundDecimal(2 + rng() * 25);
          const amount = roundDecimal(qty * (18 + rng() * 90));
          lines.push({ product_id: pid, quantity: qty, amount });
        }
        createCashPurchaseBatch(database, {
          transaction_date: docDate,
          notes: `Synthetic cash purchase ${runToken}-${p}`,
          lines,
        });
      }
    }

    const itemMeta = database.prepare(
      "SELECT id, name, unit, selling_price, gst_rate FROM items WHERE id = ?"
    );
    for (let inv = 0; inv < nInvoices; inv++) {
      const invDate = randomIsoInWindow(
        options.referenceDate,
        historyYears,
        rng
      );
      const hdr =
        invoiceTemplates.length > 0
          ? invoiceTemplates[inv % invoiceTemplates.length]!
          : defaultInvoiceHdr;
      const nLines = 1 + (inv % 4);
      const lines = [];
      const custPhone = `97${padNum(
        (60000000 + inv * 31 + (phoneSeqBase % 90000000)) % 100000000,
        8
      )}`;
      for (let ln = 0; ln < nLines; ln++) {
        const pid =
          newItemIds[(inv * 2 + ln * 5 + 3) % newItemIds.length] ?? newItemIds[0];
        const meta = itemMeta.get(pid) as
          | {
              id: number;
              name: string;
              unit: string;
              selling_price: number | null;
              gst_rate: number;
            }
          | undefined;
        if (!meta) {
          continue;
        }
        const qty = roundDecimal(1 + rng() * 4 + (ln % 2));
        const price =
          meta.selling_price != null && meta.selling_price > 0
            ? roundDecimal(meta.selling_price * (0.85 + rng() * 0.25))
            : roundDecimal(35 + rng() * 120);
        const amount = roundDecimal(qty * price);
        lines.push({
          product_id: pid,
          product_name: meta.name,
          quantity: qty,
          unit: meta.unit,
          price,
          amount,
          price_entered_as: "per_unit" as const,
          gst_rate: meta.gst_rate ?? 0,
          gst_inclusive: false,
          taxable_amount: amount,
          cgst_amount: 0,
          sgst_amount: 0,
        });
      }
      if (lines.length === 0) {
        continue;
      }
      createInvoiceWithLines(database, {
        customer_name: hdr.customer_name,
        customer_address: hdr.customer_address,
        customer_phone: custPhone,
        customer_gstin: null,
        invoice_date: invDate,
        notes: hdr.notes ?? `Synthetic invoice ${runToken}-${inv}`,
        order_discount_amount: (() => {
          if (inv % 13 !== 0) {
            return 0;
          }
          const sub = lines.reduce((s, l) => s + roundDecimal(l.amount), 0);
          const cap = Math.max(0, roundDecimal(sub * 0.12));
          return Math.min(roundDecimal(15 + rng() * 40), cap);
        })(),
        round_to_whole: inv % 17 === 0,
        coupon_code: null,
        created_by: superadminId,
        lines,
      });
    }

    const enrichUserPinHash = createPinHash("0000");
    for (let u = 0; u < nUsers; u++) {
      const name = `Enrich User ${runToken} ${padNum(u, 2)}`;
      insertUser.run(name, enrichUserPinHash, superadminId);
    }
  });

  run();

  return {
    dryRun: false,
    insertedProducts: nProducts,
    insertedLenders: nLenders,
    insertedPurchases: nPurchases,
    insertedInvoices: nInvoices,
    insertedUsers: nUsers,
    runToken,
    bootstrapItemsAdded: bootstrap.itemsAdded,
    bootstrapLendersAdded: bootstrap.lendersAdded,
  };
}
