import type Database from "better-sqlite3";
import { createSchema } from "./schema";
import { seedIfEmpty } from "./seed";

export interface SeedDummyBulkOptions {
  /** Target row count for major business tables (default 250). */
  rowsPerEntity?: number;
}

function padNum(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

/** 15-char GSTIN-style id (test data; not checksum-validated). */
function gstinLike(stateCode: string, i: number): string {
  const digits = padNum(i % 10000, 4);
  return `${stateCode}AAAAA${digits}A1Z5`;
}

function indianMobile(i: number): string {
  const tail = padNum(10000000 + (i % 89999999), 8);
  return `98${tail}`;
}

const CUSTOMER_FIRST = [
  "Ananya",
  "Bijoy",
  "Chitra",
  "Debashis",
  "Esha",
  "Farhan",
  "Gita",
  "Harish",
  "Indrani",
  "Jayanta",
  "Kabir",
  "Lakshmi",
  "Manas",
  "Nandini",
  "Omkar",
  "Pallavi",
  "Rahul",
  "Soma",
  "Tanmoy",
  "Usha",
] as const;

const SHOP_SUFFIX = [
  "Stores",
  "Provision",
  "General Stores",
  "Kirana",
  "Traders",
  "Enterprise",
  "Corner Shop",
  "Mart",
  "Sales",
  "Agency",
] as const;

const AREAS = [
  "Burrabazar, Kolkata",
  "Bagbazar, Kolkata",
  "Lake Town, Kolkata",
  "Salt Lake Sector V, Kolkata",
  "Howrah Maidan, Howrah",
  "Barasat Station Road, Barasat",
  "Dumdum Cantonment",
  "Sodepur, North 24 Parganas",
  "Kankurgachi, Kolkata",
  "Behala Chowrasta, Kolkata",
  "Gariahat Market, Kolkata",
  "New Town Action Area I",
  "Rajarhat Main Road",
  "Sonarpur Bazar",
  "Tollygunge Metro",
] as const;

const LENDER_PREFIX = [
  "Sharma",
  "Gupta",
  "Roy",
  "Mukherjee",
  "Sen",
  "Banerjee",
  "Das",
  "Jain",
  "Patel",
  "Singh",
  "Yadav",
  "Chatterjee",
  "Bose",
  "Nair",
  "Reddy",
] as const;

const LENDER_SUFFIX = [
  "Wholesalers",
  "Distributors",
  "Trading Co.",
  "Supply House",
  "Agencies",
  "& Sons",
  "Brothers",
  "Mart",
  "Depot",
  "Corporation",
] as const;

const ITEM_BLUEPRINTS: {
  name: string;
  codePrefix: string;
  unit: string;
  gstRate: number;
  hsn: string;
  priceLo: number;
  priceHi: number;
}[] = [
  {
    name: "Basmati Rice",
    codePrefix: "RICE",
    unit: "bags",
    gstRate: 5,
    hsn: "10063090",
    priceLo: 1600,
    priceHi: 2200,
  },
  {
    name: "Whole Wheat Atta",
    codePrefix: "ATTA",
    unit: "bags",
    gstRate: 5,
    hsn: "11010000",
    priceLo: 1800,
    priceHi: 2400,
  },
  {
    name: "Refined Sunflower Oil",
    codePrefix: "OIL",
    unit: "jars",
    gstRate: 5,
    hsn: "15121990",
    priceLo: 2800,
    priceHi: 3600,
  },
  {
    name: "Crystal Sugar",
    codePrefix: "SUGAR",
    unit: "bags",
    gstRate: 5,
    hsn: "17019900",
    priceLo: 2600,
    priceHi: 3200,
  },
  {
    name: "Dust Tea",
    codePrefix: "TEA",
    unit: "packets",
    gstRate: 5,
    hsn: "09023020",
    priceLo: 85,
    priceHi: 140,
  },
  {
    name: "Iodized Salt",
    codePrefix: "SALT",
    unit: "packets",
    gstRate: 5,
    hsn: "25010010",
    priceLo: 16,
    priceHi: 24,
  },
  {
    name: "Glucose Biscuits",
    codePrefix: "BISC",
    unit: "packets",
    gstRate: 5,
    hsn: "19053100",
    priceLo: 28,
    priceHi: 45,
  },
  {
    name: "Detergent Powder",
    codePrefix: "DET",
    unit: "packets",
    gstRate: 18,
    hsn: "34025011",
    priceLo: 90,
    priceHi: 160,
  },
  {
    name: "Toor Dal",
    codePrefix: "DAL",
    unit: "bags",
    gstRate: 5,
    hsn: "07136000",
    priceLo: 5200,
    priceHi: 6800,
  },
  {
    name: "Chana Dal",
    codePrefix: "CHANA",
    unit: "bags",
    gstRate: 5,
    hsn: "07132000",
    priceLo: 4800,
    priceHi: 6200,
  },
];

const EXTRA_UNIT_TYPE_LABELS = [
  "Packaging",
  "Depot handling",
  "Cold chain",
  "Loose retail",
  "Institutional pack",
  "Export lot",
] as const;

const SALE_NOTES = [
  "Regular weekday trade",
  "Good footfall after local fair",
  "Slower day — rain",
  "Stock clearance push",
  "Festival week — higher cash",
  "Mixed wholesale and retail",
  "Credit sales higher than usual",
  "Short day — staff leave",
  "End-of-month rush",
  "Supplier delay — lower sales",
] as const;

const CREDIT_NOTES = [
  "Stock received against supplier invoice",
  "Partial truck load — balance next week",
  "Quality check cleared at gate",
  "Price revision effective this lot",
  "Returnable crates — counted at unload",
  "GST invoice filed with purchase register",
  "Seasonal rate — agreed verbally",
  "Promotional slab pricing",
] as const;

const SETTLEMENT_NOTES = [
  "NEFT settlement — ref on bank SMS",
  "Part payment against April statement",
  "Cash dropped at supplier office",
  "UPI settlement — same day",
  "Adjusted against older credit note",
  "Cheque cleared — HDFC",
] as const;

const COUPON_VERBS = [
  "WELCOME",
  "SAVE",
  "MEGA",
  "HOLI",
  "DIWALI",
  "LOYAL",
  "BULK",
  "NEW",
] as const;

interface UnitRow {
  id: number;
  name: string;
}

/**
 * Wipes all application data and inserts large, **realistic** datasets for UI
 * and performance testing (Indian wholesale / godown style). Intended for
 * local / disposable databases only.
 */
export function seedDummyBulkData(
  db: Database.Database,
  options?: SeedDummyBulkOptions
): void {
  const n = options?.rowsPerEntity ?? 250;
  if (!Number.isFinite(n) || n < 1 || n > 5000) {
    throw new Error("rowsPerEntity must be between 1 and 5000");
  }

  const tableNames = [
    "settlement_allocations",
    "invoice_lines",
    "invoices",
    "transactions",
    "stock_adjustments",
    "item_other_units",
    "item_unit_conversions",
    "unit_conversions",
    "items",
    "customers",
    "lenders",
    "daily_sales",
    "opening_balance",
    "coupons",
    "tiered_discount_rules",
    "units",
    "unit_types",
    "settings",
  ] as const;

  const sequenceTables = [
    "customers",
    "unit_types",
    "units",
    "items",
    "item_other_units",
    "unit_conversions",
    "item_unit_conversions",
    "lenders",
    "transactions",
    "settlement_allocations",
    "daily_sales",
    "invoices",
    "invoice_lines",
    "coupons",
    "tiered_discount_rules",
    "stock_adjustments",
  ] as const;

  const run = db.transaction(() => {
    db.pragma("foreign_keys = OFF");
    for (const t of tableNames) {
      db.exec(`DELETE FROM ${t}`);
    }
    for (const t of sequenceTables) {
      db.prepare("DELETE FROM sqlite_sequence WHERE name = ?").run(t);
    }
    db.pragma("foreign_keys = ON");

    createSchema(db);
    seedIfEmpty(db);

    const getTypeId = db.prepare(
      "SELECT id FROM unit_types WHERE name = ?"
    ) as Database.Statement;
    const insertUnitType = db.prepare(
      "INSERT INTO unit_types (name) VALUES (?)"
    );
    const existingTypeCount = (
      db.prepare("SELECT COUNT(*) AS c FROM unit_types").get() as { c: number }
    ).c;
    for (let k = existingTypeCount; k < n; k++) {
      const label = pick(EXTRA_UNIT_TYPE_LABELS, k);
      insertUnitType.run(`${label} — class ${padNum(k, 4)}`);
    }

    const insertUnit = db.prepare(
      "INSERT INTO units (name, symbol, unit_type_id) VALUES (?, ?, ?)"
    );
    let unitRows = db.prepare("SELECT id, name FROM units ORDER BY id").all() as UnitRow[];
    const massType = getTypeId.get("Mass") as { id: number } | undefined;
    const countType = getTypeId.get("Count") as { id: number } | undefined;
    const volType = getTypeId.get("Volume") as { id: number } | undefined;
    let u = 0;
    while (unitRows.length < n) {
      const kind = u % 3;
      let typeId: number | null = null;
      if (kind === 0) {
        typeId = massType?.id ?? null;
      } else if (kind === 1) {
        typeId = countType?.id ?? null;
      } else {
        typeId = volType?.id ?? null;
      }
      const name = `trade_pack_${padNum(u, 5)}`;
      let sym = "drum";
      if (kind === 0) {
        sym = "sack";
      } else if (kind === 1) {
        sym = "ctn";
      }
      insertUnit.run(name, sym, typeId);
      u++;
      unitRows = db
        .prepare("SELECT id, name FROM units ORDER BY id")
        .all() as UnitRow[];
    }

    const unitIds = unitRows.map((r) => r.id);

    const insertUnitConversion = db.prepare(
      "INSERT OR IGNORE INTO unit_conversions (from_unit, to_unit, from_unit_id, to_unit_id, factor) VALUES (?, ?, ?, ?, ?)"
    );
    const kgRow = unitRows.find((r) => r.name === "kilogram");
    for (let i = 0; i < n; i++) {
      const urow = unitRows[i % unitRows.length];
      const next = unitRows[(i + 1) % unitRows.length];
      if (!urow || !next || urow.name === next.name) {
        continue;
      }
      if (kgRow && urow.name.startsWith("trade_pack_")) {
        insertUnitConversion.run(
          urow.name,
          "kilogram",
          urow.id,
          kgRow.id,
          10 + (i % 50)
        );
        continue;
      }
      insertUnitConversion.run(
        urow.name,
        next.name,
        urow.id,
        next.id,
        1 + (i % 12) * 0.25
      );
    }

    const insertLender = db.prepare(
      "INSERT INTO lenders (name, address, phone, gstin) VALUES (?, ?, ?, ?)"
    );
    const lenderIds: number[] = [];
    for (let i = 0; i < n; i++) {
      const res = insertLender.run(
        `${pick(LENDER_PREFIX, i)} ${pick(LENDER_SUFFIX, i + 3)}`,
        `${(i % 120) + 1} ${pick(AREAS, i + 1)}`,
        indianMobile(600000000 + i),
        gstinLike("19", i)
      );
      lenderIds.push(Number(res.lastInsertRowid));
    }

    const insertCustomer = db.prepare(
      "INSERT INTO customers (phone, name, address, gstin) VALUES (?, ?, ?, ?)"
    );
    const customerIds: number[] = [];
    for (let i = 0; i < n; i++) {
      const res = insertCustomer.run(
        indianMobile(700000000 + i),
        `${pick(CUSTOMER_FIRST, i)} ${pick(SHOP_SUFFIX, i + 5)}`,
        `Shop ${(i % 40) + 1}, ${pick(AREAS, i)}`,
        i % 4 === 0 ? gstinLike("19", i + 900000) : null
      );
      customerIds.push(Number(res.lastInsertRowid));
    }

    const insertItem = db.prepare(
      `INSERT INTO items (
        name, code, unit, unit_id, selling_price, gst_rate, hsn_code,
        current_stock, reorder_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const itemIds: number[] = [];
    const getUnitIdByName = db.prepare(
      "SELECT id FROM units WHERE name = ?"
    ) as Database.Statement;
    for (let i = 0; i < n; i++) {
      const bp = pick(ITEM_BLUEPRINTS, i);
      const unitRow = getUnitIdByName.get(bp.unit) as { id: number } | undefined;
      const uid = unitRow?.id ?? unitIds[i % unitIds.length];
      const packW = 5 + (i % 45);
      const price =
        bp.priceLo + ((i * 17) % (bp.priceHi - bp.priceLo + 1 || 1));
      const res = insertItem.run(
        `${bp.name} ${packW}${bp.unit === "packets" ? "g" : "kg"} pack`,
        `${bp.codePrefix}-${padNum(i + 1, 4)}`,
        bp.unit,
        uid ?? null,
        price,
        bp.gstRate,
        bp.hsn,
        40 + (i % 400),
        8 + (i % 25)
      );
      itemIds.push(Number(res.lastInsertRowid));
    }

    const altUnits = ["packets", "boxes", "pieces", "cartons", "tins"] as const;
    const insertItemOtherUnit = db.prepare(
      "INSERT INTO item_other_units (item_id, unit, sort_order) VALUES (?, ?, ?)"
    );
    for (let i = 0; i < n; i++) {
      const itemId = itemIds[i];
      if (itemId === undefined) {
        continue;
      }
      const bp = pick(ITEM_BLUEPRINTS, i);
      const alt = pick(altUnits, i + 2);
      if (alt === bp.unit) {
        insertItemOtherUnit.run(itemId, pick(altUnits, i + 7), i % 6);
      } else {
        insertItemOtherUnit.run(itemId, alt, i % 6);
      }
    }

    const insertItemUnitConversion = db.prepare(
      "INSERT INTO item_unit_conversions (item_id, to_unit, to_unit_id, factor) VALUES (?, ?, ?, ?)"
    );
    for (let i = 0; i < n; i++) {
      const itemId = itemIds[i];
      const bp = pick(ITEM_BLUEPRINTS, i);
      let toName = pick(altUnits, i);
      let tries = 0;
      while (toName === bp.unit && tries < altUnits.length) {
        tries++;
        toName = pick(altUnits, i + tries);
      }
      if (toName === bp.unit) {
        toName = "pieces";
      }
      const toRow = getUnitIdByName.get(toName) as { id: number } | undefined;
      if (itemId === undefined || !toRow) {
        continue;
      }
      insertItemUnitConversion.run(
        itemId,
        toName,
        toRow.id,
        toName === "pieces" ? 12 + (i % 8) : 1 + (i % 5) * 0.5
      );
    }

    const insertTransaction = db.prepare(
      `INSERT INTO transactions (
        type, batch_uuid, lender_id, product_id, product_name, quantity, amount,
        transaction_date, notes, gst_rate, gst_inclusive, taxable_amount, cgst_amount, sgst_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const creditIds: number[] = [];
    for (let i = 0; i < n; i++) {
      const lenderId = lenderIds[i % lenderIds.length];
      const productId = itemIds[i % itemIds.length];
      const bp = pick(ITEM_BLUEPRINTS, i);
      const taxable = 8000 + i * 173;
      const half = (taxable * (bp.gstRate / 100)) / 2;
      const res = insertTransaction.run(
        "credit_purchase",
        null,
        lenderId ?? null,
        productId ?? null,
        `${bp.name} — credit lot`,
        8 + (i % 40),
        Math.round(taxable * (1 + bp.gstRate / 100)),
        `2025-${padNum((i % 12) + 1, 2)}-${padNum((i % 27) + 1, 2)}`,
        pick(CREDIT_NOTES, i),
        bp.gstRate,
        0,
        taxable,
        half,
        half
      );
      creditIds.push(Number(res.lastInsertRowid));
    }

    for (let i = 0; i < n; i++) {
      const productId = itemIds[(i + 5) % itemIds.length];
      const bp = pick(ITEM_BLUEPRINTS, i + 4);
      const amt = 2200 + i * 89;
      insertTransaction.run(
        "cash_purchase",
        null,
        null,
        productId ?? null,
        `${bp.name} — cash buy`,
        3 + (i % 22),
        amt,
        `2025-${padNum(((i + 3) % 12) + 1, 2)}-${padNum((i % 26) + 1, 2)}`,
        "Paid at counter — cash memo filed",
        0,
        0,
        amt,
        0,
        0
      );
    }

    const settlementIds: number[] = [];
    for (let i = 0; i < n; i++) {
      const lenderId = lenderIds[(i + 2) % lenderIds.length];
      const res = insertTransaction.run(
        "settlement",
        null,
        lenderId ?? null,
        null,
        null,
        null,
        5000 + i * 137,
        `2025-${padNum(((i + 5) % 12) + 1, 2)}-${padNum((i % 25) + 1, 2)}`,
        pick(SETTLEMENT_NOTES, i),
        0,
        0,
        0,
        0,
        0
      );
      settlementIds.push(Number(res.lastInsertRowid));
    }

    const insertAllocation = db.prepare(
      `INSERT INTO settlement_allocations (settlement_id, credit_purchase_id, amount)
       VALUES (?, ?, ?)`
    );
    for (let i = 0; i < n; i++) {
      const sid = settlementIds[i];
      const cid = creditIds[i];
      if (sid === undefined || cid === undefined) {
        continue;
      }
      insertAllocation.run(sid, cid, Math.min(3500 + i * 12, 12000));
    }

    const insertDailySale = db.prepare(
      `INSERT INTO daily_sales (
        sale_date, sale_amount, cash_in_hand, expenditure_amount, invoice_sales, misc_sales, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (let i = 0; i < n; i++) {
      const d = new Date(Date.UTC(2025, 0, 1 + i));
      const y = d.getUTCFullYear();
      const mo = padNum(d.getUTCMonth() + 1, 2);
      const da = padNum(d.getUTCDate(), 2);
      const inv = 12000 + i * 211;
      const misc = 800 + (i % 4000);
      const sale = inv + misc;
      const cash = Math.round(sale * 0.62);
      const exp = 400 + (i % 3500);
      insertDailySale.run(
        `${y}-${mo}-${da}`,
        sale,
        cash,
        exp,
        inv,
        misc,
        pick(SALE_NOTES, i)
      );
    }

    const insertOpening = db.prepare(
      "INSERT INTO opening_balance (year, amount) VALUES (?, ?)"
    );
    const currentYear = new Date().getFullYear();
    const openingYears = Math.min(n, 25);
    for (let i = 0; i < openingYears; i++) {
      insertOpening.run(
        currentYear - (openingYears - 1 - i),
        75000 + i * 18500 + (i % 7) * 1200
      );
    }

    const insertInvoice = db.prepare(
      `INSERT INTO invoices (
        invoice_number, customer_name, customer_address, customer_phone, customer_id,
        invoice_date, notes, order_discount_amount, round_to_whole
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const invoiceIds: number[] = [];
    for (let i = 0; i < n; i++) {
      const custId = customerIds[i % customerIds.length];
      const first = pick(CUSTOMER_FIRST, i + 11);
      const suf = pick(SHOP_SUFFIX, i + 2);
      const res = insertInvoice.run(
        `INV-2025-${padNum(i + 1, 5)}`,
        `${first} ${suf}`,
        `${(i % 55) + 1}, ${pick(AREAS, i + 4)}`,
        indianMobile(800000000 + i),
        custId ?? null,
        `2025-${padNum((i % 12) + 1, 2)}-${padNum((i % 27) + 1, 2)}`,
        i % 5 === 0 ? "Credit — payment due 15 days" : "Cash / UPI at counter",
        i % 11 === 0 ? 120 + (i % 80) : 0,
        i % 6 === 0 ? 1 : 0
      );
      invoiceIds.push(Number(res.lastInsertRowid));
    }

    const linesPerInvoice = 3;
    const insertLine = db.prepare(
      `INSERT INTO invoice_lines (
        invoice_id, product_id, product_name, quantity, unit, unit_id, price, amount,
        price_entered_as, gst_rate, gst_inclusive, taxable_amount, cgst_amount, sgst_amount, hsn_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (let inv = 0; inv < n; inv++) {
      const invoiceId = invoiceIds[inv];
      if (invoiceId === undefined) {
        continue;
      }
      for (let k = 0; k < linesPerInvoice; k++) {
        const idx = (inv + k) % itemIds.length;
        const productId = itemIds[idx];
        const bp = pick(ITEM_BLUEPRINTS, idx);
        const uid =
          (getUnitIdByName.get(bp.unit) as { id: number } | undefined)?.id ??
          unitIds[idx % unitIds.length];
        const qty = 2 + ((inv + k) % 12);
        const price = bp.priceLo + ((inv * 13 + k * 7) % (bp.priceHi - bp.priceLo + 1));
        const taxable = qty * price;
        const rate = bp.gstRate;
        const half = (taxable * (rate / 100)) / 2;
        insertLine.run(
          invoiceId,
          productId ?? null,
          `${bp.name} (${qty} ${bp.unit})`,
          qty,
          bp.unit,
          uid ?? null,
          price,
          taxable,
          "per_unit",
          rate,
          0,
          taxable,
          half,
          half,
          bp.hsn
        );
      }
    }

    const insertCoupon = db.prepare(
      `INSERT INTO coupons (
        code, discount_type, discount_value, min_order_amount, valid_from, valid_to, usage_limit, used_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (let i = 0; i < n; i++) {
      const isPercent = i % 2 === 0;
      insertCoupon.run(
        `${pick(COUPON_VERBS, i)}${padNum(i + 1, 4)}`,
        isPercent ? "percent" : "flat",
        isPercent ? 5 + (i % 12) : 150 + (i % 500),
        800 + (i % 8000),
        "2025-01-01",
        "2026-12-31",
        500,
        Math.min(i % 80, 200)
      );
    }

    const insertTier = db.prepare(
      `INSERT INTO tiered_discount_rules (
        min_order_amount, discount_percent, discount_flat, max_discount_amount, sort_order
      ) VALUES (?, ?, ?, ?, ?)`
    );
    for (let i = 0; i < n; i++) {
      insertTier.run(
        2500 + i * 450,
        Math.min(2 + (i % 8), 15),
        i % 4 === 0 ? 50 + (i % 200) : 0,
        800 + (i % 6000),
        i
      );
    }

    const insertAdj = db.prepare(
      `INSERT INTO stock_adjustments (
        item_id, adjustment_type, quantity, unit, primary_quantity, reason
      ) VALUES (?, ?, ?, ?, ?, ?)`
    );
    const adjReasons = [
      "Physical stock count correction",
      "Damaged in transit — written off",
      "Free sample issued to retailer",
      "Return from customer — restocked",
      "Moisture loss — net weight adjusted",
      "Promotional bundle assembly",
    ] as const;
    for (let i = 0; i < n; i++) {
      const itemId = itemIds[i % itemIds.length];
      if (itemId === undefined) {
        continue;
      }
      const bp = pick(ITEM_BLUEPRINTS, i);
      const isAdd = i % 2 === 0;
      const q = 2 + (i % 18);
      insertAdj.run(
        itemId,
        isAdd ? "add" : "reduce",
        q,
        bp.unit,
        q,
        pick(adjReasons, i)
      );
    }
  });

  run();
}
