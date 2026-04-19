#!/usr/bin/env node
/**
 * Appends template-based dummy data to an existing Godown SQLite database.
 * Uses an active superadmin when present; otherwise any active user, or an inactive
 * superadmin for audit FKs. If the users table is empty, inserts a bootstrap superadmin
 * (PIN 0000, name "Owner (template enrich bootstrap)"). Catalog/lenders may be bootstrapped when empty.
 *
 * Close the Electron app before running — the DB file must not be open elsewhere.
 *
 * Usage (no path needed — uses the same godown.db as the installed/dev app):
 *   npm run db:enrich-templates
 *
 * Optional:
 *   GODOWN_DB=/path/to/godown.db   override database file (otherwise same path as the Electron app)
 *   --db=...                      same as GODOWN_DB (relative paths resolve from cwd)
 *   --history-years=1|2       (default: 2) synthetic purchase/invoice dates in [today−N years, today]
 *   --reference-iso=YYYY-MM-DD optional fixed "today" for reproducible runs (local noon)
 *   --dry-run                 print planned counts only, no writes
 *   --company-name=...        used for synthetic onboarding + only fills settings.company_name when missing
 *   --owner-name=...          used for synthetic onboarding + only fills settings.owner_name when missing
 *   --recovery-key=...        owner recovery key when the enricher completes onboarding settings (default below)
 *
 * If settings.onboarding_complete is not "true", the enricher writes the same settings as the
 * onboarding form (company, owner, display name, MASTER_KEY_CUSTOMER_HASH, onboarding_complete)
 * before inserting template data. Default recovery key: godown-template-enrich-recovery-key
 * (PIN for the bootstrap superadmin remains 0000 when that row is created here).
 *
 * Synthetic users all use PIN 0000 (same hash stored for each row).
 *
 * Invoices are created through the same pipeline as the app (createInvoiceWithLines),
 * so item_stock_movements for invoice_sale use ref_kind invoice_line and join to
 * invoice_lines. The Stock history screen resolves source_invoice_id from that join
 * and can open invoice quick view / #/invoices?invoiceId=<id>.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

function defaultDbPath() {
  const appName = "godown-stock-lite";
  if (process.platform === "darwin") {
    return path.join(
      process.env.HOME,
      "Library",
      "Application Support",
      appName,
      "godown.db"
    );
  }
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || "", appName, "godown.db");
  }
  return path.join(process.env.HOME || "", ".config", appName, "godown.db");
}

function parseArgs(argv) {
  let dbPathOverride = null;
  let historyYears = 2;
  let dryRun = false;
  let referenceIso = null;
  let companyNameIfMissing = null;
  let ownerNameIfMissing = null;
  let syntheticOnboardingRecoveryKey = null;
  for (const a of argv) {
    if (a.startsWith("--db=")) {
      dbPathOverride = a.slice(5);
    } else if (a.startsWith("--history-years=")) {
      historyYears = Number(a.slice("--history-years=".length));
    } else if (a === "--dry-run") {
      dryRun = true;
    } else if (a.startsWith("--reference-iso=")) {
      referenceIso = a.slice(16);
    } else if (a.startsWith("--company-name=")) {
      companyNameIfMissing = a.slice(15);
    } else if (a.startsWith("--owner-name=")) {
      ownerNameIfMissing = a.slice(13);
    } else if (a.startsWith("--recovery-key=")) {
      syntheticOnboardingRecoveryKey = a.slice(15);
    }
  }
  const fromEnv =
    typeof process.env.GODOWN_DB === "string" && process.env.GODOWN_DB.trim()
      ? process.env.GODOWN_DB.trim()
      : null;
  const explicit = dbPathOverride ?? fromEnv;
  const resolved =
    explicit === null
      ? defaultDbPath()
      : path.isAbsolute(explicit)
        ? explicit
        : path.resolve(process.cwd(), explicit);
  if (historyYears !== 1 && historyYears !== 2) {
    console.error("--history-years must be 1 or 2");
    process.exit(1);
  }
  return {
    dbPath: resolved,
    usedDefaultDb: explicit === null,
    historyYears,
    dryRun,
    referenceIso,
    companyNameIfMissing,
    ownerNameIfMissing,
    syntheticOnboardingRecoveryKey,
  };
}

const schemaPath = path.join(root, "dist", "main", "db", "schema.js");
const enrichPath = path.join(root, "dist", "main", "db", "templateEnrichedSeed.js");

if (!fs.existsSync(schemaPath) || !fs.existsSync(enrichPath)) {
  console.error(
    "Missing compiled main output. Run: npm run build:main\nExpected:",
    schemaPath,
    "and",
    enrichPath
  );
  process.exit(1);
}

const { createSchema } = require(schemaPath);
const { enrichFromTemplates } = require(enrichPath);

const {
  dbPath,
  usedDefaultDb,
  historyYears,
  dryRun,
  referenceIso,
  companyNameIfMissing,
  ownerNameIfMissing,
  syntheticOnboardingRecoveryKey,
} = parseArgs(process.argv.slice(2));

const parent = path.dirname(dbPath);
if (!fs.existsSync(parent)) {
  fs.mkdirSync(parent, { recursive: true });
}

let referenceDate = new Date();
if (referenceIso && /^\d{4}-\d{2}-\d{2}$/.test(referenceIso)) {
  referenceDate = new Date(`${referenceIso}T12:00:00`);
}

console.warn(
  "\n*** godown-stock-lite: template enricher ***\nClose the desktop app if it is using this database.\n"
);
if (usedDefaultDb) {
  console.warn(
    "Using default app database (no --db or GODOWN_DB):\n  " + dbPath + "\n"
  );
}

const db = new Database(dbPath);
try {
  createSchema(db);
  const report = enrichFromTemplates(db, {
    referenceDate,
    historyYears,
    dryRun,
    companyNameIfMissing: companyNameIfMissing ?? undefined,
    ownerNameIfMissing: ownerNameIfMissing ?? undefined,
    syntheticOnboardingRecoveryKey:
      syntheticOnboardingRecoveryKey ?? undefined,
  });
  console.log(
    "Enrich from templates:",
    dbPath,
    usedDefaultDb ? "(default userData)" : ""
  );
  console.log("runToken:", report.runToken);
  console.log("historyYears:", historyYears);
  console.log("dryRun:", report.dryRun);
  console.log("syntheticOnboardingApplied:", report.syntheticOnboardingApplied);
  console.log(
    "counts:",
    report.insertedProducts,
    "products,",
    report.insertedLenders,
    "lenders,",
    report.insertedPurchases,
    "purchases,",
    report.insertedInvoices,
    "invoices,",
    report.insertedUsers,
    "users"
  );
  if (
    !report.dryRun &&
    (report.bootstrapItemsAdded > 0 || report.bootstrapLendersAdded > 0)
  ) {
    console.log(
      "bootstrap (empty catalog):",
      report.bootstrapItemsAdded,
      "starter products,",
      report.bootstrapLendersAdded,
      "starter lenders"
    );
  }
  if (!report.dryRun) {
    console.log("Synthetic users: PIN 0000 for each inserted user.");
    const brokenInvoiceSale = db
      .prepare(
        `SELECT COUNT(*) AS c FROM item_stock_movements m
         WHERE m.reason = 'invoice_sale'
           AND m.ref_kind = 'invoice_line'
           AND m.ref_id IS NOT NULL
           AND (SELECT il.invoice_id FROM invoice_lines il WHERE il.id = m.ref_id) IS NULL`
      )
      .get();
    if (brokenInvoiceSale && Number(brokenInvoiceSale.c) > 0) {
      console.warn(
        "Warning: invoice_sale stock rows without resolvable invoice_id:",
        brokenInvoiceSale.c,
        "(Stock history may show Open invoices instead of quick view.)"
      );
    }
  }
} finally {
  db.close();
}
