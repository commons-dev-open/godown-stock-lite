#!/usr/bin/env node
/**
 * Creates a tiny valid DB for smoke-testing db:enrich-templates (not for production).
 * Usage: cross-env ELECTRON_RUN_AS_NODE=1 electron scripts/create-minimal-db-for-enrich.mjs --db=.tmp/enrich-smoke.db
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

const schemaPath = path.join(root, "dist", "main", "db", "schema.js");
const seedPath = path.join(root, "dist", "main", "db", "seed.js");
const pinPath = path.join(root, "dist", "main", "db", "pinHash.js");
const { createSchema } = require(schemaPath);
const { seedIfEmpty } = require(seedPath);
const { createPinHash } = require(pinPath);

let dbPath = path.join(root, ".tmp", "enrich-smoke.db");
for (const a of process.argv.slice(2)) {
  if (a.startsWith("--db=")) {
    dbPath = path.resolve(process.cwd(), a.slice(5));
  }
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new Database(dbPath);
createSchema(db);
seedIfEmpty(db);
const kg = db.prepare("SELECT id FROM units WHERE name = ?").get("kilogram");
const uid = kg?.id ?? null;
db.prepare(
  "INSERT INTO items (name, code, unit, unit_id, gst_rate, hsn_code, current_stock) VALUES ('Tpl Rice','R1','bags',?,5,'10063090',100)"
).run(uid);
db.prepare(
  "INSERT INTO lenders (name, address, phone, gstin) VALUES ('Tpl Mahajan','Kolkata','9812345678','19AAAAA0001A1Z5')"
).run();
db.prepare(
  "INSERT INTO users (name, pin_hash, role, pin_is_temporary, is_active) VALUES ('Owner', ?, 'superadmin', 0, 1)"
).run(createPinHash("4242"));
db.close();
console.log("Wrote minimal DB:", dbPath);
