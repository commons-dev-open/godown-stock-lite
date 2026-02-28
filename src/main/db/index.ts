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

export function getDb(): Database.Database {
  if (!db) {
    const userDataPath = app.getPath("userData");
    const dbPath = path.join(userDataPath, "godown.db");
    db = new Database(dbPath);
    createSchema(db);
    migratePurchaseToCashPurchase(db);
    migrateSchema(db);
    seedIfEmpty(db);
  }
  return db;
}
