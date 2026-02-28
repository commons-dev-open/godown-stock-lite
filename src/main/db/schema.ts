interface DbLike {
  exec(sql: string): void;
}

export function createSchema(db: DbLike): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT,
      unit TEXT NOT NULL DEFAULT 'pcs',
      current_stock REAL NOT NULL DEFAULT 0,
      reorder_level REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mahajans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      gstin TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
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

    CREATE TABLE IF NOT EXISTS daily_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_date TEXT NOT NULL,
      sale_amount REAL NOT NULL,
      cash_in_hand REAL NOT NULL,
      expenditure_amount REAL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS opening_balance (
      year INTEGER PRIMARY KEY,
      amount REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}
