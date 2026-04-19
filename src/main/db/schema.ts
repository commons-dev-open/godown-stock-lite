interface DbLike {
  exec(sql: string): void;
}

export function createSchema(db: DbLike): void {
  db.exec(`PRAGMA foreign_keys = ON;`);
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
      -- NOTE: CHECK constraint only enforced for newly created databases.
      current_stock REAL NOT NULL DEFAULT 0 CHECK(current_stock >= -0.005),
      reorder_level REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER REFERENCES users(id)
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
      -- NOTE: ON DELETE SET NULL only takes effect for newly created databases;
      -- SQLite does not support ALTER TABLE to change FK constraints on existing databases.
      from_unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
      to_unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
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
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS supplier_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL CHECK(kind IN ('credit','cash')),
      lender_id INTEGER REFERENCES lenders(id),
      document_date TEXT NOT NULL,
      notes TEXT,
      lender_invoice_number TEXT,
      invoice_file_path TEXT,
      vendor_name TEXT,
      payment_method TEXT,
      other_charges REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER REFERENCES users(id),
      CHECK (
        (kind = 'cash' AND lender_id IS NULL)
        OR (kind = 'credit' AND lender_id IS NOT NULL)
      )
    );

    CREATE TABLE IF NOT EXISTS supplier_purchase_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES supplier_purchases(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES items(id),
      quantity REAL NOT NULL,
      unit TEXT NOT NULL DEFAULT 'pcs',
      amount REAL NOT NULL,
      gst_rate REAL NOT NULL DEFAULT 0,
      gst_inclusive INTEGER NOT NULL DEFAULT 0,
      taxable_amount REAL NOT NULL DEFAULT 0,
      cgst_amount REAL NOT NULL DEFAULT 0,
      sgst_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lender_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lender_id INTEGER NOT NULL REFERENCES lenders(id),
      direction TEXT NOT NULL CHECK(direction IN ('out','in')),
      amount REAL NOT NULL,
      movement_date TEXT NOT NULL,
      notes TEXT,
      payment_method TEXT,
      reference_number TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS lender_movement_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movement_id INTEGER NOT NULL REFERENCES lender_movements(id) ON DELETE CASCADE,
      purchase_id INTEGER NOT NULL REFERENCES supplier_purchases(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS item_stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL REFERENCES items(id),
      delta_qty REAL NOT NULL,
      reason TEXT NOT NULL,
      ref_kind TEXT,
      ref_id INTEGER,
      occurred_at TEXT NOT NULL,
      note TEXT,
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
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER REFERENCES users(id)
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
      order_discount_amount REAL NOT NULL DEFAULT 0,
      round_to_whole INTEGER NOT NULL DEFAULT 0,
      coupon_code TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER REFERENCES users(id)
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
      line_discount_percent REAL NOT NULL DEFAULT 0,
      line_discount_flat REAL NOT NULL DEFAULT 0,
      bogo_buy_qty REAL,
      bogo_get_qty REAL,
      bogo_discount_percent REAL NOT NULL DEFAULT 100,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      discount_type TEXT NOT NULL CHECK(discount_type IN ('percent', 'flat')),
      discount_value REAL NOT NULL,
      min_order_amount REAL,
      valid_from TEXT,
      valid_to TEXT,
      usage_limit INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tiered_discount_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      min_order_amount REAL NOT NULL,
      discount_percent REAL NOT NULL DEFAULT 0,
      discount_flat REAL NOT NULL DEFAULT 0,
      max_discount_amount REAL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL REFERENCES items(id),
      adjustment_type TEXT NOT NULL CHECK(adjustment_type IN ('add', 'reduce')),
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      primary_quantity REAL NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      pin_is_temporary INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      entity_label TEXT,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    DROP TABLE IF EXISTS unit_sort_order;

    -- Foreign-key and lookup indexes
    CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id ON invoice_lines(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_invoice_lines_product_id ON invoice_lines(product_id);
    CREATE INDEX IF NOT EXISTS idx_supplier_purchases_lender_id ON supplier_purchases(lender_id);
    CREATE INDEX IF NOT EXISTS idx_supplier_purchases_document_date ON supplier_purchases(document_date);
    CREATE INDEX IF NOT EXISTS idx_supplier_purchases_kind ON supplier_purchases(kind);
    CREATE INDEX IF NOT EXISTS idx_supplier_purchase_lines_purchase_id ON supplier_purchase_lines(purchase_id);
    CREATE INDEX IF NOT EXISTS idx_supplier_purchase_lines_product_id ON supplier_purchase_lines(product_id);
    CREATE INDEX IF NOT EXISTS idx_lender_movements_lender_id ON lender_movements(lender_id);
    CREATE INDEX IF NOT EXISTS idx_lender_movements_date ON lender_movements(movement_date);
    CREATE INDEX IF NOT EXISTS idx_lender_movement_allocations_movement_id ON lender_movement_allocations(movement_id);
    CREATE INDEX IF NOT EXISTS idx_lender_movement_allocations_purchase_id ON lender_movement_allocations(purchase_id);
    CREATE INDEX IF NOT EXISTS idx_item_stock_movements_item_id ON item_stock_movements(item_id);
    CREATE INDEX IF NOT EXISTS idx_item_stock_movements_occurred_at ON item_stock_movements(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_item_stock_movements_ref ON item_stock_movements(ref_kind, ref_id);
    CREATE INDEX IF NOT EXISTS idx_daily_sales_sale_date ON daily_sales(sale_date);
    CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);
    CREATE INDEX IF NOT EXISTS idx_item_other_units_item_id ON item_other_units(item_id);
    CREATE INDEX IF NOT EXISTS idx_item_unit_conversions_item_id ON item_unit_conversions(item_id);
    CREATE INDEX IF NOT EXISTS idx_stock_adjustments_item_id ON stock_adjustments(item_id);
  `);
  ensureUserColumns(db);
  ensureGstColumns(db);
  ensureDiscountColumns(db);
  ensureSupplierPurchaseCashMeta(db);
  migrateBusinessNameToCompanyName(db);
  ensureLedgerSourceCreatedAtDateTime(db);
}

function addColumnIfMissing(db: DbLike, table: string, sql: string): void {
  try {
    db.exec(sql);
  } catch {
    /* column already exists */
  }
}

function ensureUserColumns(db: DbLike): void {
  addColumnIfMissing(db, "invoices", "ALTER TABLE invoices ADD COLUMN created_by INTEGER");
  addColumnIfMissing(db, "invoices", "ALTER TABLE invoices ADD COLUMN updated_by INTEGER");
  addColumnIfMissing(db, "items", "ALTER TABLE items ADD COLUMN created_by INTEGER");
  addColumnIfMissing(db, "items", "ALTER TABLE items ADD COLUMN updated_by INTEGER");
  addColumnIfMissing(db, "lenders", "ALTER TABLE lenders ADD COLUMN created_by INTEGER");
  addColumnIfMissing(db, "lenders", "ALTER TABLE lenders ADD COLUMN updated_by INTEGER");
  addColumnIfMissing(db, "daily_sales", "ALTER TABLE daily_sales ADD COLUMN created_by INTEGER");
  addColumnIfMissing(db, "daily_sales", "ALTER TABLE daily_sales ADD COLUMN updated_by INTEGER");
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

function ensureSupplierPurchaseCashMeta(db: DbLike): void {
  addColumnIfMissing(
    db,
    "supplier_purchases",
    "ALTER TABLE supplier_purchases ADD COLUMN vendor_name TEXT"
  );
  addColumnIfMissing(
    db,
    "supplier_purchases",
    "ALTER TABLE supplier_purchases ADD COLUMN payment_method TEXT"
  );
  addColumnIfMissing(
    db,
    "supplier_purchases",
    "ALTER TABLE supplier_purchases ADD COLUMN other_charges REAL NOT NULL DEFAULT 0"
  );
}

function ensureDiscountColumns(db: DbLike): void {
  addColumnIfMissing(db, "invoices", "ALTER TABLE invoices ADD COLUMN order_discount_amount REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "invoices", "ALTER TABLE invoices ADD COLUMN round_to_whole INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "invoices", "ALTER TABLE invoices ADD COLUMN coupon_code TEXT");
  addColumnIfMissing(db, "invoice_lines", "ALTER TABLE invoice_lines ADD COLUMN line_discount_percent REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "invoice_lines", "ALTER TABLE invoice_lines ADD COLUMN line_discount_flat REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "invoice_lines", "ALTER TABLE invoice_lines ADD COLUMN bogo_buy_qty REAL");
  addColumnIfMissing(db, "invoice_lines", "ALTER TABLE invoice_lines ADD COLUMN bogo_get_qty REAL");
  addColumnIfMissing(db, "invoice_lines", "ALTER TABLE invoice_lines ADD COLUMN bogo_discount_percent REAL NOT NULL DEFAULT 100");
  addColumnIfMissing(db, "tiered_discount_rules", "ALTER TABLE tiered_discount_rules ADD COLUMN discount_flat REAL NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "tiered_discount_rules", "ALTER TABLE tiered_discount_rules ADD COLUMN max_discount_amount REAL");
}

function migrateBusinessNameToCompanyName(db: DbLike): void {
  try {
    db.exec(`
      INSERT INTO settings (key, value)
      SELECT 'company_name', value FROM settings
      WHERE key = 'business_name'
        AND NOT EXISTS (SELECT 1 FROM settings WHERE key = 'company_name');

      INSERT INTO settings (key, value)
      SELECT 'displayName', substr(value, 1, 25) FROM settings
      WHERE key = 'company_name'
        AND NOT EXISTS (SELECT 1 FROM settings WHERE key = 'displayName');
    `);
  } catch {
    /* settings table not yet initialized or already migrated */
  }
}

/** Persist full datetime for ledger source rows used in unified ordering (idempotent). */
function ensureLedgerSourceCreatedAtDateTime(db: DbLike): void {
  try {
    db.exec(`
      UPDATE supplier_purchase_lines
      SET created_at = datetime(trim(created_at))
      WHERE length(trim(created_at)) = 10
        AND instr(trim(created_at), ' ') = 0
        AND instr(trim(created_at), 'T') = 0;

      UPDATE lender_movements
      SET created_at = datetime(trim(created_at))
      WHERE length(trim(created_at)) = 10
        AND instr(trim(created_at), ' ') = 0
        AND instr(trim(created_at), 'T') = 0;

      UPDATE supplier_purchase_lines
      SET created_at = (
        SELECT datetime(trim(sp.document_date))
        FROM supplier_purchases sp
        WHERE sp.id = supplier_purchase_lines.purchase_id
      )
      WHERE created_at IS NULL OR trim(created_at) = '';

      UPDATE lender_movements
      SET created_at = datetime(trim(movement_date))
      WHERE created_at IS NULL OR trim(created_at) = '';
    `);
  } catch {
    /* tables not ready */
  }
}
