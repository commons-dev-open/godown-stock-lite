import Database from "better-sqlite3";
import fs from "node:fs";
import { app } from "electron";
import path from "node:path";
import { createSchema } from "./schema";
import { seedIfEmpty } from "./seed";

let db: Database.Database | null = null;

export function getDbPath(): string {
  const userDataPath = app.getPath("userData");
  return path.join(userDataPath, "godown.db");
}

/** Path to a flag file: when present, we skip auto-seed on next getDb() (user cleared data). */
export function getSkipSeedFlagPath(): string {
  return path.join(app.getPath("userData"), "skip-seed.flag");
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
    const skipSeedPath = getSkipSeedFlagPath();
    if (fs.existsSync(skipSeedPath)) {
      fs.unlinkSync(skipSeedPath);
    } else {
      seedIfEmpty(db);
    }
  }
  return db;
}
