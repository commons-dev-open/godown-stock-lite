import type Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { seedIfEmpty } from "./seed";

type SampleSnapshot = {
  items: unknown[];
  mahajans: unknown[];
  transactions: unknown[];
  daily_sales: unknown[];
  opening_balance: unknown[];
  invoices: unknown[];
  invoice_lines: unknown[];
};

function getCount(db: Database.Database, table: string): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM ${table}`)
    .get() as { c: number } | undefined;
  return row?.c ?? 0;
}

function getSnapshotPath(): string {
  const userData = app.getPath("userData");
  return path.join(userData, "sample-data.json");
}

function writeSnapshot(db: Database.Database): void {
  const snapshot: SampleSnapshot = {
    items: db.prepare("SELECT * FROM items LIMIT 50").all(),
    mahajans: db.prepare("SELECT * FROM mahajans LIMIT 50").all(),
    transactions: db.prepare("SELECT * FROM transactions LIMIT 100").all(),
    daily_sales: db.prepare("SELECT * FROM daily_sales LIMIT 50").all(),
    opening_balance: db.prepare("SELECT * FROM opening_balance LIMIT 50").all(),
    invoices: db.prepare("SELECT * FROM invoices LIMIT 50").all(),
    invoice_lines: db.prepare("SELECT * FROM invoice_lines LIMIT 200").all(),
  };
  const filePath = getSnapshotPath();
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf8");
}

function readSnapshot(): SampleSnapshot | null {
  const filePath = getSnapshotPath();
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as SampleSnapshot;
    return parsed;
  } catch {
    return null;
  }
}

export function populateSampleData(db: Database.Database): void {
  seedIfEmpty(db);

  const run = db.transaction(() => {
    const hasExistingData =
      getCount(db, "items") > 0 ||
      getCount(db, "mahajans") > 0 ||
      getCount(db, "transactions") > 0 ||
      getCount(db, "daily_sales") > 0 ||
      getCount(db, "invoices") > 0;

    if (hasExistingData) {
      writeSnapshot(db);
      return;
    }

    const snapshot = readSnapshot();
    if (snapshot) {
      const insertItem = db.prepare(
        "INSERT INTO items (id, name, code, unit, unit_id, reference_unit, quantity_per_primary, retail_primary_unit, current_stock, reorder_level, created_at, updated_at) VALUES (@id, @name, @code, @unit, @unit_id, @reference_unit, @quantity_per_primary, @retail_primary_unit, @current_stock, @reorder_level, @created_at, @updated_at)"
      );
      const insertMahajan = db.prepare(
        "INSERT INTO mahajans (id, name, address, phone, gstin, created_at, updated_at) VALUES (@id, @name, @address, @phone, @gstin, @created_at, @updated_at)"
      );
      const insertTransaction = db.prepare(
        "INSERT INTO transactions (id, type, batch_uuid, mahajan_id, product_id, product_name, quantity, amount, transaction_date, notes, created_at, updated_at) VALUES (@id, @type, @batch_uuid, @mahajan_id, @product_id, @product_name, @quantity, @amount, @transaction_date, @notes, @created_at, @updated_at)"
      );
      const insertDailySale = db.prepare(
        "INSERT INTO daily_sales (id, sale_date, sale_amount, cash_in_hand, expenditure_amount, invoice_sales, misc_sales, notes, created_at, updated_at) VALUES (@id, @sale_date, @sale_amount, @cash_in_hand, @expenditure_amount, COALESCE(@invoice_sales, 0), COALESCE(@misc_sales, @sale_amount, 0), @notes, @created_at, @updated_at)"
      );
      const insertOpeningBalance = db.prepare(
        "INSERT INTO opening_balance (year, amount, updated_at) VALUES (@year, @amount, @updated_at)"
      );
      const insertInvoice = db.prepare(
        "INSERT INTO invoices (id, invoice_number, customer_name, customer_address, invoice_date, notes, created_at, updated_at) VALUES (@id, @invoice_number, @customer_name, @customer_address, @invoice_date, @notes, @created_at, @updated_at)"
      );
      const insertInvoiceLine = db.prepare(
        "INSERT INTO invoice_lines (id, invoice_id, product_id, product_name, quantity, unit, unit_id, price, amount, price_entered_as, created_at) VALUES (@id, @invoice_id, @product_id, @product_name, @quantity, @unit, @unit_id, @price, @amount, @price_entered_as, @created_at)"
      );

      for (const row of snapshot.items) insertItem.run(row);
      for (const row of snapshot.mahajans) insertMahajan.run(row);
      for (const row of snapshot.transactions) insertTransaction.run(row);
      for (const row of snapshot.daily_sales) insertDailySale.run(row);
      for (const row of snapshot.opening_balance)
        insertOpeningBalance.run(row);
      for (const row of snapshot.invoices) insertInvoice.run(row);
      for (const row of snapshot.invoice_lines) insertInvoiceLine.run(row);

      return;
    }

    const getUnitId = db.prepare(
      "SELECT id FROM units WHERE name = ?"
    ) as Database.Statement;

    const insertMahajan = db.prepare(
      "INSERT INTO mahajans (name, address, phone, gstin) VALUES (?, ?, ?, ?)"
    );

    const mahajans = [
      {
        name: "Sharma Traders",
        address: "Bazaar Road, Kolkata",
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

    const mahajanIds: number[] = [];
    for (const m of mahajans) {
      const res = insertMahajan.run(
        m.name,
        m.address,
        m.phone,
        m.gstin
      ) as Database.RunResult;
      mahajanIds.push(Number(res.lastInsertRowid));
    }

    const insertItem = db.prepare(
      "INSERT INTO items (name, code, unit, unit_id, reference_unit, quantity_per_primary, retail_primary_unit, current_stock, reorder_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    const items = [
      {
        name: "Basmati Rice 25kg Bag",
        code: "RICE25",
        unit: "bags",
        reference_unit: "kilogram",
        quantity_per_primary: 25,
        retail_primary_unit: "kilogram",
        current_stock: 40,
        reorder_level: 10,
      },
      {
        name: "Wheat Flour 50kg Bag",
        code: "ATTA50",
        unit: "bags",
        reference_unit: "kilogram",
        quantity_per_primary: 50,
        retail_primary_unit: "kilogram",
        current_stock: 30,
        reorder_level: 8,
      },
      {
        name: "Refined Oil 15L Jar",
        code: "OIL15",
        unit: "jars",
        reference_unit: "liter",
        quantity_per_primary: 15,
        retail_primary_unit: "liter",
        current_stock: 25,
        reorder_level: 5,
      },
      {
        name: "Sugar 50kg Bag",
        code: "SUGAR50",
        unit: "bags",
        reference_unit: "kilogram",
        quantity_per_primary: 50,
        retail_primary_unit: "kilogram",
        current_stock: 20,
        reorder_level: 5,
      },
      {
        name: "Iodized Salt 1kg Packet",
        code: "SALT1",
        unit: "packets",
        reference_unit: null,
        quantity_per_primary: null,
        retail_primary_unit: "packets",
        current_stock: 200,
        reorder_level: 50,
      },
      {
        name: "Tea 250g Packet",
        code: "TEA250",
        unit: "packets",
        reference_unit: null,
        quantity_per_primary: null,
        retail_primary_unit: "packets",
        current_stock: 150,
        reorder_level: 40,
      },
      {
        name: "Glucose Biscuit 10pcs Pack",
        code: "BIS10",
        unit: "packets",
        reference_unit: "pieces",
        quantity_per_primary: 10,
        retail_primary_unit: "packets",
        current_stock: 180,
        reorder_level: 60,
      },
      {
        name: "Detergent Powder 1kg Packet",
        code: "DETER1",
        unit: "packets",
        reference_unit: null,
        quantity_per_primary: null,
        retail_primary_unit: "packets",
        current_stock: 120,
        reorder_level: 30,
      },
    ];

    const itemByCode = new Map<string, number>();

    for (const item of items) {
      const unitRow = getUnitId.get(item.unit) as { id: number } | undefined;
      const unitId = unitRow?.id ?? null;
      const res = insertItem.run(
        item.name,
        item.code,
        item.unit,
        unitId,
        item.reference_unit,
        item.quantity_per_primary,
        item.retail_primary_unit,
        item.current_stock,
        item.reorder_level
      ) as Database.RunResult;
      const id = Number(res.lastInsertRowid);
      itemByCode.set(item.code, id);
    }

    const insertTransaction = db.prepare(
      "INSERT INTO transactions (type, batch_uuid, mahajan_id, product_id, product_name, quantity, amount, transaction_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    const transactions = [
      {
        type: "lend",
        mahajanIndex: 0,
        productCode: "RICE25",
        productName: "Basmati Rice 25kg Bag",
        quantity: 10,
        amount: 35000,
        date: "2025-04-01",
        notes: "Opening lend for rice stock",
      },
      {
        type: "lend",
        mahajanIndex: 1,
        productCode: "OIL15",
        productName: "Refined Oil 15L Jar",
        quantity: 8,
        amount: 28000,
        date: "2025-04-03",
        notes: "Oil stock received",
      },
      {
        type: "deposit",
        mahajanIndex: 0,
        productCode: null,
        productName: null,
        quantity: null,
        amount: 15000,
        date: "2025-04-10",
        notes: "Part payment received",
      },
      {
        type: "cash_purchase",
        mahajanIndex: null,
        productCode: "SUGAR50",
        productName: "Sugar 50kg Bag",
        quantity: 5,
        amount: 12000,
        date: "2025-04-05",
        notes: "Cash purchase of sugar",
      },
      {
        type: "cash_purchase",
        mahajanIndex: null,
        productCode: "TEA250",
        productName: "Tea 250g Packet",
        quantity: 50,
        amount: 9000,
        date: "2025-04-06",
        notes: "Cash purchase of tea",
      },
    ] as const;

    for (const t of transactions) {
      const hasMahajanIndex =
        typeof t.mahajanIndex === "number" &&
        Number.isInteger(t.mahajanIndex) &&
        t.mahajanIndex >= 0 &&
        t.mahajanIndex < mahajanIds.length;
      const mahajanId = hasMahajanIndex
        ? mahajanIds[t.mahajanIndex as number]
        : null;
      const hasProductCode = typeof t.productCode === "string";
      const productId = hasProductCode
        ? itemByCode.get(t.productCode as string) ?? null
        : null;
      insertTransaction.run(
        t.type,
        null,
        mahajanId,
        productId,
        t.productName,
        t.quantity,
        t.amount,
        t.date,
        t.notes
      );
    }

    const insertDailySale = db.prepare(
      "INSERT INTO daily_sales (sale_date, sale_amount, cash_in_hand, expenditure_amount, invoice_sales, misc_sales, notes) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );

    const dailySales = [
      {
        date: "2025-04-01",
        sale: 12000,
        cash: 8000,
        expenditure: 2000,
        notes: "Weekday sale",
      },
      {
        date: "2025-04-02",
        sale: 13500,
        cash: 9000,
        expenditure: 1500,
        notes: "Good footfall",
      },
      {
        date: "2025-04-03",
        sale: 11000,
        cash: 7000,
        expenditure: 1800,
        notes: "Average day",
      },
      {
        date: "2025-04-04",
        sale: 14500,
        cash: 9500,
        expenditure: 2200,
        notes: "Festival rush",
      },
      {
        date: "2025-04-05",
        sale: 16000,
        cash: 10000,
        expenditure: 2500,
        notes: "Weekend sale",
      },
      {
        date: "2025-04-06",
        sale: 15500,
        cash: 9800,
        expenditure: 2100,
        notes: "Weekend sale",
      },
      {
        date: "2025-04-07",
        sale: 11800,
        cash: 7800,
        expenditure: 1900,
        notes: "Weekday sale",
      },
    ];

    for (const s of dailySales) {
      insertDailySale.run(
        s.date,
        s.sale,
        s.cash,
        s.expenditure,
        0,
        s.sale,
        s.notes
      );
    }

    const currentYear = new Date().getFullYear();
    const insertOpeningBalance = db.prepare(
      "INSERT OR REPLACE INTO opening_balance (year, amount, updated_at) VALUES (?, ?, datetime('now'))"
    );
    insertOpeningBalance.run(currentYear, 50000);

    const insertInvoice = db.prepare(
      "INSERT INTO invoices (invoice_number, customer_name, customer_address, invoice_date, notes) VALUES (?, ?, ?, ?, ?)"
    );
    const insertInvoiceLine = db.prepare(
      "INSERT INTO invoice_lines (invoice_id, product_id, product_name, quantity, unit, unit_id, price, amount, price_entered_as) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    const invoices = [
      {
        number: "INV-2025-0001",
        customer: "Local Retailer A",
        address: "Sodepur, Kolkata",
        date: "2025-04-02",
        notes: "Repeat customer",
        lines: [
          { code: "RICE25", name: "Basmati Rice 25kg Bag", qty: 2, unit: "bags", price: 1800 },
          { code: "SALT1", name: "Iodized Salt 1kg Packet", qty: 20, unit: "packets", price: 18 },
        ],
      },
      {
        number: "INV-2025-0002",
        customer: "Local Retailer B",
        address: "Dumdum, Kolkata",
        date: "2025-04-03",
        notes: "Cash invoice",
        lines: [
          { code: "ATTA50", name: "Wheat Flour 50kg Bag", qty: 1, unit: "bags", price: 2100 },
          { code: "TEA250", name: "Tea 250g Packet", qty: 15, unit: "packets", price: 90 },
        ],
      },
      {
        number: "INV-2025-0003",
        customer: "Tea Stall C",
        address: "Barasat Crossing",
        date: "2025-04-04",
        notes: "Monthly supply",
        lines: [
          { code: "TEA250", name: "Tea 250g Packet", qty: 25, unit: "packets", price: 88 },
          { code: "BIS10", name: "Glucose Biscuit 10pcs Pack", qty: 30, unit: "packets", price: 30 },
        ],
      },
      {
        number: "INV-2025-0004",
        customer: "Catering Service D",
        address: "Howrah",
        date: "2025-04-05",
        notes: "Event order",
        lines: [
          { code: "RICE25", name: "Basmati Rice 25kg Bag", qty: 4, unit: "bags", price: 1750 },
          { code: "OIL15", name: "Refined Oil 15L Jar", qty: 3, unit: "jars", price: 3200 },
        ],
      },
      {
        number: "INV-2025-0005",
        customer: "Grocery Shop E",
        address: "Lake Town, Kolkata",
        date: "2025-04-06",
        notes: "Credit invoice",
        lines: [
          { code: "SUGAR50", name: "Sugar 50kg Bag", qty: 2, unit: "bags", price: 1500 },
          { code: "DETER1", name: "Detergent Powder 1kg Packet", qty: 20, unit: "packets", price: 95 },
        ],
      },
    ];

    for (const inv of invoices) {
      const res = insertInvoice.run(
        inv.number,
        inv.customer,
        inv.address,
        inv.date,
        inv.notes
      ) as Database.RunResult;
      const invoiceId = Number(res.lastInsertRowid);

      for (const line of inv.lines) {
        const productId = itemByCode.get(line.code) ?? null;
        const unitRow = getUnitId.get(line.unit) as { id: number } | undefined;
        const unitId = unitRow?.id ?? null;
        const amount = line.qty * line.price;
        insertInvoiceLine.run(
          invoiceId,
          productId,
          line.name,
          line.qty,
          line.unit,
          unitId,
          line.price,
          amount,
          "per_unit"
        );
      }
    }
  });

  run();
}

