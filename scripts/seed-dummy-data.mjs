#!/usr/bin/env node
/**
 * Replaces all rows in the Godown SQLite database with large **realistic** test
 * datasets (Indian wholesale / godown style: products, HSNs, GSTIN-shaped ids,
 * Kolkata-area addresses, daily sales notes). Default ~250 rows per major
 * table; opening_balance is capped to recent years; settings stay empty.
 *
 * Usage:
 *   npm run build:main && node scripts/seed-dummy-data.mjs
 *   npm run db:seed-dummy
 *
 * Options:
 *   --db=/absolute/or/relative/path/to/godown.db   (default: Electron userData path)
 *   --rows=300                                     (default: 250, max: 5000)
 *
 * WARNING: This deletes all existing application data in the target database.
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
  let dbPath = null;
  let rows = 250;
  for (const a of argv) {
    if (a.startsWith("--db=")) {
      dbPath = a.slice(5);
    } else if (a.startsWith("--rows=")) {
      rows = Number(a.slice(7));
    }
  }
  const resolved =
    dbPath === null ? defaultDbPath() : path.resolve(process.cwd(), dbPath);
  return { dbPath: resolved, rows };
}

const schemaPath = path.join(root, "dist", "main", "db", "schema.js");
const seedPath = path.join(root, "dist", "main", "db", "seedDummyBulkData.js");

if (!fs.existsSync(schemaPath) || !fs.existsSync(seedPath)) {
  console.error(
    "Missing compiled main output. Run: npm run build:main\nExpected:",
    schemaPath,
    "and",
    seedPath
  );
  process.exit(1);
}

const { createSchema } = require(schemaPath);
const { seedDummyBulkData } = require(seedPath);

const { dbPath, rows } = parseArgs(process.argv.slice(2));

const parent = path.dirname(dbPath);
if (!fs.existsSync(parent)) {
  fs.mkdirSync(parent, { recursive: true });
}

const db = new Database(dbPath);
try {
  createSchema(db);
  seedDummyBulkData(db, { rowsPerEntity: rows });
  console.log("Seeded dummy bulk data:", dbPath, "rowsPerEntity=", rows);
} finally {
  db.close();
}
