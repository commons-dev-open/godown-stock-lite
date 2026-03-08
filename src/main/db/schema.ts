interface DbLike {
  exec(sql: string): void;
}

export function createSchema(db: DbLike): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL UNIQUE,
      name TEXT,
      address TEXT,
      gstin TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS unit_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      symbol TEXT,
      unit_type_id INTEGER REFERENCES unit_types(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT,
      unit TEXT NOT NULL DEFAULT 'pcs',
      unit_id INTEGER REFERENCES units(id),
      reference_unit TEXT,
      quantity_per_primary REAL,
      retail_primary_unit TEXT,
      selling_price REAL,
      selling_price_unit TEXT,
      selling_price_unit_id INTEGER REFERENCES units(id),
      gst_rate REAL NOT NULL DEFAULT 0,
      hsn_code TEXT,
      current_stock REAL NOT NULL DEFAULT 0,
      reorder_level REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS item_other_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      unit TEXT NOT NULL,
      unit_id INTEGER REFERENCES units(id),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS unit_conversions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_unit TEXT NOT NULL,
      to_unit TEXT NOT NULL,
      from_unit_id INTEGER REFERENCES units(id),
      to_unit_id INTEGER REFERENCES units(id),
      factor REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(from_unit, to_unit)
    );

    CREATE TABLE IF NOT EXISTS item_unit_conversions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      to_unit TEXT NOT NULL,
      to_unit_id INTEGER REFERENCES units(id),
      factor REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(item_id, to_unit)
    );

    CREATE TABLE IF NOT EXISTS lenders (
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
      type TEXT NOT NULL CHECK(type IN ('credit_purchase','settlement','cash_purchase')),
      batch_uuid TEXT,
      lender_id INTEGER REFERENCES lenders(id),
      product_id INTEGER REFERENCES items(id),
      product_name TEXT,
      quantity REAL,
      amount REAL NOT NULL,
      transaction_date TEXT NOT NULL,
      notes TEXT,
      lender_invoice_number TEXT,
      invoice_file_path TEXT,
      payment_method TEXT,
      reference_number TEXT,
      gst_rate REAL NOT NULL DEFAULT 0,
      gst_inclusive INTEGER NOT NULL DEFAULT 0,
      taxable_amount REAL NOT NULL DEFAULT 0,
      cgst_amount REAL NOT NULL DEFAULT 0,
      sgst_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settlement_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      settlement_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      credit_purchase_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_date TEXT NOT NULL UNIQUE,
      sale_amount REAL NOT NULL,
      cash_in_hand REAL NOT NULL,
      expenditure_amount REAL,
      invoice_sales REAL NOT NULL DEFAULT 0,
      misc_sales REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS opening_balance (
      year INTEGER PRIMARY KEY,
      amount REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE,
      customer_name TEXT,
      customer_address TEXT,
      customer_phone TEXT,
      customer_id INTEGER REFERENCES customers(id),
      invoice_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoice_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES items(id),
      product_name TEXT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      unit_id INTEGER REFERENCES units(id),
      price REAL NOT NULL,
      price_unit TEXT,
      amount REAL NOT NULL DEFAULT 0,
      price_entered_as TEXT NOT NULL DEFAULT 'per_unit' CHECK(price_entered_as IN ('per_unit', 'total')),
      gst_rate REAL NOT NULL DEFAULT 0,
      gst_inclusive INTEGER NOT NULL DEFAULT 0,
      taxable_amount REAL NOT NULL DEFAULT 0,
      cgst_amount REAL NOT NULL DEFAULT 0,
      sgst_amount REAL NOT NULL DEFAULT 0,
      hsn_code TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    DROP TABLE IF EXISTS unit_sort_order;
  `);
  ensureGstColumns(db);
}

function addColumnIfMissing(db: DbLike, table: string, sql: string): void {
  try {
    db.exec(sql);
  } catch {
    /* column already exists */
  }
}

function ensureGstColumns(db: DbLike): void {
  addColumnIfMissing(db, "customers", "ALTER TABLE customers ADD COLUMN gstin TEXT");
  addColumnIfMissing(db, "items", "ALTER TABLE items ADD COLUMN selling_price REAL");
  addColumnIfMissing(db, "items", "ALTER TABLE items ADD COLUMN selling_price_unit TEXT");
  addColumnIfMissing(db, "items", "ALTER TABLE items ADD COLUMN selling_price_unit_id INTEGER REFERENCES units(id)");
  addColumnIfMissing(db, "items", "ALTER TABLE items ADD COLUMN gst_rate REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "items", "ALTER TABLE items ADD COLUMN hsn_code TEXT");
  addColumnIfMissing(db, "invoice_lines", "ALTER TABLE invoice_lines ADD COLUMN price_unit TEXT");
  addColumnIfMissing(db, "invoice_lines", "ALTER TABLE invoice_lines ADD COLUMN gst_rate REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "invoice_lines", "ALTER TABLE invoice_lines ADD COLUMN gst_inclusive INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "invoice_lines", "ALTER TABLE invoice_lines ADD COLUMN taxable_amount REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "invoice_lines", "ALTER TABLE invoice_lines ADD COLUMN cgst_amount REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "invoice_lines", "ALTER TABLE invoice_lines ADD COLUMN sgst_amount REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "invoice_lines", "ALTER TABLE invoice_lines ADD COLUMN hsn_code TEXT");
}
