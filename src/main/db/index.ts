import Database from "better-sqlite3";
import { app } from "electron";
import path from "path";
import { createSchema } from "./schema";
import { seedIfEmpty } from "./seed";

let db: Database.Database | null = null;

function migratePurchaseToCashPurchase(database: Database.Database): void {
  const hasOldPurchase = database
    .prepare("SELECT 1 FROM transactions WHERE type = 'purchase' LIMIT 1")
    .get();
  if (!hasOldPurchase) return;

  database.exec(`
    CREATE TABLE transactions_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('lend','deposit','cash_purchase')),
      batch_uuid TEXT,
      mahajan_id INTEGER REFERENCES mahajans(id),
      product_id INTEGER REFERENCES items(id),
      product_name TEXT,
      quantity REAL,
      amount REAL NOT NULL,
      transaction_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO transactions_new (id, type, batch_uuid, mahajan_id, product_id, product_name, quantity, amount, transaction_date, notes, created_at, updated_at)
    SELECT id, CASE WHEN type = 'purchase' THEN 'cash_purchase' ELSE type END, batch_uuid, mahajan_id, product_id, product_name, quantity, amount, transaction_date, notes, created_at, updated_at
    FROM transactions;
    DROP TABLE transactions;
    ALTER TABLE transactions_new RENAME TO transactions;
  `);
}

function migrateUnitsFromItems(database: Database.Database): void {
  try {
    database.exec(
      "INSERT OR IGNORE INTO units (name) SELECT DISTINCT unit FROM items WHERE unit IS NOT NULL AND trim(unit) != ''"
    );
  } catch {
    // units table may not exist on first run before schema
  }
}

function migrateUnitsAddSymbol(database: Database.Database): void {
  try {
    const tableInfo = database.prepare("PRAGMA table_info(units)").all() as {
      name: string;
    }[];
    if (tableInfo.some((c) => c.name === "symbol")) return;
    database.exec("ALTER TABLE units ADD COLUMN symbol TEXT");
  } catch {
    // ignore
  }
}

const DEFAULT_INVOICE_UNITS = [
  { name: "gram", symbol: "g", sort_order: 0 },
  { name: "g", symbol: "g", sort_order: 1 },
  { name: "kg", symbol: "kg", sort_order: 2 },
  { name: "L", symbol: "L", sort_order: 3 },
  { name: "Liter", symbol: "L", sort_order: 4 },
  { name: "ml", symbol: "ml", sort_order: 5 },
  { name: "pcs", symbol: "pcs", sort_order: 6 },
  { name: "box", symbol: null, sort_order: 7 },
  { name: "packet", symbol: null, sort_order: 8 },
];

function migrateItemsAddRetailPrimaryUnit(database: Database.Database): void {
  try {
    const tableInfo = database.prepare("PRAGMA table_info(items)").all() as {
      name: string;
    }[];
    if (tableInfo.some((c) => c.name === "retail_primary_unit")) return;
    database.exec("ALTER TABLE items ADD COLUMN retail_primary_unit TEXT");
  } catch {
    // ignore
  }
}

function migrateInvoiceUnits(database: Database.Database): void {
  try {
    const exists = database
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='invoice_units'"
      )
      .get();
    if (!exists) return;
    const count = database
      .prepare("SELECT COUNT(*) AS c FROM invoice_units")
      .get() as { c: number };
    if (count.c > 0) return;
    const stmt = database.prepare(
      "INSERT OR IGNORE INTO invoice_units (name, symbol, sort_order) VALUES (?, ?, ?)"
    );
    for (const u of DEFAULT_INVOICE_UNITS) {
      stmt.run(u.name, u.symbol, u.sort_order);
    }
  } catch {
    // ignore
  }
}

/** Add invoice_lines.amount (line total as truth); backfill from quantity * price. */
function migrateInvoiceLinesAmount(database: Database.Database): void {
  try {
    const tableInfo = database
      .prepare("PRAGMA table_info(invoice_lines)")
      .all() as { name: string }[];
    if (tableInfo.some((c) => c.name === "amount")) return;
    database.exec(
      "ALTER TABLE invoice_lines ADD COLUMN amount REAL NOT NULL DEFAULT 0"
    );
    database.exec("UPDATE invoice_lines SET amount = quantity * price");
  } catch {
    // ignore
  }
}

/** Add invoice_lines.price_entered_as ('per_unit' | 'total'). */
function migrateInvoiceLinesPriceEnteredAs(database: Database.Database): void {
  try {
    const tableInfo = database
      .prepare("PRAGMA table_info(invoice_lines)")
      .all() as { name: string }[];
    if (tableInfo.some((c) => c.name === "price_entered_as")) return;
    database.exec(
      "ALTER TABLE invoice_lines ADD COLUMN price_entered_as TEXT NOT NULL DEFAULT 'per_unit'"
    );
  } catch {
    // ignore
  }
}

function migrateSchema(database: Database.Database): void {
  const hasOldLends = database
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='mahajan_lends'"
    )
    .get();
  if (!hasOldLends) return;

  try {
    database.exec(
      "ALTER TABLE mahajan_lends ADD COLUMN quantity REAL NOT NULL DEFAULT 0"
    );
  } catch {
    // Column already exists
  }
  database.exec(`
    INSERT INTO transactions (type, batch_uuid, mahajan_id, product_id, product_name, quantity, amount, transaction_date, notes, created_at, updated_at)
    SELECT 'lend', 'legacy-' || id, mahajan_id, product_id, product_name, COALESCE(quantity, 0), amount, lend_date, notes, created_at, updated_at
    FROM mahajan_lends;
    INSERT INTO transactions (type, mahajan_id, product_id, product_name, quantity, amount, transaction_date, notes, created_at, updated_at)
    SELECT 'deposit', mahajan_id, NULL, NULL, NULL, amount, deposit_date, notes, created_at, updated_at
    FROM mahajan_deposits;
    INSERT INTO transactions (type, mahajan_id, product_id, product_name, quantity, amount, transaction_date, notes, created_at, updated_at)
    SELECT 'cash_purchase', NULL, product_id, NULL, NULL, amount, purchase_date, notes, created_at, updated_at
    FROM purchases;
    DROP TABLE mahajan_lends;
    DROP TABLE mahajan_deposits;
    DROP TABLE purchases;
  `);
}

export function getDbPath(): string {
  const userDataPath = app.getPath("userData");
  return path.join(userDataPath, "godown.db");
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = getDbPath();
    db = new Database(dbPath);
    createSchema(db);
    migrateUnitsFromItems(db);
    migrateUnitsAddSymbol(db);
    migratePurchaseToCashPurchase(db);
    migrateSchema(db);
    migrateItemsAddRetailPrimaryUnit(db);
    migrateInvoiceUnits(db);
    migrateInvoiceLinesAmount(db);
    migrateInvoiceLinesPriceEnteredAs(db);
    seedIfEmpty(db);
  }
  return db;
}
